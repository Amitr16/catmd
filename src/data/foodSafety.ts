/**
 * Cat safety lookup dataset — food, plants, drugs, household hazards.
 *
 * Sources: ASPCA Animal Poison Control, Pet Poison Helpline, AAFP guidance,
 * FDA animal health advisories, and the in-app Knowledge Cards. Paraphrased
 * for brevity; every entry links back to one of the same-domain Knowledge
 * Card topics so we can deep-link to citations later.
 *
 * Legal note: this is informational only. Any "toxic" / "caution" verdict
 * surfaces a strong call-to-action to contact a vet or the APCC hotline.
 * We never tell the user an item is "safe enough that you can skip a call"
 * when an ingestion amount is unknown.
 */

export type SafetyVerdict = 'safe' | 'caution' | 'toxic';
export type SafetyCategory = 'food' | 'plant' | 'drug' | 'household';

export type SafetyItem = {
  name: string;
  category: SafetyCategory;
  verdict: SafetyVerdict;
  why: string;
  signs?: string[];       // if toxic/caution
  what_to_do: string;
  aliases?: string[];     // alternate spellings / common names
};

// Keep alphabetized within category for scannability.
export const SAFETY_DB: SafetyItem[] = [
  // ── FOOD ────────────────────────────────────────────────────────────────
  {
    name: 'Acetaminophen (Tylenol)',
    aliases: ['paracetamol', 'tylenol', 'apap'],
    category: 'drug',
    verdict: 'toxic',
    why:
      'Even a single regular-strength tablet can be fatal to cats. Cats lack the liver enzyme (UDP-glucuronyl transferase) needed to metabolize it, causing methemoglobinemia (blood can\u2019t carry oxygen) and fatal liver damage.',
    signs: [
      'Brownish/muddy gums or tongue (low oxygen)',
      'Rapid breathing or open-mouth breathing',
      'Swollen face or paws',
      'Vomiting, lethargy, collapse',
    ],
    what_to_do:
      'Emergency. Go to the nearest vet immediately — minutes matter. Call ASPCA APCC (888-426-4435) en route.',
  },
  {
    name: 'Alcohol',
    aliases: ['beer', 'wine', 'liquor', 'ethanol'],
    category: 'food',
    verdict: 'toxic',
    why:
      'Cats are extremely sensitive. Even small amounts cause central-nervous-system depression, metabolic acidosis, and low blood sugar.',
    signs: ['Wobbly walking', 'Vomiting', 'Low body temperature', 'Collapse'],
    what_to_do: 'Call your vet or APCC immediately. Do not induce vomiting without direction.',
  },
  {
    name: 'Aloe vera',
    category: 'plant',
    verdict: 'toxic',
    why:
      'The latex/sap contains saponins and anthraquinones that irritate the GI tract and can cause electrolyte imbalance.',
    signs: ['Vomiting', 'Diarrhea', 'Lethargy', 'Tremors'],
    what_to_do: 'Call vet or APCC. Bring a leaf sample if possible.',
  },
  {
    name: 'Amaryllis',
    category: 'plant',
    verdict: 'toxic',
    why: 'Contains lycorine and other alkaloids; the bulb is the most toxic part.',
    signs: ['Drooling', 'Vomiting', 'Tremors', 'Low blood pressure'],
    what_to_do: 'Call vet. Remove from environment.',
  },
  {
    name: 'Antifreeze (ethylene glycol)',
    aliases: ['coolant', 'ethylene glycol'],
    category: 'household',
    verdict: 'toxic',
    why:
      'Sweet taste tempts cats; metabolized into calcium oxalate crystals that destroy the kidneys. Often fatal if treatment is delayed more than 3 hours.',
    signs: [
      'Wobbly, drunken walk (early)',
      'Excessive thirst / urination',
      'Vomiting, no urine later',
    ],
    what_to_do:
      'Emergency. Treatment is only effective within hours of ingestion. Go to the ER right now.',
  },
  {
    name: 'Aspirin',
    aliases: ['acetylsalicylic acid', 'asa'],
    category: 'drug',
    verdict: 'toxic',
    why:
      'Cats metabolize salicylates very slowly. Over-the-counter doses cause GI ulcers, liver damage, and bone-marrow suppression.',
    signs: ['Vomiting (sometimes bloody)', 'Rapid breathing', 'Loss of appetite'],
    what_to_do: 'Call vet or APCC before giving any human analgesic.',
  },
  {
    name: 'Azalea',
    aliases: ['rhododendron'],
    category: 'plant',
    verdict: 'toxic',
    why: 'Grayanotoxins disrupt sodium channels in nerve and heart cells.',
    signs: ['Drooling', 'Vomiting', 'Weakness', 'Low heart rate', 'Collapse'],
    what_to_do: 'Emergency. Bring a leaf/flower sample.',
  },
  {
    name: 'Banana',
    category: 'food',
    verdict: 'safe',
    why:
      'Non-toxic in small amounts. High in sugar though — a nibble is fine, but shouldn\u2019t be a regular treat.',
    what_to_do: 'Offer only a small piece occasionally; no need to call a vet.',
  },
  {
    name: 'Blueberries',
    category: 'food',
    verdict: 'safe',
    why: 'Non-toxic and a reasonable occasional treat. Most cats ignore them.',
    what_to_do: 'No action needed.',
  },
  {
    name: 'Bread (plain, baked)',
    category: 'food',
    verdict: 'caution',
    why:
      'Plain baked bread in tiny amounts is usually fine, but raw yeast dough is dangerous (it rises in the stomach and produces alcohol). Bread offers no feline nutrition.',
    signs: ['For raw dough: bloating, vomiting, wobbly gait'],
    what_to_do:
      'Plain toasted bread → no action. Raw dough → call vet immediately, this is an emergency.',
  },
  {
    name: 'Caffeine (coffee, tea, energy drinks)',
    aliases: ['coffee', 'espresso', 'tea', 'energy drink'],
    category: 'food',
    verdict: 'toxic',
    why:
      'Methylxanthines stimulate the nervous system and heart. Even a few tablespoons of strong coffee or a lick of an energy drink can cause toxicity.',
    signs: ['Restlessness', 'Rapid breathing', 'Muscle tremors', 'Racing heart'],
    what_to_do: 'Call vet or APCC immediately.',
  },
  {
    name: 'Carrot (cooked)',
    category: 'food',
    verdict: 'safe',
    why: 'Non-toxic. A small piece of plain steamed carrot is fine.',
    what_to_do: 'No action needed.',
  },
  {
    name: 'Cat grass (oat or wheat grass)',
    category: 'plant',
    verdict: 'safe',
    why: 'Specifically cultivated to be safe for cats to chew.',
    what_to_do: 'Safe — no action needed.',
  },
  {
    name: 'Catnip',
    category: 'plant',
    verdict: 'safe',
    why:
      'Non-toxic. Contains nepetalactone, which triggers a short euphoric response in about 2/3 of cats.',
    what_to_do: 'Safe in normal amounts. Large quantities may cause mild GI upset.',
  },
  {
    name: 'Chicken (cooked, plain)',
    category: 'food',
    verdict: 'safe',
    why: 'Plain boiled or grilled chicken with no seasoning, bones, or skin is a common bland-diet protein.',
    what_to_do: 'Safe. Remove bones.',
  },
  {
    name: 'Chocolate',
    aliases: ['cocoa', 'dark chocolate', 'milk chocolate', 'white chocolate'],
    category: 'food',
    verdict: 'toxic',
    why:
      'Theobromine + caffeine. Dark and baking chocolate are the most dangerous; white chocolate has less theobromine but still fat-load risk.',
    signs: ['Vomiting', 'Restlessness', 'Rapid heart rate', 'Tremors', 'Seizures'],
    what_to_do:
      'Call APCC (888-426-4435) with the type (dark/milk), cat weight, and amount eaten.',
  },
  {
    name: 'Chrysanthemum',
    aliases: ['mum'],
    category: 'plant',
    verdict: 'toxic',
    why: 'Pyrethrins irritate GI tract and can cause neurological signs.',
    signs: ['Vomiting', 'Drooling', 'Incoordination'],
    what_to_do: 'Call vet if you suspect ingestion.',
  },
  {
    name: 'Cucumber',
    category: 'food',
    verdict: 'safe',
    why: 'Non-toxic. Most cats are startled by them rather than attracted.',
    what_to_do: 'No action needed.',
  },
  {
    name: 'Daffodil',
    aliases: ['narcissus', 'jonquil'],
    category: 'plant',
    verdict: 'toxic',
    why: 'Lycorine and other alkaloids; the bulb is the most dangerous part.',
    signs: ['Vomiting', 'Drooling', 'Drop in blood pressure', 'Tremors'],
    what_to_do: 'Call vet — potentially serious.',
  },
  {
    name: 'Dairy (milk, cheese)',
    aliases: ['milk', 'cheese', 'cream'],
    category: 'food',
    verdict: 'caution',
    why:
      'Most adult cats are lactose-intolerant. Not toxic, but dairy often causes GI upset.',
    signs: ['Loose stool', 'Vomiting', 'Gas'],
    what_to_do: 'Usually self-resolves in 24h. Offer water and bland food.',
  },
  {
    name: 'Egg (cooked, plain)',
    category: 'food',
    verdict: 'safe',
    why: 'Plain scrambled or boiled egg is a common bland-diet protein.',
    what_to_do: 'Safe.',
  },
  {
    name: 'Egg (raw)',
    category: 'food',
    verdict: 'caution',
    why:
      'Raw whites contain avidin, which blocks biotin absorption; raw eggs may also carry salmonella.',
    what_to_do: 'If ingested once, monitor. Avoid as a routine part of diet.',
  },
  {
    name: 'English ivy',
    aliases: ['hedera helix'],
    category: 'plant',
    verdict: 'toxic',
    why: 'Triterpenoid saponins irritate the GI tract and skin.',
    signs: ['Vomiting', 'Drooling', 'Abdominal pain'],
    what_to_do: 'Call vet if ingestion is significant.',
  },
  {
    name: 'Essential oils (tea tree, citrus, eucalyptus, pine, peppermint)',
    aliases: ['tea tree oil', 'melaleuca', 'eucalyptus', 'citrus oil', 'peppermint oil'],
    category: 'household',
    verdict: 'toxic',
    why:
      'Cats lack hepatic glucuronidation — most concentrated essential oils cause neurologic and hepatic toxicity, whether ingested, applied to skin, or even diffused in enclosed spaces.',
    signs: ['Drooling', 'Wobbly walk', 'Low body temperature', 'Tremors', 'Liver failure'],
    what_to_do:
      'Move cat to fresh air. Do NOT bathe with water alone (oil spreads). Call vet or APCC.',
  },
  {
    name: 'Garlic',
    category: 'food',
    verdict: 'toxic',
    why:
      'Contains thiosulfates (like onion) that destroy red blood cells. Even more potent per gram than onion.',
    signs: ['Pale gums', 'Lethargy', 'Dark urine', 'Rapid breathing'],
    what_to_do: 'Call vet — blood work may be needed.',
  },
  {
    name: 'Grapes / raisins',
    aliases: ['grape', 'raisin', 'sultana', 'currant'],
    category: 'food',
    verdict: 'toxic',
    why:
      'Mechanism still being studied (possibly tartaric acid). Causes sudden kidney failure in some dogs; evidence in cats is weaker but current guidance is to treat as toxic.',
    signs: ['Vomiting', 'Not eating', 'Reduced urination'],
    what_to_do: 'Call vet promptly. Do not wait to see symptoms.',
  },
  {
    name: 'Holly',
    category: 'plant',
    verdict: 'toxic',
    why: 'Saponins and methylxanthines cause GI upset; spiny leaves can injure mouth and paws.',
    signs: ['Vomiting', 'Drooling', 'Head shaking'],
    what_to_do: 'Call vet if significant ingestion.',
  },
  {
    name: 'Ibuprofen',
    aliases: ['advil', 'motrin', 'nurofen'],
    category: 'drug',
    verdict: 'toxic',
    why: 'NSAIDs cause GI ulcers and acute kidney failure in cats at human OTC doses.',
    signs: ['Vomiting (sometimes bloody)', 'Not eating', 'Lethargy', 'Reduced urine'],
    what_to_do: 'Call APCC or vet immediately.',
  },
  {
    name: 'Lily',
    aliases: ['easter lily', 'tiger lily', 'asiatic lily', 'stargazer lily', 'daylily', 'lilium', 'hemerocallis'],
    category: 'plant',
    verdict: 'toxic',
    why:
      'True lilies (Lilium) and daylilies (Hemerocallis) cause acute kidney failure from a tiny exposure — nibbling a leaf, drinking vase water, or licking pollen off fur.',
    signs: ['Vomiting', 'Lethargy', 'No urine after 24-48h'],
    what_to_do:
      'EMERGENCY. Go to the vet immediately — treatment must start within 18 hours to be effective. Remove all lilies from the home.',
  },
  {
    name: 'Macadamia nuts',
    category: 'food',
    verdict: 'caution',
    why:
      'Clear toxicity in dogs; data in cats is thin but current advice is to avoid.',
    signs: ['Weakness', 'Vomiting', 'Tremors'],
    what_to_do: 'Call APCC if ingested.',
  },
  {
    name: 'Mistletoe',
    category: 'plant',
    verdict: 'toxic',
    why: 'American mistletoe causes GI upset; European variant can cause cardiovascular collapse.',
    signs: ['Vomiting', 'Drooling', 'Difficulty breathing', 'Slow heart rate'],
    what_to_do: 'Call vet or APCC.',
  },
  {
    name: 'Oleander',
    category: 'plant',
    verdict: 'toxic',
    why: 'Contains cardiac glycosides similar to digoxin — can cause fatal arrhythmias.',
    signs: ['Vomiting', 'Slow or irregular heart rate', 'Tremors', 'Collapse'],
    what_to_do: 'Emergency — go to the vet now.',
  },
  {
    name: 'Onion',
    aliases: ['shallot', 'scallion', 'green onion', 'leek', 'chive'],
    category: 'food',
    verdict: 'toxic',
    why:
      'All alliums contain thiosulfates, which oxidize feline red blood cells and cause hemolytic anemia. Powdered forms (soup mixes, baby food seasoning) are especially dangerous.',
    signs: ['Pale gums', 'Lethargy', 'Dark orange/red urine', 'Rapid breathing'],
    what_to_do: 'Call vet — effects may appear 1-3 days later.',
  },
  {
    name: 'Peace lily',
    aliases: ['spathiphyllum'],
    category: 'plant',
    verdict: 'caution',
    why:
      'Not a true lily. Contains insoluble calcium oxalate crystals that cause oral irritation, but rarely kidney failure.',
    signs: ['Drooling', 'Pawing at mouth', 'Vomiting'],
    what_to_do: 'Rinse mouth with water. Call vet if signs persist.',
  },
  {
    name: 'Philodendron',
    category: 'plant',
    verdict: 'toxic',
    why: 'Calcium oxalate crystals cause severe oral and throat irritation.',
    signs: ['Drooling', 'Pawing at mouth', 'Difficulty swallowing', 'Vomiting'],
    what_to_do: 'Rinse mouth. Call vet.',
  },
  {
    name: 'Poinsettia',
    category: 'plant',
    verdict: 'caution',
    why: 'Reputation is worse than reality. Latex causes mild mouth and GI irritation.',
    signs: ['Mild drooling', 'Vomiting'],
    what_to_do: 'Usually self-resolves. Call vet if cat stops eating.',
  },
  {
    name: 'Pothos',
    aliases: ['devil\u2019s ivy', 'epipremnum'],
    category: 'plant',
    verdict: 'toxic',
    why: 'Calcium oxalate crystals — same mechanism as philodendron.',
    signs: ['Drooling', 'Mouth irritation', 'Vomiting'],
    what_to_do: 'Rinse mouth, call vet.',
  },
  {
    name: 'Pumpkin (plain canned)',
    category: 'food',
    verdict: 'safe',
    why: 'Often used to help with mild constipation or diarrhea (1 tsp of plain, not pie filling).',
    what_to_do: 'Safe in small amounts.',
  },
  {
    name: 'Rice (plain, cooked)',
    category: 'food',
    verdict: 'safe',
    why: 'Common bland-diet component for upset GI.',
    what_to_do: 'Safe.',
  },
  {
    name: 'Rodenticide (rat/mouse poison)',
    aliases: ['rat poison', 'warfarin', 'bromethalin', 'cholecalciferol'],
    category: 'household',
    verdict: 'toxic',
    why:
      'Multiple active ingredients, each with different (often severe) effects: internal bleeding, brain swelling, or kidney failure. Also toxic if the cat eats a poisoned rodent.',
    signs: ['Bleeding from gums', 'Bruising', 'Weakness', 'Seizures', 'Vomiting'],
    what_to_do:
      'EMERGENCY. Bring the product packaging to the vet — the active ingredient determines treatment.',
  },
  {
    name: 'Sago palm',
    aliases: ['cycas revoluta'],
    category: 'plant',
    verdict: 'toxic',
    why:
      'Cycasin causes severe liver failure. Seeds (nuts) are the most toxic part. Often fatal even with treatment.',
    signs: ['Vomiting (often bloody)', 'Lethargy', 'Jaundice', 'Seizures'],
    what_to_do: 'Emergency — go to the vet immediately.',
  },
  {
    name: 'Spider plant',
    aliases: ['chlorophytum'],
    category: 'plant',
    verdict: 'safe',
    why: 'Non-toxic. Mild hallucinogenic effect reported in some cats (like catnip).',
    what_to_do: 'Safe.',
  },
  {
    name: 'Tulip',
    category: 'plant',
    verdict: 'toxic',
    why: 'Tulipalin A and B; the bulb is the most dangerous part.',
    signs: ['Drooling', 'Vomiting', 'Depression'],
    what_to_do: 'Call vet.',
  },
  {
    name: 'Tuna (human canned, as a meal)',
    category: 'food',
    verdict: 'caution',
    why:
      'Plain chunk-light tuna in water is fine as an occasional treat, but should never be the main diet — lacks taurine, vitamin E, and can concentrate heavy metals (mercury).',
    what_to_do: 'Treat as occasional, not a staple. No action needed unless vomiting.',
  },
  {
    name: 'Watermelon (seedless, no rind)',
    category: 'food',
    verdict: 'safe',
    why: 'Flesh is non-toxic. Seeds and rind can cause GI upset.',
    what_to_do: 'No action needed.',
  },
  {
    name: 'Xylitol',
    aliases: ['sugar-free gum', 'sugar substitute', 'birch sugar'],
    category: 'food',
    verdict: 'toxic',
    why:
      'Well-documented severe toxicity in dogs (hypoglycemia and liver failure). Evidence in cats is emerging; current guidance is to avoid and treat as toxic.',
    signs: ['Weakness', 'Vomiting', 'Tremors', 'Collapse'],
    what_to_do: 'Call APCC (888-426-4435) immediately.',
  },
  {
    name: 'Yeast dough (raw)',
    aliases: ['bread dough', 'pizza dough'],
    category: 'food',
    verdict: 'toxic',
    why: 'Dough rises in the stomach, ferments into alcohol, and can cause painful bloat.',
    signs: ['Distended abdomen', 'Retching', 'Wobbly gait', 'Collapse'],
    what_to_do: 'Emergency — go to the vet immediately.',
  },
];

/**
 * Normalize query for simple substring search: lowercase, strip punctuation,
 * collapse whitespace.
 */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function searchSafety(query: string, limit = 12): SafetyItem[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const hits: { item: SafetyItem; score: number }[] = [];
  for (const item of SAFETY_DB) {
    const haystacks = [
      item.name.toLowerCase(),
      ...(item.aliases ?? []).map((a) => a.toLowerCase()),
    ];
    let best = 0;
    for (const h of haystacks) {
      if (h === q) { best = Math.max(best, 100); continue; }
      if (h.startsWith(q)) { best = Math.max(best, 80); continue; }
      if (h.includes(q)) { best = Math.max(best, 50); continue; }
      // token-level fallback
      const tokens = h.split(' ');
      for (const tok of tokens) {
        if (tok === q) best = Math.max(best, 70);
        else if (tok.startsWith(q)) best = Math.max(best, 40);
      }
    }
    if (best > 0) hits.push({ item, score: best });
  }
  hits.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return hits.slice(0, limit).map((h) => h.item);
}
