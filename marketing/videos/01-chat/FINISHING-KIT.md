# Video #1 (Chat) — Finishing Kit

> **Drafted:** 2026-05-05
> **Purpose:** Everything needed to finish Video #1 in one ~60-min focused session. Drops Week 1 Monday on TikTok + IG Reels + YT Shorts.
> **Status:** 3/4 assets done (clip-1, clip-2, clip-4 in `clips/`; brand-card placeholder `Clip-5.jpg`). Pending: re-record Clip 3 + final brand card with icon + CapCut assembly + export.

---

## What's done vs pending

| Asset | Status | File |
|---|---|---|
| Still 1 (cat at laptop) | ✅ | `stills/still-1-cat-laptop.jpg` |
| Still 2 (owner / phone) | ✅ | `stills/still-2-owner-phone.jpg` |
| Still 4 (cat blink) | ✅ | `stills/still-4-cat-blink.jpg` |
| Clip 1 (cat at laptop, animated) | ✅ | `clips/clip-1.mp4` |
| Clip 2 (owner reaching for phone, animated) | ✅ | `clips/clip-2.mp4` |
| Clip 4 (cat blink, animated) | ✅ | `clips/clip-4.mp4` |
| **Clip 3 (chat screen recording on vc 62)** | 🟡 **Re-record needed** — old `clips/Clip3.mp4` likely has learned-facts chip | `recordings/clip-3-screen.mp4` |
| **Brand card with CatMD icon** | 🟡 **Refresh needed** — old `clips/Clip-5.jpg` lacks icon | `final/brand-card.jpg` |
| CapCut assembly | ❌ | — |
| Final export | ❌ | `final/01-chat-v1.mp4` |

---

## Step A — Re-record Clip 3 (the chat screen recording)

**Why re-do:** vc 62 shipped the chat without the "Learned: …" chip. The old recording has the chip and reads as cluttered. We want a clean chat-feed look so the reply lands as the only on-screen text.

### Pre-flight

- [ ] vc 62 AAB installed on phone (verify build version in Settings → About)
- [ ] Lily's profile loaded with personality archetype + 2-3 diary entries already seeded (so chat has memory context)
- [ ] DND on / notifications silenced
- [ ] Battery > 50% (cleaner status bar)
- [ ] Open CatMD → Chat tab → scroll to top so feed starts clean

### The shot — exactly what to capture

Per storyboard 00 §"Clip 2 — Chat exchange":

1. Start phone screen recording (Android pull-down → Screen recorder → 9:16 portrait)
2. Wait 1 full second on a clean Chat screen (no draft text in the input)
3. Type: **"Why are you on my laptop?"** — type at natural pace, don't rush
4. Hit Send
5. Wait for the reply to come in. **The reply must be specific + dry.**
6. Wait 2 full seconds after the reply finishes typing in (lets the beat breathe)
7. Stop recording

**Save to:** `marketing/videos/01-chat/recordings/clip-3-screen.mp4`

### What a "good" reply looks like (don't post if you don't get one)

✅ **Land these:**
- *"Because you keep typing instead of paying attention."*
- *"Yes. You know why."*
- *"It's warm. Also you're trying to ignore me."*
- *"Obviously. Reflect on your choices."*
- *"The keyboard is mine now. You may leave."*

❌ **Re-record if you get any of these:**
- *"I just like being close to you"* — too soft, no attitude
- *"I love spending time with you"* — saccharine, breaks the cat voice
- *"I want to be where you are"* — generic, could be any AI
- Any reply with "love", "appreciate", "thank you", "happy"

**The whole video lives or dies on this reply.** Per playbook: cost is ~3¢ per chat turn, regenerate the message until it lands. Aim for 3-5 attempts; pick the punchiest.

### Common failures to dodge

| Symptom | Fix |
|---|---|
| Status bar shows low battery | Charge to >50% before re-recording |
| Notification banner pops mid-recording | Toggle DND |
| Chat scrolls weird (jumps to top mid-record) | Start fresh — Chat tab, scroll to bottom, wait 1s, start recording |
| Reply types in too fast to read | Recording is fine — we'll trim and slow in CapCut if needed |
| Reply is generic | Long-press the bot message → regenerate, or send a slightly different opener |

---

## Step B — Brand card with CatMD icon (Nano Banana, ~5 min)

**Why refresh:** the existing `clips/Clip-5.jpg` brand card lacks the CatMD app icon. Per §0a we want the icon at the top — gives the closing card immediate brand recognition for repeat viewers.

### The Nano Banana prompt (paste exactly)

Open Google AI Studio → New chat → model `Gemini 2.5 Flash Image`. **Upload `store-listing/play-icon-512.png` as a reference image.** Then paste:

```
A clean, minimal vertical brand card. Solid cream background, exact colour #FAF7F2. Vertical 9:16 aspect ratio (1080 wide by 1920 tall).

Centred and stacked composition with generous vertical spacing.

At the top, centred horizontally, place the uploaded CatMD app icon at approximately 240×240 px. Render it crisply, no filter, no shadow, just the icon on cream. Generous space below the icon.

Below the icon, centred, in a serif font (Source Serif 4 or similar warm humanist serif), large size:
"CatMD"
Colour: deep sage green, exact colour #3F6456.

Below, italic, smaller, same sage:
"Talk to your cat."

Below that with more breathing room, sans-serif (Figtree-like), even smaller:
"catmd.pet"
Colour: warm terracotta, exact colour #C97B63.

Premium, minimal. Plenty of empty space. Render every word crisply and legibly with exact spelling. No icons, illustrations, or decorations beyond the CatMD icon at top.
```

**Generate 4 attempts.** Verify before picking:
- [ ] CatMD icon at top is legible (not warped / re-imagined)
- [ ] "CatMD" spelled correctly (not "CafMD" / "CatMID")
- [ ] "Talk to your cat." has the period
- [ ] "catmd.pet" all lowercase
- [ ] Cream background is true cream (not white-ish / yellow-ish)

**Save to:** `marketing/videos/01-chat/final/brand-card.jpg`

### Fallback (if Nano Banana keeps mangling text)

CapCut → New 9:16 project → solid colour clip → cream `#FAF7F2`, 4 seconds → drop in `store-listing/play-icon-512.png` as image overlay (centred, top third) → 3 stacked text layers below:

| Layer | Font | Size | Colour | Text |
|---|---|---|---|---|
| 1 | Source Serif 4 | 96pt | `#3F6456` | **CatMD** |
| 2 | Source Serif 4 Italic | 56pt | `#3F6456` | *Talk to your cat.* |
| 3 | Figtree | 36pt | `#C97B63` | catmd.pet |

Static — no animation. Export the 4s clip as `final/brand-card.mp4` instead of jpg.

---

## Step C — CapCut assembly (~10 min)

### Timeline (15s hard cap)

| Time | Asset (file) | Trim from raw | Notes |
|---|---|---|---|
| 0:00–0:03 | `clips/clip-1.mp4` | 5s → 3s | Cat at laptop. Pick the most natural-motion 3s. |
| 0:03–0:05 | `clips/clip-2.mp4` | 5s → 2s | Owner / phone. Pick the moment hand reaches phone. |
| 0:05–0:09 | `recordings/clip-3-screen.mp4` | trim to 4s | The question typed → reply lands. End on the reply being fully readable. |
| 0:09–0:11 | `clips/clip-4.mp4` | 5s → 2s | Cat blink. Pick the cleanest blink-frame sequence. |
| 0:11–0:15 | `final/brand-card.jpg` (or `.mp4`) | hold for 4s | Static. |

**Total: 15.0 seconds. Hard cap.**

### Editing rules (non-negotiable)

- Straight cuts. No transitions, no fades between clips.
- Optional: 0.15s flash-cut at 0:03 (clip 1 → clip 2) to sell the "phone buzzes" moment.
- Trim 0.1-0.2s into each AI clip if you see any morphing at the edge frames.

### Text overlays (CapCut "Classic" font, white with black outline)

| Time | Text | Position | Notes |
|---|---|---|---|
| 0:00–0:02 | `wait. i can text her now?` | bottom-third | 0.2s fade in/out. Lowercase, conversational. **The hook.** |
| 0:09–0:11 | `she's been right every time` | bottom-third | 0.2s fade in/out. The payoff. |

**Two overlays max.** The screen-recording reply is the biggest text in the middle — let it carry.

### Music

- CapCut → Audio → Music → search **"lofi minimal"** or **"calm piano hi-hat"** or **"soft hi-hat"**
- Sweet spot: single repeating piano note + light hi-hat
- Volume: **-15dB** (so reply text reads cleanly)
- Optional: build → release on the cat-blink beat at 0:09

---

## Step D — Export

| Setting | Value |
|---|---|
| Resolution | 1080 × 1920 |
| Frame rate | 30 fps |
| Codec | H.264 / MP4 |
| Quality | High |
| Target file size | 8–12 MB |

**Save to:** `marketing/videos/01-chat/final/01-chat-v1.mp4`

---

## Step E — Pre-post quality check (do not skip)

- [ ] Hook line readable in <0.5s
- [ ] Cat in clip 1 + clip 4 looks like the SAME cat (Lily)
- [ ] Reply in screen recording is specific + has attitude (not generic)
- [ ] No "Learned: …" chip visible anywhere in the screen recording
- [ ] No morphing or glitch frames at any clip edge
- [ ] Brand card text is spelled correctly (re-read every word)
- [ ] Music doesn't drown out the reply text
- [ ] Total length is 15.0 seconds (not 14.6, not 15.4 — TikTok rounds and treats "16s" videos worse)

---

## Step F — Caption variants (pick one, paste at upload)

**A — the storyboard default (recommended for first drop):**
```
i texted her and she's been right every time

CatMD lets you talk to your cat in their voice. they reply with their personality, their memory, what you've told them about themselves.

free in beta — link in bio
#catmd #catsoftiktok #cattalk #catpersonality #catsofinstagram #aiforcats #cathumor #catlovers
```

**B — confessional / curiosity-driven:**
```
i made an app where the cat replies. i did not expect the cat to be this honest

CatMD lets you talk to your cat in their voice. they reply with their personality, their memory, what you've told them about themselves.

free in beta — link in bio
#catmd #catsoftiktok #cattalk #catpersonality #catsofinstagram #aiforcats #cathumor #catlovers
```

**C — POV / cat-first:**
```
turns out my cat had a lot to say

CatMD lets you talk to your cat in their voice. they reply with their personality, their memory, what you've told them about themselves.

free in beta — link in bio
#catmd #catsoftiktok #cattalk #catpersonality #catsofinstagram #aiforcats #cathumor #catlovers
```

**Recommended:** A for TikTok primary drop (matches storyboard, tested hook). Save B and C for re-cut variants Week 2.

### Cover frame (TikTok)

Pick a still from `clips/clip-4.mp4` — the cat-blink moment. Specifically a frame with eyes ¾ closed and head slightly tilted. That's the most "judgemental" cat moment, which is what scroll-stops on the For You feed.

---

## Step G — Cross-post (do all three same day)

| Platform | File | Caption | Notes |
|---|---|---|---|
| TikTok | `final/01-chat-v1.mp4` | Caption A above | First drop. Reply to every comment for 48h. |
| IG Reels | Same file | Same caption | Hashtags fit fine. |
| YouTube Shorts | Same file | Same caption | Title field: "I can text my cat now (CatMD)" |

Optional same-day:
- IG Stories: cross-post Reel with "Tap link in bio" sticker
- X: trim caption to 280 chars, drop hashtags to 3-4: `#catsoftwitter #catmd #aiforcats`

---

## Total time estimate

| Step | Time |
|---|---|
| A — Screen recording (3-5 takes) | 15 min |
| B — Brand card (Nano Banana 4 attempts) | 5-10 min |
| C — CapCut assembly | 10 min |
| D — Export | 2 min |
| E — Quality check | 5 min |
| F-G — Caption + post + cross-post | 10 min |
| **Total** | **~50-60 min** |

---

## Next: log Week 1 drop in handover

After the video is up on all 3 platforms, append a row to `marketing/MARKETING-AGENT-HANDOVER.md` §0a "Current state":

```
| Video #1 (Chat) | ✅ Posted [date] to TikTok / IG / YT — [link] |
```
