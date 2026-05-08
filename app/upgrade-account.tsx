/**
 * Upgrade-account — email + password → 6-digit OTP verify → confirmed.
 *
 * We use OTP instead of magic links because mobile magic-link flows have
 * three failure modes that kill conversion:
 *   1. Gmail prefetches the URL for safe-browsing, consuming the single-
 *      use token before the user ever taps it.
 *   2. The deep link back to the app can mis-route on Android.
 *   3. The browser→app AppState transition doesn't always fire the
 *      session refresh, leaving the UI in a stale "still pending" state.
 *
 * OTP avoids all three: the user stays in the app the whole time, pastes
 * a 6-digit code from their inbox, and hits Verify. Same flow Signal /
 * WhatsApp / Telegram use.
 *
 * State machine:
 *   - `form`  — enter email + password
 *   - `otp`   — 6 digit boxes + Resend + "use a different email"
 *   - `done`  — success splash, auto-route back
 * The user's auth state (pendingEmail / pendingFlow) seeds the OTP stage
 * automatically if they leave and return mid-flow.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Envelope, LockSimple } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';
import {
  addEmailToAccount,
  resendEmailOtp,
  verifyEmailOtp,
  type EmailOtpFlow,
} from '../src/services/auth';
import { identifyPurchasesUser } from '../src/services/purchases';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { validateEmail } from '../src/utils/email';

type Stage = 'form' | 'otp' | 'done';

export default function UpgradeAccountScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gate } = useLocalSearchParams<{ gate?: string }>();
  const auth = useAuthSession();

  // Seed from server state: if the user already has a pending email, jump
  // straight to the OTP stage with their pending address + flow preloaded.
  const seededEmail = auth.pendingEmail ?? '';
  const seededFlow: EmailOtpFlow | null = auth.pendingFlow;

  const [stage, setStage] = useState<Stage>(seededFlow ? 'otp' : 'form');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string>(seededEmail);
  const [flow, setFlow] = useState<EmailOtpFlow | null>(seededFlow);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resentAt, setResentAt] = useState<number | null>(null);

  // When the auth hook loads for the first time (or flips state) and we
  // learn there's a pending email we didn't have at mount, jump to OTP.
  useEffect(() => {
    if (auth.loading) return;
    if (auth.hasConfirmedEmail) {
      setStage('done');
      const t = setTimeout(() => router.replace('/(main)'), 600);
      return () => clearTimeout(t);
    }
    if (auth.pendingFlow && stage === 'form') {
      setPendingEmail(auth.pendingEmail ?? '');
      setFlow(auth.pendingFlow);
      setStage('otp');
    }
  }, [auth.loading, auth.hasConfirmedEmail, auth.pendingFlow, auth.pendingEmail, stage, router]);

  if (!auth.loading && auth.hasConfirmedEmail && stage !== 'done') {
    // Race-condition guard: while the effect above is scheduling, avoid
    // rendering the form for a confirmed user.
    return <DoneSplash />;
  }

  if (stage === 'done') return <DoneSplash />;

  // ── form stage ──────────────────────────────────────────────────────────
  const onSubmitForm = async () => {
    setErr(null);
    const check = validateEmail(emailInput);
    if (!check.ok) {
      setErr(check.reason);
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'email_added', props: { disposable_rejected: true } }),
      );
      return;
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      // addEmailToAccount picks updateUser vs signUp based on whether a
      // session exists. The flow type we'll need for verify is 'email_change'
      // in the updateUser path, 'signup' in the signUp path.
      const sessionExisted = !!auth.user;
      const nextFlow: EmailOtpFlow = sessionExisted ? 'email_change' : 'signup';
      const trimmedEmail = emailInput.trim().toLowerCase();
      const user = await addEmailToAccount(trimmedEmail, password);
      if (user?.id) await identifyPurchasesUser(user.id);
      setPendingEmail(trimmedEmail);
      setFlow(nextFlow);
      setStage('otp');
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'email_added', props: {} }),
      );
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── otp stage ───────────────────────────────────────────────────────────
  const onVerify = async () => {
    if (!flow || !pendingEmail) return;
    setErr(null);
    setBusy(true);
    try {
      await verifyEmailOtp(pendingEmail, code, flow);
      setStage('done');

      // PostHog alias — bind the (anonymous) distinct_id used since
      // first launch to the user's email so the support workflow can
      // find them by the email they reach out from. After this point,
      // PostHog dashboards key on email instead of an opaque uuid.
      // Fire-and-forget; failures never block the verification.
      void import('../src/services/analytics').then(({ identify, track }) => {
        try {
          identify(pendingEmail, { email: pendingEmail });
        } catch {
          // identify is best-effort
        }
        track({ type: 'email_confirmed' });
      });

      // Cloud restore — if this is a returning user who reinstalled
      // (cats / scans / events sit in Supabase keyed by their auth.uid,
      // and that auth.uid resolves to the same row when they sign in
      // again with the same email), pull their data and apply to the
      // local Zustand stores. No-op when local has data OR cloud has
      // none — see `restoreFromCloudIfNeeded` for the gate logic.
      // Fire-and-forget: a failure here shouldn't block the user from
      // proceeding into the app. The Settings entry point (added in a
      // follow-up) will be the manual retry path.
      void import('../src/services/sync').then(async ({ restoreFromCloudIfNeeded }) => {
        try {
          const summary = await restoreFromCloudIfNeeded();
          if (summary.skipped === null) {
            const { track } = await import('../src/services/analytics');
            track({
              type: 'cloud_restore_succeeded',
              props: {
                cats: summary.appliedCats,
                scans: summary.appliedScans,
                events: summary.appliedEvents,
              },
            });
          }
        } catch (e) {
          // Log + telemetry. Counts of cloud_restore_failed over total
          // email_confirmed give us the broken-restore rate per release.
          console.warn('[CatMD] cloud restore on verify failed:', e);
          try {
            const { track } = await import('../src/services/analytics');
            const reason = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
            track({ type: 'cloud_restore_failed', props: { reason } });
          } catch {
            // Telemetry is best-effort; if even THAT fails, the only
            // thing left is the console.warn above.
          }
        }
      });

      setTimeout(() => router.replace('/(main)'), 900);
    } catch (e: any) {
      setErr(e?.message ?? 'That code didn\u2019t work. Check for typos or try resend.');
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (!flow || !pendingEmail) return;
    setErr(null);
    setBusy(true);
    try {
      await resendEmailOtp(pendingEmail, flow);
      setResentAt(Date.now());
      setCode('');
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'email_resent' }),
      );
    } catch (e: any) {
      setErr(e?.message ?? 'Could not resend. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  const onUseDifferentEmail = () => {
    setStage('form');
    setCode('');
    setResentAt(null);
    setErr(null);
    // Preload the email input with the pending one so the user can edit
    // rather than re-type.
    if (pendingEmail) setEmailInput(pendingEmail);
  };

  const heading =
    stage === 'otp'
      ? 'Enter the 6-digit code'
      : gate === 'email'
        ? 'Confirm your email to keep scanning'
        : 'Create your CatMD account';
  const subheading =
    stage === 'otp'
      ? `We sent a code to ${pendingEmail}. It expires in an hour.`
      : gate === 'email'
        ? 'Free plan gives 3 scans per month \u2014 unlocked after a quick email check.'
        : 'One email, three free scans per month, data syncs across devices.';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.root,
          {
            paddingTop: insets.top + space[4],
            paddingBottom: insets.bottom + space[8],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text token="displayLg">{heading}</Text>
        <Text
          token="bodyLg"
          color="textSecondary"
          style={{ marginTop: space[3] }}
        >
          {subheading}
        </Text>

        {stage === 'form' ? (
          <FormStage
            email={emailInput}
            setEmail={setEmailInput}
            password={password}
            setPassword={setPassword}
            err={err}
            busy={busy}
            onSubmit={onSubmitForm}
          />
        ) : (
          <OtpStage
            code={code}
            setCode={setCode}
            err={err}
            busy={busy}
            resentAt={resentAt}
            onVerify={onVerify}
            onResend={onResend}
            onUseDifferentEmail={onUseDifferentEmail}
          />
        )}

        <Text
          token="caption"
          color="textMuted"
          style={{ marginTop: space[8], textAlign: 'center' }}
        >
          Your billing (if any) follows your Google/Apple account separately —
          adding an email here does NOT affect your subscription.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── sub-components ────────────────────────────────────────────────────────

function FormStage(props: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  err: string | null;
  busy: boolean;
  onSubmit: () => void;
}) {
  const t = useTheme();
  return (
    <>
      <View style={{ marginTop: space[6] }}>
        <Label>Email</Label>
        <Input
          value={props.email}
          onChangeText={props.setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Label>Password (6+ chars)</Label>
        <Input
          value={props.password}
          onChangeText={props.setPassword}
          placeholder="at least 6 characters"
          secureTextEntry
          autoComplete="password-new"
        />
      </View>

      {props.err ? (
        <Text token="caption" style={{ color: t.error, marginTop: space[3] }}>
          {props.err}
        </Text>
      ) : null}

      <View style={{ marginTop: space[6] }}>
        <Button
          label={props.busy ? 'Sending\u2026' : 'Send 6-digit code'}
          onPress={props.onSubmit}
          disabled={
            props.busy ||
            props.email.trim().length < 5 ||
            props.password.length < 6
          }
          leftIcon={<Envelope size={16} color={t.textInverse} weight="bold" />}
          size="lg"
          pill
          fullWidth
        />
        <Text
          token="caption"
          color="textMuted"
          style={{ textAlign: 'center', marginTop: space[2] }}
        >
          We never sell or share your email.
        </Text>
      </View>
    </>
  );
}

function OtpStage(props: {
  code: string;
  setCode: (v: string) => void;
  err: string | null;
  busy: boolean;
  resentAt: number | null;
  onVerify: () => void;
  onResend: () => void;
  onUseDifferentEmail: () => void;
}) {
  const t = useTheme();
  const inputRef = useRef<TextInput>(null);

  // Auto-focus the OTP input on mount so the user can start typing /
  // pasting immediately.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, []);

  // Split the code into six boxes. A single hidden TextInput captures
  // all characters (works with paste, autofill from SMS on iOS, and
  // Gboard's OTP autocomplete on Android). The boxes are visual-only.
  const boxes = useMemo(() => {
    const arr = new Array<string>(6).fill('');
    for (let i = 0; i < Math.min(props.code.length, 6); i++) {
      arr[i] = props.code[i] ?? '';
    }
    return arr;
  }, [props.code]);

  return (
    <View style={{ marginTop: space[6] }}>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={styles.otpRow}>
          {boxes.map((digit, i) => {
            const active = i === props.code.length;
            return (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  {
                    borderColor: active ? t.primary700 : t.borderStrong,
                    backgroundColor: t.surfaceElevated,
                  },
                ]}
              >
                <Text
                  token="heading1"
                  style={{ color: t.textPrimary, fontFamily: 'JetBrainsMono_500Medium' }}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>
      {/* Hidden input that receives the actual characters */}
      <TextInput
        ref={inputRef}
        value={props.code}
        onChangeText={(v) => props.setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        style={styles.hiddenInput}
      />

      {props.err ? (
        <Text token="caption" style={{ color: t.error, marginTop: space[3], textAlign: 'center' }}>
          {props.err}
        </Text>
      ) : null}
      {props.resentAt ? (
        <Text token="caption" color="textMuted" style={{ marginTop: space[2], textAlign: 'center' }}>
          Sent again at {new Date(props.resentAt).toLocaleTimeString()}. Give it 30 seconds.
        </Text>
      ) : null}

      <Button
        label={props.busy ? 'Verifying\u2026' : 'Verify'}
        onPress={props.onVerify}
        disabled={props.busy || props.code.length !== 6}
        leftIcon={<LockSimple size={16} color={t.textInverse} weight="bold" />}
        size="lg"
        pill
        fullWidth
        style={{ marginTop: space[5] }}
      />

      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
        <Button
          label="Resend code"
          variant="ghost"
          onPress={props.onResend}
          disabled={props.busy}
          style={{ flex: 1 }}
        />
        <Button
          label="Use a different email"
          variant="ghost"
          onPress={props.onUseDifferentEmail}
          disabled={props.busy}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function DoneSplash() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.centered,
        {
          backgroundColor: t.surface,
          paddingTop: insets.top + space[10],
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <CheckCircle size={72} color={t.success} weight="fill" />
      <Text token="heading1" align="center" style={{ marginTop: space[4] }}>
        Email confirmed
      </Text>
      <Text token="bodyLg" color="textSecondary" align="center" style={{ marginTop: space[1] }}>
        Your data now syncs across devices.
      </Text>
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      token="caption"
      color="textSecondary"
      style={{ marginTop: space[3], marginBottom: 6 }}
    >
      {children}
    </Text>
  );
}

function Input(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: string;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={t.textMuted}
      keyboardType={props.keyboardType ?? 'default'}
      secureTextEntry={props.secureTextEntry}
      autoCapitalize={props.autoCapitalize}
      autoComplete={props.autoComplete as any}
      style={{
        height: 48,
        paddingHorizontal: space[4],
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: t.borderStrong,
        backgroundColor: t.surfaceElevated,
        color: t.textPrimary,
        fontFamily: 'Figtree_400Regular',
        fontSize: 16,
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: space[5],
  },
  otpRow: {
    flexDirection: 'row',
    gap: space[2],
    justifyContent: 'space-between',
  },
  otpBox: {
    flex: 1,
    aspectRatio: 0.8,
    maxHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    left: -9999,
    height: 1,
    width: 1,
    opacity: 0,
  },
});
