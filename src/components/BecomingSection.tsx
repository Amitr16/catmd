/**
 * BecomingSection — circular progress wheel + collapsible facet rows.
 *
 * Lives inside the Personality screen as the "how [cat] is taking
 * shape" section. Replaces the earlier dedicated /becoming screen
 * and the standalone Bond-tab tile, which the user found cluttered
 * and the stage labels ("a glimpse" / "getting to know you") clunky.
 *
 * Layout:
 *   1. Circular SVG progress wheel (big % in center, label below)
 *   2. Accordion: 7 facet rows, each tap-to-expand
 *      Collapsed: icon + name + count
 *      Expanded: description + CTA button
 *
 * The wheel uses `react-native-svg` (already installed) for a clean
 * circular stroke. No external animation library — the % value
 * renders statically; on this screen the user isn't watching it
 * tick, they're seeing a snapshot.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CaretDown,
  CaretRight,
  Camera as CameraIcon,
  ChatCircle,
  Clock,
  MaskHappy,
  NotePencil,
  PlayCircle,
  UsersThree,
} from 'phosphor-react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import {
  deriveBecoming,
  type Facet,
  type FacetId,
} from '../services/becoming';
import { useHealthStore } from '../state/healthStore';
import { useChatStore } from '../state/chatStore';
import { usePhotoStudioStore } from '../state/photoStudioStore';
import { useSubjectsForCat } from '../state/subjectDirectoryStore';
import { useDiaryEntriesForCat } from '../state/diaryStore';
import { usePersonalityQuizAnswered } from '../state/personalityStore';
import { track } from '../services/analytics';

const WHEEL_SIZE = 140;
const WHEEL_STROKE = 12;
const WHEEL_RADIUS = (WHEEL_SIZE - WHEEL_STROKE) / 2;
const WHEEL_CIRCUMFERENCE = 2 * Math.PI * WHEEL_RADIUS;

type Props = {
  catId: string;
  catName: string;
};

export function BecomingSection({ catId, catName }: Props) {
  const t = useTheme();
  const router = useRouter();
  const [expandedFacet, setExpandedFacet] = useState<FacetId | null>(null);

  // ── Pull live store state ──
  const photos = usePhotoStudioStore((s) => s.photos[catId] ?? EMPTY_PHOTOS);
  const allEvents = useHealthStore((s) => s.events);
  const events = useMemo(
    () => allEvents.filter((e) => e.cat_id === catId),
    [allEvents, catId],
  );
  const chatTurnCount = useChatStore(
    (s) => (s.threads[catId] ?? EMPTY_TURNS).length,
  );
  const subjects = useSubjectsForCat(catId);
  const diaryEntries = useDiaryEntriesForCat(catId);
  const personalityAnswered = usePersonalityQuizAnswered(catId);

  // ── Derive Becoming snapshot ──
  const becoming = useMemo(() => {
    const bodyLanguageSessionCount = events.filter(
      (e) => e.type === 'behavior_observation',
    ).length;
    const checkinStreak = countCheckinStreak(events);
    return deriveBecoming({
      photoCount: photos.length,
      chatTurnCount,
      bodyLanguageSessionCount,
      checkinStreak,
      namedSubjectsCount: subjects.length,
      personalityArchetypeSet: personalityAnswered,
      diaryEntryCount: diaryEntries.length,
      previousStages: null,
    });
  }, [
    photos.length,
    events,
    chatTurnCount,
    subjects.length,
    personalityAnswered,
    diaryEntries.length,
  ]);

  const onTapFacet = (facet: Facet) => {
    setExpandedFacet((curr) => (curr === facet.id ? null : facet.id));
  };

  const onTapCta = (facet: Facet) => {
    track({
      type: 'becoming_facet_cta_tapped',
      props: { facet: facet.id, stage: facet.stage },
    });
    router.push(facet.ctaRoute as never);
  };

  return (
    <View style={{ marginTop: space[6] }}>
      {/* Section header */}
      <Text
        token="caption"
        color="textMuted"
        style={{
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: space[3],
        }}
      >
        How {catName} is taking shape
      </Text>

      {/* Progress wheel */}
      <View
        style={[
          styles.wheelCard,
          { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
        ]}
      >
        <ProgressWheel
          percent={becoming.depth}
          stageLabel={becoming.overallStage}
        />
        <Text
          token="body"
          color="textMuted"
          style={{
            marginTop: space[3],
            textAlign: 'center',
            lineHeight: 21,
            paddingHorizontal: space[3],
          }}
        >
          {wheelHelper(becoming.depth, catName)}
        </Text>
      </View>

      {/* Facet accordion */}
      <View style={{ marginTop: space[4], gap: 8 }}>
        {becoming.facets.map((facet) => (
          <FacetRow
            key={facet.id}
            facet={facet}
            expanded={expandedFacet === facet.id}
            onTap={() => onTapFacet(facet)}
            onCta={() => onTapCta(facet)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Progress wheel (SVG)
// ---------------------------------------------------------------------------

function ProgressWheel({
  percent,
  stageLabel,
}: {
  percent: number;
  stageLabel: string;
}) {
  const t = useTheme();
  // Stroke offset for the progress arc.
  // strokeDashoffset shrinks as percent grows (full circle - filled portion).
  const filledPortion = (percent / 100) * WHEEL_CIRCUMFERENCE;
  const offset = WHEEL_CIRCUMFERENCE - filledPortion;

  return (
    <View
      style={{
        width: WHEEL_SIZE,
        height: WHEEL_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
        {/* Background ring (full circle, faint) */}
        <Circle
          cx={WHEEL_SIZE / 2}
          cy={WHEEL_SIZE / 2}
          r={WHEEL_RADIUS}
          stroke={t.borderSubtle}
          strokeWidth={WHEEL_STROKE}
          fill="transparent"
        />
        {/* Filled progress arc — rotated -90° so it starts at top */}
        <Circle
          cx={WHEEL_SIZE / 2}
          cy={WHEEL_SIZE / 2}
          r={WHEEL_RADIUS}
          stroke={t.secondary500}
          strokeWidth={WHEEL_STROKE}
          fill="transparent"
          strokeDasharray={WHEEL_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          // Rotate so 0° starts at the 12-o-clock position (instead of 3-o-clock)
          transform={`rotate(-90 ${WHEEL_SIZE / 2} ${WHEEL_SIZE / 2})`}
        />
      </Svg>
      {/* Center text — overlaid on top of the SVG */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          token="displayLg"
          style={{
            fontFamily: 'JetBrainsMono_500Medium',
            color: t.secondary900,
            fontSize: 36,
            lineHeight: 40,
          }}
        >
          {percent}
          <Text style={{ fontSize: 18, color: t.textMuted }}>%</Text>
        </Text>
        <Text
          token="caption"
          color="textMuted"
          style={{
            marginTop: 2,
            textTransform: 'capitalize',
            textAlign: 'center',
            paddingHorizontal: 8,
            fontSize: 11,
          }}
        >
          {stageLabel}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Facet row (collapsible)
// ---------------------------------------------------------------------------

function FacetRow({
  facet,
  expanded,
  onTap,
  onCta,
}: {
  facet: Facet;
  expanded: boolean;
  onTap: () => void;
  onCta: () => void;
}) {
  const t = useTheme();
  const Icon = facetIcon(facet.id);

  return (
    <View
      style={[
        styles.facetCard,
        { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
      ]}
    >
      <Pressable onPress={onTap} accessibilityRole="button" accessibilityLabel={`${facet.label}, ${facet.stage}`}>
        <View style={styles.facetHeader}>
          <View
            style={[
              styles.facetBadge,
              {
                backgroundColor:
                  facet.stage === 'unseen' ? t.surfaceSunken : t.secondary100,
              },
            ]}
          >
            <Icon
              size={18}
              color={facet.stage === 'unseen' ? t.textMuted : t.secondary700}
              weight="duotone"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
              {facet.label}
            </Text>
            <Text
              token="caption"
              color="textMuted"
              style={{ marginTop: 1, fontSize: 12 }}
            >
              {facetCountLabel(facet)}
            </Text>
          </View>
          {/* Mini progress bar */}
          <View style={{ alignItems: 'flex-end' }}>
            <View
              style={[
                styles.miniBar,
                { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
              ]}
            >
              <View
                style={[
                  styles.miniBarFill,
                  {
                    width: `${stageToPct(facet.stage)}%`,
                    backgroundColor:
                      facet.stage === 'unseen' ? t.textMuted : t.secondary500,
                  },
                ]}
              />
            </View>
            <Text
              token="caption"
              color="textMuted"
              style={{ marginTop: 4, fontSize: 10, textTransform: 'capitalize' }}
            >
              {facet.stage}
            </Text>
          </View>
          {expanded ? (
            <CaretDown size={14} color={t.textMuted} />
          ) : (
            <CaretRight size={14} color={t.textMuted} />
          )}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.facetExpanded}>
          <View style={[styles.divider, { backgroundColor: t.borderSubtle }]} />
          <Text
            token="body"
            style={{
              color: t.textSecondary,
              fontStyle: 'italic',
              lineHeight: 21,
            }}
          >
            {facet.description}
          </Text>
          {facet.nextMilestone ? (
            <Text
              token="caption"
              color="textMuted"
              style={{ marginTop: space[2], fontSize: 12 }}
            >
              Next: {facet.nextMilestone.label.toLowerCase()} at {facet.nextMilestone.value}
            </Text>
          ) : null}
          <Pressable
            onPress={onCta}
            style={({ pressed }) => [
              styles.ctaBtn,
              {
                backgroundColor: t.primary500,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              token="caption"
              style={{
                color: t.textInverse,
                fontFamily: 'Figtree_600SemiBold',
              }}
            >
              {facet.ctaLabel}
            </Text>
            <CaretRight size={14} color={t.textInverse} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function facetIcon(id: FacetId) {
  switch (id) {
    case 'face':
      return CameraIcon;
    case 'voice':
      return ChatCircle;
    case 'body':
      return PlayCircle;
    case 'rhythm':
      return Clock;
    case 'family':
      return UsersThree;
    case 'nature':
      return MaskHappy;
    case 'memory':
      return NotePencil;
  }
}

function facetCountLabel(facet: Facet): string {
  const v = facet.currentValue;
  switch (facet.id) {
    case 'face':
      return v === 0 ? 'no photos yet' : `${v} ${v === 1 ? 'photo' : 'photos'}`;
    case 'voice':
      return v === 0 ? 'no chats yet' : `${v} ${v === 1 ? 'chat turn' : 'chat turns'}`;
    case 'body':
      return v === 0 ? 'never watched' : `${v} ${v === 1 ? 'session' : 'sessions'}`;
    case 'rhythm':
      return v === 0 ? 'no streak yet' : `${v}-day streak`;
    case 'family':
      return v === 0 ? 'no one tagged' : `${v} ${v === 1 ? 'name' : 'names'}`;
    case 'nature':
      return v === 0 ? 'quiz not done' : 'archetype set';
    case 'memory':
      return v === 0 ? 'no diary days' : `${v} ${v === 1 ? 'diary day' : 'diary days'}`;
  }
}

function stageToPct(stage: Facet['stage']): number {
  switch (stage) {
    case 'unseen':
      return 5;
    case 'glimpsed':
      return 25;
    case 'familiar':
      return 55;
    case 'known':
      return 80;
    case 'deep':
      return 100;
  }
}

function wheelHelper(depth: number, catName: string): string {
  // Every stage explicitly names what the score DRIVES (chat replies,
  // diary, daily card, postcards) so the user understands the data
  // loop: more activities → richer score → more authentic ${catName}
  // voice across every surface. See marketing/chat-as-viral-lever.md.
  if (depth < 10) {
    return `Every photo, chat turn, check-in and named person sharpens the ${catName} who replies in chat, writes the diary, and shows up on the daily card.`;
  }
  if (depth < 45) {
    return `${catName} is starting to take shape. Keep logging — chat replies, the diary, the daily card and postcards all get sharper as ${catName}'s self grows.`;
  }
  if (depth < 75) {
    return `${catName} is settling in. The ${catName} in the app is starting to sound like the ${catName} at home — chat, diary, daily card, all drawing from a real self.`;
  }
  return `${catName} is fully formed. Chat replies, the diary, the daily card, postcards and posters all speak in ${catName}'s real voice now.`;
}

function countCheckinStreak(
  events: { type: string; ts: string }[],
): number {
  const checkinDates = new Set<string>();
  for (const e of events) {
    if (e.type !== 'daily_checkin') continue;
    try {
      const d = new Date(e.ts);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      checkinDates.add(k);
    } catch {
      // skip
    }
  }
  if (checkinDates.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  let firstHit = false;
  for (let i = 0; i < 365; i += 1) {
    const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (checkinDates.has(k)) {
      firstHit = true;
      streak += 1;
    } else if (firstHit) {
      break;
    } else if (i > 0) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Stable empty constants for Zustand selectors that fall back when
// the cat has no records yet. Inline `?? []` returns a new array
// reference each call → infinite re-render loop. Same fix as the
// SubjectTagSheet pitfall.
const EMPTY_PHOTOS: never[] = Object.freeze([]) as never;
const EMPTY_TURNS: never[] = Object.freeze([]) as never;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wheelCard: {
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  facetCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  facetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
  },
  facetBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBar: {
    width: 60,
    height: 4,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  facetExpanded: {
    paddingHorizontal: space[3],
    paddingBottom: space[4],
    paddingTop: 0,
  },
  divider: {
    height: 1,
    marginBottom: space[3],
  },
  ctaBtn: {
    marginTop: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
