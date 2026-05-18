# I shipped a cat AI app in 14 days with Claude as pair programmer. Here's the playbook.

**Slug:** `shipped-catmd-in-14-days-with-claude`
**Audience:** Indie Hackers, AI engineering Twitter, dev-tools curious devs, Anthropic case-study pitch
**Estimated length:** ~1,900 words
**Primary keyword:** Claude Code production app
**Secondary:** AI pair programming, indie hacker AI app, audit-driven development

---

Two weeks ago CatMD didn't exist on Google Play. As of today it's live in production, in 177 countries, with 14 internal testers running real cats through it daily. Solo dev. Singapore-based. Zero outside funding. Claude Code as pair programmer the whole way.

This is the playbook. Not the marketing version — the actual workflow, the decisions, the things that broke, the things I'd do differently.

If you're an indie founder thinking about shipping an AI product, here's what worked.

---

## What CatMD is, briefly

A first-person cat companion app. Daily AI-generated diary in the cat's voice, chat where you can talk to your cat, postcards for sharing, scan-based vet triage, body language reader (analyses 6-second video clips of your cat), meow translator (audio + frames + memory → cat-voice translation), personality archetype (Feline Five framework), 30-day health rhythm dashboard.

Under the hood: Expo / React Native (SDK 54), Zustand stores with Supabase cloud mirror, Cloudflare Worker proxy to OpenAI, RevenueCat for paywall, PostHog analytics, Sentry for crashes.

About 50k lines of TypeScript across `src/` and `app/`. ~1,000 lines of test fixtures. 47 date-boundary tests + 33 voice-quality and voice-mode tests run pre-ship every round. All green at vc 94.

That's the system. Below is how I got it there.

---

## The setup

**Tools:**
- Claude Code (Sonnet 4.5 then 4.6 as it dropped) — primary pair
- Codex (read-only audits — independent review of Claude's output)
- VS Code + a normal local dev loop
- EAS for builds, Google Play Console for distribution
- Cloudflare Workers for the AI proxy
- Supabase for auth + cloud sync
- PostHog for analytics, Sentry for crash reporting
- No design tool — the entire UI is hand-built tokens (`src/theme/tokens.ts`)

**Working agreement with Claude:**
I treat Claude as a fast, careful, sometimes-overconfident senior engineer who has no memory between sessions and needs everything important re-stated. The combination is good. I bring the product judgment, the user empathy, the calls about what to cut. Claude brings encyclopedic patience for code, infinite willingness to refactor, and the ability to verify a 50-line change in TS + lint + tests in 30 seconds.

The collaboration breaks if you treat it like a tool. It works if you treat it like an employee who needs clear briefs.

---

## The workflow that actually shipped

### Phase 1: scaffold (days 1-3)

Started with `npx create-expo-app`, immediately added the Zustand stores for cat profiles, scan history, daily check-ins. Wrote the world memory + subject directory shape on day 2 before any LLM calls existed. The schema is most of the work — get that wrong and you'll be rewriting prompts forever.

Claude wrote most of the boilerplate. I made architectural calls. Roughly an 80/20 code-to-judgment ratio.

### Phase 2: get one thing working end-to-end (days 4-6)

One feature: scan-based triage. Photo → vision pass → triage reply → urgency badge. End-to-end with real RevenueCat paywall, real Supabase auth, real Cloudflare Worker proxy.

This is where most indie hackers screw up — they build 10 features at 80% and ship none. I built 1 feature at 99% before touching anything else. The discipline pays off because every later feature inherits the working scaffolding (auth, proxy, paywall, telemetry).

### Phase 3: the long middle (days 7-12)

This is where everything happens. Diary, chat, postcards, body language reader, meow translator, personality quiz, photo studio, cat studio (movie-poster generator), world memory, subject directory, daily mood lottery, voice quality gate, the lot.

Claude's role here was *force multiplier*. I would describe a feature ("daily mood lottery, 15 moods, archetype × today × feedback layered weights, deterministic per cat per date"), Claude would implement it across 4-6 files with the right idioms, and I'd review the PR diff. About 20-30 minutes per feature on average.

The key habit: **review the diff before running tests**. If you wait for tests to fail to find the problem, the tests aren't catching what you care about (architecture, naming, idiomatic patterns).

### Phase 4: the audit loop (days 13-14 and ongoing)

This is the secret sauce. After most features were in place, I started running Codex against the codebase in read-only mode, slice by slice — "audit the diary date-boundary logic", "audit the mood lottery wiring", "audit the postcard self-filter for the active cat", etc.

Codex returns structured findings — P1 / P2 / P3 with file paths and line numbers. I feed each finding back to Claude, fix it, run TS + lint + 62 fixture tests, ship to internal testing, repeat.

**Round 1-16 of audit fixes that ended up shipping in production:**
- Diary backfill leaking today's weather into yesterday's mood lottery
- Postcard tagging the active cat as her own visitor
- World memory pulling forward subjects from after the diary's target date
- Recurring subjects window not anchored to target date
- Emergency-tier scans not routing to the dark mood pool
- Voice quality gate retry directive not naming the specific failure
- Self-fact contradiction resolver not catching opposing-sentiment statements
- Live mood overlay (weather/meow/pain/appetite/litter/water/weight) not flowing into the actual voice surfaces (chat/diary/postcard)
- "No water logged today" being read as "drank less than usual"
- 15+ other smaller findings — every one tracked, fixed, tested

Without the audit loop none of this would have caught. With it, I shipped 17 audit rounds before vc 94 hit production. The result is an app that, in 14 days of internal testing across multiple real cats, hit zero crash reports and zero "this feels wrong" feedback on the voice.

---

## What Claude was best at

- **Idiomatic implementation.** Tell it the shape, get back working code in the project's existing conventions (RN/Expo, Zustand, no-class components, hooks-first). I almost never had to ask for refactors after the first round of corrections.
- **Refactoring under time pressure.** Round 15 found that water/weight signals were defined in TodayContext but no callsite was passing them. Claude wrote a shared `computeBodyTrendSignals` helper, wired it into 3 generation paths and the central live-context builder, in one continuous turn. 20 minutes including verification.
- **Test scaffolding.** The 47-test date-boundary fixture suite, the 18-test voice-mode suite — both were Claude's drafts with my edits. Pure-Node, no Jest, runs in 1 second.
- **Audit response.** Codex's findings come in as natural-language paragraphs. Claude reads them, finds the file, makes the edit, runs the verification. I'm essentially routing audit → implementer, while contributing the product judgment about whether to fix or defer.
- **The 80-line file you don't want to write yourself.** All the boring-but-necessary work: voice quality scoring helpers, mood weight tables, date math, schema.org JSON-LD blocks for the website.

## What Claude was *not* good at (or needed careful supervision on)

- **Over-confident first drafts.** First attempt was often "almost right but with one buried assumption that breaks production". I caught these by reviewing the diff every time. Trust but verify.
- **Memory across long sessions.** When the context window fills, summarisation runs, and details get lost. The workaround: explicit `docs/` files for anything important (audit findings, architecture decisions, voice rules). When I need Claude to remember something specific, I point it back at the doc.
- **Cross-file invariants.** Claude is fine at one-file changes; cross-file refactors where 5 callsites all need to update in sync are where I have to be most careful. The audit loop catches the misses.
- **Product judgment.** Should the free tier exist? What's the right trial length? Which voice modes feel right for our users? Claude has good *taste* but no information about the actual users. These calls have to be mine.
- **Knowing when to stop.** Left unsupervised, Claude will polish indefinitely. I had to explicitly call "stop, this is shippable" multiple times when it was about to refactor something good.

---

## The specific patterns that paid off

### Pattern 1: tests first for date math

Date / timezone / boundary logic is where AI assistance bites you hardest. The model writes plausible-looking date code and then you find out at 11:59pm local that backfilling yesterday's diary is computing against today's wall clock.

I wrote `scripts/test-diary-date-boundaries.mjs` early. 47 fixture cases covering: birthday detection at year boundary, weekday matching across DST, vibe inclusion in past backfill, subject appearance counts using only on-or-before-target events, scenes-by-cat date anchoring, recurring subjects window. All pure-Node, no app dependencies, runs in 800ms.

Every round of audit, I run these tests before claiming a fix shipped. They've caught regressions 4 times.

### Pattern 2: typed analytics events

`src/services/analytics.ts` defines a single `AnalyticsEvent` discriminated union with ~100 entries. Every event the app fires goes through `track(event: AnalyticsEvent)`. The compiler enforces:
- No typos in event names (`scan_submited` → compile error)
- No missing required props (`postcard_shared` without surface field → compile error)
- No invalid enum values (urgency must be one of four strings, not just any string)

Three months from now when I'm debugging "why is conversion zero", I will be very glad the events are typed.

### Pattern 3: deterministic gates after non-deterministic generators

The voice quality gate. Same pattern applies everywhere: LLM generates → deterministic evaluator scores → ship or retry. Don't rely on the model to self-correct. Build a gate.

This is the single highest-ROI engineering decision in the codebase.

### Pattern 4: lazy imports and stores accessed via `getState()`

React Native + Zustand + service modules creates circular-import potential. The pattern that works:
- Stores expose `useStore.getState()` for reads from non-component code
- Service modules avoid top-of-file store imports where possible — use lazy `require` or dynamic `import('./store')` inside functions
- TypeScript-only imports (`import type {...}`) never trigger runtime cycles

About 5 hours of debugging-circular-import time saved by adopting this from day 1.

### Pattern 5: weekly write-up to clear my own head

Every Sunday I dump 2,000 words into a `docs/SESSION-CHECKPOINT-YYYY-MM-DD.md` file describing what shipped, what's broken, what I'm worried about. Claude reads these on the next session and we resume context fast.

Without these docs, week 2 productivity would have dropped 40% just from re-explaining context. With them, every Monday morning is "OK here's where we are, here's the next thing."

---

## What I'd do differently

- **Start the audit loop on day 1, not day 10.** I would have caught half the date-boundary bugs three days earlier.
- **Build the voice quality gate before the LLM features that need it.** I had to retrofit the gate after the first round of slop output. Cheaper to build it first.
- **Treat the marketing site as a real codebase.** I kept editing `proxy/landing.ts` ad hoc and had two stale "beta" references survive 4 rounds of fixes. Should have run the same audit discipline against it.
- **Write tests for prompts, not just for code.** I have 33 voice-quality tests but the actual prompts are mostly hand-tuned without regression coverage. A "given this fixture context, the system prompt should contain X" test suite would have saved me from a few accidental prompt regressions.

---

## The honest cost picture

- **Time:** 14 days from `create-expo-app` to Google Play production. About 8-10 hours/day. Solo. I have other work; this was full focus.
- **Money:** ~$200 USD in OpenAI / Anthropic API spend during development. Zero on infrastructure (Cloudflare Workers free tier covers the AI proxy, Supabase free tier covers auth). EAS build credits are free for the first ~30 builds/month; I exceeded that and paid ~$10 in overages.
- **Claude usage:** roughly the equivalent of 200+ hours of Claude Code conversations. Most sessions 30-90 minutes. Many concurrent during refactors. The audit loop alone is probably 50 hours of Claude time across 16 rounds.

The cost is laughable. The barrier to building production AI apps as a solo founder has collapsed.

---

## What's next

- Open testing → production rollout this week
- iOS in ~2 months pending Apple review + Android retention proof
- A blog series like this one for SEO + community building. The slop manifesto is up first.
- More audit rounds. Always more audit rounds.

If you're building an AI product solo and want to compare notes, find me on X (links on [catmd.pet](https://catmd.pet)). Always happy to swap notes on what's working.

CatMD is live on Google Play: **[play.google.com/store/apps/details?id=com.catmd.app](https://play.google.com/store/apps/details?id=com.catmd.app)**. 14-day free trial, no card required.

---

*If you work on Claude Code at Anthropic and this kind of solo-founder case study is interesting to you, get in touch. I'd be happy to do a longer write-up of the audit-driven dev workflow.*
