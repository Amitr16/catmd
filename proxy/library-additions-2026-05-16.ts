/**
 * CatMD library additions — 2026-05-16
 *
 * One new SEO-targeted article. Companion long-form for the Pain Check
 * feature: "Do cats hide pain? How to read the signs in your cat's face."
 *
 * To activate (already done in this commit):
 *   1. In library.ts, near the top with other imports:
 *        import {
 *          ADDITIONAL_ARTICLES_2026_05_16,
 *          ADDITIONAL_IMAGE_ALTS_2026_05_16,
 *        } from './library-additions-2026-05-16';
 *
 *   2. Just before the closing `];` of the ARTICLES array:
 *        ...ADDITIONAL_ARTICLES_2026_05_16,
 *
 *   3. Inside the IMAGE_ALT_BY_SLUG record, spread:
 *        ...ADDITIONAL_IMAGE_ALTS_2026_05_16,
 *
 *   4. Update relatedSlugs on at least 2 existing articles to include
 *      the new slug, so the internal link graph closes both ways:
 *        - cat-hiding-illness → add 'do-cats-hide-pain'
 *        - cat-body-language-ears-whiskers-eyes → add 'do-cats-hide-pain'
 *
 *   5. Add hero image at /proxy/public/library/do-cats-hide-pain.webp,
 *      1200×630 WebP, via the existing convert-new-library-images.mjs.
 *
 *   6. Deploy:
 *        cd proxy
 *        npx wrangler deploy
 *
 *   7. Verify at:
 *        https://catmd.pet/library/do-cats-hide-pain
 */

import type { Article } from './library';

export const ADDITIONAL_IMAGE_ALTS_2026_05_16: Record<string, string> = {
  'do-cats-hide-pain':
    "A quiet tabby cat resting on a cream blanket beside a phone showing a simple pain-check score card — hero illustration for a guide on whether cats hide pain",
};

export const ADDITIONAL_ARTICLES_2026_05_16: Article[] = [
  {
    slug: 'do-cats-hide-pain',
    title: "Do Cats Hide Pain? How to Read the Signs in Your Cat's Face",
    description:
      "Cats often hide pain. Here's how to read the five facial signs (ears, eyes, muzzle, whiskers, head position) using the Feline Grimace Scale.",
    datePublished: '2026-05-16',
    dateModified: '2026-05-16',
    readMinutes: 9,
    primaryKeyword: 'do cats hide pain',
    relatedSlugs: [
      'cat-not-jumping',
      'cat-grooming-less',
      'cat-not-eating',
      'cat-hiding-illness',
      'cat-body-language-ears-whiskers-eyes',
    ],
    faqs: [
      {
        question: 'Do cats really hide pain?',
        answer:
          "Yes. Many cats show pain subtly. They may reduce movement, hide, sleep more, eat less, groom differently, or become more irritable rather than openly crying or limping. The change from your cat's normal behavior is the important signal.",
      },
      {
        question: 'What does a cat in pain look like?',
        answer:
          'A painful cat may look hunched, tense, withdrawn, sleepy, or guarded. In the face, watch the ears, eyes, muzzle, whiskers, and head position. The Feline Grimace Scale uses those five areas to structure pain scoring.',
      },
      {
        question: 'Does purring mean my cat is not in pain?',
        answer:
          'No. Cats can purr when comfortable, but they may also purr when stressed or unwell. Purring alone does not rule out pain. Look at the whole pattern: appetite, movement, hiding, posture, litter-box use, and facial tension.',
      },
      {
        question: 'Can I use one photo to know if my cat is in pain?',
        answer:
          'One photo can give useful information, especially if the face is clear and the cat is resting. But it should not be treated as a diagnosis. Compare the photo with behavior changes and contact your vet if signs persist or worsen.',
      },
      {
        question: 'What is the Feline Grimace Scale?',
        answer:
          'The Feline Grimace Scale is a pain assessment framework that looks at five facial action units: ears, eyes, muzzle, whiskers, and head position. Each is scored from 0 to 2, creating a composite score.',
      },
      {
        question: "What does CatMD's Pain Check do?",
        answer:
          "CatMD's Pain Check uses a clear face photo to estimate the five Feline Grimace Scale signals and return a 0–10 score. A score of 4 or higher means it is worth considering a vet examination. It is informational triage only, not a diagnosis.",
      },
      {
        question: 'When should I call a vet?',
        answer:
          'Call your vet if pain signs persist, worsen, or appear with appetite loss, hiding, litter-box changes, vomiting, limping, breathing changes, visible injury, or sudden weakness. In a medical emergency, contact a licensed veterinarian immediately.',
      },
    ],
    bodyHtml: `
<p>Cats can be in pain and still look almost normal.</p>

<p>That is the hard part. A cat may keep walking around the home, eating a little, grooming a little, and sleeping in her usual places. Nothing looks dramatic. Nothing looks like an emergency. But the pattern has shifted: she jumps less, hides more, eats slower, flinches when touched, or sleeps in a tighter position than she used to.</p>

<p>Pain in cats is often quiet. The job is not to panic. The job is to notice the small changes early enough to document them, watch the pattern, and know when it is time to call your vet.</p>

<h2>The short answer</h2>

<p>Yes, cats can hide pain.</p>

<p>They are not doing it to be mysterious. They are doing what cats are built to do: stay functional, stay guarded, and avoid looking vulnerable. A cat who openly shows weakness is easier to threaten, so many cats mask discomfort until the signs become harder to miss.</p>

<p>That is why pain in cats often shows up as a change in routine rather than a single obvious symptom.</p>

<p>A painful cat may:</p>
<ul>
<li>stop jumping onto furniture she used to reach easily</li>
<li>sleep more, or sleep in a tucked, guarded position</li>
<li><a href="/library/cat-hiding-illness">hide under the bed or in quiet rooms</a></li>
<li><a href="/library/cat-not-eating">eat less, or take longer to finish meals</a></li>
<li><a href="/library/cat-grooming-less">groom less, leading to a rougher coat</a></li>
<li>overgroom one painful area</li>
<li>avoid being picked up</li>
<li>become more irritable when touched</li>
<li>use the litter box differently</li>
<li>move more slowly on stairs or after waking</li>
</ul>

<p>None of these proves pain by itself. But a change from your cat's normal is worth taking seriously.</p>

<h2>Why cats are so hard to read</h2>

<p>Cats are not small dogs.</p>

<p>A dog in pain may limp obviously, whine, seek comfort, or follow you around. Some cats do that too. But many cats go quiet. They withdraw. They reduce movement. They choose safer places. They conserve energy.</p>

<p>Owners often describe it as:</p>

<p><em>"She's just getting older."</em></p>
<p><em>"She's sleeping more lately."</em></p>
<p><em>"She's become grumpy."</em></p>
<p><em>"She doesn't jump up there anymore."</em></p>
<p><em>"She still eats, so I thought she was fine."</em></p>

<p>Those details matter. A cat who has stopped doing something she used to do easily is giving you information. The change may be age, stress, arthritis, dental pain, abdominal discomfort, injury, or something else entirely. The point is not to diagnose at home. The point is to notice the drift and bring better evidence to the vet.</p>

<h2>The face may show what behavior hides</h2>

<p>One reason feline pain is difficult is that behavior changes can be subtle. The face gives another signal.</p>

<p>The <strong>Feline Grimace Scale</strong> is a research-backed pain scoring framework that looks at five facial action units:</p>

<ol>
<li>ear position</li>
<li>eye narrowing</li>
<li>muzzle tension</li>
<li>whisker position</li>
<li>head position</li>
</ol>

<p>Each signal is scored from 0 to 2. Together, they form a composite pain score.</p>

<p>This does not mean you can diagnose your cat from one photo. It means the face can carry useful information, especially when you compare it with the rest of the cat's behavior: appetite, movement, hiding, litter-box use, grooming, and mood.</p>

<h2>The five facial signs to watch</h2>

<h3>1. Ears</h3>

<p>A relaxed cat's ears usually sit forward or slightly outward. Pain can change that. The ears may rotate outward, flatten, or sit lower than usual.</p>

<p>This is not the same as a cat briefly turning her ears toward a sound. You are looking for a resting pattern: how the ears sit when the cat is still. For a deeper look at what ear position normally signals, see <a href="/library/cat-body-language-ears-whiskers-eyes">our guide to feline body language</a>.</p>

<h3>2. Eyes</h3>

<p>Pain can make the eyes look narrowed or tense. Owners often describe this as "squinting," "sleepy-looking," or "not quite herself."</p>

<p>A sleepy cat can also narrow her eyes. Context matters. If the eyes look tighter and the cat is also eating less, hiding more, moving differently, or resisting touch, that combination is more meaningful.</p>

<h3>3. Muzzle</h3>

<p>The muzzle is the area around the nose and mouth. In a comfortable cat, it often looks soft and rounded. In a painful cat, it can look tense, compressed, or pulled.</p>

<p>This is one of the harder signs for owners to notice because it is subtle. A clear front-facing photo helps.</p>

<h3>4. Whiskers</h3>

<p>Whiskers can shift with mood, curiosity, fear, and pain. In a pain face, whiskers may appear straighter, more forward, or held away from the relaxed curve you normally see.</p>

<p>Again: one whisker position does not prove anything. The signal matters more when it appears with other facial changes.</p>

<h3>5. Head position</h3>

<p>A comfortable cat often holds the head naturally above the shoulders. A painful cat may lower the head or hold it in a guarded position.</p>

<p>This is especially worth noticing if your cat is resting in an unusual posture, sitting hunched, or keeping the head lower than normal.</p>

<h2>When "she's just old" is not enough</h2>

<p>Aging changes cats. But age should not become a trash can explanation for every new behavior.</p>

<p>If your senior cat stops jumping, that may be age-related. It may also be joint pain. If she eats less, it may be fussiness. It may also be dental pain, nausea, kidney disease, or another medical issue. If she hides more, it may be stress. It may also be discomfort.</p>

<p>The useful question is not <em>"is this normal for an older cat?"</em></p>

<p>The useful question is:</p>

<p><strong>What changed, when did it start, and is the pattern continuing?</strong></p>

<p>Write that down. Take photos if there is a visible change. Track appetite. Track litter-box behavior. Track weight if you can. Vets work from patterns, and the owner is usually the only person who can see the pattern before the appointment.</p>

<h2>What to document before calling the vet</h2>

<p>If you think your cat may be in pain, document the basics.</p>

<p>Useful notes include:</p>
<ul>
<li>when the change started</li>
<li>whether appetite is normal, reduced, or absent</li>
<li>whether water intake changed</li>
<li>whether litter-box use changed</li>
<li>whether your cat is hiding more</li>
<li>whether movement changed: jumping, stairs, walking, stiffness</li>
<li>whether grooming changed</li>
<li>whether touch triggers flinching, growling, or withdrawal</li>
<li>whether the face looks different from usual</li>
<li>any vomiting, coughing, breathing changes, or visible injury</li>
</ul>

<p>Take one clear face photo in good light. Take a short video of walking or jumping if movement changed. If there is a wound, swelling, eye issue, or posture change, photograph that too.</p>

<p>Do not force painful movement for a video. Document what naturally happens.</p>

<h2>When to contact a vet</h2>

<p>Contact your vet if pain signs persist, worsen, or appear alongside other health changes.</p>

<p>Call promptly if your cat is:</p>
<ul>
<li>not eating</li>
<li>hiding and refusing interaction</li>
<li>limping or struggling to walk</li>
<li>crying out when touched</li>
<li>repeatedly vomiting</li>
<li>straining in the litter box</li>
<li>breathing with effort</li>
<li>unable to settle</li>
<li>suddenly weak or collapsed</li>
<li>showing a painful eye, swollen area, wound, or injury</li>
</ul>

<div class="callout warn">
<strong>Some signs should not wait.</strong> Open-mouth breathing, collapse, seizure, suspected poisoning, inability to urinate, or severe sudden weakness are emergency situations. Contact a licensed veterinarian immediately.
</div>

<h2>How CatMD's Pain Check works</h2>

<p>CatMD's Pain Check is built around the Feline Grimace Scale.</p>

<p>You take one clear photo of your cat's face. CatMD estimates the five FGS facial action units — ears, eyes, muzzle, whiskers, and head position — and returns a 0–10 pain score.</p>

<p>A score of 4 or higher means it is worth considering a vet examination.</p>

<p>The point is not to diagnose your cat. CatMD is informational triage only. Not a diagnosis. Not veterinary advice. It is designed to pair with your vet, not replace one.</p>

<p>The value is documentation: a structured score, a saved result, and a clearer record of what you noticed.</p>

<h2>Why one pain score is not the whole story</h2>

<p>Pain rarely lives alone.</p>

<p>A cat with discomfort may also eat less. Drink differently. Use the litter box differently. Move less. Sleep more. Hide. Groom less. Lose weight. Become quieter or more irritable.</p>

<p>That is why CatMD does not treat Pain Check as an isolated novelty. Pain scores can sit alongside scans, appetite logs, weight, water, litter, medications, vaccinations, vet visits, and Health Rhythm trends.</p>

<p>A single photo answers one question:</p>

<p><em>"What does her face look like right now?"</em></p>

<p>A pattern answers a better one:</p>

<p><em>"What has changed over the last week?"</em></p>

<p>That is the part owners miss when they rely on memory. We normalize slow changes. We forget when they started. We tell ourselves the cat is probably fine because nothing dramatic happened.</p>

<p>A record keeps you honest.</p>

<h2>A simple home check</h2>

<p>Once a week, look at your cat as if you were describing her to someone else.</p>

<p>Ask:</p>
<ul>
<li>Is she jumping to the same places?</li>
<li>Is she eating the same amount?</li>
<li>Is she grooming normally?</li>
<li>Is she using the litter box normally?</li>
<li>Is she hiding more?</li>
<li>Is she sleeping in a new position?</li>
<li>Does her face look softer, tighter, sleepier, or more guarded than usual?</li>
<li>Does she react differently when touched?</li>
</ul>

<p>You are not trying to become a vet. You are trying to become a better witness.</p>

<p>That is enough to change the quality of the vet conversation.</p>

<h2>What this changes</h2>

<p>The mistake is waiting for pain to become obvious.</p>

<p>With cats, obvious can be late. The earlier signs are often smaller: a jump avoided, a meal half-finished, a face that looks tighter than usual, a cat who is suddenly spending more time under the bed.</p>

<p>Take the small changes seriously. Document them. Use structured tools when they help. Call your vet when the pattern is concerning.</p>

<p>CatMD helps with the noticing. Your vet handles the medicine.</p>
`,
  },
];
