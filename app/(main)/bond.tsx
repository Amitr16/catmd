/**
 * Bond tab — emotional + creative layer.
 *
 * Layout (top → bottom):
 *   1. Header — matches Today tab's pattern: cat avatar + "Bond" caption
 *      + cat name as the heading. (Previously the header read "[avatar]
 *      Bond" which made it look like the cat was named Bond.)
 *   2. Lede — one line.
 *   3. Hero photo capture card — THE entry point for adding photos.
 *      Photos taken here feed Postcard collages, Cat Studio's weekly
 *      reference photo, the Diary's vision context, and the time-lapse
 *      gallery. There's no other photo-capture flow on Bond — this is
 *      the source of truth.
 *   4. Tiles — Personality, Diary, Postcard, Photos, Posters, Memory.
 *
 * Tile order rationale (set explicitly by user 2026-05-02):
 *   Personality (the lens) → Diary (private daily) → Postcard (today's
 *   share) → Photos (gallery + time-lapse) → Posters (weekly auto AI
 *   poster) → Memory Book (year-in-review, deferred).
 *
 * Tile titles personalised with the cat's name to reinforce that this
 * is *their* cat's bond surface, not generic "Cat features."
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookBookmark,
  Camera as CameraIcon,
  CameraPlus,
  CaretRight,
  Cat as CatIcon,
  FilmSlate,
  Images,
  UsersThree,
  MaskHappy,
  Sparkle,
  NotePencil,
  PaperPlaneTilt,
  WarningCircle,
} from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { useCatStore } from '../../src/state/catStore';
import {
  usePersonalityProfile,
  usePersonalityQuizAnswered,
  usePersonalityStore,
} from '../../src/state/personalityStore';
import {
  ARCHETYPE_META,
  confidenceLabel,
  hasEnoughDataForReveal,
} from '../../src/services/personality';
import { useTodaysDiaryEntry, useDiaryUnreadCount } from '../../src/state/diaryStore';
import { useSubjectsForCat } from '../../src/state/subjectDirectoryStore';
import { useBecomingForCat } from '../../src/services/useBecomingForCat';
import { useTodaysPostcard } from '../../src/state/postcardStore';
import {
  PICKER_BATCH_LIMIT,
  usePhotoStudioStore,
  usePhotosInLastDays,
  useTodaysPhotos,
} from '../../src/state/photoStudioStore';
import { captureViaImagePicker } from '../../src/services/photoStudio';
import { track } from '../../src/services/analytics';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function BondTab() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const catName = cat?.name ?? 'your cat';

  // Personality tile state — recompute on mount so the subtitle reflects
  // fresh data (added check-ins, behaviour observations since last visit).
  const personalityProfile = usePersonalityProfile(cat?.id);
  const personalityQuizAnswered = usePersonalityQuizAnswered(cat?.id);
  const recomputePersonality = usePersonalityStore((s) => s.recompute);
  useEffect(() => {
    if (cat?.id) recomputePersonality(cat.id);
  }, [cat?.id, recomputePersonality]);

  // Cat Diary tile state — diary is private + 7pm-gated. Diary
  // accepts ANY material (check-in, body language, weight, scan,
  // chat, photo, etc.) — photos enrich but aren't required. Subtitle
  // shows today's entry preview if cached, else explains the trigger.
  const todaysDiary = useTodaysDiaryEntry(cat?.id);
  const diaryUnread = useDiaryUnreadCount(cat?.id);
  const subjectsCount = useSubjectsForCat(cat?.id).length;

  // Becoming — composite "depth" of how shaped the cat-in-the-app
  // has become. Drives the Becoming tile body copy + headline depth.
  // Computation moved to the shared useBecomingForCat hook (used here
  // and on chat/diary for the PersonalityProgressBanner). The
  // ~45-line inline useMemo this replaces was duplicated three times
  // before extraction.
  const becoming = useBecomingForCat(cat?.id);
  const diarySubtitle = todaysDiary
    ? truncateForPreview(todaysDiary.entry, 110)
    : `Private journal in ${catName}'s voice — writes at 7pm if anything happened today (check-in, photo, scan, or chat).`;

  // Postcard tile — show today's caption if cached. When no postcard
  // exists yet, we discriminate between "no photos in gallery today"
  // (the actual gating reason) vs "photos exist but no postcard
  // generated yet" so users learn the gallery is the trigger.
  const todaysPostcard = useTodaysPostcard(cat?.id);
  const todaysPhotosCount = useTodaysPhotos(cat?.id).length;
  const photosInLastWeek = usePhotosInLastDays(cat?.id, 7).length;
  const postcardSubtitle = todaysPostcard
    ? truncateForPreview(todaysPostcard.caption, 110)
    : todaysPhotosCount === 0
      ? `Needs a photo first — snap one above to unlock today's postcard.`
      : `A photo collage + caption in ${catName}'s voice — share to Instagram, TikTok, or anywhere.`;

  // Three-state subtitle for the Personality tile. Avoids the academic
  // framework name ("Litchfield Feline Five") and the confidence
  // percentage — most users can't interpret either. Surfaces archetype
  // + one-liner instead.
  const personalitySubtitle = (() => {
    if (!cat) return `Discover ${catName}'s archetype — 4 quick questions.`;
    if (!personalityQuizAnswered && !personalityProfile) {
      return `4 quick questions to map ${catName}'s personality. See how ${catName} is taking shape.`;
    }
    if (personalityProfile && hasEnoughDataForReveal(personalityProfile)) {
      const meta = ARCHETYPE_META[personalityProfile.archetype];
      const label = confidenceLabel(personalityProfile.confidence);
      const base =
        label === 'stable'
          ? `${meta.name} — ${meta.oneLiner}`
          : `${meta.name} · still settling`;
      return becoming
        ? `${base} · ${becoming.depth}% formed`
        : base;
    }
    return `Building ${catName}'s profile — keep up the daily check-ins.`;
  })();

  // Photo gallery state — drives the hero capture card AND the Photos
  // tile preview. Subscribes to today's photos so the strip updates
  // immediately after a capture.
  const todaysPhotos = useTodaysPhotos(cat?.id);
  const photosSubtitle = useMemo(() => {
    if (todaysPhotos.length === 0) {
      return `With every photo, ${catName} comes more into focus here — the diary, postcards, and posters all draw from these.`;
    }
    if (todaysPhotos.length === 1) {
      return `1 photo today. Tap to see the timeline + monthly time-lapse.`;
    }
    return `${todaysPhotos.length} photos today. Tap to see the timeline + monthly time-lapse.`;
  }, [todaysPhotos.length, catName]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + space[5],
        paddingHorizontal: space[5],
        paddingBottom: insets.bottom + space[8],
        gap: space[3],
      }}
    >
      {/* Header — matches Today tab pattern (caption + cat name) so the
          avatar+name read as one unit, not "cat named Bond". */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[2] }}>
        <CatAvatar uri={cat?.photo_uri ?? null} size={56} />
        <View style={{ flexShrink: 1 }}>
          <Text token="caption" color="textMuted">Bond</Text>
          <Text token="heading1" numberOfLines={1} style={{ flexShrink: 1 }}>
            {cat?.name ?? 'Your cat'}
          </Text>
        </View>
      </View>
      <Text token="body" color="textMuted" style={{ marginBottom: space[4] }}>
        Snap photos of {catName} — they feed everything below.
      </Text>

      {/* Hero photo capture card — the canonical entry point. */}
      <BondPhotoCaptureCard catId={cat?.id ?? null} catName={catName} />

      {/* Becoming was a standalone tile here; folded into the
          Personality screen as a circular progress wheel + facet
          accordion. Cleaner mental model — "how shaped the cat is"
          lives under "the cat's personality." See Personality tile
          below; opens /personality which now hosts the wheel. */}

      {/* Tiles, in the explicit order: Personality → Diary → Postcard
          → Photos → Posters → Memory Book. */}

      <Tile
        live={
          !!personalityProfile &&
          hasEnoughDataForReveal(personalityProfile) &&
          confidenceLabel(personalityProfile.confidence) === 'stable'
        }
        icon={<MaskHappy size={22} color={t.secondary700} weight="duotone" />}
        title={`${catPossessive(cat?.name)} Personality`}
        body={personalitySubtitle}
        onPress={() => router.push('/personality' as never)}
      />

      <Tile
        live={!!todaysDiary}
        unreadCount={diaryUnread}
        icon={<NotePencil size={22} color={t.secondary700} weight="duotone" />}
        title={`${catPossessive(cat?.name)} Diary`}
        body={diarySubtitle}
        onPress={() => router.push('/diary' as never)}
      />

      <Tile
        live
        icon={<PaperPlaneTilt size={22} color={t.secondary700} weight="duotone" />}
        title={`${catPossessive(cat?.name)} Postcard`}
        body={postcardSubtitle}
        onPress={() => router.push('/postcard' as never)}
      />

      {/* Meow Translator moved to Today tab on 2026-05-11 — it's a
          quick-action read, not a passive bond surface. Lives alongside
          Body Language under "Know your cat" on Today. */}

      <Tile
        live
        icon={<Images size={22} color={t.secondary700} weight="duotone" />}
        title={`${catPossessive(cat?.name)} Photos`}
        body={photosSubtitle}
        onPress={() => router.push('/photo-studio' as never)}
      />

      <Tile
        live={subjectsCount > 0}
        icon={<UsersThree size={22} color={t.secondary700} weight="duotone" />}
        title={`${catPossessive(cat?.name)} People & Pets`}
        body={
          subjectsCount === 0
            ? `Tag who's in ${catName}'s photos — names show up in the diary as memories.`
            : `${subjectsCount} ${subjectsCount === 1 ? 'name' : 'names'} ${catName} sees regularly. Tap to manage.`
        }
        onPress={() => router.push('/people' as never)}
      />

      <Tile
        live
        icon={<FilmSlate size={22} color={t.secondary700} weight="duotone" />}
        title={`${catPossessive(cat?.name)} Posters`}
        body={
          photosInLastWeek === 0
            ? `A new theme every week — movie posters, famous paintings, historical figures, Ghibli scenes. Snap a photo this week and ${catName} gets reimagined into this week's theme.`
            : `A new theme every week — ${catName} reimagined as a movie hero, a famous painting, a historical figure, a Ghibli forest spirit. Tap to see this week's piece.`
        }
        onPress={() => router.push('/cat-studio' as never)}
      />

      {/* Memory Book — HIDDEN for everyday users. Surfaced ONLY in
          November / December each year as the year-in-review feature.
          Year-in-review has nothing meaningful to show off-season —
          a cat's "January wrapped" with 11 days of data is empty
          calories. Reveal window: months 10 (Nov) and 11 (Dec) of
          the local calendar year. Build target for the actual feature:
          Q3 2026 when the earliest beta cohort hits 6mo of data. */}
      {(() => {
        const monthIdx = new Date().getMonth(); // 0=Jan, 10=Nov, 11=Dec
        const inMemoryBookSeason = monthIdx === 10 || monthIdx === 11;
        if (!inMemoryBookSeason) return null;
        return (
          <Tile
            comingSoon
            icon={<BookBookmark size={22} color={t.textMuted} weight="duotone" />}
            title={`${catPossessive(cat?.name)} Memory Book`}
            body={`Year-in-review for ${catName} — like Spotify Wrapped, but for a cat.`}
          />
        );
      })()}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Hero photo capture card
// ---------------------------------------------------------------------------

/**
 * The canonical "add photo" entry point for the Bond pillar. Behaviour:
 *   - Empty state (0 today): big CTA + value pitch
 *   - Has photos today: thumbnails strip + always-visible Add tile
 *
 * Daily cap was removed 2026-05-04 — users take unlimited photos; the
 * postcard samples 3 at random from today's pool.
 *
 * Photo source flow: tap → action sheet (Camera / Gallery / Cancel) →
 * `captureViaImagePicker` → `addPhoto` writes to photoStudioStore →
 * everything else (Postcard, Cat Studio, Diary, Photos screen) reads
 * from there.
 */
function BondPhotoCaptureCard({
  catId,
  catName,
}: {
  catId: string | null;
  catName: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const todaysPhotos = useTodaysPhotos(catId);
  const addPhoto = usePhotoStudioStore((s) => s.addPhoto);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    if (!catId || adding) return;
    Alert.alert(
      `Add a photo of ${catName}`,
      `Snap fresh — or pick from your gallery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => void capture('camera') },
        { text: 'Gallery', onPress: () => void capture('gallery') },
      ],
    );
  };

  const capture = async (source: 'camera' | 'gallery') => {
    if (!catId) return;
    setAdding(true);
    setError(null);
    try {
      const picked = await captureViaImagePicker({
        source,
        selectionLimit: PICKER_BATCH_LIMIT,
      });
      if (picked.length === 0) return; // user cancelled
      for (const p of picked) {
        await addPhoto({
          catId,
          sourceUri: p.uri,
          source,
          ...(p.width != null ? { width: p.width } : {}),
          ...(p.height != null ? { height: p.height } : {}),
        });
      }
      track({
        type: 'photo_studio_photo_added',
        props: {
          source,
          replaced_existing: false,
          total_after: todaysPhotos.length + picked.length,
        },
      });
    } catch (e) {
      console.warn('[Bond] capture failed:', e);
      const reason = e instanceof Error ? e.message : 'unknown';
      setError(`Couldn't add the photo — ${reason.slice(0, 100)}`);
    } finally {
      setAdding(false);
    }
  };

  const goToGallery = () => router.push('/photo-studio' as never);

  // Empty state — big CTA, explains WHY photos matter.
  if (todaysPhotos.length === 0) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={!catId || adding}
        accessibilityRole="button"
        accessibilityLabel={`Snap a photo of ${catName}`}
        style={({ pressed }) => [
          styles.captureCardEmpty,
          {
            backgroundColor: t.secondary100,
            borderColor: t.secondary500,
            opacity: pressed || adding ? 0.85 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.captureBadge,
            { backgroundColor: t.surfaceElevated, borderColor: t.secondary500 },
          ]}
        >
          <CameraIcon size={28} color={t.secondary700} weight="duotone" />
        </View>
        <Text token="heading2" style={{ marginTop: space[3], textAlign: 'center' }}>
          Snap a photo of {catName}.
        </Text>
        <Text
          token="body"
          color="textMuted"
          style={{ marginTop: space[2], textAlign: 'center', lineHeight: 22, maxWidth: 320 }}
        >
          Each photo brings {catName} more to life in here. The diary, postcards, and posters all draw from these — take as many as you like; postcard picks 3 at random.
        </Text>
        <Button
          label={adding ? 'Adding…' : 'Take a photo'}
          onPress={onAdd}
          disabled={!catId || adding}
          leftIcon={<CameraIcon size={18} color={t.textInverse} weight="bold" />}
          style={{ marginTop: space[5] }}
          size="md"
          pill
        />
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space[3] }}>
            <WarningCircle size={14} color={t.warning} />
            <Text token="caption" color="textMuted">{error}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  // Has-photos state — thumbnails + Add tile + cap counter.
  return (
    <View
      style={[
        styles.captureCardFilled,
        { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[3] }}>
        <Text token="caption" color="textMuted" style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>
          Today
        </Text>
        <Text token="caption" color="textMuted">
          {todaysPhotos.length} {todaysPhotos.length === 1 ? 'photo' : 'photos'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[2] }}
      >
        {/* Add tile FIRST so it stays visible without horizontal
            scrolling — the daily ritual is "snap a photo," and the
            camera CTA being the first thing users see (not the last
            thumbnail in a long row) is critical to the loop. Photo
            thumbnails scroll to the right of it. */}
        <Pressable
          onPress={onAdd}
          disabled={adding}
          accessibilityRole="button"
          accessibilityLabel={`Add a photo of ${catName}`}
          style={({ pressed }) => [
            styles.captureAddTile,
            {
              backgroundColor: t.secondary100,
              borderColor: t.secondary500,
              opacity: pressed || adding ? 0.7 : 1,
            },
          ]}
        >
          <CameraIcon size={26} color={t.secondary700} weight="duotone" />
          <Text token="caption" style={{ color: t.secondary900, fontFamily: 'Figtree_600SemiBold', marginTop: 4, fontSize: 11 }}>
            {adding ? 'Adding…' : 'Add'}
          </Text>
        </Pressable>
        {todaysPhotos.map((p) => (
          <Pressable
            key={p.id}
            onPress={goToGallery}
            accessibilityRole="button"
            accessibilityLabel="View photo"
            style={({ pressed }) => [
              styles.captureThumb,
              { borderColor: t.borderSubtle, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Image source={{ uri: p.uri }} style={styles.captureThumbImage} />
          </Pressable>
        ))}
      </ScrollView>
      <Text
        token="caption"
        color="textMuted"
        style={{ marginTop: space[3], lineHeight: 16 }}
      >
        With every photo, {catName} comes more to life in here.
      </Text>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space[3] }}>
          <WarningCircle size={14} color={t.warning} />
          <Text token="caption" color="textMuted">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

type TileProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
  live?: boolean;
  comingSoon?: boolean;
  /**
   * Optional unread count — when > 0, replaces the "NEW" pill with a
   * count chip (e.g. "3 unread"). Used by the Diary tile to surface
   * silent backfills the user hasn't seen yet.
   */
  unreadCount?: number;
  onPress?: () => void;
};

function Tile({ icon, title, body, live, comingSoon, unreadCount, onPress }: TileProps) {
  const t = useTheme();
  const interactive = !!onPress && !comingSoon;

  const containerStyle = [
    styles.tile,
    {
      backgroundColor: comingSoon ? t.surface : t.surfaceElevated,
      borderColor: t.borderSubtle,
      borderStyle: comingSoon ? ('dashed' as const) : ('solid' as const),
      opacity: comingSoon ? 0.85 : 1,
    },
  ];

  const inner = (
    <>
      <View
        style={[
          styles.tileIcon,
          {
            backgroundColor: comingSoon ? t.surfaceSunken : t.secondary100,
            borderColor: t.borderSubtle,
          },
        ]}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Text token="heading3">{title}</Text>
          {unreadCount && unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: t.secondary500 }]}>
              <Text token="caption" style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {unreadCount} unread
              </Text>
            </View>
          ) : live ? (
            <View style={[styles.badge, { backgroundColor: t.secondary100 }]}>
              <Text token="caption" style={{ color: t.secondary900, fontSize: 10 }}>
                NEW
              </Text>
            </View>
          ) : null}
          {comingSoon ? (
            <View style={[styles.badge, { backgroundColor: t.surfaceSunken }]}>
              <Text token="caption" style={{ color: t.textMuted, fontSize: 10 }}>
                SOON
              </Text>
            </View>
          ) : null}
        </View>
        <Text token="caption" color="textMuted">
          {body}
        </Text>
      </View>
      {interactive ? <CaretRight size={20} color={t.textMuted} /> : null}
    </>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => [...containerStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={containerStyle}>{inner}</View>;
}

/**
 * Circular cat-photo avatar with a friendly fallback when none is set.
 * Mirrors the Today/cats Avatar shape so the cat reads identically
 * across the app.
 */
function CatAvatar({ uri, size = 48 }: { uri: string | null; size?: number }) {
  const t = useTheme();
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          ...dims,
          borderWidth: 2,
          borderColor: t.borderSubtle,
        }}
      />
    );
  }
  return (
    <View
      style={{
        ...dims,
        borderWidth: 2,
        borderColor: t.borderSubtle,
        backgroundColor: t.secondary100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CatIcon size={size * 0.5} color={t.secondary700} weight="duotone" />
    </View>
  );
}

/**
 * Build a possessive prefix for a tile title — "Lily's" when the cat
 * has a name, fallback to "Cat" when no active cat. Repeated 6 times
 * across the Bond tiles; centralised here so future feature renames
 * touch one spot.
 */
function catPossessive(catName: string | null | undefined): string {
  return catName && catName.trim().length > 0 ? `${catName.trim()}'s` : 'Cat';
}

/** Trim a string to N chars on a word boundary. Used for tile previews. */
function truncateForPreview(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '…';
}

// Suppress the unused-import warning — CameraPlus is kept around for the
// near-future possibility of a "snap" camera-only quick-add CTA. Cheap
// to keep imported; phosphor icons are tree-shaken at build time.
void CameraPlus;

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  captureCardEmpty: {
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  captureCardFilled: {
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  captureBadge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  captureThumbImage: {
    width: '100%',
    height: '100%',
  },
  captureAddTile: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
