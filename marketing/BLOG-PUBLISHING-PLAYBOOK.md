# Blog publishing playbook — for the marketing agent

> **Audience:** the marketing Claude agent (with Nano Banana API access).
> **Scope:** end-to-end process to publish ONE new blog article on
> `catmd.pet/library/{slug}` — from article draft to live URL.
> **Goal:** every article you ship lands with proper SEO, brand-aligned
> hero image, internal link graph, and zero broken references.
>
> Read this fully before publishing the first article. After that, use
> the checklist at the bottom for each one.

---

## 1. The architecture you're publishing into

The blog lives in a Cloudflare Worker at `D:\apps\catmd\proxy\`. There
is **no CMS, no database, no static-site-generator**. Articles are
TypeScript objects compiled into the Worker bundle. To ship an
article, you edit the source, run typecheck, and deploy.

### File layout
```
proxy/
├── library.ts                         # master article registry + section/cluster index + page renderer
├── library-additions-2026-05-09.ts    # spillover file for new articles (current convention)
├── public/library/                    # hero images, served as static assets
│   ├── {slug}.webp                    # 1200×630, ~30-300KB
│   └── ...
└── scripts/convert-library-images.mjs # PNG → WebP optimiser (reference)
```

### Where to put new articles
- **Default**: append to `ADDITIONAL_ARTICLES` array in `library-additions-2026-05-09.ts`
- If that file grows past ~10 articles, create a new file
  `library-additions-{YYYY-MM-DD}.ts` and import it the same way
- **Never edit `library.ts` to add an article body** — that file is
  the registry. Body goes in `library-additions-*.ts`

---

## 2. The Article object — exact shape

```ts
{
  slug: 'how-meow-translators-work',           // URL segment, kebab-case
  title: 'How Modern Meow Translators Actually Work — and Why Some Read Your Specific Cat',
  description: 'One-paragraph meta-description, 140-160 chars ideal, ...',
  datePublished: '2026-05-11',                  // ISO yyyy-mm-dd
  dateModified: '2026-05-11',                   // same as published on first ship
  readMinutes: 8,                               // honest reading-time estimate
  primaryKeyword: 'meow translator app',        // the ONE keyword this article targets
  relatedSlugs: ['cat-vocalizations-decoded', 'cat-tail-language', 'cat-body-language-ears-whiskers-eyes'],
  faqs: [                                       // OPTIONAL but strongly recommended
    {
      question: 'Do meow translator apps actually work?',
      answer: 'Audio-only translators work in a narrow technical sense — ...',
    },
    // 3-5 FAQs total. Each answer 60-200 words.
  ],
  bodyHtml: `
<p>Opening hook paragraph...</p>
<h2>First section</h2>
<p>...</p>
`,
}
```

### Slug rules (this is SEO-critical)
- Kebab-case, all lowercase, no punctuation
- Include the primary keyword if it's natural (`how-meow-translators-work`, `cat-not-eating`)
- Never include a competitor's name (see §6)
- Max 5 words ideally; 7 absolute max
- Once shipped, **never change the slug** — it's the canonical URL forever

### relatedSlugs rules
- 2–4 entries
- Each must be a real slug from the registry — typos silently break the related-links footer
- These appear as "Read more" cards at the bottom of every article
- Reciprocity matters: when you ship article X, **edit at least 2 existing articles' `relatedSlugs` to add X**. Otherwise X is an orphan in the internal link graph
- Pick the most thematically-related articles; this is both SEO and reader UX

### FAQ rules (when present)
- Output emits `FAQPage` JSON-LD → eligible for FAQ rich-result snippets in Google SERP
- Question must be a real question someone would type into Google
- Answer must be self-contained (could stand alone as a featured snippet)
- 3-5 FAQs per article. More than 6 is diminishing returns; fewer than 3 is wasted schema opportunity
- Don't repeat the same content the article body already covers verbatim — paraphrase

---

## 3. bodyHtml — the HTML conventions

The Worker emits the body inside the article chrome. You write **raw
HTML** in a template literal. No Markdown, no JSX, no React. The
conventions:

### Structure
```html
<p>Opening paragraph that hooks. ONE strong sentence first.</p>
<p>Second paragraph that sets up the article's promise.</p>

<h2>First top-level section</h2>
<p>Body...</p>

<h3>Optional subsection</h3>
<p>Body...</p>

<p>Read more: <a href="/library/{related-slug}">descriptive anchor text</a>.</p>

<h2>Next section</h2>
...
```

### Allowed elements
- `<h2>`, `<h3>` (NEVER `<h1>` — the renderer emits that for the title)
- `<p>`, `<strong>`, `<em>`, `<a>`, `<ul>`/`<ol>`/`<li>`
- `<table>` with `<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`
- `<blockquote>` — use sparingly for cat-voice quotes, with inline style:
  ```html
  <blockquote style="margin: 1.2em 0; padding: 0.6em 1em; border-left: 4px solid var(--sage, #3F6456); font-style: italic; font-family: Georgia, serif; font-size: 1.1em;">"fine. you may sit on the floor near me. don't talk."</blockquote>
  ```

### Forbidden
- `<h1>` (renderer owns it)
- `<style>` blocks (use inline styles only when essential)
- `<script>` (worker strips them, but don't try)
- `<img>` in body (we don't have an in-body image pipeline yet — only the hero image is supported)

### Anchor text rules
- Internal links use absolute path: `<a href="/library/{slug}">...</a>`
- Anchor text describes the destination ("the science of cat vocalisations") — never "click here"
- 2-4 internal links per 1000 words is the sweet spot. Don't stuff
- External links (rare): use `rel="nofollow noopener"` when citing third parties

### TypeScript escape gotcha
Because `bodyHtml` is a template literal in a TS file, **all
apostrophes inside the body must be escaped** as `\'`:
```ts
bodyHtml: `
<p>This cat\'s personality...</p>   // ✅ correct
<p>This cat's personality...</p>    // ❌ breaks the template literal
`,
```
And don't put backticks inside the body — TypeScript will think the
template literal ended.

---

## 4. Voice + tone rules (brand-critical)

### DO
- Write like a smart, calm, cat-savvy friend. Editorial, not clinical
- Use the cat's pronouns deliberately — pick "she" or "they" consistently per article (we don't default to "she/her" anymore)
- Cite real research with specific authors + year when relevant (e.g. *"Pandeya et al, MDPI Applied Sciences 2018"*)
- Include practical, contextualised advice — every section should leave the reader knowing what to DO with the info
- Use the cat's own voice (italic, blockquote) when illustrating CatMD output

### DON'T
- **Never name a competitor by name on the public site.** No MeowTalk, no Cat Translator, no Whiskr, nothing. Use phrases like *"audio-only translators"*, *"most consumer-grade cat apps"*, *"a generic translator"*. Internal marketing notes can name competitors; the public site never does
- Never write absolute clinical claims ("this means your cat is sick"). Always use probabilistic language ("likely", "appears", "may indicate")
- Never recommend skipping a vet visit. Triage flows direct to professional care, full stop
- No emojis in body copy (the brand voice is too literary). Emojis are fine on the landing page feature cards (`landing.ts`) only
- No exclamation marks in body copy unless they're literally a cat speaking
- No "stunning", "amazing", "revolutionary", or any other SaaS-marketing adjective
- No first-person plural that breaks the brand voice ("we at CatMD"). When CatMD has to be referenced, it's third-person ("CatMD does X")

### Brand palette references (when writing colour-aware copy)
- Cream `#FAF7F2` — primary background
- Sage `#3F6456` — primary accent / CTA / link
- Sage dark `#25403A` — hover state
- Terracotta `#C97B63` — secondary accent / bond-pillar tag
- Ink `#1F2024` — body text

---

## 5. Hero image — Nano Banana prompt template

Every article needs a `{slug}.webp` at `proxy/public/library/`.
**1200×630**, ~30-300KB.

### Prompt template (paste into Nano Banana, adapt the COMPOSITION + MOOD lines)

```
Editorial illustration in the warm-clinical CatMD brand palette: cream
background (#FAF7F2), sage green accents (#3F6456), soft terracotta
warmth (#C97B63). Aspect ratio 1200x630, hero banner format.

Composition: {describe the cat pose + setting + what's happening — be
specific. e.g. "a tabby cat curled on a folded cream blanket in golden
afternoon light, eyes half-closed in a soft slow-blink, with a small
analog clock on the windowsill in the background"}

Style: photo-illustration hybrid, as if a tasteful editorial magazine
commissioned it. Warm, intimate, slightly literary. NOT a tech render,
NOT a gradient-heavy app screenshot, NOT clip-art, NOT a cartoon. Soft
grain, gentle depth of field. Brand-cohesive with a Kinfolk /
Cup-of-Jo / Substack-essay feel.

Mood: {one short mood sentence — e.g. "a cat at the threshold of sleep,
trust visible in the relaxed face"}

No text. No logos. No watermarks. No UI chrome. No screen mockups
unless explicitly requested in the Composition line.
```

### Adapt these per article
- Cat pose / breed / coat colour — match the article topic
- Lighting (golden afternoon / soft window / quiet morning / lamp at dusk)
- Setting (cream wool blanket / sage-coloured sofa / hardwood floor near a window / cushion next to a clock)
- Mood (one line, evocative)
- Whether a phone or screen-mockup appears (only if the article is specifically about the app — most won't)

### Forbidden in prompts
- Don't request brand logos in the image (the page chrome handles branding)
- Don't request text inside the image unless it's an in-app screenshot (which is rare)
- Don't request other species (dogs, kittens-with-puppies, etc.) — cats only
- Don't request photorealistic clinical / medical imagery (no vet equipment, no syringes, no blood)

### Examples that have worked
- `cat-vocalizations-decoded.webp` — *"Cat in mid-meow with mouth slightly open, looking up at someone off-frame"*
- `kitten-development-windows.webp` — *"Small tabby kitten exploring a quiet living room floor while an adult human watches gently from the side"*
- `how-to-bond-with-cat.webp` — *"Cat and owner sharing a slow blink across a cream-colored sofa in golden afternoon light"*

Match this register. Read the existing hero images at
`proxy/public/library/*.webp` before generating a new one to align
with the visual language.

---

## 6. Image conversion — PNG/JPG → WebP

Nano Banana usually outputs PNG or JPG. The library serves WebP for
LCP performance + bandwidth. Convert with `sharp`:

```bash
cd D:\apps\catmd\proxy
node -e "
const sharp = require('sharp');
const inFile = 'public/library/{slug}.png';     // or .jpg
const outFile = 'public/library/{slug}.webp';
sharp(inFile)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .webp({ quality: 82, effort: 6 })
  .toFile(outFile)
  .then(() => console.log('done'))
  .catch(e => { console.error(e); process.exit(1); });
"
```

After conversion, you can keep or delete the PNG — both are deployed
as static assets, but only the WebP is referenced by the renderer.
Keeping the PNG is fine; it's just a few MB extra in the bundle.

### Don't try to deploy without a hero image
The article renderer always emits `<img src="/library/{slug}.webp">` in
the hero figure. If the file is missing, every reader gets a broken
image, OG-share previews fail, and the LCP score tanks. Always
generate + convert + verify the file exists before deploying.

---

## 7. Wiring the article into the library index

After adding the article object to `ADDITIONAL_ARTICLES`, you need
THREE more edits:

### a) IMAGE_ALT_BY_SLUG (in `library-additions-2026-05-09.ts`)
Add an entry describing the hero image for screen readers + SEO:
```ts
export const ADDITIONAL_IMAGE_ALTS: Record<string, string> = {
  // ...existing entries...
  '{slug}': 'Descriptive alt text — what\'s in the image, hero illustration for a guide on {topic}',
};
```

### b) LIBRARY_SECTIONS (in `library.ts`)
Find the most thematically-relevant cluster and add the slug to its
`slugs` array:
```ts
{
  id: 'body-language',
  title: 'Body language fundamentals',
  blurb: '...',
  slugs: ['cat-tail-language', 'cat-body-language-ears-whiskers-eyes', 'cat-vocalizations-decoded', '{slug}'],
},
```

If no existing cluster fits, create a new one inside the most
relevant section. Talk to me first before creating a whole new
top-level section (that's a bigger info-architecture decision).

### c) Cross-link from 2+ existing articles (in `library.ts` and/or `library-additions-*.ts`)
Find at least two existing articles whose `relatedSlugs` should
include the new article. Edit them to add it:
```ts
// before
relatedSlugs: ['cat-tail-language', 'cat-body-language-ears-whiskers-eyes', 'feline-five-personality-framework'],
// after
relatedSlugs: ['cat-tail-language', 'cat-body-language-ears-whiskers-eyes', '{new-slug}'],
```

This closes the internal link graph. Orphans rank poorly. Without
this step you have published the article but Google won't find it
through internal navigation.

---

## 8. Pre-deploy verification

Before running `wrangler deploy`, run these checks:

### Typecheck
```bash
cd D:\apps\catmd\proxy
npm run typecheck
```
Must exit clean. Any TS error means your article won't compile.

### Slug consistency check
Grep for the slug across the proxy folder. It should appear in
AT LEAST these places:
- `library-additions-2026-05-09.ts` (the article object's `slug` field + at least one `relatedSlugs` entry from another article)
- `library.ts` (in `LIBRARY_SECTIONS` somewhere)
- `proxy/public/library/{slug}.webp` (the hero file)

```bash
# from D:/apps/catmd/proxy
grep -rn "{slug}" library.ts library-additions-2026-05-09.ts
ls -la public/library/{slug}.*
```

### Competitor scrub
Always grep before deploy:
```bash
grep -rni "MeowTalk\|Meowtalk\|akvelon\|whiskr\|cat.translator.app" proxy/*.ts
```
Must return zero results from the public-facing files. If a
competitor reference slipped in, find a generic phrase
(*"audio-only translators"*, *"most consumer-grade cat apps"*) and
swap.

### Image presence
```bash
ls -la D:/apps/catmd/proxy/public/library/{slug}.webp
```
Must exist and be > 5KB (a 0-byte file means conversion silently
failed).

---

## 9. Deploy

```bash
cd D:\apps\catmd\proxy
npx wrangler deploy
```

Wait for `✨ Success!` and the `Current Version ID: ...` line.
**That's your deploy receipt** — save it in the run log.

If wrangler asks to log in, the project owner has to do it. Don't
guess credentials.

---

## 10. Post-deploy verification

After deploy, hit the live URLs and confirm:

```bash
# Article page renders
curl -sk "https://catmd.pet/library/{slug}" | grep -oE '<title>[^<]+</title>'

# Hero image returns 200, not 404
curl -skI "https://catmd.pet/library/{slug}.webp" | head -3

# Article appears in the library index
curl -sk "https://catmd.pet/library" | grep -c "{slug}"
# expect 1-3 (depending on how many clusters reference it)

# Competitor scrub on the live HTML
curl -sk "https://catmd.pet/library/{slug}" | grep -ic "meowtalk"
# expect 0
```

If any of these fail, do NOT publish promo posts about the new
article. Fix first, redeploy, re-verify.

---

## 11. After-publish marketing actions

Once the article is live + verified:

1. **Update the sprint state** in
   `marketing/openclaw/workspace/memory/sprint-state.md` with the new
   article's URL and target keyword
2. **Queue social posts** referencing the article across Reddit, X,
   creator-outreach DMs — adapt to each platform's voice rules
3. **Update internal knowledge** if the article introduces a new
   concept or feature the agent should remember (e.g.
   `marketing/openclaw/workspace/knowledge/PRODUCT.md`)
4. **Crawl signal**: Google usually finds new pages via the existing
   sitemap within 24-48h. If urgent, submit the URL manually in
   Google Search Console

---

## 12. Single-article checklist (printable)

```
Article — _____________________________________________
Slug — _______________________________________________
Date — _______________________________________________

[ ] 1. Article object added to ADDITIONAL_ARTICLES
       (slug / title / description / dates / readMinutes /
       primaryKeyword / relatedSlugs / faqs / bodyHtml)
[ ] 2. ADDITIONAL_IMAGE_ALTS updated with descriptive alt text
[ ] 3. LIBRARY_SECTIONS in library.ts updated — slug in a cluster
[ ] 4. At least 2 existing articles' relatedSlugs include new slug
[ ] 5. Nano Banana prompt run — output saved as public/library/{slug}.png
[ ] 6. Converted to WebP at 1200×630 — public/library/{slug}.webp
[ ] 7. npm run typecheck passes clean
[ ] 8. grep -i 'meowtalk\|competitor names' returns zero
[ ] 9. npx wrangler deploy succeeds — version id ________________
[ ] 10. curl checks pass:
        [ ] article title present
        [ ] hero webp returns 200
        [ ] article visible in /library index
        [ ] zero competitor mentions in live HTML
[ ] 11. Sprint-state updated with article URL + keyword
[ ] 12. Social-post queue updated
```

---

## 13. Common failure modes

| Symptom                                | Cause                                         | Fix |
|----------------------------------------|-----------------------------------------------|-----|
| TS error: "Property X is missing"       | Forgot a required Article field               | Add the field; readMinutes/dates are most often missed |
| Article renders but no related links    | `relatedSlugs` entry is a typo / wrong slug   | Verify each slug exists in the registry |
| Hero is broken on the live page         | Missed step 6 (image conversion)              | Re-run the sharp conversion, re-deploy |
| Article not in /library index          | Missed step 7b (LIBRARY_SECTIONS edit)        | Add slug to a cluster's slugs array |
| Article ranks poorly after 4 weeks      | Likely an orphan — missing cross-links        | Add inbound `relatedSlugs` from 2+ existing articles |
| MeowTalk slipped through                | Author muscle-memory                          | Search-replace to a generic phrase, redeploy |
| OG preview shows generic image          | Hero is too dark / too detailed / not 1200×630| Regenerate with the brand-aligned prompt template |
| WebP is 0 bytes                         | sharp call silently failed                    | Re-run with verbose error logging |

---

## 14. When to ask me before publishing

- The article introduces a NEW top-level section (not just a new cluster)
- The article advocates a position that contradicts existing CatMD copy
- The article makes a clinical claim that hasn't been vet-reviewed
- The article is > 2500 words (we don't have any in that range yet — confirm intent before writing one)
- The hero image needs anything other than a cat in a domestic setting (no people-faces, no breaking-the-fourth-wall, no surreal scenes — these need approval)

Otherwise, follow this playbook end-to-end and ship.

---

## 15. Reference: live articles to study before drafting

Read these to absorb the voice:
- `/library/cat-vocalizations-decoded` — clean info-arch, FAQ-rich
- `/library/how-meow-translators-work` — the freshest example, multimodal-feature explainer
- `/library/feline-five-personality-framework` — the personality voice
- `/library/cat-ate-lily-emergency` — emergency-tier urgency without panic-mongering
- `/library/how-to-bond-with-cat` — practical advice cadence

When in doubt, mimic the closest existing article's structure.
