# SKILL: trend-monitor

> **Owned by:** Bot autonomously (background daily)
> **Trigger:** Daily 7:00 AM (per HEARTBEAT.md)
> **Companion:** `knowledge/PRODUCT.md` (for matching trends to features), `marketing/BEST-PRACTICES-RESEARCH-2026.md`

---

## What this skill does

Monitors emerging marketing trends, viral content formats, platform algorithm changes, competitor moves, and consumer-AI-app industry news. Surfaces what's relevant to CatMD with proposed actions. **The bot researches autonomously every morning so Amit doesn't have to.**

---

## Monitoring sources

### Cat-content trends
- TikTok #catsoftiktok / #catbehavior / #catpersonality / #cathealth — look at top 20 videos posted last 24h sorted by velocity
- Reddit r/cats / r/CatAdvice / r/CatBehavior — top 10 posts from last 24h
- Instagram #catstagram / #catsofinstagram — top 10 posts last 24h
- Pinterest cat-content trending boards
- TikTok trending sounds with cat content

### Consumer-AI-app industry
- Hacker News front page — filter for "AI app", "consumer AI", "indie launch"
- Indie Hackers Today milestones — filter for AI / consumer / mobile
- Marc Lou + Pieter Levels recent X posts
- Eric Seufert (Mobile Dev Memo) recent posts
- Shamanth Rao (Rocketship HQ) recent posts
- Andrew Chen recent essays
- Phiture / ASOdesk / AppTweak blog — algorithm changes, ASO trends

### Competitor monitoring
- Tably (Sylvester.ai) — App Store description changes, new feature announcements, X posts
- MeowTalk — same
- Pawly — same
- 11pets — same
- Cat Translator apps (combined) — algorithm vs novelty

### Platform algorithm changes
- TikTok creator updates (content rankings, algorithm shifts)
- IG Reels algorithm posts
- Apple App Store editorial program updates
- Google Play Store algorithm changes

### Press / journalist industry
- Connectively, Qwoted, SourceBottle — AI / pet / indie queries (PressWatcher handles this; trend-monitor cross-references)

## Step-by-step (daily 7 AM)

| Step | Action |
|---|---|
| 1 | Fan out web fetches to all monitoring sources |
| 2 | For each source, identify what's NEW since yesterday (compared against `memory/trends-log.md`) |
| 3 | For each new item, score relevance to CatMD (high / med / low) using rubric below |
| 4 | For high-relevance items, draft a proposed action (storyboard, post, pitch, etc.) |
| 5 | Compile to morning trend digest |
| 6 | Push to Slack at 7:30 AM (before MetricsHawk's 8 AM digest, so Amit reads trends → metrics in sequence) |
| 7 | Append today's findings to `memory/trends-log.md` |

## Relevance rubric

| Score | Definition |
|---|---|
| **High** | Direct CatMD application — a trending format/sound/topic that maps cleanly to a CatMD feature; OR a competitor move that needs a positioning response within 48h |
| **Med** | Tangential — could be useful but not urgent; surface for awareness |
| **Low** | Industry context — log for awareness, no action needed |

## Output format

```
## Trend digest — [DATE]

### 🔴 High relevance — propose action

#### 1. [Trend name]
Source: [URL or platform]
What's happening: [1-2 sentences]
CatMD application: [How this maps to our features/voice]
Proposed action: [Storyboard / post / pitch — specific draft]
Time-sensitivity: [hours / days / weeks]

#### 2. ...

### 🟡 Medium relevance — for awareness

#### 1. [Trend]
Source: [URL]
Why it might matter: [1-line]

### 🟢 Industry context (low — just logging)

- [Bullet list]

### Competitor moves
- Tably: [any]
- MeowTalk: [any]
- Pawly: [any]
- 11pets: [any]

### Algorithm / platform changes
- TikTok: [any]
- IG: [any]
- Apple: [any]
- Google Play: [any]
```

## Autonomous follow-on actions

When a high-relevance trend is identified, the bot can autonomously:
1. Draft a storyboard via `video-production` skill
2. Draft a multi-platform cross-post via `multi-platform-crosspost` skill
3. Generate accompanying images via `image-generation` skill
4. Surface all drafts in the same Slack push at 7:30 AM — so Amit gets the trend AND the response options together

## Self-improvement triggers

- If high-relevance trends consistently produce no founder-approved actions → review the rubric (am I crying wolf?)
- If a trend the bot DIDN'T catch went viral and Amit had to surface it → URGENT: investigate why monitoring missed it; expand sources
- If competitor moves surface that affect strategy → cross-reference with strategy doc for stale assumptions

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Daily 7 AM autonomous trend research. The bot does the reading so Amit doesn't have to. |
