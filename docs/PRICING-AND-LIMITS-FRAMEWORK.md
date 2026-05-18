# CatMD — Pricing & Per-User Limits Framework

> ⚠️ **PRICING UPDATED 2026-05-17.** Current live prices are
> **$9.99/month and $79.99/year** (not the $12.99/$69 used in the
> economic model below). The model's math is built on the old
> assumptions and is preserved as a historical snapshot. When you
> re-run the analysis with PostHog data, plug in the new prices —
> the 20%-of-revenue cost-ceiling logic still applies, just the
> dollar denominators change ($9.99 → $2.00/user LLM ceiling for
> monthly, $79.99/yr → $13.33/user LLM ceiling for annual).
>
> **Purpose**: data-driven approach to designing free / paid tier caps so
> the cost of LLM calls per user per month stays under 20% of monthly
> subscription fee. Drafted 2026-05-03.
>
> **Read first**: `docs/SESSION-CHECKPOINT-2026-05-03.md` §3 — explains
> the `llm_usage` event, `LLMActivity` enum, and `cost_cents` estimator.

---

## 0. The constraint

**LLM cost per user per month must be ≤ 20% of monthly subscription fee.**

This keeps unit economics positive even at the worst-case heavy user.
Above 20% and the marginal cost of a power-user subscriber starts
eating margin to the point where churn or downgrade hurts.

**Important: budget against NET revenue, not gross.** App stores take
~15% commission (Apple Small Business Program + Google Play first-$1M
tier), plus VAT/sales tax in many regions, plus RevenueCat 1% above
$2.5k MTR. Net per $10 of gross is ~$8.50 in the US, ~$7.00–$7.50
worldwide blended. Below shows BOTH gross-budget and net-budget.

| Tier | Gross fee | Net (~85% US) | 20% of NET budget / user / month |
|---|---|---|---|
| Free | $0 | $0 | < $0.10 (paid by conversion funnel, not amortised LLM) |
| Pro Monthly | $12.99 | ~$11.04 | $2.20 |
| Pro Annual | $69/yr ≈ $5.75/mo gross | ~$4.89/mo net | $0.98 |
| Pro Lifetime | $199 / 36 mo amortised ≈ $5.53/mo gross | ~$4.70/mo net | $0.94 |

Annual / Lifetime budgets are tighter than Monthly because (a) revenue
is front-loaded but costs accrue linearly, and (b) annual subscriptions
on Apple Standard rate get the 30%→15% bonus AFTER year 1 — but at
Small Business rate it's already 15% from day one.

The annual/lifetime budget is tighter than monthly because revenue is
front-loaded but costs accrue linearly. Two design options:

1. **Set caps based on the tightest tier** ($1.10/month). Simplest;
   slight under-utilisation by Pro Monthly users.
2. **Differentiate per tier**. More complex; maximises perceived value
   at each price point.

---

## 1. Three PostHog queries to run on 2026-05-17 (14 days of data)

The averages-per-activity insight already built tells you "how
expensive is one call?" That's necessary but not sufficient for tier
design. These three queries surface the **distribution per user**,
which is what actually drives caps.

### 1a. Distribution of cost per user per day

```
For the `llm_usage` event over the last 14 days:
- Group by `distinct_id` AND day
- Sum `cost_cents` per group
- Show the distribution: P50, P75, P90, P95, P99, max
- Render as a histogram and a percentile table
```

**Why it matters**: tells you what the median user costs vs. what the
worst 1% costs in a day. The P99 number drives your free-tier daily
cap. If P99 daily cost is 5¢, free tier can afford generous caps. If
P99 is 50¢, you need stricter throttling or paywall it.

### 1b. Per-user spend stratified by activity

```
For the `llm_usage` event over the last 14 days:
- Group by `distinct_id` AND `activity`
- Sum `cost_cents` per group
- For each activity, show the P90 cost per user
- Sort by P90 cost descending
```

**Why it matters**: identifies which activity is the budget killer for
power users. Probably one of: `cat_studio_poster`,
`body_language_vision`, `scan_triage`. That's your throttling target.

### 1c. Engagement vs. cost correlation

```
For users who fired any `llm_usage` event in the last 14 days:
- Bucket each user by total events fired (1-10, 11-50, 51-200, 200+)
- Show average and P95 monthly cost per bucket
- Show count of users per bucket
```

**Why it matters**: tells you what % of users are genuinely heavy. If
95% of users are in 1-50 events / 14 days, you design tiers for the
5% who matter to economics. If the distribution is flat (whales drive
the average), you design differently.

---

## 2. Strawman tier caps to validate against the data

**These are guesses. Validate with the queries above before shipping.**

### Free tier — target: <$0.10/user/month LLM cost

| Activity | Cap | Rationale |
|---|---|---|
| `scan_triage` | 3/month | Taste-test the medical capability; primary conversion driver |
| `scan_classify` | unlimited | Cheap (~$0.0005/call), runs invisibly |
| `pain_score` (FGS) | 1/month | One-time differentiator demo, then paywall |
| `body_language_vision` | 0 | Too expensive (~$0.003/call); paywall entirely |
| `body_language_audio` | 0 | Tied to body_language above |
| `postcard_caption` | unlimited | Cheap (~$0.0005/call); retention driver |
| `diary_generation` | unlimited | Cheap (~$0.0002/call); retention driver |
| `chat` | 30 messages/month | Generous enough to feel real, capped enough to need conversion |
| `cat_studio_poster` | 0 | Expensive ($0.10/image); fully gated |
| `identity_match` | unlimited | Cheap, runs invisibly |
| `embedding_rag` | unlimited | Nearly free ($0.02/M tokens) |
| `personality_compute` | unlimited | Computed locally, no LLM cost |

### Pro tier — target: <$1.10–$2.60/user/month LLM cost

| Activity | Cap | Rationale |
|---|---|---|
| `scan_triage` | 100/month soft cap | Almost no real user hits this |
| `scan_classify` | unlimited | |
| `pain_score` (FGS) | 1/day | Daily monitoring use case |
| `body_language_vision` | 1/day | Daily check-in use case |
| `body_language_audio` | tied to body_language | |
| `postcard_caption` | unlimited | |
| `diary_generation` | unlimited | |
| `chat` | 500 messages/month soft cap | |
| `cat_studio_poster` | 4/month | Weekly Sunday auto-gen + 0 manual extras |
| `identity_match` | unlimited | |
| `embedding_rag` | unlimited | |

**Soft cap concept**: a quota almost no real user hits, but blocks
runaway abuse. Set at P99 + 20% headroom from the data.

---

## 3. Risks to watch in the data

- **Beta testers ≠ typical users.** Early data skews high-engagement.
  Wait for 50+ active users for 7+ days before drawing strong
  conclusions.
- **Posters could be a budget bomb.** $0.10/image × weekly auto-gen
  for 100 Pro users = $40/month in image-gen alone. Verify the
  Sunday-10am cron is Pro-only (it should be).
- **High-detail vision spikes cost 10x.** Currently
  `imageDetail: 'low'` everywhere. If anyone ever flips to 'high'
  (e.g. for a sharper FGS read), costs jump from $0.001/image to
  $0.01/image. Add a comment + lint rule if this matters.
- **First-day cost spike.** New users explore every feature once on
  day 1. A daily cap will work better than a first-day cumulative
  one — otherwise day-1 quota panic triggers conversion anxiety
  prematurely.
- **Whisper is per-second.** Body-language audio at 6 seconds = $0.0006.
  Negligible per call, but if anyone ever extends clip duration, this
  scales linearly.
- **Embedding-RAG is nearly free.** Don't bother gating it; the
  marginal cost on chat queries is rounding error.

---

## 4. Implementation pointers

When you're ready to actually wire caps:

- **Quota tracking lives in `src/hooks/useScanQuota.ts`** for the
  scan-tier currently. Pattern to extend: per-activity quota hooks
  that read from `useHealthStore` events / `usePhotoStudioStore` /
  similar, count today's invocations per cat per activity, return
  `{ canUse, remaining, resetsAt }`.
- **Paywall surface**: `app/paywall.tsx`. Currently triggered via
  `{ pathname: '/paywall', params: { source: '...' } }`. Add new
  source values per activity (e.g. `'body_language_quota'`,
  `'poster_quota'`) so PostHog can track which feature drives
  conversions best.
- **Free-tier env switches**: `eas.json` production env has
  `EXPO_PUBLIC_ENABLE_PAYWALL=false` currently. Flip to `true` when
  ready. There's also `EXPO_PUBLIC_DEV_FORCE_FREE` for testing.
- **Soft cap UX**: when a user hits 90% of their quota, show a quiet
  "approaching limit" hint. At 100%, show the paywall with a clear
  "you've used 5/5 today; resets at midnight" line — never the
  generic "upgrade" wall.

---

## 5. Revisit prompt for 2026-05-17

Open a fresh Claude session in this workspace and paste:

```
Read docs/SESSION-CHECKPOINT-2026-05-03.md §3 (PostHog tracking)
and docs/PRICING-AND-LIMITS-FRAMEWORK.md for context.

Here are 14 days of `llm_usage` distribution data from PostHog:

[paste the output of the three queries from §1 of the framework doc]

Design free / paid tier daily and monthly caps per LLMActivity that:
1. Keep LLM cost per Pro Monthly user under $2.60/month (20% of $12.99)
2. Keep LLM cost per free user under $0.10/month
3. Allow the median Pro user to feel unrestricted (P50 below cap)
4. Block runaway abuse via soft caps at P99 + 20%

Show your math. Then propose specific quota constants to add to the
codebase, file by file, ready to implement.
```

The output should be data-grounded specific numbers, not vibes-based
estimates.

---

## 6. Pointers back

- Session checkpoint: `docs/SESSION-CHECKPOINT-2026-05-03.md`
- iOS handoff: `docs/IOS-SETUP-GUIDE.md`
- Listing copy (shared with iOS App Store): `store-listing/store-listing-copy.md`
- LLM tracking implementation: `src/services/analytics.ts` (LLMActivity
  enum, price table, trackLLMUsage helper) + `src/ai/client.ts`
  (instrumented call sites)
- Quota hook (existing pattern to extend): `src/hooks/useScanQuota.ts`

End of pricing framework doc.
