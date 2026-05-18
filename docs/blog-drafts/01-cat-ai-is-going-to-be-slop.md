# Cat AI is going to be slop. Here's how we tried not to be.

**Slug:** `cat-ai-is-going-to-be-slop`
**Audience:** HN, AI newsletters (TLDR AI, Ben's Bites, The Rundown), AI engineering Twitter
**Estimated length:** ~2,100 words
**Primary keyword:** AI cat app
**Secondary:** cat companion AI, voice quality gate, daily mood lottery

---

There are about to be a lot of cat AI apps. Most of them are going to be slop.

I know this because I've been building one for six months, and the first version I shipped was slop. I shipped it, looked at the diary entries, and felt the specific embarrassment of recognising your own product as the same generic "your furry friend had a purr-fect day!" texture I see in every other pet AI demo on Twitter.

So I rebuilt it. Not the app — the *voice*. The architecture under the cat's words. This post is about what's underneath, because I think the next wave of cat AI (and pet AI generally, and probably a lot of "AI companion" products) is going to be downstream of the same problems and the same solutions.

Skip this if you don't care about AI craft. Read on if you've ever wondered why most LLM creative output feels the same regardless of which product wraps it.

---

## What slop looks like

Run a generic GPT-4 with the prompt *"You are a cat named Lily. Write a one-sentence diary entry for today."* — you get something like this:

> *"Today was a wonderful day filled with cozy naps and playful moments with my favorite human!"*

There is nothing factually wrong with this sentence. It is also unusable. A cat would not write it. Nobody would screenshot it. Nobody would share it. It carries the texture of generic warmth — the same texture every AI assistant settles into when asked to be cheerful about anything.

Now look at what we want:

> *"My kibble. Is. The wrong shape."*

Or:

> *"I had a plan. The plant was the target. The bowl, a distraction. It held."*

Or:

> *"You've been quiet today. I noticed. I always notice."*

Same model. Same input data. Wildly different output because of what we put around the prompt.

The architecture of *not slop* is the whole thing. Here's what's in it.

---

## Layer 1: a 15-mood daily lottery

Most AI products give the model a single voice — a personality string baked into the system prompt that never changes. The user opens the app on Tuesday and gets the same flavour as Monday and Wednesday.

We took the opposite approach, borrowed from Co-Star (the horoscope app that built a cult on daily anticipation): **the cat wakes up in a different mood every day**. Fifteen possible moods, deterministically picked per-cat-per-date, ranging across five clusters:

- **Warm:** affectionate, cozy, chosen, attuned
- **Joy:** playful, mischievous, curious
- **Flavor:** theatrical, philosophical
- **Sass:** sarcastic, roasting, imperious
- **Dark:** grumpy, indignant, megalomania

Same cat. Multiplied range. Same Velcro-Cat archetype reads completely differently when she wakes up imperious (*"This is my house. I let you live here."*) versus when she wakes up chosen (*"I chose the chair near you. The chair chose me back."*).

The lottery is a weighted random with four layered modifiers:

```
effective_weight = base × archMod × todayMod × feedbackMod^1.5
```

Each modifier captures a different time horizon:

- **base:** the mood's natural frequency (cozy weighs 4, megalomania weighs 2)
- **archMod:** the cat's personality (Velcro-Cat boosts warm moods 1.7×, suppresses imperious to 0.4×)
- **todayMod:** today's actual signals — body language tags from the last Read Cat session, meow translations, weather, weight trend, water intake, pain score, today's check-in mood. A thunderstorm pulls toward attuned; an off-day check-in pulls toward dark
- **feedbackMod:** which moods THIS user has historically shared. Raised to the 1.5th power so user preference dominates archetype after enough data — if you've shared 4× more on Cozy days than baseline, Cozy gets ~3-4× more lottery weight going forward

The exponent matters. Without it, archetype dominates forever and the app feels static. With it, user behaviour bends the cat over weeks toward the moods that user actually loves.

A 7-day cold-start gate prevents one share on day 1 from pinning the lottery to a single mood. Until each mood has been exposed at least five times, the feedback term stays neutral.

---

## Layer 2: pop-culture voice modes

Here's where it gets interesting.

There's an HCI paper from last year — *AI Cat Narrator* by Lai, Huang, and Liang (arXiv 2406.06192). They built an AI tool that writes cat-perspective narratives and discovered something useful: **factual-only training produces mundane voice**. Their fix was a technique called *defamiliarization* — blending real cat-ethnographic data with literary fiction (specifically Natsume's *I am a Cat*, a 1906 Japanese novel narrated by a cat).

Their finding held: the literary-blended version produced more empathetic, more individualised cat voice. Their training source — a 1906 novel — does not.

Our users are watching Bridgerton. They're posting Phoebe Bridgers lyrics on Instagram. They're quoting Drag Race confessionals in group chats. They are *not* reading 119-year-old Japanese fiction.

So we took the insight and changed the references. Fifteen voice modes, one per mood, each described in generic stylistic terms (we don't name celebrities or shows in the prompt — likeness risk, brittle to cultural rotation):

| Mood | Voice mode | Shape |
|---|---|---|
| affectionate | earnest small-revelation | *"I waited. I would have waited longer."* |
| chosen | quiet affirming, gratitude-journal cadence | *"I chose the chair near you. The chair chose me back."* |
| cozy | deadpan symmetrical observation | *"Today I sat in three places. The second was best."* |
| playful | chaotic-internet exclamation | *"EXCUSE ME?? the AUDACITY of this paper bag. I cannot."* |
| mischievous | heist-voiceover plotting | *"I had a plan. The plant was the target. The bowl, a distraction. It held."* |
| curious | anxious-meta-observer | *"Is the bird watching me back? Statistically, probably."* |
| theatrical | period-drama society-narrator | *"Dearest. You will NEVER guess what arrived in the bowl."* |
| philosophical | sad-singer-songwriter wistful | *"I knocked the cup over. Watched it. Felt everything. Felt nothing."* |
| attuned | direct-address vulnerable | *"You've been quiet today. I noticed. I always notice."* |
| sarcastic | petty-grievance escalator | *"My water dish has been moved. Six inches. SIX."* |
| roasting | mock-pitying confessional read | *"Listen. The dog. Tried it. Did. Not. Serve."* |
| imperious | tired-domestic-patriarch | *"This is my house. I let you live here."* |
| grumpy | sitcom-grump | *"My kibble. Is. The wrong shape."* |
| indignant | reality-TV-confessional outrage | *"I have never been so DISRESPECTED in my entire life."* |
| megalomania | corporate-villain monologue | *"You are not serious people. Bring me the bird."* |

These are calibration shapes, not templates. The model sees the descriptor and the example shape, and writes its own variant grounded in the cat's actual world. The voice mode tilts cadence and attitude. Grounding (which objects can appear, who the cat knows) is enforced separately.

A cozy Tuesday with a Wes-Anderson-deadpan voice mode lands like:

> *"I sat in four places today. The window was second. The sofa came third. The laptop, fourth — warm but resentful."*

A grumpy Wednesday in sitcom-grump mode lands like:

> *"You moved my water dish. Again. Six inches, this time. I noticed within a minute."*

Same cat. Different day. Recognisably the same animal.

---

## Layer 3: the voice quality gate

Even with mood + voice mode dialled in, LLM output is non-deterministic. Roughly 5-15% of generations slip into slop — saccharine pet-app cliché, assistant-register apology, invented named entities (the model decides the cat has a friend named "Mr. Mittens" who doesn't exist), or output too long to fit a postcard.

So we built a post-generation gate. Pure function, no AI calls, deterministic. It runs on every chat reply, every diary share-line, every postcard caption.

The gate is a 4-tier flow:

```
1. evaluate → numeric score + failure reasons
2. if ok → ship
3. if not ok → retry with directive injection (one shot, LLM call)
4. if retry recovered → ship
5. if retry still fails → mechanical repair (truncate, strip cliché)
6. if mechanical repair scores ok → ship
7. else → safe neutral fallback (one of N hand-written lines)
```

Scoring is heuristic. The current version (it'll keep evolving) has:

**Negative signals** (subtract):
- Banned phrases — "your furry friend", "purrfect", "fluff ball", "I'm here for you", "as an AI", "I recommend", "consult your vet" (medical-advice register is forbidden in cat voice)
- Generic praise — "today was wonderful", "best human ever", "love you to the moon"
- Unsupported named entity — capitalised words that aren't in the cat's known subjects + a small allowlist (days, months, "I")
- Assistant voice patterns
- Length overflow per surface (postcard 12 words, diary 18, chat 45)

**Positive signals** (add):
- Concrete anchor — a known object from YOUR WORLD, a body part, a time-of-day, a weather reference
- First-person cat POV (uses I/my/me; doesn't start with narrator-pattern "the cat sat")
- Flavor — decisive verbs ("decided", "allowed", "permitted"), cat-evaluative qualifiers ("adequate", "insufficient"), temporal precision ("again", "still")
- Standalone quotability — doesn't start with dependent clauses ("yes", "but", "it")

Each surface has its own threshold. Postcard needs the highest score; chat in medical context softens the bar — a clear, careful triage reply beats a quotable one.

We ship analytics on every gate event:
- `voice_quality_eval` — pass rate per surface
- `voice_quality_retried` — recovery rate when retry kicks in
- `voice_quality_fallback` — how often we hit mechanical / safe-neutral

The retry directive is generated from the specific failures. If the model used a banned phrase, the retry prompt names it: *"Your previous reply used 'furry friend'. Forbidden. Try again — keep the warmth but use a specific anchor instead."* If the output was too long, the directive is *"Previous reply was 18 words. Postcards cap at 12. Compress without losing the punchline."*

Retries succeed about 70-80% of the time in our internal testing. The remaining cases fall through to mechanical repair (which strips known-bad phrases without inventing replacements) or the safe neutral pool (a small set of hand-written lines that always score above threshold). The cat never goes silent.

---

## Layer 4: grounding (YOUR WORLD)

The cat can't reference things that aren't real. Most LLM cat outputs hallucinate household objects — they reach for "the radiator", "sunbeams", "Mr. Mittens" — because the training data is full of generic cat content set in northern-temperate homes with imaginary friends.

Our prompts enforce a separate context block: **YOUR WORLD** — a list of objects, places, toys, weather, and known people/pets that this specific cat has actually been around. Built up over time from:

- Photos analysed by a silent vision pass that extracts objects ("teapot", "rug", "balcony", "window") and recurring places
- Body-language reads tagged with detected props
- Explicit user mentions in chat ("Lily knocked over the kettle today") via marker extraction
- Weather snapshots (opt-in location → Open-Meteo)
- Known subjects from the subject directory (people, pets, named visitors)

Every prompt that generates voice includes YOUR WORLD as a literal list, with the directive: *"When you reference a physical object in your reply, it MUST come from YOUR WORLD. If YOUR WORLD lacks a suitable object, omit the prop and lean on time-of-day / human-posture / abstract reference instead."*

The voice quality gate enforces this from the output side: capitalised proper-noun candidates not in the cat's `knownSubjects + catName` allowlist hard-fail. The cat literally cannot invent a "Mr. Mittens" without it getting caught.

Same with weather. If the cat is in Singapore on a 32°C day, the system never mentions "the radiator" or "sunbeams" by default — because those are climate-specific props that don't exist in YOUR WORLD. The prompts call this out explicitly.

This is the single biggest difference between our voice and generic LLM cat voice. The cat sounds *real* because it can't talk about things that aren't.

---

## Layer 5: the audit loop

The voice quality gate, the mood lottery, the voice modes, the grounding — none of this happened in a planning doc. It happened across 16 rounds of audit, every round driven by a third-party AI reviewer (Codex) and verified by 62 fixture tests before each ship.

The audit cadence looks like:

1. Codex does a read-only pass over a specific slice (mood architecture / date-boundary / voice quality / etc.)
2. Returns P1/P2/P3 findings with file paths and line numbers
3. I fix each finding, with a code comment citing the audit round
4. Run TypeScript compile, ESLint, 47 date-boundary fixture tests, 33 voice quality + voice mode tests
5. All green → ship to internal testing
6. Re-audit. Repeat.

Findings from rounds 1-17 that ended up in production:
- Diary backfill date contamination (writing yesterday's entry was leaking today's weather into the mood)
- Postcard subject memory not filtering the active cat (the cat was being tagged as her own visitor)
- Water "low" inference firing on zero-log days (no log ≠ drank less; we now require ≥1 log to call direction)
- Weight trend signal not wired to the mood lottery (existed in the type but no callsite passed it)
- Emergency-tier scan not routing to dark mood pool (chat could be playful on a medically grave day)
- Recurring subjects pulling forward from after the diary's target date (Mom tagged on May 10 was showing up in the May 5 backfill)

This loop is the actual moat. Not the architecture — the relentlessness. Anyone can read this post and copy the patterns. Few will run 16 audit rounds against their own code before launch.

---

## What we measure

The four-layer mood lottery would be a hypothesis without measurement. Every voice mode firing carries an analytics tag — `petty_grievance`, `wes_anderson_deadpan`, `period_drama_narrator`, etc. — that joins to the share funnel:

- `mood_exposed` — fires the first time a mood lands today (deduped per-cat-per-day)
- `chat_session_in_mood` — chat opened during this mood
- `daily_card_shared` — the strongest signal. User screenshotted / shared a card / postcard from this mood

PostHog formulas across this give us per-mode share rate per cat. We watch which voice modes drive the most shares per exposure and feed that back into the lottery weights via the user-feedback layer. The cat genuinely bends, over weeks, toward the voice the owner most loves.

Same for the voice quality gate — we watch `voice_quality_retried` (recovery rate when the first generation fails) and `voice_quality_fallback` (how often we hit mechanical repair). Both numbers are visible on a dashboard. Both should be going DOWN over time as the prompts improve.

---

## What I think actually matters

If you take one thing from this post: **post-generation gates beat better prompts.** Engineers spend a lot of time perfecting their system prompt; that work has sharp diminishing returns. The single biggest quality lift we got was building a deterministic, testable gate that runs AFTER the LLM, evaluates output against a clear rubric, and either ships or retries.

Prompts are non-deterministic. Gates are. You should not ship LLM creative output to production without a gate.

The second thing: **architectural layering > monolithic prompt**. Mood, voice mode, archetype, today's signals, YOUR WORLD, grounding rules — each lives in its own module with its own tests. The full prompt at runtime is composed from 8+ structured inputs. Most people stuff everything into one growing system prompt that becomes unmaintainable around prompt token 4,000.

The third thing: **measure the right thing**. Share rate per voice mode per cat is the metric that closes the loop. Token usage is not. CSAT is not. Anything you can't tie back to "did this specific generation produce a screenshotable moment" is noise.

The fourth thing: **citations matter even in indie product work**. The mood lottery is downstream of Co-Star. The voice modes are downstream of Lai/Huang/Liang. The voice quality gate is downstream of a dozen smaller observations I'd be happy to credit if I could remember the threads. Naming the prior art keeps you honest about what's novel and what isn't.

---

## Try it

CatMD is live on Google Play: **[play.google.com/store/apps/details?id=com.catmd.app](https://play.google.com/store/apps/details?id=com.catmd.app)**. 14-day free trial, full Pro access, no card on file.

Built solo with Claude Code as pair programmer, in Singapore, over fourteen days. Source for posts like this one lives on [catmd.pet/blog](https://catmd.pet/blog).

The cat in your life is one of one. The AI that talks for her shouldn't sound generic.
