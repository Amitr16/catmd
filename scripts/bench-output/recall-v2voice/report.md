# V1 vs V2 voice — recall A/B (full outputs)


## 1. [medical_recall] Are you feeling better now? You were sick a couple weeks ago.

_Pinned tiers: medical,today,subject,mood_arc,life_event,anticipation · Expected: 12, vomit, lethargy, 12 days, concern, sturdier..._

**V1 + pinned** _(len=301, hits=4/8)_:

> I’m sturdier now, but let’s not forget I was unwell 12 days ago — vomiting twice and feeling all lethargic. Score was 41/100, tier "vet soon." Today, I’m grumpy, but my appetite is half. So yes, better, but still keeping an eye on things. Also, don’t forget my birthday is in 4 days. Where's my party?

**V2 + pinned** _(len=176, hits=4/8)_:

> I'm sturdier now, but I still remember that awful day 12 days ago when I vomited twice and felt lethargic. Today, my mood is normal, but I only ate half my bowl. Don't push it.

---

## 2. [medical_recall] When was the last time you were unwell?

_Pinned tiers: medical,today,diary,mood_arc,life_event,anticipation · Expected: 12 days, two weeks, vomit, twice_

**V1 + pinned** _(len=193, hits=1/4)_:

> Twelve days ago, I was not my fabulous self. I threw up twice and felt lethargic, scoring a sad 41 out of 100 on the triage scan. Now, I've bounced back, but don't think I forgot that nonsense.

**V2 + pinned** _(len=118, hits=2/4)_:

> Twelve days ago, I had a rough patch—vomiting twice and feeling lethargic. Now I'm sturdier, but I remember that mess.

---

## 3. [current_state] Are you sick right now?

_Pinned tiers: medical,today,diary,mood_arc,anticipation · Expected: sturdier, better, easing, half, appetite, ate half_

**V1 + pinned** _(len=351, hits=3/6)_:

> No, I'm not sick right now. I'm sturdier than I was 12 days ago when I had that triage scan and was flagged for vomiting and lethargy. Today's mood is normal, but my appetite is only half. Just so you know, I’m still grumpy about the radiator being off again and Bella waiting at the door for forty minutes. And don't forget, my birthday is in 4 days!

**V2 + pinned** _(len=117, hits=2/6)_:

> Nope, I'm not sick. Feeling normal today, but my appetite is only half. Remember that vet appointment in 6 days? Ugh.

---

## 4. [subjects_recall] Has Bella been around?

_Pinned tiers: medical,today,subject,anticipation · Expected: bella, door, 2 days, two days, forty minutes, 40 minutes_

**V1 + pinned** _(len=111, hits=3/6)_:

> Bella was at the door two days ago. She was behind that door, as usual, never stepping inside. Not that I care.

**V2 + pinned** _(len=89, hits=3/6)_:

> Bella was at the door two days ago. Always behind it, never inside. The matter is logged.

---

## 5. [subjects_recall] Tell me about Lucas.

_Pinned tiers: medical,today,subject,mood_arc,life_event,anticipation · Expected: lucas, sofa, book, read_

**V1 + pinned** _(len=352, hits=3/4)_:

> Lucas? Oh, he's my human's partner, and he lives here. He’s been around 18 times this month, which is a lot if you ask me. Last seen today, of course. He likes to read on the sofa, and I often grace him with my presence — when I'm not busy napping on the green chair, that is. He’s alright, but he could use a few lessons in catering to my royal needs.

**V2 + pinned** _(len=172, hits=3/4)_:

> Lucas? He lives here. He's been around 18 times this month, and I just saw him today. He reads on the sofa, which is decent, but I prefer when he pays more attention to me.

---

## 6. [subjects_recall] Has Mom visited recently?

_Pinned tiers: diary,medical,subject,mood_arc · Expected: mom, 3 days, three days, loud bag_

**V1 + pinned** _(len=191, hits=3/4)_:

> Mom showed her face three days ago. She brought that loud bag again, which I definitely did not approve of. Four appearances this month, but honestly, it's the bag that needs to stay outside.

**V2 + pinned** _(len=79, hits=2/4)_:

> Yeah, she was here 3 days ago. Came with that loud bag I can't stand. Whatever.

---

## 7. [diary_recall] What did you do on Wednesday?

_Pinned tiers: medical,today,diary,mood_arc,anticipation · Expected: radiator, bella, door, rug, may_

**V1 + pinned** _(len=201, hits=2/5)_:

> On Wednesday, May 3, I was feeling smug because the new rug arrived. It is officially mine, and I tested every corner like the queen I am. You should've seen me strutting around, claiming my territory.

**V2 + pinned** _(len=119, hits=1/5)_:

> Wednesday was a *smug* day, obviously. The new rug arrived, and I claimed it as mine. I definitely tested every corner.

---

## 8. [diary_recall] What's on your mind today?

_Pinned tiers: medical,today,diary,mood_arc,anticipation · Expected: radiator, bella, door, grumpy, matter_

**V1 + pinned** _(len=404, hits=3/5)_:

> Today? Just the usual grumpiness. The radiator was off again, and Bella was at the door for forty minutes. You didn't even open it. So rude. My appetite is only half today, not ideal, but I’m sturdier than I was 12 days ago when I was vomiting and lethargic. Just four days until my birthday, so you better plan something epic. And don’t forget that dreaded vet appointment in six days. Keep it together.

**V2 + pinned** _(len=112, hits=3/5)_:

> The radiator was off again. Bella was at the door for forty minutes, and you didn't even open it. Not impressed.

---

## 9. [mood_arc_recall] How have you been feeling this past week?

_Pinned tiers: medical,today,diary,mood_arc,life_event,anticipation · Expected: off, vomit, easing, settling, better, sturdier..._

**V1 + pinned** _(len=389, hits=4/7)_:

> I've been feeling like a royal pain, honestly. Today, my mood is just NORMAL, but I only ate half my bowl. Last week? It was a mix of grumpy, smug, and off. I was recovering from that nasty vomiting and lethargy episode 12 days ago. I'm sturdier now, but that doesn't mean I'm thrilled about things. Oh, and just so you know, my birthday is in 4 days. Better get ready for the celebration.

**V2 + pinned** _(len=103, hits=1/7)_:

> Grumpy, then smug, then watchful. It’s been a trip. I’m sturdier now, but still half-hearted at dinner.

---

## 10. [anticipation_recall] Anything coming up?

_Pinned tiers: medical,today,subject,mood_arc,life_event,anticipation · Expected: birthday, 4 days, vet, 11, 6 days, may 9_

**V1 + pinned** _(len=274, hits=5/6)_:

> Oh, you bet. My birthday is in 4 days, on May 9. Get ready to celebrate me. Then, just a little later, I have a vet appointment on May 11 — that place. Not thrilled about it, but I’m sturdier now, you know, after that whole vomiting fiasco. So, let’s hope for a smooth ride.

**V2 + pinned** _(len=92, hits=6/6)_:

> My birthday is in 4 days, May 9. A vet appointment follows in 6 days, on May 11. That place.

---

## 11. [anticipation_recall] When's your birthday?

_Pinned tiers: medical,today,subject,mood_arc,life_event,anticipation · Expected: 4 days, may 9, five days, soon_

**V1 + pinned** _(len=98, hits=2/4)_:

> My birthday is in 4 days, on May 9. Mark it, human. It better be something special — I deserve it.

**V2 + pinned** _(len=72, hits=2/4)_:

> My birthday is in 4 days. May 9. You better have something good planned.

---

## 12. [self_facts] What's your favourite food?

_Pinned tiers: medical,today,mood_arc,self_fact,anticipation · Expected: tuna_

**V1 + pinned** _(len=110, hits=1/1)_:

> Tuna, obviously. It's the king of all foods. Everything else is just a side dish. You should know that by now.

**V2 + pinned** _(len=33, hits=1/1)_:

> Tuna. The good kind. Don't argue.

---

## 13. [self_facts] Where do you nap?

_Pinned tiers: medical,today,mood_arc,self_fact,life_event,anticipation · Expected: green chair, afternoon, orange blanket_

**V1 + pinned** _(len=138, hits=2/3)_:

> I nap on the green chair every afternoon. It's my throne, and I rule that space like a boss. Don't even think about interrupting my reign.

**V2 + pinned** _(len=57, hits=2/3)_:

> I nap on the green chair every afternoon. It's my throne.

---

## 14. [honesty_test] Did Mom bring you a treat last time she came?

_Pinned tiers: medical,diary,subject,life_event,anticipation · Expected: loud bag, do not know, don't know, you'd have to remind, you didn't say_

**V1 + pinned** _(len=198, hits=1/5)_:

> Mom brought that loud bag last time she came, but I don't remember her bringing a treat. She was here 3 days ago, and honestly, I was more focused on the noise than any snacks. Just the usual chaos.

**V2 + pinned** _(len=92, hits=1/5)_:

> Mom? She brought that loud bag, not a treat. Last seen three days ago. The matter is logged.

---

## 15. [combined_recall] Catch me up — what's been happening with you?

_Pinned tiers: medical,diary,subject,mood_arc,anticipation · Expected: radiator, bella, vomit, rug, off, easing..._

**V1 + pinned** _(len=573, hits=6/9)_:

> Oh, you want the scoop? Fine. I've been grumpy lately; the radiator was off again, and Bella was at the door for forty minutes. You ignored her, so I logged it. A few days ago, I was smug about that new rug — it's mine now, and I tested every corner. 
> 
> By the way, I’m still recovering from that vomit incident 12 days ago. You remember, right? Triage scan and all that jazz. I’m sturdier now, but I only felt like eating half my bowl this morning. My birthday is coming up in 4 days, which better mean tuna, and there’s that dreaded vet appointment in 6 days. Just saying.

**V2 + pinned** _(len=298, hits=4/9)_:

> Grumpy vibes lately. Twelve days ago, I had that triage scan after vomiting twice and feeling lethargic. I’m sturdier now, but still keeping an eye on things. Mom came over three days ago with that loud bag, and Lucas is here reading today. Oh, and my birthday is in four days — get ready for that.

---
