/**
 * Paywall — the single most important conversion surface in the app.
 *
 * Structure (conversion-optimized):
 *   1. Hero — emotional hook ("Unlock everything for {Luna}")
 *   2. Trust stats — factual social proof (not fake testimonials)
 *   3. Benefits — 4 key differentiators
 *   4. Plans — annual selected by default, lifetime flagged "Limited"
 *   5. CTA — trial-first for annual, subscribe otherwise
 *   6. Trust badges + Restore
 *
 * Compliance:
 *   - Google Play billing policy: clear prices, auto-renew language,
 *     cancel instructions, restore button.
 *   - Apple App Store Review 3.1.1: visible close, terms/privacy links,
 *     trial → paid transition spelled out.
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Books,
  CheckCircle,
  Heartbeat,
  Lock,
  ShieldCheck,
  Stethoscope,
  Sparkle,
  X,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';
import {
  listOfferings,
  purchasePackage,
  restorePurchases,
  type CatMdPackage,
} from '../src/services/purchases';

const BENEFITS: { title: string; body: string; Icon: any }[] = [
  {
    title: 'Unlimited AI scans',
    body: 'Free tier is 3 scans / month. Pro lifts the cap.',
    Icon: Stethoscope,
  },
  {
    title: 'Every specialist monitor',
    body: 'Pain (Feline Grimace Scale), respiratory rate, CKD + thyroid dashboards, litter-box analytics, symptom photo timeline.',
    Icon: Heartbeat,
  },
  {
    title: 'Share with your real vet',
    body: 'Export a clean 12-month PDF report — your vet reads it in 30 seconds.',
    Icon: ShieldCheck,
  },
  {
    title: 'Private by design',
    body: 'Data stays yours. No ads. No data sales. Delete everything anytime.',
    Icon: Lock,
  },
];

/**
 * Factual "social proof" — what's actually in the product. No fake
 * testimonials. If these numbers change we update them here.
 */
const TRUST_STATS: { big: string; caption: string }[] = [
  { big: '527', caption: 'vet-literature topics' },
  { big: '11', caption: 'specialist monitors' },
  { big: 'Cat', caption: 'only — no dog dilution' },
];

type PaywallSource = 'scan_quota' | 'settings' | 'cats';
const VALID_SOURCES: readonly PaywallSource[] = ['scan_quota', 'settings', 'cats'] as const;

export default function PaywallScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useActiveCat();
  const auth = useAuthSession();
  const { source: rawSource } = useLocalSearchParams<{ source?: string }>();
  const source: PaywallSource = VALID_SOURCES.includes(rawSource as PaywallSource)
    ? (rawSource as PaywallSource)
    : 'scan_quota';
  const [packages, setPackages] = useState<CatMdPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listOfferings()
      .then((pkgs) => {
        if (pkgs.length === 0) {
          // RC returned a valid-but-empty offering (usually means products
          // not yet approved in Play Console) — surface a useful message
          // instead of leaving the Subscribe button stuck-disabled.
          setErr('No plans available right now. Try again in a few minutes.');
          return;
        }
        setPackages(pkgs);
        const annual = pkgs.find((p) => p.period === 'ANNUAL') ?? pkgs[0];
        if (annual) setSelected(annual.identifier);
      })
      .catch(() => setErr('Could not load plans. Check your connection.'));
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'paywall_viewed', props: { source } }),
    );
  }, [source]);

  const selectedPkg = useMemo(
    () => packages.find((p) => p.identifier === selected) ?? null,
    [packages, selected],
  );
  const isTrialEligible = selectedPkg?.period === 'ANNUAL';

  const onBuy = async () => {
    if (!selectedPkg) return;
    setErr(null);

    // Email gate (added 2026-05-03). Pro users MUST have a verified
    // email before checkout — this is the architectural rule that
    // makes cross-device restore work. Email becomes the user's
    // identity for cloud backup; without it, they can't recover their
    // cat's data on a new device. We route them through the existing
    // OTP-based upgrade-account flow, which sends them to /(main) on
    // verify; they tap Subscribe again from there. The `gate=paywall`
    // param can later be used to auto-route back to /paywall after
    // verify (Phase B follow-up).
    if (!auth.hasConfirmedEmail) {
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'paywall_email_gate_shown', props: { source } }),
      );
      router.push({
        pathname: '/upgrade-account',
        params: { gate: 'paywall' },
      });
      return;
    }

    setBusy(true);
    try {
      const ok = await purchasePackage(selectedPkg);
      if (ok) {
        void import('../src/services/analytics').then(({ track, flushAnalytics }) => {
          track({
            type: 'paywall_converted',
            props: { period: selectedPkg.period },
          });
          void flushAnalytics();
        });
        router.replace('/(main)');
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Purchase failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    setErr(null);
    try {
      const ok = await restorePurchases();
      if (ok) router.replace('/(main)');
      else setErr('No active subscription found on this account.');
    } catch (e: any) {
      setErr(e?.message ?? 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.top + space[3],
          paddingBottom: insets.bottom + space[6],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close paywall"
        hitSlop={12}
        style={styles.close}
      >
        <X size={24} color={t.textSecondary} weight="regular" />
      </Pressable>

      {/* Hero */}
      <View style={{ marginTop: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Sparkle size={24} color={t.warning} weight="fill" />
          <Text token="caption" style={{ color: t.warning, fontFamily: 'Figtree_700Bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            CatMD Pro
          </Text>
        </View>
        <Text token="displayLg" style={{ marginTop: space[2] }}>
          Unlock everything
          {cat?.name ? ` for ${cat.name}` : ''}.
        </Text>
        <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[3] }}>
          Cats hide pain. Pro gives you every tool to catch what they don&rsquo;t show —
          before it becomes an emergency.
        </Text>
      </View>

      {/* Trust stats */}
      <View style={styles.statsRow}>
        {TRUST_STATS.map((s, i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
            <Text token="heading1" style={{ color: t.primary700, fontFamily: 'SourceSerif4_500Medium' }}>
              {s.big}
            </Text>
            <Text token="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: 2 }}>
              {s.caption}
            </Text>
          </View>
        ))}
      </View>

      {/* Benefits */}
      <View style={{ marginTop: space[6], gap: space[4] }}>
        {BENEFITS.map(({ title, body, Icon }) => (
          <View key={title} style={styles.benefit}>
            <Icon size={22} color={t.primary700} weight="regular" />
            <View style={{ flex: 1 }}>
              <Text token="heading3">{title}</Text>
              <Text token="body" color="textSecondary" style={{ marginTop: 2 }}>
                {body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Plans */}
      <View style={{ marginTop: space[8], gap: space[2] }}>
        {packages.length === 0 ? (
          <View style={{ padding: space[4], alignItems: 'center' }}>
            <Text token="body" color="textMuted">Loading plans…</Text>
          </View>
        ) : null}
        {packages.map((pkg) => {
          const isSelected = pkg.identifier === selected;
          const isAnnual = pkg.period === 'ANNUAL';
          const isLifetime = pkg.period === 'LIFETIME';
          return (
            <Pressable
              key={pkg.identifier}
              onPress={() => setSelected(pkg.identifier)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.plan,
                {
                  backgroundColor: t.surfaceElevated,
                  borderColor: isSelected ? t.primary700 : t.borderSubtle,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
                  <Text token="heading3">{pkg.product.title}</Text>
                  {isAnnual && (
                    <View style={[styles.badge, { backgroundColor: t.primary700 }]}>
                      <Text token="caption" style={{ color: t.textInverse, fontFamily: 'Figtree_700Bold' }}>
                        BEST VALUE
                      </Text>
                    </View>
                  )}
                  {isLifetime && (
                    <View style={[styles.badge, { backgroundColor: t.warning }]}>
                      <Text token="caption" style={{ color: t.textInverse, fontFamily: 'Figtree_700Bold' }}>
                        ★ LIMITED
                      </Text>
                    </View>
                  )}
                </View>
                <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                  {pkg.product.description}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text token="heading3">{pkg.product.priceString}</Text>
                {isAnnual ? (
                  <Text token="caption" color="textMuted">
                    per year
                  </Text>
                ) : pkg.period === 'MONTHLY' ? (
                  <Text token="caption" color="textMuted">
                    per month
                  </Text>
                ) : (
                  <Text token="caption" color="textMuted">
                    one-time
                  </Text>
                )}
              </View>
              {isSelected ? (
                <CheckCircle
                  size={20}
                  color={t.primary700}
                  weight="fill"
                  style={{ marginLeft: space[2] }}
                />
              ) : (
                <View style={[styles.radio, { borderColor: t.borderStrong, marginLeft: space[2] }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {err ? (
        <Text token="caption" style={{ color: t.error, marginTop: space[3], textAlign: 'center' }}>
          {err}
        </Text>
      ) : null}

      {/* Anonymous-user info card. Shown only when the user has no
          confirmed email — gives a heads-up that subscribing will
          route through email verification first, so the Subscribe tap
          doesn't feel like an unexpected redirect. Pro users always
          have a verified email going forward; this is what enables
          cross-device data restore. */}
      {!auth.hasConfirmedEmail ? (
        <View
          style={{
            marginTop: space[4],
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: t.surfaceSunken,
            borderWidth: 1,
            borderColor: t.borderSubtle,
            flexDirection: 'row',
            gap: space[2],
            alignItems: 'flex-start',
          }}
        >
          <ShieldCheck size={18} color={t.primary700} weight="duotone" />
          <Text token="caption" color="textSecondary" style={{ flex: 1, lineHeight: 18 }}>
            We&apos;ll ask for your email next — Pro members get cloud
            backup so your cat&apos;s history follows you to any device.
          </Text>
        </View>
      ) : null}

      {/* CTA */}
      <View style={{ marginTop: space[6] }}>
        <Button
          label={
            busy
              ? 'Working\u2026'
              : !selectedPkg
                ? 'Pick a plan'
                : isTrialEligible
                  ? 'Start 7-day free trial'
                  : selectedPkg.period === 'LIFETIME'
                    ? 'Get lifetime access'
                    : 'Subscribe'
          }
          onPress={onBuy}
          disabled={busy || !selectedPkg}
          size="lg"
          pill
          fullWidth
        />
        <Text
          token="caption"
          color="textMuted"
          style={{ marginTop: space[2], textAlign: 'center' }}
        >
          {isTrialEligible
            ? `Then ${selectedPkg?.product.priceString}/year. Cancel anytime in Play Store settings \u2014 no charge if you cancel before day 7.`
            : selectedPkg?.period === 'LIFETIME'
              ? 'One-time payment. No recurring charges.'
              : 'Renews monthly. Cancel anytime in Play Store settings.'}
        </Text>
      </View>

      {/* Trust badges */}
      <View style={styles.trustRow}>
        <TrustChip label="Cancel anytime" />
        <TrustChip label="No ads" />
        <TrustChip label="Privacy-first" />
      </View>

      {/* Restore + legal links */}
      <View style={{ marginTop: space[6], alignItems: 'center', gap: space[2] }}>
        <Pressable onPress={onRestore} hitSlop={12} accessibilityRole="button">
          <Text token="caption" color="primary700">
            Restore purchases
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: space[4] }}>
          <Pressable onPress={() => openUrl('https://catmd.pet/terms')}>
            <Text token="caption" color="textMuted">Terms</Text>
          </Pressable>
          <Pressable onPress={() => openUrl('https://catmd.pet/privacy')}>
            <Text token="caption" color="textMuted">Privacy</Text>
          </Pressable>
          <Pressable onPress={() => openUrl('https://catmd.pet/disclaimer')}>
            <Text token="caption" color="textMuted">Disclaimer</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function TrustChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: 6,
        borderRadius: radius.full,
        backgroundColor: t.surfaceSunken,
        borderWidth: 1,
        borderColor: t.borderSubtle,
      }}
    >
      <Text token="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  close: { alignSelf: 'flex-start', padding: space[1] },
  benefit: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  statsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[5],
  },
  statCard: {
    flex: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[4],
    borderRadius: radius.md,
    gap: space[2],
  },
  badge: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    justifyContent: 'center',
    marginTop: space[5],
  },
});
