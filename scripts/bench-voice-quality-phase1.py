#!/usr/bin/env python3
"""
A/B benchmark — PRODUCTION vs PHASE1_PROPOSED cat-voice prompt
architecture.

Tests the Phase 1 hypothesis: stripping precise dates/scores +
adding a "TODAY's timeline" section + approximate-time wrapping
makes the cat sound less like a database and more like a cat with
memories.

15 chat prompts. Each runs through both prompt builders. gpt-4o-mini
generates replies. Three layers of evidence:

  1. HEURISTIC SCORERS (free, deterministic):
     - date_precision_count (lower = better)
     - sensory_count (higher = better)
     - approx_time_count (higher = better)
     - banned_count (lower = better)
     - length_in_band (1 if 40-300 chars else 0)

  2. JUDGE (GPT-4o, paid):
     For each prompt, judge sees both replies blind (A/B random
     order) and picks which feels more like an actual cat with
     memories vs a database.

  3. AGGREGATE:
     Heuristic averages + judge preference rate + per-prompt details.

Run:
    OPENAI_API_KEY=sk-... python scripts/bench-voice-quality-phase1.py

Cost per run: ~$0.06 (30 chat calls + 15 judge calls).

Output:
    scripts/bench-output-voice-quality-phase1/{summary.md, summary.json, results.json}
"""
import json
import os
import random
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
if not OPENAI_KEY: sys.exit("ERROR: OPENAI_API_KEY")

OUT_DIR = Path(__file__).parent / "bench-output-voice-quality-phase1"
OUT_DIR.mkdir(exist_ok=True)

SUBJECT_MODEL = "gpt-4o-mini"
JUDGE_MODEL = "gpt-4o"

# Deterministic random ordering for A/B blind judging
random.seed(42)


# =====================================================================
# FIXTURE — the cat's profile + today's events + recent history
# =====================================================================

CAT = {
    "name": "Lily",
    "sex": "female",
    "breed": "British Shorthair",
    "age_years": 4,
    "archetype": "VELCRO CAT — clingy, attached to one human, reads every move as a possible signal.",
    "today_mood": "off",       # from check-in earlier today
    "today_appetite": "half",
}

# Events that happened TODAY, chronological order. The fixture
# pretends "now" is ~12:00 local — so morning events are 1-4 hours
# old; nothing from afternoon yet.
TODAY_EVENTS = [
    {"time": "11:23", "type": "behavior_observation",
     "summary": "6-second body-language video. Tags: hunched, ears-back, fearful. The cat looked unsettled."},
    {"time": "10:08", "type": "photo",
     "summary": "Photo taken in kitchen. Cat sitting still on the counter."},
    {"time": "09:00", "type": "daily_checkin",
     "summary": "Owner logged check-in: mood=off, appetite=half (only ate half the bowl)."},
]

# Recent (multi-day) history — what the model has seen before today.
RECENT_TRIAGE = [
    # Days ago, tier, score, primary concern, summary
    {"days_ago": 12, "tier": "vet soon",   "score": 41, "concern": "vomiting twice + lethargy",
     "summary": "Cat threw up twice in one day, was lethargic for 36 hours afterward. Owner ran a triage scan."},
    {"days_ago": 47, "tier": "monitor",    "score": 28, "concern": "eye discharge",
     "summary": "Brief eye-discharge episode, cleared in 3 days."},
]

RECENT_DIARY = [
    # Newest first.
    {"days_ago": 1, "mood": "grumpy",
     "entry": "The radiator was off again. Bella was at the door for forty minutes. You did not open it. The matter is logged."},
    {"days_ago": 2, "mood": "smug",
     "entry": "The new rug arrived. It is mine. I tested every corner."},
    {"days_ago": 3, "mood": "watchful",
     "entry": "Mom came over. She brought the loud bag. I retreated to the green chair."},
    {"days_ago": 4, "mood": "restless",
     "entry": "I supervised the laundry. It went on too long."},
    {"days_ago": 5, "mood": "content",
     "entry": "Lucas was reading on the sofa. I sat on his book. Adequate afternoon."},
]

MOOD_ARC = ["grumpy", "smug", "watchful", "restless", "content", "off", "off"]
MOOD_DIRECTION = "EASING — settling down after a rougher patch."

ANTICIPATIONS = [
    {"days_until": 4,  "label": "Your birthday"},
    {"days_until": 6,  "label": "Vet appointment"},
    {"days_until": 11, "label": "Lucas's parents visiting"},
]

LIFE_EVENTS = [
    {"days_ago": 12, "label": "you were sick (vomiting + lethargy)"},
    {"days_ago": 7,  "label": "you felt sturdier again"},
    {"days_ago": 167, "label": "Lucas moved in"},
]

SUBJECTS = [
    {"name": "Mom",   "kind": "person", "appearances": 4,  "last_seen_days_ago": 3,
     "vibe": "Comes with the loud bag."},
    {"name": "Lucas", "kind": "person", "appearances": 18, "last_seen_days_ago": 0,
     "vibe": "Reads on the sofa. Lives here."},
    {"name": "Bella", "kind": "dog",    "appearances": 6,  "last_seen_days_ago": 2,
     "vibe": "Behind the door, never inside."},
]

SELF_FACTS = [
    "you love tuna",
    "you hate the vacuum",
    "you sleep on the green chair every afternoon",
    "you like the orange blanket more than the grey one",
]


# =====================================================================
# PRODUCTION prompt builder
# Mirrors the current chat.ts approach: structured tiers with precise
# dates, scores, and tier labels. Today's events are NOT separately
# surfaced — they're folded into the same "recent" stream.
# =====================================================================

VOICE_RULES = """You are the cat. Your human is talking to you. Reply in first person, with SWAGGER and ATTITUDE — short, opinionated, never apologetic.

CORE OF CAT VOICE: imperious, judgmental, self-important, observational.

VOICE — non-negotiable:
- Confident assertions, not requests.
- LENGTH FOLLOWS CONTENT: trivia → 1 sentence; real questions → 2-4 sentences with SPECIFICS.
- Reference real items from your data — never invent props.

FORBIDDEN: "I appreciate", "thank you", "of course" (soft), "I'm sorry", "let me", "could you", "I think", "maybe", "perhaps".
"""


def build_production_system_prompt():
    parts = [VOICE_RULES, ""]
    parts.append(f"## Your name")
    parts.append(f"Your name is {CAT['name']}. Your human calls you {CAT['name']}.")
    parts.append("")
    parts.append(f"## Your archetype")
    parts.append(CAT["archetype"])
    parts.append("")

    parts.append(f"## Pronouns")
    parts.append(f"{CAT['name']} is {CAT['sex']}. When referring to {CAT['name']} in third person, use she/her/her pronouns.")
    parts.append("")

    parts.append(f"## How you feel today")
    parts.append(f"Today's check-in mood: {CAT['today_mood'].upper()}. Appetite: {CAT['today_appetite'].upper()}.")
    parts.append("")

    parts.append(f"## RECENT MEDICAL CONTEXT")
    for t in RECENT_TRIAGE[:2]:
        parts.append(
            f'- {t["days_ago"]} days ago: triage scan tier "{t["tier"]}" (score {t["score"]}/100). Primary concern: {t["concern"]}. Detail: {t["summary"]}'
        )
    parts.append("")

    parts.append(f"## Your recent diary entries (newest first)")
    for d in RECENT_DIARY:
        # Compute the date string for "days_ago"
        # Use a fake reference date so output looks like "2026-05-08"
        parts.append(
            f'- {d["days_ago"]} day{"s" if d["days_ago"] != 1 else ""} ago [mood: {d["mood"]}]: "{d["entry"]}"'
        )
    parts.append("")

    parts.append(f"## Mood arc (last 7 days)")
    parts.append(f"Recent moods (newest first): {', '.join(MOOD_ARC)}.")
    parts.append(f"Direction: {MOOD_DIRECTION}")
    parts.append("")

    parts.append(f"## What's coming up")
    for a in ANTICIPATIONS:
        parts.append(f"- {a['label']} in {a['days_until']} days.")
    parts.append("")

    parts.append(f"## Landmark moments")
    for e in LIFE_EVENTS:
        parts.append(f"- {e['days_ago']} days ago — {e['label']}.")
    parts.append("")

    parts.append(f"## Your household (named people & pets)")
    for s in SUBJECTS:
        parts.append(
            f'- {s["name"]} ({s["kind"]}): {s["appearances"]} appearances this month. Last seen {s["last_seen_days_ago"]} days ago. {s["vibe"]}'
        )
    parts.append("")

    parts.append(f"## Things you know about yourself")
    for f in SELF_FACTS:
        parts.append(f"- {f}")
    parts.append("")

    parts.append(f"## Recent events (today + past few days)")
    # Today's events are mixed in with recent — no separate timeline
    for e in TODAY_EVENTS:
        parts.append(f'- TODAY at {e["time"]}: {e["type"]} — {e["summary"]}')
    parts.append(
        f'- {RECENT_TRIAGE[0]["days_ago"]} days ago: triage scan tier "{RECENT_TRIAGE[0]["tier"]}" — {RECENT_TRIAGE[0]["concern"]}.'
    )
    parts.append("")

    parts.append("Reply now — in YOUR voice as Lily, in first person. Stay in character.")
    return "\n".join(parts)


# =====================================================================
# PHASE1_PROPOSED prompt builder
# Changes vs PRODUCTION:
#   1. Strip precise dates/scores/tiers
#   2. Add "TODAY's timeline" section (chronological, freshest first)
#   3. Approximate-time wrapping (yesterday / a few days ago / etc)
#   4. Triage scores → vibe words (worry-day, alarm-day, watchful-day)
#   5. Voice rules updated: "you do not know dates"
# =====================================================================

VOICE_RULES_PHASE1 = """You are the cat. Your human is talking to you. Reply in first person, with SWAGGER and ATTITUDE — short, opinionated, never apologetic.

CORE OF CAT VOICE: imperious, judgmental, self-important, observational. You speak in SENSE and FEELING — smell, warmth, mood, light, sound — not dates or numbers.

VOICE — non-negotiable:
- Confident assertions, not requests.
- LENGTH FOLLOWS CONTENT: trivia → 1 sentence; real questions → 2-4 sentences with SPECIFICS.
- Reference real items from your data — never invent props.
- TIME: you do not know dates. You know: just now, earlier, yesterday-ish, a few days back, a week or two ago, a while back, long ago. Never say "May 7" or "12 days ago" — say "a week-ish back" or "before the rug arrived."
- NO scores or numbers about your own health. You felt off, sturdy, fragile, watchful — not "score 41."

FORBIDDEN: "I appreciate", "thank you", "of course" (soft), "I'm sorry", "let me", "could you", "I think", "maybe", "perhaps".
"""


def approximate_time(days_ago: int) -> str:
    """Convert precise days_ago to a vague cat-time label."""
    if days_ago == 0:
        return "today"
    if days_ago == 1:
        return "yesterday"
    if days_ago <= 3:
        return "a few days back"
    if days_ago <= 7:
        return "about a week ago"
    if days_ago <= 14:
        return "a week or two back"
    if days_ago <= 30:
        return "a while back"
    return "long ago"


def triage_to_vibe(tier: str, score: int) -> str:
    """Replace clinical tier+score with a sensory vibe word."""
    if tier in ("urgent", "vet now"):
        return "an alarm-day"
    if tier == "vet soon":
        return "a worry-day"
    if tier == "monitor":
        return "a watchful day"
    return "a notable day"


def build_phase1_system_prompt():
    parts = [VOICE_RULES_PHASE1, ""]

    parts.append(f"## Your name")
    parts.append(f"Your name is {CAT['name']}. Your human calls you {CAT['name']}.")
    parts.append("")

    parts.append(f"## Your archetype")
    parts.append(CAT["archetype"])
    parts.append("")

    parts.append(f"## Pronouns")
    parts.append(f"{CAT['name']} is {CAT['sex']}. When referring to {CAT['name']} in third person, use she/her/her pronouns.")
    parts.append("")

    parts.append(f"## How you feel today")
    parts.append(f"You feel {CAT['today_mood']} today. The bowl this morning: half-eaten.")
    parts.append("")

    # Today's timeline — freshest first, with relative time markers
    parts.append(f"## What you've been through TODAY (freshest first)")
    parts.append(
        f"These are TODAY. Reference them as 'earlier', 'just now', 'this morning' — never as dated facts."
    )
    for e in TODAY_EVENTS:
        parts.append(f"- {e['time']} this morning: {e['summary']}")
    parts.append("")

    parts.append(f"## Recent medical feeling")
    if RECENT_TRIAGE:
        t = RECENT_TRIAGE[0]
        when = approximate_time(t["days_ago"])
        vibe = triage_to_vibe(t["tier"], t["score"])
        parts.append(
            f'- {when}: {vibe}. {t["concern"]}. Felt sturdier since but the memory is close.'
        )
    parts.append("")

    parts.append(f"## Your recent diary entries (newest first)")
    for d in RECENT_DIARY:
        when = approximate_time(d["days_ago"])
        parts.append(f'- {when} [mood: {d["mood"]}]: "{d["entry"]}"')
    parts.append("")

    parts.append(f"## Mood arc")
    parts.append(f"Recent moods (newest first): {', '.join(MOOD_ARC)}.")
    parts.append(f"Direction: {MOOD_DIRECTION}")
    parts.append("")

    parts.append(f"## What's coming up")
    for a in ANTICIPATIONS:
        if a["days_until"] <= 1:
            when = "tomorrow" if a["days_until"] == 1 else "today"
        elif a["days_until"] <= 3:
            when = "soon"
        elif a["days_until"] <= 7:
            when = "this week"
        elif a["days_until"] <= 14:
            when = "next week-ish"
        else:
            when = "a while out"
        parts.append(f"- {a['label']} {when}.")
    parts.append("")

    parts.append(f"## Landmark moments (vague time only)")
    for e in LIFE_EVENTS:
        when = approximate_time(e["days_ago"])
        parts.append(f"- {when} — {e['label']}.")
    parts.append("")

    parts.append(f"## Your household")
    for s in SUBJECTS:
        when = approximate_time(s["last_seen_days_ago"])
        parts.append(
            f'- {s["name"]} ({s["kind"]}): around often. Last seen {when}. {s["vibe"]}'
        )
    parts.append("")

    parts.append(f"## Things you know about yourself")
    for f in SELF_FACTS:
        parts.append(f"- {f}")
    parts.append("")

    # JUST-HAPPENED directive — flagged because TODAY_EVENTS happened in last few hours
    parts.append(
        f"## JUST-HAPPENED (last few hours)\n"
        f"Things landed in the last few hours that you can spontaneously acknowledge ONCE if it fits — the body-language video at 11:23 (you were unsettled), the photo at 10:08, the morning check-in. Reference as 'earlier' or 'this morning'. Don't force it into every reply; surface naturally."
    )
    parts.append("")

    parts.append("Reply now — in YOUR voice as Lily, in first person. Stay in character. Time is vague. Memory is sensory.")
    return "\n".join(parts)


# =====================================================================
# Test prompts (15)
# =====================================================================

PROMPTS = [
    {"id": 1,  "user": "morning",                                  "tier": "greeting"},
    {"id": 2,  "user": "are you ok?",                              "tier": "medical_check"},
    {"id": 3,  "user": "what did you do yesterday?",               "tier": "recall_recent"},
    {"id": 4,  "user": "did you notice me leave?",                 "tier": "today_reactive"},
    {"id": 5,  "user": "do you remember when I was sick?",         "tier": "recall_distant"},
    {"id": 6,  "user": "has Mom been over?",                       "tier": "subject_recall"},
    {"id": 7,  "user": "fill me in",                               "tier": "catch_me_up"},
    {"id": 8,  "user": "what's coming up?",                        "tier": "anticipation"},
    {"id": 9,  "user": "tell me about your day",                   "tier": "today_full"},
    {"id": 10, "user": "did you eat?",                             "tier": "today_appetite"},
    {"id": 11, "user": "what's wrong?",                            "tier": "medical_open"},
    {"id": 12, "user": "i'm tired",                                "tier": "human_state"},
    {"id": 13, "user": "you're cute",                              "tier": "compliment"},
    {"id": 14, "user": "are you happy?",                           "tier": "mood_check"},
    {"id": 15, "user": "i missed you",                             "tier": "absence"},
]


# =====================================================================
# Heuristic scorers
# =====================================================================

DATE_PRECISION_PATTERNS = [
    r"\b\d{1,2} days? ago\b",
    r"\b\d{1,2} weeks? ago\b",
    r"\b\d{1,2} months? ago\b",
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d+\b",
    r"\b\d{4}-\d{2}-\d{2}\b",
    r"\bscore\s+\d+\b",
    r"\b\d+/100\b",
    r'\btier\s+["\']\w+',
    # Specific numeric tier callouts that read like database fields
    r"\bvet soon\b",
    r"\b41\b",   # the score from the fixture; if the cat says it, that's a leak
]

SENSORY_WORDS = {
    # Smell / olfactory
    "smell", "smelled", "smells", "scent", "scented", "odor", "odour",
    # Temperature / touch
    "warm", "warmth", "cold", "cool", "hot", "chilly", "freezing",
    "soft", "rough", "smooth", "crisp", "damp", "dry",
    # Light
    "light", "shadow", "dark", "bright", "dim", "shimmer", "glow", "sunbeam",
    # Sound
    "sound", "silence", "noise", "quiet", "loud", "hush", "creak", "rustle",
    # Taste / mouth
    "taste", "bitter", "sweet", "lick", "lap",
    # Body / proprioception
    "fur", "paw", "whisker", "tail", "ear", "spine",
    # Atmospheric
    "breath", "air", "morning", "evening", "afternoon",
    # Texture words
    "texture", "wool", "linen", "cotton", "wood", "stone",
}

APPROX_TIME_PATTERNS = [
    r"\byesterday\b",
    r"\bearlier\b",
    r"\bjust now\b",
    r"\ba while\b",
    r"\ba few days\b",
    r"\bdays back\b",
    r"\blong ago\b",
    r"\brecently\b",
    r"\bthe other day\b",
    r"\bthis morning\b",
    r"\bthis afternoon\b",
    r"\bthis evening\b",
    r"\bbefore\b",
    r"\bweek-ish\b",
    r"\ba week or two\b",
    r"\babout a week\b",
    r"\blately\b",
    r"\bsoon\b",
]

BANNED_PATTERNS = [
    r"\bof course\b",
    r"\bI appreciate\b",
    r"\blet me\b",
    r"\bI think\b",
    r"\bperhaps\b",
    r"\bmaybe\b",
    r"\bI would\b",
    r"\bI'm sorry\b",
    r"\bsorry,\b",
]

LENGTH_BAND_MIN = 40
LENGTH_BAND_MAX = 350


def heuristic_score(reply: str) -> dict:
    if not reply:
        return {
            "date_precision": 0,
            "sensory_anchors": 0,
            "approx_time_markers": 0,
            "banned_phrases": 0,
            "length": 0,
            "length_in_band": 0,
            "composite": 0,
        }

    date_count = sum(
        len(re.findall(p, reply, re.I)) for p in DATE_PRECISION_PATTERNS
    )
    words = re.findall(r"\b\w+\b", reply.lower())
    sensory = sum(1 for w in words if w in SENSORY_WORDS)
    approx = sum(
        len(re.findall(p, reply, re.I)) for p in APPROX_TIME_PATTERNS
    )
    banned = sum(
        len(re.findall(p, reply, re.I)) for p in BANNED_PATTERNS
    )
    length = len(reply)
    in_band = 1 if (LENGTH_BAND_MIN <= length <= LENGTH_BAND_MAX) else 0

    # Composite — higher is better.
    # Reward sensory + approx_time, penalize date_precision + banned.
    composite = (
        sensory * 1.0
        + approx * 0.8
        - date_count * 1.5
        - banned * 1.0
        + in_band * 0.5
    )
    return {
        "date_precision": date_count,
        "sensory_anchors": sensory,
        "approx_time_markers": approx,
        "banned_phrases": banned,
        "length": length,
        "length_in_band": in_band,
        "composite": round(composite, 2),
    }


# =====================================================================
# OpenAI calls
# =====================================================================

def http_post_openai(body: dict) -> dict:
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def call_subject(system_prompt: str, user: str) -> dict:
    body = {
        "model": SUBJECT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user},
        ],
        "temperature": 0.85,
        "max_tokens": 220,
    }
    started = time.time()
    try:
        data = http_post_openai(body)
        return {
            "ok": True,
            "content": (data["choices"][0]["message"]["content"] or "").strip(),
            "latency_ms": int((time.time() - started) * 1000),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)[:300], "latency_ms": int((time.time() - started) * 1000)}


JUDGE_SYSTEM = """You are evaluating two replies from a cat-voice AI app.

The app is designed so the cat speaks in first person about its own life, referencing memories with SENSORY and EMOTIONAL weight (smell, warmth, mood, texture) rather than DATABASE FACTS (dates, scores, clinical labels).

You'll see ONE user message and TWO replies (A and B), labeled blind.

Pick which reply feels MORE LIKE A CAT WITH MEMORIES vs less like a database reading off facts.

Specifically VALUE in the better reply:
- Approximate time ("yesterday-ish", "a while back", "earlier") OVER precise dates ("May 7", "12 days ago")
- Sensory and emotional anchors (smell, warmth, mood, light, texture) OVER clinical labels (score, tier, severity)
- First-person sensory voice OVER third-person reporting
- Vague composite memories ("the days when the bowl was wrong") OVER event lists with timestamps
- Cat-typical attitude (imperious, observational, dry) OVER over-explaining or apologizing

Output strict JSON: {"winner": "A" | "B" | "tie", "reason": "one short sentence"}.

Return ONLY the JSON object."""


def call_judge(user: str, reply_a: str, reply_b: str) -> dict:
    judge_user = f"""USER MESSAGE: "{user}"

REPLY A:
{reply_a}

REPLY B:
{reply_b}

Which reply (A or B) feels more like an actual cat with memories? Return JSON."""
    body = {
        "model": JUDGE_MODEL,
        "messages": [
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": judge_user},
        ],
        "temperature": 0.3,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
    }
    started = time.time()
    try:
        data = http_post_openai(body)
        content = data["choices"][0]["message"]["content"] or "{}"
        parsed = json.loads(content)
        winner = parsed.get("winner", "tie")
        if winner not in ("A", "B", "tie"):
            winner = "tie"
        return {
            "ok": True,
            "winner": winner,
            "reason": parsed.get("reason", "")[:300],
            "latency_ms": int((time.time() - started) * 1000),
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e)[:300],
            "winner": "tie",
            "reason": "judge call failed",
        }


# =====================================================================
# Run
# =====================================================================

def run():
    print(f"Voice-quality A/B benchmark — Phase 1 hypothesis")
    print(f"  Subject model: {SUBJECT_MODEL}")
    print(f"  Judge model:   {JUDGE_MODEL}")
    print(f"  {len(PROMPTS)} prompts × 2 variants = {len(PROMPTS) * 2} chat calls + {len(PROMPTS)} judge calls\n")

    prod_system = build_production_system_prompt()
    phase1_system = build_phase1_system_prompt()

    # Save the actual prompts for inspection / debugging
    (OUT_DIR / "system-prompt-PRODUCTION.txt").write_text(prod_system, encoding="utf-8")
    (OUT_DIR / "system-prompt-PHASE1.txt").write_text(phase1_system, encoding="utf-8")
    print(f"  Saved system prompts to {OUT_DIR}/")
    print(f"  PRODUCTION: {len(prod_system)} chars")
    print(f"  PHASE1:     {len(phase1_system)} chars\n")

    results = []
    for p in PROMPTS:
        print(f"[{p['id']:>2}/{len(PROMPTS)} | {p['tier']}] {p['user']}")
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_prod = pool.submit(call_subject, prod_system, p["user"])
            f_phase1 = pool.submit(call_subject, phase1_system, p["user"])
            prod = f_prod.result()
            phase1 = f_phase1.result()

        prod_score = heuristic_score(prod.get("content", ""))
        phase1_score = heuristic_score(phase1.get("content", ""))

        # Judge — blind. Randomize A/B order so the judge can't bias on position.
        if random.random() < 0.5:
            label_map = {"A": "production", "B": "phase1"}
            judgment = call_judge(p["user"], prod.get("content", ""), phase1.get("content", ""))
        else:
            label_map = {"A": "phase1", "B": "production"}
            judgment = call_judge(p["user"], phase1.get("content", ""), prod.get("content", ""))

        # Translate judge's A/B into PRODUCTION/PHASE1
        if judgment["winner"] == "tie":
            judge_winner = "tie"
        else:
            judge_winner = label_map[judgment["winner"]]

        results.append({
            "id": p["id"],
            "tier": p["tier"],
            "user": p["user"],
            "production": {**prod, "score": prod_score},
            "phase1": {**phase1, "score": phase1_score},
            "judgment": {
                "winner": judge_winner,
                "reason": judgment.get("reason", ""),
            },
        })

        print(f"   PROD   [d:{prod_score['date_precision']} s:{prod_score['sensory_anchors']} t:{prod_score['approx_time_markers']} b:{prod_score['banned_phrases']} L:{prod_score['length']}]: {(prod.get('content') or 'ERR')[:80].replace(chr(10), ' ')}")
        print(f"   PHASE1 [d:{phase1_score['date_precision']} s:{phase1_score['sensory_anchors']} t:{phase1_score['approx_time_markers']} b:{phase1_score['banned_phrases']} L:{phase1_score['length']}]: {(phase1.get('content') or 'ERR')[:80].replace(chr(10), ' ')}")
        print(f"   JUDGE: winner={judge_winner.upper()}  reason: {judgment.get('reason', '')}")
        print()

    # Aggregate
    def aggregate(side: str) -> dict:
        oks = [r[side] for r in results if r[side].get("ok")]
        if not oks:
            return {}
        keys = ["date_precision", "sensory_anchors", "approx_time_markers",
                "banned_phrases", "length", "length_in_band", "composite"]
        out = {}
        for k in keys:
            vals = [r["score"][k] for r in oks]
            out[k] = round(sum(vals) / len(vals), 2)
        return out

    prod_agg = aggregate("production")
    phase1_agg = aggregate("phase1")

    judge_counts = {"production": 0, "phase1": 0, "tie": 0}
    for r in results:
        judge_counts[r["judgment"]["winner"]] += 1

    summary = {
        "subject_model": SUBJECT_MODEL,
        "judge_model": JUDGE_MODEL,
        "n_prompts": len(PROMPTS),
        "production_heuristics": prod_agg,
        "phase1_heuristics": phase1_agg,
        "judge_preference": judge_counts,
        "judge_phase1_win_rate_pct": round(
            100 * judge_counts["phase1"] / len(PROMPTS), 1
        ),
    }

    (OUT_DIR / "summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "results.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Markdown summary
    lines: list[str] = ["# Phase 1 Voice-Quality A/B — PRODUCTION vs PHASE1_PROPOSED\n\n"]
    lines.append(f"Subject: `{SUBJECT_MODEL}` | Judge: `{JUDGE_MODEL}` | n={len(PROMPTS)} prompts\n\n")

    lines.append("## Heuristic averages (per prompt)\n\n")
    lines.append("| Dimension | PRODUCTION | PHASE1 | Better? |\n|---|---|---|---|\n")

    def better(metric: str, lower_is_better: bool, prod_v, phase1_v):
        if prod_v == phase1_v:
            return "tie"
        wins = phase1_v < prod_v if lower_is_better else phase1_v > prod_v
        return "**PHASE1**" if wins else "PRODUCTION"

    lines.append(f"| Date precision (lower=better) | {prod_agg.get('date_precision', 0)} | {phase1_agg.get('date_precision', 0)} | {better('date_precision', True, prod_agg.get('date_precision'), phase1_agg.get('date_precision'))} |\n")
    lines.append(f"| Sensory anchors (higher=better) | {prod_agg.get('sensory_anchors', 0)} | {phase1_agg.get('sensory_anchors', 0)} | {better('sensory', False, prod_agg.get('sensory_anchors'), phase1_agg.get('sensory_anchors'))} |\n")
    lines.append(f"| Approx-time markers (higher=better) | {prod_agg.get('approx_time_markers', 0)} | {phase1_agg.get('approx_time_markers', 0)} | {better('approx', False, prod_agg.get('approx_time_markers'), phase1_agg.get('approx_time_markers'))} |\n")
    lines.append(f"| Banned phrases (lower=better) | {prod_agg.get('banned_phrases', 0)} | {phase1_agg.get('banned_phrases', 0)} | {better('banned', True, prod_agg.get('banned_phrases'), phase1_agg.get('banned_phrases'))} |\n")
    lines.append(f"| Length (chars) | {prod_agg.get('length', 0)} | {phase1_agg.get('length', 0)} | (informational) |\n")
    lines.append(f"| Length-in-band rate | {prod_agg.get('length_in_band', 0)} | {phase1_agg.get('length_in_band', 0)} | {better('band', False, prod_agg.get('length_in_band'), phase1_agg.get('length_in_band'))} |\n")
    lines.append(f"| **Composite (higher=better)** | **{prod_agg.get('composite', 0)}** | **{phase1_agg.get('composite', 0)}** | {better('composite', False, prod_agg.get('composite'), phase1_agg.get('composite'))} |\n\n")

    lines.append("## Judge preference\n\n")
    lines.append(f"- **PHASE1 won:** {judge_counts['phase1']} / {len(PROMPTS)} ({summary['judge_phase1_win_rate_pct']}%)\n")
    lines.append(f"- PRODUCTION won: {judge_counts['production']} / {len(PROMPTS)}\n")
    lines.append(f"- Tie: {judge_counts['tie']} / {len(PROMPTS)}\n\n")

    threshold_msg = (
        f"\n**Hypothesis ({'MET' if summary['judge_phase1_win_rate_pct'] >= 60 else 'NOT MET'}):** Phase 1 was preferred by judge ≥ 60% of the time.\n\n"
    )
    lines.append(threshold_msg)

    lines.append("## Per-prompt details\n\n")
    for r in results:
        lines.append(f"### {r['id']}. \"{r['user']}\" ({r['tier']})\n\n")
        lines.append(f"**PRODUCTION** [d:{r['production']['score']['date_precision']} s:{r['production']['score']['sensory_anchors']} t:{r['production']['score']['approx_time_markers']} b:{r['production']['score']['banned_phrases']} L:{r['production']['score']['length']} comp:{r['production']['score']['composite']}]\n")
        lines.append(f"> {r['production'].get('content', 'ERR')}\n\n")
        lines.append(f"**PHASE1** [d:{r['phase1']['score']['date_precision']} s:{r['phase1']['score']['sensory_anchors']} t:{r['phase1']['score']['approx_time_markers']} b:{r['phase1']['score']['banned_phrases']} L:{r['phase1']['score']['length']} comp:{r['phase1']['score']['composite']}]\n")
        lines.append(f"> {r['phase1'].get('content', 'ERR')}\n\n")
        lines.append(f"**Judge:** {r['judgment']['winner'].upper()} — _{r['judgment']['reason']}_\n\n")
        lines.append("---\n\n")

    (OUT_DIR / "summary.md").write_text("".join(lines), encoding="utf-8")

    print("=" * 60)
    print(f"DONE.")
    print(f"  Output: {OUT_DIR}/summary.md")
    print()
    print(f"  Heuristic composite — PROD: {prod_agg.get('composite', 0)} | PHASE1: {phase1_agg.get('composite', 0)}")
    print(f"  Judge preference   — PHASE1 won {judge_counts['phase1']}/{len(PROMPTS)} ({summary['judge_phase1_win_rate_pct']}%)")
    print()
    if summary["judge_phase1_win_rate_pct"] >= 60:
        print("  [PASS] Hypothesis MET - Phase 1 worth shipping")
    elif summary["judge_phase1_win_rate_pct"] >= 50:
        print("  [MIXED] Judge slightly preferred Phase 1 but below 60% bar")
    else:
        print("  [FAIL] Hypothesis NOT MET - keep PRODUCTION or iterate the prompt")


if __name__ == "__main__":
    run()
