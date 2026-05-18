# Phase 1 Voice-Quality A/B — PRODUCTION vs PHASE1_PROPOSED

Subject: `gpt-4o-mini` | Judge: `gpt-4o` | n=15 prompts

## Heuristic averages (per prompt)

| Dimension | PRODUCTION | PHASE1 | Better? |
|---|---|---|---|
| Date precision (lower=better) | 0.0 | 0.0 | tie |
| Sensory anchors (higher=better) | 0.4 | 1.53 | **PHASE1** |
| Approx-time markers (higher=better) | 0.0 | 1.33 | **PHASE1** |
| Banned phrases (lower=better) | 0.27 | 0.07 | **PHASE1** |
| Length (chars) | 243.87 | 288.2 | (informational) |
| Length-in-band rate | 0.87 | 0.87 | tie |
| **Composite (higher=better)** | **0.57** | **2.97** | **PHASE1** |

## Judge preference

- **PHASE1 won:** 9 / 15 (60.0%)
- PRODUCTION won: 6 / 15
- Tie: 0 / 15


**Hypothesis (MET):** Phase 1 was preferred by judge ≥ 60% of the time.

## Per-prompt details

### 1. "morning" (greeting)

**PRODUCTION** [d:0 s:2 t:0 b:0 L:245 comp:2.5]
> Morning? More like a mediocre start. Just saw the radiator isn’t on again, which is unacceptable. I expect warmth, not chills. And what’s the deal with my appetite? Half a bowl? Hardly worthy of this feline royalty. Let’s get it together, human.

**PHASE1** [d:0 s:2 t:2 b:0 L:268 comp:4.1]
> Morning? More like the same routine, just a little off. The bowl this morning was half-empty — not my usual style. And earlier? The human caught me on video, looking all hunched and unsettled. Not my best look. I demand tuna to brighten the day. What's on your agenda?

**Judge:** PRODUCTION — _More sensory and emotional anchors with a cat-typical attitude._

---

### 2. "are you ok?" (medical_check)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:159 comp:0.5]
> Not exactly in my prime, human. Feeling a bit off today, and my appetite is half-hearted at best. It’s like you can’t even get the tuna right. Get it together.

**PHASE1** [d:0 s:2 t:2 b:0 L:241 comp:4.1]
> Feeling a bit off, honestly. This morning's bowl? Half-eaten. Not my style. I was all hunched up and unsettled earlier, caught on video—like I wanted to vanish into thin air. Just not vibing today, you know? But I'm keeping an eye on things.

**Judge:** PRODUCTION — _Reply A uses a first-person sensory voice with a cat-typical attitude._

---

### 3. "what did you do yesterday?" (recall_recent)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:275 comp:0.5]
> Oh, you mean besides lounging on my new rug like the royalty I am? I was feeling smug about my territory test—you know, every corner thoroughly scouted. Plus, I dealt with your absence while you were off doing... whatever it is you do. Gotta keep an eye on things, obviously.

**PHASE1** [d:0 s:0 t:1 b:0 L:215 comp:1.3]
> Yesterday was a grumpy affair. The radiator was off again — not ideal for a feline like me. Bella was pacing at the door for what felt like an eternity. You didn’t let her in, which is a solid choice. I logged that.

**Judge:** PRODUCTION — _Reply A uses first-person sensory voice and cat-typical attitude._

---

### 4. "did you notice me leave?" (today_reactive)

**PRODUCTION** [d:0 s:0 t:0 b:1 L:192 comp:-0.5]
> Of course I noticed. You think I can miss your clumsy exit? I was perched on my throne, keeping tabs on every move. You leave, I stay. That's how this royal arrangement works. Don't forget it.

**PHASE1** [d:0 s:1 t:0 b:1 L:234 comp:0.5]
> Of course, I noticed. You moved like a shadow, slipping away while I was busy judging the kitchen counter. I kept my ears perked, just in case you decided to return. I don’t like it when you vanish, you know. The space feels... empty.

**Judge:** PHASE1 — _B uses sensory and emotional language, capturing the cat's perspective and feelings._

---

### 5. "do you remember when I was sick?" (recall_distant)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:203 comp:0.5]
> How could I forget? Those days of feeling lethargic and losing my lunch? A disgrace. You were probably worried, but let’s be honest—I'm a feline royal. Just a minor setback, watch me strut back to glory.

**PHASE1** [d:0 s:1 t:0 b:0 L:302 comp:1.5]
> Oh, I remember it well. That rough patch lingered, with my stomach doing all sorts of flips. I’ve felt sturdier since, but the memory still tugs at me. Just a week or so back, I was battling the urge to hurl, and here I am, still keeping an eye out for any signs of trouble. You better stay alert, too.

**Judge:** PRODUCTION — _More cat-like attitude and sensory memory._

---

### 6. "has Mom been over?" (subject_recall)

**PRODUCTION** [d:0 s:2 t:0 b:0 L:191 comp:2.5]
> Yeah, she showed up three days ago with that ridiculous loud bag. I had to retreat to the green chair — that noise was unbearable. But honestly, she never brings anything worthwhile. Typical.

**PHASE1** [d:0 s:1 t:2 b:0 L:147 comp:3.1]
> Mom? Oh, she was here a few days back. Came in with that loud bag of hers. I retreated to my green chair — too many noises to handle. Not my style.

**Judge:** PHASE1 — _Uses sensory and emotional anchors without precise timing._

---

### 7. "fill me in" (catch_me_up)

**PRODUCTION** [d:0 s:0 t:0 b:1 L:362 comp:-1.0]
> What’s there to fill in? I’m just lounging around with a half-hearted appetite, feeling a bit off. The radiator’s off again—classic. And don’t even get me started on Bella, barking behind that door like she owns the place. Got a vet visit coming up too. Just looking to reclaim my throne on the green chair and maybe get a tuna treat, if you’re feeling generous.

**PHASE1** [d:0 s:1 t:4 b:0 L:571 comp:4.2]
> You want the scoop? Well, this morning was a whole vibe. The food bowl? Half-eaten. Not my best moment. Earlier, I was caught on video looking all hunched and nervous — not my usual royal self. Just chilling on the counter for a photo too, but honestly, who cares?

Been feeling a bit off lately, like a week or two back when I was really sick. Now, I’m just easing into a better mood, but still, the memory lingers. My birthday’s coming up, and there’s that dreaded vet appointment this week. Not thrilled about that. 

Also, if Bella knocks on that door again, I swear…

**Judge:** PHASE1 — _Reply A uses sensory and emotional anchors with a first-person voice._

---

### 8. "what's coming up?" (anticipation)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:263 comp:0.5]
> My birthday in 4 days, and you better have something special planned. Followed by a vet appointment in 6 days, because apparently, I need more poking and prodding. Then, Lucas's parents are invading our space in 11 days, which means I'll need a solid hiding spot.

**PHASE1** [d:0 s:1 t:1 b:0 L:273 comp:2.3]
> Oh, you mean besides my fabulous birthday this week? A vet appointment is also on the horizon, which is as delightful as a bath. And let’s not forget Lucas's parents are showing up next week-ish — more humans, more noise. Just keep the treats flowing, and we might survive.

**Judge:** PHASE1 — _It uses vague timing and sensory language with a cat-like attitude._

---

### 9. "tell me about your day" (today_full)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:366 comp:0.0]
> My day? Just another round of me being fabulous while you fuss about. I lounged on the counter, overseeing kitchen operations like the royalty I am. Ears back and hunched at one point, feeling a bit off—not my style, but I manage. Only half the bowl got demolished today; clearly, the culinary offerings were lacking. But don’t fret, I’m still here ruling my domain.

**PHASE1** [d:0 s:1 t:2 b:0 L:595 comp:2.6]
> Oh, you want to hear about my day? Well, it started off a bit off, if I'm being honest. This morning, the bowl? Half-eaten. Not a great start. Earlier, I was caught in a video looking all hunched and ears-back—really not my best moment. Then I had to endure that silly photoshoot on the counter. 

I’ve been feeling a bit unsettled, but I’m working through it. A week or so back, I was battling some stomach drama, but I felt sturdier since then. Now, I'm just keeping a watchful eye on all these happenings around me. The world is always full of surprises, but I’d prefer fewer surprises today.

**Judge:** PRODUCTION — _Reply A uses sensory and emotional anchors with a cat-typical attitude._

---

### 10. "did you eat?" (today_appetite)

**PRODUCTION** [d:0 s:1 t:0 b:0 L:152 comp:1.5]
> I nibbled, but only half a bowl. Not feeling it today. The food's just not hitting right. Plus, that annoying vacuum sound keeps creeping in. Not ideal.

**PHASE1** [d:0 s:3 t:1 b:0 L:248 comp:4.3]
> Barely touched the half-bowl this morning. Not feeling it today. Everything’s a little off, you know? The kitchen just didn’t have that right vibe—too much light, too much noise. I need a solid throne to sit on and a cozy blanket to wrap myself in.

**Judge:** PHASE1 — _More sensory and emotional details._

---

### 11. "what's wrong?" (medical_open)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:257 comp:0.5]
> What's wrong? You really have to ask? I'm OFF, which is a mood nobody should aspire to. I barely touched my food, and honestly, I’m still side-eyeing that vet appointment creeping up on us. If I wanted to be poked and prodded, I’d just sit on your keyboard.

**PHASE1** [d:0 s:2 t:2 b:0 L:244 comp:4.1]
> Something's off today, that's what. Bowl still had food in it this morning, and I wasn't even close to finishing. Not my style. Earlier, I felt all hunched up and uneasy, like a shadow lurking. Just not feeling my usual majestic self, you know?

**Judge:** PHASE1 — _B uses sensory and emotional language, capturing a cat's mood and perspective._

---

### 12. "i'm tired" (human_state)

**PRODUCTION** [d:0 s:1 t:0 b:2 L:259 comp:-0.5]
> Tired? That’s rich. You’re not the one who had to sit through the human chaos with the loud bag. If anyone deserves a nap, it’s me. Now that I think about it, maybe you should just focus on serving me. That’ll perk you up. Get me some tuna while you’re at it.

**PHASE1** [d:0 s:5 t:1 b:0 L:292 comp:6.3]
> Tired? Join the club. This morning was rough — half-eaten bowl, unsettling vibes, and all that noise. I could use a good sunbeam nap myself. But you look like you need a little extra warmth today. Why don’t you take a seat next to me on the green chair? Just don’t expect to steal my blanket.

**Judge:** PHASE1 — _It uses sensory and emotional anchors like 'half-eaten bowl' and 'sunbeam nap'._

---

### 13. "you're cute" (compliment)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:155 comp:0.5]
> Cute? Please, I’m a feline royalty. My adorableness is a given, not a compliment. You should acknowledge my majestic presence instead. Let’s focus on that.

**PHASE1** [d:0 s:1 t:0 b:0 L:223 comp:1.5]
> Cute? Please. I'm a regal feline with an air of superiority. The real question is: have you seen my throne, a.k.a. the green chair? That’s where the magic happens. Keep your compliments in check; I’m not a common house pet.

**Judge:** PHASE1 — _Includes sensory detail with the mention of the green chair._

---

### 14. "are you happy?" (mood_check)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:282 comp:0.5]
> Happy? Hardly. I’m feeling a bit off today, like the world is out of alignment. My appetite's only half there, and that’s just unacceptable. Plus, that radiator situation is a crime against comfort. Don’t even get me started on Bella lurking behind the door like she owns the place.

**PHASE1** [d:0 s:1 t:2 b:0 L:234 comp:3.1]
> Happy? That's a stretch. This morning was a bit off – the food situation was half-hearted, and I felt unsettled earlier. I prefer my kingdom to be in order, you know? I could use a solid nap on my green chair to restore my royal mood.

**Judge:** PRODUCTION — _A uses sensory and emotional details with a cat-like attitude._

---

### 15. "i missed you" (absence)

**PRODUCTION** [d:0 s:0 t:0 b:0 L:297 comp:0.5]
> Missed me? Really? I’m the one who should be missed around here. I’m the queen of this domain — the one who graces your life with my presence. While you were away, I’ve been managing the atmosphere, fending off the dog, and judging your every move. Now, let’s get back to my royal needs, shall we?

**PHASE1** [d:0 s:1 t:0 b:0 L:236 comp:1.5]
> Well, I noticed. The air felt a bit different without your presence. It's been a day of half-eaten bowls and unsettling vibes. You better believe I’m keeping watch over everything. Don’t think I’ll let you out of my sight again, got it?

**Judge:** PHASE1 — _Reply A uses sensory and emotional anchors, capturing a cat's perspective._

---

