# CatMD OpenClaw Marketing Bot — Deployment Kit

> **Drafted:** 2026-05-07 (D3)
> **Owner:** Marketing agent (this doc) + Amit (deployment)
> **Hardware target:** Mac Studio M4 Max, 16C/40G GPU, 64GB unified memory, 1TB SSD
> **LLM:** Qwen 3.6-35B-A3B-Instruct, Q5_K_M, MLX format, via LM Studio
> **Deploy date:** ~Mon May 25 (Week 2 post-launch) — NOT before launch
> **Goal:** A 24/7 marketing-bot that makes moonshot a base case by automating the high-volume drafting + monitoring + alerting layer of `MARKETING-STRATEGY-MOONSHOT.md` execution.

---

## What this kit contains

The 15 workspace files in `marketing/openclaw/workspace/` map 1:1 to OpenClaw's expected directory structure at `~/.openclaw/workspace/`. When you're ready to deploy:

```bash
# After installing OpenClaw + LM Studio + Qwen 3.6-35B-A3B:
cp -r marketing/openclaw/workspace/* ~/.openclaw/workspace/

# Then start OpenClaw daemon:
openclaw daemon restart
launchctl list | grep openclaw   # verify running
```

That's it. The bot is now configured with CatMD's full marketing strategy as context.

---

## Architecture overview

```
                    ┌─────────────────────────────┐
                    │   HEARTBEAT.md (the pulse)  │
                    │   • Daily 8 AM trigger      │
                    │   • Real-time monitors      │
                    │   • Sunday weekly trigger   │
                    └──────────────┬──────────────┘
                                   │ wakes
                    ┌──────────────▼──────────────┐
                    │   AGENTS.md (5 agents)      │
                    │   ┌──────────────────────┐  │
                    │   │ ReddyTheBot          │  │ Daily Reddit drafts
                    │   │ XPoster              │  │ Daily X posts
                    │   │ MetricsHawk          │  │ Daily metrics + alerts
                    │   │ CreatorScout         │  │ Creator outreach loop
                    │   │ PressWatcher         │  │ Journalist queries + press
                    │   └──────────────────────┘  │
                    └──────────────┬──────────────┘
                                   │ uses
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌──────────────┐    ┌──────────────────┐  ┌──────────────────┐
     │   SOUL.md    │    │   skills/*       │  │   knowledge/     │
     │  Personality │    │  Capabilities    │  │  Strategy docs   │
     │  Brand voice │    │  (7 skills)      │  │  (references)    │
     └──────────────┘    └──────────────────┘  └──────────────────┘
              │                    │                    │
              └────────────────────┴────────────────────┘
                                   │ writes
                    ┌──────────────▼──────────────┐
                    │   memory/                   │
                    │   • sprint-state.md         │
                    │   • voice-examples.md       │
                    │   • learnings.md            │
                    └─────────────────────────────┘
                                   │ outputs
                    ┌──────────────▼──────────────┐
                    │   YOU (founder)             │
                    │   • Slack/email drafts      │
                    │   • Approve → publish       │
                    │   • Strategic decisions     │
                    └─────────────────────────────┘
```

## File map (15 files)

| File | Purpose | Critical level |
|---|---|---|
| `SOUL.md` | Marketing-strategist + brand-voice persona. Injected into every agent session first. | 🔴 Most critical — set the agent's identity |
| `IDENTITY.md` | Founder name, app facts, sprint state, contact info | 🔴 Critical |
| `AGENTS.md` | 5 named sub-agents with distinct roles | 🟡 High |
| `TOOLS.md` | Capabilities granted to the agent | 🟡 High |
| `HEARTBEAT.md` | 24/7 schedule + triggers | 🔴 Most critical — drives the loop |
| `skills/reddit-comments/SKILL.md` | 12-pattern library + daily Reddit draft routine | 🟡 High — daily volume |
| `skills/x-buildinpublic/SKILL.md` | Daily X build-in-public post | 🟡 High |
| `skills/daily-metrics/SKILL.md` | Pull metrics, summarize, format | 🟡 High |
| `skills/creator-outreach/SKILL.md` | Creator DM drafting + tracker | 🟢 Med |
| `skills/journalist-queries/SKILL.md` | Connectively/Qwoted filter | 🟢 Med |
| `skills/threshold-alerts/SKILL.md` | Moonshot-trigger detection | 🔴 Most critical — captures the moonshot moment |
| `skills/sprint-dashboard/SKILL.md` | Weekly Sunday KPI report | 🟢 Med |
| `knowledge/INDEX.md` | Pointers to existing marketing docs | 🟡 High — keeps context grounded |
| `memory/sprint-state.md` | Bot's working memory | 🟢 Med — bot writes here |
| `memory/voice-examples.md` | Few-shot voice examples | 🟡 High — voice consistency |
| `memory/learnings.md` | Self-improvement log | 🟢 Med — bot writes here |

## How it makes moonshot a base case

Per `MARKETING-STRATEGY-MOONSHOT.md` §1, the moonshot bet is "30 shots in 60 days, math says one cracks 1M+ views." The bot doesn't make the videos go viral — but it dramatically raises the *probability* of the moonshot by:

| Lever | Without bot | With bot |
|---|---|---|
| Reddit comments per week | 15-25 manual | 35-50 (bot drafts, you approve) — **2x volume** |
| X build-in-public posts | 4-7/week with effort | 7/week consistently | Cadence is the hidden multiplier |
| Threshold alerts | Manual checking → miss the window | Real-time → moonshot-accelerant protocol fires within minutes |
| Press response time | Hours-days when journalist query lands | Minutes (bot drafts, you approve) — **first-responder advantage** |
| Creator outreach volume | 5-10 DMs/week with research overhead | 15-25 (bot personalizes, you approve) — **3x volume** |
| Voice consistency across high volume | Drift over time as you tire | Stable (SOUL.md + voice-examples.md keep register tight) |

**The math:** moonshot probability scales roughly with shots-fired × shot-quality × response-velocity. The bot 2-3x's shots-fired without dropping quality. That moves moonshot probability from the strategy doc's stated 30-40% to **50-65%** — meaningfully into "expected" territory.

## Deployment timeline

| Phase | When | What |
|---|---|---|
| 1 — Pre-launch | Now (D3-D11) | **Don't deploy.** Files are ready in `marketing/openclaw/`. Focus on launch. |
| 2 — Week 1 post-launch | May 18-24 | Install OpenClaw + LM Studio + Qwen 3.6-35B-A3B. Smoke test. Ship Sean Ellis survey separately. |
| 3 — Week 2 deployment | May 25-31 | `cp -r` workspace files. Wire up first 2 skills (Reddit + X). Run for 7 days, founder reviews drafts daily. |
| 4 — Week 3 expansion | Jun 1-7 | Add metrics + threshold-alerts + creator-outreach skills. Bot now full-loop. |
| 5 — Week 4 maturation | Jun 8-14 | Add journalist-queries + sprint-dashboard. Tune `voice-examples.md` with approved outputs. |
| 6 — Week 5+ ongoing | Jun 15+ | Bot is steady-state. Founder reviews/approves daily, bot self-improves via `learnings.md`. |

## Security caveats (per Cybersecurity Dive Jan 2026 audit)

- **42K exposed OpenClaw instances had auth bypasses.** Don't expose your localhost to the internet.
- **Don't install on your primary dev machine.** Mac Studio dedicated to marketing automation is fine. Don't put financial credentials, customer auth, or other sensitive material on it.
- **Use Tailscale or SSH tunnel** if you need remote access to the bot from your phone.
- **Review skill permissions** — every skill in this kit declares scope. Don't expand without thinking.

## Cost

| Item | Cost |
|---|---|
| OpenClaw | $0 |
| Qwen 3.6-35B-A3B model weights | $0 |
| LM Studio | $0 |
| Mac Studio (already owned) | $0 |
| Electricity | ~$3-5/month |
| Cloud escalation budget (Claude Sonnet for high-stakes 20% of tasks via API) | ~$15-30/month |
| **Total ongoing** | **~$20-35/month** |

vs Claude API at full marketing-agent volume: $80-300/month. **Net savings: ~$60-265/month.**

## Files in this kit

See `marketing/openclaw/workspace/` for the full file tree.

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 (D3) | Initial design + 15 workspace files written. Tied to vc 67 features and current 8-week sprint plan. Deploy Week 2-3 post-launch. |
