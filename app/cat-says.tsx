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

type ScoredReply = { turn: ChatTurn; score: number };

function pickGreatestHits(thread: ChatTurn[], max: number): ChatTurn[] {
  const scored: ScoredReply[] = thread
    .filter((t) => t.role === 'assistant')
    .map((t) => ({ turn: t, score: scoreShareability(t.content) }))
    .filter((s) => s.score > 0);

  // Sort descending by score, then newest-first within same score.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.turn.created_at.localeCompare(a.turn.created_at);
  });
  return scored.slice(0, max).map((s) => s.turn);
}

// ────────────────────────────────────────────────────────────────────

export default function CatSaysScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const thread = useChatThread(cat?.id);
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();

  const greatestHits = useMemo(() => pickGreatestHits(thread, 30), [thread]);
  const catName = cat?.name ?? 'your cat';

  const handleShare = (turn: ChatTurn) => {
    if (!cat) return;
    void shareCard(
      {
        kind: 'chat_reply',
        catName: cat.name,
        catPhotoUri: cat.photo_uri ?? null,
        headline: turn.content,
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
              {catName} hasn't said much yet. Open Chat and ask
              {' '}{catName}
              {' '}something — the punchiest replies will
              show up here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: space[8] }}>
            {greatestHits.map((turn) => (
              <View key={turn.id} style={{ gap: space[3] }}>
                <Text
                  style={{
                    color: t.textPrimary,
                    fontFamily: 'SourceSerif4_500Medium',
                    fontStyle: 'italic',
                    fontSize: 22,
                    lineHeight: 32,
                  }}
                >
                  “{turn.content.trim()}”
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
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
                    {formatRelative(turn.created_at)}
                  </Text>
                  <Pressable
                    onPress={() => handleShare(turn)}
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
