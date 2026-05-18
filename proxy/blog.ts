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
];
