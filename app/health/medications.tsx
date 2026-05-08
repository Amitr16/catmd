/**
 * Medications log.
 *
 * Upgrade over v1: reminders still exist (cat profile), but THIS screen
 * logs actual doses given. Each log entry is a separate event so we can
 * chart adherence over time, count doses remaining, and show the vet a
 * clean administration history.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill, Plus, Trash } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type MedicationDosePayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function Medications() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const list = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e) => e.cat_id === cat.id && e.type === 'medication_dose')
      .sort((a, b) => b.ts.localeCompare(a.ts)) as {
        id: string; ts: string; payload: MedicationDosePayload;
      }[];
  }, [events, cat]);

  // Group by medication name for "how many doses this week" summary
  const perMed = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const map = new Map<string, { total: number; lastAt: string }>();
    for (const e of list) {
      const k = e.payload.medication;
      const prev = map.get(k) ?? { total: 0, lastAt: '' };
      if (new Date(e.ts).getTime() >= weekAgo) prev.total += 1;
      if (!prev.lastAt || e.ts > prev.lastAt) prev.lastAt = e.ts;
      map.set(k, prev);
    }
    return Array.from(map.entries());
  }, [list]);

  const [med, setMed] = useState('');
  const [dose, setDose] = useState('');
  const [notes, setNotes] = useState('');

  if (!cat) return null;

  const logDose = () => {
    if (!med.trim()) return;
    const now = new Date().toISOString();
    addEvent({
      cat_id: cat.id,
      type: 'medication_dose',
      ts: now,
      payload: {
        medication: med.trim(),
        dose_given: dose.trim() || null,
        scheduled: false,
        given_at: now,
        notes: notes.trim() || null,
      },
    });
    setDose('');
    setNotes('');
    // Keep med text so repeat doses are quick
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this dose?', 'This deletes the administration record.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
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
          <Pill size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Medications</Text>
        </View>
        <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
          Log every dose you give {cat.name}. Build a clean history for your vet.
        </Text>

        {/* Quick-log form */}
        <Card style={{ marginTop: space[5] }}>
          <Text token="heading3">Log a dose</Text>
          <Text token="caption" color="textSecondary" style={{ marginTop: space[2], marginBottom: 4 }}>
            Medication
          </Text>
          <TextInput
            value={med}
            onChangeText={setMed}
            placeholder="Methimazole 2.5mg"
            placeholderTextColor={t.textMuted}
            style={styles.input(t)}
          />
          <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
            Dose given (optional)
          </Text>
          <TextInput
            value={dose}
            onChangeText={setDose}
            placeholder="1 tablet / 100 ml / 2 drops"
            placeholderTextColor={t.textMuted}
            style={styles.input(t)}
          />
          <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
            Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Refused first bite, took with churu"
            placeholderTextColor={t.textMuted}
            style={[styles.input(t), { minHeight: 60, textAlignVertical: 'top' }]}
          />
          <Button
            label="Log dose (now)"
            onPress={logDose}
            disabled={!med.trim()}
            leftIcon={<Plus size={18} color={t.textInverse} weight="bold" />}
            style={{ marginTop: space[3] }}
          />
        </Card>

        {/* Weekly summary */}
        {perMed.length > 0 ? (
          <View style={{ marginTop: space[6] }}>
            <Text
              token="caption"
              color="textMuted"
              style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
            >
              This week
            </Text>
            <Card padded={false}>
              {perMed.map(([name, stats], i) => (
                <View key={name}>
                  {i > 0 ? (
                    <View style={{ height: 1, backgroundColor: t.borderSubtle, marginHorizontal: space[4] }} />
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: space[4],
                      paddingVertical: space[3],
                      gap: space[3],
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text token="body" style={{ fontFamily: 'Figtree_500Medium' }}>{name}</Text>
                      <Text token="caption" color="textMuted">
                        Last dose {new Date(stats.lastAt).toLocaleString()}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: space[2],
                        paddingVertical: 4,
                        borderRadius: radius.full,
                        backgroundColor: t.primary100,
                      }}
                    >
                      <Text token="caption" style={{ color: t.primary700 }}>
                        {stats.total} this week
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Full history */}
        <View style={{ marginTop: space[6], gap: space[2] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: 0 }}
          >
            History
          </Text>
          {list.length === 0 ? (
            <Card>
              <Text token="body" color="textSecondary">
                No doses logged yet.
              </Text>
            </Card>
          ) : (
            list.map((d) => (
              <Card key={d.id}>
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text token="body" style={{ fontFamily: 'Figtree_500Medium' }}>
                      {d.payload.medication}
                    </Text>
                    <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                      {new Date(d.ts).toLocaleString()}
                      {d.payload.dose_given ? `  ·  ${d.payload.dose_given}` : ''}
                    </Text>
                    {d.payload.notes ? (
                      <Text token="body" style={{ marginTop: space[1] }}>{d.payload.notes}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => confirmDelete(d.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Trash size={18} color={t.textMuted} />
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  root: { paddingHorizontal: space[5] },
  input: (t: ReturnType<typeof useTheme>) => ({
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surface,
    color: t.textPrimary,
    fontFamily: 'Figtree_400Regular' as const,
    fontSize: 15,
  }),
};
