# SKILL: video-production

> **Owned by:** Any agent (most often invoked by MetricsHawk via threshold-alerts, or autonomously by the bot when a viral angle is identified)
> **Trigger:** On-demand + autonomous when video opportunity detected
> **Companion:** `marketing/videos/PRODUCTION-PLAYBOOK.md`, `marketing/storyboards/`, `marketing/ai-video-prompts/`, `knowledge/PRODUCT.md`

---

## What this skill does

Generates complete video production specs autonomously. Given a content angle, produces:
1. A full storyboard (shot list, timing, text overlays, audio cues)
2. Nano Banana still prompts (for character-consistent stills)
3. Hailuo motion prompts (for animating stills into 5-sec clips)
4. Phone screen recording instructions (for real app footage)
5. CapCut assembly timeline
6. Caption copy (per platform)
7. Brand card design

The bot can either output the spec for Amit to produce, OR (if budget approved) execute the Hailuo + Nano Banana generations autonomously via fal.ai API.

---

## When the bot autonomously triggers this skill

| Trigger | Source |
|---|---|
| A video crosses 50K views | MetricsHawk → suggest 5 re-cut variants of the winner |
| A trending TikTok format/sound is detected matching a CatMD feature | Trend monitor → propose new storyboard |
| Competitor ships a feature CatMD has → positioning video | Competitor monitor → propose video |
| New product feature ships in vc N+1 → showcase video needed | IDENTITY.md monitoring → propose video |
| Press hit lands → "as featured on [outlet]" video | PressWatcher → propose follow-up video |
| Creator post goes viral (>100K views on their CatMD post) → response video | CreatorScout → propose stitch/duet |
| User-generated content surfaces (organic UGC with CatMD) → reaction video | Daily UGC monitoring → propose response |

## Step-by-step (full storyboard generation)

| Step | Action |
|---|---|
| 1 | Read the trigger context (e.g., "winner clip from Video #N had highest completion rate at 78%") |
| 2 | Define the single insight the new video will deliver — must be specific, must be different from prior videos |
| 3 | Choose format: 9:16 vertical, 24-38s length per 2026 best-practice update |
| 4 | Draft shot list — 4-6 beats, each ~3-5 seconds |
| 5 | For each beat, identify asset type: AI clip / screen recording / brand card / text overlay |
| 6 | For each AI clip, write Nano Banana still prompt + Hailuo motion prompt using the 5-sentence template |
| 7 | For each screen recording, specify which app surface to capture + what the user types/taps |
| 8 | Write text overlay copy per beat (sourced from voice-examples.md for voice consistency) |
| 9 | Specify audio per beat (mood / SFX / music / silence) |
| 10 | Draft caption copy per platform (TikTok / IG / YT / Threads / Bluesky) |
| 11 | Draft brand card design |
| 12 | Compile to full storyboard markdown file → save to `marketing/videos/[NN-name]/STORYBOARD.md` |
| 13 | Push summary to Slack: video name + insight + link to spec |

## Hailuo prompt template (always use the 5-sentence rule that works)

```
[CAMERA STATEMENT]. [SUBJECT POSITION]. [ONE SIMPLE ACTION AT
SPECIFIC SECOND]. [WHAT MUST STAY STILL]. [LIGHTING UNCHANGED].
```

5 short sentences. Under 50 words. Each does one job.

## Nano Banana still prompt template

```
A short-haired tabby cat (the same Lily character — reference photo
attached) [POSITION + EXPRESSION]. [LIGHTING — soft, natural, warm
window or golden hour]. [BACKGROUND — softly blurred, brand palette
cream/sage/terracotta]. Cinematic 35mm look, shallow depth of
field, natural light only. [EMOTIONAL READ — what the still
conveys].
```

Always upload the canonical Lily reference photo for character consistency.

## Brand card prompt template

```
A minimalist 9:16 vertical card. Cream background (#FAF7F2). At
the top center, a small dark sage circular icon (cat silhouette
in a sage circle). Below the icon, in elegant serif typography
(Source Serif 4 style), the words "CatMD" in sage dark green
(#3F6456). Below that: "[VIDEO-SPECIFIC TAGLINE]". Below that:
"catmd.pet". Centered, generous whitespace, luxurious editorial
feel.
```

## Autonomous Hailuo generation (if budget approved)

When the bot has a fal.ai budget cap configured (e.g., $5/week autonomous), it can:
1. Generate Nano Banana stills (free)
2. Generate Hailuo clips at $0.27/5s
3. Save outputs to `marketing/videos/[NN-name]/clips/`
4. Push Slack summary: "Generated [N] clips for Video [name]. [Cost]. Quality scores: [auto-rated]. Founder review at [path]."

## Quality gates

Before saving any storyboard:
- ✅ Hook lands in first 1-3 seconds
- ✅ Length 24-38s (per 2026 best-practice)
- ✅ Single insight, not multi-feature showcase
- ✅ Voice on-brand (cross-checked against voice-examples.md)
- ✅ Tied to one of the 9 archetypes / features in PRODUCT.md
- ✅ Has a screenshot moment (matches Co-Star pattern)
- ✅ Brand card matches brand palette + voice

If any gate fails, regenerate the spec; don't ship marginal storyboards.

## Output format (storyboard markdown)

```markdown
# Storyboard [NN] — [Title]

**Goal:** [Single sentence on what this video achieves]
**Length:** [N seconds]
**Single insight:** [One thing the viewer takes away]

## Shot list

| Time | Visual | Audio | Text overlay |
|---|---|---|---|
| 0:00–0:0X | [Description] | [Audio] | [Text] |
| ...

## AI prompts

### Still 1 — [Name]
[Nano Banana prompt]

### Clip 1 — [Name]
[Hailuo prompt]

[Repeat per clip]

## Screen recording instructions
[What to capture]

## Brand card
[Nano Banana brand card prompt]

## Caption per platform
TikTok: ...
IG Reels: ...
YT Shorts: ...
Threads: ...

## Quality check
- [ ] Hook in first 3s ✅
- [ ] 24-38s length ✅
- [ ] Single insight ✅
- [ ] Voice on-brand ✅
```

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Autonomous storyboard generator. Can produce full spec end-to-end. |
