# What CatMD Actually Does — Marketing Reference

*Last updated 2026-05-09 (build vc 82 / v0.1.18)*

This is the canonical "what's in the app right now" document for the marketing team. Use the copy here verbatim — it's already audited against the actual feature set. Anything not in this doc isn't shippable claim territory yet.

---

## The 30-second pitch

**CatMD is the AI-powered cat-care app that doubles as your cat's voice.** It watches what your cat does (photos, videos, your check-ins) and turns it into two things: vet-aware guidance for when something feels off, and a personality-driven companion who keeps a diary, sends you a daily card, and chats back like the cat you actually live with.

Three pillars, one app:

1. **Care** — triage scans, body-language reads, longitudinal health tracking
2. **Bond** — cat-voice chat, daily diary, shareable daily card, postcards, AI movie posters
3. **Memory** — the cat learns your household, your spaces, your routines, and references them by name

It's free to start, anonymous-first, no email required to use. Pro unlocks unlimited scans + the year-long diary archive + the full Cat Studio art rotation.

---

## Who it's for

Cat owners who:
- Worry about subtle symptoms but can't justify a $200 vet visit for a hunch
- Want a daily-loop reason to engage with their cat that isn't another social-media scroll
- Find pet-photo apps shallow and want one that *learns* about their cat over time
- Are 25-45 years old, urban or suburban, smartphone-first, often live with one to three cats

It's NOT for:
- Breeders or veterinary professionals (this is a consumer triage tool)
- Multi-pet households where dogs are the focus
- People who want literal medical diagnosis (we're explicitly an observation tool — we tell people to see a vet when something's worth a vet visit)

---

## Pillar 1 — Care (the "second opinion" angle)

### Triage Scan
The headline feature for first-time users. User describes a symptom (typing or photo or both); the AI returns:
- **Urgency tier**: routine / monitor / concern / urgent
- **0-100 severity score**
- **Plain-language interpretation**: what it likely is, what to watch
- **Action recommendation**: home-monitor / vet-soon / vet-now
- **Vet-PDF export** (Pro): clean clinical summary the vet reads in 30 seconds

What it CAN catch (in our internal benchmarks): vomiting patterns, eye discharge, lethargy clusters, mobility issues, urinary signs, weight changes flagged via litter-box or photo input.

What it CAN'T do (and we say this in-app): replace a vet. Diagnose. Prescribe. We always direct serious flags to a vet.

**Marketing angle:** *"The friend who's good with cats, in your pocket. For the 3am moment when something feels off but you don't know if it's nothing or everything."*

### Body Language Reader
6-second video → AI reads it. Posture, ears, tail, eyes, motion + audio (vocalizations). Returns a labelled-lines structure (Eyes / Ears / Tail / Body / Motion / Most likely / Right now / What to do).

Differentiator: it's not generic. The AI is told to write SPECIFIC observations grounded in this clip — *"tail tip twitching every 1-2 seconds, ears rotated outward by frame 4"* — not the generic "your cat appears calm and observant" most apps default to.

History view + per-reading notes. All readings feed the cat's personality scoring + diary memory.

**Marketing angle:** *"The vet-trained eye, every time you wonder what your cat is feeling. 6 seconds of video, the AI reads the room."*

### Longitudinal Health Tracking
The "your cat's chart" pillar. Tracks:

- **Vaccinations** (next-due / overdue tracking, vet name, lot number)
- **Medications + doses** (adherence visualisation, miss alerts)
- **Weight log** (90-day trend with gain/loss/stable direction)
- **Vet appointments** (next + recent completed with outcome notes)
- **Pain Score** (Feline Grimace Scale photo input)
- **Daily check-ins** (mood + appetite, ~10 sec)
- **Symptom photos** (timeline view)

All longitudinal data feeds the chat's voice and the diary, so the cat naturally references it.

**Marketing angle:** *"Your cat's full medical chart, kept by an AI that actually pays attention. The vet pulls it up; you don't have to remember a thing."*

---

## Pillar 2 — Bond (the "your cat's voice" angle)

This is the viral lever. Built around shareable, screenshot-able content.

### Chat (cat-voice)
The user types to their cat; the cat replies in first person, in character, using:
- The cat's actual personality archetype (one of 7+)
- Today's mood + appetite (from check-ins)
- Recent diary memories
- Named household members (from photo tags)
- Real objects in the cat's world (from photo extraction)
- Today's events (triage, photos, body-language reads)

Replies are tuned to be **screenshottable** — Co-Star-shaped one-liners, dry wit, cat attitude. Not chatbot-y; not love-bombing; not generic.

**One-tap share** on every reply: exports a 1080×1920 vertical card with the user's question + the cat's reply, ready for Instagram/TikTok story.

**Marketing angle:** *"Your cat finally talks back. With opinions. Screenshot the burns."*

### Daily Card (Co-Star analog)
Single shareable card with the cat's punchiest one-liner from today's diary. Co-Star horoscope shape. The cat photo + name + italic-serif quote + mood word + share button. Triggered by a 7pm push notification with the same line on the lock screen — user can screenshot the lock screen as-is.

**Marketing angle:** *"She sends me a card every evening. Like Co-Star, but the cat."* (This is literally Marketing Video #5.)

### Cat Diary
The cat writes a journal entry **every evening** (7pm local, "writing time"). Pulls from the day's actual activity:
- Photos taken
- Body-language readings
- Daily check-ins
- Chat conversations
- Health events (scans, vaccines, weight changes)
- Named people/pets seen
- Real objects in their world
- Recent moods + landmark events

The diary is in **the cat's voice** with their personality archetype baked in. Year-long archive (Pro). Each entry has a memory chip (when the cat references a past day, you tap and navigate to it).

**Empty days get a melancholic 1-2 sentence vignette** — Co-Star-style — once the cat has accumulated enough lifetime data to "miss" the human.

**Marketing angle:** *"Your cat keeps a journal. About you. It's not entirely flattering."*

### Postcard (photo collage)
Today's photos in a 1080×1080 or 1080×1920 collage with an AI-generated caption in the cat's voice. Edit the caption, share to socials, done.

**Marketing angle:** *"The cat-content post, generated. From today's photos. With caption."*

### Cat Studio (AI movie posters / themed art)
Weekly rotation of themes (Movie posters, Historical figures, Famous paintings, Studio Ghibli scenes, Pixar characters, 80s anime). The AI generates a poster of the user's actual cat in that theme. Shareable. ~30 seconds per generation.

**Marketing angle:** *"Your cat. As a Pixar character. As a Renaissance portrait. As a 1980s movie poster. Refreshed every week."*

### Weekly Reading ("She Noticed")
Sunday evening: the cat reads the HUMAN — what kind of week the human had, what shifted, what the cat noticed about them. Co-Star-shaped reverse-perspective card. Push notification, shareable.

**Marketing angle:** *"On Sundays, the cat reads you back."*

### Photo Studio
Per-cat photo gallery with date-stamped daily photos. Time-lapse playback (month at a time). Identity matching — when you take a photo with multiple cats, AI tells you which one is "your" cat. Subject tagging (people + other pets) auto-detects with vision.

### Cat Says (audio reactions)
Short audio clips of cat-style reactions (a meow, purr, hiss snippet). Used for re-engagement and surfacing.

---

## Pillar 3 — Memory (the "your actual cat" angle)

This is what makes CatMD different from every other AI cat app. The cat *learns* about its own world.

### Personality Profile
4-question quiz at first launch. The AI assigns one of 7+ archetypes (Velcro Cat, Hunter, Confident Sociable, Watchful Observer, etc.). The archetype shapes the cat's voice in chat + diary.

**Becoming depth** — a 7-facet meter that grows as the user engages: photos, chat turns, body-language sessions, check-in streak, named subjects, personality quiz answered, diary entries. The deeper the meter, the more the cat speaks with confidence ("I am well-formed in here").

### World Memory (silent)
The AI watches the photos you upload. Vision pass extracts:
- **Objects** (the green chair, the cat tree, the rug, the kicker toy)
- **Places** (the kitchen window, the balcony, the garden)
- **Environment markers** (snow outside, sunny morning, rain)

Items that show up in **2+ photos within 30 days** silently graduate from candidates to permanent memories. The cat then references them by name in chat and diary.

User wonders: *"How does Lily know we have a green chair?"* — that's the magic moment.

The user can also tell the cat directly in chat ("Lily loves the kicker toy") — the AI extracts it as a memory immediately.

**Marketing angle:** *"You don't tell her anything. She just knows. Wait until she mentions the windowsill."*

### Household Directory ("People & Pets")
Tag people and other pets in your photos. The cat learns:
- Their name
- Their relationship (mother, partner, friend, neighbour's dog)
- A "vibe" the AI summarises after enough appearances
- How often they show up + when last

The cat references them by name in chat ("yes, Mom was here three days ago — she brought the loud bag"). Enables multi-cat-household disambiguation: which cat is in this photo?

### Self-Facts (durable)
You tell the cat things in chat ("you love tuna"). The AI extracts and stores it. The cat then references it as established self-knowledge. Survives forever, syncs to cloud.

### Diary Archive
365 days of daily entries cached on-device, full year+ on cloud. Each entry has a hero photo (when one was taken that day), a mood word, the entry text, and a memory chip linking to a past day the cat referenced.

**Free tier**: last 7 days. Pro: full year.

---

## How it all connects (the moat)

This is the part marketing should hit hard. Most cat apps are single-feature: photo gallery, OR chat, OR symptom checker. CatMD's depth is that **everything connects**:

- Take a photo → AI detects the green chair → cat references it in chat tonight → diary mentions Lily was on it
- Run a triage scan → cat in chat acknowledges feeling off → diary tonight writes about the rough day
- Tag your mom in a photo → cat references "Mom" in chat → diary mentions her visit when she comes over
- 5 days of "off" mood check-ins → cat's chat replies become curt → diary writes melancholic-direction entries

This is the **user-perceived intelligence** layer. The competitive moat. None of the AI-cat apps that exploded in 2025 have it.

---

## Free vs Pro

### Free tier (generous)
- 3 triage scans per month
- 3 body-language reads per day
- Last 7 days of diary archive
- Daily check-ins
- Photo Studio (unlimited photos)
- Chat (no message cap)
- Postcards
- World memory + personality
- Cloud backup + cross-device restore (requires email)

### Pro ($X/month, $Y/year, $Z lifetime)
- Unlimited scans
- Full year-long diary archive
- Cat Studio (all themes, weekly rotation)
- Vet PDF export
- Birthday album
- Weekly reading expanded archive

The paywall surfaces gracefully — no nag screens. We trust users to convert when they hit the limits, not when we shove the upsell at them.

---

## Notifications (the engagement loops)

CatMD's notification strategy is *"few but valuable"*:

- **7pm cat-voice diary push** — daily reminder "your cat's diary is waiting" (rolling 7-day window — auto-stops if user goes inactive for a week, prevents Android demotion)
- **Weekly reading push** — Sunday evening "she noticed"
- **Birthday / adoption-iversary** — once per year
- **Streak milestones** — 7/14/30/60/90/180/365 day check-in streaks
- **Health insight** — "Lily has logged 3 'off' days this week — worth a scan?"
- **Outcome check-in** — 48 hours after a triage scan, "how's Lily doing?"
- **Med reminders** — daily, user-configurable
- **Body-language nudge** — 7 days after last reading, "want to read her?"

Every category is independently toggleable in settings.

---

## Cross-device + privacy

- **Anonymous-first** — no signup required to use the app. Anonymous Supabase auth gives every install a unique ID instantly.
- **Email-optional** — only required for Pro subscriptions and cross-device restore.
- **Cloud backup** — all per-cat data (cats, scans, events, photos URIs, diary, chat, personality, world, subjects) syncs to Supabase. Reinstall on another device → enter email → restore.
- **Forget-me** — one-tap full data deletion (local + cloud RPC).
- **Privacy-first defaults** — analytics opt-in via env flag (currently always-on for testing).
- **Permissions clearly justified** — camera (scans + body-language), microphone (audio analysis), location (today's weather, rounded to 10km), nothing else.

---

## Killer differentiators (what to lead with)

In rough order of marketing leverage:

1. **The cat actually has personality + memory.** Most AI cat apps are interchangeable. This one feels like *your* cat because it learned about your home from your photos.
2. **Triage that respects the vet.** Not "diagnose your cat" (which gets you rejected from Play). Observation + flag + "see a vet when it's worth it."
3. **Daily Card / Co-Star moment.** Single most viral surface — the cat's daily one-liner on a shareable card. *"She sends me a card every evening."*
4. **Body-language reader.** No one else has this with frame-level interpretation. 6-second video, vet-grade output.
5. **The chat replies are share-bait.** Every reply is screenshottable. Built around the meme-able cat-voice attitude.
6. **Year-long diary in your cat's voice.** Co-Star-meets-journal. Becomes a literal year-end keepsake.
7. **Anonymous-first.** Lowest possible friction to first scan / first chat. No signup wall.

---

## What's NOT in the app yet (don't promise)

To prevent marketing from over-promising:

- ❌ **Multiple languages** — English only for now
- ❌ **Real-time vet chat** — we're not connected to live vets
- ❌ **Auto-shipped supplements / food** — no commerce yet
- ❌ **Smart-collar integration** — no hardware partners
- ❌ **Apple HealthKit / Google Fit sync** — pet data isn't in those platforms anyway
- ❌ **Multiple humans per cat / shared households** — one device per cat
- ❌ **Server-side daily diary cron** — entries write client-side when user opens the app post-7pm. Users who never open the app for a week have gap days, not auto-written entries.
- ❌ **Voice-call chat** — text only
- ❌ **AR or live camera filters**
- ❌ **Scheduled subscription gifting / family plans**

---

## Demo recipes (filmable in <60 seconds each)

For your Hailuo / fal.ai video producers:

1. **The triage moment**: Cat looks lethargic → user opens scan → types "she hasn't eaten and keeps hiding" → result lands → tier "concern" → outcome check-in 48h later
2. **The chat moment**: User types "morning" → cat replies with attitude → user laughs → taps share → IG story posted
3. **The diary moment**: 7pm push fires → user taps → diary opens with today's entry in cat-voice → user reads → memory chip → tap → past day surfaces
4. **The "she knows" moment**: Cat in chat references "the green chair" → user looks confused → cuts to user's actual house showing the green chair → caption *"she figured it out from the photos"*
5. **The Daily Card moment**: Lock screen shows push *"the bird at the window was unreasonable for thirty seconds"* → screenshot → IG story
6. **The body-language moment**: Cat hunched, ears back → user records 6 seconds → AI returns *"defensive crouch, ears pinned, tail tucked — something startled her in the last hour, give her space"* → cuts to cat slowly emerging
7. **The Cat Studio moment**: User taps "Renaissance" theme → 30 seconds → AI returns cat-as-Renaissance-portrait → share

---

## Taglines we could use

Pick the angle that matches the channel:

| Channel | Tagline |
|---|---|
| TikTok / Reels (high virality) | *"Your cat finally talks back. With opinions."* |
| Instagram (aesthetic) | *"She keeps a journal. About you. Not entirely flattering."* |
| Reddit / r/cats | *"The 3am app. For the moment something feels off."* |
| Play Store description (search) | *"AI-powered cat triage, body-language reader, and daily diary in your cat's voice."* |
| Influencer pitch | *"Co-Star, but the cat. Daily card every 7pm."* |
| Vet-adjacent / pragmatic | *"Your cat's full chart, kept by an AI that pays attention."* |

---

## Internal: who to reach for what

- **Triage / health questions**: refer to `src/services/diary.ts`, `services/triage.ts`, `services/healthScore.ts`
- **Voice / chat questions**: `src/services/chat.ts`
- **Diary writing details**: `src/services/diary.ts`, `src/state/diaryStore.ts`
- **Memory / world**: `src/services/worldExtraction.ts`, `src/state/worldStore.ts`
- **Privacy / data**: `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md`
- **Pricing**: `docs/MONETIZATION-STRATEGY.md`, `docs/PRICING-AND-LIMITS-FRAMEWORK.md`
- **Existing marketing strategy**: `marketing/MARKETING-STRATEGY-MOONSHOT.md`

---

## One-paragraph summary marketing can paste anywhere

> CatMD is the AI cat-care companion that fuses three things into one app: vet-aware health triage (scan a symptom, get an urgency tier in 60 seconds), an AI body-language reader (6-second video → posture/ears/tail interpretation in the voice of a cat-savvy friend), and a personality-driven cat companion who keeps a daily diary in your cat's voice, sends you a Co-Star-style daily card every 7pm, and references your home's actual people, pets, and objects after learning about them silently from your photos. Free to start, anonymous-first, no signup. Pro unlocks unlimited scans + the year-long diary archive + AI-generated themed art.
