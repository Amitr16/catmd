/**
 * Cat Symptom Checker — /cat-symptom-checker
 *
 * SEO target: "cat symptom checker" (currently rank: null; #1 is cats.com).
 * Format mismatch is why we don't rank — they have a tool, we had only
 * individual articles. This page is the tool: a symptom grid that picks
 * the right library article for what the user is seeing, in one click.
 *
 * What this page does (in priority order):
 *   1. Match Google's intent for the query (tool, not article).
 *   2. Funnel high-intent searchers into the existing 18 library articles.
 *   3. Convert into Play Store installs via the bottom CTA (utm_medium=tool).
 *
 * Why no scoring / no diagnosis: this would push us into YMYL liability
 * territory we don't want. Pure router from symptom → vet-reviewed library
 * article keeps the trust angle clean and the legal surface small.
 */
import {
  buildPlayStoreUrl,
  renderAnalyticsScripts,
  renderSearchConsoleMeta,
} from './seoAndAnalytics';

const SITE_URL = 'https://catmd.pet';
const PAGE_URL = `${SITE_URL}/cat-symptom-checker`;
const PAGE_TITLE = 'Cat Symptom Checker — Free, Vet-Reviewed Triage Guide';
const PAGE_DESCRIPTION =
  'Free cat symptom checker. Pick what you\'re seeing — vomiting, hiding, not eating, breathing fast, straining, jumping less — and get the right vet-reviewed guide in one click. Plus a 60-second AI triage tool in the CatMD app.';

type Severity = 'emergency' | 'urgent' | 'monitor';

interface SymptomCard {
  /** Visible label — should match how owners search ("not eating", not "anorexia"). */
  label: string;
  /** One-sentence elaboration shown under the label. */
  hint: string;
  /** Library article slug this card routes to. */
  slug: string;
  severity: Severity;
}

interface SymptomGroup {
  id: string;
  title: string;
  blurb: string;
  cards: SymptomCard[];
}

/** Cards grouped by body system. Emergencies float first for crawler signal. */
const SYMPTOM_GROUPS: SymptomGroup[] = [
  {
    id: 'emergency',
    title: 'Emergency — minutes matter',
    blurb:
      'These patterns need a vet today, not tomorrow. If your cat fits one of these, call your nearest emergency clinic now.',
    cards: [
      {
        label: 'Straining in the litter box',
        hint: 'Especially male cats. Can be a urethral obstruction — life-threatening within hours.',
        slug: 'cat-straining-to-urinate',
        severity: 'emergency',
      },
      {
        label: 'Ate a lily or toxic plant',
        hint: 'Lilies cause acute kidney failure in cats. Even a small lick of pollen is a vet visit.',
        slug: 'cat-ate-lily-emergency',
        severity: 'emergency',
      },
      {
        label: 'Breathing fast while sleeping',
        hint: 'Resting respiratory rate >30 breaths/min can indicate fluid in the lungs.',
        slug: 'cat-breathing-fast-sleeping',
        severity: 'emergency',
      },
      {
        label: 'Pale, white, or blue gums',
        hint: 'Gum colour is one of the fastest signals of shock, anemia, or oxygen problems.',
        slug: 'cat-gum-color',
        severity: 'emergency',
      },
    ],
  },
  {
    id: 'digestive',
    title: 'Digestive & appetite',
    blurb: 'The most common reasons cats see a vet — and the patterns that separate "monitor at home" from "go now."',
    cards: [
      {
        label: 'Vomiting',
        hint: 'How to tell occasional hairball from something more serious.',
        slug: 'cat-vomiting-when-to-see-vet',
        severity: 'urgent',
      },
      {
        label: 'Not eating',
        hint: 'Cats who skip more than 24 hours need attention — fatty liver risk is real.',
        slug: 'cat-not-eating',
        severity: 'urgent',
      },
      {
        label: 'Losing weight',
        hint: 'Quiet weight loss is often the first sign of treatable disease.',
        slug: 'cat-losing-weight',
        severity: 'urgent',
      },
    ],
  },
  {
    id: 'urinary',
    title: 'Litter box & urinary',
    blurb: 'The litter box is the most underrated diagnostic tool in feline health.',
    cards: [
      {
        label: 'Changed litter-box habits',
        hint: 'Going more, going less, going outside the box — what the patterns mean.',
        slug: 'cat-litter-box-changes',
        severity: 'urgent',
      },
      {
        label: 'Straining to urinate',
        hint: 'A male cat straining is an emergency. A female cat straining is still urgent.',
        slug: 'cat-straining-to-urinate',
        severity: 'emergency',
      },
    ],
  },
  {
    id: 'respiratory',
    title: 'Respiratory & eyes',
    blurb: 'Overlapping anatomy means these symptoms often cluster — the decision tree for URI vs something worse.',
    cards: [
      {
        label: 'Sneezing',
        hint: 'When sneezing means a mild URI, and when it points to something deeper.',
        slug: 'cat-sneezing',
        severity: 'monitor',
      },
      {
        label: 'Eye discharge',
        hint: 'Clear, yellow, green, or crusty — each colour means something different.',
        slug: 'cat-eye-discharge',
        severity: 'monitor',
      },
      {
        label: 'Breathing fast',
        hint: 'Count breaths while she sleeps — over 30/min in a relaxed cat is concerning.',
        slug: 'cat-breathing-fast-sleeping',
        severity: 'emergency',
      },
    ],
  },
  {
    id: 'pain-mobility',
    title: 'Pain & mobility',
    blurb: 'Cats hide pain. These are the patterns owners notice without realising they are signals.',
    cards: [
      {
        label: 'Hiding pain (face changes)',
        hint: 'The Feline Grimace Scale — five facial signals vets use to score pain.',
        slug: 'do-cats-hide-pain',
        severity: 'urgent',
      },
      {
        label: 'Not jumping like she used to',
        hint: 'Reduced jumping is often arthritis, but not always. What else to check.',
        slug: 'cat-not-jumping',
        severity: 'urgent',
      },
      {
        label: 'Grooming less / rough coat',
        hint: 'A dull coat reflects movement, comfort, and energy — not just hygiene.',
        slug: 'cat-grooming-less',
        severity: 'urgent',
      },
    ],
  },
  {
    id: 'general',
    title: 'General wellness',
    blurb: 'Cats mask weakness. These full-body signals often appear before any organ-specific sign.',
    cards: [
      {
        label: 'Hiding more than usual',
        hint: 'A cat who suddenly hides is often telling you something.',
        slug: 'cat-hiding-illness',
        severity: 'urgent',
      },
      {
        label: 'Lethargic / less active',
        hint: 'Sleeping more is normal at any age. Slower in motion is not.',
        slug: 'cat-lethargy',
        severity: 'urgent',
      },
      {
        label: 'Meowing more than usual',
        hint: 'Sudden vocal changes — what each pattern can mean.',
        slug: 'why-does-my-cat-meow-at-me',
        severity: 'monitor',
      },
    ],
  },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityClass(s: Severity): string {
  if (s === 'emergency') return 'sev-emergency';
  if (s === 'urgent') return 'sev-urgent';
  return 'sev-monitor';
}

function severityLabel(s: Severity): string {
  if (s === 'emergency') return 'Emergency';
  if (s === 'urgent') return 'Urgent';
  return 'Monitor';
}

export function renderSymptomChecker(): string {
  const allSlugs = SYMPTOM_GROUPS.flatMap((g) => g.cards.map((c) => c.slug));
  const playUrl = buildPlayStoreUrl('tool', 'cat-symptom-checker');

  // ItemList schema — helps Google understand this is a curated index of
  // symptom guides, improves sitelinks eligibility.
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Cat Symptom Checker — symptom index',
    'numberOfItems': allSlugs.length,
    'itemListElement': allSlugs.map((slug, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'url': `${SITE_URL}/library/${slug}`,
    })),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'CatMD', 'item': SITE_URL },
      { '@type': 'ListItem', 'position': 2, 'name': 'Cat Symptom Checker', 'item': PAGE_URL },
    ],
  };

  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'name': 'CatMD Cat Symptom Checker',
    'url': PAGE_URL,
    'applicationCategory': 'HealthApplication',
    'operatingSystem': 'Any',
    'description': PAGE_DESCRIPTION,
    'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
  };

  const groupsHtml = SYMPTOM_GROUPS.map(
    (g) => `
    <section class="sym-group ${g.id === 'emergency' ? 'sym-group-emergency' : ''}" id="${g.id}">
      <h2>${escapeHtml(g.title)}</h2>
      <p class="group-blurb">${escapeHtml(g.blurb)}</p>
      <div class="sym-grid">
        ${g.cards
          .map(
            (c) => `
            <a class="sym-card ${severityClass(c.severity)}" href="/library/${c.slug}">
              <span class="sev-tag">${severityLabel(c.severity)}</span>
              <span class="sym-label">${escapeHtml(c.label)}</span>
              <span class="sym-hint">${escapeHtml(c.hint)}</span>
              <span class="sym-arrow" aria-hidden="true">→</span>
            </a>`,
          )
          .join('')}
      </div>
    </section>`,
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#FAF7F2" />
<title>${escapeHtml(PAGE_TITLE)}</title>
<meta name="description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
<link rel="canonical" href="${PAGE_URL}" />
${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}
<meta property="og:title" content="${escapeHtml(PAGE_TITLE)}" />
<meta property="og:description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${PAGE_URL}" />
<meta property="og:site_name" content="CatMD" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(PAGE_TITLE)}" />
<meta name="twitter:description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='34' r='20' fill='%233F6456'/%3E%3Cpath d='M16 22 L20 10 L26 24 Z' fill='%233F6456'/%3E%3Cpath d='M48 22 L44 10 L38 24 Z' fill='%233F6456'/%3E%3Ccircle cx='26' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Ccircle cx='38' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600&family=Inter:wght@400;500;600;700&display=swap" />
<script type="application/ld+json">${JSON.stringify(webApp)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<style>
  :root {
    --cream:#FAF7F2; --cream-2:#F4EFE5; --sage:#3F6456; --sage-dark:#25403A;
    --sage-soft:#DCE6DE; --terracotta:#C97B63; --ink:#1F2024; --ink-2:#2E2D28;
    --muted:#7A7160; --border:#E6E0D3; --surface:#FFFFFF;
    --emergency:#B8392F; --emergency-bg:#FDECE8;
    --urgent:#C97B63; --urgent-bg:#FAEFE9;
    --ff-serif:'Fraunces','Iowan Old Style',Georgia,serif;
    --ff-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box;}
  html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;}
  body{margin:0;background:var(--cream);color:var(--ink);font-family:var(--ff-sans);
    font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;}
  a{color:var(--sage);text-underline-offset:3px;}
  a:hover{color:var(--sage-dark);}

  nav.top{position:sticky;top:0;z-index:50;background:rgba(250,247,242,0.88);
    backdrop-filter:saturate(140%) blur(12px);-webkit-backdrop-filter:saturate(140%) blur(12px);
    border-bottom:1px solid rgba(230,224,211,0.6);}
  nav.top .wrap{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;
    justify-content:space-between;align-items:center;}
  nav.top .logo{display:flex;align-items:center;gap:10px;font-family:var(--ff-serif);
    font-weight:500;font-size:19px;color:var(--ink);text-decoration:none;}
  nav.top .logo svg{width:26px;height:26px;}
  nav.top .links a{margin-left:24px;font-size:14px;color:var(--ink-2);
    font-weight:500;text-decoration:none;}
  nav.top .links a:hover{color:var(--sage);}

  .hero{max-width:1100px;margin:0 auto;padding:64px 24px 36px;text-align:center;}
  .kicker{font-size:12px;letter-spacing:0.14em;text-transform:uppercase;
    font-weight:700;color:var(--sage);margin-bottom:14px;}
  h1{font-family:var(--ff-serif);font-size:clamp(34px,5vw,52px);
    line-height:1.1;margin:0 0 16px;font-weight:500;letter-spacing:-0.018em;
    font-variation-settings:"opsz" 96,"wght" 500;}
  .hero p.sub{margin:0 auto 28px;max-width:680px;color:var(--ink-2);font-size:18px;line-height:1.55;}
  .hero p.note{margin:0 auto;max-width:620px;color:var(--muted);font-size:14px;font-style:italic;}

  .container{max-width:1100px;margin:0 auto;padding:24px 24px 80px;}

  .sym-group{margin:48px 0;}
  .sym-group h2{font-family:var(--ff-serif);font-size:28px;margin:0 0 8px;
    font-weight:500;font-variation-settings:"opsz" 48,"wght" 500;}
  .sym-group .group-blurb{margin:0 0 22px;color:var(--ink-2);max-width:760px;}
  .sym-group-emergency h2{color:var(--emergency);}

  .sym-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
  .sym-card{position:relative;display:flex;flex-direction:column;gap:6px;
    padding:18px 20px 22px;background:var(--surface);border:1px solid var(--border);
    border-radius:14px;text-decoration:none;color:var(--ink);
    transition:transform .14s ease, box-shadow .14s ease, border-color .14s ease;}
  .sym-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(31,32,36,.06);
    border-color:var(--sage-soft);}
  .sym-card.sev-emergency{border-left:4px solid var(--emergency);}
  .sym-card.sev-urgent{border-left:4px solid var(--urgent);}
  .sym-card.sev-monitor{border-left:4px solid var(--sage);}
  .sev-tag{font-size:11px;letter-spacing:0.08em;text-transform:uppercase;
    font-weight:700;color:var(--muted);}
  .sym-card.sev-emergency .sev-tag{color:var(--emergency);}
  .sym-card.sev-urgent .sev-tag{color:var(--urgent);}
  .sym-card.sev-monitor .sev-tag{color:var(--sage);}
  .sym-label{font-family:var(--ff-serif);font-size:18px;font-weight:500;
    font-variation-settings:"opsz" 32,"wght" 500;color:var(--ink);}
  .sym-hint{font-size:14px;color:var(--ink-2);line-height:1.5;}
  .sym-arrow{position:absolute;top:18px;right:18px;color:var(--muted);font-size:18px;
    transition:transform .14s ease, color .14s ease;}
  .sym-card:hover .sym-arrow{transform:translateX(2px);color:var(--sage);}

  .app-cta{margin:64px auto 0;max-width:760px;padding:36px 30px;background:var(--sage-dark);
    color:var(--cream);border-radius:18px;text-align:center;}
  .app-cta h3{font-family:var(--ff-serif);font-size:26px;margin:0 0 8px;color:var(--cream);
    font-variation-settings:"opsz" 48,"wght" 500;}
  .app-cta p{margin:0 auto 22px;max-width:560px;color:rgba(250,247,242,0.86);font-size:16px;line-height:1.55;}
  .app-cta a{display:inline-block;padding:13px 26px;background:var(--cream);
    color:var(--sage-dark);text-decoration:none;border-radius:999px;
    font-weight:600;font-size:15px;}
  .app-cta a:hover{background:#fff;}

  .disclaimer{margin-top:36px;padding:20px 22px;background:var(--cream-2);
    border-radius:12px;font-size:13.5px;color:var(--muted);font-style:italic;line-height:1.6;}
  .disclaimer strong{color:var(--ink);font-style:normal;}

  .related-reading{margin-top:64px;padding-top:36px;border-top:1px solid var(--border);}
  .related-reading h2{font-family:var(--ff-serif);font-size:28px;margin:0 0 8px;
    font-weight:500;font-variation-settings:"opsz" 48,"wght" 500;}
  .related-blurb{margin:0 0 24px;color:var(--ink-2);max-width:680px;}
  .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
  .related-card{display:flex;flex-direction:column;gap:6px;padding:18px 20px 20px;
    background:var(--surface);border:1px solid var(--border);border-radius:14px;
    text-decoration:none;color:var(--ink);
    transition:transform .14s ease, box-shadow .14s ease, border-color .14s ease;}
  .related-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(31,32,36,.06);
    border-color:var(--sage-soft);}
  .related-tag{font-size:11px;letter-spacing:0.08em;text-transform:uppercase;
    font-weight:700;color:var(--sage);}
  .related-title{font-family:var(--ff-serif);font-size:17px;font-weight:500;
    line-height:1.3;color:var(--ink);font-variation-settings:"opsz" 32,"wght" 500;}
  .related-hint{font-size:14px;color:var(--ink-2);line-height:1.5;}
  .related-foot{margin:24px 0 0;font-size:14.5px;}

  footer.site-foot{margin-top:60px;padding:32px 24px;border-top:1px solid var(--border);
    color:var(--muted);font-size:13px;text-align:center;}
  footer.site-foot a{color:var(--muted);margin:0 8px;text-decoration:none;}
  footer.site-foot a:hover{color:var(--sage);}
</style>
</head>
<body>
<nav class="top">
  <div class="wrap">
    <a class="logo" href="/">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="32" cy="34" r="20" fill="#3F6456"/>
        <path d="M16 22 L20 10 L26 24 Z" fill="#3F6456"/>
        <path d="M48 22 L44 10 L38 24 Z" fill="#3F6456"/>
        <circle cx="26" cy="32" r="2.4" fill="#FAF7F2"/>
        <circle cx="38" cy="32" r="2.4" fill="#FAF7F2"/>
      </svg>
      CatMD
    </a>
    <div class="links">
      <a href="/library">Library</a>
      <a href="/cat-personality-test">Personality Test</a>
      <a href="/blog">Blog</a>
    </div>
  </div>
</nav>

<header class="hero">
  <div class="kicker">Free · Vet-Reviewed · Plain English</div>
  <h1>Cat Symptom Checker</h1>
  <p class="sub">Pick what you're seeing. Get the right vet-reviewed guide in one click — no signup, no email, no AI scoring you can't verify.</p>
  <p class="note">For a faster on-the-go check, the CatMD app includes a 60-second AI triage tool that scans a photo of your cat and returns a structured read. Free on Android.</p>
</header>

<main class="container">
${groupsHtml}

  <div class="app-cta">
    <h3>The full 60-second AI triage lives in the app</h3>
    <p>CatMD's Triage tool takes a photo of your cat, asks 4 short questions, and returns a structured read citing Merck, Cornell, and AAFP. Free on Google Play.</p>
    <a href="${playUrl}" rel="nofollow">Get CatMD on Google Play</a>
  </div>

  <section class="related-reading">
    <h2>More from the CatMD Library</h2>
    <p class="related-blurb">Beyond symptom triage — the patterns, frameworks, and life-stage guides feline vets use to read cats well.</p>
    <div class="related-grid">
      <a href="/cat-personality-test" class="related-card">
        <span class="related-tag">Tool</span>
        <span class="related-title">Cat Personality Test</span>
        <span class="related-hint">Free 10-question Feline Five quiz. 9 archetypes with lifestyle implications.</span>
      </a>
      <a href="/library/do-cats-hide-pain" class="related-card">
        <span class="related-tag">Pain</span>
        <span class="related-title">Do Cats Hide Pain? Reading the 5 Facial Signs</span>
        <span class="related-hint">The Feline Grimace Scale — five facial signals vets use to score pain in cats.</span>
      </a>
      <a href="/library/senior-cat-care-after-age-10" class="related-card">
        <span class="related-tag">Life-stage</span>
        <span class="related-title">Senior Cat Care After Age 10</span>
        <span class="related-hint">The 12 markers worth tracking when small drift is the first sign of disease.</span>
      </a>
      <a href="/library/cat-body-language-ears-whiskers-eyes" class="related-card">
        <span class="related-tag">Body language</span>
        <span class="related-title">Cat Body Language Meaning</span>
        <span class="related-hint">What ears, eyes, whiskers, tail, and posture each tell you.</span>
      </a>
      <a href="/library/five-pillars-happy-indoor-cat" class="related-card">
        <span class="related-tag">Welfare</span>
        <span class="related-title">The 5 Pillars of a Happy Indoor Cat</span>
        <span class="related-hint">The AAFP/ISFM welfare standard, with a 15-minute home audit.</span>
      </a>
      <a href="/library/feline-five-personality-framework" class="related-card">
        <span class="related-tag">Personality</span>
        <span class="related-title">The Feline Five — The Science of Cat Personality</span>
        <span class="related-hint">The research-validated personality framework and the 9 archetypes that emerge.</span>
      </a>
    </div>
    <p class="related-foot"><a href="/library">Browse the full CatMD Library →</a></p>
  </section>

  <div class="disclaimer">
    <strong>Editorial note:</strong> This page routes you to educational content reviewed against feline veterinary sources (Merck Veterinary Manual, AAFP, ISFM, Cornell Feline Health Center). It is not a substitute for veterinary diagnosis or treatment. In a medical emergency, contact a licensed veterinarian immediately.
  </div>
</main>

<footer class="site-foot">
  <div>
    <a href="/library">Library</a> ·
    <a href="/blog">Blog</a> ·
    <a href="/cat-personality-test">Personality Test</a> ·
    <a href="/privacy">Privacy</a> ·
    <a href="/terms">Terms</a> ·
    <a href="/disclaimer">Disclaimer</a>
  </div>
  <div style="margin-top:10px;">© ${new Date().getFullYear()} CatMD · catmd.pet</div>
</footer>
</body>
</html>`;
}
