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
 * Pricing rationale (revised 2026-05-12, per docs/MONETIZATION-STRATEGY.md):
 *   - Annual at $39.99 (~$3.33/mo) — slightly above SoSA median ($34.80)
 *     to anchor as premium for the AI + pet category. SoSA: higher
 *     prices convert BETTER (8.9% vs 4.4% for low-priced apps).
 *   - Monthly at $5.99 — 1.8× the annual effective rate so the annual
 *     reads as the obvious value. Intentionally NOT 3× — keeps monthly
 *     a viable "try-before-committing-a-year" option.
 *   - NO LIFETIME TIER (decision 2026-05-05). Lifetime captures
 *     one-time revenue but kills the recurring engine + self-selects
 *     the wrong segment.
 */
const DEV_PACKAGES: CatMdPackage[] = [
  {
    identifier: 'catmd_annual',
    product: {
      identifier: 'catmd.annual',
      priceString: '$39.99',
      title: 'Annual',
      description: '$3.33/month — save 44%',
    },
    period: 'ANNUAL',
  },
  {
    identifier: 'catmd_monthly',
    product: {
      identifier: 'catmd.monthly',
      priceString: '$5.99',
      title: 'Monthly',
      description: 'Cancel anytime',
    },
    period: 'MONTHLY',
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
 * Tag the current RevenueCat user with a partner code id BEFORE the
 * purchase fires. The webhook handler on the Cloudflare Worker reads
 * this attribute off the INITIAL_PURCHASE event and links the
 * redemption to the right partner_codes row.
 *
 * Why this approach: it's the RevenueCat-native way to attach metadata
 * to a purchase without a custom server endpoint. Subscriber attributes
 * persist through renewals and refunds, so the partner stays attributed
 * across the full 12-month attribution window.
 *
 * Pass null to clear (e.g., if the user backs out before buying).
 *
 * Audit 2026-05-17 — partner-code program.
 */
export async function setPartnerCodeAttribute(
  codeId: string | null,
): Promise<void> {
  if (!ENABLED) return;
  const Purchases = await loadSdk();
  if (!Purchases) return;
  try {
    // `setAttributes` is the RC-native method for arbitrary subscriber
    // metadata. Webhook events include the full attribute bag.
    await Purchases.setAttributes({ partner_code_id: codeId });
  } catch (e) {
    // Non-fatal — purchase still works; we just lose attribution. We
    // explicitly log because un-attributed partner purchases are the
    // ONE case we want to detect and fix.
    console.warn('[CatMD] setPartnerCodeAttribute failed:', e);
  }
}

/**
 * Find the offering package matching a given product identifier. Used
 * by the paywall when a partner code is applied — we need to swap the
 * default annual package for the discounted `pro_annual_partner`
 * package before calling purchasePackage().
 *
 * Returns null if the product id isn't in the current offering — the
 * caller should fall back to the regular annual package (and surface
 * a friendly error: "this code can't be applied right now").
 */
export async function findPackageByProductId(
  productId: string,
): Promise<CatMdPackage | null> {
  if (!ENABLED) return null;
  const Purchases = await loadSdk();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const all = offerings?.all ?? {};
    // Search every offering (current + any extras) for a matching product
    for (const offeringKey of Object.keys(all)) {
      const off = all[offeringKey];
      const pkgs = off?.availablePackages ?? [];
      for (const p of pkgs) {
        if (p.product?.identifier === productId) {
          return {
            identifier: p.identifier,
            product: {
              identifier: p.product.identifier,
              priceString: p.product.priceString,
              title: p.product.title,
              description: p.product.description,
            },
            period: p.packageType,
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.warn('[CatMD] findPackageByProductId:', e);
    return null;
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

/**
 * Trial length in days. Driven by env so we can A/B-test 7d vs 14d vs
 * 21d later without redeploying. Default 14 — the SoSA-validated sweet
 * spot for cumulative-value subscription apps.
 *
 * The actual trial timer lives in Supabase (`user_trial_state` table)
 * and is enforced server-side by the `start_or_get_trial()` RPC. This
 * constant is for client-side day-remaining UI math.
 */
export const TRIAL_LENGTH_DAYS = Math.max(
  1,
  parseInt(process.env.EXPO_PUBLIC_TRIAL_LENGTH_DAYS ?? '14', 10) || 14,
);

/**
 * Trial state returned by the Supabase `start_or_get_trial()` RPC.
 * Idempotent — first call stamps `trial_started_at`, subsequent calls
 * return the existing row. Used by `useEntitlement` to compute
 * `hasProAccess` and the days-remaining label.
 */
export type TrialState = {
  trial_started_at: string;   // ISO timestamp
  trial_ends_at: string;      // ISO timestamp (started + length)
  in_trial: boolean;          // computed server-side via now() < trial_ends_at
  days_remaining: number;     // 0 when expired
};

/**
 * Start (or fetch) the calling user's trial. First call stamps the
 * server-side `trial_started_at` to now() and returns 14 days
 * remaining. Subsequent calls just return the existing state. The
 * client should call this once on app open (per session) and cache
 * the result for ~5 min.
 *
 * Returns null when the user isn't authed yet (anonymous-but-no-session
 * scenario), or when the RPC fails. Callers should treat null as
 * "trial state unknown" and fall back to is-Pro for gating.
 */
export async function startOrGetTrial(): Promise<TrialState | null> {
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.rpc('start_or_get_trial');
    if (error) {
      console.warn('[CatMD] start_or_get_trial:', error.message);
      return null;
    }
    // RPC returns a single-row table; supabase-js gives an array.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return row as TrialState;
  } catch (e) {
    console.warn('[CatMD] start_or_get_trial threw:', e);
    return null;
  }
}

/**
 * Module-level cache for the unified `hasProAccess` flag. Used by
 * silent background services (world extraction, subject detection,
 * scene captions) that run on every photo add — they shouldn't
 * spam three RPCs per call. The useEntitlement hook handles its own
 * caching on the React side; this is for non-React callers.
 *
 * 5-minute TTL — short enough that trial-day rollover (the time-
 * sensitive event) lands within ~5 min, long enough that bulk photo
 * imports don't generate one RPC per photo.
 */
type CachedProAccess = { value: boolean; cachedAt: number };
let proAccessCache: CachedProAccess | null = null;
const PRO_ACCESS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get the user's "has Pro access" state (paid / in-trial / whitelisted)
 * for use in NON-React contexts. Cached 5 min. Cheap to call from
 * background services on every photo / clip.
 *
 * Returns FALSE on any RPC failure — silent vision passes skipping is
 * the safe failure mode (avoid burning AI budget on an indeterminate
 * state).
 */
export async function getProAccessCached(): Promise<boolean> {
  const now = Date.now();
  if (proAccessCache && now - proAccessCache.cachedAt < PRO_ACCESS_CACHE_TTL_MS) {
    return proAccessCache.value;
  }
  try {
    const [pro, trial, whitelisted] = await Promise.all([
      getEntitlement(),
      startOrGetTrial(),
      isCurrentUserWhitelisted(),
    ]);
    const value = pro || (trial?.in_trial ?? false) || whitelisted;
    proAccessCache = { value, cachedAt: now };
    return value;
  } catch {
    // Fail closed — better to skip a silent vision call than burn
    // budget. The cache is also poisoned with `false` for the TTL
    // window so we don't retry on every photo add.
    proAccessCache = { value: false, cachedAt: now };
    return false;
  }
}

/** Invalidate the proAccessCache. Call after a successful purchase
 *  or restore so silent services re-check immediately. */
export function invalidateProAccessCache(): void {
  proAccessCache = null;
}

/**
 * Check whether the currently-authenticated user's email is on the
 * Pro whitelist (admin-controlled, see `pro_whitelist` table). Returns
 * false for anonymous users (no email). Cached at the hook level to
 * avoid hammering the RPC on every render.
 */
export async function isCurrentUserWhitelisted(): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.rpc('is_current_user_whitelisted');
    if (error) {
      console.warn('[CatMD] is_current_user_whitelisted:', error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn('[CatMD] is_current_user_whitelisted threw:', e);
    return false;
  }
}

export const purchases = {
  ENABLED,
  DEV_FORCE_FREE,
  ENTITLEMENT_ID,
  FREE_SCANS_PER_MONTH,
  TRIAL_LENGTH_DAYS,
  initializePurchases,
  identifyPurchasesUser,
  getEntitlement,
  listOfferings,
  purchasePackage,
  restorePurchases,
  startOrGetTrial,
  isCurrentUserWhitelisted,
};
