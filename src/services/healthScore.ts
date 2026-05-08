/**
 * Adjusted health score — makes the home-screen number RESPONSIVE to
 * daily check-ins, instead of frozen at scan time.
 *
 * Why this exists: a scan establishes a baseline ("here's what we found
 * on day N"). Subjective check-ins between scans give us a directional
 * signal — is the cat trending better or worse? An app that shows
 * "See Vet Soon" three days after the user reported "Happy + Full bowl"
 * feels broken. An app that nudges the score toward recovery, but never
 * fully clears the alert without a fresh scan, feels intelligent.
 *
 * Hard medical rule (do not weaken without vet review):
 *   • Check-ins can move the score WITHIN a tier band.
 *   • Check-ins can cross AT MOST one tier boundary upward (e.g. concern → monitor).
 *   • Check-ins NEVER take the score from concern/urgent all the way to routine
 *     without a fresh scan. Subjective wellness ≠ medical wellness.
 *   • If the scan was hard-urgency (Layer-1 keyword emergency), check-ins
 *     do NOT lower the urgency at all. Only a new scan can clear that.
 */
import type { ScanRecord } from '../state/scanStore';
import type { HealthEvent, DailyCheckinPayload } from '../state/healthStore';
import { tierFromScore, type UrgencyTier } from '../theme/tokens';

/** Per-check-in score modifiers. */
const MODIFIER_BY_PROFILE: Record<string, number> = {
  // Best-case — clear improvement signal
  'happy:full': +5,
  // Strong but not perfect
  'happy:half': +3,
  'normal:full': +3,
  // Mixed
  'normal:half': +1,
  'happy:none': -2,    // happy mood but didn't eat — anorexia is concerning
  // Neutral / no change
  'normal:none': -3,   // no appetite is always concerning
  // Negative
  'off:full': -3,      // off mood but eating — moderate concern
  'off:half': -6,
  'off:none': -10,     // worst case — both signals red
};

const MAX_POSITIVE_DRIFT = 20; // how much check-ins can lift the score above baseline
const MAX_NEGATIVE_DRIFT = 20; // how much check-ins can drop the score below baseline
const NEUTRAL_BASELINE = 75;   // score we drift toward when no check-ins for >24h
const DECAY_PER_DAY = 5;       // how fast the score drifts toward NEUTRAL_BASELINE

export type ScoreSource =
  | 'no_scan'
  | 'scan_only'
  | 'scan_plus_checkins'
  | 'stale_scan';

export type AdjustedScore = {
  /** Score to display (post-modifier). */
  score: number;
  /** Tier matching the displayed score. */
  tier: UrgencyTier;
  /** Original scan score for reference. */
  baselineScore: number;
  /** Original scan tier. */
  baselineTier: UrgencyTier;
  /** Net delta applied (positive = improvement). */
  delta: number;
  /** Did the tier change vs the scan baseline? */
  tierChanged: boolean;
  /** Number of check-ins counted in the modifier. */
  checkinsApplied: number;
  /** Provenance — useful for UI microcopy. */
  source: ScoreSource;
  /** Microcopy summarising the adjustment, if any. */
  copy: string | null;
  /** Should the home screen suggest a fresh scan? */
  suggestRescan: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function modifierFor(payload: DailyCheckinPayload): number {
  const key = `${payload.mood}:${payload.appetite}`;
  return MODIFIER_BY_PROFILE[key] ?? 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Cap a raw target score so the tier doesn't jump more than one band upward
 * from the baseline. e.g. concern (41-60) can rise to monitor (61-80) but
 * not to routine (81-100) — that requires a fresh scan.
 */
function capTierAdvancement(
  raw: number,
  baselineTier: UrgencyTier,
): number {
  switch (baselineTier) {
    case 'urgent':
      // Hard floor: cannot advance past concern (60) without a new scan.
      return Math.min(raw, 60);
    case 'concern':
      // Cannot advance past monitor (80).
      return Math.min(raw, 80);
    case 'monitor':
    case 'routine':
      // No upward cap (already in safe territory).
      return raw;
  }
}

/**
 * Compute the live, check-in-aware health score for a cat.
 *
 * @param scan       Most recent scan for the cat (or null if no scan).
 * @param checkins   ALL daily-checkin events for the cat (any order; we
 *                   filter to ones that occurred after the scan).
 * @param now        Current timestamp (injectable for tests).
 */
export function computeAdjustedScore(
  scan: ScanRecord | null,
  checkins: HealthEvent<'daily_checkin'>[],
  now: number = Date.now(),
): AdjustedScore {
  // No scan → empty state. Home screen shows EmptyScoreRing anyway.
  if (!scan) {
    return {
      score: 0,
      tier: 'routine',
      baselineScore: 0,
      baselineTier: 'routine',
      delta: 0,
      tierChanged: false,
      checkinsApplied: 0,
      source: 'no_scan',
      copy: null,
      suggestRescan: false,
    };
  }

  const scanTime = new Date(scan.created_at).getTime();
  const ageDays = (now - scanTime) / DAY_MS;
  // Defensive: scan.score should always be 0-100 from the model, but a
  // malformed cloud-sync record could in theory smuggle in something
  // weird. Clamp at the door so downstream math stays sane.
  const baselineScore = clamp(Math.round(scan.score), 0, 100);
  const baselineTier = scan.urgency;

  // Stale scan (> 30 days). Home screen already handles the stale banner;
  // we still return the baseline so the UI can decide what to show.
  if (ageDays > 30) {
    return {
      score: baselineScore,
      tier: baselineTier,
      baselineScore,
      baselineTier,
      delta: 0,
      tierChanged: false,
      checkinsApplied: 0,
      source: 'stale_scan',
      copy: null,
      suggestRescan: true,
    };
  }

  // Hard-urgency scans (Layer-1 keyword emergency) cannot be softened by
  // check-ins. Only a fresh scan can clear that flag.
  // Why: emergency cases like lily ingestion can present as "fine" for
  // hours before kidney failure manifests. Letting subjective wellness
  // lower the urgency here is potentially fatal.
  if (scan.hard_urgency) {
    // Count post-scan check-ins for the UX, even though they don't move
    // the score. We want to ack the user did the check-in, AND explain
    // why the alert is locked.
    const postScanCheckins = checkins.filter(
      (e) => new Date(e.ts).getTime() > scanTime,
    );
    const copy =
      postScanCheckins.length > 0
        ? 'Score is locked because this scan flagged a critical signal (e.g. toxic ingestion, severe trauma). Check-ins are saved but cannot clear an emergency alert. Run a fresh scan once you’re ready to re-evaluate.'
        : null;
    return {
      score: baselineScore,
      tier: baselineTier,
      baselineScore,
      baselineTier,
      delta: 0,
      tierChanged: false,
      checkinsApplied: postScanCheckins.length,
      source: 'scan_only',
      copy,
      suggestRescan: postScanCheckins.length > 0, // strongly prompt for rescan when locked
    };
  }

  // Filter to check-ins AFTER the scan (only post-scan signals are evidence
  // of recovery/decline). Sorted oldest → newest so we apply chronologically.
  const eligible = checkins
    .filter((e) => new Date(e.ts).getTime() > scanTime)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  let modifierSum = 0;
  for (const e of eligible) {
    modifierSum += modifierFor(e.payload);
  }

  // Apply the cap so check-ins can't fully override the medical baseline.
  const cappedModifier = clamp(modifierSum, -MAX_NEGATIVE_DRIFT, MAX_POSITIVE_DRIFT);

  // Daily decay toward neutral baseline (75) when no recent check-in.
  // This stops a single great check-in 5 days ago from pinning a high score.
  let decay = 0;
  if (eligible.length > 0) {
    const lastCheckin = eligible[eligible.length - 1];
    const lastTime = new Date(lastCheckin.ts).getTime();
    const daysSinceLast = (now - lastTime) / DAY_MS;
    if (daysSinceLast > 1) {
      // Drift fractionally toward NEUTRAL_BASELINE. The further from neutral
      // we are, the more we drift back. Capped at the modifier we earned.
      const driftMagnitude = Math.min(
        Math.floor(daysSinceLast - 1) * DECAY_PER_DAY,
        Math.abs(cappedModifier),
      );
      decay = cappedModifier > 0 ? -driftMagnitude : +driftMagnitude;
    }
  }

  const netModifier = cappedModifier + decay;

  // Apply modifier to baseline, then clamp tier advancement.
  let target = baselineScore + netModifier;
  target = capTierAdvancement(target, baselineTier);
  // CRITICAL: hard-clamp to [0, 100] AFTER everything else. This is the
  // last line of defence — score MUST stay in the valid range no matter
  // what modifiers, decay, or tier caps fire above. The ScoreRing UI
  // explodes silently on out-of-range values.
  target = clamp(Math.round(target), 0, 100);

  const newTier = tierFromScore(target);
  const delta = target - baselineScore;
  const tierChanged = newTier !== baselineTier;

  // Suggest a re-scan when:
  //   - Two or more positive check-ins have stacked up (cat seems to be recovering).
  //   - OR the scan is more than 5 days old AND the user is still in concern/urgent.
  //   - OR check-ins are getting worse (negative modifier means decline).
  const positiveCheckins = eligible.filter((e) => modifierFor(e.payload) > 0).length;
  const suggestRescan =
    positiveCheckins >= 2 ||
    (ageDays > 5 && (baselineTier === 'concern' || baselineTier === 'urgent')) ||
    netModifier <= -10;

  let copy: string | null = null;
  if (eligible.length === 0) {
    // No check-ins yet — score is purely the scan baseline.
    return {
      score: baselineScore,
      tier: baselineTier,
      baselineScore,
      baselineTier,
      delta: 0,
      tierChanged: false,
      checkinsApplied: 0,
      source: 'scan_only',
      copy: null,
      suggestRescan: suggestRescan && false, // no recheck without checkins data
    };
  }

  if (delta > 0 && tierChanged) {
    copy = `Cat seems to be recovering — moved out of "${baselineTier}" tier based on ${eligible.length} check-in${eligible.length === 1 ? '' : 's'}.`;
  } else if (delta > 0) {
    copy = `Cat seems to be improving (+${delta} from check-ins).`;
  } else if (delta < 0 && tierChanged) {
    copy = `Cat may be declining — score dropped into "${newTier}" tier. Run a fresh scan.`;
  } else if (delta < 0) {
    copy = `Slight decline (${delta} from check-ins). Worth keeping a closer eye.`;
  } else {
    copy = `Score holding steady — ${eligible.length} check-in${eligible.length === 1 ? '' : 's'} consistent with scan baseline.`;
  }

  return {
    score: target,
    tier: newTier,
    baselineScore,
    baselineTier,
    delta,
    tierChanged,
    checkinsApplied: eligible.length,
    source: 'scan_plus_checkins',
    copy,
    suggestRescan,
  };
}

/**
 * Lightweight test-mode export — exposes the modifier table so a smoke
 * script can assert the contract without re-implementing the lookup.
 */
export const __test__ = {
  MODIFIER_BY_PROFILE,
  MAX_POSITIVE_DRIFT,
  MAX_NEGATIVE_DRIFT,
  NEUTRAL_BASELINE,
  DECAY_PER_DAY,
};
