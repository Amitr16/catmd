# From Natsume to Bridgerton: how an HCI paper changed our cat AI

**Slug:** `from-natsume-to-bridgerton`
**Audience:** HCI Twitter, academic / research-curious readers, design-leaning engineers, the paper authors themselves
**Estimated length:** ~1,400 words
**Primary keyword:** AI cat narrator HCI
**Secondary:** defamiliarization in AI, pop culture voice modes, applied HCI research

---

Last week I was deep in a stack of generic LLM cat replies — *"today was a wonderful day filled with purrs!"* — trying to figure out why every cat AI on the market sounds like the same Hallmark card. I came across a paper that ended up being one of the most directly applicable pieces of research I've ever ported into a product.

**Lai, Huang, Liang. *AI Cat Narrator: Designing an AI Tool for Exploring the Shared World and Social Connection with a Cat*. arXiv 2406.06192 (2024).**

This post is for them, and for anyone who builds creative AI products. Their insight was real. Their reference set was wrong for our users. The translation between the two is where the interesting work happened.

---

## What they found

The paper introduces a tool called the *AI Cat Narrator* — an LLM-based system that generates first-person cat-perspective narratives from ethnographic data (camera footage of a cat's daily life, owner interviews, observed behavioural traits).

Their core technique is *defamiliarization* — a deliberately ambiguous, evocative register adapted from literary fiction. They built two versions of the narrator: one trained purely on factual ethnographic data, and one trained on the factual data **plus excerpts from Natsume Sōseki's 1906 novel *I am a Cat*** (一吾輩は猫である), a novel famously narrated by a cat observing Meiji-era Japan.

The factual-only version produced "mundane narratives that stick to reality and lack engaging personalized storytelling."

The factual+fictional version produced narratives "with deeper emotional resonance" that "more effectively capture and express the unique personalities of cats."

That's the headline. And it tracks with everything I've seen building creative LLM features: pure factual grounding produces flat output. You need a stylistic reference to anchor the voice in something with personality.

The mechanism they propose — *defamiliarization* — is the practice of presenting familiar material in unfamiliar ways. In the cat-narrative context, it means: a cat doesn't describe its own day the way a human would describe a cat's day. The framing should be strange enough to invite re-reading.

I think this is right. Their applied result — using Natsume — is also right in a research-paper context. It would not have landed for our actual users.

---

## Why Natsume doesn't ship

CatMD's user base is — based on the early demographic data — predominantly female, millennial / Gen-X, urban, smartphone-native, terminally online. They watch Bridgerton. They post Phoebe Bridgers lyrics on Instagram. They quote Drag Race confessionals in group chats. They consume an enormous amount of contemporary culture per day and they have ruthless attention budgets.

If our cat AI dropped a 1906 Japanese-literary register into the daily diary entry, the typical user would not recognise the reference, would not be flattered by it, and would scroll past. The defamiliarization would land as confusion, not as wonder.

The literary reference is doing a real job in the paper. But the job is *recognisable distinct voice* — not *that specific voice*. The same defamiliarization function could be served by any voice the audience instantly recognises as having its own personality. For our audience, that's pop culture, not literary fiction.

So I sat down and tried to enumerate the cat-narrator voices our actual users would recognise instantly. Here's what made the list:

| Cultural register | What it sounds like | Mood it fits |
|---|---|---|
| Wes Anderson deadpan | symmetrical, listed, gently melancholy | cozy |
| Bridgerton period-drama society narrator | formal direct address, faux-scandalised | theatrical |
| Phoebe Bridgers / sad-girl singer-songwriter | wistful, observed-then-felt, ironic on melancholy | philosophical |
| Stan Twitter chaos | clipped phrases, ALL-CAPS bursts, mock outrage | playful |
| Heist movie voiceover (Ocean's 11) | conspiratorial, plotting, tactical clauses | mischievous |
| Anxious-millennial meta-observer (Bo Burnham) | questions chained, statistical hedging | curious |
| Fleabag direct-address vulnerability | second person, says the unsaid thing | attuned |
| Larry David / Seinfeld grump | minor injustice = major crisis | grumpy |
| Drag Race confessional read | mock-pitying, "did NOT serve" cadence | roasting |
| Real Housewives confessional outrage | extreme adjectives for mundane slights | indignant |
| Wellness influencer affirmation | gratitude-journal cadence, ceremonial small choices | chosen |
| Corporate-villain monologue | slow deliberate cadence, references to "plans" | megalomania |
| Tired-domestic-patriarch (Tony Soprano at home) | weary edicts, household as fiefdom | imperious |
| Sitcom-grump punctuated complaint | single-word sentences for emphasis | sarcastic |
| Pixar-narrator earnest tenderness | sincere, no irony, restraint as warmth | affectionate |

Fifteen registers. One per daily mood in our existing mood lottery (15 moods chosen for unrelated product reasons — coincidentally a clean 1:1 mapping fell out).

---

## The legal-safety pivot

Naming Phoebe Bridgers or Drag Race in a system prompt is a problem. Three reasons:

1. **Likeness / right-of-publicity risk** — telling an LLM to write "in the style of Phoebe Bridgers" could plausibly violate her right of publicity in some jurisdictions, even if the output is original. There's no settled case law and indie founders shouldn't be the test case.

2. **Cultural rotation** — Phoebe Bridgers is a 2020-2024 reference. Bridgerton is a 2020-2025 reference. If we leave the prompts that way and re-read in 2030, both might be ancient references — but the descriptors like "sad-girl singer-songwriter" and "period-drama society narrator" will still parse. We want registers that survive.

3. **Over-imitation** — when you tell an LLM to write "like X", it tries to recall X's actual catchphrases and known lines. We don't want the cat saying lines from Bridgerton dialogue. We want the cat saying its own things, in the *shape* of that register.

So every voice mode descriptor in the codebase is a generic stylistic pattern. The system prompt sees this:

```
## Voice mode

Period-drama society-narrator register — formal direct address
("dearest" / "well now"), faux-scandalised exclamation, gossipy
gravitas about household trivia. ONE capitalised word per reply
for emphasis. Refer to the human as "you" — never "human" /
"reader" / "dear one". Never break the formality.

Shape example (calibrate the RHYTHM and ATTITUDE, do NOT copy
the words): "Dearest. You will NEVER guess what arrived in
the bowl."
```

No Bridgerton. No Lady Whistledown. Just the *shape* of the voice. The model writes its own variant in that shape, grounded in the cat's actual world. Output looks like:

> *"Dearest. You will NEVER guess what I noticed at the window this afternoon. The dust. Has been TRESPASSING."*

The Bridgerton reader recognises the cadence. The non-Bridgerton reader still gets a distinct, theatrically-formal cat voice. Neither one is reading dialogue from the show.

---

## What I think Lai, Huang, and Liang got most right

The deepest insight in their paper isn't the *I am a Cat* reference. It's the framing that **the cat's voice has to come from somewhere distinct**. Otherwise it defaults to the mean of the training data — which, for LLMs, is a register I would describe as "well-meaning corporate cheerfulness."

You need a stylistic anchor. Their anchor was literary. Ours is contemporary. Either one closes the loop, as long as the anchor is recognisably individual.

I'd also flag a point they make in passing that ended up being central to our voice quality gate: **first-person POV reveals interaction details that third-person POV misses.** A third-person narrator describes a cat. A first-person cat describes the *texture* of being a cat. The latter is harder for LLMs to do well, which is exactly why it produces more individual-feeling output when you DO get it right.

This is the reason chat replies in CatMD are first-person ("My kibble. Is. The wrong shape.") rather than diary-style narration. The first-person constraint forces the model out of generic narrator voice into a specific embodied register.

---

## What I'd ask if I could ask them

Three questions for the authors, if any of you read this:

1. **Did you test domain transfer?** Did you try the *I am a Cat* version on subjects who hadn't read the novel — vs subjects who had — and measure whether the literary reference itself was doing work, or whether ANY distinct stylistic anchor would have produced the same lift?

2. **Hallucination guardrails?** Your factual+fictional version sounds harder to ground in real cat data — the fictional layer encourages "openness and unpredictability" which is great for individuation but dangerous for product safety. We solved this with a deterministic output gate that hard-fails on invented household objects or named entities. Did your tool have anything similar, or did you trust the model + ethnographic prompt to stay grounded?

3. **Mood / time-of-day stratification?** Your AI Cat Narrator was a single voice. Did you experiment with multiple voice-modes per cat — different registers for different days, moods, or contexts — and did that improve or hurt the "individualisation" your evaluators felt?

I'd genuinely love to talk about any of this. I'm Singapore-based, ship as a solo founder, and the indie / academic gap on AI-companion design is huge — most of the good ideas in this space are sitting in HCI papers nobody outside the field reads.

---

## What this means for AI product teams

If you're building a creative AI product (cat AI, character chat, AI letters, AI horoscopes, anything that needs to *sound* like something), I think the actionable takeaway from this paper is:

1. **Identify your voice deficit first.** Generate a hundred outputs with your current system prompt. Read them. If they feel generic, the deficit is in your stylistic anchor, not in your factual grounding.
2. **Pick a recognisable register, not a literal style.** Your users have a media diet. Your voice anchors should live inside it.
3. **Describe the shape, not the source.** Never name the celebrity or show in the prompt. Describe the cadence, attitude, sentence patterns. This is legally safer and works better.
4. **One register per context.** If you only have one voice mode active across all situations, you have a personality. If you have one voice mode per mood / context / time-of-day, you have a *character* — and the variation is itself a product feature.
5. **Gate the output.** Stylistic anchors increase the variance of LLM output. Some of that variance is good (the deeper resonance the paper describes); some is bad (off-register, hallucinated, slop). A deterministic post-generation evaluator catches the bad cases without limiting the good ones.

---

## Credits

The 15-voice-mode system in CatMD is a direct descendant of the AI Cat Narrator paper's defamiliarization technique. If their work isn't on your radar and you build creative LLM features, read it.

CatMD is live on Google Play: **[play.google.com/store/apps/details?id=com.catmd.app](https://play.google.com/store/apps/details?id=com.catmd.app)**. Built solo, Singapore. More on the architecture at [catmd.pet/blog](https://catmd.pet/blog).
