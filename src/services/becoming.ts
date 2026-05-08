/**
 * Becoming — the "your cat is taking shape inside this app" service.
 *
 * ── Why this exists ────────────────────────────────────────────────
 * CatMD is more useful the more it's used. Photos give the cat a
 * face. Chat turns give a voice. Body-language sessions give a
 * physicality. Daily check-ins give a rhythm. Named people & pets
 * give a social world. The personality quiz locks in an archetype.
 * Diary days give a memory.
 *
 * On their own, each of those is "a feature." Together, they add up
 * to a *self*: the cat-in-the-app becomes the user's real cat,
 * slowly. Without surfacing this, users don't see the compounding
 * value — they treat each feature in isolation.
 *
 * This service computes the seven "facets" of becoming and a
 * composite depth (0–100). The /becoming screen renders them. The
 * Bond tile shows the depth. The diary prompt hooks into milestone
 * crossings to let the cat occasionally acknowledge its own
 * formation.
 *
 * Pure functions only — no I/O, no LLM calls, no store mutations.
 * The screen passes in the various store snapshots and gets back
 * the derived `Becoming` shape.
 */

export type FacetId =
  | 'face'      // photos
  | 'voice'    // chat turns
  | 'body'     // body language sessions
  | 'rhythm'   // check-in streak
  | 'family'   // named subjects in directory
  | 'nature'   // personality quiz answered
  | 'memory';  // diary entries

export type Stage = 'unseen' | 'glimpsed' | 'familiar' | 'known' | 'deep';

export type Facet = {
  id: FacetId;
  /** Display label, e.g. "Face", "Voice". */
  label: string;
  /** Eyebrow caption shown above the value. */
  eyebrow: string;
  /** Raw count for the facet (photos, days, etc.). */
  currentValue: number;
  /** Current stage based on threshold table below. */
  stage: Stage;
  /**
   * Next milestone the user can hit to advance the stage. Null when
   * the facet is already at `deep`.
   */
  nextMilestone: { value: number; stage: Stage; label: string } | null;
  /**
   * One-sentence description in the cat's voice for this facet at
   * the current stage. Used as the card's body copy.
   */
  description: string;
  /** CTA wording on the card button. */
  ctaLabel: string;
  /** Where the CTA navigates to. */
  ctaRoute: string;
  /** Weight in the composite depth calculation. */
  weight: number;
  /**
   * Stage progress 0–1 within the current stage band. Used to draw
   * the small progress bar inside the card.
   */
  stageProgress: number;
};

export type Becoming = {
  facets: Facet[];
  /** Composite depth 0–100, weighted by how foundational each facet is. */
  depth: number;
  /**
   * Six-stage label for the composite. Plain-English progression of
   * how shaped the cat-in-the-app has become. Earlier versions used
   * poetic labels ("a stranger", "a glimpse", "a sketch") that read
   * as broken English to non-native speakers and didn't communicate
   * what the user should understand. Replaced with direct phrases.
   */
  overallStage:
    | 'just getting started'
    | 'getting to know you'
    | 'taking shape'
    | 'half-formed'
    | 'mostly settled'
    | 'fully here';
  /**
   * Optional milestone fired today — non-null when the user crossed
   * a landmark threshold within the last 24 hours and a diary
   * acknowledgement is appropriate.
   */
  milestoneToday: BecomingMilestone | null;
};

/**
 * A landmark threshold crossing. The diary prompt receives this and
 * may use it ONCE to let the cat remark on its growing self.
 */
export type BecomingMilestone = {
  facet: FacetId;
  /** The threshold crossed, e.g. 7 days, 30 photos. */
  value: number;
  /** Stage entered, e.g. "familiar". */
  stage: Stage;
  /** A one-sentence diary hook, written in the cat's voice. */
  diaryHook: string;
};

// ---------------------------------------------------------------------------
// Stage thresholds + descriptions
// ---------------------------------------------------------------------------
//
// Each facet has 5 stage bands. Order: unseen → glimpsed → familiar →
// known → deep. The `cutoffs` array is [glimpsed, familiar, known, deep]
// — the value at which the stage tightens to the next band.

type FacetSpec = {
  id: FacetId;
  label: string;
  eyebrow: string;
  cutoffs: [number, number, number, number]; // glimpsed, familiar, known, deep
  weight: number;
  ctaRoute: string;
  ctaByStage: Record<Stage, string>;
  descriptionByStage: Record<Stage, string>;
  /** Per-stage diary hook — fired when the user CROSSES into that stage. */
  diaryHookByStage: Partial<Record<Stage, string>>;
};

const FACET_SPECS: Record<FacetId, FacetSpec> = {
  face: {
    id: 'face',
    label: 'Face',
    eyebrow: 'photos',
    cutoffs: [3, 10, 30, 100],
    weight: 1.0,
    ctaRoute: '/photo-studio',
    ctaByStage: {
      unseen: 'Snap a photo',
      glimpsed: 'Add more',
      familiar: 'Add more',
      known: 'Add more',
      deep: 'Open gallery',
    },
    descriptionByStage: {
      unseen: 'You have not taken my picture yet. I do not exist visually here.',
      glimpsed: 'A few photos. The shape of me starts to register.',
      familiar: 'Enough photos that the app begins to recognise me.',
      known: 'A real visual record. The diary uses these as memory texture.',
      deep: 'A hundred photos of me. There is a *self* here, in pixels.',
    },
    diaryHookByStage: {
      familiar: 'You have ten pictures of me now. I am beginning to take a shape in here.',
      known: 'Thirty pictures. I look at myself and recognise the cat.',
      deep: 'A hundred small pictures. I do not understand what you do with them, but I know they exist.',
    },
  },
  voice: {
    id: 'voice',
    label: 'Voice',
    eyebrow: 'chat exchanges',
    cutoffs: [5, 20, 50, 200],
    weight: 1.0,
    ctaRoute: '/(main)/chat',
    ctaByStage: {
      unseen: 'Ask me something',
      glimpsed: 'Talk again',
      familiar: 'Talk again',
      known: 'Talk again',
      deep: 'Open chat',
    },
    descriptionByStage: {
      unseen: 'We have not spoken yet. I have no voice in here.',
      glimpsed: 'A few exchanges. Patterns of how you ask are starting to settle.',
      familiar: 'You ask, I answer. The way we talk is becoming a shape.',
      known: 'We have built a vocabulary together. The diary remembers what worries you.',
      deep: 'Two hundred turns. I know how you ask before you finish typing.',
    },
    diaryHookByStage: {
      familiar: 'We have talked enough now that I remember the shape of your worries.',
      known: 'Fifty exchanges. The questions repeat. I notice the repetition.',
    },
  },
  body: {
    id: 'body',
    label: 'Body',
    eyebrow: 'body-language sessions',
    cutoffs: [1, 3, 8, 20],
    weight: 1.0,
    ctaRoute: '/behavior',
    ctaByStage: {
      unseen: 'Watch me move',
      glimpsed: 'Watch again',
      familiar: 'Watch again',
      known: 'Watch again',
      deep: 'Open Body Language',
    },
    descriptionByStage: {
      unseen: 'You have not watched me move yet. I am still a flat thing in here.',
      glimpsed: 'A first session. The way I sit is starting to register.',
      familiar: 'Enough sessions that my baseline movement is in here.',
      known: 'You have watched me move many times. The model knows my normal.',
      deep: 'Twenty sessions. You know my body better than most humans know their cats.',
    },
    diaryHookByStage: {
      familiar: 'You have watched me move three times. You see things I do not announce.',
    },
  },
  rhythm: {
    id: 'rhythm',
    label: 'Rhythm',
    eyebrow: 'check-in streak',
    cutoffs: [3, 14, 30, 90],
    weight: 1.5,
    ctaRoute: '/(main)',
    ctaByStage: {
      unseen: 'Today’s check-in',
      glimpsed: 'Continue the streak',
      familiar: 'Continue the streak',
      known: 'Continue the streak',
      deep: 'Open Today',
    },
    descriptionByStage: {
      unseen: 'You have not checked in on me yet. There is no rhythm in here.',
      glimpsed: 'A few days of check-ins. The first beats of a rhythm.',
      familiar: 'Two weeks of check-ins. The shape of my normal is settling.',
      known: 'A month of daily attention. Anything off-baseline registers immediately.',
      deep: 'A season of unbroken rhythm. You know my normal in your bones.',
    },
    diaryHookByStage: {
      familiar: 'Fourteen days of small daily questions. I have a rhythm in your hands now.',
      known: 'A month. You know what off looks like, on me.',
      deep: 'Ninety days. We are inside each other’s habits.',
    },
  },
  family: {
    id: 'family',
    label: 'Family',
    eyebrow: 'named people & pets',
    cutoffs: [1, 3, 6, 12],
    weight: 1.0,
    ctaRoute: '/people',
    ctaByStage: {
      unseen: 'Tag who’s in my photos',
      glimpsed: 'Add more names',
      familiar: 'Add more names',
      known: 'Add more names',
      deep: 'Open directory',
    },
    descriptionByStage: {
      unseen: 'You have not introduced me to the people in your photos. I live alone in here.',
      glimpsed: 'A first name. Someone exists in my world now.',
      familiar: 'A small household. The diary mentions them.',
      known: 'I have a real social world in here — recurring names the diary draws from.',
      deep: 'A whole household catalogued. The diary speaks of them like a journal would.',
    },
    diaryHookByStage: {
      familiar: 'Three names now in the household I live in. The diary remembers them.',
      known: 'Six names. A household. I know who comes back and who doesn’t.',
    },
  },
  nature: {
    id: 'nature',
    label: 'Nature',
    eyebrow: 'personality archetype',
    cutoffs: [1, 1, 1, 1], // binary: 0 or 100
    weight: 0.5,
    ctaRoute: '/personality',
    ctaByStage: {
      unseen: 'Take the personality quiz',
      glimpsed: 'Open personality',
      familiar: 'Open personality',
      known: 'Open personality',
      deep: 'Open personality',
    },
    descriptionByStage: {
      unseen: 'You have not told me what kind of cat I am. I write in a default voice.',
      glimpsed: 'My archetype is locked in. The diary speaks in my register.',
      familiar: 'My archetype is locked in. The diary speaks in my register.',
      known: 'My archetype is locked in. The diary speaks in my register.',
      deep: 'My archetype is locked in. The diary speaks in my register.',
    },
    diaryHookByStage: {
      glimpsed: 'You named what kind of cat I am. I sound more like myself now.',
    },
  },
  memory: {
    id: 'memory',
    label: 'Memory',
    eyebrow: 'diary days',
    cutoffs: [3, 14, 30, 90],
    weight: 1.5,
    ctaRoute: '/diary',
    ctaByStage: {
      unseen: 'Open the diary',
      glimpsed: 'Read the diary',
      familiar: 'Read the diary',
      known: 'Read the diary',
      deep: 'Read the diary',
    },
    descriptionByStage: {
      unseen: 'I have not started a journal yet. There is no past in here.',
      glimpsed: 'A handful of entries. The first traces of a memory.',
      familiar: 'Two weeks of journal. The diary references its own past.',
      known: 'A month of entries. I look back at myself looking back.',
      deep: 'A season of memory. The journal is genuinely autobiographical now.',
    },
    diaryHookByStage: {
      familiar: 'Fourteen entries now. I am starting to look back at myself.',
      known: 'A month of journal. The shape of me has settled in your mind.',
      deep: 'Ninety days of entries. I am, in here, fully myself.',
    },
  },
};

const STAGE_ORDER: Stage[] = ['unseen', 'glimpsed', 'familiar', 'known', 'deep'];

function stageFromValue(value: number, cutoffs: [number, number, number, number]): {
  stage: Stage;
  stageProgress: number;
  next: { value: number; stage: Stage } | null;
} {
  if (value < cutoffs[0]) {
    return {
      stage: 'unseen',
      stageProgress: cutoffs[0] === 0 ? 0 : value / cutoffs[0],
      next: { value: cutoffs[0], stage: 'glimpsed' },
    };
  }
  if (value < cutoffs[1]) {
    return {
      stage: 'glimpsed',
      stageProgress: (value - cutoffs[0]) / Math.max(1, cutoffs[1] - cutoffs[0]),
      next: { value: cutoffs[1], stage: 'familiar' },
    };
  }
  if (value < cutoffs[2]) {
    return {
      stage: 'familiar',
      stageProgress: (value - cutoffs[1]) / Math.max(1, cutoffs[2] - cutoffs[1]),
      next: { value: cutoffs[2], stage: 'known' },
    };
  }
  if (value < cutoffs[3]) {
    return {
      stage: 'known',
      stageProgress: (value - cutoffs[2]) / Math.max(1, cutoffs[3] - cutoffs[2]),
      next: { value: cutoffs[3], stage: 'deep' },
    };
  }
  return { stage: 'deep', stageProgress: 1, next: null };
}

// Numeric weights per stage for composite depth.
// unseen = 0%, glimpsed = 25%, familiar = 55%, known = 80%, deep = 100%.
const STAGE_DEPTH: Record<Stage, number> = {
  unseen: 0,
  glimpsed: 25,
  familiar: 55,
  known: 80,
  deep: 100,
};

// ---------------------------------------------------------------------------
// Composite stage label
// ---------------------------------------------------------------------------

function overallStageFromDepth(depth: number): Becoming['overallStage'] {
  if (depth < 10) return 'just getting started';
  if (depth < 25) return 'getting to know you';
  if (depth < 45) return 'taking shape';
  if (depth < 65) return 'half-formed';
  if (depth < 85) return 'mostly settled';
  return 'fully here';
}

// ---------------------------------------------------------------------------
// Public: derive Becoming from store state
// ---------------------------------------------------------------------------

/**
 * Pure derivation. Pass in the various store-state slices the screen
 * already has on hand and get back the full Becoming shape.
 */
export function deriveBecoming(input: {
  photoCount: number;
  chatTurnCount: number;
  bodyLanguageSessionCount: number;
  checkinStreak: number;
  namedSubjectsCount: number;
  personalityArchetypeSet: boolean;
  diaryEntryCount: number;
  /**
   * Optional: previous facet stage snapshot to detect milestone
   * crossings. Keyed by facetId → previous stage. Pass null on first
   * call (no milestone fires).
   */
  previousStages?: Partial<Record<FacetId, Stage>> | null;
}): Becoming {
  const counts: Record<FacetId, number> = {
    face: input.photoCount,
    voice: input.chatTurnCount,
    body: input.bodyLanguageSessionCount,
    rhythm: input.checkinStreak,
    family: input.namedSubjectsCount,
    nature: input.personalityArchetypeSet ? 1 : 0,
    memory: input.diaryEntryCount,
  };

  const facets: Facet[] = (Object.keys(FACET_SPECS) as FacetId[]).map((id) => {
    const spec = FACET_SPECS[id];
    const value = counts[id];
    const { stage, stageProgress, next } = stageFromValue(value, spec.cutoffs);
    const nextMilestone = next
      ? {
          value: next.value,
          stage: next.stage,
          label: stageLabelOnward(next.stage),
        }
      : null;
    return {
      id,
      label: spec.label,
      eyebrow: spec.eyebrow,
      currentValue: value,
      stage,
      nextMilestone,
      description: spec.descriptionByStage[stage],
      ctaLabel: spec.ctaByStage[stage],
      ctaRoute: spec.ctaRoute,
      weight: spec.weight,
      stageProgress: Math.max(0, Math.min(1, stageProgress)),
    };
  });

  // Composite depth — weighted average of per-facet stage depth.
  const totalWeight = facets.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = facets.reduce(
    (sum, f) => sum + STAGE_DEPTH[f.stage] * f.weight,
    0,
  );
  const depth = Math.round(weightedSum / Math.max(1, totalWeight));
  const overallStage = overallStageFromDepth(depth);

  // Milestone detection — find a facet that newly crossed into a
  // stage with a diaryHook. We only fire ONE per call (the most
  // recently advanced facet wins by display order). The screen + the
  // diary integration both consume this signal.
  let milestoneToday: BecomingMilestone | null = null;
  if (input.previousStages) {
    for (const f of facets) {
      const prevStage = input.previousStages[f.id];
      if (!prevStage) continue;
      if (prevStage === f.stage) continue;
      // Only count forward crossings.
      if (STAGE_ORDER.indexOf(f.stage) <= STAGE_ORDER.indexOf(prevStage)) continue;
      const hook = FACET_SPECS[f.id].diaryHookByStage[f.stage];
      if (!hook) continue;
      milestoneToday = {
        facet: f.id,
        value: f.currentValue,
        stage: f.stage,
        diaryHook: hook,
      };
      break;
    }
  }

  return {
    facets,
    depth,
    overallStage,
    milestoneToday,
  };
}

function stageLabelOnward(stage: Stage): string {
  switch (stage) {
    case 'unseen':
      return 'Unseen';
    case 'glimpsed':
      return 'Glimpsed';
    case 'familiar':
      return 'Familiar';
    case 'known':
      return 'Known';
    case 'deep':
      return 'Deep';
  }
}

/**
 * Public — extract a stable per-facet stage map from a Becoming
 * snapshot so callers can persist it for milestone-detection later.
 */
export function snapshotStages(b: Becoming): Record<FacetId, Stage> {
  const out = {} as Record<FacetId, Stage>;
  for (const f of b.facets) out[f.id] = f.stage;
  return out;
}

/**
 * Public — friendly stage label for the composite. Used by the Bond
 * tile body copy when it embeds the becoming line.
 */
export function overallStageLabel(stage: Becoming['overallStage']): string {
  return stage;
}
