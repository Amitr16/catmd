/**
 * Cat Birthday screen — happy-birthday celebration page.
 *
 * Triggered by the home-tab banner when today's MM-DD matches the active
 * cat's DOB (any year). Free for everyone to see the wish + age. Paying
 * users (isPro) unlock a curated album of the cat's last 12 months of
 * photos — sourced from scan.image_uri + the cat profile photo.
 *
 * Future enhancements (deferred):
 *   - AI-generated birthday card image (Cat Studio integration)
 *   - Cat-voice diary entry written for the day (Diary integration)
 *   - Year-in-numbers ("47 check-ins, 8 scans, 2 vet visits")
 *   - Shareable birthday card export
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Cake, Crown, Lock, Sparkle } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useCatStore, resolveCatAgeYears } from '../src/state/catStore';
import { useScanStore } from '../src/state/scanStore';
import { useEntitlement } from '../src/hooks/useEntitlement';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

const DAY_MS = 24 * 60 * 60 * 1000;
const ALBUM_WINDOW_DAYS = 365;

export default function CatBirthdayScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const allScans = useScanStore((s) => s.scans);
  const { isPro } = useEntitlement();

  const ageYears = resolveCatAgeYears(cat);
  const trackedOpenRef = useRef<string | null>(null);

  // Build the birthday album from scan images + cat profile photo.
  // Filter to the last 12 months and de-dup by URI.
  const albumPhotos = useMemo(() => {
    if (!cat) return [];
    const cutoff = Date.now() - ALBUM_WINDOW_DAYS * DAY_MS;
    const seen = new Set<string>();
    const out: Array<{ uri: string; takenAt: string }> = [];
    if (cat.photo_uri) {
      seen.add(cat.photo_uri);
      out.push({ uri: cat.photo_uri, takenAt: cat.updated_at });
    }
    const scanPhotos = allScans
      .filter((s) => s.cat_id === cat.id && !!s.image_uri)
      .filter((s) => new Date(s.created_at).getTime() >= cutoff)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    for (const s of scanPhotos) {
      if (s.image_uri && !seen.has(s.image_uri)) {
        seen.add(s.image_uri);
        out.push({ uri: s.image_uri, takenAt: s.created_at });
      }
    }
    return out;
  }, [cat, allScans]);

  // Telemetry: birthday_screen_opened — yearly retention peak. Fires
  // once per cat per mount, AFTER albumPhotos has been computed so
  // album_size is accurate. trackedOpenRef stops re-fires on re-render.
  useEffect(() => {
    if (!cat?.id) return;
    if (trackedOpenRef.current === cat.id) return;
    trackedOpenRef.current = cat.id;
    void import('../src/services/analytics').then(({ track }) =>
      track({
        type: 'birthday_screen_opened',
        props: { is_pro: isPro, album_size: albumPhotos.length },
      }),
    );
  }, [cat?.id, isPro, albumPhotos.length]);

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text token="heading2">No active cat</Text>
          <Button label="Back" onPress={() => router.back()} style={{ marginTop: space[4] }} />
        </View>
      </View>
    );
  }

  const catName = cat.name;

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      {/* Header with back button — minimal, lets the celebration breathe */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
        </Pressable>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[6],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — clear large circular cat photo (or friendly fallback)
            as the centrepiece, with the celebratory copy beneath. The
            previous duotone treatment buried the photo under a saturated
            sage→terracotta overlay and read as a smudge. The right
            celebration here is a clear photo of the cat, not chrome. */}
        <View style={styles.heroBlock}>
          {cat?.photo_uri ? (
            <Image
              source={{ uri: cat.photo_uri }}
              style={[
                styles.heroPhoto,
                { borderColor: t.secondary500 },
              ]}
            />
          ) : (
            <View
              style={[
                styles.heroPhoto,
                {
                  backgroundColor: t.secondary100,
                  borderColor: t.secondary500,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Cake size={64} color={t.secondary700} weight="duotone" />
            </View>
          )}

          <Text
            token="displayLg"
            style={{ textAlign: 'center', marginTop: space[5] }}
          >
            Happy Birthday,{'\n'}
            <Text token="displayLg" style={{ color: t.secondary700, fontStyle: 'italic' }}>
              {catName}
            </Text>
            !
          </Text>
          {ageYears != null && (
            <Text
              token="bodyLg"
              color="textSecondary"
              style={{ textAlign: 'center', marginTop: space[3] }}
            >
              {ageYears < 1
                ? 'First birthday on the way 🎂'
                : ageYears === 1
                  ? '1 year old today 🎂'
                  : `${ageYears} years old today 🎂`}
            </Text>
          )}

          <Text
            token="body"
            color="textMuted"
            style={{
              textAlign: 'center',
              marginTop: space[5],
              lineHeight: 24,
              maxWidth: 360,
              alignSelf: 'center',
            }}
          >
            Another year of slow blinks, sun-puddle naps, and 3 a.m. zoomies.
            Thanks for letting us be part of the journey, {catName}.
          </Text>
        </View>

        {/* Album section + close-out friendly text */}
        <View>

        {/* Album section — Pro gates the photo gallery */}
        <View style={{ marginTop: space[8] }}>
          <View style={styles.sectionHead}>
            <Sparkle size={20} color={t.secondary700} weight="duotone" />
            <Text token="heading3">{catName}&apos;s year in pictures</Text>
          </View>

          {isPro ? (
            albumPhotos.length === 0 ? (
              <View
                style={[
                  styles.emptyAlbum,
                  { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
                ]}
              >
                <Text token="body" color="textMuted" style={{ textAlign: 'center' }}>
                  No photos yet from the last 12 months. Photos from your scans
                  and check-ins will appear here on future birthdays.
                </Text>
              </View>
            ) : (
              <View style={styles.albumGrid}>
                {albumPhotos.map((p) => (
                  <View
                    key={p.uri}
                    style={[
                      styles.albumTile,
                      { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
                    ]}
                  >
                    <Image source={{ uri: p.uri }} style={styles.albumImage} />
                    <Text
                      token="caption"
                      color="textMuted"
                      style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                    >
                      {new Date(p.takenAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )
          ) : (
            // Free-tier upsell — simple, warm, non-pushy
            <Pressable
              onPress={() => {
                void import('../src/services/analytics').then(({ track }) =>
                  track({ type: 'birthday_album_paywall_tapped' }),
                );
                router.push({
                  pathname: '/paywall',
                  params: { source: 'birthday_album' },
                });
              }}
              style={({ pressed }) => [
                styles.lockedAlbum,
                {
                  backgroundColor: t.secondary50,
                  borderColor: t.secondary300,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.lockBadge,
                  { backgroundColor: t.secondary100, borderColor: t.borderSubtle },
                ]}
              >
                <Lock size={28} color={t.secondary700} weight="duotone" />
              </View>
              <Text token="heading3" style={{ marginTop: space[4], textAlign: 'center' }}>
                {catName}&apos;s birthday album is a Pro perk
              </Text>
              <Text
                token="body"
                color="textSecondary"
                style={{ textAlign: 'center', marginTop: space[2], lineHeight: 22 }}
              >
                Unlock {catName}&apos;s curated photo album from the last 12 months —
                plus a year-in-review every birthday — with CatMD Pro.
              </Text>
              <View
                style={[
                  styles.upgradeBtn,
                  { backgroundColor: t.secondary700, marginTop: space[5] },
                ]}
              >
                <Crown size={18} color={t.textInverse} weight="bold" />
                <Text token="body" style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}>
                  Upgrade to Pro
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Friendly close */}
        <Text
          token="caption"
          color="textMuted"
          style={{ textAlign: 'center', marginTop: space[8], lineHeight: 20 }}
        >
          From all of us at CatMD — extra treats and a long sun-puddle nap today, {catName}. 🐾
        </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
  heroBlock: { alignItems: 'center', marginTop: space[6] },
  heroPhoto: {
    width: 220,
    height: 220,
    borderRadius: radius.full,
    borderWidth: 4,
  },
  cakeBadge: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[4],
  },
  emptyAlbum: {
    padding: space[6],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  albumTile: {
    width: '48.5%',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  albumImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  lockedAlbum: {
    padding: space[6],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderRadius: radius.full,
  },
});
