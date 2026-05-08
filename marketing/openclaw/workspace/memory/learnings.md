# memory/learnings.md — Bot's self-improvement log

> Every failure, every reject, every surprise gets logged here. Sunday Reviewer reads it weekly to identify patterns and update SOUL.md/skills as needed. The bot improves over time by writing here and reading here.

---

## Format

Each entry:

```
## YYYY-MM-DD — [Category]
**What happened:** [observation]
**Why it matters:** [implication]
**Action:** [what to change, in which file]
**Status:** open / applied / superseded
```

Categories:
- `voice-drift` — generated output that didn't match brand voice
- `false-positive` — alert/threshold that fired but was noise
- `missed-signal` — important moment the bot didn't catch
- `pattern-win` — a draft that landed above expectations
- `pattern-loss` — a draft that flopped
- `tooling-gap` — needed a tool/data the bot didn't have access to
- `process-improvement` — workflow change worth applying
- `founder-feedback` — direct input from Amit

---

## Initial entries (founder-set baseline)

### 2026-05-07 — process-improvement
**What happened:** Founder explicitly rejected pre-launch posting twice (Video #1 D2, then mid-tier Video #4 D2). Each time, founder stated reasoning: "viral hit on non-installable app wastes the asset; share-card / install-CTA loop only works post-launch."
**Why it matters:** This is the founder rule that drives the zero-pre-launch-posts policy. It's now locked in HEARTBEAT.md.
**Action:** Locked in `HEARTBEAT.md` and `SOUL.md`. No future agent should propose pre-launch posting.
**Status:** applied

### 2026-05-07 — process-improvement
**What happened:** TAAFT + Futurepedia both went paid-only since carpet-bomb strategy was originally written. $49-$497 entry costs violate the $500/mo budget.
**Why it matters:** AI directory landscape shifted in 2024-2026. Carpet-bomb math is broken at scale.
**Action:** Both deferred to post-launch revenue per `DIRECTORY-LAUNCH-LIST.md` Deferred section. Founder rule: don't pay >$50 to any single directory pre-launch.
**Status:** applied

### 2026-05-07 — process-improvement
**What happened:** Founder confirmed Lily is an AI character (founder doesn't own a cat). Body-language Video #4 will use friend's cat footage.
**Why it matters:** Brand consistency requires Lily-AI character across most videos. For Video #4 specifically, friend's cat is OK if not named/branded as Lily.
**Action:** Logged in IDENTITY.md. Don't disclose Lily-AI publicly. Brand consistency rule: most videos use Lily-AI; one-off feature demos can use real cat footage if not named.
**Status:** applied

### 2026-05-07 — process-improvement
**What happened:** Sean Ellis survey originally planned for D3 ship was deferred to Week 1 post-launch.
**Why it matters:** Closed-test users skew positive (Sean Ellis's own warning). Survey only works on real product-dependency, not closed-test exposure.
**Action:** New ship date ~Mon May 18 (Week 1). Logged in operating plan §3 D3.
**Status:** applied

### 2026-05-07 — founder-feedback
**What happened:** Founder pushback on TikTok Business account — they were on Creator (not Business) all along; handover was wrong.
**Why it matters:** Business account locks out trending music library. Critical for organic reach. Creator is correct.
**Action:** Updated handover §0a. New rule: Creator account on every video platform for indie/solo founders.
**Status:** applied

### 2026-05-07 — founder-feedback
**What happened:** Founder rejected "solo, 8 months" framing in launch X post — said it dilutes the work.
**Why it matters:** Voice rule: don't lean on underdog framing. The product is the achievement; team size is incidental.
**Action:** Logged in voice-examples.md anti-patterns. Future build-in-public posts avoid solo / underdog framing as default; if used, framed as fact ("8 months") not framing ("solo").
**Status:** applied

---

## Self-improvement triggers (the Sunday Reviewer reads this section)

When Sunday Reviewer scans the past 7 days of learnings:
- 3+ entries in the same category → that's a pattern, propose a fix
- Any `voice-drift` entry → review SOUL.md and voice-examples.md
- Any `missed-signal` entry → review HEARTBEAT.md thresholds
- Any `tooling-gap` entry → propose an MCP server or API integration in TOOLS.md

---

## Active improvement loops

| Loop | Status | Next review |
|---|---|---|
| Reddit comment first-pass approval rate | Tracking — target >70% by Week 2 | Sunday Reviewer Week 2 |
| X post engagement consistency | Tracking — baseline being established | Sunday Reviewer Week 3 |
| Threshold-alert false-positive rate | Tracking — target <10% | Sunday Reviewer Week 2 |
| Cat-voice consistency in generated output | Tracking via voice-examples.md library growth | Ongoing |

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Seeded with 6 baseline learnings from sprint Pre-Week-0 founder feedback. |
