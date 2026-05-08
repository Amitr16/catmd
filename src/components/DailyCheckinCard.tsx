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
import { BowlFood, CheckCircle, Flame, X } from 'phosphor-react-native';
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
          Alert.alert(
            `${cName} seems to be recovering 🎉`,
            `${cName}’s score moved out of "${labelForTier(adjusted.baselineTier)}". Run a fresh scan to confirm she’s fully bounced back, or keep checking in.`,
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
          Alert.alert(
            `${cName} seems much better 🐈‍⬛`,
            'Want to run a fresh scan to confirm she’s fully bounced back?',
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
});
