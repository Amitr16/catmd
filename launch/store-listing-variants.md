# Store listing A/B variants — queue for post-launch testing

Play Console's Store Listing Experiments allow you to A/B test title, short description, full description, icon, feature graphic, and screenshots. Each experiment runs for 14+ days to reach significance.

**IMPORTANT:** Experiments require Production access (not Closed Testing). Queue these for Week 1 post-launch.

---

## Experiment 1 — App title (highest leverage)

**Control (V1):** `CatMD - AI Vet Triage for Cats`

**Challenger (V4):** `CatMD: Cat Symptom Checker AI`

**Hypothesis:** V4 includes "symptom checker" which has 10× search volume vs "triage." Expect +15% conversion from search impressions.

**Traffic split:** 50/50.

**Run duration:** 14 days minimum; extend if no significance by day 14.

---

## Experiment 2 — Short description

**Control (V1):** `AI vet triage built only for cats. Scan, score, share with your vet.`

**Challenger (V2):** `AI symptom checker for cats. 0-99 score, vet-ready summaries, pain scoring.`

**Hypothesis:** V2 leads with "symptom checker" (higher search volume) and includes concrete features (0-99 score, pain scoring) that differentiate. Expect +10-20% install conversion.

---

## Experiment 3 — Feature graphic

**Control (current):** Sage background with "Cats hide pain. CatMD catches what you can't." + 90 health score ring

**Challenger:** Same background, but foreground = cat's face + large "0-99 score" callout, with smaller "Built only for cats" tag

**Hypothesis:** Human/cat face increases emotional engagement over abstract score. Expect +5-8% install conversion.

**Production note:** to test this, build the challenger in Figma or similar, export as 1024×500 PNG, upload as experiment asset.

---

## Experiment 4 — Screenshot ordering

**Control (current order):**
1. 01-home-urgent-alert
2. 02-emergency-triage-actions
3. 03-scan-input-running
4. 04-cat-specific-differentials
5. 05-clinical-reasoning
6. 06-action-guide-decisions
7. 07-health-score-routine
8. 08-vet-handoff-share

**Challenger (emotional → functional → trust, per ASO research):**
1. 02-emergency-triage-actions (lead with the differentiated moment)
2. 07-health-score-routine (the 0-99 score — magic moment)
3. 01-home-urgent-alert
4. 04-cat-specific-differentials
5. 05-clinical-reasoning
6. 08-vet-handoff-share (high-trust signal)
7. 06-action-guide-decisions
8. 03-scan-input-running

**Hypothesis:** First 3 screenshots drive 80% of install decisions. Leading with emergency-tier + 0-99 score (the two most differentiated moments) should lift install conversion +10-15%.

---

## Full description variants

### V1 (current) — the "Cats hide pain" story-first

Current long description leading with emotional hook. See `store-listing-copy.md`.

### V2 — features-first, more keyword-dense

```
CatMD — the AI vet triage app built ONLY for cats.

KEY FEATURES
• 0-99 health score with 4 urgency tiers (Emergency, Vet Soon, Monitor, Routine)
• Feline Grimace Scale pain scoring from a single photo (U. Montreal 2019 protocol)
• Symptom + photo triage — type, snap, or both
• Sleeping Respiratory Rate tracker (HCM early warning)
• CKD monitoring dashboard — water intake, urination, weight trends
• Hyperthyroidism monitoring — the "classic triad" of symptoms
• Litter-box log — blockage + polyuria flags
• Vet-ready PDF export — summary your vet skims in 60 seconds

CONDITIONS CATMD SCREENS FOR
Feline urethral obstruction, feline idiopathic cystitis (FIC), chronic kidney disease (CKD), hyperthyroidism, diabetes mellitus, hepatic lipidosis, hypertrophic cardiomyopathy (HCM), upper respiratory infection (URI), inflammatory bowel disease, dental issues, ear mites, hairballs, foreign body obstruction, toxin ingestion (lily, antifreeze, human medications), trauma, and pain.

WHY CAT-ONLY
Every pet symptom checker I tried was built around dog patterns — then retrofitted for cats. Cats hide illness completely differently. Urethral obstruction kills in 48 hours. Hyperthyroidism looks like "she's just old." CKD is 70% done before symptoms show. These conditions don't have dog analogues. CatMD is trained on feline-only medical sources: Merck Vet Manual feline chapters, AAFP guidelines, ISFM, Cornell Feline Health, and ASPCA toxicity database.

HONEST AI
• Never called a diagnosis — triage and education only
• Always shows its reasoning, red flags, and sources
• Flags "low confidence" when evidence is thin
• Emergency-tier scans include one-tap ER vet dial and poison hotline
• Species-locked — refuses to triage dogs, rabbits, humans

PRIVACY
• Fully anonymous — no account required
• Scan history lives on your device unless you opt in to sync
• We never sell data; we never train AI on your cat
• One-tap delete wipes everything

PRICING
• Free: 3 scans per month, all flows
• Pro Annual: $79.99/year (~$6.67/month), 7-day free trial
• Pro Monthly: $9.99/month
• 14-day free trial with full Pro access — no card required to start

⚠️ CatMD is informational only. It is not veterinary advice, diagnosis, or treatment, and does not replace a licensed veterinarian. In a medical emergency, contact your nearest emergency vet immediately.
```

**Why test V2:** keyword-dense, feature-first, structured — tends to convert higher for users who scroll past the first 2 sentences.

---

## Experiment execution checklist

For each experiment:

- [ ] Configure in Play Console → Grow users → Store listing experiments
- [ ] Set traffic split (50/50 for single-variable tests)
- [ ] Set minimum duration 14 days
- [ ] Run to statistical significance (Play Console tells you when reached)
- [ ] If winner: apply, then start next experiment
- [ ] If no winner by day 28: stop, try a different variable

**Never run two experiments on the same variable simultaneously** — results become uninterpretable.

**Never change other variables during an experiment** — same reason.

---

## Expected cumulative lift

If each experiment delivers its hypothesized lift:

| Experiment | Lift | Cumulative |
|---|---|---|
| Title V4 | +15% | +15% |
| Short desc V2 | +10% | +26.5% |
| Feature graphic challenger | +5% | +32.8% |
| Screenshot order | +10% | +46.1% |
| Full description V2 | +5% | +53.4% |

Realistic expectation: 25-40% lift by end of month 3 post-launch.

---

## When NOT to run experiments

- Installs < 500/day (too little traffic for significance)
- During a press coverage spike (skewed traffic invalidates test)
- In the week of a new release (mixed signals)

If you're below 500 installs/day, focus on acquisition (Reddit, SEO, TikTok) first. Store optimization matters at volume.
