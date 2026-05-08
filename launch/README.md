# CatMD Launch Deliverables

Launch assets for Closed Testing → Production transition.

## Files in this directory

| File | Purpose |
|---|---|
| [`tester-onboarding.md`](tester-onboarding.md) | 4-message tester-flow templates + tracker sheet schema |
| [`tiktok-reels-scripts.md`](tiktok-reels-scripts.md) | 5 ready-to-shoot 15-30s scripts with hashtags |
| [`press-pitch.md`](press-pitch.md) | 15-journalist list + pitch templates + press release |
| [`aso-keyword-research.md`](aso-keyword-research.md) | Play Store keyword targets + competitor comparison |
| [`store-listing-variants.md`](store-listing-variants.md) | A/B variants for Play Store experiments |
| [`seo-articles/`](seo-articles/) | 10 ready-to-publish medical articles for `/library/{slug}` |

## Landing page

Lives in the Cloudflare Worker (`proxy/landing.ts`). Deployed at catmd.pet root.

To deploy changes:
```
cd proxy
npx wrangler deploy
```

## SEO articles — publishing plan

Each article is ~700-800 words, medically-sourced, optimized for long-tail search intent.

**Target:** publish 1 article per week for 10 weeks, then scale to 2-3/week.

**Publishing options:**
1. Add routes to the Worker (`proxy/worker.ts`) → `/library/{slug}` → render from markdown
2. Host on a separate platform (Medium, Substack, Ghost) with rel=canonical pointing to catmd.pet
3. Build a static-site section at catmd.pet/library (Cloudflare Pages sibling)

Option 1 is the moonshot-friendly choice — keeps all SEO equity on catmd.pet.

## Timing

- **Week 0-2 (beta review + 14-day clock):** tester onboarding, tiktok scripts, ASO research. No press yet.
- **Week 3 (Production approval):** press pitch launch, first 3 SEO articles published, store listing experiments queued.
- **Week 3-10:** sustain organic content, 1 article/week, iterate store listing based on experiment data.
