/**
 * Weight tracker — add measurement, see chart, track BCS (1-9).
 *
 * BCS scale (WSAVA standard):
 *   1-3 underweight, 4-5 ideal, 6-9 overweight
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
import { Plus, Scales, Trash } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type WeightPayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const BCS_LABELS = [
  null, '1 emaciated', '2 very thin', '3 thin', '4 underweight',
  '5 ideal', '6 overweight', '7 heavy', '8 obese', '9 severely obese',
];

export default function Weight() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const list = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e) => e.cat_id === cat.id && e.type === 'weight')
      .sort((a, b) => a.ts.localeCompare(b.ts)) as {
        id: string; ts: string; payload: WeightPayload;
      }[];
  }, [events, cat]);

  const chartData = useMemo(
    () => list.map((e) => ({ x: new Date(e.ts).getTime(), y: e.payload.weight_kg })),
    [list],
  );

  const [weightStr, setWeightStr] = useState('');
  const [bcs, setBcs] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  if (!cat) return null;

  const save = () => {
    const w = parseFloat(weightStr);
    if (!Number.isFinite(w) || w <= 0) return;
    const now = new Date().toISOString();
    addEvent({
      cat_id: cat.id,
      type: 'weight',
      ts: now,
      payload: {
        weight_kg: Math.round(w * 100) / 100,
        bcs,
        measured_at: now,
        notes: notes.trim() || null,
      },
    });
    setWeightStr('');
    setBcs(null);
    setNotes('');
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this weight entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
  };

  const latest = list[list.length - 1];
  const firstInRange = list[Math.max(0, list.length - 12)];
  const delta =
    latest && firstInRange && latest.id !== firstInRange.id
      ? latest.payload.weight_kg - firstInRange.payload.weight_kg
      : 0;

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
          <Scales size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Weight</Text>
        </View>

        {latest ? (
          <Card style={{ marginTop: space[4] }}>
            <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Latest
            </Text>
            <Text token="displayLg">{latest.payload.weight_kg} kg</Text>
            <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
              {new Date(latest.ts).toLocaleDateString()}
              {latest.payload.bcs ? `  ·  BCS ${latest.payload.bcs}/9` : ''}
              {delta !== 0 ? `  ·  ${delta > 0 ? '+' : ''}${delta.toFixed(2)} kg vs earlier` : ''}
            </Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: space[4] }}>
          <Text token="heading3" style={{ marginBottom: space[3] }}>Trend</Text>
          <LineChart
            data={chartData}
            width={340}
            height={180}
            yUnit="kg"
            emptyHint="Log your first weight to see the trend."
          />
        </Card>

        {/* Add form */}
        <Card style={{ marginTop: space[5] }}>
          <Text token="heading3">Add weight</Text>
          <Text token="caption" color="textSecondary" style={{ marginTop: space[2], marginBottom: 4 }}>
            Weight (kg)
          </Text>
          <TextInput
            value={weightStr}
            onChangeText={setWeightStr}
            keyboardType="decimal-pad"
            placeholder="4.2"
            placeholderTextColor={t.textMuted}
            style={styles.input(t)}
          />
          <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
            Body Condition Score (optional)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const selected = bcs === n;
              const tone =
                n <= 3 ? t.warning : n <= 5 ? t.primary700 : n <= 7 ? t.warning : t.error;
              return (
                <Pressable
                  key={n}
                  onPress={() => setBcs(selected ? null : n)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: selected ? tone : t.borderStrong,
                    backgroundColor: selected ? t.primary100 : t.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text token="body" style={{ color: selected ? tone : t.textPrimary, fontFamily: 'Figtree_500Medium' }}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {bcs ? (
            <Text token="caption" color="textMuted" style={{ marginTop: space[1] }}>
              {BCS_LABELS[bcs]}
            </Text>
          ) : null}

          <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
            Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Post-grooming, or at vet"
            placeholderTextColor={t.textMuted}
            style={[styles.input(t), { minHeight: 60, textAlignVertical: 'top' }]}
          />
          <Button
            label="Save weight"
            onPress={save}
            disabled={!weightStr.trim()}
            leftIcon={<Plus size={18} color={t.textInverse} weight="bold" />}
            style={{ marginTop: space[3] }}
          />
        </Card>

        {/* History */}
        <View style={{ marginTop: space[6], gap: space[2] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1 }}
          >
            History ({list.length})
          </Text>
          {[...list].reverse().map((w) => (
            <Card key={w.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View style={{ flex: 1 }}>
                  <Text token="body" style={{ fontFamily: 'Figtree_500Medium' }}>
                    {w.payload.weight_kg} kg
                    {w.payload.bcs ? `  ·  BCS ${w.payload.bcs}/9` : ''}
                  </Text>
                  <Text token="caption" color="textMuted">
                    {new Date(w.ts).toLocaleString()}
                  </Text>
                  {w.payload.notes ? (
                    <Text token="body" style={{ marginTop: space[1] }}>{w.payload.notes}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => confirmDelete(w.id)} hitSlop={8}>
                  <Trash size={18} color={t.textMuted} />
                </Pressable>
              </View>
            </Card>
          ))}
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
