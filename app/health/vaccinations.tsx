/**
 * Vaccinations — list + add + due reminders.
 *
 * Presets: FVRCP (core), Rabies, FeLV (for outdoor / multi-cat), the
 * AAFP-standard schedule. Users can add anything custom too.
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Plus, Syringe, Trash } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type VaccinationPayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

// AAFP core + lifestyle vaccine presets. "every_months" is the typical
// booster cadence — owner can override when scheduling.
const PRESETS = [
  { vaccine: 'FVRCP (core)', every_months: 12 },
  { vaccine: 'Rabies', every_months: 12 },
  { vaccine: 'FeLV (outdoor / multi-cat)', every_months: 12 },
  { vaccine: 'Bordetella', every_months: 12 },
  { vaccine: 'FIV', every_months: 12 },
  { vaccine: 'Chlamydia felis', every_months: 12 },
];

type Form = {
  vaccine: string;
  given_on: Date;
  next_due: Date | null;
  administered_by: string;
  batch_no: string;
  notes: string;
};

const emptyForm = (): Form => ({
  vaccine: '',
  given_on: new Date(),
  next_due: null,
  administered_by: '',
  batch_no: '',
  notes: '',
});

export default function Vaccinations() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const list = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e) => e.cat_id === cat.id && e.type === 'vaccination')
      .sort((a, b) => b.ts.localeCompare(a.ts)) as {
        id: string;
        ts: string;
        payload: VaccinationPayload;
      }[];
  }, [events, cat]);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [pickingGivenOn, setPickingGivenOn] = useState(false);
  const [pickingNextDue, setPickingNextDue] = useState(false);

  if (!cat) return null;

  const choosePreset = (preset: (typeof PRESETS)[number]) => {
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + preset.every_months);
    setForm({
      vaccine: preset.vaccine,
      given_on: new Date(),
      next_due: nextDue,
      administered_by: '',
      batch_no: '',
      notes: '',
    });
    setAdding(true);
  };

  const save = () => {
    if (!form.vaccine.trim()) return;
    addEvent({
      cat_id: cat.id,
      type: 'vaccination',
      ts: form.given_on.toISOString(),
      payload: {
        vaccine: form.vaccine.trim(),
        given_on: form.given_on.toISOString(),
        next_due: form.next_due ? form.next_due.toISOString() : null,
        administered_by: form.administered_by.trim() || null,
        batch_no: form.batch_no.trim() || null,
        notes: form.notes.trim() || null,
      },
    });
    setForm(emptyForm());
    setAdding(false);
  };

  const confirmDelete = (id: string, vaccine: string) => {
    Alert.alert(
      `Remove ${vaccine}?`,
      'This deletes the vaccination record from your local history and the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
      ],
    );
  };

  const onGivenOnChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setPickingGivenOn(false);
    if (event.type === 'set' && d) setForm((f) => ({ ...f, given_on: d }));
  };
  const onNextDueChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setPickingNextDue(false);
    if (event.type === 'set' && d) setForm((f) => ({ ...f, next_due: d }));
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
          <Syringe size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Vaccinations</Text>
        </View>
        <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
          AAFP core: kittens get FVRCP at 6–8 wk, 10–12 wk, 14–16 wk, then 1 yr,
          then every 3 yr. Rabies varies by state. Your vet knows the exact schedule.
        </Text>

        {/* Upcoming alerts */}
        {list.some((v) => v.payload.next_due && new Date(v.payload.next_due).getTime() < Date.now() + 30 * 86_400_000) && (
          <Card style={{ marginTop: space[4], borderLeftWidth: 3, borderLeftColor: t.warning }}>
            <Text token="heading3" style={{ color: t.warning }}>
              Due within 30 days
            </Text>
            {list
              .filter((v) => v.payload.next_due && new Date(v.payload.next_due).getTime() < Date.now() + 30 * 86_400_000 && new Date(v.payload.next_due).getTime() > Date.now() - 86_400_000)
              .map((v) => (
                <Text key={v.id} token="body" style={{ marginTop: 4 }}>
                  {v.payload.vaccine} — {new Date(v.payload.next_due!).toLocaleDateString()}
                </Text>
              ))}
          </Card>
        )}

        {/* List */}
        <View style={{ marginTop: space[5], gap: space[2] }}>
          {list.map((v) => (
            <Card key={v.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                <View style={{ flex: 1 }}>
                  <Text token="heading3">{v.payload.vaccine}</Text>
                  <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                    Given {new Date(v.payload.given_on).toLocaleDateString()}
                    {v.payload.next_due ? `  ·  Next due ${new Date(v.payload.next_due).toLocaleDateString()}` : ''}
                  </Text>
                  {v.payload.administered_by ? (
                    <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                      by {v.payload.administered_by}
                    </Text>
                  ) : null}
                  {v.payload.notes ? (
                    <Text token="body" style={{ marginTop: space[2] }}>
                      {v.payload.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => confirmDelete(v.id, v.payload.vaccine)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${v.payload.vaccine} record`}
                >
                  <Trash size={18} color={t.textMuted} />
                </Pressable>
              </View>
            </Card>
          ))}
          {list.length === 0 ? (
            <Card>
              <Text token="body" color="textSecondary">
                No vaccinations logged yet. Pick from the presets below, or add custom.
              </Text>
            </Card>
          ) : null}
        </View>

        {/* Presets */}
        {!adding ? (
          <View style={{ marginTop: space[6] }}>
            <Text
              token="caption"
              color="textMuted"
              style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
            >
              Quick add
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.vaccine}
                  onPress={() => choosePreset(p)}
                  style={{
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: t.borderStrong,
                    backgroundColor: t.surfaceElevated,
                  }}
                >
                  <Text token="body" style={{ color: t.textPrimary }}>{p.vaccine}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              label="Add custom vaccination"
              variant="secondary"
              onPress={() => { setForm(emptyForm()); setAdding(true); }}
              leftIcon={<Plus size={18} color={t.textPrimary} />}
              style={{ marginTop: space[3] }}
            />
          </View>
        ) : null}

        {/* Add form */}
        {adding ? (
          <Card style={{ marginTop: space[6] }}>
            <Text token="heading3">New vaccination</Text>

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Vaccine
            </Text>
            <TextInput
              value={form.vaccine}
              onChangeText={(v) => setForm((f) => ({ ...f, vaccine: v }))}
              placeholder="e.g. FVRCP"
              placeholderTextColor={t.textMuted}
              style={{
                height: 44,
                paddingHorizontal: space[3],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                color: t.textPrimary,
                fontFamily: 'Figtree_400Regular',
                fontSize: 15,
              }}
            />

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Given on
            </Text>
            <Pressable
              onPress={() => setPickingGivenOn(true)}
              style={{
                height: 44,
                paddingHorizontal: space[3],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                justifyContent: 'center',
              }}
            >
              <Text token="body">{form.given_on.toLocaleDateString()}</Text>
            </Pressable>
            {pickingGivenOn && (
              <DateTimePicker
                value={form.given_on}
                mode="date"
                maximumDate={new Date()}
                onChange={onGivenOnChange}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Next due (optional)
            </Text>
            <Pressable
              onPress={() => setPickingNextDue(true)}
              style={{
                height: 44,
                paddingHorizontal: space[3],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                justifyContent: 'center',
              }}
            >
              <Text token="body" color={form.next_due ? 'textPrimary' : 'textMuted'}>
                {form.next_due ? form.next_due.toLocaleDateString() : 'Tap to set'}
              </Text>
            </Pressable>
            {pickingNextDue && (
              <DateTimePicker
                value={form.next_due ?? new Date()}
                mode="date"
                onChange={onNextDueChange}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Vet / clinic (optional)
            </Text>
            <TextInput
              value={form.administered_by}
              onChangeText={(v) => setForm((f) => ({ ...f, administered_by: v }))}
              placeholder="Dr. Smith, Friendly Paws Clinic"
              placeholderTextColor={t.textMuted}
              style={{
                height: 44,
                paddingHorizontal: space[3],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                color: t.textPrimary,
                fontFamily: 'Figtree_400Regular',
                fontSize: 15,
              }}
            />

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Notes (reactions, lot number, etc.)
            </Text>
            <TextInput
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
              multiline
              style={{
                minHeight: 60,
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

            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[4] }}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => { setAdding(false); setForm(emptyForm()); }}
              />
              <Button label="Save" onPress={save} disabled={!form.vaccine.trim()} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
});
