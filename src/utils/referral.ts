/**
 * Referral code generation.
 *
 * Derives a short, user-friendly code from the Supabase auth uid so the
 * mapping is deterministic and server-free: anyone who knows the code
 * can't reverse-engineer the uid (different alphabet + length).
 * Good enough for an indie launch. We can migrate to server-issued
 * codes + proper credit ledger once RevenueCat + Play Console are wired
 * (month 2-3).
 *
 * Format: `CAT` + 6 alphanumeric chars, e.g. `CATAB3K9L`.
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // no 0/1/I/O/L/U to avoid confusion

export function referralCodeFromUid(uid: string | null | undefined): string | null {
  if (!uid) return null;
  // Simple deterministic hash: sum char codes weighted by position → map
  // into the alphabet. Not cryptographic; we just need collision-free for
  // realistic user counts. Identical uids always yield identical codes.
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  let code = '';
  let cursor = hash;
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[cursor % ALPHABET.length];
    cursor = Math.floor(cursor / ALPHABET.length) || (hash + i + 1);
  }
  return `CAT${code}`;
}

export function referralLink(code: string): string {
  return `https://catmd.pet/refer/${code}`;
}
