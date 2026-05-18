/**
 * Personality screen — Bond pillar's second live feature.
 *
 * Two states in one screen:
 *   1. Quiz state — when the cat has no quiz answers yet, walk the owner
 *      through the 4-question intake. Quiz can be skipped; profile still
 *      computes from breed + check-ins + behaviour observations, just at
 *      lower confidence.
 *   2. Profile state — show the archetype card, 5-trait bars, what-this-
 *      means body, breed cross-reference, confidence + inputs used.
 *
 * Reachable from Bond tab tile. Route: /personality.
 *
 * Pro gating note: v1 ships free across the board. Pro features (drift
 * over time, cat-cat / cat-owner compatibility, share-card export) are
 * deferred — design + product call to come back to that as a follow-up.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, MaskHappy, ShareNetwork, Sparkle } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import { useShareableCard } from '../src/components/ShareableCatCard';
import { useActiveCat } from '../src/hooks/useActiveCat';
import {
  usePersonalityStore,
  usePersonalityProfile,
} from '../src/state/personalityStore';
import {
  ARCHETYPE_META,
  confidenceLabel,
  hasEnoughDataForReveal,
  type FelineFiveScore,
  type PersonalityQuizAnswers,
} from '../src/services/personality';
import { track } from '../src/services/analytics';
import { BecomingSection } from '../src/components/BecomingSection';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

// ---------------------------------------------------------------------------
// Quiz definitions — a single source of truth for the 4 questions.
// Adding a 5th means appending here and extending the answers type.
// ---------------------------------------------------------------------------

type QuizField = keyof Omit<PersonalityQuizAnswers, 'answered_at'>;

type QuizOption = {
  value: string;
  label: string;
  hint?: string;
};

type QuizQuestion = {
  field: QuizField;
  prompt: (catName: string) => string;
  options: QuizOption[];
};

const QUESTIONS: QuizQuestion[] = [
  {
    field: 'strangers',
    prompt: (n) => `When a stranger visits, ${n} usually…`,
    options: [
      { value: 'hides', label: 'Hides somewhere' },
      { value: 'watches', label: 'Watches from a safe distance' },
      { value: 'approaches', label: 'Walks up and rubs against them' },
    ],
  },
  {
    field: 'novel_object',
    prompt: (n) => `With a brand-new toy, ${n}…`,
    options: [
      { value: 'ignores', label: 'Ignores it' },
      { value: 'watches', label: 'Watches with interest' },
      { value: 'plays_immediately', label: 'Pounces and plays immediately' },
    ],
  },
  {
    field: 'handling',
    prompt: (n) => `When picked up, ${n}…`,
    options: [
      { value: 'squirms', label: 'Squirms to get down' },
      { value: 'tolerates', label: 'Tolerates it briefly' },
      { value: 'settles', label: 'Settles in and gets comfortable' },
    ],
  },
  {
    field: 'night_pattern',
    prompt: (n) => `At 3am, ${n} is usually…`,
    options: [
      { value: 'asleep', label: 'Fast asleep' },
      { value: 'quiet', label: 'Quietly active' },
      { value: 'vocalising', label: 'Vocalising or zooming around' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PersonalityScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const profile = usePersonalityProfile(cat?.id);
  const recompute = usePersonalityStore((s) => s.recompute);
  const quizAnswers = usePersonalityStore((s) =>
    cat ? s.quizAnswers[cat.id] : undefined,
  );

  // Recompute on mount + when cat or quiz answers change. Cheap (pure fn).
  useEffect(() => {
    if (cat?.id) recompute(cat.id);
  }, [cat?.id, quizAnswers, recompute]);

  // Telemetry: fire personality_quiz_started once when the quiz UI is
  // shown for this cat, and personality_profile_viewed once when the
  // archetype is rendered (post-recompute). Both are guarded so we
  // don't double-fire on re-renders.
  const showQuizFirstFlag = !quizAnswers;
  useEffect(() => {
    if (!cat?.id) return;
    if (showQuizFirstFlag) {
      track({ type: 'personality_quiz_started', props: { skipped_initial: false } });
    }
  }, [cat?.id, showQuizFirstFlag]);

  useEffect(() => {
    if (!cat?.id || !profile) return;
    if (showQuizFirstFlag) return; // skip when quiz UI is up
    track({
      type: 'personality_profile_viewed',
      props: {
        archetype: hasEnoughDataForReveal(profile) ? profile.archetype : null,
        confidence_band: confidenceLabel(profile.confidence),
        confidence_pct: Math.round(profile.confidence * 100),
        had_breed_prior: profile.inputs_used.breed_prior,
        had_quiz: profile.inputs_used.quiz_answered,
        checkin_count: profile.inputs_used.checkin_count,
        behavior_obs_count: profile.inputs_used.behavior_obs_count,
      },
    });
    // Profile object identity changes per recompute; key on archetype +
    // confidence so identical re-renders don't re-fire.
  }, [cat?.id, showQuizFirstFlag, profile?.archetype, profile?.confidence]);

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

  // If no quiz answered yet, show the quiz flow up front. The user can
  // still skip to "show what we have" if they don't want to take it.
  const showQuizFirst = !quizAnswers;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: t.surface, paddingTop: insets.top },
      ]}
    >
      <Header onBack={() => router.back()} title={`${cat.name}'s personality`} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        {showQuizFirst ? (
          <QuizFlow catName={cat.name} catId={cat.id} />
        ) : (
          <ProfileView catName={cat.name} catId={cat.id} />
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
        <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
      </Pressable>
      <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
        {title ?? 'Personality'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quiz flow (4 questions, swipe-style)
// ---------------------------------------------------------------------------

function QuizFlow({ catName, catId }: { catName: string; catId: string }) {
  const t = useTheme();
  const saveQuiz = usePersonalityStore((s) => s.saveQuiz);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<QuizField, string>>({
    strangers: '',
    novel_object: '',
    handling: '',
    night_pattern: '',
  });

  const total = QUESTIONS.length;
  const q = QUESTIONS[step]!;
  const selected = answers[q.field];
  const canAdvance = !!selected;
  const isLast = step === total - 1;

  const finish = () => {
    saveQuiz(catId, {
      strangers: answers.strangers as PersonalityQuizAnswers['strangers'],
      novel_object: answers.novel_object as PersonalityQuizAnswers['novel_object'],
      handling: answers.handling as PersonalityQuizAnswers['handling'],
      night_pattern: answers.night_pattern as PersonalityQuizAnswers['night_pattern'],
      answered_at: new Date().toISOString(),
    });
    track({
      type: 'personality_quiz_completed',
      props: { skipped: false, question_count: total },
    });
  };

  const skip = () => {
    // Save a "neutral midpoint" answer set so the algorithm runs. The
    // profile will lean on breed + observations. Confidence will be lower
    // because hasQuiz is technically true but answers are neutral.
    saveQuiz(catId, {
      strangers: 'watches',
      novel_object: 'watches',
      handling: 'tolerates',
      night_pattern: 'quiet',
      answered_at: new Date().toISOString(),
    });
    track({
      type: 'personality_quiz_completed',
      props: { skipped: true, question_count: total },
    });
  };

  return (
    <View style={{ paddingTop: space[5] }}>
      <Text
        token="caption"
        color="textMuted"
        style={{ textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', marginBottom: space[2] }}
      >
        About {catName} · {step + 1} of {total}
      </Text>

      {/* Progress dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[2], marginBottom: space[6] }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i <= step ? t.secondary500 : t.borderSubtle,
            }}
          />
        ))}
      </View>

      {/* Question prompt */}
      <Text
        token="heading2"
        style={{ textAlign: 'center', marginBottom: space[6], paddingHorizontal: space[3] }}
      >
        {q.prompt(catName)}
      </Text>

      {/* Options */}
      <View style={{ gap: space[3] }}>
        {q.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() =>
                setAnswers((prev) => ({ ...prev, [q.field]: opt.value }))
              }
              style={[
                styles.optionTile,
                {
                  backgroundColor: isSelected ? t.secondary100 : t.surfaceElevated,
                  borderColor: isSelected ? t.secondary500 : t.borderSubtle,
                },
              ]}
            >
              <Text
                token="body"
                style={{
                  fontFamily: isSelected ? 'Figtree_600SemiBold' : 'Figtree_400Regular',
                  color: isSelected ? t.secondary900 : t.textPrimary,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer buttons */}
      <View style={{ marginTop: space[8], gap: space[3] }}>
        <Button
          label={isLast ? `See ${catName}'s personality` : 'Next'}
          rightIcon={
            isLast ? (
              <Sparkle size={18} color={t.textInverse} weight="fill" />
            ) : (
              <ArrowRight size={18} color={t.textInverse} weight="bold" />
            )
          }
          disabled={!canAdvance}
          onPress={() => {
            if (isLast) finish();
            else setStep((s) => s + 1);
          }}
          size="lg"
          pill
          fullWidth
        />
        {step === 0 ? (
          <Pressable onPress={skip} style={{ paddingVertical: space[3], alignItems: 'center' }}>
            <Text token="caption" color="textMuted">
              Skip — show me what you have so far
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            style={{ paddingVertical: space[3], alignItems: 'center' }}
          >
            <Text token="caption" color="textMuted">
              ← Back
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Profile view — archetype card + trait bars + body
// ---------------------------------------------------------------------------

function ProfileView({ catName, catId }: { catName: string; catId: string }) {
  const t = useTheme();
  const router = useRouter();
  const cat = useActiveCat();
  const profile = usePersonalityProfile(catId);
  const saveQuiz = usePersonalityStore((s) => s.saveQuiz);
  const recompute = usePersonalityStore((s) => s.recompute);
  const { share: shareCard, Host: ShareCardHost } = useShareableCard();

  if (!profile) {
    return (
      <View style={{ paddingTop: space[8], alignItems: 'center' }}>
        <Text token="body" color="textMuted">
          Computing {catName}&apos;s profile…
        </Text>
      </View>
    );
  }

  const enoughData = hasEnoughDataForReveal(profile);
  const meta = ARCHETYPE_META[profile.archetype];
  const confLabel = confidenceLabel(profile.confidence);
  const confPct = Math.round(profile.confidence * 100);

  // Share the archetype as a 1080×1920 identity card. Mirrors the
  // Co-Star "I'm a Capricorn rising" identity-as-content pattern: the
  // shared card recruits the next user. See marketing/chat-as-viral-
  // lever.md §6.
  const handleShareArchetype = () => {
    if (!enoughData) return;
    shareCard(
      {
        kind: 'archetype',
        catName,
        catPhotoUri: cat?.photo_uri ?? null,
        eyebrow: meta.name,
        headline: meta.oneLiner,
        subtitle: `What's your cat?`,
      },
      { surface: 'personality_screen' },
    );
  };

  return (
    <View style={{ paddingTop: space[5] }}>
      {!enoughData ? (
        <BuildingNotice catName={catName} profile={profile} />
      ) : (
        <>
          {/* Archetype card — terracotta-themed */}
          <View
            style={[
              styles.archetypeCard,
              { backgroundColor: t.secondary100, borderColor: t.secondary500 },
            ]}
          >
            <Text
              token="caption"
              style={{ color: t.secondary700, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: space[2] }}
            >
              {catName}&apos;s archetype
            </Text>
            <Text
              token="displayLg"
              style={{ color: t.secondary900, marginBottom: space[2] }}
            >
              {meta.emoji}  {meta.name}
            </Text>
            <Text token="bodyLg" style={{ color: t.secondary900, fontStyle: 'italic' }}>
              {meta.oneLiner}
            </Text>
            <Text
              token="body"
              style={{ color: t.secondary900, marginTop: space[4], lineHeight: 22 }}
            >
              {meta.body}
            </Text>
          </View>

          {/* Five trait bars */}
          <SectionHeading>The Feline Five</SectionHeading>
          <Card>
            <TraitBar label="Skittishness" value={profile.scores.skittishness} subtitle="anxious ↔ calm" />
            <TraitBar label="Outgoingness" value={profile.scores.outgoingness} subtitle="reserved ↔ sociable" />
            <TraitBar label="Dominance" value={profile.scores.dominance} subtitle="submissive ↔ assertive" />
            <TraitBar label="Spontaneity" value={profile.scores.spontaneity} subtitle="predictable ↔ impulsive" />
            <TraitBar label="Friendliness" value={profile.scores.friendliness} subtitle="aloof ↔ affectionate" />
          </Card>

          {/* Care implications */}
          <SectionHeading>What this means for {catName}</SectionHeading>
          <Card>
            <Text token="body" style={{ lineHeight: 22 }}>
              {meta.careHint}
            </Text>
          </Card>

          {/* How to deepen the profile — every activity sharpens
              ${catName}'s voice in chat, diary, daily card. This is
              the explicit "more data → richer voice" message the user
              should see at the moment they care about the profile. */}
          <SectionHeading>How {catName}&apos;s voice grows</SectionHeading>
          <Card>
            <Text token="body" style={{ lineHeight: 22, marginBottom: space[3] }}>
              {`The archetype above is the starting point. ${catName}'s voice in chat, diary entries and the daily card gets richer with every activity you log — each one is another brushstroke on ${catName}'s portrait.`}
            </Text>
            <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold', marginBottom: space[2] }}>
              What deepens the profile:
            </Text>
            <View style={{ gap: space[2] }}>
              <VoiceGrowthRow
                label="Daily check-ins"
                desc={`Mood + appetite + litter. Builds the rhythm ${catName} writes the diary from.`}
              />
              <VoiceGrowthRow
                label="Body Language reads"
                desc={`6-second clips → AI tags ${catName}'s posture, vocalisation, energy. Feeds the personality scores.`}
              />
              <VoiceGrowthRow
                label="Photos with people & pets"
                desc={`Tag who's in the frame. ${catName} starts referencing them by name in diary + chat.`}
              />
              <VoiceGrowthRow
                label="Self-facts in chat"
                desc={`Tell ${catName} something about themselves ("you love tuna") — it sticks. ${catName} speaks from these.`}
              />
              <VoiceGrowthRow
                label="Triage + symptom logs"
                desc={`Real medical context. ${catName} stops faking "I'm fine" when they're not.`}
              />
            </View>
            <Text
              token="caption"
              color="textMuted"
              style={{ marginTop: space[4], lineHeight: 18, fontStyle: 'italic' }}
            >
              {`The Becoming meter below tracks how shaped ${catName} is becoming in here.`}
            </Text>
          </Card>
        </>
      )}

      {/* Confidence card removed 2026-05-04 — the new BecomingSection
          (progress wheel + facet accordion) below covers the same
          territory ("how shaped is the cat in this app?") with
          richer detail. Two cards saying similar things created
          conceptual overlap. */}

      {/* Action buttons */}
      <View style={{ marginTop: space[6], gap: space[3] }}>
        {enoughData ? (
          <Button
            label={`Share ${catName}'s archetype`}
            variant="primary"
            leftIcon={
              <ShareNetwork size={18} color={t.textInverse} weight="bold" />
            }
            onPress={handleShareArchetype}
            fullWidth
          />
        ) : null}
        <Button
          label="Refresh profile"
          variant="secondary"
          onPress={() => {
            recompute(catId);
            track({ type: 'personality_profile_refreshed' });
          }}
          fullWidth
        />
        <Pressable
          onPress={() => {
            if (!cat?.id) return;
            // Wipe the quiz answers — the screen reads `quizAnswers`
            // reactively, so clearing them flips the gate at line 173
            // (`showQuizFirst = !quizAnswers`) and re-renders into the
            // quiz flow without a navigation round-trip. The cached
            // profile stays so the archetype doesn't disappear mid-retake;
            // it'll be recomputed when new answers save.
            usePersonalityStore.getState().clearQuiz(cat.id);
            track({
              type: 'personality_quiz_started',
              props: { skipped_initial: false, retake: true },
            });
          }}
          style={{ paddingVertical: space[3], alignItems: 'center' }}
        >
          <Text token="caption" color="textMuted">
            Retake the quiz
          </Text>
        </Pressable>
      </View>

      {/* Off-screen host for the ShareableCatCard. Renders the
          1080×1920 archetype card at opacity 0 inside the viewport
          while a share is in flight, then unmounts. */}
      {ShareCardHost}

      {/* Becoming section — circular progress wheel + collapsible
          facets showing how shaped the cat-in-the-app has become.
          Embedded under personality so the two read as one continuous
          identity surface. Replaces the earlier dedicated /becoming
          screen + Bond-tab tile, which the user found cluttered. */}
      <BecomingSection catId={catId} catName={catName} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers + sub-components
// ---------------------------------------------------------------------------

function BuildingNotice({
  catName,
  profile,
}: {
  catName: string;
  profile: NonNullable<ReturnType<typeof usePersonalityProfile>>;
}) {
  const t = useTheme();
  const checkinsNeeded = Math.max(0, 3 - profile.inputs_used.checkin_count);
  const obsNeeded = Math.max(0, 1 - profile.inputs_used.behavior_obs_count);

  return (
    <View
      style={[
        styles.archetypeCard,
        { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
      ]}
    >
      <Text
        token="caption"
        color="textMuted"
        style={{ letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: space[2] }}
      >
        Building {catName}&apos;s profile
      </Text>
      <Text token="heading2" style={{ marginBottom: space[3] }}>
        Almost there.
      </Text>
      <Text token="body" color="textMuted" style={{ lineHeight: 22 }}>
        Personality reads are most accurate with a few weeks of daily
        check-ins and at least one Read-{catName} session.
        {checkinsNeeded > 0 ? ` ${checkinsNeeded} more daily check-in${checkinsNeeded === 1 ? '' : 's'}` : ''}
        {checkinsNeeded > 0 && obsNeeded > 0 ? ' and' : ''}
        {obsNeeded > 0 ? ` ${obsNeeded} Read-${catName} session` : ''}
        {checkinsNeeded > 0 || obsNeeded > 0 ? ' will reveal the archetype.' : ''}
      </Text>
    </View>
  );
}

function VoiceGrowthRow({
  label,
  desc,
}: {
  label: string;
  desc: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: t.secondary500,
          marginTop: 8,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold', lineHeight: 22 }}>
          {label}
        </Text>
        <Text token="body" color="textSecondary" style={{ lineHeight: 22 }}>
          {desc}
        </Text>
      </View>
    </View>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      token="caption"
      color="textMuted"
      style={{
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: space[6],
        marginBottom: space[3],
      }}
    >
      {children}
    </Text>
  );
}

function TraitBar({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number;
  subtitle: string;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: space[3] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space[1] }}>
        <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
          {label}
        </Text>
        <Text token="caption" color="textMuted" style={{ fontFamily: 'JetBrainsMono_500Medium' }}>
          {value}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: t.surfaceSunken,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${value}%`,
            height: '100%',
            backgroundColor: t.secondary500,
          }}
        />
      </View>
      <Text token="caption" color="textMuted" style={{ marginTop: 2, fontSize: 11 }}>
        {subtitle}
      </Text>
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
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  archetypeCard: {
    padding: space[6],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionTile: {
    paddingVertical: space[4],
    paddingHorizontal: space[5],
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

