/**
 * RevenueCat wrapper + dev fallback.
 *
 * Two modes, controlled by EXPO_PUBLIC_ENABLE_PAYWALL:
 *
 * - "false" (default)  → RC SDK not called. getEntitlement() returns TRUE
 *   (all features unlocked). Useful in Expo Go and for local dev.
 *
 * - "true"              → real RC SDK. Requires Expo Dev Client build
 *   (react-native-purchases is a native module). Entitlement is whatever
 *   the store says for this appUserID.
 *
 * When you're ready to ship paid, add a RevenueCat project, create the
 * "pro" entitlement, flip the flag, and install via:
 *     npx expo install react-native-purchases
 *     eas build --profile development --platform android
 */
import { Platform } from 'react-native';

const ENABLED =
  (process.env.EXPO_PUBLIC_ENABLE_PAYWALL ?? 'false').toLowerCase() === 'true';

/**
 * Dev-only knob: when paywall is disabled, we normally auto-grant Pro to
 * unblock local dev. Set EXPO_PUBLIC_DEV_FORCE_FREE=true to flip that —
 * the app then behaves as a non-Pro user and you can test the paywall
 * flow without installing RevenueCat.
 */
const DEV_FORCE_FREE =
  (process.env.EXPO_PUBLIC_DEV_FORCE_FREE ?? 'false').toLowerCase() === 'true';

const ENTITLEMENT_ID = 'pro';

/**
 * Dev-mode virtual packages so the paywall UI has something to render
 * without an RC project attached.
 */
export type CatMdPackage = {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
    title: string;
    description: string;
  };
  period: 'MONTHLY' | 'ANNUAL' | 'LIFETIME';
};

/**
 * Dev-mode virtual packages — mirror the Play Console / App Store Connect
 * products we'll create once Play Console verification clears. Prices
 * anchor to USD; Play auto-tiers to local currency per user region.
 *
 * Pricing rationale (post competitive study, Apr 2026):
 *   - Annual at $69 (~$5.75/mo) hits the TTcare/DogMD $4.99-6/mo anchor
 *     after discount framing. Default plan → highest LTV conversion.
 *   - Monthly at $12.99 is the "casual try-it-out" rate — intentionally
 *     2.3× the annual effective rate so the annual looks like a steal.
 *   - Lifetime at $199 is the early-adopter hook; capped to first 1,000
 *     users to create honest scarcity without fake urgency.
 */
const DEV_PACKAGES: CatMdPackage[] = [
  {
    identifier: 'catmd_annual',
    product: {
      identifier: 'catmd.annual',
      priceString: '$69.00',
      title: 'Annual',
      description: '$5.75/month — save 56%',
    },
    period: 'ANNUAL',
  },
  {
    identifier: 'catmd_monthly',
    product: {
      identifier: 'catmd.monthly',
      priceString: '$12.99',
      title: 'Monthly',
      description: 'Cancel anytime',
    },
    period: 'MONTHLY',
  },
  {
    identifier: 'catmd_lifetime',
    product: {
      identifier: 'catmd.lifetime',
      priceString: '$199.00',
      title: 'Lifetime',
      description: 'Pay once, use forever — first 1,000 users only',
    },
    period: 'LIFETIME',
  },
];

let initialized = false;

/**
 * Lazy SDK loader. Dynamic-imports `react-native-purchases` so that:
 *   - Expo Go keeps booting (native module absent → import throws → we
 *     catch and return null → every entry point degrades gracefully).
 *   - EAS dev-client / production builds get the real SDK.
 *   - When ENABLE_PAYWALL=false the import never runs, costing nothing.
 *
 * Cached after first resolve so we don't re-import on every call.
 */
let sdkPromise: Promise<any | null> | null = null;
async function loadSdk(): Promise<any | null> {
  if (!ENABLED) return null;
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    try {
      const mod = await import('react-native-purchases');
      return (mod as any).default ?? mod;
    } catch (e) {
      console.warn('[CatMD] react-native-purchases not available:', e);
      return null;
    }
  })();
  return sdkPromise;
}

export async function initializePurchases(appUserId: string): Promise<void> {
  if (initialized || !ENABLED) return;
  const Purchases = await loadSdk();
  if (!Purchases) return;
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
  if (!key) {
    console.warn('[CatMD] No RevenueCat key for this platform; skipping init.');
    return;
  }
  await Purchases.configure({ apiKey: key, appUserID: appUserId });
  initialized = true;
}

/** Re-identify the RC user (e.g. after an anonymous-to-email upgrade). */
export async function identifyPurchasesUser(appUserId: string): Promise<void> {
  if (!ENABLED || !initialized) return;
  const Purchases = await loadSdk();
  if (!Purchases) return;
  await Purchases.logIn(appUserId);
}

export async function getEntitlement(): Promise<boolean> {
  if (!ENABLED) return !DEV_FORCE_FREE; // dev: unlocked unless forced-free
  const Purchases = await loadSdk();
  if (!Purchases) return !DEV_FORCE_FREE;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch (e) {
    console.warn('[CatMD] getEntitlement:', e);
    return false;
  }
}

export async function listOfferings(): Promise<CatMdPackage[]> {
  if (!ENABLED) return DEV_PACKAGES;
  const Purchases = await loadSdk();
  if (!Purchases) return DEV_PACKAGES;
  const offerings = await Purchases.getOfferings();
  const current = offerings?.current;
  if (!current) return DEV_PACKAGES;
  return (current.availablePackages ?? []).map((p: any) => ({
    identifier: p.identifier,
    product: {
      identifier: p.product.identifier,
      priceString: p.product.priceString,
      title: p.product.title,
      description: p.product.description,
    },
    period: p.packageType,
  }));
}

export async function purchasePackage(pkg: CatMdPackage): Promise<boolean> {
  if (!ENABLED) return true; // dev: pretend the buy succeeded
  const Purchases = await loadSdk();
  if (!Purchases) return true;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch (e: any) {
    if (e?.userCancelled) return false;
    console.warn('[CatMD] purchasePackage:', e);
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!ENABLED) return true;
  const Purchases = await loadSdk();
  if (!Purchases) return true;
  try {
    const info = await Purchases.restorePurchases();
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch (e) {
    console.warn('[CatMD] restorePurchases:', e);
    return false;
  }
}

/**
 * Free-tier monthly scan pool — unified across all scan content (cat
 * body + litter box + stool + urine). Default 3/month; overridable via
 * EXPO_PUBLIC_FREE_SCANS_PER_MONTH.
 */
export const FREE_SCANS_PER_MONTH = Math.max(
  0,
  parseInt(process.env.EXPO_PUBLIC_FREE_SCANS_PER_MONTH ?? '3', 10) || 0,
);

export const purchases = {
  ENABLED,
  DEV_FORCE_FREE,
  ENTITLEMENT_ID,
  FREE_SCANS_PER_MONTH,
  initializePurchases,
  identifyPurchasesUser,
  getEntitlement,
  listOfferings,
  purchasePackage,
  restorePurchases,
};
