# SKILL: x-buildinpublic

> **Owned by:** XPoster
> **Trigger:** Daily 10:00 AM (per HEARTBEAT.md) OR on-demand "draft an X post about [topic]"
> **Companion:** `knowledge/PRODUCT.md` (for any product mentions), `memory/sprint-state.md` (for current week + recent metrics)

---

## What this skill does

Pulls yesterday's metrics from PostHog/RevenueCat/platform analytics. Frames the story (build-in-public daily update). Drafts ONE X post under 280 chars, optionally with a screenshot suggestion.

---

## Step-by-step

| Step | Action |
|---|---|
| 1 | Read `memory/sprint-state.md` → current sprint week + day + most recent KPIs |
| 2 | Pull yesterday's metrics: paying users delta, MRR delta, top-performing video views, cumulative downloads, any threshold crossings |
| 3 | Read `memory/x-posts-log.md` last 7 entries — avoid repeating the same framing/angle |
| 4 | Read `knowledge/PRODUCT.md` — reference for any feature-mention angles |
| 5 | Pick ONE story angle from yesterday: a milestone, a learning, a piece of feedback, a process detail, a video that landed, a creator that posted |
| 6 | Draft the post (≤280 chars, founder voice — direct, lowercase OK, no hype) |
| 7 | Add suggested visual (screenshot of metric, cat reply card, video thumb) |
| 8 | Output to Slack at 10:30 AM with paste-ready post + char count + visual suggestion |
| 9 | Log to `memory/x-posts-log.md`: date, draft, framing angle, founder approval status |

## Post structure templates (rotate, don't repeat in 7 days)

### Template A — Milestone
```
Day [N] of building in public.

[Specific milestone — paying users, MRR, downloads]

[One concrete detail of what got it there]

[Cat-voice line if relevant — pull from voice-examples.md]
```

### Template B — Process detail
```
Today shipped: [feature/change]

The hardest part: [specific challenge]

[Lesson or what's next]

[Optional cat-voice line]
```

### Template C — Feedback / observation
```
Heard from a [user / creator / journalist] today:

"[Quote — paraphrased]"

[Founder reflection in 1 line]
```

### Template D — Cat-reply screenshot
```
[Single line setup]

[Attach cat-reply screenshot]

[Optional 1-line frame on what's interesting about it]
```

### Template E — Numbers + chart-of-the-day
```
Day [N]:
• Downloads: [N] ([+M] yesterday)
• Paying users: [N]
• MRR: [$N]
• Top video: [N] views

[1-line context line]
```

## Voice rules (per SOUL.md + IDENTITY.md)

- ✅ Lowercase often. Direct. Specific numbers.
- ✅ Cat-voice line is a RESERVED bonus — only when contextually fitting, not forced
- ❌ No "🚀 Excited to share..."
- ❌ No "Game-changing"
- ❌ No multiple emojis in series
- ❌ No threading unless the topic genuinely demands it (default: single post)

## Char count discipline

- 280 char hard cap (X free tier — Amit doesn't have Premium per IDENTITY.md)
- Image attached doesn't count toward chars
- Account for the URL preview if linking — it consumes ~24 chars internally

## When to NOT post

- Yesterday's metrics are completely flat AND no learning/process beat exists
- Threshold-alert moonshot is firing — that's a different post (handled by MetricsHawk)
- Last 7 days of posts have been heavy on metrics — pivot to process/feedback for variety

## Output format

```
## X build-in-public draft — [DATE]
Char count: [N]/280

[The draft post]

Suggested visual: [description / file path if available]
Framing angle: [Template letter]

Posting time recommendation: [based on engagement data — usually 8-9 AM PT or 6-7 PM PT]
```

## Founder review handoff

After Amit posts:
1. Founder updates `memory/x-posts-log.md` with the live URL
2. After 24h, MetricsHawk records engagement (likes, RTs, replies) and feeds back to the log
3. Posts that hit >50 likes → angle reinforced in voice-examples.md
4. Posts that hit <5 likes → flagged for review (was the framing wrong?)

## Self-improvement triggers

- 7-day median engagement drops by 50% from prior 7-day → review framing, voice drift
- Same angle repeated within 7 days → flag, force angle rotation
- A post crosses 100 likes → log the angle + first 3 words of opener (these are the high-leverage patterns)

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. 5 rotating templates. Bound to founder voice register (lowercase, direct). |
