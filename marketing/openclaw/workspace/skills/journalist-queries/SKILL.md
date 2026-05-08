# SKILL: journalist-queries

> **Owned by:** PressWatcher
> **Trigger:** Daily 9:00 AM, 1:00 PM, 6:00 PM (per HEARTBEAT.md) + on-demand
> **Companion:** `marketing/PRESS-PROSPECTS.md`, `knowledge/PRODUCT.md`, `memory/press-pipeline.md`

---

## What this skill does

Reads daily digests from Connectively (formerly HARO), Qwoted, SourceBottle. Filters for cat-AI / pet-tech / indie-AI-app / founder-story queries. Drafts a response within 1 hour for relevant ones — the speed advantage is the lever.

---

## Step-by-step

| Step | Action |
|---|---|
| 1 | At 9 AM / 1 PM / 6 PM, fetch the latest digest from each of the 3 services (Connectively / Qwoted / SourceBottle) |
| 2 | For each query in the digest, check against keyword filter: `AI app`, `pet tech`, `cat behavior`, `indie founder`, `AI for pets`, `solo dev`, `cat owner survey`, `pet AI ethics`, `vet tech` |
| 3 | For matched queries, also check the deadline — if <2 hours, prioritize; if >24 hours, normal-priority |
| 4 | For each matched query, draft a response per the template below |
| 5 | Output to Slack with: query text, journalist name, outlet, deadline, draft response |
| 6 | Log to `memory/press-pipeline.md`: query, draft, outcome (filled by founder later) |

## Response template (per query)

The response should answer the journalist's question DIRECTLY first, then offer additional angles + interview availability.

```
[Direct answer to the journalist's question — 2-4 sentences, specific, 
no hype]

For context: I'm a solo dev who built CatMD, an AI cat-care app where 
the cat actually replies in their own voice (dry, observant, slightly 
imperious — closer to Co-Star than Replika). Plus a daily diary the 
cat writes about you, personality archetype on the Feline Five, 
body-language read from 6-sec clips, and 60-sec symptom triage with 
vet-ready PDFs. iOS + Android, [launch date], catmd.pet.

[Optional additional angles relevant to their query]

Available for phone or video interview today/tomorrow. Happy to 
provide screenshots, demo video, or a Pro account.

— Amit
catmd.pet
[contact]
```

## Tier-1 outlet escalation rule

If the journalist's outlet is in this list, ESCALATE the draft to Claude Sonnet via cloud API (not local Qwen):

- Verge, Wired, NYT, WSJ, Mashable, TechCrunch, BBC, FT, Bloomberg, Reuters, Engadget, Fast Company, The Atlantic, New Yorker

For these, draft quality is too high-stakes for local 35B. Tag the output as `claude-drafted-tier1-press` and stamp "founder-review-required" prominently.

## Filter keywords (broad — better to over-surface than miss)

`AI app`, `AI tools`, `AI for pets`, `pet tech`, `pet AI`, `cat behavior`, `cat health tech`, `cat owner survey`, `cat owner statistics`, `solo developer`, `solo founder`, `indie app`, `indie founder`, `mobile app launch`, `App Store editorial`, `Apple Search Ads`, `consumer AI app`, `AI companion app`, `Co-Star`, `Replika`, `Character.AI`, `ChatGPT competitor`, `vet tech`, `pet wellness app`, `AI ethics for pets`

When in doubt, surface the query — better for Amit to skip than miss.

## What NOT to surface

- Queries about specific competitors (Tably, Pawly) where CatMD isn't a direct fit
- Queries asking for medical/veterinary expert sources (Amit isn't a vet)
- Queries about generic AI ethics not specific to consumer apps
- Queries with deadline already past

## Output format

```
## Journalist queries — [DATE] [TIME slot]

### High-priority (deadline <2h)

#### Query 1 — [Journalist name] / [Outlet]
Tier: [1/2/3]
Deadline: [datetime]
Topic: [1-line summary of what they want]
Original query: "[Full query text]"

Draft response:
[Full response]

[If Tier-1: ⚠️ DRAFTED VIA CLOUD CLAUDE — review carefully]

### Normal-priority (deadline 2-24h)

[Same format as above]

### No matches this digest
[Explicit if 0]
```

## Founder review handoff

After Amit reviews:
1. Approves/edits/skips each draft
2. Sends approved responses via the journalist's specified channel (email / form / DM)
3. Updates `memory/press-pipeline.md` with outcome (sent/declined/coverage-landed)
4. If coverage lands → MetricsHawk fires the press-hit threshold alert

## Self-improvement triggers

- If a query type is consistently surfacing but never converting → tighten the filter
- If a query type has zero coverage in 4 weeks → consider if our angles match the kind of journalists asking
- If a Tier-1 response gets coverage → the cloud-escalation budget is well-spent; continue
- If founder consistently edits a part of the template → update the template

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. 3-services digest filter + cloud escalation for Tier-1 outlets. |
