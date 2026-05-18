import {
  ADDITIONAL_ARTICLES,
  ADDITIONAL_IMAGE_ALTS,
} from './library-additions-2026-05-09';
import {
  ADDITIONAL_ARTICLES_2026_05_16,
  ADDITIONAL_IMAGE_ALTS_2026_05_16,
} from './library-additions-2026-05-16';
import {
  ADDITIONAL_ARTICLES_2026_05_17,
  ADDITIONAL_IMAGE_ALTS_2026_05_17,
} from './library-additions-2026-05-17';
import {
  buildPlayStoreUrl,
  renderAnalyticsScripts,
  renderSearchConsoleMeta,
} from './seoAndAnalytics';

/**
 * CatMD knowledge library — catmd.pet/library
 *
 * SEO-facing long-form medical articles. Each article is:
 *   - Served at /library/{slug} as clean HTML
 *   - Indexed via /sitemap.xml
 *   - Tagged with Schema.org Article JSON-LD
 *   - Cross-linked with 2–3 related articles (internal link graph)
 *   - Branded with the same Warm Clinical chrome as legal + landing
 *
 * Article bodies are inline HTML (not markdown at runtime) — keeps the
 * worker dependency-free and the page-render single-digit-ms.
 *
 * Add a new article:
 *   1. Append an entry to ARTICLES below with slug + metadata + bodyHtml
 *   2. Update relatedSlugs on at-least-two existing articles to link back
 *   3. Deploy — sitemap auto-regenerates.
 */

export interface Article {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  readMinutes: number;
  relatedSlugs: string[];
  primaryKeyword: string;
  bodyHtml: string;
  /**
   * Optional FAQ block. When present, the renderer emits:
   *   1. FAQPage JSON-LD (eligible for rich-result FAQ snippets in SERPs)
   *   2. A visible <h2>Frequently asked questions</h2> section appended after
   *      the article body so human readers see the same content the schema
   *      describes (Google requires schema content to be visible on-page).
   */
  faqs?: Array<{ question: string; answer: string }>;
}

/**
 * Hero image config — convention-based. Every article in this library has a
 * matching WebP at `/library/{slug}.webp` (served from the public/ folder
 * via Cloudflare Static Assets). The renderer derives the URL from the slug
 * so we don't have to repeat it on every Article object.
 */
const IMAGE_BASE_PATH = '/library';
const IMAGE_EXT = '.webp';
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

/** Per-article alt text — descriptive, keyword-aware, accessibility-safe. */
const IMAGE_ALT_BY_SLUG: Record<string, string> = {
  ...ADDITIONAL_IMAGE_ALTS,
  ...ADDITIONAL_IMAGE_ALTS_2026_05_16,
  ...ADDITIONAL_IMAGE_ALTS_2026_05_17,
  'cat-vomiting-when-to-see-vet':
    'Tabby cat sitting next to a clean ceramic water bowl, looking thoughtful — illustrative hero for a guide on cat vomiting urgency',
  'cat-not-eating':
    'Untouched cat food bowl in the foreground with a small cat looking away in soft focus — hero illustration for a guide on cat anorexia',
  'cat-straining-to-urinate':
    'Cat sitting near a modern litter box, dignified but uncomfortable — hero for a guide on feline urethral obstruction urgency',
  'cat-hiding-illness':
    'Cat peeking out from under a sage-coloured sofa in a warm living room — hero illustration for a guide on cats hiding illness',
  'cat-losing-weight':
    'Long-haired cat in profile on a windowsill in golden afternoon light — hero for a guide on unexplained feline weight loss',
  'cat-lethargy':
    'Small cat curled on a folded cream wool blanket in soft afternoon light — hero illustration for a guide on cat lethargy',
  'cat-eye-discharge':
    'Tabby cat face close-up with a gentle hand offering a cotton pad — hero for a guide on cat eye discharge',
  'cat-gum-color':
    'Ginger cat in soft profile with a kind hand near the mouth — hero illustration for a guide on checking cat gum colour',
  'cat-breathing-fast-sleeping':
    'Grey cat asleep on a cushion next to a small analog stopwatch — hero illustration for a guide on tracking sleeping respiratory rate',
  'cat-litter-box-changes':
    'Stylized cross-section of a clean modern litter box with a cat looking thoughtfully nearby — hero for a guide on litter box change diagnostics',
  'cat-ate-lily-emergency':
    'Tipped ceramic vase holding an Easter lily with a fallen petal on the floor and a cat watching from a doorway — hero illustration for a lily-poisoning emergency guide',
  'cat-sneezing':
    'Small kitten in a sunbeam captured mid-sneeze — hero illustration for a guide on cat sneezing causes',
  'cat-tail-language':
    'Cat in profile with tail held high and curved at the tip in golden afternoon light — hero illustration for a guide on cat tail body language',
  'cat-body-language-ears-whiskers-eyes':
    'Close-up cat face with ears forward, whiskers fanned, soft slow-blink eyes — hero illustration for a guide on reading cat body language beyond the tail',
  'feline-five-personality-framework':
    'Three different cats arranged in distinct postures on a warm cream background — confident, observant, playful — hero illustration for the Feline Five personality framework',
  'five-pillars-happy-indoor-cat':
    'A warm modern living room seen through a cat\'s perspective — vertical perches, hidey nooks, scratching post, food and water on different walls — hero illustration for the AAFP 5 Pillars happy-indoor-cat framework',
  'senior-cat-care-after-age-10':
    'Older long-haired cat resting on a cushion next to a small water bowl and a soft heated pad — hero illustration for a senior cat care guide',
  'cat-vocalizations-decoded':
    'Cat in mid-meow with mouth slightly open, looking up at someone off-frame — hero illustration for a guide on decoding cat vocalisations',
  'multi-cat-household-harmony':
    'Two cats sharing a sun-puddle on a cream rug, one grooming the other — hero illustration for a guide on multi-cat household harmony',
  'kitten-development-windows':
    'Small tabby kitten exploring a quiet living room floor while an adult human watches gently from the side — hero illustration for a kitten development timeline guide',
};

/** Build the canonical absolute hero image URL for an article. */
function heroImageUrl(slug: string): string {
  return `${SITE_URL}${IMAGE_BASE_PATH}/${slug}${IMAGE_EXT}`;
}

const SITE_URL = 'https://catmd.pet';
const SITE_NAME = 'CatMD';
const AUTHOR_NAME = 'CatMD';

/** Article chrome — shared header, nav, footer, styling. */
function renderArticlePage(article: Article): string {
  const canonicalUrl = `${SITE_URL}/library/${article.slug}`;
  const heroUrl = heroImageUrl(article.slug);
  const heroAlt =
    IMAGE_ALT_BY_SLUG[article.slug] ?? `Hero illustration for ${article.title}`;
  const related = article.relatedSlugs
    .map((s) => ARTICLES.find((a) => a.slug === s))
    .filter((a): a is Article => !!a);

  // Multi-schema JSON-LD. MedicalWebPage is the primary Google signal for
  // YMYL health content (better E-E-A-T than a plain Article). Article +
  // BreadcrumbList are included alongside so other crawlers still understand
  // the structure.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'MedicalWebPage',
      'name': article.title,
      'headline': article.title,
      'description': article.description,
      'url': canonicalUrl,
      'datePublished': article.datePublished,
      'dateModified': article.dateModified,
      'lastReviewed': article.dateModified,
      'inLanguage': 'en',
      'about': { '@type': 'MedicalCondition', 'name': article.primaryKeyword },
      'audience': { '@type': 'MedicalAudience', 'audienceType': 'Cat owners' },
      'author': { '@type': 'Organization', 'name': AUTHOR_NAME, 'url': SITE_URL },
      'publisher': {
        '@type': 'Organization',
        'name': SITE_NAME,
        'url': SITE_URL,
        'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/favicon.svg` },
      },
      'mainEntityOfPage': { '@type': 'WebPage', '@id': canonicalUrl },
      'image': {
        '@type': 'ImageObject',
        'url': heroUrl,
        'width': IMAGE_WIDTH,
        'height': IMAGE_HEIGHT,
      },
      'keywords': article.primaryKeyword,
      'citation': [
        { '@type': 'CreativeWork', 'name': 'Merck Veterinary Manual — Feline sections', 'url': 'https://www.merckvetmanual.com/cat-owners' },
        { '@type': 'CreativeWork', 'name': 'American Association of Feline Practitioners guidelines', 'url': 'https://catvets.com/guidelines' },
        { '@type': 'CreativeWork', 'name': 'International Society of Feline Medicine', 'url': 'https://icatcare.org/advice/' },
        { '@type': 'CreativeWork', 'name': 'Cornell Feline Health Center', 'url': 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'CatMD', 'item': SITE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Library', 'item': `${SITE_URL}/library` },
        { '@type': 'ListItem', 'position': 3, 'name': article.title, 'item': canonicalUrl },
      ],
    },
  ];

  // Optional FAQPage schema — only emitted when the article carries an
  // `faqs` block. Eligible for FAQ rich results in Google SERPs (the
  // expandable Q&A blocks under the headline). Doubles snippet surface area.
  if (article.faqs && article.faqs.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': article.faqs.map((f) => ({
        '@type': 'Question',
        'name': f.question,
        'acceptedAnswer': { '@type': 'Answer', 'text': f.answer },
      })),
    } as unknown as typeof jsonLd[number]);
  }

  // Visible FAQ HTML — Google requires the FAQ content described in
  // FAQPage JSON-LD to ALSO be visible on-page. A hidden FAQ block
  // disqualifies the rich result.
  const faqHtml =
    article.faqs && article.faqs.length > 0
      ? `<h2>Frequently asked questions</h2>\n${article.faqs
          .map(
            (f) =>
              `<h3>${escapeHtml(f.question)}</h3>\n<p>${escapeHtml(f.answer)}</p>`,
          )
          .join('\n')}`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#FAF7F2" />
<title>${escapeHtml(article.title)} — CatMD</title>
<meta name="description" content="${escapeHtml(article.description)}" />
<link rel="canonical" href="${canonicalUrl}" />
${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}
<meta property="og:title" content="${escapeHtml(article.title)}" />
<meta property="og:description" content="${escapeHtml(article.description)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:image" content="${heroUrl}" />
<meta property="og:image:width" content="${IMAGE_WIDTH}" />
<meta property="og:image:height" content="${IMAGE_HEIGHT}" />
<meta property="og:image:alt" content="${escapeHtml(heroAlt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(article.title)}" />
<meta name="twitter:description" content="${escapeHtml(article.description)}" />
<meta name="twitter:image" content="${heroUrl}" />
<meta name="twitter:image:alt" content="${escapeHtml(heroAlt)}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='34' r='20' fill='%233F6456'/%3E%3Cpath d='M16 22 L20 10 L26 24 Z' fill='%233F6456'/%3E%3Cpath d='M48 22 L44 10 L38 24 Z' fill='%233F6456'/%3E%3Ccircle cx='26' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Ccircle cx='38' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600&family=Inter:wght@400;500;600;700&display=swap" />
${jsonLd
  .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
  .join('\n')}
<style>
  :root {
    --cream:#FAF7F2; --cream-2:#F4EFE5; --sage:#3F6456; --sage-dark:#25403A;
    --sage-soft:#DCE6DE; --terracotta:#C97B63; --ink:#1F2024; --ink-2:#2E2D28;
    --muted:#7A7160; --border:#E6E0D3; --surface:#FFFFFF;
    --emergency:#B8392F; --emergency-bg:#FDECE8;
    --ff-serif:'Fraunces','Iowan Old Style',Georgia,serif;
    --ff-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box;}
  html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;}
  body{margin:0;background:var(--cream);color:var(--ink);font-family:var(--ff-sans);
    font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
  a{color:var(--sage);text-underline-offset:3px;}
  a:hover{color:var(--sage-dark);}
  img,svg{display:block;max-width:100%;}

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

  .article{max-width:720px;margin:0 auto;padding:48px 24px 80px;}
  .kicker{font-size:12px;letter-spacing:0.14em;text-transform:uppercase;
    font-weight:700;color:var(--sage);margin-bottom:16px;}
  .kicker a{color:var(--sage);text-decoration:none;}
  .kicker a:hover{text-decoration:underline;}
  h1{font-family:var(--ff-serif);font-size:clamp(32px,4vw,46px);
    line-height:1.12;margin:0 0 16px;font-weight:500;letter-spacing:-0.015em;
    font-variation-settings:"opsz" 96,"wght" 500;}
  .meta{color:var(--muted);font-size:14px;display:flex;gap:14px;flex-wrap:wrap;
    margin:0 0 40px;padding-bottom:24px;border-bottom:1px solid var(--border);}
  .meta .dot{width:3px;height:3px;background:var(--muted);border-radius:50%;align-self:center;}

  .article h2{font-family:var(--ff-serif);font-size:28px;margin:44px 0 14px;
    font-weight:500;letter-spacing:-0.01em;font-variation-settings:"opsz" 48,"wght" 500;}
  .article h3{font-family:var(--ff-serif);font-size:21px;margin:32px 0 8px;
    font-weight:500;font-variation-settings:"opsz" 32,"wght" 500;}
  .article p{margin:0 0 18px;color:var(--ink-2);}
  .article ul,.article ol{margin:0 0 20px;padding-left:24px;}
  .article li{margin:6px 0;color:var(--ink-2);}
  .article strong{font-weight:600;color:var(--ink);}
  .article em{font-style:italic;}

  table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:15px;}
  th,td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border);}
  th{font-weight:600;color:var(--ink);background:var(--cream-2);font-size:13px;
    text-transform:uppercase;letter-spacing:0.04em;}

  .callout{padding:18px 22px;background:var(--surface);border:1px solid var(--border);
    border-left:4px solid var(--sage);border-radius:8px;margin:24px 0;font-size:15px;}
  .callout.warn{border-left-color:var(--emergency);background:var(--emergency-bg);color:var(--ink);}
  .callout strong{color:var(--ink);}

  .app-cta{margin:48px 0 0;padding:32px 28px;background:var(--sage-dark);
    color:var(--cream);border-radius:16px;}
  .app-cta h3{font-family:var(--ff-serif);font-size:24px;margin:0 0 8px;color:var(--cream);
    font-variation-settings:"opsz" 48,"wght" 500;}
  .app-cta p{margin:0 0 18px;color:rgba(250,247,242,0.86);font-size:15px;}
  .app-cta a{display:inline-block;padding:12px 22px;background:var(--cream);
    color:var(--sage-dark);text-decoration:none;border-radius:999px;
    font-weight:600;font-size:15px;}
  .app-cta a:hover{background:#fff;}

  .sources{margin-top:48px;padding:24px 0 0;border-top:1px solid var(--border);
    font-size:14px;color:var(--muted);}
  .sources strong{color:var(--ink);}
  .disclaimer{margin-top:20px;font-size:13px;color:var(--muted);font-style:italic;}

  .related{margin-top:48px;padding-top:32px;border-top:1px solid var(--border);}
  .related h3{font-family:var(--ff-serif);font-size:20px;margin:0 0 18px;}
  figure.hero{margin:28px 0 36px;border-radius:14px;overflow:hidden;
    background:var(--cream-2);border:1px solid var(--border);
    box-shadow:0 1px 2px rgba(31,32,36,.04);}
  figure.hero img{display:block;width:100%;height:auto;aspect-ratio:1200/630;
    object-fit:cover;}

  .related-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .related-card{padding:20px 22px;background:var(--surface);border:1px solid var(--border);
    border-radius:10px;text-decoration:none;transition:border-color .15s ease,transform .15s ease;}
  .related-card:hover{border-color:var(--sage);transform:translateY(-2px);}
  .related-card .rt{display:block;font-family:var(--ff-serif);font-size:17px;
    font-weight:500;color:var(--ink);margin-bottom:4px;line-height:1.35;}
  .related-card .rd{font-size:13px;color:var(--muted);line-height:1.5;}

  /* Prominent "Read next" footer — intercepts readers before they hit the
     conversion CTA + sources block, so library visitors do not dead-end
     after one article. Single-card design (most curated next pick) keeps
     attention focused; secondary recs live in the bottom grid. */
  .read-next{margin:40px 0 0;}
  .read-next-card{display:block;padding:28px 28px 26px;background:var(--sage-soft);
    border:1px solid var(--sage);border-radius:14px;text-decoration:none;color:inherit;
    transition:transform .18s ease,box-shadow .18s ease,background .18s ease;}
  .read-next-card:hover{transform:translateY(-2px);background:#D2E0D5;
    box-shadow:0 6px 22px -10px rgba(63,100,86,.32);}
  .read-next-card .rn-kicker{display:inline-block;font-size:12px;letter-spacing:0.14em;
    text-transform:uppercase;font-weight:700;color:var(--sage-dark);
    margin-bottom:10px;}
  .read-next-card .rn-title{font-family:var(--ff-serif);font-size:22px;line-height:1.25;
    margin:0 0 8px;font-weight:500;color:var(--ink);
    font-variation-settings:"opsz" 48,"wght" 500;}
  .read-next-card .rn-desc{font-size:15px;line-height:1.55;margin:0 0 14px;
    color:var(--ink-2);}
  .read-next-card .rn-cta{display:inline-flex;align-items:center;gap:6px;
    font-size:14px;font-weight:600;color:var(--sage-dark);}
  .read-next-card .rn-arrow{transition:transform .18s ease;}
  .read-next-card:hover .rn-arrow{transform:translateX(4px);}

  footer{border-top:1px solid var(--border);padding:32px 24px;background:var(--cream);
    font-size:13px;color:var(--muted);}
  footer .wrap{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;
    flex-wrap:wrap;gap:16px;align-items:center;}
  footer a{color:var(--muted);margin-left:20px;text-decoration:none;}
  footer a:hover{color:var(--sage);}

  @media (max-width:640px){
    .article{padding:32px 20px 60px;}
    .related-grid{grid-template-columns:1fr;}
    nav.top .links a:first-child{display:none;}
  }
</style>
</head>
<body>

<nav class="top">
  <div class="wrap">
    <a class="logo" href="/">
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
      <a href="/library">Library</a>
      <a href="/#features">Features</a>
      <a href="/#get">Get the app</a>
    </div>
  </div>
</nav>

<article class="article">
  <div class="kicker"><a href="/library">Library</a> &middot; Feline Health</div>
  <h1>${escapeHtml(article.title)}</h1>
  <div class="meta">
    <span>${article.readMinutes} min read</span>
    <span class="dot"></span>
    <span>Last updated ${formatDate(article.dateModified)}</span>
    <span class="dot"></span>
    <span>Reviewed against feline veterinary sources</span>
  </div>

  <figure class="hero">
    <img
      src="${heroUrl}"
      alt="${escapeHtml(heroAlt)}"
      width="${IMAGE_WIDTH}"
      height="${IMAGE_HEIGHT}"
      loading="eager"
      fetchpriority="high"
      decoding="async"
    />
  </figure>

  ${article.bodyHtml}

  ${faqHtml}

  ${related.length > 0 ? `
  <aside class="read-next" aria-label="Read next">
    <a class="read-next-card" href="/library/${related[0]!.slug}">
      <span class="rn-kicker">Read next &rarr;</span>
      <h3 class="rn-title">${escapeHtml(related[0]!.title)}</h3>
      <p class="rn-desc">${escapeHtml(related[0]!.description)}</p>
      <span class="rn-cta">Continue reading<span class="rn-arrow" aria-hidden="true">&rarr;</span></span>
    </a>
  </aside>` : ''}

  <div class="app-cta">
    <h3>Triage your cat in under 60 seconds</h3>
    <p>Not sure if this is an emergency? CatMD runs feline-specific triage on symptoms or photos and returns a 0–99 health score with urgency tier, differentials, and a vet-ready summary.</p>
    <a href="${buildPlayStoreUrl('library', article.slug)}">Get the app</a>
  </div>

  <div class="sources">
    <strong>Editorial note:</strong> This article is educational content, reviewed against peer-reviewed feline veterinary sources (Merck Veterinary Manual, AAFP, ISFM, Cornell Feline Health Center, ASPCA). It is not a substitute for veterinary diagnosis or treatment.
    <div class="disclaimer">In a medical emergency, contact a licensed veterinarian immediately.</div>
  </div>

  ${related.length > 1 ? `
  <div class="related">
    <h3>More related reading</h3>
    <div class="related-grid">
      ${related
        .slice(1)
        .map(
          (r) => `
      <a class="related-card" href="/library/${r.slug}">
        <span class="rt">${escapeHtml(r.title)}</span>
        <span class="rd">${escapeHtml(r.description)}</span>
      </a>`
        )
        .join('')}
    </div>
  </div>` : ''}
</article>

<footer>
  <div class="wrap">
    <div>&copy; ${new Date().getFullYear()} CatMD &middot; Informational only</div>
    <div>
      <a href="/">Home</a>
      <a href="/library">Library</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/disclaimer">Disclaimer</a>
    </div>
  </div>
</footer>

</body>
</html>`;
}

/** Library index page at /library. */
/**
 * Library hierarchy — two-level: sections → clusters → articles.
 *
 * Sections are top-level: Read your cat / Your cat's personality / The
 * good cat life / Health & triage / By life-stage. They map to the four
 * pillars of the app (Today / Triage / Bond / Chat) plus a cross-cutting
 * life-stage view. Each section communicates a *mode* of caring for a
 * cat, not just a body system — the 6-month "we're a triage app" framing
 * has been replaced by "your cat's MD" — the resident expert who knows
 * them whole.
 *
 * Each section contains one or more topic clusters; each cluster lists
 * article slugs. Slugs not assigned anywhere fall through into the
 * catch-all "More" cluster on the index page.
 *
 * Topical-authority signal: Google reads the section→cluster→article
 * hierarchy as proof we own the cat space broadly, not just symptoms.
 */
type LibraryCluster = { id: string; title: string; blurb: string; slugs: string[] };
type LibrarySection = { id: string; title: string; blurb: string; clusters: LibraryCluster[] };

const LIBRARY_SECTIONS: LibrarySection[] = [
  {
    id: 'read-your-cat',
    title: 'Read your cat',
    blurb: 'Cats can\'t talk, but they\'re saying a lot. The vocabulary of tails, ears, whiskers, eyes, and posture — and how to read what your cat is feeling without guessing.',
    clusters: [
      {
        id: 'body-language',
        title: 'Body language fundamentals',
        blurb: 'The five channels every cat owner can learn to read: tail, ears, whiskers, eyes, and posture. With a printable cheat-sheet at the end of each.',
        slugs: ['cat-tail-language', 'cat-body-language-ears-whiskers-eyes', 'cat-vocalizations-decoded', 'why-does-my-cat-meow-at-me', 'how-meow-translators-work', 'how-body-language-readers-work'],
      },
    ],
  },
  {
    id: 'personality',
    title: 'Your cat\'s personality',
    blurb: 'Cats have personalities the way humans do — five-factor, measurable, life-shaping. The science of cat archetypes and why your Maine Coon and your friend\'s Bengal are nothing alike.',
    clusters: [
      {
        id: 'personality-fundamentals',
        title: 'The Feline Five',
        blurb: 'The research-validated personality framework for cats — five traits, recognisable archetypes, practical implications for how you live with each one.',
        slugs: ['feline-five-personality-framework'],
      },
    ],
  },
  {
    id: 'good-cat-life',
    title: 'The good cat life',
    blurb: 'Enrichment, environment, routines. The architecture of a life that lets a cat be a cat — endorsed by the AAFP and ISFM, the people who write the welfare guidelines vets follow.',
    clusters: [
      {
        id: 'environment-enrichment',
        title: 'Environment & enrichment',
        blurb: 'How feline vets think about a cat-friendly home: the 5 pillars framework, multi-cat dynamics, and the small changes that turn a stressed cat into a relaxed one.',
        slugs: ['five-pillars-happy-indoor-cat', 'multi-cat-household-harmony'],
      },
    ],
  },
  {
    id: 'health-triage',
    title: 'Health & triage',
    blurb: 'When something feels off. Vet-sourced, plain-English guides to the symptoms cat parents Google at 2 a.m., grouped by body system — emergencies first.',
    clusters: [
      {
        id: 'emergencies',
        title: 'Emergencies — minutes matter',
        blurb: 'Time-critical situations where waiting until tomorrow can be the difference. Recognise these patterns fast.',
        slugs: ['cat-ate-lily-emergency', 'cat-straining-to-urinate'],
      },
      {
        id: 'digestive',
        title: 'Digestive & appetite',
        blurb: 'Vomiting, anorexia, and weight changes — the most common reasons cat owners call a vet, and the patterns that distinguish "monitor at home" from "go now."',
        slugs: ['cat-vomiting-when-to-see-vet', 'cat-not-eating', 'cat-losing-weight'],
      },
      {
        id: 'urinary',
        title: 'Urinary & litter box',
        blurb: 'The litter box is the single most underrated diagnostic tool in feline health. How to read frequency, blood, straining, and behavioural changes.',
        slugs: ['cat-litter-box-changes'],
      },
      {
        id: 'respiratory',
        title: 'Respiratory & eyes',
        blurb: 'Breathing patterns, sneezing, and eye discharge — overlapping anatomy means these symptoms cluster together. The decision tree for URI vs. something worse.',
        slugs: ['cat-breathing-fast-sleeping', 'cat-sneezing', 'cat-eye-discharge'],
      },
      {
        id: 'general-signs',
        title: 'General wellness signals',
        blurb: 'Cats are evolutionary prey animals — they mask weakness. These are the subtle full-body signals that often appear before any organ-specific sign.',
        slugs: ['cat-hiding-illness', 'cat-lethargy', 'cat-gum-color', 'do-cats-hide-pain', 'cat-not-jumping', 'cat-grooming-less'],
      },
    ],
  },
  {
    id: 'by-life-stage',
    title: 'By life-stage',
    blurb: 'Kittens are not small adult cats. Senior cats are not weakened versions of themselves. Each life-stage has its own care priorities — here\'s what changes and when.',
    clusters: [
      {
        id: 'kitten-development',
        title: 'Kitten development',
        blurb: 'The first 16 weeks shape who a cat will be for the rest of their life. The socialisation window, the milestones, and what owners can do at each stage.',
        slugs: ['kitten-development-windows'],
      },
      {
        id: 'senior-care',
        title: 'Senior cat care',
        blurb: 'Cats over 10 enter a life-stage where small drift in weight, water, and litter habits is often the first sign of treatable disease.',
        slugs: ['senior-cat-care-after-age-10'],
      },
    ],
  },
];

/** Backward-compat: flat list of all clusters across all sections. */
const LIBRARY_CLUSTERS: LibraryCluster[] = LIBRARY_SECTIONS.flatMap((s) => s.clusters);

export function renderLibraryIndex(): string {
  const canonicalUrl = `${SITE_URL}/library`;

  // Render each cluster as a <section> with heading + blurb + card grid.
  // Articles are looked up by slug; missing entries are silently skipped
  // so a typo doesn't break the page render.
  const renderCard = (a: Article) => `
    <a class="lib-card" href="/library/${a.slug}">
      <img class="lib-thumb" src="${heroImageUrl(a.slug)}" alt="" loading="lazy" decoding="async" width="400" height="210" />
      <div class="lib-body">
        <span class="lib-read">${a.readMinutes} min &middot; ${escapeHtml(a.primaryKeyword)}</span>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.description)}</p>
      </div>
    </a>`;

  // Render the section → cluster → cards hierarchy. Each section gets a
  // larger heading and intro blurb; clusters within each section get a
  // smaller heading. Empty clusters (no published articles yet) skip
  // silently — keeps stub sections from rendering empty.
  const renderCluster = (c: LibraryCluster): string => {
    const articlesInCluster = c.slugs
      .map((s) => ARTICLES.find((a) => a.slug === s))
      .filter((a): a is Article => !!a);
    if (articlesInCluster.length === 0) return '';
    return `
      <div class="cluster" id="${c.id}">
        <header class="cluster-head">
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.blurb)}</p>
        </header>
        <div class="grid">${articlesInCluster.map(renderCard).join('')}</div>
      </div>`;
  };

  const sections = LIBRARY_SECTIONS.map((s) => {
    const renderedClusters = s.clusters.map(renderCluster).filter(Boolean).join('');
    if (!renderedClusters) return '';
    return `
    <section class="lib-section" id="${s.id}">
      <header class="section-head">
        <h2>${escapeHtml(s.title)}</h2>
        <p>${escapeHtml(s.blurb)}</p>
      </header>
      ${renderedClusters}
    </section>`;
  }).join('');

  // Defensive: surface any article not assigned to a cluster — keeps the
  // hub honest as the library grows.
  const allClusteredSlugs = new Set(
    LIBRARY_SECTIONS.flatMap((s) => s.clusters.flatMap((c) => c.slugs)),
  );
  const orphans = ARTICLES.filter((a) => !allClusteredSlugs.has(a.slug));
  const orphanSection = orphans.length > 0 ? `
    <section class="lib-section" id="more">
      <header class="section-head">
        <h2>More</h2>
        <p>Recently published or yet to be slotted into a section.</p>
      </header>
      <div class="cluster">
        <div class="grid">${orphans.map(renderCard).join('')}</div>
      </div>
    </section>` : '';

  // CollectionPage JSON-LD: tells Google this is a structured library, not
  // a sea of unrelated pages. Helps with topical-authority interpretation
  // across the *whole* cat-care space — body language, personality,
  // lifestyle, life-stage, and medical — not just symptom triage.
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'CatMD Library',
    'description': 'Vet-sourced guides for understanding and caring for your cat — body language, personality, lifestyle, life-stage, and health.',
    'url': canonicalUrl,
    'inLanguage': 'en',
    'isPartOf': { '@id': `${SITE_URL}/#site` },
    'hasPart': ARTICLES.map((a) => ({
      '@type': 'MedicalWebPage',
      'name': a.title,
      'url': `${SITE_URL}/library/${a.slug}`,
      'about': { '@type': 'MedicalCondition', 'name': a.primaryKeyword },
    })),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>The CatMD Library — Read your cat. Decode their personality. Live well together.</title>
<meta name="description" content="Vet-sourced guides for cat parents. Body language, personality, the good cat life, health & triage, and life-stage care — all in plain English, all backed by Merck, Cornell, AAFP, ISFM, and the Litchfield Feline Five." />
<link rel="canonical" href="${canonicalUrl}" />
${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}
<meta property="og:title" content="The CatMD Library — your cat's MD" />
<meta property="og:description" content="The complete cat library: body language, personality, lifestyle, health, and life-stage care. Vet-sourced, plain English, no fluff." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonicalUrl}" />
<script type="application/ld+json">${JSON.stringify(collectionLd)}</script>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='34' r='20' fill='%233F6456'/%3E%3Cpath d='M16 22 L20 10 L26 24 Z' fill='%233F6456'/%3E%3Cpath d='M48 22 L44 10 L38 24 Z' fill='%233F6456'/%3E%3Ccircle cx='26' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Ccircle cx='38' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600;700&display=swap" />
<style>
  :root{--cream:#FAF7F2;--cream-2:#F4EFE5;--sage:#3F6456;--sage-dark:#25403A;
    --ink:#1F2024;--ink-2:#2E2D28;--muted:#7A7160;--border:#E6E0D3;--surface:#FFFFFF;
    --ff-serif:'Fraunces',Georgia,serif;--ff-sans:'Inter',system-ui,sans-serif;}
  *{box-sizing:border-box;}body{margin:0;background:var(--cream);color:var(--ink);
    font-family:var(--ff-sans);line-height:1.6;-webkit-font-smoothing:antialiased;}
  a{color:var(--sage);text-decoration:none;}
  nav.top{position:sticky;top:0;z-index:50;background:rgba(250,247,242,0.88);
    backdrop-filter:saturate(140%) blur(12px);border-bottom:1px solid rgba(230,224,211,0.6);}
  nav.top .wrap{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;
    justify-content:space-between;align-items:center;}
  nav.top .logo{display:flex;align-items:center;gap:10px;font-family:var(--ff-serif);
    font-weight:500;font-size:19px;color:var(--ink);}
  nav.top .logo svg{width:26px;height:26px;}
  nav.top .links a{margin-left:24px;font-size:14px;color:var(--ink-2);font-weight:500;}
  .hero{max-width:1100px;margin:0 auto;padding:64px 24px 32px;}
  .kicker{font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;
    color:var(--sage);margin-bottom:14px;}
  h1{font-family:var(--ff-serif);font-size:clamp(36px,4.5vw,54px);line-height:1.08;
    margin:0 0 18px;font-weight:500;letter-spacing:-0.015em;
    font-variation-settings:"opsz" 96,"wght" 500;}
  h1 em{font-style:italic;color:var(--sage);
    font-variation-settings:"opsz" 96,"wght" 400;}
  .lede{font-size:18px;color:var(--ink-2);max-width:640px;margin:0 0 40px;}

  /* Top-level section — Read your cat / Personality / Good cat life / etc.
     Each section can hold one or more topic clusters. */
  .lib-section{max-width:1100px;margin:0 auto;padding:8px 24px 64px;}
  .section-head{margin:0 0 28px;border-top:1px solid var(--border);padding-top:48px;}
  .lib-section:first-of-type .section-head{border-top:none;padding-top:0;}
  .section-head h2{font-family:var(--ff-serif);font-size:clamp(30px,3.6vw,42px);
    margin:0 0 12px;font-weight:500;color:var(--ink);letter-spacing:-0.012em;
    font-variation-settings:"opsz" 96,"wght" 500;}
  .section-head h2 em{font-style:italic;color:var(--sage);
    font-variation-settings:"opsz" 96,"wght" 400;}
  .section-head p{margin:0;color:var(--muted);font-size:16px;max-width:720px;line-height:1.6;}

  /* Topic-cluster within a section. Smaller heading, tighter rhythm. */
  .cluster{margin:0 0 36px;}
  .cluster:last-child{margin-bottom:0;}
  .cluster-head{margin:0 0 8px;}
  .cluster-head h3{font-family:var(--ff-serif);font-size:clamp(20px,2.2vw,24px);
    margin:0 0 4px;font-weight:500;color:var(--ink);letter-spacing:-0.005em;
    font-variation-settings:"opsz" 40,"wght" 500;}
  .cluster-head p{margin:0;color:var(--muted);font-size:14.5px;max-width:680px;line-height:1.55;}

  /* Card grid — now nested inside each cluster. */
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:24px;}
  .lib-card{display:flex;flex-direction:column;background:var(--surface);
    border:1px solid var(--border);border-radius:14px;overflow:hidden;
    transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease;}
  .lib-card:hover{border-color:var(--sage);transform:translateY(-3px);
    box-shadow:0 8px 24px -12px rgba(37,64,58,0.18);}
  .lib-thumb{display:block;width:100%;height:auto;aspect-ratio:1200/630;
    object-fit:cover;background:var(--cream-2);border-bottom:1px solid var(--border);}
  .lib-body{padding:22px 24px 24px;}
  .lib-read{font-size:12px;color:var(--muted);letter-spacing:0.04em;text-transform:uppercase;font-weight:600;}
  .lib-card h3{font-family:var(--ff-serif);font-size:21px;margin:8px 0 8px;
    font-weight:500;line-height:1.28;color:var(--ink);
    font-variation-settings:"opsz" 40,"wght" 500;}
  .lib-card p{margin:0;font-size:14.5px;color:var(--ink-2);line-height:1.55;}
  footer{border-top:1px solid var(--border);padding:32px 24px;background:var(--cream);
    font-size:13px;color:var(--muted);}
  footer .wrap{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;
    flex-wrap:wrap;gap:16px;}
  footer a{color:var(--muted);margin-left:20px;}
  @media (max-width:720px){.grid{grid-template-columns:1fr;}}
</style>
</head>
<body>
<nav class="top">
  <div class="wrap">
    <a class="logo" href="/">
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
    <div class="links"><a href="/#features">Features</a><a href="/#get">Get the app</a></div>
  </div>
</nav>
<section class="hero">
  <div class="kicker">The CatMD Library</div>
  <h1>Your cat's MD,<br/><em>in long form.</em></h1>
  <p class="lede">Read your cat's body language. Decode their personality. Live well with them, day-to-day. And catch the medical things that hide in plain sight. Five sections, one library — all vet-sourced, all in plain English.</p>
</section>
${sections}
${orphanSection}
<footer>
  <div class="wrap">
    <div>&copy; ${new Date().getFullYear()} CatMD</div>
    <div><a href="/">Home</a><a href="/library">Library</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
  </div>
</footer>
</body>
</html>`;
}

/** Look up an article by slug and render its page. Returns null if not found. */
export function renderArticleBySlug(slug: string): string | null {
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return null;
  return renderArticlePage(article);
}

/** Return all article slugs — used by sitemap generator in worker.ts. */
export function getArticleSlugs(): { slug: string; lastmod: string }[] {
  return ARTICLES.map((a) => ({ slug: a.slug, lastmod: a.dateModified }));
}

// ── helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── articles ────────────────────────────────────────────────────────────────
// Ordered by publication priority. Cross-linked via relatedSlugs.

const ARTICLES: Article[] = [
  {
    slug: 'cat-vomiting-when-to-see-vet',
    title: 'Cat Vomiting: When to See a Vet vs. Monitor at Home',
    description: "Cat vomited once, twice, or many times today? A clear, cat-specific guide to which vomiting is an emergency, which can wait, and what to tell your vet.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 5,
    primaryKeyword: 'cat vomiting',
    relatedSlugs: ['cat-not-eating', 'cat-ate-lily-emergency', 'cat-straining-to-urinate'],
    faqs: [
      {
        question: 'When should I take my cat to the vet for vomiting?',
        answer: "Go to an emergency vet immediately if your cat vomits blood, can't keep water down for 12+ hours, vomits alongside lethargy and not eating, has a suspected toxin ingestion, or is a male cat straining to urinate. Vet within 24 hours: 3+ vomiting episodes in a day, vomiting with foreign material, or any kitten or senior cat vomiting even once.",
      },
      {
        question: 'How many times can a cat vomit before it is an emergency?',
        answer: 'Three or more vomiting episodes within 24 hours warrants a same-day vet visit. A single isolated vomit in an otherwise normal, eating, drinking cat can be monitored, but multi-episode vomiting — especially with reduced appetite, hiding, or lethargy — should not wait.',
      },
      {
        question: 'Is it normal for cats to vomit hairballs?',
        answer: 'An occasional hairball (1–2 per month) in a long-haired cat with otherwise normal behavior is normal. A sudden increase in hairball frequency, repeated retching without producing anything, vomiting bile after every meal, or hairballs in a short-haired cat are not normal hairball patterns and warrant a vet call.',
      },
      {
        question: 'What are red flags for cat vomiting?',
        answer: 'Fresh blood or coffee-ground material in vomit, inability to keep water down for 12+ hours, hard or distended abdomen, pale or yellow gums, breathing difficulty, suspected toxin ingestion, string hanging from the mouth or anus, a male cat straining to urinate, or a cat that has not eaten in 24+ hours all warrant emergency veterinary care.',
      },
    ],
    bodyHtml: `
<p>Cats vomit more than most owners realize — but not every episode is harmless, and "she always throws up hairballs" is sometimes the story of a missed serious condition. This guide walks through what kind of vomiting needs a vet, what can wait, and what to document before you call.</p>

<h2>The quick decision chart</h2>
<table>
<thead><tr><th>What you're seeing</th><th>Urgency</th></tr></thead>
<tbody>
<tr><td>Vomiting blood (fresh red or coffee-ground brown)</td><td><strong>Emergency vet now</strong></td></tr>
<tr><td>Continuous vomiting, can't keep water down &gt; 12 hours</td><td><strong>Emergency vet now</strong></td></tr>
<tr><td>Vomiting + lethargy + hiding + not eating</td><td><strong>Emergency vet now</strong></td></tr>
<tr><td>Suspected toxin ingestion (lily, antifreeze, human medication, string)</td><td><strong>Emergency vet now</strong></td></tr>
<tr><td>Vomiting + straining to urinate (especially male cats)</td><td><strong>Emergency vet now</strong></td></tr>
<tr><td>Vomiting 3+ times in 24 hours</td><td><strong>Vet within 24 hours</strong></td></tr>
<tr><td>Vomiting with foreign material (string, thread, plant matter)</td><td><strong>Vet within 24 hours</strong></td></tr>
<tr><td>Kitten or senior cat vomiting even once</td><td><strong>Vet within 24 hours</strong></td></tr>
<tr><td>One vomit, cat otherwise normal, eating and drinking</td><td>Monitor at home</td></tr>
<tr><td>Occasional hairball, lifelong pattern, otherwise well</td><td>Monitor at home</td></tr>
</tbody></table>

<h2>Why vomiting matters more for cats than dogs</h2>
<p>Cats are small. They dehydrate fast. A 4 kg cat loses meaningful body water after 2–3 substantial vomiting episodes — fast enough that an otherwise-mild illness can spiral in under 24 hours. "Wait and see" advice that's fine for a dog can be dangerous for a cat.</p>

<p>Cats also have <strong>two vomiting patterns that are specifically urgent</strong>:</p>
<ul>
<li><strong>Vomiting with straining to urinate in male cats</strong> can mean <a href="/library/cat-straining-to-urinate">urethral obstruction</a> — which kills in under 48 hours via hyperkalemia. The vomiting isn't from food; it's a metabolic consequence.</li>
<li><strong>Vomiting + hiding + weight loss in older cats</strong> is the classic presentation of hyperthyroidism, CKD, or pancreatitis — three leading causes of feline morbidity. None get better on their own.</li>
</ul>

<h2>The three-type model (how vets categorize vomiting)</h2>
<h3>1. Acute vomiting (started today or yesterday)</h3>
<p>Often a dietary issue, a hairball, or a mild stomach upset. If the cat is bright-eyed, eating, drinking, and the vomiting has stopped within 24 hours, you can monitor.</p>
<h3>2. Frequent vomiting (2–4 times per month, chronic)</h3>
<p>This is where "she's just a pukey cat" often hides a real diagnosis. Common culprits: <strong>inflammatory bowel disease, food sensitivities, chronic pancreatitis, or intestinal lymphoma.</strong> All treatable — but only if diagnosed. Regular vomiting is worth a vet visit even without a single dramatic episode.</p>
<h3>3. Progressive vomiting (increasing over days/weeks)</h3>
<p>Always a vet visit. This pattern points to something progressing — kidney failure, an intestinal obstruction, or cancer.</p>

<h2>What to document before you call the vet</h2>
<ul>
<li><strong>When:</strong> date and time of each episode (last 48 hours)</li>
<li><strong>What:</strong> food, bile (yellow), blood (red or coffee-ground), hairball, foreign material</li>
<li><strong>Appetite:</strong> eating normally / reduced / not eating</li>
<li><strong>Water intake:</strong> drinking normally / more than usual / not drinking</li>
<li><strong>Activity:</strong> normal / hiding / lethargic</li>
<li><strong>Litter box:</strong> urinating normally / straining / not urinating</li>
<li><strong>Weight:</strong> gained, same, lost in last month</li>
<li><strong>Anything new:</strong> food, medication, plants, access to string/ribbon/tinsel</li>
</ul>

<div class="callout warn">
<strong>Red flags that turn any vomit into an emergency.</strong> Any one of these means emergency vet, now — regardless of how many episodes:
<ul style="margin-top:8px;">
<li>Fresh blood or coffee-ground material in vomit</li>
<li>Can't keep water down for more than 12 hours</li>
<li>Abdomen hard, distended, or painful</li>
<li>Pale or yellow gums (press gum — should pink back in &lt; 2 seconds)</li>
<li>Breathing fast or with effort</li>
<li>Suspected ingestion of a <a href="/library/cat-ate-lily-emergency">toxic plant</a>, chemical, or medication</li>
<li>String / thread / ribbon / tinsel hanging from mouth or anus — <strong>do not pull</strong></li>
<li>Male cat straining to urinate with no output</li>
<li>Cat has <a href="/library/cat-not-eating">not eaten in 24+ hours</a> (hepatic lipidosis risk)</li>
</ul>
</div>

<h2>When "just a hairball" is and isn't</h2>
<p><strong>Actual hairball:</strong> cat retches, wet sound, produces a tube-shaped mass of matted hair plus a bit of food. Happens 1–2× a month in long-haired cats. Cat is normal afterward.</p>
<p><strong>Not a hairball:</strong> repeated retching without producing anything, vomiting food after every meal, vomiting bile (yellow liquid without hair), or hairballs suddenly more frequent than baseline. All of these warrant a vet call.</p>
`,
  },
  {
    slug: 'cat-not-eating',
    title: 'Cat Not Eating: Causes, Timeline, and Red Flags',
    description: "Your cat hasn't eaten for 24 hours — or three days. What it means, when it's dangerous, and what to do before the vet visit.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 6,
    primaryKeyword: 'cat not eating',
    relatedSlugs: ['cat-vomiting-when-to-see-vet', 'cat-losing-weight', 'cat-hiding-illness'],
    faqs: [
      {
        question: 'How long can a cat go without eating?',
        answer: '0–12 hours of fasting is acceptable in healthy adult cats. Beyond 24 hours, the risk of hepatic lipidosis (fatty liver disease) starts rising. Beyond 48–72 hours the risk is significant. Beyond 72 hours, anorexia is a medical emergency. Overweight cats and kittens hit the danger window faster than lean adults.',
      },
      {
        question: 'Why is my cat not eating?',
        answer: "The most common causes, ordered by frequency, are: dental pain, environmental stress, upper respiratory infection (cats can't taste food when congested), gastrointestinal disease, kidney disease in seniors, hyperthyroidism, liver disease, urethral obstruction in males, foreign body obstruction, and cancer. Anorexia paired with vomiting, hiding, or weight loss almost always has a medical cause.",
      },
      {
        question: 'What is hepatic lipidosis in cats?',
        answer: "Hepatic lipidosis is a potentially fatal liver disease that develops when a cat stops eating. The body mobilizes fat for energy, but cats' livers can't process fat efficiently — fat accumulates in liver cells and causes liver failure. It's the most common feline liver disease, and the trigger is almost always 'cat stopped eating for another reason.' Preventable with early intervention; fatal without.",
      },
      {
        question: 'How can I get my cat to start eating again?',
        answer: 'Try warming wet food (smell drives appetite), offering plain boiled chicken (no salt or oil), making sure the cat is warm (chilled cats stop eating), and reducing household stress. If the cat hasn\'t eaten for 24 hours despite these efforts, see a vet — appetite stimulants like mirtazapine and treatment of the underlying cause are often needed.',
      },
    ],
    bodyHtml: `
<p>A cat that stops eating is not just being picky. Unlike dogs, cats develop a specific and dangerous complication called <strong>hepatic lipidosis</strong> (fatty liver disease) when they don't eat — sometimes in as little as 48–72 hours. This is why "he'll eat when he's hungry enough" is dangerous advice for cats.</p>

<h2>The timeline that matters</h2>
<table>
<thead><tr><th>Duration without eating</th><th>What's happening</th><th>What to do</th></tr></thead>
<tbody>
<tr><td><strong>0–12 hours</strong></td><td>Could be normal (stress, mild GI upset, finicky)</td><td>Monitor; offer favorite food</td></tr>
<tr><td><strong>12–24 hours</strong></td><td>Starting to matter, especially if also vomiting</td><td>Vet call/message recommended</td></tr>
<tr><td><strong>24–48 hours</strong></td><td>Risk of hepatic lipidosis starts to rise</td><td><strong>Vet visit within 24h</strong></td></tr>
<tr><td><strong>48–72 hours</strong></td><td>Hepatic lipidosis risk real and rising</td><td><strong>Urgent vet visit</strong></td></tr>
<tr><td><strong>72+ hours</strong></td><td>Medical emergency</td><td><strong>Emergency vet</strong></td></tr>
</tbody></table>
<p><strong>Overweight cats are at highest risk.</strong> A fat cat that stops eating is a medical emergency faster than a lean one.</p>

<h2>Why cats can't "just skip meals" the way dogs can</h2>
<p>When a cat stops eating, their body starts mobilizing body fat for energy. But cats' livers can't process fat efficiently — fat accumulates inside liver cells, causing hepatic lipidosis. Once this starts, the cat feels even worse, eats less, more fat mobilizes, and you have a spiral that ends in liver failure.</p>
<p>Hepatic lipidosis is <strong>the most common liver disease in cats</strong>, and its trigger is almost always "cat stopped eating for another reason and it snowballed." It's preventable with early intervention. It's fatal without.</p>

<h2>The common causes (ordered by frequency)</h2>
<h3>1. Dental pain</h3>
<p>Resorptive lesions, gingivitis, fractured teeth. Cats hide dental pain extremely well; often the first visible sign is they stop eating dry food or drop pieces from their mouth.</p>
<h3>2. Stress or environmental change</h3>
<p>New person, new pet, moved house, new furniture, litter box moved, dog staying over. Give it 24 hours, then call the vet if not improving.</p>
<h3>3. Upper respiratory infection (URI)</h3>
<p>Cats who can't smell don't eat (<a href="/library/cat-sneezing">cat sneezing differential</a>). A congested cat loses appetite within a day. Look for sneezing, nasal discharge, squinting eyes.</p>
<h3>4. Gastrointestinal disease</h3>
<p>Nausea from IBD, chronic pancreatitis, or food intolerance. Often paired with vomiting or diarrhea.</p>
<h3>5. Kidney disease (especially senior cats)</h3>
<p>CKD causes nausea that worsens in the afternoon/evening. A senior cat who eats breakfast but refuses dinner fits this pattern.</p>
<h3>6. Hyperthyroidism (atypical)</h3>
<p>Classic hyperthyroidism causes <em>increased</em> appetite, but end-stage or atypical thyroid disease can flip to anorexia.</p>
<h3>7. Liver disease</h3>
<p>Including the hepatic lipidosis that anorexia itself causes. Yellow gums, vomiting, weight loss over weeks.</p>
<h3>8. Urethral obstruction (male cats)</h3>
<p>A blocked cat stops eating because of systemic metabolic effects. Look for <a href="/library/cat-straining-to-urinate">straining in the litter box with no urine output</a>. <strong>Emergency.</strong></p>
<h3>9. Foreign body obstruction</h3>
<p>Swallowed string, thread, ribbon, hair tie, small toy. Vomiting with anorexia.</p>
<h3>10. Cancer</h3>
<p>Lymphoma, intestinal, oral. Less common but on the list for any cat with weeks of progressive appetite decline.</p>

<div class="callout warn">
<strong>Red flags — emergency now.</strong> Any of these and go to a vet immediately:
<ul style="margin-top:8px;">
<li>Cat hasn't eaten for 72+ hours</li>
<li>Overweight cat who hasn't eaten for 48+ hours</li>
<li>Appetite loss + yellow gums or yellow skin (jaundice)</li>
<li>Appetite loss + vomiting + hiding</li>
<li>Appetite loss + straining to urinate (males especially)</li>
<li>Appetite loss + fast or labored breathing</li>
<li>Appetite loss + collapse or unresponsiveness</li>
<li>Visible string or thread hanging from mouth, or known ingestion of a <a href="/library/cat-ate-lily-emergency">toxic plant such as a lily</a> — <strong>do not wait for symptoms</strong></li>
</ul>
</div>

<h2>Things to try at home (first 12–24 hours only)</h2>
<ul>
<li>Warm the food to body temperature (releases smell)</li>
<li>Offer a <strong>strongly-scented</strong> favorite — tuna juice, tiny piece of cooked chicken, kitten food</li>
<li>Move the dish away from water or litter (cats dislike contamination)</li>
<li>Try a different bowl (shallow, wide — not deep)</li>
<li>Offer in a quiet, low-traffic area</li>
<li>Let them eat from your hand if they'll take it</li>
</ul>
<p>If none of this works within 24 hours, stop trying and call the vet.</p>

<h2>What to document for the vet</h2>
<ul>
<li>How long off food (exact last meal date/time)</li>
<li>Any vomiting, diarrhea, constipation</li>
<li>Water intake — increased, decreased, normal</li>
<li>Urination frequency and effort</li>
<li>Weight change in last 1–3 months</li>
<li>Any new foods, medications, supplements</li>
<li>Access to plants, human food, trash, strings</li>
<li>Recent stress events</li>
</ul>
`,
  },
  {
    slug: 'cat-straining-to-urinate',
    title: 'Cat Straining in the Litter Box: The 48-Hour Emergency Most Owners Miss',
    description: 'A male cat straining in the litter box with no output is a life-threatening emergency. Here\'s why, what to do, and how to tell it apart from constipation.',
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 6,
    primaryKeyword: 'cat urethral obstruction',
    relatedSlugs: ['cat-litter-box-changes', 'cat-vomiting-when-to-see-vet', 'cat-hiding-illness'],
    bodyHtml: `
<div class="callout warn">
<strong>If your male cat is going in and out of the litter box, straining, and producing little to no urine, stop reading and call an emergency vet right now.</strong> Urethral obstruction kills male cats in under 48 hours.
</div>

<p>This is one of the most time-sensitive emergencies in small-animal medicine, and almost every cat parent misses it at first because the behavior looks like "constipation" or "maybe a UTI."</p>

<h2>What you're actually seeing</h2>
<p>A cat with a urethral blockage will typically:</p>
<ul>
<li>Make repeated trips to the litter box (sometimes every few minutes)</li>
<li>Squat and strain, often vocalizing</li>
<li>Produce little or no urine, or a few pink-tinged drops</li>
<li>Have a hard, tender abdomen (don't press firmly — you can rupture the bladder)</li>
<li>Become <a href="/library/cat-lethargy">lethargic</a>, hide, or <a href="/library/cat-not-eating">refuse food</a> as the hours pass</li>
<li><a href="/library/cat-vomiting-when-to-see-vet">Vomit</a> as kidney values rise (late sign — do not wait for this)</li>
<li>Progress to collapse within 24–48 hours</li>
</ul>
<p>Female cats can also get partial obstructions, but anatomic differences make full blockage much less common.</p>

<h2>Why 48 hours is the window</h2>
<p>Urine is how the body eliminates potassium. When the bladder can't empty, potassium rises in the blood — <strong>hyperkalemia</strong>. At levels above 8–9 mEq/L, the heart starts to slow and eventually stops. This happens in roughly 24–48 hours from complete obstruction.</p>
<p>The math is brutal:</p>
<ul>
<li>Hours 0–12: cat looks uncomfortable but alive</li>
<li>Hours 12–24: lethargy, vomiting, refusing food</li>
<li>Hours 24–48: life-threatening metabolic crisis</li>
<li>Beyond 48: cardiac arrest</li>
</ul>
<p>The cat does not get better on their own. They will die.</p>

<h2>How to tell obstruction from constipation</h2>
<table>
<thead><tr><th>Sign</th><th>Obstruction</th><th>Constipation</th></tr></thead>
<tbody>
<tr><td>Straining location</td><td>Urinating</td><td>Defecating</td></tr>
<tr><td>Output</td><td>Little/no urine, maybe pink</td><td>Hard stool eventually, or none</td></tr>
<tr><td>Frequency</td><td>Many short trips</td><td>Fewer, longer efforts</td></tr>
<tr><td>Abdominal feel</td><td>Hard, very tender</td><td>Lumpy but not firm</td></tr>
<tr><td>Progression</td><td>Rapid decline</td><td>Slower</td></tr>
<tr><td>Breed/sex</td><td>Much more common in males</td><td>Any cat, more in seniors</td></tr>
</tbody></table>
<p><strong>If you're not sure, treat it as obstruction.</strong> Missing a constipation diagnosis costs you a few extra hours at the vet; missing obstruction costs you your cat.</p>

<h2>What causes urethral obstruction</h2>
<ul>
<li><strong>FLUTD</strong> — inflammation creating a plug of mucus, crystals, and cellular debris</li>
<li><strong>Crystalluria</strong> — calcium oxalate or struvite crystals</li>
<li><strong>Bladder stones</strong> that migrate into the urethra</li>
<li><strong>Urethral spasm</strong> secondary to feline idiopathic cystitis (FIC)</li>
</ul>
<p>Male cats are far more vulnerable because their urethra narrows dramatically at the tip of the penis.</p>

<h2>Risk factors</h2>
<p>Your cat is at elevated risk if they:</p>
<ul>
<li>Are male (especially neutered)</li>
<li>Are overweight</li>
<li>Eat a primarily dry-food diet (low water intake)</li>
<li>Are indoor-only and sedentary</li>
<li>Live in a multi-cat household (stress triggers FIC)</li>
<li>Have had a prior obstruction (recurrence is common)</li>
<li>Are 2–7 years old (peak incidence age)</li>
</ul>

<h2>What to do, right now</h2>
<ol>
<li><strong>Call an emergency vet.</strong> Not a regular vet. You need someone who can sedate and catheterize tonight.</li>
<li><strong>Drive, don't wait.</strong> Every hour increases the risk.</li>
<li><strong>Do not give any medication.</strong> Not human painkillers, not leftover antibiotics. These can be fatal.</li>
<li><strong>Do not press the abdomen firmly.</strong> A full bladder can rupture.</li>
<li><strong>Bring a history.</strong> When the cat last urinated normally, diet, any recent stress event.</li>
</ol>

<h2>After the crisis — preventing a recurrence</h2>
<ul>
<li><strong>Switch to a wet-food or mixed diet</strong> (water content is protective)</li>
<li>Prescription urinary diet if recommended (Royal Canin Urinary SO, Hill's c/d, Purina UR)</li>
<li>Reduce stress — add cat trees, multiple litter boxes, Feliway diffusers</li>
<li>Weight management if overweight</li>
<li>Watch for early signs every time — small changes in litter habits matter</li>
</ul>
`,
  },
  {
    slug: 'cat-hiding-illness',
    title: 'Cat Hiding: Normal Behavior or Early Warning of Illness?',
    description: "Cats hide when they're stressed — but also when they're sick. How to tell the difference, and when hiding becomes a vet visit.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 4,
    primaryKeyword: 'cat hiding',
    relatedSlugs: ['do-cats-hide-pain', 'cat-grooming-less', 'cat-not-eating', 'cat-lethargy', 'cat-body-language-ears-whiskers-eyes'],
    bodyHtml: `
<p>A cat hiding under the bed for a few hours is normal. A cat hiding for a day is a question. A cat hiding for two days is a problem.</p>
<p>The difficulty is that cats use the same behavior — withdrawing from visibility — to signal "I want to be alone right now" <em>and</em> "I'm in pain but I don't want you to know." Generic "wait and see" advice doesn't work because by the time a cat's hiding is obvious enough to alarm you, they may have been sick for days.</p>

<h2>The two-question filter</h2>
<h3>1. Has anything about the environment changed?</h3>
<ul>
<li>New person, pet, or baby in the house</li>
<li>Furniture moved or rearranged</li>
<li>Loud event (thunder, fireworks, construction)</li>
<li>Recent vet visit, grooming, or medication</li>
<li>Loud household argument</li>
<li>Move, travel, routine change</li>
</ul>
<p>If yes, stress hiding is plausible. Give it 24–48 hours with quiet + enrichment.</p>
<h3>2. Is the hiding combined with any physical changes?</h3>
<ul>
<li><a href="/library/cat-not-eating">Eating less or not at all</a></li>
<li>Drinking more or less</li>
<li><a href="/library/cat-litter-box-changes">Not using the litter box normally</a></li>
<li>Flinching when touched</li>
<li>Unusual postures (hunched, head low, tucked paws)</li>
<li>Vocalizing when handled</li>
<li>Visible signs: limping, discharge, cloudy eyes, bad breath, dull coat</li>
</ul>
<p>If any of these are also present, <strong>it's more than stress.</strong> Call the vet within 24 hours.</p>

<h2>The "just been quiet" problem</h2>
<p>The single most dangerous sentence in feline medicine is "she's just been a bit quiet." Cats are evolutionary prey animals. Their survival strategy is to mask weakness. A cat visibly sick in public has likely been concealing illness for days.</p>
<p>Many serious feline conditions present initially as only hiding + mild appetite reduction:</p>
<ul>
<li><a href="/library/cat-straining-to-urinate">Urethral obstruction (males)</a> — subtle straining, hiding</li>
<li>Feline idiopathic cystitis (FIC)</li>
<li>Early hepatic lipidosis</li>
<li>Hyperthyroidism decompensation</li>
<li>CKD flare</li>
<li>Abscess (cats fight, you miss the wound, it abscesses)</li>
<li>Bladder stones or UTI</li>
<li>Dental pain</li>
<li>Broken tooth or oral tumor</li>
<li>Constipation / megacolon</li>
<li>Pancreatitis</li>
</ul>

<h2>The safe rule of thumb</h2>
<ul>
<li><strong>Hiding under 12 hours + no other symptoms:</strong> probably fine, monitor</li>
<li><strong>Hiding 12–24 hours + no other symptoms:</strong> offer favorite food, note behavior, call if not resolved by 24 hours</li>
<li><strong>Hiding 24+ hours:</strong> vet call/visit</li>
<li><strong>Hiding + any physical symptom:</strong> vet visit, same day</li>
</ul>

<h2>Recognizing pain-related hiding</h2>
<p>Cats in pain hide in <em>specific</em> places:</p>
<ul>
<li>Under the bed</li>
<li>In closets</li>
<li>Behind the couch</li>
<li>Inside cupboards</li>
<li>In a small enclosed space, often away from their normal favorites</li>
</ul>
<p>They often also:</p>
<ul>
<li>Hunch with paws tucked under</li>
<li>Avoid eye contact</li>
<li>Flinch or growl when touched near the painful area</li>
<li>Have ears slightly back, eyes partially closed</li>
<li>Purr even when not happy (self-soothing)</li>
</ul>
<p>The <strong>Feline Grimace Scale</strong> (U. Montreal, 2019) is a validated pain-scoring framework looking at ears, eyes, muzzle, whiskers, and head position.</p>

<div class="callout warn">
<strong>Red flags that mean "vet now":</strong>
<ul style="margin-top:8px;">
<li>Hiding + not eating &gt; 24 hours</li>
<li>Hiding + vomiting</li>
<li>Hiding + straining to urinate</li>
<li>Hiding + labored breathing</li>
<li>Hiding + pale or blue gums</li>
<li>Hiding + limping</li>
<li>Hiding + visible injury or wound</li>
<li>Hiding + disorientation, imbalance, head tilt</li>
<li>Hiding + any change in a senior cat (10+ years)</li>
</ul>
</div>
`,
  },
  {
    slug: 'cat-losing-weight',
    title: 'Cat Losing Weight: CKD, Hyperthyroidism, and the Three Differentials You Need to Know',
    description: 'A cat losing weight — even with a normal appetite — is almost never healthy. How to tell CKD from hyperthyroidism from diabetes, and which labs to ask for.',
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 7,
    primaryKeyword: 'cat weight loss',
    relatedSlugs: ['cat-not-eating', 'senior-cat-care-after-age-10', 'cat-litter-box-changes'],
    bodyHtml: `
<p>If your senior cat is losing weight — even slowly, even while eating well — please read this. Unintentional weight loss is one of the earliest and most important signs of serious disease, and the three biggest causes are all eminently treatable <em>if</em> caught early.</p>

<h2>The rule of thumb</h2>
<p><strong>A cat losing more than 5% of body weight in a month needs a vet visit.</strong> For a 4 kg (9 lb) cat, that's just 200 g. Easy to miss at home; your vet will catch it on the scale.</p>
<p><strong>Any cat over 10 years old who is losing weight needs a vet visit regardless of appetite.</strong> Senior cats do not "just get skinny." They develop diseases.</p>

<h2>The three big differentials</h2>
<h3>1. Hyperthyroidism</h3>
<p><strong>Classic presentation:</strong> older cat (10+), losing weight <em>despite an increased appetite</em>, often vocal/restless, sometimes vomiting or drinking more. May have patchy coat.</p>
<p><strong>What it is:</strong> a benign tumor on the thyroid gland over-produces thyroid hormone. The cat's metabolism runs too hot. They burn weight even while eating more.</p>
<p><strong>How vets diagnose:</strong> a simple blood test (T4, often total T4 + free T4).</p>
<p><strong>Treatment:</strong> very effective. Daily oral medication (methimazole), prescription diet (Hill's y/d), radioactive iodine therapy (curative, gold standard), or surgery.</p>
<p><strong>Prognosis:</strong> excellent if treated early.</p>

<h3>2. Chronic kidney disease (CKD)</h3>
<p><strong>Classic presentation:</strong> older cat, gradual weight loss over months, <a href="/library/cat-litter-box-changes">increased thirst and urination</a>, reduced appetite (especially evening), occasional vomiting, dull coat, ammonia-like breath.</p>
<p><strong>What it is:</strong> the kidneys are progressively losing function. By the time symptoms appear, 70%+ of kidney function is already lost.</p>
<p><strong>How vets diagnose:</strong> blood chemistry (creatinine, SDMA, BUN, phosphorus), urinalysis. SDMA catches earlier than creatinine.</p>
<p><strong>Treatment:</strong> not curable, but progression is dramatically slowed. Prescription renal diets, subcutaneous fluids, phosphate binders, blood pressure medication, anti-nausea medications, telmisartan for proteinuria.</p>
<p><strong>Prognosis:</strong> Cats diagnosed in IRIS stage 2 and treated can live 2–4+ additional years.</p>

<h3>3. Diabetes mellitus</h3>
<p><strong>Classic presentation:</strong> overweight middle-aged cat who starts losing weight while drinking and urinating more. Weakness in hind legs (diabetic neuropathy) in advanced cases.</p>
<p><strong>How vets diagnose:</strong> blood glucose + fructosamine (long-term marker). Urinalysis shows glucose.</p>
<p><strong>Treatment:</strong> insulin injections (Lantus or ProZinc), low-carb diet, weight management. A significant fraction of cats go into diabetic remission within 6 months if caught early.</p>
<p><strong>Prognosis:</strong> very good with early treatment.</p>

<h2>The less-common (but important) differentials</h2>
<ul>
<li><strong>Inflammatory bowel disease (IBD)</strong> — gradual weight loss, intermittent vomiting or diarrhea</li>
<li><strong>Intestinal lymphoma</strong> — often presents like IBD but worsens steadily</li>
<li><strong>Chronic pancreatitis</strong> — episodic vomiting, appetite fluctuation</li>
<li><strong>Dental pain</strong> — cat eats less because chewing hurts</li>
<li><strong>Heart disease</strong> — weight loss in end-stage HCM</li>
<li><strong>Cancer</strong> — multiple sites, progressive weight loss</li>
<li><strong>Chronic infection</strong> (FIV, FeLV, dental abscess)</li>
</ul>

<h2>The minimum lab panel for a senior cat losing weight</h2>
<p>"Cat cachexia" — muscle wasting in old age — is not a diagnosis. It's a symptom. Something is causing it. The above list represents 90%+ of causes, most treatable.</p>
<p>A senior cat losing weight should have, at minimum:</p>
<ul>
<li>CBC (complete blood count)</li>
<li>Full chemistry panel (including SDMA for early kidney detection)</li>
<li>T4 (thyroid)</li>
<li>Urinalysis</li>
<li>Ideally: blood pressure measurement</li>
</ul>
<p>This costs around $150–$300 and can diagnose 3 of the 4 biggest causes.</p>

<h2>Tracking weight at home</h2>
<p>Weigh your cat monthly. Easiest method: weigh yourself on a bathroom scale, then weigh yourself holding the cat. Subtract. Record monthly.</p>
<p>A baby scale is more accurate if you have one. Even a 100–200 g loss matters for a small cat.</p>

<div class="callout warn">
<strong>Red flags — urgent vet visit:</strong>
<ul style="margin-top:8px;">
<li>Weight loss + not eating</li>
<li>Weight loss + vomiting blood or coffee-ground material</li>
<li>Weight loss + hiding + lethargy</li>
<li>Weight loss + rapid breathing (possible heart disease)</li>
<li>Weight loss + jaundice (yellow gums)</li>
<li>Weight loss + a palpable lump</li>
<li>Any weight loss in a diabetic cat (ketoacidosis risk)</li>
<li>Weight loss + collapse, weakness, or inability to stand</li>
</ul>
</div>
`,
  },
  {
    slug: 'cat-lethargy',
    title: 'Cat Lethargy: What It Means at Different Ages',
    description: "A lethargic cat is never 'just tired.' What lethargy signals in kittens, adults, and seniors — and when it becomes an emergency.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 5,
    primaryKeyword: 'cat lethargy',
    relatedSlugs: ['cat-hiding-illness', 'cat-not-jumping', 'cat-ate-lily-emergency', 'cat-not-eating'],
    bodyHtml: `
<p>Cats sleep 12–16 hours a day. That's normal. What's not normal is a cat who stops responding to their usual triggers — food bowl, toy, owner returning home, a bird at the window — and just lies there. That's not tiredness. That's lethargy. In cats, lethargy is usually a medical sign, not a mood.</p>

<h2>Distinguishing "normal cat energy" from lethargy</h2>
<p>Ask yourself:</p>
<ul>
<li>Does she come when called for dinner? (Normally yes; now no = concerning)</li>
<li>Does he jump on his favorite perch? (Normally yes; now skipping = concerning)</li>
<li>Does she greet you at the door? (Normally yes; now hiding = concerning)</li>
<li>Is he grooming himself? (Cats who feel unwell often stop grooming)</li>
<li>Is the sleep posture normal, or hunched/head-low/paws-tucked?</li>
</ul>
<p>A cat who's "just tired" still responds to the food bowl, still blinks slowly when you make eye contact, still grooms. A lethargic cat is absent in a way that's qualitatively different.</p>

<h2>Causes by age</h2>
<h3>Kitten (under 1 year)</h3>
<p>Kittens have very little physiologic reserve — their bodies are still rapidly forming during the <a href="/library/kitten-development-windows">first sixteen weeks of kitten development</a>, and they crash from problems that an adult cat would shake off. Lethargy in a kitten is a fast-moving medical situation.</p>
<ul>
<li><strong>Panleukopenia</strong> (feline parvovirus) — deadly without fast treatment</li>
<li><strong><a href="/library/cat-sneezing">URI</a></strong> — congested kittens stop eating and crash fast</li>
<li><strong>Parasites</strong> causing anemia</li>
<li><strong>Hypoglycemia</strong> — kittens can crash from low blood sugar within hours</li>
<li><strong>Congenital heart defect</strong> becoming symptomatic</li>
<li><strong><a href="/library/cat-ate-lily-emergency">Toxin ingestion</a></strong> — lily, antifreeze, human medications, essential oils</li>
</ul>
<p><strong>Rule:</strong> any kitten lethargic and not eating for 12+ hours needs a vet.</p>

<h3>Young/adult cat (1–7 years)</h3>
<ul>
<li><a href="/library/cat-straining-to-urinate">Urethral obstruction (males)</a></li>
<li>Feline idiopathic cystitis (FIC)</li>
<li>Upper respiratory infection</li>
<li>Trauma (cat fights, falls, being hit)</li>
<li>Pancreatitis</li>
<li>Toxin ingestion</li>
<li>Systemic infection (abscess, bite wound)</li>
<li>Heart disease (HCM presenting)</li>
<li>FIP (feline infectious peritonitis) — historically fatal, now treatable with GS-441524</li>
</ul>

<h3>Senior cat (10+ years)</h3>
<ul>
<li>Chronic kidney disease</li>
<li>Hyperthyroidism</li>
<li>Diabetes mellitus (especially DKA)</li>
<li>Hypertension (often secondary to CKD or thyroid)</li>
<li>Heart disease</li>
<li>Cancer (lymphoma, various)</li>
<li>Hepatic lipidosis</li>
<li>Arthritis — not fatal but causes chronic low energy</li>
</ul>

<div class="callout warn">
<strong>Red flags that mean "emergency vet now":</strong>
<ul style="margin-top:8px;">
<li>Pale, yellow, or blue gums</li>
<li>Fast or labored breathing</li>
<li>Collapse or inability to stand</li>
<li>Hind leg weakness (possible arterial thromboembolism)</li>
<li>Straining in litter box</li>
<li>Vomiting or diarrhea that's blood-tinged</li>
<li>Fever detectable (body feels hot)</li>
<li>Very low body temperature (cold ears, paws)</li>
<li>Seizure or disorientation</li>
<li>Bloat, distended abdomen</li>
</ul>
</div>

<h2>The FATE score (veterinary triage heuristic)</h2>
<p><strong>F</strong>luid loss, <strong>A</strong>ppetite, <strong>T</strong>emperature, <strong>E</strong>nergy. If three of four are abnormal, it's an urgent visit.</p>
<p>Run this yourself:</p>
<ul>
<li><strong>F</strong> — dehydration: lift skin at scruff; if it doesn't snap back in under 1 second, they're dehydrated</li>
<li><strong>A</strong> — eating/drinking normally?</li>
<li><strong>T</strong> — body temperature (100.5–102.5°F / 38–39.2°C normal)</li>
<li><strong>E</strong> — responding to usual stimuli?</li>
</ul>

<h2>The home temperature trick</h2>
<p>A normal cat's ear tips are warm. A lethargic cat with cold ears and cold paws is often in circulatory shock — don't wait, go to the vet. A cat with very warm ears and panting may have a fever.</p>
`,
  },
  {
    slug: 'cat-eye-discharge',
    title: 'Cat Eye Discharge: URI, Corneal Ulcer, or Herpesvirus?',
    description: "Clear, yellow, or green eye discharge in cats usually means one of three things. How to tell them apart — and which is a vet emergency.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 4,
    primaryKeyword: 'cat eye discharge',
    relatedSlugs: ['cat-sneezing', 'cat-not-eating', 'cat-gum-color'],
    bodyHtml: `
<p>Eye discharge in a cat is almost never just "a bit goopy." It's almost always one of three clinical conditions — each with different urgency, treatment, and long-term implications. Getting the right one matters because the wrong treatment can make feline eye disease much worse.</p>

<h2>The three common culprits</h2>
<h3>1. Feline upper respiratory infection (URI)</h3>
<p><strong>Presentation:</strong> watery then mucopurulent (yellow/green) discharge from one or both eyes, with nasal discharge, <a href="/library/cat-sneezing">sneezing</a>, <a href="/library/cat-not-eating">reduced appetite</a>, possibly fever. Cats often squint.</p>
<p><strong>Cause:</strong> most commonly <strong>feline herpesvirus (FHV-1)</strong> or <strong>calicivirus</strong>, sometimes bacterial (Chlamydophila, Mycoplasma, Bordetella).</p>
<p><strong>Urgency:</strong> vet visit within 24–48 hours. Supportive care plus antiviral/antibiotic eye drops.</p>

<h3>2. Corneal ulcer</h3>
<p><strong>Presentation:</strong> one eye, squinting shut (sometimes completely), excessive tearing, visible haze on the cornea, pain (cat rubs eye or avoids light). No sneezing.</p>
<p><strong>Cause:</strong> trauma (cat scratch, plant matter, self-rubbing), FHV-1 reactivation, dry eye, or secondary bacterial infection.</p>
<p><strong>Urgency:</strong> same-day vet visit. Corneal ulcers can deepen rapidly and lead to perforation.</p>
<div class="callout warn"><strong>Critical:</strong> do NOT use any eye drops containing steroids on a cat with an ulcer. Steroids accelerate ulcer deepening and can lead to eye loss. Only vet-prescribed drops after evaluation.</div>

<h3>3. Feline herpesvirus flare (FHV-1)</h3>
<p><strong>Presentation:</strong> typically one eye, chronic or recurrent, mild-to-moderate discharge, squinting, often recurs under stress. Most cats are exposed in kittenhood and carry the virus for life.</p>
<p><strong>Urgency:</strong> vet visit within a few days. Chronic cases benefit from lysine supplementation and stress reduction.</p>
<p><strong>Key detail:</strong> FHV-1 can cause <strong>dendritic corneal ulcers</strong> with a characteristic branching shape — visible only with fluorescein stain at the vet.</p>

<h2>Quick differentiation guide</h2>
<table>
<thead><tr><th>Sign</th><th>URI</th><th>Corneal ulcer</th><th>FHV-1 flare</th></tr></thead>
<tbody>
<tr><td>One or both eyes</td><td>Often both</td><td>One</td><td>One</td></tr>
<tr><td>Sneezing</td><td>Yes</td><td>No</td><td>Sometimes</td></tr>
<tr><td>Squinting</td><td>Mild/moderate</td><td>Severe</td><td>Moderate</td></tr>
<tr><td>Discharge</td><td>Yellow/green mucopurulent</td><td>Often watery</td><td>Watery to yellow</td></tr>
<tr><td>Pain level</td><td>Moderate</td><td>High</td><td>Moderate</td></tr>
<tr><td>Recurrence</td><td>Acute</td><td>One event</td><td>Chronic/recurrent</td></tr>
</tbody></table>

<h2>Don't-miss causes</h2>
<ul>
<li><strong>Glaucoma</strong> — enlarged eye, severe pain, vision loss. Emergency.</li>
<li><strong>Uveitis</strong> — often secondary to FIP, FeLV, FIV, toxoplasmosis.</li>
<li><strong>Foreign body</strong> — severe squinting, usually one eye. Same-day vet.</li>
<li><strong>Tear duct blockage</strong> — chronic watery discharge. Brachycephalic breeds prone.</li>
<li><strong>Entropion</strong> (inward-rolled eyelid) — chronic irritation.</li>
<li><strong>Eyelid tumor</strong> — older cats, visible lump.</li>
</ul>

<div class="callout warn">
<strong>Red flags — emergency vet:</strong>
<ul style="margin-top:8px;">
<li>Eye visibly bulging or enlarged</li>
<li>Eye looks sunken or smaller than the other</li>
<li>Significant blood from the eye</li>
<li>Cat won't open the eye and it's getting worse by the hour</li>
<li>Visible foreign object on or in the eye</li>
<li>Pupil fixed (non-responsive to light change)</li>
<li>Trauma to head or face</li>
<li>Kitten with both eyes gummed shut and not eating</li>
</ul>
</div>

<h2>What you can do at home (while waiting)</h2>
<ul>
<li>Gently wipe discharge with a warm, damp cotton pad</li>
<li>Use a separate pad per eye</li>
<li>Do NOT use human eye drops or saline contact solutions</li>
<li>Do NOT flush with hydrogen peroxide or alcohol</li>
<li>Keep other pets separate (herpesvirus and chlamydia are contagious)</li>
<li>Reduce stress</li>
</ul>
`,
  },
  {
    slug: 'cat-gum-color',
    title: 'Cat Gum Color: Pink, Pale, Yellow, or Blue — What Each Means',
    description: 'Gum color is one of the fastest checks of feline health. Pink is good. Pale, yellow, or blue is an emergency. Here\'s what each color tells you.',
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 4,
    primaryKeyword: 'cat gum color',
    relatedSlugs: ['cat-lethargy', 'cat-breathing-fast-sleeping', 'cat-vomiting-when-to-see-vet'],
    bodyHtml: `
<p>Gum color is the single fastest, cheapest home check of a cat's cardiovascular and metabolic status. Vets assess it every exam. You can too. It takes 3 seconds and can tell you whether something is "call tomorrow" or "go to the ER now."</p>

<h2>How to check</h2>
<p>Lift your cat's upper lip gently and look at the gum tissue above the canine tooth. In a healthy cat, it should be <strong>bubblegum pink</strong>. Press lightly with your fingertip; the spot should turn white, then pink again in <strong>under 2 seconds</strong> (capillary refill time, or CRT).</p>
<p>Some cats have naturally pigmented gums, especially Bombay, Siamese, and some mixed-breed cats. Find a non-pigmented area — the tongue underside works if gums are all dark.</p>

<h2>The color chart</h2>
<h3>Healthy pink (normal)</h3>
<p>Uniform light-to-bubblegum pink, CRT under 2 seconds. Cat is fine circulatorily.</p>

<h3>Pale pink or white (anemia / shock / blood loss)</h3>
<p><strong>Emergency.</strong> Causes:</p>
<ul>
<li>Internal bleeding (trauma, toxin — e.g., rat poison)</li>
<li>Anemia (parasites in kittens, CKD, autoimmune, cancer)</li>
<li>Severe dehydration</li>
<li>Shock (trauma, sepsis, cardiac)</li>
<li>Hypothermia</li>
</ul>
<p><strong>What to do:</strong> emergency vet immediately. Pale gums + weakness = circulatory collapse.</p>

<h3>Yellow / jaundiced (icterus)</h3>
<p><strong>Emergency.</strong> Causes:</p>
<ul>
<li><a href="/library/cat-not-eating">Hepatic lipidosis</a></li>
<li>Cholangitis (liver/bile duct infection)</li>
<li>Hemolysis (red blood cell destruction)</li>
<li>Liver tumor</li>
<li>Extrahepatic biliary obstruction</li>
</ul>
<p><strong>What to do:</strong> same-day vet visit.</p>

<h3>Bright red (shock / sepsis / toxin / overheating)</h3>
<p><strong>Emergency.</strong> Causes: septic shock, heat stroke, carbon monoxide poisoning, severe allergic reaction, toxin exposure.</p>

<h3>Blue / purple (cyanosis)</h3>
<p><strong>Emergency.</strong> Causes: severe respiratory distress, heart failure, pleural effusion, airway obstruction, cyanide or severe oxygen deprivation.</p>
<p><strong>What to do:</strong> blue gums + any <a href="/library/cat-breathing-fast-sleeping">breathing difficulty</a> = call ahead to the ER vet, carry the cat to the car, drive. Do not wait.</p>

<h3>Tacky / dry (dehydration)</h3>
<p>Press your finger firmly; a normal cat's gum is moist and wet. Dry, tacky gums mean dehydration. Combined with skin tenting, it's a vet visit.</p>

<h2>Using CRT to sharpen the signal</h2>
<ul>
<li><strong>Under 1 second:</strong> may indicate hyperdynamic circulation (early shock, excitement)</li>
<li><strong>1–2 seconds:</strong> normal</li>
<li><strong>2–3 seconds:</strong> mild dehydration or poor perfusion — vet visit</li>
<li><strong>Over 3 seconds:</strong> significant circulatory compromise — emergency</li>
</ul>

<h2>Combine with two other fast checks</h2>
<h3>1. Heart rate</h3>
<p>Place your palm flat on your cat's chest behind the elbow. Count beats for 15 seconds and multiply by 4.</p>
<ul>
<li>Normal: 140–220 bpm</li>
<li>Under 100 or over 240 at rest: concerning</li>
</ul>
<h3>2. Respiratory rate (at rest or asleep)</h3>
<p>Count chest rises for 30 seconds × 2.</p>
<ul>
<li>Normal awake: 20–30/min</li>
<li>Normal asleep: under 30/min</li>
<li>Over 40 asleep: abnormal — vet call</li>
</ul>
<p>The three together — gum color, heart rate, respiratory rate — catch roughly 90% of cats in circulatory or respiratory crisis within 60 seconds.</p>

<div class="callout warn"><strong>What NOT to do:</strong> do not give aspirin, Tylenol, or ibuprofen to a cat. These are fatal in cats, even in doses tolerable to dogs.</div>
`,
  },
  {
    slug: 'cat-breathing-fast-sleeping',
    title: 'Cat Breathing Fast While Sleeping: HCM and the 30 bpm Rule',
    description: "A sleeping cat's breathing rate should be under 30 breaths per minute. Above that — especially in Maine Coons, Ragdolls, and Persians — can be an early sign of HCM.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 5,
    primaryKeyword: 'cat breathing fast',
    relatedSlugs: ['cat-gum-color', 'cat-sneezing', 'cat-lethargy'],
    bodyHtml: `
<p>There's a single number most cat parents have never heard of but every cardiologist knows: <strong>30 breaths per minute while your cat is sleeping or resting.</strong> Consistently above that, especially in predisposed breeds, is one of the earliest signs of <strong>hypertrophic cardiomyopathy (HCM)</strong> — the most common heart disease in cats and a leading cause of sudden death.</p>

<h2>How to measure sleeping respiratory rate</h2>
<p>Wait until your cat is fully asleep (not just resting — asleep). Watch the chest or belly rise and fall. Each full rise-and-fall = one breath.</p>
<ul>
<li>Count for 30 seconds, multiply by 2 → breaths per minute</li>
<li>Take 3 measurements across different sleep sessions for a reliable baseline</li>
</ul>
<p>Do <strong>not</strong> measure during purring or active dreaming (twitchy REM phase).</p>

<h2>What's normal</h2>
<ul>
<li><strong>Healthy cat, asleep:</strong> 15–30 breaths per minute. Most sit around 20–25.</li>
<li><strong>Healthy cat, awake and resting:</strong> 20–30 bpm</li>
<li><strong>Panting in cats:</strong> almost always abnormal. Cats do not pant like dogs.</li>
</ul>
<p><strong>The threshold to remember: 30 bpm asleep.</strong></p>

<h2>Why it's specifically an HCM early signal</h2>
<p>HCM thickens the heart muscle, which reduces how much blood the heart can hold and pump per beat. The body compensates by breathing faster to deliver more oxygen per minute. This shows up in sleep — when metabolic demand is otherwise lowest — as an elevated baseline respiratory rate.</p>
<p>By the time the cat is audibly breathing hard, the disease is usually advanced. The 30 bpm threshold catches it earlier.</p>

<h2>Breeds at elevated HCM risk</h2>
<ul>
<li><strong>Maine Coon</strong> — genetic MYBPC3 mutation, ~35% prevalence</li>
<li><strong>Ragdoll</strong> — different MYBPC3 mutation, high prevalence</li>
<li><strong>Sphynx</strong> — high prevalence, underdiagnosed</li>
<li><strong>British Shorthair</strong></li>
<li><strong>Persian</strong></li>
<li><strong>American Shorthair</strong></li>
<li><strong>Norwegian Forest Cat</strong></li>
</ul>
<p>Any mixed-breed cat can develop HCM, but breed cats from above lines should have at minimum one cardiologist echocardiogram, ideally every 1–2 years.</p>

<h2>The tracking protocol</h2>
<ol>
<li>Once a week, measure SRR over 30 seconds while the cat is deeply asleep</li>
<li>Record the number</li>
<li>If the running average starts climbing over 1–2 months, schedule a cardiology workup</li>
<li>If any single reading is consistently above 40, call the vet within a day</li>
<li>If above 50 or paired with any distress, emergency vet</li>
</ol>
<p>For predisposed breeds, weekly tracking from age 2 onward catches problems early.</p>

<h2>Distinguishing HCM from other causes</h2>
<ul>
<li><strong>Pleural effusion</strong> (fluid around the lungs)</li>
<li><strong>Pulmonary edema</strong> (fluid in the lungs — left-sided heart failure)</li>
<li><strong>Feline asthma</strong> (real and common)</li>
<li><strong>Pneumonia</strong></li>
<li><strong>Pulmonary contusion</strong> (trauma)</li>
<li><strong>Chylothorax</strong></li>
<li><strong>Diaphragmatic hernia</strong></li>
<li><strong><a href="/library/cat-gum-color">Anemia</a></strong> — pale gums confirm</li>
<li><strong>Pain</strong></li>
<li><strong>Fever</strong></li>
<li><strong>Hyperthyroidism</strong></li>
</ul>

<div class="callout warn">
<strong>Red flags — emergency now:</strong>
<ul style="margin-top:8px;">
<li>Sleeping respiratory rate above 50</li>
<li>Breathing with open mouth</li>
<li>Breathing with elbows splayed out (orthopneic posture)</li>
<li>Abdominal heave (belly working hard to breathe)</li>
<li>Blue or pale gums + fast breathing</li>
<li>Collapse or inability to rise</li>
<li>Sudden hind-limb weakness or paralysis (aortic thromboembolism — HCM complication)</li>
</ul>
</div>
<p><strong>Aortic thromboembolism</strong> (ATE / saddle thrombus) deserves special mention. Cats with HCM can throw a clot that lodges at the aortic bifurcation, cutting blood flow to the hind legs. Sudden hind-leg weakness + crying out + cold hind paws = immediate emergency.</p>
`,
  },
  {
    slug: 'cat-litter-box-changes',
    title: 'Litter Box Changes: Frequency, Consistency, Blood, and What They Mean',
    description: "Your cat's litter box is the best home diagnostic tool you have. How to read changes in frequency, clump size, stool, and color.",
    datePublished: '2026-04-24',
    dateModified: '2026-04-24',
    readMinutes: 5,
    primaryKeyword: 'cat litter box changes',
    relatedSlugs: ['cat-straining-to-urinate', 'cat-losing-weight', 'senior-cat-care-after-age-10'],
    faqs: [
      {
        question: 'How often should a cat use the litter box?',
        answer: 'Healthy cats typically urinate 2–4 times per day and defecate 1–2 times per day. Significant deviations from this baseline — much more or much less, larger or smaller clumps than usual, or sudden changes in stool consistency — warrant attention even if the cat seems otherwise normal.',
      },
      {
        question: 'Why is my cat peeing outside the litter box?',
        answer: 'First rule out medical causes: feline idiopathic cystitis (FIC), UTI, urethral obstruction, arthritis (painful to step into a high-sided box), or a previous painful experience that created litter aversion. If medical is cleared, look at litter type preference, box cleanliness, location stress, or insufficient box count (rule of thumb: N cats + 1 box).',
      },
      {
        question: 'What does blood in cat urine mean?',
        answer: 'Pink, red, or orange-tinted urine indicates blood. Causes include feline idiopathic cystitis (FIC), bladder stones, UTI, urethral obstruction (an emergency in male cats), trauma, kidney disease, or cancer. Any visible blood in urine warrants a vet visit within 24 hours, sooner if accompanied by straining or no urine output.',
      },
      {
        question: 'When is cat constipation an emergency?',
        answer: 'A cat that has not defecated in 3+ days while showing straining behavior needs a vet visit, especially when accompanied by vomiting (a sign the colon is distended). Common causes include dehydration secondary to chronic kidney disease, megacolon, pelvic injury, or hairballs.',
      },
    ],
    bodyHtml: `
<p>The litter box is the single most underrated diagnostic tool in feline health. Changes in frequency, volume, consistency, or color almost always precede visible illness. Learning to read the signals can add years to your cat's life.</p>

<h2>What "normal" looks like</h2>
<table>
<thead><tr><th>Variable</th><th>Normal</th></tr></thead>
<tbody>
<tr><td>Urination frequency</td><td>2–4 times per day</td></tr>
<tr><td>Clump size</td><td>2–3 tablespoons each, consistent</td></tr>
<tr><td>Stool frequency</td><td>1–2 times per day</td></tr>
<tr><td>Stool consistency</td><td>Firm but not rock-hard, easy to scoop, no mucus</td></tr>
<tr><td>Stool color</td><td>Medium to dark brown</td></tr>
<tr><td>Urine color</td><td>Pale yellow to amber, consistent</td></tr>
<tr><td>Litter box use</td><td>In the box, consistently</td></tr>
</tbody></table>

<h2>Urinary changes</h2>
<h3>Large, frequent clumps (polyuria)</h3>
<p>Cat is peeing more volume than usual. Almost always paired with polydipsia (increased drinking). Common causes:</p>
<ul>
<li><strong>Chronic kidney disease</strong> (diluted urine, lost concentrating ability)</li>
<li><strong>Hyperthyroidism</strong></li>
<li><strong>Diabetes mellitus</strong></li>
<li><strong>Hypercalcemia</strong></li>
</ul>
<p>Action: vet visit within a week for senior cats; sooner if other signs present.</p>

<h3>Small frequent clumps (pollakiuria)</h3>
<p>Cat is making many short trips, possibly straining, possibly not producing much. Causes:</p>
<ul>
<li><strong>FIC (feline idiopathic cystitis)</strong></li>
<li><strong>Bladder stones</strong></li>
<li><strong>UTI</strong> (less common than FIC in cats)</li>
<li><strong>Urethral obstruction</strong> (males — <strong>emergency</strong>)</li>
</ul>
<p>Action: same-day vet, especially for males.</p>

<h3>Pink, red, or orange urine</h3>
<p>Blood in urine. Causes: FIC, bladder stones, UTI, <a href="/library/cat-straining-to-urinate">urethral obstruction</a>, trauma, kidney disease, cancer.</p>
<p>Action: vet visit within 24 hours. Bring a fresh urine sample if you can collect one.</p>

<h3>Strong-smelling urine</h3>
<p>A sudden sharp or sweet smell can indicate UTI, diabetes (sweet/fruity from ketones), or kidney disease.</p>

<h2>Fecal changes</h2>
<h3>Diarrhea</h3>
<p>Small-bowel diarrhea: large volume, few trips per day. Large-bowel diarrhea: small volume, frequent trips, mucus, sometimes fresh blood.</p>
<p>Acute causes: dietary change, parasite, infection, toxin. Chronic causes: IBD, lymphoma, food allergy, exocrine pancreatic insufficiency.</p>

<h3>Constipation</h3>
<p>Straining to defecate with no output or small hard pellets. Often paired with <a href="/library/cat-vomiting-when-to-see-vet">vomiting</a> once the colon is distended.</p>
<p>Causes: dehydration (often secondary to CKD), megacolon, pelvic injury, hairballs.</p>

<h3>Black, tarry stool (melena)</h3>
<p>Digested blood from upper GI bleeding. Causes: ulcer, pancreatitis, hemangiosarcoma, tumor, severe parasite burden.</p>
<p>Action: same-day vet.</p>

<h3>Pale or white stool</h3>
<p>Indicates bile isn't reaching the intestines. Liver or biliary disease. Vet visit within 48 hours.</p>

<h2>Behavioral changes</h2>
<h3>Going outside the box</h3>
<p>First question: medical or behavioral?</p>
<ul>
<li><strong>Medical causes:</strong> FIC, UTI, arthritis (painful to step into high-sided box), litter aversion from a previous painful experience.</li>
<li><strong>Behavioral causes:</strong> litter type preference, box cleanliness, location stress, number of cats vs. boxes (rule: N cats + 1 box), new pet/person.</li>
</ul>
<p>Start with a vet visit to rule out medical. It's very often medical.</p>

<h2>The N+1 rule</h2>
<p>If you have N cats, you need N+1 litter boxes, in different locations. One cat can "block" another from a single box. Inadequate box count causes behavioral issues.</p>

<div class="callout warn">
<strong>Red flags — same-day vet:</strong>
<ul style="margin-top:8px;">
<li>Blood in urine</li>
<li>Straining with no urine output (male especially)</li>
<li>Black tarry stool</li>
<li>Diarrhea with blood + hiding or lethargy</li>
<li>No urination in 12+ hours</li>
<li>No defecation in 3+ days with straining</li>
<li>Dramatic increase in urine volume in a senior cat</li>
</ul>
</div>
`,
  },
  {
    slug: 'cat-ate-lily-emergency',
    title: 'Cat Ate a Lily: Why Every Minute Matters and What to Do Right Now',
    description: "Lilies cause acute kidney failure in cats within hours. The 6-hour window, which 'lilies' are actually toxic, and step-by-step actions before the vet.",
    datePublished: '2026-04-28',
    dateModified: '2026-04-28',
    readMinutes: 6,
    primaryKeyword: 'cat lily poisoning',
    relatedSlugs: ['cat-vomiting-when-to-see-vet', 'cat-not-eating', 'cat-lethargy'],
    faqs: [
      {
        question: 'Are all lilies poisonous to cats?',
        answer: 'No — only some "lilies" are deadly. True lilies (genus Lilium, including Easter, Tiger, Asiatic, Oriental, Stargazer) and daylilies (genus Hemerocallis) are highly nephrotoxic and cause acute kidney failure. Peace lilies and calla lilies cause oral irritation but not kidney failure. Lily of the valley is a different toxin causing heart arrhythmias — also dangerous, also a vet emergency.',
      },
      {
        question: 'How quickly can lily poisoning kill a cat?',
        answer: 'Without treatment, lily ingestion causes acute kidney failure within 24–72 hours. Treatment within 6 hours of ingestion is most effective and usually prevents kidney damage entirely. Beyond 18 hours the prognosis becomes guarded to poor, and surviving cats may have lifelong kidney disease.',
      },
      {
        question: 'My cat ate a lily but seems fine. Should I still worry?',
        answer: 'Yes. Lily toxicity has a deceptive phase between 2–12 hours where the cat appears mostly normal while kidney tubular damage is starting. Symptoms (lethargy, hiding, more vomiting, stops urinating) typically only appear after the easy-treatment window has closed. Treat exposure, not symptoms.',
      },
      {
        question: 'What should I do if my cat ate a lily?',
        answer: "Call your vet or animal poison control immediately. Do NOT try to induce vomiting at home with hydrogen peroxide — it's dangerous and unreliable in cats; vets use safer drugs (xylazine or dexmedetomidine). Bring the plant or a photo to confirm the species. Treatment within 6 hours usually prevents kidney damage entirely.",
      },
    ],
    bodyHtml: `
<p>If your cat has chewed any part of a lily — petal, leaf, stem, pollen, even the water from the vase — stop reading this and call your vet or an animal poison control line right now. Then come back. Lily ingestion is one of the few feline toxicities where <strong>treatment within 6 hours saves the kidneys, and treatment after 18 hours often does not.</strong></p>

<div class="callout warn">
<strong>Emergency action — every minute matters.</strong>
<ul style="margin-top:8px;">
<li><strong>Don't wait for symptoms.</strong> A cat that ate a lily an hour ago will look completely fine. Kidney failure starts silently and is irreversible by the time symptoms appear.</li>
<li><strong>Don't try to make them vomit at home</strong> with hydrogen peroxide — it's dangerous in cats and unreliable. The vet has a safe drug (xylazine or dexmedetomidine) that works in minutes.</li>
<li><strong>Bring the plant.</strong> A photo or the actual stem helps confirm species — true lilies vs. lookalikes vs. plants that just share the name.</li>
<li><strong>Call ahead.</strong> Tell the clinic "suspected lily ingestion" so they prep IV fluids and a kennel before you arrive.</li>
</ul>
</div>

<h2>The 6-hour window (and why it exists)</h2>
<p>Lily toxicity in cats happens in three phases. Treatment effectiveness drops sharply at each transition.</p>
<table>
<thead><tr><th>Time since ingestion</th><th>What's happening inside the cat</th><th>Treatment outlook</th></tr></thead>
<tbody>
<tr><td><strong>0–6 hours</strong></td><td>Toxin still in GI tract or early bloodstream. Cat usually looks fine, may drool or vomit once.</td><td><strong>Excellent</strong> — induced vomiting, activated charcoal, and aggressive IV fluids usually prevent kidney damage entirely.</td></tr>
<tr><td><strong>6–18 hours</strong></td><td>Kidney tubular cells starting to die. Cat may show vomiting, lethargy, hiding, off food. Bloodwork starts to shift.</td><td><strong>Guarded</strong> — aggressive IV fluids for 48–72h can sometimes reverse early damage, but irreversible injury has often started.</td></tr>
<tr><td><strong>18–72 hours</strong></td><td>Acute kidney failure established. Cat stops urinating, becomes severely lethargic, may vomit blood.</td><td><strong>Poor</strong> — survival often requires hemodialysis (rare and expensive), and many cats are euthanized at this stage.</td></tr>
</tbody></table>
<p>This is why the standard veterinary advice is "treat exposure, not symptoms." Waiting until your cat looks sick is waiting too long.</p>

<h2>Which "lilies" are actually deadly</h2>
<p>The word "lily" gets used for dozens of unrelated plants. Only some are nephrotoxic to cats. The dangerous ones are <strong>true lilies (genus <em>Lilium</em>) and daylilies (genus <em>Hemerocallis</em>)</strong>. All parts are toxic — petals, leaves, stems, pollen, and the water in the vase.</p>

<h3>Highly toxic — kidney failure within 24–72 hours</h3>
<ul>
<li>Easter lily (<em>Lilium longiflorum</em>)</li>
<li>Tiger lily (<em>Lilium lancifolium</em>)</li>
<li>Asiatic lily (<em>Lilium asiatica</em> hybrids)</li>
<li>Oriental lily (<em>Lilium orientalis</em> hybrids — Stargazer, Casablanca)</li>
<li>Daylily (<em>Hemerocallis</em>) — common in gardens</li>
<li>Japanese show lily, rubrum lily, wood lily</li>
</ul>

<h3>Mildly toxic — irritation, drooling, vomiting, but not kidney failure</h3>
<ul>
<li>Peace lily (<em>Spathiphyllum</em>) — calcium oxalate, oral irritation</li>
<li>Calla lily (<em>Zantedeschia</em>) — calcium oxalate</li>
<li>Lily of the valley (<em>Convallaria majalis</em>) — <strong>different toxicity</strong>: causes heart arrhythmias, also dangerous, also a vet emergency, but mechanism is cardiac glycoside not nephrotoxin</li>
</ul>
<p>If you're unsure which lily it was, <strong>treat as if it were a true lily.</strong> The cost of overtreating a peace-lily exposure is one vet visit. The cost of undertreating an Easter-lily exposure is your cat.</p>

<h2>What you'll see (and what you won't)</h2>
<p>Most cat owners panic only when symptoms appear — but in lily toxicity, symptoms appearing means you've missed the easy-treatment window. The early signs are subtle:</p>
<ul>
<li><strong>0–2 hours:</strong> chewed plant fragments near the cat, yellow pollen on face/paws, drooling, one episode of vomiting that often contains plant material</li>
<li><strong>2–12 hours:</strong> cat appears mostly normal. May refuse one meal. Often the deceptive phase — owners think "guess he's fine" and don't go in.</li>
<li><strong>12–24 hours:</strong> <a href="/library/cat-lethargy">lethargy</a>, <a href="/library/cat-hiding-illness">hiding</a>, <a href="/library/cat-not-eating">stops eating</a>, may vomit again, drinks more water</li>
<li><strong>24–72 hours:</strong> stops urinating (this is the diagnostic sign — kidneys have failed), severe lethargy, dehydration, sometimes seizures</li>
</ul>
<p><strong>If you see pollen on your cat's face or chewed petals on the floor, that is enough. Go.</strong> Don't wait to see if the cat acts sick.</p>

<h2>What the vet will do</h2>
<h3>If you arrive within 2 hours</h3>
<p>Induced vomiting (with a safe injected drug, not peroxide), then activated charcoal to bind any remaining toxin, then IV fluids for 24–48 hours to flush the kidneys. Bloodwork at 24, 48, and 72 hours to confirm kidney values stay normal. Most cats go home on day 3 with no lasting damage.</p>

<h3>If you arrive at 6–12 hours</h3>
<p>Induced vomiting may still be useful. Aggressive IV fluids for 48–72 hours. Bloodwork every 12–24 hours tracking creatinine, BUN, and SDMA. Many cats still recover fully, but the prognosis depends on bloodwork trends.</p>

<h3>If you arrive after 18 hours</h3>
<p>Treatment shifts to managing acute kidney failure. IV fluids, anti-nausea drugs, sometimes hemodialysis at a referral hospital. Survival is possible but not guaranteed, and surviving cats may have lifelong kidney disease.</p>

<h2>Cost expectations</h2>
<p>Knowing this in advance helps you make fast decisions instead of agonizing over an estimate at 2am.</p>
<ul>
<li><strong>Early decontamination + 24h IV fluids:</strong> roughly $400–$900 in most US clinics</li>
<li><strong>48–72h hospitalization with bloodwork:</strong> roughly $1,200–$2,500</li>
<li><strong>Hemodialysis at a referral hospital (late presentation):</strong> $5,000–$10,000+</li>
</ul>
<p>The financial logic of going early is overwhelming: the cheapest treatment is also the most effective.</p>

<h2>Prevention — what cat-safe homes actually do</h2>
<ul>
<li><strong>No true lilies in the house.</strong> Not in arrangements, not as houseplants. The pollen alone — groomed off fur — is enough exposure.</li>
<li><strong>Tell visitors and florists.</strong> A bouquet from a well-meaning friend is the most common exposure route. Ask florists to substitute alstroemerias, snapdragons, or stocks.</li>
<li><strong>Check the garden in spring.</strong> Daylilies are common in landscaping; a cat that goes outside can chew them.</li>
<li><strong>Cat-safe alternatives:</strong> roses, sunflowers, snapdragons, alstroemerias, orchids, African violets, spider plants.</li>
</ul>

<p>If you're reading this because something already happened: stop reading. Call. The window is shorter than you think — and shorter than this article was to read.</p>
`,
  },
  {
    slug: 'cat-sneezing',
    title: 'Cat Sneezing: URI, Allergies, or Something Worse?',
    description: "Most cat sneezing is benign — but a subset hides chronic infection, nasal foreign bodies, dental disease, or tumors. How to tell which is which.",
    datePublished: '2026-04-28',
    dateModified: '2026-04-28',
    readMinutes: 6,
    primaryKeyword: 'cat sneezing',
    relatedSlugs: ['cat-eye-discharge', 'cat-not-eating', 'cat-breathing-fast-sleeping'],
    faqs: [
      {
        question: 'Why is my cat sneezing?',
        answer: 'Most cat sneezing is benign — dust, perfume, scented litter, or mild allergies. The most common medical cause is upper respiratory infection (URI), typically from feline herpesvirus or calicivirus. Less common causes include foreign body in the nasal cavity, dental disease (especially upper carnassial root abscess), nasal polyps, chronic rhinitis, or — in older cats — nasal tumors.',
      },
      {
        question: 'When should I take my cat to the vet for sneezing?',
        answer: 'Same-day vet for: sneezing blood (epistaxis), breathing difficulty, sneezing with not eating for 24+ hours, violent cluster sneezing with face-pawing (suggests foreign body), or visible facial swelling or asymmetry. Within 1 week: persistent one-sided nasal discharge in a senior cat (rule out tumor) or thick yellow/green discharge that does not respond to home care.',
      },
      {
        question: 'Can cats catch colds from humans?',
        answer: 'No. Cat upper respiratory infections are caused by feline-specific viruses (herpesvirus, calicivirus) and bacteria (Chlamydia felis, Mycoplasma) that do not spread to humans. Cats catch URIs from other cats, especially in shelters, breeders, or multi-cat households.',
      },
      {
        question: 'How long does cat sneezing last?',
        answer: 'A typical uncomplicated URI resolves in 7–14 days. Persistent sneezing beyond two weeks, especially one-sided, warrants further investigation — could be chronic rhinitis (often a long-term consequence of severe early-life URI), a foreign body, polyp, or tumor. Herpesvirus stays latent for life and can flare with stress.',
      },
    ],
    bodyHtml: `
<p>A cat that sneezes a few times a day is almost always fine. But sneezing is also one of the most-missed early signs of upper respiratory infection, dental disease, and (in older cats) nasal tumors. The decision isn't "is sneezing bad" — it's "what kind of sneezing is this, and what comes with it?"</p>

<h2>The quick decision chart</h2>
<table>
<thead><tr><th>What you're seeing</th><th>Urgency</th></tr></thead>
<tbody>
<tr><td>Sneezing + open-mouth breathing or labored breathing</td><td><strong>Emergency vet now</strong></td></tr>
<tr><td>Sneezing + lethargy + not eating &gt; 24h</td><td><strong>Vet within 24 hours</strong></td></tr>
<tr><td>Sneezing blood (epistaxis), even once</td><td><strong>Vet within 24 hours</strong></td></tr>
<tr><td>Sudden violent sneezing fits, pawing at face/nose</td><td><strong>Vet within 24 hours</strong> — possible foreign body</td></tr>
<tr><td>Sneezing + thick yellow/green nasal discharge</td><td>Vet within 2–3 days</td></tr>
<tr><td>Sneezing + eye discharge in a kitten or new-adopted cat</td><td>Vet within 2–3 days</td></tr>
<tr><td>One-sided nasal discharge, especially in a senior cat</td><td>Vet within 1 week</td></tr>
<tr><td>Occasional clear sneezing, otherwise totally normal</td><td>Monitor at home</td></tr>
</tbody></table>

<h2>The "single sneeze" vs. "cluster sneeze" rule</h2>
<p>Veterinary nose-watchers categorize sneezing in two patterns:</p>
<ul>
<li><strong>Isolated sneezes</strong> spread through the day, with the cat otherwise normal — usually dust, perfume, litter, a stray hair. Self-limiting.</li>
<li><strong>Cluster sneezing</strong> — three, five, ten sneezes in a row, sometimes with the cat shaking its head or pawing at its nose. This pattern is unusual and worth attention. Triggers include foreign bodies (grass blade, foxtail), polyps, severe rhinitis flares, or the early phase of a URI.</li>
</ul>

<h2>The common causes (ordered roughly by frequency)</h2>

<h3>1. Upper respiratory infection (URI)</h3>
<p>The classic cat cold. <strong>Feline herpesvirus (FHV-1)</strong> and <strong>feline calicivirus (FCV)</strong> account for the vast majority. Less commonly: <em>Chlamydia felis</em>, <em>Mycoplasma</em>, <em>Bordetella</em>.</p>
<p>Typical picture: sneezing, <a href="/library/cat-eye-discharge">watery eye discharge</a> that may turn yellow/green, congested breathing, sometimes a hoarse meow, often a fever and <a href="/library/cat-not-eating">reduced appetite</a>. Kittens, shelter cats, and recent adoptions are highest risk. Most uncomplicated URIs resolve in 7–14 days, but herpesvirus stays latent for life and flares with stress.</p>
<p><strong>Action:</strong> vet visit if not eating, lethargic, or signs persist beyond a week. Vets may prescribe antibiotics (for bacterial overlay), antivirals (famciclovir for severe herpes), or supportive care like steam therapy and L-lysine.</p>

<h3>2. Allergies (less common in cats than in dogs)</h3>
<p>Cats can be allergic to dust, pollen, mold, cigarette smoke, scented litter, and household sprays. Unlike URI, allergic sneezing is typically:</p>
<ul>
<li>Bilateral (both nostrils)</li>
<li>Clear nasal discharge — never thick yellow/green</li>
<li>No fever, no appetite change</li>
<li>Often seasonal or tied to a specific room</li>
</ul>
<p><strong>Action:</strong> remove the suspected trigger (try unscented dust-free litter, no aerosols, HEPA filter). Persistent cases need a vet to rule out other causes and possibly try a short steroid course.</p>

<h3>3. Foreign body in the nasal cavity</h3>
<p>A blade of grass, foxtail awn, or seed lodged in the nasal passage. Hallmark presentation: <strong>sudden onset</strong>, violent cluster sneezing, sometimes with a small amount of blood, and the cat pawing at the affected side of the face. Usually one-sided.</p>
<p><strong>Action:</strong> vet within 24 hours. Removal is straightforward under sedation; left in place, the foreign body causes chronic infection.</p>

<h3>4. Dental disease — especially upper carnassial tooth root abscess</h3>
<p>An overlooked cause. The roots of the upper premolars and canines sit just below the floor of the nasal cavity. An abscessed root can drain into the nose, producing chronic one-sided sneezing and discharge with no respiratory cause. Classic in cats over 7.</p>
<p><strong>Action:</strong> a vet exam plus dental X-rays. Extraction of the affected tooth often resolves the sneezing completely.</p>

<h3>5. Nasal polyps (especially young to middle-aged cats)</h3>
<p>Benign growths from the eustachian tube or middle ear. Cause one-sided nasal discharge, sneezing, and sometimes a change in voice or head tilt. More common in cats under 5.</p>
<p><strong>Action:</strong> diagnosis via sedated exam or imaging; treatment is removal (traction or surgery).</p>

<h3>6. Chronic rhinitis / "stuffy cat" syndrome</h3>
<p>Often a long-term consequence of severe early-life URI. Permanent damage to nasal turbinates leaves the cat with lifelong intermittent sneezing and congestion. Manageable, not curable.</p>

<h3>7. Nasal tumor (older cats)</h3>
<p>The reason "one-sided discharge in a senior cat" is on every red-flag list. Adenocarcinoma and lymphoma are the most common feline nasal tumors. Presentation: progressive one-sided discharge that doesn't respond to antibiotics, sometimes blood, sometimes a visible facial bulge over weeks.</p>
<p><strong>Action:</strong> any senior cat with persistent one-sided nasal signs needs imaging (CT or MRI) and a biopsy. Lymphoma in particular responds well to chemotherapy when caught early.</p>

<h3>8. Fungal infection (cryptococcus, aspergillus)</h3>
<p>Less common but serious. Often presents as a firm swelling over the bridge of the nose, chronic one-sided discharge, and sometimes neurological signs. Diagnosis via culture or cytology; treatment is months of antifungal medication.</p>

<h2>What to document before the vet visit</h2>
<ul>
<li><strong>How long</strong> sneezing has been happening (days, weeks, months)</li>
<li><strong>One side or both</strong> — look at which nostril is wet</li>
<li><strong>Discharge color:</strong> none / clear / yellow / green / bloody</li>
<li><strong>Other symptoms:</strong> eye discharge, appetite, energy, weight, breathing pattern at rest</li>
<li><strong>Pattern:</strong> constant, after meals, in one room, when you use a particular spray</li>
<li><strong>History:</strong> recent adoption, contact with other cats, outdoor access, vaccination status</li>
<li><strong>Age:</strong> kitten / young adult / senior — changes the differential dramatically</li>
</ul>

<div class="callout warn">
<strong>Red flags — same-day vet:</strong>
<ul style="margin-top:8px;">
<li>Sneezing blood, even a small amount</li>
<li>Difficulty breathing, open-mouth breathing, or breathing fast at rest</li>
<li>Cat has stopped eating for 24+ hours (URI plus anorexia is a faster spiral than people expect)</li>
<li>One-sided nasal discharge in a senior cat that has lasted &gt; 2 weeks</li>
<li>Sudden violent sneezing with pawing at the face</li>
<li>Visible facial swelling, asymmetry, or a bulge above the nose</li>
<li>Pale or blue gums during a sneezing episode</li>
</ul>
</div>

<h2>What you can do at home (when it's mild)</h2>
<ul>
<li>Run a humidifier or take the cat into a steamy bathroom for 10–15 minutes once or twice a day</li>
<li>Switch to unscented, low-dust litter</li>
<li>Wipe the nose and eyes gently with a damp cotton pad</li>
<li>Encourage eating with warmed-up wet food (smell drives appetite — congestion kills it)</li>
<li>Reduce household stress; herpesvirus flares track stress closely</li>
</ul>
<p>Anything that doesn't resolve in a week, or that comes with the red flags above, isn't a "wait-and-see." A 15-minute vet exam usually sorts URI, foreign body, and dental causes apart in one visit.</p>
`,
  },

  // ── Section: Read your cat ──────────────────────────────────────
  {
    slug: 'cat-tail-language',
    title: 'What your cat’s tail is telling you — the 7 positions, decoded',
    description: 'The tail is the most readable channel a cat has. Seven positions, what each one means, and the body-language combinations that change everything.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 9,
    relatedSlugs: ['cat-body-language-ears-whiskers-eyes', 'how-body-language-readers-work', 'feline-five-personality-framework'],
    primaryKeyword: 'cat tail meaning',
    faqs: [
      {
        question: 'Does a wagging tail mean a cat is happy, like a dog?',
        answer: 'No — the opposite. In dogs, a wagging tail signals enthusiasm and friendliness. In cats, a fast-lashing or whipping tail is one of the clearest "I am annoyed, stop now" signals. Slow side-to-side swishes during play are different (focused predatory engagement). The visual is similar; the meaning is reversed.',
      },
      {
        question: 'What does it mean when a cat’s tail tip twitches?',
        answer: 'A small rhythmic twitch confined to the last 1–2 inches of the tail is a graduated tolerance gauge. During focused attention (watching a bird, stalking a toy) it signals locked-on engagement. During petting, a tail-tip twitch is the early warning that the cat is approaching its tolerance limit — the next escalation is a full lash, then a swat. Caregivers who learn to spot it can disengage before the cat escalates.',
      },
      {
        question: 'Why does my cat hold their tail straight up when I come home?',
        answer: 'Tail held high and curved at the tip is a friendly social greeting — it’s a confidence signal cats use with bonded humans and friendly cats. Kittens learn it greeting their mother. If your cat does this when you walk in, it means they’re happy to see you and feel secure. The slight curve at the tip is the difference between a confident greeting (curve) and a more neutral upright posture (no curve).',
      },
      {
        question: 'My cat’s tail is puffed up like a bottle brush — what should I do?',
        answer: 'A bottle-brush tail (piloerection) is acute defensive arousal: the cat feels threatened and is making itself look bigger. Common triggers: another animal (cat, dog, raccoon), sudden loud noise, an unfamiliar visitor, vacuum cleaner. Do not approach or pick up the cat — give it space and a clear escape route. The tail puff drops within minutes once the threat is gone. If it persists or recurs frequently, look for a household stressor (new pet, schedule change, blocked sightline to another cat).',
      },
      {
        question: 'Do cats use their tails to communicate with other cats?',
        answer: 'Yes — cat-to-cat tail signalling is well-documented. Tail-up greetings, tail-wrap (one cat draping its tail over another’s back, a peaceful affiliative signal), and tail position during pass-bys all carry meaning. In multi-cat homes, watching the tails during a doorway encounter tells you whether the relationship is friendly (tails relaxed or up) or tense (lashing, low-held, or puffed).',
      },
    ],
    bodyHtml: `
<p>Cats can’t talk, but they’re saying a lot. Of all the channels they use — ears, whiskers, eyes, vocalizations, posture — the <strong>tail is the most readable</strong>. It’s long, mobile, visible from across a room, and operates on a vocabulary that’s consistent across nearly all domestic cats. Once you can read it, you can read your cat.</p>

<p>This guide covers the seven tail positions every cat owner should know, what each one means, and how to combine tail with other body-language signals to avoid the most common misreads.</p>

<h2>The seven positions</h2>

<h3>1. Tail held high and curved at the tip</h3>
<p>A confident, friendly greeting. Often paired with a forward walk, ears forward, and possibly a chirp or trill. Kittens learn this from their mothers; adult cats use it with bonded humans and friendly conspecifics. <strong>Means:</strong> "I see you, I’m happy you’re here, I feel safe." When your cat does this as you walk in the door, it’s the closest thing in cat-language to a hug.</p>

<h3>2. Tail upright with vibrating tip</h3>
<p>An intensified version of #1, often seen in unspayed/unneutered cats and intact toms when marking territory — but also seen in spayed/neutered cats during particularly enthusiastic greetings. The vibration is rapid, almost a flutter. <strong>Means:</strong> excited recognition. Combined with backing up to a wall: territorial marking; if no marking, just a happy hello.</p>

<h3>3. Tail held neutrally horizontal or in a relaxed curve</h3>
<p>Default cruising posture. The cat is calm, exploring, and not particularly emotionally engaged. <strong>Means:</strong> "I’m fine, going about my business." Not a strong signal in either direction — just baseline.</p>

<h3>4. Tail tucked under the body or wrapped tightly around legs</h3>
<p>A tucked tail signals fear, submission, or pain. The cat is trying to make itself smaller and protect a vulnerable body part. Often paired with crouched posture, ears flat or sideways, and dilated pupils. <strong>Means:</strong> "I feel unsafe right now." In a cat that suddenly starts tucking its tail when picked up or in a particular spot, consider pain — abdominal, urinary, or musculoskeletal.</p>

<h3>5. Tail lashing or whipping side-to-side</h3>
<p>Fast, large-amplitude side-to-side movement of the whole tail. Often misread as "wagging like a dog." It is not friendly. <strong>Means:</strong> high arousal, frustration, on the edge of escalation. During petting, a tail lash is the cat’s "I’m done, stop." During cat-to-cat tension, a tail lash precedes a swat. The correct response: stop whatever interaction is happening, give space, and let the cat disengage.</p>

<h3>6. Tail puffed up like a bottle brush (piloerection)</h3>
<p>Acute defensive arousal: the cat is afraid and is making itself look bigger to ward off a threat. The hair stands on end via the same mechanism that makes humans get goosebumps, but in cats it’s a deliberate display. Often paired with arched back, sideways stance, and ears flat. <strong>Means:</strong> "I am scared and ready to defend myself." Do not approach. Give space. The puff resolves within minutes once the threat is gone.</p>

<h3>7. Tail-tip twitch (the small one)</h3>
<p>A small rhythmic flick of the last inch or two of the tail, with the rest of the tail still. This is a <em>graduated tolerance gauge</em>. In a focused predator state (watching a bird, stalking a wand toy), the twitch signals locked-on attention — the cat is engaged. During petting or other handling, a twitch means the cat is approaching the limit of what it wants. The next escalation is a full lash; the one after that is a swat. <strong>Means:</strong> attention or warning, depending on context. Reading this tip-twitch correctly is the single biggest way to prevent "petting-induced aggression" — the cat almost always warns you before swatting.</p>

<h2>The slow swish (a special case)</h2>
<p>Distinct from the lash, the slow swish is a wide, deliberate side-to-side movement during focused predatory play. Hunting cats do this just before pouncing on prey — the tail counterbalances the upcoming spring. If your cat is doing this with eyes locked on a wand toy or a bug on the wall, you’re watching the predator sequence in action. Channel it with a toy.</p>

<h2>Reading tail in context: the body-language combinations</h2>
<p>The single most important rule of body-language reading is this: <strong>no signal stands alone</strong>. The same tail position can mean very different things depending on what the rest of the body is doing.</p>
<ul>
<li><strong>Low crouched body + dilated pupils + forward whiskers + tail-tip twitch:</strong> hunting state. The cat is locked on prey (or a toy that triggers the prey response). Engaged and positively aroused.</li>
<li><strong>Low crouched body + dilated pupils + flat whiskers + tail tucked:</strong> fear. Same body crouch, opposite emotional state. The whiskers and tail tell the story.</li>
<li><strong>Tail high + ears flat:</strong> conflict. The cat is approaching but feels uncertain. Read this carefully — don’t reach for them.</li>
<li><strong>Tail lashing + slow blink:</strong> doesn’t happen — these are mutually exclusive emotional states. If you think you’re seeing both, look again.</li>
</ul>

<h2>What about during sleep?</h2>
<p>Sleeping cats often hold their tails wrapped around their bodies or tucked under their chins. This is thermoregulation and habit, not emotional signalling. The tail-language vocabulary is for the awake cat; ignore tail position during deep sleep.</p>

<h2>The cheat-sheet</h2>
<table>
<thead><tr><th>Tail position</th><th>Most likely meaning</th></tr></thead>
<tbody>
<tr><td>Up + curved tip</td><td>Confident greeting</td></tr>
<tr><td>Up + vibrating</td><td>Excited recognition (or marking)</td></tr>
<tr><td>Horizontal / relaxed curve</td><td>Calm baseline</td></tr>
<tr><td>Tucked / wrapped tightly</td><td>Fear or pain</td></tr>
<tr><td>Lashing / whipping</td><td>Frustration / "stop"</td></tr>
<tr><td>Puffed bottle-brush</td><td>Acute defensive fear</td></tr>
<tr><td>Tip twitching only</td><td>Attention or rising tolerance limit</td></tr>
</tbody></table>

<h2>What this lets you do</h2>
<p>Once you can read the tail, three things change. First, you stop misreading "wagging" as friendly — your cat will stop biting you mid-pet, because you’ll back off when the twitch starts. Second, you start spotting fear earlier — a tucked tail at the vet’s office is a cue to slow the handling, not push through. And third, you notice when the baseline shifts — a normally tail-up cat that suddenly starts tail-tucking is telling you something is wrong, often before any other symptom appears.</p>

<p>The tail is just one channel. The next piece in this series covers the other four — ears, whiskers, eyes, and posture — and how to put them together into a complete read of your cat. (Curious how AI does this from a photo? See <a href="/library/how-body-language-readers-work">how body-language reader apps work</a>.)</p>
`,
  },

  {
    slug: 'cat-body-language-ears-whiskers-eyes',
    title: 'Cat Body Language Meaning: What Ears, Eyes, Whiskers, and Tails Tell You',
    description: 'Cat body language meaning, decoded. What ears, eyes, whiskers, tail, and posture each tell you about how your cat feels — with a quick-reference table and side-by-side photos.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 10,
    relatedSlugs: ['do-cats-hide-pain', 'cat-tail-language', 'how-body-language-readers-work', 'feline-five-personality-framework'],
    primaryKeyword: 'cat body language',
    faqs: [
      {
        question: 'Why are my cat’s pupils so big when we’re playing?',
        answer: 'Dilated pupils during play are normal — they reflect arousal, not fear. The cat is in a predatory state: focused, energized, locked on the toy. The same dilated pupils paired with flat ears and tucked tail would mean fear; paired with forward ears and a hunting crouch, they mean engaged. Read pupils alongside ears and whiskers, never alone.',
      },
      {
        question: 'What does the slow blink really mean? Is it like a kiss?',
        answer: 'A slow blink — eyes narrowing slowly, sometimes closing fully, then reopening — is a peaceful trust signal. It tells another cat (or human) "I’m relaxed, I don’t see you as a threat." Research has shown that humans who slow-blink at unfamiliar cats are more likely to be approached. It’s not exactly a kiss, but the closest cat equivalent: an explicit "we’re good" signal. Try it — your cat will often blink back.',
      },
      {
        question: 'My cat’s ears swivel sideways like an airplane — what does that mean?',
        answer: '"Airplane ears" — ears rotated sideways and slightly back — are a transitional state between alert and defensive. The cat has heard or noticed something it’s not sure about and is gathering information. If the situation resolves (no threat), ears go back forward. If the cat decides it’s a threat, ears flatten further. It’s a "wait, what?" face.',
      },
      {
        question: 'Why does my cat sit in the loaf position so much?',
        answer: 'The "loaf" — paws tucked under chest, tail wrapped around the body — is a moderately relaxed resting posture. The cat is comfortable but ready to spring up if needed. It’s most common on cool surfaces (helps conserve heat) and during light naps. A cat that switches from relaxed sploot or side-lie to consistent tight-loafing may be guarding its abdomen — a possible early pain sign worth flagging at the next vet visit.',
      },
    ],
    bodyHtml: `
<p>The tail tells you maybe half of what your cat is feeling. The other half is in four channels you might be reading without realising it — <strong>ears, whiskers, eyes, and posture</strong>. Each is a real signal with a real vocabulary, and once you can read all five, you can read your cat with the kind of fluency most owners never reach.</p>

<h2>Ears — the directional indicator</h2>
<p>Cats have 32 muscles per ear and can rotate each one 180° independently. That’s far more articulation than they need just to hear, and it’s why ears are such a rich emotional signal.</p>

<h3>Forward, alert</h3>
<p>Ears upright, both pointed forward. Means: focused interest, hunting, curiosity. The cat is paying attention to something specific in front of it.</p>

<h3>Neutral relaxed</h3>
<p>Ears upright but slightly outward, soft posture. Means: calm baseline. The cat is at ease.</p>

<h3>Sideways / "airplane ears"</h3>
<p>Ears rotated outward to the sides, slightly back. Means: uncertain, gathering information about a possible threat. Transitional between alert and defensive — watch what the cat does next.</p>

<h3>Flat back, pressed against the head</h3>
<p>The ears are pulled tight against the skull. Means: fear or aggression — the cat is protecting its ears from a possible fight, and is signalling that escalation is on the table. Combined with a hiss or growl, this is "back off." Combined with a tucked tail, it’s pure fear; combined with a stiff body, it can be aggression.</p>

<h3>Twitching or flicking</h3>
<p>One or both ears flicking rapidly. Means: irritation, discomfort, or active scanning. A cat with one ear flicking constantly may have an ear infection or ear mites — worth a check-up if it persists.</p>

<h2>Whiskers — the sensitivity dial</h2>
<p>Whiskers (vibrissae) are mechanoreceptors, but they’re also a low-bandwidth communication channel. Their position correlates predictably with affect:</p>
<ul>
<li><strong>Forward, fanned out</strong> — interest, curiosity, predatory focus. Often paired with dilated pupils and ears forward. The cat is engaged.</li>
<li><strong>Neutral, slightly curved sideways</strong> — calm baseline.</li>
<li><strong>Flat / pulled tight against the cheeks</strong> — fear, defensive arousal, sometimes pain. Often paired with flattened ears and tucked tail.</li>
</ul>
<p>Whisker fanning is fast — sub-second — so it’s easier to spot in motion than in static photos. It’s also one of the strongest tells for whether a "stalking" pose is hunting (whiskers forward, engaged) or defensive (whiskers flat, scared).</p>
<p>Bonus: never trim a cat’s whiskers. Length is calibrated to the cat’s body width for spatial navigation; trimming causes brief disorientation. Also note "whisker fatigue" — narrow food bowls force whiskers against the rim, which some cats find unpleasant. Switch to wide shallow bowls; resolves in days.</p>

<h2>Eyes — pupils and blinks</h2>

<h3>Pupil shape and size</h3>
<p>Pupil dilation in cats reflects two things: ambient light and emotional arousal. In bright rooms, pupils should be vertical slits. Wide round pupils in a bright room mean the cat is highly aroused — either in play, fear, or pain.</p>
<ul>
<li><strong>Slits in normal light:</strong> calm, content.</li>
<li><strong>Wide round pupils + forward ears + crouched hunting pose:</strong> engaged predator state.</li>
<li><strong>Wide round pupils + flat ears + tucked tail:</strong> fear.</li>
<li><strong>Asymmetric pupils (one bigger than the other):</strong> not normal — see a vet within 24 hours. Anisocoria can signal neurological issues, eye injury, or systemic disease.</li>
</ul>

<h3>The slow blink</h3>
<p>Eyes narrowing slowly, sometimes closing fully, then reopening. The slow blink is a peaceful trust signal between cats and between cats and humans. It says "I’m relaxed, I don’t see you as a threat." Research has shown unfamiliar cats are more likely to approach humans who slow-blink at them — it works.</p>
<p>If you want to send a "we’re good" message to your cat, slowly close your eyes for a beat and reopen them. Cats often blink back.</p>

<h3>The hard stare</h3>
<p>The opposite of the slow blink. A wide-open, unblinking stare is a challenge or a threat assessment in cat-language. In multi-cat homes, an unblinking stare across a room is often a passive-aggressive resource conflict — the staring cat is communicating "this is mine" without moving. If you have two cats and one stares at the other for 30+ seconds at a stretch, watch for under-the-radar tension.</p>

<h2>Posture — the whole-body read</h2>

<h3>The loaf and its variants</h3>
<p>The classic <strong>loaf</strong> — paws tucked under chest, tail wrapped around the body — is moderately relaxed; the cat is conserving heat and ready to spring up if needed. Common on cool surfaces.</p>
<p>The <strong>half-loaf</strong>, with one paw out and slight hunching, is uncertain or mildly uncomfortable. A cat that suddenly switches to consistent tight half-loafing may be guarding its abdomen — worth flagging.</p>
<p>The <strong>sphinx</strong> — lying on belly, paws stretched forward, head up — is alert rest. Short naps in busy households often happen in this pose.</p>

<h3>Sploot and full-flop</h3>
<p>The <strong>sploot</strong> — back legs stretched out behind, belly on the floor — is fully relaxed and trustful. So is the <strong>side-lie</strong> (full-flop), where the cat is on its side with legs extended; this is the deepest relaxation, REM-capable. Both expose the belly, which is the most vulnerable part of a cat’s body — a strong vote of trust in the environment.</p>

<h3>Belly-up</h3>
<p>The peak trust signal. A cat on its back with paws relaxed in the air is showing the most vulnerable position in its repertoire. Note: this is <em>not</em> always an invitation to rub the belly. Many cats show belly-up as trust but don’t want belly contact — the petting will trigger a defensive grab. Read the tail and tail-tip first.</p>

<h3>Arched back, sideways, fur up</h3>
<p>Halloween-cat pose. Acute defensive arousal: making itself look bigger to ward off a threat. Combined with a puffed tail and flat ears, the message is "I am scared, do not come closer."</p>

<h2>Putting the five channels together</h2>
<p>The discipline of body-language reading is <strong>cross-checking</strong>. The same single signal can mean opposite things in different contexts. Two examples:</p>

<p><strong>Hunting state:</strong> low crouched body + wide pupils + ears forward + whiskers forward + tail-tip twitching. All channels say "engaged predator." The cat is locked on prey or play.</p>

<p><strong>Fear state:</strong> low crouched body + wide pupils + ears flat + whiskers flat + tail tucked. The body is in the same crouch as the hunting state, but the four other channels reverse the meaning.</p>

<p>Read all five before deciding what your cat is feeling. The tail tells you a lot, but the ears and whiskers tell you whether what the tail is telling you is a positive or negative emotion. The eyes confirm arousal level. The posture grounds it all in the body.</p>

<h2>What this changes day-to-day</h2>
<ul>
<li>You stop getting "surprise-bitten" during petting — the tail twitch and ear-flicks warn you 5–10 seconds before the bite.</li>
<li>You spot fear at the vet faster, which means you can advocate for a slower, calmer handling approach.</li>
<li>You catch baseline shifts earlier — a cat whose ears used to be forward and now are constantly sideways may be hearing something different in its environment, or feeling differently about it.</li>
<li>You can answer the eternal cat-owner question "what is my cat thinking right now" with something better than guessing.</li>
</ul>

<p>Reading body language is a skill, not a talent. A few weeks of paying deliberate attention and you’ll be fluent enough that it becomes automatic.</p>
`,
  },

  // ── Section: Your cat's personality ─────────────────────────────
  {
    slug: 'feline-five-personality-framework',
    title: 'The Feline Five — the science of cat personality',
    description: 'Cats have personalities the way humans do — measurable, stable, life-shaping. The five-trait research framework, the recognisable archetypes, and what each one means for how you should live with your cat.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 11,
    relatedSlugs: ['cat-tail-language', 'do-cats-remember-owners', 'five-pillars-happy-indoor-cat'],
    primaryKeyword: 'cat personality types',
    faqs: [
      {
        question: 'Can a cat’s personality change over its life?',
        answer: 'Mostly no. The Feline Five traits are stable across adulthood, and a cat’s archetype at age 2 generally holds at age 12. What CAN change: a previously confident cat that becomes skittish often has a medical reason (pain, hyperthyroidism, cognitive dysfunction in seniors), and a previously skittish cat that gradually becomes more sociable usually had inadequate socialisation as a kitten and is gaining confidence with a stable home. Sudden personality changes deserve a vet visit.',
      },
      {
        question: 'How early can I tell my kitten’s personality?',
        answer: 'Useful signals appear by 8–12 weeks; the trait baselines are largely set by 16 weeks. The 2–7 week socialisation window is when environmental experience most shapes outgoingness and skittishness — a kitten exposed to handling, noise, and other animals during that window will be a more confident adult. After 16 weeks, the personality you see is roughly the personality you’ll have.',
      },
      {
        question: 'Is breed personality real or just stereotype?',
        answer: 'It’s real, but it’s a tendency, not a guarantee. Breed selection over generations has shaped behavioural baselines: Sphynx tend toward high outgoingness and friendliness, British Shorthairs toward low outgoingness and high stability, Bengals toward high spontaneity and dominance. But individual variation within breeds is wide. A Bengal can be a velcro lap cat; a Persian can be active and adventurous. Use breed personality as a starting prior; let the individual cat correct it.',
      },
      {
        question: 'How can I tell if two cats will get along before adopting?',
        answer: 'Match on activity level and dominance, not on breed or look. Two high-dominance cats will compete for territory; two low-activity calm cats will coexist quietly; a high-spontaneity cat paired with a skittish cat is a recipe for chronic stress. The single best predictor of multi-cat harmony is whether each cat’s "good day" looks like the other’s "good day."',
      },
      {
        question: 'What do I do if my cat is "skittish-sensitive"?',
        answer: 'Three things. First, environmental stability — minimise schedule shifts, frequent guests, and disruptive sounds. Second, give them refuge — elevated hides and quiet rooms they can retreat to. Third, never force handling — let them initiate every interaction. Skittish cats can become deeply affectionate over months once trust builds; the path is patience, not exposure therapy.',
      },
    ],
    bodyHtml: `
<p>For decades, cat personality was treated as folk science — a thing every cat owner believed in but no researcher quantified. That’s changed. The 2017 Litchfield et al. study (<em>The "Feline Five": An Examination of Personality in the Domestic Cat</em>, PLoS One) surveyed over 2,800 cat owners and identified five replicable personality traits. Together they form the strongest scientific framework we have for understanding why cats are so individually different.</p>

<p>This guide walks through the five traits, the archetypes that emerge from common combinations, and what each one means for how to live with your cat.</p>

<h2>The five traits</h2>

<h3>1. Skittishness (anxious vs calm)</h3>
<p>How easily and how strongly a cat reacts to novel or surprising events. High-skittishness cats startle easily, hide longer after disruptions, and take more time to acclimate to new people. Low-skittishness cats are emotionally stable and bounce back quickly.</p>

<h3>2. Outgoingness (sociable vs reserved)</h3>
<p>How actively a cat seeks social interaction — with humans, other cats, and visitors. High-outgoing cats greet strangers, follow owners room-to-room, and lap-sit. Low-outgoing cats are independent, may prefer solitude, and form deep bonds with one or two specific humans.</p>

<h3>3. Dominance (assertive vs submissive)</h3>
<p>How much a cat asserts itself in resource conflicts. High-dominance cats guard food, claim sleeping spots, and are likely to bully more submissive cats in multi-cat homes. Low-dominance cats yield resources and avoid confrontation.</p>

<h3>4. Spontaneity (impulsive vs predictable)</h3>
<p>How much a cat does abrupt, unpredictable things. High-spontaneity cats have sudden zoomies, surprise pounces, and shifting moods. Low-spontaneity cats are routine-loving and behaviourally consistent across days.</p>

<h3>5. Friendliness (affectionate vs aloof)</h3>
<p>How affectionate a cat is once a relationship is established. High-friendliness cats seek physical contact, purr readily, and tolerate handling. Low-friendliness cats may live happily alongside their humans without seeking touch.</p>

<h2>The archetypes</h2>

<p>Specific combinations of the five traits produce recognisable types. Most cats fit one or another loosely; some don’t fit any cleanly. Use these as a starting framework, not a rigid box.</p>

<h3>Confident-Sociable</h3>
<p>High outgoingness, low skittishness, moderate dominance. The cat that meets every visitor at the door. Adapts well to new environments, multi-cat homes, and travel. Common in Sphynx, Bengals, Maine Coons. Lifestyle implications: needs daily interaction, does poorly when left alone for long workdays, often benefits from a feline companion.</p>

<h3>Curious-Introvert</h3>
<p>Moderate outgoingness, low-moderate skittishness, low dominance. Confident in their own home but reserved with strangers. Tend to be quietly curious, exploring on their own terms. Common in Russian Blues. Lifestyle implications: thrive on routine, do better in quiet households, need a designated safe-room during gatherings.</p>

<h3>Anxious-Sensitive</h3>
<p>High skittishness, low outgoingness, low dominance. Easily overwhelmed; takes weeks to settle into new environments. Often the result of inadequate kitten socialisation, but also common in some genetic lines. Lifestyle implications: stable schedules, predictable handling, environmental enrichment focused on hiding spots and elevated perches. Avoid loud households, frequent guests, and forceful introductions.</p>

<h3>Hunter-Athlete</h3>
<p>High spontaneity, low skittishness, high outgoingness. Athletic, focused, prey-driven. Wand toys are a non-negotiable daily ritual. Common in Bengals, Abyssinians, Savannahs. Lifestyle implications: provide intense daily play (15–20 minutes wand-toy), food puzzles, vertical territory, and ideally a catio or harness-walk option.</p>

<h3>Affectionate-Lap</h3>
<p>High friendliness, high outgoingness, low dominance. The classic lap cat — seeks physical contact, purrs at the slightest touch, sleeps on the bed. Common in Ragdolls, Birmans, Scottish Folds. Lifestyle implications: thrive on close human contact; do badly when left alone for extended periods. Excellent with children if children are gentle.</p>

<h3>Velcro-Cat</h3>
<p>Extreme high outgoingness, high friendliness, high attachment. The cat that follows you to the bathroom. Common in Sphynx and many Oriental breeds. Lifestyle implications: separation distress is a real risk; consider a companion cat. Often vocalise more than average.</p>

<h3>Skittish-Sensitive</h3>
<p>High skittishness, low outgoingness, moderate friendliness with bonded humans only. Slow to trust, deeply bonded once trust forms. Common in Russian Blues with poor socialisation history, and in some rescue cats. Lifestyle implications: respect their pace, never force interaction, expect 6–12 months for full bonding.</p>

<h3>Cool-Observer</h3>
<p>Low outgoingness, low skittishness, low spontaneity. Watches everything, reacts to little. The cat-shaped equivalent of a long-time housemate who likes you but doesn’t want to be picked up. Common in British Shorthairs. Lifestyle implications: don’t take their reserve personally; affection comes on their terms.</p>

<h3>Goofball-Playful</h3>
<p>High spontaneity, high outgoingness, high friendliness, low dominance. The class clown. Knocks things off tables on purpose, plays fetch, gets into harmless mischief. Often common in Domestic Shorthairs. Lifestyle implications: enrichment is crucial; bored Goofballs become destructive Goofballs.</p>

<h2>Personality plus breed</h2>
<p>Breed creates statistical tendencies but doesn’t guarantee an archetype. Selective breeding shapes baseline traits over generations, which is why breed personality profiles exist. But within any breed, individual variation is large.</p>
<p>Use breed as a <em>prior</em> when you adopt: a Bengal kitten is statistically more likely to be high-spontaneity and high-energy than a British Shorthair kitten. But by 6 months, the individual cat in front of you has corrected the breed prior with their own data. Read the cat, not the label.</p>

<h2>What this changes</h2>

<p>Knowing your cat’s archetype reframes everything. A Skittish-Sensitive cat that hides under the bed when guests come isn’t broken — it’s being a Skittish-Sensitive cat correctly. The work is to build the environment that lets that personality thrive: hides, height, quiet, predictability.</p>

<p>An Affectionate-Lap cat left alone for 12-hour workdays isn’t happy with its own company — it’s suffering from a mismatch between its personality and its life. The fix is a companion cat, a midday visitor, or a job change. (For the rituals that actually deepen a cat-human bond, see our guide on <a href="/library/how-to-bond-with-cat">how to bond with your cat properly</a>.)</p>

<p>And a Hunter-Athlete in a small apartment with no daily play and no vertical territory will turn its energy into furniture destruction — not from spite but from a genuinely unmet need. The fix is wand toys and catification, not punishment.</p>

<p>Personality is descriptive, not normative. There’s no "good" or "bad" cat personality — there are only environments that match or mismatch the personality you have. The Feline Five framework lets you stop fighting your cat’s nature and start designing around it.</p>
`,
  },

  // ── Section: The good cat life ──────────────────────────────────
  {
    slug: 'five-pillars-happy-indoor-cat',
    title: 'The 5 pillars of a happy indoor cat (according to feline vets)',
    description: 'The AAFP/ISFM 5 Pillars framework is the welfare standard feline vets follow. Five environmental needs, what each one means in practice, and a 15-minute home audit you can do this weekend.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 12,
    relatedSlugs: ['feline-five-personality-framework', 'how-to-bond-with-cat', 'cat-litter-box-changes'],
    primaryKeyword: 'happy indoor cat',
    faqs: [
      {
        question: 'How many litter boxes do I actually need?',
        answer: 'The AAFP/ISFM standard is N+1 — one box per cat plus one. Two cats = three boxes. Three cats = four boxes. Crucially, the boxes need to be in DIFFERENT locations — three boxes lined up in one bathroom is one location to a cat, not three. Spread them across rooms and ideally floors. Litter-box avoidance and inter-cat tension drop dramatically when this rule is followed.',
      },
      {
        question: 'My cat doesn’t play with toys. Are they boring or am I doing it wrong?',
        answer: 'Almost always: the toy or technique is wrong. Cats don’t play with toys that don’t move; they don’t play with toys that move predictably; and they lose interest in toys they’ve seen all day. The fix: wand toys (mimic prey), short sessions of 5–10 minutes, end with the cat catching the toy and an immediate small meal (mimics the natural hunt-eat-groom-sleep cycle), and rotate toys weekly so they stay novel.',
      },
      {
        question: 'How do I introduce a new cat without weeks of fighting?',
        answer: 'Slow, structured, scent-first. Week 1: keep the new cat in a separate room with all its resources; swap bedding/towels between rooms daily so each cat gets used to the other’s scent without seeing them. Week 2: feed both cats on opposite sides of a closed door so they associate each other’s smell with food. Week 3: visual contact through a baby gate or cracked door, brief sessions. Week 4: supervised free-roaming, starting with very short windows. Most introductions take 2–6 weeks; rushing it is the single biggest cause of long-term inter-cat tension.',
      },
      {
        question: 'Do indoor cats really need vertical territory?',
        answer: 'Yes — it’s one of the most under-implemented welfare needs. Cats are arboreal-leaning predators; height is where they feel safe and where they monitor their territory from. Two elevated spots per cat in different rooms is the minimum. Cat trees, window perches, cleared shelving, even the top of a bookshelf all count. Vertical territory reduces inter-cat tension in multi-cat homes more than almost any other intervention.',
      },
      {
        question: 'What’s the simplest single change with the biggest impact?',
        answer: 'Wand-toy play, 10 minutes a day, before the evening meal. It hits three pillars at once — play (Pillar 3), positive interaction (Pillar 4), and routine (which feeds into emotional security). It addresses zoomies, mild destructive behaviour, mild stress, and bonds the cat to you. It costs nothing and fits into any schedule. If you do nothing else from this article, do this.',
      },
    ],
    bodyHtml: `
<p>An indoor cat’s welfare isn’t about love alone — it’s about <strong>environmental design</strong>. Cats evolved to spend their lives navigating a 100-acre territory full of vertical space, hiding spots, prey, and choices. We move them indoors and ask them to be happy in 700 square feet. They can be — but only when we design the space to give back what the outdoors took away. (If you’re raising a kitten right now, the environment you create during the <a href="/library/kitten-development-windows">first sixteen weeks of kitten development</a> will shape who they become — design accordingly.)</p>

<p>The American Association of Feline Practitioners (AAFP) and International Society of Feline Medicine (ISFM) jointly published the <strong>5 Pillars of a Healthy Feline Environment</strong> in 2013, and it’s been the welfare gold standard ever since. Every feline-friendly veterinary practice in the world is built around these five needs. This guide walks through each pillar, what it means in practice, and how to audit your home in 15 minutes.</p>

<h2>Pillar 1 — Provide a safe place</h2>
<p>Cats need refuge. A safe place is somewhere a cat can hide, feel concealed, and not be reachable by other animals or people. Multiple safe places per cat, spread around the home.</p>
<p><strong>Practical:</strong> covered cat beds, igloo-style hides, cardboard boxes (free and effective), the underside of a sofa, the top of a closet. Critically, the safe place should be <em>off the floor in at least one location</em> — elevated hides feel safer to cats than ground-level ones because they can monitor the room from above.</p>
<p><strong>Test:</strong> when something disrupts your cat (vacuum, doorbell, guests), where do they go? If the answer is "under the bed every time," they have one safe place — they need at least two more in different rooms.</p>

<h2>Pillar 2 — Multiple, separated key resources</h2>
<p>Resources are food, water, litter, scratching posts, sleeping spots, and toys. Cats need <em>multiple</em> of each, in <em>separate locations</em>. The classic mistake is a single "cat zone" — food bowl, water bowl, and litter all stacked in one corner of the kitchen — which forces resource encounters and creates chronic low-grade tension.</p>
<p><strong>The N+1 rule:</strong> one resource per cat, plus one extra. Two cats = three food stations, three water bowls, three litter boxes. Each in a different location.</p>
<p><strong>Why it matters:</strong> in nature, cats keep food, water, and elimination separate by walking distances. Forcing them into proximity causes low-level chronic stress, bullying at shared bowls, litter-box avoidance, and urinary issues (feline idiopathic cystitis is stress-driven).</p>
<p><strong>Audit:</strong> map your home. For each resource, count locations. If there are two cats and only one litter location — even with three boxes lined up there — that’s a Pillar 2 violation. Spread them.</p>

<h2>Pillar 3 — Opportunity for play and predatory behaviour</h2>
<p>Cats are obligate predators with a deeply wired hunt-stalk-pounce-bite-eat sequence. Indoor cats with no outlet for that sequence experience the same low-grade frustration as a working dog with no work. The fix isn’t toys lying on the floor — it’s structured play that completes the predatory sequence.</p>
<p><strong>Wand-toy protocol:</strong> 5–10 minutes, 1–2 sessions a day. Move the toy like prey — dart, hide, freeze, scurry. Let the cat catch it at the end. Follow immediately with a small meal. This mimics the natural cycle (hunt → eat → groom → sleep) and produces a satisfied cat.</p>
<p><strong>Food puzzles:</strong> dispense part of the daily ration through puzzle feeders, lick mats, or hidden bowls around the home. Cats should work for some of their food.</p>
<p><strong>Toy rotation:</strong> keep three to five toys out at any time, rotate them weekly. Novelty is what triggers play; "old" toys lose interest fast.</p>

<h2>Pillar 4 — Positive, consistent, predictable human-cat social interaction</h2>
<p>Cats are not solitary — most are highly social with bonded humans — but their social rules are different from dogs’. They prefer interactions that are <strong>brief, predictable, and on their terms</strong>. The biggest welfare violation here is humans pushing affection on cats who don’t want it.</p>
<p><strong>Let the cat initiate.</strong> When the cat approaches and rubs, that’s an invitation. When the cat walks away mid-pet, that’s the end of the session. Honour both signals consistently and the cat will trust you more.</p>
<p><strong>Routine matters.</strong> Cats thrive on schedule. Feed at the same times, play at the same times, and the cat’s nervous system relaxes around the predictability.</p>
<p><strong>Don’t over-pet.</strong> Most cats prefer cheek and chin scratches over body strokes. Most don’t enjoy belly rubs even when they show belly. Read the tail-tip twitch (see our body-language guide) for the signal that they’ve had enough.</p>

<h2>Pillar 5 — Respect for the cat’s sense of smell</h2>
<p>Cats live in a scent-first world. Their olfactory system is far more sensitive than ours, and their territory is largely defined by scent markers. Two practical implications:</p>
<p><strong>Don’t over-clean cat-marked areas.</strong> When your cat cheek-rubs furniture, doorways, or your legs, they’re depositing facial pheromones that mark the space as safe. Aggressively cleaning these areas with strong chemicals erases that safety signal. Use cat-safe enzymatic cleaners only where needed (urine accidents); leave cheek-rub spots alone.</p>
<p><strong>Avoid strong scents in cat areas.</strong> Plug-in air fresheners, scented candles near litter boxes, perfume sprays, and scented detergents on cat bedding all overwhelm the cat’s scent map of home. Some essential oils (tea tree, citrus, eucalyptus) are also toxic to cats. Keep cat areas scent-neutral.</p>
<p><strong>Use synthetic feline pheromone (Feliway).</strong> The synthetic version of the cheek-rub pheromone, released via plug-in diffuser, can lower stress in cats during introductions, moves, and inter-cat tension. Evidence is moderate but the downside is zero — worth a 30-day trial.</p>

<h2>The 15-minute home audit</h2>
<p>Walk your home with a notebook. For each pillar, note compliance:</p>
<ol>
<li><strong>Safe places:</strong> count covered hides per cat. Are at least two per cat in different rooms? Is at least one elevated?</li>
<li><strong>Resources:</strong> map food, water, litter, scratching posts. N+1 of each? In separate locations (not just stacked)?</li>
<li><strong>Play:</strong> when did you last do a structured wand-toy session? If "weeks ago," that’s the gap.</li>
<li><strong>Interaction:</strong> are interactions cat-initiated or human-initiated? Does your cat ever walk away mid-session and you keep going?</li>
<li><strong>Smell:</strong> any plug-in air fresheners, scented candles, scented litter, or strong cleaners in the cat’s zones? If yes, that’s the friction.</li>
</ol>

<p>Most homes that "have a stressed cat" have two or three pillar gaps. Closing them takes a weekend of furniture rearranging and £50–100 of new resources. The before/after in the cat’s body language and behaviour is often dramatic.</p>

<h2>What this changes</h2>
<p>The 5 Pillars framework reframes welfare from "do they have food, water, and a clean litter box" to "is the environment designed for a cat to be a cat." When the answer is yes, the standard markers — friendly behaviour, regular routines, low aggression, no inappropriate elimination, healthy weight — follow naturally. When the answer is no, no amount of love compensates.</p>

<p>You don’t have to renovate the house. Most pillar gaps close with small, deliberate changes — a second litter box upstairs, a cat tree by a window, 10 minutes of wand-toy a day, dropping the plug-in air freshener. Five small interventions, one weekend, and the cat’s welfare profile shifts from "coping" to "thriving."</p>
`,
  },

  // ── Section: By life-stage ──────────────────────────────────────
  {
    slug: 'senior-cat-care-after-age-10',
    title: 'Senior cat care — the 12 changes worth tracking after age 10',
    description: 'Cats over 10 enter a life-stage where small drift in weight, water, litter, and behaviour is often the first sign of treatable disease. The 12 markers worth tracking, the schedule that catches problems early, and the environment changes that keep senior cats comfortable.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 9,
    relatedSlugs: ['cat-losing-weight', 'cat-not-jumping', 'cat-grooming-less', 'cat-breathing-fast-sleeping', 'cat-litter-box-changes'],
    primaryKeyword: 'senior cat care',
    faqs: [
      {
        question: 'When does a cat become "senior"?',
        answer: 'AAFP/ISFM life-stage guidelines call age 10–14 "senior" and 15+ "geriatric" (sometimes "super-senior"). The shift at 10 isn’t a hard biological line — it’s the age where the prevalence of treatable age-associated diseases (CKD, hyperthyroidism, dental disease, arthritis, cancer) rises sharply enough that screening pays off. Many cats at 10 are still vigorous; the goal is to catch problems while still treatable, not to act old.',
      },
      {
        question: 'How often should senior cats see the vet?',
        answer: 'Every 6 months for a physical exam, with annual baseline bloodwork (complete blood count, chemistry, T4 thyroid, urinalysis). The 6-month cadence matters because cats can drift through significant disease in 12 months — senior cats can lose 15% of their body weight before the owner notices. Twice-yearly weight checks alone catch a lot of disease early.',
      },
      {
        question: 'My senior cat is "just slowing down" — is that normal aging or a problem?',
        answer: '"Just slowing down" is one of the most over-used explanations for treatable senior cat disease. Most "slowing down" is arthritis (which is under-diagnosed in cats and very treatable with modern multimodal pain management), hyperthyroidism (which causes restlessness in early stages, then fatigue as it advances), CKD, dental pain, or hypertension. Don’t assume normal aging — a vet visit and bloodwork can usually distinguish.',
      },
      {
        question: 'What environmental changes help an older cat?',
        answer: 'Lower-sided litter boxes (easier to step into with arthritis), heated beds in cool spots, shallow wide food and water bowls (whisker-friendly, less neck flexion), ramps or steps to favorite perches, night lights for cats with vision changes, and softer bedding on hard floors. Most senior cats benefit from these changes well before obvious mobility issues appear.',
      },
    ],
    bodyHtml: `
<p>The cat in front of you at 12 is not the same cat at 5 — even when the personality and routines look identical. Their kidneys are working harder. Their thyroid is more likely to drift. Their joints have wear. Their gum line has receded. The disease landscape changes, and the symptoms hide in plain sight.</p>

<p>Senior cats don’t fall ill suddenly so much as they <em>drift</em>. The cat who was 5.0 kg at age 8 is 4.4 kg at age 11 — a 12% drop that nobody noticed because it happened over three years. That drift is often the only early signal of treatable disease. This guide is a map of what to watch for, with the cadence and environment changes that make age 10–year-old plus a thriving life-stage rather than a managed decline.</p>

<h2>The 12 markers worth tracking</h2>

<h3>Weight</h3>
<p>The single most useful number in senior cat health. Weigh monthly using a digital baby scale or by weighing yourself with and without the cat on a regular scale. Drift down >5% in 3 months is significant. Causes include hyperthyroidism (often paired with increased appetite), CKD, diabetes, dental pain, and cancer. For the full diagnostic workup — what each likely cause means and the minimum lab panel to ask for — see our guide on <a href="/library/cat-losing-weight">unexplained weight loss in cats</a>.</p>

<h3>Water intake</h3>
<p>Increased thirst is one of the earliest signs of CKD and diabetes. Watch the water bowl — if it goes from "topping up every other day" to "topping up daily," that’s a flag. Some owners mark the level with a sticker for two weeks to quantify.</p>

<h3>Litter-box patterns</h3>
<p>Frequency, volume, and consistency of urine and stool are gold-standard organ markers. Bigger or more frequent urine clumps signal increased urine production (early CKD, hyperthyroidism, diabetes). Hard small stools suggest dehydration or constipation, common in seniors. Persistent diarrhoea after age 10 isn’t normal — vet workup.</p>

<h3>Appetite and food preference</h3>
<p>A cat who used to eat enthusiastically and now picks at food may have dental pain (very common in seniors), nausea (CKD, hyperthyroidism), or changing taste preferences from kidney disease. A cat who suddenly eats much more is often hyperthyroid.</p>

<h3>Sleeping respiratory rate</h3>
<p>Count breaths per minute while the cat is in deep sleep, ideally a few times a month. Normal: under 30. Persistently above 30, especially climbing month-over-month, is the gold-standard early signal of heart disease. The CatMD app has a built-in tap-per-breath SRR tracker; alternatively, a smartphone stopwatch and 30-second count works.</p>

<h3>Mobility and grooming</h3>
<p>Arthritis is dramatically under-diagnosed in cats — X-ray studies show ~90% of cats over 12 have radiographic evidence of joint disease, but only a fraction are diagnosed because cats don’t limp the way dogs do. Look for: reluctance to jump up to old favourite perches, jumping up but not jumping down, unkempt fur over the rump (the spot the cat can no longer reach to groom), and a stiff gait first thing in the morning.</p>

<h3>Behavioural changes</h3>
<p>New irritability, hiding more, or new clinginess can all signal pain or cognitive decline. Cats with feline cognitive dysfunction (FCD) may become disoriented, vocalise at night, miss the litter box despite no medical cause, and seem confused in familiar rooms. Pattern: it gets worse, not better, over months.</p>

<h3>Coat condition</h3>
<p>A senior cat’s coat tells you a lot. Greasy, matted, or unkempt coat is often grooming compromise from arthritis, dental pain, or systemic illness. A previously sleek cat with a dull coat warrants a vet check.</p>

<h3>Vocalisation patterns</h3>
<p>New, persistent night vocalisation in a senior cat is a flag. Causes include hyperthyroidism (restless, vocal), hypertension (sometimes blindness from retinal detachment, leading to disorientation), and FCD. None are "just getting old."</p>

<h3>Eye changes</h3>
<p>Some cloudiness in the lens after age 10 is normal (lenticular sclerosis, harmless). True cataracts (denser, white opacity) and sudden vision loss are not. Watch for the cat bumping into furniture, missing jumps, or sudden hesitation in dim rooms.</p>

<h3>Lump checks</h3>
<p>During grooming or petting, run hands over the cat’s body monthly. New firm lumps (especially under the skin or in the mammary chain of females) deserve a vet check. Most are benign; some aren’t. Catching them at "small and movable" matters.</p>

<h3>Blood pressure (at the vet)</h3>
<p>Hypertension is common in senior cats and frequently silent until catastrophic (sudden blindness from retinal detachment). Most feline-friendly practices now include blood pressure measurement at every senior wellness visit — ask if yours doesn’t.</p>

<h2>The veterinary cadence that catches things early</h2>
<ul>
<li><strong>Every 6 months:</strong> physical exam, weight, body-condition score, dental check, blood pressure</li>
<li><strong>Annually:</strong> complete blood count, full chemistry panel, T4 (thyroid), urinalysis. Add SDMA (early kidney marker) once standard kidney values stay normal but you want extra sensitivity.</li>
<li><strong>As needed:</strong> chest X-rays if SRR climbs or murmur develops; echocardiogram for HCM-prone breeds (Maine Coon, Ragdoll, Sphynx, Persian)</li>
</ul>

<h2>Environment changes that make life easier</h2>

<p><strong>Litter boxes:</strong> switch to lower-sided boxes (5–7 cm rim height) so arthritic cats can step in without pain. Add at least one extra box on whichever floor the cat spends most time on; senior cats reduce travel distance, and a far-away box gets used less.</p>

<p><strong>Food and water:</strong> wide shallow bowls (whisker-friendly, no neck flexion required). Keep a water station near where the cat sleeps — senior cats drink less if walking to water is effortful, which compounds dehydration.</p>

<p><strong>Sleeping spots:</strong> add a heated bed (low-temperature, pet-safe) in a cool spot. Senior cats lose thermoregulation reserves and seek warmth more. Pad hard floors near favourite spots.</p>

<p><strong>Mobility:</strong> ramps or steps to favourite perches the cat can no longer jump to. Window perches at low-jump height. Avoid slippery hardwood without rugs — traction matters as joints stiffen.</p>

<p><strong>Light and orientation:</strong> small night lights in hallways and near litter boxes for cats with reduced vision or early FCD. Keeping furniture in stable positions matters more for older cats than younger ones.</p>

<h2>Pain management is the under-rated upgrade</h2>
<p>The biggest single intervention in senior cat life quality is multimodal arthritis pain management. Modern options include monoclonal antibody injections (frunevetmab, given monthly at the vet), gabapentin, and joint supplements. Many "just getting old" cats become genuinely playful again within weeks of starting pain management. Talk to your vet — don’t accept stiffness as inevitable.</p>

<h2>What this changes</h2>
<p>The combination of monthly weight checks, alert observation of the 12 markers, and a 6-month vet cadence catches most senior cat disease at "treatable" rather than "managed decline." Cats today routinely live to 16–20 with good senior care, and many of those years can be active and engaged — not just survival, but a real third act.</p>

<p>The frame is not "managing my old cat’s decline." It’s "running a careful surveillance program so I notice the things that hide." Cats earned that surveillance with their famous opacity. We can give it back to them.</p>
`,
  },

  // ── Section: Read your cat — Article 3 ──────────────────────────
  {
    slug: 'cat-vocalizations-decoded',
    title: 'How to read your cat’s vocalizations — meow, chirp, purr, growl',
    description: 'Cats produce 21+ distinct sounds, but the everyday repertoire reduces to about eight. What each one means, the surprising fact that adult cats meow almost exclusively at humans, and how vocal patterns shift with age and health.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 9,
    relatedSlugs: ['why-does-my-cat-meow-at-me', 'cat-tail-language', 'cat-body-language-ears-whiskers-eyes', 'how-meow-translators-work'],
    primaryKeyword: 'cat sounds meaning',
    faqs: [
      {
        question: 'Why does my cat purr when they’re hurt or stressed, not just when happy?',
        answer: 'Purring is bidirectional self-soothing — cats purr in distress as much as in contentment. The vibration frequency (25-150 Hz) overlaps with frequencies shown to promote tissue healing in humans, and there’s strong evidence cats purr to calm themselves during fear, pain, or recovery. A cat purring at the vet isn’t happy — it’s coping. Read purring alongside the cat’s posture, ears, and tail; don’t take it as a standalone "everything’s fine" signal.',
      },
      {
        question: 'My cat doesn’t meow much. Is something wrong?',
        answer: 'Probably not — cats vocalise toward humans much less than humans assume they should. A confident, well-adjusted cat with predictable feeding times and no unmet needs may meow only a few times a day. Vocal frequency is largely individual + breed-driven (Siamese / Tonkinese / Burmese are loud; British Shorthair / Russian Blue are quiet). Concern only if the cat WAS vocal and now isn’t (a vocal-baseline drop in a senior cat warrants a check-up — possible hearing loss, neurological change, or systemic illness).',
      },
      {
        question: 'What does it mean when my cat chatters at birds through the window?',
        answer: 'Chattering — that rapid teeth-clicking with the jaw vibrating — is a frustrated predatory state. The cat sees prey it can’t reach. Some researchers think it’s an instinctive practice of the killing-bite jaw motion (cats kill rodents and small birds with a precise neck-bite that requires fast jaw articulation). It’s normal, harmless, and doesn’t indicate distress — but if your indoor cat does it constantly at the window, consider increasing structured wand-toy play to give the predatory drive an outlet.',
      },
      {
        question: 'My senior cat has started yowling at night. Is this normal aging?',
        answer: 'No — sudden new yowling in an older cat is a flag, not "just aging." Three main causes worth screening: hyperthyroidism (overactive thyroid causes restlessness + nighttime activity + vocalisation), hypertension (sometimes secondary to retinal detachment causing sudden blindness, leading to disorientation), and feline cognitive dysfunction (FCD — the cat dementia equivalent, with disorientation and lost diurnal rhythm). All three are treatable. A senior wellness exam + bloodwork + blood pressure check usually identifies which.',
      },
    ],
    bodyHtml: `
<p>Cats are not silent. They produce <strong>21+ distinct vocalisations</strong>, but the everyday repertoire most owners encounter reduces to about eight sounds with consistent meanings. Knowing the vocabulary tells you whether your cat is greeting, asking, complaining, threatening, or self-soothing — and lets you spot when their baseline shifts.</p>

<h2>The eight everyday sounds</h2>

<h3>1. Meow</h3>
<p>The all-purpose request. Pitch and length carry meaning: a short clipped meow is usually attention-asking, a long drawn-out meow is complaint or distress, a high-pitched chirpy meow is greeting. Most owners learn their own cat’s specific meow vocabulary within months — it tends to be remarkably consistent per individual. Worth noting: adult cats almost never meow at each other — they keep the meow channel almost exclusively for humans (see <a href="/library/why-does-my-cat-meow-at-me">why your cat meows at you specifically</a>).</p>

<h3>2. Chirp / trill</h3>
<p>A short rolled "brrrr" or "prrrrt", mouth closed. Originally a mother-to-kitten "come here" call; adult cats use it as a friendly greeting toward bonded humans and friendly cats. Almost always a positive signal.</p>

<h3>3. Purr</h3>
<p>Continuous low-frequency vibration on inhale and exhale (distinct from a growl, which is exhale-dominant and more strained). <strong>Critically: purring is bidirectional self-soothing</strong> — cats purr in distress as much as contentment. A cat purring at the vet, after surgery, or while injured isn’t happy; it’s coping. Read alongside posture, ears, and tail; never alone.</p>

<h3>4. Growl</h3>
<p>Low sustained rumble, exhale-dominant, distinct from purring. A clear warning. The cat is asking for distance — see the body-language cards on hissing + growling for the full escalation hierarchy. Almost always paired with flat ears and a defensive body shape.</p>

<h3>5. Hiss / spit</h3>
<p>Sharp forced exhale through an open mouth. Defensive — the cat is asking the threat to back off without escalating to a fight. Spitting is the more abrupt single-explosion variant, usually triggered by sudden surprise.</p>

<h3>6. Yowl</h3>
<p>Long mournful call, often louder and more drawn-out than a meow. Three main contexts: distress (cat in pain or trapped), mating call in unspayed/unneutered cats, and — in senior cats — sometimes a sign of cognitive decline, hyperthyroidism, or sudden blindness from hypertension. Sudden new yowling in an older cat is always worth a vet check, never "just aging."</p>

<h3>7. Chatter</h3>
<p>Rapid teeth-clicking with visible jaw vibration. Almost exclusively triggered by watching prey through a window — birds, squirrels, bugs. A frustrated predatory state. Some researchers think the jaw motion mimics the killing-bite. Not communication; just the cat’s predatory wiring firing without an outlet.</p>

<h3>8. Scream</h3>
<p>A piercing high-pitched shriek. In a non-breeding household, this is pain — abrupt severe pain (paw caught, tail trodden, sudden injury). Vet emergency unless the cause is obvious + brief. In breeding contexts, female cats can scream during or after mating; the male’s barbed penis triggers it. Not normal in spayed cats.</p>

<h2>The single most surprising fact about cat communication</h2>

<p>Adult cats <strong>almost exclusively meow at humans, not at other cats</strong>. Cat-to-cat communication in the wild is dominated by body language and scent — meowing is largely absent between adult conspecifics. Kittens meow at their mothers; mothers respond. As cats mature, the meow drops out of cat-cat communication.</p>

<p>The exception is humans. Cats appear to have <em>retained</em> the meow because we respond to it. Domestic cats developed an expanded meow repertoire specifically to manipulate human caregivers — distinct meows for "feed me", "open the door", "pay attention", "I’m bored." This is a form of cross-species learning unique to cats among domestic animals.</p>

<p>Practical implication: if your cat is "not vocal", that’s usually fine. A confident, low-stress cat with predictable schedules has less reason to issue requests. Vocal frequency is largely breed-driven (Siamese / Tonkinese / Burmese are famously loud; British Shorthair / Russian Blue / Persian are quiet) and individually variable.</p>

<h2>Vocal patterns that warrant attention</h2>

<p>Track the cat’s baseline. Concern is mostly about CHANGES, not absolute volume:</p>

<ul>
<li><strong>Sudden increase in middle-aged or senior cats:</strong> hyperthyroidism (early restless phase), hypertension (sometimes secondary to retinal detachment + disorientation), feline cognitive dysfunction in seniors. Vet workup with bloodwork + blood pressure.</li>
<li><strong>Persistent night vocalisation:</strong> see above. Particularly common at 14:00-16:00 (hyperthyroid restlessness peak) or 03:00-05:00 (cognitive dysfunction or pre-dawn hunger).</li>
<li><strong>New yowling on touch or in a specific area:</strong> localised pain. Note the body region; that’s where to direct vet examination.</li>
<li><strong>A vocal cat going silent:</strong> equally telling. A previously chatty cat that goes quiet may have hearing loss (especially white cats with blue eyes — congenital deafness rate is high), pain, or systemic illness affecting energy.</li>
</ul>

<h2>Reading vocalisations alongside body language</h2>

<p>Sound rarely stands alone. The same "meow" can mean different things depending on context:</p>

<ul>
<li>Meow + tail-up + cheek-rub at 7am → "feed me" + greeting</li>
<li>Meow + dilated pupils + retreating → distress / fear</li>
<li>Meow + half-closed eyes + slow approach → "I’m here, attention please"</li>
<li>Persistent yowl + vocal pacing + new behaviour → flag for vet</li>
</ul>

<p>The vocal vocabulary is the one channel where the vocabulary is <em>directed at you specifically</em> — your cat learned over the months you’ve known them which sounds get which response. Pay attention to the meows you hear most; that’s your cat’s personalized requests dictionary.</p>

<h2>What this changes day-to-day</h2>

<p>Once you can read the vocabulary, two things happen. First, you stop dismissing or over-reacting to specific sounds — chatter at the window isn’t distress, a hiss at the new vacuum isn’t pathological, persistent night yowling in an older cat isn’t "just getting old." Second, you spot baseline shifts faster: a normally chatty cat that goes quiet, or a quiet cat that suddenly yowls at 3am, becomes a clear flag rather than ambient noise.</p>

<p>Body language tells you what your cat is feeling. Vocalisations tell you what your cat is asking for. Together they’re fluency.</p>
`,
  },

  // ── Section: The good cat life — Article 2 ──────────────────────
  {
    slug: 'multi-cat-household-harmony',
    title: 'Multi-cat households — the science of getting along',
    description: 'Twenty percent of cat homes have more than one cat, and most of them have lower-grade conflict the owners don’t recognise. The AAFP-backed framework for resource design, the introduction protocol that prevents long-term tension, and the body-language signs that tell you whether your cats actually like each other.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 11,
    relatedSlugs: ['five-pillars-happy-indoor-cat', 'feline-five-personality-framework', 'cat-body-language-ears-whiskers-eyes'],
    primaryKeyword: 'multi-cat household',
    faqs: [
      {
        question: 'My two cats "tolerate" each other but never sleep together. Is that fine?',
        answer: 'Tolerating is the lower bar — most multi-cat households are at this level and that’s acceptable. The higher bar is allogrooming + sharing sleeping spots + tail-up greetings. If your cats avoid actively conflicting, you have a stable household. If they actively avoid each other (using different rooms, eating at different times to avoid presence), that’s lower-grade chronic stress worth addressing through resource redesign.',
      },
      {
        question: 'How long does a proper cat-cat introduction take?',
        answer: 'Two to six weeks for most pairings. Faster than that means you skipped a phase and the relationship will likely have residual tension. The standard sequence: week 1 separation + scent swap, week 2 visual contact through a barrier, week 3 supervised brief co-presence, week 4 longer co-presence. Skittish cats (Russian Blue, anxious rescues) can need 2-3 months. Forcing it is the single biggest cause of failed multi-cat households.',
      },
      {
        question: 'Do cats "need a friend" if I’m at work all day?',
        answer: 'Highly individual. Cats from breeds bred for human-attachment (Sphynx, Tonkinese, Burmese, Velcro-Cat archetypes generally) genuinely suffer from prolonged solo time and benefit from a feline companion. Cats from independent / cool-observer breeds (British Shorthair, many DSH) often prefer to be the only cat. Litchfield Five outgoingness scores predict this — high outgoingness + low dominance = good single-cat-to-multi-cat conversion candidate; low outgoingness OR high dominance = leave them solo.',
      },
      {
        question: 'My older cat hates the new kitten. Will it ever get better?',
        answer: 'Usually yes, but slowly — 3-6 months of patience plus active environmental design. Older cats find rambunctious kitten energy genuinely stressful; the kitten’s play-attempts read as harassment. Provide elevated escape routes (shelves, cat-trees) where the older cat can be high and untouchable. Use baby gates to separate during high-energy periods. Most older cats accept a kitten over time as the kitten matures and calms down at 12-18 months. If actual fighting (not play) is occurring weekly past month 3, consult a vet behaviourist.',
      },
    ],
    bodyHtml: `
<p>A surprising fraction of multi-cat households are running on lower-grade chronic conflict the owners don’t recognise. The cats aren’t fighting visibly — they’re using different rooms at different times, eating in shifts, posturing across doorways, and quietly modulating their lives around each other’s presence. That’s not a peaceful coexistence; that’s two stressed animals doing the work to avoid escalation.</p>

<p>The good news: the science of cat-cat compatibility is well-developed. The AAFP/ISFM 5 Pillars framework + a structured introduction protocol + thoughtful resource design fix most multi-cat tension. This guide covers what feline vets and behaviourists actually recommend.</p>

<h2>Why cats don’t naturally cohabit</h2>

<p>Domestic cats descended from <em>Felis silvestris lybica</em>, the African wildcat — a solitary territorial species. Cats have <strong>secondary sociality</strong>: they can live in groups when resources are abundant (the cat colonies around fishing villages, cats in barns) but their default ecology is solitary territory-holding. We forget this when we adopt a second cat into a 700-square-foot apartment and expect them to "be friends."</p>

<p>The good multi-cat household design works <em>with</em> this biology. The bad one ignores it.</p>

<h2>The introduction protocol — 2-6 weeks done properly</h2>

<p>Cat-cat first impressions are durable. A botched introduction can produce 6+ months of unwinding work. The standard protocol — backed by ISFM, ASPCA, and most feline behaviourists:</p>

<h3>Week 1: complete separation + scent swap</h3>
<p>Resident cat in their normal home; new cat in a single closed room with all their resources (food, water, litter, bed, toys). The cats can hear each other but never see each other. Daily: take a soft towel, rub it on the new cat’s cheeks (collecting facial pheromones), place it near the resident cat’s resting spot. Repeat in reverse. The cats become familiar with each other’s scent before any visual contact.</p>

<h3>Week 2: feeding through a closed door</h3>
<p>Place each cat’s food bowl on opposite sides of the closed door separating them. Both cats associate the other cat’s smell with food (a positive event). Start with bowls a few feet from the door; move incrementally closer over the week. By end of week 2, they should be eating directly on either side of the door without anxiety.</p>

<h3>Week 3: visual contact through a barrier</h3>
<p>Use a baby gate (or a cracked door) to allow visual contact while preventing physical access. Brief sessions (10-30 minutes) with both cats getting treats / play during the interaction. Watch for body language: ears forward + relaxed bodies = good; ears flat + stiff bodies + low growling = back off, return to closed-door work.</p>

<h3>Week 4+: supervised co-presence</h3>
<p>Once cats are calm with visual contact, allow brief supervised free-roaming time. Have a thick blanket or pillow ready to interrupt any tension. Keep sessions short initially. Gradually extend.</p>

<p>Skittish cats (Russian Blue, anxious rescues, Skittish-Sensitive archetype generally) can need 2-3 months for the full protocol. <strong>Skipping phases is the single biggest cause of failed multi-cat households.</strong></p>

<h2>Resource design — the AAFP 5 Pillars in multi-cat form</h2>

<p>The 5 Pillars framework you see in single-cat advice gets significantly more important with multiple cats. The N+1 rule comes from this: <em>one resource per cat plus one extra, in different physical locations</em>.</p>

<h3>Litter (most critical)</h3>
<p>Two cats = three litter boxes, in three different rooms / floors. NOT three boxes lined up in one bathroom — that’s one location to a cat, regardless of box count. Cats often refuse to use a box another cat is currently using or has recently used; without redundancy you get litter-box avoidance and inappropriate elimination, which is the #1 reason cats end up surrendered to shelters.</p>

<h3>Food + water (separated)</h3>
<p>Multiple food stations (N+1) in different rooms. Multiple water stations (N+1) ideally not adjacent to food (cats prefer water away from prey/food in their evolutionary mental model). One station per cat means the dominant cat blocks the other; resource guarding shapes the household quietly.</p>

<h3>Vertical territory</h3>
<p>Two cats in a flat territory create a 2D conflict zone. Add vertical complexity (cat trees, cleared shelves, window perches, top-of-bookshelf access) and conflict drops dramatically — cats can pass each other in 3D space, the lower-status cat can escape upward, both can monitor the room without competing for the same square footage.</p>

<h3>Hiding spots</h3>
<p>Each cat needs at least 2-3 covered hides in different rooms — places they can disappear from each other’s sight. The lower-status cat especially needs <em>certain</em> retreat options at all times.</p>

<h2>Reading whether your cats actually like each other</h2>

<p>Don’t mistake "tolerating" for "bonded." The hierarchy of multi-cat relationship quality, weakest to strongest:</p>

<ol>
<li><strong>Active conflict</strong> — visible fights, hissing, blocked spaces. Worst. Needs intervention now.</li>
<li><strong>Active avoidance</strong> — cats use different rooms / different times. Lower-grade chronic stress; both cats are managing the situation. Owners often miss this — it looks "peaceful."</li>
<li><strong>Tolerance</strong> — cats coexist in the same rooms without conflict but never affiliate. Acceptable; most multi-cat households at this level.</li>
<li><strong>Affiliation</strong> — tail-up greetings between the cats, allorubbing, occasional shared sleeping spots. Genuinely friendly.</li>
<li><strong>Bonded</strong> — allogrooming (one cat licking the other), regular shared sleeping, tail-wrap, nose touches at greeting. The strongest signal a multi-cat relationship is genuinely good.</li>
</ol>

<p>If you’ve never seen allogrooming or tail-wrap between your cats and they’ve lived together a year, you’re probably at "tolerance" — the household is stable but not bonded. That’s fine; you don’t need affection between cats for a healthy home. But understand that "they don’t fight" is the lower bar, not the higher one.</p>

<h2>The personality compatibility lens</h2>

<p>Litchfield Five framework predicts multi-cat outcomes well. The single biggest predictor: <strong>activity level + dominance match</strong>. Two high-dominance cats will compete for territory indefinitely. Two low-activity calm cats will coexist quietly. A high-spontaneity Hunter-Athlete paired with a Skittish-Sensitive cat is a recipe for chronic stress — the energetic cat’s play-attempts read as harassment to the anxious one.</p>

<p>If you’re considering adding a second cat, the most useful question is: <em>"What’s a good day for my current cat? Will the new cat have a similar good day?"</em> If yes, compatibility is likely. If their good days look incompatible, even perfect introductions won’t produce a relaxed household.</p>

<h2>What to do when it’s gone wrong</h2>

<p>If you’re reading this with two cats already in chronic tension, the playbook:</p>

<ol>
<li><strong>Re-introduce.</strong> Yes, even after months together. Treat it as a from-scratch introduction with the 4-week protocol. This often works because it lets the cats reset their expectations.</li>
<li><strong>Audit the resource map.</strong> Walk the home with a notebook; count litter boxes, food stations, water stations, hides, vertical territory. Map shortest paths each cat takes from sleeping spots to litter to food. Where they cross is where conflict happens.</li>
<li><strong>Add Feliway Multicat.</strong> Different formulation from the standard Feliway diffuser; targets cat-cat tension specifically. 30-day trial.</li>
<li><strong>Consult a vet behaviourist.</strong> Real fighting (not play) at week 12+ post-introduction is a behaviourist case. Some pairs respond to fluoxetine in addition to environmental changes.</li>
<li><strong>Accept that some pairings don’t work.</strong> ~5-10% of cat pairings don’t reach even tolerance regardless of effort. If you’re a year in and one cat is hiding 16 hours a day, the kindest answer for both cats may be to rehome one to a single-cat household.</li>
</ol>

<h2>What this changes</h2>

<p>The biggest mistake multi-cat owners make is treating their cats as a single household unit instead of two separate territorial animals sharing space. The framework here — proper introduction, N+1 resource separation, vertical territory, personality compatibility, body-language reading — addresses every level of the problem at once.</p>

<p>Most multi-cat tension is a design problem, not a personality problem. Fix the design and most cats settle.</p>
`,
  },

  // ── Section: By life-stage — Article 2 ──────────────────────────
  {
    slug: 'kitten-development-windows',
    title: 'Kitten development — the windows that matter most',
    description: 'The first 16 weeks of a cat’s life shape who they will be for the next 18 years. The 2-7 week socialisation window, the milestones month-by-month, and the things owners can do at each stage to set their cat up for a confident adult life.',
    datePublished: '2026-05-01',
    dateModified: '2026-05-01',
    readMinutes: 9,
    relatedSlugs: ['feline-five-personality-framework', 'five-pillars-happy-indoor-cat', 'multi-cat-household-harmony'],
    primaryKeyword: 'kitten development stages',
    faqs: [
      {
        question: 'Why is the 2-7 week socialisation window so important?',
        answer: 'During weeks 2-7, kittens form lifelong baseline expectations about what is safe, normal, and worth investigating. Kittens exposed to handling, voices, household sounds, gentle dogs, children, and varied surfaces during this window grow into adults who handle novel situations confidently. Kittens kept in isolation (e.g., a litter raised in a quiet barn with no human contact) can never fully recover that confidence — adult socialisation works but produces less stable results. This window closes around 8-9 weeks; experiences after that still shape behaviour but with diminishing returns.',
      },
      {
        question: 'When is the right time to bring a kitten home?',
        answer: 'Twelve to fourteen weeks is the modern recommendation. Earlier (8-10 weeks) used to be standard but increasingly the consensus is the extra weeks with the mother + littermates produce better-adjusted adults — especially for things like bite inhibition (learned from siblings), reading other cats’ body language, and emotional self-regulation. Early-separation kittens often develop wool-sucking, anxious attachment, or aggressive play-biting toward humans because they didn’t finish learning these things from their family.',
      },
      {
        question: 'Should a kitten be vaccinated before going outside?',
        answer: 'Yes — fully. Core kitten vaccines (FVRCP at 6-8 weeks, 10-12 weeks, 14-16 weeks; rabies once at 12-16 weeks; FeLV if outdoor exposure planned) provide herd-level protection but not full immunity until the series is complete. Outdoor access should wait until 16 weeks AND at least 2 weeks past the last booster. Before that, all socialisation happens indoors or in the owner’s carried arms during brief outdoor walks where contact with other animals is impossible.',
      },
      {
        question: 'How much should a kitten eat — and how often?',
        answer: 'High-calorie kitten food (specifically labelled "kitten" — adult food has the wrong nutrient profile for growth) free-fed or in 4-5 small meals up to 6 months, then 3-4 meals to 12 months, then transition to twice-daily adult feeding. Kittens grow rapidly and have small stomachs; under-feeding shows as failure to gain weight (weigh weekly, expect ~1 lb / 450g per month for first 6 months). Over-feeding is rare but possible in slow-grown breeds — body-condition score over palpation is the better gauge than scale weight alone.',
      },
    ],
    bodyHtml: `
<p>The first 16 weeks of a kitten’s life shape who they will be for the next 18 years. The personality archetype your future adult cat falls into, how they handle visitors and vet visits, whether they tolerate handling, whether they form deep bonds easily — all of these are heavily set during a critical window most owners don’t even know exists.</p>

<p>This guide walks through kitten development month-by-month, with emphasis on the 2-7 week socialisation window (the one that matters most) and what owners receiving a kitten at 12+ weeks can still do to shape outcomes.</p>

<h2>The biggest single fact: the 2-7 week socialisation window</h2>

<p>Between approximately 2 and 7 weeks of age, kittens form <strong>lifelong baseline expectations</strong> about the world. Specifically:</p>

<ul>
<li>What humans look, sound, smell, and feel like</li>
<li>Whether handling is safe</li>
<li>Whether household sounds (vacuums, doorbells, children, TVs) are normal or threatening</li>
<li>Whether other species (dogs, other cats outside the litter) are safe</li>
<li>Whether varied surfaces (grass, hardwood, carpet, tile, gravel) are normal</li>
</ul>

<p>Kittens exposed to a varied stimulus environment during this window grow into <strong>confident, adaptable adults</strong>. Kittens kept in isolation — a litter raised in a quiet shed with one caregiver, or separated from littermates too early — develop into adults who startle at novelty their entire lives.</p>

<p>The window closes around 8-9 weeks. Socialisation after that still works (an adult cat can become more confident with a stable home and patient handling) but produces less stable results — the baseline is set, and you’re working against it rather than with it.</p>

<p>Practical implication: when adopting, ask the breeder or rescue what the kitten’s first 8 weeks looked like. A kitten raised in a foster home with kids, dogs, and household chaos is going to handle your real life better than one raised in a quiet shelter back-room.</p>

<h2>Month-by-month timeline</h2>

<h3>Weeks 0-2 — neonatal</h3>
<p>Eyes and ears closed, motor coordination minimal. Kitten depends entirely on mother for warmth (can’t thermoregulate), food, and elimination (mother stimulates urination by licking). Owners shouldn’t handle kittens at this stage beyond brief gentle weighing. Birth weight ~100g, doubles by week 2.</p>

<h3>Weeks 2-4 — transition</h3>
<p>Eyes open ~10 days, ears open ~14-18 days. Begin to walk wobbly, start interacting with littermates, baby teeth erupt. <strong>Begin gentle daily handling now</strong> — a few minutes per kitten, every day. Voices, gentle touch, exposure to household sounds at low volume. This is the start of the socialisation window.</p>

<h3>Weeks 4-7 — the critical socialisation window</h3>
<p>The most important developmental period of the cat’s life. Kittens are highly receptive to learning what’s normal. Goals during this window:</p>
<ul>
<li><strong>Daily handling</strong> by multiple humans — different ages, voices, hand sizes</li>
<li><strong>Household sound exposure</strong> — vacuum running in the next room, doorbells, music, kitchen noise, calm conversation</li>
<li><strong>Surface variety</strong> — different textures of bedding, brief floor time on hardwood / tile / carpet</li>
<li><strong>Other-species contact</strong> when possible — calm dogs, gentle children. Closely supervised.</li>
<li><strong>Toy interaction</strong> — gentle wand-toy play in the last few weeks; teaches predatory sequence is welcome at humans’ initiation, not constantly</li>
</ul>
<p>Kittens this age also start eating solid food (around 4 weeks) and learning litter-box use from watching the mother.</p>

<h3>Weeks 7-12 — juvenile</h3>
<p>Eating solid food fully, weaning complete by 8-10 weeks (modern guidance says don’t separate from mother / littermates before 12-14 weeks even after weaning). Bite inhibition develops through play with siblings — kittens learn that biting too hard ends play. Kittens separated from siblings too early often grow up to be aggressive play-biters because they didn’t finish learning.</p>

<p>First vaccine series begins (FVRCP at 6-8 weeks, repeats at 10-12 and 14-16 weeks). Indoor-only at this stage.</p>

<h3>Weeks 12-16 — late kittenhood / adoption window</h3>
<p>Modern best-practice adoption window. Kitten can leave its mother and littermates with adequate emotional development. Strong attachment to humans forms quickly. Final core vaccines complete; rabies given at 12-16 weeks. Spay/neuter typically scheduled at 4-6 months.</p>

<p>Owners receiving a kitten in this window should focus on:</p>
<ul>
<li><strong>Carrier conditioning from day one</strong> — leave the carrier out as a normal piece of furniture; treat-pair</li>
<li><strong>Vet visits as low-stress</strong> — schedule a "happy visit" (no procedures, just treats from the vet techs) at 14-16 weeks</li>
<li><strong>Handling tolerance</strong> — daily gentle nail-trim simulation (touch paws, press to extend claw, treat), tooth-brushing acclimation, ear handling</li>
<li><strong>Resource setup</strong> — litter box already in place; food stations; vertical territory access; hiding spots</li>
</ul>

<h3>4-12 months — adolescence</h3>
<p>Often the most challenging phase for owners. Kittens lose their kitten-cuteness restraint and develop full-strength play drive. Furniture climbing, household redecoration, 3am zoomies. This is normal. The key intervention is <strong>structured wand-toy play 2-3× daily</strong> — give the predatory drive a target, end with food, the cat sleeps. Without it, the cat redirects onto curtains and your ankles.</p>

<p>Spay / neuter typically happens at 4-6 months. Discuss with vet — pediatric spay (8-16 weeks) is increasingly common for shelter cats and produces good outcomes, but private veterinary practice still tends toward 5-6 months. After spay/neuter, calorie needs drop about 25% — adjust food gradually to prevent post-spay weight gain (extremely common).</p>

<h3>12+ months — young adult</h3>
<p>By the first birthday, the cat is structurally an adult. Personality is largely set; activity levels start moderating from peak kitten energy. Transition from kitten food to adult food gradually over a week or two.</p>

<p>This is when you can start meaningful Personality Profile assessment — the 14+ days of check-ins and behaviour observations CatMD’s Personality Profile uses produce a stable archetype reading from this point onward.</p>

<h2>The single biggest owner mistake</h2>

<p>Bringing a kitten home before 12 weeks. The kittens removed at 8 weeks were an artefact of pet-store economics, not biology. Modern feline behaviour research consistently shows that kittens who stay with mother + littermates until 12-14 weeks develop better bite inhibition, social intelligence, and emotional regulation as adults. A few extra weeks of patience produces a noticeably better cat for the next 18 years.</p>

<p>The second biggest: under-stimulating a kitten. Boredom-aggression is real; kittens with insufficient daily play turn the household into prey. Wand toys, food puzzles, vertical climbing access from week 1 in your home. Five minutes of structured play 3× daily is the minimum.</p>

<h2>What this changes</h2>

<p>Most adult-cat behaviour problems trace back to gaps in the first 16 weeks. A cat that hides from visitors, a cat that bites during petting, a cat that hates the carrier, a cat that fears dogs — these are usually socialisation gaps, not "the cat’s personality." The window is real, but if you’ve adopted past it, the playbook is patient consistent counter-conditioning over months.</p>

<p>The cats with the easiest adult lives almost always had an unusually good first 16 weeks. The ones with the most behavioural problems almost always didn’t. That fact alone reshapes how you should think about adoption sources, breeder questions, and the calendar of your kitten’s first weeks at home.</p>
`,
  },
  ...ADDITIONAL_ARTICLES,
  ...ADDITIONAL_ARTICLES_2026_05_16,
  ...ADDITIONAL_ARTICLES_2026_05_17,
];
