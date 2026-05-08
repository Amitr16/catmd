/**
 * Appointments — upcoming + past vet visits.
 * Tap an upcoming one to mark it complete and add outcome notes.
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
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { CalendarCheck, Check, Plus, Trash } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type AppointmentPayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function Appointments() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const updateEvent = useHealthStore((s) => s.updateEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const list = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e) => e.cat_id === cat.id && e.type === 'appointment')
      .sort((a, b) => (a.payload as AppointmentPayload).scheduled_for.localeCompare(
        (b.payload as AppointmentPayload).scheduled_for,
      )) as { id: string; payload: AppointmentPayload }[];
  }, [events, cat]);

  const now = Date.now();
  const upcoming = list.filter((a) => !a.payload.completed && new Date(a.payload.scheduled_for).getTime() >= now);
  const past = list
    .filter((a) => a.payload.completed || new Date(a.payload.scheduled_for).getTime() < now)
    .reverse();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [vet, setVet] = useState('');
  const [reason, setReason] = useState('');
  const [scheduledFor, setScheduledFor] = useState(new Date());
  const [picking, setPicking] = useState(false);

  if (!cat) return null;

  const save = () => {
    if (!title.trim()) return;
    addEvent({
      cat_id: cat.id,
      type: 'appointment',
      ts: scheduledFor.toISOString(),
      payload: {
        title: title.trim(),
        scheduled_for: scheduledFor.toISOString(),
        vet: vet.trim() || null,
        reason: reason.trim() || null,
        completed: false,
        outcome_notes: null,
      },
    });
    setTitle('');
    setVet('');
    setReason('');
    setScheduledFor(new Date());
    setAdding(false);
  };

  const markComplete = (id: string) => {
    Alert.prompt?.(
      'Mark complete',
      'Add outcome notes (optional)',
      (text) => {
        updateEvent<'appointment'>(id, {
          completed: true,
          outcome_notes: text?.trim() || null,
        });
      },
      'plain-text',
      '',
    );
    // Android fallback — no Alert.prompt; just mark complete.
    if (Platform.OS === 'android') {
      updateEvent<'appointment'>(id, { completed: true });
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this appointment?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
  };

  const onPickerChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setPicking(false);
    if (event.type === 'set' && d) setScheduledFor(d);
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
          <CalendarCheck size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Appointments</Text>
        </View>

        {/* Upcoming */}
        <View style={{ marginTop: space[4], gap: space[2] }}>
          <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Upcoming ({upcoming.length})
          </Text>
          {upcoming.length === 0 ? (
            <Card><Text token="body" color="textSecondary">No upcoming visits.</Text></Card>
          ) : (
            upcoming.map((a) => (
              <Card key={a.id}>
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text token="heading3">{a.payload.title}</Text>
                    <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                      {new Date(a.payload.scheduled_for).toLocaleString()}
                      {a.payload.vet ? `  ·  ${a.payload.vet}` : ''}
                    </Text>
                    {a.payload.reason ? (
                      <Text token="body" style={{ marginTop: space[1] }}>{a.payload.reason}</Text>
                    ) : null}
                  </View>
                  <View style={{ gap: space[2] }}>
                    <Pressable onPress={() => markComplete(a.id)} hitSlop={8}>
                      <Check size={20} color={t.primary700} />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(a.id)} hitSlop={8}>
                      <Trash size={18} color={t.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Add */}
        {!adding ? (
          <Button
            label="Add appointment"
            variant="secondary"
            onPress={() => setAdding(true)}
            leftIcon={<Plus size={18} color={t.textPrimary} />}
            style={{ marginTop: space[4] }}
          />
        ) : (
          <Card style={{ marginTop: space[4] }}>
            <Text token="heading3">New appointment</Text>

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Title
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Annual check-up"
              placeholderTextColor={t.textMuted}
              style={styles.input(t)}
            />

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Date + time
            </Text>
            <Pressable
              onPress={() => setPicking(true)}
              style={styles.pseudoInput(t)}
            >
              <Text token="body">{scheduledFor.toLocaleString()}</Text>
            </Pressable>
            {picking && (
              <DateTimePicker
                value={scheduledFor}
                mode="datetime"
                onChange={onPickerChange}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Vet / clinic (optional)
            </Text>
            <TextInput
              value={vet}
              onChangeText={setVet}
              placeholder="Dr. Smith"
              placeholderTextColor={t.textMuted}
              style={styles.input(t)}
            />

            <Text token="caption" color="textSecondary" style={{ marginTop: space[3], marginBottom: 4 }}>
              Reason (optional)
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              placeholder="Follow-up bloodwork"
              placeholderTextColor={t.textMuted}
              style={[styles.input(t), { minHeight: 60, textAlignVertical: 'top' }]}
            />

            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <Button label="Cancel" variant="ghost" onPress={() => setAdding(false)} />
              <Button label="Save" onPress={save} disabled={!title.trim()} />
            </View>
          </Card>
        )}

        {/* Past */}
        {past.length > 0 ? (
          <View style={{ marginTop: space[6], gap: space[2] }}>
            <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Past ({past.length})
            </Text>
            {past.map((a) => (
              <Card key={a.id}>
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text token="body" style={{ fontFamily: 'Figtree_500Medium' }}>{a.payload.title}</Text>
                    <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                      {new Date(a.payload.scheduled_for).toLocaleString()}
                      {a.payload.vet ? `  ·  ${a.payload.vet}` : ''}
                    </Text>
                    {a.payload.outcome_notes ? (
                      <Text token="body" style={{ marginTop: space[1] }}>{a.payload.outcome_notes}</Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => confirmDelete(a.id)} hitSlop={8}>
                    <Trash size={18} color={t.textMuted} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
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
  pseudoInput: (t: ReturnType<typeof useTheme>) => ({
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surface,
    justifyContent: 'center' as const,
  }),
};
