# CatMD Monetization Strategy

> Written 2026-05-05. Source-of-truth for paywall, pricing, free-vs-Pro
> tier design, and rollout phasing. Grounded in RevenueCat's State of
> Subscription Apps 2026 (SoSA) data and CatMD's specific product
> shape (AI memory + voice + cat-owner relationship).

## TL;DR — the bet

CatMD ships with a **14-day reverse trial + hybrid usage caps + annual
plan as the financial heart**. No paywall on Day 0; no lifetime
purchase. Free tier stays valuable forever (capped, but real). Pro is
the depth + the AI-cost-eater features. Payment is requested at Day 14
when the cat has already "become" something the user doesn't want to
lose.

Why this and not pure hard paywall: SoSA shows hard paywalls convert
5× freemium (10.7% vs 2.1%), but they win for **utility** apps where
value is immediate (Calm, Headspace, photo filters). CatMD's value is
cumulative — the cat literally has to grow into themselves over weeks.
A reverse trial gets us close to hard-paywall conversion AND builds
the memory moat that fights the +30% AI-app churn problem SoSA
identified.

---

## The SoSA findings that drive this strategy

| Finding | Number | Implication for CatMD |
|---|---|---|
| Hard paywall vs freemium conversion | 10.7% vs 2.1% Day-35 | Pure freemium leaves 5× revenue on the table |
| Hard paywall vs freemium revenue/install | $3.09 vs $0.38 Day-60 | 8× revenue gap |
| Year-1 retention, hard vs freemium | 27% vs 28% | Once payers, retention is the same — paywall ≠ churn |
| Trials 17-32 days conversion | 42.5% | Long trials win conversion |
| Trials <4 days conversion | 25.5% (and 55% Day-0 cancel) | Short trials are a panic-cancel trap |
| Higher-priced apps download→trial | 8.9% vs 4.4% for low-priced | Higher prices convert BETTER, not worse |
| Median annual price 2026 | $34.80 | Pet/lifestyle apps cluster $30-50/yr |
| AI app revenue/payer premium | +41% | We can charge more than non-AI |
| AI app churn vs traditional | 30% worse | Retention is the existential battle |
| New apps reaching $1K MRR in 2 years | 17.3% | 83% fail; we need to be in top quintile |

Sources:
- [State of Subscription Apps 2026 — RevenueCat](https://www.revenuecat.com/state-of-subscription-apps/)
- [SoSA in 10 minutes — RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/)
- [Top 10 Learnings — SaaStr](https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth/)
- [Hybrid monetization is the default — RevenueCat blog](https://www.revenuecat.com/blog/growth/ai-hybrid-monetization/)

---

## Pricing

| Plan | Price | Equivalent /mo | Notes |
|---|---|---|---|
| **Monthly** | **$5.99 / mo** | $5.99 | Slightly above-median to anchor value |
| **Annual** | **$39.99 / yr** | $3.33 | 44% off vs monthly; the financial heart of the model; sits at SoSA median ($34.80) but premium for AI pet category |

**No lifetime tier.** Decision per Amit, 2026-05-05. Reasons aligned
with the call:
- Lifetime captures one-time revenue but kills the recurring engine
- Power users we'd most want as recurring subscribers self-select into
  lifetime
- Removes a pricing-anchor artifact that confuses the value
  perception of $39.99/yr

**Why not lower prices to compete:** SoSA's most counterintuitive
finding — higher-priced apps convert at 8.9% from download to trial vs
4.4% for low-priced ones. Cheap signals "low value" in subscription
apps. Cat owners spend $58B/yr in the US on their cats; $40 for a
year of cat-decoded AI is on-pattern.

---

## The user journey — reverse trial mechanics

| Phase | Days | What user sees / can do | Why |
|---|---|---|---|
| **Onboarding** | Day 0 | NO paywall. Set up cat (name, breed, age, photo). Run first triage scan. See first diary entry. Take personality quiz. | 50% of paid conversions happen Day 0 — but ALSO 55% of cancellations. For a cumulative-value product, show value first; don't paywall first impression. |
| **Reverse trial** | Days 1-14 | **Full Pro experience.** No card required. Banner in Today shows "Pro features unlocked · day N of 14". Daily usage tracked + surfaced ("you've used 12 chat turns / read 4 diary entries / ran 2 body-language reads this week"). | Long enough that the diary fills, the personality reveals, the Becoming meter ticks up, named subjects accumulate. Loss aversion + accumulated investment drive the subscribe decision. |
| **Soft paywall** | Day 14 | Personalised wall: *"You've sent 47 messages to Lily. She's written 9 diary entries. You found her archetype. Keep going for $5.99/month or $39.99/year (7-day free trial)."* + the option "Continue free with limits." | Specific personal numbers convert better than generic feature lists. SoSA: specificity always beats vague. |
| **Free tier** | Day 14+ if not paying | App still works. Capped: 5 chat turns/day, 1 body-language read/week, 3 triage scans/month, 7-day diary archive only. Daily check-in, daily card preview, today's diary entry stay free. | Keeps the install base alive. SoSA: even unconverted users can be retargeted later via push, daily-card hooks, weekly readings. |

**Tracking the moment:** every Day-14 paywall view should fire
`paywall_shown` with `{trial_days_completed, chat_turns_used,
diary_entries_read, photo_count, body_language_reads, has_personality_archetype}`.
Lets us segment converters vs non-converters and find the activation
threshold.

---

## Free vs Pro feature matrix

### Free tier (always free — protects the install base)

- Daily check-in (mood, appetite, litter)
- Streak gamification + birthday + adoption-iversary reminders
- Today screen with health score
- Today's diary entry (one entry, no archive past 7 days)
- **5 chat turns/day** with the cat (Lily replies, full voice/mood/memory — just rate-limited)
- **3 triage scans/month** (full 0-99 scoring; vet-ready PDF gated)
- **1 body-language read/week**
- Photo gallery — last 30 days
- Cat profile + personality quiz + archetype reveal
- 1 cat (multi-cat = Pro)
- Push notifications (cat-voice evening, weekly reading)

### Pro tier ($5.99/mo or $39.99/yr — the depth + the AI-cost-eaters)

- **Unlimited chat** with cat-voice replies
- **Full diary archive** — search, history, all days
- **Daily card** screen + share + weekly "she noticed" readings + Greatest Hits archive
- **Unlimited body-language reads**
- **Unlimited triage scans** + **vet-ready PDF export**
- **Cat Studio posters** (weekly auto-generated, theme rotation)
- **Cloud backup** + multi-device sync
- **Multi-cat** profiles
- (Phase 2) **Premium AI model** for chat/diary — gpt-4o instead of gpt-4o-mini, demonstrably richer voice. Real upsell hook for users who notice the difference.

**Design principle:** Free tier delivers the **daily ritual** (check-in,
push, today's diary, basic chat). Pro delivers **depth** (archive,
unlimited interactions, premium AI, share-everywhere, multi-cat).

---

## Hybrid usage caps (the AI-cost protection)

SoSA explicitly called this out as the 2026 pattern for AI apps:
**subscriptions gate access; usage caps protect from cost runaway.**

| Feature | Free cap | Pro cap | Reason |
|---|---|---|---|
| Chat turns | 5/day | Unlimited | Each chat turn = ~$0.001-0.005 LLM. 5/day caps free user at ~$0.30/month. |
| Body-language reads | 1/week | Unlimited | Each read = ~$0.002 high-detail vision. Weekly cap is generous + still capped. |
| Triage scans | 3/month | Unlimited | Each scan = ~$0.005-0.010. 3/month is the historic free tier (already in `EXPO_PUBLIC_FREE_SCANS_PER_MONTH`). |
| Postcard caption | 1/week | Unlimited | Each = ~$0.0002. Could be looser; 1/week prevents accidental abuse. |
| Cat Studio poster | 1/month | 1/week (auto) | Image gen is the expensive one — $0.05-0.10 per poster. Tight free cap. |
| Diary entries | Today only viewable + 7-day archive | Full archive | LLM cost already paid; gating is value-tier not cost-protection. |

**Implementation:** all caps live in user-pref/store; the LLM-call
client checks before firing. Soft prompt when cap hit: *"You've used
your 5 chats today. Lily will be back tomorrow — or upgrade to keep
talking."*

---

## Onboarding paywall placement

**No paywall on Day 0.** Reasoning:
- Cat-voice value is **cumulative** — the cat hasn't BECOME anything
  yet by Day 0. Hard paywall apps that win on Day 0 (Calm, Headspace)
  deliver the value within minutes (a 10-min meditation).
- 55% of all 3-day trial cancellations happen Day 0 (SoSA). Day 0 is
  fragile.
- The strategic moat is the memory loop. Building the memory requires
  unblocked access during the formation period.

**Soft promotional touches** during the reverse trial are OK:
- Banner in Today: "Pro unlocked · day 7 of 14"
- After the personality reveal: "This profile keeps deepening with
  every check-in. Pro keeps the daily card + chat unlimited."
- After the first diary entry: "Lily wrote her first entry. The
  archive opens with Pro."

These are *informational*, not blocking. The blocking moment is Day
14.

---

## Retention plan (the existential battle for AI apps)

SoSA's hardest finding: **AI apps churn 30% faster than non-AI apps.**
Our entire moat is the memory loop, so retention IS the strategy.

### Already built or in current AAB (vc 61)

- **Daily 19:00 cat-voice push** with real one-liner from today's
  diary — re-engagement at peak phone-attention time
- **Daily card** screen — designed asset, screenshotable, shareable
- **Daily diary** — every night at 19:00 the cat writes
- **Weekly Sunday "she noticed" reading** — the cat reads YOU
- **Greatest Hits** scroll — comeback surface
- **Daily mood lottery** — anticipation loop ("which side of the bed
  did she wake up on?")
- **Cat birthday + adoption-iversary** notifications
- **Streak gamification** in Today
- **People & Pets memory** — diary references named family

### Planned (not yet built)

- **Pre-renewal email at month 11** — "Here's what Lily wrote this
  year: 312 entries, 47 conversations, met 4 named visitors..."
  Should be wired via Resend/Postmark + cron in proxy worker
- **Cancellation save offer** — 30% off next month + reset the daily
  card to today's mood ("see what Lily said today before you go")
- **Win-back nurture** for cancelled users — monthly email "Lily
  hasn't written in 14 days"
- **Referral discount** — free month for both sides; SoSA shows
  referral subscribers retain ~2× organic
- **Yearly digest postcard** — a real postcard mailed (or a beautiful
  digital one) on each anniversary of signup

### Engagement metrics to watch

| Metric | Target | Source |
|---|---|---|
| D7 retention (free tier) | ≥40% | Industry baseline for cat/pet apps is ~30% |
| D30 retention (free tier) | ≥20% | |
| Trial → paid conversion | ≥10% (matches hard paywall median) | SoSA hard paywall median Day-35 |
| Annual share of MRR | ≥60% | SoSA: annual subscribers retain 2-3× monthly |
| Pre-renewal save rate (annual) | ≥15% | SoSA: in-app save offers recover ~15% of cancels |

---

## Phased rollout

### Phase 1 — Closed beta (now → Play Store public)
- `EXPO_PUBLIC_ENABLE_PAYWALL=false`
- All testers see Pro for free
- Validate engagement loop, daily-active-day pattern, chat usage,
  diary depth-over-time
- Track: which features get used most, where users drop off in
  onboarding, how many cats per user

### Phase 2 — Soft launch (Play Store public + first 30 days)
- Enable reverse trial (`EXPO_PUBLIC_ENABLE_PAYWALL=true`)
- New users: 14-day Pro automatically, then soft paywall
- Existing closed-beta testers: grandfathered to Pro free for 90 days
  ("thanks for testing")
- Track: Day-14 conversion %, free-tier retention, premium-feature
  daily-use after downgrade
- No A/B tests yet — get a baseline first

### Phase 3 — Tune (Months 2-3)
- A/B test trial length: 7d vs 14d vs 21d reverse trial
- A/B test pricing: $4.99 vs $5.99/mo; $34.99 vs $39.99 annual
- A/B test paywall copy: feature-list vs personalized-numbers vs
  social-proof
- Each A/B run for 4 weeks min to clear noise

### Phase 4 — Scale (Month 4+)
- Add referral program (free month both sides)
- Add cancellation save flow (30% off + emotional anchor)
- Add pre-renewal email (yearly digest)
- Consider Phase-2 AI-model upgrade for Pro (gpt-4o for chat/diary)
- Consider partner/family pricing tier for 3+ cats

---

## What we explicitly will NOT do

| ❌ | Why not |
|---|---|
| Pure freemium with no paywall ever | 8× revenue gap vs reverse-trial / hard paywall (SoSA) |
| 3-day trial | 55% cancel Day 0. Document panic. |
| Lower price to compete on price | SoSA: lower-priced apps convert WORSE, not better |
| Unlimited free chat | LLM cost on a free user with no quota is unbounded |
| Ads | Pet apps with ads underperform pet apps without; we're a relationship product |
| Lifetime purchase tier | Per Amit: kills recurring engine, captures wrong segment |
| Hard paywall on Day 0 | Value is cumulative; need the trial period for the memory loop |
| Trial on monthly plan | Forces commitment to better unit economics; trial is annual-only |

---

## Open validations / risks to watch

1. **AI cost per free user.** With 5 chats/day cap + 1 body-language
   read/week + 3 triage scans/month at current 4o-mini pricing, a
   maxed-out free user costs ~$0.30-0.50/month in LLM. Sustainable IF
   conversion ≥3%; tight if conversion <2%. **Pin LLM-cost-per-DAU in
   PostHog as a primary metric.**

2. **Reverse trial mechanics in RevenueCat.** Supported but takes
   specific product setup — needs an entitlement flag with auto-expiry,
   not a true subscription. Worth verifying how the existing paywall
   infra (`useEntitlement`, `paywall.tsx`) is configured before
   wiring the 14-day grant.

3. **iOS App Store review** is stricter on reverse trials than Play.
   May need to ship Android-only with reverse trial first, then adapt
   for iOS (possibly with explicit 7-day free-trial-on-annual instead
   of reverse trial).

4. **Pre-renewal retention play needs an email path.** Supabase has
   user emails; Resend/Postmark integration via the proxy worker is
   ~1 day of work but unblocks the highest-leverage retention lever.

5. **Closed-beta tester grandfathering.** If we grant existing
   testers 90-day free Pro, conversion data from this cohort is
   useless until day 90+. Plan accordingly.

---

## Implementation checklist (when ready to build)

- [ ] Verify RevenueCat entitlement schema supports reverse-trial
      (auto-grant + auto-expire)
- [ ] Wire `useEntitlement` to read the reverse-trial state, not just
      paid/free
- [ ] Add `paywall_shown` analytics event with full context payload
- [ ] Update `EXPO_PUBLIC_FREE_SCANS_PER_MONTH=3` (already exists)
- [ ] Add `EXPO_PUBLIC_FREE_CHAT_TURNS_PER_DAY=5` env var
- [ ] Add `EXPO_PUBLIC_FREE_BODY_LANG_PER_WEEK=1` env var
- [ ] Build the Day-14 personalized paywall screen (replace generic
      `app/paywall.tsx` body)
- [ ] Build cap-hit upsell prompts (chat, body-language, scan)
- [ ] Build reverse-trial banner in Today + Pro
- [ ] Build closed-beta grandfathering grant via RevenueCat dashboard
- [ ] Build cancellation save offer flow
- [ ] Wire pre-renewal email cron in proxy worker
- [ ] PostHog dashboard: paywall funnel + cap-hit funnel + retention
      cohorts

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-05 | Drop lifetime tier | Per Amit — kills recurring engine, wrong segment |
| 2026-05-05 | Reverse trial 14d, not hard paywall | Cumulative-value product needs trial; SoSA AI churn data |
| 2026-05-05 | Annual at $39.99 (not $34.80 median) | Higher prices convert better per SoSA; AI premium category |
| 2026-05-05 | Trial only on annual | Forces better unit economics |
| 2026-05-05 | No paywall on Day 0 | Value is cumulative; show value first |
| 2026-05-05 | Hybrid usage caps on AI features | RevenueCat 2026 pattern; protects margin |
