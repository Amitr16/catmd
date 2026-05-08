/**
 * Client-side email validation — cheap sanity checks before the round-
 * trip to Supabase. The authoritative check is still Supabase's email
 * confirmation (user must click a link in a real inbox) — this just
 * rejects obvious garbage so we don't burn a confirmation-send on
 * something that will never resolve.
 */
import { isDisposableEmailDomain } from '../data/disposableEmailDomains';

// Pragmatic email regex — doesn't enforce full RFC 5322 but catches the
// structural failures most humans make (no @, no TLD, whitespace,
// localhost, etc.). Full-spec validation is the server's job.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type EmailCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateEmail(raw: string): EmailCheckResult {
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, reason: 'Enter an email address.' };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: 'That doesn\u2019t look like a valid email.' };
  }
  // Block common junk TLDs that humans type by accident.
  if (email.endsWith('@localhost') || email.endsWith('.local')) {
    return { ok: false, reason: 'Use a real email provider.' };
  }
  if (isDisposableEmailDomain(email)) {
    return {
      ok: false,
      reason: 'Disposable email addresses aren\u2019t supported. Use your real email.',
    };
  }
  return { ok: true };
}
