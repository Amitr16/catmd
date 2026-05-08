# SKILL: creator-outreach

> **Owned by:** CreatorScout
> **Trigger:** Weekly Monday 10:00 AM + on-demand
> **Companion:** `marketing/INFLUENCER-PROSPECTS.md`, `memory/creator-pipeline.md`, `knowledge/PRODUCT.md`

---

## What this skill does

Maintains the creator outreach pipeline. Drafts personalized DMs for new prospects. Drafts follow-ups for stalled threads. Surfaces creators worth re-engaging post-launch.

---

## Pipeline states

Every creator in the pipeline lives in one of these states:

| State | Meaning |
|---|---|
| `prospect` | Identified but not yet DM'd |
| `dm_sent` | Initial DM sent, awaiting reply |
| `replied_yes` | Said yes, awaiting brief / asset / payment / post |
| `replied_no` | Politely declined — DON'T re-DM unless major change (e.g., viral hit) |
| `replied_maybe` | Wants more info or to think about it — needs follow-up |
| `silent` | No reply 96h+ after DM — needs ONE follow-up max |
| `posted` | Live post — track metrics in metrics-log |
| `paid` | $50 + Pro lifetime delivered |

## Step-by-step (Monday 10 AM batch)

| Step | Action |
|---|---|
| 1 | Read `memory/creator-pipeline.md` — current state of all creators |
| 2 | Identify prospects to DM this week (5-10 per Monday batch) |
| 3 | For each prospect: pull 2-3 recent posts from their feed, identify a specific reference for the personalized opener |
| 4 | Draft the DM using the template below with the personalized opener |
| 5 | If the prospect has a notable cat: propose generating a custom Feline Five archetype card via Nano Banana (and reference the card in the DM) |
| 6 | For `silent` creators >96h since DM: draft ONE follow-up per the template |
| 7 | Output all drafts to Slack at 10:30 AM with paste-ready DMs grouped by platform (TikTok / IG) |

## DM template (post-launch — when CatMD is live)

```
[Personalized opener referencing 2-3 specific things from THEIR feed —
NOT generic. Example: "Dan — your bit about cats demanding space and 
independence is basically the whole CatMD personality engine — Hank 
would have a Feline Five archetype and you'd love roasting him with 
the result."]

Quick pitch: we built CatMD — AI cat-care app where the cat replies 
in their own voice (dry, observant, slightly imperious). Daily diary 
the cat writes about you, personality archetype, body-language read 
from a 6-sec clip. Live on iOS + Android since [launch date].

Would you be up for posting one organic TikTok / Reel about it — your 
way, no script, no edits asked? Offer: free Pro lifetime + $50 cash 
(paid after the post is live). #ad / #sponsored disclosure required 
by platform terms.

I rendered [their cat's name]'s Feline Five archetype card — sending 
it because it felt right for [cat name] specifically. [card 
attachment]

catmd.pet — [Amit's name], DM open.
```

## DM template (pre-launch — confirmed launch date in pitch)

Same as above but with: *"We launch on iOS + Android **[launch date]**"* and *"Would you be up for posting in the [launch_date]–[+7 days] window — your way..."*

## Follow-up template (for `silent` creators 96h+ later)

```
hey [name] — just wanted to check if my DM from [date] landed in 
the void. no pressure either way. catmd.pet if curious. would 
genuinely love your read on [their cat's name]'s archetype if 
you're up for it.
```

## Custom archetype card prompt (for cat-influencer accounts)

When the recipient cat has high public visibility (e.g., Nala Cat, Smoothie, Cole and Marmalade), generate the custom Feline Five archetype card via Nano Banana and attach to the DM:

```
A 1080×1920 vertical card. Cream background (#FAF7F2). At top, 
elegant serif typography "[CAT NAME]". Below, in larger sage green 
serif: "[ARCHETYPE NAME]". Below in italic: "[archetype tagline]". 
A small reference photo of the cat (provided) styled cinematically 
in a circle at the bottom. Footer: "CatMD · catmd.pet". Brand 
palette: cream, sage, terracotta accent. Source Serif 4 typography 
throughout.
```

(Generate the card BEFORE drafting the DM so the DM can attach it.)

## Output format

```
## Creator outreach drafts — [DATE]

### New DMs (5)

#### 1. @[handle] — [Platform] — [Followers]
Status: prospect → dm_sent
Opener context: [why this prospect, what specific reference]
Custom archetype card needed: [yes/no]

DM draft:
[Full DM text]

#### 2. ...

### Follow-ups (N)

#### @[handle] — silent since [date]
Follow-up draft:
[Text]

### Pipeline summary
• Prospects total: [N]
• DM'd this week: [N]
• Replies pending: [N] (silent count: [M])
• Confirmed posts upcoming: [N]
• Posts live: [N]
```

## Founder review handoff

After Amit reviews:
1. Founder marks each draft as approved/edit/skip
2. Founder sends approved DMs (CreatorScout doesn't auto-send — per TOOLS.md hard rule)
3. Founder updates `memory/creator-pipeline.md` with state transition
4. Bot reads the pipeline on next run

## Self-improvement triggers

- DM reply rate <15% → review opener quality (was it specific enough?)
- Reply rate <20% but post-yes rate >60% → opener works, expand to higher-volume
- Custom archetype card boosts reply rate >2x → propose mandatory cards for top-tier prospects

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Anchored to INFLUENCER-PROSPECTS.md tier system. |
