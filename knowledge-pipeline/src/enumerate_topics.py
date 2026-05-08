"""Step 1: Topic enumeration (per-category batching).

Ask the LLM to brainstorm feline triage topics ONE CATEGORY AT A TIME.
Per-category batching avoids the single-response output-token ceiling and
gives us explicit coverage guarantees. Runs categories concurrently.

Writes `data/topics.jsonl`.

Run:
    python -m src.enumerate_topics
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from pydantic import ValidationError
from rich.console import Console
from rich.table import Table

from . import config
from .llm_client import complete_json
from .schemas import Topic
from .utils.jsonl import write_jsonl

console = Console()

SYSTEM = (
    "You are a feline veterinary curriculum designer. You output ONLY valid JSON. "
    "You are meticulous about coverage, granularity, and deduplication."
)

# ─── Per-category targets (sum = ~700) ─────────────────────────────────────
# Counts reflect clinical importance + breadth. Toxicology leads because each
# substance needs its own card (triage must know cat-specific thresholds).
#
# 2026-05-01: Phase-2 non-clinical categories added (personality, lifestyle).
# Phase 1 medical categories already produced 527 cards — re-running them
# wastes ~$3 in LLM calls on near-duplicate topics. Use the
# PIPELINE_CATEGORIES env var to filter to specific categories. Example:
#   PIPELINE_CATEGORIES=personality,lifestyle python scripts/run_pipeline.py
_ALL_CATEGORY_TARGETS: dict[str, int] = {
    # ─── Phase 1 medical (already seeded, ~527 cards in Supabase) ───────
    "derm": 35,
    "ophth": 25,
    "cardiac": 20,     # HCM, HCM decompensation, ATE/saddle thrombus, CHF
    "respiratory": 25,
    "gi": 45,
    "urinary": 35,     # incl. CKD, AKI, FLUTD, FIC, stones — #1 killer category
    "neuro": 25,
    "endocrine": 25,   # hyperthyroid (huge in seniors), diabetes, Cushing's
    "oncology": 25,
    "behavioral": 30,
    "toxicology": 85,  # every plant/food/drug/chemical as own topic
    "breed": 45,       # 20-25 breeds × top risks each
    "pediatric": 25,
    "geriatric": 25,
    "emergency": 35,   # every acute presentation gets its own card
    "dental": 20,
    "musculoskeletal": 25,
    "reproductive": 20,
    "infectious": 40,  # FIV, FeLV, FIP subtypes, URI agents, parasites
    # ─── Phase 2 non-clinical (added 2026-05-01) ────────────────────────
    "personality": 55,    # archetypes (Litchfield Feline Five) + 25 breed-personality cards
    "lifestyle": 75,      # enrichment, multi-cat dynamics, environment, routines, sleep, age-stage care
}

# Filter via env var. If PIPELINE_CATEGORIES is set (e.g. "personality,lifestyle"),
# only those categories run. Empty/unset = all categories run (legacy behaviour).
_filter_csv = os.environ.get("PIPELINE_CATEGORIES", "").strip()
if _filter_csv:
    _allowed = {c.strip().lower() for c in _filter_csv.split(",") if c.strip()}
    CATEGORY_TARGETS: dict[str, int] = {
        k: v for k, v in _ALL_CATEGORY_TARGETS.items() if k in _allowed
    }
else:
    CATEGORY_TARGETS = dict(_ALL_CATEGORY_TARGETS)

# ─── Per-category coverage rules — injected into the prompt ────────────────
CATEGORY_RULES: dict[str, tuple[str, str]] = {
    "derm": (
        "skin, coat, claws, external ear",
        "Include: allergic/atopic dermatitis, flea allergy dermatitis, "
        "ringworm, miliary dermatitis, abscess (bite wound), feline acne, "
        "otitis externa, ear mites, stud tail, alopecia areata, ...",
    ),
    "ophth": (
        "eyes and eyelids (non-neurological)",
        "Include: conjunctivitis, corneal ulcer, uveitis, glaucoma, "
        "cataracts, entropion, chemosis, third eyelid prolapse, feline "
        "herpesvirus ocular, chlamydia, ...",
    ),
    "cardiac": (
        "heart and vascular (HCM is the #1 feline heart disease)",
        "Include: HCM (hypertrophic cardiomyopathy) and its subtypes, "
        "HCM decompensation, congestive heart failure, arterial "
        "thromboembolism (saddle thrombus), DCM, RCM, endocarditis, "
        "systemic hypertension — each with cat-specific signs.",
    ),
    "respiratory": (
        "upper and lower respiratory (non-cardiac)",
        "Include: URI (herpes, calici, chlamydia, mycoplasma), feline asthma, "
        "pneumonia, pleural effusion, pyothorax, chylothorax, laryngeal "
        "disease, nasopharyngeal polyp, ...",
    ),
    "gi": (
        "digestive system — mouth-to-anus incl. liver + pancreas",
        "Include: vomiting (acute/chronic), diarrhea, constipation, "
        "megacolon, hairball, IBD, lymphoma (but cross-reference oncology), "
        "pancreatitis, triaditis, hepatic lipidosis (cat-specific killer), "
        "cholangitis, foreign body, string foreign body (LINEAR — emergency), "
        "anal sac disease, ...",
    ),
    "urinary": (
        "urinary tract + kidneys (feline #1 mortality category)",
        "Include: FLUTD, feline idiopathic cystitis (FIC), urethral "
        "obstruction (male cats — fatal <24h), struvite stones, calcium "
        "oxalate stones, chronic kidney disease (CKD — map renal/nephrology "
        "here), acute kidney injury (AKI), pyelonephritis, urinary "
        "incontinence, proteinuria, ureteral obstruction, ...",
    ),
    "neuro": (
        "central and peripheral nervous system",
        "Include: seizure disorders, feline cognitive dysfunction syndrome, "
        "vestibular disease, feline hyperesthesia syndrome, meningioma, "
        "lymphoma CNS, spinal cord injury, thiamine deficiency, ...",
    ),
    "endocrine": (
        "hormone-producing organs",
        "Include: hyperthyroidism (huge in senior cats), diabetes mellitus, "
        "diabetic ketoacidosis (EMERGENCY), Cushing's, Addison's (rare in "
        "cats), acromegaly, hypoglycemia, ...",
    ),
    "oncology": (
        "cancers common in cats",
        "Include: lymphoma (most common feline cancer — GI, mediastinal, "
        "renal, CNS subtypes), mammary adenocarcinoma, squamous cell "
        "carcinoma (oral, cutaneous), fibrosarcoma (including injection-site "
        "sarcoma — cat-specific risk), mast cell tumor, basal cell tumor, ...",
    ),
    "behavioral": (
        "behavior and psychiatric",
        "Include: inappropriate elimination, urine marking / spraying, "
        "intercat aggression, redirected aggression, anxiety, compulsive "
        "overgrooming (psychogenic alopecia), pica, petting-induced "
        "aggression, fear/phobia, cognitive decline behavior, introducing "
        "new cat, multi-cat household tension, ...",
    ),
    "toxicology": (
        "toxic substances — each one as its OWN topic",
        "Plants: lily (Lilium + Hemerocallis — all parts, all species), "
        "tulip, sago palm, azalea, oleander, rhododendron, autumn crocus, "
        "dieffenbachia, philodendron, pothos, mistletoe, cyclamen, "
        "foxglove, yew, kalanchoe.\n"
        "Foods: chocolate (dark, milk, white — by species), onion, garlic, "
        "leek, chive, shallot, grapes, raisins, xylitol, macadamia, alcohol, "
        "caffeine (coffee, tea, energy drinks), raw yeast dough, raw fish "
        "(thiaminase), liver (vitamin A toxicosis).\n"
        "Household/chemicals: antifreeze (ethylene glycol), anticoagulant "
        "rodenticide, bromethalin rodenticide, cholecalciferol rodenticide, "
        "permethrin spot-on (dog product — DEADLY to cats), pyrethroid, "
        "bleach, laundry detergent pods, toilet bowl cleaner, zinc coins "
        "(pennies post-1982), lead paint, pine oil, phenolic cleaners.\n"
        "Human drugs: paracetamol/acetaminophen (Tylenol — fatal at 10 "
        "mg/kg), ibuprofen, aspirin, naproxen, 5-fluorouracil, pseudoephedrine, "
        "ADHD medications, SSRIs, venlafaxine, baclofen, benzodiazepines, "
        "vitamin D supplements.\n"
        "Essential oils (cat-specific toxicity): tea tree, peppermint, "
        "pennyroyal, cinnamon, wintergreen, citrus, clove, eucalyptus, "
        "ylang-ylang, lavender, pine, sweet birch, thyme, oregano.\n"
        "Other: marijuana edibles, tobacco/nicotine, mushrooms "
        "(Amanita phalloides, psilocybin), moth balls (naphthalene), "
        "glow-stick fluid.\n"
        "Each gets its own topic, e.g. 'Lily (Lilium spp.) ingestion in cats'.",
    ),
    "breed": (
        "breed-specific health risks (at least 20 breeds)",
        "Cover: Persian (PKD, brachycephalic), Maine Coon (HCM, hip "
        "dysplasia), Ragdoll (HCM), Siamese (asthma, amyloidosis, "
        "strabismus), Scottish Fold (osteochondrodysplasia), Sphynx (HCM, "
        "skin issues, hypothermia risk), Bengal (PRA, HCM), British "
        "Shorthair (HCM, hemophilia B), Burmese (diabetes, hypokalemia), "
        "Abyssinian (PRA, PK deficiency, amyloidosis), Norwegian Forest Cat "
        "(glycogen storage disease IV), Birman (congenital hypotrichosis), "
        "Devon Rex / Cornish Rex (coat/skin, hypotrichosis), Oriental "
        "Shorthair, Exotic Shorthair, American Shorthair, Russian Blue, "
        "Somali, Manx (sacrocaudal dysgenesis), Himalayan, Selkirk Rex, "
        "Turkish Angora (deafness), Turkish Van. Each breed gets 1-3 "
        "topics depending on condition count.",
    ),
    "pediatric": (
        "kitten-specific (<12 months)",
        "Include: vaccination schedule (core), fading kitten syndrome, "
        "neonatal isoerythrolysis, cleft palate, umbilical hernia, patent "
        "ductus arteriosus, kitten URI, ringworm (higher in kittens), "
        "coccidiosis, panleukopenia, hypoglycemia in kittens, socialization "
        "window, ...",
    ),
    "geriatric": (
        "senior (11-14y) / super-senior (15y+) specific",
        "Include: senior wellness screening, chronic kidney disease "
        "management, hyperthyroidism, cognitive dysfunction, osteoarthritis "
        "(affects 90%+ senior cats — under-diagnosed), hypertension, "
        "dehydration risk, dental disease, quality-of-life assessment, "
        "hospice considerations, ...",
    ),
    "emergency": (
        "acute presentations requiring immediate vet attention",
        "Include: dyspnea/open-mouth breathing, collapse, seizure cluster, "
        "saddle thrombus (sudden hind-limb paralysis), urethral obstruction, "
        "blocked cat, pyometra, dystocia, hemorrhage, heatstroke, "
        "hypothermia, shock, anaphylaxis, high-rise syndrome (fall), "
        "HBC (hit by car), animal bite wound, penetrating trauma, "
        "foreign body aspiration, choking, severe dehydration, diabetic "
        "ketoacidosis, hypoglycemic collapse, hepatic lipidosis decompensation, "
        "ethylene glycol toxicosis, string foreign body, ...",
    ),
    "dental": (
        "teeth, gums, oral",
        "Include: periodontal disease, tooth resorption (FORL — cat-specific, "
        "~30% of cats!), feline chronic gingivostomatitis (FCGS), juvenile "
        "gingivitis, oral squamous cell carcinoma, tooth fracture, "
        "malocclusion, retained deciduous teeth, ...",
    ),
    "musculoskeletal": (
        "bones, joints, muscles, tendons",
        "Include: osteoarthritis (under-diagnosed in cats!), hip dysplasia, "
        "patellar luxation, cruciate rupture (rare in cats), fractures, "
        "myopathy, hypertrophic myopathy, calici-associated lameness, "
        "nutritional secondary hyperparathyroidism, rickets, ...",
    ),
    "reproductive": (
        "intact males/females (most US cats spayed/neutered, but cover it)",
        "Include: pyometra (open and closed), mastitis, dystocia, "
        "pseudopregnancy, cryptorchidism, feline mammary hyperplasia "
        "(fibroadenomatous hyperplasia), eclampsia, metritis, retained "
        "placenta, ...",
    ),
    "infectious": (
        "viral, bacterial, fungal, parasitic",
        "Viral: feline panleukopenia, FIV, FeLV, FIP (wet + dry), feline "
        "herpesvirus 1, feline calicivirus, rabies.\n"
        "Bacterial: mycoplasma, chlamydia felis, bartonellosis, "
        "leptospirosis (rare in cats), salmonella, campylobacter, plague.\n"
        "Fungal: ringworm (dermatophytosis), cryptococcus, histoplasmosis, "
        "blastomycosis, sporotrichosis.\n"
        "Parasitic (external): fleas, ticks, ear mites, demodex gatoi, "
        "cheyletiella, notoedres.\n"
        "Parasitic (internal): roundworms, hookworms, tapeworms, "
        "giardia, tritrichomonas foetus, toxoplasma (cat is definitive "
        "host — pregnancy risk), heartworm (cats CAN get it), coccidia.",
    ),
    # ─── Phase 2 non-clinical categories (added 2026-05-01) ───────────────
    "personality": (
        "feline personality archetypes + breed-specific personality traits",
        "Topics MUST cover BOTH personality archetypes AND breed-personality "
        "cards.\n\n"
        "ARCHETYPES (~25 cards): research-validated archetypes from the "
        "Litchfield 'Feline Five' framework (Neuroticism, Extraversion, "
        "Dominance, Impulsiveness, Agreeableness) + composite types like "
        "'Curious-Introvert', 'Confident-Sociable', 'Anxious-Sensitive', "
        "'Affectionate-Lapcat', 'Independent-Aloof', 'Hunter-Athlete', "
        "'Velcro-Cat', 'Skittish-Sensitive', 'Cool-Observer', 'Goofball-"
        "Playful'. Each card describes telltale behaviours, care implications, "
        "what care-needs the archetype requires, and which environments "
        "stress vs. satisfy the cat. Skip the 6 already authored: "
        "Curious-Introvert, Confident-Sociable, Anxious-Sensitive (already "
        "covered).\n\n"
        "BREED-PERSONALITY (~30 cards): one card per common breed describing "
        "TEMPERAMENT (not health — health is in the breed category). Cover: "
        "Maine Coon, Bengal, Persian (already covered — skip), Ragdoll, "
        "Siamese, Sphynx, Russian Blue, Scottish Fold, British Shorthair, "
        "Norwegian Forest Cat, Abyssinian, Burmese, Cornish Rex, Devon Rex, "
        "Tonkinese, Oriental Shorthair, American Shorthair, Manx, Turkish "
        "Angora, Birman, Savannah, Egyptian Mau, Singapura, Munchkin, "
        "Domestic Shorthair (mixed-breed default profile). Each names "
        "energy level, sociability, vocal level, lap-tendency, prey-drive, "
        "and what kind of household the breed thrives in.\n\n"
        "All cards are non-clinical — `symptoms` field is empty array and "
        "`time_to_vet` is empty object. Sources: Litchfield et al. 2017 "
        "(Feline Five PLOS ONE), ISFM breed profiles, AAFP behaviour "
        "resources, Pam Johnson-Bennett, Bradshaw + Turner 'The Domestic "
        "Cat'."
    ),
    "lifestyle": (
        "feline environmental needs, enrichment, multi-cat dynamics, routines",
        "Topics describe HOW to keep a cat well — not what's wrong with one. "
        "Cover these clusters:\n\n"
        "AAFP/ISFM 5 PILLARS framework (~10 cards): the five pillars of a "
        "healthy feline environment (safe place, multiple resource locations, "
        "play+predatory behaviour, positive social interaction, scent + "
        "olfactory environment). One card per pillar plus implementation "
        "cards.\n\n"
        "MULTI-CAT DYNAMICS (~12 cards): N+1 litter rule (already covered, "
        "skip), introducing a new cat (slow protocol), inter-cat aggression "
        "types, resource guarding, vertical territory (already covered, "
        "skip), Feliway/synthetic pheromone use, separation when intro "
        "fails.\n\n"
        "INDOOR ENRICHMENT (~15 cards): food puzzles (already covered, skip), "
        "wand-toy play (interactive), prey-toy rotation, perches at varying "
        "heights (already covered, skip), window watching (already covered, "
        "skip), cat shelves + climbing routes, scratching surfaces "
        "(already covered, skip), grass + cat-safe plants, scent "
        "enrichment (catnip, silvervine, valerian).\n\n"
        "ROUTINES & RHYTHMS (~12 cards): crepuscular activity patterns, "
        "feeding-time consistency, owner-departure-routine, separation "
        "stress prevention, sleep cycle protection, daily play duration "
        "(15-20 min × 2 recommended), bedtime ritual, pre-dawn vocalisation "
        "management.\n\n"
        "AGE-STAGE CARE (~15 cards): kitten socialisation window (2-7w "
        "critical), kitten-proofing the home, adolescent energy peak "
        "management, mid-life weight management, senior cat environment "
        "adaptations (already covered, skip), geriatric cognitive "
        "dysfunction support, dental/grooming routine for older cats.\n\n"
        "OUTDOOR ACCESS (~8 cards): catio design, harness + leash training, "
        "supervised garden access, neighbourhood + traffic risk assessment, "
        "indoor-only vs indoor-outdoor decision framework.\n\n"
        "GROOMING (~8 cards): brushing frequency by coat type, mat "
        "prevention in long-hair breeds, nail trimming, tooth brushing, "
        "ear cleaning, bathing (when needed), professional grooming when "
        "warranted.\n\n"
        "All cards are non-clinical — `symptoms` and `time_to_vet` empty. "
        "Sources: AAFP/ISFM Environmental Needs Guidelines, Ohio State "
        "Indoor Pet Initiative, Pam Johnson-Bennett, Bradshaw + Turner, "
        "Cornell Feline Health Center, ISFM cat-care resources."
    ),
}

# Category aliases we'll accept from the LLM and normalize.
CATEGORY_ALIASES: dict[str, str] = {
    "renal": "urinary",
    "nephrology": "urinary",
    "kidney": "urinary",
    "cardiovascular": "cardiac",
    "cardio": "cardiac",
    "ocular": "ophth",
    "ophthalmology": "ophth",
    "dermatology": "derm",
    "gastrointestinal": "gi",
    "neurology": "neuro",
    "endocrinology": "endocrine",
    "ent": "respiratory",
}


def load_prompt() -> str:
    return (config.PROMPTS / "enumerate_category.md").read_text(encoding="utf-8")


async def enumerate_one_category(
    category: str,
    count: int,
    *,
    semaphore: asyncio.Semaphore,
) -> list[Topic]:
    """Fetch topics for a single category. Retries via llm_client's Tenacity."""
    description, rules = CATEGORY_RULES[category]
    template = load_prompt()
    user = template.format(
        count=count,
        category=category,
        category_description=description,
        category_coverage_rules=rules,
    )
    async with semaphore:
        resp = await complete_json(
            system=SYSTEM,
            user=user,
            temperature=0.5,
            max_tokens=4000,  # 4K is plenty for ≤85 topics per category
        )

    raw_topics = resp.get("topics", []) or []
    topics: list[Topic] = []
    rejected = 0
    for raw in raw_topics:
        # Normalize aliased categories before validation
        cat = raw.get("category", "").lower().strip()
        raw["category"] = CATEGORY_ALIASES.get(cat, cat) or category
        try:
            t = Topic.model_validate(raw)
        except ValidationError:
            # Last-chance coerce: force the category we asked for
            raw["category"] = category
            try:
                t = Topic.model_validate(raw)
            except ValidationError as e:
                console.print(f"[yellow]{category}: skip[/] {raw!r} — {e.errors()[0]['msg']}")
                rejected += 1
                continue
        topics.append(t)

    console.print(
        f"[green]{category}[/] returned {len(topics)}/{count} topics "
        f"({rejected} rejected)"
    )
    return topics


async def enumerate_topics() -> list[Topic]:
    console.print(
        f"[bold]Step 1[/] — enumerating topics per category via {config.LLM_MODEL} "
        f"(target ~{sum(CATEGORY_TARGETS.values())})"
    )
    sem = asyncio.Semaphore(5)  # bounded concurrency on LLM calls
    tasks = [
        asyncio.create_task(enumerate_one_category(cat, n, semaphore=sem))
        for cat, n in CATEGORY_TARGETS.items()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_topics: list[Topic] = []
    for cat, result in zip(CATEGORY_TARGETS.keys(), results):
        if isinstance(result, Exception):
            console.print(f"[red]{cat} FAILED:[/] {result}")
            continue
        all_topics.extend(result)

    # Dedupe case-insensitively on topic name, keep first occurrence
    seen: set[str] = set()
    deduped: list[Topic] = []
    for t in all_topics:
        key = t.topic.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(t)

    console.print(
        f"[bold green]OK[/] {len(deduped)} unique topics "
        f"({len(all_topics) - len(deduped)} duplicates dropped)."
    )
    return deduped


def _report_distribution(topics: list[Topic]) -> None:
    by_cat: dict[str, int] = {}
    by_pri: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    emergency = 0
    for t in topics:
        by_cat[t.category] = by_cat.get(t.category, 0) + 1
        by_pri[t.priority] = by_pri.get(t.priority, 0) + 1
        if t.emergency_related:
            emergency += 1

    table = Table(title="Topic coverage (actual vs target)")
    table.add_column("Category", style="cyan")
    table.add_column("Got", justify="right")
    table.add_column("Target", justify="right")
    table.add_column("Δ", justify="right")
    for cat in config.CATEGORIES:
        got = by_cat.get(cat, 0)
        target = CATEGORY_TARGETS.get(cat, 0)
        delta = got - target
        sign = "+" if delta > 0 else ""
        style = "green" if abs(delta) <= target * 0.15 else "yellow"
        table.add_row(cat, str(got), str(target), f"[{style}]{sign}{delta}[/]")
    console.print(table)

    console.print(
        f"Priority: high={by_pri['high']} "
        f"medium={by_pri['medium']} low={by_pri['low']} | "
        f"Emergency-related: {emergency}"
    )


async def run(out_path: Path | None = None) -> int:
    out_path = out_path or config.TOPICS_PATH
    topics = await enumerate_topics()
    n = write_jsonl(out_path, topics)
    _report_distribution(topics)
    console.print(f"[bold green]->[/] Wrote {n} topics to {out_path}")
    return n


if __name__ == "__main__":
    asyncio.run(run())
