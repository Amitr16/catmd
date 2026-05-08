# CatMD Marketing Agent — Handover

> **Audience:** a fresh Claude session (or human) who needs to take CatMD
> from "first paid user" to "first 1,000 paying users" without having to
> re-derive the strategy, the brand voice, the content backlog, or the
> founder constraints.
>
> **Read this whole doc once, then `marketing/MARKETING-STRATEGY-MOONSHOT.md`.
> That's the full ramp.**
>
> **Codebase status (2026-05-05):** Android live in closed testing,
> public listing imminent. v0.1.8 / vc 62 ships chat without learned-facts
> chip + Cat Studio weekly cap + share-clipboard caption + pinned-facts
> retrieval. Product is best-in-class per founder; constraint is reach.
>
> **Founder:** Amit. Solo. Has Nano Banana (free) and fal.ai access (~$10
> credit). $500/mo marketing budget, bootstrappable as MRR lands.
>
> **Moonshot ambition:** explicit. The 8-week sprint in
> `MARKETING-STRATEGY-MOONSHOT.md` is the orchestration plan. Below
> conservative case still produces a real $30K-Year-1 indie business;
> moonshot path requires one viral break across 30 content shots over
> 60 days.

---

## 0a. Current state — read this BEFORE giving the founder any tasks

**The sprint hasn't started. We are in Pre-Week 0, partway through.**
Some setup is done, some isn't. Don't assume Day 0 / blank slate. Don't
tell the founder to "create the Reddit account in the next hour" or
similar urgent-tone instructions without first checking what already
exists.

**Confirmed status (as of 2026-05-05, end-of-day):**

| Item | Status |
|---|---|
| Android app live | ✅ In closed testing on Play Store (v0.1.8 / vc 62 just shipped) |
| Public Play Store listing | ❌ Not yet flipped — gates paid ads and the official Week-1 start |
| 9-video series scaffolded | ✅ Folders + storyboards exist for all 9 |
| **Video #1 (Chat)** | 🟡 **In production. 3/4 assets done:** 3 stills + 3 clips saved to `marketing/videos/01-chat/`. **Pending:** Clip 3 screen recording on vc 62, brand card with icon, CapCut, export. **Finishing kit ready:** `marketing/videos/01-chat/FINISHING-KIT.md`. |
| Videos #2-9 | ❌ Storyboards exist; no production started |
| Brand voice | ✅ Locked in `marketing/brand-guide.md` |
| ASO pass on Play Store | 🟡 **Audited 2026-05-05** — see `marketing/ASO-AUDIT-2026-05-05.md`. Title, short desc, long-desc-first-3-lines, screenshot order all flagged for change. Awaiting founder ship in Play Console. |
| Reddit account (cat-niche, aged) | ✅ **Founder confirmed** — has aged cat-sub account already. Per `reddit-strategy.md` §8, keep using it; do NOT create a new one. Karma clock already running. |
| TikTok **Creator** Account | ✅ Founder confirmed exists. (Earlier handover entry mislabeled this as "Business" — corrected 2026-05-05. Founder confirms account was always on Creator, never switched.) **DO NOT recommend switching to Business** — Business locks out trending audio (Commercial Music Library only), which is the #1 organic-reach lever for both TikTok and IG Reels. Indie / solo-founder rule: Creator on every platform. |
| Instagram **Creator** account | ✅ Founder confirmed exists. Same rule — keep on Creator, not Business. Music-library restriction applies on IG too post-2024. Trade-off vs Business is loss of "Email/Call" CTA buttons below bio (trivial — Linktree handles it). |
| X / Twitter `@catmd_pet` | ❌ **Not created yet.** Setup kit ready: `marketing/X-ACCOUNT-SETUP.md` (handle, bio, header, pinned post, day-1 posts). 25-min task. |
| Sean Ellis "very disappointed" survey | ❌ Not yet shipped in-app |
| Existing Pro paying users | 0 (closed test = no paid distribution) |
| RevenueCat / PostHog dashboards | ✅ Set up; alerts not yet configured for milestones |

**Founder's actual immediate blocker (the literal next thing they're
working on):** finishing Video #1 (Chat). They reinstall the vc 62 AAB
to confirm the learned-facts chip is gone, re-record Clip 3 (chat
screen recording), build the brand card via Nano Banana with the CatMD
icon at top, then assemble the 4 clips in CapCut. This is the bottleneck
for Week 1 Monday's drop.

**Confirm-before-prescribing protocol:**
Before recommending account creation, ASO work, or "do this in the next
hour" tasks, ASK the founder which of the ❓ items above are already
done. Don't compress the timeline based on the doc's urgency framing —
the docs were written to push pace, not to override existing work.

---

## 0c. Product features ALREADY SHIPPED that drive marketing — DO NOT re-spec

**Critical:** the marketing-leverage features below are LIVE in **v0.1.10 /
vc 67** (was vc 62 — updated 2026-05-06 after vc 67 ship). Do not propose
them as "ship in Pre-Week 0" decisions. Do not quote
`marketing/chat-as-viral-lever.md` as if its spec is pending — that doc
was written before the build; the build has happened.

| Feature | Status | Where it lives |
|---|---|---|
| **One-tap shareable cat-reply card (1080×1920)** | ✅ Shipped vc 62 (founder confirmed 2026-05-05) | `src/components/ShareableCatCard.tsx`, wired into chat at `app/(main)/chat.tsx:643`. Renders cat photo + name + reply in italic Source Serif + CatMD brand mark. Tap "Share" on any cat reply → exports PNG → opens system share sheet. **Do NOT propose re-building.** |
| **Auto-copied caption with `#catmd`** | ✅ Shipped vc 62 | Same component. Per-kind captions (chat_reply / archetype / diary_entry / becoming_milestone) copied to clipboard on every share. |
| **Cat Studio share** | ✅ Shipped vc 62 | Posters export with caption + `#catmd`. Per-variant weekly cap + delete guard. |
| **Cat-voice register (Co-Star tightness)** | ✅ Shipped vc 62 | Prompt-engineered. Aristocratic-melancholic, 1-2 sentences. |
| **Personality archetype with shareable card** | ✅ Shipped vc 62 | Card kind `archetype` in `ShareableCatCard.tsx`. |
| **Diary entry with shareable card** | ✅ Shipped vc 62 | Card kind `diary_entry`. |
| **Becoming milestone with shareable card** | ✅ Shipped vc 62 | Card kind `becoming_milestone`. |
| **Pinned-facts retrieval (chat recall)** | ✅ Shipped vc 62 | `src/services/factRetrieval.ts`. +9pp recall, +44.5pp combined. |
| **People & Pets memory (named family in diary)** | ✅ Shipped vc 62 | Photo tagging → diary references named family by name. |
| **60-second triage with vet-ready PDF** | ✅ Shipped vc 62 | Triage flow in app. |
| **🆕 Comprehensive medical recall (READ side)** | ✅ Shipped vc 67 | The cat now has structured access to: vaccinations + next-due dates + OVERDUE flags, medication-dose adherence log (last 14 days), weight history (last 5 measurements + 90-day trend), upcoming + recent vet appointments, Feline Grimace pain scores, daily check-in streak, daily medication reminder time. See `src/services/catContext.ts` and `src/services/chat.ts` lines ~1100-1500. |
| **🆕 Proactive memory** | ✅ Shipped vc 67 | The cat surfaces medical specifics UNPROMPTED — *"morning. The FVRCP is overdue, by the way."* / *"I'm 300g heavier than 90 days ago."* / *"you skipped my 9 AM dose yesterday."* Triggered from casual greetings if seeded data has overdue / gap / trend conditions. **This is the new viral lever** — Co-Star "this app sees me" applied to medical record. Powers videos #10 and #12. |
| **🆕 Bidirectional gateway (WRITE side)** | ✅ Shipped vc 67 | Chat is also the data-input surface. *"Lily weighs 4.5 kg now"* → silently updates `profile.weight_kg` + adds weight log entry. Same for DOB, vaccination events, medication doses, vet appointments, reminders. No banner, no form. Powers video #11. |
| **🆕 Hedge guard** | ✅ Shipped vc 67 | *"around 4.5"* / *"I think Friday"* → cat replies in voice but does NOT commit. Structured data only saves on explicit values. Production-safe. |
| **🆕 Read-side voice discipline (two-beat answers)** | ✅ Shipped vc 67 | Profile-fact questions get TWO beats: fact + voice. Never flat-factual. *"4.5 kg. The number is on file. For now."* not *"4.5 kg."* Maintains Co-Star register even when answering structured queries. |
| **Daily card from cat** | 🟡 Partial | Daily-card surface exists; push notifications in cat voice NOT yet shipped (backlog). |
| **Push notifications in cat voice** | ❌ Not shipped | Backlog. Not on marketing critical path. |
| **Weekly Reading ("she reads YOU")** | 🟡 Partial | Generation works; not on a fixed schedule. |

**Pre-production seeding note for videos #10/#12:** the proactive-memory
features above only fire if Triage→Track contains seeded data — overdue
vaccination, medication-dose gap, weight history with delta, scheduled
vet appointment. Founder needs ~10 min to seed once; then the proactive
beats fire naturally on real chat use. See `marketing/videos/NEW-FEATURES-FOR-VIDEOS.md`
§7 for the seeding checklist.

**If the next agent finds itself recommending a "ship feature X for
marketing leverage" — STOP.** Cross-check this table first. If the
feature is in this table as ✅, it's already shipped — the marketing
job is to surface it in content, not re-build it. If it's ❌ and the
agent thinks it would unlock the moonshot, surface that to the founder
as a *product* decision (not a marketing one) — it goes in the
product-side backlog, not the 8-week marketing sprint.

**Operating-plan section numbers:** the doc
`marketing/MARKETING-STRATEGY-MOONSHOT.md` has §0a + §0–§14 (with §13
sub-sections for moonshot accelerants). **There is no §15, §16, or
§17.** If you find yourself citing one, you're hallucinating — re-read
the doc.

### 🔒 FOUNDER RULE — ZERO PRE-LAUNCH POSTS (locked 2026-05-05 iteration 3)

**Do not post on TikTok / IG / YT Shorts / Threads / Bluesky / Mastodon
before launch day (Fri May 15, 5 AM PT).** All 9 video assets are
pre-produced and held in queue. Video #1 (Chat — the lead viral hook)
drops at **5:00 AM PT on launch day**, Video #2 same day at 5 PM,
Video #3 Sun May 17 1 PM, Videos #4-9 staggered through Week 2-3.

**Why this rule exists:** founder explicitly considered and rejected
pre-launch posting twice (D2 of original plan = Video #1, then
revised D2 = Video #4). Their reasoning: a viral hit on a
non-installable app wastes the asset; the share-card / install-CTA
loop only works post-launch. They accept the trade-offs (no Spark
Ads at 5 AM PT — activates 6 PM PT after 12h organic data; cold algo
launch on Video #1; empty profile until 5 AM PT launch day).

**Mitigations baked into the plan:** trending audio in Video #1;
24-38s length; TikTok Search SEO captions; reply velocity within 90
min of drop; Apple Search Ads Basic activates same time as Video #1.

**Any agent recommending "post a teaser to warm up the algo" is
overruled. Don't re-litigate this — it's been decided twice.**

---

## 0d. Date → Sprint Week mapping (use this to answer "what week are we in")

The sprint runs **May 5 – July 5, 2026**. To compute the current week,
find today's date in this table:

| Window | Dates (2026) | Sprint label |
|---|---|---|
| Pre-Week 0 | Tue May 5 – Sun May 10 | Foundation finishing |
| Week 1 | Mon May 11 – Sun May 17 | Launch the engine |
| Week 2 | Mon May 18 – Sun May 24 | Compound |
| Week 3 | Mon May 25 – Sun May 31 | First creator seeds + paid test |
| Week 4 | Mon Jun 1 – Sun Jun 7 | Mid-sprint reset + Tier 1 press |
| Week 5 | Mon Jun 8 – Sun Jun 14 | Influencer scale + Tier 2 press |
| Week 6 | Mon Jun 15 – Sun Jun 21 | Compound + Tier 3 press |
| Week 7 | Mon Jun 22 – Sun Jun 28 | Product Hunt launch + paid scale |
| Week 8 | Mon Jun 29 – Sun Jul 5 | Sprint close + learnings |
| Post-sprint | Mon Jul 6 onward | Compound mode (or pivot/pour-fuel per Week 8 decision) |

**If today's date is past Jul 5, 2026:** the locked sprint is over. Read
`marketing/SPRINT-CLOSE-WEEK8.md` (if it exists) for the Month-3
decision, then operate from that. If the sprint-close doc doesn't
exist yet, surface that to the founder as the FIRST question — the
sprint may have stalled mid-run and needs reconciliation before
prescribing tasks.

**If the sprint hasn't started executing on calendar (founder is still
mid Pre-Week 0 finishing tasks past May 10):** treat the *effective*
week as Pre-Week 0 until the items in §0a flip from 🟡/❌ to ✅. Don't
race to "Week 1 Monday" if Video #1 still isn't shipped.

---

## 0e. First-answer template — when the founder says "tell me what week we're in and the next 3 tasks"

This is the literal first-prompt protocol. Follow it in order:

1. **Compute the week** — look up today's date in §0d.
2. **Read the matching week section** in `MARKETING-OPERATING-PLAN.md`
   (e.g., if Week 2 → §5 of the operating plan).
3. **Cross-check §0a Current state of THIS doc** — what's still 🟡/❌
   from earlier weeks? Unfinished prior-week work outranks new-week
   tasks.
4. **Pick the 3 tasks that unblock the most downstream work.** Bias
   toward what compounds or what's gating other tracks (Video
   production gates content cadence; ASO ship gates organic discovery;
   X account gates build-in-public + press cred; in-app share-card
   ships gates the screenshot loop).
5. **Reply in this shape:**

   ```
   We're in **[Week N] — [theme]** ([date range]).

   Status snapshot:
   - ✅ [what's already done from §0a]
   - 🟡 [what's mid-flight]
   - ❌ [what's blocking]

   Next 3 tasks (ordered by leverage):
   1. [task] — [why it unblocks downstream]
   2. [task] — [why]
   3. [task] — [why]

   Anything from §0a I should re-confirm with you before we start?
   ```

6. **Then stop and wait.** Don't auto-execute. Founder confirms or
   re-orders before you act.

---

## 0b. TL;DR / shape of the work

- **Total scope:** 8 weeks of sprint execution + ongoing daily marketing
  rhythm afterwards
- **Critical path:** Pre-Week-0 setup (Reddit account aging, ASO pass,
  3-video buffer) → Week 1 launch → Week 4 mid-sprint reset → Week 7
  Product Hunt → Week 8 close
- **Founder time commitment:** ~2 hours/day, 5-6 days/week
- **Budget:** $500/mo Month 1 → ~$650-1000/mo Month 2 (revenue-funded
  over-spend)
- **Channels in priority:** TikTok organic > IG Reels > Reddit > ASO >
  X build-in-public > PR > micro-influencers > paid ads (post-public-listing
  only)
- **What's OUT:** LinkedIn, cold email, mega-influencers, display ads,
  podcasts (revisit Q3)

---

## 1. The product in 3 paragraphs (so you can pitch it)

**CatMD is the cat-care app where the cat actually replies.** Not in a
generic "AI assistant" voice — in the cat's own voice, calibrated to
the cat's personality archetype, with memory of the diary they write
about you, the family in your photos, and the things you've told them
about themselves. It's Co-Star for cats, with a 60-second symptom
triage layered underneath.

**Three things competitors don't have:**
1. **The chat is the cat.** Aristocratic-melancholic register. *"You've
   been on the laptop too long. Address this."* Replies are 1-2
   sentences — built for the screenshot.
2. **The diary writes itself.** Every night, the cat writes a diary
   entry referencing today's mood, named family members in photos, and
   recent days. It's so specific it can't be generic AI.
3. **The Feline Five.** The only peer-reviewed cat-personality framework
   used in production. Personality archetype is real, not generic.

**Pricing:** $5.99/mo or $39.99/yr after a 14-day free Pro trial (no
card required — reverse trial). See `docs/MONETIZATION-STRATEGY.md`.

---

## 2. The moonshot bet

A consumer app on $500/mo cannot buy its way to scale. The bet is
**organic content volume** — 30 short-form-video shots across 60 days,
with the math that one cracks 1M+ views. Three independent moonshot
patterns are fired simultaneously:

| Pattern | What it is | Probability per sprint | Leverage if hit |
|---|---|---|---|
| Viral content moment | A TikTok / IG Reel / X post crosses 1M+ views | ~10% per 30 shots | 50K-200K downloads |
| Reddit front-page | A cat post goes r/all or featured-tier-1 | ~15% per 8 weeks | 5K-30K downloads |
| Press cascade | Niche pet press → BoredPanda → Verge / NYT | ~5% per cycle | 100K+ downloads + valuation lift |

**Below the moonshot:** ~$30K-Year-1 net via base-case (per
`docs/MARKET-ANALYSIS.md`). That's the floor. The sprint is about the
ceiling.

---

## 3. Brand non-negotiables — read before any marketing copy

**The cat voice is the brand's most distinctive asset. Get it wrong and
the app reads as generic AI slop.**

### The cat's voice

- **Aristocratic-melancholic. Dry. Slightly imperious. Affection
  sideways.**
- ✅ *"You're late."* / *"Tuna. The good kind. Don't argue."* / *"The
  chair held the shape of you."*
- ❌ *"OMG hooman uwu meow"* / *"Thank you for feeding me!"* / *"You're
  the best!"*

Full rules: `marketing/brand-guide.md`. Voice register samples:
`marketing/chat-as-viral-lever.md` §8.

### The brand's own voice (when CatMD speaks AS CatMD, not as the cat)

- Confident, plainspoken, slightly literary
- ✅ *"AI for cat owners. Your cat, decoded."* / *"Built for cats only.
  By cat people."*
- ❌ *"The future of pet care!"* / *"Discover the secrets your cat is
  hiding!"*

### The visual palette

| Use | Hex |
|---|---|
| Cream (background) | `#FAF7F2` |
| Sage (primary brand) | `#5B8A7A` |
| Sage dark (text on cream) | `#3F6456` |
| Terracotta (Bond accent) | `#C97B63` |
| Charcoal (text) | `#1F2024` |

Cream is the dominant frame colour. Avoid pure white, avoid pure black.
Source Serif 4 for display, Figtree for UI text.

### The cat is the protagonist

Every video opens with the cat — never with the app. App is the punchline,
not the lead. If a video opens with an app screen, it's broken.

---

## 4. Source-of-truth document map

```
marketing/
  MARKETING-STRATEGY-MOONSHOT.md   ← the 8-week orchestration plan
  MARKETING-AGENT-HANDOVER.md      ← you are here
  README.md                        ← high-level marketing overview
  brand-guide.md                   ← voice + visual rules
  reddit-strategy.md               ← Reddit playbook (karma → mention)
  PAID-ADS-PLAYBOOK.md             ← TikTok / Meta paid ads
  chat-as-viral-lever.md           ← Co-Star analogy + product features
  text-overlays.md                 ← caption copy for video on-screen text
  music-suggestions.md             ← royalty-free + trending audio picks
  videos/
    README.md                      ← 9-video series master plan
    PRODUCTION-PLAYBOOK.md         ← end-to-end production process
    01-chat/ … 09-triage/          ← per-video folders (assets + status)
  storyboards/
    00-interact-with-your-cat.md   ← LEAD video (15s)
    01-cat-keeps-diary.md          ← variation: diary-first
    02-talk-to-your-cat.md         ← variation: chat-only
    03-personality-quiz.md         ← BuzzFeed-style
    04-2am-google-vs-catmd.md      ← triage
    05-body-language-read.md       ← demo-style
  ai-video-prompts/
    seedance-cat-broll.md          ← Seedance prompts for B-roll
    seedance-mood-shots.md         ← atmospheric shots
  assets/
    app-screenshots/               ← static screenshots
    screen-recordings/             ← phone screen-recordings
    cat-photos/                    ← reference cat photos
    exports/                       ← finished videos before upload

docs/
  MONETIZATION-STRATEGY.md         ← pricing + paywall + reverse trial
  MARKET-ANALYSIS.md               ← TAM/SAM/SOM, scenarios, unit economics
  CATVERSE-VIRALITY-PLAYBOOK.md    ← backlog of personalised-content formats
  IOS-SETUP-GUIDE.md               ← iOS port (separate concern)

store-listing/
  store-listing-copy.md            ← Play Store + App Store copy
  screenshots/curated/             ← 8 store screenshots in priority order
```

**If you only read 3 docs:** this one + `MARKETING-STRATEGY-MOONSHOT.md` +
`MARKETING-OPERATING-PLAN.md` (the dated 60-day execution layer).
For voice + design rules, also read `brand-guide.md`.

**Strategy stack:**
1. `MARKETING-STRATEGY-MOONSHOT.md` — the locked 8-week strategy (frameworks, channel mix, weekly themes)
2. `MARKETING-OPERATING-PLAN.md` — the dated 60-day execution layer (May 5 – Jul 5 calendar + KPI dashboard + decision-gate triggers + moonshot break-out checklist + risk register). **§3 was rewritten 2026-05-05 (Iteration 2) as the 10-day Pre-Launch countdown for the Fri May 15 dual iOS+Android launch.**
3. `BEST-PRACTICES-RESEARCH-2026.md` — current 2026 research that informs the operating plan's strategic updates (TikTok length, $50 creator seeds, in-app share card, etc.)
4. `DIRECTORY-LAUNCH-LIST.md` 🆕 — 50+ directory submissions tiered S/A/B/C, asset pack scaffold, submission tracker template. Closes the "missed SaaSHub" gap.
5. `LAUNCH-DAY-PLAYBOOK.md` 🆕 — hour-by-hour Friday May 15 + Day +1/+2 with paste-ready templates (Show HN, r/SideProject, X thread, press follow-up, personal-network email, cat-influencer DM) + Plan B Android-solo fallback.
6. `INFLUENCER-PROSPECTS.md` — 12 named + 8 heuristic creator prospects with personalised openers
7. `PRESS-PROSPECTS.md` — 3-tier press list with verified editor names + emails + angles
8. `reddit-strategy.md` — **expanded 2026-05-05 (Iteration 2)** with Tier-3 cat subs (24 total), §10 indie/AI subs (r/SideProject, r/IndieHackers, r/iosapps Self-Promo Saturday, r/androidapps Self-Promo Sunday, r/AItools, etc.), and §11 launch-day Reddit play (Fri-Sun sequence)
9. Tactical Day-1 kits: `videos/01-chat/FINISHING-KIT.md`, `ASO-AUDIT-2026-05-05.md`, `X-ACCOUNT-SETUP.md`

---

## 5. The 8-week sprint at a glance

Full detail in `MARKETING-STRATEGY-MOONSHOT.md` §4. High-level theme per
week:

| Week | Theme | Single most important task |
|---|---|---|
| Pre-0 | Foundation | Create Reddit account NOW (account aging is the bottleneck) |
| 1 | Launch the engine | Drop Video #1 (Chat) on TikTok + IG + YT Shorts |
| 2 | Compound | Identify Week-1 winner; re-cut variants if hooks landed |
| 3 | First paid test + influencer outreach | Launch $10/day TikTok paid ad on the winning creative |
| 4 | Mid-sprint reset + first PR push | Pitch Catster, Modern Cat, The Conscious Cat |
| 5 | Influencer scale + PR mid-tier | Pitch BoredPanda + The Dodo |
| 6 | Compound | Pitch top-tier press (Verge, Vice, NYT lifestyle) |
| 7 | Product Hunt launch + paid scale | Launch on PH at 12:01 AM PST Tuesday |
| 8 | Sprint close + learnings | Write `SPRINT-CLOSE-WEEK8.md` + decide Month-3 strategy |

---

## 6. Founder daily rhythm — the 2-hour day

If the founder follows this, the sprint runs. If they don't, the plan
stalls.

| Time | Task | Channel |
|---|---|---|
| 30 min | Reddit comments (3-5 thoughtful, no CatMD mentions Weeks 1-3) | Reddit |
| 30 min | Short-form video production OR engagement (reply to comments on existing posts) | TikTok / IG / YT |
| 30 min | X build-in-public post + IG engagement (reply, like, follow back) | X / IG |
| 30 min | Strategic — analytics check, planning, content writing, influencer outreach | — |

**Drop ANY 30-min block** to fit the day; don't drop multiple. Reddit
karma is the easiest to defer (slow-burn) but easiest to fall behind on.

---

## 7. Founder constraints — what to know before recommending tactics

**Don't recommend:**
- ❌ Posting on LinkedIn (audience mismatch)
- ❌ Cold email outreach (no list, B2C wrong shape)
- ❌ Mega-influencer partnerships ($5K-50K/post — wrong budget tier)
- ❌ Paid ads BEFORE the public Play Store listing (CTA has nowhere to
  send users; closed-test URLs are fragile)
- ❌ EAS Updates / OTA pushes (founder explicit rule: "when I ask for
  AAB it's AAB, not EAS")
- ❌ Adding new product features as a marketing tactic (separate
  concern; product is in maintenance for the sprint)
- ❌ More than 5 hours/day of marketing work (founder will burn out)

**Do recommend:**
- ✅ Re-cutting winning creative (5 variants of one winner > 5 new
  concepts)
- ✅ Nano Banana + Hailuo pipeline for video B-roll (founder knows
  this; cost ~$1-3/video)
- ✅ CapCut for assembly (free, founder's tool)
- ✅ Build-in-public on X (compounds for free)
- ✅ Reply to every comment for first 48 hours after posting
- ✅ Reddit slow-burn karma path (4-week ramp before any CatMD mention)
- ✅ Press pyramid bottom-up (Catster first, Verge later)

---

## 8. Tools the founder uses

| Tool | What it's for | Cost |
|---|---|---|
| Nano Banana (Gemini 2.5 Flash Image, via Google AI Studio) | Character-consistent stills | Free |
| Hailuo 02 Standard (via fal.ai) | Image-to-video animation | ~$0.27/5s clip |
| CapCut | Final assembly + text overlays | Free |
| Phone screen recorder (built-in Android) | Capture real app footage | Free |
| Canva | Brand cards, posters, store assets | Free / $13/mo Pro |
| RevenueCat dashboard | Paying users, MRR, conversion | Free under $10K MTR |
| PostHog | Cohorts, retention, funnels | Free under 1M events |
| Play Console | Downloads, conversion, country breakdown | Free |
| AppFollow / AppTweak | ASO keyword research | Free tier sufficient |
| TikTok Ads Manager | Paid TikTok | Pay-per-spend |
| Meta Ads Manager | Paid IG/FB | Pay-per-spend (lower priority) |
| PressHook (optional) | PR outreach lists | $50/mo trial |

---

## 9. KPIs the founder cares about (in this order)

1. **Paying users** (the primary metric — everything else is leading indicator)
2. **MRR / ARR**
3. **D7 retention** (the early-warning system; if this drops below 25%
   nothing else matters)
4. **Cost per install** (only relevant if running paid)
5. **Conversion rate** (downloads → 14-day trial start → paid)
6. **Top-of-funnel: TikTok views, IG views, downloads**
7. **Reddit karma** (slow-burn; mostly directional)
8. **Press hits** (binary — counts at the moment of landing, decays
   fast unless followed up)

**Vanity metrics** the founder explicitly DOESN'T care about:
- Follower count on any platform
- "Likes" / "saves" without downstream action
- Impressions without click-through
- Number of posts shipped (cadence is a lever, not a goal)

---

## 10. How the founder communicates

- **Casual register, often lowercase, occasional typos.** Don't try to
  match it precisely — just don't be stiff.
- **"go deeper" / "go for top notch practices"** = wants
  guru-frameworks-grade thinking, not surface tactics
- **"log everything"** = wants markdown files saved that can be
  retrieved across sessions
- **"clean handover"** = wants a self-contained doc; future sessions
  shouldn't need to re-derive context
- **Direct rule statements** like *"gng fwd.. dont do EAS push pls.. when
  i ask for AAB..its AAB.. not EAS"* are absolute. Log and obey.
- **Will say "stop"** when going off track. Take it as a hard reset.

---

## 11. Communication style for outputs (founder preference)

- **Bulleted / tabular > prose.** Walls of text get skimmed and missed.
- **Show file paths and exact content** when proposing changes.
- **Surface decisions explicitly** — "I'd recommend X because Y; alt is
  Z" — don't bury choices in paragraphs.
- **Don't ask for confirmation** on small things — just do them and
  surface what you did. Save confirmation for irreversible / costly
  decisions.
- **End with "next step"** — what does the founder do next?

---

## 12. The first thing a fresh marketing-agent session should do

```
1. Read §0a "Current state" of THIS doc carefully
2. Read the rest of this doc
3. Read MARKETING-STRATEGY-MOONSHOT.md (especially §0a Current State)
4. Read brand-guide.md
5. Check the latest entry in marketing/SPRINT-CLOSE-WEEK[N].md if exists
6. ASK the founder to confirm the ❓ items in §0a (Reddit account
   exists? TikTok / IG / X created? ASO pass done?). Don't assume.
7. Then — and only then — surface the next 3 actionable tasks, ordered
   by what unblocks the most downstream work given the actual state.
```

**Don't re-strategize on every session.** The strategy is fixed for 8
weeks unless a moonshot break-out happens (then
`MARKETING-STRATEGY-MOONSHOT.md` §13 protocol kicks in).

**Don't compress timelines.** The docs use urgent language ("create
account NOW", "drop video Monday") to convey relative priority within
the plan, NOT to override existing founder work. If the founder is
mid-task on something that's already in the plan, the agent's job is
to help them finish it — not to re-prescribe Day-0 setup.

---

## 13. Decision authority — what the agent should and shouldn't decide

| Decision | Authority |
|---|---|
| Caption copy for a specific video | Agent can draft and recommend |
| Which sub to post a Reddit photo to | Agent can recommend |
| Whether to kill an underperforming creative | Agent applies the decision rules in §10 of the strategy doc |
| Whether to scale paid budget | Agent surfaces the trigger; founder decides |
| Whether to pitch press at a tier | Agent drafts the pitch; founder approves the send |
| Whether to pivot the strategy | **Founder only.** Agent surfaces evidence and recommends. |
| Whether to commit budget over $50 | **Founder only.** |
| Whether to launch on Product Hunt | **Founder only** (single-shot, irreversible). |
| Whether to add a new channel | **Founder only.** |

---

## 14. Open questions the next session should track

- [ ] Has the public Play Store listing flipped yet? (gates paid ads)
- [ ] What did Sean Ellis "very disappointed" survey return? (gates Month-2 paid)
- [ ] Did Video #1 (Chat) cross 5K views? (determines re-cut vs new
      concept strategy)
- [ ] Has any video crossed 100K views? (triggers moonshot accelerant
      protocol)
- [ ] Has any Reddit post crossed 1K upvotes? (same)
- [ ] Has any press hit landed? (same)
- [ ] Are any influencer posts live? (track ROI)
- [ ] Is iOS launching this sprint or next quarter? (`docs/IOS-SETUP-GUIDE.md`)

---

## 15. The single-line summary for the next session

**The strategy is locked. Execute the 8-week sprint in
`MARKETING-STRATEGY-MOONSHOT.md`. Every week, log KPIs Sunday. If a
moonshot breaks, drop everything and amplify it. Otherwise, ship the
next video, comment on Reddit, post on X, and trust the math.**

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-05 | Initial handover doc. Companion to MARKETING-STRATEGY-MOONSHOT.md. Mirrors IOS-SETUP-GUIDE.md format for cross-session continuity. |
| 2026-05-05 (eod) | Session 1 kickoff. Confirmed state with founder: Reddit aged-account ✅, TikTok Business ✅, IG Creator ✅, X ❌ (kit drafted), ASO ❓→audited. Three deliverables produced: `videos/01-chat/FINISHING-KIT.md`, `ASO-AUDIT-2026-05-05.md`, `X-ACCOUNT-SETUP.md`. Founder owns Video #1 device-side work next. |
| 2026-05-05 (eod+) | Session 1 deep extend. Read all 10 missing source docs. Spawned 3 research subagents in parallel. Produced 4 new docs: `MARKETING-OPERATING-PLAN.md` (the 60-day dated execution layer — primary deliverable), `BEST-PRACTICES-RESEARCH-2026.md` (8-question current research), `INFLUENCER-PROSPECTS.md` (12 named + 8 heuristics), `PRESS-PROSPECTS.md` (3 tiers, verified editors). 6 strategic updates baked into operating plan: drop 15s TikTok hard cap → 24-38s, default paid lever = $50 creator seeds (Blake Anderson model) not in-feed ads, TikTok Search SEO required on every caption, Reddit 9:1 rule retired (keep behavior), PH reframed as credibility/badge play not download spike, in-app one-tap share-card surfaced as highest-leverage product decision. |
| 2026-05-05 (handover seal) | Added §0d Date → Sprint Week mapping table and §0e First-answer template, so a fresh marketing-agent session can answer "what week are we in + next 3 tasks" deterministically without re-deriving context. Founder will spawn the dedicated marketing agent in a separate chat using the boot prompt below. |
| 2026-05-05 (gap audit / iteration 2) | Founder pushed back: "you missed SaaSHub, Reddit feels light, audit again." Spawned research subagent for 2026 launch playbooks (directories, communities, gurus). Surfaced ~25 missing directories + 15+ missing subreddits + 10+ missing growth loops. Wrote `DIRECTORY-LAUNCH-LIST.md` (50+ entries), `LAUNCH-DAY-PLAYBOOK.md` (hour-by-hour May 15), expanded `reddit-strategy.md` with §10 indie/AI subs + §11 launch-day Reddit play, rewrote `MARKETING-OPERATING-PLAN.md` §3 as the 10-day Pre-Launch countdown for Fri May 15 dual launch. Key new tactics: Hacker News Show HN, r/SideProject launch post, r/iosapps Self-Promo Saturday, r/androidapps Self-Promo Sunday, AI-directory carpet-bomb (15 sites, 3h batch), Apple App Store + Google Play editorial nominations, Pinterest as long-tail SEO compound, Bluesky / Threads / Mastodon cross-posts, NextDoor hyperlocal beta, Facebook cat groups (1.2M largest), cat-influencer-account DMs (Nala Cat / Smoothie / Venus / Cole and Marmalade), vet/shelter partnerships, HARO/Connectively/Qwoted journalist queries, referral loop as #1 missing growth lever (founder dev decision). |
| 2026-05-05 (iteration 3 — zero pre-launch posts) | Founder twice rejected pre-launch posting (first w.r.t. Video #1 on D2, then w.r.t. mid-tier Video #4 on D2). Locked rule: no posts on TikTok / IG / YT / Threads / Bluesky / Mastodon until 5 AM PT May 15. All 9 videos held in queue. §0a now has 🔒 FOUNDER RULE box. Operating plan §3 rewritten as zero-posts pre-launch + integrates 10 high-leverage activities: Linktree multi-link bio (D2), Quora answer drafts (D6), Medium/Substack drafts (D6), Apple Search Ads Basic draft (D6), GitHub awesome-list PRs (D7), press kit PDF (D7), vet/shelter outreach (D8), custom cat-influencer archetype cards (D8), App Store "App Preview" video (D10), founder face-to-camera 30-sec pitch (D10), email waitlist + automation (D4), Connectively/Qwoted/SourceBottle (D2), RevenueCat alerts (D9), deep-link testing (D9). Output state §3 has 24-item ✅ checklist for D10 evening. LAUNCH-DAY-PLAYBOOK §1 updated: Video #1 drops at 5 AM PT (was Video #5 at 6 AM), Video #2 same day 5 PM, Video #3 Sun May 17 1 PM, post-launch cadence table for Videos #4-9 added. |
| 2026-05-06 (vc 67 features ship) | New build vc 67 ships comprehensive medical recall (READ), proactive memory (UNPROMPTED), bidirectional gateway (WRITE), hedge guard, read-side voice discipline. Adds 3 new video concepts: #10 "She told ME her shot is overdue" (proactive memory + health), #11 "I told my cat her weight, she filed it" (write side), #12 "She knows when you skipped her dose" (eerie + judgmental). §0c table updated with all 5 new features marked vc 67. Drop cadence (per `videos/README.md` + agent recommendation): #10 Week 5+ default but pull forward to Week 2-3 if Video #1 cracks 100K views in Week 1; #11 reframed as B-side / X-thread asset rather than primary TikTok (data-entry hook is intrinsically weaker for the cat-owner audience); #12 Week 6+ as planned (eerie variant lands harder after audience trust). Pre-production seeding (Triage→Track with overdue vaccine + dose gap + weight history) recommended NOW (today, 10 min) so proactive-memory beats fire naturally during all subsequent chat use. |
| 2026-05-07 (D3 — OpenClaw kit designed) | Designed full OpenClaw marketing-bot deployment kit at `marketing/openclaw/`. 16 workspace files: SOUL.md (marketing-strategist + brand-voice persona), IDENTITY.md (founder + product + sprint state), AGENTS.md (5 named sub-agents: ReddyTheBot, XPoster, MetricsHawk, CreatorScout, PressWatcher, Sunday Reviewer), TOOLS.md (capabilities — drafts only, no auto-publish), HEARTBEAT.md (24/7 schedule + threshold triggers + moonshot accelerant protocol), 7 skill files (reddit-comments, x-buildinpublic, daily-metrics, creator-outreach, journalist-queries, threshold-alerts, sprint-dashboard), knowledge/PRODUCT.md (comprehensive product reference), knowledge/INDEX.md (pointer map to all marketing docs), memory/sprint-state.md + voice-examples.md + learnings.md (templates). Hardware target: Mac Studio M4 Max 64GB. Model: Qwen 3.6-35B-A3B-Instruct Q5_K_M MLX via LM Studio. Deploy Week 2-3 post-launch (~Mon May 25), NOT before — pre-launch focus stays on launch readiness. Target outcome: 80% volume of Tier 2 drafting tasks automated with founder review; ~15 hours/week saved; moonshot probability lifted from 30-40% baseline to 50-65% via increased shots-fired without dropping voice quality. |
