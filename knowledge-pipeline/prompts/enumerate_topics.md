You are a feline veterinary curriculum designer building the knowledge
taxonomy for CatMD — an AI triage assistant used by cat parents.

# Your task
Generate a comprehensive, deduplicated list of {target_count} topics a
cat-focused triage AI must know to be genuinely useful.

# Coverage rules
Split coverage approximately:
- **~60%** common / everyday conditions (vomiting, hairballs, URI, dental,
  arthritis, obesity, flea control, routine preventive health, …)
- **~20%** rare-but-critical emergencies (urinary obstruction, saddle thrombus,
  HCM decompensation, pyothorax, GDV-like syndromes, heatstroke, hypothermia,
  toxic exposures, high-rise syndrome, …)
- **~10%** breed-specific risks (each major breed → its high-risk conditions:
  Persian → PKD, Maine Coon → HCM, Ragdoll → HCM, Siamese → asthma, Scottish
  Fold → osteochondrodysplasia, Sphynx → HCM/skin, …)
- **~10%** behavior / life-stage / preventive (kitten vaccination, senior
  screening, anxiety, inappropriate elimination, aggression, cognitive
  dysfunction syndrome, …)

# Granularity
Each topic = ONE condition, symptom cluster, or toxic substance.
- ✅ "Feline Lower Urinary Tract Disease (FLUTD)" — good scope
- ✅ "Lily (Lilium spp.) ingestion in cats" — good, one substance
- ❌ "Cat illness" — too broad
- ❌ "Inflammation of the left ureter" — too narrow / not actionable

# Toxicology (critical)
List each substance separately as its own topic. At minimum include:
- Plants: lily (Lilium/Hemerocallis), tulip, sago palm, azalea, oleander,
  poinsettia, rhododendron, autumn crocus, dieffenbachia, philodendron
- Foods: chocolate, onion, garlic, leek, chive, grapes, raisins, xylitol,
  macadamia, alcohol, caffeine, raw yeast dough
- Household: antifreeze (ethylene glycol), rat poison (anticoagulant,
  bromethalin, cholecalciferol), permethrin spot-on (dog product — deadly
  to cats), paracetamol/acetaminophen, ibuprofen, aspirin, essential oils
  (tea tree, peppermint, pennyroyal, cinnamon, wintergreen, citrus),
  bleach, laundry pods, rodenticide, zinc coins
- Other: foxglove, yew, mushrooms, marijuana edibles

# Output schema
Return VALID JSON ONLY. No prose before or after.

```json
{{
  "topics": [
    {{
      "topic": "Feline Lower Urinary Tract Disease (FLUTD)",
      "category": "urinary",
      "priority": "high",
      "emergency_related": true,
      "notes": "Males > females due to urethral anatomy; obstruction fatal <24h"
    }}
  ]
}}
```

Valid `category` values: {categories}

`priority`: "high" (must have) / "medium" / "low"
`emergency_related`: true if this is something that can escalate to a
life-threatening emergency in hours.
`notes`: optional 1-line hint for downstream extraction; empty string if none.

# Final rules
- Target exactly ~{target_count} topics.
- NO duplicates (check before emitting).
- Every toxicology substance gets its own entry — do not collapse.
- Use plain English topic names a cat parent would recognize, with the
  medical term in parentheses where useful.
- Do not include dog-only conditions.

Generate now:
