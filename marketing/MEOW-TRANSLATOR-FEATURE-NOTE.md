# Feature note — Meow Translator (the MeowTalk-killer)

> **For marketing.** Shipped 2026-05-10 (build 0.1.18, version code 82).
> File this in the agent's knowledge base alongside `WHAT-CATMD-DOES.md`.
> If anything below contradicts older copy, this note is canonical.

---

## The 30-second pitch

CatMD now has a **Meow Translator** that turns 4 seconds of your cat
into one screenshot-worthy line *in your cat's voice*.

You hold up the phone. Your cat meows. CatMD listens to the voice,
watches the body language, and pulls in everything it already knows
about your cat — name, archetype, what happened today, what your cat
ate yesterday — and spits out one line. Not a label. A line.

> Lily says: *"fine. you may sit on the floor near me. don't talk."*

That's a translation Lily's owner can screenshot and send to a friend.
That's the entire feature.

---

## The competitor we're killing

**MeowTalk** is the incumbent. 10 million+ downloads. Audio-only. They
record a meow, run it through a classifier, and print one of 13
generic labels: "Happy/Content", "Hunting", "Mating Call", "Resting",
etc. Their conversion to paid is **0.125%** — terrible — because
those labels die the moment you show them to a friend. Nobody
screenshots "Happy/Content". There's nothing to share.

Where MeowTalk is weak:
- Audio-only (no body language, no context, no memory of the cat)
- Generic labels, identical for every cat in every household
- No personalisation (Lily and your friend's Mochi get the same output)
- No persistence beyond a flat list of past audio clips

CatMD's translator wins on all four axes. **Use this comparison hard
in copy. It's our cleanest "Apple beats Nokia" story.**

---

## The three things to lean on in copy

### 1. MULTIMODAL — voice + body + memory

CatMD captures four seconds of *video* (sound AND motion). The AI
sees:
- **Audio**: the meow / trill / purr / hiss / chatter (Whisper
  transcription so the model "hears" the actual sound)
- **Body language**: posture, ears, tail position, pupil dilation,
  motion across the four-second clip
- **Cat memory**: name, archetype (from the personality quiz), recent
  events (today's mood, the scan from three days ago, what the cat
  ate, the toys it knows about)

Then one AI call fuses all three into the output. MeowTalk only has
the first input.

**Marketing implication**: this is why our line is in the cat's
voice. We HAVE the cat's voice — they don't.

### 2. PERSONALISED — your cat, not "a cat"

The output uses:
- Your cat's **name** ("Lily says")
- Your cat's **archetype** (Skittish-Sensitive vs Velcro-Cat vs
  Hunter-Athlete vs Cool-Observer vs Confident-Communicator — five
  voices, calibrated tone-by-tone in the AI prompt)
- Your cat's **pronouns** (he / she / they — never wrong, the prompt
  enforces it)
- Real recent events ("eye stopped itching" if a recent triage
  flagged the eye; "tuna for dinner yesterday" if that's in the log)

A Velcro-Cat says: *"i'm purring but i'm not okay. eye still hurts.
stay close."*

A Cool-Observer in the same physical state says: *"yes. i hear the
thing. it's beneath my dignity to react."*

Same body language, same audio. Different cats. Different lines.
This is why MeowTalk can't copy it without rebuilding their entire
data layer.

### 3. SCREENSHOT-WORTHY — the line IS the marketing

Every translation is **40 to 160 characters**, in italic-serif type
on the result screen, with a Share button right under it. The whole
UX is calibrated for "open phone, capture, screenshot, send."

The content itself follows three rules baked into the AI prompt:
- Specific (uses the cat's name, references real recent context)
- In the cat's voice (first-person, present tense)
- One line, ends with a period

We tested generic outputs ("Hi, I'm hungry"). They scored as
unsharable. So the prompt has a hard rule against them: if the line
could plausibly be applied to any cat, it's wrong.

---

## What the 10 vocalisation types are

The AI classifies into one of 10 types (anchored on the CatMeows
dataset, the Pandeya 2018 paper, and the Ludovico 2020 research):

`meow`, `trill`, `chirp`, `purr`, `hiss`, `growl`, `yowl`,
`chatter`, `silent` (no audio — body-only read), `other`.

And one of 10 intents:

`greeting`, `demand_food`, `demand_attention`, `annoyed`, `playful`,
`comfort_seeking`, `warning`, `distress`, `curious`, `self_soothing`.

**Don't lead with this in copy.** It's research-backing, not a
selling point. But it's there if you need to defend "is this real
science or hand-waving?"

---

## What the 5 archetypes sound like (use for ad demos)

| Archetype             | Sample line                                              |
|-----------------------|----------------------------------------------------------|
| Confident-Communicator| *"the bowl. you remember the bowl. the bowl is empty."* |
| Hunter-Athlete        | *"the bird. THE bird. it's right there. let me out."*    |
| Skittish-Sensitive    | *"okay. you may sit on the floor near me. don't talk."*  |
| Velcro-Cat            | *"i missed you. the chair held the shape of you. lap."*  |
| Cool-Observer         | *"adequate. proceed."*                                   |

Pair these with stock cat poses for static ads. The contrast between
two archetypes saying something completely different to the same
posture is the cleanest 9-second TikTok we have.

---

## Where the feature lives in the app

### Primary surface: Today tab → "Meow Translator" tile (re-placed 2026-05-11)

The tile sits in the "Know your cat" section on the Today tab,
alongside the Body Language reader. Both are "do something with your
cat right now" actions — pairing them makes the Today tab the
unambiguous home for quick AI reads.

> "Record 4 sec → one line in {Cat}'s actual voice."

### Capture flow: `/translate`

- Mode picker: Record now (camera) / Upload (gallery)
- Live capture: 4-second video with countdown, mic permission asked
  if not granted
- Upload: short clips (≤7s) go straight to translation; longer clips
  show an 8-thumbnail trim picker so the user picks WHICH 4 seconds
  to translate
- **No-meow gate**: if the clip is silent (mic was denied / cat
  didn't vocalise / audio fails Whisper), the screen surfaces a
  dedicated "We didn't hear a meow" stage with a route to the Body
  Language reader. The translator never produces a "silent body-only"
  output — credibility move, the product contract is "you record a
  meow, we interpret the meow"
- Result screen: italic-serif line, "Share {Cat}'s line" primary
  button, "Translate another" secondary, "See past translations"
  link below

### History: `/translate-history`

Chronological log of every translation. Each row is the line itself
+ date/time + voca·intent pills. Tap any row → expanded view with
the AI's reasoning, the audio transcript ("we heard 'mrr-rrp'"),
and a per-row Share button so re-sharing an old line is one tap.

Mirrors the existing Body Language history page in shape.

### Greatest Hits: `/cat-says`

Translations now MERGE INTO the existing "Things {Cat} Said" scroll
(which previously was chat replies only). Each translation is
tagged with a small "translated meow" / "translated purr" badge so
the user can tell the source. **Distress translations are filtered
out** — they're earnest, not screenshottable.

### Catch: chat + diary stay consistent

Behind the scenes, the last 3 translations feed into the AI's
context for chat and diary. This means: if the cat has been grumpy
in 3 recent translations, the diary tonight reads grumpy too. The
cat's voice is consistent across surfaces. **Copy implication: "the
voice you hear in the translator is the same voice the cat keeps
in chat — they're the same cat, not two separate features."**

---

## Pricing / paywall posture (current)

- **5 translations per cat per day** on free tier
- No paywall yet. The feature is a free funnel for now — the
  conversion event we're tracking is the **share**, not subscribe
- Paywall arrives later (likely 14 days post-launch); the current
  goal is share-rate measurement

If asked about pricing, say: *"free for now, generous daily
allowance, paywall coming as we measure usage."*

---

## What NOT to claim

- Don't say "scientifically accurate" — we're using a multimodal LLM,
  not a peer-reviewed classifier. Output is interpretive.
- Don't say "decodes what cats are saying" without the qualifier —
  use "translates" or "interprets". Cats meow at humans
  manipulatively (this is real cat-comm research) so "translates"
  is fair; "decodes" implies a lossless cipher we haven't earned.
- Don't promise distress detection. The AI does flag distress
  (intent: 'distress') and the result screen routes those toward
  triage scan, but we make NO clinical claims. Always pair with the
  "behavioural observation, not diagnosis" disclaimer if pushed.
- Don't position this as primarily a health feature. It's a **bond /
  share** feature. The triage tie-in is a secondary safety net, not
  the headline.

---

## Honest comparison sheet (use as ad B-roll text)

| Capability                     | MeowTalk           | CatMD Meow Translator |
|--------------------------------|--------------------|----------------------|
| Audio capture                  | ✅                 | ✅                   |
| Body language input            | ❌                 | ✅                   |
| Knows your cat's name          | ❌                 | ✅                   |
| Knows your cat's archetype     | ❌                 | ✅                   |
| References recent events       | ❌                 | ✅                   |
| Output in your cat's voice     | ❌                 | ✅                   |
| Distress flag → vet path       | ❌                 | ✅                   |
| Share-first result screen      | partial            | ✅                   |
| Translation persists in memory | ❌ (audio log only)| ✅                   |
| Cross-platform (iOS + Android) | ✅                 | Android first        |

The single line we'd put in a paid-ad headline:

> "MeowTalk says your cat is *Happy/Content*. Lily says *fine. you may
> sit on the floor near me. don't talk.* CatMD."

---

## Suggested content angles (for the agent's queue)

- **Comparison post** (Reddit r/CatAdvice, r/cats): "I tried MeowTalk
  for a year. Then a free app fed it my cat's body language too." —
  feature-driven, side-by-side screenshots, no hard sell
- **TikTok / Reels**: Two clips of the same cat, two different
  archetypes the user could have selected, two completely different
  translations. Ends with: "your cat's archetype matters. CatMD."
- **X / Twitter**: Three-line carousel — the meow you recorded, the
  generic label MeowTalk would give, the line CatMD gave. Reveal
  pattern works.
- **Influencer**: Send creator a CatMD account pre-loaded with their
  cat's profile. They record 30 seconds, get back 5 different
  translations across the day. The contrast is the content.
- **Press**: Technical angle — multimodal AI for animal
  communication, per-cat personalization, anchored on real research
  (CatMeows dataset, Pandeya 2018). This is a Wired / The Verge /
  TechCrunch story if pitched as "we used everything ChatGPT can do
  to one-up the 10M-download incumbent."

---

## What this unlocks for OTHER copy you've already written

Anywhere the existing knowledge base says *"Meow decoder — coming
soon"* or *"audio classification deferred"*, **update to "Meow
Translator — live, on the Today tab as 'Meow Translator', shipped 2026-05-10."*

The `WHAT-CATMD-DOES.md` doc, the website copy, and any in-flight
ad creative should all be revised. This is now a Pillar feature
alongside Diary, Chat, and Body Language — not a "coming soon."
