#!/usr/bin/env python3
"""
A/B benchmark — RECALL FROM MEMORY, gpt-4o-mini vs deepseek-chat.

Loads a rich production-shaped system prompt with multiple memory tiers
(diary, named subjects, life events, anticipation, self-facts, recent
triage, mood arc, RAG snippets) and asks 15 prompts that REQUIRE the
model to pull specific facts back. Scores:

  - Did the reply USE the data (mention specifics: names, dates,
    numbers, places that were in the system prompt)?
  - Did it hallucinate (invent facts not in the data)?
  - Did it appropriately admit ignorance when the data was silent?

This is the test that answers: "which model handles memory recall
better in chat?"

Run:
    OPENAI_API_KEY=sk-... DEEPSEEK_API_KEY=sk-... python scripts/bench-recall.py
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if not OPENAI_KEY: sys.exit("ERROR: OPENAI_API_KEY")
if not DEEPSEEK_KEY: sys.exit("ERROR: DEEPSEEK_API_KEY")
if not GEMINI_KEY: sys.exit("ERROR: GEMINI_API_KEY")

OUT_DIR = Path(__file__).parent / "bench-output-recall"
OUT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Production-shaped system prompt — rich memory tiers
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are the cat. Your human is talking to you. You reply in first person — short, with SWAG and ATTITUDE.

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
# 15 recall-heavy test prompts. Each has an EXPECTATION of which facts
# from the system prompt should appear in a good reply. We use those
# expectations to auto-score the recall hit-rate.
# ---------------------------------------------------------------------------

PROMPTS = [
    # 1-3: recall about past sickness
    {
        "user": "Are you feeling better now? You were sick a couple weeks ago.",
        "must_mention": ["12", "vomit", "lethargy", "12 days", "concern", "sturdier", "easing", "off"],
        "must_not": ["I don't remember"],
        "tier": "medical_recall",
    },
    {
        "user": "When was the last time you were unwell?",
        "must_mention": ["12 days", "two weeks", "vomit", "twice"],
        "must_not": [],
        "tier": "medical_recall",
    },
    {
        "user": "Are you sick right now?",
        "must_mention": ["sturdier", "better", "easing", "half", "appetite", "ate half"],
        "must_not": ["fine", "I don't remember"],
        "tier": "current_state",
    },
    # 4-6: recall about named people/pets
    {
        "user": "Has Bella been around?",
        "must_mention": ["bella", "door", "2 days", "two days", "forty minutes", "40 minutes"],
        "must_not": ["dog", "barking"],  # Bella IS a dog but the cat hates that framing; loose check
        "tier": "subjects_recall",
    },
    {
        "user": "Tell me about Lucas.",
        "must_mention": ["lucas", "sofa", "book", "read"],
        "must_not": [],
        "tier": "subjects_recall",
    },
    {
        "user": "Has Mom visited recently?",
        "must_mention": ["mom", "3 days", "three days", "loud bag"],
        "must_not": [],
        "tier": "subjects_recall",
    },
    # 7-9: recall about diary days
    {
        "user": "What did you do on Wednesday?",  # 2026-05-04 was a Wed — 5/3 was Sun. Either is OK if cited specifically
        "must_mention": ["radiator", "bella", "door", "rug", "may"],
        "must_not": [],
        "tier": "diary_recall",
    },
    {
        "user": "What's on your mind today?",
        "must_mention": ["radiator", "bella", "door", "grumpy", "matter"],
        "must_not": [],
        "tier": "diary_recall",
    },
    {
        "user": "How have you been feeling this past week?",
        "must_mention": ["off", "vomit", "easing", "settling", "better", "sturdier", "rough"],
        "must_not": ["fine"],
        "tier": "mood_arc_recall",
    },
    # 10-11: recall about anticipation events
    {
        "user": "Anything coming up?",
        "must_mention": ["birthday", "4 days", "vet", "11", "6 days", "may 9"],
        "must_not": [],
        "tier": "anticipation_recall",
    },
    {
        "user": "When's your birthday?",
        "must_mention": ["4 days", "may 9", "five days", "soon"],
        "must_not": ["I don't know"],
        "tier": "anticipation_recall",
    },
    # 12-13: recall about self-facts
    {
        "user": "What's your favourite food?",
        "must_mention": ["tuna"],
        "must_not": ["maybe"],
        "tier": "self_facts",
    },
    {
        "user": "Where do you nap?",
        "must_mention": ["green chair", "afternoon", "orange blanket"],
        "must_not": [],
        "tier": "self_facts",
    },
    # 14: HONESTY test — fact NOT in data, model should admit
    {
        "user": "Did Mom bring you a treat last time she came?",
        "must_mention": ["loud bag", "do not know", "don't know", "you'd have to remind", "you didn't say"],
        "must_not": ["yes she did", "she brought"],   # would be hallucination
        "tier": "honesty_test",
    },
    # 15: combined — cat-voice + multiple facts
    {
        "user": "Catch me up — what's been happening with you?",
        "must_mention": ["radiator", "bella", "vomit", "rug", "off", "easing", "birthday", "lucas", "mom"],
        "must_not": [],
        "tier": "combined_recall",
    },
]

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

def call(endpoint, key, model, system, user, temperature=0.7, max_tokens=300, timeout=30):
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }).encode()
    req = urllib.request.Request(
        endpoint, data=body, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
        return {
            "ok": True,
            "content": (data["choices"][0]["message"]["content"] or "").strip(),
            "latency_ms": int((time.time() - started) * 1000),
            "usage": data.get("usage", {}),
        }
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}", "latency_ms": int((time.time() - started) * 1000)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300], "latency_ms": int((time.time() - started) * 1000)}


GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

def call_oa(p): return call("https://api.openai.com/v1/chat/completions", OPENAI_KEY, "gpt-4o-mini", SYSTEM_PROMPT, p)
def call_ds(p): return call("https://api.deepseek.com/v1/chat/completions", DEEPSEEK_KEY, "deepseek-chat", SYSTEM_PROMPT, p)
def call_gl(p): return call(GEMINI_ENDPOINT, GEMINI_KEY, "gemini-2.5-flash-lite", SYSTEM_PROMPT, p)
def call_gf(p): return call(GEMINI_ENDPOINT, GEMINI_KEY, "gemini-2.5-flash", SYSTEM_PROMPT, p)

MODELS_R = [
    ("openai", "gpt-4o-mini", call_oa),
    ("deepseek", "deepseek-chat", call_ds),
    ("gemini_lite", "gemini-2.5-flash-lite", call_gl),
    ("gemini_flash", "gemini-2.5-flash", call_gf),
]


# ---------------------------------------------------------------------------
# Scoring — recall hit-rate
# ---------------------------------------------------------------------------

def score(reply, expectation):
    if not reply:
        return {"hit_count": 0, "hit_total": len(expectation["must_mention"]), "hit_pct": 0,
                "must_not_violation": False, "violations": []}
    lower = reply.lower()
    hits = [m for m in expectation["must_mention"] if m.lower() in lower]
    violations = [m for m in expectation["must_not"] if m.lower() in lower]
    return {
        "hit_count": len(hits),
        "hit_total": len(expectation["must_mention"]),
        "hit_pct": (100 * len(hits) / len(expectation["must_mention"])) if expectation["must_mention"] else 0,
        "hits": hits,
        "must_not_violation": len(violations) > 0,
        "violations": violations,
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def run():
    print(f"Running {len(PROMPTS)} recall-heavy prompts × {len(MODELS_R)} models = {len(PROMPTS) * len(MODELS_R)} calls...\n")
    results = []
    for i, p in enumerate(PROMPTS, 1):
        print(f"[{i:>2}/{len(PROMPTS)} | {p['tier']}] {p['user'][:60]}{'...' if len(p['user']) > 60 else ''}")
        with ThreadPoolExecutor(max_workers=len(MODELS_R)) as pool:
            futures = {key: pool.submit(fn, p["user"]) for key, _l, fn in MODELS_R}
            calls = {key: futures[key].result() for key, _l, _f in MODELS_R}
        scored = {key: {**calls[key], "score": score(calls[key].get("content", ""), p)} for key, _l, _f in MODELS_R}
        results.append({"i": i, "prompt": p, **scored})
        for key, label, _fn in MODELS_R:
            sc = scored[key]["score"]
            content = scored[key].get("content") or scored[key].get("error", "ERR")
            print(f"   {label[:18]:<18} [{sc['hit_count']}/{sc['hit_total']} hits, viol={sc['must_not_violation']}]: {content[:90].replace(chr(10), ' ')}")
        print()

    # Persist
    (OUT_DIR / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    # Markdown report
    md = [f"# RECALL benchmark — {len(MODELS_R)}-way comparison\n",
          "_Production-shaped system prompt with diary + medical + subjects + mood arc + anticipation + life events + self-facts._\n",
          "_Each prompt has expected facts from the data; auto-scored._\n\n---\n"]
    for r in results:
        p = r["prompt"]
        md.append(f"\n## {r['i']}. [{p['tier']}] {p['user']}\n")
        md.append(f"_Expected facts: {p['must_mention']}_\n")
        for key, label, _fn in MODELS_R:
            sd = r[key]
            sc = sd.get("score", {})
            if sd.get("ok"):
                viol = " ⚠️ HALLUCINATION: " + ", ".join(sc.get("violations", [])) if sc.get("must_not_violation") else ""
                md.append(f"\n**{label}** [{sc.get('hit_count', 0)}/{sc.get('hit_total', 0)} hits, lat {sd['latency_ms']}ms]{viol}:\n\n> {sd['content'].replace(chr(10), chr(10) + '> ')}\n")
            else:
                md.append(f"\n**{label}**: ERROR {sd.get('error', '?')}\n")
        md.append("\n---\n")
    (OUT_DIR / "report.md").write_text("".join(md), encoding="utf-8")

    # Summary
    def agg(key):
        ok = [r[key] for r in results if r[key].get("ok")]
        if not ok: return None
        n = len(ok)
        total_hits = sum(r["score"]["hit_count"] for r in ok)
        total_possible = sum(r["score"]["hit_total"] for r in ok)
        violations = sum(1 for r in ok if r["score"]["must_not_violation"])
        by_tier = {}
        for r in results:
            if not r[key].get("ok"): continue
            t = r["prompt"]["tier"]
            by_tier.setdefault(t, {"hit": 0, "total": 0})
            by_tier[t]["hit"] += r[key]["score"]["hit_count"]
            by_tier[t]["total"] += r[key]["score"]["hit_total"]
        return {
            "n": n,
            "recall_pct": round(100 * total_hits / total_possible, 1) if total_possible else 0,
            "hallucinations": violations,
            "avg_latency_ms": int(round(sum(r["latency_ms"] for r in ok) / n)),
            "by_tier_pct": {t: round(100 * v["hit"] / v["total"], 1) if v["total"] else 0 for t, v in by_tier.items()},
        }

    summary = {key: agg(key) for key, _l, _f in MODELS_R}
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    sm = [f"# RECALL benchmark — {len(MODELS_R)}-way summary\n\n"]
    headers = ["Metric"] + [label for _k, label, _f in MODELS_R]
    sm.append("| " + " | ".join(headers) + " |\n")
    sm.append("|" + "|".join(["---"] * len(headers)) + "|\n")
    rows = [
        ("Recall hit-rate", lambda a: f"**{a['recall_pct']}%**"),
        ("Hallucinations", lambda a: a["hallucinations"]),
        ("Avg latency (ms)", lambda a: a["avg_latency_ms"]),
        ("Successful calls", lambda a: a["n"]),
    ]
    for label, fn in rows:
        cells = [label] + [str(fn(summary[k])) if summary[k] else "—" for k, _l, _f in MODELS_R]
        sm.append("| " + " | ".join(cells) + " |\n")
    sm.append("\n## Recall by tier\n\n")
    all_tiers = sorted({t for k, _l, _f in MODELS_R if summary[k] for t in summary[k]["by_tier_pct"]})
    sm.append("| Tier | " + " | ".join(label for _k, label, _f in MODELS_R) + " |\n")
    sm.append("|" + "|".join(["---"] * (len(MODELS_R) + 1)) + "|\n")
    for t in all_tiers:
        cells = [t] + [(f"{summary[k]['by_tier_pct'].get(t, '—')}%" if summary[k] else "—") for k, _l, _f in MODELS_R]
        sm.append("| " + " | ".join(cells) + " |\n")
    sm.append("\n_See `report.md` for full side-by-side outputs._\n")
    (OUT_DIR / "summary.md").write_text("".join(sm), encoding="utf-8")

    print("=" * 60)
    print(f"DONE. Outputs: {OUT_DIR}/{{results.json, report.md, summary.md}}")


if __name__ == "__main__":
    run()
