/**
 * PostcardShareCard — off-screen render target for the social share
 * asset. The actual PNG that ships to Instagram, TikTok, Twitter.
 *
 * Two formats:
 *   - 'square' — 1080×1080 (Instagram feed default)
 *   - 'story'  — 1080×1920 (IG + TikTok story format)
 *
 * Visual design (rebuilt 2026-05-02 after early UX feedback):
 *   - The collage FILLS the full card (no separate cream caption band
 *     below). Caption renders as a stylised overlay on the bottom
 *     third of the collage, against a dark linear gradient for
 *     readability across any photo content.
 *   - Caption font: SourceSerif4 italic (display weight). Centered.
 *     Wrapped in subtle dramatic quote marks ( " " ). Reads as a
 *     quotable line, not a diary paragraph.
 *   - Cat name in small uppercase tracking above the caption.
 *   - Watermark (🐾 catmd.pet) bottom-right, on a translucent dark
 *     pill — same as before.
 *
 * Photo failure-mode: collage parent backgroundColor is INK (dark) so
 * if any photo URI fails to load, the fallback shows as a dark frame
 * instead of an obvious sage smudge. The dark gradient at the bottom
 * is the same INK so failure blends rather than screams.
 *
 * Captured by react-native-view-shot's captureRef (lazy-loaded from
 * the Postcard screen — same defensive pattern as Cat Diary share).
 */
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { PostcardPhoto } from '../services/postcard';

const CREAM = '#FAF7F2';
const INK = '#1F2024';
// Photo container fallback. CREAM (was '#1A1A1A' before 2026-05-03) so
// any visible gutter or alpha-bleed during Android view-shot capture
// shows up as a light tone, not a dark wash. The dark fallback was
// the dominant cause of the WhatsApp "everything looks dim" complaint:
// react-native-view-shot on Android does not match the live render's
// alpha compositing, so any pixel that wasn't fully covered by a photo
// would punch through to the parent bg — and a black parent bg meant
// the export came out noticeably darker than the in-app preview.
const PHOTO_FALLBACK = CREAM;

export type PostcardFormat = 'square' | 'story';

export const POSTCARD_DIMS: Record<PostcardFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

type Props = {
  photos: PostcardPhoto[];
  caption: string;
  catName: string;
  format: PostcardFormat;
};

/**
 * Caption max-length safety net. The v2 caption prompt enforces ≤12
 * words / one sentence, but a stale cached caption (or a future prompt
 * regression) could still produce something too long for the overlay.
 * We trim mid-word truncation by slicing at the last word boundary
 * before MAX_CHARS and appending an ellipsis. RN's `numberOfLines={3}`
 * + `ellipsizeMode="tail"` is the second line of defence at the View
 * level, but the in-text trim makes failures look intentional rather
 * than chopped mid-word ("noting the peculiari…" → "noting the…").
 */
const CAPTION_MAX_CHARS = 100;
function fitCaption(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length <= CAPTION_MAX_CHARS) return trimmed;
  const slice = trimmed.slice(0, CAPTION_MAX_CHARS);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > CAPTION_MAX_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice;
  // Strip trailing punctuation before the ellipsis so we don't end
  // with "word,…" or "word.…" — looks tidier.
  return cut.replace(/[\s.,;:!?]+$/, '') + '…';
}

export function PostcardShareCard({ photos, caption, catName, format }: Props) {
  const dims = POSTCARD_DIMS[format];
  const isSquare = format === 'square';
  const safeCaption = fitCaption(caption);

  // Caption layout sizing — driven by format. Square is tighter on
  // vertical space; story has room for a larger display caption.
  // Caption legibility uses a hard text-shadow as the primary
  // strategy + a small static dark band underneath as backup. The
  // earlier LinearGradient was removed (2026-05-03) because Android's
  // react-native-view-shot rasterises gradients darker than the live
  // render — that single quirk was responsible for the entire export
  // looking dim when shared to WhatsApp/Instagram.
  const captionFontSize = isSquare ? 52 : 72;
  const captionLineHeight = isSquare ? 64 : 86;
  // Caption-band heights — tighter than the old gradient (which was
  // 28–32% of card height). Now we only darken the bottom strip that
  // actually sits behind the caption text.
  const bandHeightTall = isSquare ? Math.round(dims.height * 0.22) : Math.round(dims.height * 0.20);
  const bandHeightShort = Math.round(bandHeightTall * 0.55);

  return (
    <View
      style={{
        width: dims.width,
        height: dims.height,
        backgroundColor: PHOTO_FALLBACK,
      }}
    >
      {/* Full-bleed collage — fills the entire card. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <CollageLayout photos={photos} width={dims.width} height={dims.height} />
      </View>

      {/* Two-layer caption band — solid Views, NO LinearGradient. Two
          stacked semi-transparent dark Views approximate a soft bottom
          fade without using LinearGradient (which Android view-shot
          captures darker than the live render). The text-shadow on
          the caption is the primary readability strategy; these
          bands are belt-and-suspenders for very bright photo content.

          Layered:
            - Outer: ~22% of card height at rgba(0,0,0,0.30) — soft dim
            - Inner: ~12% of card height at rgba(0,0,0,0.40) — slight
              extra anchor right behind the text
          Total max alpha ≈ 0.58 in the very bottom slice — markedly
          lighter than the old gradient's 0.78 max. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: bandHeightTall,
          backgroundColor: 'rgba(0,0,0,0.30)',
        }}
        pointerEvents="none"
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: bandHeightShort,
          backgroundColor: 'rgba(0,0,0,0.40)',
        }}
        pointerEvents="none"
      />

      {/* Caption block — stylised serif italic, centered. Quote marks
          framing the line so it reads as a quotable beat, not a
          journal entry. Horizontal padding kept tight so longer
          captions wrap to 2-3 lines instead of truncating. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: isSquare ? 56 : 80,
          paddingBottom: isSquare ? 130 : 180,
          paddingTop: 40,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'Figtree_600SemiBold',
            fontSize: 22,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 18,
            textAlign: 'center',
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 6,
          }}
          numberOfLines={1}
        >
          {catName}
        </Text>
        <Text
          style={{
            color: CREAM,
            fontFamily: 'SourceSerif4_500Medium',
            fontSize: captionFontSize,
            lineHeight: captionLineHeight,
            textAlign: 'center',
            fontStyle: 'italic',
            // Hard text-shadow so the caption stays readable even when
            // the gradient is gentle. Offset+radius layers a soft black
            // halo behind every glyph — works on white fur, dark sofas,
            // sun-bleach, anything. Tested visually for legibility at
            // both square + story sizes.
            textShadowColor: 'rgba(0,0,0,0.95)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 12,
          }}
          // Allow up to ~3 lines but the prompt should keep captions
          // to one short line. JS-side word-boundary trim is the
          // first defence (see fitCaption); numberOfLines is the
          // second.
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {`“${safeCaption}”`}
        </Text>
      </View>

      {/* Watermark — bottom-right, sits above the gradient. Tasteful. */}
      <View
        style={{
          position: 'absolute',
          bottom: 36,
          right: 36,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 28,
          backgroundColor: 'rgba(31, 32, 36, 0.7)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Text
          style={{
            color: CREAM,
            fontFamily: 'Figtree_600SemiBold',
            fontSize: 22,
            letterSpacing: 1,
          }}
        >
          🐾 catmd.pet
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Collage layouts — orientation-aware
// ---------------------------------------------------------------------------
//
// Layout strategy (rebuilt 2026-05-03 after dark-export feedback):
//
//   Cells are ASSIGNED based on each photo's actual aspect ratio so a
//   tall photo lands in a tall cell and a wide photo lands in a wide
//   cell. When the cell aspect closely matches the photo aspect, we
//   render with `resizeMode="cover"` — no blurred backdrop fill needed.
//   Cover crops a few pixels symmetrically, never enough to lose a
//   head/paw/tail (the cat is always centered in the original photo).
//
//   When the aspect mismatch is too large for a clean cover (e.g. a
//   17:9 panorama in a 4:3 cell), we fall back to the original
//   contain+blurred-backdrop pattern — but that's now the rare path,
//   and we use a softer blur (14 vs 25) so the captured backdrop
//   stays bright enough that the export doesn't read as "dark".
//
// Why this matters for the WhatsApp-too-dark issue: Android's
// react-native-view-shot captures blurRadius regions noticeably darker
// than the live preview renders them. Earlier postcards forced every
// 3-photo collage into 3 horizontal stripes — vertical photos in those
// stripes left huge dark blurred wings on each side, and the captured
// JPEG looked nearly black on share. With orientation-aware tiling +
// cover-where-possible, the blur surface is tiny or zero, so the
// export brightness now matches the in-app preview.
//
// Layouts implemented:
//   - 1 photo:           full-bleed
//   - 2 photos:          side-by-side  OR  stacked (orientation-picked)
//   - 3 photos (all wide / square majority):   3 horizontal stripes
//   - 3 photos (all tall):                      3 vertical columns
//   - 3 photos (1 wide + 2 tall):              wide stripe top, 2 tall split bottom
//   - 3 photos (2 wide + 1 tall):              tall column left, 2 wide stacked right
//   - 4+ photos:                                2×2 grid (truncate)

type AspectClass = 'wide' | 'tall' | 'square';

function classifyAspect(width?: number, height?: number): AspectClass {
  if (!width || !height) return 'square'; // unknown dims → treat as square
  const r = width / height;
  if (r < 0.85) return 'tall';
  if (r > 1.18) return 'wide';
  return 'square';
}

/**
 * Pick a 3-photo layout based on the orientations of the three photos.
 * Falls back to 'stripes' if dims are missing — preserves the old
 * behaviour for legacy postcards rendered before width/height was
 * threaded through.
 */
function pickLayout3(photos: PostcardPhoto[]):
  | 'stripes'
  | 'columns'
  | 'wide-top'
  | 'tall-left' {
  const classes = photos.map((p) => classifyAspect(p.width, p.height));
  const tall = classes.filter((c) => c === 'tall').length;
  const wide = classes.filter((c) => c === 'wide').length;

  if (tall === 3) return 'columns';
  if (wide === 3 || tall === 0) return 'stripes';
  if (tall === 2 && wide === 1) return 'wide-top';
  if (wide === 2 && tall === 1) return 'tall-left';
  // 1 wide + 1 tall + 1 square (or other mixed cases): pick by majority
  return tall >= wide ? 'columns' : 'stripes';
}

/**
 * A single photo cell. NO BLUR — the blur backdrop was the root cause
 * of both the "dark export" (dark fallback + dark blur on capture) and
 * the "washed out" (cream fallback + light blur on bright photos)
 * complaints. Android's view-shot rasterises blurred Image layers in a
 * way that doesn't match the live render, and no fallback colour hides
 * the artefact. Removing it entirely is the only stable fix.
 *
 * Render mode picked per-cell:
 *   - When photo dims are KNOWN (modern postcards): always `cover`.
 *     The orientation-aware layout picker (pickLayout3) ensures the
 *     cell aspect closely matches the photo aspect, so cover crops
 *     modestly (<20% on one axis, symmetric, centred). Cat photos are
 *     virtually always centred so the subject survives the crop.
 *   - When photo dims are MISSING (legacy cached postcards that
 *     haven't been regenerated yet): fall back to `contain` with a
 *     cream letterbox. Cropping with cover is risky here because the
 *     layout picker collapsed all unknown-aspect photos into a single
 *     stripe layout — a portrait photo there would lose 70%+ on a
 *     cover crop. Cream bars look like an intentional polaroid frame
 *     and read fine on capture.
 */
function PhotoCell({
  uri,
  cellWidth,
  cellHeight,
  photoWidth,
  photoHeight,
}: {
  uri: string;
  cellWidth: number;
  cellHeight: number;
  /** Source photo dims. Decides cover vs contain — see comment above. */
  photoWidth?: number;
  photoHeight?: number;
}) {
  const haveDims = !!(photoWidth && photoHeight);
  // Image positioned in NATURAL flow (no absolute positioning) — on
  // Android, react-native-view-shot's offscreen capture can drop
  // absolute-positioned Images that DO render fine in the live view.
  // Natural-flow rasterises reliably during view-shot.
  return (
    <View style={{ width: cellWidth, height: cellHeight, backgroundColor: PHOTO_FALLBACK, overflow: 'hidden' }}>
      <Image
        source={{ uri }}
        style={{ width: cellWidth, height: cellHeight }}
        resizeMode={haveDims ? 'cover' : 'contain'}
      />
    </View>
  );
}

const GUTTER = 6;

function CollageLayout({
  photos,
  width,
  height,
}: {
  photos: PostcardPhoto[];
  width: number;
  height: number;
}) {
  if (photos.length === 0) {
    return (
      <View
        style={{
          width,
          height,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: PHOTO_FALLBACK,
        }}
      >
        <Text style={{ color: CREAM, fontSize: 48 }}>🐾</Text>
      </View>
    );
  }

  if (photos.length === 1) {
    return (
      <PhotoCell
        uri={photos[0].uri}
        cellWidth={width}
        cellHeight={height}
        photoWidth={photos[0].width}
        photoHeight={photos[0].height}
      />
    );
  }

  if (photos.length === 2) {
    // Pick split direction by orientation: 2 tall photos read better as
    // 2 columns (cell aspect ~0.5 matches tall sources). Otherwise
    // stack as 2 rows so wide photos get full-width cells.
    const c0 = classifyAspect(photos[0].width, photos[0].height);
    const c1 = classifyAspect(photos[1].width, photos[1].height);
    const bothTall = c0 === 'tall' && c1 === 'tall';
    if (bothTall) {
      const halfW = (width - GUTTER) / 2;
      return (
        <View style={{ flexDirection: 'row', width, height, backgroundColor: PHOTO_FALLBACK }}>
          <PhotoCell uri={photos[0].uri} cellWidth={halfW} cellHeight={height} photoWidth={photos[0].width} photoHeight={photos[0].height} />
          <View style={{ width: GUTTER, height, backgroundColor: PHOTO_FALLBACK }} />
          <PhotoCell uri={photos[1].uri} cellWidth={halfW} cellHeight={height} photoWidth={photos[1].width} photoHeight={photos[1].height} />
        </View>
      );
    }
    // Default: stack as rows — wide-friendly.
    const halfH = (height - GUTTER) / 2;
    return (
      <View style={{ width, height, backgroundColor: PHOTO_FALLBACK }}>
        <PhotoCell uri={photos[0].uri} cellWidth={width} cellHeight={halfH} photoWidth={photos[0].width} photoHeight={photos[0].height} />
        <View style={{ height: GUTTER, width, backgroundColor: PHOTO_FALLBACK }} />
        <PhotoCell uri={photos[1].uri} cellWidth={width} cellHeight={halfH} photoWidth={photos[1].width} photoHeight={photos[1].height} />
      </View>
    );
  }

  if (photos.length === 3) {
    const layout = pickLayout3(photos);
    // Re-order photos so the right-shaped photo lands in the right-
    // shaped cell. We don't mutate the input — just compute an indexed
    // order. `cells` describes the visual grid; we map the photos to
    // cells based on which orientation each cell prefers.
    if (layout === 'stripes') {
      // 3 horizontal stripes — wide-friendly.
      const stripeH = Math.floor((height - GUTTER * 2) / 3);
      return (
        <View style={{ width, height, backgroundColor: PHOTO_FALLBACK }}>
          <PhotoCell uri={photos[0].uri} cellWidth={width} cellHeight={stripeH} photoWidth={photos[0].width} photoHeight={photos[0].height} />
          <View style={{ height: GUTTER, width, backgroundColor: PHOTO_FALLBACK }} />
          <PhotoCell uri={photos[1].uri} cellWidth={width} cellHeight={stripeH} photoWidth={photos[1].width} photoHeight={photos[1].height} />
          <View style={{ height: GUTTER, width, backgroundColor: PHOTO_FALLBACK }} />
          <PhotoCell uri={photos[2].uri} cellWidth={width} cellHeight={stripeH} photoWidth={photos[2].width} photoHeight={photos[2].height} />
        </View>
      );
    }

    if (layout === 'columns') {
      // 3 vertical columns — tall-friendly.
      const colW = Math.floor((width - GUTTER * 2) / 3);
      return (
        <View style={{ flexDirection: 'row', width, height, backgroundColor: PHOTO_FALLBACK }}>
          <PhotoCell uri={photos[0].uri} cellWidth={colW} cellHeight={height} photoWidth={photos[0].width} photoHeight={photos[0].height} />
          <View style={{ width: GUTTER, height, backgroundColor: PHOTO_FALLBACK }} />
          <PhotoCell uri={photos[1].uri} cellWidth={colW} cellHeight={height} photoWidth={photos[1].width} photoHeight={photos[1].height} />
          <View style={{ width: GUTTER, height, backgroundColor: PHOTO_FALLBACK }} />
          <PhotoCell uri={photos[2].uri} cellWidth={colW} cellHeight={height} photoWidth={photos[2].width} photoHeight={photos[2].height} />
        </View>
      );
    }

    if (layout === 'wide-top') {
      // 1 wide stripe on top + 2 tall side-by-side on bottom.
      // Reorder: put the wide photo first, talls after.
      const sorted = [...photos].sort((a, b) => {
        const ca = classifyAspect(a.width, a.height);
        const cb = classifyAspect(b.width, b.height);
        if (ca === 'wide' && cb !== 'wide') return -1;
        if (cb === 'wide' && ca !== 'wide') return 1;
        return 0;
      });
      const topH = Math.floor(height * 0.5) - Math.floor(GUTTER / 2);
      const botH = height - topH - GUTTER;
      const halfW = (width - GUTTER) / 2;
      return (
        <View style={{ width, height, backgroundColor: PHOTO_FALLBACK }}>
          <PhotoCell uri={sorted[0].uri} cellWidth={width} cellHeight={topH} photoWidth={sorted[0].width} photoHeight={sorted[0].height} />
          <View style={{ height: GUTTER, width, backgroundColor: PHOTO_FALLBACK }} />
          <View style={{ flexDirection: 'row', width, height: botH }}>
            <PhotoCell uri={sorted[1].uri} cellWidth={halfW} cellHeight={botH} photoWidth={sorted[1].width} photoHeight={sorted[1].height} />
            <View style={{ width: GUTTER, height: botH, backgroundColor: PHOTO_FALLBACK }} />
            <PhotoCell uri={sorted[2].uri} cellWidth={halfW} cellHeight={botH} photoWidth={sorted[2].width} photoHeight={sorted[2].height} />
          </View>
        </View>
      );
    }

    // tall-left: 1 tall column on the left + 2 wide stacked on the right.
    const sorted = [...photos].sort((a, b) => {
      const ca = classifyAspect(a.width, a.height);
      const cb = classifyAspect(b.width, b.height);
      if (ca === 'tall' && cb !== 'tall') return -1;
      if (cb === 'tall' && ca !== 'tall') return 1;
      return 0;
    });
    const leftW = Math.floor(width * 0.5) - Math.floor(GUTTER / 2);
    const rightW = width - leftW - GUTTER;
    const halfH = (height - GUTTER) / 2;
    return (
      <View style={{ flexDirection: 'row', width, height, backgroundColor: PHOTO_FALLBACK }}>
        <PhotoCell uri={sorted[0].uri} cellWidth={leftW} cellHeight={height} photoWidth={sorted[0].width} photoHeight={sorted[0].height} />
        <View style={{ width: GUTTER, height, backgroundColor: PHOTO_FALLBACK }} />
        <View style={{ width: rightW, height }}>
          <PhotoCell uri={sorted[1].uri} cellWidth={rightW} cellHeight={halfH} photoWidth={sorted[1].width} photoHeight={sorted[1].height} />
          <View style={{ height: GUTTER, width: rightW, backgroundColor: PHOTO_FALLBACK }} />
          <PhotoCell uri={sorted[2].uri} cellWidth={rightW} cellHeight={halfH} photoWidth={sorted[2].width} photoHeight={sorted[2].height} />
        </View>
      </View>
    );
  }

  // 4+ photos → 2×2 grid (truncate at 4). Each cell is square so
  // square photos cover cleanly; tall and wide photos land in close-
  // enough cells that cover crops only a small symmetric strip.
  const halfW = (width - GUTTER) / 2;
  const halfH = (height - GUTTER) / 2;
  return (
    <View style={{ width, height, backgroundColor: PHOTO_FALLBACK }}>
      <View style={{ flexDirection: 'row' }}>
        <PhotoCell uri={photos[0].uri} cellWidth={halfW} cellHeight={halfH} photoWidth={photos[0].width} photoHeight={photos[0].height} />
        <View style={{ width: GUTTER, height: halfH, backgroundColor: PHOTO_FALLBACK }} />
        <PhotoCell uri={photos[1].uri} cellWidth={halfW} cellHeight={halfH} photoWidth={photos[1].width} photoHeight={photos[1].height} />
      </View>
      <View style={{ height: GUTTER, width, backgroundColor: PHOTO_FALLBACK }} />
      <View style={{ flexDirection: 'row' }}>
        <PhotoCell uri={photos[2].uri} cellWidth={halfW} cellHeight={halfH} photoWidth={photos[2].width} photoHeight={photos[2].height} />
        <View style={{ width: GUTTER, height: halfH, backgroundColor: PHOTO_FALLBACK }} />
        <PhotoCell uri={photos[3].uri} cellWidth={halfW} cellHeight={halfH} photoWidth={photos[3].width} photoHeight={photos[3].height} />
      </View>
    </View>
  );
}

// Suppress: StyleSheet not used now — kept to match the rest of the
// codebase's style conventions if we re-introduce shared styles later.
void StyleSheet;
