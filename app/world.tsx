/**
 * World Memory — the registry of REAL objects, places, toys, furniture,
 * and environmental context the cat actually has in their world.
 *
 * ── Why this screen exists ─────────────────────────────────────────
 * The chat module used to fabricate references ("the cup is closer to
 * the edge", "the radiator was cold") because it had no grounded data.
 * World Memory is the registry of REAL items the cat references, so
 * chat replies, diary entries, and pinned-facts retrieval can cite
 * actual objects by name.
 *
 * ── How entries land here (2026-05-05 pivot) ───────────────────────
 * Pre-pivot: the user typed entries into a form on this screen. Felt
 * like work. Most users didn't bother.
 *
 * Post-pivot: entries land SILENTLY from vision passes on photos
 * uploaded to the photo gallery and on body-language video frames.
 * The user does nothing. Recurring sightings (≥2 in 30 days) graduate
 * automatically into visible entries the cat starts referencing in
 * chat. The user notices Lily mention "the green chair" and wonders
 * how she knows — that's the magic.
 *
 * This screen is now READ-ONLY (with edit/delete escape hatches for
 * cases where the model got something wrong). No Add form. The cat's
 * world is what the cat sees in your photos.
 *
 * Layout:
 *   - Header (back + title)
 *   - Intro card (explains autonomous learning)
 *   - Weather opt-in (user grants location → cat references real weather)
 *   - Empty state if no entries graduated yet
 *   - Sectioned list: Furniture / Toys / Things / Places / Today
 *     - Each row shows name + chips + "X photos contributed" badge for
 *       auto-detected entries. Tap to edit/delete.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  Sparkle,
  Trash,
  X,
  House,
  GameController,
  Tree,
  Cloud,
  Cube,
  Camera,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import { useActiveCat } from '../src/hooks/useActiveCat';
import {
  useWorldStore,
  useWorldEntries,
  groupEntriesByKind,
  worldKindLabel,
  sentimentLabel,
  type WorldEntry,
  type WorldKind,
  type WorldSentiment,
} from '../src/state/worldStore';
import { track } from '../src/services/analytics';

const KIND_ORDER: WorldKind[] = ['furniture', 'toy', 'object', 'place', 'environment'];
const SENTIMENT_OPTIONS: WorldSentiment[] = ['loves', 'likes', 'curious', 'tolerates', 'dislikes', 'fears'];

function kindIcon(kind: WorldKind, color: string) {
  switch (kind) {
    case 'furniture': return <House size={20} color={color} weight="duotone" />;
    case 'toy': return <GameController size={20} color={color} weight="duotone" />;
    case 'place': return <Tree size={20} color={color} weight="duotone" />;
    case 'environment': return <Cloud size={20} color={color} weight="duotone" />;
    case 'object':
    default: return <Cube size={20} color={color} weight="duotone" />;
  }
}

export default function WorldScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const entries = useWorldEntries(cat?.id);
  const updateEntry = useWorldStore((s) => s.updateEntry);
  const removeEntry = useWorldStore((s) => s.removeEntry);

  const [editingId, setEditingId] = useState<string | null>(null);

  // Telemetry — surface how often the world screen gets opened.
  useEffect(() => {
    if (!cat?.id) return;
    track({
      type: 'world_screen_opened',
      props: { entry_count: entries.length },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Lazy backfill — first time the user opens /world after install
  // (or after upgrading to the world-extraction build), kick off a
  // one-shot vision pass over their existing photo gallery so the
  // empty state populates with real items rather than waiting for
  // them to add new photos. Idempotent — backfillWorldFromPhotos
  // gates on an AsyncStorage flag and is a no-op on later opens.
  useEffect(() => {
    if (!cat?.id || !cat?.name) return;
    void (async () => {
      try {
        const [{ usePhotoStudioStore }, { backfillWorldFromPhotos }] = await Promise.all([
          import('../src/state/photoStudioStore'),
          import('../src/services/worldExtraction'),
        ]);
        const photos = usePhotoStudioStore.getState().getPhotosForCat(cat.id);
        if (photos.length === 0) return;
        await backfillWorldFromPhotos({
          catId: cat.id,
          catName: cat.name,
          photos: photos.map((p) => ({ uri: p.uri, added_at: p.added_at })),
        });
      } catch (e) {
        console.warn('[World] backfill skipped:', e);
      }
    })();
  }, [cat?.id, cat?.name]);

  const grouped = useMemo(() => groupEntriesByKind(entries), [entries]);

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={{ padding: space[6] }}>
          <Text token="body" color="textMuted">
            Add a cat first — Settings → Manage cats.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} title={`${cat.name}'s world`} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
          paddingTop: space[2],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro / context — explains autonomous learning. The phrasing
            is deliberately gentle ("noticed in your photos") — we want
            the user to feel the cat is paying attention, not that the
            app is scanning their gallery in a creepy way. */}
        <View style={[styles.introCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
          <View style={styles.introHeader}>
            <Sparkle size={18} color={t.primary500} weight="duotone" />
            <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, fontWeight: '600' }}>
              {cat.name} is learning their world
            </Text>
          </View>
          <Text token="body" color="textSecondary" style={{ marginTop: space[2] }}>
            The things, places, and toys {cat.name} notices in your photos
            show up here. Once the same item appears a few times, {cat.name}
            starts referencing it in chat and diary entries — instead of
            inventing props that don't exist.
          </Text>
          <Text token="caption" color="textMuted" style={{ marginTop: space[2] }}>
            Tap any item to edit or remove if {cat.name} got something wrong.
          </Text>
        </View>

        {/* Weather opt-in — gives the cat awareness of today's real
            weather. Permission is requested only when user taps the
            button; we never auto-prompt. Status reflects current
            permission state (granted / denied / not yet asked). */}
        <WeatherOptInCard catName={cat.name} />

        {/* Empty state — explains how to seed the world */}
        {entries.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
            <Camera size={28} color={t.textMuted} weight="duotone" />
            <Text token="body" color="textSecondary" style={{ textAlign: 'center', marginTop: space[3] }}>
              Nothing learned yet.
            </Text>
            <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[1] }}>
              Add a few photos of {cat.name} from the Bond tab — the
              chair they nap on, the rug they knead, the window they
              watch. {cat.name} will start to recognise their world.
            </Text>
          </View>
        ) : null}

        {/* Sections by kind */}
        {KIND_ORDER.map((kind) => {
          const list = grouped[kind];
          if (list.length === 0) return null;
          return (
            <View key={kind} style={{ marginTop: space[5] }}>
              <View style={styles.sectionHeader}>
                {kindIcon(kind, t.primary500)}
                <Text token="heading3" style={{ marginLeft: space[2], color: t.textPrimary }}>
                  {worldKindLabel(kind)}
                </Text>
                <Text token="caption" color="textMuted" style={{ marginLeft: space[2] }}>
                  {list.length}
                </Text>
              </View>
              {list.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isEditing={editingId === entry.id}
                  onEdit={() => setEditingId(entry.id)}
                  onSave={(fields) => {
                    updateEntry(entry.id, fields);
                    setEditingId(null);
                    track({
                      type: 'world_entry_updated',
                      props: { kind: entry.kind },
                    });
                  }}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => {
                    Alert.alert(
                      'Remove from world?',
                      `${cat.name} will no longer reference "${entry.name}".`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => {
                            removeEntry(entry.id);
                            setEditingId(null);
                            track({
                              type: 'world_entry_removed',
                              props: { kind: entry.kind },
                            });
                          },
                        },
                      ],
                    );
                  }}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: t.borderSubtle }]}>
      <Pressable onPress={onBack} style={styles.headerBack}>
        <ArrowLeft size={24} color={t.textPrimary} weight="bold" />
      </Pressable>
      <Text token="heading3" style={{ color: t.textPrimary, flex: 1, textAlign: 'center' }}>
        {title ?? 'World'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function EntryRow({
  entry,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: WorldEntry;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (fields: Partial<WorldEntry>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const [name, setName] = useState(entry.name);
  const [color, setColor] = useState(entry.color ?? '');
  const [location, setLocation] = useState(entry.location ?? '');
  const [sentiment, setSentiment] = useState<WorldSentiment | undefined>(entry.sentiment);
  const [description, setDescription] = useState(entry.description ?? '');

  // Reset local edit state when entry changes (e.g. cloud restore brings new data)
  useEffect(() => {
    setName(entry.name);
    setColor(entry.color ?? '');
    setLocation(entry.location ?? '');
    setSentiment(entry.sentiment);
    setDescription(entry.description ?? '');
  }, [entry.id, entry.name, entry.color, entry.location, entry.sentiment, entry.description]);

  if (isEditing) {
    return (
      <View style={[styles.formCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle, marginTop: space[2] }]}>
        <View style={styles.formHeader}>
          <Text token="heading3" style={{ color: t.textPrimary }}>Edit</Text>
          <Pressable onPress={onCancel} style={styles.formClose}>
            <X size={20} color={t.textMuted} weight="bold" />
          </Pressable>
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={t.textMuted}
          style={[styles.formInput, { color: t.textPrimary, borderColor: t.borderSubtle, backgroundColor: t.surface }]}
        />
        <TextInput
          value={color}
          onChangeText={setColor}
          placeholder="Color"
          placeholderTextColor={t.textMuted}
          style={[styles.formInput, { color: t.textPrimary, borderColor: t.borderSubtle, backgroundColor: t.surface }]}
        />
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
          placeholderTextColor={t.textMuted}
          style={[styles.formInput, { color: t.textPrimary, borderColor: t.borderSubtle, backgroundColor: t.surface }]}
        />
        <View style={styles.chipRow}>
          {SENTIMENT_OPTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSentiment(sentiment === s ? undefined : s)}
              style={[
                styles.chip,
                sentiment === s && styles.chipActive,
                {
                  borderColor: sentiment === s ? t.primary500 : t.borderSubtle,
                  backgroundColor: sentiment === s ? t.primary500 : t.surface,
                },
              ]}
            >
              <Text
                token="caption"
                style={{ color: sentiment === s ? t.textInverse : t.textPrimary }}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Note"
          placeholderTextColor={t.textMuted}
          multiline
          style={[
            styles.formInput,
            styles.formInputMulti,
            { color: t.textPrimary, borderColor: t.borderSubtle, backgroundColor: t.surface },
          ]}
        />

        <View style={styles.editActionsRow}>
          <Pressable
            onPress={onDelete}
            style={[styles.deleteButton, { borderColor: t.error }]}
          >
            <Trash size={16} color={t.error} weight="bold" />
            <Text token="caption" style={{ marginLeft: space[1], color: t.error, fontWeight: '600' }}>
              Remove
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              onSave({
                name: name.trim(),
                color: color.trim() || undefined,
                location: location.trim() || undefined,
                sentiment,
                description: description.trim() || undefined,
              })
            }
            style={[styles.saveButton, { backgroundColor: t.primary500, flex: 1, marginLeft: space[2] }]}
          >
            <Text token="body" style={{ color: t.textInverse, fontWeight: '600' }}>
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Compact display row
  const chips: string[] = [];
  if (entry.color) chips.push(entry.color);
  if (entry.location) chips.push(entry.location);
  const sentimentText = sentimentLabel(entry.sentiment);
  if (sentimentText) chips.push(sentimentText);

  // Evidence chip — only for auto-detected entries (rest are user-
  // mentioned in chat or hand-typed before the pivot). Singular
  // when the count is 1 — a freshly graduated entry sits at exactly
  // RECURRENCE_THRESHOLD = 2 sightings, but a chat-extracted entry
  // updated by a later photo might show "1 photo".
  const isAutoDetected = entry.source_type === 'auto_detected';
  const evidenceCount = entry.evidence_count ?? 0;
  const showEvidence = isAutoDetected && evidenceCount > 0;

  return (
    <Pressable onPress={onEdit} style={[styles.entryRow, { borderColor: t.borderSubtle, backgroundColor: t.surface }]}>
      <View style={styles.entryRowHeader}>
        <Text token="body" style={{ color: t.textPrimary, fontWeight: '600', flex: 1 }}>
          {entry.name}
        </Text>
        {showEvidence ? (
          <View style={[styles.evidenceBadge, { borderColor: t.borderSubtle }]}>
            <Camera size={11} color={t.textMuted} weight="duotone" />
            <Text token="caption" style={{ marginLeft: 4, color: t.textMuted }}>
              {evidenceCount === 1 ? '1 photo' : `${evidenceCount} photos`}
            </Text>
          </View>
        ) : null}
      </View>
      {chips.length > 0 ? (
        <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
          {chips.join(' · ')}
        </Text>
      ) : null}
      {entry.description ? (
        <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
          {entry.description.length > 100 ? entry.description.slice(0, 100) + '…' : entry.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * WeatherOptInCard — a single card on the world screen offering the
 * user the chance to give the cat awareness of today's real weather.
 *
 * Three states:
 *   - "not_asked" — never requested permission. Show "Allow" button.
 *   - "granted"   — permission OK. Show "Active" check + a way to revoke
 *                   via system settings.
 *   - "denied"    — user declined. Show explainer + system-settings link.
 *
 * Permission request fires only on user tap. No auto-prompt anywhere.
 */
function WeatherOptInCard({ catName }: { catName: string }) {
  const t = useTheme();
  const [status, setStatus] = useState<'unknown' | 'granted' | 'denied' | 'not_asked'>('unknown');
  const [busy, setBusy] = useState(false);

  // Read permission state on mount + when the screen regains focus.
  // expo-location's `getForegroundPermissionsAsync` is read-only, never
  // prompts. `canAskAgain` distinguishes "user said no, can't re-ask"
  // (denied + soft-blocked) from "we just haven't asked yet".
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!active) return;
        if (perm.granted) setStatus('granted');
        else if (perm.canAskAgain) setStatus('not_asked');
        else setStatus('denied');
      } catch {
        if (active) setStatus('not_asked');
      }
    })();
    return () => { active = false; };
  }, []);

  const onAllow = async () => {
    setBusy(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.granted) {
        setStatus('granted');
        track({ type: 'world_weather_permission_granted', props: {} });
        // Trigger a background fetch so first chat reply has data.
        try {
          const { triggerWeatherRefresh } = await import('../src/services/weatherContext');
          triggerWeatherRefresh();
        } catch {
          // optional — refresh is best-effort
        }
      } else if (!result.canAskAgain) {
        setStatus('denied');
        track({ type: 'world_weather_permission_denied', props: { soft_blocked: true } });
      } else {
        setStatus('not_asked');
        track({ type: 'world_weather_permission_denied', props: { soft_blocked: false } });
      }
    } catch (e) {
      console.warn('[World] location request failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const openSettings = () => {
    void Linking.openSettings().catch((e) =>
      console.warn('[World] openSettings failed:', e),
    );
  };

  // Loading state — don't flicker between forms while we read the
  // initial permission state.
  if (status === 'unknown') return null;

  if (status === 'granted') {
    return (
      <View style={[styles.weatherCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
        <View style={styles.weatherCardHeader}>
          <Cloud size={20} color={t.primary500} weight="duotone" />
          <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, fontWeight: '600' }}>
            Today's weather
          </Text>
          <View style={styles.weatherActiveBadge}>
            <Check size={14} color={t.primary700} weight="bold" />
            <Text token="caption" style={{ marginLeft: 4, color: t.primary700, fontWeight: '600' }}>
              active
            </Text>
          </View>
        </View>
        <Text token="caption" color="textMuted" style={{ marginTop: space[1] }}>
          {catName} can reference today's real weather. To revoke, open device Settings.
        </Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={[styles.weatherCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
        <View style={styles.weatherCardHeader}>
          <Cloud size={20} color={t.textMuted} weight="duotone" />
          <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, fontWeight: '600' }}>
            Today's weather
          </Text>
        </View>
        <Text token="caption" color="textMuted" style={{ marginTop: space[1] }}>
          Location permission was declined. Open device Settings to allow.
        </Text>
        <Pressable
          onPress={openSettings}
          style={[styles.weatherActionButton, { borderColor: t.borderSubtle }]}
        >
          <Text token="caption" style={{ color: t.textPrimary, fontWeight: '600' }}>
            Open Settings
          </Text>
        </Pressable>
      </View>
    );
  }

  // status === 'not_asked'
  return (
    <View style={[styles.weatherCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
      <View style={styles.weatherCardHeader}>
        <Cloud size={20} color={t.primary500} weight="duotone" />
        <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, fontWeight: '600' }}>
          Let {catName} know today's weather?
        </Text>
      </View>
      <Text token="caption" color="textMuted" style={{ marginTop: space[1], marginBottom: space[2] }}>
        Approximate location only (rounded to ~10km, never shared).
        {catName} will reference real conditions ("snow today, I am not pleased")
        in chat and diary instead of inventing weather.
      </Text>
      <Pressable
        onPress={onAllow}
        disabled={busy}
        style={[
          styles.weatherActionButton,
          {
            backgroundColor: t.primary500,
            borderColor: t.primary500,
            opacity: busy ? 0.6 : 1,
          },
        ]}
      >
        <Text token="caption" style={{ color: t.textInverse, fontWeight: '600' }}>
          {busy ? 'Asking…' : 'Allow location'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
  },
  headerBack: { padding: space[2] },
  headerSpacer: { width: 40 },
  introCard: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[3],
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherCard: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[3],
  },
  weatherCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(63, 100, 86, 0.1)',
  },
  weatherActionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[2],
  },
  emptyState: {
    padding: space[5],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[4],
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    marginBottom: space[2],
  },
  entryRow: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[2],
  },
  entryRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    marginLeft: space[2],
  },
  formCard: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[4],
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  formClose: { padding: space[1] },
  formInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 16,
    marginBottom: space[2],
  },
  formInputMulti: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginBottom: space[2],
  },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[1] + 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipActive: {},
  saveButton: {
    paddingVertical: space[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
