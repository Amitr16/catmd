"""Pydantic schemas — single source of truth for pipeline data shapes.

Aligned with the Supabase `knowledge_cards` table defined in
`docs/knowledge-pipeline-spec.md` §12. Keep them in sync.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

Category = Literal[
    # Medical / clinical (Phase 1 + Phase 6 categories — already seeded ~500 cards)
    "derm", "ophth", "cardiac", "respiratory", "gi", "urinary", "neuro",
    "endocrine", "oncology", "behavioral", "toxicology", "breed", "pediatric",
    "geriatric", "emergency", "dental", "musculoskeletal", "reproductive",
    "infectious",
    # Non-clinical (Phase 2+ categories — added 2026-05-01)
    # Used by Read [cat], Personality Profile, Cat Diary, Companion, Cat Studio.
    # Cards in these categories typically have empty symptoms / null time_to_vet —
    # `cat_specific_notes` carries the narrative payload instead.
    "personality",      # archetype + breed-personality cards
    "lifestyle",        # enrichment, multi-cat dynamics, environment, routines
    "nutrition",        # life-stage, food brands, special diets (Phase 4)
    "cultural",         # cat literature voice, naming, film/music canon (Phase 3)
    "owner_side",       # vocab patterns, vet-prep, grief support (Phase 3)
]

UrgencyTier = Literal["routine", "monitor", "concern", "urgent"]

Priority = Literal["high", "medium", "low"]


# ─── Step 1 output ─────────────────────────────────────────────────────────
class Topic(BaseModel):
    topic: str
    category: Category
    priority: Priority = "medium"
    emergency_related: bool = False
    notes: str | None = None


# ─── Step 2 output (held in memory / cache, not persisted) ─────────────────
class SourceExcerpt(BaseModel):
    # Step-2 excerpts are always real http/https pages; keep strict typing.
    url: HttpUrl
    title: str
    text: str                              # extracted main content
    fetched_at: datetime
    domain: str
    content_hash: str


class TopicSources(BaseModel):
    """Step 2 output — mapping of topic to successfully-fetched source URLs.

    Avoids re-searching in steps 3 + 4. The actual content is loaded from
    the URL-keyed cache on disk.
    """
    topic: str
    category: str
    source_urls: list[str]


# ─── Step 3 output ─────────────────────────────────────────────────────────
class Source(BaseModel):
    # Accepts http/https/internal:// — the last signals an LLM-fallback card
    # with no external authoritative source. Validated manually below.
    url: str
    title: str
    fetched_at: datetime
    license: str | None = None

    def model_post_init(self, __context) -> None:  # noqa: D401
        url = str(self.url)
        if not (url.startswith("http://") or url.startswith("https://") or url.startswith("internal://")):
            raise ValueError(f"Source.url must be http/https/internal://, got: {url!r}")


class TimeToVet(BaseModel):
    """Escalation guidance per urgency tier. All optional — fill what applies."""
    urgent: str | None = None
    concern: str | None = None
    monitor: str | None = None
    routine: str | None = None


class ToxicologyData(BaseModel):
    """Only populated for toxicology-category cards."""
    substance: str
    ld50_mg_per_kg: float | None = None
    minimum_toxic_dose_mg_per_kg: float | None = None
    onset_hours: float | None = None
    mechanism: str | None = None


class KnowledgeCardBody(BaseModel):
    topic: str
    aliases: list[str] = Field(default_factory=list)
    # Symptoms is empty for non-clinical (personality/lifestyle/cultural) cards.
    # Required + populated for medical cards (preserved for back-compat).
    symptoms: list[str] = Field(default_factory=list)
    emergency_threshold: str | None = None
    # time_to_vet is medical-only — defaults to all-null for non-clinical cards.
    time_to_vet: TimeToVet = Field(default_factory=lambda: TimeToVet())
    breed_risks: list[str] = Field(default_factory=list)
    age_risks: str | None = None
    toxicology: ToxicologyData | None = None
    differentials: list[str] = Field(default_factory=list)
    cat_specific_notes: str                # mandatory — the core value field
    related_topics: list[str] = Field(default_factory=list)


class KnowledgeCard(BaseModel):
    topic: str
    category: Category
    body: KnowledgeCardBody
    sources: list[Source] = Field(min_length=1)
    emergency_tags: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    generated_at: datetime
    version: int = 1


# ─── Step 4 output (verification) ──────────────────────────────────────────
VerifyAction = Literal["accept", "flag_for_review", "reject"]


class VerificationReport(BaseModel):
    topic: str
    confidence: float = Field(ge=0.0, le=1.0)
    unsupported_claims: list[str] = Field(default_factory=list)
    corrections: list[str] = Field(default_factory=list)
    emergency_tags_assessment: Literal[
        "appropriate", "overtagged", "undertagged"
    ] = "appropriate"
    recommend_action: VerifyAction
