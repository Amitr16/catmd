/**
 * CatMD library additions — 2026-05-18
 *
 * One new SEO-targeted article — the "honest comparison" buyer's guide
 * for the AI-for-cats category:
 *   - ai-cat-health-apps-compared
 *
 * Why: "best cat health app" / "cat AI app comparison" / "AI cat
 * translator vs" are growing search queries with no established
 * comparison content. MeowTalk owns "cat translator" branding; Tably
 * and CatsMe own clinical pain detection. There is currently NO
 * canonical buyer's-guide content in the category — first-mover SEO
 * opportunity.
 *
 * The article is positioned as objective + structural — not a CatMD
 * sales pitch. The category frame ("multi-signal health intelligence
 * vs single-signal point tools") is the implicit positioning. Reader
 * concludes; we don't tell.
 *
 * Wiring (already done in this commit):
 *   1. Imports added in library.ts below the 2026-05-17 import block.
 *   2. Spread into ARTICLES + IMAGE_ALT_BY_SLUG.
 *   3. Added to the "body-language" cluster (Read your cat → body
 *      language fundamentals — same cluster as how-meow-translators-work
 *      and how-body-language-readers-work and what-is-my-cat-thinking-
 *      ai-apps).
 *   4. relatedSlugs back-links added on what-is-my-cat-thinking-ai-apps,
 *      how-meow-translators-work, how-body-language-readers-work,
 *      do-cats-hide-pain (the FGS / pain article).
 *
 * Hero image: reuses what-is-my-cat-thinking-ai-apps.webp as placeholder
 * (same topical lane). User can swap in a dedicated 1200×630 hero later
 * — drop ai-cat-health-apps-compared.png into proxy/public/library/ and
 * run convert-new-library-images.mjs.
 *
 * Deploy: cd proxy && npx wrangler deploy
 */

import type { Article } from './library';

export const ADDITIONAL_IMAGE_ALTS_2026_05_18: Record<string, string> = {
  'ai-cat-health-apps-compared':
    'A clean overhead comparison-table illustration showing four small phone screens side by side — Tably, MeowTalk, CatsMe, and CatMD — each focused on a different cat-AI capability, warm cream and sage palette, editorial style; hero illustration for an objective buyer\'s-guide article on AI cat health apps',
};

export const ADDITIONAL_ARTICLES_2026_05_18: Article[] = [
  {
    slug: 'ai-cat-health-apps-compared',
    title: 'AI Cat Health Apps Compared: What Each One Does (And Doesn\'t Do)',
    description:
      'Honest comparison of the leading AI cat health and translator apps — Tably, MeowTalk, CatsMe, CatMD. What each one reads, where it shines, where it doesn\'t, and how to choose.',
    datePublished: '2026-05-18',
    dateModified: '2026-05-18',
    readMinutes: 10,
    primaryKeyword: 'ai cat health apps compared',
    relatedSlugs: [
      'how-meow-translators-work',
      'how-body-language-readers-work',
      'do-cats-hide-pain',
      'what-is-my-cat-thinking-ai-apps',
    ],
    faqs: [
      {
        question: 'Which cat health app is the most accurate?',
        answer:
          'It depends on what you\'re measuring. Single-signal tools like Tably and CatsMe are clinically validated for pain detection from a single photo. Multi-signal tools like CatMD trade peak accuracy on any one signal for a broader, longitudinal picture across body language, audio, daily check-ins, and behavioural trends. The right answer is "accurate at what" — none of them outperform a vet on diagnosis.',
      },
      {
        question: 'Can MeowTalk actually translate what my cat is saying?',
        answer:
          'MeowTalk classifies cat meows into about a dozen category labels (Happy, Hunting, Resting, In Heat, etc.) using audio analysis. That\'s categorisation, not translation — cats don\'t have a structured language with one-to-one sound-to-meaning mappings. With its per-cat profile feature, MeowTalk has gotten better at recognising YOUR cat\'s specific vocalisations within those categories, but the output is still labels, not sentences. Treat it as entertainment + curiosity, not a translator.',
      },
      {
        question: 'Are these apps a replacement for a vet?',
        answer:
          'No. Every app in this article is an OBSERVATION tool. They help cat owners notice patterns earlier, document better, and bring clearer information to a vet visit. None of them diagnose. None of them treat. None of them substitute for hands-on veterinary care. The honest framing: they\'re the cat-parent equivalent of taking your own temperature — useful data, not a doctor.',
      },
      {
        question: 'Why is multi-signal "better" than single-signal?',
        answer:
          "Multi-signal isn't strictly better — it's broader. A single-signal app like Tably or CatsMe will outperform a multi-signal app on its narrow task (pain scoring from one photo) because it specialises. A multi-signal app trades peak accuracy on any one signal for a longitudinal picture: how mood drifted over a week, whether grooming dropped off, whether the cat is jumping less than they used to. The right framing: use a multi-signal app as your daily picture-builder, and reach for single-signal clinical tools when you need a focused second opinion.",
      },
      {
        question: 'Do I need more than one cat AI app?',
        answer:
          'Most owners don\'t. A reasonable approach: pick one multi-signal app for the daily picture (mood, weight, litter, behaviour, vocalisations over time) and optionally use a single-signal clinical app like Tably as a confirmation tool when something specific concerns you. Running 3-4 cat apps in parallel is engagement-fatigue territory — pick the one that matches your actual question and use it consistently.',
      },
      {
        question: 'Why are AI cat apps getting popular now?',
        answer:
          'Three things converged around 2024-2026: smartphone cameras good enough for clinical-grade facial analysis, multimodal AI models (Gemini, GPT-4o, Claude) that can interpret video + audio + text simultaneously, and a generation of cat owners who already use AI tools for other things and expect them to apply to their pets too. The Feline Grimace Scale (FGS) — the research framework that made AI pain detection possible — was published in 2019; the consumer apps took a few years to mature on top of it.',
      },
      {
        question: 'What does CatMD do that the others don\'t?',
        answer:
          'CatMD is multi-signal by design — body language video reads, meow audio interpretation, daily check-ins, symptom triage scans, behavioural trend tracking, plus a cat-voice diary and chat that build a personality profile over time. Where Tably tells you "is your cat in pain right now," CatMD tells you "your cat is jumping less than 2 weeks ago, grooming is down, and the last triage flagged a concern" — a longitudinal picture, not a point-in-time read. Free to start, no signup required, Android-first.',
      },
    ],
    bodyHtml: `
<p>The "AI for cats" space went from non-existent to crowded in about two years.</p>

<p>There are now apps that read your cat's face for pain, apps that classify your cat's meows into mood categories, apps that build personality profiles, and apps that try to do all of the above with daily health tracking. The marketing copy across them is suspiciously similar — some variant of "decode your cat." The underlying technology is wildly different. And the day-to-day usefulness depends entirely on which problem you're actually trying to solve.</p>

<p>This is an honest comparison. None of these apps replace a vet. None of them diagnose. Some are clinical-grade for narrow tasks, some are entertainment with a health flavour, and some try to build a longer-term picture of how your cat is doing. The right one depends on what you're after.</p>

<h2>The four apps, at a glance</h2>

<table>
<thead>
<tr><th>App</th><th>What it reads</th><th>Primary use</th><th>Where it shines</th></tr>
</thead>
<tbody>
<tr><td><strong>Tably</strong></td><td>Cat face (Feline Grimace Scale)</td><td>Pain detection from a photo</td><td>Clinical pain scoring backed by published research</td></tr>
<tr><td><strong>MeowTalk</strong></td><td>Cat audio (meows)</td><td>Categorising vocalisations</td><td>Brand recognition + per-cat audio profile learning</td></tr>
<tr><td><strong>CatsMe</strong></td><td>Cat face (pain)</td><td>Pain detection from a photo</td><td>Study-backed clinical accuracy (per published research)</td></tr>
<tr><td><strong>CatMD</strong></td><td>Body language + audio + daily check-ins + scans + behaviour + personality</td><td>Multi-signal health picture</td><td>Longitudinal context across the whole cat over time</td></tr>
</tbody>
</table>

<p>Below, what each one actually does, where it doesn't, and how to think about the category as a whole.</p>

<h2>Tably — clinical pain detection from a single photo</h2>

<p><strong>What it does.</strong> Tably uses computer vision trained on the <a href="/library/do-cats-hide-pain">Feline Grimace Scale (FGS)</a> — a peer-reviewed pain assessment framework developed by veterinary anaesthesiologists. The user takes a clear photo of their cat's face; the app returns a pain score derived from facial action units (ear position, eye narrowing, muzzle tension, whisker position, head position).</p>

<p><strong>Where it shines.</strong> FGS is a real clinical instrument. It's used in veterinary clinics. Anchoring an app to it gives Tably credibility no entertainment-grade competitor can match. For an owner who wants a structured second opinion on "is my cat in pain right now," Tably is the closest a phone gets to a vet's hands-on pain assessment.</p>

<p><strong>What it doesn't do.</strong> Tably is point-in-time and single-signal. One photo, one score. It doesn't know what your cat is doing the rest of the day. It doesn't notice that grooming has dropped off this week, that jumping has reduced, that mood has been "off" three days running. The cat's whole life sits outside the frame of any one Tably scan.</p>

<p><strong>Best for:</strong> owners who suspect their cat may be in pain and want a clinical-grade pain scoring tool to confirm what they're seeing. Useful as a checkpoint, not a daily ritual.</p>

<h2>MeowTalk — audio classification of meows</h2>

<p><strong>What it does.</strong> MeowTalk records short audio clips of a cat's meow and classifies them into roughly eleven generic intent categories — Happy, Hungry, Resting, Hunting, In Heat, Mating Call, and similar. With its per-cat profile feature, the app gradually learns the specific vocal signatures of YOUR cat, refining its classifications over time.</p>

<p><strong>Where it shines.</strong> Audio is the most accessible signal for a curious owner — easier to capture than a clear face photo, easier to spam, instantly entertaining. MeowTalk built the dominant brand in the "translate my cat" category, and the per-cat learning genuinely does improve over time for individual cats whose owners use it consistently.</p>

<p><strong>What it doesn't do.</strong> MeowTalk is audio-only. It cannot see what the cat is doing while making the sound. A "hungry" meow at the food bowl and a "hungry" meow during a thunderstorm sound similar but mean different things — one is a request, the other is anxiety with a similar vocal envelope. Without seeing posture, pupils, ears, the surroundings, audio-only classification has a ceiling. The output is also fundamentally a label, not an interpretation — "happy" tells you a bucket, not a story.</p>

<p>Read our deep-dive on <a href="/library/how-meow-translators-work">how modern meow translator apps actually work</a> for the technical detail on what audio can and can't tell you about a cat.</p>

<p><strong>Best for:</strong> owners curious about cat communication, who want a fun categorical read on what their cat's vocalisations might mean. Good entertainment. Less reliable as a health signal.</p>

<h2>CatsMe — pain detection (study-backed)</h2>

<p><strong>What it does.</strong> CatsMe is a pain-detection app developed in Japan, also based on facial computer vision. The developers have published research on its accuracy in clinical settings, with reported pain-detection accuracy in the mid-to-high 90s percent in their validation studies.</p>

<p><strong>Where it shines.</strong> Like Tably, CatsMe is built on a clinical foundation rather than entertainment. The published research gives the app stronger credibility for veterinary professionals than apps without academic backing. For owners willing to read research papers, the accuracy claims are unusually well documented for a consumer cat app.</p>

<p><strong>What it doesn't do.</strong> Single-signal, single-task: pain detection from a face. Same structural limitation as Tably — it answers one question well, and the rest of the cat's life sits outside its frame. The app's UX and broader feature surface is also less consumer-polished than the international competitors; it's a research-derived tool more than a daily-use companion.</p>

<p><strong>Best for:</strong> clinically curious owners, professionals, or owners specifically in the Japan region looking for study-backed pain detection.</p>

<h2>CatMD — multi-signal health intelligence</h2>

<p><strong>What it does.</strong> CatMD is a multi-signal cat companion app that reads:</p>

<ul>
<li><strong>Body language video</strong> — 6-second clips analysed across ear position, eye state, tail movement, posture, motion, and any vocalisations. See <a href="/library/how-body-language-readers-work">how body-language reader apps work</a> for the technical detail.</li>
<li><strong>Audio</strong> — meow interpretation paired with the rest of the context, not in isolation.</li>
<li><strong>Daily check-ins</strong> — 10-second mood and appetite logs that build a baseline over time.</li>
<li><strong>Triage scans</strong> — symptom-to-urgency tiering with vet-PDF export.</li>
<li><strong>Behavioural trends</strong> — Health Rhythm view that shows mood, appetite, weight, water, litter, and pain face evolving across weeks.</li>
<li><strong>Personality + memory</strong> — a Feline Five archetype profile + cat-voice diary + chat that reference your home's named people, pets, and objects after learning them from your photos.</li>
</ul>

<p><strong>Where it shines.</strong> Multi-signal is broader by design. Where Tably tells you "your cat may be in pain right now," CatMD tells you "your cat has been jumping less than two weeks ago, grooming is slightly down, the last triage flagged a moderate concern, and the diary noted hiding behaviour twice this week." It's the longitudinal picture, not the single-frame photograph.</p>

<p>The other layer — and this is harder to describe in a comparison table — is that CatMD treats your cat as an individual. The chat replies in your cat's personality voice. The diary references your home's named people by name. The triage adjusts to your cat's specific archetype. Over weeks, the app accumulates a picture of <em>your</em> cat that no signal-specific app builds, because they're not trying to.</p>

<p><strong>What it doesn't do.</strong> CatMD does not match Tably or CatsMe on isolated pain-score accuracy from a single photo — clinical specialists outperform generalists on their specific task. CatMD is also newer than the comparison set (launched 2026, currently Android-only), and the multi-signal picture is only as rich as the daily input the owner provides. An owner who never logs a check-in or never uploads a photo gets a thinner CatMD experience than an owner who engages daily.</p>

<p><strong>Best for:</strong> cat owners who want one app that knows their cat over time — daily picture-building, behavioural drift detection, and a companion layer that doesn't feel like a clinical tool.</p>

<h2>Why multi-signal matters (and when it doesn't)</h2>

<p>A vet examining a cat doesn't look at just the face or just listen to the breathing. They take in posture, weight history, owner notes, behaviour changes, lab values, and the cat's individual baseline. That's multi-signal triage. It's how clinicians actually work.</p>

<p>Single-signal apps optimise for one specific question — "is the cat in pain in this photo," "what category does this meow fall into." Within that narrow question, they can be excellent. They will often beat multi-signal apps on the isolated task because that's all they do.</p>

<p>But cats don't have one-signal lives. They have bodies that move, sounds they make, behavioural patterns that drift over time, and personalities that colour everything. When something is wrong, the signal usually shows up across multiple channels before it shows up dramatically in any one. The cat groomed less for four days, then the appetite dropped, then the hiding started — none of which any single-signal app would catch, but all of which a multi-signal picture surfaces as a pattern.</p>

<p><strong>The honest framing:</strong></p>

<ul>
<li>For a <strong>specific narrow question</strong> — "is my cat in pain in this moment" — a clinical single-signal app like Tably or CatsMe is the right tool.</li>
<li>For <strong>"how is my cat doing"</strong> — daily picture, drift detection, longitudinal context — a multi-signal app like CatMD is the right tool.</li>
<li>For <strong>most owners most of the time</strong>, the multi-signal app is the daily habit, and the clinical apps are confirmation tools used occasionally when something specific concerns you.</li>
</ul>

<h2>None of these replace a vet</h2>

<p>This bears repeating because every app in this article is marketed adjacent to clinical insight and it's easy to forget where the line is.</p>

<p>Every app on this list is an <strong>observation tool</strong>. They help you notice patterns earlier, document better, and bring clearer information to a vet visit. None of them diagnose. None of them treat. None of them substitute for hands-on veterinary care.</p>

<p>Use them as the cat-parent equivalent of taking your own temperature — useful data, not a doctor. The best outcome for any of these tools is that you walk into your vet's office with a clear timeline, specific symptoms named, and behavioural changes documented, and the vet's job is easier because you've done the noticing.</p>

<h2>How to choose, in one paragraph</h2>

<p>If you want the most accurate pain scoring from a single photo: Tably or CatsMe. If you want a fun-and-curious tool for cat vocalisations specifically: MeowTalk. If you want one app that knows your cat over weeks and months — mood drift, behavioural change, named-people-and-pets, personality-driven diary — that's the multi-signal lane, and CatMD is the option there. The category is young enough that the right answer for many owners is "pick the one that matches what you're actually asking" rather than "find the one best app." None of them replace a vet, but the better ones meaningfully change what a vet visit looks like — you bring data instead of guesses.</p>
`,
  },
];
