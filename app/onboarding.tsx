/**
 * Onboarding — 6 slides: positioning → four pillars → privacy → name →
 * profile → activation.
 *
 * The activation slide (final) introduces the three things to try first
 * — added because Bond went from one feature to three this session
 * (Personality, Diary, Read [cat]) and new users were landing in
 * /(main) with no idea those existed. Onboarding is the only place we
 * can introduce all four pillars before the user has to discover them
 * by tapping around.
 *
 * Design: minimal, one primary action per step, no back-button spam.
 * Profile step asks for age + sex + spay + breed — all skippable but
 * meaningfully improve triage + behaviour reader + personality profile
 * quality. Breed especially impacts behaviour/personality interpretation
 * (Maine Coon ≠ Sphynx in posture defaults).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useCatStore, newCat, type Sex } from '../src/state/catStore';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

// Age quick-pick → approximate age_months. Owner can edit precisely from
// the cat profile screen later. These midpoints are just enough for
// triage to know "kitten vs senior."
type AgeBucket = 'kitten' | 'young' | 'mature' | 'senior' | null;
const AGE_BUCKET_MONTHS: Record<Exclude<AgeBucket, null>, number> = {
  kitten: 6,    // <1y → ~6mo midpoint
  young: 36,    // 1-6y → ~3y
  mature: 102,  // 7-10y → ~8.5y
  senior: 144,  // 10+ → ~12y
};

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(0);
  const [catName, setCatName] = useState('');
  const [ageBucket, setAgeBucket] = useState<AgeBucket>(null);
  const [sex, setSex] = useState<Sex>('unknown');
  const [spayedNeutered, setSpayedNeutered] = useState<boolean | null>(null);
  const [breed, setBreed] = useState('');
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addCat = useCatStore((s) => s.addCat);
  const setHasOnboarded = useCatStore((s) => s.setHasOnboarded);

  const onFinish = () => {
    const base = newCat(catName || 'Cat');
    const cat = {
      ...base,
      breed: breed.trim() || null,
      age_months: ageBucket ? AGE_BUCKET_MONTHS[ageBucket] : null,
      sex,
      spayed_neutered: spayedNeutered,
    };
    addCat(cat);
    setHasOnboarded(true);
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'onboarding_completed' }),
    );
    // Ask for notification permission opportunistically AFTER onboarding
    // completes — gives us scaffolding to schedule birthday + check-in
    // pushes the moment the user sets a DOB or daily-checkin time.
    // Failure is non-fatal — user can grant later from Settings.
    void import('../src/services/notifications').then(({ ensureNotificationPermission }) =>
      ensureNotificationPermission().catch(() => false),
    );
    router.replace('/(main)');
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: t.surface,
          paddingTop: insets.top + space[8],
          paddingBottom: insets.bottom + space[6],
        },
      ]}
    >
      <View style={styles.progress}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i <= step ? t.primary500 : t.borderSubtle },
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        {step === 0 && (
          <>
            <Text token="displayLg" color="textPrimary">
              Your cat&apos;s MD.
            </Text>
            <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[5], lineHeight: 26 }}>
              An expert who knows your cat whole — health, mood,
              personality, daily life. Built for cats only, trained
              on vet-curated feline medicine.
            </Text>
          </>
        )}

        {step === 1 && (
          <>
            <Text token="displayLg" color="textPrimary">Four ways to know your cat.</Text>
            <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[5], lineHeight: 24 }}>
              Open one tab; the rest are humming in the background.
            </Text>
            <View style={{ marginTop: space[5], gap: space[3] }}>
              <PillarRow
                name="Today"
                desc="A 15-second check-in. Streaks, mood, appetite — at a glance."
                color={t.primary700}
              />
              <PillarRow
                name="Bond"
                desc="Personality, photo memories, daily diary written for you."
                color={t.secondary700}
              />
              <PillarRow
                name="Chat"
                desc="Ask anything — behavior, food, weird habits. The AI knows your cat."
                color={t.secondary700}
              />
              <PillarRow
                name="Triage"
                desc="Vet-grade symptom check. Vaccines, weight, watch monitors."
                color={t.primary700}
              />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text token="displayLg" color="textPrimary">Private by design.</Text>
            <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[5] }}>
              Your cat&apos;s photos and notes stay on your device. We never sell or
              share your data. Your account is anonymous until you create one.
            </Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text token="displayLg" color="textPrimary">What&apos;s your cat&apos;s name?</Text>
            <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[5] }}>
              We&apos;ll personalise insights around them.
            </Text>
            <TextInput
              autoFocus
              placeholder="e.g. Luna"
              placeholderTextColor={t.textMuted}
              style={{
                marginTop: space[6],
                height: 52,
                paddingHorizontal: space[4],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surfaceElevated,
                color: t.textPrimary,
                fontFamily: 'Figtree_500Medium',
                fontSize: 18,
              }}
              value={catName}
              onChangeText={setCatName}
              returnKeyType="next"
              onSubmitEditing={() => setStep(4)}
              accessibilityLabel="Your cat's name"
            />
          </>
        )}

        {step === 4 && (
          <ScrollView contentContainerStyle={{ paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
            <Text token="displayLg" color="textPrimary">
              A bit about {catName.trim() || 'your cat'}
            </Text>
            <Text token="body" color="textSecondary" style={{ marginTop: space[3], lineHeight: 22 }}>
              Age and sex change which risks your cat has — kittens, seniors, and males have very different patterns. Skip anything you&apos;re not sure about.
            </Text>

            {/* Age — quick-pick buttons. DOB precision happens in cat profile later. */}
            <Text token="caption" style={{ marginTop: space[6], color: t.textPrimary, fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>
              Age
            </Text>
            <View style={styles.optionRow}>
              {([
                ['kitten', 'Kitten', 'under 1y'],
                ['young', 'Young', '1–6y'],
                ['mature', 'Adult', '7–10y'],
                ['senior', 'Senior', '10y+'],
              ] as const).map(([key, label, sub]) => (
                <Pressable
                  key={key}
                  onPress={() => setAgeBucket(ageBucket === key ? null : key)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: ageBucket === key ? t.primary100 : t.surfaceElevated,
                      borderColor: ageBucket === key ? t.primary500 : t.borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text token="body" style={{ color: ageBucket === key ? t.primary900 : t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
                    {label}
                  </Text>
                  <Text token="caption" style={{ color: ageBucket === key ? t.primary700 : t.textMuted }}>
                    {sub}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Sex */}
            <Text token="caption" style={{ marginTop: space[5], color: t.textPrimary, fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>
              Sex
            </Text>
            <View style={styles.optionRow}>
              {([
                ['female', 'Female'],
                ['male', 'Male'],
                ['unknown', "Don't know"],
              ] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setSex(key)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: sex === key ? t.primary100 : t.surfaceElevated,
                      borderColor: sex === key ? t.primary500 : t.borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                      flex: 1,
                    },
                  ]}
                >
                  <Text token="body" style={{ color: sex === key ? t.primary900 : t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Spayed / neutered */}
            <Text token="caption" style={{ marginTop: space[5], color: t.textPrimary, fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>
              Spayed / neutered?
            </Text>
            <View style={styles.optionRow}>
              {([
                [true, 'Yes'],
                [false, 'No'],
                [null, "Not sure"],
              ] as const).map(([key, label]) => (
                <Pressable
                  key={String(key)}
                  onPress={() => setSpayedNeutered(key)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: spayedNeutered === key ? t.primary100 : t.surfaceElevated,
                      borderColor: spayedNeutered === key ? t.primary500 : t.borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                      flex: 1,
                    },
                  ]}
                >
                  <Text token="body" style={{ color: spayedNeutered === key ? t.primary900 : t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Breed */}
            <Text token="caption" style={{ marginTop: space[5], color: t.textPrimary, fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}>
              Breed
            </Text>
            <TextInput
              placeholder="e.g. Domestic Shorthair, Maine Coon"
              placeholderTextColor={t.textMuted}
              style={{
                marginTop: space[2],
                height: 48,
                paddingHorizontal: space[4],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surfaceElevated,
                color: t.textPrimary,
                fontFamily: 'Figtree_500Medium',
                fontSize: 16,
              }}
              value={breed}
              onChangeText={setBreed}
              returnKeyType="done"
              onSubmitEditing={() => setStep(5)}
              accessibilityLabel="Cat breed"
            />

            <Text token="caption" color="textMuted" style={{ marginTop: space[5], lineHeight: 18 }}>
              Tip: you can add more cats anytime from <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>Settings → Manage cats</Text>.
            </Text>
          </ScrollView>
        )}

        {step === 5 && (
          <ScrollView contentContainerStyle={{ paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
            <Text token="displayLg" color="textPrimary">
              {`How ${catName.trim() || 'Lily'}'s voice grows.`}
            </Text>
            <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[4], lineHeight: 24 }}>
              {`Every check-in, every photo, every read, every chat — ${catName.trim() || 'Lily'} learns from it. The more you log, the more ${catName.trim() || 'Lily'}'s diary, daily card and chat replies sound like the real ${catName.trim() || 'Lily'} — not a generic cat. Three quick first moves below; you don't need to do them all today.`}
            </Text>

            <View style={{ marginTop: space[6], gap: space[3] }}>
              <ActivationTile
                label="1"
                title="Log today's check-in"
                desc={`Today tab → three taps on mood, appetite, litter. Builds the rhythm ${catName.trim() || 'Lily'} writes from.`}
                color={t.primary700}
                bg={t.primary100}
              />
              <ActivationTile
                label="2"
                title="Read body language"
                desc={`Today → Body Language → 6-sec clip. AI tells you what ${catName.trim() || 'Lily'} is feeling — and remembers it.`}
                color={t.secondary700}
                bg={t.secondary100}
              />
              <ActivationTile
                label="3"
                title={`Find ${catName.trim() || 'Lily'}'s personality`}
                desc={`Bond → Personality → 4 quick questions. Locks in ${catName.trim() || 'Lily'}'s voice register for chat + diary.`}
                color={t.secondary700}
                bg={t.secondary100}
              />
            </View>

            <Text token="caption" color="textMuted" style={{ marginTop: space[6], lineHeight: 18, textAlign: 'center' }}>
              {`Each activity adds another brushstroke. ${catName.trim() || 'Lily'}'s voice gets richer as you go.`}
            </Text>
          </ScrollView>
        )}
      </View>

      <Button
        label={
          step < 3
            ? 'Continue'
            : step === 3
              ? catName.trim()
                ? 'Next'
                : 'Skip for now'
              : step === 4
                ? `Meet ${catName.trim() || 'your cat'}`
                : `Take me to ${catName.trim() || 'CatMD'}`
        }
        onPress={step < 5 ? () => setStep((step + 1) as Step) : onFinish}
        size="lg"
        pill
        fullWidth
        rightIcon={<ArrowRight size={18} color={t.textInverse} weight="bold" />}
      />
    </View>
  );
}

/**
 * Compact pillar row used on Step 1 — pillar name (terracotta or sage)
 * + one-line description. Shared visual rhythm with the website's
 * pillar-band so brand recognition carries across surfaces.
 */
function PillarRow({
  name,
  desc,
  color,
}: {
  name: string;
  desc: string;
  color: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <Text
        token="heading3"
        style={{
          color,
          width: 64,
          fontFamily: 'SourceSerif4_500Medium',
          letterSpacing: -0.3,
        }}
      >
        {name}
      </Text>
      <Text
        token="body"
        color="textSecondary"
        style={{ flex: 1, lineHeight: 21 }}
      >
        {desc}
      </Text>
    </View>
  );
}

/**
 * Numbered activation card used on Step 5. Visually similar to a feature
 * tile but compact — three of these stack vertically without scrolling
 * on most phones. The colored "1 / 2 / 3" badge uses sage for Today
 * (medical/clinical anchor) and terracotta for Bond (relational anchor)
 * so the cards self-identify by pillar at a glance.
 */
function ActivationTile({
  label,
  title,
  desc,
  color,
  bg,
}: {
  label: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        padding: space[4],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.borderSubtle,
        backgroundColor: t.surfaceElevated,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          token="body"
          style={{ color, fontFamily: 'Figtree_700Bold' }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text token="heading3" style={{ marginBottom: 4 }}>
          {title}
        </Text>
        <Text token="caption" color="textMuted" style={{ lineHeight: 18 }}>
          {desc}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space[5],
    justifyContent: 'space-between',
  },
  progress: { flexDirection: 'row', gap: 6 },
  dot: { width: 28, height: 4, borderRadius: 2 },
  content: { flex: 1, justifyContent: 'center' },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[2],
  },
  chip: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
  },
});
