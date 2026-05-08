# CatMD Marketing Strategy — 8-Week Moonshot Plan

> **Drafted:** 2026-05-05
> **Audience:** Founder (Amit) + future marketing-agent session
> **Trigger:** Product is best-in-class as of v0.1.8 / vc 62. Constraint
> is reach. This doc is the source-of-truth strategy for getting from
> ~0 paying users to **first 1,000 paying users** through a 60-day
> compressed sprint, on a **$500/month starting budget** (bootstrappable
> as revenue lands).
> **Scope:** 8 weeks. Reassess at end of Week 4 (mid-point) and Week 8
> (sprint close). Strategy assumes Android-only (iOS port planned).
> **Source-of-truth status:** This doc ties together the 9 marketing
> docs that already exist (see §11). It does NOT duplicate them — it
> orchestrates them in time.

---

## 0a. Current state — read first

**This sprint hasn't started. We are in Pre-Week 0, partway through.**
Some items are done; some aren't. Don't read the week-by-week plan as
"Day 0 / blank slate" — confirm actual state first.

| Item | Status (2026-05-05) |
|---|---|
| Android app | ✅ v0.1.8 / vc 62 in closed testing |
| Public Play listing | ❌ Not yet flipped (gates paid ads + official Week-1) |
| 9-video series scaffolded | ✅ Folders + storyboards exist |
| **Video #1 (Chat)** | 🟡 **3/4 assets done.** Pending: Clip 3 screen recording on vc 62 + brand card + CapCut assembly + export |
| Videos #2-9 | ❌ Not started |
| Brand voice | ✅ Locked in `marketing/brand-guide.md` |
| ASO pass on Play listing | ❓ Confirm with founder |
| Reddit account (aged) | ❓ Ask founder — they may already have one |
| TikTok Business / IG Creator / X | ❓ Confirm with founder |
| Sean Ellis "very disappointed" survey | ❌ Not yet shipped in-app |

**Founder's literal next blocker:** finish Video #1. Reinstall vc 62
AAB → re-record Clip 3 → brand card via Nano Banana with icon → CapCut
assembly → export to `marketing/videos/01-chat/final/`. Everything else
in Pre-Week 0 happens in parallel; Video #1 unblocks Week 1 Monday's
drop.

**Don't compress timelines based on the urgency tone in §4.** The
week-by-week plan uses "do X NOW" to convey relative priority; if
something is already done, skip it. The plan is a sequence, not a
deadline list.

---

## 0. The thesis in one paragraph

CatMD is a Co-Star for cats: an identity-product disguised as a cat-care
app. Its core viral lever is the **screenshot** — a 1-2 sentence cat
reply that lands on a friend's group chat, recruits the next user, and
self-amplifies. Marketing's job is not to "sell features." It is to
manufacture screenshot moments at high volume across three channels —
**short-form video (TikTok / IG Reels), Reddit, and PR** — until one of
them breaks containment. The math says: 30 shots, one hits 1M+ views,
moonshot unlocks. Below that, we compound to a $500K ARR indie business
inside 18 months. Both outcomes are acceptable; only one is bet on.

---

## 1. The moonshot lens — what we're betting on

A **moonshot** for a consumer app on a $500/mo budget is not "spend
more on ads." Paid ads with $50/yr ARPU lose money below ~$3 CPI and
CatMD's category is mid-CPI. Moonshot patterns are organic. We bet on
three:

| Pattern | What it looks like | Probability | Leverage if it hits |
|---|---|---|---|
| **Viral content moment** | One TikTok or X post crosses 1M+ views | ~10% per 30 shots | 50K-200K downloads in a week |
| **Reddit front-page** | Cat post hits r/all or a tier-1 cat sub featured | ~15% per 8 weeks | 5K-30K downloads + lasting credibility |
| **Press cascade** | Catster → BoredPanda → Verge / Vice / NYT lifestyle | ~5% per cycle | 100K+ downloads + valuation lift |

We need to **fire all three at once**. Each pattern has independent
probability; the chance that ZERO hits across 8 weeks of disciplined
firing is roughly 60-70%. The chance that AT LEAST ONE hits is 30-40%.
That's the bet.

The fallback path — if no moonshot — is the Year-1 base case from
`docs/MARKET-ANALYSIS.md`: ~75K downloads, ~750 paying users, ~$30K net.
That happens almost regardless. The 60-day sprint is about lifting the
ceiling, not the floor.

---

## 2. Marketing-guru frameworks anchoring this plan

Each section below cites the framework it's drawing from. This is not
academic — every framework here has been used to ship a real consumer
app to scale.

### 2.1 Sean Ellis — "Must Have" PMF survey
**Rule:** Don't scale acquisition until 40%+ of active users say they
would be "very disappointed" if the product disappeared. CatMD has not
yet measured this — Week 1 ships the in-app survey to everyone with 7+
days of usage. **Decision rule:** if PMF score < 40%, redirect Month 2
budget from paid acquisition to product fixes.

### 2.2 Andrew Chen — Cold Start Problem + Atomic Networks
**Rule:** Pick ONE channel and dominate it before diversifying. For
consumer apps, the channel that works first is usually short-form video.
Reddit and PR are second-order — they reward identity that's already
established. **Decision rule:** TikTok + IG Reels are the primary
channel for Weeks 1-4. Reddit is parallel but doesn't get to drive
strategy until Week 5.

### 2.3 Brian Balfour — Channel-Product-Market Fit
**Rule:** A channel only works if your product's ARPU, retention, and
distribution shape match the channel's economics. CatMD: $40/yr ARPU,
35-50% annual retention, screenshot-shareable artefact. **Channel fits:**
TikTok ✓, IG Reels ✓, Reddit ✓, App Store SEO ✓, niche pet press ✓.
**Channel mis-fits:** paid Meta at scale ✗ (CAC too high), LinkedIn ✗
(wrong audience), email outreach ✗ (no list, B2C anyway).

### 2.4 Nir Eyal — Hooked Model (Trigger → Action → Reward → Investment)
Already baked into the product:
- **Trigger** = push notification in cat voice
- **Action** = open chat / read diary entry
- **Reward** = variable cat reply
- **Investment** = the diary fills, the cat "becomes" itself

Marketing's job is to seed Step 1 (trigger). The product handles 2-4.

### 2.5 April Dunford — Obviously Awesome positioning
**Rule:** Position via competitive alternative + unique value. CatMD
positioning: *"Cat owners use Google for symptoms (anxiety) and DMs to
their friends for cat banter (low effort). CatMD replaces both — your
cat actually replies, with their personality, their memory, and a
60-second triage that gives a vet-ready PDF."* This is the line every
PR pitch and every paid-ad copy must trace back to.

### 2.6 Ryan Holiday — PR Pyramid (Trust Me I'm Lying)
**Rule:** Start at niche blogs that aggregate up. Pet press → lifestyle
blogs → BoredPanda / The Dodo → mainstream tech (Verge, Wired) → TV.
Each tier feeds the next. **CatMD pyramid:** Catster + Modern Cat +
The Conscious Cat (Week 5) → BoredPanda + The Dodo (Week 6) → Verge /
Vice / NYT lifestyle (Week 7+).

### 2.7 Pieter Levels / Marc Lou — Build in public, ship fast
**Rule:** Solo founder shows MRR, downloads, and product progress
publicly on X. Builds: (a) an audience of indie hackers who become
super-fans, (b) press hooks ("indie founder builds AI-cat-app to $X
MRR"), (c) cat-owner organic discovery via the X feed. **CatMD:** start
a daily Build-in-Public thread on X Week 1. Post: install count, MRR,
one product detail, one cat moment. Run forever.

### 2.8 Phiture / Steve P. Young — ASO compounds
**Rule:** App Store SEO is the only marketing channel that compounds
without ongoing spend. Keywords + screenshots + reviews are the lever.
For Play Store: title keyword, first 3 lines of description, 8
screenshots that tell a story. CatMD has the screenshots; the title +
description need an ASO pass Week 1.

### 2.9 Co-Star pattern — Build for the screenshot (already-internal doc)
**Rule:** The screenshot IS the marketing. See
`marketing/chat-as-viral-lever.md`. The product features that drive
this (shareable cat-reply cards, daily card, archetype card) are
shipped or scoped. Marketing's job is to manufacture the situations
where users screenshot.

---

## 3. Channel mix — what's in, what's out, why

| Channel | Status | Weight | Rationale |
|---|---|---|---|
| **TikTok organic** | IN — primary | 35% | Highest virality ceiling. 9-video series scaffolded. Cat content thrives here. |
| **Instagram Reels** | IN — primary (cross-post) | 15% | Same content as TikTok, near-zero marginal cost. Older / female audience skews higher LTV. |
| **Reddit** | IN — secondary | 15% | Slow-burn but highest-trust channel. `marketing/reddit-strategy.md` is the playbook. |
| **App Store SEO (Play Store)** | IN — foundation | 10% | Compounds for free. ASO pass Week 1. |
| **X / Twitter (build-in-public)** | IN — foundation | 5% | Cheap reputational capital. Press hook. Indie hacker community. |
| **PR / press outreach** | IN — Week 5+ | 10% | Pyramid play. Catster first, mainstream later. |
| **Micro-influencer seeding** | IN — Week 3+ | 5% | $50-200 per post, niche cat creators 10K-100K followers. |
| **Paid ads (TikTok / Meta)** | IN — Week 5+ (gated on Play public) | 5% | Test only. Not the primary lever. See `PAID-ADS-PLAYBOOK.md`. |
| **Product Hunt** | IN — single shot Week 7 | — | One-time launch event. Free. |
| **YouTube Shorts** | IN — cross-post (zero effort) | — | Same vertical video, post simultaneously. |
| **LinkedIn** | OUT | — | Wrong audience for cat owners. |
| **Email cold outreach** | OUT | — | No list. B2C wrong shape. |
| **Influencer mega-stars** | OUT | — | $5K-50K/post; budget mismatch. Revisit at $50K MRR. |
| **Display ads / banner networks** | OUT | — | CAC death. |
| **Podcast sponsorships** | OUT | — | $200-1000/episode, weeks to land, untargeted. Revisit Q3. |

**Allocation discipline:** if a channel below 5% weight is taking >30
min/day of founder time, kill it.

---

## 4. The 8-week sprint — week by week

> **Founder daily rhythm (across all weeks):** 30 min Reddit + 30 min
> short-form-video production / engagement + 30 min X/IG engagement +
> 30 min strategic (analytics, planning, content writing). **2 hours/day,
> 5-6 days/week.** Below that, the plan stalls. Above that, you'll burn
> out by Week 4.

### Pre-Week 0 — Foundation (the week BEFORE the public Play listing)

This is the dry-run week. Everything must be in place before the public
Play Store listing flips, because that's the moment paid ads can fire
and Day-1 of the official sprint begins.

**Goals:**
- Public Play Store listing flips during this window
- All accounts created, accounts aged, content backlog ready
- ASO pass complete on Play Store listing

**Tasks (conditional — skip what's already done; confirm state with
founder before prescribing):**

🟢 **Founder's primary blocker — finish first:**
- [ ] **Finish Video #1 (Chat).** Reinstall vc 62 AAB → re-record Clip 3 (chat screen recording — the learned-facts chip is now removed) → build brand card via Nano Banana with CatMD icon at top → CapCut assembly per `marketing/videos/PRODUCTION-PLAYBOOK.md` → export to `marketing/videos/01-chat/final/`. **Without this, Week 1 Monday has nothing to drop.**

🟡 **Account setup (skip whichever already exist):**
- [ ] TikTok Business Account (fresh, zero followers fine — needed for organic analytics + paid later)
- [ ] Instagram Creator account
- [ ] X account `@catmd_pet` — bio + pinned post (chat-screenshot card)
- [ ] **Reddit account** — **CHECK WITH FOUNDER FIRST.** Per `marketing/reddit-strategy.md` §8: "If you've been using a different cat-sub account, just keep using that one — don't make a new one for CatMD." If founder already has an aged cat-niche Reddit account, use it. Only create new if they don't.

🟡 **In-app + listing prep:**
- [ ] Sean Ellis "Very Disappointed" survey — in-app prompt for users with 7+ days closed-test usage. Target 30+ responses before Week 4 decision gate.
- [ ] **ASO pass on Play Store listing** (confirm with founder if already done):
  - Title: "cat" + "AI" + "diary" or "personality" in 30 chars
  - Short description: lead with cat-voice chat + diary
  - Long description: first 3 lines loaded with top keywords
  - 8 screenshots in priority order (already curated per `store-listing/screenshots/curated/`)

🟢 **Always do (cheap, compounds):**
- [ ] Pre-produce Video #2 (Diary) and #3 (Personality) IF Video #1 is finished AND founder has bandwidth. **Better to ship Week 1 with 1-2 polished videos than 3 rushed ones.**
- [ ] RevenueCat dashboard alerts: first paid user, 10 / 100 paid users, $1K MRR
- [ ] PostHog cohorts: D1 retention, D7 retention, free → trial → paid funnel

**Budget this window:** $0 (no paid spend until public listing live).
~$15 fal.ai credits if Videos #2-3 enter production.

**Time:** elastic — depends on what's already done. The hard floor is
"Video #1 ready to drop on Week 1 Monday." Everything else slides if
needed.

---

### Week 1 — Launch the engine

**Theme:** Drop the lead video, start Reddit karma grind, launch
build-in-public on X.

**Goals:**
- 1,000+ TikTok views on lead video (#1 Chat) — minimum baseline
- 200+ Reddit comment karma
- First X build-in-public post
- 100+ Play Store organic downloads

**Tasks:**
- [ ] **Mon**: Drop **Video #1 (Chat)** simultaneously to TikTok, IG Reels, YouTube Shorts. Caption: organic version per `marketing/videos/README.md`. Reply to every comment for first 48h.
- [ ] **Tue-Sun**: 3-5 substantive Reddit comments daily in r/CatAdvice, r/cats, r/CatTraining. **No CatMD mentions.** Read the full `marketing/reddit-strategy.md` if not already.
- [ ] **Wed**: Drop **Video #2 (Diary)**. Same multi-platform.
- [ ] **Thu**: First X build-in-public post. Format: *"Day 1 of building in public. CatMD is live on Play Store. 0 paying users today. Here's what the cat said when I asked her about the launch: [screenshot]"*. Pin it.
- [ ] **Fri**: First **photo post on r/cats** — your own cat, dry caption per Reddit playbook §3A. Don't mention CatMD.
- [ ] **Sat**: Drop **Video #3 (Personality)**. Same multi-platform.
- [ ] **Sun**: Week 1 retrospective. Log views, downloads, paying users, top-performing video.

**Budget this week:** $0 paid. ~$15 in fal.ai credits for next-week's video pre-production.

**KPIs to log Sunday:**
- TikTok total views (target: ≥3,000 across 3 videos)
- IG Reels total views (target: ≥1,000)
- Play Store downloads (target: ≥100)
- Reddit karma (target: ≥200)
- X followers (target: ≥30)

---

### Week 2 — Compound

**Theme:** Keep posting, start measuring, refine hooks based on what
landed.

**Goals:**
- Identify which Week-1 video performed best — re-cut a variant
- 500+ Reddit karma
- First Reddit photo post crosses 100 upvotes
- 250+ Play Store downloads cumulative

**Tasks:**
- [ ] **Mon**: Drop **Video #4 (Body Language)** OR a **variant of Week-1's winner** (different hook line, different opening 0.5s). Whichever has higher expected value. **Rule:** if Video #1 from Week 1 cracked 5K views, the highest-EV move is to re-cut it 3 different ways before launching anything new.
- [ ] **Wed**: Drop **Video #5 (Daily Card)**.
- [ ] **Fri**: Second Reddit photo post (different cat moment). Aim for r/IllegallySmolCats or r/OneOrangeBraincell if Lily fits the niche.
- [ ] **Sun**: Drop **Video #6 (Cat Studio)**. This one's pure visual — different audience reach than the chat-voice videos.
- [ ] **Daily**: continue Reddit comments + X build-in-public daily.
- [ ] **One-time**: Submit CatMD to **5 product directories**: Product Hunt (Week 7 launch — submit "upcoming"), AlternativeTo, AppAdvice, Lifehacker tip line, Indie Hackers product page.

**Budget this week:** ~$15 fal.ai credits.

**KPIs Sunday:**
- TikTok cumulative views (target: ≥10,000)
- IG Reels cumulative views (target: ≥3,000)
- Play Store downloads cumulative (target: ≥250)
- Reddit karma (target: ≥500)
- D7 retention from Week-1 cohort (target: ≥30%)
- First paid users (target: ≥3)

**Decision gate (end of Week 2):**
- If TikTok median per-video > 5K views → on track for moonshot. Continue.
- If TikTok median per-video < 1K views → hooks aren't landing. **Don't add more videos. Re-cut openings.** Use comment patterns from Week 1 winners as new hook lines.

---

### Week 3 — First paid test + influencer outreach

**Theme:** Layer in paid ads (TikTok only, $10/day, NOT Meta yet). Reach
out to 10 micro-influencers.

**Goals:**
- TikTok paid ad CPI < $3
- 1 micro-influencer agreement signed
- First Reddit long-form post in r/CatAdvice
- 500+ Play Store downloads cumulative

**Tasks:**
- [ ] **Mon**: Launch first **TikTok paid ad** using Week-1's best video. Per `marketing/PAID-ADS-PLAYBOOK.md` §Setup. **$10/day for 7 days = $70 total this week.** Targeting Recipe A (broad cat owners US/UK/CA/AU). CTA = Install Now → Play Store.
- [ ] **Tue**: Identify **20 micro-influencer cat accounts** (10K-100K followers) on TikTok + IG. Tools: free tier of Modash or HypeAuditor; or manually browse #catsoftiktok / #catsofinstagram.
- [ ] **Wed**: Drop **Video #7 (Weekly Reading)**. Eerie hook — only after audience trusts the brand.
- [ ] **Thu**: **Cold outreach** to 10 micro-influencers via DM. Template: §6 of this doc. Offer: free Pro lifetime + $50 cash for one TikTok / Reel mentioning CatMD. Aim for 2-3 yeses.
- [ ] **Fri**: First **long-form post in r/CatAdvice**. Topic: "What I learned after 6 months of daily check-ins on my anxious cat." Per `marketing/reddit-strategy.md` §3D. **Still don't mention CatMD by name.**
- [ ] **Sat**: Drop **Video #8 (People & Pets)**.
- [ ] **Sun**: Week 3 retrospective. Cull TikTok ad if CPI > $5. Otherwise hold.

**Budget this week:** $70 (paid ads) + $0 (influencers — agreements get fulfilled Week 4) = $70.

**KPIs Sunday:**
- Paid CPI (target: < $3)
- Cumulative downloads (target: ≥500)
- Cumulative paid users (target: ≥15)
- Reddit karma (target: ≥1,000)
- Influencer responses (target: 3-5 yes's)

---

### Week 4 — Mid-sprint reset + first PR push

**Theme:** Halfway gate. Reassess. Begin PR pyramid bottom-tier.

**Goals:**
- 1-2 micro-influencer videos LIVE this week
- 1-2 niche pet blogs covering CatMD (Catster, Modern Cat, The Conscious Cat)
- First subtle CatMD mention on Reddit (per playbook §6)
- 750+ Play Store downloads cumulative

**Tasks:**
- [ ] **Mon**: Drop **Video #9 (Triage)**. Last video in the original 9-series. After this we re-cut winners + iterate, no new concepts until Week 6.
- [ ] **Mon**: **PR pyramid bottom tier** — pitch Catster, Modern Cat, The Conscious Cat, Cat Behavior Associates. Pitch template: §7 of this doc. Hook: "Solo dev built an AI app where the cat actually replies in their own voice — and the diary entries reference your family by name. Free during beta."
- [ ] **Tue-Sat**: Coordinate with influencers on their content. Provide brand guide, video assets if asked. **Don't dictate creative** — micro-influencers know their audience better than you do.
- [ ] **Wed**: Reddit — **first soft CatMD mention** in a comment. Per playbook §6. ONE mention only this week. Watch backlash.
- [ ] **Sat**: Drop **first re-cut variant** of Week-1 winner (different opening, different hook line).
- [ ] **Sun**: **Mid-sprint retrospective.** Update this doc with what's working / not. Re-do channel weights if needed.

**Budget this week:** $70 (paid ads, holding) + $50-100 (influencer payments as videos go live) + $0 (PR is free) = $120-170.

**KPIs Sunday:**
- Cumulative downloads (target: ≥750)
- Cumulative paid users (target: ≥30)
- Press hits (target: ≥1)
- Influencer videos live (target: ≥1)
- D7 retention (target: ≥35%)
- **Sean Ellis PMF score** if 30+ responses collected (target: ≥40% "very disappointed")

**Decision gate (end of Week 4):**
- If PMF score ≥ 40% → green-light Month 2 paid scale.
- If PMF score < 40% → divert Month 2 budget to product fixes; Month 2 marketing reverts to organic-only.
- If a viral moment has already happened (any video > 100K views, any Reddit post > 1K upvotes) → 80/20 budget into amplifying that specific creative. Drop everything else.

---

### Week 5 — Influencer scale + PR mid-tier

**Theme:** If Month 1 retention + conversion are healthy, double the
paid budget. Start mid-tier press.

**Goals:**
- 3-5 influencer videos LIVE
- 1-2 mid-tier press hits (BoredPanda, The Dodo)
- Paid CPI holds < $3
- 1,200+ Play Store downloads cumulative

**Tasks:**
- [ ] **Mon**: Double paid TikTok ad budget to **$20/day** if Week 4 CPI < $3. Add second creative variant in parallel ($10/day each, $20/day total). Total weekly paid: $140.
- [ ] **Mon**: **Pitch BoredPanda + The Dodo** with the strongest viral angle from your existing content. Hook for BoredPanda: "AI-app where cats write daily diary entries about their human." Hook for The Dodo: "The personality archetypes are eerily accurate."
- [ ] **Tue-Fri**: Reach out to **5 more influencers** (10K-100K followers) for Week 6-7 content slots.
- [ ] **Wed-Fri**: Reddit — **second soft CatMD mention** in a comment. Continue pure-engagement comments.
- [ ] **Sat**: Drop **second re-cut variant** of Week-1 winner OR a fully new concept if Week 4 retro identified a missing angle.
- [ ] **Sun**: First **Cat Studio carousel post** to IG feed (square format) — pure visual, low effort, broadens audience beyond chat-voice angle.

**Budget this week:** $140 (paid) + $100 (influencers, 2 more) = $240.

**KPIs Sunday:**
- Cumulative downloads (target: ≥1,200)
- Cumulative paid users (target: ≥60)
- Press hits (target: ≥3)
- Influencer videos live (target: ≥3)
- TikTok cumulative views (target: ≥150,000)

---

### Week 6 — Compound

**Theme:** Hold paid spend, scale winners, push press top-tier.

**Goals:**
- 1 top-tier press hit (Verge, Vice, NYT lifestyle, Wired)
- Influencer cohort generates ≥10K combined views
- 2,000+ Play Store downloads cumulative
- First Reddit photo post crosses 1K upvotes

**Tasks:**
- [ ] **Mon**: Pitch top-tier press. Verge ("AI for cats — what works"), Vice ("solo dev built a Co-Star for cats"), NYT lifestyle ("the rise of pet-AI subscriptions"). Pitch template §7.
- [ ] **Tue-Sat**: Continue paid ($140/wk), influencer coordination, Reddit daily.
- [ ] **Wed**: **Drop a NEW format video** — Cat Studio movie poster carousel, OR a stitch / duet of a viral cat creator's post (with permission). Goal: trigger creator-collab visibility.
- [ ] **Fri**: **Reddit big swing post** — emotionally-loaded story post in r/cats or r/CatAdvice. Per playbook §3C. Include a great photo. Don't mention CatMD yet (still building credibility).
- [ ] **Sun**: Week 6 retrospective. **Project Year-1 outcome** based on Month 1 + 2 trajectory. Pick scenario (conservative / base / optimistic).

**Budget this week:** $140 (paid) + $50 (influencer remainder) + $50 (PressHook trial / journalist outreach tools) = $240.

**KPIs Sunday:**
- Cumulative downloads (target: ≥2,000)
- Cumulative paid users (target: ≥100) ← **first revenue milestone**
- ARR run rate (target: ≥$4,000)
- Press hits cumulative (target: ≥4)
- D30 retention from Week-2 cohort (target: ≥25%)

---

### Week 7 — Product Hunt launch + paid scale

**Theme:** Single biggest one-day event of the sprint. Coordinated.

**Goals:**
- Product Hunt #1 in product-of-the-day
- 1,000+ downloads in 24 hours
- Press follow-up from PH momentum
- 3,500+ Play Store downloads cumulative

**Tasks:**
- [ ] **Mon (12:01 AM PST)**: **Launch on Product Hunt.** First-comment + maker-comment templates ready in §8. Post to X simultaneously. Email 50 friends/network from a personal list to upvote+comment.
- [ ] **Mon**: **Cross-promote PH launch on every channel** — TikTok video about the launch, IG story, Reddit r/SideProject post (one of the few subs where promo is welcome), Indie Hackers Today milestone, Hacker News (Show HN — read HN posting rules first).
- [ ] **Tue**: Day-after PH momentum. Reply to every PH comment. Post the rank screenshot to X.
- [ ] **Wed-Sat**: **Scale paid TikTok ad to $30/day** if Week 6 CPI held. Test Targeting Recipe B (high-intent cat owners) on a separate ad set.
- [ ] **Fri**: **Pitch the Product Hunt placement to press** as fresh news ("CatMD launches on Product Hunt, hits #1 in [category]" — even a #3 finish is a story).
- [ ] **Sun**: New video drop — should be a story about the PH launch itself ("we hit #1 on Product Hunt and the cat had something to say about it").

**Budget this week:** $200 (paid scale) + $50 (PH launch supporting tools — assets, video about launch).

**KPIs Sunday:**
- PH rank (target: top 5)
- Day-1 downloads from PH (target: ≥500)
- Cumulative downloads (target: ≥3,500)
- Cumulative paid users (target: ≥175)
- Hacker News / IH visibility (target: front-page placement on at least one)

---

### Week 8 — Sprint close + learnings

**Theme:** Consolidate. Don't add complexity. Document for next phase.

**Goals:**
- 5,000 Play Store downloads cumulative
- 250 paying users cumulative
- $10,000 ARR run rate
- Decision: continue sprint or shift to compound mode

**Tasks:**
- [ ] **Mon-Wed**: Hold paid at $30/day. Continue daily organic + Reddit.
- [ ] **Tue**: **Pitch the 60-day sprint as a story** to indie press (Indie Hackers, Lenny's Newsletter, MicroConf, Failory, SaaStr). Hook: "Solo founder shipped CatMD to $10K ARR in 60 days on a $500/mo budget."
- [ ] **Thu**: Drop **best-performing-video-to-date variant #3**. Don't overthink — the data already chose.
- [ ] **Sat**: Write **Sprint Close Report** (template §9). Log every channel's actual ROI vs predicted. Save as `marketing/SPRINT-CLOSE-WEEK8.md`.
- [ ] **Sun**: **Decide Month 3 strategy.** Three options:
  - **A (Compound):** Healthy trajectory, no moonshot — keep doing what's working at the same cadence; bootstrap budget proportional to MRR.
  - **B (Pivot):** Conversion or retention below threshold — pause acquisition, fix product.
  - **C (Pour fuel):** Viral moment hit — divert all capital to the working channel; raise budget ceiling to $1500-3000/mo.

**Budget this week:** $200 (paid hold) + $50 (sprint-close pitches / tools) = $250.

**KPIs Sunday (sprint close):**
- Cumulative downloads (target: ≥5,000)
- Cumulative paid users (target: ≥250)
- ARR (target: ≥$10,000)
- D30 retention (target: ≥30%)
- LTV / CPI ratio (target: ≥3:1)
- **PMF score Round 2** if 60+ responses (target: ≥45% "very disappointed", up from Week 4)

---

## 5. Budget allocation — $500/mo, 8 weeks total

**Total sprint budget: ~$1,000 across 8 weeks** (~$500/mo). Distribution:

| Week | Paid ads | Influencers | PR / tools | Cumulative |
|---|---|---|---|---|
| Pre-Week 0 | $0 | $0 | $50 (Canva Pro, CapCut Pro) | $50 |
| Week 1 | $0 | $0 | $15 (fal.ai) | $65 |
| Week 2 | $0 | $0 | $15 (fal.ai) | $80 |
| Week 3 | $70 | $0 | $0 | $150 |
| Week 4 | $70 | $100 | $0 | $320 |
| Week 5 | $140 | $100 | $0 | $560 |
| Week 6 | $140 | $50 | $50 (PressHook) | $800 |
| Week 7 | $200 | $0 | $50 (PH assets) | $1,050 |
| Week 8 | $200 | $0 | $50 | $1,300 |

**Above $500/mo by Week 5.** This is intentional — by then revenue
should fund the over-spend. **Decision rule:** if MRR < $500 by end of
Week 4, cap Month 2 paid at $300 (the original budget) and route the
saved budget to influencer payments instead (cheaper viral leverage).

**If MRR > $1,500 by end of Week 6:** raise Week 7-8 paid to $50/day
($350/wk) on ONLY the proven-winning creative.

---

## 6. Influencer outreach — DM template

Use this exact format. Don't reply with a polished pitch — that triggers
the marketer-flag. Casual, specific, and disclose the offer:

```
hey [name] — your video about [specific cat moment from THEIR feed,
not generic] made me laugh. i build a cat app called CatMD where
the cat actually replies in their own voice and writes a daily
diary about you. feels like something [their cat's name] would
have a lot to say in.

would you be up for trying it and maybe posting one tiktok if you
like it? i can give you free Pro lifetime + send $50 your way for
the post (no creative direction — make it your way, that's why
your stuff works).

no worries if not your thing. catmd.pet if curious.
```

**Targets per week:**
- Week 3: 10 outreach
- Week 4: 5 outreach (filling Week 6 slots)
- Week 5: 5 outreach (filling Week 7 slots)
- Total: 20 DMs → expect 4-6 yeses → expect 3-4 actual posts

---

## 7. PR pitch templates

### Niche pet press (Catster, Modern Cat, The Conscious Cat)

Subject: A solo dev built an AI app where the cat actually replies (and remembers)

```
Hi [editor name],

Quick pitch — I'm a solo founder who built CatMD, an AI app for
cat owners where the cat replies to messages in their own voice,
writes a daily diary about you, and reads body language from a
6-second clip. Currently free in beta, launching paid this month.

Why your readers might care:
- The cat's voice is calibrated to be dry / observant — not the
  saccharine "hooman" voice in most pet AI. Closer to Co-Star than
  Replika.
- The diary references named family members (my mom is in the
  diary because I tagged her in a photo).
- The personality archetype maps to the Feline Five — the only
  peer-reviewed cat-personality framework.

Happy to share preview screenshots, demo videos, or a Pro account
if you'd like to try it. Available for interview by phone or email
this week.

— Amit
[catmd.pet]
[twitter / contact]
```

### Mainstream lifestyle / tech (BoredPanda, The Dodo, Verge, NYT)

Same structure, sharper hook, lead with the unique data point:

```
Subject line options:
- "AI app where cats write daily diary entries about their humans
  is going viral on TikTok"
- "The cat-AI app that reads your cat's body language from a
  6-second clip"
- "A solo founder is building Co-Star for cats — and it's working"
```

Body: open with the most viral content of the prior 4 weeks. Embed a
TikTok if one is over 50K views. Close with the founder story (1 line)
and contact.

---

## 8. Product Hunt launch — first comment template

```
Maker here 👋

I built CatMD because every cat owner I know talks to their cat
constantly — and the cat clearly understands. CatMD is the app
where the cat replies. In their own voice. Remembering the diary
they write about you, the family in your photos, and what you've
told them about themselves.

It also reads body language from a 6-second clip, has a 60-second
symptom triage with a vet-ready PDF, and a personality archetype
based on the Feline Five (the only peer-reviewed cat-personality
framework).

3 things I'd love feedback on:
1. Does the cat-voice land for your cat? (try the chat first)
2. Anything in the personality result feel "off"?
3. Pricing thoughts — currently $5.99/mo or $39.99/yr after a
   14-day free Pro trial.

Free during beta — Android first, iOS coming Q3.

Made by one person. Ask me anything.
```

PH launch checklist:
- Submit "upcoming" 1 week prior (Week 6 Sunday)
- Schedule for Tuesday or Wednesday 12:01 AM PST (best traffic days)
- First comment posted by maker within 5 min of launch
- Email 50 personal-network people 1 day before with: link + ask + draft comment
- Cross-post to X within 30 min of launch
- Reply to every PH comment for first 12 hours

---

## 9. Sprint Close Report — template

To be filled in Week 8 Saturday and saved as `marketing/SPRINT-CLOSE-WEEK8.md`:

```markdown
# CatMD 8-Week Sprint — Close Report

## Headline
- Total downloads: X
- Total paying users: Y
- ARR: $Z
- Top channel by acquisition: [channel]
- Top channel by revenue: [channel]

## Channel ROI
| Channel | Time invested | $ spent | Downloads | Paying users | Revenue | ROI |
|---|---|---|---|---|---|---|

## What worked
- (free-form, 3-5 bullets)

## What didn't
- (free-form, 3-5 bullets)

## Surprises
- (free-form, anything unexpected)

## Month 3 decision
A / B / C (per Week 8 Sunday options)

## Carry-forward backlog
- [ ] (anything not finished but worth keeping)
```

---

## 10. Decision rules — when to kill, when to scale

These are absolute. No emotional attachment to creative or channels.

| Symptom | Action |
|---|---|
| Paid CPI > $5 after $50 spent | Kill creative. Re-cut opening 0.5s. Don't increase budget. |
| Influencer post under 1K views | Don't pay further. Politely decline future collabs. |
| Reddit comment downvoted to <0 in r/CatAdvice | Stop mentioning CatMD in that sub for 2 weeks. |
| TikTok video under 500 views after 48h | Don't boost. Re-cut opening; new audio. |
| D7 retention < 20% from any cohort | **Stop acquisition.** Fix the funnel. |
| Conversion < 2% after 1,000 downloads | Investigate. Likely: paywall timing, pricing, onboarding. |
| Any single video > 100K views | **Drop everything else.** Re-cut 5 variants of the winner. Pour paid budget into the winning creative. Pitch press immediately with the view count as the hook. |
| Reddit post > 1K upvotes | Comment on it FROM the brand account (with disclosure). Don't seed CatMD aggressively — let the post do its own thing. |
| Press hit lands at any tier | Cross-post to every channel within 12 hours. Pitch up the pyramid using the press hit as social proof. |

---

## 11. Source-of-truth document map

This strategy doc orchestrates the following existing docs in time:

| Doc | Role |
|---|---|
| `marketing/MARKETING-STRATEGY-MOONSHOT.md` (this doc) | The 8-week orchestration plan |
| `marketing/MARKETING-OPERATING-PLAN.md` | 60-day dated execution layer (§3 = 10-day Pre-Launch countdown for May 15 launch) |
| `marketing/MARKETING-AGENT-HANDOVER.md` | Onboarding for fresh marketing-agent sessions |
| `marketing/DIRECTORY-LAUNCH-LIST.md` 🆕 | 50+ directory submissions tiered S/A/B/C, asset pack scaffold, submission tracker template (closes the "missed SaaSHub" gap) |
| `marketing/LAUNCH-DAY-PLAYBOOK.md` 🆕 | Hour-by-hour Friday May 15 + Day +1/+2 with paste-ready templates + Plan B Android-solo fallback |
| `marketing/BEST-PRACTICES-RESEARCH-2026.md` | 2026 research underpinning operating-plan strategic updates |
| `marketing/INFLUENCER-PROSPECTS.md` | 12 named + 8 heuristic creator prospects |
| `marketing/PRESS-PROSPECTS.md` | 3-tier press list with editors + angles |
| `marketing/README.md` | High-level marketing project overview |
| `marketing/brand-guide.md` | Voice + visual rules (cat voice, palette, fonts) |
| `marketing/reddit-strategy.md` | Reddit playbook — §1-9 karma path; §10 indie/AI subs; §11 launch-day Reddit play |
| `marketing/PAID-ADS-PLAYBOOK.md` | TikTok / Meta paid ads (post-Play-public) |
| `marketing/chat-as-viral-lever.md` | Co-Star analogy + product features for shareability |
| `marketing/text-overlays.md` | Caption copy for video on-screen text |
| `marketing/music-suggestions.md` | Royalty-free + trending audio picks |
| `marketing/videos/README.md` | 9-video series master plan |
| `marketing/videos/PRODUCTION-PLAYBOOK.md` | End-to-end video production process |
| `marketing/storyboards/00-05` | Shot-by-shot for first 6 videos |
| `marketing/ai-video-prompts/` | Nano Banana / Hailuo prompts |
| `docs/MONETIZATION-STRATEGY.md` | Pricing + paywall + reverse trial |
| `docs/MARKET-ANALYSIS.md` | TAM/SAM/SOM, scenarios, unit economics |
| `docs/CATVERSE-VIRALITY-PLAYBOOK.md` | Backlog of personalised-content formats |

---

## 12. KPIs cheatsheet — what to log every Sunday

Paste into a spreadsheet. Update weekly. The trajectory matters more
than any single number.

| Week | Downloads (cum) | Paying users (cum) | ARR | TikTok views (cum) | Reddit karma | Press hits | Best video views |
|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | $0 | 0 | 0 | 0 | — |
| 1 | 100 | 0 | $0 | 3K | 200 | 0 | — |
| 2 | 250 | 3 | $120 | 10K | 500 | 0 | — |
| 3 | 500 | 15 | $600 | 30K | 1K | 0 | — |
| 4 | 750 | 30 | $1,200 | 60K | 1.5K | 1 | — |
| 5 | 1,200 | 60 | $2,400 | 150K | 2K | 3 | — |
| 6 | 2,000 | 100 | $4,000 | 250K | 2.5K | 4 | — |
| 7 | 3,500 | 175 | $7,000 | 400K | 3K | 5 | — |
| 8 | 5,000 | 250 | $10,000 | 600K | 3.5K | 6 | — |

**These targets are aggressive but plausible** if the lead video lands.
If we miss by 30%, the sprint is still successful. If we miss by 70%,
something is broken upstream — likely product hook, not marketing.

---

## 13. The moonshot accelerants — what to do if something breaks

If at any point a single piece of content unexpectedly hits 1M+ views,
or a press hit lands at the top of the pyramid (Verge / NYT / Wired),
this is the **moonshot break-out moment**. Specific protocol:

### Within 1 hour:
- [ ] Pin the viral content / press hit on every channel
- [ ] Tweet about it from `@catmd_pet` with a mid-tweet emotional reflection ("solo founder, didn't expect this")
- [ ] Capture screenshot of view count / press logo for use in future content

### Within 24 hours:
- [ ] **Pitch up the pyramid** — every press tier above the one that hit. Use the hit as the social proof. ("Just covered by BoredPanda — happy to share an exclusive angle if you'd be interested in a follow-up piece.")
- [ ] **Pour budget into the winning creative or angle.** If a TikTok hit, run paid TikTok ads on that exact video at $50/day immediately. If a press hit, run paid social referencing the press logo.
- [ ] **Reddit cross-promote** in subs where promo is allowed (r/SideProject, r/IndieHackers, r/InternetIsBeautiful if angle fits).

### Within 7 days:
- [ ] Apple / Google editorial outreach. Featured slot is unlocked by social proof. Pitch via your account contact in App Store Connect / Play Console.
- [ ] Influencer follow-on — every micro-influencer who said "no" in Week 3-5 will say "yes" now. Re-DM them with the hit as proof.
- [ ] **Hire help.** A part-time community manager ($1-2K/month) or video editor frees the founder for strategy. Only after MRR > $5K.

### Within 30 days:
- [ ] iOS launch (if not already shipped) — Apple audience converts ~2x Android.
- [ ] Press anniversary content — re-pitch the same press tier 30 days later with growth numbers from the first hit.
- [ ] Open second-channel scaling — if TikTok hit, expand to YouTube long-form (5-min explainer videos). If press hit, podcast circuit (cat-pet podcasts first).

---

## 14. The single-line summary

**Build for the screenshot. Ship 30 shots in 60 days. Reply to every
comment. One of them will hit. If none do, you've still got a $30K-Year-1
indie business compounding underneath.**

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-05 | Initial draft. 8-week sprint plan, $500/mo budget, three moonshot patterns, decision rules, KPI cheatsheet. Hand-off ready. |
| 2026-05-05 (iteration 2) | Founder confirmed dual iOS+Android launch on Fri May 15 (originally Android-public-imminent + iOS-Q3). Founder pushed back on gap coverage ("missed SaaSHub, Reddit feels light"). Spawned research subagent on 2026 launch playbooks. Created `DIRECTORY-LAUNCH-LIST.md` (50+ directories) and `LAUNCH-DAY-PLAYBOOK.md` (hour-by-hour May 15). Expanded `reddit-strategy.md` with §10 indie/AI subs + §11 launch-day Reddit play. Rewrote `MARKETING-OPERATING-PLAN.md` §3 as the 10-day Pre-Launch countdown. Section 11 source-of-truth doc map updated (above) to reference new docs. Strategy thesis unchanged — execution layer extended. |
