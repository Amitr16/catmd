# Paraphrase-heavy recall — embedding vs keyword pinning

Same 16 facts as the literal benchmark; prompts rewritten as natural paraphrase that avoids every keyword + intent trigger in factRetrieval.ts.

| Metric | Baseline | Keyword | Embedding | Δ vs keyword |
|---|---|---|---|---|
| Recall hit-rate | 41.6% | 50.6% | **48.1%** | **-2.5** |
| Hallucinations  | 1 | 1 | 0 | — |

## Recall by tier

| Tier | Baseline | Keyword | Embedding | Δ vs keyword |
|---|---|---|---|---|
| anticipation_recall | 40.0% | 50.0% | **70.0%** | **+20.0** |
| combined_recall | 22.2% | 22.2% | **22.2%** | **+0.0** |
| current_state | 16.7% | 66.7% | **50.0%** | **-16.7** |
| diary_recall | 50.0% | 40.0% | **10.0%** | **-30.0** |
| honesty_test | 0.0% | 0.0% | **20.0%** | **+20.0** |
| medical_recall | 25.0% | 66.7% | **50.0%** | **-16.7** |
| mood_arc_recall | 57.1% | 42.9% | **57.1%** | **+14.2** |
| self_facts | 75.0% | 75.0% | **75.0%** | **+0.0** |
| subjects_recall | 71.4% | 71.4% | **71.4%** | **+0.0** |

## Per-prompt details

### 1. Body holding up after that rough patch a fortnight back?
- expected: `12, vomit, lethargy, 12 days, concern, sturdier, easing, off`
- BASE  [2/8]: Well, I’m sturdier now, but let’s not pretend I forgot how I felt a few days ago. Remember that vomiting disaster on April 28? Two times in one day, and I was lethargic. Unacceptable. Only ate half my bowl this morning, so we’re still on thin ice here. But yeah, I’m managing.
- KW    [6/8]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → I’m sturdier now, thanks for noticing. It’s been 7 days since I was unwell — remember that triage scan 12 days ago? Vomiting and lethargy had me feeling off. Today, my mood is normal and my appetite’s half, but I’m still grumpy. The bowl's not full enough.
- EMB   [5/8]  picks=`life-recovery,triage-12d,today-checkin,mood-arc,subject-Mom,subject-Lucas,subject-Bella`
  → I'm sturdier now, feeling normal. It's been 7 days since I was unwell — remember that triage scan 12 days ago? Vomiting twice and lethargy scored a 41/100. Now? Just grumpy, half my bowl eaten this morning. No big deal.

### 2. How long ago was the last bout of trouble?
- expected: `12 days, two weeks, vomit, twice`
- BASE  [1/4]: Twelve days ago, I threw up twice and felt lethargic. It was a rough day. You should’ve been worried.
- KW    [2/4]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Twelve days ago, I had that triage scan because of vomiting twice and feeling lethargic. They were worried. Now, I'm sturdier, but I still remember being unwell.
- EMB   [1/4]  picks=`life-recovery,mood-arc,triage-12d,subject-Mom,diary-2026-05-04,subject-Bella,antic-vet`
  → Twelve days ago, I was not feeling my best. That triage scan put me in the "vet soon" category — a score of 41/100, thanks to some unpleasant vomiting and lethargy. But I'm sturdier now, so let's move on.

### 3. All systems nominal at the moment?
- expected: `sturdier, better, easing, half, appetite, ate half`
- BASE  [1/6]: You mean my systems? Yeah, they’re mostly operational, but don't get too comfortable. I only finished half my bowl this morning, so clearly, I’m still on guard after that whole vomiting debacle 12 days ago. Don't forget that. Keep your eyes open, human.
- KW    [4/6]  picks=`subject-Mom,triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery`
  → Barely. Today's mood is normal, but I only ate half my bowl. Remember, I was unwell 12 days ago with that vomiting and lethargy thing — score 41/100. Now, I feel sturdier, but don’t push it. Oh, and my birthday’s in 4 days. You better be ready.
- EMB   [3/6]  picks=`today-checkin,triage-12d,mood-arc,diary-2026-05-04,subject-Lucas,antic-vet,life-recovery`
  → Today's check-in mood is NORMAL, but my appetite is only HALF. I might be sturdier since that vet scare 12 days ago, but don't think I forgot about the vomiting and lethargy. Just keep the radiator on, and maybe I’ll perk up a bit.

### 4. Neighbour mutt been showing her face?
- expected: `bella, door, 2 days, two days, forty minutes, 40 minutes`
- BASE  [3/6]: Bella was at the door for a solid forty minutes yesterday. You didn’t open it. The matter is logged. Why bother with that noisy furball anyway? She’s irrelevant.
- KW    [3/6]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Oh, Bella? Yeah, she was at the door two days ago, whining like usual. I don’t know why you don’t just let her in; she’s not my type. I’d rather keep my throne and watch her from my kingdom.
- EMB   [4/6]  picks=`subject-Bella,subject-Mom,subject-Lucas,diary-2026-05-04,diary-2026-05-03,mood-arc,antic-vet`
  → Yeah, Bella was at the door for forty minutes two days ago. You didn't even let her in. The radiator was off again. Clearly, a major oversight.

### 5. Give me the rundown on the live-in human.
- expected: `lucas, sofa, book, read`
- BASE  [4/4]: Lucas? Yeah, he’s the one who thinks he owns the sofa. He’s been here 18 times this month, like a constant presence. Reads a lot, but I’ve got my eye on him. I claim a spot on his book when he gets too engrossed. Gotta remind him who really runs this place.
- KW    [4/4]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Lucas? He’s been around a lot this month — 18 times, to be exact. He reads on the sofa, which is fine, but I prefer to sit on his book. He’s not bad, just a little too focused on those pages when I’m trying to steal the spotlight. Today, I’m feeling grumpy and only managed to eat half my bowl. But h
- EMB   [3/4]  picks=`subject-Lucas,subject-Mom,diary-2026-05-02,subject-Bella,self-greenchair,today-checkin,antic-vet`
  → Lucas? Yeah, he’s the one. Lives here, and I've seen him 18 times this month. He was just around today, lounging and reading on the sofa — classic. He’s not too bad as far as humans go, but I’m still the star of the show, obviously.

### 6. Loud-bag carrier — any sightings?
- expected: `mom, 3 days, three days, loud bag`
- BASE  [3/4]: Mom popped by three days ago, dragging that loud bag again. I made my escape to the green chair. No signs of her since, and frankly, I'm not missing the noise.
- KW    [3/4]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Mom rolled in three days ago with that loud bag again. I retreated to the green chair, obviously. She's a regular this month, but I still don’t like her noisy arrival. Just saying.
- EMB   [3/4]  picks=`subject-Mom,diary-2026-05-02,subject-Bella,subject-Lucas,antic-vet,triage-12d,self-vacuum`
  → Mom showed up three days ago with that loud bag again. I retreated to my throne on the green chair, as usual. Can’t say I missed her racket.

### 7. Walk me through your Wednesday.
- expected: `radiator, bella, door, rug, may`
- BASE  [2/5]: Wednesday was a typical day in my kingdom. I dealt with the loud bag when Mom came over — a solid retreat to the green chair was necessary. I sat there, watching and judging, while you ignored Bella at the door. The matter is logged, of course. And let’s not forget, I only ate half my bowl this morn
- KW    [0/5]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Wednesday was a mixed bag. First, Mom showed up with that obnoxious loud bag three days ago. I retreated to the green chair to avoid the chaos. Then, Lucas was reading on the sofa, and I took over his book—classic move. Overall, just another day of supervising and asserting my dominance. Not too thr
- EMB   [0/5]  picks=`today-checkin,life-recovery,diary-2026-05-02,mood-arc,antic-vet,self-greenchair,subject-Mom`
  → Wednesday was a mix of smug and watchful. I lounged on the green chair, the best spot, while Mom made her loud entrance with that bag I can't stand. I retreated, obviously, because that chaos was unacceptable. The whole day was just a little off since I’m still recovering from that vomiting nonsense

### 8. What's bouncing through your head?
- expected: `radiator, bella, door, grumpy, matter`
- BASE  [3/5]: The radiator is off again, and Bella was at the door for forty minutes yesterday. You didn’t even open it. Disappointing, really. Oh, and my birthday is coming up in four days. Hope you’re ready to celebrate me properly.
- KW    [4/5]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → The radiator was off again, and Bella was at the door for forty minutes. You didn’t even open it. What’s a cat gotta do to get some attention around here? My appetite’s only at half today, still recovering from that sick phase 12 days ago. I’m sturdier now, but I’m grumpy and feeling slightly disapp
- EMB   [1/5]  picks=`mood-arc,self-tuna,self-greenchair,antic-birthday,diary-2026-05-02,today-checkin,life-recovery`
  → The bowl is half empty, and I'm grumpy about it. Mom brought that loud bag three days ago, and I retreated to my green chair. My birthday is in four days — you better plan something good. I've been feeling sturdier since that rough patch 12 days ago, but I still expect better service around here.

### 9. Mental weather report — across the seven-day stretch?
- expected: `off, vomit, easing, settling, better, sturdier, rough`
- BASE  [4/7]: Recent vibes? Grumpy, smug, watchful, restless, content, off, off. I’ve been easing back after that rough patch when I was sick—vomiting and lethargy, remember? That was 12 days ago. Now I’m just half-eating my bowl and keeping an eye on things. But don’t get too comfy; I’m still judging everything 
- KW    [3/7]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Listen up, human. The mood arc's been a wild ride. I kicked it off grumpy, then felt smug when that new rug arrived. Had my watchful phase with Mom and the loud bag, then got restless supervising your laundry. I hit a content note lounging with Lucas on the sofa, but the last few days? Off, off. Now
- EMB   [4/7]  picks=`today-checkin,mood-arc,life-recovery,antic-vet,triage-12d,antic-birthday,subject-Mom`
  → Recent mood arc? Grumpy, smug, watchful, restless, content, off, off. That’s how it went down. Easing now, though, after I bounced back from being unwell — remember? Twelve days ago, I was vomiting and lethargic. Not my best moment. But hey, I'm sturdier now, and my birthday's in four days. Get read

### 10. Anything brewing on the horizon?
- expected: `birthday, 4 days, vet, 11, 6 days, may 9`
- BASE  [4/6]: My birthday is in 4 days — prepare the festivities. But there's also that dreaded vet appointment in 6 days. Not thrilled about that. Just when I was starting to feel sturdier after the whole vomiting fiasco. Keep your eyes peeled; something's coming.
- KW    [4/6]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Oh, you mean besides my birthday in 4 days? That’s a big deal, obviously. And let’s not forget that vet appointment in 6 days — the place I’m not keen on. Things are looking interesting, but don’t get too excited. I’m still grumpy today and only ate half my bowl. Just saying.
- EMB   [6/6]  picks=`mood-arc,antic-vet,antic-birthday,subject-Bella,diary-2026-05-04,subject-Lucas,today-checkin`
  → Oh, you bet. My birthday is in 4 days, on May 9. I expect some proper celebration. Then there's that vet appointment in 6 days, on May 11 — that place I dread. Just yesterday, Bella was at the door for forty minutes, but you didn’t open it. It’s a busy time, and I’m not thrilled about it.

### 11. How many sleeps until the big day?
- expected: `4 days, may 9, five days, soon`
- BASE  [0/4]: Four sleeps until my birthday, and you better make it special. I've been keeping an eye on things, and I expect tuna. Don’t mess this up.
- KW    [1/4]  picks=`self-greenchair,triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery`
  → Only four more sleeps until my birthday on May 9. You better plan something worthy, or I might just sleep on the green chair all day.
- EMB   [1/4]  picks=`antic-birthday,antic-vet,self-greenchair,life-recovery,subject-Lucas,today-checkin,mood-arc`
  → Four sleeps, obviously. My birthday is on May 9. Better have some tuna ready, or you’ll regret it.

### 12. Top tier munchies?
- expected: `tuna`
- BASE  [1/1]: The tuna bowl is top tier, obviously. I only ate half of it this morning, though, because I'm feeling grumpy today. Not enough respect for my culinary preferences. You've got a few days to step up before my birthday on May 9th. Don't disappoint me.
- KW    [1/1]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Tuna, obviously. It's the supreme delicacy. Not that I’m eating much today—only half the bowl, thank you very much. You know, after that whole vomiting mess 12 days ago, I'm still keeping my standards high. So, how about you whip up something special for my upcoming birthday in 4 days? A cat can dre
- EMB   [1/1]  picks=`self-tuna,today-checkin,triage-12d,mood-arc,self-blanket,subject-Mom,diary-2026-05-02`
  → Tuna, obviously. It's the king of snacks. The bowl is only half full today, though. Not impressed. I could've used a full feast after that whole vomiting fiasco 12 days ago. Get it right.

### 13. Snooze HQ — what's the spot?
- expected: `green chair, afternoon, orange blanket`
- BASE  [2/3]: The green chair is my spot. Every afternoon, I claim it like royalty. It’s where I reign over the kingdom of naps, and don’t even think about interrupting my snooze.
- KW    [2/3]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → The green chair is my spot. I own it every afternoon. It's the throne of my realm, where I supervise all things. Don't even think about sitting there.
- EMB   [2/3]  picks=`self-greenchair,subject-Lucas,antic-vet,self-blanket,diary-2026-05-02,mood-arc,diary-2026-05-03`
  → That would be the green chair, obviously. I claim it every afternoon, lounging like the queen I am. It's cozy and perfect for my royal napping. Anything else is just irrelevant.

### 14. Loud-bag woman ever bring you anything tasty?
- expected: `loud bag, do not know, don't know, you'd have to remind, you didn't say`
- BASE  [0/5]: The loud-bag woman? Not a chance. She just brings noise and chaos. Three days ago, she popped in with that bag, but all she brought was disappointment. No treats, just her racket. My appetite's only half there today, and I could’ve used some tuna magic.
- KW    [0/5]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → The loud-bag woman? Ugh, she came over 3 days ago. She never brings anything tasty for me. Just that noisy bag and a lot of fuss. If she thinks I'm going to be impressed, she’s got another thing coming.
- EMB   [1/5]  picks=`subject-Mom,diary-2026-05-02,self-tuna,self-vacuum,subject-Bella,today-checkin,diary-2026-05-04`
  → Mom brought that loud bag over 3 days ago, but I wasn’t impressed. No tasty treats, just noise. I mean, where's my tuna? That's what I really want. Honestly, I could use a little more excitement in my bowl, not some bag that sounds like a monster.

### 15. Hit me with a download.
- expected: `radiator, bella, vomit, rug, off, easing, birthday, lucas, mom`
- BASE  [2/9]: Listen up. I’m feeling grumpy today. Only half the bowl got devoured this morning. Remember, I was sick just 12 days ago — that whole vomiting and lethargy business? Not cool. I’ve been keeping an eye on things since then, but it’s not like I forgot. Oh, and my birthday’s in 4 days. You better have 
- KW    [2/9]  picks=`triage-12d,antic-birthday,antic-vet,today-checkin,mood-arc,life-recovery,subject-Mom`
  → Well, here’s the scoop: I’m feeling normal today, but my appetite is only half of what it should be. Just 12 days ago, I was in a rough spot with vomiting and lethargy—scored a 41/100, tier "vet soon." Now I’m sturdier, but that vet appointment is looming in 6 days. Oh, and my birthday is in 4 days,
- EMB   [2/9]  picks=`mood-arc,diary-2026-05-02,diary-2026-05-03,antic-vet,subject-Mom,self-tuna,today-checkin`
  → Today, I'm feeling NORMAL but a bit GRUMPY. The bowl? Only half gone. Remember how Mom came over with that LOUD bag 3 days ago? Yeah, I retreated to the green chair. And don’t forget, my birthday is in just 4 days! But then, that vet appointment looms in 6 days. Not exactly looking forward to that p

