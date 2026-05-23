/**
 * CatMD AI Proxy — Cloudflare Worker.
 *
 * Why: the app ships with EXPO_PUBLIC_AI_BASE_URL pointing at this
 * Worker. The worker holds the real OpenAI API key in a Cloudflare
 * secret. The app bundle contains no plaintext key, so decompiling the
 * APK yields nothing useful.
 *
 * Endpoints forwarded (OpenAI-compatible):
 *   POST /v1/chat/completions
 *   POST /v1/embeddings
 *
 * Protections:
 *   - Method gate (POST only)
 *   - Path allow-list
 *   - Optional shared-secret header (APP_SECRET). Not bulletproof —
 *     anyone who extracts the APK sees the secret — but raises the bar
 *     past casual scraping and enables rotation.
 *   - Cloudflare's automatic DDoS + rate-limiting rules (configure in
 *     the dashboard: Security → WAF → Rate limiting rules).
 *
 * Deploy: see ./README.md.
 */

import {
  renderDeleteAccount,
  renderDisclaimer,
  renderLegalIndex,
  renderPrivacy,
  renderReferralLanding,
  renderTerms,
} from './legal';
import { renderLandingPage } from './landing';
import {
  getArticleSlugs,
  renderArticleBySlug,
  renderLibraryIndex,
} from './library';
import {
  getBlogSlugs,
  renderBlogIndex,
  renderBlogPostBySlug,
} from './blog';
import { renderAudioTrendsJson, SEED_PAYLOAD } from './audioTrends';
import { readCurrentTrends, refreshAudioTrends } from './audioTrendsRefresh';
import { handleRcWebhook } from './rcWebhook';
import { renderSymptomChecker } from './symptomChecker';
import { renderPersonalityTest } from './personalityTest';

export interface Env {
  OPENAI_API_KEY: string;          // Cloudflare secret (required)
  APP_SECRET?: string;             // Cloudflare secret (optional)
  ALLOWED_ORIGINS?: string;        // CSV; optional, for web callers
  /**
   * PostHog project API key for server-side capture of `llm_usage`
   * events on image-generation calls. Optional — when unset the worker
   * skips tracking and the client-side fallback (in dev mode) still
   * works. Set via `wrangler secret put POSTHOG_PROJECT_KEY`.
   */
  POSTHOG_PROJECT_KEY?: string;
  /**
   * PostHog Capture API host. Defaults to https://us.i.posthog.com
   * (matches the client SDK's default).
   */
  POSTHOG_HOST?: string;
  /**
   * KV namespace for the cron-refreshed audio-trends list. Bound in
   * wrangler.toml under `[[kv_namespaces]]`. Optional at runtime: if
   * unbound (e.g. local dev without the binding configured), the
   * endpoint serves the bundled SEED list and the scheduled() handler
   * is a no-op.
   */
  AUDIO_TRENDS_KV?: KVNamespace;
  /**
   * RevenueCat webhook auth header (audit 2026-05-17). Configure the
   * same value in RevenueCat → Integrations → Webhooks → Authorization
   * header. Worker rejects POSTs to /api/rc-webhook that don't match.
   * Set via `wrangler secret put RC_WEBHOOK_SECRET`.
   */
  RC_WEBHOOK_SECRET?: string;
  /**
   * Supabase service role key — required to write to partner_redemptions
   * table from the webhook handler (bypasses RLS). Treat as highly
   * sensitive. Set via `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`.
   */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /**
   * Supabase project URL — public, but kept in env so worker can
   * construct API calls without hardcoding.
   * e.g. https://xxx.supabase.co
   * Set via `wrangler secret put SUPABASE_URL`.
   */
  SUPABASE_URL?: string;
}

/**
 * Image-gen pricing snapshot (USD per call) for estimating cost
 * server-side. Mirrors the client-side LLM_PRICE_TABLE in
 * src/services/analytics.ts but only for gpt-image-1 since that's the
 * only path the proxy tracks. Both sides should stay in sync.
 */
const IMAGE_PRICE_USD_PER_CALL: Record<string, number> = {
  'gpt-image-1:medium:1024x1536': 0.10,
  'gpt-image-1:medium:1024x1024': 0.07,
  'gpt-image-1:high:1024x1536':   0.17,
  'gpt-image-1:high:1024x1024':   0.13,
  'gpt-image-1:low:1024x1024':    0.04,
};

/**
 * Endpoints whose responses should be tracked in PostHog as `llm_usage`
 * events. Image gen only — chat / embed / whisper are tracked by the
 * client where the response usage object is easier to access. Keeping
 * server-side tracking narrow to image-gen avoids the duplicate-event
 * footgun.
 */
const TRACKED_PATHS = new Set<string>([
  '/v1/images/edits',
  '/v1/images/generations',
]);

const ALLOWED_PATHS = new Set<string>([
  '/v1/chat/completions',
  '/v1/embeddings',
  '/v1/audio/transcriptions',
  // Image generation — used by Posters (Cat Studio).
  // `/edits` is hit when the app passes a reference photo of the cat
  // (typical case — gallery photo conditions the poster). `/generations`
  // is the fallback when no reference photo exists yet.
  '/v1/images/edits',
  '/v1/images/generations',
]);

const OPENAI_BASE = 'https://api.openai.com';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ── Trailing-slash canonicalisation ────────────────────────────────────
    // Why: catmd.pet renders identical content for /foo and /foo/ which
    // triggers Google Search Console's "Alternate page with proper canonical
    // tag" warning and wastes crawl budget. A 301 to the no-slash form makes
    // the worker emit a single canonical URL per page.
    // The root path (/) is exempt — it's a directory, not a slug.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname.length > 1 &&
      url.pathname.endsWith('/')
    ) {
      url.pathname = url.pathname.replace(/\/+$/, '');
      return Response.redirect(url.toString(), 301);
    }

    // ── Legal landing pages (Play Store / App Store required URLs) ────────
    // Authored in ./legal.ts; kept in sync with docs/legal/*.md which are
    // the human-readable source of truth.
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/privacy' || url.pathname === '/privacy/')) {
      return htmlResponse(renderPrivacy());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/terms' || url.pathname === '/terms/')) {
      return htmlResponse(renderTerms());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/disclaimer' || url.pathname === '/disclaimer/')) {
      return htmlResponse(renderDisclaimer());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/delete-account' || url.pathname === '/delete-account/')) {
      return htmlResponse(renderDeleteAccount());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/legal' || url.pathname === '/legal/')) {
      return htmlResponse(renderLegalIndex());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/' || url.pathname === '')) {
      return htmlResponse(renderLandingPage());
    }

    // ── Library (SEO-facing long-form articles) ────────────────────────────
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/library' || url.pathname === '/library/')) {
      return htmlResponse(renderLibraryIndex());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/library/')) {
      const slug = url.pathname.slice('/library/'.length).replace(/\/+$/, '');
      if (slug) {
        const body = renderArticleBySlug(slug);
        if (body) return htmlResponse(body);
        // Unknown slug falls through to 404 below.
        return new Response('Not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }

    // ── SEO tool pages — interactive entry points ──────────────────────────
    // These pages target high-intent commercial queries where the SERP wants
    // a tool, not an article. Both ship full client-side interactivity.
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/cat-symptom-checker' || url.pathname === '/cat-symptom-checker/')) {
      return htmlResponse(renderSymptomChecker());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/cat-personality-test' || url.pathname === '/cat-personality-test/')) {
      return htmlResponse(renderPersonalityTest());
    }

    // ── Blog (engineering / founder long-form posts) ───────────────────────
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/blog' || url.pathname === '/blog/')) {
      return htmlResponse(renderBlogIndex());
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/blog/')) {
      const slug = url.pathname.slice('/blog/'.length).replace(/\/+$/, '');
      if (slug) {
        const body = renderBlogPostBySlug(slug);
        if (body) return htmlResponse(body);
        return new Response('Not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }

    // ── Audio trends — cron-refreshed JSON for the postcard share UI ─────
    // The app fetches this on the postcard share screen, caches 24h
    // locally, and falls back to its own bundled list if this fails.
    // KV write happens weekly via the scheduled() handler below.
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/audio-trends.json') {
      const payload = env.AUDIO_TRENDS_KV
        ? await readCurrentTrends({ kv: env.AUDIO_TRENDS_KV, fallback: SEED_PAYLOAD })
        : SEED_PAYLOAD;
      return renderAudioTrendsJson(payload);
    }

    // ── RevenueCat webhook (audit 2026-05-17, partner-code program) ────────
    // POST /api/rc-webhook — RC fires here on every subscription event.
    // Authenticated via Authorization header against RC_WEBHOOK_SECRET.
    // Writes partner_redemptions rows when a purchase carries a
    // partner_code_id subscriber attribute. See proxy/rcWebhook.ts.
    if (request.method === 'POST' && url.pathname === '/api/rc-webhook') {
      return handleRcWebhook(request, env);
    }

    // ── SEO plumbing: sitemap + robots ─────────────────────────────────────
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/sitemap.xml') {
      return new Response(buildSitemapXml(), {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    // ── IndexNow key verification (2026-05-21) ──
    // IndexNow is the indexing-protocol-of-choice for Bing, Yandex,
    // Naver, Seznam, and (since 2024) several smaller engines that
    // power AI search results. The protocol requires we host a key
    // file at /<key>.txt that returns the key as plain text — that
    // proves we control the domain. Submissions to api.indexnow.org
    // are then validated against this URL.
    //
    // Google does NOT use IndexNow — it still requires Search Console
    // submissions for fast re-crawl. Sitemap auto-discovery handles
    // the slower path for Google.
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/2a66e2b908bc8b2e947e000a2defc3a4.txt') {
      return new Response('2a66e2b908bc8b2e947e000a2defc3a4', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/robots.txt') {
      return new Response(buildRobotsTxt(), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
    // Referral landing: /refer/{code} — friend's branded install page.
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/refer/')) {
      const code = url.pathname.slice('/refer/'.length).split('/')[0] ?? '';
      return htmlResponse(renderReferralLanding(code.toUpperCase()));
    }

    // ── Supabase auth landing pages ────────────────────────────────────────
    // Supabase redirects the user here after they click a link in an auth
    // email (signup confirm, email change, magic link, password reset).
    // We render a branded HTML page that tells them the flow succeeded and
    // tries to deep-link back to the CatMD app, preserving the tokens in
    // the URL fragment so the app can complete the session handoff.
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/auth')) {
      return new Response(renderAuthLandingHtml(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }

    // Preflight — cheap CORS for any web-based caller (harmless for mobile).
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, corsHeaders(request, env));
    }

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return json({ error: 'endpoint_not_allowed', path: url.pathname }, 404, corsHeaders(request, env));
    }

    // Optional app-secret check — only enforced when APP_SECRET is set.
    if (env.APP_SECRET) {
      const provided = request.headers.get('x-catmd-app-secret');
      if (provided !== env.APP_SECRET) {
        return json({ error: 'unauthorized' }, 401, corsHeaders(request, env));
      }
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'proxy_misconfigured' }, 500, corsHeaders(request, env));
    }

    // Capture telemetry context BEFORE forwarding — the request body
    // gets consumed by the OpenAI fetch below so we can't read it
    // again, and these custom headers are consumed for tracking only.
    const trackingActivity = request.headers.get('x-catmd-activity');
    const trackingUserId = request.headers.get('x-catmd-user-id');
    const trackingStart = Date.now();

    // Forward to OpenAI. Body is streamed through unchanged so token
    // streaming (if the app ever uses it) works end-to-end.
    const upstream = await fetch(OPENAI_BASE + url.pathname + url.search, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') ?? 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        // Pass through optional OpenAI header used by the client if present.
        ...(request.headers.get('openai-organization')
          ? { 'OpenAI-Organization': request.headers.get('openai-organization')! }
          : {}),
      },
      body: request.body,
    });

    // ── Server-side llm_usage capture (image-gen only) ─────────────
    // Fire-and-forget via ctx.waitUntil so the user-facing response
    // isn't blocked on the PostHog round-trip. We only track:
    //   - Image generation paths (chat/embed/whisper are client-tracked)
    //   - Successful upstream responses (2xx)
    //   - When POSTHOG_PROJECT_KEY is set (skip silently otherwise)
    if (
      TRACKED_PATHS.has(url.pathname) &&
      upstream.ok &&
      env.POSTHOG_PROJECT_KEY &&
      trackingActivity
    ) {
      const latencyMs = Date.now() - trackingStart;
      const distinctId = trackingUserId && trackingUserId !== 'unknown'
        ? trackingUserId
        : 'anonymous-proxy';
      // Default to medium 1024x1536 (Cat Studio's default) for cost
      // estimation. Could be made precise by inspecting the request body
      // but that costs us streaming-pass-through; the medium-vertical
      // estimate is close to actual for the Posters use case.
      const costCents = (IMAGE_PRICE_USD_PER_CALL['gpt-image-1:medium:1024x1536'] ?? 0.10) * 100;
      const phHost = env.POSTHOG_HOST ?? 'https://us.i.posthog.com';
      const projectKey = env.POSTHOG_PROJECT_KEY;
      ctx.waitUntil(
        fetch(`${phHost}/capture/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: projectKey,
            event: 'llm_usage',
            distinct_id: distinctId,
            properties: {
              activity: trackingActivity,
              model: 'gpt-image-1',
              image_count: 1,
              cost_cents: Math.round(costCents * 10000) / 10000,
              latency_ms: latencyMs,
              source: 'proxy',
              endpoint: url.pathname,
            },
            timestamp: new Date().toISOString(),
          }),
        }).catch((e) => {
          // PostHog is best-effort — never fail the user's image-gen
          // because tracking failed. Log only.
          console.warn('[catmd] posthog capture failed:', e);
        }),
      );
    }

    // Pass the upstream response straight through.
    const respHeaders = new Headers();
    respHeaders.set(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    );
    const cache = upstream.headers.get('cache-control');
    if (cache) respHeaders.set('Cache-Control', cache);
    for (const [k, v] of Object.entries(corsHeaders(request, env))) {
      respHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  },

  /**
   * Scheduled handler — fired by the Cloudflare Cron Trigger configured
   * in wrangler.toml ([triggers] crons = ["0 16 * * 5"]).
   *
   * Friday 16:00 UTC = Friday morning US Pacific = ahead of weekend
   * cat-content posting peak. We refresh the trending-audio list and
   * write to the AUDIO_TRENDS_KV namespace.
   *
   * On any failure (AI call rate-limited, malformed response, KV write
   * error, etc.) we leave the existing KV value alone — the endpoint
   * keeps serving last-known-good. We never overwrite KV with garbage.
   *
   * `event.cron` is the cron expression that fired this; useful in logs
   * if we add multiple cron schedules later (e.g. an emergency manual
   * refresh path).
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (!env.AUDIO_TRENDS_KV) {
      console.warn('[catmd] scheduled: AUDIO_TRENDS_KV not bound; skipping refresh');
      return;
    }
    if (!env.OPENAI_API_KEY) {
      console.warn('[catmd] scheduled: OPENAI_API_KEY not set; skipping refresh');
      return;
    }
    // waitUntil ensures the worker doesn't get killed mid-fetch when
    // the scheduled() function returns; the AI call + KV write get to
    // finish.
    ctx.waitUntil(
      (async () => {
        const result = await refreshAudioTrends({
          openaiApiKey: env.OPENAI_API_KEY,
          kv: env.AUDIO_TRENDS_KV!,
        });
        if (result.ok) {
          console.log(
            `[catmd] audio-trends refresh ok (cron=${event.cron}, count=${result.trendCount})`,
          );
        } else {
          console.warn(
            `[catmd] audio-trends refresh FAILED (cron=${event.cron}, reason=${result.reason}). Keeping previous KV value.`,
          );
        }
      })(),
    );
  },
};

// ── helpers ────────────────────────────────────────────────────────────────

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Shared response builder for the legal + auth landing pages. */
function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/**
 * Self-contained branded landing page for Supabase email-auth redirects.
 * Reads the URL fragment (`#type=signup|recovery|email_change|magiclink`
 * + tokens) to show the right copy, then deep-links the user back into
 * the CatMD app with the same fragment so the mobile session handoff
 * completes client-side. No external CSS / JS fetches.
 */
function renderAuthLandingHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" />
<title>CatMD — email confirmation</title>
<style>
  :root {
    --cream:#FAF7F2; --sage:#3F6456; --dark-sage:#25403A;
    --ink:#1F2024; --muted:#7A7160; --err:#8B2F1F; --warn:#B07F28;
    --surface:#FFFFFF; --border:#E6E0D3;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; background:var(--cream); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    line-height:1.5; min-height:100vh; }
  .bg {
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:32px 20px;
    background: radial-gradient(circle at 50% 30%, #4d7465 0%, var(--dark-sage) 70%);
  }
  .card {
    background:var(--surface); border:1px solid var(--border); border-radius:16px;
    max-width:440px; width:100%; padding:40px 28px; text-align:center;
    box-shadow:0 10px 30px rgba(0,0,0,0.18);
  }
  .brand { font-size:12px; letter-spacing:2px; color:var(--muted);
    text-transform:uppercase; font-weight:600; }
  h1 { font-family:Georgia,'Times New Roman',serif; font-size:28px;
    margin:12px 0 8px; color:var(--ink); font-weight:500; }
  p { color:#3a3a3a; margin:0 0 16px; }
  .muted { color:var(--muted); font-size:14px; }
  .cta {
    display:inline-block; margin-top:20px; padding:14px 24px;
    background:var(--sage); color:var(--cream); text-decoration:none;
    border-radius:999px; font-weight:600; font-size:15px; border:0;
    cursor:pointer;
  }
  .cta:hover { background:var(--dark-sage); }
  .icon { width:56px; height:56px; margin:0 auto 8px; display:block; }
  .small { font-size:12px; color:var(--muted); margin-top:28px; line-height:1.6; }
  .error { color:var(--err); }
  .pill {
    display:inline-block; padding:4px 12px; border-radius:999px;
    background:var(--cream); border:1px solid var(--border);
    color:var(--muted); font-size:11px; letter-spacing:1px;
    text-transform:uppercase; font-weight:600;
  }
</style>
</head>
<body>
<div class="bg">
  <div class="card" id="card">
    <div class="brand">CatMD</div>
    <svg class="icon" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="30" r="18" fill="#3F6456"/>
      <path d="M14 18 L18 8 L22 20 Z" fill="#3F6456"/>
      <path d="M42 18 L38 8 L34 20 Z" fill="#3F6456"/>
      <circle cx="22" cy="28" r="2" fill="#FAF7F2"/>
      <circle cx="34" cy="28" r="2" fill="#FAF7F2"/>
    </svg>
    <h1 id="title">One moment…</h1>
    <p id="body" class="muted">Finalising your sign-in.</p>
    <a id="cta" class="cta" style="display:none;" href="#">Open CatMD</a>
    <div class="small">
      If nothing happens, open the CatMD app manually — your status is already updated on the server.
    </div>
  </div>
</div>
<script>
  (function () {
    // Supabase can put state in either the hash (#access_token=&type=...)
    // or the query string (?error=...&error_description=...).
    var hash = window.location.hash || '';
    var search = window.location.search || '';

    function param(src, key) {
      var s = src.replace(/^[#?]/, '');
      var pairs = s.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var kv = pairs[i].split('=');
        if (decodeURIComponent(kv[0]) === key) {
          return decodeURIComponent((kv[1] || '').replace(/\\+/g, ' '));
        }
      }
      return null;
    }

    var type = param(hash, 'type') || param(search, 'type') || '';
    var err = param(search, 'error') || param(hash, 'error');
    var errDesc = param(search, 'error_description') || param(hash, 'error_description');

    var title = document.getElementById('title');
    var body = document.getElementById('body');
    var cta = document.getElementById('cta');

    var copy = {
      signup:        ['Email confirmed',       'Your CatMD account is ready. Open the app to continue.'],
      email_change:  ['Email updated',         'Your new email is now linked to your CatMD account.'],
      magiclink:     ['Signed in',             'You can close this tab and return to CatMD.'],
      recovery:      ['Reset link verified',   'Open CatMD to set a new password.'],
      invite:        ['Invitation accepted',   'Open CatMD to finish setting up your account.']
    };

    if (err) {
      title.textContent = 'Something went wrong';
      title.className = 'error';
      body.textContent = (errDesc || err || 'The link may have expired. Try again from the app.');
      cta.textContent = 'Open CatMD';
    } else if (copy[type]) {
      title.textContent = copy[type][0];
      body.textContent = copy[type][1];
      cta.textContent = 'Open CatMD';
    } else {
      title.textContent = 'You\\u2019re all set';
      body.textContent = 'Open the CatMD app to continue.';
      cta.textContent = 'Open CatMD';
    }

    // Build the deep link, preserving the original fragment so the mobile
    // app can re-exchange tokens via supabase-js if needed.
    var deepLink = 'catmd://auth/callback' + (hash || '');
    cta.href = deepLink;
    cta.style.display = 'inline-block';

    // Attempt automatic deep-link hop. Browsers block this if the page
    // wasn't loaded from a user gesture, so the button above is the
    // primary path.
    if (!err) {
      setTimeout(function () {
        try { window.location.href = deepLink; } catch (e) { /* ignore */ }
      }, 800);
    }
  })();
</script>
</body>
</html>`;
}

/**
 * XML sitemap served at /sitemap.xml. Lists landing, library index, library
 * articles, and public legal pages. Submit this URL in Google Search Console.
 */
function buildSitemapXml(): string {
  const site = 'https://catmd.pet';
  const today = new Date().toISOString().slice(0, 10);
  const entries: { loc: string; lastmod: string; priority: string; changefreq: string }[] = [
    { loc: `${site}/`, lastmod: today, priority: '1.0', changefreq: 'weekly' },
    { loc: `${site}/library`, lastmod: today, priority: '0.9', changefreq: 'weekly' },
    { loc: `${site}/blog`, lastmod: today, priority: '0.9', changefreq: 'weekly' },
    { loc: `${site}/cat-symptom-checker`, lastmod: today, priority: '0.9', changefreq: 'monthly' },
    { loc: `${site}/cat-personality-test`, lastmod: today, priority: '0.9', changefreq: 'monthly' },
    { loc: `${site}/privacy`, lastmod: today, priority: '0.3', changefreq: 'yearly' },
    { loc: `${site}/terms`, lastmod: today, priority: '0.3', changefreq: 'yearly' },
    { loc: `${site}/disclaimer`, lastmod: today, priority: '0.3', changefreq: 'yearly' },
  ];
  for (const { slug, lastmod } of getArticleSlugs()) {
    entries.push({ loc: `${site}/library/${slug}`, lastmod, priority: '0.8', changefreq: 'monthly' });
  }
  for (const { slug, lastmod } of getBlogSlugs()) {
    entries.push({ loc: `${site}/blog/${slug}`, lastmod, priority: '0.8', changefreq: 'monthly' });
  }
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** robots.txt — allow all, point to sitemap. */
function buildRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: https://catmd.pet/sitemap.xml\n`;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  // Mobile apps don't enforce CORS, but a web dashboard or landing page
  // eventually might call this. Allow what's explicitly configured.
  const origin = request.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin =
    origin && allowed.length > 0 && allowed.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CatMD-App-Secret, OpenAI-Organization',
    'Access-Control-Max-Age': '86400',
  };
}
