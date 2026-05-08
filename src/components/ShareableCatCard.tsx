/**
 * ShareableCatCard — the viral-leverage component.
 *
 * Renders a beautiful, screenshot-shaped 1080×1920 card with:
 *   - Cat's circular photo (top-center)
 *   - Cat's name in small caps eyebrow
 *   - The headline content (cat's reply / archetype / diary line) in
 *     big italic Source Serif on cream
 *   - Subtle CatMD logo + URL at the bottom
 *
 * This component is a PURE RENDER — it doesn't capture. The
 * `useShareableCard()` hook (below) mounts it off-screen and handles
 * the captureRef + Sharing.shareAsync lifecycle.
 *
 * Used by:
 *   - Chat bubbles (share a cat reply)
 *   - Personality screen (share archetype reveal)
 *   - Diary screen (share an entry)
 *   - Becoming milestones (share a stage crossing)
 *
 * Design philosophy: the card LOOKS designed, not screenshot. The
 * format is so visually distinct that any TikTok creator who
 * screenshots it gets brand-recognition for free. This is the
 * single highest-ROI viral feature in CatMD per the strategic doc
 * at `marketing/chat-as-viral-lever.md`.
 *
 * Android off-screen-render note: do NOT host this card at
 * `top: -99999`. RN's Android native renderer can skip render passes
 * for children whose layout rect is entirely outside the screen
 * bounds, which makes captureRef return empty pixels. The
 * `useShareableCard` hook hosts the card inside the viewport at
 * opacity 0 with a 1×1 overflow-hidden parent — see app/postcard.tsx
 * for the same pattern that fixed dark Android exports.
 */
import { useCallback, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { Text } from './Text';
import { track } from '../services/analytics';

// Brand anchors — kept in sync with `tokens.ts`.
const SAGE_500 = '#5B8A7A';
const SAGE_700 = '#3F6357';
const SAGE_50 = '#EEF3F0';
const TERRACOTTA = '#C97B63';
const CREAM = '#FAF7F2';
const INK = '#1F2024';
const INK_MUTED = '#6E6F73';
const BORDER_SUBTLE = '#E5E0D8';

/** What kind of card we're rendering — affects layout + footer text. */
export type CardKind =
  | 'chat_reply'         // headline = the cat's reply
  | 'archetype'          // headline = archetype name + one-liner
  | 'diary_entry'        // headline = diary entry text (truncated to 4-5 lines)
  | 'becoming_milestone'; // headline = the milestone hook

export type CatCardData = {
  kind: CardKind;
  catName: string;
  catPhotoUri: string | null;
  /**
   * The hero text. Will be rendered in big italic serif. Max ~140
   * chars looks best on the card; longer text gets clipped.
   */
  headline: string;
  /**
   * Optional eyebrow text above the headline (e.g. "Today's diary",
   * "Velcro Cat", "Becoming"). Small caps, sage colour.
   */
  eyebrow?: string;
  /**
   * Optional subtitle below the headline. Used by archetype card
   * for the personality one-liner subtitle.
   */
  subtitle?: string;
  /**
   * For `chat_reply` kind only — the user's question that prompted
   * this reply. When present, the auto-copied share caption sets up
   * context ("i asked '[question]' — [name] said this 😭") so
   * followers understand why the cat said what it said. Without it,
   * the caption falls back to the generic "[name] said this..." form.
   *
   * Truncated to ~80 chars in the caption; the full message stays in
   * the data for any future card-design variants that show the question
   * above the reply.
   */
  userMessage?: string;
};

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

/**
 * Pure render component. Renders the card at full 1080×1920. The
 * caller is responsible for hosting it off-screen + capturing.
 *
 * Layout summary (vertical 9:16 ratio):
 *   - Top 1/4: cat photo + name eyebrow
 *   - Middle 1/2: headline text (italic serif), centered
 *   - Bottom 1/4: subtitle (optional) + brand mark
 */
export function ShareableCatCard({ data }: { data: CatCardData }) {
  const eyebrow = (data.eyebrow ?? data.catName).toUpperCase();
  const headlineWithQuotes = data.kind === 'chat_reply'
    ? `“${data.headline.trim()}”`
    : data.headline.trim();
  // Small "asked: ..." line under the eyebrow for chat-reply cards.
  // Belt-and-suspenders for caption-loss scenarios — when the card is
  // screenshotted from a friend's phone and re-shared without the
  // caption, this preserves the question context. Stays small + dim
  // so the cat's reply remains the visual hero.
  const askedLine =
    data.kind === 'chat_reply' && data.userMessage && data.userMessage.trim().length > 0
      ? truncateQuestion(data.userMessage, 60)
      : null;

  return (
    <View style={styles.card}>
      {/* Top: cat photo + eyebrow */}
      <View style={styles.topSection}>
        {data.catPhotoUri ? (
          <Image
            source={{ uri: data.catPhotoUri }}
            style={styles.catPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.catPhoto, styles.catPhotoFallback]}>
            <Text
              style={{
                color: SAGE_700,
                fontFamily: 'SourceSerif4_500Medium',
                fontSize: 140,
                lineHeight: 160,
              }}
            >
              {data.catName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {askedLine ? (
          <Text style={styles.askedLine}>asked: “{askedLine}”</Text>
        ) : null}
      </View>

      {/* Middle: hero headline */}
      <View style={styles.middleSection}>
        <Text style={styles.headline}>{headlineWithQuotes}</Text>
        {data.subtitle ? (
          <Text style={styles.subtitle}>{data.subtitle}</Text>
        ) : null}
      </View>

      {/* Bottom: brand mark */}
      <View style={styles.bottomSection}>
        <View style={styles.brandRow}>
          <View style={styles.brandLogoCircle} />
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>CatMD</Text>
            <Text style={styles.brandUrl}>
              catmd.pet · {kindFooter(data.kind)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Caption builder — auto-copied to clipboard on every share
// ---------------------------------------------------------------------------

/**
 * Build the social-media caption that gets copied to the user's
 * clipboard the moment they tap Share. They land in TikTok / IG /
 * X / wherever, paste, and post — no typing, no thinking about
 * hashtags. The caption is tuned per card kind so a chat-reply
 * share lands in the right meme register vs a diary share or an
 * archetype reveal.
 *
 * `#catmd` MUST appear in every caption — it's the brand-tag every
 * shared card carries to drive discovery and let the team find
 * organic UGC. Other hashtags rotate per surface.
 *
 * Why we do this clipboard dance: TikTok and Instagram do NOT
 * honour the share-sheet's text payload (unlike Twitter / Mail /
 * WhatsApp). The image arrives but the caption field is empty.
 * Clipboard pre-fill is the industry-standard workaround.
 */
/**
 * Truncate the user's question for inclusion in a share caption. Long
 * messages get the head + ellipsis so the caption stays scannable on
 * a TikTok / IG composer (which truncates around 100-120 chars).
 */
function truncateQuestion(q: string, max = 80): string {
  const cleaned = q.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Rotate through context-aware caption variants for chat replies. The
 * choice is deterministic per call by hashing the question — same
 * question always picks the same variant, so the user can predict what
 * format their share will take, but different questions get different
 * variants to avoid repetition across multiple shares.
 *
 * Each variant frames the SAME info two ways: setup (the question)
 * + payoff (the cat's reply, which is on the card image). The caption
 * does the setup; the image carries the punchline.
 *
 * Variants kept under 100 chars before hashtags so they fit comfortably
 * in TikTok / IG / X composers without truncation.
 */
function pickChatCaptionVariant(name: string, question: string, replyHeadline: string): string {
  const q = truncateQuestion(question);
  // Lightweight deterministic pick — sum char codes mod variants.length.
  let hash = 0;
  for (let i = 0; i < question.length; i++) hash = (hash + question.charCodeAt(i)) | 0;
  const variants: string[] = [
    `i asked: "${q}"\n\n${name} said this and i can't 😭`,
    `me: ${q}\n${name}:`,
    `asked her "${q}".\n\nbig mistake.`,
    `wanted to know "${q}".\n\n${name}'s answer:`,
    `me, casually: "${q}"\n${name}, devastatingly:`,
    `"${q}" — me, two seconds ago.\n${name}'s response:`,
    `asked ${name} "${q}". got humbled.`,
  ];
  const idx = ((hash % variants.length) + variants.length) % variants.length;
  return variants[idx];
}

export function buildShareCaption(data: CatCardData): string {
  const name = data.catName || 'my cat';
  const HASHTAGS = {
    chat: '#catmd #catsoftiktok #cattalk #catpersonality #catsofinstagram #aiforcats #cathumor #catlovers',
    archetype: '#catmd #catpersonality #catsoftiktok #cattypes #catsofinstagram #catlovers #cattalk #aiforcats',
    diary: '#catmd #catdiary #catsoftiktok #catsofinstagram #catlife #cattalk #catlovers #catowner',
    becoming: '#catmd #catsoftiktok #catpersonality #catsofinstagram #cattalk #catlife #catlovers',
  };

  switch (data.kind) {
    case 'chat_reply': {
      // When we have the user's question, set up context so followers
      // understand why the cat said what it said. This is the main
      // viral lever: the punchline (cat's reply) lands harder when the
      // setup (the human's question) is right above it.
      if (data.userMessage && data.userMessage.trim().length > 0) {
        const intro = pickChatCaptionVariant(name, data.userMessage, data.headline);
        return `${intro}\n\n${HASHTAGS.chat}`;
      }
      // Fallback — original generic caption when no question is available
      // (e.g. legacy share path or onboarding card without prior turns).
      return `${name} said this and i can't 😭\n\n${HASHTAGS.chat}`;
    }

    case 'archetype': {
      const archetype = data.eyebrow ?? 'something specific';
      return `turns out ${name} is a ${archetype}. accurate.\n\n${HASHTAGS.archetype}`;
    }

    case 'diary_entry':
      return `${name} wrote this today.\n\n${HASHTAGS.diary}`;

    case 'becoming_milestone':
      return `${name} noticed this about me this week 👀\n\n${HASHTAGS.becoming}`;
  }
}

/**
 * Show a brief "Caption copied" toast after a share triggers. Uses
 * Android's native ToastAndroid (free, no UI library needed); on
 * iOS, falls back to a no-op since iOS doesn't have a native toast
 * — Android is the primary platform and iOS users get the share
 * sheet without the explicit nudge (the caption is still on their
 * clipboard, they just don't get the visual confirmation).
 */
function showCaptionCopiedToast() {
  if (Platform.OS === 'android') {
    ToastAndroid.show('Caption copied — paste in IG/TikTok', ToastAndroid.LONG);
  }
}

function kindFooter(kind: CardKind): string {
  switch (kind) {
    case 'chat_reply':
      return 'talk to your cat';
    case 'archetype':
      return 'cat personality';
    case 'diary_entry':
      return "your cat's diary";
    case 'becoming_milestone':
      return 'becoming';
  }
}

// ---------------------------------------------------------------------------
// Hook: useShareableCard — the integration entrypoint for screens
// ---------------------------------------------------------------------------

/**
 * `useShareableCard()` returns:
 *   - `share(data, opts?)`: async — captures + opens system share sheet
 *   - `Host`: a JSX element to render somewhere in your tree. Mounts
 *     the off-screen card while a share is in flight.
 *
 * Usage:
 *   const { share, Host } = useShareableCard();
 *   ...
 *   <Pressable onPress={() => share({ kind: 'chat_reply', catName, ... })}>
 *     Share
 *   </Pressable>
 *   {Host}
 *
 * The hook tracks `share_card_*` analytics events so we can measure
 * share-rate per surface — surfaces with low share rate need
 * messaging improvements; high share rate vindicates the strategic
 * bet that chat is the viral lever.
 */
export function useShareableCard() {
  const [active, setActive] = useState<CatCardData | null>(null);
  const cardRef = useRef<View>(null);
  // Mirror of `active` in a ref so the race guard inside `share()` sees
  // the in-flight state synchronously without waiting for React state
  // to flush. Without this, two rapid taps both pass the `if (active)`
  // check before the first re-render lands.
  const activeRef = useRef<CatCardData | null>(null);

  const share = useCallback(
    async (data: CatCardData, opts?: { surface?: string }) => {
      // Race guard — a rapid double-tap (Share-Share-Share) can blow
      // through `setActive` mid-capture and clobber the off-screen
      // render with new data, producing either a wrong-content PNG or
      // a transient null ref during captureRef. Drop subsequent taps
      // while a share is mid-flight; the user's first tap wins.
      if (activeRef.current) return;
      activeRef.current = data;
      track({
        type: 'share_card_initiated',
        props: {
          kind: data.kind,
          surface: opts?.surface ?? 'unknown',
          has_photo: data.catPhotoUri != null,
        },
      });
      setActive(data);
      // Wait for the View to mount + paint before capture. 250ms is
      // empirically the sweet spot on mid-tier Android: too short
      // (~80ms) and the photo Image hasn't decoded; too long (~600ms)
      // and the user feels a perceptible delay between tap and share
      // sheet. The host View has `collapsable: false` so RN doesn't
      // optimise it away during the wait.
      await new Promise((r) => setTimeout(r, 250));

      try {
        const ref = cardRef.current;
        if (!ref) {
          throw new Error('Share-card ref not ready');
        }
        const uri = await captureRef(ref, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
        });

        const ok = await Sharing.isAvailableAsync();
        if (!ok) {
          throw new Error('Sharing not available on this device');
        }

        // ── Auto-copy caption + hashtags to clipboard ──
        // TikTok and Instagram do NOT honour the share-sheet's text
        // payload — only the image arrives in their composer, the
        // caption field is empty. Pre-copying the tuned caption to
        // clipboard means the user can paste it instantly in the
        // destination app. `#catmd` is included in every caption so
        // every shared card carries our brand-tag for discovery.
        // The toast nudge (Android) tells the user the paste is
        // ready. iOS has no native toast — the clipboard is still
        // populated, just no visual confirmation.
        try {
          const caption = buildShareCaption(data);
          await Clipboard.setStringAsync(caption);
          showCaptionCopiedToast();
          track({
            type: 'share_caption_copied',
            props: {
              kind: data.kind,
              surface: opts?.surface ?? 'unknown',
              caption_length: caption.length,
            },
          });
        } catch (e) {
          // Clipboard failure is non-fatal — the share still proceeds.
          console.warn('[ShareableCatCard] clipboard copy failed:', e);
        }

        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share this card',
          mimeType: 'image/png',
        });
        track({
          type: 'share_card_completed',
          props: {
            kind: data.kind,
            surface: opts?.surface ?? 'unknown',
          },
        });

        // Best-effort cleanup — we don't NEED to wait for delete.
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      } catch (e) {
        console.warn('[ShareableCatCard] share failed:', e);
        track({
          type: 'share_card_failed',
          props: {
            kind: data.kind,
            surface: opts?.surface ?? 'unknown',
            reason:
              e instanceof Error ? e.message.slice(0, 200) : 'unknown',
          },
        });
      } finally {
        activeRef.current = null;
        setActive(null);
      }
    },
    [],
  );

  // Host JSX — must be rendered SOMEWHERE in the consuming screen's
  // tree so the off-screen card has a real layout to capture from.
  // Renders as a 1×1 opacity:0 wrapper inside the viewport (NOT at
  // top:-99999 — see header comment for the Android rationale).
  const Host = active ? (
    <View
      collapsable={false}
      style={styles.host}
      pointerEvents="none"
    >
      <View
        ref={cardRef}
        collapsable={false}
        style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT }}
      >
        <ShareableCatCard data={active} />
      </View>
    </View>
  ) : null;

  return { share, Host, sharing: active != null };
}

// ---------------------------------------------------------------------------
// Styles — all dimensions in render-pixels at 1080×1920. Capture upscales.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Off-screen mount host: kept INSIDE the viewport at 1×1 with
  // overflow:hidden and opacity 0 so the full 1080×1920 child renders
  // properly (Android skips render passes for layout outside screen
  // bounds — see header comment).
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: CREAM,
    paddingHorizontal: 96,
    paddingTop: 160,
    paddingBottom: 100,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    gap: 36,
  },
  catPhoto: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 6,
    borderColor: BORDER_SUBTLE,
  },
  catPhotoFallback: {
    backgroundColor: SAGE_50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: SAGE_700,
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 32,
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
  // The "asked: ..." line under the eyebrow on chat-reply cards.
  // Kept small + dim so the cat's reply remains the visual hero —
  // this is screenshot-loss insurance, not a co-equal text element.
  askedLine: {
    color: INK_MUTED,
    fontFamily: 'SourceSerif4_500Medium',
    fontStyle: 'italic',
    fontSize: 28,
    lineHeight: 38,
    textAlign: 'center',
    paddingHorizontal: 80,
    marginTop: 4,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 36,
  },
  headline: {
    color: INK,
    fontFamily: 'SourceSerif4_500Medium',
    fontStyle: 'italic',
    fontSize: 76,
    lineHeight: 96,
    textAlign: 'center',
  },
  subtitle: {
    color: INK_MUTED,
    fontFamily: 'Figtree_400Regular',
    fontStyle: 'italic',
    fontSize: 38,
    lineHeight: 52,
    textAlign: 'center',
  },
  bottomSection: {
    paddingTop: 40,
    borderTopWidth: 2,
    borderTopColor: BORDER_SUBTLE,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 36,
  },
  brandLogoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SAGE_500,
  },
  brandName: {
    color: INK,
    fontFamily: 'SourceSerif4_600SemiBold',
    fontSize: 40,
    letterSpacing: 1,
  },
  brandUrl: {
    color: TERRACOTTA,
    fontFamily: 'Figtree_400Regular',
    fontSize: 24,
    letterSpacing: 2,
    marginTop: 4,
  },
});
