/**
 * People & Pets — the directory of recurring subjects in your cat's
 * life. Browser-style screen sourced from `subjectDirectoryStore`.
 *
 * Layout:
 *   - Header (back + title)
 *   - Empty state (no entries yet) explains the loop: "tag photos →
 *     names show up here → diary mentions them"
 *   - List: one card per directory entry, sorted by appearance count
 *     (most-frequent first). Each card shows:
 *       - Name + kind icon
 *       - Vibe blurb (lazy LLM-summarised; falls back to a stub)
 *       - "Appeared in N photos · last seen X days ago"
 *       - Recent photo thumbnails (up to 4)
 *
 * Tap a card → expand to a per-subject detail (rename, delete,
 * change kind). Detail editing is intentionally minimal in this
 * first cut — the screen's main job is letting the user see the
 * directory grow.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Cat as CatIcon,
  Dog,
  PencilSimple,
  Sparkle,
  Trash,
  User as UserIcon,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import { useActiveCat } from '../src/hooks/useActiveCat';
import {
  useSubjectsForCat,
  useSubjectDirectoryStore,
  type DirectoryEntry,
} from '../src/state/subjectDirectoryStore';
import { usePhotoStudioStore } from '../src/state/photoStudioStore';
import {
  shouldRefreshVibe,
  summariseSubject,
} from '../src/services/subjects';
import { track } from '../src/services/analytics';
import type { SubjectKind } from '../src/services/photoStudio';

export default function PeopleAndPetsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const subjects = useSubjectsForCat(cat?.id);

  // Telemetry — surface how often the directory gets opened.
  useEffect(() => {
    if (!cat?.id) return;
    track({
      type: 'subject_directory_opened',
      props: { directory_size: subjects.length },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Lazy vibe refresh — for entries that are due, kick off the LLM
  // summariser one at a time (avoid blasting OpenAI). Updates the
  // entry's `vibe` and `vibe_updated_at` once the call returns.
  useEffect(() => {
    if (!cat?.id || subjects.length === 0) return;
    const due = subjects.find(shouldRefreshVibe);
    if (!due) return;
    let cancelled = false;
    void (async () => {
      try {
        const vibe = await summariseSubject({ catName: cat.name, entry: due });
        if (cancelled || !vibe) return;
        useSubjectDirectoryStore
          .getState()
          .patchEntry(cat.id, due.id, {
            vibe,
            vibe_updated_at: new Date().toISOString(),
          });
        track({
          type: 'subject_vibe_summarised',
          props: { appearances_at_summary: due.total_appearances },
        });
      } catch (e) {
        console.warn('[people] vibe refresh failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cat?.id, cat?.name, subjects]);

  return (
    <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[8],
        }}
      >
        <View style={{ marginBottom: space[5] }}>
          <Text token="caption" color="textMuted" style={styles.eyebrow}>
            Bond
          </Text>
          <Text token="heading1" style={{ marginTop: 4 }}>
            {cat?.name ?? 'Your cat'}&apos;s People &amp; Pets
          </Text>
          <Text token="body" color="textMuted" style={{ marginTop: space[2], lineHeight: 22 }}>
            Tag who&apos;s in {cat?.name ?? 'your cat'}&apos;s photos and they&apos;ll show up here. Recurring names get woven into the diary as memories.
          </Text>
        </View>

        {subjects.length === 0 ? (
          <EmptyState
            catName={cat?.name ?? 'your cat'}
            onOpenGallery={() => router.push('/photo-studio' as never)}
          />
        ) : (
          subjects.map((entry) => (
            <SubjectCard
              key={entry.id}
              entry={entry}
              catId={cat?.id ?? null}
              catName={cat?.name ?? 'your cat'}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subject card
// ---------------------------------------------------------------------------

function SubjectCard({
  entry,
  catId,
  catName,
}: {
  entry: DirectoryEntry;
  catId: string | null;
  catName: string;
}) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(entry.name);
  const [draftKind, setDraftKind] = useState<SubjectKind>(entry.kind);
  const photos = usePhotoStudioStore((s) => s.photos[catId ?? ''] ?? []);

  const recentPhotoUris = useMemo(() => {
    const photoIds = new Set(entry.appearances.slice(0, 4).map((a) => a.photo_id));
    return photos
      .filter((p) => photoIds.has(p.id))
      .slice(0, 4)
      .map((p) => p.uri);
  }, [photos, entry.appearances]);

  const daysSinceLast = useMemo(() => {
    const last = new Date(`${entry.last_seen}T12:00:00`);
    const ms = Date.now() - last.getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }, [entry.last_seen]);

  const subtitle = useMemo(() => {
    const seenLabel =
      daysSinceLast === 0
        ? 'today'
        : daysSinceLast === 1
          ? 'yesterday'
          : `${daysSinceLast} days ago`;
    return `${entry.total_appearances} ${entry.total_appearances === 1 ? 'photo' : 'photos'} · last seen ${seenLabel}`;
  }, [entry.total_appearances, daysSinceLast]);

  const onSaveEdit = () => {
    if (!catId) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Subject name cannot be empty.');
      return;
    }
    useSubjectDirectoryStore.getState().patchEntry(catId, entry.id, {
      name: trimmed,
      kind: draftKind,
    });
    setEditing(false);
  };

  const onDelete = () => {
    if (!catId) return;
    Alert.alert(
      `Delete ${entry.name}?`,
      `This removes ${entry.name} from ${catName}'s directory. The tags on individual photos stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            useSubjectDirectoryStore.getState().deleteEntry(catId, entry.id);
            setExpanded(false);
          },
        },
      ],
    );
  };

  const KindIcon = entry.kind === 'pet' ? Dog : entry.kind === 'person' ? UserIcon : CatIcon;

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: t.surfaceElevated,
          borderColor: t.borderSubtle,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={[
            styles.kindBadge,
            { backgroundColor: t.secondary100, borderColor: t.borderSubtle },
          ]}
        >
          <KindIcon size={22} color={t.secondary700} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text token="heading3">{entry.name}</Text>
          <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
      </View>

      {entry.vibe ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: space[3], alignItems: 'flex-start' }}>
          <Sparkle size={14} color={t.secondary700} weight="duotone" style={{ marginTop: 2 }} />
          <Text token="body" style={{ flex: 1, color: t.textSecondary, fontStyle: 'italic', lineHeight: 21 }}>
            {entry.vibe}
          </Text>
        </View>
      ) : null}

      {recentPhotoUris.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: space[3] }}>
          {recentPhotoUris.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri }}
              style={[styles.thumb, { borderColor: t.borderSubtle }]}
            />
          ))}
        </View>
      ) : null}

      {expanded ? (
        <View style={{ marginTop: space[4], gap: space[3] }}>
          <View style={{ height: 1, backgroundColor: t.borderSubtle }} />

          {editing ? (
            <View style={{ gap: space[2] }}>
              <Text token="caption" color="textMuted" style={styles.eyebrow}>
                Edit
              </Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                style={[
                  styles.input,
                  { borderColor: t.borderStrong, color: t.textPrimary, backgroundColor: t.surface },
                ]}
                autoCapitalize="words"
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['person', 'pet', 'other'] as const).map((k) => {
                  const active = draftKind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setDraftKind(k)}
                      style={({ pressed }) => [
                        styles.kindChip,
                        {
                          backgroundColor: active ? t.secondary100 : t.surface,
                          borderColor: active ? t.secondary500 : t.borderSubtle,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        token="caption"
                        style={{
                          color: active ? t.secondary900 : t.textPrimary,
                          fontFamily: active ? 'Figtree_600SemiBold' : 'Figtree_400Regular',
                        }}
                      >
                        {k === 'person' ? 'Person' : k === 'pet' ? 'Pet' : 'Other'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: space[2] }}>
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setDraftName(entry.name);
                    setDraftKind(entry.kind);
                  }}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { borderColor: t.borderStrong, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onSaveEdit}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: t.primary500, borderColor: t.primary500, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text token="caption" style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setEditing(true)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { borderColor: t.borderStrong, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <PencilSimple size={14} color={t.textPrimary} weight="bold" />
                <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
                  Rename
                </Text>
              </Pressable>
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { borderColor: t.error, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Trash size={14} color={t.error} weight="bold" />
                <Text token="caption" style={{ color: t.error, fontFamily: 'Figtree_600SemiBold' }}>
                  Remove
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  catName,
  onOpenGallery,
}: {
  catName: string;
  onOpenGallery: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
      ]}
    >
      <Text token="heading3" style={{ textAlign: 'center' }}>
        No one tagged yet
      </Text>
      <Text
        token="body"
        color="textMuted"
        style={{ textAlign: 'center', marginTop: space[2], lineHeight: 22 }}
      >
        Tagging happens inside a photo. Open {catName}&apos;s gallery, tap any photo to open it, then tap &ldquo;Tag who&apos;s here&rdquo; below the image. Names you save show up here and start appearing in {catName}&apos;s diary.
      </Text>
      <Pressable
        onPress={onOpenGallery}
        style={({ pressed }) => [
          styles.emptyCta,
          {
            backgroundColor: t.primary500,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${catName}'s photos to start tagging`}
      >
        <Text
          token="body"
          style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}
        >
          Open {catName}&apos;s photos
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space[3],
        paddingVertical: space[3],
      }}
    >
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn} accessibilityLabel="Back">
        <ArrowLeft size={22} color={t.textPrimary} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <View style={styles.iconBtn} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  card: {
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space[3],
  },
  kindBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
  },
  empty: {
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyCta: {
    marginTop: space[4],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderRadius: 999,
    alignItems: 'center',
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: 'Figtree_400Regular',
    fontSize: 15,
  },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
