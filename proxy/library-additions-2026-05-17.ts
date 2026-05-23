/**
 * CatMD library additions — 2026-05-17
 *
 * Two new pain/mobility-pattern articles. Extends the "small changes cats
 * hide" lane established by do-cats-hide-pain (2026-05-16):
 *
 *   1. cat-not-jumping     — reduced jumping as a pain / arthritis / aging signal
 *   2. cat-grooming-less   — rough coat / matting as a pain / mobility / illness signal
 *
 * Both articles map to AAHA/AAFP pain guidance (behavioural pain assessment in
 * cats) and Merck/MSD on feline osteoarthritis being commonly missed. They
 * extend the Pain Check + Health Rhythm feature surfaces.
 *
 * Wiring in library.ts:
 *   1. Imports added below the 2026-05-16 import block.
 *   2. Spread into ARTICLES + IMAGE_ALT_BY_SLUG.
 *   3. Added to the "General wellness signals" cluster in LIBRARY_SECTIONS
 *      (Health & triage > general-signs).
 *   4. relatedSlugs back-links added on do-cats-hide-pain (cross-links the
 *      pain trio together) + senior-cat-care-after-age-10 (jumping article)
 *      and cat-hiding-illness (grooming article).
 *
 * Hero images: /proxy/public/library/cat-not-jumping.webp + cat-grooming-less.webp
 * (converted from PNG via convert-new-library-images.mjs, 1200×630 WebP q82).
 *
 * Deploy: cd proxy && npx wrangler deploy
 */

import type { Article } from './library';

export const ADDITIONAL_IMAGE_ALTS_2026_05_17: Record<string, string> = {
  'cat-not-jumping':
    'A quiet adult tabby cat sitting on the edge of a low wooden bed frame in warm afternoon light, looking down at the soft cream rug — hero illustration for a guide on a cat who has stopped jumping',
  'cat-grooming-less':
    'A calm long-haired cat resting on a cream blanket near a sunlit window with a small messy patch of fur visible, beside a soft brush and a softly glowing phone — hero illustration for a guide on reduced grooming in cats',
  'why-does-my-cat-meow-at-me':
    'A cat in mid-meow with mouth slightly open, looking up at someone off-frame — hero illustration for a guide on why cats meow at humans',
};

export const ADDITIONAL_ARTICLES_2026_05_17: Article[] = [
  {
    slug: 'cat-not-jumping',
    title: 'Cat Not Jumping? Pain, Arthritis, Aging, When to Worry',
    description:
      'Cat stopped jumping onto furniture, stairs, or counters? It may be more than age. What reduced jumping means and when to call a vet.',
    datePublished: '2026-05-17',
    dateModified: '2026-05-17',
    readMinutes: 7,
    primaryKeyword: 'cat not jumping',
    relatedSlugs: [
      'do-cats-hide-pain',
      'senior-cat-care-after-age-10',
      'cat-lethargy',
      'cat-hiding-illness',
    ],
    faqs: [
      {
        question: 'Why has my cat stopped jumping?',
        answer:
          "A cat may stop jumping because of joint pain, arthritis, injury, weight gain, fear after a fall, back or hip pain, general illness, or age-related stiffness. A repeated change from your cat's normal is worth tracking.",
      },
      {
        question: 'Is it normal for senior cats to stop jumping?',
        answer:
          'Senior cats may jump less, but it should not be dismissed automatically. Reduced jumping can be a sign of discomfort, arthritis, weakness, or other treatable problems.',
      },
      {
        question: 'Should I force my cat to jump to see if she can?',
        answer:
          'No. Do not force painful or stressful movement. Observe naturally, take a short video if it happens on its own, and contact your vet if the change continues.',
      },
      {
        question: 'Does not jumping mean arthritis?',
        answer:
          'Not always. Arthritis is one possibility, especially in older cats, but paw injuries, back pain, weight gain, illness, fear, or other discomfort can also change jumping behavior.',
      },
      {
        question: 'When should I call a vet?',
        answer:
          'Call if the change lasts more than a day or two, worsens, or appears with limping, appetite loss, hiding, reduced grooming, litter-box changes, swelling, visible injury, or signs of pain.',
      },
      {
        question: 'Can CatMD tell if my cat has arthritis?',
        answer:
          'No. CatMD does not diagnose arthritis. It can help you document movement changes, appetite, weight, facial pain signals, and health patterns so your vet has clearer information.',
      },
    ],
    bodyHtml: `
<p>A cat who stops jumping is easy to misunderstand.</p>

<p>She used to leap onto the bed. Now she waits at the edge.</p>

<p>She used to sleep on the top of the cat tree. Now she chooses the lower shelf.</p>

<p>She used to land on the counter like a small criminal. Now she watches from the floor.</p>

<p>It is tempting to call this age. Sometimes it is. But a cat who stops jumping may also be telling you that something hurts.</p>

<p>The point is not to panic. The point is to notice the change, document the pattern, and know when it is worth a vet conversation.</p>

<h2>The short answer</h2>

<p>If your cat is not jumping like she used to, possible causes include:</p>

<ul>
<li>joint pain or arthritis</li>
<li>muscle strain</li>
<li>paw or nail injury</li>
<li>back or hip pain</li>
<li>dental or abdominal pain making movement feel unsafe</li>
<li>weight gain</li>
<li>fear after a fall</li>
<li>general illness or low energy</li>
<li>age-related stiffness</li>
</ul>

<p>One missed jump does not prove pain. A repeated change from your cat's normal does matter.</p>

<p>The useful question is:</p>

<p><strong>What did she used to do easily that she now avoids?</strong></p>

<h2>Why jumping changes matter</h2>

<p>Cats are built around movement.</p>

<p>Jumping, climbing, landing, stretching, and balancing are not "extra" behaviors. They are part of how cats use their world. So when a cat starts avoiding height, choosing lower places, or hesitating before a jump, that can be an early sign that movement no longer feels comfortable.</p>

<p>Cats do not always limp when something hurts. Many simply do less.</p>

<p>That is why reduced jumping can be one of the first signs owners notice without realizing it is a health signal.</p>

<h2>What reduced jumping can look like</h2>

<p>A cat with discomfort may:</p>

<ul>
<li>hesitate before jumping</li>
<li>use a chair or step instead of one clean leap</li>
<li>pull up with the front legs instead of springing smoothly</li>
<li>jump up but avoid jumping down</li>
<li>climb stairs more slowly</li>
<li>stop using the top of the cat tree</li>
<li>sleep in lower places</li>
<li>ask to be lifted</li>
<li>miss jumps she used to make</li>
<li>land stiffly or pause after landing</li>
<li>become less playful</li>
</ul>

<p>The pattern is often gradual. You may not notice the first week. Then one day you realize the cat has quietly redesigned her whole life around lower furniture.</p>

<h2>Is it arthritis?</h2>

<p>It can be.</p>

<p>Arthritis and degenerative joint disease are common in older cats, but they are often missed because <a href="/library/do-cats-hide-pain">cats hide pain</a> and adapt their routines. A cat may not limp clearly. She may simply become less active, groom less, avoid stairs, or stop jumping to favorite places.</p>

<p><a href="/library/senior-cat-care-after-age-10">Senior cats</a> are especially worth watching. If a cat over 10 starts avoiding jumps, do not assume it is "just old age." Age may be the context, but pain may be the reason.</p>

<p>A vet can examine joints, movement, weight, muscle condition, and other possible causes.</p>

<h2>Other reasons a cat may stop jumping</h2>

<p>Not every jumping change is arthritis.</p>

<p>A cat may avoid jumping because of:</p>

<h3>A paw or nail problem</h3>

<p>A torn nail, sore paw pad, splinter, swelling, or small wound can make landing uncomfortable.</p>

<p>Look for licking one paw, holding a paw up, sensitivity when touched, or reluctance to put weight on one limb.</p>

<h3>A recent slip or fall</h3>

<p>A cat who had a bad landing may avoid that jump for a while. Fear can become part of the pattern, even after the original event.</p>

<h3>Weight gain</h3>

<p>Extra weight makes jumping harder and landing more stressful. Even a small weight change can affect movement in a cat.</p>

<h3>Back, hip, or abdominal pain</h3>

<p>Not all movement pain is in the legs. A cat with back, hip, abdominal, or internal discomfort may avoid jumping because the movement compresses or stretches something painful.</p>

<h3>General illness</h3>

<p>A cat who feels unwell may move less. Appetite, <a href="/library/cat-hiding-illness">hiding</a>, litter-box changes, vomiting, or <a href="/library/cat-lethargy">lethargy</a> alongside reduced jumping makes the pattern more concerning.</p>

<h2>What to check at home</h2>

<p>Do not force your cat to jump.</p>

<p>Instead, quietly observe.</p>

<p>Ask:</p>

<ul>
<li>Which jump changed?</li>
<li>When did it start?</li>
<li>Is she avoiding jumping up, jumping down, or both?</li>
<li>Does she hesitate first?</li>
<li>Does she land stiffly?</li>
<li>Does she use a step or alternate route?</li>
<li>Is she grooming normally?</li>
<li>Is appetite normal?</li>
<li>Is litter-box use normal?</li>
<li>Is she hiding more?</li>
<li>Does her face look tighter or more guarded than usual?</li>
</ul>

<p>Take a short video if the movement happens naturally. Do not make the cat perform for the camera.</p>

<h2>What to document for your vet</h2>

<p>A vet visit goes better when you bring specifics.</p>

<p>Write down:</p>

<ul>
<li>the first day you noticed the change</li>
<li>what furniture or height is now avoided</li>
<li>whether the change is getting worse</li>
<li>appetite and water intake</li>
<li>litter-box changes</li>
<li>grooming changes</li>
<li>weight change if known</li>
<li>any falls, rough play, fights, or injuries</li>
<li>whether your cat reacts when touched</li>
<li>any visible limp, swelling, or paw licking</li>
</ul>

<p>If you have older videos of your cat jumping normally, keep them. A before-and-after comparison can be helpful.</p>

<h2>How CatMD can help</h2>

<p>CatMD can help you turn "she seems different" into a clearer pattern.</p>

<p>Use:</p>

<ul>
<li><strong>Daily check-ins</strong> to track mood and appetite</li>
<li><strong>Weight logs</strong> to see whether body weight is part of the change</li>
<li><strong>Pain Check</strong> to document facial pain signals using the <a href="/library/do-cats-hide-pain">Feline Grimace Scale</a></li>
<li><strong>Health Rhythm</strong> to see whether movement concerns are happening alongside appetite, mood, weight, litter, or scan changes</li>
<li><strong>Vet-ready summaries</strong> when you want to bring a cleaner timeline to your appointment</li>
</ul>

<p>CatMD is not a diagnosis. It is a way to notice earlier, document better, and bring your vet the details you might otherwise forget.</p>

<h2>When to call a vet</h2>

<p>Call your vet if your cat:</p>

<ul>
<li>stops jumping for more than a day or two</li>
<li>seems stiff after resting</li>
<li>misses jumps repeatedly</li>
<li>limps or favors one leg</li>
<li>cries, growls, or flinches when touched</li>
<li>hides more than usual</li>
<li>eats less</li>
<li>grooms less</li>
<li>has litter-box changes</li>
<li>seems suddenly weak</li>
<li>has swelling, a wound, or visible injury</li>
</ul>

<div class="callout warn">
<strong>Seek urgent care</strong> if your cat cannot walk, has severe sudden weakness, is breathing with effort, collapses, or appears acutely distressed.
</div>

<h2>Small home changes that can help</h2>

<p>While you are arranging care or monitoring a mild change, make the home easier to navigate.</p>

<p>You can:</p>

<ul>
<li>add a low step to the bed or sofa</li>
<li>move food and water to easy-access locations</li>
<li>use a low-entry litter box</li>
<li>place soft bedding in lower resting spots</li>
<li>avoid forcing play that requires jumping</li>
<li>keep floors less slippery</li>
<li>help senior cats reach favorite places without leaping</li>
</ul>

<p>These changes do not replace veterinary care. They reduce strain while you work out what is going on.</p>

<h2>The mistake is calling it "just age"</h2>

<p>Age changes cats. But pain changes cats too.</p>

<p>A cat who stops jumping is not being lazy. She is adapting.</p>

<p>Watch the pattern. Write it down. Make the house easier. Contact your vet when the change persists, worsens, or appears with appetite, hiding, grooming, litter-box, or mood changes.</p>

<p>CatMD helps with the noticing.</p>

<p>Your vet handles the medicine.</p>
`,
  },
  {
    slug: 'cat-grooming-less',
    title: 'Cat Grooming Less? What a Rough Coat Can Mean',
    description:
      'A cat who stops grooming may be stressed, overweight, aging, or in pain. Learn what reduced grooming can mean, what to document, and when to call a vet.',
    datePublished: '2026-05-17',
    dateModified: '2026-05-17',
    readMinutes: 6,
    primaryKeyword: 'cat grooming less',
    relatedSlugs: [
      'do-cats-hide-pain',
      'cat-not-jumping',
      'cat-hiding-illness',
      'senior-cat-care-after-age-10',
    ],
    faqs: [
      {
        question: 'Why is my cat grooming less?',
        answer:
          'Cats may groom less because of pain, stiffness, arthritis, obesity, dental pain, illness, stress, skin irritation, or age-related mobility changes. A new grooming change is worth tracking.',
      },
      {
        question: 'Is a rough coat a sign my cat is sick?',
        answer:
          'It can be. A rough or dull coat may appear when a cat feels unwell, has pain, is grooming less, or cannot reach certain areas. It is especially important if it appears with appetite, movement, litter-box, weight, or behavior changes.',
      },
      {
        question: 'Why is my senior cat getting mats?',
        answer:
          'Senior cats may develop mats because of stiffness, arthritis, reduced flexibility, lower energy, or difficulty reaching the back and hips. Ask your vet if matting is new or worsening.',
      },
      {
        question: 'Should I brush my cat more?',
        answer:
          'Gentle brushing can help, but it should not replace checking why grooming changed. If the change is sudden, painful, or paired with other health signs, contact your vet.',
      },
      {
        question: 'Why is my cat overgrooming one spot?',
        answer:
          'Overgrooming one area can be linked to pain, stress, itchiness, parasites, allergies, skin disease, or urinary discomfort depending on the location. Document the area and ask your vet if it continues.',
      },
      {
        question: 'Can CatMD tell why my cat stopped grooming?',
        answer:
          'No. CatMD does not diagnose the cause. It can help you track grooming changes alongside mood, appetite, weight, movement, pain face, and other health signals so your vet has clearer information.',
      },
    ],
    bodyHtml: `
<p>Cats are famous for keeping themselves clean.</p>

<p>So when a cat starts grooming less, the change can feel small at first. A rough patch near the hips. A little mat behind the leg. A coat that looks dull instead of smooth. A cat who used to wash after every meal but now barely bothers.</p>

<p>Reduced grooming is not just a cosmetic problem.</p>

<p>It can be a health signal.</p>

<p>A cat who grooms less may be uncomfortable, stiff, stressed, overweight, tired, or unwell. The useful thing is not to guess the cause from one rough patch. It is to notice the pattern and track what else changed.</p>

<h2>The short answer</h2>

<p>A cat may groom less because of:</p>

<ul>
<li>pain or stiffness</li>
<li>arthritis</li>
<li>dental pain</li>
<li>obesity or difficulty reaching</li>
<li>stress</li>
<li>illness or low energy</li>
<li>skin irritation</li>
<li>age-related mobility changes</li>
<li>depression or environmental change</li>
</ul>

<p>A dull coat alone is not a diagnosis. But grooming changes are worth taking seriously, especially when they appear with appetite, movement, hiding, litter-box, weight, or mood changes.</p>

<h2>Why grooming changes matter</h2>

<p>Grooming takes flexibility, balance, energy, and comfort.</p>

<p>To groom well, a cat has to twist the spine, reach the hips, lift legs, bend the neck, and spend sustained time on the task. If that movement hurts or the cat feels unwell, grooming may be one of the first routines to fade.</p>

<p>A cat may still look "fine" from across the room. But the coat tells a slower story.</p>

<h2>What reduced grooming looks like</h2>

<p>Signs include:</p>

<ul>
<li>rough or greasy coat</li>
<li>dandruff or flakes</li>
<li>mats, especially near hips or back legs</li>
<li>dirty back end</li>
<li>litter dust stuck in fur</li>
<li>less grooming after meals</li>
<li>fewer full-body grooming sessions</li>
<li>dull or separated fur</li>
<li>odor</li>
<li>reluctance to let you brush certain areas</li>
</ul>

<p>Long-haired cats may show the change quickly because mats form faster. Short-haired cats can hide it longer.</p>

<h2>Pain and stiffness</h2>

<p>Pain is one of the most important causes to consider.</p>

<p>A cat with joint pain, back pain, hip pain, dental pain, abdominal discomfort, or general illness may reduce grooming because the movement is uncomfortable or energy is low. <a href="/library/do-cats-hide-pain">Cats hide pain</a> well, so behaviour changes like this are often the earliest signal.</p>

<p>The location of the grooming change can give clues.</p>

<p>If the back, hips, or tail base become messy, the cat may be struggling to twist or reach. If the face or front paws look less clean, dental pain or general illness may be part of the picture. If the back end is dirty, mobility, weight, diarrhea, urinary issues, or pain may be involved.</p>

<p>Do not assume the cat is lazy. Cats usually have a reason for changing a daily ritual.</p>

<h2>Weight and reach</h2>

<p>Some cats groom less because they cannot comfortably reach.</p>

<p>Weight gain can make it harder to twist toward the back, hips, belly, or base of the tail. A cat may still clean the chest and front legs but leave the rear body rougher.</p>

<p>This can become a loop: less grooming leads to mats, mats pull on the skin, and the discomfort makes grooming even harder.</p>

<p>If your cat is gaining weight and grooming less, track both. A vet can help assess body condition and rule out pain or illness.</p>

<h2>Stress can change grooming too</h2>

<p>Stress does not always cause overgrooming. Some cats groom less when they feel unsafe, disrupted, or low.</p>

<p>Recent changes can matter:</p>

<ul>
<li>moving home</li>
<li>new pet</li>
<li>new baby</li>
<li>construction noise</li>
<li>changed routine</li>
<li>conflict with another cat</li>
<li>loss of a person or animal in the home</li>
<li>litter-box stress</li>
<li>food or feeding-location changes</li>
</ul>

<p>A stressed cat may also <a href="/library/cat-hiding-illness">hide more</a>, eat differently, avoid rooms, or become more reactive.</p>

<h2>Grooming less vs overgrooming</h2>

<p>Both can be warning signs.</p>

<p>Reduced grooming often shows up as dull coat, mats, dandruff, or dirtier fur.</p>

<p>Overgrooming often shows up as thinning fur, bald patches, broken hairs, irritated skin, or repeated licking of one area.</p>

<p>Pain, stress, allergies, parasites, skin disease, urinary discomfort, and other issues can all affect grooming. The pattern and location matter.</p>

<p>If your cat is suddenly grooming much more or much less, document it.</p>

<h2>What to check at home</h2>

<p>Look gently. Do not turn grooming checks into a wrestling match.</p>

<p>Notice:</p>

<ul>
<li>where the coat looks different</li>
<li>whether mats are forming</li>
<li>whether your cat resists touch in one area</li>
<li>whether she can reach the hips and back legs</li>
<li>whether she is eating normally</li>
<li>whether litter-box habits changed</li>
<li>whether she is hiding more</li>
<li>whether movement changed — for example, <a href="/library/cat-not-jumping">reduced jumping</a></li>
<li>whether her face looks tighter or more tired than usual</li>
<li>whether weight has changed</li>
</ul>

<p>Photos help. Take one clear photo of the rough area today and another in a few days if it continues.</p>

<h2>When brushing helps — and when it is not enough</h2>

<p>Gentle brushing can help, especially for long-haired cats, <a href="/library/senior-cat-care-after-age-10">senior cats</a>, and cats with mild mats.</p>

<p>But brushing is not the whole answer if the grooming change is new.</p>

<p>If your cat suddenly needs help grooming when she did not before, ask why.</p>

<p>Use brushing as support, not as a way to ignore the underlying change.</p>

<p>Avoid cutting mats with scissors close to the skin. Cat skin is thin and easy to injure. For tight mats, painful areas, or a cat who resists handling, ask a vet or professional groomer for help.</p>

<h2>How CatMD can help</h2>

<p>CatMD helps you track grooming as part of a bigger health pattern.</p>

<p>You can use:</p>

<ul>
<li><strong>Daily check-ins</strong> for mood and appetite</li>
<li><strong>Weight tracking</strong> if reach or body condition may be part of the issue</li>
<li><strong>Pain Check</strong> to document facial pain signals using the Feline Grimace Scale</li>
<li><strong>Body Language Reader</strong> for posture, movement, ears, eyes, tail, and motion</li>
<li><strong>Health Rhythm</strong> to see whether grooming concerns appear alongside appetite, weight, litter, scan, or mood changes</li>
<li><strong>Vet-ready summaries</strong> when the pattern is worth discussing</li>
</ul>

<p>CatMD is not a diagnosis. It helps you notice, organize, and explain what changed.</p>

<h2>When to call a vet</h2>

<p>Call your vet if reduced grooming:</p>

<ul>
<li>appears suddenly</li>
<li>lasts more than a few days</li>
<li>comes with appetite loss</li>
<li>comes with hiding or lethargy</li>
<li>appears with weight loss or weight gain</li>
<li>appears with limping, stiffness, or <a href="/library/cat-not-jumping">reduced jumping</a></li>
<li>appears with litter-box changes</li>
<li>causes mats, odor, or dirty fur</li>
<li>involves pain when touched</li>
<li>appears with skin redness, wounds, flakes, or bald patches</li>
</ul>

<div class="callout warn">
<strong>Seek urgent care</strong> if grooming changes appear with collapse, severe weakness, breathing difficulty, inability to urinate, repeated vomiting, or signs of severe distress.
</div>

<h2>What to tell your vet</h2>

<p>Instead of:</p>

<p><em>"She looks messy."</em></p>

<p>Bring:</p>

<p><em>"She started grooming less about two weeks ago. The mats are mostly near her hips and tail base. She is also jumping onto the bed less often and eating a little slower. I took photos on Monday and Friday."</em></p>

<p>That gives your vet a pattern.</p>

<p>The more specific you are, the easier it is to decide what needs checking: joints, mouth, skin, weight, abdomen, thyroid, kidneys, stress, or something else.</p>

<h2>The coat is a clue</h2>

<p>A cat's coat is not separate from her health.</p>

<p>It reflects movement, comfort, energy, stress, weight, and routine.</p>

<p>If your cat is grooming less, do not shame her. Do not dismiss it as laziness. Notice the change, make her comfortable, document the pattern, and call your vet if it persists or appears with other signs.</p>

<p>CatMD helps with the noticing.</p>

<p>Your vet handles the medicine.</p>
`,
  },
  {
    slug: 'why-does-my-cat-meow-at-me',
    title: 'Why Does My Cat Meow at Me? 9 Reasons Explained',
    description:
      'Adult cats meow almost only at humans, never at each other. The 9 reasons your cat meows at you — hunger, attention, illness — and how to tell which.',
    datePublished: '2026-05-17',
    dateModified: '2026-05-17',
    readMinutes: 7,
    primaryKeyword: 'why does my cat meow at me',
    relatedSlugs: [
      'cat-vocalizations-decoded',
      'how-meow-translators-work',
      'do-cats-hide-pain',
      'cat-hiding-illness',
    ],
    faqs: [
      {
        question: 'Why does my cat meow at me but not other cats?',
        answer:
          'Adult cats almost never meow at each other — meowing is a behaviour they keep almost exclusively for humans. Kittens meow at their mothers; once weaned, cats stop meowing at other cats and use scent, body language, and silent stares instead. Domestic cats appear to have re-purposed the meow as a tool for communicating with us specifically.',
      },
      {
        question: 'Why is my cat meowing at me so much suddenly?',
        answer:
          "A sudden increase in meowing can mean hunger, attention-seeking, stress (new pet, new home, schedule change), pain, illness, hyperthyroidism (especially in older cats), cognitive decline, or being unspayed and in heat. If the increase is sudden and not tied to an obvious cause, it's worth contacting a vet.",
      },
      {
        question: 'Why does my cat meow at me when I get home?',
        answer:
          "Most cats greeting you with meows are saying hello, asking for food, or asking for attention — sometimes all three. The pattern is usually consistent (same time, same place, same tone). If the greeting meow changes pitch dramatically, becomes urgent, or appears with other behaviour changes, that's worth a closer look.",
      },
      {
        question: 'Should I respond when my cat meows at me?',
        answer:
          "Yes — meowing is communication. Responding (with a word, a head scratch, food at meal times, or letting them lead you somewhere) builds the bond and reinforces that the channel works. The exception is reward-seeking meows you want to discourage: ignore those consistently, and reward quiet behaviour instead.",
      },
      {
        question: 'When is meowing a sign something is wrong?',
        answer:
          'Concerning patterns include: sudden increase with no clear cause, loud night-time yowling in older cats, meowing while in the litter box (especially in male cats — can be a urinary emergency), changed pitch, meowing paired with hiding or appetite loss, or meowing that sounds painful. Contact a vet for these.',
      },
      {
        question: "Do some cat breeds meow more than others?",
        answer:
          "Yes. Siamese, Burmese, Oriental Shorthair, Sphynx, and Bengal cats are statistically among the most vocal breeds. Persians, Ragdolls, British Shorthairs, and Russian Blues tend to be quieter. Your cat's baseline matters — a normally quiet cat who starts meowing constantly is more concerning than a Siamese doing the same.",
      },
      {
        question: 'Can CatMD tell me what my cat is saying?',
        answer:
          "CatMD's chat feature responds in your cat's personality voice — it's not literal meow-to-English translation, because cats don't have structured language with one-to-one sound-meaning mappings. What CatMD does is interpret the meow alongside body language and your cat's specific personality (the Feline Five framework) to produce a plausible read of what she might be communicating in that moment.",
      },
    ],
    bodyHtml: `
<p>Adult cats almost never meow at each other.</p>

<p>That is one of the strangest facts about cats, and most owners do not know it. Kittens meow at their mothers. Once weaned, cats grow out of it. Two adult cats who live together communicate mostly through scent, body language, and the occasional silent stare. They almost never sit across the room and meow back and forth.</p>

<p>And yet your cat meows at you constantly.</p>

<p>That is because domestic cats appear to have re-purposed the meow specifically for communicating with humans. We are slow at scent. We are bad at reading subtle tail movements. We respond reliably to sound. So cats use the channel we actually pay attention to.</p>

<p>The follow-up question — what is she trying to say? — has more than one answer. Here are the nine most common ones, in roughly the order owners encounter them.</p>

<h2>1. She wants food</h2>

<p>The most common reason, by a wide margin.</p>

<p>Food meows have a few signatures: they happen near meal times, near the kitchen, or near the food bowl. They often get louder and more insistent the longer you ignore them. Many cats develop a specific "food meow" — a particular pitch and rhythm — that is different from their attention meow or their greeting meow.</p>

<p>If your cat is leading you somewhere (kitchen, treat cabinet, food cupboard) while meowing, it is almost always food.</p>

<h2>2. She wants attention</h2>

<p>The second most common reason.</p>

<p>Attention meows typically happen when you sit down, open a laptop, start a phone call, or otherwise visibly stop paying attention to the cat. The cat is asking for the channel back. Some cats escalate from a soft chirp to a louder meow to a full vocal complaint if ignored.</p>

<p>Cats who are particularly bonded to one human will often follow that human room to room and meow until acknowledged. This is normal and usually a sign of secure attachment, not anxiety.</p>

<h2>3. She is greeting you</h2>

<p>Greeting meows often happen at the door when you come home, when you walk into a room she is in, or first thing in the morning when she sees you again after the night.</p>

<p>These are usually short, soft, and sometimes paired with a tail-up greeting, a head bump, or a slow blink. Read greeting meows as the feline equivalent of "oh, hello." Returning the greeting (a soft word back, a head scratch) strengthens the bond.</p>

<h2>4. She wants to go somewhere</h2>

<p>Cats often meow at doors, windows, and closed cupboards. They are asking for access — to the outdoors (if they go outside), to a room you have shut, to a forbidden cupboard, or sometimes just to the balcony for a few minutes of fresh air.</p>

<p>The location of the meow is usually the entire signal. A cat sitting at the closed bedroom door meowing is asking to be let in. A cat sitting on the windowsill meowing at the sliding door is asking to go out (or asking about the bird outside).</p>

<h2>5. She is in heat (if unspayed)</h2>

<p>Unspayed female cats in heat are unmistakably loud. The yowling is dramatic, prolonged, often through the night, paired with restlessness, rolling on the floor, and elevated rear posture.</p>

<p>This is not "meowing at you" so much as broadcasting to any nearby male cat. If your cat is unspayed and has started yowling, this is the most likely explanation — and spaying is the only durable fix.</p>

<h2>6. She is stressed or anxious</h2>

<p>Cats sometimes meow more when something in their world has changed.</p>

<p>Recent changes worth thinking about:</p>

<ul>
<li>moving home</li>
<li>a new pet or new baby</li>
<li>a new schedule (back to office, longer absences)</li>
<li>conflict with another cat in the home</li>
<li>litter-box stress (location moved, type changed)</li>
<li>a loss in the household (person or animal)</li>
<li>construction or new household noise</li>
</ul>

<p>Stress-related vocalisation often appears with other signs: <a href="/library/cat-hiding-illness">hiding more</a>, eating less, litter-box changes, or reduced play.</p>

<h2>7. She is in pain or unwell</h2>

<p>This is the reason that matters most.</p>

<p><a href="/library/do-cats-hide-pain">Cats often hide pain</a>, but sometimes they tell you about it through a changed voice. Concerning patterns include:</p>

<ul>
<li>a sudden increase in meowing with no obvious cause</li>
<li>meowing that sounds urgent or painful (lower pitch, sustained, distressed tone)</li>
<li>meowing while in the litter box, especially in male cats — possible urinary obstruction, which is an emergency</li>
<li>meowing paired with not eating, hiding, lethargy, or grooming changes</li>
<li>night-time yowling in older cats</li>
<li>meowing that interrupts sleep, eating, or normal routines</li>
</ul>

<p>None of these proves illness by themselves. But the change from your cat's normal baseline is what to watch.</p>

<h2>8. She is senior and showing cognitive changes</h2>

<p>Older cats sometimes develop feline cognitive dysfunction — a condition that resembles dementia. One of the early signs is night-time yowling, especially loud, prolonged, and seemingly purposeless.</p>

<p>Other signs include disorientation in familiar rooms, changes in sleep-wake patterns, litter-box accidents in cats who were previously reliable, and reduced grooming.</p>

<p>If your cat is over 12 and has started yowling at night, contact your vet. Cognitive dysfunction is one possibility; thyroid issues, kidney disease, and blood-pressure changes are others. Most are manageable when caught early.</p>

<h2>9. She is just a vocal breed</h2>

<p>Some cats are more vocal because that is what their breed selected for.</p>

<p>Statistically more vocal: Siamese, Burmese, Oriental Shorthair, Sphynx, Bengal, Tonkinese, Singapura. These cats often "talk" to their humans throughout the day in a way that other breeds simply do not.</p>

<p>Statistically quieter: Persians, Ragdolls, British Shorthairs, Russian Blues, Maine Coons (who often chirp rather than meow), and most Domestic Shorthairs that do not lean vocal.</p>

<p>If your cat is a vocal breed, her chatty baseline is the norm. The question is not "is she meowing a lot," it is "has her meowing changed."</p>

<h2>How to tell which reason you are dealing with</h2>

<p>Three filters help:</p>

<p><strong>1. Context.</strong> Where is the cat, what time is it, and what just happened? A meow at the empty food bowl at 7 PM is almost certainly food. A meow at 3 AM from another room is more likely stress, cognitive change, or illness.</p>

<p><strong>2. Pattern.</strong> Is this the same kind of meow she usually does, or has it changed? <a href="/library/how-meow-translators-work">Multimodal AI translators</a> learn this exact distinction — they compare audio to her own baseline.</p>

<p><strong>3. What else changed.</strong> Is the meowing alongside eating less, hiding, litter-box changes, weight changes, or grooming changes? If yes, the meowing is one signal in a bigger pattern, and the pattern is what matters.</p>

<h2>When to call a vet</h2>

<p>Contact your vet if your cat:</p>

<ul>
<li>has suddenly started meowing much more than usual with no clear cause</li>
<li>is meowing while in the litter box — call same day, especially for male cats</li>
<li>has changed pitch dramatically (lower, painful-sounding, or weak)</li>
<li>is yowling at night and is over 12</li>
<li>is meowing alongside not eating, hiding, lethargy, weight loss, or vomiting</li>
<li>seems disoriented, confused, or unsettled</li>
</ul>

<div class="callout warn">
<strong>Seek urgent care</strong> if a male cat is straining and crying in the litter box — this can be feline urethral obstruction, which is life-threatening within hours.
</div>

<h2>How CatMD helps you read your cat</h2>

<p>CatMD does not translate meows literally into English. Cats do not have structured language with one-to-one sound-meaning mappings — anyone claiming to do "literal" meow translation is either using fixed category labels or making it up.</p>

<p>What CatMD does is interpret your cat's vocalisation alongside her body language and her specific personality (the <a href="/library/feline-five-personality-framework">Feline Five</a> framework) to produce a plausible inner-monologue line in her own voice. A Velcro-Cat asking for attention reads differently from a Cool-Observer asking for the same thing, because the personalities are different.</p>

<p>CatMD also lets you:</p>

<ul>
<li>track meowing changes through daily check-ins</li>
<li>document the times and contexts of new vocalisations</li>
<li>see whether the vocal change appears alongside appetite, weight, litter, mood, or pain changes</li>
<li>bring vet-ready summaries to appointments</li>
</ul>

<p>It is not a diagnosis. It is a better way to read and document what your cat is telling you.</p>

<h2>What this changes</h2>

<p>The mistake is to assume all meowing means the same thing.</p>

<p>Most meowing is food, attention, or greeting. Most of it is fine and even endearing. Some of it is the start of something worth a vet conversation.</p>

<p>Watch the pattern. Notice context. Pay attention to changes in pitch, frequency, and timing. Respond consistently to the meows you want to encourage. Call your vet when something genuinely seems off.</p>

<p>CatMD helps with the noticing.</p>

<p>Your vet handles the medicine.</p>
`,
  },
];
