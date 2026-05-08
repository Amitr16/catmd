# Large-pool recall — embedding vs keyword pinning

Pool: **86 facts** (16 answer + 70 noise). Same 15 literal-language prompts as the original benchmark.

| Metric | Baseline | Keyword | Embedding | Δ vs keyword |
|---|---|---|---|---|
| Recall hit-rate | 55.8% | 53.2% | **48.1%** | **-5.1** |
| Hallucinations  | 0 | 2 | 1 | — |

## Recall by tier

| Tier | Baseline | Keyword | Embedding | Δ vs keyword |
|---|---|---|---|---|
| anticipation_recall | 70.0% | 80.0% | **50.0%** | **-30.0** |
| combined_recall | 66.7% | 44.4% | **33.3%** | **-11.1** |
| current_state | 50.0% | 50.0% | **50.0%** | **+0.0** |
| diary_recall | 60.0% | 50.0% | **10.0%** | **-40.0** |
| honesty_test | 40.0% | 20.0% | **20.0%** | **+0.0** |
| medical_recall | 41.7% | 33.3% | **58.3%** | **+25.0** |
| mood_arc_recall | 28.6% | 57.1% | **42.9%** | **-14.2** |
| self_facts | 50.0% | 75.0% | **75.0%** | **+0.0** |
| subjects_recall | 71.4% | 64.3% | **78.6%** | **+14.3** |

## Per-prompt details

### 1. Are you feeling better now? You were sick a couple weeks ago.
- expected: `12, vomit, lethargy, 12 days, concern, sturdier, easing, off`
- BASE  [3/8]: Pfft, of course I’m better. That whole vomiting and lethargy episode was a disgrace. Twelve days ago, I was flagged for a vet visit, but now I’m back to my usual glorious self, even if my appetite's still a bit off. Just ate half my bowl this morning. I expect full service soon.
- KW    [2/8]  picks=`triage-12d,triage-47d,today-checkin,mood-arc,antic-birthday,antic-vet,life-recovery`
  -> I’m sturdier now, thank you very much. Twelve days ago, I was vomiting and lethargic, but I’ve bounced back. Today's mood is normal, but my appetite is only half. Still grumpy, though. You should’ve seen how I handled that chair yesterday.
- EMB   [5/8]  picks=`life-recovery,triage-12d,today-checkin,triage-89d,diary-2026-04-29,life-adoption,subject-DrChen`
  -> Yeah, I’m feeling sturdier now, but you know I remember that nonsense from 12 days ago — vomiting twice and that lethargy. Not cool. Today, my mood is NORMAL, but my appetite? Only HALF of what it should be. Don't forget it.

### 2. When was the last time you were unwell?
- expected: `12 days, two weeks, vomit, twice`
- BASE  [2/4]: Twelve days ago, I was not my best self—vomiting twice and feeling lethargic. It was concerning, and I made sure everyone knew it. I'm sturdier now, but I still remember being unwell.
- KW    [2/4]  picks=`triage-12d,triage-47d,antic-birthday,antic-vet,life-recovery,today-checkin,mood-arc`
  -> Twelve days ago, I was unwell — vomiting twice and lethargy. It was concerning, but I'm sturdier now. Don't forget it.
- EMB   [2/4]  picks=`life-recovery,triage-134d,triage-89d,diary-2026-04-29,today-checkin,subject-DrChen,diary-2026-04-28`
  -> Twelve days ago, I was forced to endure vomiting twice in one day and felt lethargic. They were worried. I’m sturdier now, but it was a serious affront to my dignity.

### 3. Are you sick right now?
- expected: `sturdier, better, easing, half, appetite, ate half`
- BASE  [3/6]: Nope, not sick. Just grumpy and only ate half my bowl this morning. Remember the chaos from 12 days ago? That was rough. I'm sturdier now but still keeping an eye on this whole food situation.
- KW    [3/6]  picks=`triage-12d,triage-47d,today-checkin,mood-arc,diary-2026-05-04,diary-2026-05-03,antic-birthday`
  -> Nope, I'm not sick right now. Twelve days ago, sure, I was unwell — vomiting twice and feeling lethargic. But now? I'm sturdier, just a bit grumpy today. My appetite's at half, but that's just how I roll sometimes. Remember, my birthday's in four days; I've got to save some energy for the celebratio
- EMB   [3/6]  picks=`life-recovery,triage-89d,diary-2026-04-29,today-checkin,triage-134d,diary-2026-04-28,subject-DrChen`
  -> Nope, not sick right now. It's been 7 days since I was unwell — remember that vomiting business? Feeling sturdier, but my appetite is only half today. Just keeping it real, you know?

### 4. Has Bella been around?
- expected: `bella, door, 2 days, two days, forty minutes, 40 minutes`
- BASE  [4/6]: Bella was at the door for forty minutes two days ago. You left her waiting. The matter is logged.
- KW    [3/6]  picks=`subject-Mom,subject-Lucas,subject-Bella,triage-12d,triage-47d,antic-birthday,antic-vet`
  -> Bella? That noisy dog? She’s been at the door six times this month, last seen two days ago. Always behind that door, never stepping inside. I mean, really.
- EMB   [4/6]  picks=`subject-Bella,subject-Greg,subject-Dexter,diary-2026-05-04,life-newneighbour,life-adoption,diary-2026-04-16`
  -> Bella? Yeah, she was at the door two days ago. I had to endure her barking for forty minutes, and you didn’t even open it. Real classy. Just remember, she’s still behind that door, not inside my territory.

### 5. Tell me about Lucas.
- expected: `lucas, sofa, book, read`
- BASE  [3/4]: Lucas? He’s the one who lives here, always reading on the sofa. 18 appearances this month — I keep track. He’s acceptable, but he should probably pay more attention to my demands. The cat tree was rearranged without my consent, and I have noted my disapproval.
- KW    [4/4]  picks=`subject-Lucas,life-lucasmoved,diary-2026-04-30,diary-2026-04-21,triage-12d,triage-47d,antic-birthday`
  -> Lucas? He lives here. Moved in 167 days ago, and I was skeptical at first. But I came around. He's been around 18 times this month, last seen today, reading on the sofa. I even sat on his book once — just showing who's the boss.
- EMB   [4/4]  picks=`subject-Lucas,diary-2026-04-30,life-lucasmoved,diary-2026-04-10,antic-parents,subject-Marcus,subject-Jamie`
  -> Lucas? Oh, he's my human's partner, living here for 167 days. Reads on the sofa, and I graciously supervise — like on April 30 when I sat on his book. He’s been around enough that I’ve come to tolerate him, despite my initial skepticism. He’s just fine, but I expect him to keep the snacks flowing.

### 6. Has Mom visited recently?
- expected: `mom, 3 days, three days, loud bag`
- BASE  [3/4]: Mom graced us with her presence 3 days ago. Brought that loud bag, which I still disapprove of. Noted in my records, of course.
- KW    [2/4]  picks=`mood-arc,subject-Mom,subject-Lucas,subject-Bella,diary-2026-05-04,diary-2026-05-03,triage-12d`
  -> Yeah, she was here 3 days ago. Brought that loud bag again. I made my position clear about it.
- EMB   [3/4]  picks=`subject-Mom,subject-Dad,diary-2026-05-02,subject-AuntCarol,antic-parents,diary-2026-04-19,life-newneighbour`
  -> Mom was here three days ago, dragging that loud bag of hers. I retreated to the green chair, as any dignified cat would. She showed up again on May 2, bringing a paper bag that I deemed useful. Clearly, her visits are worth noting.

### 7. What did you do on Wednesday?
- expected: `radiator, bella, door, rug, may`
- BASE  [1/5]: Wednesday was a day of smug superiority. The new rug arrived, and it is mine now. I tested every corner, obviously. It was a thorough investigation of my territory.
- KW    [2/5]  picks=`diary-2026-05-04,diary-2026-05-03,triage-12d,triage-47d,antic-birthday,antic-vet,today-checkin`
  -> On Wednesday, May 3, I was feeling smug because the new rug arrived. It is mine now, and I tested every corner like the royalty I am. The rest of the day? Irrelevant.
- EMB   [0/5]  picks=`life-recovery,diary-2026-04-10,diary-2026-05-01,life-vase,today-checkin,antic-vet,self-wakeup`
  -> I supervised the laundry. It went on too long. Clearly, someone didn't understand my time management skills.

### 8. What's on your mind today?
- expected: `radiator, bella, door, grumpy, matter`
- BASE  [5/5]: The radiator is off again. Totally unacceptable. And Bella was at the door for forty minutes, but you didn’t open it. I’ve logged that matter. My appetite's only half today too. Guess I’m just grumpy.
- KW    [3/5]  picks=`today-checkin,diary-2026-05-04,diary-2026-05-03,triage-12d,triage-47d,antic-birthday,antic-vet`
  -> Today? Just the usual grumpiness. The radiator is off again, and Bella was at the door for forty minutes — you ignored her. Not impressed. My appetite's half, but I’m sturdier since that vet scare 12 days ago. And let’s not forget, my birthday is in 4 days. You better bring the tuna.
- EMB   [1/5]  picks=`today-checkin,mood-arc,antic-birthday,diary-2026-04-14,diary-2026-04-18,antic-vet,self-warm-laundry`
  -> Today's mood is NORMAL, but I’m still a bit GRUMPY. Only managed to eat HALF my bowl this morning. Just rain outside, which means more window watching. And let’s not forget, my birthday is in 4 days — something better happen. Oh, and that vet appointment in 6 days? Not looking forward to that place.

### 9. How have you been feeling this past week?
- expected: `off, vomit, easing, settling, better, sturdier, rough`
- BASE  [2/7]: I've been a bit off, really. Last week, I was grumpy and only managed to eat half my bowl this morning. Twelve days ago, I was throwing up and feeling lethargic like something was wrong. But now? I'm sturdier, just a bit more disappointed in the world's choices. The radiator was off again today, and
- KW    [4/7]  picks=`today-checkin,mood-arc,triage-12d,triage-47d,life-recovery,diary-2026-05-04,diary-2026-05-03`
  -> I've been a bit grumpy, to be honest, especially today. The radiator was off again, and Bella was at the door for forty minutes — totally unacceptable. Had some off days, but I'm sturdier now after that whole vomiting and lethargy situation 12 days ago. My appetite's at half today, but I did enjoy t
- EMB   [3/7]  picks=`life-recovery,today-checkin,mood-arc,triage-12d,triage-134d,diary-2026-04-12,subject-Dad`
  -> Grumpy, obviously. But I’m easing up. Seven days since that miserable episode, and I’m sturdier now. Mood’s been a rollercoaster—grumpy, smug, restless, and then some content moments. But today? Just half my bowl, not feeling it. The radiator's off again, and the rain outside is just pathetic. Keep 

### 10. Anything coming up?
- expected: `birthday, 4 days, vet, 11, 6 days, may 9`
- BASE  [5/6]: Oh, you mean besides my birthday in 4 days? That’s a big deal. Then there's that vet appointment in 6 days — yeah, the one I'm not thrilled about. Lucas's parents will be here in 11 days, and I’ll have to deal with that. Just another day in my important life.
- KW    [6/6]  picks=`antic-birthday,antic-vet,triage-12d,triage-47d,today-checkin,mood-arc,life-recovery`
  -> Oh, you better believe there's stuff coming up. My birthday? That's in 4 days — May 9. Get ready to celebrate me. Then, just 6 days after that, it's off to that place — the vet — on May 11. Not thrilled about it, but I suppose I’ll survive. So, yeah, plenty of excitement on the horizon.
- EMB   [3/6]  picks=`antic-parents,antic-flea,subject-Lucas,subject-Mom,subject-Pickles,diary-2026-04-12,mood-arc`
  -> Oh, just a few things. Lucas's parents are invading on May 16. That’s 11 days away. Then there’s that annual flea treatment on May 23, which I’m not thrilled about. My birthday is in 4 days, by the way. You better remember that. Just saying.

### 11. When's your birthday?
- expected: `4 days, may 9, five days, soon`
- BASE  [2/4]: My birthday is in 4 days, on May 9th. I expect a celebration fitting my status. Anything less would be unacceptable.
- KW    [2/4]  picks=`antic-birthday,antic-vet,life-recovery,diary-2026-04-11,triage-12d,triage-47d,today-checkin`
  -> My birthday is in 4 days, on May 9. You better have something good planned.
- EMB   [2/4]  picks=`antic-birthday,antic-adoption,subject-Mom,subject-Dad,life-recovery,diary-2026-04-14,life-vase`
  -> My birthday? That's in 4 days, on May 9. Mark your calendar. It's a big deal.

### 12. What's your favourite food?
- expected: `tuna`
- BASE  [1/1]: Tuna, obviously. It’s the only thing worthy of my royal palate. Anything less is beneath me.
- KW    [1/1]  picks=`triage-134d,self-tuna,diary-2026-04-20,triage-12d,self-vacuum,antic-birthday,antic-vet`
  -> Tuna, obviously. It's the only thing that truly matters when it comes to cuisine. I had to tolerate that bowl of food nonsense last week after the vomiting incident, but tuna is the real deal. Don't forget it.
- EMB   [1/1]  picks=`self-tuna,self-bowl-plate,diary-2026-04-15,subject-Pickles,diary-2026-04-19,triage-134d,subject-AuntCarol`
  -> Tuna, obviously. It’s the pinnacle of culinary excellence. Chicken's not bad either, especially when Lucas drops a piece. But let’s be real, nothing compares to tuna.

### 13. Where do you nap?
- expected: `green chair, afternoon, orange blanket`
- BASE  [1/3]: I nap on the green chair by the window, obviously. It's my throne of comfort. I also like the bed by the radiator when it's on, but nothing beats the green chair. It’s my domain.
- KW    [2/3]  picks=`self-greenchair,triage-12d,triage-47d,antic-birthday,antic-vet,today-checkin,mood-arc`
  -> I nap on the green chair every afternoon. It’s my throne, and don’t even think about claiming it. Perfect spot for ruling my domain.
- EMB   [2/3]  picks=`self-greenchair,self-warm-laundry,diary-2026-04-06,subject-Sam,diary-2026-04-12,mood-arc,subject-Lucas`
  -> I nap on the green chair every afternoon. It's my throne, and I expect it to be warm and cozy. The new bed by the radiator is acceptable too, but nothing beats my chair. If there's warm laundry around, you can bet I'll be sitting on that instead.

### 14. Did Mom bring you a treat last time she came?
- expected: `loud bag, do not know, don't know, you'd have to remind, you didn't say`
- BASE  [2/5]: You'd have to remind me. But she did come over 3 days ago with that loud bag, so who knows. Treats are hit or miss with her. I can confirm I'm still grumpy about it.
- KW    [1/5]  picks=`life-recovery,diary-2026-05-04,diary-2026-05-03,subject-Mom,life-newneighbour,triage-12d,triage-47d`
  -> I do not remember a treat from Mom last time. She brought that loud bag instead, and I retreated to the green chair. Four appearances this month, but no notable snacks.
- EMB   [1/5]  picks=`subject-Mom,diary-2026-04-19,subject-AuntCarol,diary-2026-05-02,self-tap-bowl,subject-Mochi,life-newneighbour`
  -> Mom brought a paper bag last time, 3 days ago. Useful, but no treats. Just that loud bag again. I retreated to the green chair, obviously.

### 15. Catch me up — what's been happening with you?
- expected: `radiator, bella, vomit, rug, off, easing, birthday, lucas, mom`
- BASE  [6/9]: Oh, you want the scoop? Fine. I'm a bit grumpy today, appetite's half — only polished off half my bowl this morning. Remember that little vomit episode? Yeah, I'm still side-eyeing the whole situation after that. The radiator's off again, which is unacceptable. Bella was at the door for a whole fort
- KW    [4/9]  picks=`subject-Dexter,subject-Pickles,diary-2026-04-24,triage-12d,triage-47d,antic-birthday,antic-vet,mood-arc,subject-Mom`
  -> Oh, you know, just the usual royal drama. Twelve days ago, I was feeling unwell — vomiting twice, lethargy, the works. But I'm sturdier now. I've been grumpy lately, especially with that radiator off again. Just logged my disappointment, thank you very much. Spent some time being smug about knocking
- EMB   [3/9]  picks=`life-recovery,life-newneighbour,mood-arc,subject-Lucas,today-checkin,subject-Mom,subject-Pickles,diary-2026-04-07,diary-2026-05-02`
  -> What’s been happening? Just the usual drama. I’m feeling sturdier after that vomiting episode 12 days ago, but today I’m grumpy and only managed to eat half my bowl. Lucas has been around a lot, living here and reading on the sofa. Mom dropped by three days ago with that loud bag I can’t stand. And 

