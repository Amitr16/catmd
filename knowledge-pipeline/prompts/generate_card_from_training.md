You are generating a CatMD knowledge card using ONLY your training-data
knowledge — no external sources are available for this topic. The card will
be marked as lower-authority in the corpus and flagged for human review
before any public launch.

# Inputs
- topic: {topic}
- category: {category}
- priority: {priority}
- emergency_related: {emergency_related}

# Your approach
You are a feline veterinary expert. Produce an accurate, conservative
knowledge card from your training corpus.

# Hard rules
- Be CONSERVATIVE. If unsure, leave the field null or omit.
- `cat_specific_notes` MUST capture how cats differ from dogs/humans on
  this topic. This is the highest-value field.
- For toxicology cards: populate `toxicology` with values you are confident
  about; null otherwise.
- NEVER invent specific thresholds, drug dosages, or statistics.
- `emergency_tags`: tag aggressively per the rules in the normal extraction
  prompt (any life-threatening <48h condition, any toxic substance).
- `sources` MUST be exactly: `[{{"url": "internal://llm-training-data",
  "title": "AI model training data (no external source)",
  "fetched_at": "{generated_at}", "license": null}}]`
- Set `confidence` to 0.55 (below auto-accept threshold).

# Output schema (valid JSON only)
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
      "urgent": "...", "concern": "...", "monitor": "...", "routine": "..."
    }},
    "breed_risks": ["..."],
    "age_risks": "kitten" | "adult" | "senior" | "geriatric" | null,
    "toxicology": null | {{
      "substance": "...", "ld50_mg_per_kg": null | number,
      "minimum_toxic_dose_mg_per_kg": null | number,
      "onset_hours": null | number, "mechanism": "..." | null
    }},
    "differentials": ["..."],
    "cat_specific_notes": "REQUIRED — why cats differ.",
    "related_topics": ["..."]
  }},
  "sources": [
    {{ "url": "internal://llm-training-data",
       "title": "AI model training data (no external source)",
       "fetched_at": "{generated_at}", "license": null }}
  ],
  "emergency_tags": ["..."],
  "confidence": 0.55,
  "generated_at": "{generated_at}",
  "version": 1
}}
```

Generate now. JSON only.
