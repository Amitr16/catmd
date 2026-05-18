/**
 * TestimonialStoryModal — bottom-sheet that asks the owner to share
 * the story behind a vet-confirmed outcome (audit 2026-05-16
 * marketing-attribution story-collection spec).
 *
 * Fires from `app/outcome-check.tsx` after the user marks
 * `vet_visited === 'yes'`. Submission goes to Supabase's
 * `vet_confirmed_stories` table via the write-only helper in
 * `services/vetConfirmedStories.ts`.
 *
 * Per-user gating (90-day cool-off) happens at the caller — this
 * component is dumb: it just renders the form and reports back
 * 'submitted' | 'dismissed' via `onClose`.
 */
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, X } from 'phosphor-react-native';
import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import type { UrgencyTier } from '../ai/triage';
import {
  submitVetConfirmedStory,
  markTestimonialPrompted,
  type StoryPermissionLevel,
} from '../services/vetConfirmedStories';

export type TestimonialModalCloseReason = 'submitted' | 'skipped' | 'never_again';

export type TestimonialStoryModalProps = {
  visible: boolean;
  catName: string;
  catId: string;
  scanId: string;
  urgencyTier: UrgencyTier;
  healthScore: number;
  onClose: (reason: TestimonialModalCloseReason) => void;
};

const PERMISSION_OPTIONS: Array<{
  value: StoryPermissionLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'private',
    label: 'Private note only',
    description: 'Kept internal. Helps the team improve CatMD. Never published.',
  },
  {
    value: 'anonymous_quote',
    label: 'Anonymous quote OK',
    description: 'Quote may be published without your name or your cat’s name.',
  },
  {
    value: 'first_name',
    label: 'First name + cat name',
    description: 'Quote may be published with your first name and your cat’s name.',
  },
  {
    value: 'contact_me',
    label: 'Contact me first',
    description: 'We’ll reach out before using your story publicly.',
  },
];

export function TestimonialStoryModal({
  visible,
  catName,
  catId,
  scanId,
  urgencyTier,
  healthScore,
  onClose,
}: TestimonialStoryModalProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [ownerObserved, setOwnerObserved] = useState('');
  const [catmdFlagged, setCatmdFlagged] = useState('');
  const [vetConfirmed, setVetConfirmed] = useState('');
  const [outcome, setOutcome] = useState('');
  const [permission, setPermission] = useState<StoryPermissionLevel | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !submitting &&
    ownerObserved.trim().length > 0 &&
    catmdFlagged.trim().length > 0 &&
    vetConfirmed.trim().length > 0 &&
    outcome.trim().length > 0 &&
    permission != null &&
    (permission !== 'contact_me' || contactEmail.trim().length > 3);

  const handleSubmit = async () => {
    if (!canSubmit || !permission) return;
    setSubmitting(true);
    try {
      const result = await submitVetConfirmedStory({
        cat_id: catId,
        scan_id: scanId,
        original_urgency_tier: urgencyTier,
        health_score: healthScore,
        catmd_flagged: catmdFlagged,
        owner_observed: ownerObserved,
        vet_confirmed: vetConfirmed,
        outcome,
        permission_level: permission,
        contact_email: permission === 'contact_me' ? contactEmail : null,
      });

      if (!result.ok) {
        Alert.alert(
          'Could not save',
          'Something went wrong saving your story. Please try again, or skip for now.',
        );
        return;
      }

      // Fire analytics + set the 90-day cool-off + close
      void import('../services/analytics').then(({ track }) =>
        track({
          type: 'testimonial_story_submitted',
          props: {
            scan_id: scanId,
            permission_level: permission,
            had_contact_email:
              permission === 'contact_me' && contactEmail.trim().length > 0,
          },
        }),
      );
      await markTestimonialPrompted();
      onClose('submitted');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    void import('../services/analytics').then(({ track }) =>
      track({
        type: 'testimonial_story_dismissed',
        props: { scan_id: scanId, reason: 'skip' },
      }),
    );
    await markTestimonialPrompted();
    onClose('skipped');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.surface }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Close X */}
        <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
          <Pressable
            onPress={handleSkip}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityLabel="Skip for now"
          >
            <X size={22} color={t.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + space[10] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text token="heading1">Would you tell us what happened?</Text>
          <Text token="body" color="textSecondary" style={{ marginTop: space[2] }}>
            Stories like yours help other cat parents understand when
            &ldquo;something feels off&rdquo; is worth acting on. Optional, takes
            about a minute, kept private until you say otherwise.
          </Text>

          <Field
            label="What did you notice first?"
            placeholder={`e.g. ${catName} stopped jumping onto the couch`}
            value={ownerObserved}
            onChange={setOwnerObserved}
          />

          <Field
            label="What did CatMD flag?"
            placeholder="e.g. monitor-tier scan, possible pain"
            value={catmdFlagged}
            onChange={setCatmdFlagged}
          />

          <Field
            label="What did the vet say?"
            placeholder="e.g. early dental disease, started treatment"
            value={vetConfirmed}
            onChange={setVetConfirmed}
          />

          <Field
            label={`How is ${catName} doing now?`}
            placeholder="e.g. eating normally again after two weeks"
            value={outcome}
            onChange={setOutcome}
          />

          {/* Permissions */}
          <Text
            token="heading3"
            style={{ marginTop: space[5], marginBottom: space[2] }}
          >
            Can we use this story?
          </Text>
          <Text token="caption" color="textMuted" style={{ marginBottom: space[3] }}>
            You decide how this story can be used. You can also change your
            mind later by emailing us.
          </Text>
          {PERMISSION_OPTIONS.map((opt) => (
            <PermissionRow
              key={opt.value}
              label={opt.label}
              description={opt.description}
              selected={permission === opt.value}
              onPress={() => setPermission(opt.value)}
            />
          ))}

          {permission === 'contact_me' && (
            <View style={{ marginTop: space[3] }}>
              <Text token="body" style={{ marginBottom: space[2] }}>
                Your email
              </Text>
              <TextInput
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="you@example.com"
                placeholderTextColor={t.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{
                  padding: space[3],
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: t.borderStrong,
                  backgroundColor: t.surface,
                  color: t.textPrimary,
                  fontFamily: 'Figtree_400Regular',
                  fontSize: 15,
                }}
              />
              <Text
                token="caption"
                color="textMuted"
                style={{ marginTop: space[1] }}
              >
                We&apos;ll only reach out about this specific story. Never sold,
                never spammed.
              </Text>
            </View>
          )}

          <Button
            label={submitting ? 'Saving…' : 'Share the story'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            leftIcon={<CheckCircle size={18} color={t.textInverse} weight="bold" />}
            fullWidth
            style={{ marginTop: space[6] }}
          />
          <Pressable
            onPress={handleSkip}
            style={{ marginTop: space[3], alignItems: 'center' }}
            hitSlop={8}
          >
            <Text token="caption" color="textMuted">
              Skip for now
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (s: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ marginTop: space[4] }}>
      <Text token="body" style={{ marginBottom: space[2], fontWeight: '500' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        multiline
        style={{
          minHeight: 72,
          padding: space[3],
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: t.borderStrong,
          backgroundColor: t.surface,
          color: t.textPrimary,
          fontFamily: 'Figtree_400Regular',
          fontSize: 15,
          textAlignVertical: 'top',
        }}
      />
    </View>
  );
}

function PermissionRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.permRow,
        {
          borderColor: selected ? t.primary700 : t.borderStrong,
          backgroundColor: selected ? t.primary100 : t.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? t.primary700 : t.borderStrong },
        ]}
      >
        {selected && (
          <View
            style={[styles.radioInner, { backgroundColor: t.primary700 }]}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text token="body" style={{ fontWeight: '500' }}>
          {label}
        </Text>
        <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space[4],
    paddingBottom: space[1],
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: space[5],
    paddingTop: space[2],
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[2],
    gap: space[3],
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
