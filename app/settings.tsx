/**
 * Settings — account, data, legal. The "hub" screen reached from the
 * dashboard gear icon.
 *
 * Sections:
 *  - Account: anonymous status + "Add email" link + entitlement + restore
 *  - Cat: link to cat-profile editor
 *  - Data: "Forget everything about my cat" (GDPR hard-delete) + sign-out
 *  - Legal: T&C + Privacy
 */
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Bell,
  CaretRight,
  Cat,
  Crown,
  Envelope,
  Eraser,
  House,
  ShareFat,
  SignOut,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { useEntitlement } from '../src/hooks/useEntitlement';
import { useCatStore } from '../src/state/catStore';
import { useScanStore } from '../src/state/scanStore';
import { forgetMe, signOut } from '../src/services/auth';
import { referralCodeFromUid, referralLink } from '../src/utils/referral';
import { purchases, restorePurchases } from '../src/services/purchases';

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, hasConfirmedEmail, hasPendingEmail, pendingEmail } = useAuthSession();
  const { isPro, refresh: refreshEntitlement } = useEntitlement();
  // hasConfirmedEmail is keyed off `email_confirmed_at` — NOT just
  // `user.email`. A fresh signUp populates `email` before the user
  // clicks the confirmation link, so gating on email alone was letting
  // fake-email accounts through. See useAuthSession for the derivation.
  const noSession = !user;
  // "Restore purchases" is a Play Store / App Store requirement only when
  // real IAP is wired. In dev (paywall disabled) there's nothing to
  // restore, so the row is dead UX — hide it.
  const showRestore = purchases.ENABLED;
  const catCount = useCatStore((s) => s.cats.length);
  const resetOnboarded = useCatStore((s) => s.setHasOnboarded);
  const clearAllCats = useCatStore((s) => s.clearAllCats);
  const clearScans = useScanStore((s) => s.clear);
  const [busy, setBusy] = useState(false);

  const onRestore = async () => {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      await refreshEntitlement();
      Alert.alert(
        ok ? 'Subscription restored' : 'No active subscription found',
        ok
          ? 'Your Pro access is re-linked to this device.'
          : 'If you paid on a different Google/Apple account, sign into that account in the Play Store / App Store and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Pro row behaviour:
   *  - Not Pro  → /paywall (buy flow)
   *  - Pro      → open the store\u2019s subscription management page.
   *    Android deep link: `market://...` falls back to the web Play URL.
   *    iOS: `itms-apps://apps.apple.com/account/subscriptions`.
   */
  const onProRow = async () => {
    if (!isPro) {
      router.push({ pathname: '/paywall', params: { source: 'settings' } });
      return;
    }
    const pkg =
      (Constants.expoConfig?.android?.package as string | undefined) ??
      'com.catmd.app';
    const androidPrimary = `https://play.google.com/store/account/subscriptions?package=${pkg}`;
    const iosPrimary = 'itms-apps://apps.apple.com/account/subscriptions';
    const target = Platform.OS === 'ios' ? iosPrimary : androidPrimary;
    try {
      const ok = await Linking.canOpenURL(target);
      if (ok) return Linking.openURL(target);
    } catch {
      // fall through
    }
    Alert.alert(
      'CatMD Pro',
      'All features are unlocked on this account. Manage your subscription in the Play Store (Android) or App Store (iOS).',
    );
  };

  const onForget = () => {
    Alert.alert(
      'Forget everything?',
      'This permanently deletes your cat\u2019s profile, every scan, and any stored photos from our servers and this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget everything',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              void import('../src/services/analytics').then(
                ({ track, resetAnalytics }) => {
                  track({ type: 'forget_me' });
                  resetAnalytics();
                },
              );
              await forgetMe().catch((e) => console.warn('[CatMD] forget_me rpc:', e));
              clearAllCats();
              clearScans();
              resetOnboarded(false);
              router.replace('/onboarding');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onShareCatMD = async () => {
    const code = referralCodeFromUid(user?.id ?? null);
    const url = code ? referralLink(code) : 'https://catmd.pet';
    const message =
      `I'm using CatMD to keep tabs on my cat's health \u2014 it's a home-vet that catches things early.` +
      `\n\nTry it: ${url}`;
    try {
      await Share.share({
        message,
        url, // iOS uses url separately
        title: 'CatMD \u2014 cat health, at home',
      });
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'referral_shared', props: { surface: 'settings' } }),
      );
    } catch {
      // user cancelled or native share unavailable; no action
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    try {
      void import('../src/services/analytics').then(
        ({ track, resetAnalytics }) => {
          track({ type: 'sign_out' });
          resetAnalytics();
        },
      );
      await signOut();
      clearAllCats();
      clearScans();
      resetOnboarded(false);
      router.replace('/onboarding');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      <Text token="heading1">Settings</Text>

      <Section title="Account">
        <Card padded={false}>
          <Row
            icon={<Envelope size={20} color={t.primary700} />}
            title={
              hasConfirmedEmail
                ? (user?.email ?? 'Signed in')
                : pendingEmail
                  ? pendingEmail
                  : noSession
                    ? 'Create an account'
                    : 'Add email to your account'
            }
            subtitle={
              hasConfirmedEmail
                ? 'Email linked \u2014 data syncs across devices'
                : pendingEmail
                  ? 'Check your inbox \u2014 tap the confirmation link to finish'
                  : noSession
                    ? 'Save your cat\u2019s history to the cloud'
                    : 'Recover your data on a new device'
            }
            onPress={hasConfirmedEmail ? undefined : () => router.push('/upgrade-account')}
          />
          <Divider />
          <Row
            icon={<Crown size={20} color={isPro ? t.warning : t.textMuted} weight={isPro ? 'fill' : 'regular'} />}
            title={isPro ? 'CatMD Pro' : 'CatMD Free'}
            subtitle={
              isPro
                ? 'All features unlocked \u2014 tap to manage subscription'
                : 'Upgrade for unlimited check-ins'
            }
            onPress={onProRow}
          />
          {showRestore ? (
            <>
              <Divider />
              <Row
                icon={<ArrowRight size={20} color={t.textMuted} />}
                title="Restore purchases"
                subtitle={
                  busy
                    ? 'Working\u2026'
                    : 'Re-link a Pro subscription after reinstalling or on a new device'
                }
                onPress={onRestore}
              />
            </>
          ) : null}
        </Card>
      </Section>

      <Section title="Your cats">
        <Card padded={false}>
          <Row
            icon={<Cat size={20} color={t.primary700} />}
            title={catCount <= 1 ? 'Cat profile' : `${catCount} cats`}
            subtitle={
              catCount <= 1
                ? 'Name, breed, DOB, weight, lifestyle, history'
                : 'Switch between cats or add another'
            }
            onPress={() => router.push('/cats')}
          />
        </Card>
      </Section>

      <Section title="Notifications">
        <Card padded={false}>
          <Row
            icon={<Bell size={20} color={t.primary700} weight="duotone" />}
            title="Reminders & alerts"
            subtitle="Birthday, adoption-iversary, streaks, insights, daily check-in"
            onPress={() => router.push('/notification-settings' as any)}
          />
        </Card>
      </Section>

      {/* World Memory — the registry of REAL objects, places, toys the
          cat actually has. Lets the cat reference real items in chat
          and diary instead of inventing props. */}
      <Section title="World">
        <Card padded={false}>
          <Row
            icon={<House size={20} color={t.primary700} weight="duotone" />}
            title="Things, places, toys"
            subtitle="The chair, the wand, the garden — real items your cat knows about"
            onPress={() => router.push('/world' as never)}
          />
        </Card>
      </Section>

      <Section title="Spread the word">
        <Card padded={false}>
          <Row
            icon={<ShareFat size={20} color={t.primary700} weight="fill" />}
            title="Share CatMD with a friend"
            subtitle="Every cat deserves early-warning care. Help us reach them."
            onPress={onShareCatMD}
          />
        </Card>
      </Section>

      <Section title="Data">
        <Card padded={false}>
          <Row
            icon={<Eraser size={20} color={t.error} />}
            title="Forget everything about my cat"
            subtitle="Permanently delete profile, scans, photos"
            onPress={onForget}
            tone="destructive"
          />
          <Divider />
          <Row
            icon={<SignOut size={20} color={t.textMuted} />}
            title="Sign out"
            subtitle={hasConfirmedEmail ? 'Data stays with your email' : 'You have an anonymous account \u2014 data will be lost on this device'}
            onPress={onSignOut}
          />
        </Card>
      </Section>

      <Section title="Legal">
        <Card padded={false}>
          <Row
            title="Terms of service"
            onPress={() =>
              Linking.openURL('https://catmd.pet/terms').catch(() => {})
            }
          />
          <Divider />
          <Row
            title="Privacy policy"
            onPress={() =>
              Linking.openURL('https://catmd.pet/privacy').catch(() => {})
            }
          />
          <Divider />
          <Row
            title="Medical disclaimer"
            onPress={() =>
              Linking.openURL('https://catmd.pet/disclaimer').catch(() => {})
            }
          />
        </Card>
      </Section>

      <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[8] }}>
        CatMD v0.1 · Informational only — not veterinary advice.
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[6] }}>
      <Text
        token="caption"
        color="textMuted"
        style={{ marginBottom: space[2], textTransform: 'uppercase', letterSpacing: 1 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row(props: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  tone?: 'destructive';
}) {
  const t = useTheme();
  const disabled = !props.onPress;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled ? { backgroundColor: t.surfaceSunken } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={props.title}
    >
      {props.icon}
      <View style={{ flex: 1 }}>
        <Text
          token="body"
          style={{
            color: props.tone === 'destructive' ? t.error : t.textPrimary,
            fontFamily: 'Figtree_500Medium',
          }}
        >
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>{props.subtitle}</Text>
        ) : null}
      </View>
      {!disabled ? <CaretRight size={16} color={t.textMuted} /> : null}
    </Pressable>
  );
}

function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.borderSubtle, marginHorizontal: space[4] }} />;
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
  },
});
