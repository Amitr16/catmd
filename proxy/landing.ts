/**
 * CatMD marketing landing page — served at catmd.pet/
 *
 * Design principles:
 *   - First impression for press, testers, influencers, and cold search
 *     traffic. Must convey "this was built by someone serious" in 3 sec.
 *   - Warm Clinical palette from design-system.md: cream / sage / terracotta.
 *   - Serif-for-heads (Fraunces) + clean UI sans (Inter). Both loaded
 *     from Google Fonts with font-display:swap so body renders immediately.
 *   - One clear value prop per section. Earn each scroll.
 *   - Animated score ring = the product's "magic moment" on the page.
 *   - Accessible: semantic headings, focus states, prefers-reduced-motion.
 *   - Self-contained: no external JS dependencies. Inline CSS + IntersectionObserver.
 *
 * Update together with:
 *   - docs/launch/landing-copy.md (source of truth for the body copy)
 *   - src/store-listing/* (keep positioning consistent with Play Store).
 */

const CONTACT_EMAIL = 'support@catmd.pet';
// Production Play Store listing — went live 2026-05-14 with v0.1.21 (vc 94).
// Pre-launch this was 'https://play.google.com/apps/testing/com.catmd.app'
// (the closed-beta opt-in link). Now public.
//
// All CTAs that take a user to the Play Store should use the UTM-tagged
// `buildPlayStoreUrl(...)` helper so the install referrer SDK can
// attribute installs to the source page. The bare constant below is
// kept ONLY for schema.org JSON-LD blocks (downloadUrl / installUrl /
// sameAs) where Google's app-indexing guidelines want a clean URL.
import {
  buildPlayStoreUrl,
  renderAnalyticsScripts,
  renderSearchConsoleMeta,
} from './seoAndAnalytics';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.catmd.app';
const WAITLIST_SUBJ = encodeURIComponent('CatMD waitlist');
const WAITLIST_BODY = encodeURIComponent(
  "Hi — add me to the CatMD waitlist.\n\nCat's name:\nPlatform (iOS / Android):\nHow you heard about CatMD:",
);

export function renderLandingPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#FAF7F2" />
<title>CatMD — Your cat, in their own voice. AI cat care app.</title>
<meta name="description" content="The more you use it, the more it becomes your cat. Diary, postcards, chat, and the new multimodal Meow Translator all in your cat's own voice — plus body-language reads and vet-grade triage when something feels off. Built for cats only. By cat people." />

<!-- Open Graph / Twitter card -->
<meta property="og:site_name" content="CatMD" />
<meta property="og:title" content="CatMD — Your cat, in their own voice." />
<meta property="og:description" content="The more you use it, the more it becomes your cat. Diary, postcards, chat, and the new multimodal Meow Translator all in their own voice. Plus body-language reads and vet-grade triage. Built for cats only." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://catmd.pet" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="CatMD — Built for cats. Trained on cats. By cat people." />
<meta name="twitter:description" content="Your cat replies in their own voice. Diary, postcards, body-language reads, vet-grade triage. Built for cats only." />

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='34' r='20' fill='%233F6456'/%3E%3Cpath d='M16 22 L20 10 L26 24 Z' fill='%233F6456'/%3E%3Cpath d='M48 22 L44 10 L38 24 Z' fill='%233F6456'/%3E%3Ccircle cx='26' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Ccircle cx='38' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Cpath d='M30 38 Q32 41 34 38' stroke='%23FAF7F2' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E" />

<link rel="canonical" href="https://catmd.pet/" />

${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}

<!-- Preconnect for fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" />

<!-- Structured data: Organization + WebSite + MobileApplication + FAQPage.
     Earns Knowledge-Panel eligibility, App rich-result eligibility, and
     FAQ rich-result eligibility in Google SERP. -->
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://catmd.pet/#org',
  'name': 'CatMD',
  'alternateName': 'CatMD — AI Vet Triage for Cats',
  'url': 'https://catmd.pet',
  'logo': {
    '@type': 'ImageObject',
    'url': 'https://catmd.pet/favicon.svg',
    'caption': 'CatMD logo',
  },
  'description': 'CatMD is an AI cat-care app where your cat becomes themselves as you use it. The more you log — check-ins, photos, named people, body-language reads — the more the diary, postcards, daily card and chat all sound like your real cat. Plus vet-grade triage when something feels off. Every condition, differential, and guideline is feline-specific.',
  'foundingDate': '2026',
  'knowsAbout': [
    'Feline veterinary medicine',
    'Cat health triage',
    'Cat symptom assessment',
    'Feline emergency identification',
  ],
  'sameAs': [
    'https://www.reddit.com/user/Euphoric_Actuary7995',
    'https://play.google.com/store/apps/details?id=com.catmd.app',
  ],
  'contactPoint': {
    '@type': 'ContactPoint',
    'email': 'hello@catmd.pet',
    'contactType': 'customer support',
    'availableLanguage': 'English',
  },
})}</script>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://catmd.pet/#site',
  'name': 'CatMD',
  'url': 'https://catmd.pet',
  'inLanguage': 'en',
  'publisher': { '@id': 'https://catmd.pet/#org' },
})}</script>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  '@id': 'https://catmd.pet/#app',
  'name': 'CatMD',
  'applicationCategory': 'HealthApplication',
  'applicationSubCategory': 'Veterinary triage',
  'operatingSystem': 'Android 8.0 or later',
  'url': 'https://catmd.pet',
  'downloadUrl': 'https://play.google.com/store/apps/details?id=com.catmd.app',
  'installUrl': 'https://play.google.com/store/apps/details?id=com.catmd.app',
  'softwareVersion': '0.1.21',
  'fileSize': '38MB',
  'inLanguage': 'en',
  'publisher': { '@id': 'https://catmd.pet/#org' },
  'featureList': [
    'Feline-specific AI triage',
    'Photo + symptom-text intake',
    '0–99 health score with urgency tier',
    'Differential diagnosis ranked by likelihood',
    'Vet-ready summary export',
    'Daily wellness check-ins with responsive scoring',
    'Multimodal Meow Translator (audio + body language + cat memory)',
    'Body-language video reader (6-second clip → labeled interpretation)',
    'Cat Diary written in your cat\'s own voice every evening',
    'Personality archetype mapping (Feline Five framework)',
    'Citation-backed advice from Merck Vet Manual, Cornell, AAFP, ISFM, ASPCA',
  ],
  'offers': [
    { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD', 'name': '14-day free trial — full Pro access' },
    { '@type': 'Offer', 'price': '79.99', 'priceCurrency': 'USD', 'name': 'Pro Annual' },
    { '@type': 'Offer', 'price': '9.99', 'priceCurrency': 'USD', 'name': 'Pro Monthly' },
  ],
})}</script>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': 'Is CatMD safe to rely on?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "CatMD is not a replacement for a veterinarian, and every scan result says so. It is designed as structured triage — helping you decide whether a symptom is worth a 2 a.m. ER trip, a booking within 24–48 hours, or watchful monitoring. If your cat is in obvious distress, call a vet, not an app.",
      },
    },
    {
      '@type': 'Question',
      'name': 'How is CatMD different from ChatGPT or Google?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "CatMD is species-locked to cats. Its knowledge base is curated from five peer-reviewed feline sources (Merck Veterinary Manual, AAFP, ISFM, Cornell Feline Health Center, ASPCA) and the prompts enforce FDA/VCPR-compliant language. It shows its sources. It has safety guardrails that override uncertain scores on emergency keywords. General-purpose chatbots have none of that.",
      },
    },
    {
      '@type': 'Question',
      'name': 'What does CatMD cost?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "14-day free trial with full Pro access — unlimited scans, every feature unlocked, no card on file. After trial: Pro Annual $79.99/year (about $6.67/month) or Pro Monthly $9.99/month. Cancel anytime.",
      },
    },
    {
      '@type': 'Question',
      'name': "What happens to my cat's data?",
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "You can use CatMD fully anonymously — no account required. Scan history lives on your device unless you opt in to cloud sync. Photos you scan are sent to our AI processing partner to produce the triage and are not retained on our servers after the scan. We don't sell your data. We don't train AI models on your cat. One tap in Settings deletes everything.",
      },
    },
    {
      '@type': 'Question',
      'name': 'When will CatMD be on iOS?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Android is live on Google Play now. iOS follows roughly 2 months after Android public launch, pending Apple review. Join the waitlist to be notified the day the iOS TestFlight opens.",
      },
    },
  ],
})}</script>

<style>
  /* ── design tokens ────────────────────────────────────────────── */
  :root {
    --cream: #FAF7F2;
    --cream-2: #F4EFE5;
    --sage: #3F6456;
    --sage-dark: #25403A;
    --sage-soft: #DCE6DE;
    --terracotta: #C97B63;
    --ink: #1F2024;
    --ink-2: #2E2D28;
    --muted: #7A7160;
    --border: #E6E0D3;
    --surface: #FFFFFF;
    --emergency: #B8392F;
    --emergency-bg: #FDECE8;
    --urgent: #C76E12;
    --urgent-bg: #FBF0DC;
    --monitor: #9B7E2B;
    --monitor-bg: #F9F3DC;
    --routine: #3F6456;
    --routine-bg: #E5EBE6;

    --radius-sm: 8px;
    --radius-md: 14px;
    --radius-lg: 22px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.03);
    --shadow-md: 0 4px 16px rgba(37,64,58,.08), 0 1px 3px rgba(0,0,0,.04);
    --shadow-lg: 0 24px 60px -20px rgba(37,64,58,.28), 0 8px 24px -12px rgba(37,64,58,.18);

    --ff-serif: 'Fraunces', 'Iowan Old Style', Georgia, serif;
    --ff-sans:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    --ff-mono:  'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  }

  /* ── reset + base ─────────────────────────────────────────────── */
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--cream);
    color: var(--ink);
    font-family: var(--ff-sans);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  img, svg { display: block; max-width: 100%; }
  a { color: var(--sage); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a:focus-visible {
    outline: 2px solid var(--sage);
    outline-offset: 3px;
    border-radius: 4px;
  }

  /* ── typography ───────────────────────────────────────────────── */
  h1, h2, h3, h4 {
    font-family: var(--ff-serif);
    font-weight: 500;
    letter-spacing: -0.015em;
    margin: 0;
    color: var(--ink);
    font-variation-settings: "opsz" 40;
  }
  .eyebrow {
    font-family: var(--ff-sans);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--muted);
  }

  /* ── layout primitives ────────────────────────────────────────── */
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  section { padding: 96px 0; position: relative; }
  section.tight { padding: 72px 0; }

  /* ── nav ──────────────────────────────────────────────────────── */
  nav.top {
    position: sticky; top: 0; z-index: 50;
    background: rgba(250,247,242,0.85);
    backdrop-filter: saturate(140%) blur(14px);
    -webkit-backdrop-filter: saturate(140%) blur(14px);
    border-bottom: 1px solid rgba(230,224,211,0.6);
  }
  nav.top .wrap {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 16px; padding-bottom: 16px;
  }
  nav.top .logo {
    display: flex; align-items: center; gap: 10px;
    font-family: var(--ff-serif); font-weight: 500; font-size: 20px;
    color: var(--ink);
  }
  nav.top .logo svg { width: 28px; height: 28px; }
  nav.top .links { display: flex; gap: 28px; align-items: center; }
  nav.top .links a {
    font-size: 14px; color: var(--ink-2); font-weight: 500;
  }
  nav.top .links a:hover { color: var(--sage); text-decoration: none; }
  nav.top .links .cta-mini {
    padding: 8px 16px; background: var(--sage); color: var(--cream);
    border-radius: 999px; font-weight: 600;
  }
  nav.top .links .cta-mini:hover { background: var(--sage-dark); color: var(--cream); }

  /* ── hero ─────────────────────────────────────────────────────── */
  .hero {
    padding: 80px 0 100px;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(63,100,86,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 100% 30%, rgba(201,123,99,0.06) 0%, transparent 45%),
      var(--cream);
  }
  .hero .wrap {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 72px;
    align-items: center;
  }
  .hero .tagline {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 6px 14px; border-radius: 999px;
    background: var(--sage-soft); color: var(--sage-dark);
    font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
    margin-bottom: 24px;
  }
  .hero .tagline::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: var(--sage); animation: pulse 2.2s ease-in-out infinite;
  }
  .hero h1 {
    font-size: clamp(40px, 5.4vw, 68px);
    line-height: 1.02;
    font-variation-settings: "opsz" 96, "wght" 500;
    margin-bottom: 24px;
  }
  .hero h1 em {
    font-style: italic;
    font-variation-settings: "opsz" 96, "wght" 400;
    color: var(--sage);
  }
  .hero .lede {
    font-size: 19px; color: var(--ink-2);
    margin: 0 0 36px; max-width: 540px; line-height: 1.5;
  }
  .cta-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 15px 26px; border-radius: 999px; border: 0;
    font-family: var(--ff-sans); font-weight: 600; font-size: 15px;
    cursor: pointer; transition: transform .1s ease, background .15s ease, box-shadow .15s ease;
    text-decoration: none;
  }
  .btn:hover { text-decoration: none; transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn-primary { background: var(--sage); color: var(--cream); box-shadow: var(--shadow-sm); }
  .btn-primary:hover { background: var(--sage-dark); box-shadow: var(--shadow-md); color: var(--cream); }
  .btn-ghost { background: transparent; color: var(--sage); border: 1.5px solid var(--sage); }
  .btn-ghost:hover { background: var(--sage); color: var(--cream); }
  .hero .meta {
    margin-top: 24px; color: var(--muted); font-size: 13px;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .hero .meta .dot { width: 3px; height: 3px; background: var(--muted); border-radius: 50%; display: inline-block; }

  /* ── phone mockup / score ring ─────────────────────────────── */
  .mockup {
    position: relative;
    justify-self: center;
    width: 100%;
    max-width: 380px;
  }
  .mockup-frame {
    position: relative;
    background: linear-gradient(180deg, #1a1d1c 0%, #25262a 100%);
    border-radius: 42px;
    padding: 14px;
    box-shadow: var(--shadow-lg),
                inset 0 0 0 2px rgba(255,255,255,0.04);
  }
  .mockup-screen {
    border-radius: 30px; overflow: hidden;
    background: var(--cream); aspect-ratio: 9 / 19.5;
    display: flex; flex-direction: column;
  }
  .mockup-header {
    padding: 22px 22px 14px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--border);
  }
  .mockup-header .bar { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: 0.05em; }
  .mockup-header .cat-name { font-family: var(--ff-serif); font-size: 15px; color: var(--ink); }
  /* mockup-body now a positioning context for the carousel screens.
     Padding moves onto each .carousel-screen so absolute children
     align cleanly with the same offsets the previous single-screen
     used. overflow:hidden keeps fading screens clipped to the phone
     frame and prevents any sub-pixel content from leaking outside the
     rounded mask. */
  .mockup-body {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  /* Carousel — 4 screens fading through the same phone frame. Each
     visible ~3.5s with 1s fades, 20s full cycle. Respects
     prefers-reduced-motion (just shows screen 1 statically). */
  .carousel-screen {
    position: absolute;
    inset: 0;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    opacity: 0;
    animation: carousel-fade 20s infinite;
  }
  .carousel-screen-1 { animation-delay: -1s; }
  .carousel-screen-2 { animation-delay: 4s; }
  .carousel-screen-3 { animation-delay: 9s; }
  .carousel-screen-4 { animation-delay: 14s; }
  @keyframes carousel-fade {
    0%   { opacity: 0; }
    5%   { opacity: 1; }
    20%  { opacity: 1; }
    25%  { opacity: 0; }
    100% { opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .carousel-screen { animation: none; opacity: 0; }
    .carousel-screen-1 { opacity: 1; }
  }

  .mockup-tier {
    display: inline-block; padding: 4px 12px; border-radius: 999px;
    background: var(--emergency-bg); color: var(--emergency);
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;
  }
  /* Sage variant for non-emergency tier pills (Today / Personality /
     Pain check) — keeps the body-language screen looking distinct
     while the others read as "calm informational" rather than "alert". */
  .mockup-tier-sage {
    background: var(--sage-soft); color: var(--sage-dark);
  }
  /* Carousel-specific elements — Feline Five bars, FGS action-unit
     rows, daily-check-in trio. Sized to fit the phone frame neatly
     alongside the existing ring/list/cta primitives. */
  .ff-bar-row {
    display: grid; grid-template-columns: 88px 1fr 28px;
    align-items: center; gap: 10px; margin-top: 8px;
    font-size: 11px; color: var(--ink-2);
  }
  .ff-bar-row:first-of-type { margin-top: 14px; }
  .ff-bar-track {
    height: 6px; border-radius: 999px; background: var(--border);
    overflow: hidden;
  }
  .ff-bar-fill {
    height: 100%; background: var(--sage); border-radius: 999px;
  }
  .ff-bar-num {
    text-align: right; font-family: var(--ff-mono); color: var(--muted);
    font-size: 11px;
  }
  .au-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 9px 0; border-bottom: 1px solid var(--border);
    font-size: 12.5px; color: var(--ink-2);
  }
  .au-row:last-of-type { border-bottom: none; }
  .au-score {
    font-family: var(--ff-mono); font-size: 11px;
    color: var(--sage-dark); background: var(--sage-soft);
    padding: 2px 8px; border-radius: 999px; font-weight: 700;
  }
  .checkin-trio {
    display: flex; justify-content: space-around; gap: 8px;
    margin: 16px 0 8px;
  }
  .checkin-pill {
    flex: 1; text-align: center; padding: 10px 6px;
    border: 1px solid var(--border); border-radius: 12px;
    background: var(--cream-2);
  }
  .checkin-pill .emoji { font-size: 22px; line-height: 1; }
  .checkin-pill .label {
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--muted); margin-top: 6px;
  }
  .checkin-pill .value {
    font-family: var(--ff-serif); font-size: 14px; color: var(--ink);
    margin-top: 2px;
  }
  .archetype-headline {
    font-family: var(--ff-serif); font-size: 30px; line-height: 1.1;
    text-align: center; color: var(--ink); margin: 18px 0 4px;
    letter-spacing: -0.01em;
  }
  .archetype-confidence {
    text-align: center; font-family: var(--ff-mono); font-size: 11px;
    color: var(--muted); letter-spacing: 0.05em; margin-bottom: 4px;
  }
  /* Score-ring sage variant — same geometry as ring-fg but uses sage
     instead of emergency. Keeps the fill animation but desaturates
     the visual so the Today screen reads as "healthy", not "alert". */
  .ring-fg-sage {
    fill: none; stroke: var(--sage); stroke-width: 10;
    stroke-linecap: round;
    stroke-dasharray: 502;
    stroke-dashoffset: 502;
    animation: ring-fill 2.2s cubic-bezier(.4,.2,.2,1) .4s forwards;
  }
  /* Smaller ring for the Pain check screen — 0-10 score doesn't
     need the same visual prominence as the 0-100 health score. */
  .ring-wrap-sm {
    position: relative; width: 130px; height: 130px;
    margin: 12px auto 6px;
  }
  .ring-wrap-sm svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring-wrap-sm .ring-num { font-size: 42px; }
  .ring-wrap-sm .ring-max { font-size: 11px; }
  /* Reduce visual hierarchy slightly inside carousel screens so multiple
     elements (header pill + ring + body) all fit cleanly. */
  .carousel-screen .mockup-list li { padding: 8px 0; font-size: 12px; }
  .carousel-screen .mockup-cta { margin-top: 10px; padding: 10px; font-size: 12px; }

  /* Body-language screen — paragraph + tag chips, mirroring the real
     app output (no confidence ring; the AI returns observation text
     + a small tag array). */
  .bl-observation {
    margin: 18px 0 14px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink-2);
    font-family: var(--ff-serif);
  }
  .bl-tags {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-bottom: 14px;
  }
  .bl-tag {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sage-soft);
    color: var(--sage-dark);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .bl-disclaimer {
    font-size: 10.5px; line-height: 1.45;
    color: var(--muted);
    border-top: 1px solid var(--border);
    padding-top: 10px;
    margin-top: auto;
  }
  .ring-wrap {
    position: relative; width: 180px; height: 180px;
    margin: 16px auto 8px;
  }
  .ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring-bg { fill: none; stroke: var(--border); stroke-width: 10; }
  .ring-fg {
    fill: none; stroke: var(--emergency); stroke-width: 10;
    stroke-linecap: round;
    stroke-dasharray: 502;
    stroke-dashoffset: 502;
    animation: ring-fill 2.2s cubic-bezier(.4,.2,.2,1) .4s forwards;
  }
  .ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .ring-num {
    font-family: var(--ff-serif); font-size: 60px; line-height: 1;
    font-variation-settings: "opsz" 144, "wght" 400;
    color: var(--ink); letter-spacing: -0.03em;
  }
  .ring-max {
    font-family: var(--ff-mono); font-size: 13px; color: var(--muted);
    margin-top: 4px;
  }
  .mockup-subtitle {
    text-align: center; color: var(--muted); font-size: 12px;
    margin: 4px 0 18px;
  }
  .mockup-list { border-top: 1px solid var(--border); }
  .mockup-list li {
    list-style: none; padding: 10px 0;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: var(--ink-2);
  }
  .mockup-list ul { margin: 0; padding: 0; }
  .mockup-list .bullet {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--emergency); flex-shrink: 0;
  }
  .mockup-cta {
    margin-top: 14px; padding: 12px; background: var(--emergency);
    color: #fff; text-align: center; border-radius: 10px;
    font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
  }
  .mockup-float {
    position: absolute; background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: var(--shadow-md);
    font-size: 13px; line-height: 1.35;
    /* CSS grid + identical grid-area on every child = 4 callout
       variants stack on top of each other. The parent sizes to the
       LARGEST child; we set min-height too to keep visual mass even
       on shorter variants. */
    display: grid;
    min-height: 132px;
    overflow: hidden;
  }
  .mockup-float-a {
    top: 6%; left: -24px;
    max-width: 200px;
    animation: float-a 4s ease-in-out infinite;
  }
  .mockup-float-b {
    bottom: 18%; right: -28px;
    max-width: 210px;
    animation: float-b 4.6s ease-in-out infinite;
  }
  /* Rotating content inside each callout — same 20s carousel cycle
     as the phone screens, same fade-in/fade-out keyframes, same
     stagger delays. So when the phone shows Today, the floating
     callouts also describe Today; when the phone rotates to Body
     Language, the callouts swap to body-language framing. The
     earlier static callouts (always Triage + Chat) made "vet-grade
     triage" dominate the hero regardless of what the phone showed. */
  .float-content {
    grid-area: 1 / 1;
    padding: 12px 16px;
    opacity: 0;
    animation: carousel-fade 20s infinite;
  }
  .float-content-1 { animation-delay: -1s; }
  .float-content-2 { animation-delay: 4s; }
  .float-content-3 { animation-delay: 9s; }
  .float-content-4 { animation-delay: 14s; }
  .mockup-float .eyebrow { font-size: 10px; margin-bottom: 2px; }
  .mockup-float strong { color: var(--sage-dark); font-family: var(--ff-serif); font-size: 14px; display: block; }
  .mockup-float .float-body { font-size: 12px; color: var(--muted); margin-top: 2px; }

  /* ── logos / credibility strip ──────────────────────────────── */
  .trust-strip {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--cream-2);
    padding: 28px 0;
  }
  .trust-strip .wrap {
    display: flex; flex-wrap: wrap; align-items: center; gap: 28px 48px;
    justify-content: center;
  }
  .trust-label { color: var(--muted); font-size: 13px; font-weight: 500; }
  .trust-source {
    font-family: var(--ff-serif);
    font-size: 17px;
    color: var(--ink-2);
    font-weight: 500;
    font-style: italic;
    opacity: 0.75;
  }

  /* ── section heads ───────────────────────────────────────────── */
  .section-head { max-width: 720px; margin: 0 0 56px; }
  .section-head h2 {
    font-size: clamp(32px, 3.4vw, 44px);
    line-height: 1.08;
    margin: 12px 0 18px;
    font-variation-settings: "opsz" 96, "wght" 500;
  }
  .section-head h2 em { font-style: italic; color: var(--sage); font-variation-settings: "opsz" 96, "wght" 400; }
  .section-head p { font-size: 18px; color: var(--ink-2); margin: 0; }

  /* ── problem section ─────────────────────────────────────────── */
  .problem { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .problem-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; }
  .problem-card {
    padding: 28px 28px 24px; background: var(--cream);
    border: 1px solid var(--border); border-radius: var(--radius-md);
    border-left: 4px solid var(--terracotta);
  }
  .problem-card h3 {
    font-family: var(--ff-sans); font-size: 15px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--terracotta); margin: 0 0 10px;
  }
  .problem-card p { margin: 0; color: var(--ink-2); font-size: 15.5px; line-height: 1.55; }
  .problem-card .cite {
    display: block; color: var(--muted); font-size: 12px; margin-top: 12px;
    font-style: italic;
  }

  /* ── flow section (how it works) ─────────────────────────────── */
  .flow {
    background: linear-gradient(180deg, var(--cream) 0%, var(--cream-2) 100%);
  }
  .flow-steps {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px;
    counter-reset: step;
    margin-top: 40px;
  }
  .flow-step {
    padding: 28px 24px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-md);
    position: relative;
  }
  .flow-step::before {
    counter-increment: step;
    content: counter(step, decimal-leading-zero);
    font-family: var(--ff-mono); font-size: 12px; font-weight: 700;
    color: var(--sage); letter-spacing: 0.08em;
    position: absolute; top: 16px; right: 20px;
  }
  .flow-step h3 {
    font-family: var(--ff-serif); font-size: 22px;
    margin: 8px 0 10px;
    font-variation-settings: "opsz" 40, "wght" 500;
  }
  .flow-step p { margin: 0; color: var(--ink-2); font-size: 14.5px; line-height: 1.5; }
  .flow-icon {
    width: 44px; height: 44px; border-radius: 12px; background: var(--sage-soft);
    color: var(--sage-dark); display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
  /* The "becomes themselves" section has 3 steps, not 4 — override
     to a 3-column grid so the last slot doesn't sit empty. */
  #becomes .flow-steps { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 980px) {
    #becomes .flow-steps { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 720px) {
    #becomes .flow-steps { grid-template-columns: 1fr; }
  }

  /* ── features grid ───────────────────────────────────────────── */
  .features {
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  /* ── four-pillar band ─────────────────────────────────────────
     Lives in its own .pillars section right under the trust strip.
     Today / Triage / Bond / Chat — the four surfaces the app organizes
     around. Each pillar name in terracotta serif, against a soft warm
     terracotta-tinted card background, so visitors see both brand
     anchor colors (sage on rest of page, terracotta here) within the
     first viewport. */
  .pillars {
    background: linear-gradient(180deg, var(--cream) 0%, #FBEEE9 100%);
    padding: 64px 0;
  }
  .pillar-band {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 32px 8px;
    box-shadow: var(--shadow-sm);
  }
  .pillar {
    padding: 0 24px;
    border-right: 1px solid var(--border);
    text-align: center;
  }
  .pillar:last-child { border-right: 0; }
  .pillar .pillar-name {
    font-family: var(--ff-serif);
    font-size: 28px;
    font-variation-settings: "opsz" 60, "wght" 500;
    color: var(--terracotta);
    letter-spacing: -0.012em;
    display: block;
    margin-bottom: 10px;
  }
  .pillar p {
    margin: 0;
    color: var(--ink-2);
    font-size: 14.5px;
    line-height: 1.55;
  }

  .features-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
    margin-top: 40px;
  }
  .feature {
    padding: 32px 28px;
    background: var(--cream);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .feature:hover { transform: translateY(-3px); border-color: var(--sage-soft); box-shadow: var(--shadow-md); }
  .feature h3 {
    font-size: 20px; margin: 16px 0 8px;
    font-variation-settings: "opsz" 40, "wght" 500;
  }
  /* When the pillar tag sits between icon-box and h3, tighten h3 top margin
     so the pillar label visually pairs with the heading instead of floating. */
  .feature-pillar + h3 { margin-top: 4px; }
  .feature p { margin: 0; color: var(--ink-2); font-size: 14.5px; line-height: 1.55; }
  .feature .icon-box {
    width: 44px; height: 44px; border-radius: 10px;
    background: var(--sage-soft); color: var(--sage-dark);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
  /* Bond + Chat tiles get the terracotta accent — relationship pillars */
  .feature[data-pillar="bond"] .icon-box,
  .feature[data-pillar="chat"] .icon-box {
    background: rgba(201, 123, 99, 0.13);
    color: var(--terracotta);
  }
  .feature[data-pillar="bond"]:hover,
  .feature[data-pillar="chat"]:hover {
    border-color: rgba(201, 123, 99, 0.4);
  }
  /* Per-pillar small label above each feature h3 — visual signal of which
     pillar the feature belongs to. Sage for Today/Triage (medical anchor),
     terracotta for Bond/Chat (relational anchor). */
  .feature-pillar {
    display: block;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    margin-top: 14px; margin-bottom: 2px;
  }
  .feature-pillar-today,
  .feature-pillar-triage { color: var(--sage-dark); }
  .feature-pillar-bond,
  .feature-pillar-chat   { color: var(--terracotta); }

  .feature .tag {
    display: inline-block; padding: 3px 10px; background: var(--sage-soft);
    color: var(--sage-dark); border-radius: 999px; font-size: 11px;
    font-weight: 600; letter-spacing: 0.03em; margin-left: 8px;
    vertical-align: middle;
  }
  .feature[data-pillar="bond"] .tag,
  .feature[data-pillar="chat"] .tag {
    background: rgba(201, 123, 99, 0.13);
    color: var(--terracotta);
  }

  /* ── tiers visualization ─────────────────────────────────────── */
  .tiers { background: var(--cream); }
  .tier-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 40px;
  }
  .tier-box {
    padding: 28px 22px; border-radius: var(--radius-md);
    border: 1.5px solid transparent;
    position: relative;
  }
  .tier-emergency { background: var(--emergency-bg); border-color: rgba(184,57,47,0.2); color: var(--emergency); }
  .tier-urgent    { background: var(--urgent-bg);    border-color: rgba(199,110,18,0.2); color: var(--urgent); }
  .tier-monitor   { background: var(--monitor-bg);   border-color: rgba(155,126,43,0.25); color: var(--monitor); }
  .tier-routine   { background: var(--routine-bg);   border-color: rgba(63,100,86,0.2);  color: var(--routine); }
  .tier-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }
  .tier-range {
    font-family: var(--ff-serif);
    font-size: 34px; margin: 10px 0 6px;
    color: var(--ink);
    font-variation-settings: "opsz" 96, "wght" 500;
  }
  .tier-desc { color: var(--ink-2); font-size: 13.5px; line-height: 1.45; }

  /* ── research sources ───────────────────────────────────────── */
  .research {
    background: var(--sage-dark);
    color: var(--cream);
    position: relative;
    overflow: hidden;
  }
  .research::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse at 80% 20%, rgba(201,123,99,0.18) 0%, transparent 50%);
    pointer-events: none;
  }
  .research .section-head h2 { color: var(--cream); }
  .research .section-head h2 em { color: #D3E4D6; }
  .research .section-head p { color: rgba(250,247,242,0.82); }
  .research .eyebrow { color: rgba(250,247,242,0.72); }
  .research .wrap { position: relative; z-index: 1; }
  .sources-grid {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;
  }
  .source {
    padding: 22px 18px;
    background: rgba(250,247,242,0.06);
    border: 1px solid rgba(250,247,242,0.15);
    border-radius: var(--radius-md);
    backdrop-filter: blur(10px);
  }
  .source .name {
    font-family: var(--ff-serif); font-size: 16px; color: var(--cream);
    font-variation-settings: "opsz" 40, "wght" 500;
    margin-bottom: 6px;
  }
  .source .desc {
    font-size: 12.5px; color: rgba(250,247,242,0.65); line-height: 1.4;
  }
  .research-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
    margin-top: 56px; border-top: 1px solid rgba(250,247,242,0.15);
    padding-top: 40px;
  }
  .stat { text-align: center; padding: 0 16px; border-right: 1px solid rgba(250,247,242,0.12); }
  .stat:last-child { border-right: 0; }
  .stat-num {
    font-family: var(--ff-serif); font-size: 42px;
    color: var(--cream);
    font-variation-settings: "opsz" 96, "wght" 500;
    letter-spacing: -0.02em;
  }
  .stat-label {
    color: rgba(250,247,242,0.7); font-size: 13px;
    margin-top: 4px; letter-spacing: 0.01em;
  }

  /* ── honest AI ──────────────────────────────────────────────── */
  .honest { background: var(--cream-2); }
  .honest-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px;
    margin-top: 40px;
  }
  .honest-item {
    display: flex; gap: 14px; padding: 22px 24px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .honest-item .check {
    width: 24px; height: 24px; border-radius: 50%; background: var(--sage);
    color: var(--cream); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700;
  }
  .honest-item strong { display: block; margin-bottom: 4px; font-size: 15.5px; }
  .honest-item span { color: var(--ink-2); font-size: 14px; }

  /* ── founder note ───────────────────────────────────────────── */
  .founder {
    background: var(--cream);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .founder-inner {
    max-width: 780px; margin: 0 auto;
  }
  .founder blockquote {
    font-family: var(--ff-serif);
    font-size: clamp(22px, 2.2vw, 28px);
    line-height: 1.4;
    color: var(--ink);
    margin: 0 0 28px;
    font-variation-settings: "opsz" 96, "wght" 400;
    font-style: italic;
  }
  .founder-sig {
    display: flex; align-items: center; gap: 14px;
    color: var(--muted); font-size: 14px;
  }
  .founder-sig::before {
    content: ''; width: 36px; height: 1px; background: var(--muted);
    display: inline-block;
  }

  /* ── pricing ────────────────────────────────────────────────── */
  .pricing {
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .pricing-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
    margin-top: 40px;
  }
  .price-card {
    padding: 32px 28px 28px;
    background: var(--cream);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    position: relative;
  }
  .price-card-feature {
    background: var(--surface);
    border-color: var(--terracotta);
    border-width: 2px;
    box-shadow: 0 8px 24px rgba(201,123,99,0.12);
  }
  .price-tag {
    position: absolute; top: -10px; left: 20px;
    background: var(--terracotta); color: var(--surface);
    font-family: var(--ff-mono); font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px;
  }
  .price-eyebrow {
    font-family: var(--ff-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--terracotta);
  }
  .price-amount {
    font-family: var(--ff-serif); font-size: 38px;
    color: var(--ink); margin-top: 10px;
    font-variation-settings: "opsz" 96, "wght" 500;
  }
  .price-per {
    font-family: var(--ff-sans); font-size: 14px; font-weight: 500;
    color: var(--muted); margin-left: 4px;
  }
  .price-cadence {
    color: var(--muted); font-size: 12.5px;
    font-family: var(--ff-mono); margin-top: 6px;
    letter-spacing: 0.04em;
  }
  .price-list {
    margin: 22px 0 0; padding: 0; list-style: none;
    color: var(--ink-2); font-size: 14px; line-height: 1.65;
  }
  .price-list li { margin-bottom: 8px; padding-left: 18px; position: relative; }
  .price-list li::before {
    content: '✓'; position: absolute; left: 0; top: 0;
    color: var(--sage); font-weight: 700;
  }
  .pricing-footnote {
    margin-top: 36px; text-align: center;
    color: var(--muted); font-size: 13px; font-style: italic;
  }
  @media (max-width: 1000px) {
    .pricing-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .pricing-grid { grid-template-columns: 1fr; }
  }

  /* ── faq ────────────────────────────────────────────────────── */
  .faq { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .faq-list { margin-top: 40px; }
  details.faq-item {
    border-bottom: 1px solid var(--border);
    padding: 20px 0;
  }
  details.faq-item summary {
    font-family: var(--ff-serif); font-size: 19px;
    cursor: pointer; list-style: none; color: var(--ink);
    display: flex; justify-content: space-between; align-items: center;
    font-variation-settings: "opsz" 40, "wght" 500;
  }
  details.faq-item summary::-webkit-details-marker { display: none; }
  details.faq-item summary::after {
    content: '+'; font-family: var(--ff-sans); font-size: 24px;
    font-weight: 400; color: var(--sage); transition: transform .2s ease;
    flex-shrink: 0; margin-left: 20px;
  }
  details.faq-item[open] summary::after { transform: rotate(45deg); }
  details.faq-item p {
    margin: 12px 0 0; color: var(--ink-2); font-size: 15.5px;
    line-height: 1.6; max-width: 760px;
  }

  /* ── final CTA ───────────────────────────────────────────────── */
  .final-cta {
    background: var(--cream-2);
  }
  .final-cta .wrap { max-width: 860px; text-align: center; }
  .final-cta h2 {
    font-size: clamp(36px, 4vw, 52px);
    margin: 0 0 20px;
    font-variation-settings: "opsz" 96, "wght" 500;
  }
  .final-cta h2 em { font-style: italic; color: var(--sage); }
  .final-cta p {
    font-size: 18px; color: var(--ink-2); max-width: 640px;
    margin: 0 auto 40px;
  }
  .platform-row {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 16px; margin-bottom: 28px;
  }
  .platform {
    padding: 28px 24px; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius-md);
    text-align: left;
  }
  .platform .p-status {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 999px;
    background: var(--sage-soft); color: var(--sage-dark);
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  }
  .platform.coming .p-status { background: var(--cream-2); color: var(--muted); }
  .platform h3 {
    font-family: var(--ff-serif); font-size: 22px;
    margin: 12px 0 6px;
    font-variation-settings: "opsz" 40, "wght" 500;
  }
  .platform p { margin: 0 0 18px; color: var(--ink-2); font-size: 14px; }

  /* ── footer ─────────────────────────────────────────────────── */
  footer {
    background: var(--cream);
    border-top: 1px solid var(--border);
    padding: 48px 0 32px;
  }
  footer .wrap {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: 48px;
  }
  footer .fcol h4 {
    font-family: var(--ff-sans); font-weight: 700;
    font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); margin: 0 0 14px;
  }
  footer .fcol a {
    display: block; color: var(--ink-2); font-size: 14px;
    padding: 5px 0; text-decoration: none;
  }
  footer .fcol a:hover { color: var(--sage); }
  footer .brand-col .logo {
    font-family: var(--ff-serif); font-size: 20px; font-weight: 500;
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  footer .brand-col .logo svg { width: 28px; height: 28px; }
  footer .brand-col p { font-size: 13px; color: var(--muted); margin: 0; max-width: 280px; line-height: 1.55; }
  footer .footer-base {
    max-width: 1180px; margin: 40px auto 0; padding: 24px 24px 0;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;
    font-size: 12px; color: var(--muted);
  }

  /* ── reveal animation ───────────────────────────────────────── */
  .reveal {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity .7s cubic-bezier(.2,.8,.2,1), transform .7s cubic-bezier(.2,.8,.2,1);
  }
  .reveal.visible { opacity: 1; transform: translateY(0); }

  /* ── keyframes ──────────────────────────────────────────────── */
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.4); }
  }
  @keyframes ring-fill {
    /* 502 circumference total, 15/99 = 15.15% visible, so offset = 502 * (1 - 0.1515) = 426 */
    to { stroke-dashoffset: 426; }
  }
  @keyframes float-a {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes float-b {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  /* ── responsive ─────────────────────────────────────────────── */
  @media (max-width: 960px) {
    .hero .wrap { grid-template-columns: 1fr; gap: 48px; padding-top: 0; }
    .hero { padding: 56px 0 72px; }
    .mockup { max-width: 320px; }
    .flow-steps { grid-template-columns: repeat(2, 1fr); }
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .pillar-band { grid-template-columns: repeat(2, 1fr); gap: 24px 0; }
    .pillar:nth-child(2) { border-right: 0; }
    .pillar { padding: 12px 16px; }
    .tier-bar { grid-template-columns: repeat(2, 1fr); }
    .sources-grid { grid-template-columns: repeat(3, 1fr); }
    .research-stats { grid-template-columns: repeat(2, 1fr); gap: 28px 0; }
    .research-stats .stat:nth-child(2) { border-right: 0; }
    .research-stats .stat { padding: 12px 16px; }
    .problem-grid { grid-template-columns: 1fr; }
    .honest-grid { grid-template-columns: 1fr; }
    .platform-row { grid-template-columns: 1fr; }
    footer .wrap { grid-template-columns: 1fr 1fr; }
    section { padding: 72px 0; }
    nav.top .links a:not(.cta-mini) { display: none; }
  }
  @media (max-width: 540px) {
    .features-grid, .flow-steps, .sources-grid { grid-template-columns: 1fr; }
    .pillar-band { grid-template-columns: 1fr; gap: 16px 0; }
    .pillar { border-right: 0; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    .pillar:last-child { border-bottom: 0; }
    .tier-bar { grid-template-columns: 1fr; }
    footer .wrap { grid-template-columns: 1fr; gap: 32px; }
    .mockup-float-a, .mockup-float-b { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
    .reveal { opacity: 1; transform: none; }
    .ring-fg { stroke-dashoffset: 426; }
  }
</style>

</head>
<body>

<!-- ── top nav ─────────────────────────────────────────────────── -->
<nav class="top">
  <div class="wrap">
    <a class="logo" href="/" aria-label="CatMD home">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="34" r="20" fill="#3F6456"/>
        <path d="M16 22 L20 10 L26 24 Z" fill="#3F6456"/>
        <path d="M48 22 L44 10 L38 24 Z" fill="#3F6456"/>
        <circle cx="26" cy="32" r="2.4" fill="#FAF7F2"/>
        <circle cx="38" cy="32" r="2.4" fill="#FAF7F2"/>
        <path d="M30 38 Q32 41 34 38" stroke="#FAF7F2" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </svg>
      CatMD
    </a>
    <div class="links">
      <a href="#how">How it works</a>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="/blog">Blog</a>
      <a href="#faq">FAQ</a>
      <a class="cta-mini" href="${buildPlayStoreUrl('landing', 'nav')}">Get on Google Play</a>
    </div>
  </div>
</nav>

<!-- ── hero ────────────────────────────────────────────────────── -->
<section class="hero">
  <div class="wrap">
    <div class="hero-copy">
      <span class="tagline">Live on Google Play · Android first</span>
      <h1>Your cat,<br/><em>in their own voice.</em></h1>
      <p class="lede">
        The more you use CatMD, the more it becomes <em>your</em> cat.
        Every check-in, photo, named person and body-language read
        sharpens the cat that lives in here — the one who writes a
        diary every night, sends postcards in their own voice, and
        replies when you chat. Plus vet-grade triage when something
        feels off. Built for cats only. By cat people.
      </p>
      <div class="cta-row">
        <a class="btn btn-primary" href="${buildPlayStoreUrl('landing', 'hero')}">Get on Google Play</a>
        <a class="btn btn-ghost" href="mailto:${CONTACT_EMAIL}?subject=${WAITLIST_SUBJ}&amp;body=${WAITLIST_BODY}">iOS waitlist &rarr;</a>
      </div>
      <div class="meta">
        <span>Cat-only by design.</span>
        <span class="dot"></span>
        <span>Four pillars, one app.</span>
        <span class="dot"></span>
        <span>Private by default.</span>
      </div>
    </div>

    <!-- Phone mockup — 4-screen rotating carousel cycling through the
         flagship features so visitors immediately see the breadth of
         the app, not a single tile. Cycle:
            (1) Today / daily check-in
            (2) Body Language read
            (3) Personality archetype
            (4) Pain check (Feline Grimace Scale)
         Floating callouts shrunk to two pillar reminders (Triage and
         Chat — the two pillars NOT in the carousel) so the hero still
         carries all four pillars. -->
    <div class="mockup" aria-label="Rotating preview of CatMD's daily check-in, body-language reader, personality reveal, and Feline Grimace Scale pain check">
      <div class="mockup-frame">
        <div class="mockup-screen">
          <div class="mockup-header">
            <span class="bar">09:42</span>
            <span class="cat-name">Miso · 6 y · DSH</span>
            <span class="bar">● ●</span>
          </div>
          <div class="mockup-body">

            <!-- ── Screen 1: TODAY · daily check-in ───────────────── -->
            <div class="carousel-screen carousel-screen-1">
              <div style="text-align:center;">
                <span class="mockup-tier mockup-tier-sage">Today · daily heartbeat</span>
              </div>
              <div class="ring-wrap" aria-hidden="true">
                <svg viewBox="0 0 180 180">
                  <circle class="ring-bg" cx="90" cy="90" r="80"/>
                  <circle class="ring-fg-sage" cx="90" cy="90" r="80"/>
                </svg>
                <div class="ring-center">
                  <div class="ring-num">92</div>
                  <div class="ring-max">health score</div>
                </div>
              </div>
              <div class="mockup-subtitle">7-day check-in streak · trending steady</div>
              <div class="checkin-trio">
                <div class="checkin-pill">
                  <div class="emoji">😺</div>
                  <div class="label">Mood</div>
                  <div class="value">Bright</div>
                </div>
                <div class="checkin-pill">
                  <div class="emoji">🍽️</div>
                  <div class="label">Appetite</div>
                  <div class="value">Full</div>
                </div>
                <div class="checkin-pill">
                  <div class="emoji">🚽</div>
                  <div class="label">Litter</div>
                  <div class="value">Normal</div>
                </div>
              </div>
            </div>

            <!-- ── Screen 2: BODY LANGUAGE read ─────────────────────
                 Mirrors the actual app output — a 3-5 sentence
                 observation paragraph + tag chips. The AI returns an
                 observation string (30-1200 chars) and a tag array
                 per services/behaviorObservation.ts. NO confidence
                 number is shown to the user. The earlier mockup
                 invented a confidence ring + bullet list which didn't
                 match what users see — fixed 2026-05-03. -->
            <div class="carousel-screen carousel-screen-2">
              <div style="text-align:center;">
                <span class="mockup-tier">Body language · 6-sec video</span>
              </div>
              <p class="bl-observation">
                Miso looks confidently relaxed and ready to play. Her
                tail is held upright with a soft curve at the tip, her
                whiskers fan forward, and she meets the camera with a
                slow blink — all signs of an open, settled state. The
                brief chirp reads as soliciting attention, not alarm.
              </p>
              <div class="bl-tags">
                <span class="bl-tag">confident</span>
                <span class="bl-tag">soliciting</span>
                <span class="bl-tag">relaxed</span>
                <span class="bl-tag">curious</span>
                <span class="bl-tag">tail-high</span>
              </div>
              <div class="bl-disclaimer">
                Behaviour observation — not a diagnosis. AI reads
                posture, tail, ears, eyes, and any vocalisations.
              </div>
            </div>

            <!-- ── Screen 3: PERSONALITY archetype ────────────────── -->
            <div class="carousel-screen carousel-screen-3">
              <div style="text-align:center;">
                <span class="mockup-tier mockup-tier-sage">Personality · 9 archetypes</span>
              </div>
              <div class="archetype-headline">The<br/>Hunter-Athlete</div>
              <div class="archetype-confidence">CONFIDENCE 0.78 · STABLE</div>
              <div class="ff-bar-row">
                <span>Outgoing</span>
                <span class="ff-bar-track"><span class="ff-bar-fill" style="width:56%"></span></span>
                <span class="ff-bar-num">56</span>
              </div>
              <div class="ff-bar-row">
                <span>Spontaneous</span>
                <span class="ff-bar-track"><span class="ff-bar-fill" style="width:65%"></span></span>
                <span class="ff-bar-num">65</span>
              </div>
              <div class="ff-bar-row">
                <span>Dominant</span>
                <span class="ff-bar-track"><span class="ff-bar-fill" style="width:54%"></span></span>
                <span class="ff-bar-num">54</span>
              </div>
              <div class="ff-bar-row">
                <span>Skittish</span>
                <span class="ff-bar-track"><span class="ff-bar-fill" style="width:48%"></span></span>
                <span class="ff-bar-num">48</span>
              </div>
              <div class="ff-bar-row">
                <span>Friendly</span>
                <span class="ff-bar-track"><span class="ff-bar-fill" style="width:46%"></span></span>
                <span class="ff-bar-num">46</span>
              </div>
            </div>

            <!-- ── Screen 4: PAIN CHECK (Feline Grimace Scale) ────── -->
            <div class="carousel-screen carousel-screen-4">
              <div style="text-align:center;">
                <span class="mockup-tier mockup-tier-sage">Pain check · Feline Grimace Scale</span>
              </div>
              <div class="ring-wrap-sm" aria-hidden="true">
                <svg viewBox="0 0 180 180">
                  <circle class="ring-bg" cx="90" cy="90" r="80"/>
                  <circle class="ring-fg-sage" cx="90" cy="90" r="80"/>
                </svg>
                <div class="ring-center">
                  <div class="ring-num">2</div>
                  <div class="ring-max">/ 10 composite</div>
                </div>
              </div>
              <div class="mockup-subtitle" style="margin-bottom:10px;">Validated facial pain scale (Univ. of Montreal, 2019)</div>
              <div class="au-row"><span>Ear position</span><span class="au-score">0</span></div>
              <div class="au-row"><span>Eye squint</span><span class="au-score">1</span></div>
              <div class="au-row"><span>Muzzle tension</span><span class="au-score">0</span></div>
              <div class="au-row"><span>Whisker change</span><span class="au-score">1</span></div>
              <div class="au-row"><span>Head position</span><span class="au-score">0</span></div>
            </div>

          </div>
        </div>
      </div>

      <!-- Floating callouts — content rotates in sync with the phone
           carousel so each phase highlights what the phone is actually
           showing. Earlier static callouts (always Triage + Chat) made
           "vet-grade triage" dominate the hero regardless of carousel
           state. Now the message stays contextual. The 20s cycle and
           per-screen delays match the carousel-fade animation on the
           phone screens exactly so they swap together. -->
      <div class="mockup-float mockup-float-a">
        <!-- Phase 1: Today (daily heartbeat) -->
        <div class="float-content float-content-1">
          <div class="eyebrow">DAILY RITUAL</div>
          <strong>15-second check-in</strong>
          <div class="float-body">Mood, appetite, litter — at a glance. Builds the streak. The most-opened screen.</div>
        </div>
        <!-- Phase 2: Body Language -->
        <div class="float-content float-content-2">
          <div class="eyebrow">MEOWS, PURRS, TRILLS</div>
          <strong>Audio matters too</strong>
          <div class="float-body">Whisper transcribes the clip. AI weighs voice with posture, tail, ears, eyes — full picture.</div>
        </div>
        <!-- Phase 3: Personality -->
        <div class="float-content float-content-3">
          <div class="eyebrow">9 ARCHETYPES</div>
          <strong>Mapped from behaviour</strong>
          <div class="float-body">Hunter-Athlete, Chatty Companion, Quiet Watcher — and six more. Confidence grows with data.</div>
        </div>
        <!-- Phase 4: Pain check (FGS) -->
        <div class="float-content float-content-4">
          <div class="eyebrow">WHEN SOMETHING FEELS OFF</div>
          <strong>Vet-grade triage</strong>
          <div class="float-body">Symptom-checker, photo, gum-color, litter, in 60 seconds. Most days you won't need it. The day you do, it's there.</div>
        </div>
      </div>
      <div class="mockup-float mockup-float-b">
        <!-- Phase 1: Today → pair with shareable-postcard angle -->
        <div class="float-content float-content-1">
          <div class="eyebrow">DAILY POSTCARD</div>
          <strong>Your cat 'wrote' this</strong>
          <div class="float-body">Photo collage + AI caption, ready to share. One tap to Instagram.</div>
        </div>
        <!-- Phase 2: Body Language → pair with Chat -->
        <div class="float-content float-content-2">
          <div class="eyebrow">YOUR CAT REPLIES</div>
          <strong>In their own voice</strong>
          <div class="float-body">First-person, in their archetype. They remember the diary, the people in their photos, and the things you've told them about themselves.</div>
        </div>
        <!-- Phase 3: Personality → pair with Cat Studio universe -->
        <div class="float-content float-content-3">
          <div class="eyebrow">CAT STUDIO</div>
          <strong>Your cat as art</strong>
          <div class="float-body">A new theme every week. Your cat reimagined as a movie hero, a famous painting, a historical figure, a Ghibli forest spirit.</div>
        </div>
        <!-- Phase 4: Pain check → pair with the validation credibility -->
        <div class="float-content float-content-4">
          <div class="eyebrow">VALIDATED</div>
          <strong>Univ. of Montreal, 2019</strong>
          <div class="float-body">Feline Grimace Scale. 5 action units. Real clinical rubric — not a heuristic.</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── trust strip ─────────────────────────────────────────────── -->
<!-- Sources rebalanced across the four pillars: medical (Cornell, Merck),
     welfare/practice bridge (AAFP/ISFM Cat-Friendly), behaviour (Pam
     Johnson-Bennett), ethology (Bradshaw & Turner), personality (Litchfield
     Feline Five), environmental design (Jackson Galaxy). Previously the
     strip was 5/7 medical which made the brand read as a vet-only product. -->
<div class="trust-strip">
  <div class="wrap">
    <span class="trust-label">Trained on an extensive feline corpus from</span>
    <span class="trust-source">Cornell Feline Health Center</span>
    <span class="trust-source">Merck Veterinary Manual</span>
    <span class="trust-source">AAFP &amp; ISFM Cat-Friendly Practice</span>
    <span class="trust-source">Pam Johnson-Bennett</span>
    <span class="trust-source">Jackson Galaxy</span>
    <span class="trust-source">Bradshaw &amp; Turner Ethology</span>
    <span class="trust-source">Litchfield Feline Five</span>
  </div>
</div>

<!-- ── four-pillar band ────────────────────────────────────────
     The brand-level orientation: Today / Bond / Chat / Triage. Sits
     directly under the trust strip so the four-pillar story is the
     first thing visitors see after the hero, not buried inside the
     features section. Triage moved to last so the page leads on the
     voice + relationship pillars and saves the safety-net pillar
     for the end. Terracotta-tinted background ties this to the
     Bond/relationship anchor of the brand palette — sage = medical,
     terracotta = emotional/relational. -->
<section class="pillars" id="pillars">
  <div class="wrap">
    <div class="section-head reveal" style="text-align:center;max-width:720px;margin:0 auto 36px;">
      <span class="eyebrow">Four pillars · one app</span>
      <h2>The AI shows up<br/><em>four ways.</em></h2>
    </div>
    <div class="pillar-band reveal">
      <div class="pillar">
        <span class="pillar-name">Today</span>
        <p>The daily heartbeat. Mood, appetite, streaks — every check-in shapes the cat in here.</p>
      </div>
      <div class="pillar">
        <span class="pillar-name">Bond</span>
        <p>Body language, personality, named family. Builds the cat your cat actually is.</p>
      </div>
      <div class="pillar">
        <span class="pillar-name">Chat</span>
        <p>Talk to your cat. They reply in their own voice — first person, in their archetype, with everything they remember.</p>
      </div>
      <div class="pillar">
        <span class="pillar-name">Triage</span>
        <p>For when something feels off. Vet-grade scoring, symptoms, watch monitors, vet-ready PDF.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── how your cat becomes themselves ──────────────────────────
     The data → voice loop, made explicit. Promoted from a single
     Bond-tile mention ("Becoming") to a top-level section because
     it's the strategic thesis of the product: pillars are not
     parallel utilities — they are inputs that build the cat in
     the app. Three steps mirror the existing .flow-steps visual
     language (sage step counters, surface cards, serif h3). -->
<section class="flow" id="becomes">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">The loop</span>
      <h2>The more you log,<br/><em>the more it becomes them.</em></h2>
      <p>
        Every photo, every check-in, every body-language read, every
        named person in their world — sharpens the cat that lives in
        the app. After a few weeks the diary, postcards, daily card
        and chat all stop sounding like &ldquo;an AI&rdquo; and start
        sounding like the cat at home. You stop guessing what they're
        thinking.
      </p>
    </div>
    <div class="flow-steps">
      <div class="flow-step reveal">
        <div class="flow-icon">📥</div>
        <h3>You log</h3>
        <p>Daily check-ins, photos, named family in those photos, body-language clips, things you tell your cat about themselves (&ldquo;you love tuna&rdquo;), triage scans when something feels off. Each one is a brushstroke.</p>
      </div>
      <div class="flow-step reveal">
        <div class="flow-icon">🧶</div>
        <h3>The app learns</h3>
        <p>Personality archetype locks in. The Becoming meter (face, voice, body, rhythm, family, nature, memory) tracks how shaped your cat is becoming. Memory builds — diary days, recurring people, self-facts, mood arc.</p>
      </div>
      <div class="flow-step reveal">
        <div class="flow-icon">💬</div>
        <h3>Your cat speaks</h3>
        <p>Diary, postcards, daily card, weekly readings, chat — every voice surface speaks <em>as them</em>, in their archetype's register, drawing on the memory you've built together. Not a generic cat voice. Your cat's.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── why cats are different ──────────────────────────────────
     Reframed from "cats hide illness" (triage-only) to "cats are
     puzzles" — covers all four pillars. Each card maps to one pillar
     so the section reinforces the brand structure rather than
     restating triage urgency. -->
<section class="problem" id="why">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">Why cat-only</span>
      <h2>A cat is a small puzzle<br/>wrapped in a <em>warm body.</em></h2>
      <p>
        The same animal who masks pain also masks intent, fear, and
        affection. Reading them — emotionally, behaviourally, medically —
        is the work of being a good cat parent. Generic pet apps miss it
        because they're built around dogs, who broadcast.
      </p>
    </div>
    <div class="problem-grid">
      <div class="problem-card reveal">
        <h3>They mask emotion <small style="color:var(--terracotta);text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:700;display:block;margin-top:8px;">Bond</small></h3>
        <p>A cat in conflict, in pain, or genuinely happy gives signals on five different channels — tail, ears, whiskers, eyes, posture. Most owners read one or two and miss the rest. Body-language fluency takes years; we shorten it to six seconds.</p>
        <span class="cite">— Bradshaw &amp; Turner, <em>The Domestic Cat: The Biology of its Behaviour</em></span>
      </div>
      <div class="problem-card reveal">
        <h3>They hide illness <small style="color:var(--sage-dark);text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:700;display:block;margin-top:8px;">Triage</small></h3>
        <p>Cats don't limp in public, don't whimper, don't yelp. By the time CKD, hyperthyroidism, or dental disease shows visible signs, the disease is often advanced. Hiding + mild appetite drop is sometimes the only flag — and the windows that matter are narrow.</p>
        <span class="cite">— Cornell Feline Health Center; AAFP/ISFM Senior Care Guidelines</span>
      </div>
      <div class="problem-card reveal">
        <h3>They're individuals <small style="color:var(--terracotta);text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:700;display:block;margin-top:8px;">Personality</small></h3>
        <p>Five research-validated personality traits. Nine recognisable archetypes. The same advice that fits a Confident-Sociable Bengal will quietly damage an Anxious-Sensitive rescue. Generic guidance averages cats — we don't.</p>
        <span class="cite">— Litchfield et al., <em>The Feline Five</em>, PLoS One 2017</span>
      </div>
      <div class="problem-card reveal">
        <h3>They need design <small style="color:var(--terracotta);text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:700;display:block;margin-top:8px;">Lifestyle</small></h3>
        <p>Vertical territory. Multiple separated resources. Predictable rhythms. Quiet-hours discipline. Indoor cats need <em>environmental design</em> — the AAFP/ISFM 5 Pillars framework — to behave like cats. Most stressed-cat problems are pillar gaps, not personality flaws.</p>
        <span class="cite">— AAFP/ISFM Feline Environmental Needs Guidelines</span>
      </div>
    </div>
  </div>
</section>

<!-- ── how it works — one step per pillar ─────────────────────
     Previously this described only the triage flow (describe → score
     → reasoning → act). Rewritten so each step demonstrates one of
     the four pillars. The same 4-step grid, but the brand story is
     "four surfaces that fit together," not "one triage scan." -->
<section class="flow" id="how">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">How CatMD works</span>
      <h2>Four pillars.<br/><em>One app.</em></h2>
      <p>
        Each pillar runs on its own daily rhythm — together they make a
        complete picture of your cat. Open one tab; the rest are
        humming in the background, learning who they are.
      </p>
    </div>
    <div class="flow-steps">
      <div class="flow-step reveal">
        <div class="flow-icon">🌅</div>
        <h3>Today · 15-second check-in</h3>
        <p>Three taps: mood, appetite, litter. Builds a streak, catches drift before it becomes symptom, surfaces birthdays and rituals. The home-screen heartbeat of life with a cat.</p>
      </div>
      <div class="flow-step reveal">
        <div class="flow-icon">🎥</div>
        <h3>Bond · read what they can't say</h3>
        <p>6-second video → AI reads tail, ears, whiskers, eyes, posture, vocalisations. Tells you what your cat is most likely feeling — playful, hunting, soliciting, content, fearful. Body-language fluency in seconds.</p>
      </div>
      <div class="flow-step reveal">
        <div class="flow-icon">💬</div>
        <h3>Chat · your cat replies</h3>
        <p>First-person, in their archetype's register, drawing on the diary, the people you've named in their photos, and the things you've told them about themselves. They have opinions. They remember. Plus a vet-grade safety net when symptoms come up.</p>
      </div>
      <div class="flow-step reveal">
        <div class="flow-icon">🩺</div>
        <h3>Triage · when something feels off</h3>
        <p>Symptom-checker, photo, gum-color, litter — fused into a single 0–99 assessment with vet-ready next steps. Plus weight, vaccinations, watch monitors (SRR for heart, FGS for pain).</p>
      </div>
    </div>
  </div>
</section>

<!-- ── features ────────────────────────────────────────────────── -->
<section class="features" id="features">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">The cat-only moat</span>
      <h2>Everything an owner needs to<br/><em>understand</em> their cat.</h2>
      <p>
        Each pillar above is built from features designed specifically
        for cats — feline biology, feline behaviour, feline
        decision-trees — grounded in an extensive vet-curated knowledge
        corpus from research most owners have never heard of.
      </p>
    </div>
    <!-- Reordered to flow Today → Bond → Chat → Triage (matching the
         pillar narrative above). Triage moves to the END so the page
         opens on relationship/voice features and saves the
         safety-net pillar for last. Each tile is tagged with its
         pillar label so the visual signal reinforces the structure
         even when scanned. Bond + Chat tiles use the terracotta
         icon-box accent; Today + Triage stay sage. -->
    <div class="features-grid">

      <!-- TODAY pillar (2) -->
      <div class="feature reveal" data-pillar="today">
        <div class="icon-box">🗓️</div>
        <span class="feature-pillar feature-pillar-today">Today</span>
        <h3>Daily cat check</h3>
        <p>15-second home-screen card. Three taps on mood, appetite, litter. Catches subtle trend changes before they become symptoms.</p>
      </div>
      <div class="feature reveal" data-pillar="today">
        <div class="icon-box">📓</div>
        <span class="feature-pillar feature-pillar-today">Today</span>
        <h3>Cat Diary <span class="tag">live</span></h3>
        <p>Every night at 7pm, your cat &ldquo;writes&rdquo; a journal entry from their POV — warm, observant, snobbish. References recent days, named family in their photos, and the things you&rsquo;ve told them about themselves. Shareable. Memorable. Yours forever.</p>
      </div>

      <!-- BOND pillar (3) -->
      <div class="feature reveal" data-pillar="bond">
        <div class="icon-box">🎙️</div>
        <span class="feature-pillar feature-pillar-bond">Bond</span>
        <h3>Meow Translator <span class="tag">new</span></h3>
        <p>4-second video. AI fuses the meow + body language + everything CatMD already knows about your cat into one screenshot-worthy line — in your cat&rsquo;s actual voice, calibrated to their archetype and recent week. <em>Lily says: &ldquo;fine. you may sit on the floor near me. don&rsquo;t talk.&rdquo;</em></p>
      </div>
      <div class="feature reveal" data-pillar="bond">
        <div class="icon-box">🎥</div>
        <span class="feature-pillar feature-pillar-bond">Bond</span>
        <h3>Read your cat <span class="tag">live</span></h3>
        <p>6-second video. AI reads body language, vocalisations, and motion blur to tell you what your cat is most likely feeling — playful, hunting, soliciting, annoyed, fearful, content.</p>
      </div>
      <div class="feature reveal" data-pillar="bond">
        <div class="icon-box">🎭</div>
        <span class="feature-pillar feature-pillar-bond">Bond</span>
        <h3>Personality Profile <span class="tag">live</span></h3>
        <p>Co-Star-style archetype mapping. After a week of check-ins + behaviour reads, AI reveals your cat&rsquo;s personality from the Litchfield Feline Five framework — and the diary, postcards, and chat all start speaking in their archetype&rsquo;s voice.</p>
      </div>
      <div class="feature reveal" data-pillar="bond">
        <div class="icon-box">👥</div>
        <span class="feature-pillar feature-pillar-bond">Bond</span>
        <h3>People &amp; Pets <span class="tag">live</span></h3>
        <p>Tag who&rsquo;s in your cat&rsquo;s photos — Mom, Bella, the vet. Vision auto-recognises the same person across photos. Recurring names get woven into the diary as memories: &ldquo;Bella was here again&rdquo;, &ldquo;haven&rsquo;t seen Mom in three days&rdquo;.</p>
      </div>
      <div class="feature reveal" data-pillar="bond">
        <div class="icon-box">✨</div>
        <span class="feature-pillar feature-pillar-bond">Bond</span>
        <h3>Becoming meter <span class="tag">live</span></h3>
        <p>A live 7-facet score (face, voice, body, rhythm, family, nature, memory) showing how shaped your cat is in the app. The visible signal of <a href="#becomes" style="color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">the loop above</a> — every action moves the needle, every needle-tick sharpens their voice.</p>
      </div>
      <div class="feature reveal" data-pillar="bond">
        <div class="icon-box">🎬</div>
        <span class="feature-pillar feature-pillar-bond">Bond</span>
        <h3>Cat Studio <span class="tag">live</span></h3>
        <p>A new theme rolls in every week — movie posters, famous paintings, historical figures, Studio Ghibli scenes, Pixar, 80s anime. Your cat reimagined into each one. &ldquo;Lord of the Meows&rdquo; one week, Cleocatra the next, Mona Lily the week after. The shareable side of life with your cat.</p>
      </div>

      <!-- CHAT pillar (1) -->
      <div class="feature reveal" data-pillar="chat">
        <div class="icon-box">💬</div>
        <span class="feature-pillar feature-pillar-chat">Chat</span>
        <h3>Talk to Your Cat <span class="tag">live</span></h3>
        <p>Your cat replies in their own voice — first person, in their personality archetype&rsquo;s register. They remember the diary, the named people in their photos, and the things you&rsquo;ve told them about themselves (&ldquo;you love tuna&rdquo; &rarr; they remember). Plus a vet-grade safety net when symptoms come up.</p>
      </div>

      <!-- TRIAGE pillar (6) — moved to last so the page opens on the
           voice/relationship pillars and ends on the safety net. -->
      <div class="feature reveal" data-pillar="triage">
        <div class="icon-box">🐾</div>
        <span class="feature-pillar feature-pillar-triage">Triage</span>
        <h3>Symptom + photo triage</h3>
        <p>Multi-modal input. One scan takes a gum-colour photo, a litter clump, and typed notes — fused into a single 0–99 assessment with vet-ready next steps.</p>
      </div>
      <div class="feature reveal" data-pillar="triage">
        <div class="icon-box">📊</div>
        <span class="feature-pillar feature-pillar-triage">Triage</span>
        <h3>Feline Grimace Scale <span class="tag">research-grade</span></h3>
        <p>Validated 5-action-unit pain score from a single photo, based on the University of Montreal 2019 protocol — a clinical tool in your pocket.</p>
      </div>
      <div class="feature reveal" data-pillar="triage">
        <div class="icon-box">🫁</div>
        <span class="feature-pillar feature-pillar-triage">Triage</span>
        <h3>Sleeping respiratory rate</h3>
        <p>Gold-standard HCM early warning. Tap per breath, 30-second timer, alert at &gt;30 bpm. For every Maine Coon, Ragdoll, Sphynx, Persian.</p>
      </div>
      <div class="feature reveal" data-pillar="triage">
        <div class="icon-box">🔬</div>
        <span class="feature-pillar feature-pillar-triage">Triage</span>
        <h3>Litter-box analysis</h3>
        <p>Photo-based screening for urine blockage, polyuria, crystals, blood, and stool pattern — plus frequency trending that flags change before your vet does.</p>
      </div>
      <div class="feature reveal" data-pillar="triage">
        <div class="icon-box">🧾</div>
        <span class="feature-pillar feature-pillar-triage">Triage</span>
        <h3>Vet-ready PDF</h3>
        <p>One-tap export: chronology, symptom timeline, red flags, differentials, sources, questions to ask. Your vet reads it in a minute.</p>
      </div>
      <div class="feature reveal" data-pillar="triage">
        <div class="icon-box">🏥</div>
        <span class="feature-pillar feature-pillar-triage">Triage</span>
        <h3>Emergency vet finder</h3>
        <p>When a scan comes back emergency-tier: one-tap dial to the nearest 24/7 ER vet, plus direct line to the ASPCA poison hotline.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── tiers ───────────────────────────────────────────────────── -->
<section class="tiers">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">The 0–99 score</span>
      <h2>Not a diagnosis.<br/>A structured second opinion.</h2>
      <p>
        The tier tells you what to do. The score tells you how sure we are.
        You decide.
      </p>
    </div>
    <div class="tier-bar">
      <div class="tier-box tier-emergency reveal">
        <div class="tier-label">Emergency</div>
        <div class="tier-range">0–29</div>
        <div class="tier-desc">ER vet now. One-tap dial to the nearest emergency hospital, plus poison hotline.</div>
      </div>
      <div class="tier-box tier-urgent reveal">
        <div class="tier-label">Vet Soon</div>
        <div class="tier-range">30–59</div>
        <div class="tier-desc">Book within 24–48h. CatMD preps the vet-ready summary so the visit is efficient.</div>
      </div>
      <div class="tier-box tier-monitor reveal">
        <div class="tier-label">Monitor</div>
        <div class="tier-range">60–79</div>
        <div class="tier-desc">Watch 24–48h. Specific red flags to check for. Follow-up check-in the next day.</div>
      </div>
      <div class="tier-box tier-routine reveal">
        <div class="tier-label">Low Concern</div>
        <div class="tier-range">80–99</div>
        <div class="tier-desc">Normal variance. Logged for trend, no action needed. Move on with your day.</div>
      </div>
    </div>
  </div>
</section>

<!-- ── research sources ───────────────────────────────────────── -->
<section class="research">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">Sourced, not scraped</span>
      <h2>Trained on the <em>actual</em><br/>feline canon — medical AND behavioural.</h2>
      <p>
        Our knowledge base is built from peer-reviewed veterinary and feline-
        behaviour sources — rewritten into neutral factual summaries with
        citations, never verbatim scraping. Every AI answer can trace back to
        a source. We don&rsquo;t train on Reddit anecdotes or forum threads.
      </p>
    </div>
    <div class="sources-grid">
      <div class="source reveal">
        <div class="name">Merck Vet Manual</div>
        <div class="desc">Feline chapters, signs, differentials, emergency criteria.</div>
      </div>
      <div class="source reveal">
        <div class="name">AAFP</div>
        <div class="desc">American Association of Feline Practitioners clinical guidelines + Environmental Needs framework.</div>
      </div>
      <div class="source reveal">
        <div class="name">ISFM / ICatCare</div>
        <div class="desc">International Society of Feline Medicine — consensus documents on medicine and behaviour.</div>
      </div>
      <div class="source reveal">
        <div class="name">Cornell Feline Health Center</div>
        <div class="desc">Owner-facing explainers for all major feline conditions and behaviours.</div>
      </div>
      <div class="source reveal">
        <div class="name">ASPCA APCC</div>
        <div class="desc">Feline toxicity database — plants, foods, human medications.</div>
      </div>
      <div class="source reveal">
        <div class="name">Litchfield &amp; Bradshaw</div>
        <div class="desc">Feline Five personality framework + Bradshaw &amp; Turner ethology — the basis of our behaviour reader and personality profile.</div>
      </div>
    </div>
    <div class="research-stats">
      <div class="stat reveal">
        <div class="stat-num">Extensive</div>
        <div class="stat-label">feline knowledge corpus</div>
      </div>
      <div class="stat reveal">
        <div class="stat-num">6</div>
        <div class="stat-label">peer-reviewed source families</div>
      </div>
      <div class="stat reveal">
        <div class="stat-num">10</div>
        <div class="stat-label">locked safety guardrails</div>
      </div>
      <div class="stat reveal">
        <div class="stat-num">0</div>
        <div class="stat-label">diagnosis claims</div>
      </div>
    </div>
  </div>
</section>

<!-- ── honest AI ──────────────────────────────────────────────── -->
<section class="honest">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">Honest AI</span>
      <h2>We don't pretend<br/>to be your vet.</h2>
      <p>
        The pet-AI space is full of apps that promise diagnosis. We don't,
        by design. We triage. We educate. We prep your vet visit. Your
        vet decides what's actually happening.
      </p>
    </div>
    <div class="honest-grid">
      <div class="honest-item reveal">
        <span class="check">✓</span>
        <div>
          <strong>Never called a diagnosis.</strong>
          <span>FDA + VCPR-compliant language. "Triage," "indicative urgency," "differentials to discuss with your vet."</span>
        </div>
      </div>
      <div class="honest-item reveal">
        <span class="check">✓</span>
        <div>
          <strong>Always shows its reasoning.</strong>
          <span>Every scan lists supporting symptoms, red flags, source citations. No black box.</span>
        </div>
      </div>
      <div class="honest-item reveal">
        <span class="check">✓</span>
        <div>
          <strong>Confident only when warranted.</strong>
          <span>Low-confidence flag when evidence is thin. Emergency-keyword override bypasses score uncertainty.</span>
        </div>
      </div>
      <div class="honest-item reveal">
        <span class="check">✓</span>
        <div>
          <strong>Species-locked.</strong>
          <span>Refuses to triage dogs, rabbits, or humans. "CatMD is for cats only" isn't marketing — it's a hardcoded rule.</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── mission note ──────────────────────────────────────────── -->
<section class="founder">
  <div class="wrap">
    <div class="founder-inner reveal">
      <div class="eyebrow" style="margin-bottom:20px;">Why CatMD exists</div>
      <blockquote>
        The first time your cat acts "off" for a day, you spend hours on
        Google convincing yourself it's nothing. Sometimes it isn't nothing.
        CatMD exists so no cat parent at 2 a.m. has to settle for a search
        bar and a forum thread from 2011.
      </blockquote>
    </div>
  </div>
</section>

<!-- ── pricing ────────────────────────────────────────────────── -->
<section class="pricing" id="pricing">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">Pricing</span>
      <h2>Simple, <em>honest pricing.</em></h2>
      <p>Try every Pro feature free for 14 days. After that, choose a plan to keep your cat's voice.</p>
    </div>
    <div class="pricing-grid">
      <div class="price-card price-card-feature reveal">
        <span class="price-tag">Best value</span>
        <span class="price-eyebrow">Pro Annual</span>
        <div class="price-amount">$79.99<span class="price-per">/year</span></div>
        <div class="price-cadence">≈ $6.67/month · 14-day free trial</div>
        <ul class="price-list">
          <li>Unlimited scans</li>
          <li>Multi-cat dashboards</li>
          <li>Cloud sync across devices</li>
          <li>Priority emergency-tier model</li>
        </ul>
      </div>
      <div class="price-card reveal">
        <span class="price-eyebrow">Pro Monthly</span>
        <div class="price-amount">$9.99<span class="price-per">/month</span></div>
        <div class="price-cadence">cancel anytime</div>
        <ul class="price-list">
          <li>Unlimited scans</li>
          <li>Multi-cat dashboards</li>
          <li>Cloud sync across devices</li>
          <li>Priority emergency-tier model</li>
        </ul>
      </div>
    </div>
    <p class="pricing-footnote reveal">Prices in USD. No card on file during the 14-day trial. No auto-charge surprises.</p>
  </div>
</section>

<!-- ── faq ────────────────────────────────────────────────────── -->
<section class="faq" id="faq">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">FAQ</span>
      <h2>Questions we get often.</h2>
    </div>
    <div class="faq-list">
      <details class="faq-item reveal">
        <summary>Is CatMD safe to rely on?</summary>
        <p>CatMD is <strong>not</strong> a replacement for a veterinarian, and every scan result says so. It's designed as structured triage — helping you decide whether the symptom is worth a 2 a.m. ER trip, a booking within 24–48 hours, or watchful monitoring. If your cat is in obvious distress, call a vet, not an app.</p>
      </details>
      <details class="faq-item reveal">
        <summary>How is this different from ChatGPT or Google?</summary>
        <p>CatMD is species-locked to cats. Its knowledge base is curated from five peer-reviewed feline sources and the prompts enforce FDA/VCPR-compliant language. It shows its sources. It has safety guardrails that override uncertain scores on emergency keywords. General-purpose chatbots have none of that.</p>
      </details>
      <details class="faq-item reveal">
        <summary>What does it cost?</summary>
        <p>14-day free trial with full Pro access — unlimited scans, every feature unlocked, no card on file. After trial: Pro Annual $79.99/year (roughly $6.67/month) or Pro Monthly $9.99/month. Cancel anytime.</p>
      </details>
      <details class="faq-item reveal">
        <summary>What happens to my cat's data?</summary>
        <p>You can use CatMD fully anonymously — no account required. Scan history lives on your device unless you opt in to cloud sync. Photos you scan are sent to our AI processing partner (OpenAI) to produce the triage and are not retained on our servers after the scan. We don't sell your data. We don't train AI models on your cat. One tap in Settings deletes everything.</p>
      </details>
      <details class="faq-item reveal">
        <summary>When will CatMD be on iOS?</summary>
        <p>Android is live on Google Play now. iOS follows roughly 2 months after Android public launch, pending Apple review and reasonable retention proof on Android. Join the waitlist to be notified the day the iOS TestFlight opens.</p>
      </details>
      <details class="faq-item reveal">
        <summary>Who built this?</summary>
        <p>CatMD is built by a solo indie developer in Singapore, with Claude as pair-programmer. The knowledge pipeline, triage logic, and product design are all reviewed against published veterinary guidelines before shipping. No VC. No paid influencers. Just a cat owner who thought the space deserved something better.</p>
      </details>
    </div>
  </div>
</section>

<!-- ── final CTA ──────────────────────────────────────────────── -->
<section class="final-cta" id="get">
  <div class="wrap">
    <div class="reveal">
      <h2>Your cat is one of one.<br/><em>Treat them that way.</em></h2>
      <p>Get CatMD on Google Play, or join the iOS waitlist.</p>
    </div>
    <div class="platform-row">
      <div class="platform reveal">
        <span class="p-status">● Live now · Android</span>
        <h3>Android — Google Play</h3>
        <p>Install free, use freely. Feedback DMed directly to the founder.</p>
        <a class="btn btn-primary" href="${buildPlayStoreUrl('landing', 'final_cta')}">Get on Google Play</a>
      </div>
      <div class="platform coming reveal">
        <span class="p-status">○ Coming soon · iOS</span>
        <h3>iOS waitlist</h3>
        <p>Email me at launch. No spam — one notification when TestFlight opens.</p>
        <a class="btn btn-ghost" href="mailto:${CONTACT_EMAIL}?subject=${WAITLIST_SUBJ}&amp;body=${WAITLIST_BODY}">Join iOS waitlist</a>
      </div>
    </div>
    <div style="color:var(--muted); font-size:13px;">
      Informational triage only. Not a diagnosis. Not veterinary advice.<br/>
      In a medical emergency, contact a licensed veterinarian immediately.
    </div>
  </div>
</section>

<!-- ── footer ─────────────────────────────────────────────────── -->
<footer>
  <div class="wrap">
    <div class="fcol brand-col">
      <div class="logo">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="34" r="20" fill="#3F6456"/>
          <path d="M16 22 L20 10 L26 24 Z" fill="#3F6456"/>
          <path d="M48 22 L44 10 L38 24 Z" fill="#3F6456"/>
          <circle cx="26" cy="32" r="2.4" fill="#FAF7F2"/>
          <circle cx="38" cy="32" r="2.4" fill="#FAF7F2"/>
          <path d="M30 38 Q32 41 34 38" stroke="#FAF7F2" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </svg>
        CatMD
      </div>
      <p>AI for cat owners. Built for cats only. By cat people.</p>
      <!-- Third-party verification badges. Trust signals — kept in
           the brand column so they sit alongside the logo + tagline.
           SaaSHub approved 2026-05-04. Add Product Hunt / AlternativeTo
           badges here as those listings go live. -->
      <div style="margin-top: 14px;">
        <a
          href="https://www.saashub.com/catmd?utm_source=badge&amp;utm_campaign=badge&amp;utm_content=catmd&amp;badge_variant=color&amp;badge_kind=approved"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="CatMD on SaaSHub"
        >
          <img
            src="https://cdn-b.saashub.com/img/badges/approved-color.png?v=1"
            alt="CatMD on SaaSHub"
            style="max-width: 150px; height: auto; opacity: 0.9;"
          />
        </a>
      </div>
    </div>
    <div class="fcol">
      <h4>Product</h4>
      <a href="#how">How it works</a>
      <a href="#features">Features</a>
      <a href="#get">Get the app</a>
      <a href="#faq">FAQ</a>
    </div>
    <div class="fcol">
      <h4>Legal</h4>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/disclaimer">Medical disclaimer</a>
      <a href="/delete-account">Delete account</a>
    </div>
    <div class="fcol">
      <h4>Contact</h4>
      <a href="mailto:${CONTACT_EMAIL}">Email</a>
      <a href="/legal">All legal pages</a>
    </div>
  </div>
  <div class="footer-base">
    <div>&copy; ${new Date().getFullYear()} CatMD</div>
    <div>Informational only — not veterinary advice.</div>
  </div>
</footer>

<!-- ── reveal-on-scroll (vanilla JS, no deps) ────────────────── -->
<script>
  (function () {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  })();
</script>

</body>
</html>`;
}
