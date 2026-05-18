/**
 * Install Referrer — local Expo module.
 *
 * Wraps Google's Play Install Referrer SDK (com.android.installreferrer)
 * for marketing-attribution capture on Android. Returns the install
 * referrer URL set by the source that initiated the install (Google
 * Play organic, Google Ads, custom ?referrer=... links, etc.), so we
 * can parse UTM parameters and pipe them into PostHog as super-
 * properties for funnel analysis.
 *
 * Android only. iOS returns null without throwing — caller should
 * default `utm_source` to `'organic'` on null/error.
 *
 * Usage:
 *   const details = await getReferrerDetails();
 *   // { referrerUrl: 'utm_source=google-play&utm_medium=organic', ... }
 *   //   OR null on iOS / failure / device without Play Store
 *
 * Reference:
 *   https://developer.android.com/google/play/installreferrer/library
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type InstallReferrerDetails = {
  /** Raw referrer URL — typically a URL-encoded query string. May be empty. */
  referrerUrl: string;
  /** UNIX-seconds when the referrer click was timestamped on Google Play servers. */
  referrerClickTimestamp: number;
  /** UNIX-seconds when the install began. */
  installBeginTimestamp: number;
  /** True if this install came from a Google Play Instant App. */
  googlePlayInstantParam: boolean;
};

type NativeBinding = {
  getReferrerDetails: () => Promise<InstallReferrerDetails>;
};

// requireOptionalNativeModule returns null if the module isn't installed
// (e.g. running in Expo Go, on iOS, or in any environment where the
// Android side hasn't been autolinked). Avoids a hard crash on cold
// boot in dev.
const InstallReferrer = requireOptionalNativeModule<NativeBinding>('InstallReferrer');

/**
 * Fetch the install-referrer details from Google Play. Returns null on
 * any failure path (iOS, sideloaded APK, Play Store unavailable, native
 * module missing, SDK error). Caller is responsible for the
 * `'organic'` default — keep this function pure-fetch with explicit
 * null returns.
 *
 * Safe to call multiple times — Google's SDK opens a new connection
 * each call. For first-launch-once semantics, gate at the caller using
 * an AsyncStorage flag.
 */
export async function getReferrerDetails(): Promise<InstallReferrerDetails | null> {
  if (Platform.OS !== 'android') return null;
  if (!InstallReferrer) return null;
  try {
    const result = await InstallReferrer.getReferrerDetails();
    if (!result || typeof result.referrerUrl !== 'string') return null;
    return result;
  } catch {
    // Service unavailable, feature not supported, or transient network /
    // Play-services failure. Caller defaults to organic.
    return null;
  }
}
