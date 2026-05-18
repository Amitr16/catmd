/**
 * SEO + analytics helpers for catmd.pet — shared across landing,
 * library, blog, and legal renderers.
 *
 * Audit 2026-05-16. Four trackability levers in one place:
 *
 *   1. PostHog JS snippet — page views + scroll + button-click events
 *      from the marketing site flow into the same PostHog project as
 *      the mobile app. Lets you build cross-surface funnels:
 *        landing pageview → library pageview → Play Store outbound →
 *        install (Play Install Referrer) → core_feature_used.
 *
 *   2. Cloudflare Web Analytics beacon — second source of truth, free,
 *      privacy-first, can't be ad-blocked. Gives top URLs, Core Web
 *      Vitals, referrers.
 *
 *   3. Google Search Console verification meta — one-time site
 *      verification so GSC can attribute organic search traffic per
 *      URL. After verification, sitemap.xml gets indexed automatically.
 *
 *   4. Play Store CTA URL builder — appends utm_source / utm_medium /
 *      utm_content to every "Get on Google Play" link so the install
 *      referrer SDK (vc 95+) can attribute installs back to the
 *      article that drove the click. This is what closes the loop on
 *      marketing attribution.
 *
 * All three tokens (PostHog key, CF beacon token, GSC verification)
 * are PUBLIC by design — they ship to every visitor's browser. Safe
 * to commit. To activate any one, paste the token into the constant
 * below and redeploy.
 */

// ─────────────────────────────────────────────────────────────────────────
// Tokens — paste yours in. Empty string = that analytics layer is OFF.
// ─────────────────────────────────────────────────────────────────────────

/**
 * PostHog project API key (public, safe to commit — same key ships
 * in every CatMD APK via EXPO_PUBLIC_POSTHOG_API_KEY). Sourced from
 * the project .env. SAME project as the mobile app so funnels can
 * join across the marketing site and the app.
 */
const POSTHOG_API_KEY = 'phc_pE3PZxUYPL98qjcC86SNbqTGwrcZtpf3G3EwH77AHCaF';
const POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * Cloudflare Web Analytics token. Get yours at
 * https://dash.cloudflare.com → Web Analytics → Add a site →
 * "Manual install" tab → copy the token out of the beacon snippet.
 * Empty = no Cloudflare Web Analytics beacon. This is SEPARATE from
 * the wrangler auth token used for deploys; the Web Analytics
 * product has its own per-site beacon token.
 */
const CLOUDFLARE_ANALYTICS_TOKEN = '80983b92d7f349d293d0cc620dda67b2';

/**
 * Google Search Console site-verification token. Live as of
 * 2026-05-16. After this is deployed, head to
 * https://search.google.com/search-console → CatMD property →
 * "Verify" to complete the handshake, then submit
 * https://catmd.pet/sitemap.xml under Sitemaps.
 */
const GOOGLE_SITE_VERIFICATION = 'xNuRkLIYdaSQm2E1UWzNkgD31_NL2zPjSBDX21svEaE';

// ─────────────────────────────────────────────────────────────────────────
// Analytics script tags — splice into every page's <head>
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns the analytics script block to inject into <head>. Includes
 * the PostHog autocapture snippet + Cloudflare Web Analytics beacon
 * (each one only renders if its token is configured).
 *
 * Safe to call from every render — empty string when nothing is
 * configured, so no harm done before tokens are pasted.
 */
export function renderAnalyticsScripts(): string {
  const parts: string[] = [];

  // PostHog — standard snippet. Pre-render guarded by the key being
  // non-empty so empty deploys don't spam noscript errors in console.
  if (POSTHOG_API_KEY.length > 0) {
    parts.push(`
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('${POSTHOG_API_KEY}',{api_host:'${POSTHOG_HOST}',person_profiles:'identified_only',capture_pageview:true,capture_pageleave:true});
</script>`);
  }

  // Cloudflare Web Analytics — async beacon.
  if (CLOUDFLARE_ANALYTICS_TOKEN.length > 0) {
    parts.push(`
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CLOUDFLARE_ANALYTICS_TOKEN}"}'></script>`);
  }

  return parts.join('\n');
}

/**
 * Returns the Google Search Console verification meta tag if a
 * verification token is configured, otherwise empty.
 *
 * Place this in <head> alongside other meta tags. Google only checks
 * for it during the initial verification step; after that the property
 * stays verified even if the tag is removed — but it costs nothing to
 * keep, and saves you from re-verifying if the property is reset.
 */
export function renderSearchConsoleMeta(): string {
  if (GOOGLE_SITE_VERIFICATION.length === 0) return '';
  return `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}" />`;
}

// ─────────────────────────────────────────────────────────────────────────
// Play Store CTA URL builder — UTM-tagged for install attribution
// ─────────────────────────────────────────────────────────────────────────

const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details?id=com.catmd.app';

/** Where on the site this Play Store CTA lives. Used as `utm_medium`. */
export type PlayStoreCtaMedium =
  | 'landing'        // landing-page CTAs (hero / nav / final / footer)
  | 'library'        // app-cta at the bottom of a library article
  | 'library_body'   // inline link inside library article body text
  | 'blog'           // app-cta at the bottom of a blog post
  | 'blog_body'      // inline link inside blog post body text
  | 'legal'          // privacy / terms / disclaimer page CTAs
  | 'press_kit'      // press-kit downloads
  | 'directory'      // launch-day directory submissions (Product Hunt, BetaList)
  | 'social'         // X / Threads / Reddit / TikTok bio links
  | 'tool';          // interactive SEO tools (/cat-symptom-checker, /cat-personality-test)

/**
 * Build a UTM-tagged Play Store URL. The install referrer SDK in the
 * mobile app (vc 95+) captures these params on first launch and
 * registers them as PostHog super-properties — every analytics event
 * downstream inherits them.
 *
 *   utm_source = 'catmd_pet'   (always — the marketing site)
 *   utm_medium = surface name (landing / library / blog / etc.)
 *   utm_content = the specific page or slug — lets you slice by article
 *
 * Example:
 *   buildPlayStoreUrl('library', 'do-cats-hide-pain')
 *   → https://play.google.com/store/apps/details?id=com.catmd.app
 *     &utm_source=catmd_pet&utm_medium=library&utm_content=do-cats-hide-pain
 *
 * Pure function — no env, no I/O. Safe to call from every renderer.
 */
export function buildPlayStoreUrl(
  medium: PlayStoreCtaMedium,
  content?: string,
): string {
  const params: string[] = [
    'utm_source=catmd_pet',
    `utm_medium=${encodeURIComponent(medium)}`,
  ];
  if (content) {
    params.push(`utm_content=${encodeURIComponent(content)}`);
  }
  return `${PLAY_STORE_BASE}&${params.join('&')}`;
}

/**
 * Clean (UTM-free) Play Store URL — for places where UTMs are wrong:
 *   - schema.org JSON-LD (downloadUrl / installUrl / sameAs)
 *   - links in cat-voice prose where UTMs would look unprofessional
 *
 * Per Google's app indexing guidelines, the canonical install URL in
 * schema.org should be clean. Use this for those, `buildPlayStoreUrl`
 * everywhere else.
 */
export const PLAY_STORE_URL_CLEAN = PLAY_STORE_BASE;
