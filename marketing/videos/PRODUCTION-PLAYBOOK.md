# CatMD video production playbook

> The standard end-to-end workflow for producing a 15-second TikTok /
> IG Reels marketing video for any CatMD feature. Use this for every
> video in the 9-video series (see `README.md` for the master list).
> Time budget: ~90 minutes per video, ~$3 in fal.ai credits.

---

## The promise of this playbook

Every video follows the same structure: **AI clip + AI clip + real screen
recording + AI clip + brand card = 15 seconds.** The format becomes
recognisable; viewers anticipate the punchline. Format consistency
+ feature variety = a real series, not random one-offs.

If you stick to the playbook, you can produce a fresh video in **one
focused 90-minute session per feature** with very predictable cost.

---

## Tools — what you need (one-time setup)

| Tool | Purpose | Cost / setup |
|---|---|---|
| **Google AI Studio** with `Gemini 2.5 Flash Image` ("Nano Banana") | Generate consistent stills (cat + human) | Free. Sign in with Google. |
| **fal.ai** with `fal-ai/minimax/hailuo-02/standard/image-to-video` | Animate stills into 5-second video clips | $5-10 credit covers ~30+ generations. Sign up at fal.ai. |
| **CapCut** (mobile or desktop) | Final timeline assembly, text overlays, music, export | Free. Mobile app or desktop. |
| **Phone screen recorder** (built-in on Android / iOS) | Capture real CatMD app footage | Free. Built in. |
| **Canva** (optional — for brand card) | Design the brand card if Nano Banana misfires | Free. |

You only set these up once. After that, every video just runs the
prompts through the same pipeline.

---

## The 7-step process

### Step 1 — Generate the AI stills (Nano Banana, ~5–10 min)

For each video you typically need **2–3 still images**: usually a cat
shot, a human shot, and sometimes a second cat shot for the
reaction beat. The corresponding storyboard tells you exactly which
ones.

**Workflow:**
1. Open Google AI Studio → New chat → pick model `Gemini 2.5 Flash Image`
2. Upload the **cat reference photo** (`marketing/assets/cat-photos/middle photo of Lily on grey sheet`) — this is the canonical reference for character consistency across all videos
3. Paste the still-prompt from the storyboard
4. Hit Run. Generate 3-5 variations. Pick the strongest.
5. Save the JPG to `marketing/videos/<NN-video-name>/stills/still-<N>.jpg`

**Key rules:**
- **Always upload the same Lily reference photo** for any cat shot — keeps cat identity consistent across the entire series
- For human shots, no reference upload needed (Nano Banana invents the human; specify age/gender/clothing in the prompt)
- For brand cards (the closing card), no reference upload needed — pure text-to-image

**Cost:** Free — Google AI Studio includes a generous quota.

**Common failure modes:**
- Cat anatomy weird (extra paw, distorted whiskers) → regenerate
- Human hands warped (two phones, finger fusion) → regenerate
- Wrong setting (modern instead of cosy, fluorescent instead of warm) → tweak prompt's lighting clause

### Step 2 — Animate stills via Hailuo (fal.ai, ~15 min)

For each still, generate a 5-second video clip via image-to-video.

**Workflow:**
1. Open https://fal.ai/models/fal-ai/minimax/hailuo-02/standard/image-to-video
2. Upload the still as **Image input**
3. Paste the animation-prompt from the storyboard
4. **Settings:** Duration 5s, Resolution 768p (cheaper, plenty of quality for vertical TikTok)
5. **Leave "End image url" blank** — only useful for big scene changes
6. Hit Run. Each generation takes ~60-90 seconds.
7. Generate 3-4 attempts per clip. Pick the best.
8. Download the .mp4 → save to `marketing/videos/<NN-video-name>/clips/clip-<N>.mp4`

**Cost:** ~$0.27 per 5-second generation at 768p. Per video budget:
~$2-3 across 3 clips × 3-4 attempts each. Per series: $15-30 total.

**Animation prompt structure (Hailuo prefers this):**
- **Camera direction first:** "Static camera, side angle." or "Static camera, chest-up framing."
- **Subject motion second:** "The cat's right paw lifts and gently taps a key." (specific verb-led actions)
- **Mood/lighting third (optional):** "Soft morning light unchanged."

Keep the prompt under 80 words. Hailuo doesn't need scene-setting
(the still IS the scene); it needs motion direction.

**Quality checks per clip:**
- No anatomical glitches (paws, faces, hands) at any frame
- Motion is natural, not jerky
- Cat doesn't morph into another colour mid-clip
- Background stays stable (no warping windows / shifting furniture)

### Step 3 — Record the screen footage (your phone, ~10 min)

This is the only piece that requires a working build of CatMD on
your phone. It's also the piece that proves the product is real —
viewers see actual app footage.

**Pre-flight:**
- Latest AAB installed on your phone (always check `expo.dev/artifacts/eas/...` for the most recent)
- Lily's profile (or your cat's) loaded with personality archetype + a few diary entries seeded
- Notifications silenced for the recording (no banner pop-ups in the capture)
- Battery indicator + signal indicator clean (or trim them out later)

**Workflow:**
1. Open CatMD → navigate to the screen the storyboard targets (Chat, Diary, Personality, Body Language, Daily Card, etc.)
2. **Start phone screen recording** — Android: pull-down → Screen recorder → 9:16 / portrait. iOS: Control Center → Screen Record.
3. Wait 1 second on a clean state (so the recording opens on something tidy)
4. Perform the action the storyboard specifies (type a question / open a feature / scroll a list)
5. **Verify the result is on-brand.** If the AI reply / generated content is generic or weak, retry — cost is cents per attempt and the whole video lives on this moment landing
6. Wait 2 seconds after the moment lands (lets the beat breathe in editing)
7. **Stop recording**
8. Save .mp4 to `marketing/videos/<NN-video-name>/recordings/clip-<N>-screen.mp4`

**The screen recording is sacred.** If it doesn't land the right
moment, the whole video falls flat. Don't compromise here — re-record
3-5 times if needed.

### Step 4 — Build the brand card (~5 min)

Two paths:

**Path A — Nano Banana (text-to-image):**
1. In Google AI Studio, no reference upload
2. Paste this prompt (adjust for the video — typically same across all):

```
A clean, minimal vertical brand card. Solid cream background, exact colour #FAF7F2. Vertical 9:16 aspect ratio (1080 wide by 1920 tall).

Centred and stacked composition with generous vertical spacing.

Top, centred, in a serif font (Source Serif or similar warm humanist serif), large size:
"CatMD"
Colour: deep sage green, exact colour #3F6456.

Below, italic, smaller, same sage:
"Talk to your cat."

Below that with more breathing room, sans-serif (Figtree-like), even smaller:
"catmd.pet"
Colour: warm terracotta, exact colour #C97B63.

Premium, minimal, no icons or illustrations. Plenty of empty space. Render every word crisply and legibly with exact spelling.
```

3. Generate 3-4 attempts. Verify every word is spelled correctly. Pick the cleanest.
4. Save as `final/brand-card.jpg`.

**Path B — pure CapCut (bulletproof fallback):**
1. CapCut → New project → 9:16
2. Add a solid colour clip → cream `#FAF7F2`, 4 seconds
3. Add 3 stacked text layers, centre-aligned:
   - **CatMD** — Source Serif Pro, 96pt, sage `#3F6456`
   - *Talk to your cat.* — Source Serif Pro Italic, 56pt, sage
   - **catmd.pet** — Figtree, 36pt, terracotta `#C97B63`
4. No animation — static.

Use Nano Banana first (faster + slightly nicer feel). If 4-5 attempts
all have a typo, fall back to CapCut.

### Step 5 — Assemble the timeline (CapCut, ~10 min)

The standard 15-second timeline:

| Time | Asset | Duration |
|---|---|---|
| 0:00–0:03 | AI clip 1 (cat moment) | 3s — trim from 5s raw |
| 0:03–0:05 | AI clip 2 (owner / reaction) | 2s — trim from 5s raw |
| 0:05–0:09 | Screen recording (the app moment) | 4s — trim to the punchline beat |
| 0:09–0:11 | AI clip 3 (cat reaction / cut-back) | 2s — trim from 5s raw |
| 0:11–0:15 | Brand card | 4s |

**Total: 15 seconds. Hard cap.** TikTok rewards videos under 15s with
~1.5× the completion rate.

**Editing rules:**
- Straight cuts. No fancy transitions. TikTok rewards lo-fi.
- Optional: 0.2s flash-cut between AI clip 1 and 2 to sell the moment of "phone buzzes"
- Trim each AI clip from its 5s raw down to the timing above; pick the most-natural-motion 2-3 seconds within each

### Step 6 — Text overlays + music (~8 min)

**Text overlays (CapCut):**

Standard format: TikTok "Classic" font, white with black outline,
bottom-third placement, 0.2s fade in + 0.2s fade out.

The hook line at 0:00 is the scroll-stopper — keep it lowercase,
conversational, under 8 words. Examples:
- *"wait. she's typing?"*
- *"every night at 7pm…"*
- *"i took the cat personality quiz"*
- *"she's been reading me too"*

The beat line at 0:09 is the "wait what" payoff — same style:
- *"she meant it."*
- *"she heard us."*
- *"and she's been right every time."*

Most videos: **2 text overlays max.** The screen recording carries
the middle. Don't crowd.

**Music:**
1. CapCut → Audio → Music → search "lofi minimal" / "calm piano hi-hat" / "soft hi-hat"
2. Sweet spot: single repeating piano note + light hi-hat
3. Drag onto audio track, trim to 15s
4. **Volume to -15dB** so the chat reply / app reveal text reads cleanly
5. Optional: build → release on the cat-reaction beat (0:09)

### Step 7 — Export, post, propagate (~10 min)

**Export from CapCut:**
- Resolution: 1080×1920
- Frame rate: 30fps
- Codec: H.264 / MP4
- Quality: high
- Save to `marketing/videos/<NN-video-name>/final/<video-name>-v1.mp4`
- File size should be 8-12 MB

**Post to TikTok:**
1. Upload the .mp4
2. Paste the standard caption template (see below) with the per-video hook line
3. Cover frame: pick the most-judgemental cat moment (typically a Clip 1 or Clip 4 still)
4. Set bio link → catmd.pet
5. Post

**Cross-post:**
- IG Reels: same file, same caption (8 hashtags fit fine in 2200-char limit)
- IG Stories: cross-post with "Tap link in bio" sticker
- X / Twitter: trim hashtags to 3-4
- YouTube Shorts: same file + description

---

## Standard caption template

Every CatMD post starts with `#catmd` so we can find organic UGC.
Per-video hook line is the only thing that changes:

```
[hook line, lowercase, conversational, ≤ 12 words]

CatMD lets you talk to your cat in their voice. they reply with their personality, their memory, what you've told them about themselves.

free in beta — link in bio

#catmd #catsoftiktok #cattalk #catpersonality #catsofinstagram #aiforcats #cathumor #catlovers
```

Per-video hashtag swaps to add:
- **Diary:** `#catdiary`
- **Personality:** `#cattypes`
- **Body Language:** `#catbehavior`
- **Daily Card / Weekly Reading:** `#cathoroscope`
- **Cat Studio:** `#catart #aicat`
- **Triage:** `#catcare #cathealth`

---

## Folder convention (per video)

```
marketing/videos/<NN-video-name>/
├── stills/                  # Nano Banana JPGs (the AI reference frames)
├── clips/                   # Hailuo MP4s (5s AI-animated clips)
├── recordings/              # Phone screen recordings of the actual app
├── final/                   # Exported final video + brand card asset
└── README.md                # (optional) per-video status
```

Nine of these folders already scaffolded for the full series — see
`marketing/videos/README.md` for the master inventory.

---

## Quality checklist before posting

Before hitting "Post", run through this:

- [ ] **Hook line lands within 0.5 seconds** — if a viewer can't scroll-stop in half a second, the algorithm won't push the video
- [ ] **Cat looks like Lily** in every AI clip (not a generic cat) — the photo reference upload should keep this consistent
- [ ] **Screen recording reply is specific, not generic** — re-record if the AI reply was bland
- [ ] **Every text overlay is readable at 1× speed on a phone screen** — if you can't read it, viewers can't either
- [ ] **No morphing or glitch frames** at clip transitions — trim 0.1-0.2s into each clip if needed
- [ ] **Music doesn't drown out the on-screen text** — bring music down to -15dB if in doubt
- [ ] **Brand card text is spelled correctly** — read every word
- [ ] **Caption pasted with #catmd FIRST** in the hashtag block

---

## Cost budget per video

| Step | Cost |
|---|---|
| Nano Banana stills | $0 |
| Hailuo image-to-video (3 clips × 4 attempts × $0.27) | ~$3.20 |
| CapCut + posting | $0 |
| **Per video** | **~$3** |
| **Per 9-video series** | **~$27** |

---

## Common pitfalls (and the fixes)

| Symptom | Likely cause | Fix |
|---|---|---|
| Cat in clip 1 and clip 4 look like different cats | Different reference photos used, or no reference upload | Always upload the SAME canonical Lily photo for every cat shot |
| Cat anatomy weird (3 paws, melted face) | Hailuo random failure | Regenerate. Picking the right take of 4 attempts solves 95% of cases. |
| Brand card has typo ("CafMD" / "catmid.pet") | Nano Banana text-render miss | Regenerate. If 4-5 attempts all fail, fall back to CapCut text-on-cream. |
| Screen recording shows wrong UI / generic chat reply | Outdated AAB OR bad LLM generation | Reinstall latest AAB. Re-record with retried chat prompt. |
| "Learned: …" chip showing in chat recording | Older AAB pre-vc-62 | Reinstall latest AAB. Or mask in CapCut with a cream rectangle over the chip area. |
| Video feels too long or boring | Pacing issue — usually the screen recording is too long | Trim screen recording to 4 seconds max. The reply should land within those 4 seconds. |
| Music drowns out the chat reply | Volume too high | -15dB on the music track |

---

## When to deviate from the playbook

- **Cat Studio video (#6)**: structure is different — instead of 3 AI scenes + 1 screen recording, it's 1 AI scene of cat at home + 4-6 actual generated posters from the app + brand card. Use the playbook's tools/process but adjust the timeline.
- **Triage video (#9)**: 20-second hard cap (vs 15s) because the triage flow has more screens to demonstrate. Justified for the credibility-piece audience.
- **Body Language Read (#4)**: 20-second hard cap because the channel-by-channel read has more text to read on screen.

For everything else, **stick to the playbook**. The format consistency
across the series is part of the brand.

---

## Per-video changelog

| Date | Video | Notes |
|---|---|---|
| 2026-05-05 | #1 Chat | First video produced. 3 stills + 3 clips done. Awaiting screen recording on vc 62 (chip-removed AAB). Process validated end-to-end. |
