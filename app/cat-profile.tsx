/**
 * Cat profile editor — rich v1.
 *
 * Sections:
 *  - Hero: photo + name + DOB picker + sex + spayed/neutered
 *  - Basics: breed, weight, lifestyle
 *  - Medical history: conditions (tags), medications (tags)
 *  - Notes: free text
 *  - Danger zone: delete this cat
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  Bell,
  Camera,
  Cat as CatIcon,
  Image as ImageIcon,
  Plus,
  Trash,
  X,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import {
  useCatStore,
  ageMonthsFromDob,
  type Lifestyle,
  type Sex,
} from '../src/state/catStore';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useNotificationStore } from '../src/state/notificationStore';
import { useNotifPrefsStore } from '../src/state/notifPrefsStore';
import {
  setBirthdayReminder,
  setAdoptionIversaryReminder,
  setWeeklyReadNudge,
  cancelNotification,
} from '../src/services/notifications';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function CatProfileScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const cat = useActiveCat();
  const patchCat = useCatStore((s) => s.patchCat);
  const deleteCat = useCatStore((s) => s.deleteCat);
  const catCount = useCatStore((s) => s.cats.length);
  const reminders = useNotificationStore((s) => (cat ? s.byCat[cat.id] : null)) ?? null;
  const setMedReminder = useNotificationStore((s) => s.setMedReminder);
  const setCheckinReminder = useNotificationStore((s) => s.setCheckinReminder);
  const clearReminders = useNotificationStore((s) => s.clearForCat);

  // Local form state — we patch on blur / button press, not every keystroke,
  // to avoid thrashing the Supabase sync and the rest of the app.
  const [name, setName] = useState(cat?.name ?? '');
  const [breed, setBreed] = useState(cat?.breed ?? '');
  const [weightKg, setWeightKg] = useState(cat?.weight_kg?.toString() ?? '');
  const [sex, setSex] = useState<Sex>(cat?.sex ?? 'unknown');
  const [spayed, setSpayed] = useState<boolean | null>(cat?.spayed_neutered ?? null);
  const [lifestyle, setLifestyle] = useState<Lifestyle>(cat?.indoor_outdoor ?? 'indoor');
  const [conditions, setConditions] = useState<string[]>(cat?.conditions ?? []);
  const [medications, setMedications] = useState<string[]>(cat?.medications ?? []);
  const [notes, setNotes] = useState(cat?.notes ?? '');
  const [dob, setDob] = useState<Date | null>(cat?.dob_iso ? new Date(cat.dob_iso) : null);
  const [adoptedOn, setAdoptedOn] = useState<Date | null>(
    cat?.adopted_on_iso ? new Date(cat.adopted_on_iso) : null,
  );
  const [showAdoptedDatePicker, setShowAdoptedDatePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [emergencyVetName, setEmergencyVetName] = useState(cat?.emergency_vet_name ?? '');
  const [emergencyVetPhone, setEmergencyVetPhone] = useState(cat?.emergency_vet_phone ?? '');

  // Reminder UI state (separate from profile form — saved immediately, not on Save)
  const [medTimePickerVisible, setMedTimePickerVisible] = useState(false);
  const [checkinTimePickerVisible, setCheckinTimePickerVisible] = useState(false);

  const derivedAge = useMemo(
    () => ageMonthsFromDob(dob ? dob.toISOString() : null),
    [dob],
  );

  if (!cat) {
    return (
      <View style={{ flex: 1, padding: space[5], justifyContent: 'center' }}>
        <Text token="heading2">No active cat</Text>
        <Button
          label="Back"
          onPress={() => router.replace('/cats')}
          style={{ marginTop: space[4] }}
        />
      </View>
    );
  }

  const pickPhoto = async (source: 'camera' | 'library') => {
    // No native crop step — the avatar renders in a circle with
    // resizeMode="cover", so center-framing happens automatically on
    // whatever the owner captures.
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!r.canceled && r.assets[0])
        patchCat(cat.id, { photo_uri: r.assets[0].uri });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!r.canceled && r.assets[0])
        patchCat(cat.id, { photo_uri: r.assets[0].uri });
    }
  };

  const save = () => {
    patchCat(cat.id, {
      name: name.trim() || 'Cat',
      breed: breed.trim() || null,
      weight_kg:
        weightKg.trim() && Number.isFinite(parseFloat(weightKg))
          ? parseFloat(weightKg)
          : null,
      sex,
      spayed_neutered: spayed,
      indoor_outdoor: lifestyle,
      conditions,
      medications,
      notes: notes.trim() || null,
      dob_iso: dob ? dob.toISOString().slice(0, 10) : null,
      age_months: derivedAge,
      adopted_on_iso: adoptedOn ? adoptedOn.toISOString().slice(0, 10) : null,
      emergency_vet_name: emergencyVetName.trim() || null,
      emergency_vet_phone: emergencyVetPhone.trim() || null,
    });

    // If a daily-med reminder is scheduled, the notification body embeds
    // the medication list at schedule time — so it goes stale when the
    // owner adds/removes meds. Reschedule with the current list.
    if (reminders?.med_time) {
      void setMedReminder(cat.id, reminders.med_time, {
        catName: name.trim() || 'Cat',
        meds: medications,
      }).catch(() => {});
    }

    // Birthday + adoption-iversary annual reminders. Cancel the previous
    // scheduled id (if any) and reschedule based on current dates. If the
    // user clears the date OR disables the category in notif prefs, this
    // ends up just cancelling without rescheduling — exactly what we want.
    void (async () => {
      const notifPrefs = useNotifPrefsStore.getState();
      const catName = name.trim() || 'Cat';

      // Birthday
      const oldBirthdayId = notifPrefs.getScheduledId(cat.id, 'birthday');
      await cancelNotification(oldBirthdayId);
      if (dob && notifPrefs.enabled.birthday) {
        const newId = await setBirthdayReminder({
          catName,
          dobIso: dob.toISOString().slice(0, 10),
          catId: cat.id,
        });
        notifPrefs.setScheduledId(cat.id, 'birthday', newId);
      } else {
        notifPrefs.setScheduledId(cat.id, 'birthday', null);
      }

      // Adoption-iversary
      const oldAdoptionId = notifPrefs.getScheduledId(cat.id, 'adoption_iversary');
      await cancelNotification(oldAdoptionId);
      if (adoptedOn && notifPrefs.enabled.adoption_iversary) {
        const newId = await setAdoptionIversaryReminder({
          catName,
          adoptedOnIso: adoptedOn.toISOString().slice(0, 10),
          catId: cat.id,
        });
        notifPrefs.setScheduledId(cat.id, 'adoption_iversary', newId);
      } else {
        notifPrefs.setScheduledId(cat.id, 'adoption_iversary', null);
      }

      // Weekly Read [cat] nudge — only schedule an *initial* one if the
      // category is enabled AND we don't already have one in flight. The
      // healthStore re-arms this on every behaviour observation, so we
      // don't want to clobber an active one here.
      if (notifPrefs.enabled.weekly_read_nudge) {
        const existing = notifPrefs.getScheduledId(cat.id, 'weekly_read_nudge');
        if (!existing) {
          const newId = await setWeeklyReadNudge({ catName, catId: cat.id });
          notifPrefs.setScheduledId(cat.id, 'weekly_read_nudge', newId);
        }
      }
    })().catch((e) => console.warn('[CatMD] annual-reminder schedule:', e));

    router.back();
  };

  const onDelete = () => {
    if (catCount === 1) {
      Alert.alert(
        'Keep at least one cat',
        'CatMD needs an active cat. Add another first, then delete this one.',
      );
      return;
    }
    Alert.alert(
      `Remove ${cat.name}?`,
      'All scans and history for this cat will be deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearReminders(cat.id);
            deleteCat(cat.id);
            router.replace('/cats');
          },
        },
      ],
    );
  };

  /**
   * Quiet-hours guard for user-set recurring reminders.
   *
   * Our public promise (Settings screen + onboarding) is "no pushes
   * 22:00-08:00." For one-shot pushes that promise is enforced silently
   * inside notifications.ts (shiftOutOfQuietHours). For *recurring*
   * reminders the user pasted into the picker themselves, silently moving
   * the time would be confusing — the saved time wouldn't match what
   * they see on screen. So we warn and offer to clamp, but allow override
   * because some legitimate cases exist (e.g. 6:30am thyroid medication).
   *
   * Returns the hour-minute string the caller should use, OR null if the
   * user cancelled the dialog (caller should abort).
   */
  const confirmQuietHoursTime = (
    pickedHHMM: string,
    onResolve: (hhmm: string) => void,
  ) => {
    const [h] = pickedHHMM.split(':').map(Number);
    const inQuiet = h >= 22 || h < 8;
    if (!inQuiet) {
      onResolve(pickedHHMM);
      return;
    }
    Alert.alert(
      'Reminder is inside quiet hours',
      `You picked ${pickedHHMM}. CatMD's quiet-hours rule normally blocks pushes between 22:00 and 08:00 to protect your sleep. Move to 08:00, or keep this time anyway?`,
      [
        {
          text: 'Move to 08:00',
          onPress: () => onResolve('08:00'),
        },
        {
          text: 'Keep anyway',
          style: 'destructive',
          onPress: () => onResolve(pickedHHMM),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const onMedTimeChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setMedTimePickerVisible(false);
    if (event.type === 'set' && d && cat) {
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const catId = cat.id;
      const catName = cat.name;
      confirmQuietHoursTime(hhmm, (finalHHMM) => {
        void setMedReminder(catId, finalHHMM, { catName, meds: medications });
      });
    }
  };

  const onCheckinTimeChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setCheckinTimePickerVisible(false);
    if (event.type === 'set' && d && cat) {
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      // Expo weekday: 1=Sunday, 7=Saturday. JS getDay(): 0=Sunday, 6=Saturday.
      const weekday = d.getDay() + 1;
      const catId = cat.id;
      const catName = cat.name;
      confirmQuietHoursTime(hhmm, (finalHHMM) => {
        void setCheckinReminder(catId, weekday, finalHHMM, { catName });
      });
    }
  };

  const turnOffMed = () => {
    if (cat) void setMedReminder(cat.id, null, { catName: cat.name, meds: medications });
  };
  const turnOffCheckin = () => {
    if (cat) void setCheckinReminder(cat.id, null, null, { catName: cat.name });
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && date) setDob(date);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingBottom: insets.bottom + space[10] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero photo */}
        <View style={styles.photoHero}>
          <PhotoAvatar uri={cat.photo_uri} />
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
            <Button
              label="Take photo"
              variant="secondary"
              size="sm"
              onPress={() => pickPhoto('camera')}
              leftIcon={<Camera size={16} color={t.textPrimary} />}
            />
            <Button
              label="From gallery"
              variant="secondary"
              size="sm"
              onPress={() => pickPhoto('library')}
              leftIcon={<ImageIcon size={16} color={t.textPrimary} />}
            />
            {cat.photo_uri ? (
              <Button
                label="Remove"
                variant="ghost"
                size="sm"
                onPress={() => patchCat(cat.id, { photo_uri: null })}
              />
            ) : null}
          </View>
        </View>

        <Section title="Basics">
          <Field label="Name">
            <StandardInput value={name} onChangeText={setName} />
          </Field>

          <Field label="Date of birth">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select date of birth"
              style={{
                height: 48,
                paddingHorizontal: space[4],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surfaceElevated,
                justifyContent: 'center',
              }}
            >
              <Text token="body" color={dob ? 'textPrimary' : 'textMuted'}>
                {dob ? dob.toLocaleDateString() : 'Tap to choose'}
                {derivedAge != null && dob
                  ? `  ·  ${
                      derivedAge < 12
                        ? `${derivedAge} mo`
                        : `${(derivedAge / 12).toFixed(1)} yr`
                    }`
                  : ''}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={dob ?? new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)}
                mode="date"
                maximumDate={new Date()}
                minimumDate={new Date(1995, 0, 1)}
                onChange={onDateChange}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}
          </Field>

          <Field label="Adopted on (optional — for adoption-iversary reminders)">
            <Pressable
              onPress={() => setShowAdoptedDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select adoption date"
              style={{
                height: 48,
                paddingHorizontal: space[4],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surfaceElevated,
                justifyContent: 'center',
              }}
            >
              <Text token="body" color={adoptedOn ? 'textPrimary' : 'textMuted'}>
                {adoptedOn ? adoptedOn.toLocaleDateString() : 'Tap to choose'}
              </Text>
            </Pressable>
            {showAdoptedDatePicker && (
              <DateTimePicker
                value={adoptedOn ?? new Date()}
                mode="date"
                maximumDate={new Date()}
                minimumDate={new Date(1995, 0, 1)}
                onChange={(event, date) => {
                  if (Platform.OS === 'android') setShowAdoptedDatePicker(false);
                  if (event.type === 'set' && date) setAdoptedOn(date);
                }}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}
          </Field>

          <Field label="Breed (optional)">
            <StandardInput
              value={breed}
              onChangeText={setBreed}
              placeholder="e.g. Maine Coon"
            />
          </Field>

          <Field label="Weight (kg, optional)">
            <StandardInput
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="e.g. 4.2"
              keyboardType="decimal-pad"
            />
          </Field>

          <Field label="Sex">
            <ChoiceRow
              choices={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
                { value: 'unknown', label: 'Unknown' },
              ]}
              value={sex}
              onChange={setSex}
            />
          </Field>

          <Field label="Spayed / neutered?">
            <ChoiceRow
              choices={[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
                { value: null, label: 'Unsure' },
              ]}
              value={spayed}
              onChange={setSpayed}
            />
          </Field>

          <Field label="Lifestyle">
            <ChoiceRow
              choices={[
                { value: 'indoor', label: 'Indoor' },
                { value: 'outdoor', label: 'Outdoor' },
                { value: 'both', label: 'Both' },
              ]}
              value={lifestyle}
              onChange={setLifestyle}
            />
          </Field>
        </Section>

        <Section title="Medical history">
          <Text token="caption" color="textMuted" style={{ marginBottom: space[2] }}>
            Adding known diagnoses, chronic conditions, and current medications lets CatMD tailor every triage. All local to your device.
          </Text>
          <TagEditor
            label="Known conditions"
            tags={conditions}
            onChange={setConditions}
            placeholder="e.g. CKD, hyperthyroid, FLUTD…"
          />
          <TagEditor
            label="Current medications"
            tags={medications}
            onChange={setMedications}
            placeholder="e.g. methimazole 2.5mg BID…"
          />
        </Section>

        <Section title="Notes">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Anything CatMD should know — behavioral quirks, triggers, recent vet visits…"
            placeholderTextColor={t.textMuted}
            style={{
              minHeight: 100,
              padding: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.borderStrong,
              backgroundColor: t.surfaceElevated,
              color: t.textPrimary,
              fontFamily: 'Figtree_400Regular',
              fontSize: 16,
              lineHeight: 22,
              textAlignVertical: 'top',
            }}
          />
        </Section>

        <Section title="Emergency vet">
          <Text token="caption" color="textMuted" style={{ marginBottom: space[2] }}>
            One-tap dialing from urgent triage. Stays on this device.
          </Text>
          <TextInput
            value={emergencyVetName}
            onChangeText={setEmergencyVetName}
            placeholder="Clinic name (e.g. Brookhaven Animal ER)"
            placeholderTextColor={t.textMuted}
            style={{
              height: 48,
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.borderStrong,
              backgroundColor: t.surfaceElevated,
              color: t.textPrimary,
              fontFamily: 'Figtree_400Regular',
              fontSize: 16,
            }}
          />
          <TextInput
            value={emergencyVetPhone}
            onChangeText={setEmergencyVetPhone}
            placeholder="Phone (+1 555 123 4567)"
            placeholderTextColor={t.textMuted}
            keyboardType="phone-pad"
            style={{
              marginTop: space[2],
              height: 48,
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.borderStrong,
              backgroundColor: t.surfaceElevated,
              color: t.textPrimary,
              fontFamily: 'Figtree_400Regular',
              fontSize: 16,
            }}
          />
        </Section>

        <Section title="Reminders">
          <Text token="caption" color="textMuted" style={{ marginBottom: space[2] }}>
            Local phone notifications. Data stays on your device.
          </Text>

          {/* Daily meds */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <Bell size={22} color={t.primary700} />
              <View style={{ flex: 1 }}>
                <Text token="heading3">Daily medication reminder</Text>
                <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                  {reminders?.med_time
                    ? `Every day at ${reminders.med_time}. ${medications.length > 0 ? `Reminds about: ${medications.slice(0, 3).join(', ')}` : 'Add medications above for personalised reminders.'}`
                    : 'Pick a time to get a daily reminder to dose.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
                  <Button
                    label={reminders?.med_time ? 'Change time' : 'Set time'}
                    variant="secondary"
                    size="sm"
                    onPress={() => setMedTimePickerVisible(true)}
                  />
                  {reminders?.med_time ? (
                    <Button label="Turn off" variant="ghost" size="sm" onPress={turnOffMed} />
                  ) : null}
                </View>
              </View>
            </View>
          </Card>

          {/* Weekly check-in */}
          <Card style={{ marginTop: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <Bell size={22} color={t.primary700} />
              <View style={{ flex: 1 }}>
                <Text token="heading3">Weekly check-in</Text>
                <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                  {reminders?.checkin_time && reminders?.checkin_weekday
                    ? `Every ${weekdayLabel(reminders.checkin_weekday)} at ${reminders.checkin_time}.`
                    : 'A weekly nudge to scan — catches subtle changes early.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
                  <Button
                    label={reminders?.checkin_time ? 'Change day + time' : 'Schedule'}
                    variant="secondary"
                    size="sm"
                    onPress={() => setCheckinTimePickerVisible(true)}
                  />
                  {reminders?.checkin_time ? (
                    <Button label="Turn off" variant="ghost" size="sm" onPress={turnOffCheckin} />
                  ) : null}
                </View>
              </View>
            </View>
          </Card>

          {medTimePickerVisible && (
            <DateTimePicker
              value={(() => {
                const [h, m] = (reminders?.med_time ?? '08:00').split(':').map(Number);
                const d = new Date();
                d.setHours(h ?? 8, m ?? 0, 0, 0);
                return d;
              })()}
              mode="time"
              onChange={onMedTimeChange}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          )}
          {checkinTimePickerVisible && (
            <DateTimePicker
              value={(() => {
                const [h, m] = (reminders?.checkin_time ?? '09:00').split(':').map(Number);
                const d = new Date();
                // Use today's weekday as default; user re-taps on the day they want
                d.setHours(h ?? 9, m ?? 0, 0, 0);
                return d;
              })()}
              mode="time"
              onChange={onCheckinTimeChange}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          )}
        </Section>

        <View style={{ marginTop: space[8] }}>
          <Button label="Save" onPress={save} size="lg" pill fullWidth />
        </View>

        <View style={{ marginTop: space[10] }}>
          <Button
            label="Delete this cat"
            variant="ghost"
            fullWidth
            onPress={onDelete}
            leftIcon={<Trash size={16} color={t.error} />}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekdayLabel(w: number): string {
  // Expo weekday 1=Sunday … 7=Saturday
  return WEEKDAY_LABELS[Math.max(0, Math.min(6, w - 1))] ?? 'day';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[6] }}>
      <Text
        token="caption"
        color="textMuted"
        style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[3] }}>
      <Text token="caption" color="textSecondary" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function StandardInput(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  const t = useTheme();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={t.textMuted}
      keyboardType={props.keyboardType ?? 'default'}
      style={{
        height: 48,
        paddingHorizontal: space[4],
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: t.borderStrong,
        backgroundColor: t.surfaceElevated,
        color: t.textPrimary,
        fontFamily: 'Figtree_400Regular',
        fontSize: 16,
      }}
    />
  );
}

function ChoiceRow<T>({
  choices,
  value,
  onChange,
}: {
  choices: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
      {choices.map((c) => {
        const selected = c.value === value;
        return (
          <Pressable
            key={String(c.value)}
            onPress={() => onChange(c.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              paddingHorizontal: space[4],
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
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TagEditor({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const v = draft.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...tags, v]);
    setDraft('');
  };

  const removeTag = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <View style={{ marginTop: space[3] }}>
      <Text token="caption" color="textSecondary" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[2] }}>
          {tags.map((tag) => (
            <View
              key={tag}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[1],
                paddingLeft: space[3],
                paddingRight: space[2],
                paddingVertical: space[1],
                borderRadius: radius.full,
                backgroundColor: t.primary100,
              }}
            >
              <Text token="caption" style={{ color: t.primary700 }}>{tag}</Text>
              <Pressable
                onPress={() => removeTag(tag)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${tag}`}
                hitSlop={6}
              >
                <X size={12} color={t.primary700} weight="bold" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addTag}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={t.textMuted}
          style={{
            flex: 1,
            height: 44,
            paddingHorizontal: space[4],
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: t.borderStrong,
            backgroundColor: t.surfaceElevated,
            color: t.textPrimary,
            fontFamily: 'Figtree_400Regular',
            fontSize: 15,
          }}
        />
        <Pressable
          onPress={addTag}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label.toLowerCase()}`}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            backgroundColor: draft.trim() ? t.primary500 : t.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus
            size={18}
            color={draft.trim() ? t.textInverse : t.textMuted}
            weight="bold"
          />
        </Pressable>
      </View>
    </View>
  );
}

function PhotoAvatar({ uri }: { uri: string | null }) {
  const t = useTheme();
  const SIZE = 140;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: radius.full,
          borderWidth: 3,
          borderColor: t.primary500,
        }}
        resizeMode="cover"
        accessibilityLabel="Cat photo"
      />
    );
  }
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: radius.full,
        borderWidth: 3,
        borderColor: t.borderSubtle,
        backgroundColor: t.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CatIcon size={52} color={t.primary700} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5], paddingTop: space[4] },
  photoHero: { alignItems: 'center', marginTop: space[4] },
});
