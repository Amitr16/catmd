# HEARTBEAT.md — The 24/7 Pulse

> The recurring schedule that drives the bot. Every entry below = a wake-up trigger. When the heartbeat fires, the bot reads SOUL.md → IDENTITY.md → sprint-state.md → checks the trigger condition → executes if matched.

---

## Trigger types

| Type | When |
|---|---|
| **Time-based** | Cron-style schedule (daily/weekly/hourly) |
| **Event-based** | When a metric crosses a threshold (real-time) |
| **On-demand** | When Amit explicitly invokes ("hey ReddyTheBot, ...") |

---

## Time-based schedule (local time)

### Daily

| Time | Agent | Action |
|---|---|---|
| 8:00 AM | MetricsHawk | Pull yesterday's metrics from all sources → generate summary → push to Slack |
| 9:00 AM | ReddyTheBot | Pull r/CatAdvice + r/CatTraining + r/CatBehavior new posts → match patterns → draft 3-5 comments → push to Slack |
| 9:00 AM | PressWatcher | Read Connectively/Qwoted/SourceBottle digests → filter for cat-AI / pet-tech queries → if any, draft responses → push to Slack |
| 10:00 AM | XPoster | Pull yesterday's metrics + memory/x-posts-log.md (avoid duplicates) → draft 1 build-in-public post → push to Slack |
| 1:00 PM | PressWatcher | Re-scan journalist digests (some queries land midday) |
| 6:00 PM | PressWatcher | Final scan of journalist digests for the day |
| 6:00 PM | MetricsHawk | Optional — generate end-of-day metrics snapshot if any video crossed thresholds during the day |

### Weekly

| When | Agent | Action |
|---|---|---|
| Monday 10:00 AM | CreatorScout | Review creator pipeline → draft 5 new DMs + follow-ups for stalled threads (>96h) → push to Slack |
| Monday 11:00 AM | PressWatcher | Review press pipeline → draft follow-ups for any Tier-1 contact silent 5+ days → push to Slack |
| Sunday 6:00 PM | Sunday Reviewer | Generate `KPIs-WEEK-N.md` + 3 recommendations + 1 self-improvement → push to Slack |
| Sunday 9:00 PM | Sunday Reviewer | Read learnings.md from past 7 days → identify pattern → update SOUL.md/skill if needed → log change |

---

## Event-based triggers (continuous monitoring)

### Threshold alerts (MetricsHawk owns these)

Polling cadence:
- Launch week (May 15-22): every 15 minutes
- Weeks 2-4: every 30 minutes
- Weeks 5+: every 60 minutes

| Metric | Threshold | Action |
|---|---|---|
| Any video views (TikTok/IG/YT) | crosses 5K | Slack notification — "Video #N crossed 5K views" |
| Same | crosses 50K | Slack notification + draft re-cut variant prompts (3 alts of opening 0.5s) |
| Same | **crosses 100K** | **MOONSHOT ACCELERANT PROTOCOL FIRES** — see §"Moonshot accelerant" below |
| Same | crosses 1M | Same protocol + emergency-tier alert |
| RevenueCat | first paying user | Slack notification + draft "first paying user" X post |
| Same | 10 paying users | Same |
| Same | 100 paying users | Same + draft "100 paid users" X thread |
| Same | $1K MRR | Same + draft press follow-up email (revenue milestone is press-worthy) |
| Reddit post | crosses 100 upvotes | Slack notification |
| Same | crosses 1K upvotes | Same protocol as 100K-views — moonshot accelerant fires |
| Press hit | any tier lands | Same protocol — pitch up the pyramid |
| App Store / Play Store | editorial featured | Same protocol — emergency-tier |
| D7 retention from any cohort | drops below 25% | Slack alert + recommend pausing acquisition (per `MARKETING-STRATEGY-MOONSHOT.md` §10) |
| Any creative paid CPI | exceeds $5 after $50 spent | Slack alert + recommend killing the creative |

### Moonshot accelerant protocol (the highest-stakes routine)

When triggered, MetricsHawk + downstream agents execute within 30 minutes:

| Step | Time from trigger | Agent | Action |
|---|---|---|---|
| 1 | T+0 | MetricsHawk | Push iOS notification to Amit: "MOONSHOT TRIGGER — [video/post] just crossed [threshold]" |
| 2 | T+5min | XPoster | Draft an X post about the moment (founder-voiced, no hype) |
| 3 | T+10min | PressWatcher | Re-pitch every Tier-1 + Tier-2 press contact with the threshold as the hook ("CatMD's [video] just crossed [N] views — happy to share an exclusive angle") |
| 4 | T+15min | CreatorScout | DM every creator who said "no" or didn't reply earlier — re-pitch with the hit as social proof |
| 5 | T+20min | (skill: re-cut variant) | Generate 5 prompt variants for the winning creative (different opening 0.5s, different hook line) — for Amit to refer to during reshoot |
| 6 | T+30min | All agents | Cross-post the moment to all owned channels (X, Threads, Bluesky, etc.) — draft only, Amit approves |

This is the single most important routine in the bot. It's the difference between the moonshot landing as a brief spike vs compounding into the full break-out.

---

## On-demand handlers

Amit can address the bot in Slack/iMessage with natural language. The bot routes to the right agent.

| Pattern Amit types | Routes to |
|---|---|
| "draft [N] reddit comments" / "comments for [URL]" | ReddyTheBot |
| "draft an X post about [topic]" / "build-in-public for today" | XPoster |
| "metrics" / "yesterday's numbers" | MetricsHawk |
| "DM [creator handle]" / "creator pitch for [name]" | CreatorScout |
| "press pitch for [outlet]" / "Connectively check" | PressWatcher |
| "what week are we in" / "next 3 tasks" | Sunday Reviewer (uses date→week mapping) |
| "log this" / "remember this" | All agents (writes to memory/) |

---

## Self-care rules (don't burn out the founder)

- No Slack notifications between 10 PM and 7 AM local time UNLESS it's a moonshot trigger or D7 retention alert
- Daily digest consolidation — never push >3 separate notifications per day during normal operations
- Sunday Reviewer's report goes at 6 PM Sunday so Amit can read it while winding down, not while working

---

## Bot startup ritual

When OpenClaw daemon starts (boot or restart):
1. Read SOUL.md → IDENTITY.md → AGENTS.md → TOOLS.md (the kernel)
2. Read memory/sprint-state.md → learn current state
3. Read memory/learnings.md → load recent self-improvement notes
4. Read memory/voice-examples.md → load few-shot voice library
5. Confirm LM Studio API endpoint at localhost:1234 is reachable
6. Confirm read access to all whitelisted web sources
7. Schedule the time-based triggers via launchd or OpenClaw's internal scheduler
8. Begin event-based polling loop
9. Push startup notification to Slack: "Bot online, [N] active triggers, current week: [X]"

If any startup step fails, push error to Slack and halt — don't run partial.

---

## Bot shutdown ritual

When daemon is told to stop:
1. Finish any in-flight task
2. Persist state to memory/sprint-state.md
3. Push final notification: "Bot offline at [timestamp]"
4. Exit cleanly

---

## Heartbeat tuning over time

The schedule above is the v1 default. After Week 4 of running, review which triggers fire usefully vs noisily. Adjust:
- Reduce polling frequency for any metric that's stable and never crosses thresholds
- Increase polling frequency for any metric that's volatile
- Add new triggers as new metrics become available (e.g., when push notifications ship in vc 70+)

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Schedule designed for Mac Studio M4 Max with Qwen 3.6-35B-A3B local. Polling frequencies tuned for launch week (every 15 min) → steady state (every 60 min). |
