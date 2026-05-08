# App Screenshots

Static screenshots from the curated Play Store set. Use as overlays / inserts in marketing videos when a screen-recording isn't needed.

## What's here

| File | What it shows | Use for storyboard |
|---|---|---|
| `01-today-sections.jpeg` | Today tab — daily check-in card | (general anchor shot) |
| `02-postcard-catsby.jpeg` | Postcard with collage + caption | (general — hint at Bond) |
| `03-personality-archetype.jpeg` | Velcro Cat archetype reveal | **03-personality-quiz** (the reveal beat) |
| `04-poster-catsby-hero.jpeg` | Cat Studio movie poster | (general — hint at Bond) |
| `05-body-language-result.jpeg` | Body language read with multi-channel breakdown | **05-body-language-read** (the result beat) |
| `06-triage-result-monitor.jpeg` | Monitor-tier triage result | **04-2am-google-vs-catmd** (the calm result beat) |
| `07-chat-knead.jpeg` | Chat — old voice, before persona shift | ⚠️ STALE — re-capture from new build |
| `08-diary-saturday.jpeg` | Diary entry from a Saturday | **01-cat-keeps-diary** (the diary reveal beat) |

## ⚠️ What needs re-capturing from the new app build

The current screenshots are from version 0.1.6. Several major UI changes shipped in 0.1.7:

1. **Chat** (`07-chat-knead.jpeg`) — the persona shifted from third-person AI companion to first-person cat voice with "Lily learned: I love tuna" chips. Re-capture once 0.1.7 is on your phone.
2. **Diary** (`08-diary-saturday.jpeg`) — the diary now references named family members and self-facts. New entries will be richer. Re-capture a recent entry once you've used the app for a week with named subjects.
3. **Personality** (`03-personality-archetype.jpeg`) — the screen now has the **Becoming progress wheel + facet accordion** below the archetype. Re-capture to show off the new identity-formation UI.
4. **NEW screen to capture: People & Pets** — `marketing/assets/app-screenshots/09-people-and-pets.jpeg` (TODO)
5. **NEW screen to capture: Subject tagging sheet** — `marketing/assets/app-screenshots/10-tag-sheet.jpeg` (TODO)
6. **NEW screen to capture: Becoming progress wheel** (zoomed) — `marketing/assets/app-screenshots/11-becoming-wheel.jpeg` (TODO)

Once 0.1.7 is on your phone, capture these in order:

```
adb exec-out screencap -p > marketing/assets/app-screenshots/09-people-and-pets.png
```

Or just take phone screenshots and AirDrop / Drive them over.

## Format

The Play Store uses JPEG at 1080px wide for portrait phone screenshots. For TikTok overlays, PNG is sometimes cleaner (lossless edges) — re-export to PNG if you notice JPEG artifacting on your phone screens at TikTok's render size.

## Hint: aim screenshots for "the cat said something" content

The diary entry (`08-diary-saturday.jpeg`) is the single most viral asset in this folder. A still image of a diary entry, even without a video around it, gets shared on Twitter / Instagram feed posts. Reuse it.
