/**
 * DuotoneCatHero — personalised hero band for relational surfaces.
 *
 * Renders the active cat's photo as a textural background, blurred and
 * dimmed, with a sage→terracotta brand-gradient overlay on top. Used on
 * Today, Bond, and Cat-birthday — surfaces *about* the relationship —
 * never on Triage / Watch / Settings (clinical surfaces stay clean).
 *
 * Why duotone, not raw photo:
 *   1. Hides photo-quality issues (lighting, blur, off-angle, busy bg)
 *   2. Brand-tints regardless of cat's coat colour — a black cat and a
 *      ginger cat both produce a recognisable CatMD-branded hero
 *   3. Textural presence, not photographic — feels designed
 *
 * Fallback: when no photo is set, the gradient + cream surface alone
 * renders a soft brand wash. Never an empty state, never a broken image.
 *
 * Implementation: react-native-svg LinearGradient (already in deps —
 * avoids adding expo-linear-gradient just for this), and Image's
 * built-in `blurRadius` prop for the photo blur.
 */
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

export type DuotoneEmphasis = 'balanced' | 'sage' | 'terracotta';

type Props = {
  /** Cat's photo URI from `catStore`. May be null/undefined — falls back to gradient-only. */
  photoUri?: string | null;
  /**
   * Hero height in px. Ignored when fullBleed is true.
   * If omitted (and not fullBleed), the hero auto-sizes to its children —
   * useful when the celebration block has variable text length.
   */
  height?: number;
  /** When true, fills its parent absolutely (used for cat-birthday hero). */
  fullBleed?: boolean;
  /**
   * Bias the gradient distribution:
   *   balanced  — 50/50 sage→terracotta (Today)
   *   sage      — sage-weighted (medical-ish surfaces if ever needed)
   *   terracotta — terracotta-weighted (Bond, cat-birthday)
   */
  emphasis?: DuotoneEmphasis;
  /** Outer container style override (e.g. negative margins for full-bleed inside padded ScrollView). */
  style?: ViewStyle;
  /** Override children render zone — children sit ABOVE the duotone. */
  children?: React.ReactNode;
};

// Brand anchors — kept in sync with `tokens.ts` primary500 + secondary500.
// We hard-code the hex here because Svg's <Stop stopColor> is render-time
// and reading them through the theme hook each frame is wasted work.
const SAGE = '#5B8A7A';
const TERRACOTTA = '#C97B63';

// Gradient stops by emphasis. Each entry is [offset (0..1), color].
function stopsForEmphasis(e: DuotoneEmphasis): Array<[number, string]> {
  switch (e) {
    case 'sage':
      return [
        [0.0, SAGE],
        [0.65, SAGE],
        [1.0, TERRACOTTA],
      ];
    case 'terracotta':
      return [
        [0.0, SAGE],
        [0.35, TERRACOTTA],
        [1.0, TERRACOTTA],
      ];
    case 'balanced':
    default:
      return [
        [0.0, SAGE],
        [1.0, TERRACOTTA],
      ];
  }
}

export function DuotoneCatHero({
  photoUri,
  height,
  fullBleed = false,
  emphasis = 'balanced',
  style,
  children,
}: Props) {
  const t = useTheme();
  const stops = stopsForEmphasis(emphasis);

  // Container modes:
  //   fullBleed       — absolute-fills parent (cat-birthday full-page hero)
  //   height passed   — fixed height banner (Today, Bond)
  //   height omitted  — auto-sizes to children (cat-birthday content-fit)
  const containerStyle: ViewStyle = fullBleed
    ? { ...StyleSheet.absoluteFillObject }
    : height !== undefined
      ? { height, width: '100%' }
      : { width: '100%' };

  // Photo opacity — slightly higher than the spec floor so a dim photo still
  // reads as "your cat" through the overlay.  35% photo + 55% gradient =
  // visible cat at a glance, branded mood at a distance.
  const PHOTO_OPACITY = 0.35;
  const GRADIENT_OPACITY = 0.55;

  return (
    <View style={[containerStyle, { backgroundColor: t.surfaceSunken, overflow: 'hidden' }, style]}>
      {/* Photo layer (or gradient-only fallback if no URI). */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={[StyleSheet.absoluteFillObject, { opacity: PHOTO_OPACITY }]}
          blurRadius={16}
          resizeMode="cover"
          accessible={false}
        />
      ) : null}

      {/* Sage→terracotta gradient overlay. preserveAspectRatio="none" so the
          gradient stretches to fill regardless of band aspect ratio. */}
      <Svg
        style={StyleSheet.absoluteFillObject}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="duotone" x1="0%" y1="0%" x2="100%" y2="100%">
            {stops.map(([offset, color], i) => (
              <Stop
                key={i}
                offset={`${offset * 100}%`}
                stopColor={color}
                stopOpacity={GRADIENT_OPACITY}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#duotone)" />
      </Svg>

      {/* Foreground content rendered above the duotone. */}
      {children}
    </View>
  );
}
