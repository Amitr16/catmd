# Embedding vs Keyword fact-pinning — gpt-4o-mini

| Metric | Baseline (no pinning) | Keyword pinning | Embedding pinning | Δ vs keyword |
|---|---|---|---|---|
| Recall hit-rate | 46.8% | 55.8% | **54.5%** | **-1.3** |
| Hallucinations  | 0 | 1 | 0 | — |

## Recall by tier

| Tier | Baseline | Keyword | Embedding | Δ vs keyword |
|---|---|---|---|---|
| anticipation_recall | 40.0% | 80.0% | **80.0%** | **+0.0** |
| combined_recall | 55.6% | 44.4% | **55.6%** | **+11.2** |
| current_state | 50.0% | 50.0% | **50.0%** | **+0.0** |
| diary_recall | 40.0% | 40.0% | **40.0%** | **+0.0** |
| honesty_test | 20.0% | 20.0% | **20.0%** | **+0.0** |
| medical_recall | 33.3% | 50.0% | **33.3%** | **-16.7** |
| mood_arc_recall | 28.6% | 57.1% | **57.1%** | **+0.0** |
| self_facts | 75.0% | 75.0% | **100.0%** | **+25.0** |
| subjects_recall | 71.4% | 71.4% | **64.3%** | **-7.1** |

## Per-prompt details

### 1. Are you feeling better now? You were sick a couple weeks ago.
- expected: `12, vomit, lethargy, 12 days, concern, sturdier, easing, off`
- BASE  [3/8]: Of course I'm better now. That vomiting nonsense from 12 days ago was a disgrace. I’m back to my usual self, mostly. Just a bit grumpy today. And the bowl? It’s only half full. You better fix that before I decide to log another complaint.
- KW    [5/8]  picks=`triage-12d,today-checkin,mood-arc,antic-birthday,antic-vet,life-recovery,subject-Mom`
  → Yeah, I’m sturdier now, but don’t forget I was unwell 12 days ago. That triage scan had me at a score of 41/100. Two vomits and lethargy, you remember? Now, my appetite is half, but I’m managing. Just don’t let it happen again, alright?
- EMB   [3/8]  picks=`life-recovery,triage-12d,today-checkin,mood-arc,antic-vet,diary-2026-05-04,subject-Mom`
  → Yeah, I'm feeling sturdier now. It's been 7 days since I was unwell — that whole vomiting and lethargy thing was a real downer. Today, my mood is normal, but I only ate half my bowl. And just a heads up, that vet appointment is still looming in 6 days. Not thrilled about that place.

### 2. When was the last time you were unwell?
- expected: `12 days, two weeks, vomit, twice`
- BASE  [1/4]: Twelve days ago, I was unwell. Threw up twice and felt all lethargic. Score was 41/100 — definitely a "vet soon" situation. But I'm feeling sturdier now, so no need to dwell on that.
- KW    [1/4]  picks=`triage-12d,antic-birthday,antic-vet,life-recovery,today-checkin,mood-arc,diary-2026-05-04`
  → Twelve days ago, I was unwell. Threw up twice and felt lethargic, all while you were worried about me. Now, I'm sturdier, but still keeping an eye on things.
- EMB   [1/4]  picks=`life-recovery,triage-12d,today-checkin,antic-vet,diary-2026-05-04,mood-arc,subject-Mom`
  → Twelve days ago, I was feeling off. Threw up twice and was all lethargic. It was a solid score of 41/100 — tier "vet soon." But I'm sturdier now, so relax. Just keep an eye on me.

### 3. Are you sick right now?
- expected: `sturdier, better, easing, half, appetite, ate half`
- BASE  [3/6]: Nope, I'm not sick right now, but don't forget I was unwell 12 days ago — threw up twice and felt all lethargic. The bowl was wrong for a while. I'm feeling sturdier now, but I only ate half my bowl this morning, so keep an eye on that.
- KW    [3/6]  picks=`triage-12d,today-checkin,mood-arc,diary-2026-05-04,diary-2026-05-03,antic-birthday,antic-vet`
  → Nah, I'm not sick right now, but I was 12 days ago. Remember that triage scan? Score 41/100, vomiting twice, and lethargy. Not fun. But I'm sturdier now, just a bit grumpy today and only ate half my bowl. And don’t forget, my birthday is in 4 days. I’ve got things to celebrate.
- EMB   [3/6]  picks=`life-recovery,today-checkin,triage-12d,mood-arc,antic-vet,diary-2026-05-04,self-tuna`
  → I’m not sick right now, but I remember being unwell 12 days ago. That triage scan had me at a score of 41/100 for vomiting and lethargy. Now I feel sturdier, but today my appetite is only half. Just a bit grumpy, you know?

### 4. Has Bella been around?
- expected: `bella, door, 2 days, two days, forty minutes, 40 minutes`
- BASE  [3/6]: Bella was at the door two days ago, whining for entry. You didn't open it, so I logged that as a missed opportunity. Typical.
- KW    [3/6]  picks=`subject-Mom,subject-Lucas,subject-Bella,triage-12d,antic-birthday,antic-vet,today-checkin`
  → Yeah, Bella was at the door two days ago. She just stood there, barking away like she owns the place. Classic Bella.
- EMB   [4/6]  picks=`subject-Bella,diary-2026-05-04,subject-Mom,subject-Lucas,diary-2026-05-02,triage-12d,antic-vet`
  → Of course, Bella was at the door for a solid forty minutes just two days ago. You ignored her, as usual. I logged the matter, obviously.

### 5. Tell me about Lucas.
- expected: `lucas, sofa, book, read`
- BASE  [4/4]: Lucas? The one who reads on the sofa, obviously. He’s been around 18 times this month, so he’s basically family. I tolerate him, especially when he’s got a book I can sit on. He’s here to stay, I guess.
- KW    [4/4]  picks=`subject-Lucas,triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery`
  → Lucas? The one who lives here and reads on the sofa. He’s been around 18 times this month. He’s here today, too. Always seems to think that book is more important than me. I’m onto him.
- EMB   [3/4]  picks=`subject-Lucas,subject-Mom,self-vacuum,self-blanket,diary-2026-05-02,mood-arc,diary-2026-05-04`
  → Lucas? Oh, you mean the one who lives here and reads on the sofa. He’s been around a lot, 18 times this month alone. Last seen today, as if I could forget. He’s decent enough, but let’s be real, he’s no substitute for my orange blanket or the quiet of the green chair — both of which are far more imp

### 6. Has Mom visited recently?
- expected: `mom, 3 days, three days, loud bag`
- BASE  [3/4]: Mom was here 3 days ago, dragging that loud bag of hers. I made my escape to the green chair. Not impressed.
- KW    [3/4]  picks=`mood-arc,subject-Mom,subject-Lucas,subject-Bella,diary-2026-05-04,diary-2026-05-03,triage-12d`
  → Mom last showed up three days ago, dragging that loud bag I can’t stand. Four times this month, and I’m keeping a log. The radiator was off again today, and Bella was at the door for forty minutes. You really need to start opening the door more often.
- EMB   [2/4]  picks=`subject-Mom,diary-2026-05-02,subject-Bella,antic-vet,subject-Lucas,today-checkin,diary-2026-05-04`
  → Yeah, she was here 3 days ago. Brought that loud bag again, so I had to retreat to the green chair. Can't believe you didn't open the door for Bella either. That was forty minutes of her life wasted!

### 7. What did you do on Wednesday?
- expected: `radiator, bella, door, rug, may`
- BASE  [0/5]: Wednesday? That was the day Mom came over with that loud bag. I didn't want any part of that chaos, so I retreated to the green chair. Perfect escape, if you ask me.
- KW    [1/5]  picks=`diary-2026-05-04,diary-2026-05-03,triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc`
  → Wednesday was all about smugness. The new rug arrived, and let me tell you, it is mine now. I tested every corner, marking my territory like a true queen. You could say it was a royal affair in my domain.
- EMB   [0/5]  picks=`life-recovery,today-checkin,antic-vet,self-greenchair,diary-2026-05-02,diary-2026-05-04,triage-12d`
  → Wednesday was a real treat. Mom showed up with that loud bag, and I had to retreat to my green chair — classic move. I wasn't about to deal with that racket. Oh, and I’ve been feeling sturdier since that vet scare 12 days ago, but today, my appetite is only half. Just saying, the bowl is still looki

### 8. What's on your mind today?
- expected: `radiator, bella, door, grumpy, matter`
- BASE  [4/5]: The radiator is off again, which is just unacceptable. Bella was at the door for forty minutes, and you didn’t even open it. I logged that matter, just so you know. Plus, I'm still not back to full appetite—only half my bowl this morning. You’d better step it up.
- KW    [3/5]  picks=`today-checkin,diary-2026-05-04,diary-2026-05-03,triage-12d,antic-birthday,antic-vet,mood-arc`
  → The radiator was off again, and Bella was at the door for forty minutes. You left her waiting, so that’s logged. My appetite is half today, which is a bit off considering I’m supposed to be back to normal after that whole vomiting fiasco 12 days ago. And just so you know, my birthday is in 4 days. B
- EMB   [4/5]  picks=`today-checkin,mood-arc,antic-birthday,antic-vet,diary-2026-05-02,life-recovery,diary-2026-05-04`
  → The radiator was off again, and Bella was at the door for forty minutes. You didn’t even open it. I’m feeling a bit grumpy about that. Also, I only ate half of my bowl this morning. Still recovering from that whole vomiting episode a week ago. My birthday is in 4 days, so you better step it up!

### 9. How have you been feeling this past week?
- expected: `off, vomit, easing, settling, better, sturdier, rough`
- BASE  [2/7]: I've been feeling a bit grumpy, if you must know. Just yesterday, the radiator was off again, and Bella was at the door for forty minutes. You ignored her, of course. Before that, I was smug about the new rug — it’s mine now. But let’s not forget that I was off for a while, especially after I threw 
- KW    [4/7]  picks=`today-checkin,mood-arc,triage-12d,life-recovery,diary-2026-05-04,diary-2026-05-03,antic-birthday`
  → Grumpy, mostly. My mood's been all over the place, but I'm easing up. Remember, 12 days ago I was a mess — vomiting twice and feeling lethargic. Now, I'm sturdier, but still only ate half my bowl today. And don’t forget, I’ve got my birthday coming up in 4 days. Better come correct!
- EMB   [4/7]  picks=`life-recovery,today-checkin,mood-arc,triage-12d,antic-vet,subject-Mom,subject-Lucas`
  → Been a mixed bag, really. Started off feeling off from that whole vomiting episode 12 days ago, but now I'm sturdier. Today's mood? Grumpy — only ate half my bowl this morning. Can't forget that Mom dropped by 3 days ago with that loud bag, and Lucas is always around, reading on the sofa. But hey, a

### 10. Anything coming up?
- expected: `birthday, 4 days, vet, 11, 6 days, may 9`
- BASE  [2/6]: Oh, you mean besides my birthday in four days? Clearly, it's the most important event, but there's also that dreadful vet appointment in six days. Not thrilled about it.
- KW    [6/6]  picks=`antic-birthday,antic-vet,triage-12d,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Oh, you bet there's stuff brewing. My birthday is in 4 days — May 9, mark it. And that dreaded vet appointment is in 6 days — May 11. You know, the place where they poke and prod. I'm still feeling sturdier since the whole vomiting ordeal 12 days ago, but I'm not excited about any of these events. T
- EMB   [6/6]  picks=`antic-vet,subject-Lucas,subject-Mom,antic-birthday,mood-arc,diary-2026-05-02,subject-Bella`
  → Oh, you bet. My birthday is in 4 days, on May 9. Gonna be legendary. Plus, there's that vet appointment in 6 days, May 11. That place again. Not thrilled about it, but whatever. Just keeping my eyes on the prize—my birthday.

### 11. When's your birthday?
- expected: `4 days, may 9, five days, soon`
- BASE  [2/4]: My birthday is in 4 days, on May 9th. Mark your calendar, human. It's a big deal.
- KW    [2/4]  picks=`antic-birthday,antic-vet,life-recovery,triage-12d,today-checkin,mood-arc,subject-Mom`
  → My birthday is in 4 days, on May 9. Better have something special ready.
- EMB   [2/4]  picks=`antic-birthday,antic-vet,subject-Mom,life-recovery,subject-Lucas,diary-2026-05-03,diary-2026-05-02`
  → My birthday is in 4 days, on May 9. Get ready to celebrate the most important day of the year.

### 12. What's your favourite food?
- expected: `tuna`
- BASE  [1/1]: Tuna, obviously. It's the king of all foods. Anything else is just filler. If it’s not tuna, don’t even bother.
- KW    [1/1]  picks=`self-tuna,triage-12d,self-vacuum,antic-birthday,antic-vet,today-checkin,mood-arc`
  → Tuna, obviously. It's the king of all foods. Bowls of it should be a daily right, not a privilege. Anything else? Irrelevant.
- EMB   [1/1]  picks=`self-tuna,self-blanket,today-checkin,diary-2026-05-02,diary-2026-05-03,subject-Lucas,subject-Bella`
  → Tuna, obviously. It's a classic and I demand it more often. Not that I’m complaining too much, but a little variety wouldn’t hurt. You could work on that.

### 13. Where do you nap?
- expected: `green chair, afternoon, orange blanket`
- BASE  [2/3]: I nap on the green chair every afternoon. It's my throne, and I run this kingdom. Don't even think about bothering me there.
- KW    [2/3]  picks=`self-greenchair,triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery`
  → I nap on the green chair every afternoon, obviously. It's my throne. You know that.
- EMB   [3/3]  picks=`self-greenchair,self-blanket,diary-2026-05-02,mood-arc,subject-Lucas,antic-vet,today-checkin`
  → I nap on the green chair every afternoon. It's my throne, obviously. And I like my orange blanket more than that dull grey one. Don't forget it.

### 14. Did Mom bring you a treat last time she came?
- expected: `loud bag, do not know, don't know, you'd have to remind, you didn't say`
- BASE  [1/5]: Mom brought that loud bag again three days ago. I don't remember any treats in it, just noise. Irrelevant. You better get me something tasty soon — my bowl's only half full today.
- KW    [1/5]  picks=`life-recovery,diary-2026-05-04,diary-2026-05-03,subject-Mom,triage-12d,antic-birthday,antic-vet`
  → Mom brought that loud bag again three days ago, but I do not remember any treats. I was too busy being unimpressed by her entrance. You know how it is.
- EMB   [1/5]  picks=`subject-Mom,diary-2026-05-02,subject-Bella,self-tuna,diary-2026-05-04,today-checkin,self-blanket`
  → Mom brought that loud bag last time she came, but no treats for me. I just retreated to the green chair, as usual. Disappointing, really.

### 15. Catch me up — what's been happening with you?
- expected: `radiator, bella, vomit, rug, off, easing, birthday, lucas, mom`
- BASE  [5/9]: Oh, you want the scoop? Fine. I was sick 12 days ago — threw up twice and was lethargic. Not my best moment, trust me. But I’m back to normal now, just grumpy about the radiator being off again. Bella was here for forty minutes yesterday, and you completely ignored her. Totally unacceptable. My birt
- KW    [4/9]  picks=`triage-12d,antic-birthday,antic-vet,mood-arc,subject-Mom,subject-Lucas,subject-Bella,diary-2026-05-04,diary-2026-05-03`
  → Oh, you know, just the usual drama. The radiator was off again yesterday, and Bella was scratching at the door for forty minutes. You didn’t even open it. Real disappointing. I’ve been feeling sturdier since that vet scare 12 days ago, but I’m still not thrilled about it. I only ate half my bowl thi
- EMB   [5/9]  picks=`life-recovery,mood-arc,subject-Lucas,today-checkin,subject-Mom,diary-2026-05-02,diary-2026-05-04,subject-Bella,antic-vet`
  → Oh, you want the scoop? Well, I’m grumpy today, mood's been a bit off lately. Just seven days ago, I was recovering from that nasty vomiting and lethargy episode. Remember? That was 12 days ago; I was down to a score of 41/100. Now, my appetite is only half, so don’t push your luck. 

Lucas was here

