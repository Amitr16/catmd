/**
 * Follow-up Q&A — Ada-style clarifying loop.
 *
 * Flow:
 *   1. Reads the scan by id; expects `pending_questions` to be non-empty.
 *   2. Renders each question with free-text input OR multi-choice chips.
 *   3. On submit, calls `runTriage()` again with followUpAnswers fed in.
 *   4. Merges the new TriageResult back into the scan (via scanStore
 *      `updateScan` + `applyRerunToScan`) and routes back to /result.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Question } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import { applyRerunToScan, useScanStore } from '../src/state/scanStore';
import { useCatStore } from '../src/state/catStore';
import { runTriage } from '../src/ai/triage';
import type { FollowUpAnswer } from '../src/ai/triage';
import type { CatProfileSummary } from '../src/ai/prompts';
import { recentScansSummary } from '../src/state/scanStore';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function FollowUpScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scan = useScanStore((s) => s.scans.find((x) => x.id === id)) ?? null;
  const allScans = useScanStore((s) => s.scans);
  const updateScan = useScanStore((s) => s.updateScan);
  const cat = useCatStore((s) =>
    scan ? s.cats.find((c) => c.id === scan.cat_id) ?? null : null,
  );

  // Answer-state keyed by question.id so we survive re-renders cleanly.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!scan || scan.pending_questions.length === 0) {
    return (
      <View style={{ flex: 1, padding: space[5], justifyContent: 'center' }}>
        <Text token="heading2">Nothing to answer</Text>
        <Text token="body" color="textSecondary" style={{ marginTop: space[2] }}>
          This triage is already as sharp as it can be.
        </Text>
        <Button
          label="Back"
          onPress={() => router.back()}
          style={{ marginTop: space[4] }}
        />
      </View>
    );
  }

  const allAnswered = scan.pending_questions.every((q) => (answers[q.id] ?? '').trim());

  const onSubmit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const answered: FollowUpAnswer[] = scan.pending_questions.map((q) => ({
        id: q.id,
        question: q.question,
        answer: (answers[q.id] ?? '').trim(),
      }));

      const profile: CatProfileSummary | null = cat
        ? {
            name: cat.name,
            breed: cat.breed,
            age_months: cat.age_months,
            weight_kg: cat.weight_kg,
            sex: cat.sex,
            indoor_outdoor: cat.indoor_outdoor,
            conditions: cat.conditions,
            medications: cat.medications,
          }
        : null;

      // Re-run triage with original concern + image + the new Q/A.
      // No base64 here — we never store the image base64, only its URI.
      // For the rerun we still pass any prior follow-ups plus the new ones.
      const priorAndNew: FollowUpAnswer[] = [...scan.follow_up_qa, ...answered];

      const result = await runTriage({
        userInput: scan.user_input,
        catProfile: profile,
        // Exclude the scan being refined — including it would tell the LLM
        // "here's your previous answer about the same thing" and pollute
        // the differential reasoning.
        recentScansSummary: recentScansSummary(allScans.filter((x) => x.id !== scan.id)),
        mode: scan.mode,
        followUpAnswers: priorAndNew,
      });

      const patch = applyRerunToScan(scan, answered, result);
      updateScan(scan.id, patch);
      router.replace({ pathname: '/result', params: { id: scan.id } });
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.root,
          {
            paddingTop: insets.top + space[4],
            paddingBottom: insets.bottom + space[8],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
          <Question size={22} color={t.primary700} weight="fill" />
          <Text token="caption" color="primary700" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Sharpen the triage
          </Text>
        </View>
        <Text token="heading1">
          {scan.pending_questions.length} quick{' '}
          {scan.pending_questions.length === 1 ? 'question' : 'questions'}
        </Text>
        <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[1] }}>
          Your answers help CatMD narrow the differential. They&apos;ll be saved with the scan.
        </Text>

        <View style={{ marginTop: space[6], gap: space[3] }}>
          {scan.pending_questions.map((q, idx) => (
            <Card key={q.id}>
              <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Question {idx + 1} of {scan.pending_questions.length}
              </Text>
              <Text token="heading3" style={{ marginTop: 2 }}>{q.question}</Text>
              {q.rationale ? (
                <Text token="caption" color="textMuted" style={{ marginTop: space[1] }}>
                  {q.rationale}
                </Text>
              ) : null}

              {q.choices.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] }}>
                  {q.choices.map((choice) => {
                    const selected = answers[q.id] === choice;
                    return (
                      <Pressable
                        key={choice}
                        onPress={() =>
                          setAnswers((a) => ({ ...a, [q.id]: selected ? '' : choice }))
                        }
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={{
                          paddingHorizontal: space[3],
                          paddingVertical: space[2],
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: selected ? t.primary500 : t.borderStrong,
                          backgroundColor: selected ? t.primary100 : t.surfaceElevated,
                        }}
                      >
                        <Text
                          token="body"
                          style={{
                            color: selected ? t.primary700 : t.textPrimary,
                            fontFamily: 'Figtree_500Medium',
                          }}
                        >
                          {choice}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Free-text is always available. If choices are shown, the
                  text field below still lets the owner refine. */}
              <TextInput
                value={
                  q.choices.length > 0 && q.choices.includes(answers[q.id] ?? '')
                    ? ''
                    : answers[q.id] ?? ''
                }
                onChangeText={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                placeholder={
                  q.choices.length > 0
                    ? 'Or type your own answer…'
                    : 'Type your answer…'
                }
                placeholderTextColor={t.textMuted}
                multiline
                style={{
                  marginTop: space[3],
                  minHeight: 44,
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
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
            </Card>
          ))}
        </View>

        {err ? (
          <Text token="caption" style={{ color: t.error, marginTop: space[3] }}>
            {err}
          </Text>
        ) : null}

        <View style={{ marginTop: space[6] }}>
          <Button
            label={submitting ? 'Re-running triage…' : 'Update triage'}
            onPress={onSubmit}
            disabled={submitting || !allAnswered}
            size="lg"
            pill
            fullWidth
            rightIcon={<ArrowRight size={18} color={t.textInverse} weight="bold" />}
          />
          <Text
            token="caption"
            color="textMuted"
            style={{ marginTop: space[2], textAlign: 'center' }}
          >
            This doesn&apos;t count against your monthly scan quota.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
});
