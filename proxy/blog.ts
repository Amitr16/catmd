/**
 * CatMD blog — catmd.pet/blog
 *
 * Long-form founder/engineering posts (vs the SEO-medical library at
 * /library). Lives in its own module + route so the two streams don't
 * tangle: medical/triage articles are MedicalWebPage schema, written
 * for cat owners searching symptoms; blog posts are BlogPosting schema,
 * written for HN / AI newsletters / indie hackers / researchers.
 *
 * Mirrors the library architecture:
 *   - Served at /blog (index) and /blog/{slug}
 *   - Hero images at /blog/{slug}.webp (proxy/public/blog/)
 *   - Schema.org BlogPosting + BreadcrumbList per post
 *   - Sitemap auto-includes all post slugs
 *
 * To add a new post: append an entry to POSTS below + drop the hero
 * image into proxy/public/blog/{slug}.webp + deploy.
 */
import {
  buildPlayStoreUrl,
  renderAnalyticsScripts,
  renderSearchConsoleMeta,
} from './seoAndAnalytics';

export interface BlogPost {
  slug: string;
  title: string;
  /** ≤155 chars — used for OG, Twitter card, schema, meta description. */
  description: string;
  /** ISO date (YYYY-MM-DD). */
  datePublished: string;
  /** ISO date (YYYY-MM-DD). */
  dateModified: string;
  readMinutes: number;
  /** Topical tag — shown as kicker on the page. e.g. "Engineering". */
  category: string;
  /** Free-form keyword tags for the meta and JSON-LD. */
  tags: string[];
  /** Inline HTML body — same convention as library articles. */
  bodyHtml: string;
  /** Image alt text — descriptive, no keyword stuffing. */
  heroAlt: string;
}

const SITE_URL = 'https://catmd.pet';
const SITE_NAME = 'CatMD';
const AUTHOR_NAME = 'CatMD';

const IMAGE_BASE_PATH = '/blog';
const IMAGE_EXT = '.webp';
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

function heroImageUrl(slug: string): string {
  return `${SITE_URL}${IMAGE_BASE_PATH}/${slug}${IMAGE_EXT}`;
}

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

// ── shared CSS chrome ─────────────────────────────────────────────────────
// Same Warm Clinical palette as /library and /. Kept inline so each blog
// page is self-contained (no extra HTTP request, no FOUC).
const SHARED_STYLE = `
  :root {
    --cream:#FAF7F2; --cream-2:#F4EFE5; --sage:#3F6456; --sage-dark:#25403A;
    --sage-soft:#DCE6DE; --terracotta:#C97B63; --ink:#1F2024; --ink-2:#2E2D28;
    --muted:#7A7160; --border:#E6E0D3; --surface:#FFFFFF;
    --code-bg:#F4EFE5; --code-border:#E0D6BF;
    --ff-serif:'Fraunces','Iowan Old Style',Georgia,serif;
    --ff-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    --ff-mono:ui-monospace,'SF Mono','Cascadia Mono','JetBrains Mono',Menlo,monospace;
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
  .article blockquote{margin:24px 0;padding:8px 22px;border-left:3px solid var(--sage);
    background:var(--cream-2);border-radius:0 6px 6px 0;color:var(--ink-2);font-style:italic;}
  .article blockquote p{margin:8px 0;}

  table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:15px;}
  th,td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border);}
  th{font-weight:600;color:var(--ink);background:var(--cream-2);font-size:13px;
    text-transform:uppercase;letter-spacing:0.04em;}

  .article code{font-family:var(--ff-mono);font-size:14px;background:var(--code-bg);
    padding:2px 6px;border-radius:4px;border:1px solid var(--code-border);color:var(--ink);}
  .article pre{background:var(--code-bg);border:1px solid var(--code-border);
    border-radius:8px;padding:16px 18px;overflow-x:auto;margin:20px 0;
    font-size:13.5px;line-height:1.55;}
  .article pre code{background:transparent;border:0;padding:0;font-size:13.5px;}

  .app-cta{margin:48px 0 0;padding:32px 28px;background:var(--sage-dark);
    color:var(--cream);border-radius:16px;}
  .app-cta h3{font-family:var(--ff-serif);font-size:24px;margin:0 0 8px;color:var(--cream);
    font-variation-settings:"opsz" 48,"wght" 500;}
  .app-cta p{margin:0 0 18px;color:rgba(250,247,242,0.86);font-size:15px;}
  .app-cta a{display:inline-block;padding:12px 22px;background:var(--cream);
    color:var(--sage-dark);text-decoration:none;border-radius:999px;
    font-weight:600;font-size:15px;}
  .app-cta a:hover{background:#fff;}

  figure.hero{margin:28px 0 36px;border-radius:14px;overflow:hidden;
    background:var(--cream-2);border:1px solid var(--border);
    box-shadow:0 1px 2px rgba(31,32,36,.04);}
  figure.hero img{display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover;}

  .related{margin-top:48px;padding-top:32px;border-top:1px solid var(--border);}
  .related h3{font-family:var(--ff-serif);font-size:20px;margin:0 0 18px;}
  .related-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .related-card{padding:20px 22px;background:var(--surface);border:1px solid var(--border);
    border-radius:10px;text-decoration:none;transition:border-color .15s ease,transform .15s ease;}
  .related-card:hover{border-color:var(--sage);transform:translateY(-2px);}
  .related-card .rt{display:block;font-family:var(--ff-serif);font-size:17px;
    font-weight:500;color:var(--ink);margin-bottom:4px;line-height:1.35;}
  .related-card .rd{font-size:13px;color:var(--muted);line-height:1.5;}

  footer{border-top:1px solid var(--border);padding:32px 24px;background:var(--cream);
    font-size:13px;color:var(--muted);}
  footer .wrap{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;
    flex-wrap:wrap;gap:16px;align-items:center;}
  footer a{color:var(--muted);margin-left:20px;text-decoration:none;}
  footer a:hover{color:var(--sage);}

  /* Blog index card grid */
  .blog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:32px;}
  .blog-card{display:block;background:var(--surface);border:1px solid var(--border);
    border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;
    transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;}
  .blog-card:hover{transform:translateY(-3px);border-color:var(--sage);
    box-shadow:0 6px 24px -10px rgba(31,32,36,.18);}
  .blog-card .thumb{width:100%;aspect-ratio:1200/630;object-fit:cover;display:block;background:var(--cream-2);}
  .blog-card .body{padding:18px 20px 22px;}
  .blog-card .tag{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;
    font-weight:700;color:var(--sage);}
  .blog-card h3{font-family:var(--ff-serif);font-size:21px;line-height:1.25;
    margin:8px 0 8px;font-weight:500;color:var(--ink);font-variation-settings:"opsz" 32,"wght" 500;}
  .blog-card p{font-size:14.5px;line-height:1.55;margin:0;color:var(--ink-2);}
  .blog-hub-head{max-width:720px;margin:0 auto;padding:48px 24px 0;}
  .blog-hub-head h1{font-family:var(--ff-serif);font-size:clamp(36px,5vw,52px);margin:0 0 12px;
    font-variation-settings:"opsz" 96,"wght" 500;}
  .blog-hub-head p{font-size:18px;color:var(--ink-2);margin:0;max-width:600px;}
  .blog-hub{max-width:1100px;margin:0 auto;padding:32px 24px 80px;}

  @media (max-width:640px){
    .article{padding:32px 20px 60px;}
    .related-grid{grid-template-columns:1fr;}
  }
`;

const NAV_HTML = `
<nav class="top">
  <div class="wrap">
    <a class="logo" href="/">
      <svg viewBox="0 0 64 64" aria-hidden="true">
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
      <a href="/blog">Blog</a>
      <a href="/#features">Features</a>
      <a href="/#get">Get the app</a>
    </div>
  </div>
</nav>`;

const FOOTER_HTML = `
<footer>
  <div class="wrap">
    <div>&copy; ${new Date().getFullYear()} CatMD &middot; Informational only</div>
    <div>
      <a href="/">Home</a>
      <a href="/library">Library</a>
      <a href="/blog">Blog</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </div>
  </div>
</footer>`;

/**
 * App CTA renderer — UTM-tagged Play Store URL keyed to the post slug
 * so the install referrer SDK can attribute installs back to the
 * specific blog post that drove the click.
 */
function renderAppCtaHtml(slug: string): string {
  return `
<div class="app-cta">
  <h3>Try CatMD</h3>
  <p>The cat AI this post is about. 14-day free trial with full Pro access. No card on file.</p>
  <a href="${buildPlayStoreUrl('blog', slug)}">Get on Google Play</a>
</div>`;
}

const FAVICON_HTML = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='34' r='20' fill='%233F6456'/%3E%3Cpath d='M16 22 L20 10 L26 24 Z' fill='%233F6456'/%3E%3Cpath d='M48 22 L44 10 L38 24 Z' fill='%233F6456'/%3E%3Ccircle cx='26' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Ccircle cx='38' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3C/svg%3E" />`;

// ── render a single post ──────────────────────────────────────────────────
function renderBlogPostPage(post: BlogPost): string {
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
  const heroUrl = heroImageUrl(post.slug);
  const related = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': post.title,
      'description': post.description,
      'url': canonicalUrl,
      'datePublished': post.datePublished,
      'dateModified': post.dateModified,
      'inLanguage': 'en',
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
      'keywords': post.tags.join(', '),
      'articleSection': post.category,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'CatMD', 'item': SITE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Blog', 'item': `${SITE_URL}/blog` },
        { '@type': 'ListItem', 'position': 3, 'name': post.title, 'item': canonicalUrl },
      ],
    },
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#FAF7F2" />
<title>${escapeHtml(post.title)} — CatMD</title>
<meta name="description" content="${escapeHtml(post.description)}" />
<link rel="canonical" href="${canonicalUrl}" />
<meta property="og:title" content="${escapeHtml(post.title)}" />
<meta property="og:description" content="${escapeHtml(post.description)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:image" content="${heroUrl}" />
<meta property="og:image:width" content="${IMAGE_WIDTH}" />
<meta property="og:image:height" content="${IMAGE_HEIGHT}" />
<meta property="og:image:alt" content="${escapeHtml(post.heroAlt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(post.title)}" />
<meta name="twitter:description" content="${escapeHtml(post.description)}" />
<meta name="twitter:image" content="${heroUrl}" />
<meta name="twitter:image:alt" content="${escapeHtml(post.heroAlt)}" />
${FAVICON_HTML}
${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600&family=Inter:wght@400;500;600;700&display=swap" />
${jsonLd.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
<style>${SHARED_STYLE}</style>
</head>
<body>
${NAV_HTML}

<article class="article">
  <div class="kicker"><a href="/blog">Blog</a> &middot; ${escapeHtml(post.category)}</div>
  <h1>${escapeHtml(post.title)}</h1>
  <div class="meta">
    <span>${post.readMinutes} min read</span>
    <span class="dot"></span>
    <span>Published ${formatDate(post.datePublished)}</span>
  </div>

  <figure class="hero">
    <img
      src="${heroUrl}"
      alt="${escapeHtml(post.heroAlt)}"
      width="${IMAGE_WIDTH}"
      height="${IMAGE_HEIGHT}"
      loading="eager"
      fetchpriority="high"
      decoding="async"
    />
  </figure>

  ${post.bodyHtml}

  ${renderAppCtaHtml(post.slug)}

  ${related.length > 0 ? `
  <div class="related">
    <h3>More from the blog</h3>
    <div class="related-grid">
      ${related
        .map(
          (r) => `
      <a class="related-card" href="/blog/${r.slug}">
        <span class="rt">${escapeHtml(r.title)}</span>
        <span class="rd">${escapeHtml(r.description)}</span>
      </a>`,
        )
        .join('')}
    </div>
  </div>` : ''}
</article>

${FOOTER_HTML}
</body>
</html>`;
}

// ── render the index ──────────────────────────────────────────────────────
export function renderBlogIndex(): string {
  const canonicalUrl = `${SITE_URL}/blog`;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'name': 'CatMD Blog',
    'description': 'Engineering notes, design decisions, and applied research from building CatMD — a cat companion AI.',
    'url': canonicalUrl,
    'inLanguage': 'en',
    'isPartOf': { '@id': `${SITE_URL}/#site` },
    'blogPost': POSTS.map((p) => ({
      '@type': 'BlogPosting',
      'headline': p.title,
      'url': `${SITE_URL}/blog/${p.slug}`,
      'datePublished': p.datePublished,
      'dateModified': p.dateModified,
      'description': p.description,
      'image': heroImageUrl(p.slug),
    })),
  };

  const cards = POSTS.map(
    (p) => `
    <a class="blog-card" href="/blog/${p.slug}">
      <img class="thumb" src="${heroImageUrl(p.slug)}" alt="${escapeHtml(p.heroAlt)}" loading="lazy" decoding="async" width="600" height="315" />
      <div class="body">
        <span class="tag">${escapeHtml(p.category)} &middot; ${p.readMinutes} min</span>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description)}</p>
      </div>
    </a>`,
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#FAF7F2" />
<title>CatMD Blog — Engineering notes from a cat AI</title>
<meta name="description" content="Engineering notes, design decisions, and applied research from building CatMD — a cat companion AI." />
<link rel="canonical" href="${canonicalUrl}" />
<meta property="og:title" content="CatMD Blog" />
<meta property="og:description" content="Engineering notes from building a cat AI that tries not to be slop." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonicalUrl}" />
${FAVICON_HTML}
${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600;700&display=swap" />
<script type="application/ld+json">${JSON.stringify(collectionLd)}</script>
<style>${SHARED_STYLE}</style>
</head>
<body>
${NAV_HTML}

<header class="blog-hub-head">
  <div class="kicker">Blog</div>
  <h1>Notes from building CatMD.</h1>
  <p>Engineering, design, and applied research from a solo founder shipping a cat AI that tries not to sound like one.</p>
</header>

<main class="blog-hub">
  <div class="blog-grid">${cards}</div>
</main>

${FOOTER_HTML}
</body>
</html>`;
}

/** Look up a post by slug and render its page. Returns null if not found. */
export function renderBlogPostBySlug(slug: string): string | null {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return null;
  return renderBlogPostPage(post);
}

/** Return all post slugs — used by sitemap generator. */
export function getBlogSlugs(): { slug: string; lastmod: string }[] {
  return POSTS.map((p) => ({ slug: p.slug, lastmod: p.dateModified }));
}

// ── posts ─────────────────────────────────────────────────────────────────

const POSTS: BlogPost[] = [
  {
    slug: 'cat-ai-is-going-to-be-slop',
    title: 'Cat AI is going to be slop. Here’s how we tried not to be.',
    description:
      'A 4-tier voice quality gate, a 15-mood daily lottery, pop-culture voice modes, and 17 rounds of audit. The architecture behind a cat AI that tries not to sound generic.',
    datePublished: '2026-05-15',
    dateModified: '2026-05-15',
    readMinutes: 11,
    category: 'Engineering',
    tags: ['AI cat app', 'voice quality gate', 'mood lottery', 'LLM output gating', 'cat companion AI'],
    heroAlt:
      'A thoughtful cat sitting at a small writing desk in soft afternoon light — hero illustration for an essay on the architecture of believable cat AI voice',
    bodyHtml: `
<p>There are about to be a lot of cat AI apps. Most of them are going to be slop.</p>

<p>I know this because I've been building one for six months, and the first version I shipped was slop. I shipped it, looked at the diary entries, and felt the specific embarrassment of recognising your own product as the same generic "your furry friend had a purr-fect day!" texture I see in every other pet AI demo on Twitter.</p>

<p>So I rebuilt it. Not the app — the <em>voice</em>. The architecture under the cat's words. This post is about what's underneath, because I think the next wave of cat AI (and pet AI generally, and probably a lot of "AI companion" products) is going to be downstream of the same problems and the same solutions.</p>

<p>Skip this if you don't care about AI craft. Read on if you've ever wondered why most LLM creative output feels the same regardless of which product wraps it.</p>

<h2>What slop looks like</h2>

<p>Run a generic GPT-4 with the prompt <em>"You are a cat named Lily. Write a one-sentence diary entry for today."</em> — you get something like this:</p>

<blockquote><p>"Today was a wonderful day filled with cozy naps and playful moments with my favorite human!"</p></blockquote>

<p>There is nothing factually wrong with this sentence. It is also unusable. A cat would not write it. Nobody would screenshot it. Nobody would share it. It carries the texture of generic warmth — the same texture every AI assistant settles into when asked to be cheerful about anything.</p>

<p>Now look at what we want:</p>

<blockquote><p>"My kibble. Is. The wrong shape."</p></blockquote>

<p>Or:</p>

<blockquote><p>"I had a plan. The plant was the target. The bowl, a distraction. It held."</p></blockquote>

<p>Or:</p>

<blockquote><p>"You've been quiet today. I noticed. I always notice."</p></blockquote>

<p>Same model. Same input data. Wildly different output because of what we put around the prompt.</p>

<p>The architecture of <em>not slop</em> is the whole thing. Here's what's in it.</p>

<h2>Layer 1: a 15-mood daily lottery</h2>

<p>Most AI products give the model a single voice — a personality string baked into the system prompt that never changes. The user opens the app on Tuesday and gets the same flavour as Monday and Wednesday.</p>

<p>We took the opposite approach, borrowed from Co-Star (the horoscope app that built a cult on daily anticipation): <strong>the cat wakes up in a different mood every day</strong>. Fifteen possible moods, deterministically picked per-cat-per-date, ranging across five clusters:</p>

<ul>
<li><strong>Warm:</strong> affectionate, cozy, chosen, attuned</li>
<li><strong>Joy:</strong> playful, mischievous, curious</li>
<li><strong>Flavor:</strong> theatrical, philosophical</li>
<li><strong>Sass:</strong> sarcastic, roasting, imperious</li>
<li><strong>Dark:</strong> grumpy, indignant, megalomania</li>
</ul>

<p>Same cat. Multiplied range. Same Velcro-Cat archetype reads completely differently when she wakes up imperious (<em>"This is my house. I let you live here."</em>) versus when she wakes up chosen (<em>"I chose the chair near you. The chair chose me back."</em>).</p>

<p>The lottery is a weighted random with four layered modifiers:</p>

<pre><code>effective_weight = base × archMod × todayMod × feedbackMod^1.5</code></pre>

<p>Each modifier captures a different time horizon:</p>

<ul>
<li><strong>base:</strong> the mood's natural frequency (cozy weighs 4, megalomania weighs 2)</li>
<li><strong>archMod:</strong> the cat's personality (Velcro-Cat boosts warm moods 1.7×, suppresses imperious to 0.4×)</li>
<li><strong>todayMod:</strong> today's actual signals — body language tags from the last Read Cat session, meow translations, weather, weight trend, water intake, pain score, today's check-in mood. A thunderstorm pulls toward attuned; an off-day check-in pulls toward dark</li>
<li><strong>feedbackMod:</strong> which moods THIS user has historically shared. Raised to the 1.5th power so user preference dominates archetype after enough data — if you've shared 4× more on Cozy days than baseline, Cozy gets ~3–4× more lottery weight going forward</li>
</ul>

<p>The exponent matters. Without it, archetype dominates forever and the app feels static. With it, user behaviour bends the cat over weeks toward the moods that user actually loves.</p>

<p>A 7-day cold-start gate prevents one share on day 1 from pinning the lottery to a single mood. Until each mood has been exposed at least five times, the feedback term stays neutral.</p>

<h2>Layer 2: pop-culture voice modes</h2>

<p>Here's where it gets interesting.</p>

<p>There's an HCI paper from last year — <em>AI Cat Narrator</em> by Lai, Huang, and Liang (arXiv 2406.06192). They built an AI tool that writes cat-perspective narratives and discovered something useful: <strong>factual-only training produces mundane voice</strong>. Their fix was a technique called <em>defamiliarization</em> — blending real cat-ethnographic data with literary fiction (specifically Natsume's <em>I am a Cat</em>, a 1906 Japanese novel narrated by a cat).</p>

<p>Their finding held: the literary-blended version produced more empathetic, more individualised cat voice. Their training source — a 1906 novel — does not.</p>

<p>Our users are watching Bridgerton. They're posting Phoebe Bridgers lyrics on Instagram. They're quoting Drag Race confessionals in group chats. They are <em>not</em> reading 119-year-old Japanese fiction.</p>

<p>So we took the insight and changed the references. Fifteen voice modes, one per mood, each described in generic stylistic terms (we don't name celebrities or shows in the prompt — likeness risk, brittle to cultural rotation):</p>

<table>
<thead><tr><th>Mood</th><th>Voice mode</th><th>Shape</th></tr></thead>
<tbody>
<tr><td>affectionate</td><td>earnest small-revelation</td><td><em>"I waited. I would have waited longer."</em></td></tr>
<tr><td>chosen</td><td>quiet affirming, gratitude-journal cadence</td><td><em>"I chose the chair near you. The chair chose me back."</em></td></tr>
<tr><td>cozy</td><td>deadpan symmetrical observation</td><td><em>"Today I sat in three places. The second was best."</em></td></tr>
<tr><td>playful</td><td>chaotic-internet exclamation</td><td><em>"EXCUSE ME?? the AUDACITY of this paper bag. I cannot."</em></td></tr>
<tr><td>mischievous</td><td>heist-voiceover plotting</td><td><em>"I had a plan. The plant was the target. The bowl, a distraction. It held."</em></td></tr>
<tr><td>curious</td><td>anxious-meta-observer</td><td><em>"Is the bird watching me back? Statistically, probably."</em></td></tr>
<tr><td>theatrical</td><td>period-drama society-narrator</td><td><em>"Dearest. You will NEVER guess what arrived in the bowl."</em></td></tr>
<tr><td>philosophical</td><td>sad-singer-songwriter wistful</td><td><em>"I knocked the cup over. Watched it. Felt everything. Felt nothing."</em></td></tr>
<tr><td>attuned</td><td>direct-address vulnerable</td><td><em>"You've been quiet today. I noticed. I always notice."</em></td></tr>
<tr><td>sarcastic</td><td>petty-grievance escalator</td><td><em>"My water dish has been moved. Six inches. SIX."</em></td></tr>
<tr><td>roasting</td><td>mock-pitying confessional read</td><td><em>"Listen. The dog. Tried it. Did. Not. Serve."</em></td></tr>
<tr><td>imperious</td><td>tired-domestic-patriarch</td><td><em>"This is my house. I let you live here."</em></td></tr>
<tr><td>grumpy</td><td>sitcom-grump</td><td><em>"My kibble. Is. The wrong shape."</em></td></tr>
<tr><td>indignant</td><td>reality-TV-confessional outrage</td><td><em>"I have never been so DISRESPECTED in my entire life."</em></td></tr>
<tr><td>megalomania</td><td>corporate-villain monologue</td><td><em>"You are not serious people. Bring me the bird."</em></td></tr>
</tbody></table>

<p>These are calibration shapes, not templates. The model sees the descriptor and the example shape, and writes its own variant grounded in the cat's actual world. The voice mode tilts cadence and attitude. Grounding (which objects can appear, who the cat knows) is enforced separately.</p>

<h2>Layer 3: the voice quality gate</h2>

<p>Even with mood + voice mode dialled in, LLM output is non-deterministic. Roughly 5–15% of generations slip into slop — saccharine pet-app cliché, assistant-register apology, invented named entities (the model decides the cat has a friend named "Mr. Mittens" who doesn't exist), or output too long to fit a postcard.</p>

<p>So we built a post-generation gate. Pure function, no AI calls, deterministic. It runs on every chat reply, every diary share-line, every postcard caption.</p>

<p>The gate is a 4-tier flow:</p>

<pre><code>1. evaluate → numeric score + failure reasons
2. if ok → ship
3. if not ok → retry with directive injection (one shot, LLM call)
4. if retry recovered → ship
5. if retry still fails → mechanical repair (truncate, strip cliché)
6. if mechanical repair scores ok → ship
7. else → safe neutral fallback (one of N hand-written lines)</code></pre>

<p>Scoring is heuristic. The current version (it'll keep evolving) has:</p>

<p><strong>Negative signals</strong> (subtract):</p>
<ul>
<li>Banned phrases — "your furry friend", "purrfect", "fluff ball", "I'm here for you", "as an AI", "I recommend", "consult your vet" (medical-advice register is forbidden in cat voice)</li>
<li>Generic praise — "today was wonderful", "best human ever", "love you to the moon"</li>
<li>Unsupported named entity — capitalised words that aren't in the cat's known subjects + a small allowlist (days, months, "I")</li>
<li>Assistant voice patterns</li>
<li>Length overflow per surface (postcard 12 words, diary 18, chat 45)</li>
</ul>

<p><strong>Positive signals</strong> (add):</p>
<ul>
<li>Concrete anchor — a known object from YOUR WORLD, a body part, a time-of-day, a weather reference</li>
<li>First-person cat POV (uses I/my/me; doesn't start with narrator-pattern "the cat sat")</li>
<li>Flavor — decisive verbs ("decided", "allowed", "permitted"), cat-evaluative qualifiers ("adequate", "insufficient"), temporal precision ("again", "still")</li>
<li>Standalone quotability — doesn't start with dependent clauses ("yes", "but", "it")</li>
</ul>

<p>Each surface has its own threshold. Postcard needs the highest score; chat in medical context softens the bar — a clear, careful triage reply beats a quotable one.</p>

<p>The retry directive is generated from the specific failures. If the model used a banned phrase, the retry prompt names it: <em>"Your previous reply used 'furry friend'. Forbidden. Try again — keep the warmth but use a specific anchor instead."</em> If the output was too long, the directive is <em>"Previous reply was 18 words. Postcards cap at 12. Compress without losing the punchline."</em></p>

<p>Retries succeed about 70–80% of the time in our internal testing. The remaining cases fall through to mechanical repair (which strips known-bad phrases without inventing replacements) or the safe neutral pool (a small set of hand-written lines that always score above threshold). The cat never goes silent.</p>

<h2>Layer 4: grounding (YOUR WORLD)</h2>

<p>The cat can't reference things that aren't real. Most LLM cat outputs hallucinate household objects — they reach for "the radiator", "sunbeams", "Mr. Mittens" — because the training data is full of generic cat content set in northern-temperate homes with imaginary friends.</p>

<p>Our prompts enforce a separate context block: <strong>YOUR WORLD</strong> — a list of objects, places, toys, weather, and known people/pets that this specific cat has actually been around. Built up over time from:</p>

<ul>
<li>Photos analysed by a silent vision pass that extracts objects ("teapot", "rug", "balcony", "window") and recurring places</li>
<li>Body-language reads tagged with detected props</li>
<li>Explicit user mentions in chat ("Lily knocked over the kettle today") via marker extraction</li>
<li>Weather snapshots (opt-in location → Open-Meteo)</li>
<li>Known subjects from the subject directory (people, pets, named visitors)</li>
</ul>

<p>Every prompt that generates voice includes YOUR WORLD as a literal list, with the directive: <em>"When you reference a physical object in your reply, it MUST come from YOUR WORLD. If YOUR WORLD lacks a suitable object, omit the prop and lean on time-of-day / human-posture / abstract reference instead."</em></p>

<p>The voice quality gate enforces this from the output side: capitalised proper-noun candidates not in the cat's <code>knownSubjects + catName</code> allowlist hard-fail. The cat literally cannot invent a "Mr. Mittens" without it getting caught.</p>

<p>Same with weather. If the cat is in Singapore on a 32°C day, the system never mentions "the radiator" or "sunbeams" by default — because those are climate-specific props that don't exist in YOUR WORLD. The prompts call this out explicitly.</p>

<p>This is the single biggest difference between our voice and generic LLM cat voice. The cat sounds <em>real</em> because it can't talk about things that aren't.</p>

<h2>Layer 5: the audit loop</h2>

<p>The voice quality gate, the mood lottery, the voice modes, the grounding — none of this happened in a planning doc. It happened across 17 rounds of audit, every round driven by a third-party AI reviewer (Codex) and verified by 80+ fixture tests before each ship.</p>

<p>The audit cadence looks like:</p>

<ol>
<li>Codex does a read-only pass over a specific slice (mood architecture / date-boundary / voice quality / etc.)</li>
<li>Returns P1/P2/P3 findings with file paths and line numbers</li>
<li>I fix each finding, with a code comment citing the audit round</li>
<li>Run TypeScript compile, ESLint, 47 date-boundary fixture tests, 33 voice quality + voice mode tests</li>
<li>All green → ship to internal testing</li>
<li>Re-audit. Repeat.</li>
</ol>

<p>Findings from rounds 1–17 that ended up in production:</p>

<ul>
<li>Diary backfill date contamination (writing yesterday's entry was leaking today's weather into the mood)</li>
<li>Postcard subject memory not filtering the active cat (the cat was being tagged as her own visitor)</li>
<li>Water "low" inference firing on zero-log days (no log ≠ drank less; we now require ≥1 log to call direction)</li>
<li>Weight trend signal not wired to the mood lottery (existed in the type but no callsite passed it)</li>
<li>Emergency-tier scan not routing to dark mood pool (chat could be playful on a medically grave day)</li>
<li>Recurring subjects pulling forward from after the diary's target date (Mom tagged on May 10 was showing up in the May 5 backfill)</li>
</ul>

<p>This loop is the actual moat. Not the architecture — the relentlessness. Anyone can read this post and copy the patterns. Few will run 17 audit rounds against their own code before launch.</p>

<h2>What we measure</h2>

<p>The four-layer mood lottery would be a hypothesis without measurement. Every voice mode firing carries an analytics tag — <code>petty_grievance</code>, <code>wes_anderson_deadpan</code>, <code>period_drama_narrator</code>, etc. — that joins to the share funnel:</p>

<ul>
<li><code>mood_exposed</code> — fires the first time a mood lands today (deduped per-cat-per-day)</li>
<li><code>chat_session_in_mood</code> — chat opened during this mood</li>
<li><code>daily_card_shared</code> — the strongest signal. User screenshotted / shared a card / postcard from this mood</li>
</ul>

<p>PostHog formulas across this give us per-mode share rate per cat. We watch which voice modes drive the most shares per exposure and feed that back into the lottery weights via the user-feedback layer. The cat genuinely bends, over weeks, toward the voice the owner most loves.</p>

<p>Same for the voice quality gate — we watch <code>voice_quality_retried</code> (recovery rate when the first generation fails) and <code>voice_quality_fallback</code> (how often we hit mechanical repair). Both numbers are visible on a dashboard. Both should be going DOWN over time as the prompts improve.</p>

<h2>What I think actually matters</h2>

<p>If you take one thing from this post: <strong>post-generation gates beat better prompts.</strong> Engineers spend a lot of time perfecting their system prompt; that work has sharp diminishing returns. The single biggest quality lift we got was building a deterministic, testable gate that runs AFTER the LLM, evaluates output against a clear rubric, and either ships or retries.</p>

<p>Prompts are non-deterministic. Gates are. You should not ship LLM creative output to production without a gate.</p>

<p>The second thing: <strong>architectural layering &gt; monolithic prompt</strong>. Mood, voice mode, archetype, today's signals, YOUR WORLD, grounding rules — each lives in its own module with its own tests. The full prompt at runtime is composed from 8+ structured inputs. Most people stuff everything into one growing system prompt that becomes unmaintainable around prompt token 4,000.</p>

<p>The third thing: <strong>measure the right thing</strong>. Share rate per voice mode per cat is the metric that closes the loop. Token usage is not. CSAT is not. Anything you can't tie back to "did this specific generation produce a screenshotable moment" is noise.</p>

<p>The fourth thing: <strong>citations matter even in indie product work</strong>. The mood lottery is downstream of Co-Star. The voice modes are downstream of Lai/Huang/Liang. The voice quality gate is downstream of a dozen smaller observations I'd be happy to credit if I could remember the threads. Naming the prior art keeps you honest about what's novel and what isn't.</p>

<h2>Try it</h2>

<p>CatMD is live on Google Play: <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=cat-ai-is-going-to-be-slop"><strong>play.google.com/store/apps/details?id=com.catmd.app</strong></a>. 14-day free trial, full Pro access, no card on file.</p>

<p>Built solo with Claude Code as pair programmer, in Singapore, over fourteen days. Source for posts like this one lives on <a href="/blog">catmd.pet/blog</a>.</p>

<p>The cat in your life is one of one. The AI that talks for her shouldn't sound generic.</p>
`,
  },

  {
    slug: 'from-natsume-to-bridgerton',
    title: 'From Natsume to Bridgerton: how an HCI paper changed our cat AI',
    description:
      'An HCI paper validated defamiliarization as the lever for non-mundane LLM cat voice. Their reference set was 1906 Japanese literary fiction. We translated it to pop culture our users actually recognise.',
    datePublished: '2026-05-15',
    dateModified: '2026-05-15',
    readMinutes: 7,
    category: 'Applied research',
    tags: ['AI Cat Narrator', 'defamiliarization', 'HCI research', 'LLM voice', 'pop culture references'],
    heroAlt:
      'A dignified cat in a softly-lit drawing room beside a small stack of books — hero illustration for an essay on translating HCI research into cat AI voice modes',
    bodyHtml: `
<p>Last week I was deep in a stack of generic LLM cat replies — <em>"today was a wonderful day filled with purrs!"</em> — trying to figure out why every cat AI on the market sounds like the same Hallmark card. I came across a paper that ended up being one of the most directly applicable pieces of research I've ever ported into a product.</p>

<p><strong>Lai, Huang, Liang. <em>AI Cat Narrator: Designing an AI Tool for Exploring the Shared World and Social Connection with a Cat</em>. arXiv 2406.06192 (2024).</strong></p>

<p>This post is for them, and for anyone who builds creative AI products. Their insight was real. Their reference set was wrong for our users. The translation between the two is where the interesting work happened.</p>

<h2>What they found</h2>

<p>The paper introduces a tool called the <em>AI Cat Narrator</em> — an LLM-based system that generates first-person cat-perspective narratives from ethnographic data (camera footage of a cat's daily life, owner interviews, observed behavioural traits).</p>

<p>Their core technique is <em>defamiliarization</em> — a deliberately ambiguous, evocative register adapted from literary fiction. They built two versions of the narrator: one trained purely on factual ethnographic data, and one trained on the factual data <strong>plus excerpts from Natsume Sōseki's 1906 novel <em>I am a Cat</em></strong>, a novel famously narrated by a cat observing Meiji-era Japan.</p>

<p>The factual-only version produced "mundane narratives that stick to reality and lack engaging personalized storytelling."</p>

<p>The factual+fictional version produced narratives "with deeper emotional resonance" that "more effectively capture and express the unique personalities of cats."</p>

<p>That's the headline. And it tracks with everything I've seen building creative LLM features: pure factual grounding produces flat output. You need a stylistic reference to anchor the voice in something with personality.</p>

<p>The mechanism they propose — <em>defamiliarization</em> — is the practice of presenting familiar material in unfamiliar ways. In the cat-narrative context, it means: a cat doesn't describe its own day the way a human would describe a cat's day. The framing should be strange enough to invite re-reading.</p>

<p>I think this is right. Their applied result — using Natsume — is also right in a research-paper context. It would not have landed for our actual users.</p>

<h2>Why Natsume doesn't ship</h2>

<p>CatMD's user base is — based on the early demographic data — predominantly female, millennial / Gen-X, urban, smartphone-native, terminally online. They watch Bridgerton. They post Phoebe Bridgers lyrics on Instagram. They quote Drag Race confessionals in group chats. They consume an enormous amount of contemporary culture per day and they have ruthless attention budgets.</p>

<p>If our cat AI dropped a 1906 Japanese-literary register into the daily diary entry, the typical user would not recognise the reference, would not be flattered by it, and would scroll past. The defamiliarization would land as confusion, not as wonder.</p>

<p>The literary reference is doing a real job in the paper. But the job is <em>recognisable distinct voice</em> — not <em>that specific voice</em>. The same defamiliarization function could be served by any voice the audience instantly recognises as having its own personality. For our audience, that's pop culture, not literary fiction.</p>

<p>So I sat down and tried to enumerate the cat-narrator voices our actual users would recognise instantly. Here's what made the list:</p>

<table>
<thead><tr><th>Cultural register</th><th>What it sounds like</th><th>Mood it fits</th></tr></thead>
<tbody>
<tr><td>Wes Anderson deadpan</td><td>symmetrical, listed, gently melancholy</td><td>cozy</td></tr>
<tr><td>Bridgerton period-drama society narrator</td><td>formal direct address, faux-scandalised</td><td>theatrical</td></tr>
<tr><td>Phoebe Bridgers / sad-girl singer-songwriter</td><td>wistful, observed-then-felt, ironic on melancholy</td><td>philosophical</td></tr>
<tr><td>Stan Twitter chaos</td><td>clipped phrases, ALL-CAPS bursts, mock outrage</td><td>playful</td></tr>
<tr><td>Heist movie voiceover (Ocean's 11)</td><td>conspiratorial, plotting, tactical clauses</td><td>mischievous</td></tr>
<tr><td>Anxious-millennial meta-observer (Bo Burnham)</td><td>questions chained, statistical hedging</td><td>curious</td></tr>
<tr><td>Fleabag direct-address vulnerability</td><td>second person, says the unsaid thing</td><td>attuned</td></tr>
<tr><td>Larry David / Seinfeld grump</td><td>minor injustice = major crisis</td><td>grumpy</td></tr>
<tr><td>Drag Race confessional read</td><td>mock-pitying, "did NOT serve" cadence</td><td>roasting</td></tr>
<tr><td>Real Housewives confessional outrage</td><td>extreme adjectives for mundane slights</td><td>indignant</td></tr>
<tr><td>Wellness influencer affirmation</td><td>gratitude-journal cadence, ceremonial small choices</td><td>chosen</td></tr>
<tr><td>Corporate-villain monologue</td><td>slow deliberate cadence, references to "plans"</td><td>megalomania</td></tr>
<tr><td>Tired-domestic-patriarch (Tony Soprano at home)</td><td>weary edicts, household as fiefdom</td><td>imperious</td></tr>
<tr><td>Sitcom-grump punctuated complaint</td><td>single-word sentences for emphasis</td><td>sarcastic</td></tr>
<tr><td>Pixar-narrator earnest tenderness</td><td>sincere, no irony, restraint as warmth</td><td>affectionate</td></tr>
</tbody></table>

<p>Fifteen registers. One per daily mood in our existing mood lottery (15 moods chosen for unrelated product reasons — coincidentally a clean 1:1 mapping fell out).</p>

<h2>The legal-safety pivot</h2>

<p>Naming Phoebe Bridgers or Drag Race in a system prompt is a problem. Three reasons:</p>

<ol>
<li><strong>Likeness / right-of-publicity risk</strong> — telling an LLM to write "in the style of Phoebe Bridgers" could plausibly violate her right of publicity in some jurisdictions, even if the output is original. There's no settled case law and indie founders shouldn't be the test case.</li>
<li><strong>Cultural rotation</strong> — Phoebe Bridgers is a 2020-2024 reference. Bridgerton is a 2020-2025 reference. If we leave the prompts that way and re-read in 2030, both might be ancient references — but the descriptors like "sad-girl singer-songwriter" and "period-drama society narrator" will still parse. We want registers that survive.</li>
<li><strong>Over-imitation</strong> — when you tell an LLM to write "like X", it tries to recall X's actual catchphrases and known lines. We don't want the cat saying lines from Bridgerton dialogue. We want the cat saying its own things, in the <em>shape</em> of that register.</li>
</ol>

<p>So every voice mode descriptor in the codebase is a generic stylistic pattern. The system prompt sees this:</p>

<pre><code>## Voice mode

Period-drama society-narrator register — formal direct address
("dearest" / "well now"), faux-scandalised exclamation, gossipy
gravitas about household trivia. ONE capitalised word per reply
for emphasis. Refer to the human as "you" — never "human" /
"reader" / "dear one". Never break the formality.

Shape example (calibrate the RHYTHM and ATTITUDE, do NOT copy
the words): "Dearest. You will NEVER guess what arrived in
the bowl."</code></pre>

<p>No Bridgerton. No Lady Whistledown. Just the <em>shape</em> of the voice. The model writes its own variant in that shape, grounded in the cat's actual world.</p>

<h2>What I think Lai, Huang, and Liang got most right</h2>

<p>The deepest insight in their paper isn't the <em>I am a Cat</em> reference. It's the framing that <strong>the cat's voice has to come from somewhere distinct</strong>. Otherwise it defaults to the mean of the training data — which, for LLMs, is a register I would describe as "well-meaning corporate cheerfulness."</p>

<p>You need a stylistic anchor. Their anchor was literary. Ours is contemporary. Either one closes the loop, as long as the anchor is recognisably individual.</p>

<p>I'd also flag a point they make in passing that ended up being central to our voice quality gate: <strong>first-person POV reveals interaction details that third-person POV misses.</strong> A third-person narrator describes a cat. A first-person cat describes the <em>texture</em> of being a cat. The latter is harder for LLMs to do well, which is exactly why it produces more individual-feeling output when you DO get it right.</p>

<p>This is the reason chat replies in CatMD are first-person ("My kibble. Is. The wrong shape.") rather than diary-style narration. The first-person constraint forces the model out of generic narrator voice into a specific embodied register.</p>

<h2>What I'd ask if I could ask them</h2>

<p>Three questions for the authors, if any of you read this:</p>

<ol>
<li><strong>Did you test domain transfer?</strong> Did you try the <em>I am a Cat</em> version on subjects who hadn't read the novel — vs subjects who had — and measure whether the literary reference itself was doing work, or whether ANY distinct stylistic anchor would have produced the same lift?</li>
<li><strong>Hallucination guardrails?</strong> Your factual+fictional version sounds harder to ground in real cat data — the fictional layer encourages "openness and unpredictability" which is great for individuation but dangerous for product safety. We solved this with a deterministic output gate that hard-fails on invented household objects or named entities. Did your tool have anything similar, or did you trust the model + ethnographic prompt to stay grounded?</li>
<li><strong>Mood / time-of-day stratification?</strong> Your AI Cat Narrator was a single voice. Did you experiment with multiple voice-modes per cat — different registers for different days, moods, or contexts — and did that improve or hurt the "individualisation" your evaluators felt?</li>
</ol>

<p>I'd genuinely love to talk about any of this. I'm Singapore-based, ship as a solo founder, and the indie / academic gap on AI-companion design is huge — most of the good ideas in this space are sitting in HCI papers nobody outside the field reads.</p>

<h2>What this means for AI product teams</h2>

<p>If you're building a creative AI product (cat AI, character chat, AI letters, AI horoscopes, anything that needs to <em>sound</em> like something), I think the actionable takeaway from this paper is:</p>

<ol>
<li><strong>Identify your voice deficit first.</strong> Generate a hundred outputs with your current system prompt. Read them. If they feel generic, the deficit is in your stylistic anchor, not in your factual grounding.</li>
<li><strong>Pick a recognisable register, not a literal style.</strong> Your users have a media diet. Your voice anchors should live inside it.</li>
<li><strong>Describe the shape, not the source.</strong> Never name the celebrity or show in the prompt. Describe the cadence, attitude, sentence patterns. This is legally safer and works better.</li>
<li><strong>One register per context.</strong> If you only have one voice mode active across all situations, you have a personality. If you have one voice mode per mood / context / time-of-day, you have a <em>character</em> — and the variation is itself a product feature.</li>
<li><strong>Gate the output.</strong> Stylistic anchors increase the variance of LLM output. Some of that variance is good (the deeper resonance the paper describes); some is bad (off-register, hallucinated, slop). A deterministic post-generation evaluator catches the bad cases without limiting the good ones.</li>
</ol>

<h2>Credits</h2>

<p>The 15-voice-mode system in CatMD is a direct descendant of the AI Cat Narrator paper's defamiliarization technique. If their work isn't on your radar and you build creative LLM features, read it.</p>

<p>CatMD is live on Google Play: <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=from-natsume-to-bridgerton"><strong>play.google.com/store/apps/details?id=com.catmd.app</strong></a>. Built solo, Singapore. More on the architecture at <a href="/blog">catmd.pet/blog</a>.</p>
`,
  },

  {
    slug: 'shipped-catmd-in-14-days-with-claude',
    title: 'I shipped a cat AI app in 14 days with Claude as pair programmer. Here’s the playbook.',
    description:
      'Solo dev, Singapore-based, zero outside funding. From create-expo-app to Google Play production in fourteen days. The workflow, the audit loop, what Claude was good at, what it wasn’t.',
    datePublished: '2026-05-15',
    dateModified: '2026-05-15',
    readMinutes: 9,
    category: 'Build log',
    tags: ['Claude Code', 'AI pair programming', 'indie hacker', 'AI cat app', 'audit-driven development'],
    heroAlt:
      'A cat curled on the corner of a wooden desk next to an open laptop in late-afternoon light — hero illustration for a build log on shipping an AI app solo in 14 days',
    bodyHtml: `
<p>Two weeks ago CatMD didn't exist on Google Play. As of today it's live in production, in 177 countries, with 14 internal testers running real cats through it daily. Solo dev. Singapore-based. Zero outside funding. Claude Code as pair programmer the whole way.</p>

<p>This is the playbook. Not the marketing version — the actual workflow, the decisions, the things that broke, the things I'd do differently.</p>

<p>If you're an indie founder thinking about shipping an AI product, here's what worked.</p>

<h2>What CatMD is, briefly</h2>

<p>A first-person cat companion app. Daily AI-generated diary in the cat's voice, chat where you can talk to your cat, postcards for sharing, scan-based vet triage, body language reader (analyses 6-second video clips of your cat), meow translator (audio + frames + memory → cat-voice translation), personality archetype (Feline Five framework), 30-day health rhythm dashboard.</p>

<p>Under the hood: Expo / React Native (SDK 54), Zustand stores with Supabase cloud mirror, Cloudflare Worker proxy to OpenAI, RevenueCat for paywall, PostHog analytics, Sentry for crashes.</p>

<p>About 50k lines of TypeScript across <code>src/</code> and <code>app/</code>. ~1,000 lines of test fixtures. 47 date-boundary tests + 33 voice-quality and voice-mode tests run pre-ship every round. All green at vc 94.</p>

<p>That's the system. Below is how I got it there.</p>

<h2>The setup</h2>

<p><strong>Tools:</strong></p>
<ul>
<li>Claude Code (Sonnet 4.5 then 4.6 as it dropped) — primary pair</li>
<li>Codex (read-only audits — independent review of Claude's output)</li>
<li>VS Code + a normal local dev loop</li>
<li>EAS for builds, Google Play Console for distribution</li>
<li>Cloudflare Workers for the AI proxy</li>
<li>Supabase for auth + cloud sync</li>
<li>PostHog for analytics, Sentry for crash reporting</li>
<li>No design tool — the entire UI is hand-built tokens (<code>src/theme/tokens.ts</code>)</li>
</ul>

<p><strong>Working agreement with Claude:</strong> I treat Claude as a fast, careful, sometimes-overconfident senior engineer who has no memory between sessions and needs everything important re-stated. The combination is good. I bring the product judgment, the user empathy, the calls about what to cut. Claude brings encyclopedic patience for code, infinite willingness to refactor, and the ability to verify a 50-line change in TS + lint + tests in 30 seconds.</p>

<p>The collaboration breaks if you treat it like a tool. It works if you treat it like an employee who needs clear briefs.</p>

<h2>The workflow that actually shipped</h2>

<h3>Phase 1: scaffold (days 1–3)</h3>

<p>Started with <code>npx create-expo-app</code>, immediately added the Zustand stores for cat profiles, scan history, daily check-ins. Wrote the world memory + subject directory shape on day 2 before any LLM calls existed. The schema is most of the work — get that wrong and you'll be rewriting prompts forever.</p>

<p>Claude wrote most of the boilerplate. I made architectural calls. Roughly an 80/20 code-to-judgment ratio.</p>

<h3>Phase 2: get one thing working end-to-end (days 4–6)</h3>

<p>One feature: scan-based triage. Photo → vision pass → triage reply → urgency badge. End-to-end with real RevenueCat paywall, real Supabase auth, real Cloudflare Worker proxy.</p>

<p>This is where most indie hackers screw up — they build 10 features at 80% and ship none. I built 1 feature at 99% before touching anything else. The discipline pays off because every later feature inherits the working scaffolding (auth, proxy, paywall, telemetry).</p>

<h3>Phase 3: the long middle (days 7–12)</h3>

<p>This is where everything happens. Diary, chat, postcards, body language reader, meow translator, personality quiz, photo studio, cat studio (movie-poster generator), world memory, subject directory, daily mood lottery, voice quality gate, the lot.</p>

<p>Claude's role here was <em>force multiplier</em>. I would describe a feature ("daily mood lottery, 15 moods, archetype × today × feedback layered weights, deterministic per cat per date"), Claude would implement it across 4–6 files with the right idioms, and I'd review the PR diff. About 20–30 minutes per feature on average.</p>

<p>The key habit: <strong>review the diff before running tests</strong>. If you wait for tests to fail to find the problem, the tests aren't catching what you care about (architecture, naming, idiomatic patterns).</p>

<h3>Phase 4: the audit loop (days 13–14 and ongoing)</h3>

<p>This is the secret sauce. After most features were in place, I started running Codex against the codebase in read-only mode, slice by slice — "audit the diary date-boundary logic", "audit the mood lottery wiring", "audit the postcard self-filter for the active cat", etc.</p>

<p>Codex returns structured findings — P1 / P2 / P3 with file paths and line numbers. I feed each finding back to Claude, fix it, run TS + lint + 80+ fixture tests, ship to internal testing, repeat.</p>

<p><strong>Round 1–17 of audit fixes that ended up shipping in production:</strong></p>
<ul>
<li>Diary backfill leaking today's weather into yesterday's mood lottery</li>
<li>Postcard tagging the active cat as her own visitor</li>
<li>World memory pulling forward subjects from after the diary's target date</li>
<li>Recurring subjects window not anchored to target date</li>
<li>Emergency-tier scans not routing to the dark mood pool</li>
<li>Voice quality gate retry directive not naming the specific failure</li>
<li>Self-fact contradiction resolver not catching opposing-sentiment statements</li>
<li>Live mood overlay (weather/meow/pain/appetite/litter/water/weight) not flowing into the actual voice surfaces (chat/diary/postcard)</li>
<li>"No water logged today" being read as "drank less than usual"</li>
<li>15+ other smaller findings — every one tracked, fixed, tested</li>
</ul>

<p>Without the audit loop none of this would have caught. With it, I shipped 17 audit rounds before vc 94 hit production. The result is an app that, in 14 days of internal testing across multiple real cats, hit zero crash reports and zero "this feels wrong" feedback on the voice.</p>

<h2>What Claude was best at</h2>

<ul>
<li><strong>Idiomatic implementation.</strong> Tell it the shape, get back working code in the project's existing conventions (RN/Expo, Zustand, no-class components, hooks-first). I almost never had to ask for refactors after the first round of corrections.</li>
<li><strong>Refactoring under time pressure.</strong> Round 15 found that water/weight signals were defined in TodayContext but no callsite was passing them. Claude wrote a shared <code>computeBodyTrendSignals</code> helper, wired it into 3 generation paths and the central live-context builder, in one continuous turn. 20 minutes including verification.</li>
<li><strong>Test scaffolding.</strong> The 47-test date-boundary fixture suite, the 18-test voice-mode suite — both were Claude's drafts with my edits. Pure-Node, no Jest, runs in 1 second.</li>
<li><strong>Audit response.</strong> Codex's findings come in as natural-language paragraphs. Claude reads them, finds the file, makes the edit, runs the verification. I'm essentially routing audit → implementer, while contributing the product judgment about whether to fix or defer.</li>
<li><strong>The 80-line file you don't want to write yourself.</strong> All the boring-but-necessary work: voice quality scoring helpers, mood weight tables, date math, schema.org JSON-LD blocks for the website.</li>
</ul>

<h2>What Claude was <em>not</em> good at (or needed careful supervision on)</h2>

<ul>
<li><strong>Over-confident first drafts.</strong> First attempt was often "almost right but with one buried assumption that breaks production". I caught these by reviewing the diff every time. Trust but verify.</li>
<li><strong>Memory across long sessions.</strong> When the context window fills, summarisation runs, and details get lost. The workaround: explicit <code>docs/</code> files for anything important (audit findings, architecture decisions, voice rules). When I need Claude to remember something specific, I point it back at the doc.</li>
<li><strong>Cross-file invariants.</strong> Claude is fine at one-file changes; cross-file refactors where 5 callsites all need to update in sync are where I have to be most careful. The audit loop catches the misses.</li>
<li><strong>Product judgment.</strong> Should the free tier exist? What's the right trial length? Which voice modes feel right for our users? Claude has good <em>taste</em> but no information about the actual users. These calls have to be mine.</li>
<li><strong>Knowing when to stop.</strong> Left unsupervised, Claude will polish indefinitely. I had to explicitly call "stop, this is shippable" multiple times when it was about to refactor something good.</li>
</ul>

<h2>The specific patterns that paid off</h2>

<h3>Pattern 1: tests first for date math</h3>

<p>Date / timezone / boundary logic is where AI assistance bites you hardest. The model writes plausible-looking date code and then you find out at 11:59pm local that backfilling yesterday's diary is computing against today's wall clock.</p>

<p>I wrote <code>scripts/test-diary-date-boundaries.mjs</code> early. 47 fixture cases covering: birthday detection at year boundary, weekday matching across DST, vibe inclusion in past backfill, subject appearance counts using only on-or-before-target events, scenes-by-cat date anchoring, recurring subjects window. All pure-Node, no app dependencies, runs in 800ms.</p>

<p>Every round of audit, I run these tests before claiming a fix shipped. They've caught regressions 4 times.</p>

<h3>Pattern 2: typed analytics events</h3>

<p><code>src/services/analytics.ts</code> defines a single <code>AnalyticsEvent</code> discriminated union with ~100 entries. Every event the app fires goes through <code>track(event: AnalyticsEvent)</code>. The compiler enforces:</p>
<ul>
<li>No typos in event names (<code>scan_submited</code> → compile error)</li>
<li>No missing required props (<code>postcard_shared</code> without surface field → compile error)</li>
<li>No invalid enum values (urgency must be one of four strings, not just any string)</li>
</ul>

<p>Three months from now when I'm debugging "why is conversion zero", I will be very glad the events are typed.</p>

<h3>Pattern 3: deterministic gates after non-deterministic generators</h3>

<p>The voice quality gate. Same pattern applies everywhere: LLM generates → deterministic evaluator scores → ship or retry. Don't rely on the model to self-correct. Build a gate.</p>

<p>This is the single highest-ROI engineering decision in the codebase.</p>

<h3>Pattern 4: lazy imports and stores accessed via <code>getState()</code></h3>

<p>React Native + Zustand + service modules creates circular-import potential. The pattern that works:</p>
<ul>
<li>Stores expose <code>useStore.getState()</code> for reads from non-component code</li>
<li>Service modules avoid top-of-file store imports where possible — use lazy <code>require</code> or dynamic <code>import('./store')</code> inside functions</li>
<li>TypeScript-only imports (<code>import type {...}</code>) never trigger runtime cycles</li>
</ul>

<p>About 5 hours of debugging-circular-import time saved by adopting this from day 1.</p>

<h3>Pattern 5: weekly write-up to clear my own head</h3>

<p>Every Sunday I dump 2,000 words into a <code>docs/SESSION-CHECKPOINT-YYYY-MM-DD.md</code> file describing what shipped, what's broken, what I'm worried about. Claude reads these on the next session and we resume context fast.</p>

<p>Without these docs, week 2 productivity would have dropped 40% just from re-explaining context. With them, every Monday morning is "OK here's where we are, here's the next thing."</p>

<h2>What I'd do differently</h2>

<ul>
<li><strong>Start the audit loop on day 1, not day 10.</strong> I would have caught half the date-boundary bugs three days earlier.</li>
<li><strong>Build the voice quality gate before the LLM features that need it.</strong> I had to retrofit the gate after the first round of slop output. Cheaper to build it first.</li>
<li><strong>Treat the marketing site as a real codebase.</strong> I kept editing <code>proxy/landing.ts</code> ad hoc and had two stale "beta" references survive 4 rounds of fixes. Should have run the same audit discipline against it.</li>
<li><strong>Write tests for prompts, not just for code.</strong> I have 33 voice-quality tests but the actual prompts are mostly hand-tuned without regression coverage. A "given this fixture context, the system prompt should contain X" test suite would have saved me from a few accidental prompt regressions.</li>
</ul>

<h2>The honest cost picture</h2>

<ul>
<li><strong>Time:</strong> 14 days from <code>create-expo-app</code> to Google Play production. About 8–10 hours/day. Solo. I have other work; this was full focus.</li>
<li><strong>Money:</strong> ~$200 USD in OpenAI / Anthropic API spend during development. Zero on infrastructure (Cloudflare Workers free tier covers the AI proxy, Supabase free tier covers auth). EAS build credits are free for the first ~30 builds/month; I exceeded that and paid ~$10 in overages.</li>
<li><strong>Claude usage:</strong> roughly the equivalent of 200+ hours of Claude Code conversations. Most sessions 30–90 minutes. Many concurrent during refactors. The audit loop alone is probably 50 hours of Claude time across 17 rounds.</li>
</ul>

<p>The cost is laughable. The barrier to building production AI apps as a solo founder has collapsed.</p>

<h2>What's next</h2>

<ul>
<li>Open testing → production rollout this week</li>
<li>iOS in ~2 months pending Apple review + Android retention proof</li>
<li>A blog series like this one for SEO + community building. The slop manifesto is up first.</li>
<li>More audit rounds. Always more audit rounds.</li>
</ul>

<p>If you're building an AI product solo and want to compare notes, find me on X (links on <a href="/">catmd.pet</a>). Always happy to swap notes on what's working.</p>

<p>CatMD is live on Google Play: <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=shipped-catmd-in-14-days-with-claude"><strong>play.google.com/store/apps/details?id=com.catmd.app</strong></a>. 14-day free trial, no card required.</p>

<p><em>If you work on Claude Code at Anthropic and this kind of solo-founder case study is interesting to you, get in touch. I'd be happy to do a longer write-up of the audit-driven dev workflow.</em></p>
`,
  },

  // ── 2026-05-21 batch (5 posts) ─────────────────────────────────────
  // Per the marketing backlog: counter-positioning + SEO + comparison
  // content. Each targets a high-intent search query + tightens the
  // funnel from blog visitor → Play Store install. Hero images saved
  // at proxy/public/blog/{slug}.webp.

  {
    slug: 'does-your-cat-hate-you',
    title: 'Does Your Cat Hate You? What Body Language Actually Means',
    description:
      'The signs cat owners read as "she hates me" usually mean something else. The body-language guide to what your cat is actually saying.',
    datePublished: '2026-05-21',
    dateModified: '2026-05-21',
    readMinutes: 8,
    category: 'Cat Behavior',
    tags: ['cat body language', 'does my cat hate me', 'cat behavior', 'tail twitch', 'slow blink'],
    heroAlt:
      'A serious-looking British Shorthair cat staring upright at the camera with a slightly judgmental expression, one paw tucked underneath in a relaxed posture — hero illustration for an essay on cat body language and the "does my cat hate me" misread',
    bodyHtml: `
<p>You're sitting on the sofa. Your cat is across the room, tail twitching, eyes locked on you. She gets up, walks past you without stopping, knocks something off the bookshelf, and stalks into the next room.</p>

<p>You think: <em>she hates me.</em></p>

<p>You're wrong about that. Not because cats can't be irritated with you — they can, frequently — but because the signals you're reading as "hate" almost never mean what you think. The vocabulary is just unfamiliar. When you don't know cat, the most innocuous body language reads as hostility, and the warmest moments read as nothing at all.</p>

<p>This is a guide to what those signals actually mean. Five common moments cat owners misinterpret, what the cat is actually saying, and how to read it next time.</p>

<h2>1. The tail twitch isn't anger. It's a signal you haven't decoded yet.</h2>

<p>A swishing or twitching tail tip looks dangerous if you're thinking in dog. A dog's wagging tail = friendly; a still tail = uncertain; a tucked tail = afraid. So a twitching cat tail must mean… angry?</p>

<p>It doesn't. A cat's tail-tip twitch is the most overloaded signal in feline body language — it can mean any of: <em>focus, mild irritation, anticipation, hunting mode, decision-making, or just thinking</em>. Without context (ear position, eye state, posture, what the cat is looking at), the twitch alone is uninterpretable.</p>

<p>The real read: if her ears are forward and she's watching something specific, the twitch is <strong>focus</strong> — she's locked on. If her ears are airplane-flat and her body is low, the twitch is <strong>warning</strong>. If she's lying relaxed and her tail-tip moves once every few seconds, she's just thinking. Same twitch, three meanings.</p>

<p>See the full breakdown in our guide to <a href="/library/cat-tail-language">cat tail language and the 7 positions decoded</a>.</p>

<h2>2. The slow blink isn't dismissal. It's the closest cats get to "I love you."</h2>

<p>Cats narrow their eyes and slowly close + reopen them at humans they trust. The research (Humphrey et al. 2020, <em>Scientific Reports</em>) showed that humans who slow-blinked back at unfamiliar cats were significantly more likely to be approached. It's a peace signal — a deliberate display of vulnerability that says "I'm relaxed, I don't see you as a threat."</p>

<p>Most owners read it as "she's just sleepy" or "she's looking away from me." Neither. She's telling you she's safe with you.</p>

<p>Slow-blink back. The cat will often blink again. You're having a conversation.</p>

<h2>3. The "ignore" walk-past is actually a tail-up greeting in disguise.</h2>

<p>Cat walks toward you, doesn't stop, doesn't make eye contact, continues past — owner reads it as dismissal.</p>

<p>Look at the tail. If it's held straight up with a slight curve at the tip, that walk-past is a <strong>greeting</strong>. Tail-up is a friendly social signal cats learn as kittens greeting their mother. They use it the rest of their lives with humans and other cats they're bonded to. The walk-past isn't ignoring you — it's the cat-equivalent of "hey" said casually as she moves through her territory.</p>

<p>Touch her side as she passes. She'll often turn and rub her cheek against your leg. That's the next stage of the greeting ritual.</p>

<h2>4. Knocking things off tables isn't spite. It's a request for engagement.</h2>

<p>The "she hates me" interpretation: she pushed my favourite mug off the table because she's mad at me.</p>

<p>The actual interpretation: <strong>she's bored, you're nearby, and she's learned the fastest way to get a reaction is to test gravity on an object.</strong> Cats are observational learners. They notice which behaviours produce the most consistent reaction from you. The mug works. The mug is going on the floor.</p>

<p>If you want it to stop, the answer isn't punishment — it's enrichment. A cat with adequate play, hunting outlet, and stimulation doesn't run gravity experiments. See our guide on <a href="/library/five-pillars-happy-indoor-cat">the AAFP 5 Pillars of a happy indoor cat</a> for the framework feline vets actually use.</p>

<h2>5. Hiding under the bed isn't punishment. It's information.</h2>

<p>A cat who hides for half a day after you've raised your voice or had visitors over isn't <em>holding a grudge</em>. She's processing.</p>

<p>But hiding for more than a day, or hiding paired with appetite loss or grooming changes, is something else entirely — it's a health signal cats use to mask pain. <a href="/library/cat-hiding-illness">Cats hide when they're stressed AND when they're sick</a>, and the difference matters. The owner who reads "she's mad at me" misses the actual diagnostic signal.</p>

<h2>So… does your cat actually hate you?</h2>

<p>Almost certainly not. What's happening, in 95% of cases:</p>

<ul>
<li>You don't have the vocabulary yet. Tail-tip twitch is the most overloaded signal — until you can read ears + eyes + posture together, every twitch looks like anger.</li>
<li>You're reading cat through dog defaults. A dog with a wagging tail is happy; a cat with a moving tail is concentrating. Different animals, different rules.</li>
<li>You're missing the warm signals. Slow blinks, tail-up greetings, head-bumps, cheek-rubs — these are the cat-equivalent of "I love you," and they're easy to miss if you're waiting for something more dog-shaped.</li>
</ul>

<p>The cure isn't more love. It's more <em>vocabulary</em>. Once you can read her body language — actual five-channel reading across tail, ears, eyes, whiskers, and posture — you stop misinterpreting. The "hates me" interpretation becomes impossible because you can see what she's actually saying.</p>

<h2>The 6-second reader</h2>

<p>This is exactly what we built CatMD's <a href="/library/how-body-language-readers-work">Body Language Reader</a> for. Record 6 seconds of your cat on video — any 6 seconds, any time. The app reads tail, ears, eyes, posture, motion, and audio across the clip, and returns a labelled-lines interpretation: <em>"Eyes: soft. Ears: forward. Tail: relaxed S-curve. Most likely: greeting + mild curiosity. What to do: slow-blink back."</em></p>

<p>Try it on a clip of your cat doing something you read as hostile. You'll usually find she wasn't.</p>

<p><strong>The verdict: she doesn't hate you. She's just speaking cat, and you've been listening in dog.</strong></p>
`,
  },

  {
    slug: 'feline-five-personality-types',
    title: 'The Feline Five: Every Cat Personality Type Explained',
    description:
      'The peer-reviewed Feline Five framework, all 9 archetypes, and how to find your cat\'s type in 90 seconds. The first real cat personality test.',
    datePublished: '2026-05-21',
    dateModified: '2026-05-21',
    readMinutes: 10,
    category: 'Cat Personality',
    tags: ['cat personality types', 'Feline Five', 'cat behavior research', 'cat archetypes', 'Litchfield 2017'],
    heroAlt:
      'Five different cats arranged in a single warm-lit scene, each in a posture that telegraphs a distinct personality archetype — alert, curled, playful, lap-bonded, observing from height — hero illustration for the Feline Five personality framework',
    bodyHtml: `
<p>For decades, "cat personality" was treated as folk science. Every cat owner believed in it. No researcher quantified it. You got vague stereotypes — Siamese are vocal, Persians are aloof, ginger cats are wild — and that was the level of public discourse.</p>

<p>That changed in 2017. Litchfield et al. published <em>"The 'Feline Five': An Examination of Personality in the Domestic Cat"</em> in PLoS ONE. They surveyed over 2,800 cat owners across five countries, ran factor analysis on the responses, and identified five replicable personality traits in cats. Stable across adulthood. Independent of breed. Heritable.</p>

<p>It's the closest thing the cat world has to the Big Five (which is the canonical human personality framework). This is the science behind every cat-archetype meme that gets it right.</p>

<p>This guide is the practical walkthrough: the five traits, the nine archetypes most cats fall into, what each archetype tells you about how to live with your cat — and the 90-second test.</p>

<h2>The five traits (research-validated)</h2>

<p>Litchfield's framework names five replicable dimensions of cat personality. Every cat scores high, medium, or low on each:</p>

<h3>1. Skittishness (anxious ↔ calm)</h3>
<p>How easily a cat reacts to novel or surprising events. High-skittishness cats startle easily, hide longer after disruption, take more time to acclimate. Low-skittishness cats are emotionally stable and bounce back fast.</p>

<h3>2. Outgoingness (sociable ↔ reserved)</h3>
<p>How actively the cat seeks social interaction — with humans, other cats, visitors. High-outgoing cats greet strangers, follow owners room-to-room, lap-sit. Low-outgoing cats are independent, prefer solitude, form deep bonds with one or two specific humans.</p>

<h3>3. Dominance (assertive ↔ submissive)</h3>
<p>How much the cat asserts itself in resource conflicts. High-dominance cats guard food, claim sleeping spots, bully more submissive cats in multi-cat homes. Low-dominance cats yield resources and avoid confrontation.</p>

<h3>4. Spontaneity (impulsive ↔ predictable)</h3>
<p>How much the cat does abrupt, unpredictable things. High-spontaneity cats have sudden zoomies, surprise pounces, shifting moods. Low-spontaneity cats are routine-loving and behaviourally consistent across days.</p>

<h3>5. Friendliness (affectionate ↔ aloof)</h3>
<p>How affectionate the cat is once a relationship is established. High-friendliness cats seek physical contact, purr readily, tolerate handling. Low-friendliness cats may live happily alongside their humans without seeking touch.</p>

<h2>The nine archetypes most cats fall into</h2>

<p>Specific combinations of the five traits produce recognisable types. Most cats fit one of these loosely; a few don't fit any cleanly. Use these as a starting framework, not a rigid box.</p>

<h3>The Velcro Cat</h3>
<p>Extreme outgoingness + friendliness + attachment. Follows you to the bathroom. Lives on your lap. Common in Sphynx and many Oriental breeds.</p>

<h3>The Confident-Sociable</h3>
<p>High outgoingness, low skittishness. Meets every visitor at the door, treats the doorbell as a chance to make friends. Common in Maine Coons and Bengals.</p>

<h3>The Curious-Introvert</h3>
<p>Moderate outgoingness, low skittishness, low dominance. Confident at home, reserved with strangers. Common in Russian Blues.</p>

<h3>The Anxious-Sensitive</h3>
<p>High skittishness, low outgoingness, low dominance. Easily overwhelmed; takes weeks to settle into change. Often the result of inadequate kitten socialisation.</p>

<h3>The Hunter-Athlete</h3>
<p>High spontaneity, low skittishness, high outgoingness. Wand toys are non-negotiable. Common in Bengals, Abyssinians, Savannahs.</p>

<h3>The Affectionate-Lap</h3>
<p>High friendliness + outgoingness, low dominance. The storybook companion. Common in Ragdolls, Birmans, Scottish Folds.</p>

<h3>The Skittish-Sensitive</h3>
<p>High skittishness, low outgoingness, moderate friendliness with bonded humans only. Slow to trust; deeply bonded once trust forms. Common in some rescue cats.</p>

<h3>The Cool Observer</h3>
<p>Low outgoingness, low skittishness, low spontaneity. Watches everything, reacts to little. The cat-shaped equivalent of a long-time housemate. Common in British Shorthairs.</p>

<h3>The Goofball</h3>
<p>High spontaneity, high outgoingness, high friendliness, low dominance. The class clown. Plays fetch, knocks things off on purpose, gets into harmless mischief.</p>

<h2>Why your cat's archetype changes how to live with her</h2>

<p>Knowing the archetype reframes everything. A Skittish-Sensitive cat who hides under the bed when guests come isn't broken — she's being a Skittish-Sensitive cat correctly. The work is to build the environment that lets that personality thrive: hides, height, quiet, predictability.</p>

<p>An Affectionate-Lap cat left alone for 12-hour workdays isn't happy with her own company — she's suffering from a personality-environment mismatch. The fix is a companion cat, a midday visitor, or a job change.</p>

<p>A Hunter-Athlete in a small apartment with no daily play turns her energy into furniture destruction. The fix is wand toys and catification, not punishment.</p>

<p>Personality is <strong>descriptive, not normative.</strong> There's no "good" or "bad" cat personality. There are only environments that match or mismatch the personality you have.</p>

<h2>The 90-second test</h2>

<p>We built the first interactive Feline Five test at <a href="/cat-personality-test">catmd.pet/cat-personality-test</a> — 10 questions, scored against the five traits, matched to your cat's most-likely archetype. Free, no signup, takes about 90 seconds.</p>

<p>Try it. Compare the result against what you already know about your cat. The fit is usually startlingly precise — which is the experience that converts skeptics. Cat personality is real science, not astrology.</p>

<p>For the full research background, including the original Litchfield study and the trait-to-archetype mapping, see our deep-dive on the <a href="/library/feline-five-personality-framework">Feline Five framework and the science of cat personality</a>.</p>

<p><strong>The verdict: every cat has a personality. The framework lets you stop fighting your cat's nature and start designing around it.</strong></p>
`,
  },

  {
    slug: 'cat-was-sick-3-weeks-health-rhythm-caught-it',
    title: 'My Cat Was Sick for 3 Weeks. I Had No Idea.',
    description:
      'A founder\'s story: weeks of subtle drift my eyes missed, what the data caught, and how Health Rhythm changed the way I track my cat.',
    datePublished: '2026-05-21',
    dateModified: '2026-05-21',
    readMinutes: 7,
    category: 'Founder Story',
    tags: ['cat hiding pain', 'feline health tracking', 'health rhythm', 'cat early warning signs', 'longitudinal health'],
    heroAlt:
      'A quiet cat resting on a soft cream blanket near a sunlit windowsill, eyes half-closed, posture subtly tucked — beside her on the floor a softly-glowing phone showing an abstract descending line graph; hero illustration for a founder story about missed cat illness signals',
    bodyHtml: `
<p>For three weeks, my cat was telling me she didn't feel well. I missed it every day.</p>

<p>Not because I'm a careless owner. I'd built an entire app — CatMD — for exactly this kind of thing. I'd written the health-tracking module, designed the longitudinal-trend view, and shipped the daily check-in card. I knew, theoretically, what to look for. I missed it anyway. The story of what happened, and what I changed afterward, is the rest of this post.</p>

<h2>Week 1: nothing seemed off</h2>

<p>Lily is a 7-year-old short-haired tortie. Normal weight, normal appetite, sleeps in the same three places, wakes me up at the same time. She's a Curious-Introvert archetype on the Feline Five — confident in her own house, reserved with strangers, deeply bonded to me.</p>

<p>Week 1, the only thing I noticed was that she was sleeping a little more than usual. That's not a useful signal — cats sleep 12-16 hours a day, and "a little more" can mean a 30-minute drift that I'm reading as anomalous because I expected to find something.</p>

<p>I logged the daily check-ins in my own app like always. Mood: normal. Appetite: full. Litter: normal. Five seconds, every day. The cards looked fine.</p>

<h2>Week 2: the graph showed it before I did</h2>

<p>On day 11, I opened the Health Rhythm view — the longitudinal-trend page in CatMD that plots mood, weight, appetite, water, litter, and pain-face score against time. I open it about once a week, mostly to sanity-check the app's rendering.</p>

<p>The mood line was trending down. Not dramatically. Just <em>"normal"</em> on days 1-3, <em>"normal"</em> on days 4-7, then a slow tilt toward <em>"off"</em> on days 8-11. The check-ins themselves had felt the same to me — I'd tapped "normal" every day. But the cumulative pattern was visible.</p>

<p>The grooming score (which the app derives from photo metadata) had also drifted. Not enough to flag on any single day. Enough to slope on the graph.</p>

<p>I sat with the screen for a minute and thought: <em>oh.</em></p>

<h2>What I'd been missing in real time</h2>

<p>I went back through 14 days of photos and watched for the pattern the graph had caught. There it was:</p>

<ul>
<li>Slightly less time on her usual high perch by the window (down from ~3 visits/day to ~1)</li>
<li>Slightly slower morning greeting — she still came over, but later, and didn't head-bump me the way she usually does</li>
<li>A subtle change in how she sat — front paws closer together, shoulders slightly tucked (a quiet pain posture, well-documented in feline pain research)</li>
<li>One night she'd skipped her usual midnight zoomie. I'd noticed and forgotten.</li>
<li>Looking back at one photo, her gums looked slightly paler than usual — <a href="/library/cat-gum-color">gum colour is one of the fastest checks of feline circulation</a>, and I'd missed the shift entirely.</li>
<li>Her sleeping breathing rate had drifted up — averaging around 32 breaths/min vs her usual 24. <a href="/library/cat-breathing-fast-sleeping">A resting respiratory rate above 30 in a healthy cat</a> can be an early sign of HCM in predisposed breeds.</li>
</ul>

<p>None of these were dramatic. Each one, in isolation, was within normal cat variation. <a href="/library/do-cats-hide-pain">Cats hide pain</a> — that's a foundational fact of feline medicine — and the way they hide it is by reducing intensity, not changing kind. She was still doing all her normal behaviours. Just less. Each less.</p>

<h2>The vet visit</h2>

<p>I booked her in. The vet did a hands-on exam (gentle palpation, mouth check, gum colour, hydration test), bloodwork, and a urinalysis. The diagnosis: a low-grade urinary inflammation, likely feline idiopathic cystitis (FIC) — a stress-driven condition that's notoriously hard for owners to spot because cats often don't strain visibly until it's severe.</p>

<p>Treatment was straightforward: a 7-day course of anti-inflammatory pain relief, environmental enrichment changes to reduce her low-grade stress, and a wet-food shift to increase her water intake.</p>

<p>Within four days she was back on her perch, head-bumping me at the right time, and the Health Rhythm graph showed mood tilting back up.</p>

<h2>What I changed in how I track</h2>

<p>The lesson wasn't "I should check more often." I was already checking daily.</p>

<p>The lesson was: <strong>the human eye, even an attentive one, is structurally bad at noticing slow drifts.</strong> We're built to catch sharp changes. A cat who goes from healthy to limping in one day — we catch that. A cat who shifts from "normal" to "slightly off" across 11 days — we don't. Each day looks like the day before; the cumulative slope is invisible at the day-to-day timescale.</p>

<p>The graph is what makes the slope visible. The Health Rhythm view in CatMD isn't a fancy dashboard for engagement metrics — it's the visualisation that turns slow drift into a perceptible line. That's the entire value of longitudinal tracking. Not the individual data points. The <em>shape</em> they make over weeks.</p>

<p>Three things changed in my daily flow after this:</p>

<ol>
<li><strong>Health Rhythm weekly check.</strong> Every Sunday evening I look at the graph. Two minutes. I'm looking for slopes, not values. Has the mood line tilted? Has the grooming score dropped? Has weight drifted >2% over a month?</li>
<li><strong>Posture photos.</strong> I started taking one photo per week of Lily sitting upright, head-on. Pain postures (tucked shoulders, head slightly low) are visible in side-by-side comparisons that aren't visible day-to-day. The <a href="/library/do-cats-hide-pain">Feline Grimace Scale</a> is the clinical version of this.</li>
<li><strong>Trust the graph over the day.</strong> When the cumulative line says something's off but each individual day says fine, the line wins. Cats are evolutionary prey animals — they mask pain by reducing intensity, not changing kind. The day-level signal is noisy. The week-level signal is the real one.</li>
</ol>

<h2>The honest framing</h2>

<p>CatMD doesn't diagnose. It can't. No app can — that's veterinary care, which requires hands-on examination, lab values, and trained judgment.</p>

<p>What CatMD can do is <strong>change what a vet visit looks like</strong>. I walked into the vet's office with a 14-day mood graph, a list of specific behavioural drifts I'd observed (with dates), a pain-face score from the app's Feline Grimace check, and a hypothesis. The vet's job was easier because I'd done the noticing. The diagnosis came faster. Lily got treated sooner.</p>

<p>If you're trying to be a more attentive cat parent, the answer isn't to watch harder. It's to instrument the slope. Daily check-ins, weekly graph reviews, and the discipline to trust the line when your eyes say nothing's wrong.</p>

<p>That's the actual value of longitudinal health tracking. Not the dashboard. The fact that the dashboard catches what you can't.</p>

<p>CatMD is free to download on Google Play. The Health Rhythm view is in Triage tab. <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=cat-was-sick-3-weeks-health-rhythm-caught-it">Get it here</a>.</p>
`,
  },

  {
    slug: 'can-ai-translate-what-cat-is-saying',
    title: 'Can AI Actually Translate What Your Cat Is Saying?',
    description:
      'A grounded look at what AI cat translators can — and can\'t — do. We don\'t decode thoughts; we read 6 channels of signal.',
    datePublished: '2026-05-21',
    dateModified: '2026-05-21',
    readMinutes: 8,
    category: 'AI & Cats',
    tags: ['cat meow translator', 'AI cat translator', 'multimodal AI', 'cat vocalizations', 'MeowTalk'],
    heroAlt:
      'A cat in mid-meow on a cream blanket near a sunlit window, mouth slightly open, soft translucent sound-wave arcs radiating outward — hero illustration for an essay on whether AI can actually translate cat meows',
    bodyHtml: `
<p>The short answer is no. AI cannot translate what your cat is saying. Not in the sense of "she meowed twice and the app told me she wants tuna." That's not a thing that's possible — not because the AI isn't smart enough, but because <strong>cats don't have a language to translate.</strong></p>

<p>The longer answer is more interesting. What AI can do — what the better cat apps are actually doing — is <em>interpret signals across multiple channels</em>. That's a real, useful, somewhat-magical thing. It's just not translation. This post is about the difference, and why the difference matters.</p>

<h2>Why "translation" is the wrong word</h2>

<p>A translation system maps tokens in language A to tokens in language B. "Bonjour" → "Hello." That mapping works because both source and target are <strong>structured languages</strong> with finite vocabularies and consistent meaning per token.</p>

<p>Cat meows don't have that structure. A 2024 review of cat vocalisation research found:</p>

<ul>
<li>Cats produce 21+ distinct sound types in the lab, but use about 8 in everyday life</li>
<li>The same meow can mean wildly different things from the same cat depending on context (food, attention, threat, mating, illness, simple greeting)</li>
<li>Crucially: <strong>cat vocalisations are not shared across individuals.</strong> Every cat develops her own vocabulary with her human. Lily's "I want tuna" meow does not generalise to your cat's "I want tuna" meow. There's no inter-cat consistency in the audio signal.</li>
</ul>

<p>This last point is the killer. A "meow translator" trained on 10,000 cats and 10,000 owner-reported intents would, at best, output a probabilistic guess: "this meow is in the 'request' bucket with 73% confidence." That's not translation. That's audio classification, and it's a much weaker claim than the marketing usually implies.</p>

<p>See <a href="/library/how-meow-translators-work">our deep-dive on how meow translators actually work</a> for the technical detail on what audio-only classification can and can't tell you.</p>

<h2>What the better apps are doing instead</h2>

<p>The interesting work isn't audio translation. It's <strong>multimodal interpretation</strong>: combining audio with other signals to produce a more grounded read of what the cat is communicating <em>in this moment</em>.</p>

<p>The channels available are:</p>

<ol>
<li><strong>Audio</strong> — meow, chirp, purr, growl, hiss, trill. Pitch, duration, intensity.</li>
<li><strong>Body language</strong> — tail position, ear orientation, eye state, posture, motion patterns.</li>
<li><strong>Context</strong> — time of day, recent events, what's happening in the environment.</li>
<li><strong>Per-cat memory</strong> — what this specific cat has done in the past in similar moments.</li>
<li><strong>Personality</strong> — the cat's archetype (per the <a href="/library/feline-five-personality-framework">Feline Five framework</a>) shapes what behaviours mean for THIS cat.</li>
<li><strong>Health state</strong> — recent check-ins, mood, appetite, pain-face score — all of which colour interpretation.</li>
</ol>

<p>A cat sitting at the food bowl, meowing, with ears forward and tail up at 6:45 PM — that's an unambiguous "feed me" combining audio + body language + context. No interpretation needed.</p>

<p>A cat sitting in the middle of the room, meowing, with ears slightly back, tail twitching, at 3 AM — that's something else entirely. Could be discomfort, anxiety, a request to go somewhere, or (in older cats) a sign of feline cognitive dysfunction. The audio alone doesn't tell you. The combination of audio + body + context + age + recent diary entries narrows it sharply.</p>

<p>That's the actual work. Not translation. Interpretation across channels.</p>

<h2>What CatMD's Meow Translator actually does</h2>

<p>We built CatMD's <a href="/library/how-meow-translators-work">Meow Translator</a> as a multimodal interpreter, not a literal translator. When you record a meow:</p>

<ol>
<li><strong>The audio</strong> is classified into intent buckets (request, complaint, greeting, in-heat, mating, etc.).</li>
<li><strong>Recent context</strong> is layered: how today's mood was logged, whether the cat just ate, whether a vet visit happened recently, who's in the household photo gallery.</li>
<li><strong>The cat's personality</strong> (from the Feline Five quiz) and accumulated memory adjust the read. A Velcro Cat's meow has different probability weights than a Cool Observer's.</li>
<li><strong>The output</strong> is a first-person interpreted line in the cat's voice — not a label. Something like: <em>"I would like the chair. You are in the chair."</em> rather than "intent: request displacement."</li>
</ol>

<p>It's not magic. It's not literal translation. It's an honest, multi-signal, personality-aware guess at what the cat is most likely communicating in this moment. Sometimes it's funny. Sometimes it's startlingly accurate. Sometimes it's wrong — and we say so, because that's the honest framing.</p>

<h2>The comparison with MeowTalk, CatGPT, and others</h2>

<p>For the field comparison — what each AI cat translator app actually does, what each is good at, where each one falls short — see <a href="/library/ai-cat-health-apps-compared">our objective comparison of AI cat health apps</a>.</p>

<p>The short version: MeowTalk has the brand and the audio-classification depth. CatGPT-style apps lean on chat with the cat as a creative interface. CatMD pulls multiple signals together. None of them literally translate. The category as a whole is "interpretive companion," not "linguistic translator."</p>

<h2>Why this matters</h2>

<p>The "translation" framing is misleading marketing, and it lowers user trust over time. Users open the app expecting an oracle, get a categorical label, and feel duped. The honest framing — "we interpret signals across multiple channels to give you a plausible read of what your cat might be communicating" — is less sexy in a press release. It's also more useful, more accurate, and more durable.</p>

<p>If you want literal cat-to-English translation, no app can do it. If you want a tool that helps you understand your cat better — by reading more channels than you can hold in your head at once, and giving you a per-moment, per-cat, per-personality interpretation — that's what the better cat AI apps actually do.</p>

<p>Try CatMD's Meow Translator + Body Language Reader to see the difference. <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=can-ai-translate-what-cat-is-saying">Free on Google Play</a>.</p>

<p><strong>The verdict: AI can't translate cats. But it can read them, in ways your eye alone can't. That's the actual product.</strong></p>
`,
  },

  {
    slug: 'solo-founder-cat-ai-why-vcs-passed',
    title: 'Building an AI for Cats — Why VCs Passed',
    description:
      'The solo founder of CatMD on why VCs passed on a $50B pet market, why the cat-AI niche is now solvable, and why we built it anyway.',
    datePublished: '2026-05-21',
    dateModified: '2026-05-21',
    readMinutes: 9,
    category: 'Founder Story',
    tags: ['solo founder', 'indie AI', 'pet tech', 'VC pass', 'bootstrapped startup', 'AI cat app'],
    heroAlt:
      'A laptop on a cream-coloured desk in warm afternoon light, screen showing soft-glowing abstract pastel blocks, a cat curled asleep on a folded blanket next to the laptop with a paw extended onto the keyboard — hero illustration for a solo founder essay on building an AI cat app',
    bodyHtml: `
<p>Five VCs passed on CatMD before I stopped pitching it.</p>

<p>The pet market is $147B globally, $50B+ in the US alone, and growing 6-8% a year. Cat ownership specifically has been the fastest-growing segment in pet care for a decade. "Pet humanisation" is the macro thesis half the pet-tech category was built on. By any standard market-sizing exercise, an AI-native app for cat owners should be an easy pitch.</p>

<p>It wasn't. The reasons were instructive — and, in retrospect, also wrong in the specific way that VC pattern-matching is often wrong about niche-first products in inflection-point markets. This post is about what they said, why each pass was structurally rational from inside the pattern, and what I built instead.</p>

<h2>The four reasons VCs gave</h2>

<h3>1. "The market is too niche."</h3>

<p>The most common pass. The framing is: dogs are 65% of household pets in the US, cats are ~30%, and a cat-only product caps the TAM at well under half of what a multi-species pet-tech play could address. Multi-species (Rover, Petco's app, 11pets) is the funded thesis. Single-species is "leaving money on the table."</p>

<p>This was the pass I respected most. It's a real argument if you're optimising for fund-return distributions across a $200M fund where you need a few outsized winners. A $5B cat-only company is structurally harder to build than a $5B multi-species one. The maths is real.</p>

<h3>2. "Cat owners don't pay for apps."</h3>

<p>The variant: cat owners pay for food and litter, not software. Cat owner ARPU on AI tools is unproven. The closest comp is MeowTalk (cat meow translator) — which has 10M+ downloads but reported sub-$5M ARR, suggesting low conversion despite massive volume.</p>

<p>Also a real argument. The cat-app category has consistently under-monetised. Owners will adopt free tools at scale but resist subscriptions. It's a structural problem in the category, not a CatMD-specific one.</p>

<h3>3. "What's defensible? OpenAI can ship this in a weekend."</h3>

<p>The model-layer worry. If the core value is "AI looks at your cat and tells you things," and the AI part is GPT-4o or Claude or Gemini through an API, then theoretically any well-funded competitor can replicate it. The defensibility argument is the hardest in current AI: every demo looks like a feature, and every feature looks ship-able by the foundation labs themselves.</p>

<h3>4. "Why are YOU the one to build this?"</h3>

<p>The founder-fit question. I'm a solo non-veterinarian, non-pet-tech-veteran founder. I don't have a Stanford vet school connection or a former PetSmart exec on my cap table. I have a cat (one) and a software background. VCs ask "why you?" because they want to underwrite a unique advantage, and "I really love my cat and I'm a good engineer" isn't an advantage that compounds.</p>

<p>This is also fair. Founder-market fit is a real signal, and "domain-naive software founder enters category" has a long history of bad outcomes.</p>

<h2>Why each pass was structurally wrong (for THIS product, in THIS market window)</h2>

<h3>The niche argument is structurally wrong now, because the niche-tooling cost curve collapsed.</h3>

<p>VC niche-aversion assumes that a $50M cat-only company isn't worth building because the engineering and distribution costs are amortised against a smaller market than the multi-species competitor's. That math worked when building a category-defining cat app took a 15-person engineering team and 18 months.</p>

<p>It doesn't work in 2026. I built CatMD as a solo founder in 14 days of dev time, with Claude as a pair programmer. The cost basis to ship cat-specific differentiation collapsed by 10-30x. A solo dev with Claude in 2026 is the engineering output of a 5-7 person team in 2022. The whole calculus of "is this niche big enough to justify the build" changes when the build is 10x cheaper.</p>

<p>(For the engineering case study on this specifically, see <a href="/blog/shipped-catmd-in-14-days-with-claude">I shipped a cat AI app in 14 days with Claude as pair programmer</a>.)</p>

<h3>The "cat owners don't pay" argument is wrong about the why.</h3>

<p>Cat owners don't pay for the apps that have existed. They might pay for the app that doesn't exist yet — which is the one that actually understands their specific cat instead of giving them a generic categorical label.</p>

<p>The MeowTalk problem isn't "cat owners are cheap." It's "owners won't pay for a categorical audio classifier that outputs the same 8 labels for every cat." Replace it with a multi-signal interpreter that learns a specific cat over weeks and references named family members in diary entries, and the value proposition shifts from "novelty" to "companion." The pricing model that doesn't work for novelty (subscription) works for companion (because the cat-in-the-app becomes irreplaceable).</p>

<p>This is the bet. Whether it pays out is a Q3 question. The fact that pay-rate looks bad in the existing category is a feature-distance signal, not a category signal.</p>

<h3>The defensibility argument is wrong about WHERE the moat lives.</h3>

<p>If the moat were "the LLM does the cat-reading," I'd agree the foundation labs could replicate it. But that's not where the moat is. The moat is in the <em>thousands of small product decisions</em> that turn a foundation model into a believable cat AI:</p>

<ul>
<li>A 15-mood daily lottery that gives the cat a different mood every day (so the voice doesn't go stale)</li>
<li>A 4-tier voice quality gate that rejects "your furry friend had a purr-fect day" texture and asks the model to retry</li>
<li>A 3-tier depth-modulated voice that matures with the bond (warm-curious early days → intimate-comfort after months)</li>
<li>A Feline Grimace Scale pain detector calibrated against published veterinary research</li>
<li>A subject-detection pipeline that returns descriptive attributes (not biometric data) for household members the cat sees</li>
<li>A 7-facet "becoming" identity score that turns engagement into a personality formation curve</li>
<li>The peer-reviewed Litchfield Feline Five framework wired into chat + diary as voice modulators</li>
</ul>

<p>None of these are "the AI." They're product. Foundation labs don't ship products in narrow categories — they ship platforms, and they ship them slowly. The window to build the cat-specific product layer is right now, while the foundation labs are still busy with general-purpose chat. Defensibility is in the cat-specific opinionation, not the model.</p>

<p>(For the AI-product craft side specifically, see <a href="/blog/cat-ai-is-going-to-be-slop">Cat AI is going to be slop. Here's how we tried not to be.</a>)</p>

<h3>The "why you" argument is wrong about what founder-fit means in narrow consumer categories.</h3>

<p>In B2B SaaS, "former enterprise sales VP at Snowflake founds a data-pipeline tool" is a defensible founder narrative. The category rewards Rolodex, distribution, and credentialed expertise.</p>

<p>In consumer apps for emotional-relational products, the founder narrative that works is different. It's "this person uses the product daily and obsesses over the cat's voice register because she's the one who gave them the slow-blink that broke their afternoon." Founder-market fit in this category is <strong>care</strong> + <strong>craft</strong>, not Rolodex + experience.</p>

<p>I have one cat (Lily, 7yr tortie, Curious-Introvert archetype). I have been told by family that my obsession with making her chat replies sound RIGHT is concerning. I've shipped 17 audit rounds on the voice model in 6 months. That's the founder-market fit. It doesn't underwrite a venture round; it underwrites a product.</p>

<h2>Why solo + Claude was the right ratio</h2>

<p>A multi-founder team funded by a VC is the correct structure for a SaaS company aiming at $50M ARR in 4 years. It is the wrong structure for a consumer companion product that needs taste, opinionation, and the ability to make 50 micro-decisions a day without negotiating each one with cofounders or investors.</p>

<p>The cat-AI category is downstream of the same thesis Co-Star, Replika, Character.AI, and Calm exercised: <em>identity-as-product</em>, where the product's value is the specific feeling of using it. These products are not built by committee. They're built by one person with a strong taste signal, iterating until the voice lands.</p>

<p>Adding Claude as a pair programmer changes the unit economics. The 14-day build was real. The 17-round audit was real. The fact that I can ship a new feature (the partner code system, vc 96), a new voice tier (vc 99), and an attribution pipeline (vc 95) within a single calendar week without breaking the product — that's the actual unlock. Not "AI replaces engineers." AI replaces the coordination overhead that turns 1 founder + 1 engineer into a 3-person team that ships at 1.5x the speed.</p>

<p>The lean structure forces something else: I have to focus. There's no fund pressure to add a dog mode, a hamster mode, a corporate-vet B2B SKU. Every quarter I keep the product cat-only is a quarter of compounding cat-specific opinionation. That's the moat the VCs missed.</p>

<h2>What changed when I stopped pitching</h2>

<p>Three things, in order:</p>

<ol>
<li><strong>I stopped designing the app for the pitch and started designing it for Lily.</strong> Every feature decision is now "does this make the cat-in-the-app more believable" rather than "does this make the deck more impressive." The voice tightened. The diary got weird in the right way. The body-language reader started returning specifics instead of generalities. Removing the VC pressure removed the temptation to broaden the product.</li>
<li><strong>The financial pressure became cleaner.</strong> $99/yr for an Apple Developer Program enrollment, $20/mo for Claude, $5/mo for Cloudflare Workers, $20/mo for Supabase, ~$300/mo for an OpenAI cost cap. ~$500/mo all-in. CatMD has to make ~$500/mo to not be a net loss. That's a meaningful but actually-achievable bar.</li>
<li><strong>The category became a partner-game instead of a market-game.</strong> Instead of acquiring users through paid ads (which the unit economics don't support), the path is creator partnerships — micro-influencers in the cat-content space who get a free Pro for life + a 30% royalty on annual subscribers their code drives. The whole system shipped in vc 96. (See <a href="/library/ai-cat-health-apps-compared">the comparison of AI cat health apps</a> for where CatMD sits in the broader category.)</li>
</ol>

<h2>The verdict</h2>

<p>VCs weren't wrong in their pattern. They were right about the rules of the game as the rules existed when the patterns were calibrated.</p>

<p>What they missed — what I think a lot of investors will miss in 2026 specifically — is that the cost basis for niche-first AI consumer products has collapsed, and the moat lives in product opinionation, not model access. The right founder for a cat AI app isn't an ex-PetSmart exec with a Rolodex. It's someone who's spent enough afternoons watching their cat slow-blink at them that they CARE more about the voice than the deck.</p>

<p>If you're an indie founder considering a niche-first AI consumer product right now, the meta-lesson is: <strong>the VC "this is too niche" pass is increasingly a signal that the category is solvable by one person.</strong> The math has flipped. Niche + AI tooling + solo founder + 12 months of taste-iteration is now a unit that ships durable products without the venture-capital amplifier.</p>

<p>That's the bet I'm running.</p>

<p>Try the product the VCs passed on: <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=solo-founder-cat-ai-why-vcs-passed">CatMD on Google Play</a>. 14-day Pro trial, no card.</p>

<p><em>If you're working on a niche-first AI consumer product and want to compare notes on the solo-founder economics, find me at amit@catmd.pet.</em></p>
`,
  },

  {
    slug: '11pets-vs-catmd-comparison',
    title: '11pets vs CatMD: Tracker or Health Intelligence?',
    description:
      '11pets organizes vet records. CatMD interprets behaviour, body language, and patterns. When to pick which — and why most owners need both.',
    datePublished: '2026-05-21',
    dateModified: '2026-05-21',
    readMinutes: 8,
    category: 'App Comparison',
    tags: ['11pets vs catmd', 'best cat health app', 'pet tracker comparison', 'cat health intelligence', 'pet record keeping'],
    heroAlt:
      'A calm tabby cat between two softly-glowing phone outlines — left phone showing simple file-folder shapes (the tracker), right phone showing a richer abstract glow with pattern hints (the interpreter) — hero illustration for a comparison of 11pets and CatMD',
    bodyHtml: `
<p>Two apps frequently surface when cat owners search for pet-health tools: <strong>11pets</strong> and <strong>CatMD</strong>. They get compared a lot. They shouldn't.</p>

<p>They do completely different things. One organises pet records (vaccines, vet visits, weights logged manually). The other interprets your cat's behaviour, body language, mood, and health patterns. Most cat owners actually need both. This post is the honest comparison so you know which is which — and what the gap between them really is.</p>

<h2>What 11pets does well</h2>

<p>11pets is a <strong>multi-pet organiser</strong>. It's been around since 2014, predates the AI wave, and has earned its place by being a clean, reliable place to keep records for one or many pets. The core surface:</p>

<ul>
<li><strong>Vaccination tracking</strong> — record dates, set reminders, share with vets</li>
<li><strong>Vet visits and medications</strong> — log appointments, prescription schedules</li>
<li><strong>Weight + grooming + appointment calendar</strong> — manual entry for owner-tracked values</li>
<li><strong>Multi-pet support</strong> — designed for households with multiple animals (dogs, cats, even chickens and rabbits)</li>
<li><strong>Cross-platform</strong> — iOS, Android, and web sync</li>
<li><strong>Subscription</strong> — Pro tier with cloud sync + sharing</li>
</ul>

<p>If you have three cats, a dog, and a rabbit, and you need a single place to keep their vaccination history, vet appointments, medication schedules, and weight logs across the household — 11pets is genuinely useful. It does what it claims to do. It's the digital equivalent of a really good pet binder.</p>

<p>What 11pets doesn't do: <strong>interpret what your cat is feeling, score her behaviour, read her body language, write her diary, detect health-pattern drift, or generate any AI-derived signal.</strong> It's by design — 11pets isn't an AI product. It's organisation.</p>

<h2>What CatMD does</h2>

<p>CatMD is cat-specific (not multi-species) and built around <strong>interpretation</strong>, not organisation. The features:</p>

<ul>
<li><strong>Triage Scan</strong> — describe a symptom, get an urgency tier in 60 seconds. Backed by a curated feline-medicine knowledge base.</li>
<li><strong>Body Language Reader</strong> — 6-second video → AI reads tail, ears, eyes, posture, motion, vocalisations. Returns labelled-line interpretation. (See <a href="/library/how-body-language-readers-work">how body-language reader apps work</a>.)</li>
<li><strong>Meow Translator</strong> — multimodal audio + body language + per-cat memory interpretation of vocalisations.</li>
<li><strong>Health Rhythm</strong> — longitudinal trend view across mood, weight, water, litter, pain-face score. Catches slow drifts the daily eye misses.</li>
<li><strong>Pain Check (Feline Grimace Scale)</strong> — face photo → clinical-grade pain score using the FGS framework.</li>
<li><strong>Cat-voice diary + chat</strong> — your cat writes a daily diary in her own voice, references your home's named people and pets, and replies to you in chat.</li>
<li><strong>Personality (Feline Five)</strong> — peer-reviewed personality framework, 9 archetypes, free interactive test.</li>
<li><strong>Cat Studio</strong> — AI-generated themed artwork (48 variants across 6 themes, rotating weekly).</li>
</ul>

<p>What CatMD doesn't do: <strong>multi-pet record-keeping, manual vet-visit logging for multi-species households, web-based access (Android-only currently), shared family logins.</strong></p>

<p>You can manually track weight, water, and litter in CatMD's check-in card. But it's not the primary surface — the focus is interpretation and pattern-detection, not paperwork.</p>

<h2>Side-by-side: when to use which</h2>

<table>
<thead>
<tr><th>Need</th><th>11pets</th><th>CatMD</th></tr>
</thead>
<tbody>
<tr><td>"Log vaccination dates + share with my vet"</td><td>✅ Designed for this</td><td>⚠️ Possible but not the primary surface</td></tr>
<tr><td>"Track health across 3 cats + a dog"</td><td>✅ Multi-pet from day 1</td><td>❌ Cat-only, multi-cat works but not multi-species</td></tr>
<tr><td>"Schedule + remember vet appointments"</td><td>✅ Yes</td><td>⚠️ Light support</td></tr>
<tr><td>"What is my cat trying to tell me right now?"</td><td>❌ Not in scope</td><td>✅ Body Language Reader + Meow Translator + chat</td></tr>
<tr><td>"Is my cat actually OK?" (interpretive triage)</td><td>❌ Not in scope</td><td>✅ Triage Scan, Pain Check, Health Rhythm</td></tr>
<tr><td>"Track subtle drift over weeks"</td><td>⚠️ You can chart weight manually</td><td>✅ Health Rhythm catches automated drift across mood/weight/litter/grooming</td></tr>
<tr><td>"What's my cat's personality?"</td><td>❌ Not in scope</td><td>✅ Feline Five quiz + archetype</td></tr>
<tr><td>"Daily journal of my cat's life"</td><td>❌ Not in scope</td><td>✅ Conscious Diary (writes in the cat's voice)</td></tr>
<tr><td>"Share my pet binder with my partner"</td><td>✅ Family sharing</td><td>❌ Single-device currently (cloud sync exists for Pro but not multi-user)</td></tr>
<tr><td>"Cross-platform (iOS + Android + web)"</td><td>✅ Yes</td><td>❌ Android only currently (iOS in development)</td></tr>
</tbody>
</table>

<h2>The honest answer: most owners need both</h2>

<p>This isn't a competitive review where one app "wins." 11pets and CatMD answer different questions.</p>

<ul>
<li>If you have ONE specific question — "where's my cat's last vaccination record?" or "when's her next appointment?" — that's an <strong>11pets</strong> question. It's an organisation question. (For urgent triage questions like <a href="/library/cat-ate-lily-emergency">toxic-plant ingestion</a>, <a href="/library/cat-straining-to-urinate">urinary obstruction</a>, or <a href="/library/cat-losing-weight">unexplained weight loss</a> — that's medical, not paperwork.)</li>
<li>If you have a different question — "is something off with my cat?" or "what is she saying right now?" or "is the pattern this week different from last month?" — that's a <strong>CatMD</strong> question. It's an interpretation question.</li>
</ul>

<p>The owner who's most underserved by the current category is the one who's only using one or the other. 11pets-only owners have great records and no interpretive layer. CatMD-only owners have great interpretation and weak record-keeping. The honest answer is that the cat lives in both worlds — paper and signal.</p>

<h2>What we'd build in 11pets (if we ran it)</h2>

<p>The gap on 11pets isn't records — it's that the records don't generate insight. A 5-year vaccination history doesn't tell the owner anything about whether the cat is feeling OK today. A weight chart from manual entry doesn't auto-flag a 5% drift over 3 months. Records are inert without interpretation.</p>

<p>If we were the 11pets team, we'd add lightweight pattern detection on the existing data — automatic alerts when weight drifts >5% in 3 months, calendar-aware reminders that flag overdue checkups based on age-cohort norms, and (longer term) an AI-driven "anything worth looking at?" summary view. That's the missing layer.</p>

<h2>What we'd build in CatMD (if we ran it differently)</h2>

<p>The gap on CatMD is the opposite — strong interpretive surfaces, weaker organisation. We've got vaccinations, medications, and appointments in the Triage tab, but they're not the lead. They should be more prominent and more feature-complete for owners who want a "single source of truth" view of their cat's medical history.</p>

<p>Realistic plan: tighten the vaccination + medication + appointment surfaces in Q3, add iOS support so multi-platform households can use it, and stay focused on cat-only (we'd rather be the best cat app than a mediocre everything-pet app).</p>

<h2>The category framing</h2>

<p>Think of it this way:</p>

<ul>
<li><strong>11pets is your pet's filing cabinet.</strong> Where the paperwork lives. Reliable, organised, multi-pet, multi-platform. Has earned its place.</li>
<li><strong>CatMD is your cat's MD.</strong> The interpretive layer. What your cat is feeling, saying, drifting toward. AI-native. Cat-only by design.</li>
</ul>

<p>You probably need both. They're not competitors. They're different shelves in the same cat-care toolkit. The pricing supports keeping both — 11pets has a free tier + $4.99/mo Pro; CatMD is free with a 14-day Pro trial then $9.99/mo or $79.99/yr.</p>

<p>If you can only have one, the choice depends on what you're trying to solve. Vet paperwork problem → 11pets. Understanding-your-cat problem → CatMD.</p>

<p>Try CatMD free on <a href="https://play.google.com/store/apps/details?id=com.catmd.app&utm_source=catmd_pet&utm_medium=blog_body&utm_content=11pets-vs-catmd-comparison">Google Play</a>. 14-day Pro trial, no card. See if the interpretation layer adds something your filing cabinet doesn't.</p>

<p><strong>The verdict: 11pets organises. CatMD interprets. Most cat owners need both.</strong></p>
`,
  },
];
