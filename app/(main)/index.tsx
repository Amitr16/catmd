/**
 * Home / dashboard. The first surface a returning user sees.
 *
 * Layout (top → bottom):
 *   - Header: cat name + small profile link
 *   - ScoreRing: last scan's health score (or empty state before first scan)
 *   - "Scan now" primary CTA (single button)
 *   - Recent scans list (last 3)
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cat as CatIcon, Camera as CameraIcon, CaretDown, CaretRight, Flame, Gear, HeartStraight, Microphone, Sparkle, Stethoscope, Toilet, TrendUp, TrendDown, WarningCircle } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { DailyCheckinCard } from '../../src/components/DailyCheckinCard';
import { ScoreRing } from '../../src/components/ScoreRing';
import { TrialBanner } from '../../src/components/TrialBanner';
import { Text } from '../../src/components/Text';
import { UrgencyBadge } from '../../src/components/UrgencyBadge';
import { radius } from '../../src/theme/tokens';
import { useCatStore } from '../../src/state/catStore';
import { useScanStore } from '../../src/state/scanStore';
import { useHealthStore, type HealthEvent } from '../../src/state/healthStore';
import {
  PICKER_BATCH_LIMIT,
  usePhotoStudioStore,
  useTodaysPhotos,
} from '../../src/state/photoStudioStore';
import { captureViaImagePicker } from '../../src/services/photoStudio';
import { track } from '../../src/services/analytics';
import { useScanQuota } from '../../src/hooks/useScanQuota';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { tierFromScore } from '../../src/theme/tokens';
import { computeAdjustedScore } from '../../src/services/healthScore';
import {
  resolveTodaysMood,
  pickMorningGreeting,
} from '../../src/services/dailyMood';
import {
  buildArchetypeMod,
  buildLiveMoodContext,
  buildTodayBehaviorMod,
  computeFeedbackMod,
  hasMedicalConcernToday,
} from '../../src/services/moodWeights';
import { useMoodFeedbackStore } from '../../src/state/moodFeedbackStore';
import { usePersonalityStore } from '../../src/state/personalityStore';
import { setMorningMewReminder } from '../../src/services/notifications';
import { useNotifPrefsStore } from '../../src/state/notifPrefsStore';
import { resolveCatAgeMonths } from '../../src/state/catStore';

export default function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useActiveCat();
  const catCount = useCatStore((s) => s.cats.length);
  // Zustand selectors must return a stable reference when the underlying
  // data hasn't changed — so we subscribe to the raw scans array and
  // derive the cat-scoped filter in a useMemo. Without this, the
  // selector creates a new filtered array on every render and
  // useSyncExternalStore detects a "change" → infinite render loop.
  const allScans = useScanStore((s) => s.scans);
  const scans = useMemo(
    () => (cat ? allScans.filter((x) => x.cat_id === cat.id) : []),
    [allScans, cat],
  );
  // Daily check-ins for THIS cat, filtered to the type the score
  // adjuster cares about. Same Zustand-stable-reference pattern as scans.
  const allEvents = useHealthStore((s) => s.events);
  const checkins = useMemo<HealthEvent<'daily_checkin'>[]>(
    () =>
      cat
        ? allEvents.filter(
            (e): e is HealthEvent<'daily_checkin'> =>
              e.cat_id === cat.id && e.type === 'daily_checkin',
          )
        : [],
    [allEvents, cat],
  );
  const deleteScan = useScanStore((s) => s.deleteScan);
  const updateScan = useScanStore((s) => s.updateScan);
  const quota = useScanQuota();

  // Auto-arm Morning Mew on first Today-tab mount per cat. No natural
  // entry-point screen exists for this notification, so the Today tab
  // plays that role. Arms ONCE per cat (idempotent via scheduledIds
  // map) — if the user already has an id stored, we skip. The push is
  // daily-recurring, so a single arm covers every future morning.
  //
  // Phase 2 (post-launch) will refresh this nightly so the lockscreen
  // body reflects each day's freshly-rolled mood instead of the mood
  // at first-arm time. For Phase 1, the morning line stays in the
  // mood the cat was in when first armed — still feels personal, just
  // doesn't drift. Acceptable tradeoff for ship speed.
  const morningMewEnabled = useNotifPrefsStore(
    (s) => s.enabled.morning_mew,
  );
  const scheduledIds = useNotifPrefsStore((s) => s.scheduledIds);
  const setScheduledId = useNotifPrefsStore((s) => s.setScheduledId);
  useEffect(() => {
    if (!cat || !morningMewEnabled) return;
    const key = `${cat.id}:morning_mew`;
    if (scheduledIds[key]) return; // already armed
    void (async () => {
      try {
        // Audit 2026-05-14 round 10 P2 #3 + #4: use the shared
        // `buildLiveMoodContext` instead of hand-rolling. Pre-fix
        // this picked the FIRST daily_checkin without filtering to
        // today's date, so a morning push could schedule using
        // yesterday's mood. `buildLiveMoodContext` filters by today
        // properly + gathers all live signals (weather, meow, pain,
        // appetite, litter) for richer mood selection.
        const arch = usePersonalityStore.getState().getProfile(cat.id)?.archetype ?? null;
        const fbTable = useMoodFeedbackStore.getState().getFeedback(cat.id);
        const ageMonths = resolveCatAgeMonths(cat) ?? null;
        const liveCtx = await buildLiveMoodContext({ catId: cat.id, ageMonths });
        const mood = resolveTodaysMood({
          catId: cat.id,
          checkinMood: liveCtx.checkinMood ?? null,
          hasRecentMedicalConcern: hasMedicalConcernToday(cat.id),
          archetypeMod: buildArchetypeMod(arch),
          todayMod: buildTodayBehaviorMod(liveCtx),
          feedbackMod: computeFeedbackMod(fbTable),
        });
        const body =
          pickMorningGreeting({ mood, catId: cat.id }) ??
          `Tap to see what ${cat.name} has to say.`;
        const id = await setMorningMewReminder({
          catName: cat.name,
          catId: cat.id,
          body,
        });
        if (id) setScheduledId(cat.id, 'morning_mew', id);
      } catch {
        // best-effort — notifications must never block the dashboard
      }
    })();
  }, [cat, morningMewEnabled, scheduledIds, setScheduledId]);

  const confirmDeleteScan = (id: string, headline: string) => {
    Alert.alert(
      'Delete scan?',
      `"${headline}" will be removed from ${cat?.name ?? 'your cat'}\u2019s history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteScan(id) },
      ],
    );
  };

  const latest = scans[0];

  // "Dashboard freshness": only show the last scan's score if it's recent.
  // A scan older than 30 days is stale — showing it as the cat's current
  // health state is misleading, so we fall back to an empty state.
  const STALE_DAYS = 30;
  const isStale =
    !latest ||
    (Date.now() - new Date(latest.created_at).getTime()) >
      STALE_DAYS * 24 * 60 * 60 * 1000;
  const hasFreshScore = !!latest && !isStale;

  // Compute the LIVE score = scan baseline + check-in modifiers, capped to
  // safe bounds. See src/services/healthScore.ts for the medical rules.
  // Recompute on any change to the latest scan or post-scan check-ins.
  const adjusted = useMemo(
    () => computeAdjustedScore(latest ?? null, checkins),
    [latest, checkins],
  );

  const score = hasFreshScore ? adjusted.score : 0;
  const tier = hasFreshScore ? adjusted.tier : tierFromScore(90);

  // Daily check-in streak — the strongest re-engagement loop in the app.
  // Surfaced as a small pill above the check-in card when ≥3 consecutive
  // days, so the user gets visible reward for the habit they just built.
  // Below 3 we hide it: showing "1-day streak" feels patronising.
  const currentStreakDays = useMemo(() => {
    if (checkins.length === 0) return 0;
    const seenDays = new Set<string>();
    for (const e of checkins) {
      seenDays.add(new Date(e.ts).toLocaleDateString('en-CA')); // YYYY-MM-DD local
    }
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (seenDays.has(cursor.toLocaleDateString('en-CA'))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [checkins]);
  const showStreakPill = currentStreakDays >= 3;

  return (
    <ScrollView
      style={{ backgroundColor: t.surface }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + space[5],
          paddingBottom: insets.bottom + space[20],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Clean avatar-led header. Cat photo (or a friendly placeholder
          when none is set yet) is the personalisation. No gradient
          overlays — the photo IS the moment. If you want a fancier hero
          treatment in future, do it photo-forward (large clear avatar,
          maybe a subtle ~10% sage tint behind), not photo-buried. */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch cat. Currently viewing ${cat?.name ?? 'no cat'}.`}
          onPress={() => router.push('/cats')}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}
        >
          <CatAvatar uri={cat?.photo_uri ?? null} size={56} />
          <View style={{ flexShrink: 1 }}>
            <Text token="caption" color="textMuted">Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Text token="heading1" numberOfLines={1} style={{ flexShrink: 1 }}>
                {cat?.name ?? 'Your cat'}
              </Text>
              {catCount > 1 ? <CaretDown size={20} color={t.textMuted} /> : null}
            </View>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={{ padding: space[2] }}
        >
          <Gear size={24} color={t.textSecondary} />
        </Pressable>
      </View>

      {/* Trial / Pro state banner. Renders only for users who:
          - Are NOT on a paid plan
          - Are NOT on the admin whitelist
          - HAVE started the trial (anonymous-no-session = hidden)
          Three modes: mid-trial (subtle), ending (nudge), expired (CTA).
          See src/components/TrialBanner.tsx. */}
      <TrialBanner />

      <View style={styles.ringRow}>
        {hasFreshScore ? (
          <ScoreRing score={score} size={200} />
        ) : (
          <EmptyScoreRing catName={cat?.name ?? 'your cat'} />
        )}
      </View>

      {hasFreshScore && (
        <View style={{ alignItems: 'center', marginTop: space[3] }}>
          <UrgencyBadge tier={tier} />
          <Text token="caption" color="textMuted" style={{ marginTop: space[2], textAlign: 'center' }}>
            From {cat?.name ?? 'your cat'}&apos;s scan on{' '}
            {new Date(latest!.created_at).toLocaleDateString()}
            {adjusted.checkinsApplied > 0 && adjusted.delta !== 0 ? (
              <> &middot; <Text token="caption" style={{ color: adjusted.delta > 0 ? t.success : t.warning }}>
                {adjusted.delta > 0 ? '+' : ''}{adjusted.delta} from {adjusted.checkinsApplied} check-in{adjusted.checkinsApplied === 1 ? '' : 's'}
              </Text></>
            ) : null}
          </Text>
          {adjusted.copy && adjusted.checkinsApplied > 0 ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: space[2],
              marginTop: space[2], paddingHorizontal: space[3], paddingVertical: space[2],
              borderRadius: radius.md,
              backgroundColor: t.surfaceSunken,
              borderLeftWidth: 3,
              borderLeftColor: adjusted.delta > 0 ? t.success : adjusted.delta < 0 ? t.warning : t.borderStrong,
              maxWidth: 320,
            }}>
              {adjusted.delta > 0 ? (
                <TrendUp size={16} color={t.success} weight="bold" />
              ) : adjusted.delta < 0 ? (
                <TrendDown size={16} color={t.warning} weight="bold" />
              ) : null}
              <Text token="caption" color="textSecondary" style={{ flex: 1, lineHeight: 18 }}>
                {adjusted.copy}
              </Text>
            </View>
          ) : null}
          {adjusted.suggestRescan ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Run a fresh scan"
              onPress={() =>
                router.push(
                  quota.canScan
                    ? '/scan'
                    : { pathname: '/paywall', params: { source: 'scan_quota' } },
                )
              }
              style={({ pressed }) => [{
                marginTop: space[3],
                paddingHorizontal: space[4], paddingVertical: space[2],
                borderRadius: radius.full, borderWidth: 1, borderColor: t.primary300,
                backgroundColor: t.primary50,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <Text token="caption" color="primary700" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                Run a fresh scan to confirm &rarr;
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {!hasFreshScore && latest && (
        <Text
          token="caption"
          color="textMuted"
          style={{ marginTop: space[3], textAlign: 'center' }}
        >
          Last scan was more than {STALE_DAYS} days ago. Re-scan for an up-to-date read.
        </Text>
      )}

      {/* ── Birthday banner ────────────────────────────────────────────
          If today's MM-DD matches the active cat's DOB MM-DD (any year),
          show a celebratory banner that opens the birthday screen. This
          renders ABOVE the recommended-ritual banner because birthdays
          win on cuteness + once-a-year-only-ness. */}
      {(() => {
        if (!cat?.dob_iso) return null;
        const dob = new Date(cat.dob_iso);
        if (Number.isNaN(dob.getTime())) return null;
        const today = new Date();
        if (
          dob.getMonth() !== today.getMonth() ||
          dob.getDate() !== today.getDate()
        ) {
          return null;
        }
        return (
          <Pressable
            onPress={() => router.push('/cat-birthday' as never)}
            style={({ pressed }) => [
              styles.banner,
              {
                // Birthday is a Bond-side moment — terracotta, not sage.
                // Sage is reserved for clinical/medical surfaces.
                backgroundColor: t.secondary100,
                borderColor: t.secondary500,
                marginTop: space[6],
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text token="bodyLg" style={{ flex: 1, color: t.secondary900 }}>
              🎂 It&apos;s {cat.name}&apos;s birthday today — tap for the album.
            </Text>
            <CaretRight size={16} color={t.secondary700} />
          </Pressable>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════
          SECTION: TODAY
          The daily-ritual block. Everything in here is something the
          owner can act on RIGHT NOW: the next-action nudge, streak
          reward, the check-in card itself, and the photo strip.
          Grouped together so the dashboard reads as "what to do today"
          in one visual chunk, instead of a flat scroll.
          ════════════════════════════════════════════════════════════ */}
      <SectionLabel style={{ marginTop: space[8], marginBottom: space[3] }}>
        Today
      </SectionLabel>

      {/* ── Recommended-ritual banner ──────────────────────────────────
          Context-aware nudge that surfaces the next obvious action. Cycles
          based on what's missing today (no check-in, body-language not
          done in a week, fresh-scan-recommended, etc.). Only one shown
          at a time so users aren't overwhelmed. */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayMs = today.getTime();
        const hasCheckinToday = checkins.some((e) => new Date(e.ts).getTime() >= todayMs);
        const lastBehaviorObs = allEvents
          .filter((e: HealthEvent) => cat ? e.cat_id === cat.id && e.type === 'behavior_observation' : false)
          .sort((a: HealthEvent, b: HealthEvent) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
        const daysSinceBehavior = lastBehaviorObs
          ? Math.floor((Date.now() - new Date(lastBehaviorObs.ts).getTime()) / (24*60*60*1000))
          : Infinity;

        // Banner picks the highest-priority next-action nudge. The
        // "daily check-in is waiting" path was removed — DailyCheckinCard
        // right below this banner already says "How is Luna today?",
        // so a banner repeating that ask was duplicate noise. The
        // remaining priority order: stale body-language read >
        // suggest-rescan > default mood-clip nudge (only after check-in
        // is done so we don't compete with the check-in card).
        // Suppressed entirely (returns null) when none of those fire,
        // which is the common "you're up to date today" state.
        let bannerCopy: string | null = null;
        let bannerAction: (() => void) | null = null;
        if (daysSinceBehavior > 6) {
          bannerCopy = `It's been ${daysSinceBehavior === Infinity ? 'a while' : `${daysSinceBehavior} days`} — try a 6-second body language read of ${cat?.name ?? 'your cat'}.`;
          bannerAction = () => router.push('/behavior' as never);
        } else if (adjusted.suggestRescan) {
          bannerCopy = `Run a fresh scan to confirm how ${cat?.name ?? 'your cat'} is doing.`;
          bannerAction = () => router.push(quota.canScan ? '/scan' : { pathname: '/paywall', params: { source: 'scan_quota' } });
        } else if (hasCheckinToday) {
          // Default upbeat nudge — shown only AFTER today's check-in
          // is logged so we don't compete with the DailyCheckinCard.
          bannerCopy = `Capture a 6-second clip of ${cat?.name ?? 'your cat'} — AI tells you the mood.`;
          bannerAction = () => router.push('/behavior' as never);
        }
        if (!bannerCopy) return null;

        const Inner = (
          <View style={[styles.banner, { backgroundColor: t.primary50, borderColor: t.primary300 }]}>
            <Sparkle size={18} color={t.primary700} weight="duotone" />
            <Text token="caption" style={{ flex: 1, color: t.primary900, lineHeight: 18 }}>
              {bannerCopy}
            </Text>
            {bannerAction ? <CaretRight size={16} color={t.primary700} /> : null}
          </View>
        );
        return bannerAction ? (
          <Pressable onPress={bannerAction} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            {Inner}
          </Pressable>
        ) : Inner;
      })()}

      {/* ── Streak pill (3+ days — visible reward for the habit) ─────── */}
      {showStreakPill ? (
        <View style={{ alignItems: 'flex-start', marginTop: space[3] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: space[3],
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: t.secondary100,
              borderWidth: 1,
              borderColor: t.secondary500,
            }}
          >
            <Flame size={14} color={t.secondary700} weight="fill" />
            <Text token="caption" style={{ color: t.secondary900, fontFamily: 'Figtree_600SemiBold' }}>
              {currentStreakDays}-day check-in streak
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Daily check-in (always visible — full-width interactive card) */}
      <View style={{ marginTop: showStreakPill ? space[2] : space[3] }}>
        <DailyCheckinCard />
      </View>

      {/* ── Today's photo strip (companion to Bond's hero card) ──────
          Compact daily-ritual hook so users who never tap to Bond
          still build the gallery. Both surfaces share the same
          photoStudioStore. Daily cap was removed 2026-05-04 — users
          take unlimited photos; postcard samples 3 at random. */}
      <TodayPhotoStrip catId={cat?.id ?? null} catName={cat?.name ?? 'your cat'} />

      {/* ════════════════════════════════════════════════════════════════
          SECTION: KNOW YOUR CAT
          Quick-action reads — Body Language (6 sec video) + Meow
          Translator (4 sec video). Both are "do something with your
          cat right now" actions, which is exactly the Today tab's
          identity.

          2026-05-11 reshuffle: Meow Translator moved here from Bond
          (it's an action, not a passive bond surface). Health Rhythm
          moved to Triage (it's a 30-day trend visualisation, sits
          better with the medical tab). See src/services/meowTranslator.ts
          and app/health-rhythm.tsx.

          STILL DEFERRED:
            - Sleep Coach = 1-2 weeks of signal-processing + Android
              background-audio integration. Hidden until unblocked.
          ════════════════════════════════════════════════════════════ */}
      <SectionLabel style={{ marginTop: space[8], marginBottom: space[3] }}>
        Know your cat
      </SectionLabel>
      <View style={styles.tileGrid}>
        <ModuleTile
          live
          icon={<Sparkle size={24} color={t.primary700} weight="duotone" />}
          title="Body Language"
          body={`Record 6 sec → AI tells you what ${cat?.name ?? 'your cat'} is feeling.`}
          onPress={() => router.push('/behavior' as never)}
        />
        <ModuleTile
          live
          icon={<Microphone size={24} color={t.primary700} weight="duotone" />}
          title="Meow Translator"
          body={`Record 4 sec → one line in ${cat?.name ?? 'your cat'}'s actual voice.`}
          onPress={() => router.push('/translate' as never)}
        />
      </View>

      {/* ════════════════════════════════════════════════════════════════
          SECTION: MEDICAL
          Scan entry, follow-ups, and the scan history. Sits at the
          bottom because it's the heaviest visual block (full-width CTA
          + list) and most users only need it occasionally. The pending
          follow-up card sits between Scan now and Recent scans because
          it's the one piece of medical work that's TIME-BOUND.
          ════════════════════════════════════════════════════════════ */}
      <SectionLabel style={{ marginTop: space[8], marginBottom: space[3] }}>
        Medical
      </SectionLabel>

      {/* Triage — primary CTA. Has its own tab too but the home shortcut
          preserves muscle memory + keeps the medical entry one tap away. */}
      <Button
        label={quota.canScan ? 'Scan now' : 'Unlock more scans'}
        onPress={() =>
          router.push(
            quota.canScan
              ? '/scan'
              : { pathname: '/paywall', params: { source: 'scan_quota' } },
          )
        }
        size="lg"
        pill
        fullWidth
        leftIcon={<Stethoscope size={20} color={t.textInverse} weight="bold" />}
      />

      <Text
        token="caption"
        color="textMuted"
        style={{ textAlign: 'center', marginTop: space[3] }}
      >
        {quotaSubtitle(quota)}
      </Text>

      {/* Pending check-in nudge. If there's a scan from 6h–14d ago that
          the owner hasn't answered or dismissed, surface a one-tap path
          to the outcome-check screen. The push notification is the
          primary hook; this is the fallback in case notifications were
          denied or the user tapped through to the app directly.

          Card has its own Dismiss control (added at user request) so
          the user doesn't have to drill into a scan-result screen
          just to clear it. Tapping Dismiss writes outcome_dismissed_at
          on the scan; both this card AND the inline result.tsx card
          check that flag, so dismiss is a single global gesture. */}
      {(() => {
        const now = Date.now();
        const pending = scans.find((s) => {
          if (s.outcome_responded || s.outcome_dismissed_at) return false;
          const age = now - new Date(s.created_at).getTime();
          return age > 6 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000;
        });
        if (!pending) return null;
        const onDismissPending = () => {
          updateScan(pending.id, { outcome_dismissed_at: new Date().toISOString() });
        };
        return (
          <View style={{ marginTop: space[5] }}>
            <View
              style={{
                borderRadius: radius.lg,
                backgroundColor: t.primary50,
                borderWidth: 1,
                borderColor: t.primary300,
                padding: space[4],
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Scan follow-up for ${cat?.name ?? 'your cat'} — share how they're doing since the recent triage`}
                onPress={() =>
                  router.push({ pathname: '/outcome-check', params: { scanId: pending.id } })
                }
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[3],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <HeartStraight size={22} color={t.primary700} weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text token="heading3" color="primary700">
                    Scan follow-up
                  </Text>
                  <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    How is {cat?.name ?? 'your cat'} doing since the {new Date(pending.created_at).toLocaleDateString()} scan? 15 seconds.
                  </Text>
                </View>
                <CaretRight size={16} color={t.primary700} />
              </Pressable>
              {/* Dismiss row — tertiary action, kept visually quiet so
                  it never competes with the primary tap-to-respond
                  intent. Right-aligned link; standard ghost-button feel. */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: space[3] }}>
                <Pressable
                  onPress={onDismissPending}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss this scan follow-up"
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text token="caption" color="textMuted" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                    Dismiss
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })()}

      <View style={{ marginTop: space[6] }}>
        <Text token="heading3" style={{ marginBottom: space[3] }}>Recent scans</Text>
        {scans.length === 0 ? (
          <Card>
            <Text token="body" color="textSecondary">
              No scans yet. Run one to start {cat?.name ?? 'your cat'}&apos;s health timeline.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: space[2] }}>
            {scans.slice(0, 5).map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/result', params: { id: s.id } })}
                onLongPress={() => confirmDeleteScan(s.id, s.headline)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`Open scan: ${s.headline}. ${s.urgency} tier, score ${s.score}, ${new Date(s.created_at).toLocaleDateString()}. Long press to delete.`}
                style={({ pressed }) => [
                  { borderRadius: radius.lg },
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.995 }] } : null,
                ]}
              >
                <Card>
                  <View style={styles.scanRow}>
                    {s.mode === 'litter_box' ? (
                      <Toilet size={18} color={t.primary700} weight="fill" />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text token="heading3" numberOfLines={2}>{s.headline}</Text>
                      <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                        {new Date(s.created_at).toLocaleDateString()} · score {s.score}
                      </Text>
                    </View>
                    <UrgencyBadge tier={s.urgency} size="sm" />
                    <CaretRight size={16} color={t.textMuted} style={{ marginLeft: space[2] }} />
                  </View>
                </Card>
              </Pressable>
            ))}
            {scans.length > 0 ? (
              <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[2] }}>
                Long-press a scan to delete it.
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/**
 * One-liner that summarises the unified scan quota for the dashboard
 * footer. Pro users get the generic privacy line; free users see exactly
 * how many scans they have left in the current month.
 */
function quotaSubtitle(q: ReturnType<typeof useScanQuota>): string {
  if (q.isPro) return 'Unlimited \u00b7 Private \u00b7 Not a substitute for veterinary care';
  if (q.canScan) {
    return `${q.remaining} free scan${q.remaining === 1 ? '' : 's'} left this month`;
  }
  return 'Free monthly scans used \u00b7 Upgrade for unlimited check-ins';
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[5],
    gap: space[3],
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ringRow: { alignItems: 'center', marginTop: space[5] },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  behaviorTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  behaviorIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tileGrid: {
    // Vertical spacing now owned by the surrounding SectionLabel
    // (Today screen sets marginTop: space[8] / marginBottom: space[3]
    // on the label). Keeping zero here means the grid hugs the label
    // tightly with no double-margin.
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  moduleTile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[4],
    justifyContent: 'space-between',
  },
  moduleTileBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
  },
  todayPhotoAddTile: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Compact today-photo strip — companion to Bond's hero photo card.
 *
 * Why this lives on Today: Today is the most-opened tab, where the
 * daily ritual happens. If photo capture were ONLY on Bond, users who
 * never tap into Bond would never build their gallery — and every
 * Bond feature (Postcard, Posters, Diary's vision input, time-lapse)
 * would silently under-perform. This strip extends the daily ritual
 * (mood-tap → appetite-tap → photo-snap) and writes to the SAME
 * photoStudioStore as Bond's hero card. The daily cap is enforced by
 * the store, so the count is genuinely shared across both surfaces.
 *
 * Compact-mode design (vs Bond's hero):
 *   - One-line label + cap counter on top
 *   - Horizontal thumbnails strip + "Add" tile
 *   - Single explanatory line underneath ("Photos here build...")
 *   - No empty-state value pitch (Bond carries that)
 */
function TodayPhotoStrip({
  catId,
  catName,
}: {
  catId: string | null;
  catName: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const todaysPhotos = useTodaysPhotos(catId);
  const addPhoto = usePhotoStudioStore((s) => s.addPhoto);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    if (!catId || adding) return;
    Alert.alert(
      `Add a photo of ${catName}`,
      `Snap fresh — or pick from your gallery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => void capture('camera') },
        { text: 'Gallery', onPress: () => void capture('gallery') },
      ],
    );
  };

  const capture = async (source: 'camera' | 'gallery') => {
    if (!catId) return;
    setAdding(true);
    setError(null);
    try {
      const picked = await captureViaImagePicker({
        source,
        selectionLimit: PICKER_BATCH_LIMIT,
      });
      if (picked.length === 0) return; // user cancelled
      for (const p of picked) {
        await addPhoto({
          catId,
          sourceUri: p.uri,
          source,
          ...(p.width != null ? { width: p.width } : {}),
          ...(p.height != null ? { height: p.height } : {}),
        });
      }
      track({
        type: 'photo_studio_photo_added',
        props: {
          source,
          replaced_existing: false,
          total_after: todaysPhotos.length + picked.length,
        },
      });
    } catch (e) {
      console.warn('[Today] capture failed:', e);
      const reason = e instanceof Error ? e.message : 'unknown';
      setError(`Couldn't add the photo — ${reason.slice(0, 100)}`);
    } finally {
      setAdding(false);
    }
  };

  const goToGallery = () => router.push('/photo-studio' as never);

  return (
    <View
      style={{
        marginTop: space[4],
        padding: space[4],
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: t.surfaceElevated,
        borderColor: t.borderSubtle,
      }}
    >
      {/* Compact horizontal layout: Add tile on the left, all the
          metadata (label + count + helper copy) on the right. Removes
          the awkward right-side whitespace from the previous design
          where thumbnails had been removed but the tile sat alone in
          a wide card. The right column carries:
            - Section label (PHOTOS) + tappable "View all →"
            - One-line helper telling the user what photos feed
          ...so the Add tile is balanced visually instead of floating
          in empty space. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Pressable
          onPress={onAdd}
          disabled={!catId || adding}
          accessibilityRole="button"
          accessibilityLabel={`Add a photo of ${catName}`}
          style={({ pressed }) => [
            styles.todayPhotoAddTile,
            {
              backgroundColor: t.secondary100,
              borderColor: t.secondary500,
              opacity: pressed || adding ? 0.7 : 1,
            },
          ]}
        >
          <CameraIcon size={22} color={t.secondary700} weight="duotone" />
          <Text
            token="caption"
            style={{
              color: t.secondary900,
              fontFamily: 'Figtree_600SemiBold',
              marginTop: 2,
              fontSize: 10,
            }}
          >
            {adding ? 'Adding…' : 'Add'}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          {/* Top row: section label + count/view-all link */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 2,
            }}
          >
            <Text
              token="caption"
              color="textMuted"
              style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}
            >
              Photos
            </Text>
            {todaysPhotos.length > 0 ? (
              <Pressable
                onPress={goToGallery}
                accessibilityRole="button"
                accessibilityLabel={`View all ${catName}'s photos in Photo Studio`}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text token="caption" color="textMuted">
                  {todaysPhotos.length} {todaysPhotos.length === 1 ? 'photo' : 'photos'} · View all →
                </Text>
              </Pressable>
            ) : (
              <Text token="caption" color="textMuted">
                0 photos
              </Text>
            )}
          </View>
          {/* Helper line — concise; same content as before but trimmed
              to fit a compact two-line layout next to the Add tile. */}
          <Text token="caption" color="textMuted" style={{ lineHeight: 17 }}>
            Each photo brings {catName} more to life here.
          </Text>
        </View>
      </View>
      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: space[2],
          }}
        >
          <WarningCircle size={14} color={t.warning} />
          <Text token="caption" color="textMuted">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Square-ish dashboard tile used in the Today-tab 2x2 grid. Two states:
 * `live` (interactive, primary palette) and `comingSoon` (dashed border,
 * dimmed, non-interactive — used to preview Phase-2 features without
 * making them tappable). Single component keeps the grid visually tight.
 */
function ModuleTile({
  icon,
  title,
  body,
  live,
  comingSoon,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  live?: boolean;
  comingSoon?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  const interactive = !!onPress && !comingSoon;
  const containerStyle = [
    styles.moduleTile,
    {
      backgroundColor: comingSoon ? t.surface : t.surfaceElevated,
      borderColor: t.borderSubtle,
      borderStyle: comingSoon ? ('dashed' as const) : ('solid' as const),
      opacity: comingSoon ? 0.85 : 1,
    },
  ];
  const inner = (
    <>
      {icon}
      <View style={{ marginTop: space[3] }}>
        <Text token="heading3" style={{ marginBottom: 2 }}>{title}</Text>
        <Text token="caption" color="textMuted" style={{ lineHeight: 18 }}>{body}</Text>
      </View>
      {comingSoon ? (
        <View style={[styles.moduleTileBadge, { backgroundColor: t.surfaceSunken, marginTop: space[2] }]}>
          <Text token="caption" style={{ color: t.textMuted, fontSize: 10 }}>
            SOON
          </Text>
        </View>
      ) : live ? (
        <View style={[styles.moduleTileBadge, { backgroundColor: t.primary100, marginTop: space[2] }]}>
          <Text token="caption" style={{ color: t.primary900, fontSize: 10 }}>
            OPEN
          </Text>
        </View>
      ) : null}
    </>
  );
  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...containerStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={containerStyle}>{inner}</View>;
}

/**
 * Empty score ring — shown on first launch and when no scan is fresh.
 * Avoids the "fake 92" placeholder that felt misleading. Matches the
 * ScoreRing footprint so layout doesn't jump after the first scan.
 */
/**
 * Small all-caps section label — used to break the home tab into clear
 * "blocks" so the page reads as a structured dashboard, not an endless
 * vertical scroll. Keep them short (1-2 words). Visually quiet — color
 * is muted so they organise without competing.
 */
function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: import('react-native').ViewStyle;
}) {
  const t = useTheme();
  return (
    <Text
      token="caption"
      style={[
        {
          color: t.textMuted,
          fontFamily: 'Figtree_600SemiBold',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          fontSize: 11,
        },
        style as never,
      ]}
    >
      {children}
    </Text>
  );
}

function EmptyScoreRing({ catName }: { catName: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 12,
        borderColor: t.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space[5],
      }}
    >
      <Text token="heading3" color="textMuted" align="center">
        No scan yet
      </Text>
      <Text
        token="caption"
        color="textMuted"
        align="center"
        style={{ marginTop: space[1] }}
      >
        Tap scan to see {catName}&apos;s health score
      </Text>
    </View>
  );
}

/**
 * Circular cat-photo avatar with a friendly fallback when none is set.
 * Shared shape: same border + radius pattern as the avatar in /cats so
 * the cat reads identically across the app. Used in Today + Bond
 * headers as the personalisation primitive.
 */
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
        backgroundColor: t.primary100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CatIcon size={size * 0.5} color={t.primary700} weight="duotone" />
    </View>
  );
}
