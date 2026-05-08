# CatMD — The Cat-verse Virality Playbook

> **Why this doc exists**: brainstormed 2026-05-03 in the strategic
> session that pivoted CatMD from "AI vet triage" to "AI for cat
> owners." This is the menu of personalised-cat-content ideas that
> ride the existing cat-internet attention graph + leverage CatMD's
> unfair data advantage (real cat photos, personality archetype,
> Feline Five scores, daily check-in data, AI infrastructure).
>
> **Not a roadmap** — a backlog. Pick from this menu when scoping the
> next quarter. Reorder as the cat-internet meta evolves (formats
> trend in 6-12 month cycles).

---

## 0. The thesis

Every viral cat-content format follows the same mechanic: take MY cat
(ideally photo, ideally name, ideally personality), run it through
[trending format], output something I want to post. The format
changes; the mechanic doesn't.

**CatMD's advantage**: every competitor in this space starts from
"user uploads a photo." CatMD starts from "user has 30 photos, 6
weeks of personality data, today's mood, and we know how chatty
their cat is." That's a 10x content advantage per generation —
captions feel scarily personal, scenarios feel canon to the user's
cat, results are shareable in a way generic generators aren't.

The **Cat Studio movie poster** is the proof of concept. The other
8 formats this expands into are below.

---

## 1. Where the cat-internet attention graph actually lives (2024-2026)

Dominant formats right now, in order of velocity:

1. **AI-generated cats in [X]** — Studio Ghibli, Renaissance, anime,
   Pixar. ChatGPT/DALL-E image gen made this hyperviral.
2. **Cat reaction reels with overdubbed inner monologue** —
   "If my cat could talk." Carries TikTok / IG Reels.
3. **Cat horoscope / cat astrology** — niche but obsessive daily
   content. Co-Star-for-cats, breed-as-personality readings.
4. **Cat compatibility quizzes** — "Which celebrity cat are you?"
   "Your cat's compatibility score" — viral on IG Stories.
5. **Cat-as-historical-figure / cat-multiverse** — Cleocatra, Sir
   Isaac Mewton. Costume + setting AI is the new selfie filter.
6. **Cat newspapers / parody news** — Onion-style with the cat as
   protagonist.
7. **Cat memorial content** — bittersweet but high-engagement;
   people pour creativity into farewells.

Formats that have RECEDED but still have audience:
- Lolcat / image macros (still works, less dominant)
- Documentary-style cat content (Kedi-style)
- Influencer-cat accounts (saturated, hard to break in)

---

## 2. Six high-leverage ideas — each is a Cat Studio sibling

These all reuse: Photo Studio gallery, personality store, AI
infrastructure (proxy + token tracking). Each = ~3-5 dev days.

### 2a. Cat Memes (image-macro generator)

Top-text/bottom-text classic format. AI knows your cat. Templates
rotate weekly: "He do be tho", "I'm just a little guy", "Vibe
check", "He's listening", side-eye chloe. AI generates the caption
from cat's archetype + recent diary mood + breed quirks.

One tap → finished meme JPG, Instagram-ready.

**Different from Postcard**: Postcard is aesthetic. Meme is
shitposty, low-art, high-virality. Two different posting moods.

### 2b. Cat Horoscope (daily, free for everyone — habit driver)

DOB → zodiac sign. AI generates a 3-line horoscope flavoured by
archetype. Example for a Hunter-Athlete Leo:

> *"Tuesday energy: Lily will discover a new place to look
> intimidating today. Avoid the kitchen 4–6pm. Lucky color:
> midnight."*

- 30-second daily ritual, builds in-app retention
- Generation cost ~$0.0005/day at gpt-4o-mini = trivial
- Highly shareable in IG Stories
- Sundays = weekly horoscope; Saturday = "vibe report" recapping
  the week's check-in data into a cat-voiced summary

### 2c. Cat-as-X series (Cat Studio universe expansion)

Existing image-gen pipeline, six new prompt templates rotating
weekly:

- Cat as historical figure (Cleocatra, Sir Isaac Mewton, Marie
  Antoincat)
- Cat in famous paintings (Mona Lily, Starry Mew, Cat with the
  Pearl Earring)
- Cat in a Studio Ghibli scene
- Cat as Pixar character
- Cat in 80s anime
- Cat in [seasonal — Halloween costume, Christmas postcard, etc.]

Sunday-10am cron picks one, cycles, never repeats within a month.
Massive content surface from minimal new code.

### 2d. Cat Trading Card

Pokémon / baseball card format. Generated card has:
- Cat's photo as art
- Stats: Wisdom, Mischief, Snuggle, Hunt, Mystery — derived from
  existing Feline Five scores
- Archetype name as the card's "type"
- Rarity tier (common / rare / legendary) — based on archetype
  rarity + age
- Foil / holographic editions for milestones (1-year-with-CatMD,
  birthday, FGS pain check returned 0)

Collect across multiple cats / friends' cats. The collectibility
loop is what's missing from most pet apps.

### 2e. Cat Vlog (auto-generated 15s TikTok)  ← THE BIG ONE

Take 3-5 photos from today's Photo Studio entries. AI generates:

- 15-30 second video with Ken Burns pans across the photos
- Cat-voiced narrative (ElevenLabs voice synthesis)
- Musical bed (royalty-free or licensed)
- Auto-captioned, vertical, ready to post

**One tap = one TikTok-ready vlog from today's photos.** Every Pro
user becomes a daily content creator. The viral mechanic (TikTok
rewards consistent posting + cat content) does the rest.

Build complexity: medium-high (~1-2 weeks for a quality MVP).
Outsized return.

### 2f. "What kind of cat are you?" — personality mirror quiz for HUMANS

Existing personality engine, run on the OWNER instead of the cat.
4-question quiz, output is a cat archetype card the user can share.
*"I'm a Hunter-Athlete cat. What are you?"*

- Acquisition gold — non-cat-owners take it too, share card
  promotes the app
- Cheap to build (archetype schema already exists)
- Massive lateral spread potential

---

## 3. Breadth menu — second-tier, schedule later

Each fits the unfair-advantage thesis but isn't as high-leverage:

- **Cat newspaper front page** — "THE LILY POST" satirical headlines
- **Cat voice note generator** — text → audio in cat-voice (ElevenLabs)
- **Cat outfit generator** — image-edit cat into tuxedo / costume
- **Cat doppelganger** — celebrity / historical-cat twin
- **Cat compatibility (cat-cat or cat-owner)** — already on Pro roadmap
- **Cat tarot daily** — pulled card, archetype-flavoured reading
- **Cat sticker pack** — 8 stickers from photos for iMessage / WhatsApp
- **Cat Memorial / Tribute** — high-engagement, well-cared-for tribute
- **Cat awards (year-end)** — generated certificate, "Most Mischievous 2026"
- **Cat phone wallpapers** — different aesthetic templates from photos
- **Cat family tree** — fictional but plausible "noble lineage" generator
- **Cat birthday party invitation** — full party kit
- **"If my cat ran [X]"** — TED talk, congress, therapy session, book

---

## 4. Genuinely unexplored whitespace

Most Tier 1-3 ideas exist in some form somewhere. These don't.

### 4a. Calm Cat reverse — cat-as-anchor for the human

The existing Calm Cat extension shows random kittens to soothe
stressed humans. **Yours could show their OWN cat.**

- Browser extension / widget / lock-screen widget pulls from user's
  photo gallery
- Surfaces a random photo with a personalised affirmation in
  cat-voice ("You're doing great. — Lily")
- Daily Calm Mode in-app ("Stuck? Lily wants you to take a breath.")

Cat as therapist — not as ironic content, as actual ambient
companionship. **No one does this.**

### 4b. Cat-driven daily ritual outside the phone

The widget/lock-screen play. Today / iOS Today widget shows: cat
photo + 1-line horoscope + check-in CTA. Apple Watch complication
shows the cat's "vibe of the day" (mood from last check-in + emoji).

Makes CatMD ambient — cat is on home screen, watch face, lock
screen. **No competitor does cat-as-ambient-companion.** Most pet
apps are utility (track this, log that). CatMD would be the only
one playing the persistent-presence game.

### 4c. Cat as a content character with continuity

Postcard captions are currently one-shot. **Imagine the AI building
a multi-week canon for the cat.**

- *"Lily continues her rivalry with the kitchen rug — Day 47."*
- Recurring characters (the rug, the laundry basket, the visiting
  Roomba)
- Diary already has the raw material; tying it together into a
  continuous narrative makes the user FEEL the relationship
  intensifying
- Reads like Calvin & Hobbes for the user's actual cat

**No one's doing serialised AI-narrated pet life yet.** Open lane.

### 4d. Cat-as-protagonist in user's life decisions

User about to make a decision (move, change job, get another pet).
Asks their cat. AI returns the cat's "verdict" — based on archetype,
recent mood, what would actually impact them.

> *"Lily would prefer you stay. Her territorial instincts spike on
> weekends with strangers. But she'd adapt — she did with the new
> sofa, after the third week."*

Half-joke, half-real. Builds engagement in moments where pet apps
are usually closed.

---

## 5. Sequencing — three bets

If you build all 30+ ideas, you fail. Frame the next 6 months around
three lenses:

### 5a. The viral coefficient bet (build first)

**Cat Vlog (2e)**. Maximises share-out.

Hypothesis: if 10% of Pro users post a daily Cat Vlog, and 1 in 50
of those goes mildly viral (a few thousand views), CatMD spreads
laterally without paid acquisition.

Build window: 1-2 weeks for a quality MVP. Audio synthesis costs:
trivial (ElevenLabs ~$0.001/clip). Image manipulation: existing
infrastructure.

### 5b. The retention bet (build in parallel, ~3-5 days)

**Cat Horoscope (2b)**. Maximises daily-open rate.

30-second daily content, every day, free for everyone (loss leader
for activation). Habit-forming. Builds reasons to open the app
when nothing's wrong.

### 5c. The depth bet (build third, longest horizon)

**Calm Cat ambient + serialised Cat Narrative (4a + 4c)**. Turns
Pro into something irreplaceable.

Widgets, lock-screen presence, recurring characters, multi-week
canon. Big build (~4-6 weeks polished). Creates the unfair
advantage no competitor can copy because they don't have the
historical data.

---

## 6. Strategic frame — what this means for the brand

CatMD's positioning as of 2026-05-03 EOD is **"AI for cat
owners"** (was: "AI vet triage"). This playbook is the natural
extension of that positioning.

The four-pillar architecture (Today / Bond / Chat / Triage) maps
to a "Bond++" expansion strategy. Most ideas in this playbook
extend Bond — the relational pillar, the most-loved and
most-shareable side of the app. Triage stays as the trust anchor
(why people pay) but it's not the marketing lead anymore.

The bigger play:

> **CatMD is the operating system for your cat's life.** Health
> (Triage) and personality (Bond) feed an AI that knows them — and
> turns that knowing into content, ambient companionship, and
> shareable artifacts you couldn't make any other way.

That's a much bigger market than "AI vet triage." Medical layer =
trust anchor. Content layer = virality engine.

The genuinely unexplored category is **persistent personalised cat
companionship**. Not a one-shot generator. Not a utility tracker.
The cat in your life ambiently, daily, with continuity. That's what
the data lets CatMD do that nothing else can.

---

## 7. Monetisation extensions

Most generators behind Pro tier. Free tier gets 1-3 generations per
month per generator (taste-test).

Premium templates / styles = additional unlocks. Special seasonal
generators (Halloween, Christmas, birthdays) drive event-based
conversion.

Revenue beyond subscription:

- Cat trading cards: physical cards, $5/pack
- Cat newspaper: $15 printed copy
- Custom cat art prints (movie posters etc.): $20 + shipping
- Wallpaper packs: $1.99 one-time
- Cat memorial tributes: $0 (don't monetise grief)

---

## 8. Pointers back

- Session checkpoint where these ideas were brainstormed:
  `docs/SESSION-CHECKPOINT-2026-05-03.md`
- iOS handoff (separate workstream):
  `docs/IOS-SETUP-GUIDE.md`
- Cloud sync / Pro-tier identity:
  `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md`
- Pricing & limits framework (data-driven tier design):
  `docs/PRICING-AND-LIMITS-FRAMEWORK.md`
- Listing copy (shared with both stores):
  `store-listing/store-listing-copy.md`

End of cat-verse virality playbook.
