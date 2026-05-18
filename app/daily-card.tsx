/**
 * Daily Card — "the card from your cat today."
 *
 * Co-Star's daily horoscope is the core daily-loop feature. CatMD's
 * equivalent is THIS screen: an opens-to-a-card-shaped design (not
 * chat) that surfaces the cat's punchiest 1-liner of the day, with
 * a mood word and a Share button.
 *
 * Implements item §3 of marketing/chat-as-viral-lever.md.
 *
 *   ┌──────────────────────┐
 *   │      [photo]         │
 *   │       LILY           │   eyebrow
 *   │                      │
 *   │   "I have noticed    │
 *   │    the radiator      │   big italic serif
 *   │    has been off      │
 *   │    for three days."  │
 *   │                      │
 *   │      WATCHFUL        │   mood word, sage
 *   │                      │
 *   │   [Share]   catmd    │
 *   └──────────────────────┘
 *
 * Source of headline: pickCatVoiceHighlight(today's diary entry).
 * Same heuristic that powers the 19:00 cat-voice push, so the
 * lock-screen text + the daily-card text MATCH — tapping the push
 * opens the card; the user already saw the line on the lock screen
 * and finds the same line presented beautifully here, framed for
 * sharing.
 *
 * Empty state: if no diary entry today, kicks generation. If today
 * has no material AND the cat isn't yet ready for empty-day entries
 * (≥7 distinct active days), shows a quiet "nothing to report" view.
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ShareNetwork } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useShareableCard } from '../src/components/ShareableCatCard';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useEntitlement } from '../src/hooks/useEntitlement';
import {
  useDiaryEntryByDate,
  useDiaryGenerating,
  useDiaryStore,
  useTodaysDiaryEntry,
} from '../src/state/diaryStore';
import { pickCatVoiceHighlight } from '../src/services/diary';
import { track } from '../src/services/analytics';
import { getVoiceModeTag } from '../src/services/voiceModes';
import { useMoodFeedbackStore } from '../src/state/moodFeedbackStore';
import { resolveTodaysMood, localDateKey } from '../src/services/dailyMood';
import {
  buildArchetypeMod,
  buildLiveMoodContext,
  buildTodayBehaviorMod,
  computeFeedbackMod,
  hasMedicalConcernToday,
} from '../src/services/moodWeights';
import { usePersonalityStore } from '../src/state/personalityStore';
import { useHealthStore } from '../src/state/healthStore';
import { resolveCatAgeMonths } from '../src/state/catStore';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

// ── Helpers (top-level so they don't recompute every render) ──

function todayKeyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Friendly relative-day label — drives the eyebrow on the card and
 * the share-card export. "Today" / "Yesterday" / "3 days ago" /
 * absolute-date for far-back. Mirrors the convention used on the
 * behavior-history screen for consistency.
 */
function relativeDayLabel(yyyymmdd: string): string {
  const today = todayKeyLocal();
  if (yyyymmdd === today) return 'Today';
  try {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    if (y == null || m == null || d == null) return yyyymmdd;
    const dateMs = new Date(y, m - 1, d).getTime();
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round((todayMs - dateMs) / 86400000);
    if (days === 1) return 'Yesterday';
    if (days > 1 && days < 30) return `${days} days ago`;
    // Beyond ~30 days: show absolute month + day
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return yyyymmdd;
  }
}

export default function DailyCardScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  // hasProAccess gates the AI generation. The Daily Card is the same
  // diary content rendered in a different layout — same Pro rules
  // apply. History (past cards) stays viewable; today's auto-generate
  // and retry are gated.
  const { hasProAccess } = useEntitlement();
  // ── Route params ─────────────────────────────────────────────────
  // `source` — entry-point attribution for the daily_card_opened event.
  // `date`   — YYYY-MM-DD when the user navigated from a past diary
  //            entry. When omitted, defaults to today (the original
  //            push-notification flow). Added 2026-05-08 after user
  //            feedback that past diary entries should also have a
  //            shareable card surface.
  const params = useLocalSearchParams<{ source?: string; date?: string }>();
  const today = todayKeyLocal();
  const targetDate = (() => {
    const raw = (params.date ?? '').toString().trim();
    // Defensive: only accept YYYY-MM-DD, otherwise fall back to today.
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  })();
  const isToday = targetDate === today;

  // Two parallel hooks so the screen still works as before when no
  // date param is passed (the push-notification path) AND for
  // arbitrary past dates from the diary CTA.
  const todayEntry = useTodaysDiaryEntry(cat?.id);
  const pastEntry = useDiaryEntryByDate(cat?.id, isToday ? null : targetDate);
  const entry = isToday ? todayEntry : pastEntry;

  const generating = useDiaryGenerating(cat?.id);
  const generateForToday = useDiaryStore((s) => s.generateForToday);
  const [error, setError] = useState<string | null>(null);
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();

  // Headline priority (audit 2026-05-14 round 7):
  //   1. The generation-time validated `card_line` (gated by
  //      voiceQuality + retry path in services/diary.ts). When this
  //      exists, it has already passed the quotability gate.
  //   2. Heuristic `pickCatVoiceHighlight(body)` for legacy entries
  //      cached before card_line was introduced, OR when the gated
  //      regeneration fell through to no-card-line.
  const headline = useMemo(() => {
    if (!entry) return null;
    if (entry.card_line && entry.card_line.trim().length > 0) {
      return entry.card_line.trim();
    }
    return pickCatVoiceHighlight(entry);
  }, [entry]);

  // Mood word here is the diary's free-text descriptor — content-
  // specific to the day's events ("watchful", "restless", etc.). The
  // daily-mood LOTTERY label (grumpy / mischievous / etc.) is
  // deliberately NOT shown here — it's a secret tone-driver users
  // discover by talking to the cat in chat, not a label declared up
  // front. Different concept axes, kept separate.
  const moodWord = entry?.mood_word ?? null;
  const catName = cat?.name ?? 'your cat';
  const eyebrowLabel = relativeDayLabel(targetDate);

  // Auto-generate today's entry on mount if missing — same semantics
  // as the diary screen's auto-generate. requireMaterial: true means
  // empty days don't get populated with junk; we surface a quiet
  // empty state instead.
  //
  // IMPORTANT: only runs for TODAY. Past-date views never auto-
  // generate — if the past entry isn't cached we just show the empty
  // state. We don't backfill on demand because it would be confusing
  // (the entry would be written days late, with whatever data
  // happens to be in the store now).
  useEffect(() => {
    if (!cat?.id) return;
    if (!isToday) return;
    if (todayEntry) return;
    if (generating) return;
    // Pro gate — silent skip for non-Pro users. The card screen still
    // renders historical cards; only today's auto-generate is gated.
    if (!hasProAccess) return;
    setError(null);
    void generateForToday(cat.id, { requireMaterial: true })
      .catch((e) => {
        console.warn('[DailyCard] auto-generation failed:', e);
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't write today's card — tap retry.",
        );
      });
    // hasProAccess in deps for cold-start anonymous-session race fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id, isToday, hasProAccess]);

  // Source attribution — the screen accepts a ?source=... param so
  // we can split the funnel between the cat-voice evening push
  // (when shipped), the diary screen's "Today's card" link, and
  // direct deep-link / dev navigation.
  useEffect(() => {
    if (!cat?.id) return;
    const raw = (params.source ?? '').toString();
    const source: 'push' | 'diary' | 'direct' =
      raw === 'push' || raw === 'diary' ? raw : 'direct';
    track({
      type: 'daily_card_opened',
      props: {
        had_entry: !!entry,
        had_headline: !!headline,
        source,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id, targetDate]);

  const handleShare = async () => {
    if (!cat || !headline) return;
    // Resolve the mood that's active for this cat today using the
    // shared live-mood-context builder (audit 2026-05-14 round 10
    // P2 #4). Pre-fix the share handler hand-rolled today's
    // behavior tags + check-in; now it uses the same helper as
    // chat/diary/postcard so all surfaces stay in lockstep. Failures
    // are silent — the share itself must always succeed.
    try {
      const arch = usePersonalityStore.getState().getProfile(cat.id)?.archetype ?? null;
      const fbTable = useMoodFeedbackStore.getState().getFeedback(cat.id);
      const liveCtx = await buildLiveMoodContext({
        catId: cat.id,
        ageMonths: resolveCatAgeMonths(cat) ?? null,
      });
      const dailyMood = resolveTodaysMood({
        catId: cat.id,
        checkinMood: liveCtx.checkinMood ?? null,
        hasRecentMedicalConcern: hasMedicalConcernToday(cat.id),
        archetypeMod: buildArchetypeMod(arch),
        todayMod: buildTodayBehaviorMod(liveCtx),
        feedbackMod: computeFeedbackMod(fbTable),
      });
      useMoodFeedbackStore.getState().recordShare(cat.id, dailyMood.id);
      track({
        type: 'daily_card_shared',
        props: {
          mood: dailyMood.id,
          cluster: dailyMood.cluster,
          surface: 'native_share',
          voice_mode_tag: getVoiceModeTag(dailyMood.id),
        },
      });
    } catch {
      // share-tracking failure must never block the share itself
    }
    void shareCard(
      {
        kind: 'diary_entry',
        catName: cat.name,
        catPhotoUri: cat.photo_uri ?? null,
        headline,
        eyebrow: eyebrowLabel,
        ...(moodWord ? { subtitle: moodWord } : {}),
      },
      { surface: 'daily_card' },
    );
  };

  if (!cat) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: t.surface, paddingTop: insets.top },
        ]}
      >
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
    <View
      style={[
        styles.container,
        { backgroundColor: t.surface, paddingTop: insets.top },
      ]}
    >
      <Header onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading — only relevant for today's auto-generation. Past
            dates never auto-generate, so generating is a no-op there. */}
        {isToday && generating && !entry ? (
          <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
            <ActivityIndicator color={t.secondary700} size="large" />
            <Text
              token="body"
              style={{
                marginTop: space[4],
                color: t.secondary700,
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              {catName} is composing today&apos;s card…
            </Text>
          </View>
        ) : null}

        {/* Empty state — no entry, not generating, no error.
            Copy adapts to today vs past: "No card today" tells the
            user to add data and the card writes itself; for a past
            day with no cached entry, the explanation differs (the
            day was empty / never had a populated diary entry). */}
        {!generating && !entry && !error ? (
          <View style={{ paddingVertical: space[10] }}>
            <Text
              token="caption"
              style={{
                color: t.secondary700,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                marginBottom: space[3],
                fontFamily: 'Figtree_600SemiBold',
                textAlign: 'center',
              }}
            >
              {isToday ? 'No card today' : `No card from ${eyebrowLabel.toLowerCase()}`}
            </Text>
            <Text
              token="body"
              color="textMuted"
              style={{ textAlign: 'center', lineHeight: 24 }}
            >
              {isToday
                ? `${catName} has nothing to report yet. Log a check-in or snap a photo, and ${catName}'s card will write itself.`
                : `${catName} didn't have a card on this day — likely a quiet day with no diary entry. Past days can't be backfilled here.`}
            </Text>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={{ paddingVertical: space[10] }}>
            <Text
              token="body"
              color="textMuted"
              style={{ textAlign: 'center', marginBottom: space[4] }}
            >
              {error}
            </Text>
            <Button
              label={hasProAccess ? 'Try again' : 'Unlock with Pro'}
              variant="secondary"
              onPress={() => {
                if (!hasProAccess) {
                  router.push({
                    pathname: '/paywall',
                    params: { source: 'diary' },
                  } as never);
                  return;
                }
                setError(null);
                if (cat?.id) {
                  void generateForToday(cat.id, { requireMaterial: true });
                }
              }}
            />
          </View>
        ) : null}

        {/* The card itself */}
        {entry && headline ? (
          <View style={[styles.card, { borderColor: t.borderSubtle }]}>
            {/* Top: cat photo + eyebrow */}
            <View style={styles.cardTop}>
              {cat.photo_uri ? (
                <Image
                  source={{ uri: cat.photo_uri }}
                  style={[
                    styles.cardPhoto,
                    { borderColor: t.borderSubtle },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.cardPhoto,
                    {
                      backgroundColor: t.secondary100,
                      borderColor: t.borderSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Text token="displayLg" style={{ color: t.secondary700 }}>
                    {cat.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={{
                  marginTop: space[3],
                  color: t.secondary700,
                  letterSpacing: 2,
                  fontSize: 12,
                  fontFamily: 'Figtree_600SemiBold',
                  textTransform: 'uppercase',
                }}
              >
                {cat.name}
              </Text>
              <Text
                token="caption"
                style={{
                  color: t.textMuted,
                  letterSpacing: 1.4,
                  fontSize: 10,
                  marginTop: 2,
                  textTransform: 'uppercase',
                  fontFamily: 'Figtree_400Regular',
                }}
              >
                {eyebrowLabel}
              </Text>
            </View>

            {/* Middle: headline */}
            <View style={styles.cardMiddle}>
              <Text
                style={{
                  color: t.textPrimary,
                  fontFamily: 'SourceSerif4_500Medium',
                  fontStyle: 'italic',
                  fontSize: 26,
                  lineHeight: 36,
                  textAlign: 'center',
                }}
              >
                {`“${headline}”`}
              </Text>
              {moodWord ? (
                <Text
                  style={{
                    marginTop: space[5],
                    color: t.secondary700,
                    letterSpacing: 4,
                    fontSize: 12,
                    fontFamily: 'Figtree_600SemiBold',
                    textTransform: 'uppercase',
                  }}
                >
                  {moodWord}
                </Text>
              ) : null}
            </View>

            {/* Bottom: share row */}
            <View
              style={[
                styles.cardBottom,
                { borderTopColor: t.borderSubtle },
              ]}
            >
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[2],
                    paddingVertical: space[2],
                    paddingHorizontal: space[3],
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={6}
              >
                <ShareNetwork
                  size={16}
                  color={t.secondary700}
                  weight="bold"
                />
                <Text
                  style={{
                    color: t.secondary700,
                    letterSpacing: 1.4,
                    fontSize: 12,
                    fontFamily: 'Figtree_600SemiBold',
                    textTransform: 'uppercase',
                  }}
                >
                  Share
                </Text>
              </Pressable>
              <Text
                token="caption"
                style={{ color: t.textMuted, fontSize: 11 }}
              >
                catmd.pet
              </Text>
            </View>
          </View>
        ) : null}

        {/* Read full diary link */}
        {entry ? (
          <Pressable
            onPress={() => router.push('/diary' as never)}
            style={{
              marginTop: space[6],
              paddingVertical: space[3],
              alignItems: 'center',
            }}
          >
            <Text token="caption" color="textMuted">
              Read {catName}&apos;s full diary entry →
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Off-screen host for the ShareableCatCard. */}
      {ShareCardHost}
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
        <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
      </Pressable>
      <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
        Today&apos;s card
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: space[5],
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space[8],
    paddingHorizontal: space[6],
    alignItems: 'center',
    gap: space[6],
  },
  cardTop: {
    alignItems: 'center',
  },
  cardPhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
  },
  cardMiddle: {
    paddingVertical: space[4],
    alignItems: 'center',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: space[4],
    borderTopWidth: 1,
  },
});
