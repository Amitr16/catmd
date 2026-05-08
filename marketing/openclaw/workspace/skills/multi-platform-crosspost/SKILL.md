# SKILL: multi-platform-crosspost

> **Owned by:** XPoster (with consultation from owner agents per platform)
> **Trigger:** When any single piece of content needs platform-specific variants
> **Companion:** `IDENTITY.md` (handle list), `voice-examples.md`

---

## What this skill does

Given a single piece of content (post idea, video drop, milestone), generates platform-specific variants for: TikTok, Instagram (Reels + Feed + Story), YouTube Shorts, X, Threads, Bluesky, Mastodon, LinkedIn, Reddit (specific subs), Telegram, Snapchat. Each variant respects the platform's:
- Character limits
- Hashtag conventions
- Audience expectations
- Posting cadence norms
- Algorithm preferences

---

## Platform-specific rules

| Platform | Char limit | Hashtag convention | Voice / format | Best posting time (PT) |
|---|---|---|---|---|
| **TikTok** | 4,000 (caption) but front-load first 150 chars | 5-7 hashtags, embedded in caption, mix high-volume + niche-discoverable. Use TikTok Search SEO terms | Lowercase, conversational, emoji minimal | 6-9 AM PT or 6-9 PM PT |
| **Instagram Reels** | 2,200 chars | 8-10 hashtags posted as FIRST COMMENT (not in caption — IG convention 2026) | Same caption as TikTok works; emoji slightly more accepted | 9 AM PT or 5-7 PM PT |
| **Instagram Feed (1:1)** | Same as Reels | Same | Slightly more polished register | Same |
| **Instagram Story** | 2,200 chars | None — stories don't index hashtags | Tap-to-vibe, polls, stickers | Anytime; story prime is 7-10 PM local |
| **YouTube Shorts** | Title 100 chars + Description 5,000 chars | 5-10 hashtags in description, plus #Shorts | Title is search-SEO loaded; description is full long-form | 6-9 AM PT (US wake-up time) |
| **X (Twitter)** | 280 chars (free tier — Amit doesn't have Premium) | 2-3 hashtags max; many founder posts use zero | Direct, lowercase OK, founder-voice register | 8-9 AM PT or 6-7 PM PT |
| **Threads** | 500 chars | 1-3 hashtags | Cross-post X content, slightly less terse | Inherits X cadence |
| **Bluesky** | 300 chars | None / minimal | Indie-friendly, slightly more thoughtful than X | Anytime, less algo-driven |
| **Mastodon** | 500 chars | Hashtags actually work for discovery | Niche communities — caturday.club instance | Wednesday Caturday is best |
| **LinkedIn** | 3,000 chars | 3-5 hashtags | Founder-story register, slightly more polished | Tue-Thu 9-11 AM PT |
| **Reddit (r/SideProject etc.)** | No char limit (use multi-paragraph) | None | Long-form journey-narrative; link at bottom | Mon-Wed mid-morning PT for indie subs |
| **Telegram** | 4,096 chars | Channel-specific | Formal-friendly; image-heavy | Evening for cat-channels |
| **Snapchat Spotlight** | Caption short | None | Visual-first, vertical only | Anytime |

## Step-by-step

| Step | Action |
|---|---|
| 1 | Receive source content (e.g., "we just hit 100 paying users — draft a cross-post") |
| 2 | Determine which platforms warrant a variant for this content |
| 3 | For each, draft platform-specific version using the rules above |
| 4 | Generate accompanying visual if one variant would benefit (delegate to image-generation skill) |
| 5 | Output to Slack: source content → table of platform-specific drafts |
| 6 | Founder reviews + posts (or rejects/edits) |

## Output format

```
## Cross-post draft — "[Source content summary]"

### TikTok (caption)
[Draft] (X/4000 chars)
Hashtags: [5-7]

### Instagram Reels (caption + first-comment hashtags)
Caption: [Draft]
First comment: [hashtags only]

### YouTube Shorts (title + description)
Title: [search-SEO loaded] (X/100)
Description: [Draft]
Hashtags: [5-10]

### X (post)
[Draft] (X/280 chars)

### Threads
[Draft] (X/500)

### Bluesky
[Draft] (X/300)

### Mastodon (caturday.club)
[Draft] (X/500)

### LinkedIn (if relevant — founder-story register)
[Draft]

### Reddit r/SideProject (if milestone-worthy)
Title: [Draft]
Body: [Multi-paragraph draft]

### Telegram (cat-tech channels)
[Draft]

### Suggested visual (if relevant)
[Description / queue image-generation skill]

### Posting schedule (recommended)
[Time per platform]
```

## When NOT to cross-post

| Situation | Why skip cross-post |
|---|---|
| Source content is a niche reply (e.g., a specific Reddit comment) | Stays on the source platform |
| Source is a build-in-public X post that's already low-engagement | Don't pollute other platforms with a flop |
| Source contains sensitive data (specific user info, internal numbers) | Privacy |
| Cross-post fatigue detected (last 7 days had 3+ cross-posts of similar content) | Vary the content; viewers see the same thing across platforms = unfollows |

## Voice consistency across platforms

Same brand voice on all platforms. Different REGISTER per platform:
- X: terse, founder-direct
- IG: slightly warmer, emoji-light
- TikTok: search-SEO + curiosity hook
- LinkedIn: founder-narrative
- Reddit: long-form authentic

But ALL use lowercase-comfort, no hype, no superlatives, specific over generic.

## Self-improvement triggers

- If a platform consistently underperforms despite good content → propose deprecating that platform
- If a platform consistently outperforms → propose increasing cadence
- If a specific format on a platform consistently lands → bake into voice-examples.md

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. 11 platforms covered with platform-specific rules. |
