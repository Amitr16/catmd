"""One-shot rewrite — replace the meow-article bodyHtml in
library-additions-2026-05-09.ts with the live (corrected) version.

Three factual corrections vs the live deployed article:
  1. CatMeows attribution — Ludovico et al 2020 (not Pandeya 2018).
     Pandeya 2018 is a SEPARATE dataset (CatSound). Now cited as both.
  2. Dataset size — CatMeows is 440 vocalisations from 21 cats, not
     "thousands". CatSound is the larger ~3000-sample dataset.
  3. Feline Five framing — Litchfield et al 2017 PLOS ONE was developed
     from a survey of 2,800+ cats living in homes, not "originally for
     shelter assessment work".
"""
from __future__ import annotations
import re

PATH = r"D:\apps\catmd\proxy\library-additions-2026-05-09.ts"

NEW_BODY = r'''
<p>Cat translator apps have been on the App Store for over a decade. Most of them work the same way — record a meow, run it through an audio classifier, return one of about a dozen fixed labels. "Happy/Content." "Hunting." "Resting." Useful as a novelty for a week, then they stop being interesting. The label is the same for every cat in every household, and there is nothing to share with a friend.</p>

<p>A new generation of <strong>multimodal meow interpreters</strong> works differently — they capture short video instead of audio alone, fuse the meow with body language and per-cat memory, and return one interpretive line in the cat\'s specific voice. This piece explains how that pipeline works under the hood, why the output is qualitatively different, and what the underlying research actually says.</p>

<h2>The audio-only generation — what it does, where it stops</h2>

<p>The classic cat-translator app does one thing well: it records a meow, transforms the waveform into a spectrogram, and runs a classifier that maps the spectrogram to one of roughly ten to thirteen vocalisation categories. The classifier is usually trained on a published dataset of labelled cat vocalisations.</p>

<p>Two of the most-cited research datasets are the <strong>CatSound</strong> dataset (Pandeya et al, <em>MDPI Applied Sciences</em>, 2018) — a ten-class set of around 3,000 cat-sound samples covering states like resting, hunting, mating, defending, and paining — and <strong>CatMeows</strong> (Ludovico et al, 2020), which contains 440 vocalisations from 21 cats across three controlled contexts: brushing, isolation in an unfamiliar environment, and waiting for food. Audio-only classifiers built on these and related corpora can distinguish vocalisation context with accuracy in the 80-95% range on their own test splits.</p>

<p>The datasets and the classifiers are real and useful. The limitation is structural: the output of an audio-only classifier is a CATEGORY, not a SENTENCE. The model can tell you the meow falls in the "isolated" cluster or the "waiting for food" cluster — it cannot tell you what your cat would plausibly be saying about that situation, because it has no information about your cat as an individual.</p>

<p>This is why audio-only interpreters plateau. The category is the same on day one as on day three hundred. There is nothing to compound.</p>

<h2>The multimodal generation — three inputs, one output</h2>

<p>A modern multimodal meow interpreter captures four seconds of <em>video</em> instead of audio alone. That single change unlocks two additional input channels.</p>

<h3>Channel 1 — Audio</h3>

<p>Same as before: the meow is transcribed (often via Whisper or a similar speech-to-text model running over the vocalisation) and classified into one of the ten or so vocalisation types — meow, trill, chirp, purr, hiss, growl, yowl, chatter, silent (no audio, body-only read), other. The intent gets a similar classification: greeting, demand for food, demand for attention, annoyed, playful, comfort-seeking, warning, distress, curious, self-soothing.</p>

<p>This is the same engineering audio-only interpreters have always done. It is necessary, not sufficient.</p>

<h3>Channel 2 — Body language</h3>

<p>The four-second video lets the model see what the cat is doing across time, not just what the cat sounds like at one moment. Posture, ear position, tail movement, pupil dilation, motion patterns. The body-language signal carries roughly half of cat communication on its own — see the existing guide on <a href="/library/cat-body-language-ears-whiskers-eyes">reading ears, whiskers, eyes, and posture</a> and the companion piece on <a href="/library/cat-tail-language">tail language</a> for the full inventory.</p>

<p>Pairing audio with body language resolves ambiguities the audio cannot resolve alone. The same yowl can be a territorial warning, a mating call, or pain depending on what the cat\'s body is doing while it yowls. A meow with a tail-up greeting posture means something different from the same meow with a defensive crouch and dilated pupils. The body-language channel is what makes the interpretation contextual instead of categorical.</p>

<h3>Channel 3 — Per-cat memory</h3>

<p>This is the channel audio-only interpreters do not have at all. A modern multimodal app maintains a structured memory of the specific cat — name, breed, personality archetype, recent diary entries, recent triage flags, what the cat ate yesterday, who the named family members in the household are, whether there has been a recent vet visit.</p>

<p>The personality archetype matters most. Different cats with the same physical signal would say different things, in different registers. A worked example — same posture, same meow, two cats:</p>

<blockquote style="margin: 1.2em 0; padding: 0.6em 1em; border-left: 4px solid var(--sage, #3F6456); font-style: italic; font-family: Georgia, serif; font-size: 1.05em;">A Velcro-Cat would say: "i missed you. the chair held the shape of you. lap."</blockquote>

<blockquote style="margin: 1.2em 0; padding: 0.6em 1em; border-left: 4px solid var(--sage, #3F6456); font-style: italic; font-family: Georgia, serif; font-size: 1.05em;">A Cool-Observer in the same physical state would say: "yes. i hear the thing. it is beneath my dignity to react."</blockquote>

<p>The audio is identical. The body language is identical. The per-cat memory layer is what produces two completely different interpreted lines. This is why modern interpreters feel personal in a way audio-only ones never did — because they are. The five-archetype framework most multimodal apps draw on is the <strong>Feline Five</strong> (Litchfield et al, <em>PLOS ONE</em>, 2017), a peer-reviewed personality model developed from a survey of more than 2,800 cats living in homes.</p>

<h2>What "fuse the three channels into one line" actually means</h2>

<p>The fusion step is where multimodal AI does its work. The audio classification, the body-language read, and the per-cat memory all become inputs to a large language model — typically a multimodal model in the GPT-4o or Gemini family — with a prompt that asks: given this audio, this body language, and this cat\'s profile, what is one short line this specific cat would plausibly be saying right now, in their voice.</p>

<p>The model returns a single sentence, typically 40 to 160 characters, in the first person, ending with a period. Honest apps add hard rules to the prompt to prevent generic outputs — if the line could plausibly be applied to any cat, it gets regenerated. The output is calibrated for one thing: the screenshot. A short, specific, in-voice line that the owner will send to a friend and that the friend will instantly recognise as belonging to that specific cat.</p>

<h2>Why the output gets sharper over time</h2>

<p>The per-cat memory layer compounds. Every interaction the cat has with the app — every diary entry, every photo tagged with named people, every triage scan, every previous translation — becomes context for the next translation. After a few weeks of use, a multimodal interpreter knows things about your cat that no audio-only system can ever access: the name of the human the cat sleeps near, the brand of food the cat refused last week, the eye that was inflamed three weeks ago.</p>

<p>Those facts get woven into the interpreted lines when they are relevant. A meow in a posture that suggests discomfort, in a cat with a recent eye-triage flag, might come back as <em>"i am purring but i am not okay. eye still hurts. stay close."</em> instead of a generic discomfort label. The line is interpretation, not diagnosis — but it is interpretation that points the owner toward a specific thing to watch.</p>

<h2>What modern interpreters do not claim</h2>

<p>The honest framing matters. Multimodal interpreters do not <em>decode</em> cat language — cats do not have a structured language with a one-to-one mapping between sounds and meanings. They <em>interpret</em>, in the same sense a thoughtful cat-savvy friend interprets when reading your cat across the room. The output is plausible inner-monologue, anchored on real signals (audio, body language, history), but it is not a transcription.</p>

<p>The other thing they do not claim is clinical diagnosis. When the body-language read or the audio classifier flags distress, a well-designed app routes the owner toward symptom triage rather than producing a screenshot-worthy line. The flag is a behavioural observation worth investigating. The diagnosis is the vet\'s call.</p>

<h2>What this changes day-to-day</h2>

<p>For owners who used audio-only interpreters years ago and abandoned them after the novelty wore off, the relevant update is: the underlying technology has changed enough that the experience is different. The label is gone, replaced by a line. The line is in your specific cat\'s voice instead of in a generic register. The output gets more specific the longer you use the app, because the per-cat memory compounds.</p>

<p>None of this replaces the fundamental cat-reading skills. The vocalisation vocabulary covered in the existing piece on <a href="/library/cat-vocalizations-decoded">how to read your cat\'s sounds</a> is still the foundational literacy, and the <a href="/library/cat-body-language-ears-whiskers-eyes">body-language guide</a> is still the day-to-day reference. A multimodal interpreter is not a substitute for learning to read your own cat. It is a way to compress moments your cat is already showing you into something you can save and share.</p>

<p>Two cats in the same household with two different archetypes will, over time, develop two distinct voices in a multimodal interpreter that audio-only systems would have given identical labels. That is the difference, and it is the reason the second generation of these apps is worth a fresh look.</p>
'''


def main() -> None:
    with open(PATH, "r", encoding="utf-8") as f:
        src = f.read()
    # Match from the meow article's bodyHtml: ` opening through the closing
    # `, on the next line (which terminates the bodyHtml literal). The DOTALL
    # flag is implicit via [\s\S] character class.
    pat = re.compile(
        r"(slug: 'how-meow-translators-work',[\s\S]*?bodyHtml: `)([\s\S]*?)(`,\n  \},)",
    )
    m = pat.search(src)
    if not m:
        raise SystemExit("PATTERN_NOT_FOUND")
    new_src = src[: m.start(2)] + NEW_BODY + src[m.end(2) :]
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_src)
    print(f"OK — replaced meow bodyHtml ({len(NEW_BODY)} chars). New file size: {len(new_src)} bytes.")


if __name__ == "__main__":
    main()
