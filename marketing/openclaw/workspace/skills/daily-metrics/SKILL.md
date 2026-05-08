# SKILL: daily-metrics

> **Owned by:** MetricsHawk (also feeds XPoster + Sunday Reviewer)
> **Trigger:** Daily 8:00 AM (full summary) + continuous polling per HEARTBEAT.md
> **Companion:** `memory/sprint-state.md` (where the latest snapshot lives)

---

## What this skill does

Pulls yesterday's metrics from all sources. Generates a single morning summary. Updates sprint-state.md so other agents/skills can use the numbers.

---

## Data sources to pull

| Source | What to pull | Endpoint pattern |
|---|---|---|
| **RevenueCat** | Paying users count, MRR, new trials started yesterday, conversions yesterday, churn | RevenueCat API or dashboard scrape |
| **PostHog** | DAU, MAU, D1/D7/D30 retention from launch cohort, key event counts (chat_used, diary_read, share_card_exported, triage_completed) | PostHog Query API |
| **Play Console** | Yesterday's downloads, install/conversion rate, ratings, country breakdown | Play Console API |
| **App Store Connect** | Same as Play Console for iOS | App Store Connect API |
| **TikTok analytics** | Top videos by views yesterday, total views yesterday, follower delta | TikTok Business API |
| **Instagram Insights** | Reels views, profile views, follower delta | Meta Graph API |
| **YouTube Studio** | Shorts views, subscriber delta | YT Data API |
| **X analytics** | Impressions on yesterday's posts, profile visits | X API or scrape |

## Daily summary format (output to Slack at 8:30 AM)

```
## CatMD daily — [DATE] (Day [N] of sprint, Week [W])

### Top of funnel
• TikTok views yesterday: [N] (cumulative: [M])  [+/- vs prior day]
• IG Reels views: [N]  [+/- vs prior day]
• YT Shorts views: [N]  [+/- vs prior day]
• X impressions: [N]
• Top video: [Video #N] — [N] views

### Acquisition
• Play Store downloads: [N] yesterday (cum [M])
• App Store downloads: [N] yesterday (cum [M])
• Total downloads: [N] (cum [M])

### Conversion
• Trials started yesterday: [N]
• Trials → Pro conversions: [N] ([X%])
• Free tier active users: [N]

### Revenue
• Paying users: [N] (cum)  [+M new yesterday]
• MRR: $[X]  [+$Y vs prior day]
• ARR run-rate: $[X * 12]

### Retention
• D1 retention (yesterday's cohort): [X%]
• D7 retention (last week's cohort): [X%]
• D30 retention (last month's cohort): [X%]

### Sprint pace
• Where we are: Week [N] of 8
• Sprint target by today: [from operating plan]
• Actual vs target: [delta] [✅ on pace / 🟡 slipping / 🔴 off]

### Threshold alerts (if any fired in last 24h)
• [Alert text]

### Notable events
• [Free-form: any creator post, press hit, viral video, etc.]
```

## Step-by-step

| Step | Action |
|---|---|
| 1 | At 8:00 AM, fan out parallel API calls to all data sources |
| 2 | If any source is down or returns error, log to `memory/learnings.md` and continue with available data — never fail the whole digest |
| 3 | Read `memory/sprint-state.md` to compute deltas vs prior day |
| 4 | Read `MARKETING-OPERATING-PLAN.md` Week-N target row to compute pace |
| 5 | Scan for threshold crossings in last 24h (any video/post/metric crossing the boundaries in HEARTBEAT.md) |
| 6 | Render the summary above |
| 7 | Push to Slack at 8:30 AM |
| 8 | Update `memory/sprint-state.md` with today's snapshot |

## Edge cases

| Case | Action |
|---|---|
| RevenueCat API rate-limited | Use cached value from `memory/sprint-state.md` for the field; flag in summary as "stale" |
| Brand-new account (Day 1-3 with mostly-zero metrics) | Render summary anyway with zeros; lead with "Day 1 — establishing baseline" |
| Threshold crossing detected | Flag in summary AND fire `threshold-alerts` skill (separate alert path, doesn't wait for 8:30 AM digest) |
| Paying-users count drops (rare but possible) | Compute net delta honestly; check if churn or refund; flag for founder attention |

## Privacy

- Don't include user-level data (no names, no emails, no IDs) in the digest
- Aggregate only
- Don't post raw data to external services

## Self-improvement triggers

- If a metric pulled is consistently noisy/unreliable → flag in learnings.md
- If a threshold setting is firing too often (false positives) → propose adjusting in HEARTBEAT.md
- If a metric is missing (would be useful but no source wired up) → propose adding MCP server or API integration in TOOLS.md

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Single source of metrics truth. Drives daily digest, sprint-state.md, downstream skills. |
