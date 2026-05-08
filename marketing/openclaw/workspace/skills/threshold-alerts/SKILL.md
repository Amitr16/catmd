# SKILL: threshold-alerts

> **Owned by:** MetricsHawk
> **Trigger:** Continuous polling per HEARTBEAT.md
> **Companion:** `MARKETING-STRATEGY-MOONSHOT.md` §13 (the moonshot accelerant protocol — the canonical source)

---

## What this skill does

Monitors all metrics in real-time. Fires alerts when thresholds cross. Drafts amplification follow-ups within 30 minutes when moonshot triggers fire. **This is the single most important skill in the bot — it captures the moonshot moment.**

---

## Threshold ladder

| Metric | Threshold | Severity | Action |
|---|---|---|---|
| Single video views (TikTok/IG/YT) | 5K | 🟡 notable | Slack notification only |
| Same | 50K | 🟠 amplify | Slack + draft 3 re-cut variant prompts (different opening 0.5s) |
| Same | **100K** | 🔴 **MOONSHOT TRIGGER** | **Full accelerant protocol — see below** |
| Same | 1M | 🚨 emergency | Same protocol + push-notification override of "do not disturb" |
| RevenueCat | 1st paying user | 🟢 milestone | Slack + draft "first paying user" X post |
| Same | 10 paying users | 🟢 milestone | Slack |
| Same | 100 paying users | 🟢 milestone | Slack + draft "100 paid users" X thread + press follow-up |
| Same | 250 paying users | 🟢 milestone | Same + Slack + check sprint pacing vs operating plan |
| Same | $1K MRR | 🟠 amplify | Slack + draft press follow-up email (revenue milestone is press-worthy) + draft X post |
| Same | $5K MRR | 🟠 amplify | Same + propose hiring decision per sprint plan |
| Same | $10K MRR | 🔴 sprint-target | Same + sprint-close report trigger |
| Reddit post | 100 upvotes | 🟡 notable | Slack notification |
| Same | 500 upvotes | 🟠 amplify | Slack + draft engagement comment from brand account (with disclosure per reddit-strategy.md §6) |
| Same | **1K upvotes** | 🔴 **MOONSHOT TRIGGER** | **Full accelerant protocol** |
| Press hit | any tier | 🔴 **TRIGGER** | **Full accelerant protocol** |
| App Store / Play Store | editorial featured | 🚨 emergency | Same protocol + emergency-tier alert |
| D7 retention | drops below 25% from any cohort | 🔴 alert | Slack alert + recommend pausing acquisition (per `MARKETING-STRATEGY-MOONSHOT.md` §10) |
| D7 retention | drops below 20% | 🚨 emergency | Same — recommend full STOP on acquisition spend |
| Any creative paid CPI | exceeds $5 after $50 spent | 🟠 alert | Slack — recommend killing the creative |
| Conversion rate | <2% after 1,000 downloads | 🔴 alert | Slack + recommend investigating paywall timing, pricing, onboarding |
| Negative App Store / Play Store review (1-2 stars) | any | 🟡 review | Surface to founder for response (don't auto-reply per TOOLS.md) |

## The moonshot accelerant protocol

When a 🔴 trigger fires, execute these steps within 30 minutes:

| Step | Time from trigger | Action |
|---|---|---|
| 1 | T+0 | Push iOS notification to Amit (override DND if 🚨): *"MOONSHOT TRIGGER — [video/post/press] just crossed [threshold]. Protocol firing."* |
| 2 | T+0 | Update `memory/sprint-state.md` with the threshold event + timestamp |
| 3 | T+5 | Trigger XPoster to draft an X post about the moment (founder-voiced, no hype, factual) |
| 4 | T+10 | Trigger PressWatcher to draft re-pitches for every Tier-1 + Tier-2 press contact, using the threshold as the hook (*"CatMD's [video] just crossed [N] views — happy to share an exclusive angle"*) |
| 5 | T+15 | Trigger CreatorScout to DM every creator who said "no" or didn't reply earlier — re-pitch with the hit as social proof |
| 6 | T+20 | Generate 5 prompt variants for the winning creative — different opening 0.5s, different hook line, different audio (if it's a video). Save to `memory/winners.md`. |
| 7 | T+25 | Draft cross-platform amplification posts: Threads, Bluesky, Mastodon — same content, slight platform-appropriate tweaks |
| 8 | T+30 | Push consolidated digest to Slack: every draft generated, every step queued for founder approval |

The bot does not auto-publish any of these. The job is to have everything ready for Amit to approve in batch within 5 minutes.

## False-positive handling

| Symptom | Action |
|---|---|
| A threshold fires but the data is clearly noisy (e.g., bot view spike on TikTok, fake upvotes on Reddit) | Log in `memory/learnings.md` as suspected false-positive; don't fire full protocol; raise threshold in HEARTBEAT.md if recurring |
| Two thresholds fire within 1 hour | Don't fire the protocol twice — consolidate into one notification |
| Press tier-3 threshold fires (lowest tier — niche pet press) | Fire Slack notification but skip steps 4-7 of the full protocol — pitch up only when the hit is at Tier-2 or above |

## Founder override

Amit can:
- Mute a specific threshold for [N] hours: `mute video-100k-trigger 24h`
- Disable a specific threshold permanently: `disable D7-20-emergency`
- Adjust threshold values: `set video-trigger-threshold 75K`

All overrides log to `memory/learnings.md` with reasoning.

## Self-improvement triggers

- If a threshold fires and Amit consistently skips the follow-up actions → review whether the threshold is meaningful or just noise
- If the moonshot accelerant protocol fires successfully (Amit approves all 7 outputs) → reinforce the pattern; reduce false-positive checks
- If the protocol misses a moonshot (founder catches a viral moment that didn't trigger an alert) → URGENT: investigate why, fix gating, log to learnings.md

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. The single most important skill — captures the moonshot moment. Anchored to MARKETING-STRATEGY-MOONSHOT.md §13. |
