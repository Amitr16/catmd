# CatMD — Google Play Store Listing Copy

_Source of truth. Paste directly into Play Console → Main store listing._

_Updated 2026-05-04. Light-touch additions to the existing four-pillar copy: BOND now lists People & Pets, Becoming, and the in-cat-voice diary; CHAT updated to reflect the first-person cat-voice persona. Headline + structure unchanged — "Talk to your cat" is one feature among many, not the brand. The brand stays "AI for cat owners / Your cat, decoded."_

---

## App title (50 char max)

```
CatMD — Your Cat, Decoded
```
_(25 chars)_

**Alt options:**
- `CatMD — AI for Cat Owners` (25)
- `CatMD: AI That Knows Your Cat` (29)

---

## Short description (80 char max)

```
AI that knows your cat — mood, body language, postcards, and vet-grade triage.
```
_(78 chars)_

**Alt options:**
- `AI for cat owners — daily mood, personality, postcards, triage. All in one.` (75)
- `Your cat's life, decoded by AI. Mood, postcards, body language, triage.` (71)

---

## Full description (4000 char max)

```
CatMD is AI for cat owners.

It knows your cat — health, mood, personality, daily life — and turns that knowing into something you actually use every day. Built for cats only, trained on vet-curated feline medicine.

Four ways to know your cat:

🐾 TODAY — A 15-second daily check-in.
Streaks, mood, appetite, and a live health score that adjusts as you check in. Body language reader and 30-day Health Rhythm patterns spot drift before it becomes a problem.

🐾 BOND — The relationship side.
• Personality: 9 archetypes mapped from how your cat actually behaves
• Daily Postcards: AI-written captions over photo collages, ready to share
• Daily Diary: a private 7pm entry in your cat's own voice — references recent days, named family, and the things you've told them about themselves
• People & Pets: tag who's in your cat's photos; recurring names get woven into the diary as memories
• Becoming: a 7-facet identity score (face, voice, body, rhythm, family, nature, memory) showing how shaped your cat is in the app
• Movie Posters: weekly AI-generated portraits, rotating themes
• Photo time-lapse: watch them grow, monthly playback

🐾 CHAT — Talk with your cat.
Your cat replies in first person, in their personality archetype's voice. They remember the diary, the named people in their photos, and the things you've told them about themselves ("you love tuna" → they remember). For symptoms, they ask to be examined in their own voice — and route to Triage.

🐾 TRIAGE — Vet-grade symptom guidance.
Photo + text scan with urgency tiering, red flags, and follow-up questions. Plus the Feline Grimace Scale — a research-validated facial pain scoring system from the University of Montreal (Evangelista et al., 2019). Vaccines, weight tracking, and disease-specific watch monitors keep the longitudinal record vets care about.

WHY CATMD?
• AI that knows YOUR cat — every interaction sees their breed, age, personality, named family, recent diary, and what you've told them about themselves. Not a generic pet app with a cat filter.
• Built for cats only — every feature tuned to feline behaviour, anatomy, and risk patterns. No dog dilution.
• Private by design — photos, diary, and self-facts stay on your device. Pro members get cloud backup so their cat's history follows them to any device.
• Daily ritual, not crisis tool — most days you'll open CatMD just to check in, chat with your cat, share a postcard, see today's vibe. Triage is there when you need it; you'll mostly not.

CatMD uses AI (GPT-4o, Whisper, gpt-image-1) to interpret photos, behaviour, and audio. Not a substitute for veterinary care — for emergencies, contact your vet immediately.

Built by cat people, in consultation with feline-medicine vets. Available worldwide.

⚠️ CatMD is informational only. It is not veterinary advice, diagnosis, or treatment, and does not replace a licensed veterinarian. In a medical emergency, contact your nearest emergency vet immediately.
```

_(approx 2,700 / 4,000 chars — room to grow as features ship)_

---

## App category

- **Primary:** Lifestyle
- **Secondary:** Health & Fitness

_(Switched from Medical → Lifestyle in 2026-05-03 update. Medical category invites stricter "is this a medical device?" review at both Play and App Store; Lifestyle better matches the four-pillar positioning where Bond / Today / Chat carry most of the value. Health & Fitness as secondary preserves discoverability for symptom-search queries.)_

## Tags (up to 5)

1. Pet care
2. Cat health
3. AI assistant
4. Lifestyle
5. Symptom checker

## Contact details

- Email: `support@catmd.pet`
- Website: `https://catmd.pet`
- Privacy policy: `https://catmd.pet/privacy`

---

## Data safety form — answers prep

_Play Console requires a separate Data Safety questionnaire. These are the answers to prepare before opening the form:_

**Does your app collect or share any of the required user data types?** Yes.

| Data type | Collected? | Shared? | Purpose | Required? |
|---|---|---|---|---|
| Email address | Yes (optional) | No | App functionality, Account management | Optional |
| Name (cat name) | Yes (optional) | No | App functionality (personalisation) | Optional |
| Photos | Yes (user-initiated scans) | Yes (to OpenAI via proxy) | App functionality (AI triage / body-language / postcard) | Optional |
| Audio | Yes (body-language clips) | Yes (to OpenAI Whisper via proxy) | App functionality (vocalisation analysis) | Optional |
| App activity (scans, results, llm_usage) | Yes | Yes (PostHog analytics, anonymous distinct_id) | App functionality, Analytics | Optional |
| Device or other IDs | Yes (RevenueCat customer ID) | Yes (RevenueCat) | Purchases | Required |
| Purchase history | Yes | Yes (Google Play Billing, RevenueCat) | Purchases | Required |

**Is all of the user data collected by your app encrypted in transit?** Yes (TLS).

**Do you provide a way for users to request that their data is deleted?** Yes — `https://catmd.pet/delete-account` + in-app Settings → Forget me.

---

## AI content disclosure (Play Policy)

Play requires AI-content disclosure for apps that generate content. Answer:

**Does your app generate AI content?** Yes.
**Does it have a way to report offensive AI content?** Yes — the in-app feedback path + `support@catmd.pet`.
**What safety filters are in place?** Species-lock (cat-only), emergency keyword override, no-diagnosis language rules, source citation, prompt-injection shield. See `docs/ai-architecture.md`.

---

## Release notes (0.1.7) — paste into "What's new"

```
What's new in 0.1.7:

• Talk to your cat — chat replies in their voice, with their personality and memory
• Becoming — watch your cat take shape across 7 identity facets
• People & Pets — tag who's in their photos; names show up in the diary
• Self-facts — tell your cat something about themselves; they remember
• Photo tagging now auto-recognises the same person across photos
• Unlimited daily photos (postcard picks 3 at random)
```

_(approx 440 chars — comfortably under Play Store's 500-char "What's new" limit.)_

---

## Release notes (0.1.6) — previous release for reference

```
What's new in 0.1.6:

• Postcards: smarter photo collages — layout adapts to portrait/landscape mix, no more dark or washed-out exports
• Today: cleaner layout grouped into Today / Know your cat / Medical sections
• Pain check (Feline Grimace Scale) is now a primary feature on Triage
• Body language reader: clearer description of what the AI actually sees
• Daily photo cap: 4/day (collages stay tidy)
• Various copy tightening across onboarding and tiles
```

---

## Feature graphic (1024×500)

`store-listing/feature-graphic-1024x500.png` — generated 2026-05-03 from `scripts/generate-feature-graphic.py`-equivalent inline Python. Bond-led design: cream background, sage soft blob, serif tagline ("Built for cats. Trained on cats. By cat people."), 4-pillar chips (Today / Bond / Chat / Triage), app icon on right. Replaces the previous fear-led graphic.

---

## Screenshots (8) — see `store-listing/screenshots/curated/`

1. `01-today-sections.jpeg` — Today (anchor)
2. `02-postcard-catsby.jpeg` — Bond / Postcard
3. `03-personality-archetype.jpeg` — Bond / Personality
4. `04-poster-catsby-hero.jpeg` — Bond / Movie poster
5. `05-body-language-result.jpeg` — Today / Body Language read
6. `06-triage-result-monitor.jpeg` — Triage / Monitor result
7. `07-chat-knead.jpeg` — Chat
8. `08-diary-saturday.jpeg` — Bond / Diary

All four pillars covered. Bond-leading order. Triage in slot 6 with non-scary Monitor tier.
