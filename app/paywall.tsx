/**
 * Paywall — the single most important conversion surface in the app.
 *
 * Structure (conversion-optimized):
 *   1. Hero — emotional hook ("Unlock everything for {Luna}")
 *   2. Trust stats — factual social proof (not fake testimonials)
 *   3. Benefits — 4 key differentiators
 *   4. Plans — annual selected by default (with 7-day trial), monthly
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
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
  Tag,
  X,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { useChatStore } from '../src/state/chatStore';
import { useDiaryStore } from '../src/state/diaryStore';
import { useHealthStore } from '../src/state/healthStore';
import { useScanStore } from '../src/state/scanStore';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';
import {
  findPackageByProductId,
  invalidateProAccessCache,
  listOfferings,
  purchasePackage,
  restorePurchases,
  setPartnerCodeAttribute,
  type CatMdPackage,
} from '../src/services/purchases';
import { validatePartnerCode } from '../src/services/partnerCode';

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

// 2026-05-12: source enum expanded to cover every AI feature the new
// universal `requireProAccess()` gate routes through. Keeps PostHog
// `paywall_viewed` event cardinality bounded.
type PaywallSource =
  | 'scan_quota'
  | 'settings'
  | 'cats'
  | 'scan'
  | 'behavior'
  | 'translate'
  | 'diary'
  | 'postcard'
  | 'cat_studio'
  | 'chat'
  | 'pain'
  | 'pdf_export'
  | 'multi_cat'
  | 'day_14_soft';
const VALID_SOURCES: readonly PaywallSource[] = [
  'scan_quota',
  'settings',
  'cats',
  'scan',
  'behavior',
  'translate',
  'diary',
  'postcard',
  'cat_studio',
  'chat',
  'pain',
  'pdf_export',
  'multi_cat',
  'day_14_soft',
] as const;

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

  // ── Partner code state (audit 2026-05-17) ─────────────────────────
  // When a code is applied, we override the user's selected package
  // with the discounted partner product (`pro_annual_partner`) and tag
  // the RC user with the code id so the webhook can attribute the
  // resulting purchase to the right partner.
  type AppliedCode = {
    codeId: string;
    productId: string;
    partnerName: string;
    code: string;
  };
  const [appliedCode, setAppliedCode] = useState<AppliedCode | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeApplying, setCodeApplying] = useState(false);
  // When a code is applied, this package overrides `selectedPkg` at
  // purchase time. Loaded lazily from the RC offering after validation.
  const [partnerPackage, setPartnerPackage] = useState<CatMdPackage | null>(null);

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
  // When a partner code is applied, the partner package overrides the
  // user-selected one at purchase time. The plan cards stay visible
  // (so the user understands what they're getting) but the CTA points
  // at the discounted product.
  const effectivePkg = appliedCode && partnerPackage ? partnerPackage : selectedPkg;
  const isTrialEligible = effectivePkg?.period === 'ANNUAL';

  // Apply a code: validate via Supabase, then resolve the RC package
  // for the discounted product. If either step fails, surface a clear
  // error and leave the UI in its previous state.
  const applyPartnerCode = async () => {
    setCodeApplying(true);
    setCodeError(null);
    const codeLen = codeInput.trim().length;
    try {
      const result = await validatePartnerCode(codeInput);
      if (!result.ok) {
        setCodeError(result.message);
        // Telemetry: which failure modes are most common? (audit P2-1)
        void import('../src/services/analytics').then(({ track }) =>
          track({
            type: 'partner_code_apply_attempted',
            props: { code_length: codeLen, outcome: result.reason },
          }),
        );
        return;
      }
      // Find the discounted product in the current RC offering. If it
      // isn't there, the store side isn't fully set up yet — fail
      // gracefully with an actionable error.
      const pkg = await findPackageByProductId(result.productId);
      if (!pkg) {
        setCodeError(
          'This code is valid, but the discounted plan isn\'t available right now. Try again in a moment.',
        );
        void import('../src/services/analytics').then(({ track }) =>
          track({
            type: 'partner_code_apply_attempted',
            props: { code_length: codeLen, outcome: 'product_unavailable' },
          }),
        );
        return;
      }
      // Tag the RC user so the webhook can attribute the purchase.
      // Fire-and-forget — the actual write happens server-side and the
      // SDK caches the attribute until the next sync.
      await setPartnerCodeAttribute(result.codeId);
      const upperCode = codeInput.trim().toUpperCase();
      setAppliedCode({
        codeId: result.codeId,
        productId: result.productId,
        partnerName: result.partnerName,
        code: upperCode,
      });
      setPartnerPackage(pkg);
      // P1-2 fix: auto-select the annual plan card so the radio/UI
      // matches what the user will actually be charged. Codes today
      // unlock annual only. If we ever ship monthly partner codes,
      // this needs to read from the package period.
      const annualPkg = packages.find((p) => p.period === 'ANNUAL');
      if (annualPkg) setSelected(annualPkg.identifier);

      void import('../src/services/analytics').then(({ track }) => {
        track({
          type: 'partner_code_apply_attempted',
          props: { code_length: codeLen, outcome: 'valid' },
        });
        track({
          type: 'partner_code_applied',
          props: {
            code: upperCode,
            partner_name: result.partnerName,
            product_id: result.productId,
          },
        });
      });

      setCodeModalOpen(false);
      setCodeInput('');
    } finally {
      setCodeApplying(false);
    }
  };

  const removePartnerCode = async () => {
    // Clear the RC attribute too — important so a user who applies and
    // then removes the code doesn't get attributed when they buy at
    // full price.
    await setPartnerCodeAttribute(null);
    setAppliedCode(null);
    setPartnerPackage(null);
  };

  const onBuy = async () => {
    // When a partner code is applied, purchase the discounted product
    // (effectivePkg); otherwise the user-selected one.
    const pkgToBuy = effectivePkg;
    if (!pkgToBuy) return;
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
      const ok = await purchasePackage(pkgToBuy);
      if (ok) {
        // Invalidate the silent-background entitlement cache so the
        // next photo-add / clip / chat turn picks up the new Pro
        // state immediately. useEntitlement on the next screen will
        // also re-fire on AppState foreground.
        invalidateProAccessCache();
        void import('../src/services/analytics').then(({ track, flushAnalytics }) => {
          track({
            type: 'paywall_converted',
            props: { period: pkgToBuy.period },
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
      if (ok) {
        invalidateProAccessCache();
        router.replace('/(main)');
      } else {
        setErr('No active subscription found on this account.');
      }
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
          {source === 'day_14_soft'
            ? `Keep going with ${cat?.name ?? 'your cat'}.`
            : `Unlock everything${cat?.name ? ` for ${cat.name}` : ''}.`}
        </Text>
        <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[3] }}>
          {source === 'day_14_soft' ? (
            <PersonalisedHeroBody catName={cat?.name ?? 'your cat'} catId={cat?.id ?? null} />
          ) : (
            <>
              Cats hide pain. Pro gives you every tool to catch what they don&rsquo;t show —
              before it becomes an emergency.
            </>
          )}
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
          // Lifetime tier removed 2026-05-12 per strategy doc — keeps
          // recurring engine intact. Annual + Monthly only.
          //
          // P1-2 fix (audit 2026-05-17): when a partner code is applied,
          // the monthly card is non-tappable. Codes today unlock annual
          // only; allowing the user to "select" monthly while applied
          // creates a confusing state where the radio dot disagrees
          // with what gets charged. We dim + ignore taps on non-annual
          // cards while a code is active.
          const codeLockedOut = !!appliedCode && !isAnnual;
          return (
            <Pressable
              key={pkg.identifier}
              onPress={
                codeLockedOut
                  ? undefined
                  : () => setSelected(pkg.identifier)
              }
              disabled={codeLockedOut}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: codeLockedOut }}
              style={[
                styles.plan,
                {
                  backgroundColor: t.surfaceElevated,
                  borderColor: isSelected ? t.primary700 : t.borderSubtle,
                  borderWidth: isSelected ? 2 : 1,
                  opacity: codeLockedOut ? 0.5 : 1,
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
                ) : (
                  <Text token="caption" color="textMuted">
                    per month
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

      {/* ── Partner code (audit 2026-05-17) ───────────────────────
          Below the plan cards: "Have a partner code?" link, or the
          applied-code badge if a code is active. Tap opens a modal
          for code entry. Applying swaps the purchase target to the
          discounted partner product. */}
      {appliedCode ? (
        <View
          style={{
            marginTop: space[4],
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: t.primary100,
            borderWidth: 1,
            borderColor: t.primary700,
            flexDirection: 'row',
            gap: space[2],
            alignItems: 'center',
          }}
        >
          <Tag size={18} color={t.primary700} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text token="body" style={{ fontWeight: '600' }}>
              {appliedCode.code} applied · 30% off
            </Text>
            <Text token="caption" color="textMuted">
              Partner: {appliedCode.partnerName}
              {partnerPackage?.product?.priceString
                ? ` · ${partnerPackage.product.priceString}`
                : ''}
            </Text>
          </View>
          <Pressable
            onPress={removePartnerCode}
            hitSlop={10}
            accessibilityLabel="Remove partner code"
          >
            <X size={18} color={t.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setCodeError(null);
            setCodeInput('');
            setCodeModalOpen(true);
            // Funnel telemetry — top of the coupon sub-funnel (audit P2-1)
            void import('../src/services/analytics').then(({ track }) =>
              track({ type: 'partner_code_modal_opened' }),
            );
          }}
          hitSlop={8}
          style={{ marginTop: space[3], alignItems: 'center' }}
          accessibilityRole="button"
        >
          <Text token="caption" color="primary700">
            Have a partner code?
          </Text>
        </Pressable>
      )}

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
            ? `Then ${effectivePkg?.product.priceString}/year. Cancel anytime in Play Store settings \u2014 no charge if you cancel before day 7.`
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

      {/* Partner code entry modal (audit 2026-05-17) */}
      <Modal
        visible={codeModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCodeModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: t.surface }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              paddingTop: insets.top + space[3],
              paddingHorizontal: space[5],
              paddingBottom: space[1],
              flexDirection: 'row',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable
              onPress={() => setCodeModalOpen(false)}
              hitSlop={12}
              accessibilityLabel="Close"
            >
              <X size={22} color={t.textSecondary} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
            <Text token="heading1">Have a partner code?</Text>
            <Text token="body" color="textSecondary" style={{ marginTop: space[2] }}>
              Enter the code from your favourite cat creator to unlock
              30% off the annual plan.
            </Text>
            <TextInput
              value={codeInput}
              onChangeText={(v) => {
                setCodeInput(v);
                if (codeError) setCodeError(null);
              }}
              placeholder="e.g. NALA30"
              placeholderTextColor={t.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={32}
              style={{
                marginTop: space[5],
                padding: space[3],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: codeError ? t.error : t.borderStrong,
                backgroundColor: t.surface,
                color: t.textPrimary,
                fontFamily: 'JetBrainsMono_500Medium',
                fontSize: 18,
                letterSpacing: 1.5,
              }}
            />
            {codeError ? (
              <Text
                token="caption"
                style={{ color: t.error, marginTop: space[2] }}
              >
                {codeError}
              </Text>
            ) : null}
            <Button
              label={codeApplying ? 'Checking…' : 'Apply code'}
              onPress={applyPartnerCode}
              disabled={codeApplying || codeInput.trim().length < 3}
              size="lg"
              pill
              fullWidth
              style={{ marginTop: space[5] }}
            />
            <Text
              token="caption"
              color="textMuted"
              style={{ marginTop: space[3], textAlign: 'center', lineHeight: 18 }}
            >
              Codes are case-insensitive. One code per purchase.
              Codes can&apos;t be combined with other offers.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

/**
 * PersonalisedHeroBody — reads the cat's real usage numbers from the
 * stores and weaves them into a screenshot-worthy hero copy block.
 *
 * Only used when `source === 'day_14_soft'` — the auto-shown end-of-
 * trial paywall. SoSA finding: specific personal numbers convert
 * meaningfully better than generic feature lists. The numbers are
 * factual (logged events) so the copy can't lie.
 *
 * Hidden gracefully when the user has no usage at all (cold launch
 * edge case) — falls back to a generic line.
 */
function PersonalisedHeroBody({
  catName,
  catId,
}: {
  catName: string;
  catId: string | null;
}) {
  const thread = useChatStore((s) => (catId ? (s.threads[catId] ?? []) : []));
  const diaryEntries = useDiaryStore((s) =>
    catId ? s.getEntriesForCat(catId) : [],
  );
  const events = useHealthStore((s) => s.events);
  const scans = useScanStore((s) => s.scans);

  const chatTurns = thread.filter((t) => t.role === 'user').length;
  const diaryCount = diaryEntries.length;
  const translations = catId
    ? events.filter((e) => e.cat_id === catId && e.type === 'meow_translation').length
    : 0;
  const bodyLanguageReads = catId
    ? events.filter((e) => e.cat_id === catId && e.type === 'behavior_observation').length
    : 0;
  const scanCount = catId ? scans.filter((s) => s.cat_id === catId).length : 0;

  // Fire telemetry once per render with the personalised numbers — lets
  // us segment converters vs non-converters by activation level.
  useEffect(() => {
    void import('../src/services/analytics').then(({ track }) =>
      track({
        type: 'paywall_day14_shown',
        props: {
          chat_turns_used: chatTurns,
          diary_entries: diaryCount,
          translations,
          body_language_reads: bodyLanguageReads,
          scans: scanCount,
        },
      }),
    );
    // Eslint: we intentionally fire once per mount — not on every count change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick the strongest 2-3 numbers — order by which is most likely to
  // emotionally land. Chat turns > translations > diary > body-lang > scans.
  const beats: string[] = [];
  if (chatTurns >= 5) beats.push(`${chatTurns} messages you sent ${catName}`);
  if (translations >= 1) beats.push(`${translations} meow${translations === 1 ? '' : 's'} translated`);
  if (diaryCount >= 2) beats.push(`${diaryCount} diary entries ${catName} has written`);
  if (bodyLanguageReads >= 1)
    beats.push(`${bodyLanguageReads} body-language read${bodyLanguageReads === 1 ? '' : 's'}`);
  if (scanCount >= 1) beats.push(`${scanCount} scan${scanCount === 1 ? '' : 's'} on file`);

  // If somehow no usage at all, fall back to generic.
  if (beats.length === 0) {
    return (
      <>
        Your 14-day trial is up. Pick a plan to keep chat, diary, the
        meow translator, body-language reads, and triage scans for {catName}.
      </>
    );
  }

  const list = beats.slice(0, 3).join(', ');
  return (
    <>
      Two weeks with {catName} so far — {list}. Pick a plan to keep
      it all going.
    </>
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
