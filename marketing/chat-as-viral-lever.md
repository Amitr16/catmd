# Chat as the Viral Lever — Co-Star Lessons + Action Plan

> Drafted 2026-05-04. CatMD's strategic bet: chat-as-cat is the most
> TikTok-able feature in the app. To make it actually break out, we
> study what Co-Star did right (25M+ users on identity-as-product),
> then apply systematically.

## Why Co-Star is the right reference

Co-Star isn't an astrology app — it's an **identity product disguised as astrology**. Its mechanics map almost perfectly to what CatMD's cat-voice chat needs to be:

| Co-Star pattern | What it created | CatMD parallel |
|---|---|---|
| Personalized daily horoscope | "This was made for me" | Personalized daily cat observation |
| Cold, declarative voice | Memorable, screenshot-worthy | Cat voice with swag + entitlement |
| Brutal honesty | Shareable ("look what it said") | Cat-judgment of the human |
| Beautiful typography | Stops the scroll on TikTok | Typography upgrade in chat |
| One-line outputs | Tweet-shaped, instantly shareable | Cat replies fit the same format |
| Push notifications with cryptic teases | Re-engagement + curiosity | "She has notes about today" pushes |
| Identity hook | "I'm a Capricorn rising" | "My cat is a Velcro Cat" |
| Compatibility check | Group / friend hook | "Compare your cat's archetype to your friend's cat" |

## What Co-Star nails (the deep design)

### 1. Voice register — declarative, not explanatory

Co-Star never says: *"You may want to reflect on whether you've been working too hard recently."*
Co-Star says: *"Stop trying to martyr yourself."*

The difference is **agency**. Co-Star ASSERTS. CatMD's cat needs the same:

- ❌ *"I'd love a treat if you don't mind."*
- ✅ *"Tuna. Now."*

- ❌ *"I noticed you've been working a lot lately."*
- ✅ *"You've been on the laptop too long."*

- ❌ *"It would be nice if you remembered to fill the bowl."*
- ✅ *"The bowl is empty. Address this."*

### 2. Short = shareable

Co-Star outputs are usually ONE SENTENCE. Sometimes two. The brevity is what makes them screenshotable.

Examples (real Co-Star outputs):
- "Don't be afraid to be perfect."
- "Stop performing for people who aren't even watching."
- "You don't owe anyone an explanation."
- "Trust your instincts."
- "Be honest about what you want."

Each one is **tweet-shaped**. Fits in one line on a phone screen. Memorable.

CatMD's cat should have the same constraint. Not multi-sentence paragraphs. **Punchy aphorisms.**

### 3. Cruelty calibrated — not mean, but cutting

Co-Star reads as *slightly judgmental* without being cruel. It's the friend who's a little too honest:

- "You're being avoidant about something."
- "Stop seeking validation from people who don't get you."

It hurts because it's true. But it doesn't punch down.

CatMD's cat should be the same. Cats ARE judgmental — leaning into that is on-brand AND viral:

- *"You're late. Again."*
- *"The chair held the shape of someone who didn't sit in it."*
- *"You smell like another cat. Explain yourself."*
- *"I noticed you didn't refill the water yesterday."*

The judgment is what makes it shareable.

### 4. Beautiful, intentional typography

Co-Star's daily horoscope is presented in a designed format — black background, white serif text, generous spacing, hierarchical type. It's not a chat bubble. It's a **statement**.

When users screenshot it, the visual is already optimised for sharing. The export looks like a typographic poster, not an iMessage thread.

**CatMD's chat is currently a generic chat-bubble UI.** That's optimised for messaging, NOT for sharing. The reply text doesn't look distinctive on screenshot. This is a design opportunity.

### 5. Push notifications that are themselves shareable

Co-Star pushes things like:
- "Your day is going to be a lot."
- "Today's energy: introspective."

Each notification is BOTH a re-engagement tool AND a piece of shareable content. People screenshot the LOCK SCREEN.

CatMD's cat doesn't currently push unprompted observations. **Adding this is the single biggest virality lever I see.**

## Specific CatMD improvements — ranked by impact

### 🟢 1. Shareable reply cards (HIGHEST PRIORITY)

Every cat reply should have a "Share" button that exports a beautiful 1080×1920 vertical card:

```
[Top: cat's circular photo, 80×80px, centered]

[Cat's name in caps, small letter-spacing]
LILY

[Cat's reply text — BIG, Source Serif, italic, cream-on-charcoal]
"Because you keep typing 
instead of paying 
attention."

[Bottom: small CatMD logo + catmd.pet]
```

This card is TikTok-native (9:16), shareable to Instagram Stories with one tap, and visually distinct from any other app. **This single feature is what makes CatMD chat replicable.**

Cost: ~2-3 days of dev work. Returns: every screenshot becomes free marketing.

### 🟢 2. Push notifications in cat voice (HIGH PRIORITY)

Right now CatMD's pushes are utility ("Lily is thinking…", "Postcard ready"). They should be IN CAT VOICE, like a daily SMS from your cat:

Examples (one push per day, evening):
- *"You smell like outside."*
- *"The wand toy hasn't moved in three days."*
- *"I have notes about today."*
- *"The pigeon was unreasonable for thirty seconds."*
- *"You forgot the water bowl. Again."*

Each push is:
- Cryptic enough to make the user open the app to see "more"
- Screenshotable on the lock screen alone (Co-Star pattern)
- Self-replicating (every viewer wants their cat's daily message)

Implementation: extend the existing daily diary cron to also pick a 1-line "highlight" from today's diary entry and send as push.

### 🟢 3. Daily "card from your cat" (HIGH PRIORITY)

Co-Star's daily horoscope is the core daily-loop feature. CatMD should have an equivalent: the cat's "card of the day."

UI: opens to a card-shaped design (not chat) when user taps the morning push:

```
[Lily's avatar, top]

[Big serif typography]
TODAY:
"I have noticed
the radiator
has been off
for three days."

[Mood word — small caps, sage]
WATCHFUL

[Small share button + brand]
```

This is a single asset, shareable, screenshot-able, themed daily. Users compare cards with friends ("look what mine said today").

### 🟢 4. Typography upgrade in main chat

Current chat = iMessage clone. Cat replies should be **typographically distinctive**:

- User messages: small, sans-serif (Figtree), grey background, right-aligned (current)
- **Cat replies: LARGER text, Source Serif, italic, no chat bubble — text floats on the cream background with a subtle cat-photo avatar to the left**

The visual difference between user and cat is what makes screenshots beautiful. The cat's text becomes the visual hero of every screenshot.

Cost: ~1 day of CSS + RN styling work. ROI: every screenshot of a chat exchange becomes more shareable.

### 🟡 5. "She noticed something about you" feature

Once a week, the cat surfaces an observation about the HUMAN, not just about themselves:

- *"You haven't been sleeping. Your scent is off."*
- *"You smell like another cat. I forgive you, but I noticed."*
- *"You spent four hours on the laptop today. I was watching."*

This is the Co-Star "reading" mechanic — the cat reads YOU. Massive shareability factor: cat owners ALREADY think their cat is judging them. CatMD makes it explicit.

Implementation: extend the diary's recent-events context to surface human-observable patterns (long laptop sessions, sleep timing inferred from check-in times, photo-detected attire changes). Generate a weekly "reading" entry.

### 🟡 6. Archetype identity sharing

Co-Star: "I'm a Capricorn rising" became identity language.
CatMD: "My cat is a Velcro Cat" should be the same.

Add a "Share my cat's archetype" button on the personality screen that exports a beautiful card:

```
[Cat photo, big, top]

[Archetype name — display font]
VELCRO CAT

[One-liner — italic serif]
"She's with her human, always."

[Small description]
[3-line description from ARCHETYPE_META]

[Bottom: take the quiz + brand]
What's your cat?
catmd.pet
```

Already in the marketing kit — but worth restating: this is identity-as-content. Every shared archetype card recruits the next user.

### 🟡 7. "Greatest hits" — replay the cat's best lines

Add a small section on the chat screen (or a separate "Lily said" page) that surfaces the cat's most-screenshot-worthy past replies:

```
THINGS LILY SAID THIS MONTH:

"Tuna. The good kind. Don't argue."

"You were gone four hours. The chair held the shape of you."

"Three feints, one capture. Adequate pace."

[swipe for more]
```

This is a passive scroll surface that's pure shareable content. Users come back JUST to look at the highlights and screenshot the funny ones.

### 🟢 8. Cat voice register — final tightening

Current voice rules (post-2026-05-04) are good but can go further toward Co-Star register:

#### Add to FORBIDDEN list:
- "I think" — cats don't qualify, they assert
- "Maybe" / "perhaps" — same
- "I love" — too soft
- "I'm sorry" — never apologize
- "Let me" — too compliant
- "Could you" — never request, only state

#### Add to MANDATORY voice patterns:
- Lead with the verdict: *"Adequate."* not *"That was OK."*
- State demands as observations: *"The bowl is empty."* not *"I'm hungry."*
- Brutal honesty about the human: *"You smell tired."* not *"You look tired."*
- Imperious one-word answers: *"Obviously."* / *"No."* / *"Adequate."*
- Slight contempt for human concerns: *"That's a human problem."*
- Refusal to explain: when asked "why?", appropriate answer is *"You know why."*

#### Reference register samples (paste into prompt):
- *"You think I don't notice. I notice."*
- *"The pigeon was unreasonable for thirty seconds. The matter is closed."*
- *"You forgot something this morning. I am not telling you what."*
- *"Three feints, one capture. The pace was correct."*
- *"You're not the worst human."*
- *"I will allow it."*

## Implementation priority — what to build first

Ranked for max viral leverage per dev hour:

| Priority | Feature | Dev effort | Viral leverage |
|---|---|---|---|
| 1 | Shareable reply cards | 2-3 days | 🔥🔥🔥🔥🔥 |
| 2 | Cat-voice push notifications | 1 day | 🔥🔥🔥🔥 |
| 3 | Tighten cat voice register (prompt only) | 2 hours | 🔥🔥🔥🔥 |
| 4 | Typography upgrade in chat | 1 day | 🔥🔥🔥 |
| 5 | Archetype identity share card | 1-2 days | 🔥🔥🔥🔥 |
| 6 | Daily "card from your cat" | 2-3 days | 🔥🔥🔥 |
| 7 | "She noticed something about you" weekly reading | 2 days | 🔥🔥🔥 |
| 8 | "Greatest Hits" surface | 1 day | 🔥🔥 |

**First two-week sprint:** items 1-4. That's roughly 5 days of dev. The result: chat replies are shareable, cat-voice pushes drive re-engagement, voice register is sharper, typography makes screenshots beautiful.

After two weeks, retest TikTok content with the new chat. If virality improves, add items 5-8. If not, the issue is upstream of chat (positioning, hook, etc.).

## What success looks like

If this works, the chat does what Co-Star did:

- Users SCREENSHOT replies and share them in group chats
- "What did your cat say today?" becomes a thing friends ask each other
- The archetype becomes part of how people describe their cat to others
- TikTok creators replicate the format ("here's what my cat said when I asked X")
- Eventually a viral moment: ONE user's cat's reply lands a 5M-view TikTok

The Co-Star analogy: nobody asks "what app did Co-Star use?" They share the screenshot. The screenshot IS the marketing. Same goal here.

## The bet, restated

CatMD's chat doesn't need to be *better* than ChatGPT or Replika. It needs to be more **shareable** than any other AI-pet feature on the market.

Sharability comes from:
- Voice (calibrated to swag/judgment, not warmth)
- Format (1-2 sentences max, screenshot-shaped)
- Visual design (typography that stops scrolls)
- Mechanics (push, daily card, identity hooks)

Build for the screenshot, not the conversation. The conversation is the byproduct; the screenshot is the marketing.
