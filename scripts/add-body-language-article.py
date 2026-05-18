"""Add the 'how-body-language-readers-work' article to ADDITIONAL_ARTICLES
in library-additions-2026-05-09.ts. Mirrors the live deployed content
(which the user authored externally), reflowed into the registry.
"""
from __future__ import annotations

PATH = r"D:\apps\catmd\proxy\library-additions-2026-05-09.ts"

NEW_ARTICLE = r'''
  // ─────────────────────────────────────────────────────────────────────────
  // 5. How body-language readers work — multi-channel explainer (2026-05-11)
  //
  // Companion piece to how-meow-translators-work. Both articles use the
  // same "what audio-only / single-channel apps miss, what multimodal
  // adds" structure so they read as a pair. Sourced from cat-ethology
  // literature: Bradshaw, Ellis, Delgado are all real cat-behaviour
  // researchers.
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'how-body-language-readers-work',
    title: 'How Modern Cat Body-Language Readers Actually Work — and Why Six Seconds Is the Right Window',
    description:
      'How AI cat body-language reader apps analyze tail, ears, eyes, posture, and motion across six-second videos to provide personalized reads of your cat\'s emotional state.',
    datePublished: '2026-05-11',
    dateModified: '2026-05-11',
    readMinutes: 8,
    primaryKeyword: 'cat body language reader app',
    relatedSlugs: [
      'cat-tail-language',
      'cat-body-language-ears-whiskers-eyes',
      'how-meow-translators-work',
    ],
    faqs: [
      {
        question: 'Why does the app need video — can\'t it just analyse a photo?',
        answer:
          'A single photo captures one frozen moment, and most cat body-language signals are temporal — they only reveal themselves across time. A tail flicking once every two seconds means something different from a tail held still; an ear that rotates outward at second four means something different from an ear that stays forward; pupils dilating across the clip is a signal a still photo cannot show. Six seconds (or four for the meow translator) is the minimum window where these temporal signals become readable. Photo-only apps fundamentally cannot read motion, and motion carries roughly half of body-language meaning.',
      },
      {
        question: 'How accurate is the AI compared to a vet behaviourist?',
        answer:
          'For obvious states (clear distress, clear relaxation, clear play), modern multimodal readers are accurate enough that an experienced cat owner watching the same clip would generally agree with the read. For ambiguous states (mild discomfort vs annoyance, anxious-tense vs alert-curious, pain vs simple displeasure), AI accuracy drops because human experts disagree on those too — they\'re inherently context-dependent. The honest framing: a multimodal reader is a calibrated cat-savvy second opinion, not a clinical assessment. For anything that looks like pain or distress, the read should route you toward vet examination, not replace it.',
      },
      {
        question: 'Does the app know my specific cat, or is it reading every cat the same way?',
        answer:
          'Modern readers do both. The body-language interpretation itself uses a base model trained on general feline behaviour — that part is the same for every cat. But the SECOND layer (what the read means in context for your cat) uses per-cat memory. A skittish-sensitive cat looking tense at second three is meaningful; a confident-communicator cat looking tense at second three is more meaningful, because tension is unusual for that archetype. The app knows the difference because the personality archetype, recent history, and baseline temperament are part of the interpretation prompt, not just the visual analysis.',
      },
      {
        question: 'What body parts is the AI actually looking at?',
        answer:
          'The five canonical channels for cat body language are tail, ears, eyes (including pupil dilation), posture (shoulders, hips, weight distribution), and motion (any change across the clip — twitches, flicks, ear rotations, head turns, weight shifts). A sixth channel — vocalisation — folds in if the clip has audio. Modern multimodal models (typically GPT-4o-class or Gemini-class with vision) can see all six in parallel from a single video; older single-channel apps could only see one. The interpretation prompt asks the model to comment on each channel separately and then synthesize an overall emotional state with confidence.',
      },
      {
        question: 'What\'s the difference between this and just having an experienced cat owner watch the clip?',
        answer:
          'Two practical differences. First, the AI is consistent — it never gets tired, distracted, or biased toward what it expects to see. Second, the AI has structured memory of your cat that an outside observer would not — recent triage flags, the day\'s mood log, what the cat ate yesterday, the personality archetype. An experienced cat-savvy friend gives you intuition; the multimodal reader gives you intuition cross-referenced with structured per-cat history. Neither replaces a vet for medical concerns. Both are most useful as a "what am I missing here?" second opinion when you\'re reading your own cat at the threshold of being unsure.',
      },
    ],
    bodyHtml: `
<p>Cats communicate continuously, but most of what they\'re saying is silent. The vocalisation channel — meows, trills, hisses — is what owners notice. The body-language channel — tail position, ear rotation, pupil dilation, posture, motion across time — carries roughly half of all cat communication and is where almost every emotional and physical signal first appears. Reading it well is the difference between catching a problem early and noticing it after it\'s become urgent.</p>

<p>For decades the only way to learn this was practice — years of living with cats, trial and error, occasionally a vet behaviourist for the harder cases. The new generation of <strong>cat body-language reader apps</strong> takes a six-second video and returns a structured read across all five channels in roughly the time it takes to upload the clip. This piece explains how that pipeline works, why the multi-channel approach matters, and what the underlying science actually says about cat body language.</p>

<h2>The single-channel generation — what it tried, where it stopped</h2>

<p>The first wave of cat-behaviour apps were single-channel: photo-only mood detectors, tail-position classifiers, "is your cat happy" quizzes that asked you to upload one image. They were limited by something structural, not by model quality.</p>

<p>The structural limit is that <strong>most cat body-language signals are temporal</strong>. They reveal themselves across seconds, not in single frames. Consider:</p>

<ul>
<li>A tail held still vs a tail flicking once every two seconds — the second is mild irritation; the first is neutral. A still photo can\'t tell the difference.</li>
<li>Ears held forward vs ears rotating outward at second four — the rotation is the signal. The static position is ambiguous.</li>
<li>Pupils that stay constant vs pupils dilating across the clip — dilation is alert/aroused/fearful state. The static reading misses it.</li>
<li>A cat that looks relaxed at second one but tenses at second four — the SHIFT is what matters. A photo at second one says "fine"; a photo at second four says "tense"; both are wrong.</li>
</ul>

<p>Single-frame analysis fundamentally cannot see any of this. The classic body-language guides taught by veterinary behaviourists — the work of cat-behaviour researchers like John Bradshaw, Sarah Ellis, and Mikel Delgado — emphasize that body language is read in motion and in clusters of signals, never from one frozen moment.</p>

<p>This is why six seconds (or thereabouts) is the minimum useful window. Long enough to capture two or three temporal signals; short enough that the cat hasn\'t moved into a completely different context.</p>

<h2>The multi-channel generation — five (or six) inputs, one structured read</h2>

<p>A modern body-language reader analyses the clip across five visual channels in parallel, plus audio if present. Each channel produces a sub-read; the sub-reads then get synthesized into an overall emotional state with confidence.</p>

<h3>Channel 1 — Tail</h3>

<p>The tail is the most expressive single channel. Position (high, neutral, low, tucked), shape (straight, curled, puffed), and motion (still, slow swish, fast flick, lashing) each carry meaning. The full vocabulary is covered in the existing guide on <a href="/library/cat-tail-language">cat tail language</a>. The AI reads all three dimensions across the clip — a tail that starts low and goes lower means something different from a tail that starts low and rises.</p>

<h3>Channel 2 — Ears</h3>

<p>Ears rotate independently and continuously. Forward = engaged or alert, sideways or "airplane" = irritated or conflicted, flat back = defensive or fearful. Critically, ears often shift faster than any other channel — a cat\'s ears can rotate from forward to sideways in under a second when something off-frame catches attention. The reader tracks the rotation, not just the snapshot.</p>

<h3>Channel 3 — Eyes</h3>

<p>Two sub-signals here. Pupil dilation (dilated = aroused, fearful, or just dim lighting; constricted = focused or content) and eyelid position (slow blinks = trust signal, half-lidded = relaxed, wide-open with dilation = alert/anxious, hard stare = challenge). The full eye-and-face guide is at <a href="/library/cat-body-language-ears-whiskers-eyes">how to read ears, whiskers, and eyes</a>.</p>

<h3>Channel 4 — Posture</h3>

<p>Whole-body shape carries weight (literally). Loaf position with paws tucked = content and safe. Side-lying with belly exposed = trusting. Crouched low with weight forward = ready to bolt or pounce. Arched back with sideways orientation = defensive display. Stretched out with one leg extended = utterly relaxed. The shape is contextual — a "loaf" in the middle of the room is different from a "loaf" wedged into the back of a closet.</p>

<h3>Channel 5 — Motion</h3>

<p>Any change across the clip. Weight shifts, twitches, head turns, repositioning, the moment the cat decides to look at the camera. Motion-channel signals are often the most diagnostic because they\'re unconscious — the cat doesn\'t know it\'s about to flick its tail in the next half-second; the move just happens.</p>

<h3>Channel 6 — Audio (if present)</h3>

<p>If the clip has sound, the audio channel folds in: meows, trills, purrs, hisses, growls, chatter. Audio resolves ambiguity in posture — the same crouched position with a hiss means defence; without the hiss it might mean stalking. Audio analysis is the same engineering covered in the parallel piece on <a href="/library/how-meow-translators-work">how meow interpreters work</a>.</p>

<h2>What "fuse the channels" actually means in practice</h2>

<p>Each channel produces a sub-read with its own confidence. The fusion step asks a multimodal large language model — typically GPT-4o or Gemini in the vision-capable family — to synthesize the channels into one overall state with one overall confidence number, and to flag any internal contradictions.</p>

<p>Contradictions are diagnostic on their own. A cat with relaxed posture but dilated pupils and ear-rotation is showing conflicted signals — the body says "I\'m fine" while the face says "I\'m alert about something." That contradiction is exactly what an experienced cat-savvy human would notice and comment on; the multi-channel architecture surfaces it explicitly instead of averaging it away.</p>

<p>A typical structured output looks like: tail (slight flick, mild irritation, medium confidence), ears (forward then rotating outward at second four, increasing irritation, high confidence), eyes (slightly dilated, alert state, medium confidence), posture (loaf with weight forward, ready to move, medium confidence), motion (weight shift at second three, decision-point, high confidence), audio (none). Overall: <em>"Mildly irritated, deciding whether to move. Probably fine if left alone for thirty seconds."</em></p>

<h2>The per-cat memory layer — what makes the read about YOUR cat</h2>

<p>The visual analysis is the same for every cat. The interpretation of what those visuals mean depends on the specific cat. This is where the reader pulls in the per-cat memory — the personality archetype from a quiz like the <strong>Feline Five</strong> (Litchfield et al, <em>PLOS ONE</em>, 2017 — developed from a survey of 2,800+ cats living in homes), recent diary entries, recent triage flags, the cat\'s baseline temperament.</p>

<p>The same set of body-language sub-reads can mean different things in context. A skittish-sensitive cat showing mild irritation at the camera is normal baseline behaviour; a confident-communicator cat showing the same signals is unusual and worth noting. A senior cat with a recent vet visit showing slight stiffness in posture is worth flagging differently from a young cat doing the same thing for one frame. The per-cat memory layer is what turns a generic body-language read into "what this means for your specific cat right now."</p>

<h2>Why the read gets sharper over time</h2>

<p>Just like the meow interpreter, the body-language reader compounds. Every clip you submit becomes part of the cat\'s baseline. The reader learns your cat\'s normal — the typical tail position, the usual ear rotation rate, the resting posture they default to. Drift from baseline is more diagnostic than absolute readings, and the reader can only spot drift after it has enough baseline data.</p>

<p>This is the practical case for using the reader regularly even when nothing is wrong — the routine clips become the baseline. When something IS off, the system spots it because it has weeks of "this is what fine looks like for this cat" to compare against.</p>

<h2>What modern readers do not claim</h2>

<p>Two important honest framings. First, the body-language read is a behavioural observation, not a clinical diagnosis. When the reader flags "appears to be in pain" or "showing distress signals," that\'s a useful "go check this out" nudge — it\'s not a verdict. The cat needs hands-on examination from a vet for any actual diagnosis. Honest readers always pair concerning reads with a route to symptom triage rather than ending the flow at the read.</p>

<p>Second, the reader does not replace human attention. The five-channel framework is something cat-savvy owners learn to read intuitively over years; the AI condenses some of that learning into a single video upload, but it doesn\'t substitute for being present with your cat day-to-day. The reader is most useful at the threshold of being unsure — when you can tell something is slightly off but can\'t put your finger on what.</p>

<h2>What this changes day-to-day</h2>

<p>Three things shift once you have a reliable multi-channel reader available. First, ambiguous moments stop being ambiguous — when you\'re not sure if the cat is annoyed or just sleepy, you upload six seconds and find out. Second, you start spotting baseline drift earlier — the reader notices a posture change a week before you would have, because it\'s comparing against three months of clips. Third, you stop second-guessing the obvious reads — the times when your cat is clearly fine, the reader confirms it, and you stop spending mental energy worrying.</p>

<p>The reader is not a replacement for the underlying literacy. The full <a href="/library/cat-body-language-ears-whiskers-eyes">how-to-read-ears-whiskers-eyes guide</a> and the <a href="/library/cat-tail-language">tail language guide</a> are the foundation; reading your own cat is still the most important skill. The multimodal reader is what you reach for when the read is non-obvious or when you want a second opinion that has structured per-cat history backing it. It is, fundamentally, a calibrated cat-savvy friend you can summon in six seconds.</p>
`,
  },
'''


def main() -> None:
    with open(PATH, "r", encoding="utf-8") as f:
        src = f.read()
    # Check if it's already been added (idempotent)
    if "slug: 'how-body-language-readers-work'" in src:
        print("Already present — no-op.")
        return
    # Insert before the closing `];` of ADDITIONAL_ARTICLES
    marker = "\n];\n"
    idx = src.rfind(marker)
    if idx < 0:
        raise SystemExit("Closing array bracket not found")
    new_src = src[:idx] + NEW_ARTICLE + src[idx:]
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_src)
    print(f"OK — appended body-language article ({len(NEW_ARTICLE)} chars). New file size: {len(new_src)} bytes.")


if __name__ == "__main__":
    main()
