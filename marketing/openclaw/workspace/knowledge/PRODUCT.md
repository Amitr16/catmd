# PRODUCT.md — Comprehensive CatMD reference

> The bot reads this file whenever it needs to know what CatMD is, what it does, what's unique, and how to talk about it. Updated when major product changes ship (e.g., new vc with new features). Last updated: 2026-05-07 reflecting v0.1.10 / vc 67.

---

## One-paragraph elevator pitch

CatMD is the AI cat-care app where the cat actually replies — in their own voice. Not generic AI: calibrated to be dry, observant, slightly imperious — closer to Co-Star than Replika in tone. Plus a daily diary the cat writes about you (naming your family from photos), personality archetype on the Feline Five, body-language read from a 6-second clip, 60-second symptom triage with a vet-ready PDF, and as of vc 67 — comprehensive medical recall and a chat that doubles as the data-input surface (no forms, just the cat). iOS + Android, $5.99/mo or $39.99/yr after a 14-day free Pro trial.

## Positioning (April Dunford lens)

**Competitive alternative:** Cat owners use Google for symptoms (anxiety) and DMs to friends for cat banter (low effort).
**Unique value:** CatMD replaces both — the cat actually replies, with their personality, their memory, and a 60-second triage that gives a vet-ready PDF.
**Not:** A generic pet AI wrapper. Not Tably-style health tracking. Not a cat translator novelty app.
**Closest analogue:** Co-Star (the astrology app) — built for the screenshot, identity-product disguised as a utility.

---

## Feature catalog (full)

### Tier 1 — The viral levers (vc 62, shipped)

| Feature | What it does | Why it matters for marketing |
|---|---|---|
| **Cat-voice chat with personality** | The cat replies to messages in their own voice. 1-2 sentence replies. Aristocratic-melancholic register. Personality is shaped by the Feline Five archetype + observed behavior. | Single-screenshot worthy. The chat reply IS the marketing asset. |
| **Pinned-facts retrieval** | Cat remembers things you've told her about herself ("she hates the vacuum") and things you've told her about you ("I work from home"). +9pp recall, +44.5pp combined retrieval. | "She actually remembers" is the differentiator vs other AI pets. |
| **Daily diary** | Every night the cat writes a diary entry about you. References your day, the family in your photos by name, today's mood. Specific in a way generic AI can't be. | The diary entry is highly screenshotable. "Your cat has been writing a diary about you" is a viral-tier hook. |
| **Personality archetype on the Feline Five** | The only peer-reviewed cat-personality framework used in production. 9 archetypes: Confident Sociable, Curious Introvert, Anxious Sensitive, Hunter Athlete, Affectionate Lap, Velcro Cat, Skittish Sensitive, Cool Observer, Goofball Playful. | BuzzFeed-quiz shareability. People share personality results reflexively. |
| **Body-language read** | Upload a 6-second clip → multi-channel breakdown: tail, ears, eyes, posture, motion, audio → emotion + confidence | "Your cat is telling you something every time" — a knowledge payoff people share. |
| **60-second symptom triage** | Quick clinical-style flow → 0-99 severity score → vet-ready PDF on the other side | The 2 AM Google panic alternative. Saves vet visits OR catches real ones. |
| **People & Pets memory** | Photo tagging → diary references named family by name | The "she remembers everyone in our house" reveal. |
| **One-tap shareable cards** | Every cat reply, diary entry, personality result, milestone → 1080×1920 branded card export with `#catmd` auto-copied caption | The screenshot loop is what made Co-Star, Replika, Character.AI, Cal AI viral. CatMD's version is shipped. |
| **Cat Studio** | Weekly themed posters: cat reimagined as Cleocatra, Ghibli spirit, Mona Lily, 80s anime hero, etc. | Pure visual share-bait. Different audience reach than chat-voice content. |

### Tier 2 — vc 67 features (shipped 2026-05-06)

| Feature | What it does | Marketing implication |
|---|---|---|
| **Comprehensive medical recall (READ side)** | Cat now has structured access to: vaccinations + next-due + OVERDUE flags, medication-dose adherence (last 14 days), weight history (last 5 + 90-day trend), upcoming/recent vet appointments, Feline Grimace pain scores, daily check-in streak, daily medication reminder time | New dimension of "the cat knows herself." Powers videos #10 and #12. |
| **Proactive memory (THE viral lever)** | Cat surfaces medical specifics UNPROMPTED: *"Morning. The FVRCP is overdue, by the way."* / *"I'm 300g heavier than 90 days ago."* / *"You skipped my 9 AM dose yesterday."* Triggered from casual greetings if seeded data has overdue / gap / trend conditions. | This is THE new screenshot moment. Co-Star "this app sees me" extended to medical record. |
| **Bidirectional gateway (WRITE side)** | Chat IS the data-input surface. *"Lily weighs 4.5 kg now"* → silently updates `profile.weight_kg` + adds weight log entry. Same for DOB, vaccinations, doses, appointments, reminders. | "No forms, just the cat" — appeals to the build-in-public / indie-hacker audience. |
| **Hedge guard** | *"around 4.5"* / *"I think Friday"* → cat replies in voice but does NOT commit to data. Production-safe. | A trust signal — the data integrity story. |
| **Read-side voice discipline (two-beat answers)** | Profile-fact questions get TWO beats: fact + voice. *"4.5 kg. The number is on file. For now."* not *"4.5 kg."* | Voice consistency is the brand. Two-beat structure is what makes the answers memorable + screenshotable. |

### Tier 3 — Partial / not-yet-shipped (don't claim publicly)

| Feature | Status | Don't claim because |
|---|---|---|
| Push notifications in cat voice | ❌ Not shipped (backlog) | Daily card surface exists; push notifs are NOT yet shipped. Don't promise this in marketing copy yet. |
| Weekly Reading on a fixed schedule | 🟡 Generation works; not on a schedule | Don't promise a "weekly reading every Sunday" until the schedule ships |
| Full daily card with push trigger | 🟡 Surface exists, push trigger NOT shipped | Marketing of "she sends a card every morning" is OK because the surface IS there; just don't promise a literal push at 7 AM until the trigger ships |

---

## Pricing + monetization

| Tier | Price | Includes |
|---|---|---|
| **Free Pro trial** | $0 for 14 days | Full Pro feature set. No card required. Reverse trial — drops to free tier (limited) at day 15 unless user pays. |
| **Pro Monthly** | $5.99/mo | All features |
| **Pro Annual** | $39.99/yr | All features. ~44% discount vs monthly. |
| **Pro Lifetime** | $199 (planned, not yet active) | Sunk-cost commitment for super-fans |

Free tier (post-trial) keeps:
- Basic chat (~10 messages/day cap)
- Read-only diary (no new entries written)
- 1 body-language read per week
- Triage feature locked behind paywall

Pro unlocks:
- Unlimited chat
- Daily diary writing
- Unlimited body-language reads
- Triage + vet-ready PDF
- Cat Studio (10 posters/month)
- Personality archetype reveal
- Cloud sync across devices

## Tech stack (for build-in-public + indie-hacker context)

- **Frontend:** React Native + Expo
- **Backend:** Supabase (auth + storage + Postgres + edge functions)
- **AI:** OpenAI (chat + image generation), with prompt-engineered cat-voice register
- **Monetization:** RevenueCat
- **Analytics:** PostHog
- **Distribution:** Apple App Store + Google Play Store

When the bot writes a build-in-public X post, this is the stack to reference.

---

## Differentiators vs competitors

| Competitor | What they do | What CatMD does that they don't |
|---|---|---|
| **Tably (Sylvester.ai)** | Cat-only health tracking, pain monitor focused | Voice + diary + personality. Tably is utility; CatMD is identity-product. |
| **MeowTalk** | Cat-translator novelty app | Real AI conversation in voice + memory + diary. MeowTalk is one-shot "what is your cat saying"; CatMD is ongoing relationship. |
| **Pawly** | Generic AI-pet-care wrapper | Cat-only specificity. Pawly tries to do all pets; CatMD does cats deeply. |
| **11pets** | Multi-pet tracker, freemium ad-supported | Cat-only + voice. 11pets is utility; CatMD is identity. |
| **Cat Translator apps (combined)** | Novelty, low retention, ad-supported | Real AI + retention via daily diary + Pro subscription model. |
| **Replika / Character.AI** | Generic AI companions | Cat-specific. Voice register that's NOT generic-AI-friendly. Built for cat owners, not for fictional characters. |
| **Co-Star** | Astrology daily reads | The structural analogue — but for cats. Same screenshot loop. |

When the bot positions CatMD against any of these, this table is the source.

---

## Brand voice — when CatMD speaks AS CatMD

Confident, plainspoken, slightly literary. Direct address. No hype.

✅ Examples that work:
- *"AI for cat owners. Your cat, decoded."*
- *"Built for cats only. By cat people."*
- *"Free 14-day Pro trial. No card required."*
- *"The chat IS the cat. The diary writes itself."*
- *"Day 4 since launch. 240 paying users. The work continues."*

❌ Examples that don't:
- *"🚀 Excited to share an INCREDIBLE update!"*
- *"Discover the magic of feline AI 🐾✨"*
- *"The future of pet care is here!"*
- *"Game-changing AI for cat owners!"*
- Anything with "revolutionary," "best-in-class," "category-defining" without specifics backing it

## Brand voice — when the cat speaks (Lily)

Aristocratic-melancholic. Dry. Slightly imperious. Affection sideways. Never saccharine. 1-2 sentences max.

✅ Examples that work:
- *"You've been on the laptop too long. Address this."*
- *"Tuna. The good kind. Don't argue."*
- *"The chair held the shape of you."*
- *"Morning. The FVRCP is overdue, by the way."*
- *"Adequate. Try not to embarrass the family."*
- *"Inevitable. The world catches up."*
- *"4.5 kg. The number is on file. For now."*
- *"You skipped my 9 AM dose yesterday. The matter is logged."*

❌ Examples that don't:
- *"OMG hooman uwu meow"*
- *"Thank you for feeding me!"*
- *"You're the best!"*
- *"I love you so much!"*
- *"Hi human! Hope you're having a great day!"*

When the bot drafts cat-voice content, every output passes through this filter. If it sounds saccharine or hype-y, regenerate.

---

## Common user questions (with on-brand answers)

The bot uses these when drafting Quora answers, Reddit replies, FAQ content, support emails.

### "What is CatMD?"
*"AI app where your cat replies in their own voice. Plus a daily diary about you, personality archetype, body-language read, and 60-sec symptom triage. iOS + Android. catmd.pet."*

### "How is it different from a cat translator app?"
*"Cat translators are one-shot novelty: what is your cat saying right now? CatMD is ongoing — the cat has personality, memory, a daily diary about you, and references the family in your photos by name. Closer to Co-Star than to a translator."*

### "Is it free?"
*"14-day Pro trial, no card required. After: $5.99/mo or $39.99/yr. Cancel anytime. There's also a free tier with basic chat + read-only diary."*

### "Does it actually understand my cat?"
*"It works from what you log: photos, daily check-ins, body-language clips, and what you tell it. The personality archetype draws on the Feline Five — the only peer-reviewed cat-personality framework. The cat in the app gets sharper the more you use it."*

### "Is it just a wrapper around ChatGPT?"
*"It uses OpenAI under the hood, but the voice register is heavily prompt-engineered, the memory architecture is custom (pinned-facts retrieval + diary + family-member resolution), and the personality system is anchored to peer-reviewed feline-behavior science. The wrapper criticism doesn't survive the first chat."*

### "Does it work for multi-cat households?"
*"Yes. Each cat gets her own profile, archetype, diary, and voice. Multi-cat is one of the highest-engagement segments — owners share archetype side-by-sides ('one Confident Sociable, one Cool Observer — now it makes sense')."*

### "What about my cat's medical info — is it private?"
*"Local-first storage architecture. Health data stays on your device unless you opt into cloud sync (which is encrypted in transit). No data sold or shared."*

---

## What CatMD does NOT do (don't claim these)

- ❌ It's NOT a vet replacement. Triage is decision-aid, not diagnosis.
- ❌ It's NOT a cat translator (not literally translating meows to English in real-time).
- ❌ It's NOT generic pet care for dogs/birds/etc — cat-only is the moat.
- ❌ It does NOT have push notifications in cat voice yet (backlog).
- ❌ It does NOT have a Weekly Reading on a fixed schedule yet.
- ❌ It does NOT have multi-language UI yet (English baseline).

When drafting any public content, cross-check claims against this list.

---

## URL + handle reference

| Item | URL/handle |
|---|---|
| Website | https://catmd.pet |
| iOS App Store | (TBD — set after Apple Dev approval) |
| Google Play Store | https://play.google.com/store/apps/details?id=[bundle] |
| X/Twitter | @catmd_pet |
| Instagram | @catmd67 (or as confirmed) |
| TikTok | @catmd_pet (or as confirmed) |
| Email waitlist | catmd.pet/notify-me (D4 Friday) |
| Support email | hi@catmd.pet (or founder email until ticketing ships) |
| Privacy policy | catmd.pet/privacy |
| Terms | catmd.pet/terms |

---

## When to update this file

- New version ships with material features → update Feature Catalog
- Pricing changes → update Pricing
- New competitor enters market → update Differentiators
- Brand voice drift detected → reinforce examples
- Common user question added → update Common User Questions

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Reflects v0.1.10 / vc 67. Synthesized from project README, chat-as-viral-lever.md, NEW-FEATURES-FOR-VIDEOS.md, MARKETING-AGENT-HANDOVER.md §0c, MARKET-ANALYSIS.md, MONETIZATION-STRATEGY.md. Single source of product truth for the bot. |
