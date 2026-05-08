# CatMD — Marketing Project

TikTok / Instagram Reels generation. AI video tools (Higgsfield + Seedance 2.0 Fast) for B-roll cat clips, screen-recordings of the actual app for product moments, mixed in CapCut / Final Cut.

## The strategy in one paragraph

Cat owners on TikTok are the most emotionally engaged audience on the platform. They share content that captures the SPECIFIC quirks of their cat or makes them feel **seen**. CatMD has features no other app has — a diary in the cat's voice, a chat where the cat actually replies, body-language reads, personality archetypes. The job of the videos is to make a cat owner stop scrolling, say "wait, what?", and tap. We don't pitch features. We pitch *the moment* — the cat saying something, the diary entry that lands, the personality result that nails them. The app is the punchline.

## Length rule — 15 seconds max

Every video targets **15 seconds total runtime, hard cap**. TikTok's algorithm rewards completion rate, and 15s videos consistently complete at ~1.5x the rate of 25-30s videos. Each storyboard is built around **a single feature, single beat, single punchline.** No multi-feature showcases. If you can't make it land in 15s, the concept is too broad — split it into two videos.

Storyboard 00 is already at 15s. Storyboards 01–05 were drafted at 25s; **trim them to 15s** before shooting (each can lose its longest beat without losing the hook).

## Folder structure

```
marketing/
  README.md                    ← you are here
  storyboards/                 ← shot-by-shot breakdowns of each video concept
    00-interact-with-your-cat.md  ⭐ LEAD VIDEO — start here
    01-cat-keeps-diary.md         (variation — diary-first emotional hook)
    02-talk-to-your-cat.md        (variation — chat-only)
    03-personality-quiz.md        (BuzzFeed-style, easy share)
    04-2am-google-vs-catmd.md     (triage / health-anxiety relief)
    05-body-language-read.md      (science-backed, demo-style)
  ai-video-prompts/            ← copy-paste prompts for Higgsfield / Seedance
    seedance-cat-broll.md          (B-roll cat clips — for videos where you don't film your own)
    seedance-mood-shots.md         (atmospheric shots — laptop, kitchen, sunbeams)
  assets/
    app-screenshots/           ← drop static screenshots here (chat, diary, posters)
    screen-recordings/         ← drop phone screen-recordings of app interactions
    cat-photos/                ← drop reference photos of cats (yours or stock)
    exports/                   ← finished videos go here before upload
  text-overlays.md             ← caption copy for on-screen text across videos
  brand-guide.md               ← colours, fonts, voice, dos/donts
  music-suggestions.md         ← royalty-free + TikTok-trending audio picks
```

## Production flow per video

For each storyboard, the workflow is:

1. **Capture real app moments**
   Open CatMD on your phone, set up the scene (e.g., type the chat message, wait for reply), record screen with Android's built-in recorder OR scrcpy. Save to `marketing/assets/screen-recordings/`.

2. **Generate B-roll cat clips with Higgsfield + Seedance**
   Use the prompts in `marketing/ai-video-prompts/seedance-cat-broll.md`. Each prompt produces a 5-second clip. You can either:
   - Provide a reference photo of YOUR cat for image-to-video (most consistent results — same cat appears across the video).
   - Or use a stock cat photo for generic cat-archetype shots.
   Save outputs to `marketing/assets/exports/` (or wherever Higgsfield downloads to).

3. **Edit in CapCut / Final Cut / Premiere**
   The storyboards specify exact timings (e.g., "0:00–0:03: cat staring out window"). Mix B-roll cat clips, screen recordings of the app, and text overlays. CapCut's free templates work well for the TikTok format (9:16, 30s typical).

4. **Audio**
   See `marketing/music-suggestions.md`. For each storyboard there's a suggested mood + royalty-free sound + 1–2 TikTok-trending audio options.

5. **Caption + post**
   See `marketing/text-overlays.md` for the on-screen text. Each storyboard ends with the same final card: app name + tagline + "link in bio."

## Lead concept

**`storyboards/00-interact-with-your-cat.md`** is the strongest first video to make. It's:
- Action → app reaction → reality matches structure (most replicable on TikTok)
- Shows BOTH chat (talking) and diary (cat writing back) — the two flagship interactions
- "I can text my cat now and she's been right every time" hook is immediately viral
- Made with **only your phone** — no AI video generation needed for v1
- Real footage of YOUR cat = trust signal that polished AI couldn't fake

Make this one first. If it lands, the others double down on different angles (diary-only at 01, personality-quiz format at 03, etc.).

## Tools

| Tool | What it's for |
|---|---|
| **Higgsfield AI** (https://higgsfield.ai/ai/video) | Cinematic B-roll cat clips. Image-to-video gives you control. |
| **Seedance 2.0 Fast** | Quick variations + lip-sync if you want the cat to "speak" |
| **scrcpy** (or Android screen recorder) | Capture phone-app interactions |
| **CapCut** | Final assembly (TikTok-native, free, fast) |
| **CapCut auto-captions** | For the spoken-text overlays |

## Brand non-negotiables (see `brand-guide.md`)

- Cat voice is **dry, slightly imperious, never saccharine**. Never "uwu" or "awww."
- App tagline: **"AI for cat owners. Your cat, decoded."** — use across all final cards
- App URL: **catmd.pet**
- Colour palette: cream `#FAF7F2`, sage `#5B8A7A`, terracotta `#C97B63`. Match these for any text overlays / final cards.
