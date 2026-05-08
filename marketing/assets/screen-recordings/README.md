# Screen Recordings — what to capture from the actual app

Drop your phone screen recordings here. Each storyboard tells you what to capture; this is the consolidated list.

## What you need to capture (one-time, ~30 minutes)

Once your phone has 0.1.7 + a few days of use:

### For Storyboard 01 (Cat Diary)
- `01a-diary-tab-open.mp4` — opening the Diary tab from Bond
- `01b-diary-entry-scroll.mp4` — scrolling through a juicy diary entry slowly
- `01c-chat-snark-reply.mp4` — typing "Lily, are you judging me?" + cat's reply

### For Storyboard 02 (Talk to your cat)
- `02a-chat-typing-q1.mp4` — typing first question, send, wait for reply
- `02b-chat-reply-q1.mp4` — focus on the reply text appearing
- `02c-chat-typing-q2.mp4` — second question, reply
- `02d-chat-reply-q2.mp4` — focus on the second reply

(or just one continuous recording of the full back-and-forth, then trim in CapCut)

### For Storyboard 03 (Personality Quiz)
- `03a-personality-quiz-q1-q4.mp4` — full quiz, taking each of the 4 questions
- `03b-archetype-reveal.mp4` — the result screen sliding in
- `03c-becoming-wheel.mp4` — scroll down to the new Becoming wheel + facet accordion (BONUS — shows off the deeper feature)

### For Storyboard 04 (2am Triage)
- `04a-triage-photo-capture.mp4` — Triage tab → snap photo → describe symptom
- `04b-triage-result-monitor.mp4` — the Monitor-tier result landing with explanation
- `04c-triage-result-scroll.mp4` — slow scroll through the structured result (red flags, what to monitor, vet questions)

### For Storyboard 05 (Body Language)
- `05a-bond-tab-read.mp4` — Bond tab → Read [cat] → upload a 6-second video
- `05b-bodylanguage-result.mp4` — the multi-channel read landing (tail, ears, eyes, posture, audio)

## How to record

**Android (built-in):**
1. Pull down notification shade twice (full quick-settings panel)
2. Tap "Screen Recorder" tile
3. Settings: 1080p, 60fps, mic OFF (we don't want phone audio in marketing clips)
4. Start, do the action, stop
5. Save → Files / Photos
6. Transfer to PC: USB cable + drag from `Internal Storage/Movies/`, or Drive sync

**Better quality (optional): scrcpy**
- `scrcpy --record file.mkv` — captures at native resolution, no compression
- Phone connected via USB, screen mirrored to PC, recording starts
- Better for the "polished" videos

**Even better: PC screen capture of phone mirror**
- Use scrcpy to mirror, then OBS Studio to record the mirror window
- Lets you size the recording window to 9:16 ratio, crop perfectly

## Tips

1. **Slow your taps.** Real-time interactions feel rushed on video. Tap, wait a beat, tap. The app's animations need to land.
2. **Hide your status bar** if you can — most Android phones have a Developer setting "Show clock & battery" that you can disable for clean recordings. Otherwise just trim the top in CapCut.
3. **Multiple takes per scene.** Record each interaction 2-3 times. Pick the best take in editing. The chat replies vary — only ~1 in 3 lands punchy enough for a viral clip.
4. **Don't compress.** Keep originals at high bitrate. Compression happens in CapCut + TikTok upload — don't double-compress.

## File naming convention

`<storyboard>-<sequence>-<short-description>.mp4`

Examples:
- `01a-diary-tab-open.mp4`
- `02b-chat-reply-q1.mp4`
- `04a-triage-photo-capture.mp4`

This makes it easy to find clips when editing.
