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

/**
 * Upgrade an anonymous user to email + password WITHOUT losing their data.
 * Under the hood: updateUser attaches credentials to the existing uid.
 */
export async function upgradeToEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return data.user;
}

/**
 * Add email to the current account, creating the account if there's no
 * session at all (common when anonymous sign-in is disabled or offline).
 * Returns the user on success.
 */
export async function addEmailToAccount(email: string, password: string) {
  const existing = await getSession();
  if (existing) return upgradeToEmail(email, password);

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

export type EmailOtpFlow = 'signup' | 'email_change';

/**
 * Resend the email-confirmation OTP for the current user's pending email.
 * `flow` is 'signup' when the user has no prior session (fresh sign-up),
 * or 'email_change' when upgrading an anonymous session to email. The
 * caller derives this from auth state (see useAuthSession).
 */
export async function resendEmailOtp(email: string, flow: EmailOtpFlow): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('No email to resend to.');
  const { error } = await supabase.auth.resend({ type: flow, email: trimmed });
  if (error) throw error;
}

/**
 * Verify the 6-digit OTP the user entered against the email we sent it
 * to. On success, Supabase marks the email confirmed and (for signup)
 * issues a session. `flow` must match the flow that sent the code.
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
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: flow,
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
