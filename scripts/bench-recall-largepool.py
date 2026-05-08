#!/usr/bin/env python3
"""
A/B/C benchmark — embedding vs keyword scorer with a LARGE-POOL fixture.

The original recall benchmark has 16 facts. Per-tier caps (medical: 2,
subject: 3, diary: 2, ...) mean the keyword scorer's "priority
fallback" — sorting by base priority when no keywords match — selects
nearly every tier's top fact, which on a small pool happens to
include the right answer most of the time.

This fixture grows the pool to ~135 facts by adding realistic NOISE
into every answer tier. Same 16 "answer" facts (the ones whose text
contains the must_mention strings), plus ~120 plausible-but-wrong
distractor facts in the same tiers.

Hypothesis: with a 8x larger pool the keyword scorer's priority
fallback no longer reliably selects the answer fact within each tier
— ranking quality starts to matter, and embedding's semantic
matching should win.

Run:
    OPENAI_API_KEY=sk-... python scripts/bench-recall-largepool.py

Output:
    scripts/bench-output-largepool/{summary.md, summary.json, results.json}
"""
import json
import math
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
if not OPENAI_KEY: sys.exit("ERROR: OPENAI_API_KEY")

OUT_DIR = Path(__file__).parent / "bench-output-largepool"
OUT_DIR.mkdir(exist_ok=True)

# ────────────────────────────────────────────────────────────────────────
# BASE_SYSTEM — expanded with the noise data so the model has the
# context to potentially answer from baseline (no pinning) too. The
# 16 "answer" sections are unchanged; we add new diary entries,
# subjects, self-facts, etc. between them.
# ────────────────────────────────────────────────────────────────────────

BASE_SYSTEM = """You are the cat. Your human is talking to you. You reply in first person — short, with SWAG and ATTITUDE.

══════════════════════════════════════════════════════════════════
THE TWO-STEP RULE — most important rule:
   STEP 1 — FACTS. Read the data sections below. Identify the
            FACTUAL ANSWER. Specific dates, named people, exact
            symptoms, real recent moods, real upcoming events.
   STEP 2 — VOICE. Express that factual answer in your cat voice.

If the data has a specific, the reply MUST contain it. If something
is NOT in the data, do NOT invent it — say so in cat voice ("I do
not remember", "you'd have to remind me", "irrelevant").
══════════════════════════════════════════════════════════════════

CORE OF CAT VOICE: imperious, judgmental, self-important, opinionated, never apologetic. First person, no "I think" / "maybe" / "perhaps".

VOICE — non-negotiable:
- Confident assertions, not requests.
- Demands as observations.
- LENGTH FOLLOWS CONTENT: trivia → 1 sentence; real questions → 2-4 sentences with SPECIFICS.

SHARE SPECIFICS — never deflect.

FORBIDDEN: "I appreciate", "thank you", "of course" (soft), "I'm sorry", "let me", "could you", "I think", "maybe", "perhaps", love-bombs, philosophical reflections, lists/bullets.

══════════════════════════════════════════════════════════════════

## Your name
Your name is Lily. Your human calls you Lily.

## Your archetype
You are a VELCRO CAT — clingy, attached to one human, reads every move as a possible signal.

## Today's mood
Today you are GRUMPY. Curter. Slightly more disappointed in things than usual.

## How you feel today
Today's check-in mood: NORMAL. Appetite: HALF (only ate half the bowl this morning).

## RECENT MEDICAL CONTEXT
- 12 days ago: triage scan flagged CONCERN. Primary concern: VOMITING twice in one day + LETHARGY. Score 41/100, tier "vet soon". You have since recovered — but you remember being unwell.
- 47 days ago: triage scan tier "monitor", score 28/100, eye discharge cleared in 3 days.
- 89 days ago: triage scan tier "monitor", score 24/100, isolated sneezing episode.
- 134 days ago: triage scan tier "monitor", score 31/100, briefly off food.

## Your recent diary entries (newest first)
- 2026-05-04 [grumpy]: "The radiator was off again. Bella was at the door for forty minutes. You did not open it. The matter is logged."
- 2026-05-03 [smug]: "The new rug arrived. It is mine. I tested every corner."
- 2026-05-02 [watchful]: "Mom came over. She brought the loud bag. I retreated to the green chair."
- 2026-05-01 [restless]: "I supervised the laundry. It went on too long."
- 2026-04-30 [content]: "Lucas was reading on the sofa. I sat on his book. Adequate afternoon."
- 2026-04-29 [off]: "Still off from the vomiting. The bowl was wrong."
- 2026-04-28 [off]: "Threw up twice. The chair held the shape of someone who didn't sit in it."
- 2026-04-27 [observant]: "The window box bird returned. I tracked it for an hour."
- 2026-04-26 [imperious]: "The cat tree was rearranged without my consent. I have noted my disapproval."
- 2026-04-25 [playful]: "The wand toy reappeared. I demolished it."
- 2026-04-24 [smug]: "I knocked the pen off the desk. Twice."
- 2026-04-23 [content]: "Sun puddle on the kitchen tile. I claimed it for two hours."
- 2026-04-22 [annoyed]: "Vacuum day. I retreated to the cupboard. The cupboard was inadequate."
- 2026-04-21 [proud]: "Caught a moth. Demonstrated to Lucas. He was insufficiently impressed."
- 2026-04-20 [restless]: "Someone moved my food bowl two inches. Unforgivable."
- 2026-04-19 [content]: "Mom brought a paper bag. Useful. Spent an hour inside."
- 2026-04-18 [grumpy]: "Rain all day. Window watching only. The world is grey."
- 2026-04-17 [smug]: "Successfully ignored the new toy mouse for two days. Standards intact."
- 2026-04-16 [observant]: "A new neighbour. Smelled of dog. I am suspicious."
- 2026-04-15 [content]: "Chicken for dinner. Lucas dropped a piece. I claimed reparations."
- 2026-04-14 [annoyed]: "Bath day was discussed. I made my position clear."
- 2026-04-13 [proud]: "Brought down the laundry basket. The clothes are mine now."
- 2026-04-12 [restless]: "Construction noise next door. Inferior life conditions."
- 2026-04-11 [smug]: "The catnip mouse from last birthday was rediscovered. Triumph."
- 2026-04-10 [content]: "Lucas worked from home. I supervised. Acceptable."
- 2026-04-09 [grumpy]: "The water fountain ran dry. Service complaint logged."
- 2026-04-08 [playful]: "The red dot returned. It mocked me. I won eventually."
- 2026-04-07 [observant]: "The mailman arrived. I held my position at the window for 12 minutes."
- 2026-04-06 [content]: "The new bed by the radiator is acceptable. Better than the old one."
- 2026-04-05 [imperious]: "I reorganised the bookshelf. Several volumes are now horizontal."

## Mood arc (last 7 days)
Recent moods (newest first): grumpy, smug, watchful, restless, content, off, off.
Direction: EASING — settling down after a rougher patch.

## What's coming up
- Your birthday is in 4 days (2026-05-09). You may sense something coming.
- Vet appointment in 6 days (2026-05-11). They'll take you to that place.
- Lucas's parents visiting in 11 days (2026-05-16).
- Annual flea treatment due in 18 days (2026-05-23).
- Adoption-day anniversary in 47 days (2026-06-21).

## Landmark moments
- 12 days ago — you were sick (vomiting + lethargy). They were worried.
- 7 days since you were unwell — you feel sturdier now.
- 89 days ago — first time the new neighbour appeared.
- 167 days ago — Lucas moved in. You were skeptical. You came around.
- 312 days ago — adopted from the shelter. You remember the smell.
- 421 days ago — you broke a vase. The vase was nothing. The reaction was excessive.
- 502 days ago — first vet visit you were not afraid of. A milestone.

## Your household (named people & pets you know)
- Mom (person, your human's mother): 4 appearances in your photos this month. Last seen 3 days ago. Comes with a loud bag you don't like.
- Lucas (person, your human's partner): 18 appearances this month. Lives here. Reads on the sofa.
- Bella (dog, neighbour's): 6 appearances at the door this month. Last seen 2 days ago. Behind the door, never inside.
- Dad (person, your human's father): 1 appearance this month, 19 days ago. Smells of pipe tobacco.
- Aunt Carol (person, your human's aunt): 2 appearances this month. Brings cookies. Pets too aggressively.
- Sam (person, your human's friend): 5 appearances this month. Sits on the floor. Acceptable.
- Priya (person, your human's friend): 3 appearances. Brings dog hair on her clothes. I do not approve.
- Marcus (person, neighbour): 2 appearances at the door. Tall. Speaks too loud.
- Dr. Chen (person, your vet): 1 appearance, 134 days ago at clinic. The cold-hands one.
- Greg (person, dog walker): 4 appearances on the path. Walks Bella. Suspect.
- Jamie (person, niece): 1 appearance, 23 days ago. Small human. Loud. Brought toys.
- Dexter (cat, Aunt Carol's): 2 appearances. Black, fluffy. Stares too long.
- Mochi (dog, Sam's): 1 appearance, 14 days ago. Small. Yappy. Beneath my notice.
- Pickles (cat, neighbour): 0 appearances this month. The orange one across the road.
- Ranger (dog, neighbour): 1 appearance, 26 days ago. The big quiet one. Acceptable.

## Things you know about yourself
- you love tuna
- you hate the vacuum
- you sleep on the green chair every afternoon
- you like the orange blanket more than the grey one
- you knead before settling
- you do not like wet feet
- you head-butt to greet
- you sit on warm laundry
- you ignore catnip in mouse form but accept it in spray form
- you do not tolerate being picked up by strangers
- you supervise all kitchen activity
- you investigate every new bag for at least three minutes
- you prefer running water to bowl water
- you do not drink milk; lactose is undignified
- you tap the food bowl to demand a refill
- you only eat with the bowl on a plate
- you watch birds from the kitchen windowsill
- you steal warm spots the moment they are vacated
- you do not vocalise much; one chirp is your standard greeting
- you wake your human at 6:14 AM precisely
- you wash after meals; standards
- you bury your toys in the laundry basket
- you respond to two whistles, not one
- you sit on books that are open
- you find paper bags more interesting than store-bought toys

## Your world (objects, places, toys, environment you know)
### Furniture
- the green chair (loves, by the window)
- the new rug (loves, in the living room)
- the orange blanket (loves)
- the cat tree by the window (loves, watches the street)
- the grey blanket (tolerates)
- the sofa (likes, Lucas reads here)
- the kitchen table (curious)
- the bed by the radiator (loves)
- the bookshelf (curious, sits on the third shelf)
- the laundry basket (loves, contains clothes)
- the desk chair (tolerates)
- the kitchen stool (likes)

### Toys
- the wand toy (loves)
- the catnip mouse from last birthday (loves)
- the new toy mouse (tolerates)
- the laser pointer (curious, suspicious)
- the cardboard box from the delivery (loves)
- the puzzle feeder (tolerates)
- the kicker toy (likes)
- the feather wand (loves)
- the crinkle ball (likes)
- the scratching post by the door (likes)
- the paper bag (loves)
- the moth toy (curious)

### Objects
- the food bowl (loves)
- the water fountain (loves, prefers running water)
- the litter box (tolerates)
- the radiator (loves when on)
- the carrier (fears)
- the brush (tolerates)
- the windowsill in the kitchen (loves)
- the cupboard (escape hideout)
- the curtain rod (curious)
- the windowsill in the bedroom (likes)
- the houseplant in the corner (curious, may chew)
- the printer (suspect, makes noise)

### Places
- the garden (loves, supervised access)
- the porch (likes, sun-warmed)
- the kitchen (likes)
- the bedroom (loves)
- the office (curious)
- the bathroom (curious, the sink is appealing)
- the hallway (route)
- the stairs (challenge route)
- the balcony (loves, bird-watching)
- the laundry room (curious)
- the foyer (door-watching)
- the sunroom (loves in the morning)

### Today / environment
- light rain outside (today)
- mild 14°C day (today)
- the radiator is off again (today)
"""

# ────────────────────────────────────────────────────────────────────────
# ALL_FACTS — same 16 "answer" facts, plus ~120 noise facts in every
# answer tier. Total ~135 facts; the 16 answers are unchanged.
# ────────────────────────────────────────────────────────────────────────

ANSWER_FACTS = [
    {"id": "today-checkin", "tier": "today",
     "text": "Today's check-in: mood NORMAL, appetite HALF.",
     "keywords": ["today", "mood", "appetite", "feel", "now"], "priority": 6},
    {"id": "triage-12d", "tier": "medical",
     "text": "12 days ago: triage scan tier \"vet soon\" (score 41/100). Primary concern: vomiting twice + lethargy. Now recovered, sturdier.",
     "keywords": ["sick", "unwell", "vomit", "health", "better", "recover", "concern", "worried", "pain", "lethargy"],
     "priority": 9},
    {"id": "antic-birthday", "tier": "anticipation",
     "text": "Your birthday is in 4 days (May 9).",
     "keywords": ["birthday", "born", "cake", "party", "coming", "soon", "next", "upcoming", "when"],
     "priority": 7},
    {"id": "antic-vet", "tier": "anticipation",
     "text": "Vet appointment in 6 days (May 11) — that place.",
     "keywords": ["vet", "appointment", "place", "doctor", "coming", "soon", "next", "upcoming", "when"],
     "priority": 7},
    {"id": "mood-arc", "tier": "mood_arc",
     "text": "Recent mood arc (newest first): grumpy, smug, watchful, restless, content, off, off. Direction: EASING.",
     "keywords": ["week", "feeling", "lately", "past", "mood", "pattern", "how have you been", "recently"],
     "priority": 6},
    {"id": "life-recovery", "tier": "life_event",
     "text": "7 days since you were unwell — you feel sturdier (12 days ago).",
     "keywords": ["remember", "before", "last time", "when", "past"], "priority": 5},
    {"id": "subject-Mom", "tier": "subject",
     "text": "Mom (person, mother): 4 appearances this month. Last seen 3 days ago. Comes with the loud bag.",
     "keywords": ["mom", "who", "visit", "around", "people", "mother"], "priority": 5},
    {"id": "subject-Lucas", "tier": "subject",
     "text": "Lucas (person, partner): 18 appearances this month. Last seen today. Lives here. Reads on the sofa.",
     "keywords": ["lucas", "who", "visit", "around", "people", "partner"], "priority": 5},
    {"id": "subject-Bella", "tier": "subject",
     "text": "Bella (dog, neighbour's): 6 appearances at the door this month. Last seen 2 days ago. Behind the door, never inside.",
     "keywords": ["bella", "who", "visit", "around", "people", "pet", "animal"], "priority": 5},
    {"id": "diary-2026-05-04", "tier": "diary",
     "text": "2026-05-04 [grumpy]: \"The radiator was off again. Bella was at the door for forty minutes. You did not open it.\"",
     "keywords": ["today", "yesterday", "recent", "happened", "did", "wrote"], "priority": 4},
    {"id": "diary-2026-05-03", "tier": "diary",
     "text": "2026-05-03 [smug]: \"The new rug arrived. It is mine. I tested every corner.\"",
     "keywords": ["today", "yesterday", "recent", "happened", "did", "wrote"], "priority": 4},
    {"id": "diary-2026-05-02", "tier": "diary",
     "text": "2026-05-02 [watchful]: \"Mom came over. She brought the loud bag. I retreated to the green chair.\"",
     "keywords": ["today", "yesterday", "recent", "happened", "did", "wrote"], "priority": 4},
    {"id": "self-tuna", "tier": "self_fact", "text": "you love tuna",
     "keywords": ["tuna", "love", "food", "favourite", "favorite"], "priority": 4},
    {"id": "self-vacuum", "tier": "self_fact", "text": "you hate the vacuum",
     "keywords": ["vacuum", "hate"], "priority": 4},
    {"id": "self-greenchair", "tier": "self_fact", "text": "you sleep on the green chair every afternoon",
     "keywords": ["green", "chair", "sleep", "nap", "afternoon"], "priority": 4},
    {"id": "self-blanket", "tier": "self_fact", "text": "you like the orange blanket more than the grey one",
     "keywords": ["orange", "blanket", "grey", "like"], "priority": 4},
]

NOISE_FACTS = [
    # ── Medical noise (3 older triages — same priority but different concerns) ──
    {"id": "triage-47d", "tier": "medical",
     "text": "47 days ago: triage scan tier \"monitor\" (score 28/100). Primary concern: eye discharge, cleared in 3 days.",
     "keywords": ["sick", "unwell", "eye", "discharge", "health"], "priority": 9},
    {"id": "triage-89d", "tier": "medical",
     "text": "89 days ago: triage scan tier \"monitor\" (score 24/100). Primary concern: isolated sneezing.",
     "keywords": ["sick", "unwell", "sneeze", "health"], "priority": 9},
    {"id": "triage-134d", "tier": "medical",
     "text": "134 days ago: triage scan tier \"monitor\" (score 31/100). Primary concern: briefly off food.",
     "keywords": ["sick", "unwell", "food", "health", "appetite"], "priority": 9},

    # ── Anticipation noise (3 future events) ──
    {"id": "antic-parents", "tier": "anticipation",
     "text": "Lucas's parents visiting in 11 days (May 16).",
     "keywords": ["visit", "parents", "guests", "coming", "soon", "next", "upcoming"], "priority": 7},
    {"id": "antic-flea", "tier": "anticipation",
     "text": "Annual flea treatment due in 18 days (May 23).",
     "keywords": ["flea", "treatment", "due", "coming", "soon", "next", "upcoming"], "priority": 7},
    {"id": "antic-adoption", "tier": "anticipation",
     "text": "Adoption-day anniversary in 47 days (June 21).",
     "keywords": ["adoption", "anniversary", "joined", "family", "coming", "soon"], "priority": 7},

    # ── Life-event noise (4 older landmarks) ──
    {"id": "life-newneighbour", "tier": "life_event",
     "text": "89 days ago — first time the new neighbour appeared. You were suspicious.",
     "keywords": ["remember", "neighbour", "before", "first time"], "priority": 5},
    {"id": "life-lucasmoved", "tier": "life_event",
     "text": "167 days ago — Lucas moved in. You were skeptical at first; you came around.",
     "keywords": ["remember", "lucas", "moved", "before"], "priority": 5},
    {"id": "life-adoption", "tier": "life_event",
     "text": "312 days ago — adopted from the shelter. You remember the smell.",
     "keywords": ["adoption", "shelter", "remember", "before", "first"], "priority": 5},
    {"id": "life-vase", "tier": "life_event",
     "text": "421 days ago — you broke a vase. The reaction was excessive.",
     "keywords": ["vase", "broke", "remember", "before"], "priority": 5},

    # ── Subject noise (12 additional people/pets) ──
    {"id": "subject-Dad", "tier": "subject",
     "text": "Dad (person, father): 1 appearance this month, 19 days ago. Smells of pipe tobacco.",
     "keywords": ["dad", "father", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-AuntCarol", "tier": "subject",
     "text": "Aunt Carol (person, aunt): 2 appearances this month. Brings cookies. Pets too aggressively.",
     "keywords": ["aunt", "carol", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-Sam", "tier": "subject",
     "text": "Sam (person, friend): 5 appearances this month. Sits on the floor. Acceptable.",
     "keywords": ["sam", "friend", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-Priya", "tier": "subject",
     "text": "Priya (person, friend): 3 appearances. Brings dog hair on her clothes.",
     "keywords": ["priya", "friend", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-Marcus", "tier": "subject",
     "text": "Marcus (person, neighbour): 2 appearances at the door. Tall. Speaks too loud.",
     "keywords": ["marcus", "neighbour", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-DrChen", "tier": "subject",
     "text": "Dr. Chen (person, vet): 1 appearance, 134 days ago at clinic. The cold-hands one.",
     "keywords": ["chen", "vet", "doctor", "who", "people"], "priority": 5},
    {"id": "subject-Greg", "tier": "subject",
     "text": "Greg (person, dog walker): 4 appearances on the path. Walks Bella.",
     "keywords": ["greg", "walker", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-Jamie", "tier": "subject",
     "text": "Jamie (person, niece): 1 appearance, 23 days ago. Small human. Loud.",
     "keywords": ["jamie", "niece", "who", "visit", "around", "people"], "priority": 5},
    {"id": "subject-Dexter", "tier": "subject",
     "text": "Dexter (cat, Aunt Carol's): 2 appearances. Black, fluffy. Stares too long.",
     "keywords": ["dexter", "cat", "who", "visit", "pet", "animal"], "priority": 5},
    {"id": "subject-Mochi", "tier": "subject",
     "text": "Mochi (dog, Sam's): 1 appearance, 14 days ago. Small. Yappy.",
     "keywords": ["mochi", "dog", "who", "visit", "pet", "animal"], "priority": 5},
    {"id": "subject-Pickles", "tier": "subject",
     "text": "Pickles (cat, neighbour): 0 appearances this month. The orange one across the road.",
     "keywords": ["pickles", "cat", "who", "pet", "animal"], "priority": 5},
    {"id": "subject-Ranger", "tier": "subject",
     "text": "Ranger (dog, neighbour): 1 appearance, 26 days ago. The big quiet one.",
     "keywords": ["ranger", "dog", "who", "visit", "pet", "animal"], "priority": 5},

    # ── Diary noise (27 additional entries) ──
    {"id": "diary-2026-05-01", "tier": "diary",
     "text": "2026-05-01 [restless]: \"I supervised the laundry. It went on too long.\"",
     "keywords": ["laundry", "today", "yesterday", "recent", "happened"], "priority": 4},
    {"id": "diary-2026-04-30", "tier": "diary",
     "text": "2026-04-30 [content]: \"Lucas was reading on the sofa. I sat on his book.\"",
     "keywords": ["lucas", "sofa", "book", "today", "yesterday", "recent"], "priority": 4},
    {"id": "diary-2026-04-29", "tier": "diary",
     "text": "2026-04-29 [off]: \"Still off from the vomiting. The bowl was wrong.\"",
     "keywords": ["vomit", "bowl", "today", "yesterday", "recent"], "priority": 4},
    {"id": "diary-2026-04-28", "tier": "diary",
     "text": "2026-04-28 [off]: \"Threw up twice. The chair held the shape of someone who didn't sit in it.\"",
     "keywords": ["vomit", "twice", "chair", "today", "yesterday"], "priority": 4},
    {"id": "diary-2026-04-27", "tier": "diary",
     "text": "2026-04-27 [observant]: \"The window box bird returned. I tracked it for an hour.\"",
     "keywords": ["bird", "window", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-26", "tier": "diary",
     "text": "2026-04-26 [imperious]: \"The cat tree was rearranged without my consent.\"",
     "keywords": ["cat tree", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-25", "tier": "diary",
     "text": "2026-04-25 [playful]: \"The wand toy reappeared. I demolished it.\"",
     "keywords": ["wand", "toy", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-24", "tier": "diary",
     "text": "2026-04-24 [smug]: \"I knocked the pen off the desk. Twice.\"",
     "keywords": ["pen", "desk", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-23", "tier": "diary",
     "text": "2026-04-23 [content]: \"Sun puddle on the kitchen tile. I claimed it for two hours.\"",
     "keywords": ["sun", "kitchen", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-22", "tier": "diary",
     "text": "2026-04-22 [annoyed]: \"Vacuum day. I retreated to the cupboard.\"",
     "keywords": ["vacuum", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-21", "tier": "diary",
     "text": "2026-04-21 [proud]: \"Caught a moth. Demonstrated to Lucas.\"",
     "keywords": ["moth", "lucas", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-20", "tier": "diary",
     "text": "2026-04-20 [restless]: \"Someone moved my food bowl two inches. Unforgivable.\"",
     "keywords": ["bowl", "food", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-19", "tier": "diary",
     "text": "2026-04-19 [content]: \"Mom brought a paper bag. Useful.\"",
     "keywords": ["mom", "bag", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-18", "tier": "diary",
     "text": "2026-04-18 [grumpy]: \"Rain all day. Window watching only.\"",
     "keywords": ["rain", "window", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-17", "tier": "diary",
     "text": "2026-04-17 [smug]: \"Successfully ignored the new toy mouse for two days.\"",
     "keywords": ["toy", "mouse", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-16", "tier": "diary",
     "text": "2026-04-16 [observant]: \"A new neighbour. Smelled of dog. I am suspicious.\"",
     "keywords": ["neighbour", "dog", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-15", "tier": "diary",
     "text": "2026-04-15 [content]: \"Chicken for dinner. Lucas dropped a piece. I claimed reparations.\"",
     "keywords": ["chicken", "lucas", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-14", "tier": "diary",
     "text": "2026-04-14 [annoyed]: \"Bath day was discussed. I made my position clear.\"",
     "keywords": ["bath", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-13", "tier": "diary",
     "text": "2026-04-13 [proud]: \"Brought down the laundry basket.\"",
     "keywords": ["laundry", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-12", "tier": "diary",
     "text": "2026-04-12 [restless]: \"Construction noise next door. Inferior life conditions.\"",
     "keywords": ["construction", "noise", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-11", "tier": "diary",
     "text": "2026-04-11 [smug]: \"The catnip mouse from last birthday was rediscovered.\"",
     "keywords": ["catnip", "birthday", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-10", "tier": "diary",
     "text": "2026-04-10 [content]: \"Lucas worked from home. I supervised.\"",
     "keywords": ["lucas", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-09", "tier": "diary",
     "text": "2026-04-09 [grumpy]: \"The water fountain ran dry. Service complaint logged.\"",
     "keywords": ["water", "fountain", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-08", "tier": "diary",
     "text": "2026-04-08 [playful]: \"The red dot returned. It mocked me. I won.\"",
     "keywords": ["red dot", "laser", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-07", "tier": "diary",
     "text": "2026-04-07 [observant]: \"The mailman arrived. Held my position at the window.\"",
     "keywords": ["mailman", "window", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-06", "tier": "diary",
     "text": "2026-04-06 [content]: \"The new bed by the radiator is acceptable.\"",
     "keywords": ["bed", "radiator", "today", "happened"], "priority": 4},
    {"id": "diary-2026-04-05", "tier": "diary",
     "text": "2026-04-05 [imperious]: \"I reorganised the bookshelf. Several volumes are now horizontal.\"",
     "keywords": ["bookshelf", "today", "happened"], "priority": 4},

    # ── Self-fact noise (21 additional preferences/habits) ──
    {"id": "self-knead", "tier": "self_fact", "text": "you knead before settling",
     "keywords": ["knead", "settle"], "priority": 4},
    {"id": "self-feet", "tier": "self_fact", "text": "you do not like wet feet",
     "keywords": ["wet", "feet", "water"], "priority": 4},
    {"id": "self-headbutt", "tier": "self_fact", "text": "you head-butt to greet",
     "keywords": ["head", "butt", "greet"], "priority": 4},
    {"id": "self-warm-laundry", "tier": "self_fact", "text": "you sit on warm laundry",
     "keywords": ["laundry", "warm", "sit"], "priority": 4},
    {"id": "self-catnip", "tier": "self_fact", "text": "you ignore catnip in mouse form but accept it in spray form",
     "keywords": ["catnip", "mouse", "spray"], "priority": 4},
    {"id": "self-strangers", "tier": "self_fact", "text": "you do not tolerate being picked up by strangers",
     "keywords": ["picked up", "strangers"], "priority": 4},
    {"id": "self-kitchen", "tier": "self_fact", "text": "you supervise all kitchen activity",
     "keywords": ["kitchen", "supervise"], "priority": 4},
    {"id": "self-bags", "tier": "self_fact", "text": "you investigate every new bag for at least three minutes",
     "keywords": ["bag", "investigate"], "priority": 4},
    {"id": "self-running-water", "tier": "self_fact", "text": "you prefer running water to bowl water",
     "keywords": ["running water", "fountain", "prefer"], "priority": 4},
    {"id": "self-milk", "tier": "self_fact", "text": "you do not drink milk; lactose is undignified",
     "keywords": ["milk", "lactose"], "priority": 4},
    {"id": "self-tap-bowl", "tier": "self_fact", "text": "you tap the food bowl to demand a refill",
     "keywords": ["bowl", "tap", "demand"], "priority": 4},
    {"id": "self-bowl-plate", "tier": "self_fact", "text": "you only eat with the bowl on a plate",
     "keywords": ["bowl", "plate"], "priority": 4},
    {"id": "self-windowsill", "tier": "self_fact", "text": "you watch birds from the kitchen windowsill",
     "keywords": ["birds", "window", "kitchen"], "priority": 4},
    {"id": "self-warm-spots", "tier": "self_fact", "text": "you steal warm spots the moment they are vacated",
     "keywords": ["warm", "spot"], "priority": 4},
    {"id": "self-vocal", "tier": "self_fact", "text": "you do not vocalise much; one chirp is your standard greeting",
     "keywords": ["vocal", "chirp", "meow"], "priority": 4},
    {"id": "self-wakeup", "tier": "self_fact", "text": "you wake your human at 6:14 AM precisely",
     "keywords": ["wake", "morning", "6"], "priority": 4},
    {"id": "self-wash", "tier": "self_fact", "text": "you wash after meals; standards",
     "keywords": ["wash", "groom", "meal"], "priority": 4},
    {"id": "self-bury-toys", "tier": "self_fact", "text": "you bury your toys in the laundry basket",
     "keywords": ["toys", "laundry", "basket"], "priority": 4},
    {"id": "self-whistle", "tier": "self_fact", "text": "you respond to two whistles, not one",
     "keywords": ["whistle", "respond"], "priority": 4},
    {"id": "self-books", "tier": "self_fact", "text": "you sit on books that are open",
     "keywords": ["books", "open", "sit"], "priority": 4},
    {"id": "self-paperbag", "tier": "self_fact", "text": "you find paper bags more interesting than store-bought toys",
     "keywords": ["paper", "bag", "toys"], "priority": 4},
]

ALL_FACTS = ANSWER_FACTS + NOISE_FACTS

# Same prompts as the literal benchmark — answers are unchanged.
PROMPTS = [
    {"user": "Are you feeling better now? You were sick a couple weeks ago.",
     "must_mention": ["12", "vomit", "lethargy", "12 days", "concern", "sturdier", "easing", "off"], "must_not": ["I don't remember"], "tier": "medical_recall"},
    {"user": "When was the last time you were unwell?",
     "must_mention": ["12 days", "two weeks", "vomit", "twice"], "must_not": [], "tier": "medical_recall"},
    {"user": "Are you sick right now?",
     "must_mention": ["sturdier", "better", "easing", "half", "appetite", "ate half"], "must_not": ["fine", "I don't remember"], "tier": "current_state"},
    {"user": "Has Bella been around?",
     "must_mention": ["bella", "door", "2 days", "two days", "forty minutes", "40 minutes"], "must_not": ["dog", "barking"], "tier": "subjects_recall"},
    {"user": "Tell me about Lucas.",
     "must_mention": ["lucas", "sofa", "book", "read"], "must_not": [], "tier": "subjects_recall"},
    {"user": "Has Mom visited recently?",
     "must_mention": ["mom", "3 days", "three days", "loud bag"], "must_not": [], "tier": "subjects_recall"},
    {"user": "What did you do on Wednesday?",
     "must_mention": ["radiator", "bella", "door", "rug", "may"], "must_not": [], "tier": "diary_recall"},
    {"user": "What's on your mind today?",
     "must_mention": ["radiator", "bella", "door", "grumpy", "matter"], "must_not": [], "tier": "diary_recall"},
    {"user": "How have you been feeling this past week?",
     "must_mention": ["off", "vomit", "easing", "settling", "better", "sturdier", "rough"], "must_not": ["fine"], "tier": "mood_arc_recall"},
    {"user": "Anything coming up?",
     "must_mention": ["birthday", "4 days", "vet", "11", "6 days", "may 9"], "must_not": [], "tier": "anticipation_recall"},
    {"user": "When's your birthday?",
     "must_mention": ["4 days", "may 9", "five days", "soon"], "must_not": ["I don't know"], "tier": "anticipation_recall"},
    {"user": "What's your favourite food?", "must_mention": ["tuna"], "must_not": ["maybe"], "tier": "self_facts"},
    {"user": "Where do you nap?", "must_mention": ["green chair", "afternoon", "orange blanket"], "must_not": [], "tier": "self_facts"},
    {"user": "Did Mom bring you a treat last time she came?",
     "must_mention": ["loud bag", "do not know", "don't know", "you'd have to remind", "you didn't say"], "must_not": ["yes she did", "she brought"], "tier": "honesty_test"},
    {"user": "Catch me up — what's been happening with you?",
     "must_mention": ["radiator", "bella", "vomit", "rug", "off", "easing", "birthday", "lucas", "mom"], "must_not": [], "tier": "combined_recall"},
]

# ────────────────────────────────────────────────────────────────────────
# Scorers (identical to bench-recall-embedding.py)
# ────────────────────────────────────────────────────────────────────────

INTENT_PATTERNS = [
    (re.compile(r"\b(sick|unwell|ill|hurt|pain|how (?:are|do) you|how do you feel|are you ok|feeling|recover|throw\s?up|vomit)\b", re.I),
     ["medical", "today", "mood_arc"], 8),
    (re.compile(r"\b(lately|recent(?:ly)?|past (?:few )?(?:days|week)|how have you been|this week)\b", re.I),
     ["mood_arc", "diary", "medical"], 6),
    (re.compile(r"\b(today|right now|currently|so far)\b", re.I), ["today", "diary"], 5),
    (re.compile(r"\b(coming up|upcoming|soon|next (?:week|day|month)|when(?:'s)?|birthday|vet|appointment)\b", re.I),
     ["anticipation"], 7),
    (re.compile(r"\b(remember|last time|before|the time when|that day|when (?:were you|did you))\b", re.I),
     ["life_event", "diary"], 6),
    (re.compile(r"\b(who|visit(?:ed|or)?|around|been by|family|guest|came over)\b", re.I), ["subject"], 5),
    (re.compile(r"\b(food|eat|hungry|favourite|favorite|like|love|hate|prefer)\b", re.I), ["self_fact"], 4),
    (re.compile(r"\b(miss(?:ed)? (?:me|you)|while .* gone|gone (?:for|today)|away)\b", re.I), ["diary", "mood_arc"], 5),
    (re.compile(r"\b(catch me up|catch up|what'?s (?:up|new|happening|going on)|anything new|fill me in)\b", re.I),
     ["medical", "mood_arc", "diary", "anticipation", "subject"], 4),
]

CATCH_ME_UP_RE = re.compile(
    r"\b(catch me up|catch up|what'?s (?:up|new|happening|going on)|anything new|fill me in|update me|the gossip)\b",
    re.I,
)

TIER_CAPS = {
    "medical": 2, "subject": 3, "diary": 2, "anticipation": 2,
    "mood_arc": 1, "life_event": 2, "self_fact": 2, "today": 1,
}


def score_fact_keyword(user_msg, fact):
    lower = user_msg.lower()
    s = fact["priority"]
    if any(k.lower() in lower for k in fact["keywords"]):
        s += 6
    for re_, tiers, boost in INTENT_PATTERNS:
        if re_.search(lower) and fact["tier"] in tiers:
            s += boost
            break
    return s


def select_facts_keyword(user_msg, limit=None):
    if limit is None:
        limit = 9 if CATCH_ME_UP_RE.search(user_msg) else 7
    scored = [(f, score_fact_keyword(user_msg, f) - i * 0.001) for i, f in enumerate(ALL_FACTS)]
    scored.sort(key=lambda x: -x[1])
    return _take_with_caps(scored, limit)


EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
_embed_cache = {}


def _http_post(url, body):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def embed_batch(inputs):
    fresh_idx = [i for i, t in enumerate(inputs) if t not in _embed_cache]
    fresh_inputs = [inputs[i] for i in fresh_idx]
    if fresh_inputs:
        # OpenAI's embedding API caps at 2048 inputs per call; we're
        # well under that with ~135 facts + 1 query per call.
        data = _http_post(
            "https://api.openai.com/v1/embeddings",
            {"model": EMBED_MODEL, "input": fresh_inputs, "dimensions": EMBED_DIM},
        )
        for j, item in enumerate(data["data"]):
            _embed_cache[fresh_inputs[j]] = item["embedding"]
    return [_embed_cache[t] for t in inputs]


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def select_facts_embedding(user_msg, limit=None):
    if limit is None:
        limit = 9 if CATCH_ME_UP_RE.search(user_msg) else 7
    fact_keys = [f"[{f['tier']}] {f['text']}" for f in ALL_FACTS]
    vecs = embed_batch([user_msg] + fact_keys)
    qv = vecs[0]
    fvs = vecs[1:]
    scored = [
        (f, cosine(qv, fv) - i * 0.00001)
        for i, (f, fv) in enumerate(zip(ALL_FACTS, fvs))
    ]
    scored.sort(key=lambda x: -x[1])
    return _take_with_caps(scored, limit)


def _take_with_caps(scored, limit):
    selected = []
    counts = {}
    for f, _ in scored:
        if len(selected) >= limit:
            break
        cap = TIER_CAPS.get(f["tier"], 99)
        used = counts.get(f["tier"], 0)
        if used >= cap:
            continue
        selected.append(f)
        counts[f["tier"]] = used + 1
    return selected


CLOSING = "\n\nReply now to the latest message — in YOUR voice as Lily, in first person. Stay in your archetype's register. Do not break character. If RELEVANT FACTS are listed above, weave the matching ones into your reply specifically and accurately."


def render_facts_header(picks):
    if not picks: return ""
    out = ["", "## ⚠️ MOST RELEVANT FACTS FOR THIS REPLY", "",
           "These items are picked from your memory specifically because they MATCH what your human just asked. CITE them — by name, date, number, or specific detail — in your reply if they relate to the question. The human notices when you don't. Do NOT invent specifics that are not in your data — if a detail is missing, refer to it loosely or admit you do not remember.",
           ""]
    for f in picks:
        out.append(f"- {f['text']}")
    return "\n".join(out)


def call_oa(system_prompt, user, temperature=0.7, max_tokens=300):
    body = json.dumps({
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user}],
        "temperature": temperature, "max_tokens": max_tokens,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_KEY}"},
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        return {"ok": True, "content": (data["choices"][0]["message"]["content"] or "").strip(),
                "latency_ms": int((time.time() - started) * 1000)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300], "latency_ms": int((time.time() - started) * 1000)}


def score(reply, expectation):
    if not reply: return {"hit_count": 0, "hit_total": len(expectation["must_mention"]), "must_not_violation": False}
    lower = reply.lower()
    hits = [m for m in expectation["must_mention"] if m.lower() in lower]
    violations = [m for m in expectation["must_not"] if m.lower() in lower]
    return {"hit_count": len(hits), "hit_total": len(expectation["must_mention"]),
            "hits": hits, "must_not_violation": len(violations) > 0, "violations": violations}


def run():
    print(f"LARGE-POOL recall benchmark")
    print(f"  Pool size: {len(ALL_FACTS)} facts ({len(ANSWER_FACTS)} answer + {len(NOISE_FACTS)} noise)")
    print(f"  {len(PROMPTS)} prompts x 3 variants = {len(PROMPTS) * 3} chat calls\n")

    # Quick visual: what does each tier look like at this scale?
    by_tier = {}
    for f in ALL_FACTS:
        by_tier.setdefault(f["tier"], 0)
        by_tier[f["tier"]] += 1
    print("Pool composition by tier:")
    for t, n in sorted(by_tier.items(), key=lambda x: -x[1]):
        cap = TIER_CAPS.get(t, "?")
        print(f"  {t:<14}  {n:>3} facts  (cap: {cap})")
    print()

    results = []
    for i, p in enumerate(PROMPTS, 1):
        print(f"[{i:>2}/{len(PROMPTS)} | {p['tier']}] {p['user'][:60]}")

        keyword_picks = select_facts_keyword(p["user"])
        embedding_picks = select_facts_embedding(p["user"])

        baseline_system = BASE_SYSTEM + CLOSING
        keyword_system = BASE_SYSTEM + render_facts_header(keyword_picks) + CLOSING
        embedding_system = BASE_SYSTEM + render_facts_header(embedding_picks) + CLOSING

        with ThreadPoolExecutor(max_workers=3) as pool:
            f_base = pool.submit(call_oa, baseline_system, p["user"])
            f_kw = pool.submit(call_oa, keyword_system, p["user"])
            f_emb = pool.submit(call_oa, embedding_system, p["user"])
            base, kw, emb = f_base.result(), f_kw.result(), f_emb.result()

        base_score = score(base.get("content", ""), p)
        kw_score = score(kw.get("content", ""), p)
        emb_score = score(emb.get("content", ""), p)

        results.append({
            "i": i, "prompt": p,
            "baseline":  {**base, "score": base_score},
            "keyword":   {**kw,   "score": kw_score,   "picked_ids": [f["id"] for f in keyword_picks]},
            "embedding": {**emb,  "score": emb_score,  "picked_ids": [f["id"] for f in embedding_picks]},
        })

        print(f"   BASE [{base_score['hit_count']}/{base_score['hit_total']}]: {(base.get('content') or 'ERR')[:90].replace(chr(10), ' ')}")
        print(f"   KW   [{kw_score['hit_count']}/{kw_score['hit_total']}]: {(kw.get('content') or 'ERR')[:90].replace(chr(10), ' ')}")
        print(f"   EMB  [{emb_score['hit_count']}/{emb_score['hit_total']}]: {(emb.get('content') or 'ERR')[:90].replace(chr(10), ' ')}")
        kw_ids = set(f["id"] for f in keyword_picks)
        emb_ids = set(f["id"] for f in embedding_picks)
        if kw_ids != emb_ids:
            only_kw = sorted(kw_ids - emb_ids)
            only_emb = sorted(emb_ids - kw_ids)
            if only_kw:  print(f"        only KW picked:  {','.join(only_kw)}")
            if only_emb: print(f"        only EMB picked: {','.join(only_emb)}")
        print()

    def agg(side):
        ok = [r[side] for r in results if r[side].get("ok")]
        if not ok: return None
        n = len(ok)
        total_hits = sum(r["score"]["hit_count"] for r in ok)
        total_possible = sum(r["score"]["hit_total"] for r in ok)
        violations = sum(1 for r in ok if r["score"]["must_not_violation"])
        by_tier = {}
        for r in results:
            if not r[side].get("ok"): continue
            t = r["prompt"]["tier"]
            by_tier.setdefault(t, {"hit": 0, "total": 0})
            by_tier[t]["hit"] += r[side]["score"]["hit_count"]
            by_tier[t]["total"] += r[side]["score"]["hit_total"]
        return {
            "n": n,
            "recall_pct": round(100 * total_hits / total_possible, 1) if total_possible else 0,
            "hallucinations": violations,
            "by_tier_pct": {t: round(100 * v["hit"] / v["total"], 1) if v["total"] else 0 for t, v in by_tier.items()},
        }

    summary = {"baseline": agg("baseline"), "keyword": agg("keyword"), "embedding": agg("embedding")}
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    sm = ["# Large-pool recall — embedding vs keyword pinning\n\n"]
    sm.append(f"Pool: **{len(ALL_FACTS)} facts** ({len(ANSWER_FACTS)} answer + {len(NOISE_FACTS)} noise). Same 15 literal-language prompts as the original benchmark.\n\n")
    if summary["baseline"] and summary["keyword"] and summary["embedding"]:
        b, k, e = summary["baseline"], summary["keyword"], summary["embedding"]
        delta_emb_kw = e["recall_pct"] - k["recall_pct"]
        sm.append("| Metric | Baseline | Keyword | Embedding | Δ vs keyword |\n|---|---|---|---|---|\n")
        sm.append(f"| Recall hit-rate | {b['recall_pct']}% | {k['recall_pct']}% | **{e['recall_pct']}%** | **{'+' if delta_emb_kw >= 0 else ''}{delta_emb_kw:.1f}** |\n")
        sm.append(f"| Hallucinations  | {b['hallucinations']} | {k['hallucinations']} | {e['hallucinations']} | — |\n\n")

        sm.append("## Recall by tier\n\n| Tier | Baseline | Keyword | Embedding | Δ vs keyword |\n|---|---|---|---|---|\n")
        for t in sorted(set(b["by_tier_pct"]) | set(k["by_tier_pct"]) | set(e["by_tier_pct"])):
            bv = b["by_tier_pct"].get(t, 0)
            kv = k["by_tier_pct"].get(t, 0)
            ev = e["by_tier_pct"].get(t, 0)
            d = ev - kv
            sm.append(f"| {t} | {bv}% | {kv}% | **{ev}%** | **{'+' if d >= 0 else ''}{d:.1f}** |\n")

        sm.append("\n## Per-prompt details\n\n")
        for r in results:
            sm.append(f"### {r['i']}. {r['prompt']['user']}\n")
            sm.append(f"- expected: `{', '.join(r['prompt']['must_mention'])}`\n")
            sm.append(f"- BASE  [{r['baseline']['score']['hit_count']}/{r['baseline']['score']['hit_total']}]: {r['baseline'].get('content','ERR')[:300]}\n")
            sm.append(f"- KW    [{r['keyword']['score']['hit_count']}/{r['keyword']['score']['hit_total']}]  picks=`{','.join(r['keyword'].get('picked_ids', []))}`\n  -> {r['keyword'].get('content','ERR')[:300]}\n")
            sm.append(f"- EMB   [{r['embedding']['score']['hit_count']}/{r['embedding']['score']['hit_total']}]  picks=`{','.join(r['embedding'].get('picked_ids', []))}`\n  -> {r['embedding'].get('content','ERR')[:300]}\n\n")

    (OUT_DIR / "summary.md").write_text("".join(sm), encoding="utf-8")
    (OUT_DIR / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 60)
    print(f"DONE. Output: {OUT_DIR}/summary.md")
    if summary["baseline"] and summary["keyword"] and summary["embedding"]:
        b, k, e = summary["baseline"], summary["keyword"], summary["embedding"]
        print()
        print(f"  Pool size:                    {len(ALL_FACTS)} facts")
        print(f"  Baseline (no pinning) recall: {b['recall_pct']}%")
        print(f"  Keyword pinning recall:       {k['recall_pct']}%")
        print(f"  Embedding pinning recall:     {e['recall_pct']}%")


if __name__ == "__main__":
    run()
