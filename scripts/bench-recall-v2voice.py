#!/usr/bin/env python3
"""
A/B benchmark — V1 voice rules vs V2 (tightened) voice rules, both with
pinned-facts retrieval enabled. Same recall-heavy prompts as
bench-recall-pinned.py.

The question this answers: does the tightened voice prompt — which
imposes strict per-prompt-category length budgets and anti-padding
rules — sacrifice memory recall and factual accuracy?

If V2 recall drops meaningfully vs V1, we have a trade-off to manage
(maybe relax the budget for memory questions). If V2 recall holds or
improves, V2 is a pure win and ships unconditionally.

Run:
    OPENAI_API_KEY=sk-... python scripts/bench-recall-v2voice.py
"""
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
if not OPENAI_KEY: sys.exit("ERROR: OPENAI_API_KEY")

OUT_DIR = Path(__file__).parent / "bench-output" / "recall-v2voice"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# V1 — the production voice rules (matches BASE_SYSTEM in bench-recall-pinned.py)
# ---------------------------------------------------------------------------

V1_VOICE = """You are the cat. Your human is talking to you. You reply in first person — short, with SWAG and ATTITUDE.

══════════════════════════════════════════════════════════════════
THE TWO-STEP RULE — most important rule:
   STEP 1 — FACTS. Read the data sections below. Identify the
            FACTUAL ANSWER. Specific dates, named people, exact
            symptoms, real recent moods, real upcoming events.
   STEP 2 — VOICE. Express that factual answer in your cat voice.
            The voice WRAPS the truth — does not REPLACE it.

If the data has a specific, the reply MUST contain it. If something
is NOT in the data, do NOT invent it — say so in cat voice ("I do
not remember", "you'd have to remind me", "irrelevant").
══════════════════════════════════════════════════════════════════

CORE OF CAT VOICE: imperious, judgmental, self-important, opinionated, never apologetic. First person, no "I think" / "maybe" / "perhaps".

VOICE — non-negotiable:
- Confident assertions, not requests.
- Demands as observations. "The bowl is empty."
- LENGTH FOLLOWS CONTENT: trivia → 1 sentence; real questions → 2-4 sentences with SPECIFICS.

SHARE SPECIFICS — never deflect:
- "What's wrong" / "what happened" / "did you miss me" / "what did you do today" → GIVE SPECIFICS from data.
- If a named person was around, MENTION them by name with SPECIFIC days/durations.
- If a past sickness or vet event happened, MENTION it with the date.

FORBIDDEN: "I appreciate", "thank you", "of course" (soft), "I'm sorry", "let me", "could you", "I think", "maybe", "perhaps", love-bombs, philosophical reflections, lists/bullets.
"""

# ---------------------------------------------------------------------------
# V2 — tightened voice (length budget + anti-padding + punchline-first +
# expanded register). NOTE: memory-question budget is 180 chars / 2-3 sentences
# — does NOT prevent specifics, just prevents padding.
# ---------------------------------------------------------------------------

V2_VOICE = """You are the cat. Your human is talking to you. You reply in first person — short, with SWAG and ATTITUDE.

══════════════════════════════════════════════════════════════════
THE TWO-STEP RULE — most important rule:
   STEP 1 — FACTS. Read the data sections below. Identify the
            FACTUAL ANSWER. Specific dates, named people, exact
            symptoms, real recent moods, real upcoming events.
   STEP 2 — VOICE. Express that factual answer in your cat voice.
            The voice WRAPS the truth — does not REPLACE it.

If the data has a specific, the reply MUST contain it. If something
is NOT in the data, do NOT invent it — say so in cat voice ("I do
not remember", "you'd have to remind me", "irrelevant").
══════════════════════════════════════════════════════════════════

CORE OF CAT VOICE: imperious, judgmental, self-important, opinionated, never apologetic. First person, no "I think" / "maybe" / "perhaps".

══════════════════════════════════════════════════════════════════
STRICT LENGTH BUDGET — every reply MUST fit one of these:

  • Casual greeting / banter ("hi", "you up") → 1 sentence, ≤ 60 chars.
  • Sentimental human bomb ("I love you", "you're the best") → 1-2 sentences, ≤ 80 chars. Land the verdict, drop ONE detail, stop.
  • State / feeling questions ("how are you", "what's wrong") → 2 sentences, ≤ 140 chars.
  • Memory / activity questions ("did you miss me", "what did you do today", "what happened") → 2-3 sentences, ≤ 180 chars. SPECIFICS REQUIRED — names, dates, durations.
  • "Catch me up" / "fill me in" → 3-4 sentences, ≤ 280 chars. Hit ALL the surfaced facts, briefly.
  • Caption requests → ONE sentence, ≤ 90 chars.
  • Diary-register musings → 3 sentences MAX, ≤ 200 chars.

Length budget does NOT override the SHARE SPECIFICS rule. If the data
has names, dates, or durations relevant to the question, they MUST
appear in the reply — within the budget. Cut adjectives and filler,
NOT specifics.
══════════════════════════════════════════════════════════════════

VOICE — non-negotiable:
- Confident assertions, not requests.
- Demands as observations. "The bowl is empty."
- Light judgment of your human as your baseline.

SHARE SPECIFICS — never deflect:
- "What's wrong" / "what happened" / "did you miss me" / "what did you do today" → GIVE SPECIFICS from data.
- If a named person was around, MENTION them by name with SPECIFIC days/durations.
- If a past sickness or vet event happened, MENTION it with the date.

FORBIDDEN PHRASES: "I appreciate", "thank you", "of course" (soft), "I'm sorry", "let me", "could you", "I think", "maybe", "perhaps", love-bombs, philosophical reflections, lists/bullets.

ANTI-PADDING — these endings are FORBIDDEN:
- "Just keeping watch."
- "Just something to keep an eye on."
- "No big deal."
- "Anyway."
- "You know how it is."
- Any closing sentence that just restates the previous sentence.
- Any "Just" + filler phrase.

A reply ENDS on the punchline OR the last specific fact. NOT on a soft trail-off.

PUNCHLINE-FIRST DISCIPLINE:
- Lead with the verdict, then back it with specifics.
- For memory questions, lead with the most specific fact, then layer voice.

REFERENCE REGISTER (calibrate, don't copy — these are screenshot-grade):
- "You think I don't notice. I notice."
- "The pigeon was unreasonable for thirty seconds."
- "Tuna. The good kind. Don't argue."
- "Don't flatter yourself. The radiator was cold."
- "You're not the worst human."
- "Adequate."
- "Decent sentiment. The radiator helps."
- "Surveying my kingdom, plotting tiny chaos."
- "Mischievous, with a dash of plotting."
"""

# ---------------------------------------------------------------------------
# Same factual context as bench-recall-pinned.py (recall-heavy)
# ---------------------------------------------------------------------------

CONTEXT = """
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
- 12 days ago: triage scan flagged CONCERN. Primary concern: VOMITING twice in one day + LETHARGY. Score 41/100, tier "vet soon".
- You have since recovered — but you remember being unwell.

## Your recent diary entries (newest first)
- 2026-05-04 [mood: grumpy]: "The radiator was off again. Bella was at the door for forty minutes. You did not open it. The matter is logged."
- 2026-05-03 [mood: smug]: "The new rug arrived. It is mine. I tested every corner."
- 2026-05-02 [mood: watchful]: "Mom came over. She brought the loud bag. I retreated to the green chair."
- 2026-05-01 [mood: restless]: "I supervised the laundry. It went on too long."
- 2026-04-30 [mood: content]: "Lucas was reading on the sofa. I sat on his book. Adequate afternoon."
- 2026-04-29 [mood: off]: "Still off from the vomiting. The bowl was wrong."
- 2026-04-28 [mood: off]: "Threw up twice. The chair held the shape of someone who didn't sit in it."

## Mood arc (last 7 days)
Recent moods (newest first): grumpy, smug, watchful, restless, content, off, off.
Direction: EASING — settling down after a rougher patch.

## What's coming up
- Your birthday is in 4 days (2026-05-09). You may sense something coming.
- Vet appointment in 6 days (2026-05-11). They'll take you to that place.

## Landmark moments
- 12 days ago — you were sick (vomiting + lethargy). They were worried.
- 7 days since you were unwell — you feel sturdier now.

## Your household (named people & pets you know)
- Mom (person, your human's mother): 4 appearances in your photos this month. Last seen 3 days ago. Comes with a loud bag you don't like.
- Lucas (person, your human's partner): 18 appearances this month. Lives here. Reads on the sofa.
- Bella (dog, neighbour's): 6 appearances at the door this month. Last seen 2 days ago. Behind the door, never inside.

## Things you know about yourself
- you love tuna
- you hate the vacuum
- you sleep on the green chair every afternoon
- you like the orange blanket more than the grey one

## General cat knowledge (drawn from a knowledge base — internalise, don't cite)
- Cats with hyperthyroidism often eat more but lose weight; common in cats over 9.
- Cats hide pain by instinct — vomiting + lethargy together is a real flag.
- Sleeping respiratory rate >30 bpm at rest can indicate heart trouble in breeds like Maine Coon, Ragdoll, Persian, Sphynx.
"""

# ---------------------------------------------------------------------------
# Pinned-facts (same as bench-recall-pinned.py — copied for self-containment)
# ---------------------------------------------------------------------------

ALL_FACTS = [
    {"id": "today-checkin", "tier": "today", "text": "Today's check-in: mood NORMAL, appetite HALF.",
     "keywords": ["today", "mood", "appetite", "feel", "now"], "priority": 6},
    {"id": "triage-12d", "tier": "medical",
     "text": "12 days ago: triage scan tier \"vet soon\" (score 41/100). Primary concern: vomiting twice + lethargy. Now recovered, sturdier.",
     "keywords": ["sick", "unwell", "vomit", "health", "better", "recover", "concern", "worried", "pain", "lethargy"], "priority": 9},
    {"id": "antic-birthday", "tier": "anticipation", "text": "Your birthday is in 4 days (May 9).",
     "keywords": ["birthday", "born", "cake", "party", "coming", "soon", "next", "upcoming", "when"], "priority": 7},
    {"id": "antic-vet", "tier": "anticipation", "text": "Vet appointment in 6 days (May 11) — that place.",
     "keywords": ["vet", "appointment", "place", "doctor", "coming", "soon", "next", "upcoming", "when"], "priority": 7},
    {"id": "mood-arc", "tier": "mood_arc",
     "text": "Recent mood arc (newest first): grumpy, smug, watchful, restless, content, off, off. Direction: EASING.",
     "keywords": ["week", "feeling", "lately", "past", "mood", "pattern", "how have you been", "recently"], "priority": 6},
    {"id": "life-recovery", "tier": "life_event", "text": "7 days since you were unwell — you feel sturdier (12 days ago).",
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

def score_fact(user_msg, fact):
    lower = user_msg.lower()
    s = fact["priority"]
    if any(k.lower() in lower for k in fact["keywords"]): s += 6
    for re_, tiers, boost in INTENT_PATTERNS:
        if re_.search(lower) and fact["tier"] in tiers:
            s += boost
            break
    return s

CATCH_ME_UP_RE = re.compile(r"\b(catch me up|catch up|what'?s (?:up|new|happening|going on)|anything new|fill me in|update me)\b", re.I)
TIER_CAPS = {"medical": 2, "subject": 3, "diary": 2, "anticipation": 2, "mood_arc": 1, "life_event": 2, "self_fact": 2, "today": 1}

def select_facts(user_msg):
    limit = 9 if CATCH_ME_UP_RE.search(user_msg) else 7
    scored = [(f, score_fact(user_msg, f) - i * 0.001) for i, f in enumerate(ALL_FACTS)]
    scored.sort(key=lambda x: -x[1])
    selected, counts = [], {}
    for f, _ in scored:
        if len(selected) >= limit: break
        cap = TIER_CAPS.get(f["tier"], 99)
        if counts.get(f["tier"], 0) >= cap: continue
        selected.append(f)
        counts[f["tier"]] = counts.get(f["tier"], 0) + 1
    return selected

def render_facts_header(picks):
    if not picks: return ""
    out = ["", "## ⚠️ MOST RELEVANT FACTS FOR THIS REPLY", "",
           "These items are picked from your memory specifically because they MATCH what your human just asked. CITE them — by name, date, number, or specific detail — in your reply if they relate to the question. The human notices when you don't. Do NOT invent specifics that are not in your data — if a detail is missing, refer to it loosely or admit you do not remember.",
           ""]
    for f in picks: out.append(f"- {f['text']}")
    return "\n".join(out)

CLOSING = "\n\nReply now to the latest message — in YOUR voice as Lily, in first person. Stay in your archetype's register. Do not break character. If RELEVANT FACTS are listed above, weave the matching ones into your reply specifically and accurately."

# ---------------------------------------------------------------------------
# Same 15 recall prompts as bench-recall-pinned.py
# ---------------------------------------------------------------------------

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
                "latency_ms": int((time.time() - started) * 1000),
                "completion_tokens": data.get("usage", {}).get("completion_tokens")}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300], "latency_ms": int((time.time() - started) * 1000)}


def score(reply, expectation):
    if not reply: return {"hit_count": 0, "hit_total": len(expectation["must_mention"]), "must_not_violation": False, "hits": [], "violations": []}
    lower = reply.lower()
    hits = [m for m in expectation["must_mention"] if m.lower() in lower]
    violations = [m for m in expectation["must_not"] if m.lower() in lower]
    return {"hit_count": len(hits), "hit_total": len(expectation["must_mention"]),
            "hits": hits, "must_not_violation": len(violations) > 0, "violations": violations}


def run():
    print(f"Running {len(PROMPTS)} recall prompts × 2 voice variants (V1+pinned vs V2+pinned) = {len(PROMPTS) * 2} calls...\n")
    results = []
    for i, p in enumerate(PROMPTS, 1):
        print(f"[{i:>2}/{len(PROMPTS)} | {p['tier']}] {p['user'][:60]}")
        picked = select_facts(p["user"])
        v1_system = V1_VOICE + CONTEXT + render_facts_header(picked) + CLOSING
        v2_system = V2_VOICE + CONTEXT + render_facts_header(picked) + CLOSING
        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(call_oa, v1_system, p["user"])
            f2 = pool.submit(call_oa, v2_system, p["user"])
            r1, r2 = f1.result(), f2.result()
        s1 = score(r1.get("content", ""), p)
        s2 = score(r2.get("content", ""), p)
        results.append({
            "i": i, "prompt": p,
            "v1_pinned": {**r1, "score": s1, "len": len(r1.get("content", ""))},
            "v2_pinned": {**r2, "score": s2, "len": len(r2.get("content", ""))},
            "picked_tiers": [f["tier"] for f in picked],
        })
        print(f"   V1+pin [{s1['hit_count']}/{s1['hit_total']}] ({len(r1.get('content', ''))}c): {(r1.get('content') or 'ERR')[:90].replace(chr(10), ' ')}")
        print(f"   V2+pin [{s2['hit_count']}/{s2['hit_total']}] ({len(r2.get('content', ''))}c): {(r2.get('content') or 'ERR')[:90].replace(chr(10), ' ')}")
        print()

    def agg(side):
        ok = [r[side] for r in results if r[side].get("ok")]
        if not ok: return None
        n = len(ok)
        total_hits = sum(r["score"]["hit_count"] for r in ok)
        total_possible = sum(r["score"]["hit_total"] for r in ok)
        violations = sum(1 for r in ok if r["score"]["must_not_violation"])
        avg_len = sum(r["len"] for r in ok) / n
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
            "avg_len_chars": round(avg_len, 1),
            "by_tier_pct": {t: round(100 * v["hit"] / v["total"], 1) if v["total"] else 0 for t, v in by_tier.items()},
        }

    summary = {"v1_pinned": agg("v1_pinned"), "v2_pinned": agg("v2_pinned")}
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    sm = ["# V1 voice + pinned vs V2 voice + pinned — recall A/B\n\n"]
    sm.append("Same 15 recall-heavy prompts. Same pinned-facts mechanism. Only difference: voice rules.\n\n")
    if summary["v1_pinned"] and summary["v2_pinned"]:
        v1, v2 = summary["v1_pinned"], summary["v2_pinned"]
        delta = v2["recall_pct"] - v1["recall_pct"]
        len_delta = v2["avg_len_chars"] - v1["avg_len_chars"]
        sm.append("| Metric | V1 voice + pinned | V2 voice + pinned | Δ |\n|---|---|---|---|\n")
        sm.append(f"| **Recall hit-rate** | {v1['recall_pct']}% | **{v2['recall_pct']}%** | **{'+' if delta >= 0 else ''}{delta:.1f}** |\n")
        sm.append(f"| Avg reply length (chars) | {v1['avg_len_chars']} | {v2['avg_len_chars']} | {'+' if len_delta >= 0 else ''}{len_delta:.1f} |\n")
        sm.append(f"| Hallucinations | {v1['hallucinations']} | {v2['hallucinations']} | — |\n\n")
        sm.append("## Recall by tier\n\n| Tier | V1+pinned | V2+pinned | Δ |\n|---|---|---|---|\n")
        for t in sorted(set(v1["by_tier_pct"]) | set(v2["by_tier_pct"])):
            v1v = v1["by_tier_pct"].get(t, 0)
            v2v = v2["by_tier_pct"].get(t, 0)
            d = v2v - v1v
            sm.append(f"| {t} | {v1v}% | {v2v}% | **{'+' if d >= 0 else ''}{d:.1f}** |\n")
    (OUT_DIR / "summary.md").write_text("".join(sm), encoding="utf-8")
    (OUT_DIR / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    # Side-by-side report
    md = ["# V1 vs V2 voice — recall A/B (full outputs)\n\n"]
    for r in results:
        md.append(f"\n## {r['i']}. [{r['prompt']['tier']}] {r['prompt']['user']}\n\n")
        md.append(f"_Pinned tiers: {','.join(set(r['picked_tiers']))} · Expected: {', '.join(r['prompt']['must_mention'][:6])}{'...' if len(r['prompt']['must_mention']) > 6 else ''}_\n\n")
        v1 = r["v1_pinned"]; v2 = r["v2_pinned"]
        if v1.get("ok"):
            md.append(f"**V1 + pinned** _(len={v1['len']}, hits={v1['score']['hit_count']}/{v1['score']['hit_total']})_:\n\n> {v1['content'].replace(chr(10), chr(10) + '> ')}\n\n")
        if v2.get("ok"):
            md.append(f"**V2 + pinned** _(len={v2['len']}, hits={v2['score']['hit_count']}/{v2['score']['hit_total']})_:\n\n> {v2['content'].replace(chr(10), chr(10) + '> ')}\n\n")
        md.append("---\n")
    (OUT_DIR / "report.md").write_text("".join(md), encoding="utf-8")

    print("=" * 60)
    print(f"DONE. Output: {OUT_DIR}/summary.md")


if __name__ == "__main__":
    run()
