/**
 * Vet-confirmed story submissions — write-only API to the Supabase
 * `vet_confirmed_stories` table (audit 2026-05-16 marketing-attribution
 * story-collection spec).
 *
 * Flow:
 *   1. User completes outcome-check with `vet_visited === 'yes'`
 *   2. `outcome-check.tsx` fires `scan_outcome_vet_confirmed` analytics
 *   3. If `shouldShowTestimonialPrompt()` returns true, the testimonial
 *      bottom-sheet modal opens
 *   4. On submit → `submitVetConfirmedStory()` inserts to Supabase
 *   5. On submit OR dismiss → `markTestimonialPrompted()` sets a 90-day
 *      cool-off so we don't nag the same user
 *
 * Privacy:
 *   - Story content is INSERT-only; the app cannot read it back. The
 *     admin reads via service-role SQL.
 *   - `permission_level` controls how the story may be used externally.
 *     'private' = internal only; 'anonymous_quote' / 'first_name' = OK
 *     to publish with that limit; 'contact_me' = reach out first.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UrgencyTier } from '../ai/triage';
import { supabase } from './supabase';

/** AsyncStorage key for the 90-day testimonial cool-off. */
const TESTIMONIAL_COOLOFF_KEY = '@catmd/testimonial_prompt_cooloff_until';
const COOLOFF_DAYS = 90;

export type StoryPermissionLevel =
  | 'private'
  | 'anonymous_quote'
  | 'first_name'
  | 'contact_me';

export type VetConfirmedStorySubmission = {
  cat_id: string;
  scan_id: string | null;
  original_urgency_tier: UrgencyTier;
  health_score: number;
  catmd_flagged: string;
  owner_observed: string;
  vet_confirmed: string;
  outcome: string;
  permission_level: StoryPermissionLevel;
  /** Required if permission_level === 'contact_me'; otherwise null. */
  contact_email: string | null;
};

/**
 * Should we prompt this user for a testimonial right now?
 *
 * Returns false if the user is inside the 90-day cool-off (either
 * because they already submitted a story, or because they explicitly
 * dismissed the prompt). Defaults to TRUE (prompt) on first call ever
 * — the gating only kicks in after we've successfully marked them.
 */
export async function shouldShowTestimonialPrompt(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TESTIMONIAL_COOLOFF_KEY);
    if (!raw) return true;
    const cooloffUntilMs = Number.parseInt(raw, 10);
    if (!Number.isFinite(cooloffUntilMs)) return true;
    return Date.now() >= cooloffUntilMs;
  } catch {
    // AsyncStorage failure → safer to prompt than to silently swallow.
    return true;
  }
}

/**
 * Mark the user as prompted. Skips the testimonial prompt for the
 * next 90 days regardless of whether they submitted or dismissed.
 *
 * Called from both the submit-success path and the explicit-dismiss
 * path. Idempotent.
 */
export async function markTestimonialPrompted(): Promise<void> {
  try {
    const until = Date.now() + COOLOFF_DAYS * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(TESTIMONIAL_COOLOFF_KEY, String(until));
  } catch {
    // best-effort
  }
}

/**
 * Insert a vet-confirmed story to Supabase. Resolves to { ok: true }
 * on success or { ok: false, reason } on failure. Never throws.
 *
 * Requires an authenticated Supabase session (anonymous-auth is fine
 * for CatMD; the RLS policy gates on auth.uid()).
 */
export async function submitVetConfirmedStory(
  submission: VetConfirmedStorySubmission,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        ok: false,
        reason: userError?.message ?? 'no authenticated user',
      };
    }

    const { error: insertError } = await supabase
      .from('vet_confirmed_stories')
      .insert({
        user_id: user.id,
        cat_id: submission.cat_id,
        scan_id: submission.scan_id,
        original_urgency_tier: submission.original_urgency_tier,
        health_score: submission.health_score,
        catmd_flagged: submission.catmd_flagged.trim(),
        owner_observed: submission.owner_observed.trim(),
        vet_confirmed: submission.vet_confirmed.trim(),
        outcome: submission.outcome.trim(),
        permission_level: submission.permission_level,
        contact_email:
          submission.permission_level === 'contact_me'
            ? submission.contact_email?.trim() || null
            : null,
        // marketing_status defaults to 'pending' server-side
        // press_pitch_candidate defaults to false server-side
      });

    if (insertError) {
      return { ok: false, reason: insertError.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'unknown error',
    };
  }
}
