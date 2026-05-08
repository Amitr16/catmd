/**
 * Photos screen — gallery view + monthly time-lapse playback.
 *
 * Three regions, all on one ScrollView:
 *   1. Today's strip — thumbnails of all today's photos (no daily
 *      cap as of 2026-05-04 — users take unlimited photos; postcard
 *      samples 3 at random) plus an always-visible "Add" tile.
 *      Empty state shows the value pitch (photos feed postcard /
 *      poster / diary / time-lapse).
 *   2. Monthly sections — newest-first. Each section header has a
 *      "Play time-lapse" button that opens a modal looping through
 *      that month's photos at 400ms/frame.
 *   3. Footer copy explaining what photos enable.
 *
 * The Bond tab's hero photo card is the OTHER capture entry point
 * (same `captureViaImagePicker` helper); both screens write to the
 * same photoStudioStore. There is no other photo capture flow on the
 * Bond side.
 *
 * Reminder: this screen schedules the daily-11am photo notification
 * on first mount (idempotent — re-arms each visit).
 *
 * Native deps lazy-loaded — same defensive pattern as Cat Studio +
 * Cat Diary.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowsCounterClockwise,
  Camera as CameraIcon,
  Cat as CatIcon,
  Dog,
  Pause,
  Play,
  Plus,
  ShareNetwork,
  Trash,
  User as UserIcon,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { SubjectTagSheet } from '../src/components/SubjectTagSheet';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import {
  PICKER_BATCH_LIMIT,
  usePhotoStudioStore,
  usePhotosForCat,
  useTodaysPhotos,
} from '../src/state/photoStudioStore';
import {
  captureViaImagePicker,
  groupByMonth,
  type PhotoStudioPhoto,
} from '../src/services/photoStudio';
import { track } from '../src/services/analytics';
import { useNotifPrefsStore } from '../src/state/notifPrefsStore';
import {
  cancelNotification,
  setDailyPhotoStudioReminder,
} from '../src/services/notifications';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

// Frame interval for time-lapse playback. 1200ms / frame lets the user
// actually look at each photo before it moves on; the previous 400ms
// flipbook felt too fast — half the photos blurred into each other.
// Each frame transitions in via a 350ms opacity fade for visual
// softness (no instant snap between very different photos).
const TIMELAPSE_FRAME_MS = 1200;
const TIMELAPSE_FADE_MS = 350;

export default function PhotoStudioScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();

  const todaysPhotos = useTodaysPhotos(cat?.id);
  const allPhotos = usePhotosForCat(cat?.id);
  const dailyCount = todaysPhotos.length;
  const addPhoto = usePhotoStudioStore((s) => s.addPhoto);
  const deletePhoto = usePhotoStudioStore((s) => s.deletePhoto);

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Viewer + time-lapse modal state. Shared so the two affordances
  // (tap thumbnail = single, play button = time-lapse) feel consistent.
  const [viewerPhoto, setViewerPhoto] = useState<PhotoStudioPhoto | null>(null);
  const [timelapse, setTimelapse] = useState<{
    monthKey: string;
    photos: PhotoStudioPhoto[];
  } | null>(null);

  // Subject-tag sheet state — lifted from PhotoViewer to the screen
  // root because RN's nested-Modal behavior on Android often fails
  // to render the inner sheet. Holds the photo currently being
  // tagged; null when the sheet is dismissed.
  const [tagSheetTarget, setTagSheetTarget] = useState<PhotoStudioPhoto | null>(null);

  const catName = cat?.name ?? 'your cat';

  // Build the monthly-buckets render once per photos change. groupByMonth
  // is O(N), N capped at 365 — cheap enough to recompute on every render.
  const months = useMemo(() => groupByMonth(allPhotos), [allPhotos]);

  // Telemetry on mount — surface "is this feature getting opened?" +
  // funnel signal (does empty-vs-some-photos predict drop-off).
  useEffect(() => {
    if (!cat?.id) return;
    track({
      type: 'photo_studio_opened',
      props: { photo_count: allPhotos.length, has_today: todaysPhotos.length > 0 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Schedule the daily 11am photo reminder on first visit. Idempotent —
  // re-arms each visit so cat-name renames flow through. Honours the
  // notifPrefsStore.daily_photo_studio toggle.
  useEffect(() => {
    if (!cat?.id) return;
    const prefs = useNotifPrefsStore.getState();
    const oldId = prefs.getScheduledId(cat.id, 'daily_photo_studio');
    void (async () => {
      try {
        await cancelNotification(oldId);
        if (!prefs.enabled.daily_photo_studio) {
          prefs.setScheduledId(cat.id, 'daily_photo_studio', null);
          return;
        }
        const newId = await setDailyPhotoStudioReminder({
          catName: cat.name,
          catId: cat.id,
        });
        prefs.setScheduledId(cat.id, 'daily_photo_studio', newId);
      } catch (e) {
        console.warn('[PhotoStudio] reminder schedule failed:', e);
      }
    })();
  }, [cat?.id, cat?.name]);

  /**
   * Action-sheet style picker for today's photo. Uses Alert.alert with
   * three options on Android (no-op on iOS would be a separate path; we
   * ship Android first). Native deps lazy-loaded.
   */
  const onTakePhoto = () => {
    if (!cat?.id || adding) return;
    Alert.alert(
      'Add a photo',
      `Snap a fresh photo of ${catName} or pick one from your gallery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => void capture('camera') },
        { text: 'Gallery', onPress: () => void capture('gallery') },
      ],
    );
  };

  const capture = async (source: 'camera' | 'gallery') => {
    if (!cat?.id) return;
    setAdding(true);
    setError(null);
    try {
      // Picker batch limit: a session-level cap (not daily). Users
      // can run the picker repeatedly to add more. Camera path always
      // single-shot; gallery path multi-select up to PICKER_BATCH_LIMIT.
      const picked = await captureViaImagePicker({
        source,
        selectionLimit: PICKER_BATCH_LIMIT,
      });
      if (picked.length === 0) {
        // User cancelled — silent no-op.
        return;
      }

      // Insert each picked photo. The store's daily-cap eviction
      // handles the edge case where multiple photos overflow the
      // cap (oldest today's gets evicted FIFO). For the multi-select
      // path the native picker already capped us, so this is rare.
      let lastAddedPhoto: PhotoStudioPhoto | null = null;
      let anyReplaced = false;
      for (const p of picked) {
        const { photo, replaced_existing_today } = await addPhoto({
          catId: cat.id,
          sourceUri: p.uri,
          source,
          ...(p.width != null ? { width: p.width } : {}),
          ...(p.height != null ? { height: p.height } : {}),
        });
        lastAddedPhoto = photo;
        if (replaced_existing_today) anyReplaced = true;
      }

      track({
        type: 'photo_studio_photo_added',
        props: {
          source,
          // For multi-select, "replaced_existing" reflects whether
          // ANY of the additions caused a daily-cap eviction.
          replaced_existing: anyReplaced,
          total_after: allPhotos.length + picked.length - (anyReplaced ? 1 : 0),
        },
      });

      // Auto-open the viewer with the LAST photo so the user gets
      // immediate satisfaction. Skip when multi-select to avoid
      // popping a viewer over a fresh batch.
      if (lastAddedPhoto && picked.length === 1) {
        setViewerPhoto(lastAddedPhoto);
      }
    } catch (e) {
      console.warn('[PhotoStudio] capture failed:', e);
      const reason = e instanceof Error ? e.message : 'unknown';
      setError(`Couldn't add the photo — ${reason.slice(0, 100)}`);
    } finally {
      setAdding(false);
    }
  };

  const onDeletePhoto = (photo: PhotoStudioPhoto) => {
    if (!cat?.id) return;
    Alert.alert(
      'Delete this photo?',
      "It'll be removed from the time-lapse — this can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deletePhoto(cat.id, photo.id);
              setViewerPhoto((cur) => (cur?.id === photo.id ? null : cur));
              track({
                type: 'photo_studio_photo_deleted',
                props: { total_after: Math.max(0, allPhotos.length - 1) },
              });
            })();
          },
        },
      ],
    );
  };

  const onSharePhoto = async (photo: PhotoStudioPhoto) => {
    try {
      const Sharing = await import('expo-sharing');
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        setError('Sharing not available on this device');
        return;
      }
      await Sharing.shareAsync(photo.uri, {
        dialogTitle: `Share ${catName}'s photo`,
        mimeType: 'image/jpeg',
      });
      track({ type: 'photo_studio_photo_shared', props: {} });
    } catch (e) {
      console.warn('[PhotoStudio] share failed:', e);
    }
  };

  const onPlayMonth = (monthKey: string, photos: PhotoStudioPhoto[]) => {
    // Time-lapse plays oldest → newest (chronological evolution feels
    // right). The bucket comes in newest-first; reverse for playback.
    setTimelapse({ monthKey, photos: [...photos].reverse() });
    track({
      type: 'photo_studio_month_played',
      props: { month_key: monthKey, photo_count: photos.length },
    });
  };

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={{ padding: space[6] }}>
          <Text token="body" color="textMuted">Add a cat first — Settings → Manage cats.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} title={`${catName}'s Photos`} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* === TODAY'S CARD === */}
        <Text
          token="caption"
          color="textMuted"
          style={{ letterSpacing: 1.4, textTransform: 'uppercase', marginTop: space[5], marginBottom: space[2] }}
        >
          Today
        </Text>
        {todaysPhotos.length > 0 ? (
          <TodayStrip
            photos={todaysPhotos}
            catName={catName}
            dailyCount={dailyCount}
            onView={(p) => setViewerPhoto(p)}
            onAddMore={onTakePhoto}
            adding={adding}
          />
        ) : (
          <EmptyTodayCard
            catName={catName}
            isFirstPhoto={allPhotos.length === 0}
            onTakePhoto={onTakePhoto}
            adding={adding}
          />
        )}

        {error ? (
          <View
            style={[
              styles.errorRow,
              { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle, marginTop: space[3] },
            ]}
          >
            <WarningCircle size={16} color={t.warning} />
            <Text token="caption" color="textMuted" style={{ flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {/* === MONTHLY SECTIONS === */}
        {months.map((bucket) => (
          <View key={bucket.monthKey} style={{ marginTop: space[8] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: space[3],
              }}
            >
              <View style={{ flex: 1 }}>
                <Text token="heading2">{bucket.label}</Text>
                <Text token="caption" color="textMuted">
                  {bucket.photos.length} photo{bucket.photos.length === 1 ? '' : 's'}
                </Text>
              </View>
              {bucket.photos.length >= 2 ? (
                <Pressable
                  onPress={() => onPlayMonth(bucket.monthKey, bucket.photos)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.playPill,
                    {
                      backgroundColor: t.secondary100,
                      borderColor: t.secondary500,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Play size={14} color={t.secondary900} weight="fill" />
                  <Text
                    token="caption"
                    style={{ color: t.secondary900, fontFamily: 'Figtree_600SemiBold' }}
                  >
                    Play time-lapse
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.grid}>
              {bucket.photos.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setViewerPhoto(p)}
                  style={({ pressed }) => [
                    styles.thumb,
                    { borderColor: t.borderSubtle, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Image source={{ uri: p.uri }} style={styles.thumbImage} />
                  <View style={styles.thumbDateBadge}>
                    <Text token="caption" style={{ color: '#fff', fontSize: 10, fontFamily: 'Figtree_600SemiBold' }}>
                      {formatDayLabel(p.date)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* === FOOTER COPY for empty state === */}
        {allPhotos.length === 0 ? (
          <Text
            token="caption"
            color="textMuted"
            style={{ marginTop: space[8], textAlign: 'center', lineHeight: 18 }}
          >
            One photo a day. We&apos;ll group them by month and let you play back
            the time-lapse — it&apos;s the simplest way to see {catName} change.
          </Text>
        ) : null}
      </ScrollView>

      {/* === VIEWER MODAL ===
          The PhotoViewer is hosted in a Modal. The tag sheet is a
          regular View overlay (not a Modal — see SubjectTagSheet.tsx)
          rendered inside this same Modal alongside the PhotoViewer.
          This avoids both nested-Modal and sibling-Modal crashes on
          Android.
          IMPORTANT: children must be wrapped in a single View root
          (not a Fragment) — RN Modal's Android implementation uses
          the first child's layout box for measurement; a Fragment
          confuses that path and crashes on tag-sheet open. */}
      <Modal
        visible={!!viewerPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerPhoto(null)}
      >
        {viewerPhoto && cat?.id ? (
          <View style={{ flex: 1 }}>
            <PhotoViewer
              photo={viewerPhoto}
              catName={catName}
              catId={cat.id}
              onClose={() => setViewerPhoto(null)}
              onDelete={() => onDeletePhoto(viewerPhoto)}
              onShare={() => void onSharePhoto(viewerPhoto)}
              onRequestTag={() => setTagSheetTarget(viewerPhoto)}
            />
            {/* Tag sheet — overlay View on top of the PhotoViewer.
                Visibility controlled by parent state so the sheet
                survives PhotoViewer's internal renders. */}
            {tagSheetTarget ? (
              <SubjectTagSheet
                visible={!!tagSheetTarget}
                photo={tagSheetTarget}
                catId={cat.id}
                catName={catName}
                onClose={() => setTagSheetTarget(null)}
              />
            ) : null}
          </View>
        ) : null}
      </Modal>

      {/* === TIME-LAPSE MODAL === */}
      <Modal
        visible={!!timelapse}
        animationType="fade"
        transparent
        onRequestClose={() => setTimelapse(null)}
      >
        {timelapse ? (
          <TimelapsePlayer
            monthLabel={
              months.find((b) => b.monthKey === timelapse.monthKey)?.label ?? timelapse.monthKey
            }
            photos={timelapse.photos}
            onClose={() => setTimelapse(null)}
          />
        ) : null}
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
        <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
      </Pressable>
      <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
        {title ?? 'Photos'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

function EmptyTodayCard({
  catName,
  isFirstPhoto,
  onTakePhoto,
  adding,
}: {
  catName: string;
  isFirstPhoto: boolean;
  onTakePhoto: () => void;
  adding: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.emptyToday,
        { backgroundColor: t.secondary100, borderColor: t.secondary500 },
      ]}
    >
      <View
        style={[
          styles.emptyBadge,
          { backgroundColor: t.surfaceElevated, borderColor: t.secondary500 },
        ]}
      >
        <CameraIcon size={28} color={t.secondary700} weight="duotone" />
      </View>
      <Text token="heading2" style={{ marginTop: space[3], textAlign: 'center' }}>
        {isFirstPhoto
          ? `Snap your first photo of ${catName}.`
          : `No photos yet today.`}
      </Text>
      <Text
        token="body"
        color="textMuted"
        style={{ marginTop: space[2], textAlign: 'center', lineHeight: 22, maxWidth: 320 }}
      >
        Photos here build {catName} bit by bit. They power today&apos;s postcard, this week&apos;s movie
        poster, the diary&apos;s vision, and the monthly time-lapse. One thing
        creates everything else.
      </Text>
      <Button
        label={adding ? 'Adding…' : 'Take a photo'}
        onPress={onTakePhoto}
        disabled={adding}
        leftIcon={<CameraIcon size={18} color={t.textInverse} weight="bold" />}
        style={{ marginTop: space[5] }}
        size="md"
        pill
      />
    </View>
  );
}

/**
 * Today's photos strip — horizontal row of thumbnails (newest-first)
 * plus an "Add" tile (always visible — daily cap was removed
 * 2026-05-04). Tap a thumbnail to open the viewer; tap Add to invoke
 * the picker action sheet.
 */
function TodayStrip({
  photos,
  catName,
  dailyCount,
  onView,
  onAddMore,
  adding,
}: {
  photos: PhotoStudioPhoto[];
  catName: string;
  dailyCount: number;
  onView: (p: PhotoStudioPhoto) => void;
  onAddMore: () => void;
  adding: boolean;
}) {
  const t = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[3] }}>
        <Text
          token="caption"
          color="textMuted"
          style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}
        >
          Today
        </Text>
        <Text token="caption" color="textMuted">
          {dailyCount} {dailyCount === 1 ? 'photo' : 'photos'}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingRight: space[5] }}>
        {/* Add tile FIRST so the camera CTA stays visible without
            horizontal scrolling — daily ritual is "snap a photo,"
            putting it before existing thumbnails keeps it the most-
            prominent thing on the strip. */}
        <Pressable
          onPress={onAddMore}
          disabled={adding}
          style={({ pressed }) => [
            styles.todayAddTile,
            {
              backgroundColor: t.secondary100,
              borderColor: t.secondary500,
              opacity: pressed || adding ? 0.7 : 1,
            },
          ]}
        >
          <CameraIcon size={26} color={t.secondary700} weight="duotone" />
          <Text
            token="caption"
            style={{ color: t.secondary900, fontFamily: 'Figtree_600SemiBold', marginTop: 4, fontSize: 11 }}
          >
            {adding ? 'Adding…' : 'Add'}
          </Text>
        </Pressable>
        {photos.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onView(p)}
            style={({ pressed }) => [
              styles.todayThumb,
              { borderColor: t.borderSubtle, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Image source={{ uri: p.uri }} style={styles.todayThumbImage} />
          </Pressable>
        ))}
      </ScrollView>
      <Text
        token="caption"
        color="textMuted"
        style={{ marginTop: space[3], lineHeight: 16 }}
      >
        With every photo, {catName} comes more to life in here. The diary, postcards, and posters all draw from these.
      </Text>
    </View>
  );
}

function PhotoViewer({
  photo,
  catName,
  catId,
  onClose,
  onDelete,
  onShare,
  onRequestTag,
}: {
  photo: PhotoStudioPhoto;
  catName: string;
  catId: string;
  onClose: () => void;
  onDelete: () => void;
  onShare: () => void;
  /** Asks the parent screen to open the subject-tag sheet. Lifted to
      parent because nested Modals fail to render reliably on Android. */
  onRequestTag: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Subscribe to the LIVE photo record so newly-added tags + the
  // async detected_subjects update without forcing the user to
  // close + reopen the viewer.
  const livePhoto = usePhotoStudioStore((s) => {
    const list = s.photos[catId] ?? [];
    return list.find((p) => p.id === photo.id) ?? photo;
  });
  const tags = livePhoto.subjects ?? [];
  const detected = livePhoto.detected_subjects;
  // detected.people/pets is `unknown` (v1 was number, v2 is array)
  // — runtime-check what's there. Same helpers as SubjectTagSheet.
  const peopleCount = !detected
    ? 0
    : Array.isArray(detected.people)
      ? detected.people.length
      : typeof detected.people === 'number'
        ? detected.people
        : 0;
  const petsCount = !detected
    ? 0
    : Array.isArray(detected.pets)
      ? detected.pets.length
      : typeof detected.pets === 'number'
        ? detected.pets
        : 0;
  const detectedHasOthers = peopleCount > 0 || petsCount > 0;

  return (
    <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.modalIconBtn}>
          <X size={24} color="#fff" weight="regular" />
        </Pressable>
        <Text token="body" style={{ color: '#fff', flex: 1, textAlign: 'center', fontFamily: 'Figtree_600SemiBold' }}>
          {formatLongDate(livePhoto.date)}
        </Text>
        <View style={styles.modalIconBtn} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Image source={{ uri: livePhoto.uri }} style={styles.viewerImage} resizeMode="contain" />
      </View>

      {/* Subject tag strip — Google Photos-style row of names below the
          image. Tap a chip to open the sheet (re-tag / untag); tap the
          "+ Tag" affordance when nothing is tagged yet. The strip
          surfaces a subtle "+ tag who's here" prompt when vision has
          detected people / other pets but the user hasn't tagged them. */}
      <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: space[5] }}
        >
          <Pressable
            onPress={() => onRequestTag()}
            style={({ pressed }) => [
              styles.tagPill,
              {
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderColor: 'rgba(255,255,255,0.3)',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Plus size={12} color="#fff" weight="bold" />
            <Text token="caption" style={{ color: '#fff' }}>
              {tags.length === 0
                ? detectedHasOthers
                  ? 'Tag who’s here'
                  : 'Tag people & pets'
                : 'Tag more'}
            </Text>
          </Pressable>
          {tags.map((tag) => (
            <Pressable
              key={tag.subject_id}
              onPress={() => onRequestTag()}
              style={({ pressed }) => [
                styles.tagPill,
                {
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  borderColor: 'rgba(255,255,255,0.85)',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {tag.kind === 'pet' ? (
                <Dog size={12} color={t.textPrimary} weight="duotone" />
              ) : tag.kind === 'person' ? (
                <UserIcon size={12} color={t.textPrimary} weight="duotone" />
              ) : (
                <CatIcon size={12} color={t.textPrimary} weight="duotone" />
              )}
              <Text
                token="caption"
                style={{ color: t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}
              >
                {tag.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flexDirection: 'row', gap: space[3], padding: space[5] }}>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [
            styles.modalActionBtn,
            { borderColor: 'rgba(255,255,255,0.3)', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Trash size={18} color="#fff" />
          <Text token="caption" style={{ color: '#fff', fontFamily: 'Figtree_600SemiBold' }}>
            Delete
          </Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => [
            styles.modalActionBtn,
            {
              backgroundColor: t.secondary500,
              borderColor: t.secondary500,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <ShareNetwork size={18} color="#fff" weight="bold" />
          <Text token="caption" style={{ color: '#fff', fontFamily: 'Figtree_600SemiBold' }}>
            Share
          </Text>
        </Pressable>
      </View>
      <Text
        token="caption"
        style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingHorizontal: space[5], paddingBottom: space[2] }}
      >
        {catName} · {livePhoto.source === 'camera' ? 'taken with camera' : 'from gallery'}
      </Text>
    </View>
  );
}

function TimelapsePlayer({
  monthLabel,
  photos,
  onClose,
}: {
  monthLabel: string;
  photos: PhotoStudioPhoto[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Animated opacity for the soft fade-in of each new frame. Snapped to
  // 0.4 on frame change, then animates to 1.0 over TIMELAPSE_FADE_MS.
  // Soft cross-fade without needing two stacked Images.
  const fadeOpacity = useRef(new Animated.Value(1)).current;

  // Frame advance — STOPS at the last photo instead of looping. User
  // tapping Replay restarts from index 0. Single-photo edge case never
  // reaches this component (play button hidden when bucket <2).
  useEffect(() => {
    if (!playing || finished) return;
    intervalRef.current = setInterval(() => {
      setIndex((i) => {
        const next = i + 1;
        if (next >= photos.length) {
          // Reached the end — stay on the last frame, mark finished
          // so the controls swap to Replay. clearing the interval
          // happens via the cleanup below on the next effect run.
          setPlaying(false);
          setFinished(true);
          return i;
        }
        return next;
      });
    }, TIMELAPSE_FRAME_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, finished, photos.length]);

  // Soft fade-in on every index change. We don't need useNativeDriver
  // false fallback — opacity is a transform RN supports natively.
  useEffect(() => {
    fadeOpacity.setValue(0.4);
    Animated.timing(fadeOpacity, {
      toValue: 1,
      duration: TIMELAPSE_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [index, fadeOpacity]);

  const current = photos[index];

  const onPlayPause = () => {
    if (finished) {
      // Replay from start.
      setIndex(0);
      setFinished(false);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  return (
    <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.modalIconBtn}>
          <X size={24} color="#fff" weight="regular" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text token="body" style={{ color: '#fff', fontFamily: 'Figtree_600SemiBold' }}>
            {monthLabel}
          </Text>
          <Text token="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {index + 1} / {photos.length}
          </Text>
        </View>
        <View style={styles.modalIconBtn} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {current ? (
          <Animated.Image
            source={{ uri: current.uri }}
            style={[styles.viewerImage, { opacity: fadeOpacity }]}
            resizeMode="contain"
          />
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>

      {/* Play / pause / replay toggle. Replay shows when we've reached
          the end; otherwise toggles play vs pause. */}
      <View style={{ alignItems: 'center', padding: space[5] }}>
        <Pressable
          onPress={onPlayPause}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            finished ? 'Replay time-lapse' : playing ? 'Pause time-lapse' : 'Play time-lapse'
          }
          style={({ pressed }) => [
            styles.playToggle,
            {
              backgroundColor: 'rgba(255,255,255,0.15)',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {finished ? (
            <ArrowsCounterClockwise size={28} color="#fff" weight="fill" />
          ) : playing ? (
            <Pause size={28} color="#fff" weight="fill" />
          ) : (
            <Play size={28} color="#fff" weight="fill" />
          )}
        </Pressable>
        <Text
          token="caption"
          style={{ color: 'rgba(255,255,255,0.6)', marginTop: space[3] }}
        >
          {finished
            ? 'End — tap to replay'
            : current
              ? formatLongDate(current.date)
              : ''}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Short day label for thumbnail badges, e.g. "12" or "May 12". */
function formatDayLabel(yyyymmdd: string): string {
  const [, , d] = yyyymmdd.split('-').map((s) => parseInt(s, 10));
  return d ? String(d) : yyyymmdd;
}

/** Long, human label for the viewer header, e.g. "Friday, May 1". */
function formatLongDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return yyyymmdd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyToday: {
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayThumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  todayThumbImage: {
    width: '100%',
    height: '100%',
  },
  todayAddTile: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  thumb: {
    // 4-column grid: ((100% - 3*gap) / 4). At 16px gap that's roughly 23%
    // of the parent width; expressing it as a percentage-ish flex avoids
    // querying screen size on every render.
    width: '23.5%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbDateBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  modalIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  playToggle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
