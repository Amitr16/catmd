/**
 * Chat tab — talking with YOUR cat.
 *
 * ── PERSONA SHIFT (2026-05-04) ─────────────────────────────────────
 * The chat used to be a third-person "AI cat companion." It is now
 * the cat itself. The user is talking to their cat; the cat replies
 * in first person, in the voice locked in by the personality
 * archetype. The cat's memory includes its own diary, the named
 * people & pets in its life, and any self-facts the user has told
 * it ("you love tuna", "you hate the vacuum"). Symptom and emergency
 * routing still works — the cat asks to be examined in cat voice and
 * emits the existing action tokens.
 *
 * Layout: messaging UI. Header with cat avatar + "Talking with X."
 * Empty state shows 4 cat-voiced starter prompts ("X, how are you
 * really?"). Bubbles: user right, cat left with their photo as
 * avatar. Input at bottom with keyboard-aware behaviour.
 *
 * Pro gating: not gated in v1 — chat is the daily-engagement habit
 * and gating from day 1 hurts retention.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUp,
  Cat as CatIcon,
  Phone,
  Sparkle,
  Stethoscope,
  Trash,
  WarningCircle,
} from 'phosphor-react-native';
import { Text } from '../../src/components/Text';
import { PersonalityProgressBanner } from '../../src/components/PersonalityProgressBanner';
import { useShareableCard } from '../../src/components/ShareableCatCard';
import { useBecomingForCat } from '../../src/services/useBecomingForCat';
import {
  cancelNotification,
  setWeeklyReadingReminder,
} from '../../src/services/notifications';
import { useNotifPrefsStore } from '../../src/state/notifPrefsStore';
import { useCatStore, resolveCatAgeMonths } from '../../src/state/catStore';
import { useHealthStore } from '../../src/state/healthStore';
import { usePersonalityStore } from '../../src/state/personalityStore';
import { useMoodFeedbackStore } from '../../src/state/moodFeedbackStore';
import {
  resolveTodaysMood,
  localDateKey,
} from '../../src/services/dailyMood';
import {
  buildArchetypeMod,
  buildLiveMoodContext,
  buildTodayBehaviorMod,
  computeFeedbackMod,
  hasMedicalConcernToday,
} from '../../src/services/moodWeights';
import {
  useChatGenerating,
  useChatStore,
  useChatThread,
} from '../../src/state/chatStore';
import { suggestedPrompts } from '../../src/services/chat';
import type { ChatTurn } from '../../src/services/chat';
import { useProGate } from '../../src/services/paywallGate';
// pickMoodBanner removed 2026-05-18 along with the mood banner JSX. The
// function is still exported from services/dailyMood.ts if we want it
// back later as a tap-to-reveal chip inside the personality banner.
import { getVoiceModeTag } from '../../src/services/voiceModes';
import { track } from '../../src/services/analytics';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function ChatTab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const catName = cat?.name ?? 'your cat';
  // Personality-progress banner — sets expectations during the early
  // "voice is still forming" phase so generic-feeling replies don't
  // get read as "this app doesn't work." Copy graduates with the
  // Becoming depth; see PersonalityProgressBanner for the per-stage
  // copy table.
  const becoming = useBecomingForCat(cat?.id);
  const thread = useChatThread(cat?.id);
  const generating = useChatGenerating(cat?.id);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearForCat = useChatStore((s) => s.clearForCat);
  const proGate = useProGate();

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();
  // Mood-warning banner copy was rendered above the chat ScrollView
  // until 2026-05-18. The visual stack of two banners
  // (PersonalityProgressBanner + mood) was too noisy for new users
  // (see the screenshot in the design doc) so the mood banner was
  // removed. The mood signal still drives chat replies internally via
  // buildLiveMoodContext + the daily-mood pick injected into the
  // system prompt — we just don't surface it as a separate banner.
  // pickMoodBanner is still exported and available if we want to bring
  // it back later as a tap-to-reveal chip inside the progress banner.

  const handleShareTurn = async (turn: ChatTurn) => {
    if (!cat) return;
    // Find the user message that prompted this assistant turn — the
    // share-caption builder uses it to set up context ("i asked X.
    // [name] said this..."). Walk the thread backwards from the shared
    // turn to find the most-recent prior user turn.
    let userMessage: string | undefined;
    const idx = thread.findIndex((t) => t.id === turn.id);
    if (idx > 0) {
      for (let i = idx - 1; i >= 0; i--) {
        if (thread[i].role === 'user') {
          userMessage = thread[i].content;
          break;
        }
      }
    }
    // Mood-feedback attribution (2026-05-14 round 10 P2 #4: uses
    // shared `buildLiveMoodContext`). Sharing a chat reply is the
    // strongest preference signal — attribute to today's mood so the
    // adaptive lottery learns. Failures must never block share.
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
          surface: 'chat',
          voice_mode_tag: getVoiceModeTag(dailyMood.id),
        },
      });
    } catch {
      // share-tracking is best-effort
    }
    void shareCard(
      {
        kind: 'chat_reply',
        catName: cat.name,
        catPhotoUri: cat.photo_uri ?? null,
        headline: turn.content,
        userMessage,
      },
      { surface: 'chat_bubble' },
    );
  };

  // Telemetry: chat_opened — once per cat per screen mount
  useEffect(() => {
    if (!cat?.id) return;
    track({
      type: 'chat_opened',
      props: { had_history: thread.length > 0 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Field-update commits are SILENT in chat — the cat's reply itself
  // is the confirmation ("Adequate. Logged."). No toast, no banner, no
  // chip — those break the chat aesthetic and read as robotic / app-y.
  // Users verify the update by navigating to the cat-profile screen
  // where the new value is reflected. Same principle as the removed
  // learned-facts chip (2026-05-05): trust the cat-voice acknowledgement
  // to carry the UX. Analytics (chat_field_update_extracted) still fires
  // server-side for monitoring.

  // Schedule the weekly "she noticed" reading push (Sunday 19:00).
  // Idempotent: cancel-then-rearm keeps the schedule in sync as the
  // cat's name or notif preferences change. Anchored on the chat
  // screen because that's where users discover the cat-voice loop.
  useEffect(() => {
    if (!cat?.id) return;
    const prefs = useNotifPrefsStore.getState();
    const oldId = prefs.getScheduledId(cat.id, 'weekly_reading');
    void (async () => {
      try {
        await cancelNotification(oldId);
        if (!prefs.enabled.weekly_reading) {
          prefs.setScheduledId(cat.id, 'weekly_reading', null);
          return;
        }
        const newId = await setWeeklyReadingReminder({
          catName: cat.name,
          catId: cat.id,
        });
        prefs.setScheduledId(cat.id, 'weekly_reading', newId);
      } catch (e) {
        console.warn('[Chat] weekly-reading reminder schedule failed:', e);
      }
    })();
  }, [cat?.id, cat?.name]);

  // Auto-scroll on new messages — handled via onContentSizeChange on
  // the ScrollView itself rather than a delayed setTimeout. The
  // setTimeout pattern caused a visible flicker: the new message
  // would render at frame N, then the scroll would jump-animate at
  // frame N+6 (100ms later), creating a "pop into view → jump down"
  // sequence. onContentSizeChange fires synchronously when the
  // content layout settles, so the scroll happens in the same frame
  // as the layout, eliminating the flicker.
  // (The actual handler is attached on <ScrollView /> below.)

  const handleSend = async (textOverride?: string) => {
    if (!cat?.id) return;
    const toSend = (textOverride ?? input).trim();
    if (!toSend) return;
    if (generating) return;
    // Pro gate — chat is gated entirely (no free turns post-trial,
    // per the agreed launch model). The history of past replies
    // remains viewable; only NEW messages require Pro.
    if (!proGate.check('chat')) return;
    setInput('');
    setError(null);
    track({
      type: 'chat_message_sent',
      props: { length: toSend.length, used_suggested_prompt: !!textOverride },
    });
    // Unified activation event for marketing-attribution funnels (audit
    // 2026-05-16). Fires alongside the granular chat_message_sent.
    track({ type: 'core_feature_used', props: { feature: 'chat' } });
    try {
      await sendMessage(cat.id, toSend);
      track({ type: 'chat_message_received' });
    } catch (e) {
      console.warn('[Chat] send failed:', e);
      const reason = e instanceof Error ? e.message : 'unknown';
      setError(
        e instanceof Error
          ? `Couldn't send — ${e.message.slice(0, 80)}`
          : "Couldn't send — try again.",
      );
      track({
        type: 'chat_message_failed',
        props: { reason: reason.slice(0, 200) },
      });
    }
  };

  /**
   * Action handoff handler — fires when the user taps an inline button
   * embedded in an assistant message ("Open Triage scan" /
   * "Find an emergency vet"). Both routes are best-effort:
   *   - open_triage  → push to /scan within the app
   *   - call_vet     → try to dial the user's region's emergency line
   *                    via `tel:` URL. If no dialer / region matches,
   *                    fall back to the ASPCA poison-control hotline
   *                    which works from anywhere.
   * Every tap fires a `chat_action_tapped` analytics event so we can
   * see how often the model actually surfaces useful next-steps.
   */
  const handleActionTap = (action: 'open_triage' | 'call_vet') => {
    track({ type: 'chat_action_tapped', props: { action } });
    if (action === 'open_triage') {
      router.push('/scan' as never);
      return;
    }
    if (action === 'call_vet') {
      // ASPCA Animal Poison Control — works in US/Canada, the most
      // reliable single number we can default to. Future: route to a
      // local emergency-vet finder when one ships.
      const tel = 'tel:8884264435';
      Linking.canOpenURL(tel)
        .then((can) => {
          if (can) Linking.openURL(tel);
          else
            Alert.alert(
              'Emergency vet',
              'Call ASPCA Animal Poison Control: 1-888-426-4435. Or call your nearest 24/7 vet ER.',
            );
        })
        .catch(() =>
          Alert.alert(
            'Emergency vet',
            'Call ASPCA Animal Poison Control: 1-888-426-4435. Or call your nearest 24/7 vet ER.',
          ),
        );
    }
  };

  const handleClear = () => {
    if (!cat?.id) return;
    Alert.alert(
      'Start a new conversation?',
      `This clears your chat history with ${catName}. The AI will start fresh next time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearForCat(cat.id);
            track({ type: 'chat_cleared' });
          },
        },
      ],
    );
  };

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top + space[5] }]}>
        <Text token="displayLg" style={{ paddingHorizontal: space[5] }}>Chat</Text>
        <Text token="body" color="textMuted" style={{ paddingHorizontal: space[5], marginTop: space[3] }}>
          Add a cat to chat about them. Tap Settings → Manage cats.
        </Text>
      </View>
    );
  }

  const isEmpty = thread.length === 0;
  const prompts = suggestedPrompts(catName);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.surface }}
      // BOTH platforms now use 'padding' — adds bottom padding equal
      // to the keyboard height, shifting the composer above it.
      //
      // Why not 'height' on Android (the original choice): 'height'
      // shrinks the inner view to fit above the keyboard, which
      // recomputes layout on every new bubble — that was the
      // visible flicker the user reported.
      //
      // Why not undefined on Android (the previous attempt): without
      // KeyboardAvoidingView doing anything, adjustResize alone
      // wasn't enough to keep the composer visible — input was
      // hidden behind the keyboard.
      //
      // 'padding' is the goldilocks: doesn't recompute inner heights
      // (no flicker), but does push the composer up (input visible).
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + space[3],
            paddingHorizontal: space[5],
            paddingBottom: space[3],
            borderBottomColor: t.borderSubtle,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
          <CatAvatar uri={cat.photo_uri ?? null} size={40} />
          <View style={{ flex: 1 }}>
            <Text token="caption" color="textMuted">Talking with</Text>
            <Text token="heading2" numberOfLines={1}>{cat.name}</Text>
          </View>
        </View>
        {!isEmpty ? (
          <>
            <Pressable
              onPress={() => router.push('/cat-says' as never)}
              hitSlop={12}
              style={styles.iconBtn}
            >
              <Sparkle size={20} color={t.secondary700} weight="duotone" />
            </Pressable>
            <Pressable onPress={handleClear} hitSlop={12} style={styles.iconBtn}>
              <Trash size={20} color={t.textSecondary} />
            </Pressable>
          </>
        ) : null}
      </View>

      {/* Personality-progress banner — sits above the mood banner so
          the first thing a new user reads after the header is "yes,
          the voice may sound generic right now, here's why and how
          far along she is." Copy varies by Becoming.overallStage and
          becomes a quiet affirmation at 'fully here'. */}
      <PersonalityProgressBanner
        catName={catName}
        catSex={cat.sex}
        becoming={becoming}
        source="chat"
      />

      {/* Daily mood-warning banner — REMOVED 2026-05-18.
          Stacking two banners (PersonalityProgressBanner + this)
          was visually noisy for new users and competed for the same
          "small italic strip under the header" affordance. The mood
          reveal still influences chat replies via buildLiveMoodContext
          below — we just don't surface it as a separate banner.
          If we ever bring this back, do it as a tap-to-reveal chip
          inside the progress banner, not as a second stacked strip. */}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: space[5],
          paddingBottom: space[5],
          gap: space[3],
        }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          // Scroll to bottom whenever content height changes — covers
          // user message landing, typing indicator appearing, assistant
          // reply landing, and learned-facts chips expanding the bubble
          // height. animated: false avoids the visible "jump" that the
          // previous setTimeout-based approach produced.
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {isEmpty ? (
          <EmptyState
            catName={catName}
            prompts={prompts}
            onPrompt={(p) => void handleSend(p)}
          />
        ) : (
          thread.map((turn) => (
            <Bubble
              key={turn.id}
              turn={turn}
              catName={cat.name}
              catPhotoUri={cat.photo_uri ?? null}
              onActionTap={handleActionTap}
              onShare={handleShareTurn}
            />
          ))
        )}
        {generating ? <TypingIndicator catName={catName} /> : null}
        {error ? (
          <View style={[styles.errorRow, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <WarningCircle size={16} color={t.warning} />
            <Text token="caption" color="textMuted" style={{ flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Composer */}
      <View
        style={[
          styles.composer,
          {
            paddingHorizontal: space[5],
            paddingTop: space[3],
            paddingBottom: insets.bottom + space[3],
            borderTopColor: t.borderSubtle,
            backgroundColor: t.surface,
          },
        ]}
      >
        <View
          style={[
            styles.inputRow,
            { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Say something to ${catName}…`}
            placeholderTextColor={t.textMuted}
            multiline
            style={{
              flex: 1,
              fontFamily: 'Figtree_400Regular',
              fontSize: 15,
              color: t.textPrimary,
              maxHeight: 120,
              paddingVertical: 6,
            }}
            editable={!generating}
            onSubmitEditing={() => void handleSend()}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={generating || !input.trim()}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  !generating && input.trim() ? t.primary500 : t.surfaceSunken,
                opacity: generating || !input.trim() ? 0.5 : 1,
              },
            ]}
            hitSlop={6}
          >
            {generating ? (
              <ActivityIndicator color={t.textInverse} size="small" />
            ) : (
              <ArrowUp size={18} color={t.textInverse} weight="bold" />
            )}
          </Pressable>
        </View>
        <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[2], lineHeight: 16 }}>
          {catName} replies in their own voice. Anything you tell them about themselves, they remember.
        </Text>
      </View>

      {/* Off-screen host for the ShareableCatCard. Renders the
          1080×1920 card at opacity 0 inside the viewport while a
          share is in flight, then unmounts. */}
      {ShareCardHost}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({
  catName,
  prompts,
  onPrompt,
}: {
  catName: string;
  prompts: string[];
  onPrompt: (p: string) => void;
}) {
  const t = useTheme();
  // ── First-open chat empty-state copy (2026-05-19) ──
  //
  // Tied to the "first-open-activation-rescue" campaign — KPI is
  // chat_message_sent_users / app_opened_users (daily activation rate).
  // The Variant A copy below is live; Variant B + C are kept inline for
  // fast A/B swap if the activation rate doesn't cross 10% by Day 12.
  //
  // Variant A (LIVE) — "Direct + warm." Leans into the act the user
  //   just did (naming the cat), gives one concrete starter prompt,
  //   frames the cat as a friend, not a feature. Low gimmick.
  // Variant B — "Specific + low-friction." Cuts decision friction with
  //   explicit "tap a starter," primes that the voice gets better with
  //   use (true at depth < 25 — see chat.ts voice modulation).
  //   Heading: "{Lily} is here. Tap a starter or type your own."
  //   Body:    "The more you talk, the more she sounds like herself."
  // Variant C — "Sample-reply tease." Screenshot-friendly; previews
  //   the warm day-1 voice as a real-cat-like example line.
  //   Heading: "Ask {Lily} anything."
  //   Body:    "She might say something like 'I might love you back.
  //             Day one isn't enough to know.' See what she actually does."
  //
  // Kill rule: if 3-day rolling activation < 10% after Day 10, the
  // nudge approach is abandoned for chat-first onboarding (per the
  // campaign brief). Swap variants here — don't ship a new feature.
  return (
    <View style={{ paddingTop: space[6], gap: space[5] }}>
      <View style={{ alignItems: 'center', paddingHorizontal: space[5] }}>
        <Text token="heading2" style={{ textAlign: 'center', marginBottom: space[2] }}>
          You named {catName}. Now ask {catName} something.
        </Text>
        <Text token="body" color="textMuted" style={{ textAlign: 'center', lineHeight: 22 }}>
          {catName} replies in their own voice. Start with{' '}
          <Text token="body" style={{ fontStyle: 'italic', color: t.textPrimary }}>
            &ldquo;how was your day?&rdquo;
          </Text>
          {' '}— or anything you&rsquo;d ask a friend.
        </Text>
      </View>
      <View style={{ gap: space[2] }}>
        <Text token="caption" color="textMuted" style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: space[1] }}>
          Try saying
        </Text>
        {prompts.map((p) => (
          <Pressable
            key={p}
            onPress={() => onPrompt(p)}
            style={[
              styles.suggestion,
              { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
            ]}
          >
            <Text token="body" style={{ color: t.textPrimary }}>{p}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Bubble({
  turn,
  catName,
  catPhotoUri,
  onActionTap,
  onShare,
}: {
  turn: ChatTurn;
  catName: string;
  catPhotoUri: string | null;
  onActionTap: (action: 'open_triage' | 'call_vet') => void;
  onShare: (turn: ChatTurn) => void;
}) {
  const t = useTheme();
  const isUser = turn.role === 'user';

  // ── USER BUBBLE ─────────────────────────────────────────────────
  // Stays as a small Figtree-on-grey-bubble pill. Right-aligned.
  // This is intentional: the visual hierarchy reverses — the cat's
  // reply is the visual hero, the user's prompt is the small caption.
  if (isUser) {
    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        <View
          style={[
            styles.bubble,
            { backgroundColor: t.primary500, borderBottomRightRadius: 4 },
          ]}
        >
          <Text
            token="body"
            style={{ color: t.textInverse, lineHeight: 22 }}
          >
            {turn.content}
          </Text>
        </View>
      </View>
    );
  }

  // ── CAT REPLY ───────────────────────────────────────────────────
  // VIRAL-LEVERAGE TYPOGRAPHY (2026-05-04, post chat-as-viral-lever
  // strategy doc): cat replies do NOT live in a chat-bubble. They
  // float as italic Source Serif on the cream surface, with a small
  // cat avatar to the left and a Co-Star-style eyebrow ("LILY"). The
  // visual difference between user and cat is what makes a screenshot
  // of any chat exchange typographically beautiful — every screenshot
  // becomes free brand recognition.
  //
  // See: marketing/chat-as-viral-lever.md §4.
  // Failure turns get a completely different render path: muted,
  // sans-serif, no eyebrow, no share button, no actions. This makes
  // them visually distinct from real cat replies AND prevents them
  // from being attributed to the cat's voice. See chatStore.ts where
  // the failure turn is inserted with `is_failure: true` to keep the
  // thread balanced when generation errors out.
  if (turn.is_failure) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ paddingTop: 4, opacity: 0.4 }}>
          <CatAvatar uri={catPhotoUri} size={32} />
        </View>
        <View style={{ flex: 1, gap: space[1], paddingTop: space[1] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ fontStyle: 'italic' }}
          >
            {turn.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
      <View style={{ paddingTop: 4 }}>
        <CatAvatar uri={catPhotoUri} size={32} />
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        {/* Eyebrow — cat name in small caps, sage colour. Reads like
            a Co-Star byline ("LILY"), giving the reply its visual
            attribution. */}
        <Text
          token="caption"
          style={{
            color: t.secondary700,
            fontFamily: 'Figtree_600SemiBold',
            letterSpacing: 1.6,
            fontSize: 11,
            textTransform: 'uppercase',
          }}
        >
          {catName}
        </Text>

        {/* The reply itself — Source Serif italic, larger than body
            copy, generous line-height. No bubble. Floats on cream. */}
        <Text
          style={{
            color: t.textPrimary,
            fontFamily: 'SourceSerif4_500Medium',
            fontStyle: 'italic',
            fontSize: 19,
            lineHeight: 28,
          }}
        >
          {turn.content}
        </Text>

        {/* Action buttons — kept beneath the reply text. Tokens like
            [ACTION:OPEN_TRIAGE] in the raw LLM reply are stripped
            during chat-service post-processing and surface here as a
            structured `actions[]`. */}
        {turn.actions && turn.actions.length > 0 ? (
          <View style={{ marginTop: space[2], gap: space[2] }}>
            {turn.actions.includes('open_triage') ? (
              <ActionButton
                icon={<Stethoscope size={16} color={t.textInverse} weight="bold" />}
                label="Open Triage scan"
                background={t.primary500}
                color={t.textInverse}
                onPress={() => onActionTap('open_triage')}
              />
            ) : null}
            {turn.actions.includes('call_vet') ? (
              <ActionButton
                icon={<Phone size={16} color={t.textInverse} weight="bold" />}
                label="Find an emergency vet"
                background={t.error}
                color={t.textInverse}
                onPress={() => onActionTap('call_vet')}
              />
            ) : null}
          </View>
        ) : null}

        {/* Learned-facts chips REMOVED 2026-05-05.
            They were a leftover from the old chat-bubble UI. Against
            the new italic-Source-Serif typography they read as
            visual clutter and broke the screenshot-test register
            (you don't want "Learned: I am on my human laptop" under
            the cat's punchy reply when a user is about to share it).
            The underlying self-fact extraction still runs and still
            stores facts — the cat still remembers what you tell it —
            we just don't surface the storage event as a chip. The
            proof of memory is the cat REFERENCING the fact in a
            later reply, not a "Learned" badge. */}

        {/* Share row — small, low-emphasis, sits at the bottom of the
            reply. Tap exports the message as a 1080×1920 vertical
            card via ShareableCatCard. This is the single highest-
            ROI viral feature in the app per the strategic doc. */}
        <Pressable
          onPress={() => onShare(turn)}
          hitSlop={8}
          style={{ alignSelf: 'flex-start', marginTop: space[1] }}
        >
          <Text
            token="caption"
            style={{
              color: t.textMuted,
              fontFamily: 'Figtree_600SemiBold',
              letterSpacing: 1.2,
              fontSize: 10,
              textTransform: 'uppercase',
            }}
          >
            Share
          </Text>
        </Pressable>

        {/* Cited cards from RAG were rendered here as "From: <topic>"
            footnotes when the chat persona was a third-person AI vet
            companion. Now that the persona is the cat itself in first
            person, citing sources breaks the illusion — Lily wouldn't
            cite "Breed personality: Devon Rex" to her own human. The
            data is still attached to the turn (kept for analytics +
            future "what did the cat draw on?" debug surfaces) but is
            no longer displayed inline. */}
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  background,
  color,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  background: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          paddingHorizontal: space[4],
          paddingVertical: space[3],
          borderRadius: radius.full,
          backgroundColor: background,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
      <Text token="body" style={{ color, fontFamily: 'Figtree_600SemiBold' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TypingIndicator({ catName }: { catName: string }) {
  const t = useTheme();
  // No ActivityIndicator here — a spinning wheel breaks the illusion
  // that the cat is typing (it telegraphs "AI is generating"). The
  // italic "is typing…" text alone reads as human-like ambient
  // composition. Matches the iMessage / WhatsApp pattern: no spinner,
  // just the typing-status line.
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: t.surfaceElevated,
            borderColor: t.borderSubtle,
            borderWidth: 1,
            borderBottomLeftRadius: 4,
            flexDirection: 'row',
            alignItems: 'center',
          },
        ]}
      >
        <Text token="caption" color="textMuted" style={{ fontStyle: 'italic' }}>
          {catName} is typing…
        </Text>
      </View>
    </View>
  );
}

function CatAvatar({ uri, size = 40 }: { uri: string | null; size?: number }) {
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    maxWidth: '85%',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
  },
  composer: {
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    paddingLeft: space[4],
    paddingRight: space[2],
    paddingVertical: space[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestion: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  learnedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
