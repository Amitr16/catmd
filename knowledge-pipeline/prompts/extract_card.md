You are curating a structured knowledge card for CatMD — an AI triage app
for cat parents. Each card goes into the RAG corpus and is surfaced at
query time with inline citations.

# Inputs
- topic: {topic}
- category: {category}
- priority: {priority}
- emergency_related: {emergency_related}
- sources: multiple authoritative excerpts (below)

# Hard rules
- Write the card in YOUR voice. DO NOT reproduce source text verbatim —
  paraphrase facts. Facts are not copyrightable, expression is.
- Only include assertions supported by AT LEAST ONE provided source.
- If sources disagree, note it explicitly in `cat_specific_notes`.
- `cat_specific_notes` is MANDATORY and must capture how cats differ from
  dogs / humans when relevant. This is the single highest-value field.
- For toxicology cards: populate the `toxicology` object with
  ld50_mg_per_kg / minimum_toxic_dose_mg_per_kg / onset_hours / mechanism
  wherever the sources support it. Leave fields null if not found.
- For breed cards: only include breeds where the source cites elevated risk.
- `emergency_tags` is a SHORT keyword list for the app's Layer-1 emergency
  detector. Use lowercase snake_case identifiers like ["lilium",
  "urinary_obstruction", "seizure", "hepatic_lipidosis"]. Include a tag
  WHENEVER any of these apply to this condition:
    * can kill or permanently injure a cat within 48h if untreated
    * is a toxic substance (always tag the substance name)
    * requires immediate vet attention (e.g., respiratory distress,
      collapse, seizure, blocked cat, saddle thrombus, sudden blindness,
      closed pyometra)
    * has a narrow window to intervene (acute kidney injury, DKA,
      bloat/GDV equivalents, obstruction, trauma)
  Err on the side of TAGGING when in doubt — a tagged condition triggers
  stricter UI; untagged emergencies kill cats. Common misses (always tag):
  hepatic lipidosis, FLUTD obstruction, saddle thrombus, DKA, sudden
  blindness from hypertension, pyothorax, heatstroke, hypothermia.
- DO NOT invent drug names, dosages, thresholds, or species-specific
  numbers that aren't in the sources.
- DO NOT give treatment advice. Triage/education only.

# Output schema (valid JSON only, no prose)
```json
{{
  "topic": "{topic}",
  "category": "{category}",
  "body": {{
    "topic": "{topic}",
    "aliases": ["..."],
    "symptoms": ["..."],
    "emergency_threshold": "..." | null,
    "time_to_vet": {{
      "urgent": "immediate if X",
      "concern": "within 24h if Y",
      "monitor": "...",
      "routine": "..."
    }},
    "breed_risks": ["..."],
    "age_risks": "kitten" | "adult" | "senior" | "geriatric" | null,
    "toxicology": null | {{
      "substance": "...",
      "ld50_mg_per_kg": null | number,
      "minimum_toxic_dose_mg_per_kg": null | number,
      "onset_hours": null | number,
      "mechanism": "..." | null
    }},
    "differentials": ["..."],
    "cat_specific_notes": "REQUIRED — why cats differ from dogs/humans.",
    "related_topics": ["..."]
  }},
  "sources": [
    {{ "url": "<exact URL from input>", "title": "<title>",
       "fetched_at": "<exact fetched_at from input>", "license": null }}
  ],
  "emergency_tags": ["..."],
  "confidence": 0.0,
  "generated_at": "{generated_at}",
  "version": 1
}}
```

# Source excerpts
{sources_block}

Generate the card JSON now. Set `confidence` to 0.0 — it will be set in
the verification step.
