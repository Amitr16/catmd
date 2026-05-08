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
import {
  useDiaryGenerating,
  useDiaryStore,
  useTodaysDiaryEntry,
} from '../src/state/diaryStore';
import { pickCatVoiceHighlight } from '../src/services/diary';
import { track } from '../src/services/analytics';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function DailyCardScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const todayEntry = useTodaysDiaryEntry(cat?.id);
  const generating = useDiaryGenerating(cat?.id);
  const generateForToday = useDiaryStore((s) => s.generateForToday);
  const [error, setError] = useState<string | null>(null);
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();

  const headline = useMemo(() => {
    if (!todayEntry) return null;
    return pickCatVoiceHighlight(todayEntry);
  }, [todayEntry]);

  // Mood word here is the diary's free-text descriptor — content-
  // specific to the day's events ("watchful", "restless", etc.). The
  // daily-mood LOTTERY label (grumpy / mischievous / etc.) is
  // deliberately NOT shown here — it's a secret tone-driver users
  // discover by talking to the cat in chat, not a label declared up
  // front. Different concept axes, kept separate.
  const moodWord = todayEntry?.mood_word ?? null;
  const catName = cat?.name ?? 'your cat';

  // Auto-generate today's entry on mount if missing — same semantics
  // as the diary screen's auto-generate. requireMaterial: true means
  // empty days don't get populated with junk; we surface a quiet
  // empty state instead.
  useEffect(() => {
    if (!cat?.id) return;
    if (todayEntry) return;
    if (generating) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Source attribution — the screen accepts a ?source=... param so
  // we can split the funnel between the cat-voice evening push
  // (when shipped), the diary screen's "Today's card" link, and
  // direct deep-link / dev navigation.
  const params = useLocalSearchParams<{ source?: string }>();
  useEffect(() => {
    if (!cat?.id) return;
    const raw = (params.source ?? '').toString();
    const source: 'push' | 'diary' | 'direct' =
      raw === 'push' || raw === 'diary' ? raw : 'direct';
    track({
      type: 'daily_card_opened',
      props: {
        had_entry: !!todayEntry,
        had_headline: !!headline,
        source,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  const handleShare = () => {
    if (!cat || !headline) return;
    void shareCard(
      {
        kind: 'diary_entry',
        catName: cat.name,
        catPhotoUri: cat.photo_uri ?? null,
        headline,
        eyebrow: 'Today',
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
        {/* Loading */}
        {generating && !todayEntry ? (
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
              {catName} is composing today's card…
            </Text>
          </View>
        ) : null}

        {/* Empty state — no entry, not generating, no error */}
        {!generating && !todayEntry && !error ? (
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
              No card today
            </Text>
            <Text
              token="body"
              color="textMuted"
              style={{ textAlign: 'center', lineHeight: 24 }}
            >
              {catName} has nothing to report yet. Log a check-in or
              snap a photo, and {catName}'s card will write itself.
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
              label="Try again"
              variant="secondary"
              onPress={() => {
                setError(null);
                if (cat?.id) {
                  void generateForToday(cat.id, { requireMaterial: true });
                }
              }}
            />
          </View>
        ) : null}

        {/* The card itself */}
        {todayEntry && headline ? (
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
                Today
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
        {todayEntry ? (
          <Pressable
            onPress={() => router.push('/diary' as never)}
            style={{
              marginTop: space[6],
              paddingVertical: space[3],
              alignItems: 'center',
            }}
          >
            <Text token="caption" color="textMuted">
              Read {catName}'s full diary entry →
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
        Today's card
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
