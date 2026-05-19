/**
 * PersistEmailNudgeBanner — anonymous-first cat-memory nudge.
 *
 * Why it exists: CatMD is anonymous-first, so a new user's diary,
 * personality profile, named subjects, and photos live ONLY on this
 * device. A lost phone or fresh install wipes the cat. We need to
 * persuade users to add an email — but in CAT terms, not user terms:
 *
 *   ❌ "Add an email to back up your data"        (user-framed, dry)
 *   ✅ "Add an email and Lily comes with you      (cat-framed, warm)
 *       to a new phone — diary, personality,
 *       people in her life, all travel with her."
 *
 * Surface: top of the Today tab, BELOW the TrialBanner so trial state
 * always wins on screen real estate when both are active. Renders only
 * when:
 *   - User hasn't confirmed an email yet (auth state read)
 *   - At least 3 days since install (don't pester during onboarding)
 *   - Not currently snoozed (escalating ladder: 7d → 14d → 30d → perma)
 *   - Not permanently dismissed
 *
 * After 4 "Not now" taps the banner stops rendering. The "Add email"
 * affordance still lives in Settings — this banner is a passive nudge,
 * not the only entry point.
 *
 * Persistence + cadence rules: see src/state/emailNudgeStore.ts.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Envelope, X as CloseIcon } from 'phosphor-react-native';
import { Text } from './Text';
import { useAuthSession } from '../hooks/useAuthSession';
import { useEmailNudgeStore } from '../state/emailNudgeStore';
import { useActiveCat } from '../hooks/useActiveCat';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import { track } from '../services/analytics';

export function PersistEmailNudgeBanner() {
  const t = useTheme();
  const router = useRouter();
  const auth = useAuthSession();
  const cat = useActiveCat();
  const catName = cat?.name ?? 'your cat';

  // Anchor the install-age clock the first time this component mounts
  // (in practice, the first time the user reaches Today after install).
  // Idempotent — only writes once.
  const ensureFirstSeen = useEmailNudgeStore((s) => s.ensureFirstSeen);
  const shouldShow = useEmailNudgeStore((s) => s.shouldShow);
  const markShown = useEmailNudgeStore((s) => s.markShown);
  const dismiss = useEmailNudgeStore((s) => s.dismiss);
  const dismissCount = useEmailNudgeStore((s) => s.dismissCount);
  const firstSeenTs = useEmailNudgeStore((s) => s.firstSeenTs);

  useEffect(() => {
    ensureFirstSeen();
  }, [ensureFirstSeen]);

  // Auth state is loading until the supabase session is read — render
  // nothing in the meantime so we don't flash the banner only to hide it.
  // (Note: hooks below must run on every render, so we compute `visible`
  // BEFORE the early return and let the effect noop when not visible.)
  const authLoading = auth.loading;
  const visible = !authLoading && shouldShow({ hasConfirmedEmail: auth.hasConfirmedEmail });

  // Telemetry — mark-as-shown + fire `email_nudge_shown` whenever the
  // banner transitions to visible. Side effects MUST live in useEffect
  // (not in the render body) to avoid double-firing under React Strict
  // Mode and to keep render pure. The store's SAME_DAY_REPRESS guard
  // prevents same-day re-shows from inflating the impression count.
  useEffect(() => {
    if (!visible) return;
    markShown();
    try {
      const daysSinceInstall = firstSeenTs
        ? Math.floor((Date.now() - firstSeenTs) / (24 * 60 * 60 * 1000))
        : 0;
      track({
        type: 'email_nudge_shown',
        props: {
          days_since_install: daysSinceInstall,
          dismiss_count_so_far: dismissCount,
        },
      });
    } catch {
      // analytics is best-effort; UX must work regardless
    }
  }, [visible, markShown, firstSeenTs, dismissCount]);

  if (authLoading) return null;
  if (!visible) return null;

  const onTapAdd = () => {
    try {
      track({ type: 'email_nudge_tapped_add_email', props: { dismiss_count_so_far: dismissCount } });
    } catch {
      // ignore
    }
    router.push({ pathname: '/upgrade-account', params: { gate: 'email' } } as never);
  };

  const onTapNotNow = () => {
    try {
      track({
        type: 'email_nudge_dismissed',
        props: {
          dismiss_count_so_far: dismissCount,
          // After this tap, the store's dismissCount increments; the
          // outcome (snooze duration or permanent) is derived from the
          // ladder in the store.
          will_be_permanent: dismissCount >= 3,
        },
      });
    } catch {
      // ignore
    }
    dismiss();
  };

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: t.surfaceElevated, borderColor: t.primary300 },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Add an email so ${catName} remembers you on a new phone`}
    >
      <View style={styles.iconWrap}>
        <Envelope size={20} color={t.primary700} weight="duotone" />
      </View>
      <View style={{ flex: 1, marginHorizontal: space[3] }}>
        <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_700Bold' }}>
          Keep {catName}&rsquo;s memory safe across phones.
        </Text>
        <Text
          token="caption"
          color="textSecondary"
          style={{ marginTop: 2, lineHeight: 17 }}
        >
          Right now {catName} only lives on this phone. Add an email and{' '}
          {catName} comes with you to a new device — diary, personality, the
          people in {catName}&rsquo;s life, all travel.
        </Text>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
          <Pressable
            onPress={onTapAdd}
            accessibilityRole="button"
            accessibilityLabel="Add email"
            style={[styles.btnPrimary, { backgroundColor: t.primary700 }]}
            hitSlop={4}
          >
            <Text
              token="caption"
              style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}
            >
              Add email
            </Text>
          </Pressable>
          <Pressable
            onPress={onTapNotNow}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={[styles.btnSecondary, { borderColor: t.borderSubtle }]}
            hitSlop={4}
          >
            <Text token="caption" color="textSecondary">
              Not now
            </Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={onTapNotNow}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
        style={styles.closeBtn}
      >
        <CloseIcon size={14} color={t.textMuted} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    marginHorizontal: space[5],
    marginTop: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconWrap: {
    paddingTop: 2,
  },
  btnPrimary: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.full,
  },
  btnSecondary: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  closeBtn: {
    padding: space[1],
    marginLeft: space[2],
  },
});
