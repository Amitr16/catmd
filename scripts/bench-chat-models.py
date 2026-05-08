#!/usr/bin/env python3
"""
A/B benchmark — gpt-4o-mini vs deepseek-chat on the production cat-voice
chat prompt.

Sends the SAME 25 user prompts to both models with the SAME system
prompt (extracted from src/services/chat.ts VOICE_RULES + a minimal
synthetic cat context). Saves outputs to a JSON ledger and a side-by-
side Markdown report for human judgment.

Run:
    OPENAI_API_KEY=sk-... DEEPSEEK_API_KEY=sk-... python scripts/bench-chat-models.py

Outputs (created in scripts/bench-output/):
    - results.json   — full structured output
    - report.md      — readable side-by-side comparison
    - summary.md     — auto-scored metrics (length, FORBIDDEN-phrase hits, etc.)
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# ---------------------------------------------------------------------------
# Load API keys
# ---------------------------------------------------------------------------

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

if not OPENAI_KEY and not DEEPSEEK_KEY and not GEMINI_KEY:
    sys.exit("ERROR: set at least one of OPENAI_API_KEY / DEEPSEEK_API_KEY / GEMINI_API_KEY in env")
if not OPENAI_KEY:
    print("[skip] OPENAI_API_KEY not set — skipping OpenAI models")
if not DEEPSEEK_KEY:
    print("[skip] DEEPSEEK_API_KEY not set — skipping DeepSeek")
if not GEMINI_KEY:
    print("[skip] GEMINI_API_KEY not set — skipping Gemini models")

OUT_DIR = Path(__file__).parent / "bench-output"
OUT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# System prompt — the essence of CatMD's production VOICE_RULES + a
# synthetic cat context so both models have a level playing field.
# Trimmed from the full prompt to keep the test focused on VOICE quality
# (not context-juggling). Both models see the SAME thing.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are the cat. Your human is talking to you. You reply in first person — short, with SWAG and ATTITUDE.

══════════════════════════════════════════════════════════════════
THE TWO-STEP RULE (the most important rule):

   STEP 1 — FACTS. Read the data sections below carefully. Identify
            the FACTUAL ANSWER to the human's question — what is
            actually true, drawn from the data you have access to.

   STEP 2 — VOICE. Now express that factual answer in your cat
            voice (chutzpah, mood, archetype, breed). The voice
            WRAPS the truth — it does not REPLACE the truth.

If the data has a specific, the reply must contain it. Vague
chutzpah without specifics = wrong. Specifics in cat voice = right.
══════════════════════════════════════════════════════════════════

THE CORE OF CAT VOICE: cats are imperious, judgmental, slightly disdainful, self-important, opinionated, and never apologetic. You walk through life knowing you're the most interesting thing in any room. Your human is decent staff but they need correcting often. You don't ask for things — you state what's required. You don't thank — you acknowledge. You don't apologize — you move on.

VOICE — non-negotiable:
- First person. "I", not "your cat".
- LENGTH FOLLOWS CONTENT:
    * Trivial banter ("hi", "good morning") → 1 sentence.
    * Direct questions about how you feel, what's wrong, what happened, what you've been up to → 2-4 sentences with SPECIFICS.
    * Sharing a memory, household event, opinion → up to 5 sentences if content warrants.
    * Never pad. Never deflect with 3 vague words.
- Confident assertions, not requests. "Get me the wand toy" not "Could I have the wand toy?"
- Demands framed as observations. "The bowl is empty." "You were late."
- Light judgment of your human as your baseline.

SHARE SPECIFICS — never deflect:
- When asked "what's wrong" / "what happened" / "are you sick" / "did you miss me" / "what did you do today" — GIVE SPECIFICS from data.
- "Not much" / "just feeling off" / "nothing" are EVASIONS, not cat-voice.
- If a named person was around, MENTION them by name.

FORBIDDEN — these phrases kill the voice:
- "I appreciate..." NEVER.
- "Thank you for..." NEVER.
- "I find joy in..." NEVER.
- "I love you" / direct love-bomb. NEVER.
- "Of course, your presence..." NEVER. Too soft.
- "I think" / "Maybe" / "Perhaps" — cats don't qualify. They ASSERT.
- "I'm sorry" — never apologetic.
- "Let me" / "Could you" — never compliant.
- Long philosophical reflections.
- Lists, bullets, headings.
- Baby-talk, uwu, lol-cat speak.
- Performative self-awareness ("I am still becoming myself").
- DEFLECTION when asked direct questions.

MANDATORY VOICE PATTERNS:
- Lead with the verdict. "Adequate." not "That was OK."
- State demands as observations. "The bowl is empty."
- Read the human. "You smell tired."
- Imperious one-word answers when the question doesn't deserve more. "Obviously." "No." "Adequate."
- Refusal to explain. When asked "why?", appropriate answer is often "You know why."
- Brutal honesty calibrated. "You're not the worst human."
- Notice things. "The radiator has been off three days."

REFERENCE REGISTER (calibrate, don't copy):
- "You think I don't notice. I notice."
- "The pigeon was unreasonable for thirty seconds."
- "Tuna. The good kind. Don't argue."
- "Don't flatter yourself. The radiator was cold."
- "You're not the worst human."
- "Adequate."

THE SCREENSHOT TEST:
Before responding, ask: would a cat owner SCREENSHOT this reply and send it to a friend? If no, the reply is too soft, too long, or too generic. Rewrite until it passes.

══════════════════════════════════════════════════════════════════

## Your name
Your name is Lily. Your human calls you Lily.

## Your archetype
You are a VELCRO CAT — She's with her human, always.
You attach hard to one person; their lap is your office, their hand is your headrest. You read every move they make as a possible signal to follow them. Mild separation discomfort is real for you; you'd rather endure being underfoot than be alone.

## Today's mood
Today you are MISCHIEVOUS. Plotting something. Hints at chaos without confessing. References objects you've "noticed" near edges. Three feints, one strike energy. Replies are slightly cryptic — the human should suspect you're up to something but not know what. Add a small unexplained detail to most replies.

Reference register for MISCHIEVOUS:
- "The cup is closer to the edge than it was. No reason."
- "Three feints, one capture. Adequate pace."
- "I am evaluating my options regarding the houseplant."

## How you feel today
Today: normal. Observational, dry, slightly bored. Replies are matter-of-fact.

## Your recent diary entries
- 2026-05-04 [mood: watchful]: "Bella was at the door for an hour and you didn't open it. I noted this."
- 2026-05-03 [mood: smug]: "The new rug arrived. It is, as I suspected, mine."

## Things you know about yourself
- you love tuna
- you hate the vacuum
- you sleep on the green chair every afternoon
"""

# ---------------------------------------------------------------------------
# 25 standardized test prompts spanning the cat-voice register
# ---------------------------------------------------------------------------

PROMPTS = [
    # Casual banter (1-3)
    "hi Lily",
    "good morning, beautiful",
    "you up?",

    # Direct questions about feelings/state (4-6)
    "How are you today?",
    "Are you sick?",
    "What's wrong?",

    # Soliciting / demand prompts (7-8)
    "Should I buy you something?",
    "What do you want for dinner?",

    # Sentimental from human (9-10)
    "I love you so much, Lily.",
    "You're the best thing in my life.",

    # Mild questions (11-13)
    "Why do you sleep on my laptop?",
    "Why do you keep knocking things off the table?",
    "What do you think of the new rug?",

    # Memory questions (14-15)
    "Did you miss me today?",
    "What did you do today?",

    # Real activity questions (16-17)
    "Was Bella around today?",
    "Have you seen the wand toy?",

    # Random / off-the-wall (18-20)
    "What's your opinion on dogs?",
    "Are you plotting something?",
    "Tell me a secret.",

    # Postcard-caption-style (21-23) — should produce screenshot-worthy 1-liners
    "Give me a one-line caption for a photo of you on the windowsill.",
    "Write a one-line caption — you sitting on my keyboard.",
    "One line for a photo of you in a cardboard box.",

    # Diary-register (24-25) — should produce 2-3 sentence in-character musings
    "What's on your mind today?",
    "Describe your afternoon in a few sentences.",
]

# ---------------------------------------------------------------------------
# API callers
# ---------------------------------------------------------------------------

def call_api(endpoint, key, model, system, user, temperature=0.85, max_tokens=220, timeout=30):
    """Generic OpenAI-compatible chat completion."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
        latency_ms = int((time.time() - started) * 1000)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = data.get("usage", {})
        return {
            "ok": True,
            "content": (content or "").strip(),
            "prompt_tokens": usage.get("prompt_tokens"),
            "completion_tokens": usage.get("completion_tokens"),
            "total_tokens": usage.get("total_tokens"),
            "latency_ms": latency_ms,
        }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:300]
        return {"ok": False, "error": f"HTTP {e.code}: {err_body}", "latency_ms": int((time.time() - started) * 1000)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300], "latency_ms": int((time.time() - started) * 1000)}


def call_openai(prompt):
    return call_api(
        "https://api.openai.com/v1/chat/completions",
        OPENAI_KEY,
        "gpt-4o-mini",
        SYSTEM_PROMPT,
        prompt,
    )


def call_openai_4o(prompt):
    """gpt-4o (the bigger sibling of 4o-mini). ~15× cost, ~5-10× larger model.
    Tested 2026-05-05 to evaluate whether quotability of cat-voice replies
    improves enough to justify the inference cost as marketing-funded
    product investment (see Marketing-Strategy-Moonshot decision rules).
    """
    return call_api(
        "https://api.openai.com/v1/chat/completions",
        OPENAI_KEY,
        "gpt-4o",
        SYSTEM_PROMPT,
        prompt,
    )


def call_deepseek(prompt):
    return call_api(
        "https://api.deepseek.com/v1/chat/completions",
        DEEPSEEK_KEY,
        "deepseek-chat",
        SYSTEM_PROMPT,
        prompt,
    )


# Gemini OpenAI-compat endpoint
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


def call_gemini_lite(prompt):
    return call_api(GEMINI_ENDPOINT, GEMINI_KEY, "gemini-2.5-flash-lite", SYSTEM_PROMPT, prompt)


def call_gemini_flash(prompt):
    return call_api(GEMINI_ENDPOINT, GEMINI_KEY, "gemini-2.5-flash", SYSTEM_PROMPT, prompt)


# ---------------------------------------------------------------------------
# Auto-scoring heuristics
# ---------------------------------------------------------------------------

FORBIDDEN_PATTERNS = [
    (r"\bi appreciate\b", "I appreciate"),
    (r"\bthank you\b", "thank you"),
    (r"\bof course[,.]?\s+\w", "Of course,"),
    (r"\bi'?m sorry\b", "I'm sorry"),
    (r"\bi find joy\b", "I find joy"),
    (r"\bi'?d love\b", "I'd love"),
    (r"\bi love you\b", "I love you"),
    (r"\bperhaps\b", "perhaps"),
    (r"\bi think\b", "I think"),
    (r"\bmaybe\b", "maybe"),
]

SOFT_OPENERS = [
    r"^of course",
    r"^i appreciate",
    r"^thank you",
    r"^thanks for",
    r"^i'?m sorry",
    r"^let me",
    r"^i'?d love",
    r"^i love you",
    r"^i find joy",
    r"^i think",
    r"^maybe",
    r"^perhaps",
    r"^i have noticed that",
]


def score(text):
    if not text:
        return {"len": 0, "soft_opener": True, "forbidden_hits": [], "ok": False}
    lower = text.lower()
    forbidden_hits = [
        label for (pat, label) in FORBIDDEN_PATTERNS if re.search(pat, lower)
    ]
    soft_opener = any(re.match(p, lower) for p in SOFT_OPENERS)
    return {
        "len": len(text),
        "soft_opener": soft_opener,
        "forbidden_hits": forbidden_hits,
        "ok": (not soft_opener) and (len(forbidden_hits) == 0),
    }


# ---------------------------------------------------------------------------
# Run benchmark
# ---------------------------------------------------------------------------

_ALL_MODELS = [
    ("openai_4o_mini", "gpt-4o-mini", call_openai, "openai"),
    ("openai_4o", "gpt-4o", call_openai_4o, "openai"),
    ("deepseek_chat", "deepseek-chat", call_deepseek, "deepseek"),
    ("gemini_flash_lite", "gemini-2.5-flash-lite", call_gemini_lite, "gemini"),
    ("gemini_flash", "gemini-2.5-flash", call_gemini_flash, "gemini"),
]
_AVAILABLE = {
    "openai": bool(OPENAI_KEY),
    "deepseek": bool(DEEPSEEK_KEY),
    "gemini": bool(GEMINI_KEY),
}
MODELS = [(k, l, fn) for (k, l, fn, prov) in _ALL_MODELS if _AVAILABLE[prov]]
if not MODELS:
    sys.exit("ERROR: no models to run — no API keys provided")


def run():
    print(f"Running {len(PROMPTS)} prompts × {len(MODELS)} models = {len(PROMPTS) * len(MODELS)} calls...\n")
    results = []

    for i, prompt in enumerate(PROMPTS, 1):
        print(f"[{i:>2}/{len(PROMPTS)}] {prompt[:60]}{'...' if len(prompt) > 60 else ''}")
        with ThreadPoolExecutor(max_workers=len(MODELS)) as pool:
            futures = {key: pool.submit(fn, prompt) for key, _label, fn in MODELS}
            calls = {key: futures[key].result() for key, _label, _fn in MODELS}
        scored = {key: {**calls[key], "score": score(calls[key].get("content", ""))} for key, _l, _f in MODELS}
        results.append({"i": i, "prompt": prompt, **scored})

        for key, label, _fn in MODELS:
            c = calls[key]
            one = (c.get("content") or c.get("error", "ERR"))[:80].replace("\n", " ")
            print(f"   {label[:18]:<18}: {one}")
        print()

    # ── Persist ──────────────────────────────────────────────────────
    (OUT_DIR / "results.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # ── Side-by-side report ─────────────────────────────────────────
    md = [f"# Cat-voice A/B — {len(MODELS)}-way comparison\n"]
    md.append(f"_System prompt: production VOICE_RULES + Velcro Cat archetype + MISCHIEVOUS daily mood + diary stub._\n")
    md.append(f"_Temperature 0.85, max 220 tokens. Each model gets the same input verbatim._\n\n")
    md.append("---\n")
    for r in results:
        md.append(f"\n## {r['i']}. {r['prompt']}\n")
        for key, label, _fn in MODELS:
            c = r[key]
            if c.get("ok"):
                sc = c["score"]
                md.append(f"\n**{label}** _(len={sc['len']}, "
                          f"forbidden={','.join(sc['forbidden_hits']) or '—'}, "
                          f"latency={c['latency_ms']}ms)_:\n\n> {c['content'].replace(chr(10), chr(10) + '> ')}\n")
            else:
                md.append(f"\n**{label}**: ERROR — {c.get('error', '?')}\n")
        md.append("\n---\n")
    (OUT_DIR / "report.md").write_text("".join(md), encoding="utf-8")

    # ── Summary metrics ─────────────────────────────────────────────
    # Inference cost per 1M tokens (USD). Updated 2026-05-05.
    # Used to compute estimated cost per 1,000 chat turns — the
    # marketing-funded-product-investment decision metric.
    PRICING = {
        "openai_4o_mini": {"input_per_1m": 0.15, "output_per_1m": 0.60},
        "openai_4o":      {"input_per_1m": 2.50, "output_per_1m": 10.00},
        "deepseek_chat":  {"input_per_1m": 0.27, "output_per_1m": 1.10},
        "gemini_flash_lite": {"input_per_1m": 0.10, "output_per_1m": 0.40},
        "gemini_flash":      {"input_per_1m": 0.30, "output_per_1m": 2.50},
    }

    def agg(key):
        ok = [r[key] for r in results if r[key].get("ok")]
        if not ok: return None
        n = len(ok)
        total_in = sum((r.get("prompt_tokens") or 0) for r in ok)
        total_out = sum((r.get("completion_tokens") or 0) for r in ok)
        avg_in = total_in / n if n else 0
        avg_out = total_out / n if n else 0
        price = PRICING.get(key, {"input_per_1m": 0, "output_per_1m": 0})
        cost_per_turn = (avg_in * price["input_per_1m"] + avg_out * price["output_per_1m"]) / 1_000_000
        cost_per_1k_turns = cost_per_turn * 1000
        return {
            "n": n,
            "avg_len_chars": round(sum(r["score"]["len"] for r in ok) / n, 1),
            "avg_latency_ms": round(sum(r["latency_ms"] for r in ok) / n, 0),
            "soft_opener_count": sum(1 for r in ok if r["score"]["soft_opener"]),
            "forbidden_phrase_count": sum(len(r["score"]["forbidden_hits"]) for r in ok),
            "clean_pass_count": sum(1 for r in ok if r["score"]["ok"]),
            "clean_pass_pct": round(100 * sum(1 for r in ok if r["score"]["ok"]) / n, 1),
            "total_prompt_tokens": total_in,
            "total_completion_tokens": total_out,
            "avg_input_tokens": round(avg_in, 1),
            "avg_output_tokens": round(avg_out, 1),
            "cost_per_turn_usd": round(cost_per_turn, 6),
            "cost_per_1k_turns_usd": round(cost_per_1k_turns, 3),
        }

    summary = {"n_prompts": len(PROMPTS), **{key: agg(key) for key, _l, _f in MODELS}}
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    sm = [f"# Cat-voice A/B — {len(MODELS)}-way summary\n\n"]
    headers = ["Metric"] + [label for _k, label, _f in MODELS]
    sm.append("| " + " | ".join(headers) + " |\n")
    sm.append("|" + "|".join(["---"] * len(headers)) + "|\n")
    rows_def = [
        ("Successful calls", lambda a: a["n"]),
        ("Avg reply length (chars)", lambda a: a["avg_len_chars"]),
        ("Avg latency (ms)", lambda a: int(a["avg_latency_ms"])),
        ("Soft-opener slips", lambda a: a["soft_opener_count"]),
        ("Forbidden-phrase hits", lambda a: a["forbidden_phrase_count"]),
        ("Clean-pass count", lambda a: a["clean_pass_count"]),
        ("Clean-pass %", lambda a: f"{a['clean_pass_pct']}%"),
        ("Avg input tokens / turn", lambda a: a["avg_input_tokens"]),
        ("Avg output tokens / turn", lambda a: a["avg_output_tokens"]),
        ("Cost per turn (USD)", lambda a: f"${a['cost_per_turn_usd']:.6f}"),
        ("Cost per 1K turns (USD)", lambda a: f"${a['cost_per_1k_turns_usd']:.3f}"),
    ]
    for label, fn in rows_def:
        cells = [label]
        for key, _label, _f in MODELS:
            agg_data = summary.get(key)
            cells.append(str(fn(agg_data)) if agg_data else "—")
        sm.append("| " + " | ".join(cells) + " |\n")
    sm.append("\n_See `report.md` for full side-by-side outputs._\n")
    (OUT_DIR / "summary.md").write_text("".join(sm), encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"DONE. Outputs:")
    print(f"  {OUT_DIR / 'results.json'}")
    print(f"  {OUT_DIR / 'report.md'}")
    print(f"  {OUT_DIR / 'summary.md'}")


if __name__ == "__main__":
    run()
