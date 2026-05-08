/**
 * Outcome check-in — answers the "was the triage advice useful?" question.
 *
 * Reached via:
 *   - the scheduled local notification fired 6–36h after a scan
 *   - the "How is {cat} doing?" banner on /result when reopened later
 *   - a pending-check-in card on the home dashboard
 *
 * Three fast questions. The whole screen is designed to take < 15 seconds
 * so owners actually answer. On 'worse' we offer a one-tap re-scan.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
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
import {
  ArrowClockwise,
  CheckCircle,
  HeartStraight,
  Star,
  XCircle,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import { useCatStore } from '../src/state/catStore';
import { useHealthStore } from '../src/state/healthStore';
import { useScanStore } from '../src/state/scanStore';
import { cancelNotification } from '../src/services/notifications';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

type Direction = 'better' | 'same' | 'worse';
type VetVisited = 'yes' | 'no' | 'plan_to';

export default function OutcomeCheck() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();

  const scan = useScanStore((s) =>
    scanId ? s.scans.find((x) => x.id === scanId) : s.scans[0],
  );
  const updateScan = useScanStore((s) => s.updateScan);
  const cat = useCatStore((s) =>
    scan ? s.cats.find((c) => c.id === scan.cat_id) ?? null : null,
  );
  const addHealthEvent = useHealthStore((s) => s.addEvent);

  const [direction, setDirection] = useState<Direction | null>(null);
  const [vetVisited, setVetVisited] = useState<VetVisited | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const alreadyResponded = !!scan?.outcome_responded;

  const canSave = useMemo(
    () => !alreadyResponded && direction != null && vetVisited != null,
    [alreadyResponded, direction, vetVisited],
  );

  if (!scan) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + space[10] }]}>
        <Text token="heading2">Scan not found</Text>
        <Text token="body" color="textSecondary" style={{ marginTop: space[2], textAlign: 'center' }}>
          It may have been deleted. Open a recent scan from the dashboard instead.
        </Text>
        <Button
          label="Back to dashboard"
          variant="secondary"
          onPress={() => router.replace('/')}
          style={{ marginTop: space[5] }}
        />
      </View>
    );
  }

  const save = () => {
    if (!canSave || !scan || !direction || !vetVisited) return;
    setSaving(true);
    try {
      addHealthEvent({
        cat_id: scan.cat_id,
        type: 'outcome_check',
        payload: {
          scan_id: scan.id,
          direction,
          vet_visited: vetVisited,
          helpful_rating: (stars as 1 | 2 | 3 | 4 | 5 | null) ?? null,
          notes: notes.trim() || null,
          responded_at: new Date().toISOString(),
        },
      });
      void import('../src/services/analytics').then(({ track }) =>
        track({
          type: 'outcome_checkin_answered',
          props: { direction, helpful_rating: stars ?? null },
        }),
      );
      updateScan(scan.id, {
        outcome_responded: true,
        outcome_dismissed_at: new Date().toISOString(),
      });
      if (scan.outcome_notif_id) {
        void cancelNotification(scan.outcome_notif_id).catch(() => {});
      }

      if (direction === 'worse') {
        Alert.alert(
          'Thanks for letting us know',
          `We're sorry ${cat?.name ?? 'your cat'} isn't better. Want to run a fresh scan so we can re-assess?`,
          [
            { text: 'Not now', style: 'cancel', onPress: () => router.replace('/') },
            { text: 'Run a new scan', onPress: () => router.replace('/scan') },
          ],
        );
      } else {
        router.replace('/');
      }
    } finally {
      setSaving(false);
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
          { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <HeartStraight size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Quick check-in</Text>
        </View>
        <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
          How is {cat?.name ?? 'your cat'} doing now, after the triage on{' '}
          {new Date(scan.created_at).toLocaleDateString()}?
        </Text>

        {alreadyResponded ? (
          <Card style={{ marginTop: space[4], backgroundColor: t.surfaceSunken }}>
            <Text token="heading3">Already answered</Text>
            <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
              Thanks — this check-in was already recorded. Open the scan or run a
              new one if anything has changed.
            </Text>
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <Button
                label="Open scan"
                variant="secondary"
                onPress={() => router.replace({ pathname: '/result', params: { id: scan.id } })}
              />
              <Button label="New scan" onPress={() => router.replace('/scan')} />
            </View>
          </Card>
        ) : (
          <>
            {/* Direction */}
            <Card style={{ marginTop: space[4] }}>
              <Text token="heading3">How is {cat?.name ?? 'your cat'}?</Text>
              <View style={styles.pillRow}>
                <OptionPill
                  label="Better"
                  selected={direction === 'better'}
                  onPress={() => setDirection('better')}
                  tone="success"
                />
                <OptionPill
                  label="Same"
                  selected={direction === 'same'}
                  onPress={() => setDirection('same')}
                  tone="neutral"
                />
                <OptionPill
                  label="Worse"
                  selected={direction === 'worse'}
                  onPress={() => setDirection('worse')}
                  tone="danger"
                />
              </View>
            </Card>

            {/* Vet */}
            <Card style={{ marginTop: space[3] }}>
              <Text token="heading3">Did you see a vet?</Text>
              <View style={styles.pillRow}>
                <OptionPill
                  label="Yes"
                  selected={vetVisited === 'yes'}
                  onPress={() => setVetVisited('yes')}
                  tone="neutral"
                />
                <OptionPill
                  label="No"
                  selected={vetVisited === 'no'}
                  onPress={() => setVetVisited('no')}
                  tone="neutral"
                />
                <OptionPill
                  label="Plan to"
                  selected={vetVisited === 'plan_to'}
                  onPress={() => setVetVisited('plan_to')}
                  tone="neutral"
                />
              </View>
            </Card>

            {/* Helpful rating */}
            <Card style={{ marginTop: space[3] }}>
              <Text token="heading3">Was the advice helpful?</Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Optional. Helps us improve the model.
              </Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setStars((v) => (v === n ? null : n))}
                    hitSlop={8}
                    style={styles.starBtn}
                    accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    <Star
                      size={28}
                      color={stars != null && n <= stars ? t.warning : t.textMuted}
                      weight={stars != null && n <= stars ? 'fill' : 'regular'}
                    />
                  </Pressable>
                ))}
              </View>
            </Card>

            {/* Notes */}
            <Card style={{ marginTop: space[3] }}>
              <Text token="heading3">Anything else?</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional — what changed, what worked, what didn't"
                placeholderTextColor={t.textMuted}
                multiline
                style={{
                  marginTop: space[2],
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
            </Card>

            <Button
              label={saving ? 'Saving\u2026' : 'Save check-in'}
              onPress={save}
              disabled={!canSave || saving}
              leftIcon={<CheckCircle size={18} color={t.textInverse} weight="bold" />}
              fullWidth
              style={{ marginTop: space[5] }}
            />
            <Pressable
              onPress={() => router.replace('/')}
              style={{ marginTop: space[3], alignItems: 'center' }}
              hitSlop={8}
            >
              <Text token="caption" color="textMuted">Skip for now</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OptionPill({
  label,
  selected,
  onPress,
  tone,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone: 'success' | 'danger' | 'neutral';
}) {
  const t = useTheme();
  const toneColor =
    tone === 'success' ? t.success : tone === 'danger' ? t.error : t.primary700;
  const bg = selected ? toneColor : t.surface;
  const fg = selected ? t.textInverse : t.textPrimary;
  const border = selected ? toneColor : t.borderStrong;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text token="body" style={{ color: fg, fontFamily: 'Figtree_500Medium' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: space[5],
  },
  pillRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
    flexWrap: 'wrap',
  },
  pill: {
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    gap: space[1],
    marginTop: space[3],
    justifyContent: 'center',
  },
  starBtn: { padding: space[1] },
});
