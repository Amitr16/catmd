/**
 * PersonalityProgressBanner — sticky one-line status indicator that
 * sets expectations during the "cat-in-the-app is still learning its
 * voice" phase, and gives the user a clear tap-target to do something
 * about it.
 *
 * ── Why this exists (and why it's now compact) ─────────────────────
 * New users open chat/diary on day 1 and read a few replies before the
 * personality has had time to take shape. Some early replies feel
 * generic; without context, the user concludes the app is not for them.
 *
 * The first iteration of this banner explained the whole story in
 * three sentences of italic serif. That was the right *message* but
 * the wrong *form*: a sticky element you see every time you open chat
 * cannot be a 60-pixel paragraph. UX rebuild 2026-05-17 swaps it for a
 * single-line strip with three signals:
 *
 *   [emoji] [status word] · [short qualifier] · [%]      [CTA →]
 *
 * The qualifier (4-6 words, pronoun-aware) gives just enough flavour
 * that the user can read it in <1 second. The whole row is pressable
 * and routes to /becoming — the existing screen that breaks down the
 * seven facets and gives stage-specific "do X to deepen this" CTAs.
 * Don't duplicate that screen here; *route to it*.
 *
 * ── Why /becoming, not an inline expand ────────────────────────────
 * /becoming already exists, already has per-facet CTAs (add a photo,
 * have a chat, run today's check-in, name people in your cat's life,
 * take the personality quiz). Building an inline expansion would
 * duplicate it and create drift. The banner's job is signal + nudge;
 * the deep work happens on /becoming.
 *
 * ── Sticky behaviour ───────────────────────────────────────────────
 * Both chat.tsx and diary.tsx render this banner OUTSIDE the
 * ScrollView, so it stays pinned to the viewport top by default. No
 * extra position:sticky needed (React Native doesn't support that
 * CSS prop anyway — the layout tree placement does the work).
 */
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { CaretRight, Sparkle } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import type { Becoming } from '../services/becoming';
import { getPronouns, type CatSex } from '../services/pronouns';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/tokens';
import { track } from '../services/analytics';

interface Props {
  catName: string;
  catSex: CatSex | null | undefined;
  becoming: Becoming | null;
  /**
   * Surface this banner is rendered on — used for telemetry so we can
   * see which surface drives the most /becoming taps. 'chat' | 'diary'.
   */
  source: 'chat' | 'diary';
}

interface StagePresentation {
  /** Single-word status adjective. The user's eye lands here first. */
  statusWord: string;
  /**
   * Short qualifier (4-6 words) shown after the status word. Uses the
   * cat's possessive pronouns where appropriate so the line reads
   * natural for he/she/they.
   */
  qualifier: string;
}

/**
 * Compose status word + short qualifier for the current becoming
 * stage. Possessive forms come from getPronouns(sex):
 *   p.possessive         → "her" / "his" / "their" (before a noun)
 *   p.possessivePronoun  → "hers" / "his" / "theirs" (standalone)
 */
function presentationForStage(
  catSex: CatSex | null | undefined,
  becoming: Becoming,
): StagePresentation {
  const p = getPronouns(catSex);
  switch (becoming.overallStage) {
    case 'just getting started':
      return { statusWord: 'Forming', qualifier: 'voice is still warming up' };
    case 'getting to know you':
      return { statusWord: 'Sketching', qualifier: `still finding ${p.possessive} voice` };
    case 'taking shape':
      return { statusWord: 'Shaping', qualifier: 'voice is taking shape' };
    case 'half-formed':
      return { statusWord: 'Settling', qualifier: 'voice mostly settled in' };
    case 'mostly settled':
      return { statusWord: 'Settled', qualifier: `voice is ${p.possessivePronoun}` };
    case 'fully here':
      return { statusWord: 'Fully here', qualifier: 'fully formed' };
    default:
      return { statusWord: 'Forming', qualifier: 'voice is still warming up' };
  }
}

export function PersonalityProgressBanner({
  catName,
  catSex,
  becoming,
  source,
}: Props): ReactElement | null {
  const t = useTheme();
  const router = useRouter();
  if (!becoming) return null;
  const { statusWord, qualifier } = presentationForStage(catSex, becoming);
  const depth = becoming.depth;

  const handlePress = () => {
    // Telemetry — measure which surface (chat/diary) actually drives
    // becoming-screen opens. Important for deciding whether either
    // banner is worth its visual cost.
    try {
      track({
        type: 'personality_progress_banner_tapped',
        props: {
          source,
          depth,
          stage: becoming.overallStage,
        },
      });
    } catch {
      // analytics is best-effort; UX must work regardless
    }
    router.push('/becoming' as never);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${catName}'s voice is ${statusWord.toLowerCase()} at ${depth} percent. Tap to see how to deepen ${catName}'s personality.`}
      style={({ pressed }) => ({
        paddingHorizontal: space[5],
        paddingVertical: space[3],
        backgroundColor: pressed ? t.primary100 : t.primary50,
        borderBottomWidth: 1,
        borderBottomColor: t.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
      })}
      hitSlop={4}
    >
      {/* Leading glyph — small, the same sparkle motif used elsewhere
          in CatMD for "cat formation / personality" surfaces */}
      <Sparkle size={14} color={t.primary700} weight="duotone" />

      {/* Status + qualifier + %. The 3-part copy fits a single line on
          all phones >320px. numberOfLines=1 with ellipsizeMode='tail'
          is a defensive fallback for unusually long localisations
          (which don't exist today — we're EN-only — but the guard
          prevents the row from ever growing taller than 1 line). */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ color: t.textPrimary, fontSize: 13, fontWeight: '600', lineHeight: 18 }}
        >
          {statusWord}
        </Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flex: 1, color: t.textSecondary, fontSize: 12.5, lineHeight: 18 }}
        >
          {' · '}{qualifier}{' · '}{depth}%
        </Text>
      </View>

      {/* CTA label + chevron — explicit affordance. A chevron alone
          can read as decorative; pairing it with one-word text makes
          the tap-target unambiguous. Label shifts at 'fully here'
          since there's nothing major to "improve" at that stage. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text
          style={{
            color: t.primary700,
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.2,
          }}
        >
          {becoming.overallStage === 'fully here' ? 'Details' : 'Improve'}
        </Text>
        <CaretRight size={12} color={t.primary700} weight="bold" />
      </View>
    </Pressable>
  );
}
