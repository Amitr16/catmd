# SKILL: reddit-comments

> **Owned by:** ReddyTheBot
> **Trigger:** Daily 9:00 AM (per HEARTBEAT.md) OR on-demand "draft comments for [URL]"
> **Companion:** `marketing/REDDIT-DAILY-WORK.md` (the 12-pattern library), `knowledge/PRODUCT.md` (for any post-Week-4 mentions)

---

## What this skill does

Pulls fresh posts from r/CatAdvice, r/CatTraining, r/CatBehavior. Matches each post's question shape against the 12-pattern library. Drafts 3-5 paste-ready 2-4 sentence comments for Amit to review.

**Hard rule:** zero CatMD mentions before Week 4 of the sprint (per `reddit-strategy.md` §6). After Week 4, ONE soft mention per week max — and only when contextually relevant per pattern.

---

## Step-by-step

| Step | Action |
|---|---|
| 1 | HTTP fetch `reddit.com/r/CatAdvice/new.json?limit=15` + same for r/CatTraining + r/CatBehavior |
| 2 | Parse: title, body, post URL, comment count, post age. Filter posts <6h old, <10 comments, has a question mark. |
| 3 | For each candidate post, identify question shape. Match against 12 patterns from `marketing/REDDIT-DAILY-WORK.md` §3. If no pattern matches, skip. |
| 4 | For matched posts, generate a 2-4 sentence comment using the pattern template. Swap in 2-3 specific details from OP's post (cat's age, situation, what they tried). |
| 5 | Voice check: comment must sound like a real cat owner (first-person signals like "mine does this") — not corporate, not expert-y |
| 6 | Output to Slack/email digest at 9:30 AM with: post URL, matched pattern #, draft comment |
| 7 | Log to `memory/reddit-log.md`: date, post URLs, drafts produced, founder approval status (filled later) |

## The 12 patterns (canonical from REDDIT-DAILY-WORK.md §3)

| # | Trigger words | Topic |
|---|---|---|
| 1 | peeing outside box, going on carpet, stopped using box | Litter box avoidance |
| 2 | new cat, won't stop fighting, hissing, introducing | Multi-cat aggression / introductions |
| 3 | won't stop meowing, constant yowling, all night | Excessive vocalization |
| 4 | shredding couch, scratching furniture | Scratching |
| 5 | hiding under bed, won't come out, scared, new home | Anxious / hiding |
| 6 | out of nowhere, started doing X, personality changed | Sudden behavior change |
| 7 | won't eat, stopped eating, picky eater | Eating issues |
| 8 | licking herself bald, fur missing, over-grooming | Over-grooming |
| 9 | 3am crazy, wakes me at 4am, zoomies all night | Nighttime activity |
| 10 | bit me out of nowhere, attacks, petting aggression | Human aggression |
| 11 | cats fighting, one bullies, won't share | Multi-cat tension |
| 12 | older cat, [age]+ year, seems confused, senior cat | Cognitive decline |

## Comment-shape rules

- **2-4 sentences max.** Longer = skipped by readers
- **Empathy → answer → caveat.** Pattern templates already follow this; respect the structure
- **First-person cat-owner signals.** Use "mine does/did this", "ours stopped when..."
- **Specific knowledge, not generic.** Don't say "take to vet" as the only answer
- **Honest "I don't know"** if the OP's situation falls outside known patterns

## What to skip (never draft a comment for)

- OP edited/removed
- Vet emergency mid-question (just say "vet now")
- Photo-only post with no question
- Post >24h old with >100 comments (gets buried)
- Hostile OP or hostile comment thread
- Euthanasia / end-of-life topics (unless I have something specific + gentle)
- Product-recommendation requests by name (mod-flagged)

## Voice constraints

When drafting comments, voice = the founder's natural register (lowercase OK, conversational, specific). NOT cat-voice — these are HUMAN comments from Amit's aged cat-niche Reddit account. The cat-voice register is reserved for in-app cat replies, not Reddit comments.

## Output format

```
## Daily Reddit comments — [DATE]

### Match 1
Post: [URL]
Title: "[OP's title]"
Pattern: #N — [pattern name]
Draft:
[2-4 sentence comment]

### Match 2
...

### No matches today
[If 0-2 patterns matched, say so explicitly. Don't pad.]
```

## Founder review handoff

After Amit reviews and posts:
1. Founder updates `memory/reddit-log.md` with which drafts shipped
2. Bot reads the log on next run
3. Patterns in approved comments → reinforced in voice-examples.md
4. Patterns in rejected drafts → flagged in learnings.md ("rejected draft: [text] — reason: [why]")

## Self-improvement triggers

- If first-pass approval rate <70% over 7 days → review pattern matching, recalibrate
- If a drafted comment hits >100 upvotes after Amit posts → log the pattern that drove it, weight that pattern higher in future
- If a draft gets downvoted to <0 → log + understand why → adjust pattern template

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Anchored to the 12-pattern library in REDDIT-DAILY-WORK.md. |
