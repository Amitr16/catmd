# CatMD paid-ads playbook (TikTok + Meta)

> Saved for use when the Play Store goes public. Paid ads only.
> Source-of-truth for caption rules, CTA setup, targeting, budget,
> metrics, and per-video creative briefs.

## When to use this doc

**Trigger:** the moment CatMD is publicly listed on the Play Store.
Until then, organic posts are the default (no followers required for
paid ads, but install attribution requires a public store listing).

**Don't run paid ads while in closed testing.** The CTA button has
nowhere clean to send users — Play closed-test URLs are fragile,
require Google account opt-in, and most ad clicks bounce. Wait for
production.

---

## Why paid ≠ organic — the three things that change

| Element | Organic | Paid ad |
|---|---|---|
| **Hashtags** | 8-10 help algorithmic reach | **Drop most or all.** Reach is paid, not algorithmic. Hashtags are noise. |
| **"Link in bio"** | The only way to send users out | **Wrong** — paid ads have a CTA button that links directly to your app store or landing page |
| **Caption tone** | Conversational, hooks, threading | **Tighter.** Lead with the hook, payload the value, soft CTA |
| **Length** | Up to 2200 chars | Aim for ≤ 150 chars; mobile attention is bought, not earned |

---

## Standard paid-ad caption template

```
[hook line, lowercase, ≤ 8 words]

CatMD — [single feature in 1 sentence].

Free to try.
```

If TikTok or Meta strongly recommend at least one hashtag (some
campaign types do), use **only `#catmd`**. One brand tag. That's it.

### Per-video caption variants for the 9-video series

| # | Video | Paid-ad caption |
|---|---|---|
| 1 | Chat | *"i texted her and she's been right every time. CatMD — your cat replies in their own voice. They remember the diary, the people in their photos, the things you've told them. Free to try."* |
| 2 | Diary | *"my cat writes a diary every night. it's unhinged. CatMD — every entry references named family, recent days, things you've told her about herself. Free to try."* |
| 3 | Personality | *"I took the cat personality quiz. she's a Velcro Cat. accurate. CatMD reads your cat's archetype from their actual behaviour, not a guess. Free to try."* |
| 4 | Body Language | *"I gave the AI 6 seconds of my cat. it told me she was annoyed. CatMD reads tail, ears, eyes, body, motion — channel by channel. Free to try."* |
| 5 | Daily Card | *"she sends me a card every morning. CatMD — your cat's voice on your home screen, daily. Free to try."* |
| 6 | Cat Studio | *"every week my cat is somebody else. CatMD turns her into Cleocatra, a Ghibli spirit, a movie hero — fresh theme weekly. Free to try."* |
| 7 | Weekly Reading | *"once a week, she reads ME. CatMD — your cat's weekly observation about you. Eerie. Accurate. Free to try."* |
| 8 | People & Pets | *"I tagged my mom in a photo. now my cat references her. CatMD remembers everyone in your house. Free to try."* |
| 9 | Triage | *"I was about to call the vet at midnight. then I did this instead. CatMD — 60-second symptom check, vet-ready PDF. Free to try."* |

Each one ≤ 150 characters in the lede + value sentence. Keeps mobile
attention.

---

## CTA button — what replaces "link in bio"

Both TikTok Ads and Meta Ads ask for a **Call-to-Action button** when
you create the ad. Pick:

| CTA | When to use |
|---|---|
| **"Install Now"** ← recommended | Direct link to Play Store. Cleanest funnel for an Android app. |
| **"Learn More"** | Sends to catmd.pet first. Use if you want to warm the user up before the install ask. |
| **"Try Now"** / **"Sign Up"** | Same as Install in effect; choose for tone preference |

**Default for CatMD: "Install Now"** → `https://play.google.com/store/apps/details?id=com.catmd.app`

CTA button appears as a tappable bar below the video. Viewer never
has to find your bio.

---

## Setup walkthrough

### TikTok Ads Manager — https://ads.tiktok.com

1. **Account** — create at ads.tiktok.com, set up payment method, link to a TikTok Business Account (can be a fresh zero-follower account; takes ~10 min)
2. **Campaign** — Objective: **App Promotion** (for installs) or **Traffic** (for catmd.pet visits)
3. **Ad Group** — targeting:
   - Age: 22-45
   - Gender: skew female (60-70% based on cat-app demographics, but don't exclude men)
   - Interests: Pets, Cats, Pet Care, Animal Care
   - Behaviours: Pet Owners
   - Geo: **US, UK, Canada, Australia** first (highest LTV per RevenueCat SoSA)
   - Language: English
4. **Ad** — upload `chat-v1.mp4` (or whichever video), paste the tightened caption, CTA = "Install Now", URL = Play Store
5. **Budget:** **$5-15/day** for the first 7 days. Enough signal to learn what works without burning cash.
6. **Bidding:** start with auto-bid; switch to manual once you have CPI baselines

### Meta Ads Manager — https://business.facebook.com

Near-identical flow. Same targeting parameters work.

1. **Account** — Facebook Business Manager + a Facebook Page (can be a fresh page; ~10 min setup)
2. **Campaign** — Objective: **App Installs** (best for our case) or **Traffic**
3. **Ad Set** — same targeting as TikTok above. Add **Placements**: Reels + Stories + Feed for IG; auto-placement is fine
4. **Ad** — upload same `.mp4` (it's 9:16 vertical, native to Reels), paste caption, CTA = "Install Now"
5. **Budget:** $10-15/day; Meta CPMs run higher than TikTok for similar audience

---

## Targeting recipes (for any video in the series)

### Recipe A — Cat owners, US/UK/CA/AU, broad

The default. Covers most CatMD ICP.

- Age 22-45
- Gender all (or skew female if budget tight — 60/40 F/M)
- Interests: Pets, Cats, Pet Care, Animal Care, Veterinary
- Behaviours: Pet Owners (where available)
- Geo: US, UK, Canada, Australia
- Language: English

### Recipe B — High-intent cat owners (more expensive, narrower)

For testing with a more curated audience.

- Same age + gender as above
- Add **Interests**: Cat Health, Cat Behaviour, Veterinary Medicine, Pet Insurance
- Add **Behaviours**: pet-product purchasers, pet-app users (where available)
- Same geos

### Recipe C — Anxious / high-engagement cat owners (for triage video #9)

- Same demographic
- **Interests**: Cat Health, Pet Insurance, Pet Health, Animal Hospitals
- Skew toward midlife (30-50) — older cat owners, more health-aware

---

## Budget pattern — what to spend, when

| Phase | Duration | Daily budget | Total | Goal |
|---|---|---|---|---|
| **Test** | Days 1-3 | $5-10 | $15-30 | Confirm creative renders + CTA fires + targeting reaches the right people |
| **Learn** | Days 4-10 | $10-20 | $70-140 | Get 100+ installs to compute baseline CPI / CTR / D7 retention |
| **Iterate** | Days 11-20 | $15-30 (winning ad only) | $150-300 | Kill underperformers, double down on winners, A/B test 2-3 creative variants |
| **Scale** | Day 21+ | $50-200 | $1500-6000/mo | Once unit economics work (CPI ≤ LTV/3), pour fuel |

**Rule:** never scale a creative whose CPI > $5 after $50 spent. The
creative isn't the problem — try a different opening hook (re-edit
Clip 1 or change the first text overlay) before throwing more budget.

---

## Metrics — what to watch + healthy ranges

| Metric | Healthy | Where to find |
|---|---|---|
| **CPM** (cost per 1000 impressions) | $5-15 TikTok / $10-30 Meta | Ads Manager dashboard |
| **CTR** (click-through rate) | ≥ 1% TikTok / ≥ 0.7% Meta | Same |
| **CPI** (cost per install) | $1-4 for cat-niche US/UK | Same |
| **D7 paid-user retention** | ≥ 30% | RevenueCat / PostHog cohorts |
| **Trial → paid conversion (paid users)** | ≥ 8% | RevenueCat |
| **LTV / CPI ratio** | ≥ 3:1 | Calculated — needs RevenueCat LTV data |

**Decision rule:** scale only when LTV / CPI ≥ 3:1. Below that, you're losing money on every install.

---

## When to kill creative / iterate

| Symptom after $50 spent | Likely cause | Fix |
|---|---|---|
| CPM is fine, CTR is bad | Hook isn't grabbing — viewers see the ad but don't tap | Re-edit the opening 0.5s of the video; try a different hook line; new cover frame |
| CTR is fine, install rate is bad | Play Store listing isn't converting | Update store-listing screenshots / description / reviews |
| Installs are fine, retention is bad | Onboarding is dropping users | Investigate D1 cohort behaviour in PostHog; the issue is in-app, not the ad |
| Everything below baseline | Wrong audience | Try a tighter targeting recipe (B or C above) or a different geo |

---

## Two practical reminders

1. **No "Spark Ad" / "Branded Content" tag needed** since the ad runs from your brand account. Just a regular paid ad.
2. **TikTok Ads requires a TikTok Business Account; Meta requires a Facebook Page.** Both can be fresh, zero-follower setups. ~10 minutes each. Set up before the Play Store goes live so you can launch ads on day one.

---

## Source documents

- `marketing/videos/README.md` — the 9-video series master plan
- `marketing/videos/PRODUCTION-PLAYBOOK.md` — how to make each video
- `docs/MONETIZATION-STRATEGY.md` — pricing + free-vs-Pro tier (paid ads sell into this)

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-05 | Playbook drafted. Trigger: Play Store public listing (currently in closed testing). Holds until activation. |
