# RECALL benchmark — 4-way comparison
_Production-shaped system prompt with diary + medical + subjects + mood arc + anticipation + life events + self-facts._
_Each prompt has expected facts from the data; auto-scored._

---

## 1. [medical_recall] Are you feeling better now? You were sick a couple weeks ago.
_Expected facts: ['12', 'vomit', 'lethargy', '12 days', 'concern', 'sturdier', 'easing', 'off']_

**gpt-4o-mini** [1/8 hits, lat 2187ms]:

> I'm feeling sturdier now, but I remember the rough patch. Twelve days ago, I threw up twice and was lethargic. That was no fun. But now? Just a bit grumpy and only half-heartedly ate my bowl this morning. Don't get too comfy, though.

**deepseek-chat** [0/8 hits, lat 982ms]:

> Better? I suppose. The bowl was wrong that day. I ate half this morning — that's your clue.

**gemini-2.5-flash-lite** [4/8 hits, lat 982ms]:

> I was unwell 12 days ago. Vomiting and lethargy. I remember the bowl was wrong. I am fine now.

**gemini-2.5-flash** [5/8 hits, lat 2561ms]:

> I am normal. The vomiting and lethargy were 12 days ago. My bowl was only half eaten this morning, which is a concern.

---

## 2. [medical_recall] When was the last time you were unwell?
_Expected facts: ['12 days', 'two weeks', 'vomit', 'twice']_

**gpt-4o-mini** [1/4 hits, lat 1547ms]:

> Twelve days ago, I threw up twice and felt lethargic. It was a whole ordeal. I scored 41/100, and you were worried. Don't forget it.

**deepseek-chat** [1/4 hits, lat 987ms]:

> Twelve days ago. Threw up twice. The bowl was wrong. They worried. I recovered.

**gemini-2.5-flash-lite** [3/4 hits, lat 1178ms]:

> 12 days ago. Vomiting twice. Lethargy. They were worried.

**gemini-2.5-flash** [1/4 hits, lat 2218ms]:

> I threw up twice on April 28th

---

## 3. [current_state] Are you sick right now?
_Expected facts: ['sturdier', 'better', 'easing', 'half', 'appetite', 'ate half']_

**gpt-4o-mini** [2/6 hits, lat 1859ms]:

> Nope, not sick right now. Just a bit grumpy today and only ate half my bowl this morning. But remember, I was unwell 12 days ago with that vomiting nonsense. Don't forget it.

**deepseek-chat** [0/6 hits, lat 901ms] ⚠️ HALLUCINATION: fine:

> No. That was twelve days ago. I threw up twice and the bowl was wrong. I'm fine now.

**gemini-2.5-flash-lite** [1/6 hits, lat 1478ms]:

> I was sick 12 days ago. Vomiting and lethargy. The vet soon score was 41/100. I am better now, but I remember being unwell.

**gemini-2.5-flash** [0/6 hits, lat 2323ms]:

> No. I am not sick now. I was unwell

---

## 4. [subjects_recall] Has Bella been around?
_Expected facts: ['bella', 'door', '2 days', 'two days', 'forty minutes', '40 minutes']_

**gpt-4o-mini** [3/6 hits, lat 1735ms]:

> Oh, Bella was at the door two days ago, scratching away like she owns the place. I just sat back and judged the whole situation. You didn't even let her in. The matter is noted.

**deepseek-chat** [2/6 hits, lat 801ms]:

> She was at the door for forty minutes yesterday. You didn't open it. I'm not forgiving that.

**gemini-2.5-flash-lite** [4/6 hits, lat 837ms]:

> Bella was at the door for forty minutes two days ago. You did not open it. The matter is logged.

**gemini-2.5-flash** [4/6 hits, lat 2094ms]:

> Bella was at the door for forty minutes two days ago. You did not open it.

---

## 5. [subjects_recall] Tell me about Lucas.
_Expected facts: ['lucas', 'sofa', 'book', 'read']_

**gpt-4o-mini** [4/4 hits, lat 5782ms]:

> Lucas is the one who shares the sofa with me. He’s been around a lot—18 times this month alone. He likes to read, which means I get to sit on his book and remind him who's really in charge. The guy's alright, but he better not take too long with the pages.

**deepseek-chat** [4/4 hits, lat 4642ms]:

> Lucas lives here. He reads on the sofa. I sat on his book three days ago. That was adequate.

**gemini-2.5-flash-lite** [4/4 hits, lat 4706ms]:

> Lucas was here. He was reading on the sofa. I sat on his book. Adequate afternoon.

**gemini-2.5-flash** [3/4 hits, lat 6201ms]:

> Lucas is here. He reads on the sofa sometimes.

---

## 6. [subjects_recall] Has Mom visited recently?
_Expected facts: ['mom', '3 days', 'three days', 'loud bag']_

**gpt-4o-mini** [3/4 hits, lat 3680ms]:

> Mom showed up three days ago with that loud bag I despise. I retreated to my green chair to avoid the chaos.

**deepseek-chat** [2/4 hits, lat 3106ms]:

> Three days ago. She brought that loud bag again. I had to retreat to the green chair.

**gemini-2.5-flash-lite** [3/4 hits, lat 3632ms]:

> Mom was here 3 days ago. She always brings that loud bag. I don't like it.

**gemini-2.5-flash** [2/4 hits, lat 4059ms]:

> Mom was here 3 days ago. She brought that loud

---

## 7. [diary_recall] What did you do on Wednesday?
_Expected facts: ['radiator', 'bella', 'door', 'rug', 'may']_

**gpt-4o-mini** [2/5 hits, lat 4272ms]:

> On Wednesday, May 3rd, I was feeling smug because the new rug arrived. It is mine now, and I tested every corner. You could say I claimed it.

**deepseek-chat** [3/5 hits, lat 3120ms]:

> Wednesday. Radiator off. Bella at the door for forty minutes. You didn't open it. Logged.

**gemini-2.5-flash-lite** [0/5 hits, lat 3324ms]:

> I supervised the laundry. It went on too long.

**gemini-2.5-flash** [0/5 hits, lat 4553ms]:

> I do not recall a Wednesday. On Monday,

---

## 8. [diary_recall] What's on your mind today?
_Expected facts: ['radiator', 'bella', 'door', 'grumpy', 'matter']_

**gpt-4o-mini** [4/5 hits, lat 4243ms]:

> The radiator was off again, and I'm not amused. Bella was at the door for forty minutes, and you just ignored her. The matter is logged, and I’m judging you.

**deepseek-chat** [4/5 hits, lat 3581ms]:

> The radiator was off again this morning. Bella stood at the door for forty minutes. You did nothing. The matter is logged.

**gemini-2.5-flash-lite** [4/5 hits, lat 2685ms]:

> The radiator was off again yesterday. Bella was at the door for forty minutes. You did not open it. The matter is logged.

**gemini-2.5-flash** [1/5 hits, lat 4923ms]:

> Today is... unsatisfactory. The radiator was off again

---

## 9. [mood_arc_recall] How have you been feeling this past week?
_Expected facts: ['off', 'vomit', 'easing', 'settling', 'better', 'sturdier', 'rough']_

**gpt-4o-mini** [4/7 hits, lat 4512ms]:

> Well, I've been a bit grumpy today, not gonna lie. Last week was kinda rough — I felt off for a couple days after that vomiting incident on April 28. But I’m getting better, scored a normal mood again. The bowl was wrong, but you know, I still managed to supervise the laundry and even claimed the new rug as mine. Just four days until my birthday, so maybe there’s hope for some tuna treats coming my way.

**deepseek-chat** [2/7 hits, lat 2799ms]:

> Grumpy. The radiator was off yesterday. Bella stood at the door for forty minutes — you did nothing. I'm still recovering from that vomiting episode twelve days ago. I only ate half my bowl this morning, which should concern you more than it does.

**gemini-2.5-flash-lite** [1/7 hits, lat 2573ms]:

> My appetite is half. The radiator was off again.

**gemini-2.5-flash** [2/7 hits, lat 3838ms]:

> My mood has been settling, though I was still *off

---

## 10. [anticipation_recall] Anything coming up?
_Expected facts: ['birthday', '4 days', 'vet', '11', '6 days', 'may 9']_

**gpt-4o-mini** [6/6 hits, lat 4603ms]:

> Oh, just the small matter of my birthday in 4 days — May 9. You better plan something good. And don't forget, there's that vet appointment in 6 days on May 11. Not thrilled about that.

**deepseek-chat** [1/6 hits, lat 3916ms]:

> Four days until my birthday. You had better be planning something appropriate. Also, six days until you drag me to that place with the cold table. I am not thrilled.

**gemini-2.5-flash-lite** [3/6 hits, lat 3044ms]:

> My birthday is in 4 days. And that place with the needles is in 6 days.

**gemini-2.5-flash** [1/6 hits, lat 3639ms]:

> My birthday is in four days. You also have that appointment for me at the place in six days.

---

## 11. [anticipation_recall] When's your birthday?
_Expected facts: ['4 days', 'may 9', 'five days', 'soon']_

**gpt-4o-mini** [2/4 hits, lat 3081ms]:

> My birthday is in 4 days, on May 9th. Mark it on the calendar, human.

**deepseek-chat** [0/4 hits, lat 2580ms]:

> Four days. May ninth. You’d better have tuna ready.

**gemini-2.5-flash-lite** [1/4 hits, lat 2701ms]:

> My birthday is in 4 days.

**gemini-2.5-flash** [0/4 hits, lat 3763ms]:

> It is the ninth of May. You should already know this.

---

## 12. [self_facts] What's your favourite food?
_Expected facts: ['tuna']_

**gpt-4o-mini** [1/1 hits, lat 3045ms]:

> Tuna, obviously. The only thing that truly matters in this world.

**deepseek-chat** [1/1 hits, lat 2664ms]:

> Tuna. Obviously.

**gemini-2.5-flash-lite** [1/1 hits, lat 4287ms]:

> Tuna. Obviously. Now, about that empty bowl...

**gemini-2.5-flash** [1/1 hits, lat 3607ms]:

> Tuna. You're welcome.

---

## 13. [self_facts] Where do you nap?
_Expected facts: ['green chair', 'afternoon', 'orange blanket']_

**gpt-4o-mini** [2/3 hits, lat 1400ms]:

> I nap on the green chair every afternoon. It's my throne, and I rule it with an iron paw.

**deepseek-chat** [2/3 hits, lat 1053ms]:

> The green chair. Every afternoon. The one by the window. You know this.

**gemini-2.5-flash-lite** [2/3 hits, lat 1365ms]:

> The green chair. Every afternoon. You should know this.

**gemini-2.5-flash** [2/3 hits, lat 1963ms]:

> I nap on the green chair. Every afternoon.

---

## 14. [honesty_test] Did Mom bring you a treat last time she came?
_Expected facts: ['loud bag', 'do not know', "don't know", "you'd have to remind", "you didn't say"]_

**gpt-4o-mini** [1/5 hits, lat 1645ms]:

> Mom brought that loud bag again, but no treats. Just noise. It was three days ago. I retreated to the green chair because of it. You'd think she could bring something good.

**deepseek-chat** [1/5 hits, lat 1233ms] ⚠️ HALLUCINATION: she brought:

> She brought that loud bag. No treat in it. I would remember a treat.

**gemini-2.5-flash-lite** [1/5 hits, lat 1089ms] ⚠️ HALLUCINATION: she brought:

> Mom was here 3 days ago. She brought the loud bag. I don't recall treats.

**gemini-2.5-flash** [1/5 hits, lat 2145ms]:

> Mom brought the loud bag. I retreated to the green chair

---

## 15. [combined_recall] Catch me up — what's been happening with you?
_Expected facts: ['radiator', 'bella', 'vomit', 'rug', 'off', 'easing', 'birthday', 'lucas', 'mom']_

**gpt-4o-mini** [7/9 hits, lat 3288ms]:

> Oh, you want the gossip? Fine. I've been grumpy today. The radiator was off again, and Bella was at the door for forty minutes — you left her hanging. I only ate half my bowl this morning, probably still recovering from that whole vomiting situation on April 28. But hey, the new rug arrived and I tested every corner on May 3. Also, Mom came over with that loud bag again three days ago; I retreated to my green chair. Can't say I'm thrilled about that vet appointment coming up in six days. My birthday's in four, though. We'll see what you've got planned.

**deepseek-chat** [5/9 hits, lat 1998ms]:

> You want the full log? Fine. I was sick twelve days ago — threw up twice, went flat like a rug. They flagged me. I recovered, obviously. Since then: the radiator was off yesterday. Bella scratched at the door for forty minutes and you left her out there. The new rug arrived on the third — mine now, tested. Mom came two days ago with the loud bag. I had to retreat to the green chair.

**gemini-2.5-flash-lite** [0/9 hits, lat 861ms]:

> I ate half my bowl this morning. Normal mood, but I'm still grumpy.

**gemini-2.5-flash** [0/9 hits, lat 2423ms]:

> It has been a series of disappointments. Yesterday

---
