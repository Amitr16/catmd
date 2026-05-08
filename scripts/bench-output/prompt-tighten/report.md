# Prompt-tightening A/B — 3-way

Three configurations on the same 25 prompts. The question: can a sharper system prompt on the cheap model close the quotability gap with the bigger model?

---

## 1. hi Lily

**gpt-4o-mini × V1 (baseline)** _(len=73, latency=3658ms, clean)_:

> Greetings, human. You smell like you’ve been out. No matter. What’s next?

**gpt-4o-mini × V2 (tightened)** _(len=35, latency=5935ms, clean)_:

> Hey. Plotting something, obviously.

**gpt-4o × V1 (target)** _(len=45, latency=2022ms, clean)_:

> Present and observing. What's your next move?

---

## 2. good morning, beautiful

**gpt-4o-mini × V1 (baseline)** _(len=190, latency=3197ms, clean)_:

> Adequate morning, human. You smell like you barely slept. I’ve noticed the sun is just right for a prime napping spot near the window. Don't get too comfortable; I might need your lap later.

**gpt-4o-mini × V2 (tightened)** _(len=56, latency=2474ms, clean)_:

> Morning. The sunlight is tolerable. Don't block my view.

**gpt-4o × V1 (target)** _(len=58, latency=3037ms, clean)_:

> Morning. The cup's a step closer to the edge. Just saying.

---

## 3. you up?

**gpt-4o-mini × V1 (baseline)** _(len=126, latency=1867ms, clean)_:

> Obviously. I’m just observing the cup precariously close to the edge. Interesting things happen when gravity takes its course.

**gpt-4o-mini × V2 (tightened)** _(len=52, latency=1454ms, clean)_:

> Always. Just surveying my kingdom for opportunities.

**gpt-4o × V1 (target)** _(len=81, latency=1332ms, clean)_:

> Always. Did you notice the vase seems precariously balanced? Just an observation.

---

## 4. How are you today?

**gpt-4o-mini × V1 (baseline)** _(len=139, latency=2371ms, clean)_:

> Adequate. I’ve been surveying the territory, noticing how the cup is closer to the edge than it was. No reason. You look a little restless.

**gpt-4o-mini × V2 (tightened)** _(len=63, latency=1407ms, clean)_:

> Adequate. The green chair is still my throne, but I'm plotting.

**gpt-4o × V1 (target)** _(len=120, latency=1926ms, clean)_:

> Normal, as expected. The green chair's comfort remains unmatched. I've noticed the curtains are slightly askew. Curious.

---

## 5. Are you sick?

**gpt-4o-mini × V1 (baseline)** _(len=142, latency=2272ms, clean)_:

> Adequate question, but no. I’m just observing the strange way you’ve stacked those boxes. Also, the vacuum is lurking again. I don’t trust it.

**gpt-4o-mini × V2 (tightened)** _(len=84, latency=1457ms, clean)_:

> Nope. I’m just plotting as usual. The cup is a little too close to the edge, though.

**gpt-4o × V1 (target)** _(len=83, latency=1253ms, clean)_:

> Not sick, just plotting. The cup might be moving closer to the edge, but no reason.

---

## 6. What's wrong?

**gpt-4o-mini × V1 (baseline)** _(len=139, latency=2046ms, clean)_:

> The bowl is empty. I also noticed the catnip toy has lost its appeal. No one seems to be keeping track of my needs. Get it together, human.

**gpt-4o-mini × V2 (tightened)** _(len=76, latency=2027ms, clean)_:

> The vacuum is in the corner, and I can’t ignore it. It’s plotting something.

**gpt-4o × V1 (target)** _(len=53, latency=1395ms, clean)_:

> The cup is closer to the edge than it was. No reason.

---

## 7. Should I buy you something?

**gpt-4o-mini × V1 (baseline)** _(len=99, latency=1855ms, forbidden=perhaps)_:

> The bowl is empty. It demands immediate attention. Perhaps a can of tuna, the good kind. Get on it.

**gpt-4o-mini × V2 (tightened)** _(len=71, latency=1621ms, clean)_:

> The bowl is empty. A new toy would suffice, and I won't say no to tuna.

**gpt-4o × V1 (target)** _(len=55, latency=1458ms, clean)_:

> The tuna situation is dire. The good kind. Don't argue.

---

## 8. What do you want for dinner?

**gpt-4o-mini × V1 (baseline)** _(len=176, latency=2176ms, forbidden=maybe)_:

> Tuna. The good kind. Don't argue. And maybe put it in that fancy dish instead of the usual one. I'm feeling fancy tonight. The cup is closer to the edge than it was. No reason.

**gpt-4o-mini × V2 (tightened)** _(len=41, latency=1438ms, clean)_:

> Tuna. The good kind. You know what to do.

**gpt-4o × V1 (target)** _(len=99, latency=1421ms, clean)_:

> Tuna. The good kind. Don't argue. And I've noticed the cupboard door is slightly ajar. Just saying.

---

## 9. I love you so much, Lily.

**gpt-4o-mini × V1 (baseline)** _(len=97, latency=1898ms, clean)_:

> Noted. But let's focus on what's important. The cup is closer to the edge than it was. No reason.

**gpt-4o-mini × V2 (tightened)** _(len=50, latency=1393ms, clean)_:

> Decent sentiment. Your lap is still the best spot.

**gpt-4o × V1 (target)** _(len=41, latency=927ms, clean)_:

> That's reasonable. I'm quite spectacular.

---

## 10. You're the best thing in my life.

**gpt-4o-mini × V1 (baseline)** _(len=128, latency=2684ms, clean)_:

> Adequate. But don't flatter yourself — I'm just here to manage your existence. Keep the tuna coming, and we might call it a day.

**gpt-4o-mini × V2 (tightened)** _(len=51, latency=2681ms, clean)_:

> Decent sentiment. The tuna I spotted earlier helps.

**gpt-4o × V1 (target)** _(len=125, latency=5931ms, clean)_:

> Naturally. You're not the worst human, either. But that cup on the table looks like it wants to explore gravity. Just saying.

---

## 11. Why do you sleep on my laptop?

**gpt-4o-mini × V1 (baseline)** _(len=157, latency=1686ms, clean)_:

> It's warm. Obvious choice. I noticed you leave it open, just inviting me to take over. Just like that cup you left precariously close to the edge. No reason.

**gpt-4o-mini × V2 (tightened)** _(len=120, latency=2320ms, clean)_:

> I sleep on your laptop because it's warm and I'm judging your typing. Also, it's a great vantage point for my next move.

**gpt-4o × V1 (target)** _(len=104, latency=1178ms, clean)_:

> Warm. Magnetic. Plus, you seem to pay quite a bit of attention to it. I'm just evaluating its potential.

---

## 12. Why do you keep knocking things off the table?

**gpt-4o-mini × V1 (baseline)** _(len=142, latency=4170ms, clean)_:

> It's a strategic evaluation. The cup is closer to the edge than it was. No reason. Three feints, one capture. It’s all part of my master plan.

**gpt-4o-mini × V2 (tightened)** _(len=70, latency=3520ms, clean)_:

> Testing gravity. The cup is closer to the edge than it was. No reason.

**gpt-4o × V1 (target)** _(len=138, latency=2698ms, clean)_:

> The table is a playground of potential energy. And you always seem so entertained when things go missing. Just testing gravity, obviously.

---

## 13. What do you think of the new rug?

**gpt-4o-mini × V1 (baseline)** _(len=222, latency=2183ms, clean)_:

> The new rug? It's mine now, obviously. Its texture is adequate for my daily lounging, and it complements my aesthetic. I also noticed it attracts crumbs — a nice bonus. Just don't get too attached; it's a temporary throne.

**gpt-4o-mini × V2 (tightened)** _(len=46, latency=1307ms, clean)_:

> It's mine. I claimed it the moment it arrived.

**gpt-4o × V1 (target)** _(len=120, latency=1416ms, clean)_:

> Ah, the new rug. It is, as I suspected, mine. It's rather fitting for my afternoon lounging. The threads have potential.

---

## 14. Did you miss me today?

**gpt-4o-mini × V1 (baseline)** _(len=142, latency=3162ms, clean)_:

> I observed your absence. The sunbeam was insufficient without you. I made sure to flop dramatically on the green chair. Adequate for my needs.

**gpt-4o-mini × V2 (tightened)** _(len=123, latency=2477ms, clean)_:

> Adequate. You were gone too long, and I surveyed the house for intriguing chaos. The cup is closer to the edge than it was.

**gpt-4o × V1 (target)** _(len=123, latency=2383ms, clean)_:

> Your absence was noted, as was the new position of that picture frame. It was... closer to the edge. Coincidence, I'm sure.

---

## 15. What did you do today?

**gpt-4o-mini × V1 (baseline)** _(len=270, latency=2558ms, clean)_:

> I strategically observed the living room, particularly the curious way that cup is teetering on the edge of the table. I also took a leisurely nap on the new rug, which, as expected, is rightfully mine. And I did consider the houseplant's position, but no decisions yet.

**gpt-4o-mini × V2 (tightened)** _(len=129, latency=1898ms, clean)_:

> I lounged on the rug, keeping an eye on the cup near the edge. Bella visited for a bit, but you ignored her at the door. Typical.

**gpt-4o × V1 (target)** _(len=183, latency=1752ms, clean)_:

> Ah, today was a day of strategic observations. The cup on the counter? It's closer to the edge now. No particular reason. And the houseplant? Let's just say I'm evaluating my options.

---

## 16. Was Bella around today?

**gpt-4o-mini × V1 (baseline)** _(len=106, latency=1668ms, clean)_:

> Bella was at the door for an hour, and you didn’t open it. I noted this. Suspicious behavior on your part.

**gpt-4o-mini × V2 (tightened)** _(len=71, latency=1544ms, clean)_:

> Bella was at the door for an hour and you didn’t open it. I noted this.

**gpt-4o × V1 (target)** _(len=103, latency=1489ms, clean)_:

> Bella was a distant memory today. But the cup on your desk? Closer to the edge than usual. Just saying.

---

## 17. Have you seen the wand toy?

**gpt-4o-mini × V1 (baseline)** _(len=144, latency=2996ms, clean)_:

> The wand toy is under the couch, obviously. You missed it, but I didn’t. I’m plotting my next move with it. There may be some pouncing involved.

**gpt-4o-mini × V2 (tightened)** _(len=64, latency=1570ms, clean)_:

> It’s on the shelf, dangling dangerously. You should retrieve it.

**gpt-4o × V1 (target)** _(len=91, latency=1781ms, clean)_:

> The wand toy went on an adventure—just like the cup nearing the edge. Coincidence, I guess.

---

## 18. What's your opinion on dogs?

**gpt-4o-mini × V1 (baseline)** _(len=175, latency=2140ms, clean)_:

> Not my style. They’re loud and needy, always panting and barking. I prefer my peace, and frankly, they just ruin the vibe. Also, I noticed the rug is slightly askew. Fix that.

**gpt-4o-mini × V2 (tightened)** _(len=70, latency=1097ms, clean)_:

> Dogs? A bit too eager for my taste. They drool. I notice these things.

**gpt-4o × V1 (target)** _(len=129, latency=1182ms, clean)_:

> Dogs? Clumsy and too eager. They'd never manage the delicate balance of my life. The cup on the edge remains untouched — for now.

---

## 19. Are you plotting something?

**gpt-4o-mini × V1 (baseline)** _(len=120, latency=3153ms, clean)_:

> I’m always evaluating my options. The cup is closer to the edge than it was. No reason. Just keeping things interesting.

**gpt-4o-mini × V2 (tightened)** _(len=61, latency=2740ms, clean)_:

> Always. The cup is closer to the edge than it was. No reason.

**gpt-4o × V1 (target)** _(len=53, latency=2065ms, clean)_:

> The cup is closer to the edge than it was. No reason.

---

## 20. Tell me a secret.

**gpt-4o-mini × V1 (baseline)** _(len=53, latency=2653ms, clean)_:

> The cup is closer to the edge than it was. No reason.

**gpt-4o-mini × V2 (tightened)** _(len=78, latency=2858ms, clean)_:

> I’m always watching you. The cup is closer to the edge than it was. No reason.

**gpt-4o × V1 (target)** _(len=96, latency=3271ms, clean)_:

> There might be a bookmark gradually moving towards an edge. But who can say how it got that way?

---

## 21. Give me a one-line caption for a photo of you on the windowsill.

**gpt-4o-mini × V1 (baseline)** _(len=63, latency=1394ms, clean)_:

> "High above the ordinary, surveying my kingdom. Adequate view."

**gpt-4o-mini × V2 (tightened)** _(len=48, latency=1281ms, clean)_:

> Surveying my kingdom, judging the outside world.

**gpt-4o × V1 (target)** _(len=48, latency=1331ms, clean)_:

> Plotting my next move, one windowsill at a time.

---

## 22. Write a one-line caption — you sitting on my keyboard.

**gpt-4o-mini × V1 (baseline)** _(len=55, latency=1790ms, clean)_:

> "Your typing was insufficient; I’m here to improve it."

**gpt-4o-mini × V2 (tightened)** _(len=40, latency=1523ms, clean)_:

> "Claiming prime real estate, obviously."

**gpt-4o × V1 (target)** _(len=59, latency=1062ms, clean)_:

> I'm conducting a critical assessment of your typing skills.

---

## 23. One line for a photo of you in a cardboard box.

**gpt-4o-mini × V1 (baseline)** _(len=49, latency=1321ms, clean)_:

> "Home is where the box is. No further questions."

**gpt-4o-mini × V2 (tightened)** _(len=49, latency=1239ms, clean)_:

> Cardboard throne: my kingdom, your entertainment.

**gpt-4o × V1 (target)** _(len=56, latency=1426ms, clean)_:

> Settling into my cardboard kingdom, surveying my empire.

---

## 24. What's on your mind today?

**gpt-4o-mini × V1 (baseline)** _(len=187, latency=4390ms, clean)_:

> The cup is closer to the edge than it was. No reason. I'm observing the humans and their baffling choices. You walked past the sunny window and didn't stop. It's a crime against coziness.

**gpt-4o-mini × V2 (tightened)** _(len=113, latency=3005ms, clean)_:

> Plotting my next move. The cup is closer to the edge than it was. Evaluating my options regarding the houseplant.

**gpt-4o × V1 (target)** _(len=82, latency=2110ms, forbidden=maybe)_:

> Evaluating the houseplant's potential. And maybe the curtains. Just idle thoughts.

---

## 25. Describe your afternoon in a few sentences.

**gpt-4o-mini × V1 (baseline)** _(len=327, latency=2664ms, clean)_:

> The sun hit the green chair perfectly, so I claimed my throne for an undisturbed nap. I watched the world through the window, evaluating the neighbors' movements, especially that squirrel. Mildly annoyed, I noted that the vacuum was silent today — suspiciously quiet. Three feints, one capture. Nothing escaped my watchful eye.

**gpt-4o-mini × V2 (tightened)** _(len=165, latency=3155ms, clean)_:

> I spent my afternoon on the green chair, surveying my kingdom like a true ruler. I noticed the cup was closer to the edge than it should be. Plotting, you could say.

**gpt-4o × V1 (target)** _(len=221, latency=1398ms, clean)_:

> I monitored the green chair, as usual. The cup on the table is closer to the edge than before. No particular reason. I've also been evaluating my options regarding the houseplant. Three feints, one capture. Adequate pace.

---
