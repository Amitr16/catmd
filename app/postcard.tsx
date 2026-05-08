/**
 * Postcard screen — the social-sharing surface of the Bond pillar.
 *
 * Shows today's photo collage + AI-generated caption (editable). User
 * can tweak the caption, toggle between square and story format, then
 * share to Instagram / TikTok / Twitter / etc. via the native share
 * sheet.
 *
 * Trigger logic on mount:
 *   1. Today's postcard cached → display it
 *   2. No postcard cached AND ≥1 photo today → auto-generate
 *   3. No photos today → empty state with "Take a photo" CTA pointing
 *      at the cat-profile photo picker (the simplest existing photo
 *      capture flow)
 *
 * Native deps lazy-loaded (react-native-view-shot, expo-sharing,
 * expo-file-system) — same defensive pattern as Cat Studio + Cat Diary
 * after the white-screen incident.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  ArrowsClockwise,
  Camera,
  ShareNetwork,
  WarningCircle,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import {
  usePostcardGenerating,
  usePostcardStore,
  usePostcardsForCat,
  useTodaysPostcard,
} from '../src/state/postcardStore';
import {
  PostcardShareCard,
  POSTCARD_DIMS,
  type PostcardFormat,
} from '../src/components/PostcardShareCard';
import { POSTCARD_CAPTION_PROMPT_VERSION } from '../src/services/postcard';
import { usePhotoStudioStore } from '../src/state/photoStudioStore';
import { localDateKey } from '../src/services/photoStudio';
import { track } from '../src/services/analytics';
import { useNotifPrefsStore } from '../src/state/notifPrefsStore';
import {
  cancelNotification,
  setDailyPostcardReminder,
} from '../src/services/notifications';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function PostcardScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const todaysPostcard = useTodaysPostcard(cat?.id);
  const allPostcards = usePostcardsForCat(cat?.id); // newest-first, cached up to 90 days
  const generating = usePostcardGenerating(cat?.id);
  const generateForToday = usePostcardStore((s) => s.generateForToday);
  const updateCaption = usePostcardStore((s) => s.updateCaption);

  // Which postcard is the user currently viewing/editing? null = today's.
  // History strip taps set this to a past postcard's id; "Make today's"
  // resets to null. Decoupled from todaysPostcard so the user can flip
  // back without losing their place.
  const [viewingPostcardId, setViewingPostcardId] = useState<string | null>(null);
  const activePostcard = viewingPostcardId
    ? allPostcards.find((p) => p.id === viewingPostcardId) ?? todaysPostcard
    : todaysPostcard;
  const isViewingPast = !!viewingPostcardId && activePostcard?.id !== todaysPostcard?.id;

  // Editable caption — initialized from active postcard, kept in sync.
  const [editedCaption, setEditedCaption] = useState('');
  const [format, setFormat] = useState<PostcardFormat>('square');
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Tracks whether we've ever found "no photos today" so we can show
  // the right empty state vs the loading state.
  const [emptyDay, setEmptyDay] = useState(false);

  const shareCardRef = useRef<View>(null);

  const catName = cat?.name ?? 'your cat';

  // Telemetry
  useEffect(() => {
    if (!cat?.id) return;
    track({
      type: 'postcard_opened',
      props: { had_today_cached: !!todaysPostcard },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Comprehensive postcard health check on mount. Replaces the old
  // caption-only migration with the full set of failure modes:
  //
  //   1. Stale caption (v1 prompt, "Today, I..." opener, length > 100)
  //   2. Missing photo dims — needed for orientation-aware tiling
  //   3. Dead photo URIs — user deleted gallery photos AFTER the
  //      postcard was generated; the cached photos[] array still has
  //      file:// paths that no longer exist on disk, so the rendered
  //      collage shows dark fallback cells (looks like "0 photos")
  //   4. Photo-count mismatch — gallery has different photo count than
  //      the cached postcard, e.g. user added more photos today
  //
  // Recovery:
  //   - If gallery has photos: hydrate any missing dims + force regen
  //     the postcard. New postcard will have fresh URIs + dims, so the
  //     smart-layout picker fires and the export captures bright.
  //   - If gallery is now empty: clear today's cached postcard so the
  //     screen falls through to the empty-state CTA instead of
  //     rendering broken images.
  //
  // Ref guard: tracks the postcard id we've already migrated, so we
  // don't loop if regen produces another postcard that somehow still
  // fails one of the checks. Per-id, so a fresh postcard generated
  // today (different id) gets its own one-shot pass.
  const autoMigratedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!cat?.id || !todaysPostcard) return;
    const catId = cat.id;
    const tp = todaysPostcard;
    if (autoMigratedIdsRef.current.has(tp.id)) return;

    void (async () => {
      // 1. Caption staleness
      const v = tp.caption_prompt_version ?? 1;
      const isStaleCaption =
        v < POSTCARD_CAPTION_PROMPT_VERSION ||
        /^today\b/i.test(tp.caption.trim()) ||
        tp.caption.length > 100;

      // 2. Missing dims — old postcards before width/height threading
      const hasMissingDims = tp.photos.some((p) => !p.width || !p.height);

      // 3. Dead URIs — files referenced by the postcard no longer exist.
      //    expo-file-system is lazy-loaded so a missing native module
      //    never breaks the screen.
      let hasDeadUri = false;
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const checks = await Promise.all(
          tp.photos.map(async (p) => {
            try {
              const info = await FileSystem.getInfoAsync(p.uri);
              return info.exists;
            } catch {
              return false;
            }
          }),
        );
        hasDeadUri = checks.some((exists) => !exists);
      } catch (e) {
        console.warn('[Postcard] dead-URI check failed:', e);
      }

      // 4. Gallery-count mismatch — user added/removed photos since
      //    the postcard was generated.
      const galleryToday = usePhotoStudioStore
        .getState()
        .getPhotosForDate(catId, localDateKey());
      const galleryCount = galleryToday.length;
      const expectedCount = Math.min(galleryCount, 4); // matches gatherTodaysPhotos max=4
      const countMismatch = expectedCount !== tp.photos.length;

      const needsAttention =
        isStaleCaption || hasMissingDims || hasDeadUri || countMismatch;
      if (!needsAttention) return;

      autoMigratedIdsRef.current.add(tp.id);

      // If the gallery is now empty, clear today's cached postcard so
      // the screen renders the empty-state CTA. Without this, the
      // user sees a postcard with stale broken-image cells.
      if (galleryCount === 0) {
        usePostcardStore.getState().clearTodayForCat(catId);
        setEmptyDay(true);
        return;
      }

      // Hydrate any photos missing dims BEFORE regen so the new
      // postcard can read them off the gallery store and produce a
      // smart layout.
      try {
        await usePhotoStudioStore.getState().hydratePhotoDims(catId);
      } catch (e) {
        console.warn('[Postcard] hydratePhotoDims failed:', e);
      }

      // Force-regen. If the gallery has photos but generation fails
      // for another reason, the catch logs it; the user can still
      // tap the manual "Refresh" button.
      try {
        await generateForToday(catId, { force: true });
      } catch (e) {
        console.warn('[Postcard] silent migration regen failed:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id, todaysPostcard?.id]);

  // Schedule the daily 7pm postcard reminder on first visit. Idempotent
  // — re-arms each visit so the cat's current name is in the body
  // (handles renames). Honours notifPrefsStore.enabled.postcard_ready.
  useEffect(() => {
    if (!cat?.id) return;
    const prefs = useNotifPrefsStore.getState();
    const oldId = prefs.getScheduledId(cat.id, 'postcard_ready');
    void (async () => {
      try {
        await cancelNotification(oldId);
        if (!prefs.enabled.postcard_ready) {
          prefs.setScheduledId(cat.id, 'postcard_ready', null);
          return;
        }
        const newId = await setDailyPostcardReminder({
          catName: cat.name,
          catId: cat.id,
        });
        prefs.setScheduledId(cat.id, 'postcard_ready', newId);
      } catch (e) {
        console.warn('[Postcard] reminder schedule failed:', e);
      }
    })();
  }, [cat?.id, cat?.name]);

  // Auto-generate if not cached AND there are photos today
  useEffect(() => {
    if (!cat?.id) return;
    if (todaysPostcard) return;
    if (generating) return;
    setError(null);
    void generateForToday(cat.id)
      .then((p) => {
        if (!p) setEmptyDay(true);
      })
      .catch((e) => {
        console.warn('[Postcard] auto-generate failed:', e);
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't generate a postcard — try again.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Sync the editable text field with whatever postcard is active —
  // either today's (default) or a past postcard the user tapped from
  // the history strip. Re-fires whenever the active card changes.
  useEffect(() => {
    if (activePostcard) {
      setEditedCaption(activePostcard.caption);
      setEmptyDay(false);
    }
  }, [activePostcard?.id, activePostcard?.caption]);

  // Persist caption edits back to the store on blur — works for both
  // today's postcard AND past ones in history (user can tweak an old
  // postcard and re-share it later).
  const onCaptionBlur = () => {
    if (!cat?.id || !activePostcard) return;
    if (editedCaption.trim() === activePostcard.caption) return;
    updateCaption(cat.id, activePostcard.date, editedCaption.trim());
    track({
      type: 'postcard_caption_edited',
      props: {
        char_diff: Math.abs(editedCaption.length - activePostcard.caption_ai_original.length),
      },
    });
  };

  const onResetToAI = () => {
    if (!activePostcard) return;
    setEditedCaption(activePostcard.caption_ai_original);
    if (cat?.id) {
      updateCaption(cat.id, activePostcard.date, activePostcard.caption_ai_original);
    }
  };

  /** Tap a past postcard in the history strip — flip the main view to it. */
  const onSelectPostcard = (postcardId: string) => {
    setViewingPostcardId(postcardId);
    setError(null);
  };

  /** Reset back to today's postcard from a past view. */
  const onReturnToToday = () => {
    setViewingPostcardId(null);
    setError(null);
  };

  /**
   * Refresh — re-pulls today's photos from the gallery AND regenerates
   * the caption. The caption regen is essential for users with cached
   * postcards from before the prompt rewrite (those captions started
   * with "Today, I observed..." — long, journal-style, exactly what
   * the new prompt forbids). One tap fixes both photos and caption.
   *
   * The user previously asked us to remove the standalone "regenerate"
   * button, so this is the only path to a fresh caption — coupled with
   * a fresh photo pull, which feels like the unified "fix this
   * postcard" action it should be.
   */
  const [refreshingPhotos, setRefreshingPhotos] = useState(false);
  const onRefreshPhotos = async () => {
    if (!cat?.id || refreshingPhotos) return;
    setRefreshingPhotos(true);
    setError(null);
    try {
      // `force: true` re-pulls photos AND regenerates the caption from
      // scratch. The screen-level useEffect that syncs `editedCaption`
      // to `activePostcard.caption` will pick up the new caption when
      // the cache updates.
      const updated = await generateForToday(cat.id, { force: true });
      if (!updated) {
        // No photos in gallery today after all — surface the empty state.
        setEmptyDay(true);
      }
    } catch (e) {
      console.warn('[Postcard] refresh failed:', e);
      setError(
        e instanceof Error ? e.message : "Couldn't refresh. Try again.",
      );
    } finally {
      setRefreshingPhotos(false);
    }
  };

  /**
   * Share — capture the off-screen PostcardShareCard at full
   * 1080×{1080|1920} and ship to the native share sheet. Native deps
   * lazy-loaded; defensive against module-link failures.
   */
  const onShare = async () => {
    if (!activePostcard || !cat?.id || sharing) return;
    setSharing(true);
    setError(null);
    try {
      // Persist any pending edits before capture so the share asset
      // matches what the user last typed. Works for today's AND past
      // postcards — user can revisit history and re-share.
      if (editedCaption.trim() && editedCaption.trim() !== activePostcard.caption) {
        updateCaption(cat.id, activePostcard.date, editedCaption.trim());
      }

      let captureRef: typeof import('react-native-view-shot').captureRef;
      let Sharing: typeof import('expo-sharing');
      try {
        ({ captureRef } = await import('react-native-view-shot'));
        Sharing = await import('expo-sharing');
      } catch (loadErr) {
        console.warn('[Postcard] native share modules failed to load:', loadErr);
        throw new Error('Sharing is not available on this build');
      }

      // Pre-decode every photo URI before triggering the capture. On
      // Android, view-shot can return BEFORE Image components have
      // finished decoding their source — producing a frame where the
      // photos are missing entirely (just the cell background colour
      // shows through). Image.prefetch primes the in-memory bitmap
      // cache so the offscreen mount renders fully on first frame.
      // file:// URIs are supported by RN's prefetch on both platforms.
      try {
        await Promise.all(
          activePostcard.photos.map((p) =>
            (require('react-native').Image as { prefetch?: (uri: string) => Promise<boolean> })
              .prefetch?.(p.uri)
              .catch(() => false),
          ),
        );
      } catch {
        // Prefetch is best-effort; capture continues even if it fails.
      }
      // Wait long enough for RN to mount the offscreen view, run
      // layout, AND for each <Image> to paint its decoded bitmap. The
      // previous 2-RAF wait (~32ms) wasn't enough on slower Android
      // devices — capture fired before pixels existed and produced
      // empty cells. 350ms is generous; user-perceptible delay sits
      // just under the 400ms "instant" threshold.
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      if (!shareCardRef.current) throw new Error('Share-card not mounted');
      const dims = POSTCARD_DIMS[format];
      // JPEG capture configuration — tuned 2026-05-03 to fix the
      // "WhatsApp export looks dimmer than the in-app preview" issue:
      //
      //   - quality: 1.0 (was 0.95). Truly lossless. The 5% size bump
      //     is negligible for a single share asset.
      //   - width/height: explicit 1080×1080. With both set, the lib
      //     produces a bitmap of exactly that size regardless of the
      //     device's pixel ratio — important for cross-device consistency.
      //   - format: 'jpg' with sRGB metadata. Stays JPEG for cross-app
      //     consistency (PNG had wide-gamut / colour-profile issues on
      //     older Android receivers).
      //
      // The biggest dark-export fixes happened in PostcardShareCard:
      // dropping LinearGradient (Android view-shot rasterises gradients
      // darker than the live render) and switching PHOTO_FALLBACK from
      // INK to CREAM (so any alpha-bleed during capture punches through
      // to a light tone, not a dark one).
      const uri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 1.0,
        width: dims.width,
        height: dims.height,
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('Sharing not available on this device');
      }
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share ${catName}'s postcard`,
        mimeType: 'image/jpeg',
      });
      track({
        type: 'postcard_shared',
        props: {
          format,
          caption_was_edited:
            editedCaption.trim() !== activePostcard.caption_ai_original,
          photo_count: activePostcard.photos.length,
        },
      });
    } catch (e) {
      console.warn('[Postcard] share failed:', e);
      const reason = e instanceof Error ? e.message : 'unknown';
      setError(`Couldn't share — ${reason.slice(0, 100)}`);
      track({
        type: 'postcard_share_failed',
        props: { reason: reason.slice(0, 200) },
      });
    } finally {
      setSharing(false);
    }
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

  // === Render states ===

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      {/* Off-screen share-card render target. Mounted only while a
          share is in flight. CRITICAL: rendered INSIDE the viewport
          at opacity:0 (not at top:-99999). On Android, RN's native
          renderer can skip render passes for children whose layout
          rect is entirely outside the screen bounds — which means
          react-native-view-shot's captureRef sees stale or empty
          pixel buffers for photo Images even though the live preview
          looks fine. Mounting inside the viewport with opacity:0 keeps
          the View in the render tree, gets its children fully
          rasterised, and stays invisible to the user. The 1×1 size +
          overflow:'hidden' makes sure the full-resolution share-card
          (1080×1080+) doesn't push real layout out of place. */}
      {activePostcard && sharing ? (
        <View
          collapsable={false}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            overflow: 'hidden',
            opacity: 0,
          }}
          pointerEvents="none"
        >
        <View
          ref={shareCardRef}
          collapsable={false}
          style={{
            width: POSTCARD_DIMS[format].width,
            height: POSTCARD_DIMS[format].height,
          }}
        >
          <PostcardShareCard
            photos={activePostcard.photos}
            caption={editedCaption.trim() || activePostcard.caption}
            catName={cat.name}
            format={format}
          />
        </View>
        </View>
      ) : null}

      <Header onBack={() => router.back()} title={`${catName}'s postcard`} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* === MAIN CONTENT === */}

        {generating && !activePostcard ? (
          <View
            style={[
              styles.loadingBlock,
              { backgroundColor: t.secondary100, borderColor: t.secondary500 },
            ]}
          >
            <ActivityIndicator color={t.secondary700} size="large" />
            <Text token="body" style={{ marginTop: space[3], color: t.secondary900, fontStyle: 'italic', textAlign: 'center' }}>
              {catName} is composing a caption…
            </Text>
          </View>
        ) : emptyDay && !activePostcard ? (
          <EmptyState
            catName={catName}
            // Route to the unified Photos gallery — that's the
            // canonical capture surface. The hero card on Bond has
            // the same flow, but users who arrived directly at
            // /postcard need a one-tap path too.
            onTakePhoto={() => router.push('/photo-studio' as never)}
          />
        ) : activePostcard ? (
          <>
            {/* "Viewing a past postcard" banner — gives the user a fast
                way back to today (which may be empty / unwritten). */}
            {isViewingPast ? (
              <Pressable
                onPress={onReturnToToday}
                style={[
                  styles.pastBanner,
                  { backgroundColor: t.primary100, borderColor: t.primary500 },
                ]}
              >
                <ArrowLeft size={14} color={t.primary900} weight="bold" />
                <Text token="caption" style={{ color: t.primary900, fontFamily: 'Figtree_600SemiBold' }}>
                  Viewing {formatShortDate(activePostcard.date)} — tap to return to today
                </Text>
              </Pressable>
            ) : null}

            <PostcardComposer
              postcard={activePostcard}
              catName={cat.name}
              caption={editedCaption}
              onCaptionChange={setEditedCaption}
              onCaptionBlur={onCaptionBlur}
              onResetToAI={onResetToAI}
              format={format}
              onFormatChange={(f) => {
                setFormat(f);
                track({ type: 'postcard_format_changed', props: { format: f } });
              }}
              onShare={onShare}
              sharing={sharing}
              isViewingPast={isViewingPast}
              onRefreshPhotos={onRefreshPhotos}
              refreshing={refreshingPhotos}
            />
          </>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorRow,
              { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle, marginTop: space[4] },
            ]}
          >
            <WarningCircle size={16} color={t.warning} />
            <Text token="caption" color="textMuted" style={{ flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {/* === HISTORY STRIP — last 90 days, newest first ===
            Hidden when there's only one postcard (today) or zero. Past
            postcards are rendered as small thumbnails using the first
            photo of each day's collage. */}
        {allPostcards.length > 1 ? (
          <View style={{ marginTop: space[8] }}>
            <Text
              token="caption"
              color="textMuted"
              style={{ letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: space[3] }}
            >
              Recent postcards
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space[3], paddingRight: space[5] }}
            >
              {allPostcards.map((p) => {
                const isActive = activePostcard?.id === p.id;
                const firstPhoto = p.photos[0]?.uri;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => onSelectPostcard(p.id)}
                    style={[
                      styles.thumb,
                      {
                        borderColor: isActive ? t.secondary500 : t.borderSubtle,
                        borderWidth: isActive ? 2 : 1,
                        backgroundColor: t.surfaceElevated,
                      },
                    ]}
                  >
                    {firstPhoto ? (
                      <Image source={{ uri: firstPhoto }} style={styles.thumbImage} />
                    ) : (
                      <View style={[styles.thumbImage, { backgroundColor: t.surfaceSunken }]} />
                    )}
                    <View style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
                      <Text
                        token="caption"
                        style={{
                          color: isActive ? t.secondary900 : t.textPrimary,
                          fontFamily: 'Figtree_600SemiBold',
                          fontSize: 11,
                        }}
                      >
                        {formatShortDate(p.date)}
                      </Text>
                      {p.photos.length > 1 ? (
                        <Text token="caption" color="textMuted" style={{ fontSize: 10 }}>
                          {p.photos.length} photos
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
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
        {title ?? 'Postcard'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

function EmptyState({
  catName,
  onTakePhoto,
}: {
  catName: string;
  onTakePhoto: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: space[8], alignItems: 'center', paddingHorizontal: space[3] }}>
      <View
        style={[
          styles.emptyBadge,
          { backgroundColor: t.secondary100, borderColor: t.secondary500 },
        ]}
      >
        <Camera size={36} color={t.secondary700} weight="duotone" />
      </View>
      <Text token="heading2" style={{ marginTop: space[5], textAlign: 'center' }}>
        No photos in {catName}&apos;s gallery today.
      </Text>
      <Text
        token="body"
        color="textMuted"
        style={{ marginTop: space[3], textAlign: 'center', lineHeight: 22, maxWidth: 320 }}
      >
        Postcards build from today&apos;s gallery photos — short, social,
        in {catName}&apos;s voice. Snap a photo (camera or upload from your
        phone&apos;s gallery) and today&apos;s postcard composes itself.
      </Text>
      <Button
        label="Add a photo"
        onPress={onTakePhoto}
        leftIcon={<Camera size={18} color={t.textInverse} weight="bold" />}
        style={{ marginTop: space[6] }}
        size="lg"
        pill
        fullWidth
      />
    </View>
  );
}

function PostcardComposer({
  postcard,
  catName,
  caption,
  onCaptionChange,
  onCaptionBlur,
  onResetToAI,
  format,
  onFormatChange,
  onShare,
  sharing,
  isViewingPast,
  onRefreshPhotos,
  refreshing,
}: {
  postcard: NonNullable<ReturnType<typeof useTodaysPostcard>>;
  catName: string;
  caption: string;
  onCaptionChange: (s: string) => void;
  onCaptionBlur: () => void;
  onResetToAI: () => void;
  format: PostcardFormat;
  onFormatChange: (f: PostcardFormat) => void;
  onShare: () => void;
  sharing: boolean;
  isViewingPast: boolean;
  onRefreshPhotos: () => void;
  refreshing: boolean;
}) {
  const t = useTheme();
  const wasEdited = caption.trim() !== postcard.caption_ai_original.trim();
  const photosCount = postcard.photos.length;

  return (
    <View style={{ paddingTop: space[5] }}>
      {/* Preview — scales the full 1080×1080 (or 1080×1920) PostcardShareCard
          down to fit the on-screen container. Without the scale wrapper, the
          inner content renders at its absolute 1080px size and the user only
          sees the top-left corner — meaning watermark + caption band invisible.
          We size the outer container to the preview width, then scale the
          inner full-size card by (containerWidth / 1080) using a top-left
          transform origin so the layout fills the preview cleanly. */}
      <PostcardLivePreview
        postcard={postcard}
        caption={caption.trim() || postcard.caption}
        catName={catName}
        format={format}
      />

      {/* Format toggle */}
      <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[5] }}>
        <FormatTab
          label="Square"
          subtitle="Instagram feed"
          active={format === 'square'}
          onPress={() => onFormatChange('square')}
        />
        <FormatTab
          label="Story"
          subtitle="IG / TikTok stories"
          active={format === 'story'}
          onPress={() => onFormatChange('story')}
        />
      </View>

      {/* Editable caption */}
      <Text
        token="caption"
        color="textMuted"
        style={{ letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: space[2] }}
      >
        Caption — tap to edit
      </Text>
      <View
        style={[
          styles.captionBox,
          { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
        ]}
      >
        <TextInput
          value={caption}
          onChangeText={onCaptionChange}
          onBlur={onCaptionBlur}
          multiline
          maxLength={280}
          placeholder="Tap to write a caption…"
          placeholderTextColor={t.textMuted}
          style={{
            color: t.textPrimary,
            fontFamily: 'SourceSerif4_400Regular',
            fontSize: 16,
            lineHeight: 24,
            minHeight: 64,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: space[2],
          }}
        >
          <Text token="caption" color="textMuted">
            {caption.length} / 280
          </Text>
          {wasEdited ? (
            <Pressable onPress={onResetToAI} hitSlop={8}>
              <Text token="caption" style={{ color: t.secondary700, fontFamily: 'Figtree_600SemiBold' }}>
                Reset to AI version
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Photos info + refresh — when the cached postcard's photos look
          stale (e.g. from a pre-refactor cache that pulled from scan /
          symptom photos), the Refresh-photos button re-pulls from the
          gallery without rewriting the caption. Hidden when viewing a
          past postcard (you can't refresh history). */}
      <View
        style={{
          marginTop: space[3],
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text token="caption" color="textMuted">
          {photosCount} photo{photosCount === 1 ? '' : 's'} from {isViewingPast ? formatShortDate(postcard.date) : 'today'}
        </Text>
        {!isViewingPast ? (
          <Pressable
            onPress={onRefreshPhotos}
            disabled={refreshing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Refresh today's postcard — re-pull photos and regenerate caption"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: t.borderSubtle,
              backgroundColor: t.surfaceElevated,
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <ArrowsClockwise size={12} color={t.textMuted} weight="bold" />
            <Text
              token="caption"
              color="textMuted"
              style={{ fontFamily: 'Figtree_600SemiBold', fontSize: 11 }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Share button */}
      <Button
        label={sharing ? 'Preparing…' : 'Share'}
        onPress={onShare}
        leftIcon={<ShareNetwork size={18} color={t.textInverse} weight="bold" />}
        disabled={sharing || !caption.trim()}
        size="lg"
        pill
        fullWidth
        style={{ marginTop: space[5] }}
      />

      <Text
        token="caption"
        color="textMuted"
        style={{ marginTop: space[3], textAlign: 'center', lineHeight: 16 }}
      >
        Watermarked with catmd.pet so the post stays branded as you share.
      </Text>
    </View>
  );
}

/**
 * Short, human-friendly date for the history strip + past-postcard banner.
 *   today        → "Today"
 *   yesterday    → "Yesterday"
 *   <7 days      → "Mon", "Tue", …
 *   else         → "Apr 24"
 * postcard.date is YYYY-MM-DD (local). Parse loosely to avoid TZ surprises.
 */
function formatShortDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return yyyymmdd;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) {
    return target.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * On-screen scaled preview of the postcard share asset.
 *
 * The off-screen capture target (used for the actual PNG export) renders
 * `PostcardShareCard` at full 1080×1080 (or 1080×1920) — those absolute
 * pixel dimensions are intentional, the share file needs them. But that
 * same render at 1080px does NOT fit on a 360px-wide phone preview;
 * naively embedding it shows only the top-left corner (watermark + caption
 * band invisible).
 *
 * Fix: we measure the container width via `onLayout`, compute a scale
 * factor (containerWidth / 1080), and apply it via transform with
 * `transformOrigin: 'top left'`. The inner PostcardShareCard still
 * thinks it's 1080×1080 (preserving every layout decision), but visually
 * it shrinks to the preview viewport.
 *
 * `transformOrigin` is supported in RN ≥ 0.78 (Expo SDK 54 ships RN 0.81+).
 */
function PostcardLivePreview({
  postcard,
  caption,
  catName,
  format,
}: {
  postcard: NonNullable<ReturnType<typeof useTodaysPostcard>>;
  caption: string;
  catName: string;
  format: PostcardFormat;
}) {
  const t = useTheme();
  const fullDims = POSTCARD_DIMS[format];
  const aspectRatio = format === 'square' ? 1 : fullDims.width / fullDims.height;
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);

  // While we don't yet know the layout width (first frame), render the
  // outer wrapper at the right aspect ratio with no inner content. As
  // soon as onLayout fires, we know the pixel width and can scale the
  // PostcardShareCard to match.
  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== previewWidth) setPreviewWidth(w);
      }}
      style={{
        aspectRatio,
        width: '100%',
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: t.borderSubtle,
        backgroundColor: t.surfaceSunken,
        marginBottom: space[5],
      }}
    >
      {previewWidth ? (
        <View
          style={{
            width: fullDims.width,
            height: fullDims.height,
            transform: [{ scale: previewWidth / fullDims.width }],
            transformOrigin: 'top left',
          }}
          pointerEvents="none"
        >
          <PostcardShareCard
            photos={postcard.photos}
            caption={caption}
            catName={catName}
            format={format}
          />
        </View>
      ) : null}
    </View>
  );
}


function FormatTab({
  label,
  subtitle,
  active,
  onPress,
}: {
  label: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.formatTab,
        {
          backgroundColor: active ? t.secondary100 : t.surfaceElevated,
          borderColor: active ? t.secondary500 : t.borderSubtle,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        token="body"
        style={{
          color: active ? t.secondary900 : t.textPrimary,
          fontFamily: 'Figtree_600SemiBold',
        }}
      >
        {label}
      </Text>
      <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  loadingBlock: {
    padding: space[8],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
    marginTop: space[5],
  },
  emptyBadge: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatTab: {
    flex: 1,
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  captionBox: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[5],
  },
  thumb: {
    width: 88,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: 88,
  },
});
