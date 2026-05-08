/**
 * Cat Diary — single-day-at-a-time journal viewer.
 *
 * UX rebuild 2026-05-04: replaced the previous "today as hero +
 * archive list below" layout with a focused one-day-at-a-time view
 * where the user navigates between days using left/right arrows.
 *
 * The diary is now CONSCIOUS: entries are written every day if there's
 * material activity (Phase A backfill + 7pm cron-driven generation).
 * On days with NO activity, after the cat has accumulated ≥7
 * activity-days lifetime, the cat writes a 1-2 sentence
 * melancholic-aristocratic vignette about the silence (rendered with
 * quieter typography here so users can tell at a glance).
 *
 * Memory tiers (in `services/diaryMemory.ts` + `services/diary.ts`):
 *   - Recent context (last 14 days summaries + mood arc + recurring entities)
 *   - Landmark life events (past sicknesses, milestones, recoveries)
 *   - Anticipation (upcoming birthday / vet appointment)
 *   - Chat continuity (questions the human keeps asking)
 *   - Seasonal context
 *
 * The screen surfaces ONE memory chip when the entry references a
 * past date — tapping it navigates to that date.
 *
 * Pro gating: free tier sees today + last 7 days. Pro unlocks full
 * archive. Implemented as an arrow-blocker (greyed-out left arrow
 * past day 7 + paywall CTA below for non-Pro users).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  CaretLeft,
  CaretRight,
  Clock,
  Crown,
  ShareNetwork,
  Sparkle,
  WarningCircle,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useEntitlement } from '../src/hooks/useEntitlement';
import {
  useDiaryEntriesForCat,
  useDiaryGenerating,
  useDiaryStore,
  useTodaysDiaryEntry,
} from '../src/state/diaryStore';
import type { DiaryEntry } from '../src/services/diary';
import { useNotifPrefsStore } from '../src/state/notifPrefsStore';
import {
  cancelNotification,
  setDailyDiaryReminder,
} from '../src/services/notifications';
import { track } from '../src/services/analytics';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

const FREE_ARCHIVE_DAYS = 7;

function todayKeyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLongDate(yyyymmdd: string): string {
  try {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    if (y == null || m == null || d == null) return yyyymmdd;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return yyyymmdd;
  }
}

function relativeDateLabel(yyyymmdd: string): string | null {
  const today = todayKeyLocal();
  if (yyyymmdd === today) return 'Today';
  try {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    if (y == null || m == null || d == null) return null;
    const dateMs = new Date(y, m - 1, d).getTime();
    const todayMs = (() => {
      const tt = new Date();
      tt.setHours(0, 0, 0, 0);
      return tt.getTime();
    })();
    const days = Math.round((todayMs - dateMs) / (24 * 60 * 60 * 1000));
    if (days === 1) return 'Yesterday';
    if (days >= 2 && days <= 6) return `${days} days ago`;
    return null;
  } catch {
    return null;
  }
}

export default function DiaryScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const todayEntry = useTodaysDiaryEntry(cat?.id);
  const entries = useDiaryEntriesForCat(cat?.id); // newest first
  const generating = useDiaryGenerating(cat?.id);
  const generateForToday = useDiaryStore((s) => s.generateForToday);
  const markViewed = useDiaryStore((s) => s.markViewed);
  const { isPro } = useEntitlement();
  const [error, setError] = useState<string | null>(null);

  // Currently-viewed date. Default = today.
  const [viewingDate, setViewingDate] = useState<string>(todayKeyLocal());

  const catName = cat?.name ?? 'your cat';

  // Mark the diary as "viewed up to today" the moment the screen
  // mounts — clears the tab badge in the same gesture.
  useEffect(() => {
    if (!cat?.id) return;
    markViewed(cat.id);
    track({
      type: 'diary_opened',
      props: { had_today_cached: !!todayEntry },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Auto-generate today's entry on screen mount IF it's not cached
  // already AND the day has material AND we're not already generating.
  // Keeps `requireMaterial: true` semantics — empty days don't get
  // populated entries here. The 7pm cron + app-boot backfill cover
  // the days users don't open the screen.
  useEffect(() => {
    if (!cat?.id) return;
    if (todayEntry) return;
    if (generating) return;
    setError(null);
    void generateForToday(cat.id, { requireMaterial: true })
      .then(() => {
        // Generation completes; the cached entry will re-render via the
        // store subscription. No-op here.
      })
      .catch((e) => {
        console.warn('[Diary] auto-generation failed:', e);
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't write today's entry — tap retry.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Schedule daily 7pm diary reminder (idempotent).
  //
  // Collision rule: when cat_voice_evening is ENABLED, the cat-voice
  // push (re-armed by diaryStore post-generation) ALSO fires at 19:00
  // local with a real cat-voice one-liner. Running both at the same
  // minute spams the user with two notifications. Cat-voice is strictly
  // better content (actual quotable line vs generic "tap to read what
  // Lily wrote"), so we SUPPRESS the static daily reminder while
  // cat-voice is on. Toggling cat-voice off in notification-settings
  // restores the static reminder on the next mount.
  useEffect(() => {
    if (!cat?.id) return;
    const prefs = useNotifPrefsStore.getState();
    const oldId = prefs.getScheduledId(cat.id, 'diary_entry');
    void (async () => {
      try {
        await cancelNotification(oldId);
        const catVoiceTakesOver =
          prefs.enabled.cat_voice_evening && prefs.enabled.diary_entry;
        if (!prefs.enabled.diary_entry || catVoiceTakesOver) {
          prefs.setScheduledId(cat.id, 'diary_entry', null);
          return;
        }
        const newId = await setDailyDiaryReminder({
          catName: cat.name,
          catId: cat.id,
        });
        prefs.setScheduledId(cat.id, 'diary_entry', newId);
      } catch (e) {
        console.warn('[Diary] reminder schedule failed:', e);
      }
    })();
  }, [cat?.id, cat?.name]);

  // Find currently-viewed entry, plus prev/next entries (for arrows).
  const { activeEntry, prevDate, nextDate, position, total } = useMemo(() => {
    if (entries.length === 0) {
      return { activeEntry: null, prevDate: null, nextDate: null, position: 0, total: 0 };
    }
    // entries are sorted newest-first
    const idx = entries.findIndex((e) => e.date === viewingDate);
    let active: DiaryEntry | null = null;
    if (idx >= 0) {
      active = entries[idx]!;
    } else {
      // viewingDate doesn't have an entry — find the closest existing entry
      // (most recent on or before viewingDate)
      active =
        entries.find((e) => e.date <= viewingDate) ??
        entries[0] ??
        null;
    }
    const activeIdx = active ? entries.findIndex((e) => e.date === active.date) : -1;
    // newer = lower index, older = higher index (since newest-first)
    const newer = activeIdx > 0 ? entries[activeIdx - 1] : null;
    const older = activeIdx >= 0 && activeIdx < entries.length - 1 ? entries[activeIdx + 1] : null;

    return {
      activeEntry: active,
      prevDate: older?.date ?? null,    // "left arrow" → older
      nextDate: newer?.date ?? null,    // "right arrow" → newer
      position: activeIdx >= 0 ? activeIdx + 1 : 0,
      total: entries.length,
    };
  }, [entries, viewingDate]);

  // Pro gating: limit free users to last 7 days.
  const oldestAllowed = useMemo(() => {
    if (isPro) return null;
    if (entries.length === 0) return null;
    const cap = entries.slice(0, FREE_ARCHIVE_DAYS);
    return cap[cap.length - 1]?.date ?? null;
  }, [entries, isPro]);
  const prevBlockedByPaywall =
    !isPro && prevDate && oldestAllowed && prevDate < oldestAllowed;

  const onArrowOlder = () => {
    if (!prevDate) return;
    if (prevBlockedByPaywall) {
      router.push({ pathname: '/paywall', params: { source: 'settings' } });
      return;
    }
    setViewingDate(prevDate);
  };
  const onArrowNewer = () => {
    if (!nextDate) return;
    setViewingDate(nextDate);
  };

  const onTapMemoryChip = (referencedDate: string) => {
    // Confirm the referenced date has a cached entry — only navigate
    // if so. Otherwise the chip is decorative.
    if (entries.some((e) => e.date === referencedDate)) {
      setViewingDate(referencedDate);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={{ padding: space[6] }}>
          <Text token="body" color="textMuted">
            Add a cat first — Settings → Manage cats.
          </Text>
        </View>
      </View>
    );
  }

  // First-time empty: no entries cached yet, nothing in flight, no error
  const isFirstTimeEmpty =
    entries.length === 0 && !generating && !error && !todayEntry;

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header
        onBack={() => router.back()}
        title={`${catName}'s diary`}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Day navigator: left arrow + date + right arrow + position */}
        {entries.length > 0 && activeEntry ? (
          <View style={styles.navRow}>
            <Pressable
              onPress={onArrowOlder}
              disabled={!prevDate}
              accessibilityRole="button"
              accessibilityLabel={
                prevBlockedByPaywall
                  ? 'Unlock previous days with Pro'
                  : 'Previous day'
              }
              hitSlop={12}
              style={({ pressed }) => [
                styles.navArrow,
                {
                  opacity: !prevDate ? 0.25 : pressed ? 0.5 : 1,
                  borderColor: t.borderSubtle,
                },
              ]}
            >
              {prevBlockedByPaywall ? (
                <Crown size={18} color={t.warning} weight="fill" />
              ) : (
                <CaretLeft size={20} color={t.textPrimary} weight="bold" />
              )}
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text token="caption" color="textMuted" style={styles.navRelative}>
                {relativeDateLabel(activeEntry.date) ?? ''}
              </Text>
              <Text token="heading2" style={styles.navDate}>
                {formatLongDate(activeEntry.date)}
              </Text>
              <Text token="caption" color="textMuted" style={styles.navPosition}>
                {position} of {total}
              </Text>
            </View>

            <Pressable
              onPress={onArrowNewer}
              disabled={!nextDate}
              accessibilityRole="button"
              accessibilityLabel="Newer day"
              hitSlop={12}
              style={({ pressed }) => [
                styles.navArrow,
                {
                  opacity: !nextDate ? 0.25 : pressed ? 0.5 : 1,
                  borderColor: t.borderSubtle,
                },
              ]}
            >
              <CaretRight size={20} color={t.textPrimary} weight="bold" />
            </Pressable>
          </View>
        ) : null}

        {/* Generating spinner (only when nothing else to show) */}
        {generating && !activeEntry ? (
          <View style={[styles.placeholderCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <ActivityIndicator color={t.primary700} />
            <Text token="body" color="textSecondary" style={{ marginTop: space[3] }}>
              {catName} is writing today&rsquo;s entry…
            </Text>
          </View>
        ) : null}

        {/* Error state */}
        {error && !activeEntry ? (
          <View style={[styles.placeholderCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <WarningCircle size={28} color={t.warning} weight="fill" />
            <Text token="body" color="textSecondary" style={{ marginTop: space[2], textAlign: 'center' }}>
              {error}
            </Text>
            <Button
              label="Retry"
              size="sm"
              onPress={() => {
                if (!cat?.id) return;
                setError(null);
                void generateForToday(cat.id, { requireMaterial: true }).catch(
                  (e) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Couldn't write today's entry.",
                    ),
                );
              }}
              style={{ marginTop: space[3] }}
            />
          </View>
        ) : null}

        {/* First-time empty state */}
        {isFirstTimeEmpty ? (
          <View style={[styles.placeholderCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <Sparkle size={28} color={t.primary700} weight="duotone" />
            <Text token="heading3" style={{ marginTop: space[2], textAlign: 'center' }}>
              Tonight, {catName} writes
            </Text>
            <Text token="body" color="textSecondary" style={{ marginTop: space[2], textAlign: 'center', lineHeight: 22 }}>
              At 7pm, {catName} will write about the day — if anything
              happened (check-in, body-language read, chat, photo, scan,
              weight). The richer the day&rsquo;s data, the richer the
              entry.
            </Text>
          </View>
        ) : null}

        {/* THE ENTRY */}
        {activeEntry ? (
          <EntryView
            entry={activeEntry}
            onTapMemoryChip={onTapMemoryChip}
            entriesByDate={new Map(entries.map((e) => [e.date, e]))}
          />
        ) : null}

        {/* Daily Card CTA — surfaces ONLY when viewing today's
            populated entry. The Daily Card screen extracts the
            punchiest single sentence from this entry as a Co-Star-
            shaped shareable card. Without an entry point, the only
            way to reach /daily-card is the (not-yet-shipped) 7pm
            push notification. Marketing Video #5 needs this surface
            to be discoverable — see chat-as-viral-lever.md §3. */}
        {activeEntry &&
        activeEntry.date === todayKeyLocal() &&
        !activeEntry.is_empty_day &&
        activeEntry.entry?.length > 10 ? (
          <Pressable
            onPress={() =>
              router.push('/daily-card?source=diary' as never)
            }
            style={({ pressed }) => [
              styles.dailyCardLink,
              {
                borderColor: t.primary500,
                backgroundColor: t.surfaceElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ShareNetwork size={18} color={t.primary500} weight="duotone" />
            <View style={{ flex: 1, marginLeft: space[2] }}>
              <Text token="body" style={{ color: t.textPrimary, fontWeight: '600' }}>
                Today&rsquo;s card
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2, lineHeight: 16 }}>
                {catName}&rsquo;s sharpest line, framed for your story.
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} weight="bold" />
          </Pressable>
        ) : null}

        {/* Pro upsell when arrow-blocked */}
        {prevBlockedByPaywall ? (
          <View style={[styles.proCard, { backgroundColor: t.secondary100, borderColor: t.secondary500 }]}>
            <Crown size={20} color={t.warning} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text token="heading3" style={{ color: t.secondary900 }}>
                Older days are Pro
              </Text>
              <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
                Free tier shows the last {FREE_ARCHIVE_DAYS} days. Unlock the
                full year-long archive with Pro.
              </Text>
            </View>
            <Button
              label="Unlock"
              size="sm"
              onPress={() =>
                router.push({ pathname: '/paywall', params: { source: 'settings' } })
              }
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EntryView — renders one diary entry with optional memory-chip
// ---------------------------------------------------------------------------

function EntryView({
  entry,
  onTapMemoryChip,
  entriesByDate,
}: {
  entry: DiaryEntry;
  onTapMemoryChip: (date: string) => void;
  entriesByDate: Map<string, DiaryEntry>;
}) {
  const t = useTheme();
  const isEmpty = !!entry.is_empty_day;

  // Memory chip: only render if the LLM cited a past date AND we have
  // that entry cached (so tap-navigation actually goes somewhere).
  const referencedEntry = entry.referenced_past_date
    ? entriesByDate.get(entry.referenced_past_date)
    : null;

  return (
    <View
      style={[
        isEmpty ? styles.entryCardEmpty : styles.entryCard,
        {
          backgroundColor: isEmpty ? t.surfaceSunken : t.surfaceElevated,
          borderColor: t.borderSubtle,
        },
      ]}
    >
      {/* Hero photo (populated days with photo) */}
      {!isEmpty && entry.photo_uri ? (
        <Image
          source={{ uri: entry.photo_uri }}
          style={styles.heroPhoto}
          resizeMode="cover"
        />
      ) : null}

      {/* Empty-day marker */}
      {isEmpty ? (
        <View style={styles.emptyDayBadgeRow}>
          <Clock size={14} color={t.textMuted} />
          <Text token="caption" color="textMuted" style={styles.emptyDayBadge}>
            A quiet day
          </Text>
        </View>
      ) : null}

      {/* Mood word */}
      <Text
        token="caption"
        style={[
          styles.moodWord,
          {
            color: isEmpty ? t.textMuted : t.primary700,
          },
        ]}
      >
        {entry.mood_word}
      </Text>

      {/* Entry text */}
      <Text
        token="bodyLg"
        style={[
          isEmpty ? styles.entryTextEmpty : styles.entryText,
          { color: isEmpty ? t.textSecondary : t.textPrimary },
        ]}
      >
        {entry.entry}
      </Text>

      {/* Memory chip — surfaces when the cat referenced a past day */}
      {referencedEntry ? (
        <Pressable
          onPress={() => onTapMemoryChip(referencedEntry.date)}
          accessibilityRole="button"
          accessibilityLabel={`Open the diary from ${formatLongDate(referencedEntry.date)}`}
          style={({ pressed }) => [
            styles.memoryChip,
            {
              backgroundColor: t.surfaceSunken,
              borderColor: t.borderSubtle,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Sparkle size={14} color={t.secondary700} weight="duotone" />
          <View style={{ flex: 1 }}>
            <Text token="caption" color="textMuted" style={styles.memoryChipEyebrow}>
              Remembering
            </Text>
            <Text token="caption" style={{ color: t.textPrimary }} numberOfLines={1}>
              {formatLongDate(referencedEntry.date)} — &ldquo;{firstSentence(referencedEntry.entry)}&rdquo;
            </Text>
          </View>
          <CaretRight size={14} color={t.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: t.surface, borderBottomColor: t.borderSubtle },
      ]}
    >
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} style={styles.headerBtn}>
        <ArrowLeft size={22} color={t.textPrimary} />
      </Pressable>
      <Text token="heading3" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title ?? 'Diary'}
      </Text>
      {/* Right-side spacer for symmetry */}
      <View style={styles.headerBtn} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstSentence(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  const m = trimmed.match(/^[^.?!]+[.?!]/);
  if (m) return m[0]!.trim().slice(0, 100);
  return trimmed.slice(0, 100).trim();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[5],
  },
  navArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRelative: {
    fontFamily: 'Figtree_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  navDate: {
    marginTop: 2,
    textAlign: 'center',
  },
  navPosition: {
    fontFamily: 'Figtree_500Medium',
    marginTop: 4,
  },

  entryCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 0,
    marginTop: space[3],
  },
  entryCardEmpty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space[5],
    marginTop: space[3],
    alignItems: 'flex-start',
  },
  heroPhoto: {
    width: '100%',
    aspectRatio: 16 / 11,
  },
  emptyDayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space[3],
  },
  emptyDayBadge: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 10,
  },
  moodWord: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 11,
    paddingHorizontal: space[5],
    paddingTop: space[5],
  },
  entryText: {
    fontFamily: 'SourceSerif4_500Medium',
    fontSize: 18,
    lineHeight: 28,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[5],
  },
  entryTextEmpty: {
    fontFamily: 'SourceSerif4_400Regular',
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
  },

  memoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginHorizontal: space[5],
    marginBottom: space[5],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  memoryChipEyebrow: {
    fontFamily: 'Figtree_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 10,
  },

  placeholderCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space[6],
    alignItems: 'center',
    marginTop: space[5],
  },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: space[5],
  },
  // Daily Card link — sits below today's diary entry. Borderless-ish:
  // primary-tinted left edge to read as a CTA, but not a hero button
  // (the diary text itself is the hero). Fits in the same vertical
  // rhythm as the proCard above it.
  dailyCardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[4],
  },
});
