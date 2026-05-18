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
import { PersonalityProgressBanner } from '../src/components/PersonalityProgressBanner';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useBecomingForCat } from '../src/services/useBecomingForCat';
import { useEntitlement } from '../src/hooks/useEntitlement';
import {
  useDiaryEntriesForCat,
  useDiaryGenerating,
  useDiaryStore,
  useTodaysDiaryEntry,
} from '../src/state/diaryStore';
import type { DiaryEntry } from '../src/services/diary';
import { useNotifPrefsStore } from '../src/state/notifPrefsStore';
import { usePhotoStudioStore } from '../src/state/photoStudioStore';
import { useHealthStore } from '../src/state/healthStore';
import { useChatStore } from '../src/state/chatStore';
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
  // Personality-progress banner — sits above the diary content so
  // first-time users understand that the diary's voice gets sharper
  // as they enrich the underlying signals (photos, check-ins, etc.).
  // Copy graduates with Becoming.overallStage; see component for
  // the per-stage table.
  const becoming = useBecomingForCat(cat?.id);
  const todayEntry = useTodaysDiaryEntry(cat?.id);
  const entries = useDiaryEntriesForCat(cat?.id); // newest first
  const generating = useDiaryGenerating(cat?.id);
  const generateForToday = useDiaryStore((s) => s.generateForToday);
  const markViewed = useDiaryStore((s) => s.markViewed);
  // hasProAccess gates the AI generation calls below. The screen still
  // RENDERS for non-Pro users (they can read historical entries) — only
  // the new-entry generation is gated. This matches the agreed
  // free-after-trial tier: history is free; generation is Pro.
  const { isPro, hasProAccess } = useEntitlement();
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

  // Auto-generate today's entry on screen mount IF
  //   (a) it's not cached already, AND
  //   (b) we're past the 19:00 "writing hour" (post 2026-05-09 7pm
  //       gate). Pre-7pm visits show the explainer card and skip
  //       generation — see the pre-7pm explainer block in render.
  //       The 7pm rule means stale-snapshot bugs (entry written at
  //       14:00, then 16:00 activity ignored) can't happen.
  // The diaryStore.generateForToday function ALSO enforces the 7pm
  // gate as defense-in-depth — even if this screen forgets to gate,
  // the store refuses to generate before 19:00.
  useEffect(() => {
    if (!cat?.id) return;
    if (todayEntry) return;
    if (generating) return;
    if (new Date().getHours() < 19) {
      // Pre-7pm: don't auto-generate. Telemetry tracked via the
      // diary_pre_7pm_visit event below.
      return;
    }
    // Pro gate — silent skip for non-Pro users. We don't route to the
    // paywall on diary-screen-mount because that would feel intrusive
    // (the user opened the diary just to read). Instead, the screen
    // shows historical entries + a "Generate today's entry — Pro"
    // CTA in the empty state. The CTA does route to /paywall.
    if (!hasProAccess) return;
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
    // hasProAccess is in deps so that when the entitlement resolves
    // AFTER mount (anonymous-session race fix), the auto-gen fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id, hasProAccess]);

  // ── Pre-7pm visit telemetry ────────────────────────────────────
  // Counts how many users land before 7pm and see the explainer
  // card. Useful for measuring: (a) is the framing landing? (b) are
  // users coming back after 7pm to read? Fires once per (cat, day)
  // visit — the dedup is implicit via session lifetime.
  useEffect(() => {
    if (!cat?.id) return;
    if (new Date().getHours() < 19) {
      track({
        type: 'diary_pre_7pm_visit',
        props: {
          had_today_entry: !!todayEntry,
          local_hour: new Date().getHours(),
        },
      });
    }
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

  // First-time empty: no entries cached yet, nothing in flight, no error
  const isFirstTimeEmpty =
    entries.length === 0 && !generating && !error && !todayEntry;

  // ── Pre-7pm explainer state ────────────────────────────────────
  // When the user opens the diary BEFORE 19:00 local time AND today's
  // entry hasn't been generated yet AND they're viewing today, show a
  // pre-7pm card explaining the daily writing rhythm. Hides the
  // entry / first-time-empty / generating views for that one frame.
  // Post 2026-05-09: 7pm gate prevents the staleness bug where a
  // 14:00-generated entry locks in before the day's full activity.
  const todayKey = todayKeyLocal();
  const isViewingToday = viewingDate === todayKey;
  const isPre7pmGated =
    isViewingToday && !todayEntry && new Date().getHours() < 19;

  // Navigator display values — when pre-7pm-gated, the user's intent
  // is "today" but `activeEntry` resolves to the most-recent past
  // entry (yesterday) because today doesn't exist yet. Override the
  // navigator's date label to show TODAY (matching the user's
  // viewingDate intent), and rewire the prev arrow to jump straight
  // to the most-recent past entry instead of "older than yesterday".
  // The navigator stays VISIBLE pre-7pm so users can still browse
  // past entries — initial bug 2026-05-09 hid it entirely.
  const navDate = isPre7pmGated ? todayKey : (activeEntry?.date ?? viewingDate);
  const effectivePrevDate = isPre7pmGated
    ? (entries[0]?.date ?? null)  // most recent past — yesterday-ish
    : prevDate;
  const effectiveNextDate = isPre7pmGated ? null : nextDate;
  const showNavigator = entries.length > 0 || isPre7pmGated;

  // Today-so-far activity counts — show in the pre-7pm card so the
  // user knows their actions ARE being captured for tonight's entry.
  const photoCountToday = usePhotoStudioStore((s) => {
    if (!cat?.id) return 0;
    return (s.photos[cat.id] ?? []).filter((p) => p.date === todayKey).length;
  });
  const eventsTodayCount = useHealthStore((s) => {
    if (!cat?.id) return 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    return s.events.filter(
      (e) =>
        e.cat_id === cat.id &&
        new Date(e.ts).getTime() >= startMs &&
        // Material event types only — same set as hasMaterialToday
        // in services/diary.ts. Counts what the diary will reference.
        (
          e.type === 'daily_checkin' ||
          e.type === 'behavior_observation' ||
          e.type === 'weight' ||
          e.type === 'medication_dose' ||
          e.type === 'symptom_photo' ||
          e.type === 'litter_box_use' ||
          e.type === 'outcome_check'
        ),
    ).length;
  });
  const chatTurnsTodayCount = useChatStore((s) => {
    if (!cat?.id) return 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    return (s.threads[cat.id] ?? []).filter(
      (t) => t.role === 'user' && new Date(t.created_at).getTime() >= startMs,
    ).length;
  });

  // ── Render ──────────────────────────────────────────────────────────
  // Hook-order safety (2026-05-14 audit fix): the "no cat" early-return
  // used to live BEFORE the three Zustand hooks above, which violated
  // rules-of-hooks. Moved here so every render path runs the same hooks
  // in the same order regardless of whether a cat is selected.
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

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header
        onBack={() => router.back()}
        title={`${catName}'s diary`}
      />

      {/* Personality-progress banner — same component as chat. Sits
          directly under the header so the early-stage "voice is
          still forming" framing is the first thing users read. */}
      <PersonalityProgressBanner
        catName={catName}
        catSex={cat?.sex}
        becoming={becoming}
        source="diary"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pre-7pm explainer — surfaces when viewing today before
            19:00 with no cached entry. Sets the daily-rhythm
            expectation: "diary writes after 7pm." Replaces today's
            entry view; user can still navigate back to past entries
            with the arrow buttons below. */}
        {isPre7pmGated ? (
          <View style={[styles.placeholderCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <Sparkle size={28} color={t.primary700} weight="duotone" />
            <Text token="heading3" style={{ marginTop: space[2], textAlign: 'center' }}>
              {catName}&rsquo;s diary writes at 7pm
            </Text>
            <Text token="body" color="textSecondary" style={{ marginTop: space[2], textAlign: 'center', lineHeight: 22 }}>
              {catName} settles in to write each evening, after 7pm
              local. The richer your day, the richer the entry.
            </Text>
            {/* Today-so-far summary — confirms to the user that their
                actions ARE being captured. Three counts only: photos,
                health events (check-ins / scans / readings / etc.),
                chat. Hides counts that are 0 to keep the card clean
                on slow days. */}
            {(photoCountToday + eventsTodayCount + chatTurnsTodayCount) > 0 ? (
              <View style={{ marginTop: space[4], alignItems: 'center' }}>
                <Text token="caption" color="textMuted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                  Today so far
                </Text>
                <Text token="body" style={{ marginTop: space[1], color: t.textPrimary, textAlign: 'center' }}>
                  {[
                    photoCountToday > 0
                      ? `${photoCountToday} photo${photoCountToday === 1 ? '' : 's'}`
                      : null,
                    eventsTodayCount > 0
                      ? `${eventsTodayCount} health event${eventsTodayCount === 1 ? '' : 's'}`
                      : null,
                    chatTurnsTodayCount > 0
                      ? `${chatTurnsTodayCount} chat${chatTurnsTodayCount === 1 ? '' : 's'}`
                      : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ) : (
              <Text token="caption" color="textMuted" style={{ marginTop: space[4], textAlign: 'center', lineHeight: 18 }}>
                Nothing logged yet. Take a photo, log a check-in, or
                run a body-language read — {catName} writes from what
                actually happens.
              </Text>
            )}
          </View>
        ) : null}

        {/* Day navigator — always visible when there are any entries
            OR when we're showing the pre-7pm card for today.
            Pre-7pm: nav reads "Today" (matches user intent), prev
            arrow jumps to the most recent past entry, next arrow
            disabled (no future entries). Initial 2026-05-09 ship
            hid the navigator pre-7pm — that broke past-entry
            browsing for users who opened before 7pm. Fixed below. */}
        {showNavigator ? (
          <View style={styles.navRow}>
            <Pressable
              onPress={() => {
                if (isPre7pmGated) {
                  if (effectivePrevDate) setViewingDate(effectivePrevDate);
                } else {
                  onArrowOlder();
                }
              }}
              disabled={!effectivePrevDate}
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
                  opacity: !effectivePrevDate ? 0.25 : pressed ? 0.5 : 1,
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
                {relativeDateLabel(navDate) ?? ''}
              </Text>
              <Text token="heading2" style={styles.navDate}>
                {formatLongDate(navDate)}
              </Text>
              <Text token="caption" color="textMuted" style={styles.navPosition}>
                {isPre7pmGated ? 'writing tonight' : `${position} of ${total}`}
              </Text>
            </View>

            <Pressable
              onPress={onArrowNewer}
              disabled={!effectiveNextDate}
              accessibilityRole="button"
              accessibilityLabel="Newer day"
              hitSlop={12}
              style={({ pressed }) => [
                styles.navArrow,
                {
                  opacity: !effectiveNextDate ? 0.25 : pressed ? 0.5 : 1,
                  borderColor: t.borderSubtle,
                },
              ]}
            >
              <CaretRight size={20} color={t.textPrimary} weight="bold" />
            </Pressable>
          </View>
        ) : null}

        {/* Generating spinner (only when nothing else to show) */}
        {!isPre7pmGated && generating && !activeEntry ? (
          <View style={[styles.placeholderCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <ActivityIndicator color={t.primary700} />
            <Text token="body" color="textSecondary" style={{ marginTop: space[3] }}>
              {catName} is writing today&rsquo;s entry…
            </Text>
          </View>
        ) : null}

        {/* Error state */}
        {!isPre7pmGated && error && !activeEntry ? (
          <View style={[styles.placeholderCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <WarningCircle size={28} color={t.warning} weight="fill" />
            <Text token="body" color="textSecondary" style={{ marginTop: space[2], textAlign: 'center' }}>
              {error}
            </Text>
            <Button
              label={hasProAccess ? 'Retry' : 'Unlock with Pro'}
              size="sm"
              onPress={() => {
                if (!cat?.id) return;
                if (!hasProAccess) {
                  router.push({ pathname: '/paywall', params: { source: 'diary' } } as never);
                  return;
                }
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

        {/* First-time empty state — superseded by the pre-7pm card
            when both conditions overlap (new user opening before 7pm). */}
        {!isPre7pmGated && isFirstTimeEmpty ? (
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

        {/* THE ENTRY — hidden when pre-7pm-gated so the explainer
            card is the sole focus for today-no-entry state. User
            can navigate back via arrows to view past entries. */}
        {!isPre7pmGated && activeEntry ? (
          <EntryView
            entry={activeEntry}
            onTapMemoryChip={onTapMemoryChip}
            entriesByDate={new Map(entries.map((e) => [e.date, e]))}
          />
        ) : null}

        {/* Daily Card CTA — surfaces for ANY populated diary entry,
            today OR past. The Daily Card screen extracts the punchiest
            single sentence from the entry being viewed and frames it
            as a Co-Star-shaped shareable card. The screen accepts a
            `date` query param so the user can share past-day cards
            too — pre-2026-05-08 the CTA was today-only and users
            couldn't revisit / share old cards. See
            chat-as-viral-lever.md §3 for the surface intent. */}
        {activeEntry &&
        !activeEntry.is_empty_day &&
        activeEntry.entry?.length > 10 ? (
          <Pressable
            onPress={() =>
              router.push(
                `/daily-card?source=diary&date=${activeEntry.date}` as never,
              )
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
                {activeEntry.date === todayKeyLocal()
                  ? 'Today’s card'
                  : `${relativeDateLabel(activeEntry.date) ?? 'This day’s'} card`}
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
