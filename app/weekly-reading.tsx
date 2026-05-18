/**
 * Weekly Reading — the cat reads the HUMAN.
 *
 * Implements item §5 of marketing/chat-as-viral-lever.md: a once-a-
 * week observational "reading" the cat surfaces about the human's
 * patterns this week. Co-Star-style. Brutal-honesty calibrated.
 * Hugely shareable because it sounds like the cat is psychic.
 *
 *   ┌─────────────────────────┐
 *   │     [photo]             │
 *   │      LILY               │  eyebrow
 *   │      THIS WEEK          │
 *   │                         │
 *   │  "You haven't been      │
 *   │   sleeping. Your scent  │  italic serif
 *   │   is off."              │
 *   │                         │
 *   │      WATCHFUL           │  verdict word
 *   │                         │
 *   │   [Share]   catmd       │
 *   └─────────────────────────┘
 *
 * Generation: lazy on screen mount via weeklyReadingStore. One
 * reading per ISO-week per cat (cached). The Sunday push routes
 * here; user can also reach via a tile on the bond/personality
 * surface.
 */
import { useEffect, useState } from 'react';
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
import { ArrowLeft, ShareNetwork } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useShareableCard } from '../src/components/ShareableCatCard';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useEntitlement } from '../src/hooks/useEntitlement';
import {
  useThisWeeksReading,
  useWeeklyReadingGenerating,
  useWeeklyReadingStore,
} from '../src/state/weeklyReadingStore';
import { track } from '../src/services/analytics';
import { getPronouns } from '../src/services/pronouns';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function WeeklyReadingScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const reading = useThisWeeksReading(cat?.id);
  const generating = useWeeklyReadingGenerating(cat?.id);
  const generateForThisWeek = useWeeklyReadingStore((s) => s.generateForThisWeek);
  const { hasProAccess } = useEntitlement();
  const [error, setError] = useState<string | null>(null);
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();

  const catName = cat?.name ?? 'your cat';

  // Auto-generate on mount if no cached reading for this week.
  useEffect(() => {
    if (!cat?.id) return;
    if (reading) return;
    if (generating) return;
    // Pro gate — weekly reading is an LLM call (~$0.0005). Same
    // policy as diary: history viewable, generation gated.
    if (!hasProAccess) return;
    setError(null);
    void generateForThisWeek(cat.id).catch((e) => {
      console.warn('[WeeklyReading] generation failed:', e);
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't compose this week's reading — tap retry.",
      );
    });
    // hasProAccess in deps for cold-start anonymous-session race fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id, hasProAccess]);

  useEffect(() => {
    if (!cat?.id) return;
    track({
      type: 'weekly_reading_opened',
      props: { had_cached: !!reading },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  const handleShare = () => {
    if (!cat || !reading) return;
    // Eyebrow uses gender-aware "Subject noticed" — "He noticed" /
    // "She noticed" / "They noticed". Real bug 2026-05-09: hardcoded
    // "She noticed" was wrong for male cats. Routed through the
    // pronouns helper for consistency across surfaces.
    const subj = getPronouns(cat.sex).Subject;
    void shareCard(
      {
        kind: 'becoming_milestone',
        catName: cat.name,
        catPhotoUri: cat.photo_uri ?? null,
        headline: reading.reading,
        eyebrow: `${subj} noticed`,
        ...(reading.verdict ? { subtitle: reading.verdict } : {}),
      },
      { surface: 'weekly_reading' },
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
        <Header onBack={() => router.back()} catSex="unknown" />
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
      <Header onBack={() => router.back()} catSex={cat?.sex ?? 'unknown'} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading */}
        {generating && !reading ? (
          <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
            <ActivityIndicator color={t.secondary700} size="large" />
            <Text
              token="body"
              style={{
                marginTop: space[4],
                color: t.secondary700,
                fontStyle: 'italic',
                textAlign: 'center',
                paddingHorizontal: space[5],
              }}
            >
              {catName} is composing this week&apos;s reading…
            </Text>
          </View>
        ) : null}

        {/* Error */}
        {error && !generating ? (
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
                  void generateForThisWeek(cat.id, { force: true });
                }
              }}
            />
          </View>
        ) : null}

        {/* The reading card */}
        {reading ? (
          <View
            style={[
              styles.card,
              {
                borderColor: t.borderSubtle,
                backgroundColor: t.surfaceElevated,
              },
            ]}
          >
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
                {getPronouns(cat.sex).Subject} noticed · this week
              </Text>
            </View>

            <View style={styles.cardMiddle}>
              <Text
                style={{
                  color: t.textPrimary,
                  fontFamily: 'SourceSerif4_500Medium',
                  fontStyle: 'italic',
                  fontSize: 24,
                  lineHeight: 34,
                  textAlign: 'center',
                }}
              >
                {`“${reading.reading.trim()}”`}
              </Text>
              {reading.verdict ? (
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
                  {reading.verdict}
                </Text>
              ) : null}
            </View>

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

        {reading ? (
          <Text
            token="caption"
            color="textMuted"
            style={{
              textAlign: 'center',
              marginTop: space[6],
              lineHeight: 18,
              paddingHorizontal: space[3],
            }}
          >
            A new reading lands every Sunday at 19:00. The cat is
            always watching.
          </Text>
        ) : null}
      </ScrollView>

      {/* Off-screen host for the ShareableCatCard. */}
      {ShareCardHost}
    </View>
  );
}

function Header({
  onBack,
  catSex,
}: {
  onBack: () => void;
  catSex: 'male' | 'female' | 'unknown';
}) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
        <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
      </Pressable>
      <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
        {getPronouns(catSex).Subject} noticed
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
