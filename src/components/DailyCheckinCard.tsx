/**
 * Daily check-in card — the P0 retention lever.
 *
 * Purpose: transforms CatMD from an episodic crisis tool to a daily
 * habit. 10 seconds of owner input per day:
 *   - mood    (happy / normal / off)
 *   - appetite (full / half / none)
 *   - optional note
 *
 * The data feeds two downstream systems later:
 *   1. Streak gamification (shown inline) — a simple "🔥 N day streak"
 *      counter creates habit pressure.
 *   2. Anomaly baseline — 30 days of "normal" establishes what's off for
 *      this specific cat, which powers smarter triage suggestions.
 *
 * Product rationale: Tably (cat competitor) has no daily hook — users
 * only open when worried. DogMD same. Woofz (adjacent dog-training app
 * at $20M ARR) has a daily loop and it's the single biggest difference.
 * This card closes that gap for CatMD.
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BowlFood,
  CaretDown,
  CaretRight,
  CheckCircle,
  Drop,
  Flame,
  Heartbeat,
  Scales,
  Toilet,
  X,
} from 'phosphor-react-native';
import { Text } from './Text';
import {
  dailyCheckinStreak,
  todaysCheckin,
  useHealthStore,
  type DailyCheckinPayload,
  type HealthEvent,
} from '../state/healthStore';
import { useActiveCat } from '../hooks/useActiveCat';
import { useScanStore } from '../state/scanStore';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import { computeAdjustedScore } from '../services/healthScore';
import { getPronouns } from '../services/pronouns';

type Mood = DailyCheckinPayload['mood'];
type Appetite = DailyCheckinPayload['appetite'];

const MOOD_OPTIONS: { key: Mood; label: string; emoji: string }[] = [
  { key: 'happy', label: 'Happy', emoji: '\uD83D\uDE3A' },     // 😺
  { key: 'normal', label: 'Normal', emoji: '\uD83D\uDE3C' },   // 😼
  { key: 'off', label: 'Off', emoji: '\uD83D\uDE3F' },          // 😿
];

const APPETITE_OPTIONS: { key: Appetite; label: string; emoji: string }[] = [
  { key: 'full', label: 'Full bowl', emoji: '\uD83C\uDF7D\uFE0F' },  // 🍽️
  { key: 'half', label: 'Half', emoji: '\uD83E\uDD63' },              // 🥣
  { key: 'none', label: 'Didn\u2019t eat', emoji: '\u274C' },          // ❌
];

// ─── Track-more chip config ─────────────────────────────────────
//
// The "Track more about {Cat} this week" strip below the check-in
// card surfaces under-tracked Health Rhythm inputs. Weight is the
// flagship one — the 90-day weight-trend drift card can't fire
// without >=2 measurements, and the only entry today is buried 3
// taps deep inside Triage > Health > Weight.
//
// Each chip computes its OWN staleness rule and renders ONLY when
// stale. A chip that's fresh (recently logged) disappears, so the
// strip stays uncluttered.
//
// SRR is breed-conditional — only surfaced for HCM-risk breeds.
// Source: AAFP / ACVIM consensus on hereditary feline cardiomyopathy.
const HCM_RISK_BREEDS = new Set([
  'maine coon',
  'ragdoll',
  'sphynx',
  'persian',
  'british shorthair',
  'british longhair',
  'bengal',
  'norwegian forest',
  'siberian',
]);

function isHcmRiskBreed(breed: string | null | undefined): boolean {
  if (!breed) return false;
  const key = breed.toLowerCase().trim();
  if (HCM_RISK_BREEDS.has(key)) return true;
  for (const name of HCM_RISK_BREEDS) {
    if (key.includes(name)) return true;
  }
  return false;
}

/** Days since the most recent event of a given type for this cat. */
function daysSinceLastEvent(
  events: HealthEvent[],
  catId: string,
  type: HealthEvent['type'],
): number | null {
  let mostRecent = 0;
  for (const e of events) {
    if (e.cat_id !== catId || e.type !== type) continue;
    const ms = new Date(e.ts).getTime();
    if (ms > mostRecent) mostRecent = ms;
  }
  if (mostRecent === 0) return null;
  return Math.floor((Date.now() - mostRecent) / (24 * 60 * 60 * 1000));
}

type TrackerChip = {
  key: 'weight' | 'water' | 'litter' | 'srr';
  icon: React.ReactNode;
  label: string;
  /** Sub-line shown below the label. "12 days ago" / "Never logged". */
  subline: string;
  /** When true, this chip is the most urgent — highlighted. */
  urgent: boolean;
  /** Route to deep-link to. */
  route: string;
};

export function DailyCheckinCard() {
  const t = useTheme();
  const router = useRouter();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  // Most recent scan for THIS cat — used to compute the new adjusted score
  // immediately after a check-in is saved, so we can surface the right
  // celebration / re-scan prompt to the user.
  const allScans = useScanStore((s) => s.scans);

  const today = useMemo(() => {
    if (!cat) return null;
    return todaysCheckin(events.filter((e) => e.cat_id === cat.id));
  }, [events, cat]);

  const streak = useMemo(() => {
    if (!cat) return 0;
    return dailyCheckinStreak(events.filter((e) => e.cat_id === cat.id));
  }, [events, cat]);

  // ─── Track-more chips ──────────────────────────────────────────
  // Compute stale-only chip set. Each rule:
  //   - weight: never logged OR > 14 days since last
  //   - water: never logged OR > 14 days
  //   - litter: never logged OR > 7 days (more frequent because
  //     baseline shifts faster — daily-ish for healthy cats)
  //   - srr: HCM-risk breed only; never logged OR > 30 days
  // Urgent chips get a brighter outline; "never logged" is always
  // urgent because the corresponding drift card can't even fire
  // without one data point.
  const trackerChips: TrackerChip[] = useMemo(() => {
    if (!cat) return [];
    const out: TrackerChip[] = [];
    const dWeight = daysSinceLastEvent(events, cat.id, 'weight');
    const dWater = daysSinceLastEvent(events, cat.id, 'water_intake');
    const dLitter = daysSinceLastEvent(events, cat.id, 'litter_box_use');
    const dSrr = daysSinceLastEvent(events, cat.id, 'srr_measurement');
    const showWeight = dWeight == null || dWeight > 14;
    const showWater = dWater == null || dWater > 14;
    const showLitter = dLitter == null || dLitter > 7;
    const isAtRisk = isHcmRiskBreed(cat.breed);
    const showSrr = isAtRisk && (dSrr == null || dSrr > 30);
    const subline = (d: number | null) =>
      d == null ? 'Never logged' : `${d} day${d === 1 ? '' : 's'} ago`;
    if (showWeight) {
      out.push({
        key: 'weight',
        icon: <Scales size={18} color={t.primary700} weight="duotone" />,
        label: 'Weight',
        subline: subline(dWeight),
        urgent: dWeight == null,
        route: '/health/weight',
      });
    }
    if (showWater) {
      out.push({
        key: 'water',
        icon: <Drop size={18} color={t.primary700} weight="duotone" />,
        label: 'Water',
        subline: subline(dWater),
        urgent: dWater == null,
        // Water lives on the CKD screen — no dedicated /health/water yet.
        route: '/health/ckd',
      });
    }
    if (showLitter) {
      out.push({
        key: 'litter',
        icon: <Toilet size={18} color={t.primary700} weight="duotone" />,
        label: 'Litter',
        subline: subline(dLitter),
        urgent: dLitter == null,
        route: '/health/litter',
      });
    }
    if (showSrr) {
      out.push({
        key: 'srr',
        icon: <Heartbeat size={18} color={t.primary700} weight="duotone" />,
        label: 'Resp rate',
        subline: subline(dSrr),
        // SRR for at-risk breeds is genuinely high-leverage (early
        // HCM detection) — always urgent when stale.
        urgent: true,
        route: '/health/srr',
      });
    }
    return out;
  }, [events, cat, t.primary700]);

  // Strip default-expanded only when the first chip is "never logged"
  // (so first-time discovery happens naturally). Once the user has
  // logged any of them, the strip collapses by default to keep the
  // Today tab clean. User can re-expand any time.
  const anyNeverLogged = trackerChips.some((c) => c.subline === 'Never logged');
  const [stripOpen, setStripOpen] = useState<boolean>(false);
  // First render: open if any chip is never-logged. Use a ref-like
  // initialiser pattern via useMemo + state to set it once.
  React.useEffect(() => {
    if (anyNeverLogged) setStripOpen(true);
    // Only run on mount + when the never-logged status flips.
  }, [anyNeverLogged]);

  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<Mood | null>(null);
  const [appetite, setAppetite] = useState<Appetite | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!cat) return null;

  const handleOpen = () => {
    setMood(null);
    setAppetite(null);
    setNotes('');
    setOpen(true);
    void import('../services/analytics').then(({ track }) =>
      track({ type: 'daily_checkin_opened' }),
    );
  };

  const handleSave = () => {
    if (!mood || !appetite || !cat) return;
    setSaving(true);
    try {
      addEvent({
        cat_id: cat.id,
        type: 'daily_checkin',
        payload: {
          mood,
          appetite,
          notes: notes.trim() || null,
          logged_at: new Date().toISOString(),
        },
      });
      // Funnel-friendly dedicated event (in addition to the generic
      // `health_event_logged` fired by the store). `streak_after` is
      // computed as `streak + 1` because the just-added event will lift
      // the counter on next render — we pre-compute here to save a
      // re-derive round-trip for the analytics payload.
      const streakAfter = today ? streak : streak + 1;
      void import('../services/analytics').then(({ track }) =>
        track({
          type: 'daily_checkin_completed',
          props: {
            mood,
            appetite,
            streak_after: streakAfter,
            had_notes: notes.trim().length > 0,
          },
        }),
      );
      setOpen(false);

      // After-save UX: compute what the score would now look like with
      // this brand-new check-in folded in, and celebrate / nudge based on
      // the delta. We build the simulated check-in event in-line because
      // Zustand's update is async and we don't want to wait a render.
      const latestScan = allScans.find((s) => s.cat_id === cat.id) ?? null;
      if (latestScan) {
        const simulated: HealthEvent<'daily_checkin'> = {
          id: 'sim',
          cat_id: cat.id,
          type: 'daily_checkin',
          ts: new Date().toISOString(),
          created_at: new Date().toISOString(),
          payload: {
            mood,
            appetite,
            notes: notes.trim() || null,
            logged_at: new Date().toISOString(),
          },
        };
        const priorCheckins = events.filter(
          (e): e is HealthEvent<'daily_checkin'> =>
            e.cat_id === cat.id && e.type === 'daily_checkin',
        );
        const adjusted = computeAdjustedScore(latestScan, [...priorCheckins, simulated]);

        // Decide which dialog to show based on what changed.
        const isPositive = adjusted.delta > 0;
        const isNegative = adjusted.delta < 0;
        const tierChanged = adjusted.tierChanged;
        const cName = cat.name;

        // Hard-urgency lock case: scan was a Layer-1 emergency (e.g. toxic
        // ingestion). Check-ins cannot move the score AT ALL until a fresh
        // scan. Tell the user explicitly so the silence isn't confusing.
        if (latestScan.hard_urgency) {
          Alert.alert(
            `Check-in saved — but the alert stays`,
            `${cName}'s last scan flagged a critical signal that can't be cleared by check-ins alone (e.g. toxic ingestion can look "fine" for hours before symptoms appear). Run a fresh scan when you're ready to re-evaluate.`,
            [
              { text: 'OK, later', style: 'cancel' },
              { text: 'Scan now', onPress: () => router.push('/scan') },
            ],
          );
        } else if (tierChanged && isPositive) {
          // Pronoun helper drives "she's / he's / they're" so the
          // message matches the cat's set sex. Pre 2026-05-09 this
          // hardcoded "she's" — wrong for male cats.
          const subj = getPronouns(cat.sex).subject;
          const verb = subj === 'they' ? 'they’ve' : `${subj}’s`;
          Alert.alert(
            `${cName} seems to be recovering 🎉`,
            `${cName}’s score moved out of "${labelForTier(adjusted.baselineTier)}". Run a fresh scan to confirm ${verb} fully bounced back, or keep checking in.`,
            [
              { text: 'Maybe later', style: 'cancel' },
              { text: 'Scan now', onPress: () => router.push('/scan') },
            ],
          );
        } else if (tierChanged && isNegative) {
          Alert.alert(
            `${cName} may be declining ⚠️`,
            `Today’s check-in dropped the score into "${labelForTier(adjusted.tier)}". Consider running a fresh scan now.`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Scan now', style: 'destructive', onPress: () => router.push('/scan') },
            ],
          );
        } else if (adjusted.suggestRescan && isPositive) {
          // Multiple positive check-ins stacked — gentle prompt for new scan.
          const subj = getPronouns(cat.sex).subject;
          const verb = subj === 'they' ? 'they’ve' : `${subj}’s`;
          Alert.alert(
            `${cName} seems much better 🐈‍⬛`,
            `Want to run a fresh scan to confirm ${verb} fully bounced back?`,
            [
              { text: 'Maybe later', style: 'cancel' },
              { text: 'Scan now', onPress: () => router.push('/scan') },
            ],
          );
        }
        // Otherwise: silent save. The home screen will show the small
        // delta indicator under the score ring on next render.
      }
    } finally {
      setSaving(false);
    }
  };

  // Collapsed card (not done today or already done today) ── always visible
  const isDone = !!today;
  const accentColor = isDone ? t.success : t.primary700;

  return (
    <>
      <Pressable
        onPress={isDone ? undefined : handleOpen}
        disabled={isDone}
        accessibilityRole="button"
        accessibilityLabel={
          isDone
            ? `Today\u2019s check-in complete. ${streak} day streak.`
            : `Tap to check in on ${cat.name} today`
        }
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isDone ? t.surfaceSunken : t.primary50,
            borderColor: isDone ? t.borderSubtle : t.primary300,
            opacity: pressed && !isDone ? 0.92 : 1,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          {isDone ? (
            <CheckCircle size={28} color={t.success} weight="fill" />
          ) : (
            <BowlFood size={28} color={t.primary700} weight="fill" />
          )}
          <View style={{ flex: 1 }}>
            <Text
              token="heading3"
              style={{ color: accentColor, fontFamily: 'Figtree_600SemiBold' }}
            >
              {isDone
                ? `${cat.name}\u2019s check-in saved`
                : `How is ${cat.name} today?`}
            </Text>
            <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {isDone
                ? `Mood: ${labelFor(MOOD_OPTIONS, today.payload.mood)} \u00b7 Appetite: ${labelFor(APPETITE_OPTIONS, today.payload.appetite)}`
                : '10-second check-in builds a health baseline'}
            </Text>
          </View>
          {streak >= 1 ? (
            <View
              style={[
                styles.streakPill,
                { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle, borderWidth: 1 },
              ]}
            >
              <Flame size={14} color={t.warning} weight="fill" />
              <Text
                token="caption"
                style={{ color: t.warning, fontFamily: 'Figtree_700Bold', marginLeft: 2 }}
              >
                {streak}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* ─── Track-more chip strip ─────────────────────────────────
          Only renders when there's at least one stale tracker. The
          strip is the bridge from the daily 10-second habit to the
          weekly/monthly trackers (weight, water, litter, SRR) that
          Health Rhythm depends on but the current UX buries 3 taps
          deep in Triage. Each chip deep-links into its existing
          dedicated screen — no new destinations, just discovery. */}
      {trackerChips.length > 0 ? (
        <View style={styles.stripWrap}>
          <Pressable
            onPress={() => setStripOpen((v) => !v)}
            hitSlop={8}
            style={styles.stripHeader}
            accessibilityRole="button"
            accessibilityLabel={
              stripOpen
                ? `Hide track-more options for ${cat.name}`
                : `Track more about ${cat.name} this week, ${trackerChips.length} option${trackerChips.length === 1 ? '' : 's'} available`
            }
          >
            <Text
              token="caption"
              style={{
                flex: 1,
                color: t.textSecondary,
                fontFamily: 'Figtree_600SemiBold',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                fontSize: 11,
              }}
            >
              Track more about {cat.name} this week
              {trackerChips.length > 0 ? ` (${trackerChips.length})` : ''}
            </Text>
            {stripOpen ? (
              <CaretDown size={14} color={t.textMuted} weight="bold" />
            ) : (
              <CaretRight size={14} color={t.textMuted} weight="bold" />
            )}
          </Pressable>

          {stripOpen ? (
            <View style={styles.chipRow}>
              {trackerChips.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={() => router.push(chip.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${chip.label} — ${chip.subline}. Tap to log.`}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: chip.urgent ? t.primary50 : t.surface,
                      borderColor: chip.urgent ? t.primary300 : t.borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.chipIconRow}>
                    {chip.icon}
                    <Text
                      token="caption"
                      style={{
                        marginLeft: 6,
                        color: t.textPrimary,
                        fontFamily: 'Figtree_600SemiBold',
                        fontSize: 13,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </View>
                  <Text
                    token="caption"
                    style={{
                      marginTop: 2,
                      color: chip.urgent ? t.primary700 : t.textMuted,
                      fontSize: 11,
                    }}
                  >
                    {chip.subline}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          // Android: "height" resizes the view so the keyboard doesn't
          // cover the notes TextInput inside the bottom-sheet. "padding"
          // behaves inconsistently with Modal on Android.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: t.surface, borderColor: t.borderSubtle },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Text token="heading2" style={{ flex: 1 }}>
                How is {cat.name} today?
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <X size={22} color={t.textMuted} />
              </Pressable>
            </View>

            <Text token="caption" color="textMuted" style={{ marginTop: space[1], textTransform: 'uppercase', letterSpacing: 1 }}>
              Mood
            </Text>
            <View style={styles.optionRow}>
              {MOOD_OPTIONS.map((o) => (
                <Option
                  key={o.key}
                  selected={mood === o.key}
                  onPress={() => setMood(o.key)}
                  emoji={o.emoji}
                  label={o.label}
                />
              ))}
            </View>

            <Text token="caption" color="textMuted" style={{ marginTop: space[4], textTransform: 'uppercase', letterSpacing: 1 }}>
              Appetite
            </Text>
            <View style={styles.optionRow}>
              {APPETITE_OPTIONS.map((o) => (
                <Option
                  key={o.key}
                  selected={appetite === o.key}
                  onPress={() => setAppetite(o.key)}
                  emoji={o.emoji}
                  label={o.label}
                />
              ))}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything unusual? (optional)"
              placeholderTextColor={t.textMuted}
              multiline
              maxLength={200}
              style={{
                marginTop: space[4],
                minHeight: 60,
                padding: space[3],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                color: t.textPrimary,
                fontFamily: 'Figtree_400Regular',
                fontSize: 15,
                textAlignVertical: 'top',
              }}
            />

            <Pressable
              onPress={handleSave}
              disabled={!mood || !appetite || saving}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: !mood || !appetite ? t.borderStrong : t.primary700,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save today\u2019s check-in"
            >
              <Text
                token="body"
                style={{ color: t.textInverse, fontFamily: 'Figtree_700Bold' }}
              >
                {saving ? 'Saving\u2026' : 'Save check-in'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Option({
  selected,
  onPress,
  emoji,
  label,
}: {
  selected: boolean;
  onPress: () => void;
  emoji: string;
  label: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.optionBtn,
        {
          borderColor: selected ? t.primary700 : t.borderStrong,
          backgroundColor: selected ? t.primary50 : t.surface,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Text
        token="caption"
        style={{
          marginTop: 4,
          color: selected ? t.primary700 : t.textPrimary,
          fontFamily: selected ? 'Figtree_600SemiBold' : 'Figtree_400Regular',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function labelFor<T extends { key: string; label: string }>(
  options: T[],
  key: string,
): string {
  return options.find((o) => o.key === key)?.label ?? key;
}

function labelForTier(tier: string): string {
  switch (tier) {
    case 'urgent':
      return 'Urgent';
    case 'concern':
      return 'See Vet Soon';
    case 'monitor':
      return 'Monitor';
    case 'routine':
      return 'Routine';
    default:
      return tier;
  }
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,32,36,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: space[5],
    paddingBottom: space[8],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
  },
  optionRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
  optionBtn: {
    flex: 1,
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    marginTop: space[5],
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ─── Track-more strip ──────────────────────────────────────────
  stripWrap: {
    marginTop: space[2],
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingHorizontal: space[1],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: 2,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '47%',
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chipIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
