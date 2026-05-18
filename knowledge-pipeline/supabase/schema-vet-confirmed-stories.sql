-- =============================================================================
-- vet-confirmed stories — the 5-10 stories that bridge "CatMD flagged something"
-- → "vet confirmed it" → press / case-study material.
--
-- Audit 2026-05-16. Triggered from app/outcome-check.tsx after a user marks
-- `vet_visited = 'yes'` in the existing outcome-check flow.
--
-- Architecture:
--   - Write-only from the app (RLS allows authenticated INSERT for own user_id).
--   - All SELECT / UPDATE / DELETE is service-role (you read these via SQL
--     dashboard, not via the app).
--   - One row per submitted story. Idempotency is loose — a user can submit
--     multiple stories over time (one per scan_id is reasonable but not
--     enforced).
--   - `permission_level` controls how the story may be used externally.
--     Private = internal only. Anonymous quote = OK to publish without
--     names. First name = OK to use first name + cat name. Contact me =
--     reach out before using publicly.
--   - `marketing_status` is the admin's review pipeline state. App always
--     writes 'pending'; you update via service-role SQL.
--
-- After running this migration:
--   1. Confirm RLS is on:    SELECT relrowsecurity FROM pg_class WHERE relname='vet_confirmed_stories';
--   2. Test the insert RPC:  via the app on a real device, then SELECT *.
--   3. Review submissions:   SELECT * FROM vet_confirmed_stories ORDER BY created_at DESC;
--   4. Mark candidates:      UPDATE vet_confirmed_stories SET press_pitch_candidate=true WHERE id='...';
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vet_confirmed_stories (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cat_id                  text NOT NULL,           -- text per existing schema convention (post-UUID migration)
  scan_id                 text,                    -- optional — null when story isn't tied to a specific scan

  created_at              timestamptz NOT NULL DEFAULT now(),

  -- Triage snapshot at the moment of submission
  original_urgency_tier   text NOT NULL,           -- 'routine' | 'monitor' | 'concern' | 'urgent'
  health_score            int  NOT NULL CHECK (health_score >= 0 AND health_score <= 99),

  -- Story content (4 free-text fields from the modal)
  catmd_flagged           text NOT NULL,           -- "What did CatMD flag?"
  owner_observed          text NOT NULL,           -- "What did you notice first?"
  vet_confirmed           text NOT NULL,           -- "What did the vet say?"
  outcome                 text NOT NULL,           -- "How is your cat doing now?"

  -- Permission + contact
  permission_level        text NOT NULL
                          CHECK (permission_level IN (
                            'private',
                            'anonymous_quote',
                            'first_name',
                            'contact_me'
                          )),
  contact_email           text,                    -- nullable; only set when permission_level='contact_me'

  -- Admin-only fields (the app never writes these; service-role updates)
  marketing_status        text NOT NULL DEFAULT 'pending'
                          CHECK (marketing_status IN (
                            'pending',
                            'reviewed',
                            'published',
                            'declined',
                            'archived'
                          )),
  internal_notes          text,                    -- admin annotations
  press_pitch_candidate   boolean NOT NULL DEFAULT false
);

-- Indexes that pay for themselves on dashboard queries
CREATE INDEX IF NOT EXISTS idx_vet_confirmed_stories_created_at
  ON public.vet_confirmed_stories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vet_confirmed_stories_press_pitch_candidate
  ON public.vet_confirmed_stories (press_pitch_candidate) WHERE press_pitch_candidate;
CREATE INDEX IF NOT EXISTS idx_vet_confirmed_stories_marketing_status
  ON public.vet_confirmed_stories (marketing_status);
CREATE INDEX IF NOT EXISTS idx_vet_confirmed_stories_user_id
  ON public.vet_confirmed_stories (user_id);

-- =============================================================================
-- RLS — write-only-own from the app, read/update/delete service-role only
-- =============================================================================

ALTER TABLE public.vet_confirmed_stories ENABLE ROW LEVEL SECURITY;

-- INSERT — authenticated users can write a row for THEMSELVES.
-- The row's user_id must equal auth.uid(); the app reads its own auth uid
-- via supabase.auth.getUser() and passes it explicitly.
CREATE POLICY "users insert own stories"
  ON public.vet_confirmed_stories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- SELECT / UPDATE / DELETE — NO policy. Service-role bypasses RLS, so the
-- admin SQL dashboard can do anything. The app cannot read or change
-- submitted stories (write-only from the app's perspective).

-- =============================================================================
-- Helper view: stories ready for press pitch
-- Lets the admin filter to candidates with usable permission levels.
-- =============================================================================
CREATE OR REPLACE VIEW public.vet_confirmed_stories_press_ready AS
SELECT
  id,
  created_at,
  cat_id,
  original_urgency_tier,
  health_score,
  catmd_flagged,
  owner_observed,
  vet_confirmed,
  outcome,
  permission_level,
  contact_email,
  marketing_status,
  internal_notes
FROM public.vet_confirmed_stories
WHERE press_pitch_candidate = true
  AND permission_level IN ('anonymous_quote', 'first_name', 'contact_me')
  AND marketing_status IN ('pending', 'reviewed');

-- Grant the service role full access for dashboard / dbt / scripts
GRANT ALL ON public.vet_confirmed_stories TO service_role;
GRANT SELECT ON public.vet_confirmed_stories_press_ready TO service_role;
