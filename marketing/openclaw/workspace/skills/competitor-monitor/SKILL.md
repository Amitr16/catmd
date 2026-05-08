# SKILL: competitor-monitor

> **Owned by:** Bot autonomously (background)
> **Trigger:** Weekly Monday 9:30 AM (deep scan) + Real-time alerts on key changes
> **Companion:** `knowledge/PRODUCT.md` (Differentiators table)

---

## What this skill does

Tracks every direct competitor in cat-AI / pet-tech / consumer-AI-companion space. Alerts Amit when competitors ship features, change pricing, get press coverage, or run paid campaigns that affect CatMD's positioning.

---

## Watchlist (initial — expand as more competitors emerge)

| Competitor | URL | App Store / Play Store | X | Newsletter |
|---|---|---|---|---|
| **Tably** (Sylvester.ai) | sylvester.ai | iOS + Android | @SylvesterAI | Catster mentions |
| **MeowTalk** | meowtalk.co | iOS + Android | @MeowTalk | — |
| **Pawly** | pawly.com | iOS | @PawlyApp | — |
| **11pets** | 11pets.com | iOS + Android | @11pets | — |
| **TalkToYourCatAI** (or similar novelty cat-translator) | various | various | — | — |
| **Cat Translator (Honest)** | various | iOS + Android | — | — |
| **Whisker** | whisker.com | iOS | — | — |

### Adjacent competitors (different category but partial overlap)

| Competitor | Overlap |
|---|---|
| **Replika** | AI companion category (broader, not cat-specific) |
| **Character.AI** | AI character platform |
| **Co-Star** | Identity-product / horoscope analog |
| **Cal AI** / Rizz / Umax | Blake Anderson stack — model for solo $50-creator-seed strategy |

## Monitoring dimensions

| Dimension | What to watch for | Why it matters |
|---|---|---|
| **App Store / Play Store description** | Title changes, keyword changes, screenshot reorders | ASO competitive intel — they may have data we don't |
| **App Store What's New** | Major feature ships | If they ship cat-voice chat or daily diary, it's a positioning crisis |
| **Pricing changes** | Tier shifts, new bundles | Affects our pricing decisions |
| **Free trial / paywall changes** | Reverse-trial vs forward-trial, length changes | Conversion-optimization moves |
| **Ratings + reviews** | Average rating delta, recent 1-star reasons | What users complain about → opportunity for us |
| **X posts** | Press hits, milestones, feature announcements, partnerships | Real-time intel |
| **Press mentions** | Catster, BoredPanda, The Dodo, Verge, Vice, NYT | Coverage cycle competition |
| **Paid ad presence** | Apple Search Ads on cat-related keywords | Are they bidding against CatMD? |
| **Influencer partnerships** | Cat-influencer accounts mentioning competitor | Creator-seeding race |

## Step-by-step (Monday 9:30 AM weekly deep scan)

| Step | Action |
|---|---|
| 1 | Fan out fetches to all watchlist URLs |
| 2 | For each competitor, capture: current App Store description, ratings, recent What's New entries (last 30 days), recent X posts, recent press mentions |
| 3 | Compare against last week's snapshot from `memory/competitor-log.md` |
| 4 | Identify deltas — what's NEW |
| 5 | For each delta, score impact on CatMD (high/med/low) |
| 6 | Compile competitor digest |
| 7 | Push to Slack at 10 AM Monday (after CreatorScout's 10 AM, before regular morning rhythm) |
| 8 | Update `memory/competitor-log.md` with this week's snapshot |

## Real-time alert triggers (don't wait for Monday)

| Event | Severity | Action |
|---|---|---|
| Competitor ships chat-as-cat or daily-diary feature | 🚨 Emergency | Real-time Slack alert + auto-draft positioning post + auto-draft press response |
| Competitor lands Verge / NYT / Wired coverage | 🚨 Emergency | Real-time Slack + draft "we go deeper than [competitor]" angle for press follow-up |
| Competitor pricing change | 🟠 High | Alert + analysis of pricing-decision implications |
| Competitor App Store featured | 🟠 High | Alert + study what got them featured for our own pitch |
| Competitor adds new tier (Lifetime, Family Plan, etc.) | 🟡 Med | Logged; may inform our roadmap |
| Competitor 1-star review pattern emerges | 🟢 Opportunity | Logged; their pain is our angle |

## Output format

```
## Competitor digest — Week [N] — [DATE RANGE]

### 🚨 This week's emergencies
[List or "none"]

### 🟠 This week's significant moves

#### Tably
- App Store: [delta or "no changes"]
- Pricing: [delta or "no changes"]
- Recent What's New: [if any]
- X activity: [highlights]
- Press: [coverage]
- Paid presence: [Apple Search Ads bidding observed]

[Repeat per competitor]

### 🟡 Adjacent moves (Replika, Character.AI, Co-Star, Cal AI stack)
[Brief — only if material]

### Opportunities surfaced
- [Pattern in 1-star reviews]
- [Gap in feature coverage]
- [Press cycle moment to insert ourselves]

### Recommended actions this week
- [If any]
```

## Autonomous follow-on actions

When a 🚨 emergency fires, the bot autonomously:
1. Drafts a positioning X post highlighting CatMD's deeper / different approach
2. Drafts a press follow-up to Tier-1 contacts noting the competitor coverage and offering an alternative angle
3. Generates an updated `knowledge/PRODUCT.md` Differentiators row to reflect the new comparison
4. If a competitor ships a feature CatMD has, drafts a video storyboard via `video-production` skill explicitly highlighting CatMD's depth on that feature

## Self-improvement triggers

- If a competitor move catches us off-guard (Amit hears about it before bot detects it) → expand monitoring sources
- If the digest produces 0 actionable items 3 weeks running → review whether the watchlist is too narrow or competitors are simply quiet
- If a non-watchlist competitor emerges → add them and explain rationale

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Weekly deep scan + real-time alerts for emergency events. |
