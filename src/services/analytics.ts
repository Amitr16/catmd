/**
 * PostHog analytics — thin singleton wrapper around posthog-react-native.
 *
 * Goals:
 *   - Fire-and-forget from call sites: `track('scan_submitted', {...})`.
 *   - Graceful no-op when analytics is disabled via env, when the key is
 *     missing, or when the SDK fails to load (Expo Go fallback).
 *   - Consistent event naming via a typed event map so we can't accidentally
 *     typo an event name and silently lose funnel data.
 *   - identify() when the user confirms an email (anonymous → known) so
 *     session events get joined to the same person profile in PostHog.
 *
 * Privacy: the key is EXPO_PUBLIC_ so it's visible in the APK, which is
 * expected for PostHog. Anonymous users get a random distinct_id the SDK
 * persists on-device. No PII is attached unless we explicitly pass it.
 */
import type PostHogType from 'posthog-react-native';

const ENABLED =
  (process.env.EXPO_PUBLIC_ENABLE_ANALYTICS ?? 'false').toLowerCase() === 'true';
const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// ── Typed event map ────────────────────────────────────────────────────────
// Keep the left side stable; rename properties freely, adding new ones as
// optional fields. PostHog allows arbitrary props, but listing them here
// gives autocomplete + stops typos like `scan_submited`.

/**
 * LLM activity tags — the feature that triggered the model call.
 * Closed enum so PostHog cardinality stays bounded and dashboards can
 * group cleanly. Add a new entry here when wiring a new LLM call site;
 * the type is consumed both client-side (track helpers) and proxy-side
 * (the worker reads it from the X-CatMD-Activity header).
 */
export type LLMActivity =
  | 'chat'                    // Chat tab conversation
  | 'scan_triage'             // Triage main triage call (vet-grade reasoning)
  | 'scan_classify'           // Triage scan-mode pre-classifier
  | 'pain_score'              // Feline Grimace Scale pain analysis
  | 'postcard_caption'        // Postcard caption generation
  | 'diary_generation'        // Cat Diary nightly write
  | 'body_language_vision'    // Body Language video frames
  | 'body_language_audio'     // Body Language audio (Whisper)
  | 'identity_match'          // Multi-cat photo identity vision
  | 'cat_studio_poster'       // gpt-image-1 movie-poster gen
  | 'embedding_rag'           // Single-shot text-embedding-3-small for RAG
  | 'subject_detection'       // Vision: count people/pets in a photo for tagging
  | 'subject_summary'         // Text: lazy summarise a directory entry's "vibe"
  | 'self_facts_extraction'   // Text: pull "you love tuna" facts out of chat turns
  | 'weekly_human_reading'    // Text: weekly Co-Star-style "the cat reads YOU" line
  | 'world_extraction'        // Vision: extract objects/places/environment from a photo (silent world memory)
  | 'embedding_fact_score';  // Embedding: per-fact relevance ranking for chat fact pinning (flagged-on alt to keyword scorer)

/**
 * Pricing snapshot in USD per 1M tokens (chat/embed) or per call/minute
 * (image / audio). Updated 2026-05-03 against the OpenAI public price
 * sheet. All values are upper bounds — better to OVER-estimate cost in
 * dashboards than under-estimate and surprise ourselves at billing time.
 *
 * Image gen prices vary by size + quality; we use the medium-quality
 * 1024x1536 (vertical poster) value as the canonical estimate since
 * that's what Cat Studio defaults to. Real cost comes from the OpenAI
 * dashboard — these are for trend / outlier detection.
 */
const LLM_PRICE_TABLE: Record<string, {
  input_per_1m?: number;
  output_per_1m?: number;
  per_image?: number;
  per_minute?: number;
}> = {
  'gpt-4o-mini':              { input_per_1m: 0.15, output_per_1m: 0.60 },
  'gpt-4o':                   { input_per_1m: 2.50, output_per_1m: 10.00 },
  'gpt-4o-2024-08-06':        { input_per_1m: 2.50, output_per_1m: 10.00 },
  'text-embedding-3-small':   { input_per_1m: 0.02 },
  'gpt-image-1':              { per_image: 0.10 },
  'whisper-1':                { per_minute: 0.006 },
};

/**
 * Compute estimated cost in USD cents for a model call. Returns a
 * 4-decimal-rounded number so PostHog can aggregate without losing
 * precision on small token counts. Unknown models fall back to 0 —
 * better to under-report a new model than mis-attribute it.
 */
export function estimateLLMCostCents(args: {
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  image_count?: number;
  audio_seconds?: number;
}): number {
  const p = LLM_PRICE_TABLE[args.model];
  if (!p) return 0;
  let usd = 0;
  if (p.input_per_1m && args.prompt_tokens) {
    usd += (args.prompt_tokens / 1_000_000) * p.input_per_1m;
  }
  if (p.output_per_1m && args.completion_tokens) {
    usd += (args.completion_tokens / 1_000_000) * p.output_per_1m;
  }
  if (p.per_image && args.image_count) {
    usd += args.image_count * p.per_image;
  }
  if (p.per_minute && args.audio_seconds) {
    usd += (args.audio_seconds / 60) * p.per_minute;
  }
  // Round to 4 decimals of cents — sub-cent precision matters when a
  // single chat call costs ~$0.0001 and the dashboard sums thousands.
  return Math.round(usd * 100 * 10000) / 10000;
}

export type AnalyticsEvent =
  | { type: 'app_opened'; props?: Record<string, unknown> }
  | { type: 'onboarding_completed'; props?: { seconds_spent?: number } }
  | {
      type: 'scan_submitted';
      props: {
        has_photo: boolean;
        text_length: number;
        mode: 'general' | 'litter_box';
      };
    }
  | {
      type: 'scan_classified';
      props: { kind: string; mode_selected: 'general' | 'litter_box' };
    }
  | {
      type: 'scan_result';
      props: {
        urgency: 'routine' | 'monitor' | 'concern' | 'urgent';
        score: number;
        confidence: 'high' | 'moderate' | 'low';
        had_red_flags: boolean;
        hard_urgency: boolean;
      };
    }
  | { type: 'scan_blocked_by_quota'; props?: Record<string, unknown> }
  | { type: 'scan_blocked_by_email_gate'; props?: Record<string, unknown> }
  | {
      type: 'scan_rejected_irrelevant_photo';
      props: { kind: string; reason: string };
    }
  | {
      type: 'behavior_rejected_no_cat';
      props: { reason: string };
    }
  // ── Read [cat] (behavior observation) success funnel ─────────────
  | {
      type: 'behavior_observation_started';
      props?: { source?: 'camera' | 'library' };
    }
  | {
      type: 'behavior_observation_completed';
      props: {
        frame_count: number;
        had_audio: boolean;
        tag_count: number;
        // Top 3 tags from the result, comma-joined. Keeps cardinality
        // low for PostHog while still showing which interpretive states
        // dominate the corpus (confident / playful / fearful etc.).
        top_tags: string;
        observation_length: number;
      };
    }
  | {
      type: 'behavior_observation_failed';
      props: { reason: string };
    }
  // Past-readings history screen opened. Drives the "are users
  // returning to old readings" metric — useful for the bond pillar
  // since rereading the cat's history is a re-engagement loop, not a
  // first-time use one. Source distinguishes which entry point
  // brought them here.
  | {
      type: 'behavior_history_opened';
      props: {
        reading_count: number;
        source: 'mode_picker' | 'done_stage' | 'direct';
      };
    }
  // User edited (or first-added) a note on a past reading. Counts of
  // this event over `behavior_observation_completed` show how often
  // users come back to annotate their readings — high rate would
  // suggest annotation-as-a-feature is real value, low rate would
  // tell us notes are over-engineered.
  | {
      type: 'behavior_note_saved';
      props: {
        is_first_note: boolean;
        note_length: number;
      };
    }
  // User deleted a past reading from the history screen. The cat
  // loses access to it for chat recall, personality, etc. We track
  // for the "are people pruning" signal (low expected — most
  // readings likely stay forever).
  | {
      type: 'behavior_observation_deleted';
      props?: Record<string, unknown>;
    }
  // ── Personality milestone ───────────────────────────────────────
  | {
      type: 'personality_archetype_revealed';
      props: {
        archetype: string;            // first stable archetype assigned
        days_to_reveal: number | null; // approx days from quiz to reveal
      };
    }
  // ── Birthday surface ────────────────────────────────────────────
  | {
      type: 'birthday_screen_opened';
      props: { is_pro: boolean; album_size: number };
    }
  | {
      type: 'birthday_album_paywall_tapped';
      props?: Record<string, unknown>;
    }
  // ── Notification category preference ────────────────────────────
  | {
      type: 'notification_category_toggled';
      props: { category: string; enabled: boolean };
    }
  // ── Cat Studio (Bond pillar) ────────────────────────────────────
  // 2026-05-03 expansion: events now carry `theme` alongside `genre`
  // so PostHog can break down generations / costs by 6 high-level
  // themes (Movie posters, Historical figures, Famous paintings,
  // Studio Ghibli scenes, Pixar characters, 80s anime) without
  // having to map 48 genre IDs in PostHog formulas.
  | {
      type: 'cat_studio_opened';
      props: {
        has_history: boolean;
        /** Theme of the current week's rotation (visible to user). */
        this_week_theme?: string;
        /** Theme of next week — shown as anticipation teaser. */
        next_week_theme?: string;
        /** Stable week index from rotation epoch — useful for cohort analysis. */
        week_index?: number;
      };
    }
  | {
      type: 'cat_studio_genre_selected';
      props: { genre: string; theme?: string };
    }
  | {
      type: 'cat_studio_generation_started';
      props: { genre: string; theme?: string };
    }
  | {
      type: 'cat_studio_poster_generated';
      props: {
        genre: string;
        theme?: string;
        had_reference_photo: boolean;
      };
    }
  | {
      type: 'cat_studio_generation_failed';
      props: { genre: string; theme?: string; reason: string };
    }
  // User attempted to delete a poster generated this week. Blocked
  // — current-week posters are locked to prevent the per-variant
  // weekly cap from being trivially bypassed (generate → delete →
  // re-generate). Tracking lets us see how often users hit the
  // guard so we know if the messaging is clear enough.
  | {
      type: 'cat_studio_delete_blocked_current_week';
      props: { genre: string };
    }
  | {
      // Fired when the safety-retry path in generatePoster kicks in:
      // the FIRST gpt-image-1 call returned a 400 / safety / content-
      // policy error and we automatically retried with a sanitised
      // prompt. `retry_succeeded` tells us if the second attempt
      // landed; tracking both flavours lets us measure the false-
      // positive rate of OpenAI's image-gen safety moderator and
      // calibrate which prompts need further softening.
      type: 'cat_studio_safety_retried';
      props: {
        genre: string;
        theme?: string;
        retry_succeeded: boolean;
        /** First-call error message, truncated. Useful for clustering. */
        first_error: string;
      };
    }
  | {
      type: 'cat_studio_poster_shared';
      props: { genre: string; theme?: string };
    }
  | {
      // Sunday-10am weekly auto-poster job — distinct from the manual
      // cat_studio_poster_generated above so we can measure the
      // notification → tap → fresh-poster funnel separately.
      type: 'cat_studio_weekly_auto_generated';
      props: {
        genre: string;
        had_reference_photo: boolean;
        /** Comma-joined list of last-3 genres we excluded. Empty if none. */
        recent_genres_skipped: string;
      };
    }
  | {
      type: 'cat_studio_weekly_auto_failed';
      props: { reason: string };
    }
  // ── Photo Studio (Bond pillar — daily-photo log + time-lapse) ───
  | {
      type: 'photo_studio_opened';
      props: { photo_count: number; has_today: boolean };
    }
  | {
      type: 'photo_studio_photo_added';
      props: {
        source: 'camera' | 'gallery';
        /** True if this overwrote an existing photo for the same date. */
        replaced_existing: boolean;
        /** Total photos in the cat's log AFTER the add. */
        total_after: number;
      };
    }
  | {
      type: 'photo_studio_photo_deleted';
      props: { total_after: number };
    }
  | {
      type: 'photo_studio_month_played';
      props: { month_key: string; photo_count: number };
    }
  | {
      type: 'photo_studio_photo_shared';
      props: Record<string, never>;
    }
  // ── Identity matching (multi-cat household handling) ─────────────
  | {
      type: 'identity_match_run';
      props: {
        had_profile: boolean;
        /** Where the check fired from. Helps debug which surface flows. */
        surface: 'photo_studio_add' | 'body_language' | 'manual';
      };
    }
  | {
      type: 'identity_match_failed';
      props: { reason: string };
    }
  | {
      type: 'identity_match_target_not_found';
      props: {
        /** Free-form short reason — "cats_in_frame_2", "auto_bootstrap_set_profile", etc. */
        reason: string;
      };
    }
  | {
      type: 'identity_match_user_confirmed';
      props: { confidence_at_confirm: number };
    }
  | {
      type: 'identity_match_user_denied';
      props: { confidence_at_deny: number };
    }
  // ── Subject tagging (people & pets directory, added 2026-05-04) ──
  | {
      type: 'subject_detection_run';
      props: {
        people: number;
        pets: number;
        had_subjects: boolean;
      };
    }
  | {
      type: 'subject_tagged';
      props: {
        kind: 'person' | 'pet' | 'other';
        /** True if this was the FIRST time this name was added (new directory entry). */
        new_directory_entry: boolean;
        /** Where the user picked the subject from. */
        source: 'autocomplete' | 'free_text' | 'detected_chip';
        /** Cat-scoped directory size after this tag landed. */
        directory_size_after: number;
      };
    }
  | {
      type: 'subject_untagged';
      props: { kind: 'person' | 'pet' | 'other' };
    }
  // Identity-bug prevention — user attempted to tag the active cat
  // themselves as a subject in their own photo. Blocked at input
  // because it pollutes the directory and breaks first-person voice
  // in chat + diary prompts ("Even Lily, the other creature of the
  // household..."). Counts of this event tell us whether the
  // explainer alert is enough or whether the autocomplete chip for
  // the active cat needs to be hidden upstream too.
  | {
      type: 'subject_tag_blocked_self';
      props: { source: 'autocomplete' | 'free_text' | 'detected_chip' | 'auto_match' };
    }
  | {
      type: 'subject_directory_opened';
      props: { directory_size: number };
    }
  | {
      type: 'subject_vibe_summarised';
      props: { appearances_at_summary: number };
    }
  // ── Becoming: ego-building meter (added 2026-05-04) ─────────────
  | {
      type: 'becoming_opened';
      props: {
        depth: number;
        overall_stage: string;
      };
    }
  | {
      type: 'becoming_facet_cta_tapped';
      props: { facet: string; stage: string };
    }
  | {
      type: 'becoming_milestone_hit';
      props: { facet: string; stage: string; value: number };
    }
  // ── Postcard trending-audio suggestions (cron-refreshed weekly) ─
  | {
      type: 'postcard_audio_suggestion_shown';
      props: {
        mood_word: string;
        count: number;
        /** Whether the user is online with a fresh worker payload, or on cached/bundled fallback. */
        source: 'fresh' | 'cached' | 'bundled';
      };
    }
  | {
      type: 'postcard_audio_suggestion_copied';
      props: {
        mood_word: string;
        track_title: string;
        platform: 'tiktok' | 'instagram';
      };
    }
  | {
      type: 'postcard_audio_fetch_failed';
      props: { reason: string };
    }
  | {
      type: 'postcard_audio_listen_tapped';
      props: {
        track_title: string;
        mood_word: string;
      };
    }
  // ── Health Rhythm (Today tab — 30-day pattern surface) ──────────
  | {
      type: 'health_rhythm_opened';
      props: {
        days_logged: number;
        streak_days: number;
        drift_count: number;
        has_concern: boolean;
      };
    }
  | {
      type: 'health_rhythm_drift_tapped';
      props: {
        kind: 'mood' | 'appetite' | 'weight' | 'streak' | 'scans' | 'srr';
        severity: 'concern' | 'watch' | 'good';
      };
    }
  // ── Postcard (Bond pillar — social-share surface) ───────────────
  | {
      type: 'postcard_opened';
      props: { had_today_cached: boolean };
    }
  | {
      type: 'postcard_generated';
      props: {
        photo_count: number;
        had_archetype: boolean;
        forced_regenerate: boolean;
      };
    }
  | {
      type: 'postcard_generation_failed';
      props: { reason: string };
    }
  | {
      type: 'postcard_caption_edited';
      props: { char_diff: number };
    }
  | {
      type: 'postcard_format_changed';
      props: { format: 'square' | 'story' };
    }
  | {
      type: 'postcard_shared';
      props: {
        format: 'square' | 'story';
        caption_was_edited: boolean;
        photo_count: number;
      };
    }
  | {
      type: 'postcard_share_failed';
      props: { reason: string };
    }
  | { type: 'email_added'; props: { disposable_rejected?: boolean } }
  | { type: 'email_confirmed'; props?: Record<string, unknown> }
  | { type: 'email_resent'; props?: Record<string, unknown> }
  | {
      type: 'paywall_viewed';
      props: {
        source: 'scan_quota' | 'settings' | 'cats' | 'diary_archive' | 'birthday_album';
      };
    }
  | {
      type: 'paywall_converted';
      props: { period: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' };
    }
  | { type: 'cat_added'; props: { cat_count_after: number } }
  | {
      type: 'health_event_logged';
      props: { type: string };          // e.g. 'vaccination', 'weight'
    }
  | {
      type: 'outcome_checkin_answered';
      props: {
        direction: 'better' | 'same' | 'worse';
        helpful_rating: number | null;
      };
    }
  | {
      type: 'daily_checkin_opened';
      props?: Record<string, unknown>;
    }
  | {
      type: 'daily_checkin_completed';
      props: {
        mood: 'happy' | 'normal' | 'off';
        appetite: 'full' | 'half' | 'none';
        streak_after: number;
        had_notes: boolean;
      };
    }
  | {
      type: 'referral_shared';
      props: { surface: 'settings' | 'paywall' | 'onboarding' };
    }
  | {
      type: 'scan_shared_pdf';
      props?: Record<string, unknown>;
    }
  // ── Personality Profile (Bond pillar) ────────────────────────────
  | {
      type: 'personality_quiz_started';
      props?: {
        skipped_initial?: boolean;
        /**
         * True when the user is retaking the quiz from the "Retake the
         * quiz" button on the existing-profile view. Lets us measure
         * how often users re-do the quiz vs first-time intake.
         */
        retake?: boolean;
      };
    }
  | {
      type: 'personality_quiz_completed';
      props: {
        skipped: boolean;            // true if user took the "show what we have" exit
        question_count: number;      // 4 in v1
      };
    }
  | {
      type: 'personality_profile_viewed';
      props: {
        archetype: string | null;        // null when not enough data yet
        confidence_band: 'low' | 'building' | 'stable';
        confidence_pct: number;          // 0-100
        had_breed_prior: boolean;
        had_quiz: boolean;
        checkin_count: number;
        behavior_obs_count: number;
      };
    }
  | {
      type: 'personality_profile_refreshed';
      props?: Record<string, unknown>;
    }
  // ── Cat Diary (Bond pillar) ──────────────────────────────────────
  | {
      type: 'diary_opened';
      props: { had_today_cached: boolean };
    }
  | {
      type: 'diary_entry_generated';
      props: {
        // 2026-05-04 conscious-cat refactor: schema simplified. The
        // detailed occasion markers are now derivable in PostHog from
        // the underlying llm_usage events; what we surface here is
        // the headline shape of the entry.
        is_empty_day?: boolean;        // true → 1-2 sentence melancholic vignette
        had_photo?: boolean;
        forced_rewrite?: boolean;       // user-tapped Rewrite vs auto on open
        referenced_past_date?: string | null;
        // ── Legacy fields (kept optional for existing analytics queries) ──
        is_birthday?: boolean;
        is_adoption_iversary?: boolean;
        streak_milestone?: number | null;
        recent_emergency_scan?: boolean;
        special_day?: string | null;
        had_archetype?: boolean;
      };
    }
  | {
      // Fires after `backfillMissingEntries` writes one or more
      // entries on app boot (filling the gap from when the user was
      // away). Counts let us measure the "coming-back-after-absence"
      // shape — how many days were missed, how many of those produced
      // melancholic-empty entries vs populated ones.
      type: 'diary_backfill_completed';
      props: {
        days_written: number;
        empty_days: number;
        populated_days: number;
      };
    }
  | {
      type: 'diary_entry_generation_failed';
      props: { reason?: string; forced_rewrite?: boolean };
    }
  | {
      type: 'diary_entry_rewrote';
      props?: Record<string, unknown>;
    }
  | {
      type: 'diary_entry_shared';
      props: {
        is_today: boolean;                   // false = sharing an archive entry
      };
    }
  | {
      type: 'diary_share_failed';
      props?: { reason?: string };
    }
  | {
      type: 'diary_reminder_scheduled';
      props?: { changed: boolean };          // true if cancel-then-reschedule (e.g. cat renamed)
    }
  // ── Chat tab (AI cat companion) ──────────────────────────────────
  | {
      type: 'chat_opened';
      props: { had_history: boolean };
    }
  | {
      type: 'chat_message_sent';
      props: { length: number; used_suggested_prompt: boolean };
    }
  | {
      type: 'chat_message_received';
      props?: Record<string, unknown>;
    }
  | {
      type: 'chat_message_failed';
      props: { reason?: string };
    }
  | {
      type: 'chat_cleared';
      props?: Record<string, unknown>;
    }
  | {
      type: 'chat_action_tapped';
      props: { action: 'open_triage' | 'call_vet' };
    }
  // Voice scrubber fired — surface-level soft-opener stripping
  // happened post-LLM, pre-ship. Counts of this event over total
  // `chat_message_received` measure how often the model slips and
  // how much work the belt-and-suspenders layer is doing.
  | {
      type: 'chat_voice_scrubbed';
      props: {
        unsalvageable: boolean;
        hits: string;
      };
    }
  // One-shot voice retry — the scrubbed reply was unsalvageable so
  // we re-prompted the model with a stricter directive.
  // `recovered: true` means the retry produced a shippable reply.
  | {
      type: 'chat_voice_retried';
      props: { recovered: boolean };
    }
  // Fact-retrieval picked the relevant memory items for THIS turn —
  // the heuristic that pins the top 5-7 facts at the end of the
  // chat system prompt. `tiers` is a CSV of which memory tiers fed
  // the picks (medical, subject, diary, anticipation, mood_arc,
  // life_event, self_fact, today). Lets us see in PostHog whether
  // the algorithm over/under-weights any tier in production.
  | {
      type: 'chat_relevant_facts_picked';
      props: {
        count: number;
        tiers: string;
        /** Which ranker chose these facts. Lets us A/B in PostHog. */
        scorer?: 'keyword' | 'embedding';
      };
    }
  // Field-update gateway — chat as bidirectional structured-data API.
  // The cat-voice chat now also acts as the "tell me about your cat"
  // surface for profile updates: when the user is explicit ("Lily
  // weighs 4.5kg") the model emits [FIELD_UPDATE:...] markers, the
  // chat service validates + applies via patchCat / setMedReminder.
  // This event tracks both the model's emit rate and the validator's
  // reject rate (hedge_detected / not_in_user_message / out_of_range).
  // Use to diagnose if the model is hallucinating updates or the
  // validator is over-rejecting legit ones.
  | {
      type: 'chat_field_update_extracted';
      props: {
        total: number;
        applied: number;
        rejected: number;
        fields: string;          // CSV of field names (low-cardinality)
        reject_reasons: string;  // CSV of rejection reasons
      };
    }
  // Health-log event marker — chat as gateway to healthStore.addEvent.
  // Tracks vaccination / medication_dose / weight / appointment writes
  // initiated through chat. Applied vs rejected counts surface
  // hallucination rate; types CSV shows which event types are most-
  // mentioned by users in chat.
  | {
      type: 'chat_log_event_extracted';
      props: {
        total: number;
        applied: number;
        rejected: number;
        types: string;           // CSV of event types
      };
    }
  // World-Memory marker — chat as gateway to worldStore. Tracks
  // [LOG_OBJECT:...] markers fired when user mentions a real object/
  // place/toy. Applied vs rejected counts surface model hallucination
  // rate; kinds CSV shows which world categories users add via chat.
  | {
      type: 'chat_log_object_extracted';
      props: {
        total: number;
        applied: number;
        rejected: number;
        kinds: string;           // CSV of world kinds
      };
    }
  // World extraction — vision pass on a photo / video frame burst that
  // pulls objects, places, and environment markers out silently. Fires
  // for every analyzed source. `promoted` counts how many candidate
  // observations crossed the recurrence threshold and graduated to
  // real WorldEntries on this pass — the "user wonders how Lily knows"
  // moment metric.
  | {
      type: 'world_extraction_run';
      props: {
        source: 'photo' | 'behavior_observation' | 'backfill';
        objects_found: number;
        place_found: boolean;
        environment_found: boolean;
        promoted: number;
        /** Truncated reason on failure path. Empty string on success. */
        error?: string;
      };
    }
  // Fires the moment a candidate item recurs enough to graduate to a
  // visible WorldEntry. Per-graduation event so we can measure the
  // candidate → entry funnel and tune the recurrence threshold.
  | {
      type: 'world_entry_auto_promoted';
      props: {
        kind: string;
        observations_at_promotion: number;
      };
    }
  // World screen funnel — open + entry CRUD. Drives the "is the user
  // actually populating their cat's world" metric.
  | {
      type: 'world_screen_opened';
      props: { entry_count: number };
    }
  | {
      type: 'world_entry_added';
      props: { kind: string; has_sentiment: boolean };
    }
  | {
      type: 'world_entry_updated';
      props: { kind: string };
    }
  | {
      type: 'world_entry_removed';
      props: { kind: string };
    }
  // Weather opt-in funnel — tracks the user's decision on the world
  // screen's weather card. Granted vs denied (with soft_blocked
  // distinguishing "user said never" from "user dismissed once").
  | {
      type: 'world_weather_permission_granted';
      props: Record<string, never>;
    }
  | {
      type: 'world_weather_permission_denied';
      props: { soft_blocked: boolean };
    }
  // Anti-fixation guard fired — detected the cat had been over-using
  // a stock physical observation across recent turns (bowl, cup at
  // edge, etc.) and injected a course-correction directive into this
  // turn's system prompt to force variety. High firing rate = prompt
  // examples need further de-anchoring; near-zero firing = model is
  // already varying observations naturally.
  | {
      type: 'chat_object_fixation_detected';
      props: { objects: string };  // CSV of object labels detected
    }
  // Per-turn system-prompt size, broken down by major contributor.
  // Drives the "do we need a memory summarizer?" decision empirically:
  // if p95(total_tokens_est) sits comfortably below ~20k we have
  // headroom on gpt-4o-mini's 128k context and the recall problem is
  // about retrieval quality, not payload size. If it climbs into the
  // 30k+ range for power users (years of diary, 60 world entries,
  // many subjects), summarization becomes worth implementing.
  //
  // Token estimate uses chars/4 — a conservative approximation for
  // English text. Authoritative counts come from the OpenAI usage
  // object on the response (already captured in llm_usage), but this
  // event lets us slice by tier-counts without joining server logs.
  | {
      type: 'chat_prompt_size';
      props: {
        /** Total rendered system-prompt length in characters. */
        total_chars: number;
        /** Coarse token estimate (chars / 4). */
        total_tokens_est: number;
        /** Per-tier counts at render time (not chars — easier to slice). */
        diary_count: number;
        subject_count: number;
        world_count: number;
        self_fact_count: number;
        anticipation_count: number;
        life_event_count: number;
        recent_triage_count: number;
        /** RAG snippet block char length (0 when RAG returned nothing). */
        rag_chars: number;
        /** Pinned-facts header char length (0 when no facts picked). */
        pinned_facts_chars: number;
        /** True if anti-fixation directive was appended this turn. */
        had_anti_fixation: boolean;
      };
    }
  // ── Shareable cat cards (viral leverage) ─────────────────────────
  // The 1080×1920 vertical card export feature — users tap "Share"
  // anywhere a card is offered (chat reply, archetype reveal, diary
  // entry, becoming milestone). The funnel:
  //   share_card_initiated → share_card_completed (or _failed)
  // Per-surface share rate is the metric we tune the chat-as-viral
  // bet against (see marketing/chat-as-viral-lever.md).
  | {
      type: 'share_card_initiated';
      props: {
        kind: 'chat_reply' | 'archetype' | 'diary_entry' | 'becoming_milestone';
        surface: string;
        has_photo: boolean;
      };
    }
  | {
      type: 'share_card_completed';
      props: {
        kind: 'chat_reply' | 'archetype' | 'diary_entry' | 'becoming_milestone';
        surface: string;
      };
    }
  | {
      type: 'share_card_failed';
      props: {
        kind: 'chat_reply' | 'archetype' | 'diary_entry' | 'becoming_milestone';
        surface: string;
        reason: string;
      };
    }
  // Share caption + hashtags auto-copied to clipboard right before the
  // system share sheet opens. TikTok/IG don't honour the share-sheet
  // text payload, so this clipboard-prefill is the workaround. Every
  // caption includes #catmd. Tracking caption_length lets us confirm
  // the helper ran (vs failed silently and copied empty string).
  | {
      type: 'share_caption_copied';
      props: {
        kind: 'chat_reply' | 'archetype' | 'diary_entry' | 'becoming_milestone';
        surface: string;
        caption_length: number;
      };
    }
  // Cat-voice evening push armed — fires once per fresh diary entry.
  // Counts of this event over `diary_entry_generated` measure the
  // hit-rate of the heuristic 1-liner extractor.
  | {
      type: 'cat_voice_push_armed';
      props: { length: number };
    }
  // Daily-card screen opened — typically tapped from the cat-voice
  // evening push, or from the diary screen's "Today's card" link
  // added 2026-05-07 (the push isn't yet shipped, so the diary link
  // is the only in-app discovery path until then). Source attribution
  // lets us split the funnel cleanly: push vs diary vs direct.
  // Funnel: cat_voice_push_armed → daily_card_opened →
  // share_card_initiated{surface=daily_card} measures the path
  // from re-engagement push to viral content.
  | {
      type: 'daily_card_opened';
      props: {
        had_entry: boolean;
        had_headline: boolean;
        source?: 'push' | 'diary' | 'direct';
      };
    }
  // Weekly "she noticed" reading — the cat reads the human. One per
  // ISO week per cat. Generated lazily on /weekly-reading screen
  // open, or pre-generated by the Sunday push handler.
  | {
      type: 'weekly_reading_generated';
      props: {
        had_archetype: boolean;
        had_moods: boolean;
        had_signals: boolean;
        had_themes: boolean;
      };
    }
  | {
      type: 'weekly_reading_failed';
      props: { reason: string };
    }
  | {
      type: 'weekly_reading_opened';
      props: { had_cached: boolean };
    }
  | { type: 'forget_me'; props?: Record<string, unknown> }
  | { type: 'sign_out'; props?: Record<string, unknown> }
  // ── Cloud restore (post-reinstall recovery via email verification) ──
  // Fires when restoreFromCloudIfNeeded() pulls a non-empty payload from
  // Supabase and applies it to local stores. Useful for measuring how
  // often users actually go through the cross-device recovery path.
  | {
      type: 'cloud_restore_succeeded';
      props: {
        cats: number;
        scans: number;
        events: number;
      };
    }
  | {
      // Restore failed during the post-email-verify auto-pull. Captures
      // why so we can debug: is it a Supabase outage, a schema mismatch,
      // a network blip, etc. Counts of this event over total
      // email_confirmed events tell us the "broken restore" rate.
      type: 'cloud_restore_failed';
      props: {
        /** Truncated error message (≤ 200 chars). */
        reason: string;
      };
    }
  // Paywall email-gate funnel — anonymous user tapped Subscribe and got
  // routed to email verification first. Tracking this lets us measure
  // the drop-off introduced by the email-required architectural rule.
  | {
      type: 'paywall_email_gate_shown';
      props: { source: string };
    }
  // ── LLM token / cost tracking ──────────────────────────────────────
  // Fires once per AI call (chat/text/embed/whisper/image-gen).
  // PostHog dashboards aggregate by `distinct_id` for per-user spend
  // and by `activity` for per-feature spend. `cost_cents` is an
  // estimate computed client-side from a small price table — accurate
  // enough for "which user/feature is bleeding tokens" without
  // requiring a server-side cost reconciliation.
  | {
      type: 'llm_usage';
      props: {
        activity: LLMActivity;
        model: string;
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        /** For image-gen — count of images returned (usually 1). */
        image_count?: number;
        /** For Whisper — clip duration in seconds, used for cost calc. */
        audio_seconds?: number;
        /** Estimated cost in USD cents, rounded to 4 decimals. */
        cost_cents?: number;
        /** Wall-clock latency from request start to response parsed (ms). */
        latency_ms?: number;
        /** When tracked server-side from the proxy worker (Phase 2 image-gen path). */
        source?: 'client' | 'proxy';
      };
    };

// ── SDK load (lazy, no-op on failure) ──────────────────────────────────────

let instance: PostHogType | null = null;
let loadingPromise: Promise<PostHogType | null> | null = null;

function disabledReason(): string | null {
  if (!ENABLED) return 'analytics disabled by env';
  if (!API_KEY) return 'no POSTHOG_API_KEY';
  return null;
}

async function getClient(): Promise<PostHogType | null> {
  if (instance) return instance;
  const reason = disabledReason();
  if (reason) return null;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const mod = await import('posthog-react-native');
      const PostHog = (mod as any).default ?? mod;
      const ph = new PostHog(API_KEY, {
        host: HOST,
        // Flush sooner than the 20-event default so small sessions still
        // get their events shipped.
        flushAt: 5,
        flushInterval: 30_000,
        // Don't auto-capture app lifecycle / screens — we'll emit them
        // explicitly so what we ship matches the typed AnalyticsEvent map.
        captureAppLifecycleEvents: false,
      });
      instance = ph;
      return ph;
    } catch (e) {
      console.warn('[CatMD] posthog-react-native failed to load:', e);
      return null;
    }
  })();
  return loadingPromise;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record one event. Non-blocking — never throws, never awaits in the
 * caller's critical path.
 */
export function track(event: AnalyticsEvent): void {
  void (async () => {
    const ph = await getClient();
    if (!ph) return;
    try {
      const props = (event as { props?: Record<string, unknown> }).props ?? {};
      // posthog-react-native types its props as a narrower JsonType — cast
      // here rather than bending every call site. Non-JSON values will
      // simply serialize as-is or drop; JSON-safe primitives always work.
      ph.capture(event.type, props as any);
    } catch (e) {
      console.warn('[CatMD] analytics track failed:', e);
    }
  })();
}

/**
 * Convenience helper for LLM token / cost tracking. Wraps a single
 * track() call with the typed `llm_usage` event so call sites don't
 * need to remember the discriminator key. Source defaults to 'client'
 * because every JS-side caller is, well, the client; the proxy worker
 * uses the PostHog Capture HTTP API directly with source='proxy'.
 *
 * Cost is auto-estimated from the model + token / image / audio inputs
 * so the caller doesn't have to know prices. Pass cost_cents explicitly
 * to override (e.g. when the proxy has authoritative pricing).
 */
export function trackLLMUsage(args: {
  activity: LLMActivity;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  image_count?: number;
  audio_seconds?: number;
  cost_cents?: number;
  latency_ms?: number;
  source?: 'client' | 'proxy';
}): void {
  const cost_cents =
    args.cost_cents != null
      ? args.cost_cents
      : estimateLLMCostCents({
          model: args.model,
          prompt_tokens: args.prompt_tokens,
          completion_tokens: args.completion_tokens,
          image_count: args.image_count,
          audio_seconds: args.audio_seconds,
        });
  track({
    type: 'llm_usage',
    props: {
      activity: args.activity,
      model: args.model,
      ...(args.prompt_tokens != null ? { prompt_tokens: args.prompt_tokens } : {}),
      ...(args.completion_tokens != null ? { completion_tokens: args.completion_tokens } : {}),
      ...(args.total_tokens != null ? { total_tokens: args.total_tokens } : {}),
      ...(args.image_count != null ? { image_count: args.image_count } : {}),
      ...(args.audio_seconds != null ? { audio_seconds: args.audio_seconds } : {}),
      cost_cents,
      ...(args.latency_ms != null ? { latency_ms: args.latency_ms } : {}),
      source: args.source ?? 'client',
    },
  });
}

/**
 * Read the current PostHog distinct_id (anonymous or identified). Used
 * by the proxy-call path to send the user's id along with image-gen
 * requests so the worker can capture llm_usage events server-side. Safe
 * to call before the SDK is ready — returns null in that case (the
 * proxy then logs the event with distinct_id='unknown').
 */
export async function getDistinctId(): Promise<string | null> {
  try {
    const ph = await getClient();
    if (!ph) return null;
    // posthog-react-native's getDistinctId() is synchronous in current
    // versions; cast through any in case typings lag the runtime.
    const id = (ph as unknown as { getDistinctId?: () => string }).getDistinctId?.();
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Tie subsequent events to a known user. Call after email confirmation
 * (preferred) so anonymous pre-confirm events get joined to the same
 * person profile. Safe to call repeatedly.
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  void (async () => {
    const ph = await getClient();
    if (!ph) return;
    try {
      ph.identify(userId, traits as any);
    } catch (e) {
      console.warn('[CatMD] analytics identify failed:', e);
    }
  })();
}

/**
 * Clear the current user's association. Use after sign-out or
 * forget-everything so the next session starts clean.
 */
export function resetAnalytics(): void {
  void (async () => {
    const ph = await getClient();
    if (!ph) return;
    try {
      ph.reset();
      instance = null;
      loadingPromise = null;
    } catch (e) {
      console.warn('[CatMD] analytics reset failed:', e);
    }
  })();
}

/**
 * Force an immediate flush. Useful before we navigate away from a flow
 * we really want the event for (purchase success, etc.). Best-effort.
 */
export async function flushAnalytics(): Promise<void> {
  const ph = await getClient();
  if (!ph) return;
  try {
    await ph.flush();
  } catch (e) {
    console.warn('[CatMD] analytics flush failed:', e);
  }
}
