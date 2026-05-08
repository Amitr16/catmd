/**
 * Cat Studio screen — AI-generated movie-poster remixes featuring the
 * user's actual cat.
 *
 * Two states:
 *   1. Genre picker — 8 genre tiles in a 2-column grid. Tapping a tile
 *      selects it (visual highlight) — separate "Generate poster" CTA
 *      runs the actual call. This avoids "I tapped to look but it
 *      generated anyway" friction.
 *   2. Result — full-bleed poster image with share + "Make another" +
 *      delete buttons. Past generations strip at the bottom (last 10
 *      cached locally).
 *
 * Generation: ~15-30s. Spinner copy is theme-flavored ("Designing
 * the poster…", "Mixing the typography…") so the wait feels intentional.
 *
 * Pro gating note: NOT gated in v1 per user direction ("focus on build
 * now, Pro discussion later"). All generations cost ~$0.07 in API fees.
 * Pro gating later when monetization strategy lands.
 *
 * Native deps lazy-loaded: photo base64 read (expo-file-system/legacy),
 * share-card capture (react-native-view-shot), system share sheet
 * (expo-sharing). Same defensive pattern as Cat Diary's share flow.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowsClockwise,
  FilmSlate as FilmSlateIcon,
  ShareNetwork,
  Trash,
  WarningCircle,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import {
  useCatStudioGenerating,
  useCatStudioPosters,
  useCatStudioStore,
} from '../src/state/catStudioStore';
import { usePhotosInLastDays } from '../src/state/photoStudioStore';
import {
  GENRES,
  getStudioWeekAnchor,
  getThemeForWeek,
  getVariantsForTheme,
  type Genre,
  type CatStudioPoster,
} from '../src/services/catStudio';
import { track } from '../src/services/analytics';
import { useNotifPrefsStore } from '../src/state/notifPrefsStore';
import {
  cancelNotification,
  setWeeklyCatStudioReminder,
} from '../src/services/notifications';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function CatStudioScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const posters = useCatStudioPosters(cat?.id);
  const generating = useCatStudioGenerating(cat?.id);
  const generate = useCatStudioStore((s) => s.generate);
  const deletePoster = useCatStudioStore((s) => s.deletePoster);
  // weeklyAutoGenerate exists in the store for the Sunday-10am cron
  // path but is intentionally NOT called from this screen — see the
  // lengthy comment below where the previous lazy-auto-gen useEffect
  // used to live.

  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // ── Per-variant weekly cap ─────────────────────────────────────
  // Each variant button is single-use per studio-week. Cap = 8
  // generations per week (one per variant in the active theme).
  // Image-gen is the most expensive AI call we make (~$0.05-0.10
  // per poster), so this cap is real cost protection — see
  // docs/MONETIZATION-STRATEGY.md.
  //
  // Derivation is from the existing posters list (no new state):
  // we filter to posters generated since the current week's anchor
  // and collect their genre_ids into a Set. Reset is automatic —
  // when getStudioWeekAnchor() rolls over to a new Sunday, prior-
  // week posters fall out of the filter and the set empties.
  const usedGenreIdsThisWeek = useMemo(() => {
    const weekAnchor = getStudioWeekAnchor().getTime();
    const used = new Set<string>();
    for (const p of posters) {
      const ts = new Date(p.generated_at).getTime();
      if (!Number.isNaN(ts) && ts >= weekAnchor) {
        used.add(p.genre_id);
      }
    }
    return used;
  }, [posters]);

  // If the user has the now-locked variant selected, clear it so
  // they don't tap Generate on a disabled tile.
  useEffect(() => {
    if (selectedGenreId && usedGenreIdsThisWeek.has(selectedGenreId)) {
      setSelectedGenreId(null);
    }
  }, [selectedGenreId, usedGenreIdsThisWeek]);

  // Photos in the past 7 days — Posters needs at least one to generate
  // a recognisable cat. When empty, the screen shows a friendly "no
  // photos yet" state instead of dropping into the genre picker. Users
  // need to learn that the gallery is the trigger.
  const photosInLastWeek = usePhotosInLastDays(cat?.id, 7);

  // Telemetry: cat_studio_opened — once per cat per screen mount.
  // 2026-05-03: includes the active rotation theme so we can measure
  // engagement by week (which themes drive most opens, do users come
  // back when next week's theme teaser changes, etc.).
  useEffect(() => {
    if (!cat?.id) return;
    const { thisWeek, nextWeek, weekIndex } = getThemeForWeek();
    track({
      type: 'cat_studio_opened',
      props: {
        has_history: posters.length > 0,
        this_week_theme: thisWeek,
        next_week_theme: nextWeek,
        week_index: weekIndex,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Schedule the Sunday-10am weekly Cat Studio reminder. Idempotent —
  // re-arms each visit so cat-name renames flow through and any stale
  // schedule on the device gets cancelled. Honours notifPrefsStore.
  useEffect(() => {
    if (!cat?.id) return;
    const prefs = useNotifPrefsStore.getState();
    const oldId = prefs.getScheduledId(cat.id, 'cat_studio_poster');
    void (async () => {
      try {
        await cancelNotification(oldId);
        if (!prefs.enabled.cat_studio_poster) {
          prefs.setScheduledId(cat.id, 'cat_studio_poster', null);
          return;
        }
        const newId = await setWeeklyCatStudioReminder({
          catName: cat.name,
          catId: cat.id,
        });
        prefs.setScheduledId(cat.id, 'cat_studio_poster', newId);
      } catch (e) {
        console.warn('[CatStudio] reminder schedule failed:', e);
      }
    })();
  }, [cat?.id, cat?.name]);

  // Posters does NOT auto-generate on screen open. Earlier behaviour
  // ("lazy weekly auto-gen") fired a generation every time the user
  // opened the screen if no current-week poster existed — but that
  // was surprising: opening the tab kicked off a $0.07 generation
  // unprompted. Now poster creation only happens via:
  //   1. The Sunday-10am cron firing the schedule (notification path)
  //   2. The user explicitly tapping "Create poster" or "Try a
  //      different genre" → genre picker → Generate.
  // The screen lands on the most-recent existing poster (posters[0]),
  // showing past history below. weeklyAutoGenerate is still in the
  // store for future surfaces (admin tooling, scheduled re-runs) but
  // is intentionally not called from this screen.

  // Show the most-recent poster as the result if any exist
  const activePoster = activePosterId
    ? posters.find((p) => p.id === activePosterId) ?? null
    : posters[0] ?? null;

  const onGenerate = async () => {
    if (!cat?.id || !selectedGenreId || generating) return;
    const genre = GENRES.find((g) => g.id === selectedGenreId);
    if (!genre) return;

    setError(null);
    track({
      type: 'cat_studio_generation_started',
      props: { genre: genre.id, theme: genre.theme },
    });

    // Lazy-load expo-file-system for photo base64 read
    let catPhotoBase64: string | null = null;
    if (cat.photo_uri) {
      try {
        const FileSystem = await import('expo-file-system/legacy');
        catPhotoBase64 = await FileSystem.readAsStringAsync(cat.photo_uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e) {
        console.warn('[CatStudio] Failed to read cat photo:', e);
        // Continue without — generation works without reference photo
      }
    }

    try {
      const poster = await generate({
        catId: cat.id,
        genre,
        catPhotoBase64,
      });
      setActivePosterId(poster.id);
      // Flip the explicit picker-view override OFF — user generated a
      // new poster, so we want the result view back.
      setForcePickerView(false);
      track({
        type: 'cat_studio_poster_generated',
        props: {
          genre: genre.id,
          theme: genre.theme,
          had_reference_photo: !!catPhotoBase64,
        },
      });
    } catch (e) {
      console.warn('[CatStudio] generate failed:', e);
      const reason = e instanceof Error ? e.message : 'unknown';
      setError(`Couldn't generate the poster — ${reason.slice(0, 100)}`);
      track({
        type: 'cat_studio_generation_failed',
        props: {
          genre: genre.id,
          theme: genre.theme,
          reason: reason.slice(0, 200),
        },
      });
    }
  };

  const onShare = async (poster: CatStudioPoster) => {
    if (sharing) return;
    setSharing(true);
    try {
      // Lazy-load native deps to avoid module-load crash if linking fails
      const FileSystem = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');

      // Write the base64 image to a temp file so the share sheet can pick it up
      const tmpPath = FileSystem.cacheDirectory + `cat-studio-${poster.id}.png`;
      await FileSystem.writeAsStringAsync(tmpPath, poster.image_b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        console.warn('[CatStudio] Sharing unavailable');
        return;
      }
      await Sharing.shareAsync(tmpPath, {
        dialogTitle: `Share ${cat?.name ?? 'your cat'}'s poster`,
        mimeType: 'image/png',
      });
      track({
        type: 'cat_studio_poster_shared',
        props: {
          genre: poster.genre_id,
          theme: GENRES.find((g) => g.id === poster.genre_id)?.theme,
        },
      });
    } catch (e) {
      console.warn('[CatStudio] share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  const onDelete = (poster: CatStudioPoster) => {
    if (!cat?.id) return;
    // Guard — posters generated in the current studio-week cannot
    // be deleted. Why: without this, the per-variant weekly cap is
    // trivially bypassable — generate → delete → variant button
    // re-enables → infinite poster generations on our token. Posters
    // become deletable once their week has rolled over.
    const weekAnchor = getStudioWeekAnchor().getTime();
    const ts = new Date(poster.generated_at).getTime();
    if (!Number.isNaN(ts) && ts >= weekAnchor) {
      Alert.alert(
        'Cannot delete this week',
        `This poster was generated this week and is locked until next week's theme rolls in. Each variant is single-use per cycle — deletion would break that.`,
        [{ text: 'OK' }],
      );
      track({
        type: 'cat_studio_delete_blocked_current_week',
        props: { genre: poster.genre_id },
      });
      return;
    }
    deletePoster(cat.id, poster.id);
    if (activePosterId === poster.id) setActivePosterId(null);
  };

  // `forcePickerView` is the explicit "I want to pick a new genre"
  // toggle. Without it, clearing activePosterId still falls through
  // to `posters[0]` and the result view stays — making the "Try a
  // different genre" button do nothing visible. We only flip it back
  // off when the user actually generates a new poster (success) OR
  // navigates back to the existing poster via the history strip.
  const [forcePickerView, setForcePickerView] = useState(false);
  const onMakeAnother = () => {
    setActivePosterId(null);
    setSelectedGenreId(null);
    setError(null);
    setForcePickerView(true);
  };

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

  // === RESULT VIEW ===
  // Shown when:
  //   • a generation is in flight (always — loading spinner needs to
  //     appear immediately when the user taps Create poster, regardless
  //     of forcePickerView), OR
  //   • there's an active poster to display AND the user hasn't
  //     explicitly opted to pick a different genre.
  //
  // The `generating || ...` ordering matters. Earlier version put
  // `!forcePickerView` first which suppressed the spinner during
  // generation when the user had just tapped "Try a different genre"
  // — they'd hit Create poster and see nothing happen. The override
  // only applies to the IDLE state.
  const showResult =
    generating || (!forcePickerView && activePoster !== null);

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} title={`${cat.name}'s Posters`} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        {showResult ? (
          <ResultView
            poster={activePoster}
            generating={generating}
            error={error}
            sharing={sharing}
            onShare={onShare}
            onDelete={onDelete}
            onMakeAnother={onMakeAnother}
            onRetry={onGenerate}
          />
        ) : photosInLastWeek.length === 0 ? (
          // Gating state — Posters can't make a recognisable poster of
          // a cat we've never seen. Direct user to Photos so they
          // learn the gallery is the trigger for everything Bond.
          <NoPhotosYet
            catName={cat.name}
            onGoToPhotos={() => router.push('/photo-studio' as never)}
          />
        ) : (
          <PickerView
            catName={cat.name}
            selectedGenreId={selectedGenreId}
            usedGenreIdsThisWeek={usedGenreIdsThisWeek}
            onSelectGenre={(id) => {
              // Defensive: should never fire for a locked tile
              // because the tile is non-pressable, but guard
              // anyway in case of a stale render.
              if (usedGenreIdsThisWeek.has(id)) return;
              setSelectedGenreId(id);
              const variant = GENRES.find((g) => g.id === id);
              track({
                type: 'cat_studio_genre_selected',
                props: { genre: id, theme: variant?.theme },
              });
            }}
            onGenerate={onGenerate}
            error={error}
          />
        )}

        {/* Past generations strip — only when not in result view OR when
            current result isn't already in history. Lets the user flip
            back to a previous poster they liked. */}
        {posters.length > 0 ? (
          <View style={{ marginTop: space[8] }}>
            <Text
              token="caption"
              color="textMuted"
              style={{ letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: space[3] }}
            >
              Your recent posters
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space[3] }}
            >
              {posters.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setActivePosterId(p.id);
                    // Tapping a past poster in history is also an
                    // implicit "show me result view" — clear the
                    // picker-view override.
                    setForcePickerView(false);
                  }}
                  style={[
                    styles.thumb,
                    {
                      borderColor:
                        activePoster?.id === p.id ? t.secondary500 : t.borderSubtle,
                      borderWidth: activePoster?.id === p.id ? 2 : 1,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: `data:image/png;base64,${p.image_b64}` }}
                    style={{ width: 80, height: 120, borderRadius: radius.sm }}
                  />
                </Pressable>
              ))}
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
        {title ?? 'Posters'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

/**
 * Gating state — shown when the gallery is empty for the past 7 days.
 * Posters needs a recognisable cat photo to put on the poster, so we
 * can't proceed. Directs the user to the Photos gallery, which is the
 * canonical photo source for every Bond feature. Same intent as the
 * postcard's "no photos today" empty state — make sure users learn
 * that the gallery is the trigger for everything else on Bond.
 */
function NoPhotosYet({
  catName,
  onGoToPhotos,
}: {
  catName: string;
  onGoToPhotos: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: space[8], alignItems: 'center', paddingHorizontal: space[3] }}>
      <View
        style={[
          styles.errorBlock,
          { backgroundColor: t.secondary100, borderColor: t.secondary500 },
        ]}
      >
        <FilmSlateIconForEmpty />
        <Text token="heading2" style={{ marginTop: space[3], textAlign: 'center' }}>
          No photos of {catName} this week.
        </Text>
        <Text
          token="body"
          color="textMuted"
          style={{ marginTop: space[3], textAlign: 'center', lineHeight: 22 }}
        >
          A new theme rolls in every week — movie posters, famous
          paintings, historical figures, Studio Ghibli scenes, Pixar,
          80s anime. {catName} gets reimagined into each one. Drop
          a photo into the Photos gallery (camera or upload) and
          this week&apos;s piece lands. You can also pick a different
          theme any time after.
        </Text>
        <Button
          label="Open Photos"
          onPress={onGoToPhotos}
          style={{ marginTop: space[5] }}
          size="md"
          pill
        />
      </View>
    </View>
  );
}

function FilmSlateIconForEmpty() {
  // Small wrapper so the icon's sizing/colour stays consistent with
  // the other empty states. The Posters screen's primary chrome uses
  // FilmSlate as the brand mark; reusing here ties the empty state to
  // the feature visually.
  const t = useTheme();
  return <FilmSlateIcon size={28} color={t.secondary700} weight="duotone" />;
}

/**
 * Map a theme name to a representative emoji for the next-week teaser
 * card. Falls back to a neutral marker if the theme isn't recognised
 * (defensive — rotation order should always be in sync).
 */
function nextThemeEmoji(theme: string): string {
  switch (theme) {
    case 'Movie posters': return '🎬';
    case 'Historical figures': return '👑';
    case 'Famous paintings': return '🖼️';
    case 'Studio Ghibli scenes': return '🌳';
    case 'Pixar characters': return '🎈';
    case '80s anime': return '🌙';
    default: return '✨';
  }
}

function PickerView({
  catName,
  selectedGenreId,
  usedGenreIdsThisWeek,
  onSelectGenre,
  onGenerate,
  error,
}: {
  catName: string;
  selectedGenreId: string | null;
  /** Genre IDs already generated in the current studio-week. Each
   *  appears as a disabled tile with a "Generated" badge. */
  usedGenreIdsThisWeek: Set<string>;
  onSelectGenre: (id: string) => void;
  onGenerate: () => void;
  error: string | null;
}) {
  const t = useTheme();

  // Theme-of-the-week — only show variants from the currently-active
  // theme. A fresh theme rotates in every week. Next week's theme is
  // teased at the bottom for anticipation.
  const { thisWeek, nextWeek, nextRotationAt } = getThemeForWeek();
  const activeVariants = getVariantsForTheme(thisWeek);

  // How many variants have been used this week vs available.
  const usedCount = activeVariants.filter((v) => usedGenreIdsThisWeek.has(v.id)).length;
  const totalCount = activeVariants.length;
  const allUsed = usedCount === totalCount && totalCount > 0;

  // Format the next-rotation date in a human-readable way: "Sunday,
  // May 10" / "this Sunday" / "tomorrow" depending on how close it is.
  const daysUntilNext = Math.round(
    (nextRotationAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const nextDateLabel =
    daysUntilNext <= 0
      ? 'today'
      : daysUntilNext === 1
        ? 'tomorrow'
        : daysUntilNext < 7
          ? nextRotationAt.toLocaleDateString(undefined, { weekday: 'long' })
          : nextRotationAt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={{ paddingTop: space[5] }}>
      {/* Theme-of-the-week header — replaces the old generic "Pick a
          genre" heading. Sage-tinted card highlights this week's theme;
          the picker grid below is filtered to that theme only. */}
      <View
        style={{
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: t.secondary100,
          borderWidth: 1,
          borderColor: t.secondary500,
          marginBottom: space[4],
        }}
      >
        <Text
          token="caption"
          style={{
            color: t.secondary700,
            fontFamily: 'Figtree_600SemiBold',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontSize: 10,
          }}
        >
          This week
        </Text>
        <Text token="displayLg" style={{ color: t.secondary900, marginTop: 2 }}>
          {thisWeek}
        </Text>
        <Text token="body" color="textSecondary" style={{ marginTop: space[2], lineHeight: 22 }}>
          {`AI will star ${catName} in this week's theme. Pick a variant below. ~30 seconds per generation. Save or share whatever lands.`}
        </Text>
        {/* Weekly cap counter — each variant can only be generated
            once per studio-week. Resets when the week rolls over.
            See app/cat-studio.tsx → usedGenreIdsThisWeek. */}
        <Text
          token="caption"
          style={{
            marginTop: space[3],
            color: allUsed ? t.warning : t.secondary700,
            fontFamily: 'Figtree_600SemiBold',
            letterSpacing: 0.6,
          }}
        >
          {allUsed
            ? `All 8 variants generated this week. New theme + fresh slots roll in soon.`
            : `${usedCount} of ${totalCount} variants used this week · each variant once per cycle`}
        </Text>
      </View>

      <View style={styles.grid}>
        {activeVariants.map((g) => {
          const selected = selectedGenreId === g.id;
          const used = usedGenreIdsThisWeek.has(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={used ? undefined : () => onSelectGenre(g.id)}
              disabled={used}
              style={({ pressed }) => [
                styles.genreTile,
                {
                  backgroundColor: used
                    ? t.surfaceSunken
                    : selected
                      ? t.secondary100
                      : t.surfaceElevated,
                  borderColor: used
                    ? t.borderSubtle
                    : selected
                      ? t.secondary500
                      : t.borderSubtle,
                  opacity: used ? 0.55 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 32 }}>{g.emoji}</Text>
              <Text
                token="heading3"
                numberOfLines={2}
                style={{
                  marginTop: space[2],
                  color: used
                    ? t.textMuted
                    : selected
                      ? t.secondary900
                      : t.textPrimary,
                }}
              >
                {g.title}
              </Text>
              <Text
                token="caption"
                color="textMuted"
                numberOfLines={2}
                style={{ marginTop: space[1], lineHeight: 16 }}
              >
                {used ? '✓ Generated this week' : g.tagline}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Next-week teaser — quiet card under the grid. Builds
          anticipation: users come back next week to see the new
          theme. Uses muted colours so it doesn't compete with the
          active-theme card up top. */}
      <View
        style={{
          marginTop: space[5],
          padding: space[4],
          borderRadius: radius.md,
          backgroundColor: t.surfaceSunken,
          borderWidth: 1,
          borderColor: t.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        <Text style={{ fontSize: 28 }}>{nextThemeEmoji(nextWeek)}</Text>
        <View style={{ flex: 1 }}>
          <Text
            token="caption"
            color="textMuted"
            style={{
              fontFamily: 'Figtree_600SemiBold',
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontSize: 10,
            }}
          >
            {`Next ${nextDateLabel}`}
          </Text>
          <Text token="heading3" style={{ marginTop: 2 }}>
            {nextWeek}
          </Text>
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.errorRow,
            { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle, marginTop: space[5] },
          ]}
        >
          <WarningCircle size={16} color={t.warning} />
          <Text token="caption" color="textMuted" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}

      <Button
        label={selectedGenreId ? 'Create poster' : 'Pick a genre to start'}
        disabled={!selectedGenreId}
        onPress={onGenerate}
        size="lg"
        pill
        fullWidth
        style={{ marginTop: space[6] }}
      />
    </View>
  );
}

function ResultView({
  poster,
  generating,
  error,
  sharing,
  onShare,
  onDelete,
  onMakeAnother,
  onRetry,
}: {
  poster: CatStudioPoster | null;
  generating: boolean;
  error: string | null;
  sharing: boolean;
  onShare: (p: CatStudioPoster) => void;
  onDelete: (p: CatStudioPoster) => void;
  onMakeAnother: () => void;
  onRetry: () => void;
}) {
  const t = useTheme();

  if (generating) {
    return (
      <View style={{ paddingTop: space[8], alignItems: 'center' }}>
        <View
          style={{
            width: '100%',
            aspectRatio: 1024 / 1536,
            backgroundColor: t.surfaceSunken,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: t.borderSubtle,
          }}
        >
          <ActivityIndicator size="large" color={t.secondary700} />
          <Text
            token="body"
            color="textMuted"
            style={{ marginTop: space[4], fontStyle: 'italic', textAlign: 'center', paddingHorizontal: space[6] }}
          >
            Designing the poster…
          </Text>
          <Text
            token="caption"
            color="textMuted"
            style={{ marginTop: space[2], textAlign: 'center' }}
          >
            ~30 seconds. The AI is mixing the typography.
          </Text>
        </View>
      </View>
    );
  }

  if (error && !poster) {
    return (
      <View style={{ paddingTop: space[8], alignItems: 'center' }}>
        <View
          style={[
            styles.errorBlock,
            { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
          ]}
        >
          <WarningCircle size={28} color={t.warning} weight="duotone" />
          <Text token="body" style={{ marginTop: space[2] }}>
            Couldn't generate the poster.
          </Text>
          <Text token="caption" color="textMuted" style={{ marginTop: space[1], textAlign: 'center' }}>
            {error}
          </Text>
          <Button
            label="Try again"
            onPress={onRetry}
            variant="secondary"
            style={{ marginTop: space[4] }}
          />
        </View>
      </View>
    );
  }

  if (!poster) return null;

  // Auto-generated posters get a small "this week's auto poster"
  // label so users understand a fresh one lands each week — they can
  // also tap "Try a different genre" anytime to override the surprise.
  const genreMeta = GENRES.find((g) => g.id === poster.genre_id);
  const generatedDate = new Date(poster.generated_at).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric' },
  );

  return (
    <View style={{ paddingTop: space[5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <Text token="caption" color="textMuted" style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {poster.auto ? "This week's auto poster" : 'You picked'}
          </Text>
          <Text token="heading3" style={{ marginTop: 2 }} numberOfLines={1}>
            {genreMeta?.title ?? 'Poster'}
          </Text>
          <Text token="caption" color="textMuted">
            {generatedDate}
          </Text>
        </View>
      </View>
      <Image
        source={{ uri: `data:image/png;base64,${poster.image_b64}` }}
        style={{
          width: '100%',
          aspectRatio: 1024 / 1536,
          borderRadius: radius.lg,
          backgroundColor: t.surfaceSunken,
        }}
        resizeMode="cover"
      />

      <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
        <Button
          label={sharing ? 'Preparing…' : 'Share'}
          leftIcon={<ShareNetwork size={18} color={t.textInverse} weight="bold" />}
          onPress={() => onShare(poster)}
          disabled={sharing}
          size="md"
          pill
          style={{ flex: 1 }}
        />
        <Button
          label="Try a different genre"
          leftIcon={<ArrowsClockwise size={16} color={t.textPrimary} weight="bold" />}
          onPress={onMakeAnother}
          variant="secondary"
          size="md"
          pill
          style={{ flex: 1 }}
        />
      </View>

      <Pressable
        onPress={() => onDelete(poster)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          marginTop: space[3],
          padding: space[3],
        }}
        hitSlop={8}
      >
        <Trash size={14} color={t.textMuted} />
        <Text token="caption" color="textMuted">
          Delete this poster
        </Text>
      </Pressable>
    </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    marginBottom: space[2],
  },
  genreTile: {
    width: '48%',
    minHeight: 132,
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  thumb: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorBlock: {
    padding: space[6],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
});
