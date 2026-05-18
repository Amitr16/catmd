/**
 * Auth helpers on top of Supabase.
 *
 * Pattern: anonymous-first. On every app launch `ensureSession()` either
 * restores a persisted session or creates an anonymous one. Users can
 * later "upgrade" by adding an email + password — their data stays
 * because it's keyed to the same auth.uid().
 */
import { supabase } from './supabase';

export type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.warn('[CatMD] getSession:', error);
  return data.session;
}

/** Get (or create) an anonymous session. Safe to call on every launch. */
export async function ensureSession() {
  const existing = await getSession();
  if (existing) return existing;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[CatMD] signInAnonymously failed:', error.message);
    // Common reason: the Supabase project has anonymous sign-ins disabled.
    // Ship the app with a friendly banner telling the user to retry; for
    // now we return null and let callers continue without writes.
    return null;
  }
  return data.session;
}

export type EmailOtpFlow = 'signup' | 'email_change';

/**
 * Thrown by `addEmailToAccount` when the email is already linked to a
 * different CatMD account. The UI should surface this distinctly: NOT
 * a generic error, but an explicit branching choice — let the user
 * pick "use a different email" OR "sign in to that account instead
 * (clears current data)". Silently signing them in would orphan their
 * current anonymous data without warning.
 */
export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email is already linked to another account.');
    this.name = 'EmailAlreadyExistsError';
  }
}

/**
 * Add email to the current account using OTP-only auth (no password).
 *
 * One-email-one-account rule: rejects emails that are already linked
 * to other accounts. To get into an existing account, the user must
 * explicitly call `signInWithExistingEmail` (a separate, conscious
 * action that clears current anonymous data).
 *
 * Paths:
 *   1. Anonymous user + brand-new email → `updateUser({ email })`
 *      attaches the email to the existing anonymous auth.uid, sending
 *      an OTP code for `type: 'email_change'`. **Preserves all
 *      anonymous data** because the uid stays the same.
 *
 *   2. Anonymous user + email already-registered →
 *      throws `EmailAlreadyExistsError`. UI surfaces explicit choice.
 *
 *   3. No session at all (anonymous sign-in disabled / offline) →
 *      `signInWithOtp` with `shouldCreateUser: true` creates a fresh
 *      account. If the email IS already registered, Supabase itself
 *      returns a sign-in OTP for the existing account in this case —
 *      we let it through since there's no anonymous data at risk.
 *
 * Returns the flow that was used so the caller passes the right
 * `type` to verifyOtp later.
 *
 * @throws EmailAlreadyExistsError when email is taken AND we have an
 *         anonymous session (Path 2). Caller should surface explicit
 *         "sign in instead" branching UI.
 */
export async function addEmailToAccount(email: string): Promise<{
  flow: EmailOtpFlow;
}> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('Enter an email address.');
  const existing = await getSession();

  // Path 1+2: anonymous user wants to attach an email.
  if (existing) {
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    if (!error) {
      // Success — OTP en route for email_change type.
      return { flow: 'email_change' };
    }
    // Detect the "already linked to another account" case. Supabase
    // returns variations like "User already registered", "A user with
    // this email address has already been registered", etc.
    const msg = (error.message ?? '').toLowerCase();
    const alreadyExists =
      msg.includes('already') ||
      msg.includes('exists') ||
      msg.includes('registered');
    if (alreadyExists) {
      throw new EmailAlreadyExistsError();
    }
    throw error;
  }

  // Path 3: no session at all. Either creates or signs in — no
  // anonymous data to orphan.
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return { flow: 'signup' };
}

/**
 * Explicit "sign in to an existing account" flow. Called when the
 * user has been told their email is already linked elsewhere AND they
 * confirmed they want to swap into that account (losing current
 * anonymous data).
 *
 * Uses `signInWithOtp` with `shouldCreateUser: false` so a typo
 * doesn't accidentally create a fresh account.
 */
export async function signInWithExistingEmail(email: string): Promise<{
  flow: EmailOtpFlow;
}> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('Enter an email address.');
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return { flow: 'signup' };
}

/**
 * Resend the email-confirmation OTP for the current user's pending email.
 * `flow` is 'signup' for fresh-account OTP sign-ins, or 'email_change'
 * for anonymous-to-email upgrades. The caller derives this from the
 * state returned by addEmailToAccount (or from useAuthSession).
 */
export async function resendEmailOtp(email: string, flow: EmailOtpFlow): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('No email to resend to.');
  if (flow === 'email_change') {
    // updateUser-sent OTP — resend via the same path.
    const { error } = await supabase.auth.resend({ type: 'email_change', email: trimmed });
    if (error) throw error;
  } else {
    // signInWithOtp-sent code — re-fire signInWithOtp to send a fresh code.
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }
}

/**
 * Verify the 6-digit OTP the user entered against the email we sent it
 * to. On success, Supabase marks the email confirmed and issues a
 * session. The `flow` MUST match the flow that originally sent the
 * code — `verifyOtp.type` is path-dependent (Supabase requires 'email'
 * for signInWithOtp, 'email_change' for updateUser email changes).
 */
export async function verifyEmailOtp(
  email: string,
  token: string,
  flow: EmailOtpFlow,
): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedToken = token.trim().replace(/\s+/g, '');
  if (trimmedToken.length !== 6) {
    throw new Error('Enter the 6-digit code from your email.');
  }
  // Map our internal flow names to Supabase's verifyOtp type values.
  // The 'signup' flow now sends via signInWithOtp() (was signUp() with
  // password) → verify type is 'email'. The 'email_change' flow uses
  // updateUser → verify type stays 'email_change'.
  const verifyType: 'email' | 'email_change' =
    flow === 'signup' ? 'email' : 'email_change';
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: verifyType,
  });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * "Forget everything about my cat" — clears server-side user data.
 * Calls the `forget_me` RPC defined in schema-users.sql which deletes
 * the user's cats + events. Local (Zustand) clearing is the caller's job.
 *
 * Note: this does NOT delete the auth.users row. Full account deletion
 * requires a service-role call; do that server-side only when we ship
 * the edge function.
 */
export async function forgetMe() {
  const { error } = await supabase.rpc('forget_me');
  if (error) throw error;
}

/** True if the current session is an anonymous (no-email) user. */
export function isAnonymous(user: { email?: string | null } | null | undefined): boolean {
  return !!user && !user.email;
}
