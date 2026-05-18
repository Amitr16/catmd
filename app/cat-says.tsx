/**
 * "Things {Cat} Said" — the Greatest Hits surface.
 *
 * A scroll page that surfaces the cat's most-screenshot-worthy past
 * chat replies. Pure passive content — no input, no LLM call,
 * just a beautiful scroll of italic-serif aphorisms with a Share
 * button next to each.
 *
 * Implements item §7 of marketing/chat-as-viral-lever.md:
 *
 *   THINGS LILY SAID THIS MONTH:
 *
 *   "Tuna. The good kind. Don't argue."
 *
 *   "You were gone four hours. The chair held the shape of you."
 *
 *   "Three feints, one capture. Adequate pace."
 *
 * Users come back JUST to look at the highlights and screenshot
 * the funny ones — the screenshot IS the marketing.
 *
 * Source: chatStore — assistant turns only. Filtered + scored for
 * "shareability" (length, declarative, free of action-tokens or
 * triage-routing hedges).
 *
 * Reachable from: a small "{Cat} said" tile on the Chat tab empty
 * state, plus a settings entry. Route: /cat-says.
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ShareNetwork } from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { useShareableCard } from '../src/components/ShareableCatCard';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useChatThread } from '../src/state/chatStore';
import { useHealthStore, type HealthEvent } from '../src/state/healthStore';
import type { ChatTurn } from '../src/services/chat';
import { useTheme } from '../src/theme/useTheme';
import { space } from '../src/theme/tokens';

// ── Heuristic: pick the shareable replies ───────────────────────────
//
// We score each assistant turn on:
//   + length sweet spot (40-160 chars — fits a card without clipping)
//   + ends with declarative punctuation
//   + first-person assertive ("I", "My", "We", "The")
//   - contains "[ACTION:" (triage routing — boring)
//   - hedge words ("maybe", "perhaps", "seems")
//   - too short / too long (<25 or >220 chars)
//
// We don't filter by date — all-time greatest hits. Future: add a
// month-bucketed view ("This week", "This month") once the chat has
// enough volume to make pagination meaningful.

function scoreShareability(content: string): number {
  let n = 0;
  const len = content.length;
  if (len >= 40 && len <= 160) n += 6;
  else if (len >= 25 && len <= 220) n += 1;
  else return -100; // unusable
  if (content.includes('[ACTION:')) return -100;
  if (/[.!?]$/.test(content.trim())) n += 2;
  if (/^(I|My|We|The|You)\b/.test(content)) n += 3;
  if (/\b(maybe|perhaps|i think|seems?|sort of|kind of)\b/i.test(content))
    n -= 4;
  // Triage / clinical openers — useful in chat, not a Greatest Hit.
  if (/\b(vet|emergency|appointment|symptom)\b/i.test(content)) n -= 2;
  return n;
}

/**
 * Shareable hit — unified across CHAT REPLIES and MEOW TRANSLATIONS.
 * Both surfaces produce screenshot-worthy cat-voice lines; they share
 * the same scroll so the owner sees ONE Greatest Hits stream rather
 * than two siloed feeds.
 *
 * `kind` differentiates the source for tagging + share-card framing:
 *   - 'chat' → from /chat (assistant turn)
 *   - 'translation' → from /translate (cat said it; multimodal)
 */
type Hit =
  | {
      kind: 'chat';
      id: string;
      content: string;
      created_at: string;
      score: number;
    }
  | {
      kind: 'translation';
      id: string;
      content: string;
      created_at: string;
      score: number;
      /** Vocalization type — surfaces as a small badge ("meow", "purr"). */
      vocalizationType: string;
      /** Intent — surfaces as a small badge ("greeting", "demand_food"). */
      intent: string;
      confidence: 'high' | 'moderate' | 'low';
    };

function pickGreatestHits(
  thread: ChatTurn[],
  translations: HealthEvent[],
  max: number,
): Hit[] {
  const hits: Hit[] = [];

  // Chat replies — same heuristic as before.
  for (const turn of thread) {
    if (turn.role !== 'assistant') continue;
    const score = scoreShareability(turn.content);
    if (score <= 0) continue;
    hits.push({
      kind: 'chat',
      id: turn.id,
      content: turn.content,
      created_at: turn.created_at,
      score,
    });
  }

  // Meow translations — every translation is by definition meant to
  // be shareable (the whole feature is calibrated for it). We bias
  // them up by +5 over the chat baseline so the latest translations
  // surface first, then re-sort by score + recency. Low-confidence
  // translations get a -3 penalty so they don't dominate when the
  // cat hasn't been in clear-signal moods.
  for (const ev of translations) {
    if (ev.type !== 'meow_translation') continue;
    const p = ev.payload as {
      translation?: string;
      vocalization_type?: string;
      intent?: string;
      confidence?: 'high' | 'moderate' | 'low';
    };
    const content = (p.translation ?? '').trim();
    if (content.length < 10) continue;
    let score = 5; // base boost for translations
    if (p.confidence === 'low') score -= 3;
    if (p.confidence === 'high') score += 1;
    // Distress translations are hidden from the Greatest Hits scroll —
    // they're earnest, not screenshottable. Distinct surface in the
    // future (Today tab banner) will handle them.
    if (p.intent === 'distress') continue;
    hits.push({
      kind: 'translation',
      id: ev.id,
      content,
      created_at: ev.ts,
      score,
      vocalizationType: p.vocalization_type ?? 'meow',
      intent: p.intent ?? 'other',
      confidence: p.confidence ?? 'moderate',
    });
  }

  // Sort: highest score first, then newest within same score.
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.created_at.localeCompare(a.created_at);
  });
  return hits.slice(0, max);
}

// ────────────────────────────────────────────────────────────────────

export default function CatSaysScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const thread = useChatThread(cat?.id);
  const allEvents = useHealthStore((s) => s.events);
  const translations = useMemo(
    () =>
      cat?.id
        ? allEvents.filter(
            (e) => e.cat_id === cat.id && e.type === 'meow_translation',
          )
        : [],
    [allEvents, cat?.id],
  );
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();

  const greatestHits = useMemo(
    () => pickGreatestHits(thread, translations, 30),
    [thread, translations],
  );
  const catName = cat?.name ?? 'your cat';

  const handleShare = (hit: Hit) => {
    if (!cat) return;
    void shareCard(
      {
        kind: 'chat_reply',
        catName: cat.name,
        catPhotoUri: cat.photo_uri ?? null,
        headline: hit.content,
      },
      { surface: 'cat_says_greatest_hits' },
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: t.surface, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
        </Pressable>
        <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
          {catName} said
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[6],
          paddingBottom: insets.bottom + space[10],
          paddingTop: space[5],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          token="caption"
          style={{
            color: t.secondary700,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            marginBottom: space[6],
            fontFamily: 'Figtree_600SemiBold',
          }}
        >
          Things {catName} has said
        </Text>

        {greatestHits.length === 0 ? (
          <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
            <Text
              token="body"
              color="textMuted"
              style={{ textAlign: 'center', lineHeight: 22 }}
            >
              {catName} hasn&apos;t said much yet. Chat with
              {' '}{catName} or record a clip in the Voice translator — the
              punchiest lines from both will show up here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: space[8] }}>
            {greatestHits.map((hit) => (
              <View key={hit.id} style={{ gap: space[3] }}>
                <Text
                  style={{
                    color: t.textPrimary,
                    fontFamily: 'SourceSerif4_500Medium',
                    fontStyle: 'italic',
                    fontSize: 22,
                    lineHeight: 32,
                  }}
                >
                  “{hit.content.trim()}”
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Text
                      token="caption"
                      style={{
                        color: t.textMuted,
                        letterSpacing: 1.2,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        fontFamily: 'Figtree_600SemiBold',
                      }}
                    >
                      {formatRelative(hit.created_at)}
                    </Text>
                    {/* Source badge — distinguishes a quoted chat reply
                        from a multimodal translation. The translator is
                        a differentiator for the app so we LEAN INTO
                        the badge ("translated meow") rather than
                        homogenising. */}
                    {hit.kind === 'translation' && (
                      <View
                        style={{
                          paddingHorizontal: space[2],
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: t.secondary100,
                          borderWidth: 1,
                          borderColor: t.borderSubtle,
                        }}
                      >
                        <Text
                          token="caption"
                          style={{
                            color: t.secondary900,
                            fontSize: 10,
                            letterSpacing: 0.8,
                            fontFamily: 'Figtree_600SemiBold',
                          }}
                        >
                          translated {hit.vocalizationType}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => handleShare(hit)}
                    hitSlop={8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[2],
                      paddingVertical: space[1],
                    }}
                  >
                    <ShareNetwork
                      size={14}
                      color={t.secondary700}
                      weight="bold"
                    />
                    <Text
                      token="caption"
                      style={{
                        color: t.secondary700,
                        letterSpacing: 1.2,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        fontFamily: 'Figtree_600SemiBold',
                      }}
                    >
                      Share
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: t.borderSubtle,
                    marginTop: space[3],
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Off-screen host for the ShareableCatCard. */}
      {ShareCardHost}
    </View>
  );
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const days = Math.floor((now - then) / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return '';
  }
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
});
