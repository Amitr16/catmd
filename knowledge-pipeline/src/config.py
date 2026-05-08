"""Environment + path config. Single source of truth for tuning knobs."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Force UTF-8 on Windows — Rich + gpt-4o-mini emit ✓ × — and the default
# Windows cmd codepage (cp1252) crashes on them. Applies to every entry
# point because this module is imported first.
for stream_name in ("stdout", "stderr"):
    stream = getattr(sys, stream_name, None)
    if stream is not None and getattr(stream, "encoding", "").lower() != "utf-8":
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass

load_dotenv()

# ─── Paths ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW_SOURCES = DATA / "raw_sources"
PROMPTS = ROOT / "prompts"

for p in (DATA, RAW_SOURCES, PROMPTS):
    p.mkdir(parents=True, exist_ok=True)

# ─── API keys ──────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

SEARCH_PROVIDER = os.getenv("SEARCH_PROVIDER", "brave")
BRAVE_SEARCH_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY", "")
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
GOOGLE_CSE_API_KEY = os.getenv("GOOGLE_CSE_API_KEY", "")
GOOGLE_CSE_CX = os.getenv("GOOGLE_CSE_CX", "")

# ─── Models ────────────────────────────────────────────────────────────────
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")
EMBED_DIMS = int(os.getenv("EMBED_DIMS", "1536"))

# ─── Pipeline tuning ───────────────────────────────────────────────────────
TARGET_TOPIC_COUNT = int(os.getenv("TARGET_TOPIC_COUNT", "600"))
SOURCES_PER_TOPIC = int(os.getenv("SOURCES_PER_TOPIC", "4"))
RATE_LIMIT_RPS = float(os.getenv("RATE_LIMIT_RPS", "1.0"))
HTTP_TIMEOUT_S = float(os.getenv("HTTP_TIMEOUT_S", "30"))
CONFIDENCE_ACCEPT = float(os.getenv("CONFIDENCE_ACCEPT", "0.80"))
CONFIDENCE_FLAG = float(os.getenv("CONFIDENCE_FLAG", "0.60"))

# ─── Output files ──────────────────────────────────────────────────────────
# When PIPELINE_OUTPUT_SUFFIX is set (e.g. "_phase2"), all data files use
# that suffix — keeps the original Phase-1 medical run audit trail intact
# when running Phase-2 (personality/lifestyle) enumeration.
_SUFFIX = os.environ.get("PIPELINE_OUTPUT_SUFFIX", "").strip()
TOPICS_PATH = DATA / f"topics{_SUFFIX}.jsonl"
TOPIC_SOURCES_PATH = DATA / f"topic_sources{_SUFFIX}.jsonl"
CARDS_DRAFT_PATH = DATA / f"cards_draft{_SUFFIX}.jsonl"
CARDS_VERIFIED_PATH = DATA / f"cards_verified{_SUFFIX}.jsonl"
CARDS_FINAL_PATH = DATA / f"cards_final{_SUFFIX}.jsonl"

# ─── Authoritative source domains (step 2) ─────────────────────────────────
# Listed in descending authority order for the search re-ranker.
AUTHORITATIVE_DOMAINS: list[str] = [
    "msdvetmanual.com",      # Merck Vet Manual (feline sections)
    "vet.cornell.edu",       # Cornell Feline Health Center
    "icatcare.org",          # ICatCare / ISFM public pages
    "aspca.org",             # ASPCA Animal Poison Control
    "catvets.com",           # American Assoc. of Feline Practitioners
    "avma.org",              # American Veterinary Medical Association
    "vcahospitals.com",      # VCA pet guides
    "aaha.org",              # American Animal Hospital Association
    "ncbi.nlm.nih.gov",      # PMC open-access
    "petmd.com",             # Consumer vet (use carefully — less authoritative)
]

# ─── Feline knowledge taxonomy ─────────────────────────────────────────────
CATEGORIES: list[str] = [
    "derm",            # skin, coat, claws, ears (external)
    "ophth",           # eyes
    "cardiac",         # HCM (#1 feline heart disease), CHF, thromboembolism
    "respiratory",
    "gi",              # digestive, incl. vomiting, diarrhoea, IBD
    "urinary",         # lower urinary, kidney — #1 killer in cats
    "neuro",           # seizures, vestibular, cognitive
    "endocrine",       # thyroid, diabetes, adrenal
    "oncology",        # cancers
    "behavioral",      # aggression, anxiety, spraying, house-soiling
    "toxicology",      # toxic plants, foods, chemicals, meds
    "breed",           # breed-specific risks (Persian PKD, Maine Coon HCM, …)
    "pediatric",       # kittens
    "geriatric",       # senior/super-senior-specific issues
    "emergency",       # respiratory distress, obstruction, trauma, collapse
    "dental",
    "musculoskeletal", # lameness, arthritis, fractures
    "reproductive",
    "infectious",      # FIV, FeLV, FIP, URI
]

def require_openai() -> None:
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY missing. Copy .env.example to .env and fill in."
        )

def require_supabase() -> None:
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_KEY missing. Needed only for step 6."
        )
