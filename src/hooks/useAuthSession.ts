/**
 * Reactive Supabase session hook.
 *
 * Emits on login / logout / upgrade / email confirmation. Also force-
 * refreshes the user on app foreground so that confirmation state
 * propagates after the user returns from the email-link landing page.
 *
 * Derived flags the UI leans on:
 *   - isAnonymous         — true for a valid-but-emailless auth session
 *   - hasConfirmedEmail   — email_confirmed_at is populated
 *   - hasPendingEmail     — user typed an email but hasn't confirmed yet
 *   - pendingEmail        — the email they're waiting to confirm
 *
 * Gating logic (scan flow, settings) should rely on hasConfirmedEmail,
 * never on `!!user.email`, because Supabase populates user.email at
 * signUp time BEFORE confirmation — so trusting it leaves the free-tier
 * pool wide open to fake emails.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export type EmailFlow = 'signup' | 'email_change';

export type AuthState = {
  loading: boolean;
  user: User | null;
  isAnonymous: boolean;
  hasConfirmedEmail: boolean;
  hasPendingEmail: boolean;
  pendingEmail: string | null;
  /** Which OTP verify type applies to the pending email, inferred from
   *  server state. `new_email` set → email change; `email` set but not
   *  yet confirmed → fresh signup. null when there's nothing pending. */
  pendingFlow: EmailFlow | null;
};

function derive(u: User | null): Omit<AuthState, 'loading'> {
  if (!u) {
    return {
      user: null,
      isAnonymous: true,
      hasConfirmedEmail: false,
      hasPendingEmail: false,
      pendingEmail: null,
      pendingFlow: null,
    };
  }
  const confirmed = !!(u as any).email_confirmed_at;
  // `new_email` is set during an updateUser({email}) change on an
  // anonymous or email-linked account while confirmation is pending.
  const newEmail = (u as { new_email?: string | null }).new_email ?? null;
  // `email` can be populated BEFORE confirmation on a fresh signUp — we
  // treat that as pending too. This is the common indie-app mistake.
  const unconfirmedEmail = !confirmed && u.email ? u.email : null;
  const pendingEmail = newEmail || unconfirmedEmail;
  const pendingFlow: EmailFlow | null = newEmail
    ? 'email_change'
    : unconfirmedEmail
      ? 'signup'
      : null;
  return {
    user: u,
    isAnonymous: !confirmed,
    hasConfirmedEmail: confirmed,
    hasPendingEmail: !confirmed && !!pendingEmail,
    pendingEmail,
    pendingFlow,
  };
}

export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    ...derive(null),
  });

  useEffect(() => {
    let active = true;
    // Track whether we've already fired an `email_confirmed` analytics
    // event for this session — we only want it once per flip, not once
    // per hook render.
    let lastConfirmedFired = false;

    const apply = (u: User | null) => {
      const next = derive(u);
      setState({ loading: false, ...next });
      // Fire analytics on the anonymous → confirmed transition. Lazy-
      // import analytics so it doesn't pull PostHog into hook bundles
      // that might run before the SDK is ready.
      //
      // We deliberately do NOT attach the email as an `identify` trait —
      // our privacy policy only lists "anonymous usage events" for
      // PostHog, so sending the email would be a disclosure mismatch.
      if (next.hasConfirmedEmail && !lastConfirmedFired) {
        lastConfirmedFired = true;
        void import('../services/analytics').then(({ identify, track }) => {
          if (u?.id) identify(u.id);
          track({ type: 'email_confirmed' });
        });
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      apply(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      apply(session?.user ?? null);
    });

    // Force-refresh on app foreground so that when the user returns from
    // the email-confirmation landing page, email_confirmed_at propagates
    // into the hook without requiring a manual reload. Cheap round-trip.
    const appSub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      supabase.auth.getUser().then(({ data }) => {
        apply(data.user ?? null);
      }).catch(() => {});
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      appSub.remove();
    };
  }, []);

  return state;
}
