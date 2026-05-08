/**
 * DiaryShareCard — off-screen render target for the share-card export.
 *
 * Renders at 1080×1920 (Instagram-story format). Cat photo as duotone-tinted
 * background, entry text in serif over a translucent card, mood word in
 * the corner, "Built with CatMD · catmd.pet" footer. Captured by
 * `react-native-view-shot` and shared via `expo-sharing`.
 *
 * Why a dedicated component (vs reusing the diary-screen card):
 *   - The on-screen card is small and uses the device DPR; a 1080×1920
 *     capture from a small layout would be blurry or oddly cropped.
 *   - Off-screen renders let us tune typography and padding for the
 *     story-format (tall, centred, no scroll, no chrome).
 *   - Encapsulates the brand wash treatment (sage→terracotta gradient
 *     overlay) so the share artefact always reads as CatMD-brand even
 *     when the cat photo is dark or busy.
 */
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from './Text';
import type { DiaryEntry } from '../services/diary';

// Brand anchors — kept in sync with `tokens.ts`.
const SAGE = '#5B8A7A';
const TERRACOTTA = '#C97B63';
const CREAM = '#FAF7F2';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

type Props = {
  entry: DiaryEntry;
  catName: string;
  photoUri?: string | null;
  /** Long format date string (e.g. "Friday, May 1"). */
  longDate: string;
};

/**
 * Note on positioning: this component is rendered OFF-SCREEN by the
 * caller (an absolutely-positioned 1080×1920 host with `top: -99999`).
 * react-native-view-shot's captureRef walks the actual layout tree, so
 * we need real layout, not a transform-scaled DOM-style preview.
 */
export function DiaryShareCard({ entry, catName, photoUri, longDate }: Props) {
  return (
    <View style={styles.root}>
      {/* Background — cat photo (blurred + low-opacity) OR cream wash */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.55 }]}
          blurRadius={6}
          resizeMode="cover"
        />
      ) : null}

      {/* Brand-tint gradient overlay */}
      <Svg
        style={StyleSheet.absoluteFillObject}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="dshare" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={SAGE} stopOpacity={photoUri ? 0.55 : 0.85} />
            <Stop offset="100%" stopColor={TERRACOTTA} stopOpacity={photoUri ? 0.55 : 0.85} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dshare)" />
      </Svg>

      {/* Foreground content */}
      <View style={styles.content}>
        {/* Top: kicker */}
        <View style={styles.kickerRow}>
          <Text style={[styles.kicker]}>{longDate}</Text>
          <Text style={[styles.kicker, { textAlign: 'right' }]}>
            mood · {entry.mood_word}
          </Text>
        </View>

        {/* Center: the entry on a translucent card */}
        <View style={styles.entryCard}>
          <Text style={styles.entryAttribution}>
            Today, written by {catName}
          </Text>
          <Text style={styles.entryText}>{entry.entry}</Text>
        </View>

        {/* Bottom: brand mark */}
        <View style={styles.footer}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>CatMD</Text>
          </View>
          <Text style={styles.brandUrl}>catmd.pet</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: CREAM,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 100,
    paddingTop: 120,
    paddingBottom: 100,
    justifyContent: 'space-between',
  },
  kickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    color: CREAM,
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 28,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  entryCard: {
    backgroundColor: 'rgba(250, 247, 242, 0.94)',
    padding: 64,
    borderRadius: 36,
    marginVertical: 80,
  },
  entryAttribution: {
    color: TERRACOTTA,
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 32,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 36,
  },
  entryText: {
    color: '#1F2024',
    fontFamily: 'SourceSerif4_400Regular',
    fontSize: 52,
    lineHeight: 76,
  },
  footer: {
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: CREAM,
  },
  brandText: {
    color: CREAM,
    fontFamily: 'SourceSerif4_500Medium',
    fontSize: 56,
    letterSpacing: 1,
  },
  brandUrl: {
    color: CREAM,
    fontFamily: 'Figtree_400Regular',
    fontSize: 26,
    opacity: 0.85,
    marginTop: 14,
    letterSpacing: 4,
  },
});
