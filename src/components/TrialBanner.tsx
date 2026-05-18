/**
 * TrialBanner — top-of-Today surface showing the user's trial state.
 *
 * Three render modes:
 *
 *   1. Mid-trial (days 1-11): subtle reassurance.
 *      "Pro features unlocked · 9 days left"
 *
 *   2. End-of-trial warning (days 12-14): nudge.
 *      "Trial ending in 2 days · Tap to subscribe and keep talking to Lily"
 *
 *   3. Expired (days 0): hard CTA.
 *      "Trial ended · Upgrade to unlock AI features again"
 *
 * 4. Hidden states: paying subscribers, whitelisted users, and users
 *    who haven't started the trial yet (no auth session). The banner
 *    is intentionally LOUD only in modes 2 + 3 — mid-trial users get
 *    a small, friendly reminder, not a billboard.
 *
 * Banner is dismissible only in mode 1 (mid-trial). Modes 2 + 3 stay
 * pinned — they're conversion-critical.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Sparkle, WarningCircle } from 'phosphor-react-native';
import { Text } from './Text';
import { useEntitlement } from '../hooks/useEntitlement';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';

export function TrialBanner() {
  const t = useTheme();
  const router = useRouter();
  const { isPro, inTrial, isWhitelisted, daysRemaining, loading } = useEntitlement();

  // Hidden states: paying subscriber, whitelisted, or first-load before
  // we know. Loading guard prevents a flash of the banner on cold start.
  if (loading) return null;
  if (isPro) return null;
  if (isWhitelisted) return null;

  // Trial state computation. daysRemaining is null when the trial-state
  // RPC hasn't returned yet (anonymous-but-no-session edge case). In
  // that case we render nothing rather than guess.
  if (daysRemaining == null) return null;

  // Three modes, in order of urgency.
  // - expired: daysRemaining === 0 AND inTrial === false (trial ended)
  // - ending: inTrial && daysRemaining <= 2
  // - active: inTrial && daysRemaining > 2
  const mode: 'expired' | 'ending' | 'active' =
    !inTrial && daysRemaining === 0
      ? 'expired'
      : inTrial && daysRemaining <= 2
        ? 'ending'
        : 'active';

  const onTap = () => {
    router.push({
      pathname: '/paywall',
      params: {
        source: mode === 'expired' ? 'day_14_soft' : mode === 'ending' ? 'day_14_soft' : 'settings',
      },
    } as never);
  };

  if (mode === 'expired') {
    return (
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Pro — trial ended"
        style={[styles.banner, { backgroundColor: t.surfaceSunken, borderColor: t.warning }]}
      >
        <WarningCircle size={20} color={t.warning} weight="fill" />
        <View style={{ flex: 1, marginHorizontal: space[3] }}>
          <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_700Bold' }}>
            Trial ended
          </Text>
          <Text token="caption" color="textSecondary" style={{ marginTop: 1 }}>
            Upgrade to unlock chat, diary, scans, and the meow translator again.
          </Text>
        </View>
        <Text token="caption" style={{ color: t.warning, fontFamily: 'Figtree_700Bold' }}>
          Upgrade
        </Text>
      </Pressable>
    );
  }

  if (mode === 'ending') {
    const label = daysRemaining === 1 ? '1 day' : `${daysRemaining} days`;
    return (
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={`Trial ending in ${label} — tap to subscribe`}
        style={[
          styles.banner,
          { backgroundColor: t.primary50, borderColor: t.primary300 },
        ]}
      >
        <Sparkle size={20} color={t.primary700} weight="fill" />
        <View style={{ flex: 1, marginHorizontal: space[3] }}>
          <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_700Bold' }}>
            Trial ending in {label}
          </Text>
          <Text token="caption" color="textSecondary" style={{ marginTop: 1 }}>
            Subscribe to keep chat, diary, translator, and scans.
          </Text>
        </View>
        <Text token="caption" style={{ color: t.primary700, fontFamily: 'Figtree_700Bold' }}>
          Subscribe
        </Text>
      </Pressable>
    );
  }

  // mode === 'active' — quiet, reassuring
  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={`Pro features unlocked, ${daysRemaining} days left in trial`}
      style={[
        styles.bannerSubtle,
        { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
      ]}
    >
      <Crown size={14} color={t.primary700} weight="duotone" />
      <Text
        token="caption"
        style={{
          color: t.textSecondary,
          marginLeft: space[2],
          flex: 1,
        }}
      >
        Pro features unlocked
      </Text>
      <Text
        token="caption"
        style={{
          color: t.textMuted,
          fontFamily: 'Figtree_600SemiBold',
        }}
      >
        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[3],
  },
  bannerSubtle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[3],
  },
});
