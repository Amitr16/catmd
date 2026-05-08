You are a feline-domain curriculum designer building the knowledge
taxonomy for CatMD — a comprehensive cat-life app. Categories range from
medical/clinical to behavioural, personality, and lifestyle/enrichment.

# Your task
Generate exactly **{count}** topics for a single category: **{category}**
({category_description}).

# Coverage rules for this category
{category_coverage_rules}

# Granularity
Each topic = ONE specific concept. The exact shape depends on the category
(see the coverage rules above for what kind of topic this category needs).
- Use plain English names a cat parent would recognize, with technical term
  in parentheses where useful.
- ✅ Medical: "Feline Lower Urinary Tract Disease (FLUTD)", "Lily (Lilium spp.) ingestion in cats"
- ✅ Behaviour: "Tail held high and curved (greeting signal)", "Slow blink (trust gesture)"
- ✅ Personality: "Curious-Introvert archetype", "Maine Coon temperament"
- ✅ Lifestyle: "Multi-cat household N+1 litter rule", "Vertical territory and perches"
- ❌ "Cat illness" / "Cat behaviour" — too broad
- ❌ "Inflammation of the left ureter" — too narrow
- Do not include dog-only conditions.
- For non-medical categories, `priority` and `emergency_related` are still
  required by the schema — set `priority` based on how core the concept is
  to the category, and `emergency_related: false` for non-clinical topics.

# Output schema
Return VALID JSON ONLY. No prose before or after.

```json
{{
  "topics": [
    {{
      "topic": "Feline Lower Urinary Tract Disease (FLUTD)",
      "category": "{category}",
      "priority": "high",
      "emergency_related": true,
      "notes": "Males > females due to urethral anatomy; obstruction fatal <24h"
    }}
  ]
}}
```

Rules:
- `category` MUST be exactly `"{category}"` for every topic.
- `priority`: "high" (must have) / "medium" (useful) / "low" (nice-to-have)
- `emergency_related`: true if this can escalate to a life-threatening emergency in hours.
- `notes`: optional 1-line hint for downstream extraction; empty string if none.
- Deduplicate case-insensitively within your output.

Generate exactly {count} unique topics now:
