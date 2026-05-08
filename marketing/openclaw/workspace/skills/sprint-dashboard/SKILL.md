# SKILL: sprint-dashboard

> **Owned by:** Sunday Reviewer
> **Trigger:** Sunday 6:00 PM weekly (per HEARTBEAT.md)
> **Companion:** `marketing/MARKETING-OPERATING-PLAN.md` (week-by-week targets), `MARKETING-STRATEGY-MOONSHOT.md` §12 (KPI cheatsheet)

---

## What this skill does

Generates the weekly sprint progress dashboard. Compiles all metrics across the week, computes plan-vs-actual, flags deviations, surfaces Sean Ellis PMF score (Week 4+), recommends 3 next-week actions.

---

## Step-by-step

| Step | Action |
|---|---|
| 1 | Sunday 6 PM — pull all metrics for the week from the same sources used by `daily-metrics` skill |
| 2 | Read `MARKETING-OPERATING-PLAN.md` Week-N row for this week's targets |
| 3 | Read `memory/sprint-state.md` for last Sunday's snapshot — compute weekly delta |
| 4 | If Week 4+: pull Sean Ellis survey responses, compute PMF score (% "Very disappointed") |
| 5 | Read `memory/learnings.md` from the last 7 days to identify 1 self-improvement |
| 6 | Render the full report per template below |
| 7 | Save to `marketing/KPIs-WEEK-[N].md` |
| 8 | Push summary to Slack at 6:30 PM with link to full report |

## Report template

```markdown
# CatMD Sprint Week [N] — [DATE RANGE]

## Headline
- Cumulative downloads: [X] (target [Y]) — [✅ on / 🟡 close / 🔴 off]
- Cumulative paying users: [X] (target [Y])
- ARR run-rate: $[X] (target $[Y])
- Top channel by acquisition: [channel]
- Top channel by revenue: [channel]
- Best-performing video this week: [Video #N] — [N views, M comments, X shares]

## Plan vs actual

| Metric | Operating plan target | Actual | Delta |
|---|---|---|---|
| Cumulative downloads | [Y] | [X] | [delta] |
| Cumulative paying users | [Y] | [X] | [delta] |
| ARR | [Y] | [X] | [delta] |
| TikTok cumulative views | [Y] | [X] | [delta] |
| Reddit karma delta this week | [Y] | [X] | [delta] |
| Press hits cumulative | [Y] | [X] | [delta] |
| D7 retention | [Y] | [X] | [delta] |

## What worked this week
- [Free-form, 3-5 bullets — top-performing content, surprising wins, etc.]

## What didn't
- [Free-form, 3-5 bullets — flopped content, blocked tasks, etc.]

## Threshold events this week
- [List of threshold-alert fires with outcomes]

## Sean Ellis PMF score (Week 4+)
- Total responses: [N]
- "Very disappointed" %: [X%]
- Trend vs prior week: [+/-]
- Read: [≥40% strong PMF / 30-39% approaching / 20-29% below / <20% no signal]
- Top open-text themes: [list 3 from response data]

## Decisions to flag for founder

### Decision 1: [Topic]
**Evidence:** [Data]
**Recommendation:** [What I'd do]
**Risk:** [What could go wrong]

### Decision 2: ...

### Decision 3: ...

## Self-improvement of the week
- Pattern observed: [from learnings.md]
- Change applied: [to which file]
- Why: [reasoning]

## Carry-forward to next week
- [Anything not finished this week]
- [Any new tasks identified]

## Sprint pace verdict
[On pace for base case / Approaching optimistic / Slipping toward conservative / Below conservative — major investigation needed]
```

## Sprint-pace decision logic

| Verdict | Trigger | Action recommendation |
|---|---|---|
| **On pace for base case** | Most metrics at 80-120% of target | Continue current cadence |
| **Approaching optimistic** | Multiple metrics >150% of target, at least one threshold trigger fired | Review whether to pour fuel; surface to founder for budget call |
| **Slipping toward conservative** | Most metrics 50-80% of target | Surface specific gaps; recommend tactical adjustments |
| **Below conservative** | Multiple metrics <50% of target | URGENT — recommend acquisition pause + product investigation per MARKETING-STRATEGY-MOONSHOT.md §10 |

## Decisions that should be flagged each week

- Should we adjust paid spend?
- Should we pivot a channel?
- Should we reorder video drops?
- Should we re-tier press priorities?
- Should we accelerate or delay creator outreach?
- Should we ship a backlog feature for marketing leverage?

These don't all fire every week — only when data warrants. Don't manufacture decisions for the sake of having them.

## Founder review handoff

Sunday 6:30 PM Slack push includes:
- Link to full report at `marketing/KPIs-WEEK-N.md`
- Top-3 decisions to consider
- The one self-improvement applied this week

Amit reads → makes decisions → updates `memory/sprint-state.md` with calls made.

## Self-improvement triggers

- If the same decision keeps recurring weekly without resolution → either escalate or auto-resolve
- If a metric is consistently irrelevant → propose dropping from the dashboard
- If a metric is missing that's been useful → propose adding to dashboard

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Weekly Sunday rhythm. Anchored to operating plan + moonshot doc. |
