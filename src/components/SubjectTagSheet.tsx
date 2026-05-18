/**
 * SubjectTagSheet — bottom-sheet modal for tagging people/pets in a
 * photo. The "Google Photos for cat owners" UX:
 *
 *   1. Header: "Tag who's in this photo"
 *   2. Already-tagged chips at the top (tap to remove)
 *   3. Vision suggestions: if `detected_subjects` says "1 person + 1 dog",
 *      show prompts: "+ Tag the person", "+ Tag the dog"
 *   4. Quick-tap chips: top-N existing directory entries (by frequency).
 *      Tap a chip → that subject is added with one tap.
 *   5. Free-text input with autocomplete from the directory. Type "Be"
 *      → "Bella" pops up; tap to confirm.
 *   6. Kind picker (Person / Pet / Other) for new entries.
 *
 * Two-side state mutation: each tag flows through
 * `subjectDirectoryStore.upsertFromTag` (creates / increments the
 * directory entry) AND `photoStudioStore.addSubjectToPhoto` (attaches
 * the SubjectTag to the photo). Untag flows the inverse.
 */
import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
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
import {
  CaretDown,
  Cat as CatIcon,
  Dog,
  Plus,
  User,
  X,
} from 'phosphor-react-native';
import { Text } from './Text';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/tokens';
import {
  useSubjectDirectoryStore,
  useTopSubjectsForCat,
  type DirectoryEntry,
} from '../state/subjectDirectoryStore';
import { usePhotoStudioStore } from '../state/photoStudioStore';
import type {
  PhotoStudioPhoto,
  SubjectKind,
  SubjectTag,
} from '../services/photoStudio';
import {
  matchDetectedToDirectory,
  type PersonDescription,
  type PetDescription,
  type MatchCandidate,
} from '../services/subjects';
import { track } from '../services/analytics';

type Props = {
  visible: boolean;
  photo: PhotoStudioPhoto | null;
  catId: string;
  catName: string;
  onClose: () => void;
};

/**
 * In-app error boundary — shows the actual exception on screen
 * instead of letting it crash the JS engine to the splash screen.
 * TEMPORARY DEBUG SCAFFOLD: while we hunt down the tag-sheet crash
 * on Android, this surfaces the real error message so we can read
 * it without adb. Remove once the crash is fixed.
 */
class TagSheetErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { error: Error | null; info: ErrorInfo | null }
> {
  state = { error: null as Error | null, info: null as ErrorInfo | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    console.error('[SubjectTagSheet] caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: 24,
            justifyContent: 'center',
          }}
        >
          <ScrollView
            style={{
              maxHeight: 400,
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text token="heading3" style={{ color: '#8B2F1F', marginBottom: 8 }}>
              Tag sheet crashed
            </Text>
            <Text token="caption" style={{ color: '#1F2024', marginBottom: 4, fontFamily: 'JetBrainsMono_500Medium' }}>
              {this.state.error.name}
            </Text>
            <Text token="body" style={{ color: '#1F2024', marginBottom: 12 }}>
              {this.state.error.message}
            </Text>
            {this.state.error.stack ? (
              <Text
                token="caption"
                style={{
                  color: '#534B3E',
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 11,
                  lineHeight: 15,
                }}
              >
                {this.state.error.stack.slice(0, 2000)}
              </Text>
            ) : null}
            {this.state.info?.componentStack ? (
              <Text
                token="caption"
                style={{
                  color: '#534B3E',
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 11,
                  lineHeight: 15,
                  marginTop: 8,
                }}
              >
                {this.state.info.componentStack.slice(0, 1000)}
              </Text>
            ) : null}
          </ScrollView>
          <Pressable
            onPress={this.props.onClose}
            style={{
              marginTop: 16,
              backgroundColor: '#fff',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text token="body" style={{ color: '#1F2024', fontFamily: 'Figtree_600SemiBold' }}>
              Close
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export function SubjectTagSheet(props: Props) {
  return (
    <TagSheetErrorBoundary onClose={props.onClose}>
      <SubjectTagSheetInner {...props} />
    </TagSheetErrorBoundary>
  );
}

// Stable empty-array constant for the allSubjects selector below.
// CRITICAL — without this, the inline `?? []` returned a fresh array
// reference on every render, which Zustand treated as "the store
// changed", triggering a re-render that ran the selector again ad
// infinitum. The crash showed up as "Maximum update depth exceeded"
// in SubjectTagSheetInner. Same pattern as photoStudioStore's
// EMPTY_PHOTOS const — see chatStore for original write-up.
const EMPTY_SUBJECT_LIST: never[] = Object.freeze([]) as never;

/**
 * Helpers — count people/pets in a detected_subjects payload across
 * both schema versions:
 *   - v1 (legacy): { people: number, pets: number, ... }
 *   - v2 (current): { people: PersonDescription[], pets: PetDescription[], ... }
 * Old photos in the gallery still have v1 detection results; the
 * vision call upgrade only affects NEW photos.
 */
function detectedPeopleCount(d: { people: unknown }): number {
  if (Array.isArray(d.people)) return d.people.length;
  if (typeof d.people === 'number') return d.people;
  return 0;
}
function detectedPetsCount(d: { pets: unknown }): number {
  if (Array.isArray(d.pets)) return d.pets.length;
  if (typeof d.pets === 'number') return d.pets;
  return 0;
}

function SubjectTagSheetInner({ visible, photo, catId, catName, onClose }: Props) {
  const t = useTheme();
  const topSubjects = useTopSubjectsForCat(catId, 8);
  const allSubjects = useSubjectDirectoryStore(
    (s) => s.entries[catId] ?? EMPTY_SUBJECT_LIST,
  );

  const upsertFromTag = useSubjectDirectoryStore((s) => s.upsertFromTag);
  const removeAppearance = useSubjectDirectoryStore((s) => s.removeAppearance);
  const addSubjectToPhoto = usePhotoStudioStore((s) => s.addSubjectToPhoto);
  const removeSubjectFromPhoto = usePhotoStudioStore(
    (s) => s.removeSubjectFromPhoto,
  );

  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<SubjectKind>('person');

  // Subscribe to the LIVE photo record from the store so tag chips
  // and detected_subjects update reactively as the user tags +
  // detection lands. The prop is just the snapshot at sheet-open
  // time; without this hook, chips don't appear until the user
  // closes and reopens the sheet.
  const livePhoto = usePhotoStudioStore((s) => {
    if (!photo) return null;
    const list = s.photos[catId] ?? [];
    return list.find((p) => p.id === photo.id) ?? photo;
  });

  // Hook-order safety (2026-05-14 audit fix): the early-return for
  // null photo / livePhoto used to live HERE, before the six hooks
  // below (4× useMemo + 2× useState). Moved to AFTER all hooks so
  // every render path runs the same sequence. The interim variable
  // accessors below use optional chaining + ?? [] so they stay safe
  // when livePhoto is null — the early return then bails out of the
  // render path cleanly.
  const tagged = livePhoto?.subjects ?? [];
  const taggedIds = new Set(tagged.map((t) => t.subject_id));

  // Filter directory by current draft name (autocomplete).
  const trimmed = draftName.trim();
  const matches = useMemo(() => {
    if (!trimmed) return [] as DirectoryEntry[];
    const k = trimmed.toLowerCase();
    return allSubjects
      .filter(
        (e) =>
          !taggedIds.has(e.id) && e.name.toLowerCase().startsWith(k),
      )
      .slice(0, 5);
  }, [allSubjects, trimmed, taggedIds]);

  // Quick-tap chips: top subjects NOT already tagged on this photo.
  const quickChips = topSubjects.filter((e) => !taggedIds.has(e.id));

  const detected = livePhoto?.detected_subjects ?? null;

  // ── AUTO-MATCH ──
  // For each vision-detected person/pet in this photo, try to match
  // it to an existing directory entry by description similarity.
  // Matched entries become one-tap "confirm" suggestions at the top
  // of the sheet — the user just taps and the tag is added without
  // typing or selecting from the autocomplete. Unmatched detections
  // fall through to the manual flow below.
  //
  // Backwards compat: detected_subjects from the previous schema
  // version had `people: number` instead of `PersonDescription[]`.
  // The shape check (Array.isArray) keeps old photos from crashing
  // — they just don't get auto-suggestions.
  const autoMatches: MatchCandidate[] = useMemo(() => {
    if (!detected) return [];
    const detectedPeople: PersonDescription[] = Array.isArray(detected.people)
      ? (detected.people as PersonDescription[])
      : [];
    const detectedPets: PetDescription[] = Array.isArray(detected.pets)
      ? (detected.pets as PetDescription[])
      : [];
    if (detectedPeople.length === 0 && detectedPets.length === 0) return [];
    const result = matchDetectedToDirectory({
      detectedPeople,
      detectedPets,
      directory: allSubjects.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        canonical_description: e.canonical_description ?? null,
      })),
    });
    const all = [
      ...result.peopleMatches.filter((m): m is MatchCandidate => m !== null),
      ...result.petMatches.filter((m): m is MatchCandidate => m !== null),
    ];
    // Filter out subjects already tagged on this photo (no point
    // suggesting Mom again when she's already in the chip strip).
    return all.filter((m) => !taggedIds.has(m.subject_id));
  }, [detected, allSubjects, taggedIds]);

  // ── UNMATCHED DETECTIONS — track the per-person description so
  // when a manual tag fires, the FIRST unmatched detected person's
  // description gets attached as the canonical_description. Same
  // for pets. Imperfect (the user might mean a different person),
  // but in practice photos with 1 person / 1 pet are the common
  // case and this works well there.
  const unmatchedPersonDescriptions: PersonDescription[] = useMemo(() => {
    if (!detected || !Array.isArray(detected.people)) return [];
    // Recompute the match to extract which detections didn't match
    // (different from autoMatches which only keeps matched).
    const result = matchDetectedToDirectory({
      detectedPeople: detected.people as PersonDescription[],
      detectedPets: [],
      directory: allSubjects.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        canonical_description: e.canonical_description ?? null,
      })),
    });
    return (detected.people as PersonDescription[]).filter(
      (_, i) => result.peopleMatches[i] === null,
    );
  }, [detected, allSubjects]);

  const unmatchedPetDescriptions: PetDescription[] = useMemo(() => {
    if (!detected || !Array.isArray(detected.pets)) return [];
    const result = matchDetectedToDirectory({
      detectedPeople: [],
      detectedPets: detected.pets as PetDescription[],
      directory: allSubjects.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        canonical_description: e.canonical_description ?? null,
      })),
    });
    return (detected.pets as PetDescription[]).filter(
      (_, i) => result.petMatches[i] === null,
    );
  }, [detected, allSubjects]);

  // Track how many unmatched descriptions have been "consumed" by
  // tags applied during this sheet session. Used so the SECOND
  // tag on the same photo gets the SECOND unmatched description.
  const [unmatchedPersonCursor, setUnmatchedPersonCursor] = useState(0);
  const [unmatchedPetCursor, setUnmatchedPetCursor] = useState(0);

  // Hook-order-safe early return (moved from above per 2026-05-14
  // audit). All hooks above this point run on every render; the bail
  // happens during the render-output phase only.
  if (!photo || !livePhoto) return null;

  const applyTag = (
    name: string,
    kind: SubjectKind,
    source: 'autocomplete' | 'free_text' | 'detected_chip' | 'auto_match',
  ) => {
    if (!name.trim()) return;

    // Identity-bug prevention: refuse to tag the active cat as a
    // "subject" in their own photo. This is the source of the diary
    // bug where the cat is referred to in third person ("Even Lily,
    // the other creature of the household, seemed intrigued..."). Once
    // an entry exists with the active cat's name, the directory feeds
    // chat + diary prompts that render Lily as a "person/pet you
    // know" — and the LLM dutifully treats them as separate.
    //
    // We catch this at three layers (defence in depth):
    //   1. HERE — refuse the tag at input
    //   2. chat.ts / diaryStore.ts — filter the directory before
    //      rendering, so already-polluted directories don't keep
    //      breaking the voice
    //   3. (future) auto-prune existing self-tagged entries on app
    //      boot — out of scope here, only matters for users who
    //      already shipped 0.1.13 with self-tagged subjects
    if (name.trim().toLowerCase() === catName.trim().toLowerCase()) {
      track({
        type: 'subject_tag_blocked_self',
        props: { source },
      });
      Alert.alert(
        `That's ${catName}!`,
        `${catName} is the cat whose photos these are — they're already the star of the album. Tag the people and other pets who join them.`,
        [{ text: 'Got it' }],
      );
      setDraftName('');
      return;
    }

    // Pick a canonical description to attach if we're tagging a NEW
    // subject. For person tags, the cursor walks through the list
    // of unmatched detected people; same for pets. If the user is
    // tagging an existing entry (autocomplete / quick chip /
    // auto_match), the entry already has its description from when
    // it was first created — upsertFromTag won't overwrite.
    let canonicalDescription: PersonDescription | PetDescription | null = null;
    if (kind === 'person' && unmatchedPersonCursor < unmatchedPersonDescriptions.length) {
      canonicalDescription =
        unmatchedPersonDescriptions[unmatchedPersonCursor] ?? null;
    } else if (kind === 'pet' && unmatchedPetCursor < unmatchedPetDescriptions.length) {
      canonicalDescription =
        unmatchedPetDescriptions[unmatchedPetCursor] ?? null;
    }

    const entry = upsertFromTag({
      catId,
      name: name.trim(),
      kind,
      photoId: photo.id,
      photoDate: photo.date,
      ...(detected?.description ? { context: detected.description } : {}),
      ...(canonicalDescription
        ? { canonicalDescription }
        : {}),
    });
    const tag: SubjectTag = {
      subject_id: entry.id,
      name: entry.name,
      kind: entry.kind,
      tagged_at: new Date().toISOString(),
    };
    addSubjectToPhoto(catId, photo.id, tag);
    setDraftName('');

    // Walk the unmatched-cursor forward so subsequent tags on the
    // same photo pick up the next unmatched description (only when
    // we actually attached a description).
    if (canonicalDescription) {
      if (kind === 'person') setUnmatchedPersonCursor((c) => c + 1);
      else if (kind === 'pet') setUnmatchedPetCursor((c) => c + 1);
    }

    track({
      type: 'subject_tagged',
      props: {
        kind: entry.kind,
        new_directory_entry: entry.total_appearances === 1,
        source: source === 'auto_match' ? 'detected_chip' : source,
        directory_size_after: allSubjects.length + (entry.total_appearances === 1 ? 1 : 0),
      },
    });
  };

  const onUntag = (tag: SubjectTag) => {
    removeSubjectFromPhoto(catId, photo.id, tag.subject_id);
    removeAppearance(catId, tag.subject_id, photo.id);
    track({
      type: 'subject_untagged',
      props: { kind: tag.kind },
    });
  };

  const onSubmitFreeText = () => {
    if (!trimmed) return;
    // If a directory match exists for the typed name, tag that
    // existing subject (autocomplete-style). Otherwise create a new
    // entry with the picked kind.
    const exact = allSubjects.find(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) {
      applyTag(exact.name, exact.kind, 'autocomplete');
    } else {
      applyTag(trimmed, draftKind, 'free_text');
    }
  };

  const kindIcon = (kind: SubjectKind, color: string) => {
    if (kind === 'pet') return <Dog size={14} color={color} weight="duotone" />;
    if (kind === 'person') return <User size={14} color={color} weight="duotone" />;
    return <CatIcon size={14} color={color} weight="duotone" />;
  };

  // Render as an absolutely-positioned overlay (NOT a Modal) so it
  // can sit safely inside the photo-viewer Modal without triggering
  // RN's nested-Modal / sibling-Modal crash on Android. Modals at
  // the same level on Android are not officially supported and were
  // causing the app to soft-crash to splash when the tag sheet was
  // opened from the photo viewer. By using a regular View overlay,
  // this component is just a child of whatever container hosts it.
  if (!visible) return null;
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="box-none"
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        // iOS: 'padding' adds bottom padding equal to the keyboard
        // height, pushing the flex-end sheet up above it.
        // Android: 'height' shrinks the inner view so the sheet's
        // input + chips remain visible. 'undefined' was the previous
        // value — that relied on the activity's softwareKeyboardLayoutMode:
        // "resize" but this sheet is rendered as an overlay inside
        // the photo-viewer Modal, and Android Modals don't honour
        // that activity-level setting. Result: the keyboard covered
        // the entire input area + tagged chips (user-reported 2026-05-07).
        // 'padding' on Android is documented to misbehave inside Modals
        // (see DailyCheckinCard.tsx for the same lesson) — 'height' is
        // the working pattern.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: space[3],
            }}
          >
            <View style={{ flex: 1 }}>
              <Text token="heading3">Who&apos;s in this photo?</Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Tag people and pets {catName} sees regularly. Names show up in {catName}&apos;s diary.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={t.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingBottom: space[4] }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Auto-matched suggestions (Path 2 — vision-grounded
                cross-photo recognition). Shown FIRST so the most
                likely tags are one-tap-away. The matching is
                approximate (10-attribute description similarity,
                not face recognition), but for a typical 4-8-person
                household it lands ~80-90% of the time. The user
                can still ignore the suggestion and tag manually
                via the sections below. */}
            {autoMatches.length > 0 ? (
              <View
                style={[
                  styles.autoMatchCard,
                  {
                    backgroundColor: t.secondary50,
                    borderColor: t.secondary500,
                  },
                ]}
              >
                <Text token="caption" color="textMuted" style={styles.label}>
                  Looks like
                </Text>
                <Text
                  token="caption"
                  color="textMuted"
                  style={{ marginBottom: space[2], fontSize: 12 }}
                >
                  Tap to confirm — or ignore and tag manually below.
                </Text>
                <View style={styles.chipRow}>
                  {autoMatches.map((m) => (
                    <Pressable
                      key={m.subject_id}
                      onPress={() => applyTag(m.name, m.kind, 'auto_match')}
                      accessibilityLabel={`Tag ${m.name}, suggested by photo recognition`}
                      style={({ pressed }) => [
                        styles.matchChip,
                        {
                          backgroundColor: t.secondary100,
                          borderColor: t.secondary500,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {kindIcon(m.kind, t.secondary700)}
                      <Text
                        token="body"
                        style={{
                          color: t.secondary900,
                          fontFamily: 'Figtree_600SemiBold',
                        }}
                      >
                        {m.name}?
                      </Text>
                      <Text
                        token="caption"
                        color="textMuted"
                        style={{ fontSize: 10 }}
                      >
                        {Math.round(m.score * 100)}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Already-tagged chips */}
            {tagged.length > 0 ? (
              <View style={{ marginBottom: space[3] }}>
                <Text token="caption" color="textMuted" style={styles.label}>
                  Tagged
                </Text>
                <View style={styles.chipRow}>
                  {tagged.map((tag) => (
                    <Pressable
                      key={tag.subject_id}
                      onPress={() => onUntag(tag)}
                      accessibilityLabel={`Remove ${tag.name}`}
                      style={({ pressed }) => [
                        styles.tagChip,
                        {
                          backgroundColor: t.secondary100,
                          borderColor: t.secondary500,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {kindIcon(tag.kind, t.secondary700)}
                      <Text token="caption" style={{ color: t.secondary900 }}>
                        {tag.name}
                      </Text>
                      <X size={12} color={t.secondary700} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Vision-detected unmatched subjects — these are
                people/pets the vision detected that DIDN'T match
                any directory entry. Shows a "+ tag this person"
                prompt so the user can name them; the FIRST such tag
                gets the FIRST unmatched description as its
                canonical_description (anchor for future matching). */}
            {detected && (detectedPeopleCount(detected) > 0 || detectedPetsCount(detected) > 0) ? (
              <View style={{ marginBottom: space[3] }}>
                <Text token="caption" color="textMuted" style={styles.label}>
                  Also in this photo
                </Text>
                <Text
                  token="caption"
                  color="textMuted"
                  style={{ marginTop: 2, marginBottom: space[2] }}
                >
                  {detected.description}
                </Text>
                <View style={styles.chipRow}>
                  {unmatchedPersonDescriptions.length > unmatchedPersonCursor ? (
                    <Pressable
                      onPress={() => setDraftKind('person')}
                      style={({ pressed }) => [
                        styles.suggestChip,
                        {
                          backgroundColor: t.surfaceSunken,
                          borderColor: t.borderStrong,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <User size={14} color={t.textPrimary} weight="duotone" />
                      <Text token="caption" style={{ color: t.textPrimary }}>
                        {unmatchedPersonDescriptions.length - unmatchedPersonCursor === 1
                          ? '+ tag the person'
                          : `+ tag ${unmatchedPersonDescriptions.length - unmatchedPersonCursor} people`}
                      </Text>
                    </Pressable>
                  ) : null}
                  {unmatchedPetDescriptions.length > unmatchedPetCursor ? (
                    <Pressable
                      onPress={() => setDraftKind('pet')}
                      style={({ pressed }) => [
                        styles.suggestChip,
                        {
                          backgroundColor: t.surfaceSunken,
                          borderColor: t.borderStrong,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Dog size={14} color={t.textPrimary} weight="duotone" />
                      <Text token="caption" style={{ color: t.textPrimary }}>
                        {unmatchedPetDescriptions.length - unmatchedPetCursor === 1
                          ? '+ tag the pet'
                          : `+ tag ${unmatchedPetDescriptions.length - unmatchedPetCursor} pets`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Quick-tap chips: top directory entries */}
            {quickChips.length > 0 && trimmed.length === 0 ? (
              <View style={{ marginBottom: space[3] }}>
                <Text token="caption" color="textMuted" style={styles.label}>
                  Quick add
                </Text>
                <View style={styles.chipRow}>
                  {quickChips.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => applyTag(entry.name, entry.kind, 'detected_chip')}
                      accessibilityLabel={`Tag ${entry.name}`}
                      style={({ pressed }) => [
                        styles.quickChip,
                        {
                          backgroundColor: t.surfaceSunken,
                          borderColor: t.borderSubtle,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {kindIcon(entry.kind, t.textSecondary)}
                      <Text token="caption" style={{ color: t.textPrimary }}>
                        {entry.name}
                      </Text>
                      <Text token="caption" color="textMuted" style={{ fontSize: 10 }}>
                        ×{entry.total_appearances}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Free-text input + kind picker */}
            <Text token="caption" color="textMuted" style={styles.label}>
              Add a name
            </Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: t.borderStrong, backgroundColor: t.surface },
              ]}
            >
              {kindIcon(draftKind, t.textSecondary)}
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder={
                  draftKind === 'pet'
                    ? 'e.g. Bella'
                    : draftKind === 'person'
                      ? 'e.g. Mom'
                      : 'e.g. Dr. Vet'
                }
                placeholderTextColor={t.textMuted}
                style={[styles.input, { color: t.textPrimary }]}
                onSubmitEditing={onSubmitFreeText}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            {/* Kind picker — three small toggles. */}
            <View style={[styles.chipRow, { marginTop: space[2] }]}>
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
                    {kindIcon(k, active ? t.secondary700 : t.textSecondary)}
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

            {/* Autocomplete results */}
            {matches.length > 0 ? (
              <View style={{ marginTop: space[3] }}>
                <Text token="caption" color="textMuted" style={styles.label}>
                  From your directory
                </Text>
                <View style={styles.chipRow}>
                  {matches.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => applyTag(entry.name, entry.kind, 'autocomplete')}
                      style={({ pressed }) => [
                        styles.quickChip,
                        {
                          backgroundColor: t.secondary50,
                          borderColor: t.secondary500,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {kindIcon(entry.kind, t.secondary700)}
                      <Text token="caption" style={{ color: t.secondary900 }}>
                        {entry.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Submit button — only enabled when there's a draft. */}
            {trimmed.length > 0 ? (
              <Pressable
                onPress={onSubmitFreeText}
                style={({ pressed }) => [
                  styles.submit,
                  {
                    backgroundColor: t.primary500,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Plus size={16} color={t.textInverse} weight="bold" />
                <Text
                  token="body"
                  style={{
                    color: t.textInverse,
                    fontFamily: 'Figtree_600SemiBold',
                  }}
                >
                  Tag {trimmed} as {draftKind}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          {/* Drag-down handle hint */}
          <View style={{ alignItems: 'center', marginTop: space[2] }}>
            <CaretDown size={14} color={t.textMuted} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  label: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  autoMatchCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  matchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontFamily: 'Figtree_400Regular',
    fontSize: 15,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    marginTop: 16,
  },
});
