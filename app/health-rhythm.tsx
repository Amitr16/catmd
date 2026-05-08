/**
 * Health Rhythm screen — 30-day pattern surface for the Today tab.
 *
 * Composition:
 *   1. Header — cat avatar + title + "[N]/30 days logged · Y-day streak"
 *   2. Drift cards — concern → watch → good. Tappable when there's a
 *      sensible deep-link target (weight → /health/weight, mood/appetite
 *      → /health/symptom-timeline, scans → /health/symptom-timeline,
 *      streak → no-op).
 *   3. Mood timeline — 30 daily slots, color-coded.
 *   4. Appetite timeline — 30 daily slots, color-coded.
 *   5. Weight sparkline — last ~8 weight measurements as a polyline.
 *   6. Activity heatmap — per-day event count as bar height.
 *   7. Scan mix — small breakdown by urgency tier.
 *   8. Top behaviour-observation tags — chips.
 *
 * No third-party charting lib — every chart is plain RN Views with
 * positional flex/absolute layout. Keeps the bundle small + dodges the
 * react-native-svg native-link hazards we've already paid for in
 * Cat Diary / Cat Studio.
 *
 * No new ML in this screen. All signal lives in `services/healthRhythm.ts`
 * which deterministically aggregates events the user has already logged.
 */
import { useEffect, useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CaretRight,
  ChartLine,
  Cat as CatIcon,
  Flame,
  HandHeart,
  Heart,
  Heartbeat,
  Plus,
  Scales,
  Stethoscope,
  WarningCircle,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useHealthStore } from '../src/state/healthStore';
import { useScanStore } from '../src/state/scanStore';
import {
  buildHealthRhythmSnapshot,
  DEFAULT_WINDOW_DAYS,
  type DriftSignal,
  type HealthRhythmSnapshot,
} from '../src/services/healthRhythm';
import { track } from '../src/services/analytics';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function HealthRhythmScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();

  // Subscribe to the raw arrays so the snapshot recomputes when events
  // change. Both stores are lightweight; recomputing the 30-day window
  // is O(N) over the recent slice and well under a millisecond.
  const events = useHealthStore((s) => s.events);
  const scans = useScanStore((s) => s.scans);

  const snapshot: HealthRhythmSnapshot | null = useMemo(() => {
    if (!cat?.id) return null;
    return buildHealthRhythmSnapshot({
      catId: cat.id,
      events,
      scans,
      windowDays: DEFAULT_WINDOW_DAYS,
    });
  }, [cat?.id, events, scans]);

  // Telemetry: once per cat per mount. Fire after snapshot exists so we
  // can attach drift counts.
  useEffect(() => {
    if (!cat?.id || !snapshot) return;
    track({
      type: 'health_rhythm_opened',
      props: {
        days_logged: snapshot.daysLogged,
        streak_days: snapshot.currentStreakDays,
        drift_count: snapshot.drift.length,
        has_concern: snapshot.drift.some((d) => d.severity === 'concern'),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={{ padding: space[6] }}>
          <Text token="body" color="textMuted">Add a cat first — Settings → Manage cats.</Text>
        </View>
      </View>
    );
  }

  if (!snapshot) return null;

  const onDriftTap = (signal: DriftSignal) => {
    track({
      type: 'health_rhythm_drift_tapped',
      props: { kind: signal.kind, severity: signal.severity },
    });
    switch (signal.kind) {
      case 'weight':
        router.push('/health/weight' as never);
        return;
      case 'scans':
        router.push('/health/symptom-timeline' as never);
        return;
      case 'mood':
      case 'appetite':
        // Symptom timeline is the closest place to see the raw events
        // contributing to the drift. v2: route to a "Drift detail" page.
        router.push('/health/symptom-timeline' as never);
        return;
      case 'srr':
        router.push('/health/srr' as never);
        return;
      case 'streak':
        // No deep-link — streak is informational. Tap is a no-op.
        return;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} title="Health Rhythm" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* === Identity strip === */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            marginTop: space[5],
            marginBottom: space[4],
          }}
        >
          <CatAvatar uri={cat.photo_uri ?? null} size={48} />
          <View style={{ flex: 1 }}>
            <Text token="heading2" numberOfLines={1}>
              {cat.name}
            </Text>
            <Text token="caption" color="textMuted">
              Last {snapshot.windowDays} days · {snapshot.daysLogged} days
              logged · {snapshot.currentStreakDays}-day streak
            </Text>
          </View>
        </View>

        {/* === Drift cards === */}
        {snapshot.drift.length > 0 ? (
          <View style={{ gap: space[2], marginBottom: space[6] }}>
            {snapshot.drift.map((d) => (
              <DriftCard key={d.id} signal={d} onPress={() => onDriftTap(d)} />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyDrift,
              { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
            ]}
          >
            <Heart size={20} color={t.success} weight="duotone" />
            <Text token="caption" color="textMuted" style={{ flex: 1 }}>
              {snapshot.daysLogged < 3
                ? `Log a few daily check-ins so we can read the rhythm.`
                : `Nothing concerning right now — keep the daily check-ins coming.`}
            </Text>
          </View>
        )}

        {/* === Mood timeline === */}
        <SectionHeader
          icon={<HandHeart size={18} color={t.primary700} weight="duotone" />}
          title="Mood"
          subtitle={`${snapshot.moodCounts.happy} happy · ${snapshot.moodCounts.normal} normal · ${snapshot.moodCounts.off} off`}
        />
        <MoodTimeline snapshot={snapshot} />

        {/* === Appetite timeline === */}
        <SectionHeader
          icon={<Stethoscope size={18} color={t.primary700} weight="duotone" />}
          title="Appetite"
          subtitle={`${snapshot.appetiteCounts.full} full · ${snapshot.appetiteCounts.half} half · ${snapshot.appetiteCounts.none} none`}
        />
        <AppetiteTimeline snapshot={snapshot} />

        {/* === Weight === */}
        <SectionHeader
          icon={<Scales size={18} color={t.primary700} weight="duotone" />}
          title="Weight"
          subtitle={
            snapshot.latestWeightKg != null
              ? `${snapshot.latestWeightKg.toFixed(2)} kg latest${
                  snapshot.firstWeightKg != null && snapshot.weightSeries.length >= 2
                    ? ` · ${formatPctChange(snapshot.firstWeightKg, snapshot.latestWeightKg)} in window`
                    : ''
                }`
              : 'No weight measurements yet'
          }
        />
        {snapshot.weightSeries.length >= 2 ? (
          <WeightSparkline snapshot={snapshot} />
        ) : (
          <EmptyChart
            label="Add at least 2 weight measurements to see the trend"
            actionLabel="Log weight"
            onAction={() => router.push('/health/weight' as never)}
          />
        )}

        {/* === Activity intensity === */}
        <SectionHeader
          icon={<Flame size={18} color={t.primary700} weight="duotone" />}
          title="Activity"
          subtitle={`Events logged per day. ${
            snapshot.days.reduce((acc, d) => acc + d.activityCount, 0)
          } total in window.`}
        />
        <ActivityHeatmap snapshot={snapshot} />

        {/* === Scan mix === */}
        <SectionHeader
          icon={<Heartbeat size={18} color={t.primary700} weight="duotone" />}
          title="Scans"
          subtitle={
            snapshot.scanCount === 0
              ? 'No triage scans this window'
              : `${snapshot.scanCount} scan${snapshot.scanCount === 1 ? '' : 's'} this window`
          }
        />
        {snapshot.scanCount > 0 ? <ScanMix snapshot={snapshot} /> : null}

        {/* === Behaviour observation tags === */}
        {snapshot.topBehaviorTags.length > 0 ? (
          <>
            <SectionHeader
              icon={<ChartLine size={18} color={t.primary700} weight="duotone" />}
              title="Behaviour reads"
              subtitle={`Most-frequent tags from Read-${cat.name} sessions`}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[6] }}>
              {snapshot.topBehaviorTags.map((entry) => (
                <View
                  key={entry.tag}
                  style={[
                    styles.tagChip,
                    { backgroundColor: t.secondary100, borderColor: t.secondary500 },
                  ]}
                >
                  <Text
                    token="caption"
                    style={{
                      color: t.secondary900,
                      fontFamily: 'Figtree_600SemiBold',
                    }}
                  >
                    {entry.tag} · {entry.count}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text
          token="caption"
          color="textMuted"
          style={{ textAlign: 'center', lineHeight: 18, marginTop: space[4] }}
        >
          Health Rhythm reads only what you&apos;ve already logged — no
          recordings, no background sensors. The more daily check-ins
          land, the sharper the picture.
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header + section header
// ---------------------------------------------------------------------------

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
        <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
      </Pressable>
      <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
        {title ?? 'Health Rhythm'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[6], marginBottom: space[3] }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text token="heading3">{title}</Text>
        {subtitle ? (
          <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Drift card
// ---------------------------------------------------------------------------

function DriftCard({
  signal,
  onPress,
}: {
  signal: DriftSignal;
  onPress: () => void;
}) {
  const t = useTheme();
  const tappable = signal.kind !== 'streak';

  // Severity → palette. Earth-tone aesthetic: backgrounds are all
  // surfaceElevated (subtle), differentiated by border + icon colour
  // only. This matches the existing card-pattern across the app and
  // dodges palette-token additions.
  const palette = (() => {
    switch (signal.severity) {
      case 'concern':
        return {
          border: t.warning,
          icon: <WarningCircle size={20} color={t.warning} weight="fill" />,
        };
      case 'watch':
        return {
          border: t.primary500,
          icon: <ChartLine size={20} color={t.primary700} weight="bold" />,
        };
      case 'good':
        return {
          border: t.success,
          icon: <Heart size={20} color={t.success} weight="fill" />,
        };
    }
  })();

  const inner = (
    <View style={[styles.driftCard, { backgroundColor: t.surfaceElevated, borderColor: palette.border }]}>
      <View style={{ marginTop: 2 }}>{palette.icon}</View>
      <View style={{ flex: 1 }}>
        <Text token="heading3" style={{ marginBottom: 2 }}>
          {signal.headline}
        </Text>
        <Text token="caption" color="textMuted" style={{ lineHeight: 18 }}>
          {signal.detail}
        </Text>
      </View>
      {tappable ? <CaretRight size={18} color={t.textMuted} /> : null}
    </View>
  );

  if (!tappable) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {inner}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Mood + appetite timelines
// ---------------------------------------------------------------------------

function MoodTimeline({ snapshot }: { snapshot: HealthRhythmSnapshot }) {
  const t = useTheme();
  // Color map using palette tokens. "off" uses warning (concern), "happy"
  // uses success (positive), "normal" uses primary500 (neutral sage),
  // null = empty placeholder bar.
  const colorOf = (mood: typeof snapshot.days[number]['mood']): string => {
    switch (mood) {
      case 'happy':
        return t.success;
      case 'normal':
        return t.primary500;
      case 'off':
        return t.warning;
      default:
        return t.borderSubtle;
    }
  };
  return (
    <View>
      <View style={styles.timelineRow}>
        {snapshot.days.map((d) => (
          <View
            key={d.dateKey}
            style={[
              styles.timelineCell,
              {
                backgroundColor: colorOf(d.mood),
                opacity: d.mood ? 1 : 0.35,
              },
            ]}
          />
        ))}
      </View>
      <TimelineAxis snapshot={snapshot} />
      <Legend
        items={[
          { label: 'happy', color: t.success },
          { label: 'normal', color: t.primary500 },
          { label: 'off', color: t.warning },
          { label: 'no log', color: t.borderSubtle, faded: true },
        ]}
      />
    </View>
  );
}

function AppetiteTimeline({ snapshot }: { snapshot: HealthRhythmSnapshot }) {
  const t = useTheme();
  const colorOf = (a: typeof snapshot.days[number]['appetite']): string => {
    switch (a) {
      case 'full':
        return t.success;
      case 'half':
        return t.warning;
      case 'none':
        // Anorexia is the most clinically significant — use error red if
        // the theme has it, else warning. theme.error exists in tokens.
        return t.error;
      default:
        return t.borderSubtle;
    }
  };
  return (
    <View>
      <View style={styles.timelineRow}>
        {snapshot.days.map((d) => (
          <View
            key={d.dateKey}
            style={[
              styles.timelineCell,
              {
                backgroundColor: colorOf(d.appetite),
                opacity: d.appetite ? 1 : 0.35,
              },
            ]}
          />
        ))}
      </View>
      <TimelineAxis snapshot={snapshot} />
      <Legend
        items={[
          { label: 'full', color: t.success },
          { label: 'half', color: t.warning },
          { label: 'none', color: t.error },
          { label: 'no log', color: t.borderSubtle, faded: true },
        ]}
      />
    </View>
  );
}

/**
 * Sparse axis: show date labels at start, middle, end, and ~10-day
 * intervals. Avoids an unreadable 30-label row.
 */
function TimelineAxis({ snapshot }: { snapshot: HealthRhythmSnapshot }) {
  const t = useTheme();
  const total = snapshot.days.length;
  if (total === 0) return null;
  const positions = [0, Math.floor(total / 2), total - 1];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
      {positions.map((idx, i) => {
        const day = snapshot.days[idx];
        if (!day) return <View key={i} />;
        const [, m, d] = day.dateKey.split('-');
        return (
          <Text key={`${day.dateKey}-${i}`} token="caption" style={{ color: t.textMuted, fontSize: 10 }}>
            {m && d ? `${parseInt(m, 10)}/${parseInt(d, 10)}` : day.weekdayShort}
          </Text>
        );
      })}
    </View>
  );
}

function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; faded?: boolean }>;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginTop: space[2] }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: item.color,
              opacity: item.faded ? 0.35 : 1,
            }}
          />
          <Text token="caption" color="textMuted" style={{ fontSize: 11 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weight sparkline — pure-View polyline via positioned dots + lines
// ---------------------------------------------------------------------------
//
// The naive "stretch a row of bars" approach reads as a histogram; for
// weight we want a TREND. Without react-native-svg, the cheapest honest
// trendline is a row of absolutely-positioned dots whose Y is mapped to
// (max - kg) / range of the series. We connect adjacent dots with thin
// lines drawn as rotated 1px-tall Views.

function WeightSparkline({ snapshot }: { snapshot: HealthRhythmSnapshot }) {
  const t = useTheme();
  const { weightSeries } = snapshot;
  if (weightSeries.length < 2) return null;

  const max = Math.max(...weightSeries.map((p) => p.weightKg));
  const min = Math.min(...weightSeries.map((p) => p.weightKg));
  // Pad the range a bit so flat-ish series still show variation.
  const pad = Math.max(0.05, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo;

  const HEIGHT = 110;

  // Compute relative (0..1) coords for each point.
  const coords = weightSeries.map((p, i) => ({
    x: weightSeries.length === 1 ? 0.5 : i / (weightSeries.length - 1),
    y: 1 - (p.weightKg - lo) / range, // 0 = top, 1 = bottom
    weightKg: p.weightKg,
    dateKey: p.dateKey,
  }));

  return (
    <View
      style={[
        styles.sparkContainer,
        { height: HEIGHT, backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
      ]}
    >
      {/* Connecting lines between adjacent dots */}
      {coords.slice(0, -1).map((p, i) => {
        const next = coords[i + 1]!;
        return <SparkLine key={`l-${i}`} from={p} to={next} color={t.primary500} />;
      })}
      {/* Dots */}
      {coords.map((p, i) => (
        <View
          key={`d-${i}`}
          style={{
            position: 'absolute',
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
            borderRadius: 4,
            backgroundColor: t.primary700,
          }}
        />
      ))}
      {/* Min + max kg labels */}
      <Text
        token="caption"
        color="textMuted"
        style={{ position: 'absolute', top: 4, right: 8, fontSize: 10 }}
      >
        {hi.toFixed(2)}
      </Text>
      <Text
        token="caption"
        color="textMuted"
        style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 10 }}
      >
        {lo.toFixed(2)}
      </Text>
    </View>
  );
}

/**
 * One spark-line segment between two normalised points. Layout-only —
 * no transforms, no nested SVG, just a thin View whose width is the
 * Euclidean distance and whose rotation matches the segment angle.
 */
function SparkLine({
  from,
  to,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}) {
  // We need a parent width to compute pixel coordinates. The container
  // sets aspectRatio implicitly via fixed height + flex width, so we
  // place the line in % terms with rotation. The angle (deg) computes
  // from normalised dx/dy weighted by the container's aspect — we don't
  // know it exactly, so this is a best-effort visual cue. RN's `transform`
  // on percentage-positioned elements rotates around the layer origin.
  // Visually the trend reads correctly with a small angle tolerance.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // We approximate widthPercent via dx (RN's % positioning is
  // axis-independent, and rotation handles the slope).
  const widthPercent = Math.sqrt(dx * dx + dy * dy) * 100;
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: `${from.x * 100}%`,
        top: `${from.y * 100}%`,
        width: `${widthPercent}%`,
        height: 2,
        backgroundColor: color,
        opacity: 0.6,
        transform: [{ rotateZ: `${angleDeg}deg` }],
        transformOrigin: 'left center',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Activity heatmap — 30 columns, height ∝ event count
// ---------------------------------------------------------------------------

function ActivityHeatmap({ snapshot }: { snapshot: HealthRhythmSnapshot }) {
  const t = useTheme();
  const max = Math.max(1, ...snapshot.days.map((d) => d.activityCount));
  return (
    <View>
      <View style={styles.heatmapRow}>
        {snapshot.days.map((d) => {
          const ratio = d.activityCount === 0 ? 0 : d.activityCount / max;
          return (
            <View
              key={d.dateKey}
              style={{
                flex: 1,
                height: 56,
                justifyContent: 'flex-end',
              }}
            >
              <View
                style={{
                  height: `${Math.max(8, ratio * 100)}%`,
                  backgroundColor: ratio === 0 ? t.borderSubtle : t.primary500,
                  borderRadius: 2,
                  opacity: ratio === 0 ? 0.3 : 0.6 + ratio * 0.4,
                }}
              />
            </View>
          );
        })}
      </View>
      <TimelineAxis snapshot={snapshot} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scan mix — 4 segments stacked horizontally
// ---------------------------------------------------------------------------

function ScanMix({ snapshot }: { snapshot: HealthRhythmSnapshot }) {
  const t = useTheme();
  const total = snapshot.scanCount;
  const segments = [
    { label: 'routine', count: snapshot.scanUrgencyMix.routine, color: t.success },
    { label: 'monitor', count: snapshot.scanUrgencyMix.monitor, color: t.primary500 },
    { label: 'concern', count: snapshot.scanUrgencyMix.concern, color: t.warning },
    { label: 'urgent', count: snapshot.scanUrgencyMix.urgent, color: t.error },
  ].filter((s) => s.count > 0);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          height: 14,
          borderRadius: 7,
          overflow: 'hidden',
          backgroundColor: t.borderSubtle,
        }}
      >
        {segments.map((s) => (
          <View
            key={s.label}
            style={{
              flex: s.count,
              backgroundColor: s.color,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginTop: space[2] }}>
        {segments.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: s.color,
              }}
            />
            <Text token="caption" color="textMuted" style={{ fontSize: 11 }}>
              {s.label} · {s.count} of {total}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty-state chart row (used by Weight when there's <2 measurements)
// ---------------------------------------------------------------------------

function EmptyChart({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onAction}
      style={({ pressed }) => [
        styles.emptyChart,
        {
          backgroundColor: t.surfaceElevated,
          borderColor: t.borderSubtle,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text token="caption" color="textMuted" style={{ flex: 1, lineHeight: 18 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: space[3],
          paddingVertical: 6,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: t.primary500,
          backgroundColor: t.primary100,
        }}
      >
        <Plus size={12} color={t.primary900} weight="bold" />
        <Text
          token="caption"
          style={{ color: t.primary900, fontFamily: 'Figtree_600SemiBold' }}
        >
          {actionLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CatAvatar({ uri, size = 48 }: { uri: string | null; size?: number }) {
  const t = useTheme();
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          ...dims,
          borderWidth: 2,
          borderColor: t.borderSubtle,
        }}
      />
    );
  }
  return (
    <View
      style={{
        ...dims,
        borderWidth: 2,
        borderColor: t.borderSubtle,
        backgroundColor: t.secondary100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CatIcon size={size * 0.5} color={t.secondary700} weight="duotone" />
    </View>
  );
}

function formatPctChange(from: number, to: number): string {
  if (from <= 0) return '';
  const pct = ((to - from) / from) * 100;
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyDrift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[6],
  },
  driftCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 2,
    height: 36,
    alignItems: 'stretch',
  },
  timelineCell: {
    flex: 1,
    borderRadius: 2,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
  },
  sparkContainer: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space[3],
    position: 'relative',
  },
  emptyChart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tagChip: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
