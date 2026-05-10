# Video Audit vs vc 82 / v0.1.18 features

> **Drafted:** 2026-05-09
> **Source-of-truth:** `marketing/WHAT-CATMD-DOES.md` (vc 82)
> **Cross-check:** all 12 existing video concepts in `videos/README.md` + `NEW-FEATURES-FOR-VIDEOS.md`

---

## Audit summary — existing 12 videos

| # | Video | Maps to vc 82 feature | Aligned? |
|---|---|---|---|
| 1 | Chat | Chat (cat-voice) — Bond pillar | ✅ |
| 2 | Diary | Cat Diary — Bond pillar (7pm writing time, year-long archive) | ✅ |
| 3 | Personality | Personality Profile — 7+ archetypes (NOT 9 — small fix needed in storyboard) | ⚠️ minor: update from "Feline Five 9 archetypes" to "7+ archetypes" |
| 4 | Body Language | Body Language Reader — Care pillar | ✅ |
| 5 | Daily Card | Daily Card (Co-Star analog) — Bond pillar, **7pm push notification SHIPPED** (was 🟡 partial in old handover) | ✅ — feature is now fully shipped, push lock-screen moment is real |
| 6 | Cat Studio | Cat Studio — themed art rotation (movies, paintings, Studio Ghibli, Pixar, 80s anime) — Bond | ✅ |
| 7 | Weekly Reading | Weekly Reading ("She Noticed") — Sunday push, **SHIPPED** (was 🟡 in old handover) | ✅ — feature is now fully shipped |
| 8 | People & Pets | Household Directory — Memory pillar | ✅ |
| 9 | Triage | Triage Scan — Care pillar | ✅ |
| 10 | "Shot overdue" | Longitudinal Health Tracking → proactive memory line in chat | ✅ |
| 11 | "She filed my weight" | Bidirectional gateway via chat (longitudinal data write) | ✅ |
| 12 | "Skipped dose" | Medication adherence + proactive cat-voice line | ✅ |

**Net:** 11/12 perfectly aligned. Storyboard #3 (Personality) needs small phrasing fix — replace "Feline Five 9 archetypes" with "7+ archetypes" since the actual app uses Velcro Cat / Hunter / Confident Sociable / Watchful Observer / etc., not the Feline Five framework verbatim. The Feline Five is a separate library article, not the in-app archetype name.

---

## 5 new video concepts to add (the gaps)

### #13 — "She knows about the green chair"
**Pillar:** Memory — World Memory
**Hook:** *"my cat just referenced furniture I never told her about."*
**Single insight:** the cat silently learns your house from photos. After enough exposure, she references objects/places by name in chat and diary. THE viral hook for the Memory pillar (Demo Recipe #4 in WHAT-CATMD-DOES.md).
**Length:** 18-22s
**Why critical:** This is the most "uncanny / can-she-actually" moment in the entire app. Highest screenshot velocity of all 17 videos. Should drop in Week 5+ post the chat-voice videos have built audience trust.

**Storyboard skeleton:**
- 0:00–0:03: Chat screen recording — cat reply mentions "the green chair"
- 0:03–0:07: User narrating in caption "wait, I never told her..."
- 0:07–0:13: Cut to user's actual living room — pan to the actual green chair
- 0:13–0:17: Cut back to phone — cat's chat reply visible again
- 0:17–0:22: Brand card — *"CatMD. She figured it out from your photos."*

### #14 — "The Postcard"
**Pillar:** Bond — Postcard feature
**Hook:** *"today's photos, captioned by your cat."*
**Single insight:** distinct from Daily Card (which is text-only, evening). Postcard is a 1080×1080 photo collage of today's photos with AI-generated caption in cat-voice. Built for Instagram feed sharing.
**Length:** 15s
**Why useful:** different format than Daily Card; appeals to IG-feed-aesthetic crowd. Lower viral ceiling than Daily Card but high cadence-friendly (every day produces a Postcard).

### #15 — "48 hours later, she checked on me"
**Pillar:** Care — Triage outcome check-in
**Hook:** *"i ran a vet scan two days ago. then this notification came."*
**Single insight:** CatMD tracks the OUTCOME of triage scans. 48h after a "concern" or "monitor" tier scan, it pushes "how's Lily doing?" — turning a one-shot tool into a longitudinal care relationship.
**Length:** 18-22s
**Why useful:** strongest credibility-tier hook. Differentiates from "novelty triage" apps. Re-engagement loop demonstrated.

### #16 — "She knew which one was MINE"
**Pillar:** Memory — Identity matching
**Hook:** *"i took a photo with three cats. catmd picked out the one that was mine."*
**Single insight:** Multi-cat photo + AI tells you which is YOUR registered cat. Vision identity matching. Subtle moat feature.
**Length:** 12-15s
**Why useful:** appeals to multi-cat households (high-engagement segment). Demonstrates depth of vision system. Great for cat-cafe / shelter-volunteer adjacent content.

### #17 — "Year One"
**Pillar:** Bond — Year-end / birthday album (Pro upsell)
**Hook:** *"my cat just sent me a year of us."*
**Single insight:** End-of-year (or adoption-iversary) emotional payoff — the diary archive synthesized into a keepsake album. Pro feature. Drives renewal at the 12-month anniversary mark.
**Length:** 22-30s (this one earns the longer length — emotional pacing matters)
**Why useful:** retention + Pro-renewal lever. Drop in Q4 when the first cohort hits 6+ months of usage. Mother's Day / Father's Day adjacent posts.

---

## Updated 17-video drop schedule (Week 1 onwards post-launch)

| Drop date | Video | Tier |
|---|---|---|
| Fri May 15 5 AM PT | #1 Chat (LEAD) | Strong |
| Fri May 15 5 PM | #2 Diary | Strong |
| Sun May 17 1 PM | #3 Personality | Strong |
| Tue May 19 | #4 Body Language | Mid |
| Thu May 21 | #5 Daily Card | Mid |
| Sat May 23 | #6 Cat Studio | Mid |
| Tue May 26 | #7 Weekly Reading (eerie) | Strong-eerie |
| Thu May 28 | #8 People & Pets | Mid |
| Sat May 30 | #9 Triage | Utility |
| Mon Jun 1 | **#13 Green Chair (NEW)** | Strong-eerie |
| Wed Jun 3 | #10 Shot overdue (vc 67) | Strong |
| Fri Jun 5 | **#14 Postcard (NEW)** | Mid |
| Mon Jun 8 | **#15 48h Check-in (NEW)** | Credibility |
| Wed Jun 10 | #11 She filed my weight | Builder-audience |
| Fri Jun 12 | **#16 Identity matching (NEW)** | Multi-cat segment |
| Mon Jun 15 | #12 Skipped dose | Strong-eerie |
| Mon Jun 22+ | **#17 Year One (NEW)** — gated until cohort data exists | Emotional/retention |

**Net:** 17 videos across 5+ weeks, 1 video every 2-3 days post-launch. Hits the moonshot strategy doc target of "30 shots in 60 days" — re-cuts of winners + variants fill the remaining 13 slots.

---

## Production cost impact

5 new videos × ~$3-5 fal.ai credits each = **$15-25 additional**. Total 9-video bank cost was ~$30; updated 17-video bank cost is ~$50-55. Negligible vs the marketing budget.

---

## Storyboard fix needed

`storyboards/03-personality-quiz.md` — find any reference to "Feline Five" or "9 archetypes" that describes the in-app feature, replace with "7+ archetypes" or specific archetype names (Velcro Cat, Confident Sociable, Hunter, Watchful Observer, etc.).

The Feline Five is the peer-reviewed framework referenced in marketing positioning + the library article `feline-five-personality-framework`, but the in-app archetypes are slightly different and CatMD-specific. Don't conflate.

---

## What to do with this audit

1. Save this doc as the source-of-truth for the updated video bank
2. Update `videos/README.md` to add #13–#17 with brief shot lists (mirror the format of the existing per-video sections)
3. Update `MARKETING-OPERATING-PLAN.md` Week-N drop schedule to reflect 17-video run rate
4. Update OpenClaw bot's `knowledge/PRODUCT.md` to reflect vc 82 features (currently references vc 67)

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-09 | Initial audit. 12 existing videos validated against vc 82 spec. 5 new video concepts added. Storyboard #3 minor fix flagged. |
