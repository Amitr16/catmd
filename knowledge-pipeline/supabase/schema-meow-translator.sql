-- ════════════════════════════════════════════════════════════════════════
-- CatMD — Meow Translator event type (2026-05-10)
-- ════════════════════════════════════════════════════════════════════════
--
-- What this migration adds:
--   1. Extends `cat_events.type` CHECK constraint to allow `meow_translation`.
--      The Meow Translator (audio + 4 frames + cat memory → cat-voice
--      translation) writes one row per /translate run; without this
--      constraint the cloud sync silently fails (mirrors the May-6
--      bugfix for daily_checkin / behavior_observation).
--
-- Run order: AFTER `schema-cloud-backup-phase-b.sql`.
-- Idempotent: safe to re-run.
--
-- ════════════════════════════════════════════════════════════════════════

alter table public.cat_events
    drop constraint if exists cat_events_type_check;

alter table public.cat_events
    add constraint cat_events_type_check check (type in (
        -- Existing legacy types
        'scan','chat','vet_record','symptom','litter_box',
        'weight','feeding','medication',
        -- Wave A longitudinal health tracking
        'vaccination','medication_dose','appointment','symptom_photo',
        'water_intake','litter_box_use',
        -- Wave C cat-specific trackers
        'srr_measurement','pain_score','outcome_check',
        -- Bug fix (2026-05-06): missing from original constraint
        'daily_checkin','behavior_observation',
        -- Phase B (2026-05-06): full-data backup
        'diary_entry','personality_quiz','postcard',
        'cat_studio_poster','weekly_reading',
        -- Meow Translator (2026-05-10): multimodal cat-voice translator
        'meow_translation'
    ));

-- End of Meow Translator migration. After running:
--   1. Verify: \d+ public.cat_events
--   2. Test by writing a `meow_translation` event from the app — should
--      now succeed where it was silently dropped before.
