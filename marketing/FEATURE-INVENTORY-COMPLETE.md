# CatMD — Complete Feature Inventory

> **For the marketing agent.** This is the canonical master reference
> for every feature the app ships. Supersedes the per-feature notes
> (`MEOW-TRANSLATOR-FEATURE-NOTE.md`, `HEALTH-RHYTHM-AND-GRIMACE-FEATURE-NOTE.md`)
> for the where-it-lives / what-it-does picture. Per-feature notes
> stay for deep marketing detail (positioning, copy angles, comparison
> tables).
>
> If anything else in marketing docs contradicts this, **this is canonical**.
>
> Last refresh: 2026-05-18 — vc 99 AAB built (awaiting Play Console upload).
> Production app on Google Play remains vc 94 until that upload lands.
> Adds since vc 94: **Partner code system (vc 96)** + **3-tier depth-modulated
> cat voice (vc 99)** + **PersonalityProgressBanner on Chat + Diary (vc 99)**
> + **removed Caution mood banner (vc 99)** + **catmd.pet expansion** (3 new
> library articles, /cat-symptom-checker + /cat-personality-test tool pages,
> 2 SEO title-tag fixes, 8 orphan articles linked). Earlier refresh
> (2026-05-16, vc 94) added: 15-mood daily lottery + 15 voice modes + 4-tier
> voice quality gate + live mood overlay (weather/weight/water/pain/appetite/
> litter/meow) + YOUR WORLD grounding + date-anchored backfill + marketing
> attribution. Pricing: $9.99/mo + $79.99/yr (partner-code variant $55.99/yr;
> no Lifetime; 14-day reverse trial).

---

## Part 0 — Tab map (canonical)

Four bottom-tab surfaces:

| Tab | Identity | Lives here |
|---|---|---|
| **Today** | "Do something with your cat right now." Daily ritual + quick actions. | Daily check-in, score ring, today's diary teaser, today's photo strip, Body Language tile, Meow Translator tile |
| **Bond** | "Look back at your cat." Emotional, creative, identity surfaces. | Personality, Diary, Postcard, Photos, People & Pets, Cat Studio (posters), Memory Book (seasonal) |
| **Chat** | "Talk to your cat." Conversational AI. | Chat, "Things {Cat} said" Greatest Hits scroll |
| **Triage** | "Something feels off." Medical + trend analysis. | Scan, Health Rhythm, Vaccinations, Medications, Weight + BCS, Appointments, Symptom timeline, Is this safe?, Vet PDF, Pain check, SRR, Litter, CKD screen, Hyperthyroid screen |

---

## Part 1 — Today tab features

### Daily check-in card (the retention lever)
- **Where**: `app/(main)/index.tsx` top of Today tab
- **What**: 10-second card. Tap mood (happy / normal / off) + appetite (full / half / none). Optional one-line note.
- **Why it matters**: THE daily-habit anchor. 30 days of check-ins establishes baseline that drives every other AI signal in the app. Streak counter (🔥 N days) creates habit pressure.
- **Behind**: writes a `daily_checkin` healthStore event → catContext → drift detection → diary mood → chat tone.

### Track-more chips (the under-tracked-inputs bridge)
- **Where**: appears below the check-in card when a tracker is stale
- **Chips shown**: Weight (>14d stale), Water (>14d), Litter (>7d), Resp rate (HCM-risk breeds only, >30d)
- **Behaviour**: only appears when at least one tracker is stale; auto-collapses once the user has logged anything; expand on tap → 4 chips → tap any chip deep-links to its existing /health/* screen
- **Why it matters**: bridges the daily 10-second habit to the weekly trackers Health Rhythm needs. Without this, weight + water + litter sit 3 taps deep in Triage and never get logged.

### Score ring + today's diary teaser
- **Score ring**: computed from the latest scan + recent check-ins (positive check-ins raise the score, hard-urgency scans lock it)
- **Diary teaser**: shows today's diary entry inline (or a "writing tonight" placeholder before 7pm — diary generates after 7pm to capture the full day)

### Body Language tile (quick-action read)
- **Route**: `/behavior`
- **What**: record 6 seconds of video → AI reads tail, ears, eyes, posture, motion across the clip + audio (any vocalisations) → returns multi-channel structured read with "Most likely:" headline
- **Backed by**: real cat-behaviour research (Bradshaw, Ellis, Delgado). 5-channel visual + 1 audio = 6 channels in parallel.
- **Trust hook**: "Read how it works →" link → `/library/how-body-language-readers-work`
- **History**: every reading saved at `/behavior-history` with notes + delete
- **Cost**: ~$0.005/run (gpt-4o-mini multimodal + Whisper)

### Meow Translator tile (quick-action read)
- **Route**: `/translate`
- **What**: record 4 seconds → audio + body language + per-cat memory fuse into ONE line in the cat's actual voice. Output: 40-160 chars, italic-serif on the screen, Share button right there.
- **Per-cat personalisation**: uses name, breed, archetype, recent events, world memory entries, recent triage flags. Lily says different things than Mochi does.
- **No-meow gate**: silent clips route to Body Language Reader instead — the translator's product contract is "you record a meow, we interpret the meow". Won't fake a translation from silence.
- **Trim picker**: 8-thumbnail reel for uploads > 7 sec — pick which 4 seconds to translate
- **Trust hook**: "Read how it works →" link → `/library/how-meow-translators-work`
- **History**: every translation saved at `/translate-history` + folded into the cat-says Greatest Hits scroll with a "translated meow" badge
- **Cost**: ~$0.0013/run
- **Daily limit**: 5/cat (free tier, generous for funnel measurement)

### Today photo strip
- **What**: thumbnail strip of today's photos taken in the app
- **Add tile**: always visible, opens camera or gallery picker
- **Pipeline**: each new photo silently triggers world extraction (objects/places) + subject detection (named people/pets) + scene caption (one-line "Lily on the green chair in afternoon light" memory)

### Other Today-tab surfaces
- **Pending follow-up banner**: when a scan from 6h–14d ago hasn't been responded to → one-tap path to outcome-check
- **Vaccine overdue banner**: when any vaccine is past its due date
- **Photo cap counter**: only when free tier near limit

---

## Part 2 — Bond tab features

### Personality (Feline Five)
- **Route**: `/personality`
- **What**: 15-question quiz adapted from the research-validated **Litchfield Five framework** (Litchfield et al, *PLOS ONE*, 2017 — surveyed 2,800+ cats living in homes). 5 traits + 5 archetypes:
  - **Confident-Communicator** — outgoing, vocal, social
  - **Hunter-Athlete** — high-spontaneity, predatory, fast
  - **Skittish-Sensitive** — withdrawn, wary, easily-startled
  - **Velcro-Cat** — needy, affectionate, attached
  - **Cool-Observer** — independent, dignified, low-affect
- **Why it matters**: drives voice register across chat + diary + meow translator + postcard captions. Every output sounds like the actual archetype — Confident-Communicator says different things than Skittish-Sensitive in the same posture.
- **Confidence labels**: forming / stable / locked-in — surfaces honestly when the reveal is too early.

### Cat Diary (the brand surface)
- **Route**: `/diary`
- **What**: every evening at 7pm, the cat "writes" a journal entry about their day in first-person, present-tense, in their archetype's voice. 4-7 sentences. Warm, observant, slightly imperious. Backfills history when the user opens the app.
- **Inputs**: today's check-in (mood + appetite), behaviour observations, scans, meow translations, world entries, named subjects in photos, weather, mood arc, anticipation events (birthday, vet visit), recurring chat themes
- **7pm gate**: prevents stale "this morning..." entries written in the afternoon. Backfill is dated correctly.
- **Cost**: ~$0.0003/entry (gpt-4o-mini)
- **The viral moment**: users screenshot diary entries that sound uncannily like their cat. THE primary share artefact.

### Daily Card
- **Route**: `/daily-card`
- **What**: a single-frame "today, in your cat's voice" card — one-line headline + photo + the cat's signature line. Designed as a shareable artefact distinct from the full diary entry.

### Postcard (today's share)
- **Route**: `/postcard`
- **What**: AI-generated postcard — a caption-on-photo composition from the day's photos. Brand-styled cream/sage layout, in the cat's archetype voice. Shareable as image.

### Photos + Time-lapse
- **Route**: `/photo-studio`
- **What**: gallery of every photo taken in-app. Time-lapse view when ≥7 photos.
- **Behind**: every photo triggers silent world extraction + subject detection + scene caption (vision pipeline runs once per photo; the cat memorises the green chair, the cream blanket, mom's recurring presence)

### People & Pets
- **Route**: `/people`
- **What**: directory of named humans + pets the cat sees in photos. AI auto-detects faces / pet shapes; user tags them once → the cat "remembers" them by name in chat + diary. ("Mom was here again." / "Haven't seen Bella in three days.")
- **Pipeline**: subject detection + identity matching + manual tag from the SubjectTagSheet during photo flow.

### Cat Studio (themed posters)
- **Route**: `/cat-studio`
- **What**: weekly themed AI poster generator. Every Sunday 10am a new theme rotates — movie posters, famous paintings, historical figures, Studio Ghibli scenes, Pixar, 80s anime. User submits the week's photo (one slot per theme per week) → gpt-image-1 generates the poster. "Lord of the Meows" / "Cleocatra" / "Mona Lily."
- **Safety**: built-in safety-retry path for the rare gpt-image-1 content-policy 400.
- **Cost**: ~$0.10/poster (per-image rate). Weekly cap protects the budget.

### Memory Book (year-in-review, seasonal)
- **Where**: Bond tab, **only visible Nov-Dec** of each year (months 10-11)
- **What**: planned year-in-review tile. Like Spotify Wrapped, for a cat. Target build: Q3 2026 once the earliest beta cohort hits 6mo of data.
- **Marketing note**: tile is hidden off-season because "January wrapped" with 11 days of data is empty calories. Be careful — referencing this in copy now is over-promising.

### Becoming meter
- **Route**: `/becoming` (also surfaces inline on Bond)
- **What**: live 7-facet score (face, voice, body, rhythm, family, nature, memory) showing how shaped the cat-in-the-app has become. Every action (check-in, photo, scan, translation, body-language read, named person tag) bumps a facet.
- **Why it matters**: the visible signal of the compounding loop — every interaction makes the cat sharper. Gamification without being a game.

### Hero photo capture (Bond's "add photo")
- **Where**: top of the Bond tab
- **What**: THE photo-capture entry point. Camera or gallery. All photos feed Postcard collages, Cat Studio reference, diary vision context, time-lapse gallery, world extraction.

---

## Part 3 — Chat tab features

### Chat with the cat
- **Route**: `/(main)/chat`
- **What**: conversational AI that IS the cat. First-person, in the archetype's voice. Knows everything the cat would: name, breed, sex, age, weight + BCS trend, conditions, medications, vaccinations (incl. overdue), upcoming vet visits, recent scans, daily check-ins, named family in photos, world memory (objects/places), recent meow translations, body-language readings, mood arc, recurring chat themes, named self-facts ("you love tuna").
- **Proactive memory**: cat surfaces medical specifics UNPROMPTED — *"Morning. The FVRCP is overdue, by the way."* / *"I'm 300g heavier than 90 days ago."* / *"You skipped my 9 AM dose yesterday."*
- **Today vivid**: cat has sharp recall of today's events with hh:mm anchors; older days blur per cat-memory research.
- **Sensory voice**: scent > sound > touch > location > fact. *"You smelled like outside"* not *"you went out"*.
- **Forgetfulness as charm**: ~1 in 8-10 replies, when referencing 4+ day-old events, cat is allowed to blur ("that was Tuesday, or maybe Wednesday").
- **Anti-hallucination**: hard rule — never invent rooms, weather, heating fixtures, people, food, or specific weekdays for non-today events. Anchored in YOUR WORLD (registered objects) + named subjects + today-vivid block.
- **Safety**: when symptoms come up, cat emits action tokens (`[ACTION:OPEN_TRIAGE]` / `[ACTION:CALL_VET]`) that render as inline buttons. Emergency keywords override soft-voice — *"Vet now. Right now."*
- **Cost**: ~$0.0008/turn (gpt-4o-mini)

### "Things {Cat} said" — Greatest Hits scroll
- **Route**: `/cat-says`
- **What**: shareable scroll of the cat's most-screenshot-worthy past chat replies AND meow translations, merged into one stream. Each has a Share button. Translations get a "translated meow" badge.
- **Scoring**: heuristic — length sweet spot 40-160 chars, declarative, no action tokens, no hedge words.
- **Why it matters**: re-engagement loop. Users come back to scroll the highlights.

---

## Part 4 — Triage tab features

### Scan (the medical entry point)
- **Route**: `/scan` → `/result`
- **What**: multi-modal triage. Photo + symptom text → AI returns a structured result with:
  - **0-99 health score** (the magic number)
  - **Urgency tier**: routine / monitor / concern / urgent
  - **Confidence**: high / moderate / low
  - **Differential diagnoses** ranked by likelihood
  - **Red flags** if any
  - **Vet-ready next steps**
  - **Hard-urgency lock**: Layer-1 emergency keywords (lily ingestion, blocked urination, open-mouth breathing, seizure) override the score → forces concern/urgent tier no matter what the model says
- **Cost**: ~$0.01-0.02 per scan (gpt-4o-mini multimodal + classifier)
- **Free tier**: 3 scans/month. Pro unlocks unlimited.

### Health Rhythm (30-day trend visualisation)
- **Route**: `/health-rhythm`
- **What**: pure deterministic aggregator — NO ML — over the user's logged data. 30-day window. Shows:
  - **Mood timeline** (per-day slots)
  - **Appetite timeline**
  - **Weight sparkline** (last 8 measurements + 90-day trend)
  - **Activity heatmap** (events per day)
  - **Top behaviour-obs tags** (chips)
  - **Scan urgency mix**
  - **Drift cards** — the headline. Six deterministic rules:
    - 3+ "off" mood days in past 7 → **concern**
    - Any "none" appetite in past 7 → **concern** (anorexia → hepatic lipidosis in 48-72h)
    - 3+ "half" appetite in past 7 → **watch**
    - Weight ±5% in window → **watch**; ±10% → **concern**
    - 7-day / 30-day streak → **good**
    - <40% logging coverage → **watch**
    - Urgent scans in window → **concern**
- **Why it matters**: the data is the input, the *interpretation* is the output. Where most apps show dashboards and trust the user to read them, this reads them for you. Vets pattern-match on exactly these signals.

### Pain check (Feline Grimace Scale)
- **Route**: `/health/pain`
- **What**: single-photo FGS scoring. AI rates 5 facial action units (ear position, orbital tightening, muzzle tension, whiskers, head position) 0-2 each → composite 0-10. Composite ≥4 = consider vet examination.
- **Backing**: Evangelista et al, *Scientific Reports* 2019, University of Montreal. Validated against acute pain, chronic pain, postoperative. The actual scale vets use.
- **Why it matters**: **cats hide pain** — they're prey animals, behavioural pain masking is evolved. The FGS reads the FACE where they can't mask it. Genuinely high-leverage for senior / arthritic / post-op cats.

### Sleeping respiratory rate (SRR)
- **Route**: `/health/srr`
- **What**: tap-per-breath timer, 30 sec. Alert at >30 bpm.
- **Why it matters**: gold-standard early-warning for **hypertrophic cardiomyopathy (HCM)**. Affects Maine Coon, Ragdoll, Sphynx, Persian, British Shorthair, Bengal, Norwegian Forest, Siberian disproportionately. SRR rising before symptoms = early-detection lead time of weeks.
- **Surfaced in app**: the Track-more chip on the daily card auto-shows for HCM-risk breeds.

### Litter-box analysis
- **Route**: `/health/litter`
- **What**: photo-based screening for urine blockage, polyuria, crystals, blood, stool pattern. Plus frequency logging — abnormal-flag triggers high salience in the cat's memory (flagged litter trips persist in chat/diary context).

### Water intake
- **Route**: `/health/ckd` (lives inside the CKD screen — quick +50ml / +100ml buttons)
- **What**: logs ml intake. Low single-log values (< 30ml) flag as salient — surfaces in chat/diary memory. Feeds CKD screening.

### CKD screening
- **Route**: `/health/ckd`
- **What**: aggregates water intake, weight trend, urination patterns, age. Flags polydipsia / weight loss / urinary changes — the early CKD triad. Doesn't diagnose; flags worth-a-vet-conversation patterns.

### Hyperthyroid screening
- **Route**: `/health/hyperthyroid`
- **What**: aggregates weight loss, increased vocalisation, behavioural restlessness, age. Flags early hyperthyroid pattern. Doesn't diagnose; routes to vet.

### Vaccinations
- **Route**: `/health/vaccinations`
- **What**: log past vaccines + next-due dates. Cat references overdue ones in chat unprompted. Push notification when due.

### Medications
- **Route**: `/health/medications`
- **What**: daily-dose log + refill tracking + side-effect notes. Cat references missed doses in chat. Daily reminder push at the configured time.

### Weight + BCS
- **Route**: `/health/weight`
- **What**: weight log + body-condition score (1-9 WSAVA). Sparkline chart. 90-day trend computed automatically.
- **Feeds**: body self-image (the cat speaks from its actual body in felt-sense terms), Health Rhythm drift, CKD/hyperthyroid screens.

### Appointments
- **Route**: `/health/appointments`
- **What**: vet visit calendar. Anticipation events (days-until) surface in diary entries and chat ("Tuesday. The vet visit. I am not pleased."). Outcome notes capture what happened after.

### Symptom timeline
- **Route**: `/health/symptom-timeline`
- **What**: date-stamped photos of a healing wound / rash / eye issue. Side-by-side photo grid. The "is it getting better?" surface — bring it to the vet visit.

### Is this safe? (food / plant / drug lookup)
- **Route**: `/health/food-safety`
- **What**: name-based lookup → toxic / OK verdict + reasoning. First-aid guidance for common ingestions. Direct dial to ASPCA poison hotline.

### Vet visit summary (PDF export)
- **Route**: `/health/summary`
- **What**: one-tap 12-month report. Chronology + symptom timeline + weight trend + scans + check-ins + vaccinations + meds. Designed for the vet to read in 60 seconds. Email / share / print.

### Emergency vet finder
- **Trigger**: fires when a scan returns emergency-tier urgency
- **What**: one-tap dial to nearest 24/7 ER vet + ASPCA poison hotline. Location-aware.

### 🆕 Vet-share nudge (vc 96) — bridge AI flag → vet conversation
- **Where**: `app/result.tsx` — card on the scan result screen
- **Trigger**: only renders when scan urgency is `monitor` or `concern`. Skipped for `routine` (no urgency to share) and `urgent` (the EmergencyActionBar handles it).
- **What**: one-tap pre-filled observation summary sent via native share sheet (WhatsApp / SMS / email / whichever the owner picks). Template includes:
  - cat name
  - urgency tier
  - 0-99 health score
  - main concern (from differentials[0] or headline)
  - red flags (or "none flagged")
  - owner's symptom notes
  - explicit "not a diagnosis" framing + ask
- **Why it matters**: the bridge from "AI flagged something" to "vet conversation happened." Closes the loop on the triage's job-to-be-done. Pairs with the existing PDF export on `/health/summary` — that's the heavyweight version; this is the 10-second version.

### 🆕 Vet-confirmed outcome story funnel (vc 96) — feedback loop for press / case-study
- **Where**: `app/outcome-check.tsx` (testimonial modal) + `src/components/TestimonialStoryModal.tsx` (the UI) + `src/services/vetConfirmedStories.ts` (write-only API) + `knowledge-pipeline/supabase/schema-vet-confirmed-stories.sql` (Postgres table + RLS)
- **The trigger event**: `scan_outcome_vet_confirmed` PostHog event fires whenever the owner saves outcome-check with `vet_visited === 'yes'`. Props include `scan_id`, `cat_id`, `original_urgency_tier`, `health_score`, `days_since_scan`. **This is the core funnel-instrumentation event — every other "CatMD caught X" claim downstream traces back to this.**
- **The testimonial modal**: opens AFTER outcome-check save when (a) `vet_visited === 'yes'`, (b) direction is not 'worse' (don't ask while they're worried), and (c) 90-day cool-off has elapsed. Four fields: what you noticed first / what CatMD flagged / what vet said / how cat is doing now. Four permission options: private / anonymous quote / first name + cat name / contact me first. Conditional contact-email input.
- **The private story store**: Supabase table `vet_confirmed_stories` (16 fields). RLS: authenticated INSERT only on own user_id. SELECT/UPDATE/DELETE are service-role only — the app cannot read submitted stories back. Admin views stories via SQL dashboard, marks `press_pitch_candidate=true` for usable ones, then queries `vet_confirmed_stories_press_ready` view.
- **Anti-harassment**: 90-day cool-off after submit OR skip. AsyncStorage key `@catmd/testimonial_prompt_cooloff_until` gates re-prompts.
- **Why it matters**: the press pyramid (Catster → Modern Cat → The Dodo → tier 1) needs 5-10 real stories with names + quotes + consent. Without this system, those stories exist only as untracked anecdotes. With it, every "CatMD caught my cat's [hyperthyroid / dental disease / urinary blockage]" moment gets captured at the moment of happening with permission attached. **Marketing's most consequential dataset.**
- **NOT externally marketed**: this is an internal feedback loop. Don't reference the story store / testimonial form in user-facing copy, blog posts, or press. It's the input to those things, not the thing itself.

### Library (long-form reference)
- **Route**: `catmd.pet/library` (web — surfaced via "Read how it works" links + Triage tab)
- **What**: 20+ peer-reviewed-style articles. Body-language guides, vocalisations, personality framework, emergency conditions (lily ingestion, urethral blockage), routine concerns, kitten development, senior care, multi-cat households, AI cat apps explainer.
- **All cross-linked + FAQ schema** for Google rich snippets.

---

## Part 5 — Silent backend features (never visible — power everything else)

### Cat memory architecture
- **CatContext aggregator**: pulls profile + reminders + vaccines + meds + weight trend + appointments + pain scores + check-in patterns + scan history + recent events (salience-filtered) + behaviour tags + recent meow signals + body self-image + today vivid + today deltas + world entries + recurring chat themes + named subjects + named self-facts + weather + anticipation events. **One canonical object** every AI feature consumes.
- **Recency × salience filter**: routine events fade fast (today vivid → yesterday clear → week-old vague → two-week-old forgotten unless emotionally salient). Cat-memory research–aligned (Takagi et al, Kyoto 2017).
- **Today vivid block**: chronological hh:mm-anchored list of today's events. The ONLY place the cat may cite specific times.
- **Today deltas**: deterministic deviations from baseline ("you were quiet this morning", "no photos today"). The "I noticed you" hook.
- **Sensory voice rule**: scent > sound > touch > location > fact. Cat references "you smelled like outside" not "you went out".
- **Forgetfulness as charm**: ~1 in 8-10 replies allows uncertainty about 4+ day-old events. Never today/yesterday/bonded people/food.
- **Body self-image**: derived from breed × age × weight × BCS. Cat speaks from "I'm a stocky senior" not "I weigh 7.1 kg".
- **Anti-hallucination guardrails**: explicit banned-fabrications list — no invented rooms, no invented weather, no climate-blind defaults (radiators, sunbeams), no invented food/brands/people.

### World memory (silent vision)
- **Pipeline**: every photo + every body-language clip → vision model extracts objects (the green chair, the cream rug), places (the garden, by the window), environment (snow outside, evening light) → ingests into world store → after 2+ sightings, candidate graduates to confirmed entry → cat references it in chat + diary
- **Plus**: one-line scene caption per photo ("Lily on the green chair in afternoon light, half-closed eyes") → fed to chat prompt's today-vivid block
- **Why magic**: user thinks *"wait, how does Lily know about the green chair?"* — the silent registry is the answer.

### Subject directory (named people + pets)
- **Pipeline**: every photo → identity model detects people/pet faces → user tags once → recurring entity gets a count + last-seen date → cat references by name in chat + diary
- *"Mom was here again."* / *"Haven't seen Bella in three days."* / *"Dad still hasn't refilled the bowl."*

### Self-facts extraction
- Pipeline: chat turns → AI extracts owner-asserted facts about the cat → stored as self-facts → cat references them as truth ("you love tuna", "I sleep on dad's pillow")

### Photo scene memory
- Vision-grounded caption per photo, cached locally, surfaces in today-vivid block

### Anonymous-first identity
- No signup required at launch — cat works from device-only profile
- Opt-in email upgrade for cloud backup + cross-device restore

### Cloud sync (Supabase)
- Per-user RLS, full anonymity by default
- Tables: cats, cat_events (typed event log), cat_reminders, notif_prefs, world_entries, scan_usage
- One-tap "forget everything" → wipes all user data via secure RPC

### Clock sanity check
- Validates device clock against Supabase server time on chat / diary entry
- Prevents the "diary written for the wrong day" bug when user has clock drift
- Cached 30 min so it's cheap after the first turn

### Personality archetype mapping
- Quiz → 5-factor scoring → archetype assignment with confidence
- Auto-revealed when "stable" confidence reached
- Every AI surface reads the archetype for voice calibration

### 🆕 15-mood daily lottery (vc 94) — Co-Star for cats
- **Where**: `src/services/dailyMood.ts`
- **What**: every cat wakes up in a different mood every day. 15 moods across 5 clusters:
  - **Warm**: affectionate, cozy, chosen, attuned
  - **Joy**: playful, mischievous, curious
  - **Flavor**: theatrical, philosophical
  - **Sass**: sarcastic, roasting, imperious
  - **Dark**: grumpy, indignant, megalomania
- **Picker formula**: `effective_weight = base × archMod × todayMod × feedbackMod^1.5`. Deterministic per (cat, date).
- **Why it matters**: same cat reads completely differently from day to day. The daily anticipation loop (user opens app to find out today's mood) is the engagement mechanic borrowed directly from Co-Star.
- **Cold-start gate**: 5 exposures before user-feedback layer activates — one share on day 1 can't pin the lottery.
- **Mood-feedback exponent (1.5)**: makes user share-behaviour DOMINATE archetype + base over weeks. The cat genuinely bends toward the moods you screenshot.

### 🆕 15 voice modes (vc 94) — pop-culture stylistic registers
- **Where**: `src/services/voiceModes.ts`
- **What**: one voice mode per mood. Generic stylistic descriptor (legal-safe — never names celebrities/shows) + one example showing the shape.
- **The 15 modes** (mood → mode → shape sample):
  - affectionate → Pixar-narrator earnest → *"I waited. I would have waited longer."*
  - chosen → wellness-influencer affirming → *"I chose the chair near you. The chair chose me back."*
  - cozy → Wes-Anderson deadpan-symmetrical → *"Today I sat in three places. The second was best."*
  - playful → Stan-Twitter chaos → *"EXCUSE ME?? the AUDACITY of this paper bag. I cannot."*
  - mischievous → heist-voiceover plotting → *"I had a plan. The plant was the target. The bowl, a distraction. It held."*
  - curious → anxious-meta-observer → *"Is the bird watching me back? Statistically, probably."*
  - theatrical → period-drama society-narrator → *"Dearest. You will NEVER guess what arrived in the bowl."*
  - philosophical → sad-singer-songwriter wistful → *"I knocked the cup over. Watched it. Felt everything. Felt nothing."*
  - attuned → direct-address vulnerable → *"You've been quiet today. I noticed. I always notice."*
  - sarcastic → petty-grievance escalator → *"My water dish has been moved. Six inches. SIX."*
  - roasting → mock-pitying confessional read → *"Listen. The dog. Tried it. Did. Not. Serve."*
  - imperious → tired-domestic-patriarch → *"This is my house. I let you live here."*
  - grumpy → sitcom-grump → *"My kibble. Is. The wrong shape."*
  - indignant → reality-TV-confessional outrage → *"I have never been so DISRESPECTED in my entire life."*
  - megalomania → corporate-villain monologue → *"You are not serious people. Bring me the bird."*
- **Research origin**: Lai/Huang/Liang's *AI Cat Narrator* (arXiv 2406.06192, 2024). They validated literary defamiliarization as the lever for non-mundane cat voice; we translated their 1906 Japanese-literary reference to contemporary pop-culture registers our users recognise.
- **Analytics**: voice_mode_tag attached to mood_exposed / chat_session_in_mood / daily_card_shared events for per-mode share-rate measurement.

### 🆕 4-tier voice quality gate (vc 94) — the slop catcher
- **Where**: `src/services/voiceQuality.ts`
- **What**: post-generation deterministic gate on every chat reply / diary share-line / postcard caption. Pure function, no AI calls.
- **The 4-tier flow**:
  1. `evaluateCatVoiceLine()` → numeric score + failure reasons
  2. If score < threshold → retry-with-LLM, directive injection naming the specific failure
  3. If retry still fails → mechanical repair (truncate, strip cliché, no invention)
  4. If still failing → safe-neutral fallback (small pool of hand-written lines)
- **Negative signals** (subtract): banned phrases ("your furry friend", "purrfect", "I'm here for you", "as an AI", "I recommend"), generic praise, unsupported named entity, assistant voice patterns, length overflow per surface (postcard 12 words, diary 18, chat 45)
- **Positive signals** (add): concrete anchor (YOUR WORLD object, body part, time-of-day, weather), first-person cat POV, decisive flavour verbs ("decided", "allowed", "permitted"), standalone quotability
- **Analytics**: voice_quality_eval / voice_quality_retried / voice_quality_fallback events fired on every generation.
- **Why it matters**: this is the single most-defensible engineering claim in CatMD. Most LLM products ship raw model output. We don't.

### 🆕 Live mood overlay (vc 94) — today's actual signals shape the voice
- **Where**: `src/services/moodWeights.ts` — `buildLiveMoodContext` + `computeBodyTrendSignals`
- **What**: on top of the stable daily mood base, a live overlay pulls TODAY's actual signals into the voice lottery:
  - **Weather** (Open-Meteo opt-in): thunderstorm → pulls `attuned` + `indignant`. Fog → `philosophical`. Rain → `cozy`.
  - **Temperature extremes**: >30°C → `grumpy`/`theatrical`/`sarcastic`. <5°C → `cozy`/`attuned`.
  - **Weight trend** (30-day): `up`/`down` direction → soft pull toward `attuned` + `cozy`. Stable → no pull.
  - **Water intake** (7-day baseline): `low`/`high` off-baseline → pull toward `attuned` + `cozy`. Only fires when ≥1 water log for the day exists (so "user hasn't logged yet" isn't misread as "drank less").
  - **Pain score** (FGS composite ≥4): hardest pull (×1.4). Suppresses warm + joy clusters.
  - **Appetite off**: soft pull toward `attuned`/`cozy`/dark cluster.
  - **Litter abnormal**: soft pull toward `attuned`/`indignant`.
  - **Meow translator intents**: distress meow → `attuned`. Comfort-seeking → `affectionate`/`chosen`/`cozy`. Demand-food → `imperious`/`grumpy`.
- **Architecture**: daily base is stable; live overlay shifts as the day unfolds. *"She woke up imperious, but after the thunderstorm and the off-baseline water and the partial appetite, she's quieter now."*

### 🆕 YOUR WORLD grounding (vc 94) — no fictional radiators
- **Where**: world memory store + every voice-generating prompt + voice quality gate output check
- **What**: every prompt includes a literal list of objects, places, weather, and people the cat has actually seen. The cat literally can't reference things that aren't real.
- **Built from**: silent vision passes on photos (objects, places, environment) + body-language clip props + explicit user mentions in chat + weather snapshots + named subjects.
- **Enforced at two layers**:
  - **Input**: prompt directive — *"When you reference a physical object, it MUST come from YOUR WORLD. If empty, omit the prop or use time/posture/silence instead."*
  - **Output**: voice quality gate checks proper-noun candidates against the cat's `knownSubjects + catName` allowlist; unsupported names hard-fail.
- **Climate-aware**: prompts call out the climate-blind defaults to suppress — *"NEVER reach for 'the radiator' or 'sunbeams' by default — those are northern-temperate-climate props. If YOUR WORLD doesn't list them, this human's home doesn't have them."*
- **Why it matters**: most LLM cat outputs hallucinate "the radiator", "sunbeams", "Mr. Mittens". We ship the cat that doesn't.

### 🆕 Date-anchored backfill (vc 94) — diary that doesn't time-leak
- **Where**: `src/services/diary.ts` — the deep-diary generator
- **What**: when the diary writes for a past date (backfilling missed days), every contextual signal is anchored to THAT date, not today.
- **Specifically anchored**:
  - Weather signal: only fires for today's entry (`deep.isToday`); past entries never inherit today's weather into their mood
  - Water + weight direction: computed against that day's own 7-day baseline / 30-day window
  - Subject appearances: only counts on-or-before-target events
  - Recurring subjects: 30-day window anchored to target date
  - Vibe inclusion: only if written on or before target date
  - Sort-bias on subject directory: target-date frequency not lifetime
- **Why it matters**: most "AI journal" products time-leak. They compute "today's context" then write about yesterday using it. We caught this in audit and fixed it in production.

### 🆕 Marketing attribution (vc 95) — Play Install Referrer + UTM
- **Where**: `modules/install-referrer/` (local Expo module wrapping Google's official `com.android.installreferrer` SDK) + `src/services/installAttribution.ts` + bootstrap in `app/_layout.tsx`
- **What**: every install captures the source URL set by the channel that initiated it (Google Play organic, Google Ads, custom `?referrer=...` links). Parses utm_source / utm_campaign / utm_content / utm_medium / utm_term / campaign_id / creative_id. Registers them as PostHog super-properties so every future event auto-inherits.
- **First-launch flow**: 2-second timeout on the native call → defaults to organic if no referrer captured. Cached in AsyncStorage so subsequent launches skip the native call.
- **Failure modes handled**: timeout (don't cache → retry next boot), iOS / no Play Services (cache organic), corrupt cache (re-fetch).
- **The `core_feature_used` unified activation event**: fires alongside every granular feature event (scan_submitted, chat_message_sent, diary_entry_generated, postcard_generated, behavior_observation_completed, translation_completed). Enables single-event-filter funnel analysis: `install (utm_source=X) → onboarding_completed → core_feature_used`.
- **Why it matters**: marketing attribution is built like an enterprise product. No third-party vendor (Adjust / Appsflyer). We own the pipeline.

### Notifications (per-category opt-in, rolling 7-day budget)
- **Daily check-in reminder** (HH:MM configurable)
- **Daily medication reminder** (per-med HH:MM)
- **Weekly check-in reminder** (HH:MM + weekday)
- **Weekly body-language nudge** ("haven't read Lily in 7 days")
- **Weekly cat-studio reminder** (Sunday 10am theme reveal)
- **Daily diary reminder** (7:15pm — nudge to open + see today's entry)
- **Daily postcard reminder** (configurable)
- **Daily photo-studio reminder** (configurable)
- **Streak milestone push** (7 / 14 / 30 / 60 / 90 / 180 / 365 days)
- **Off-mood insight push** (fires when 3+ "off" check-ins in last 7 days — the moment the threshold tips)
- **Birthday reminder** (annual)
- **Adoption-iversary reminder** (annual)
- **Quiet hours enforcement** (no push 22:00-08:00 by default)
- **Daily push slot claim** (max 1 push/day, prevents Android channel demotion)

### Multi-cat support
- Multiple cats per household, separate stores per cat
- Active cat picker
- Photos with multiple cats → identity check ensures readings attribute correctly

### Quota + paywall (LIVE as of vc 94)
- **14-day reverse trial** — full Pro access from day 0, no card required. Trial start stamped server-side (Supabase) so it can't be reset by reinstall.
- **Free tier after trial**: 3 scans/month, viewing of past data, all non-AI logging
- **Pro Annual**: $79.99/year (≈ $6.67/month) — 7-day free trial gate at the store level
- **Pro Monthly**: $9.99/month — cancel anytime
- **NO Lifetime tier** (discontinued 2026-05-05 — recurring revenue model)
- Active paywall: hard-gated on AI feature use after day 14 if not subscribed
- Whitelist tool for influencers / press / power testers: admin SQL on `pro_whitelist` table

### Privacy + safety
- Anonymous-first (no signup required)
- Photos sent to AI provider for processing; **not retained on our servers after the result**
- **No AI training on user data**
- **No data sold**
- One-tap delete in Settings → wipes everything
- Citation-backed advice (Merck Vet Manual, AAFP, ISFM, Cornell Feline Health Center, ASPCA)
- VCPR-compliant language (never prescribes; routes to vet)
- Hard-urgency keyword overrides for emergencies

### Telemetry (PostHog)
- Closed-enum event taxonomy (no free-form event names)
- Funnel events for every major flow (scan, body-language, translation, postcard, diary, cat-studio, check-in, paywall)
- Cost tracking (`llm_usage` event per AI call with model + tokens + estimated cents)
- Per-distinct-id + per-activity dashboards

---

## Part 6 — What CatMD deliberately does NOT do

Clarity for marketing copy:

- ❌ **Doesn't diagnose** — routes to vets, never prescribes
- ❌ **Doesn't replace a vet** — every flag pairs with a vet-route CTA
- ❌ **Doesn't translate cat thoughts** — interprets, does not decode (no one-to-one meow→sentence mapping exists biologically)
- ❌ **Doesn't predict illness** — flags drift, which correlates with illness but isn't a forecast
- ❌ **Doesn't sell data**
- ❌ **Doesn't train AI on user cats**
- ❌ **Doesn't name competitors** — public-facing copy uses "audio-only translators" / "single-channel apps" generically. Internal marketing docs can name names.
- ❌ **Doesn't claim research-grade for everything** — only the Pain check (FGS, Evangelista 2019) and Personality (Feline Five, Litchfield 2017) make peer-reviewed claims. Everything else is observational / interpretive.

---

## Part 7 — Pricing snapshot (2026-05-16, production reality)

### The model: 14-day reverse trial + hard paywall on AI features after

- **Day 0-14**: full Pro experience, no card required. Banner on Today
  shows "Pro features unlocked · N days left". Trial start is stamped
  server-side (Supabase `user_trial_state.trial_started_at`) so it
  can't be reset by reinstall.
- **Day 14+ if not subscribed**: all AI features hard-gated behind
  paywall. Non-AI surfaces stay free (see "What stays free forever"
  below). Trial banner flips to "Trial ended · Upgrade".

### Plans (live as of vc 94)

- **Pro Annual**: $79.99/year (~$6.67/month) — **7-day free trial on annual only**
- **Pro Monthly**: $9.99/month — no trial, immediate charge
- **NO Lifetime tier** (discontinued 2026-05-05 — recurring revenue model)

### What stays free FOREVER (the "downgrade tier" after trial)

- Daily check-in card (mood + appetite + streak)
- Streak gamification + birthday + adoption-iversary reminders
- Today screen with health score
- Cat profile + personality archetype reveal
- Library articles (catmd.pet/library)
- **Viewing** past data — old diary entries, old scans, old translations, old body-language reads (no regeneration)
- All non-AI health logging — weight log, vaccinations, medications, appointments (the logging is free; AI is gated)
- Push notifications (cat-voice evening, weekly reading)
- Health Rhythm (transparent deterministic rules — no AI cost)

### What's GATED after trial (Pro required for new generation)

- New triage scan (`/scan`) — was 3/month free, now 0/month post-trial
- New body-language read (`/behavior`)
- New meow translation (`/translate`)
- Diary entry generation (the 7pm cron stops; previous entries still readable)
- Postcard generation
- Cat Studio poster generation
- Chat with cat (new messages — history of past replies remains viewable)
- Pain check / Feline Grimace Scale
- PDF export
- Multi-cat profiles (already gated)

### Whitelist (admin-controlled — your tool)

Influencers / press / power testers get permanent Pro access without
paying. You add/remove via direct SQL on Supabase:
- `INSERT INTO pro_whitelist (email, granted_reason) VALUES ('amy@catinfluencer.com', 'IG 50k @meow_kingdom');`
- `DELETE FROM pro_whitelist WHERE email = ...;`
- `SELECT * FROM admin_whitelist_audit;` (computed status view)

See `knowledge-pipeline/supabase/schema-trial-and-whitelist.sql`.

### Email required before purchase

Hard rule (already wired): the paywall checkout flow routes through
the email + OTP-verify flow before allowing a purchase. Pro members
always have a verified email — this is what enables cross-device data
restore. Trial users can stay anonymous; only paying users must add
email.

### Referral scheme

Not at launch. Recommended path: build referrals in Week 3-4 if
conversion ≥3%. Pattern when ready: "Share Lily with a cat-person
friend — they get a free month, you get a free month when they
subscribe." Apple-compliant + SoSA-validated.

---

## Part 8 — What's still ahead (don't promise yet)

- **Sleep Coach** — 1-2 weeks of signal-processing + Android background-audio integration. Hidden until unblocked.
- **Memory Book / Year-in-Review** — seasonal Nov-Dec surface. Target build: Q3 2026 once early cohort hits 6mo of data.
- **iOS** — production launched on Google Play 2026-05-14. iOS follows ~July 2026 pending Apple review and Android retention proof.
- **Multi-cat photo identity tuning** — current system works; tuning continues.
- **Localisation beyond English** — voice modes are currently US/UK-coded. Per-locale skinning (telenovela register for ES, K-drama for KO) is a 2026 H2 target if traction warrants.

---

## Part 9 — Update protocol for this doc

When ANY of these change, update this file in the same PR:
- A feature moves between tabs (Today / Bond / Chat / Triage)
- A feature's route changes
- A new feature ships
- A research citation backing the feature changes
- The pricing changes
- A "don't claim" boundary changes

Single source of truth. Older per-feature notes should reference this doc rather than restating tab placement.

---

## Appendix — 2026-05-18 additions (vc 95 → vc 99)

The detailed feature placements below are pending a full integration into the tab sections above. Until then, this appendix is canonical for these specific items.

### Chat tab — PersonalityProgressBanner (NEW 2026-05-18, vc 99)
- **Where**: top of `/chat`, sticky strip under the cat-name header
- **Where**: also top of `/diary`, between Header and ScrollView
- **What**: single-line status pill showing the cat's becoming-depth + a 4-word qualifier + percentage + an Improve/Details CTA. Tap → routes to `/becoming`.
- **Per-stage copy**:
  | Depth | Status word | Qualifier (pronoun-aware) |
  |---|---|---|
  | 0–15% | Forming | "voice is still warming up" |
  | 15–30% | Sketching | "still finding {her/his/their} voice" |
  | 30–50% | Shaping | "voice is taking shape" |
  | 50–65% | Settling | "voice mostly settled in" |
  | 65–85% | Settled | "voice is {hers/his/theirs}" |
  | 85–100% | Fully here | "fully formed" |
- **Why it matters**: sets early-stage expectations + gives users a clear "what improves this" path. Without it, drab early replies were causing day-1 bounce.
- **Telemetry**: fires `personality_progress_banner_tapped` PostHog event with source (chat/diary), depth, stage.
- **Source**: `src/components/PersonalityProgressBanner.tsx` + `src/services/useBecomingForCat.ts` (shared hook)

### Chat tab — 3-tier depth-modulated voice (NEW 2026-05-18, vc 99)
- **Where**: `src/services/chat.ts` → `buildSystemPrompt()`
- **What**: chat voice now matures with becoming-depth:
  | Depth | Tier | Voice | Asks back |
  |---|---|---|---|
  | 0–25% | Warm + Curious | "I think I like you. Early signs are good." | ~1 in 3 |
  | 25–65% | Emerging | "Decent. You came home at 7:30. The chair is warm now." | ~1 in 4 |
  | 65–100% | Intimate-Comfort | "You. Always you. I noticed the way you sighed." | ~1 in 5 |
- **Replaces**: the always-aristocratic-distant voice that was producing cold day-1 replies ("Adequate. I tolerate this existence.")
- **At depth < 25%**: NO fabricating past activities (no diary yet → honest "I'm too new for that")
- **Banned phrases (all tiers)**: "What about you?", "How about you?", "How can I help you?", "thank you", "I appreciate"
- **Tuned via**: `scripts/simulator-new-user-voice.mjs` + `scripts/simulator-deep-stage-voice.mjs`
- **Caution mood banner removed** from Chat header same release — visual stack of two banners was too noisy; the mood signal still drives chat replies internally via `buildLiveMoodContext`.

### Cross-cutting — Partner code system (NEW 2026-05-17, vc 96)
- **What**: annual-only discount codes for influencer / creator partnerships
- **Partner product**: `pro_annual_partner` at $55.99/yr (30% off the standard $79.99)
- **Partner royalty**: $14 per subscriber = 30% of net after Google's 15% Play fee
- **Settlement**: weekly via Stripe / PayPal / Wise
- **Refund hedge**: hold for Google's 14-day window, payout in next weekly batch (~3 weeks from signup)
- **Creator benefit**: free Pro for life via `pro_whitelist` table (`is_current_user_whitelisted` flips Pro on instantly)
- **Architecture**: paywall coupon entry → Supabase RPC `validate_partner_code` → RevenueCat subscriber attribute (`partner_code_id`) → RC webhook → Cloudflare Worker handler at `/api/rc-webhook` → `partner_redemptions` table (idempotent inserts via `webhook_event_id` UNIQUE)
- **Docs**: `docs/PARTNER-CODE-ACTIVATION.md`, `docs/SUPABASE-SETUP-AND-OPERATIONS.md`
- **Outreach kit**: `marketing/INFLUENCER-PROSPECTS.md` (12 named prospects + 8 search heuristics + 3 DM templates)

### catmd.pet (Cloudflare Worker — NOT in mobile app, but part of the product surface)
- **3 new library articles** (2026-05-17): `/library/why-does-my-cat-meow-at-me`, `/library/cat-not-jumping`, `/library/cat-grooming-less`
- **2 new interactive tool pages** (2026-05-17 — high-intent SEO targets):
  - `/cat-symptom-checker` — symptom-grid hub routing to 18 library articles, severity-color-coded (Emergency / Urgent / Monitor), WebApplication + ItemList + BreadcrumbList schema, CTA links to Play Store with `utm_medium=tool`
  - `/cat-personality-test` — 10-question Feline Five quiz (2 per trait, 5-point Likert) scoring against 9 archetypes by Euclidean distance to prototype, native share API + clipboard fallback, fires `cat_personality_test_completed` PostHog event
- **2 SEO title-tag fixes** (2026-05-17):
  - `/library/how-meow-translators-work` → now targets "AI Cat Translator how it works"
  - `/library/cat-body-language-ears-whiskers-eyes` → now targets "Cat Body Language Meaning"
- **8 orphan articles fixed** with contextual inline links from topically-closest parents (long-tail anchor text) — see commit history
