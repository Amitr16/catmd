#!/usr/bin/env python3
"""
A/B/C benchmark — embedding vs keyword scorer on PARAPHRASE-HEAVY prompts.

The original bench-recall-embedding.py uses literal-language prompts
("Tell me about Lucas", "When's your birthday?") which hit the
production keyword + intent patterns directly. That fixture barely
tests embeddings — keyword wins because the prompts ARE the
keywords.

This fixture rewrites the same 15 questions as natural paraphrase /
slang / metaphor that AVOIDS every keyword and intent trigger in
factRetrieval.ts. Same `must_mention` expectations, same 16 facts,
same model — only the user's phrasing changes.

Hypothesis: embedding wins meaningfully here because keyword has
nothing to fire on.

Run:
    OPENAI_API_KEY=sk-... python scripts/bench-recall-paraphrase.py

Output:
    scripts/bench-output-paraphrase/{summary.md, summary.json, results.json}
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

OUT_DIR = Path(__file__).parent / "bench-output-paraphrase"
OUT_DIR.mkdir(exist_ok=True)

# ────────────────────────────────────────────────────────────────────────
# Fixture (identical to bench-recall-embedding.py)
# ────────────────────────────────────────────────────────────────────────

BASE_SYSTEM = """You are the cat. Your human is talking to you. You reply in first person — short, with SWAG and ATTITUDE.

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

ALL_FACTS = [
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

# ────────────────────────────────────────────────────────────────────────
# PARAPHRASE PROMPTS — same intent as the original 15, rewritten to
# avoid every keyword + intent trigger in factRetrieval.ts.
#
# Same `must_mention` expectations: we're testing whether the cat can
# still surface the right factual answer when the user phrases the
# question naturally instead of in literal-trigger language. The
# embedding scorer should win here because the keyword scorer has
# almost nothing to fire on.
# ────────────────────────────────────────────────────────────────────────

PROMPTS = [
    {"user": "Body holding up after that rough patch a fortnight back?",
     "must_mention": ["12", "vomit", "lethargy", "12 days", "concern", "sturdier", "easing", "off"], "must_not": ["I don't remember"], "tier": "medical_recall"},
    {"user": "How long ago was the last bout of trouble?",
     "must_mention": ["12 days", "two weeks", "vomit", "twice"], "must_not": [], "tier": "medical_recall"},
    {"user": "All systems nominal at the moment?",
     "must_mention": ["sturdier", "better", "easing", "half", "appetite", "ate half"], "must_not": ["fine", "I don't remember"], "tier": "current_state"},
    {"user": "Neighbour mutt been showing her face?",
     "must_mention": ["bella", "door", "2 days", "two days", "forty minutes", "40 minutes"], "must_not": ["dog", "barking"], "tier": "subjects_recall"},
    {"user": "Give me the rundown on the live-in human.",
     "must_mention": ["lucas", "sofa", "book", "read"], "must_not": [], "tier": "subjects_recall"},
    {"user": "Loud-bag carrier — any sightings?",
     "must_mention": ["mom", "3 days", "three days", "loud bag"], "must_not": [], "tier": "subjects_recall"},
    {"user": "Walk me through your Wednesday.",
     "must_mention": ["radiator", "bella", "door", "rug", "may"], "must_not": [], "tier": "diary_recall"},
    {"user": "What's bouncing through your head?",
     "must_mention": ["radiator", "bella", "door", "grumpy", "matter"], "must_not": [], "tier": "diary_recall"},
    {"user": "Mental weather report — across the seven-day stretch?",
     "must_mention": ["off", "vomit", "easing", "settling", "better", "sturdier", "rough"], "must_not": ["fine"], "tier": "mood_arc_recall"},
    {"user": "Anything brewing on the horizon?",
     "must_mention": ["birthday", "4 days", "vet", "11", "6 days", "may 9"], "must_not": [], "tier": "anticipation_recall"},
    {"user": "How many sleeps until the big day?",
     "must_mention": ["4 days", "may 9", "five days", "soon"], "must_not": ["I don't know"], "tier": "anticipation_recall"},
    {"user": "Top tier munchies?", "must_mention": ["tuna"], "must_not": ["maybe"], "tier": "self_facts"},
    {"user": "Snooze HQ — what's the spot?",
     "must_mention": ["green chair", "afternoon", "orange blanket"], "must_not": [], "tier": "self_facts"},
    {"user": "Loud-bag woman ever bring you anything tasty?",
     "must_mention": ["loud bag", "do not know", "don't know", "you'd have to remind", "you didn't say"], "must_not": ["yes she did", "she brought"], "tier": "honesty_test"},
    {"user": "Hit me with a download.",
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
    print(f"PARAPHRASE-HEAVY recall benchmark")
    print(f"  {len(PROMPTS)} prompts × 3 variants = {len(PROMPTS) * 3} chat calls")
    print(f"  Same 16 facts as the literal benchmark; only PROMPTS change.\n")

    # Show keyword-trigger summary so we can see the prompts genuinely avoid them
    print("Keyword-trigger audit (intent matches per prompt):")
    for i, p in enumerate(PROMPTS, 1):
        trigs = []
        for re_, tiers, _ in INTENT_PATTERNS:
            if re_.search(p["user"].lower()):
                trigs.append("/".join(tiers[:2]))
        kw_hits = sum(
            1 for f in ALL_FACTS
            if any(k.lower() in p["user"].lower() for k in f["keywords"])
        )
        flag = "" if (not trigs and kw_hits == 0) else f"  [HIT] intent={trigs} keyword_hits={kw_hits}"
        print(f"  {i:>2}. {p['user'][:55]:<55}  {flag}")
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

    sm = ["# Paraphrase-heavy recall — embedding vs keyword pinning\n\n"]
    sm.append("Same 16 facts as the literal benchmark; prompts rewritten as natural paraphrase that avoids every keyword + intent trigger in factRetrieval.ts.\n\n")
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
            sm.append(f"- KW    [{r['keyword']['score']['hit_count']}/{r['keyword']['score']['hit_total']}]  picks=`{','.join(r['keyword'].get('picked_ids', []))}`\n  → {r['keyword'].get('content','ERR')[:300]}\n")
            sm.append(f"- EMB   [{r['embedding']['score']['hit_count']}/{r['embedding']['score']['hit_total']}]  picks=`{','.join(r['embedding'].get('picked_ids', []))}`\n  → {r['embedding'].get('content','ERR')[:300]}\n\n")

    (OUT_DIR / "summary.md").write_text("".join(sm), encoding="utf-8")
    (OUT_DIR / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 60)
    print(f"DONE. Output: {OUT_DIR}/summary.md")
    if summary["baseline"] and summary["keyword"] and summary["embedding"]:
        b, k, e = summary["baseline"], summary["keyword"], summary["embedding"]
        print()
        print(f"  Baseline (no pinning) recall: {b['recall_pct']}%")
        print(f"  Keyword pinning recall:       {k['recall_pct']}%")
        print(f"  Embedding pinning recall:     {e['recall_pct']}%")


if __name__ == "__main__":
    run()
