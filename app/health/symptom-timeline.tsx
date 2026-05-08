/**
 * Symptom photo timeline — 11pets' signature feature, executed properly.
 *
 * Owner picks or creates a "concern" (e.g. "left eye discharge",
 * "lump on hip"). Each photo they add gets date-stamped and stacked in
 * a time series so they — and their vet — can SEE the change.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, Plus, Trash } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type SymptomPhotoPayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export default function SymptomTimeline() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const list = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e) => e.cat_id === cat.id && e.type === 'symptom_photo')
      .sort((a, b) => b.ts.localeCompare(a.ts)) as {
        id: string; ts: string; payload: SymptomPhotoPayload;
      }[];
  }, [events, cat]);

  // Group by concern_slug
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; photos: typeof list }>();
    for (const p of list) {
      const slug = p.payload.concern_slug;
      const existing = map.get(slug) ?? { label: p.payload.concern_label, photos: [] };
      existing.photos.push(p);
      map.set(slug, existing);
    }
    return Array.from(map.entries());
  }, [list]);

  const [newConcern, setNewConcern] = useState('');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');
  const [pendingNote, setPendingNote] = useState('');

  if (!cat) return null;

  const startNewConcern = () => {
    const label = newConcern.trim();
    if (!label) return;
    setActiveSlug(slugify(label));
    setActiveLabel(label);
    setNewConcern('');
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    if (!activeSlug) return;
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const r = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (r.canceled || !r.assets[0]) return;

    addEvent({
      cat_id: cat.id,
      type: 'symptom_photo',
      payload: {
        concern_slug: activeSlug,
        concern_label: activeLabel,
        photo_uri: r.assets[0].uri,
        notes: pendingNote.trim() || null,
      },
    });
    setPendingNote('');
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this photo?', '', [
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
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Images size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Symptom timeline</Text>
        </View>
        <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
          Track a single concern over time. Perfect for wounds healing, skin
          changes, or eye issues you want your vet to see progress photos of.
        </Text>

        {/* Active concern photo-add panel */}
        {activeSlug ? (
          <Card style={{ marginTop: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Text token="heading3" style={{ flex: 1 }}>
                Adding to: {activeLabel}
              </Text>
              <Pressable onPress={() => setActiveSlug(null)}>
                <Text token="caption" color="primary700">Close</Text>
              </Pressable>
            </View>
            <TextInput
              value={pendingNote}
              onChangeText={setPendingNote}
              placeholder="Optional note — size, appearance, pain"
              placeholderTextColor={t.textMuted}
              multiline
              style={{
                marginTop: space[3],
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
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <Button
                label="Take photo"
                onPress={() => addPhoto('camera')}
                leftIcon={<Camera size={18} color={t.textInverse} weight="bold" />}
              />
              <Button
                label="From gallery"
                variant="secondary"
                onPress={() => addPhoto('library')}
                leftIcon={<Images size={18} color={t.textPrimary} />}
              />
            </View>
          </Card>
        ) : (
          <Card style={{ marginTop: space[4] }}>
            <Text token="heading3">Start a new concern</Text>
            <TextInput
              value={newConcern}
              onChangeText={setNewConcern}
              placeholder="e.g. Lump on right hip"
              placeholderTextColor={t.textMuted}
              style={{
                marginTop: space[3],
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
              returnKeyType="done"
              onSubmitEditing={startNewConcern}
            />
            <Button
              label="Start tracking"
              onPress={startNewConcern}
              disabled={!newConcern.trim()}
              leftIcon={<Plus size={18} color={t.textInverse} weight="bold" />}
              style={{ marginTop: space[3] }}
            />
          </Card>
        )}

        {/* Existing timelines */}
        {grouped.length === 0 ? null : (
          <View style={{ marginTop: space[6] }}>
            <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}>
              Ongoing concerns
            </Text>
            {grouped.map(([slug, { label, photos }]) => (
              <Card key={slug} style={{ marginBottom: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Text token="heading3" style={{ flex: 1 }}>{label}</Text>
                  <Pressable
                    onPress={() => { setActiveSlug(slug); setActiveLabel(label); }}
                    hitSlop={8}
                  >
                    <Text token="caption" color="primary700">+ Add photo</Text>
                  </Pressable>
                </View>
                <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                  {photos.length} photo{photos.length === 1 ? '' : 's'} · first on{' '}
                  {new Date(photos[photos.length - 1]!.ts).toLocaleDateString()}
                </Text>
                <ScrollView horizontal style={{ marginTop: space[3] }} showsHorizontalScrollIndicator={false}>
                  {photos.map((p) => (
                    <View key={p.id} style={{ marginRight: space[2] }}>
                      <Pressable
                        onLongPress={() => confirmDelete(p.id)}
                        delayLongPress={350}
                      >
                        <Image
                          source={{ uri: p.payload.photo_uri }}
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: t.borderSubtle,
                          }}
                        />
                      </Pressable>
                      <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                        {new Date(p.ts).toLocaleDateString()}
                      </Text>
                      {p.payload.notes ? (
                        <Text token="caption" style={{ maxWidth: 120, marginTop: 2 }} numberOfLines={2}>
                          {p.payload.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </Card>
            ))}
            <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[1] }}>
              Long-press a photo to delete it.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  root: { paddingHorizontal: space[5] },
};
