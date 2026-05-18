/**
 * Scan screen — describe a concern or attach a photo, run triage.
 *
 * V1: text-first input + optional image upload (the image is stored
 * locally with the scan record; vision multi-modal analysis is queued
 * for v2). The one primary action here is "Run triage". Per design rule:
 * one primary action per screen.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Stethoscope, X } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useCatStore, resolveCatAgeMonths } from '../src/state/catStore';
import { useScanStore, triageToScanRecord, recentScansSummary, type ScanMode } from '../src/state/scanStore';
import { runTriage } from '../src/ai/triage';
import type { CatProfileSummary } from '../src/ai/prompts';
import { useScanQuota } from '../src/hooks/useScanQuota';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

// Cat-themed "thinking" words shown while triage runs. Cycles every ~1.4s to
// reassure the user that the app is processing (not stuck) during the 15-30s
// AI call. Mix of cat behaviors + sounds — feels alive without being too cute.
const CAT_THINKING_WORDS = [
  'mewing', 'purring', 'kneading', 'blepping', 'loafing',
  'biscuit-making', 'sniffing', 'head-bonking', 'slow-blinking', 'chittering',
  'stalking', 'grooming', 'stretching', 'yawning', 'padding softly',
  'mrrping', 'trilling', 'brrrping', 'side-eyeing', 'tail-flicking',
  'ear-perking', 'whisker-twitching', 'paw-tapping', 'mlemming', 'blooping',
  'perching', 'lurking', 'derping', 'snooting', 'consulting the Merck Manual',
];

export default function ScanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Unified scan flow — no mode picker. The photo (if any) is classified
  // just before triage runs; the classifier result selects the right
  // specialized system prompt. Text-only scans always use the general
  // prompt. This keeps the user-facing UX simple while preserving the
  // litter-box-specific clinical framework internally.
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const addScan = useScanStore((s) => s.addScan);
  const updateScan = useScanStore((s) => s.updateScan);
  const allScans = useScanStore((s) => s.scans);
  const recentScans = useMemo(
    () => (cat ? allScans.filter((x) => x.cat_id === cat.id) : allScans),
    [allScans, cat],
  );
  const quota = useScanQuota();
  const auth = useAuthSession();

  const heading = `What's going on with ${cat?.name ?? 'your cat'}?`;
  const subheading =
    'Describe what you\u2019re seeing, or snap a photo — a cat, their litter box, urine, or stool. Include when it started and anything unusual.';
  // Placeholder uses the cat's name (or "they") so it doesn't pre-
  // suppose gender. Pre 2026-05-09 this hardcoded "She hasn't eaten"
  // and felt wrong for users with male cats.
  const placeholderName = cat?.name ?? 'They';
  const placeholder =
    `e.g. ${placeholderName} hasn't eaten since yesterday and keeps hiding under the bed. Or: straining in the litter box with pink tinge.`;
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(0);

  // Cycle the cat-thinking word while triage is running so users get
  // continuous "I'm processing" feedback during the 15-30s AI call.
  useEffect(() => {
    if (!busy) return;
    setThinkingIndex(0);
    const id = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % CAT_THINKING_WORDS.length);
    }, 1400);
    return () => clearInterval(id);
  }, [busy]);

  // Common picker options. We don't enable `allowsEditing` — on Android
  // that launches a native crop UI whose only button is labelled "CROP",
  // which owners mistake for "enter crop mode" rather than "confirm".
  // The AI accepts any aspect ratio; the preview + result screen render
  // with a 1:1 aspectRatio + resizeMode="cover" so framing stays clean.
  const pickerOpts = {
    quality: 0.7,
    base64: true as const,
  };

  const applyAsset = (a: ImagePicker.ImagePickerAsset | undefined) => {
    if (!a) return;
    setImageUri(a.uri);
    setImageBase64(a.base64 ?? null);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission denied.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      ...pickerOpts,
    });
    if (!r.canceled) applyAsset(r.assets[0]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission denied.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync(pickerOpts);
    if (!r.canceled) applyAsset(r.assets[0]);
  };

  const onRun = async () => {
    if (!text.trim()) return;

    // Free-tier gate: if out of free scans and not Pro, route to paywall.
    if (!quota.canScan) {
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'scan_blocked_by_quota' }),
      );
      router.push({ pathname: '/paywall', params: { source: 'scan_quota' } });
      return;
    }

    // Email-confirmation gate: anonymous users get exactly one free scan
    // before we require a confirmed email. This closes the reinstall
    // loophole — scan #2+ requires access to a real inbox, so wiping the
    // app no longer resets the quota once someone has confirmed.
    if (!quota.isPro && quota.used >= 1 && !auth.hasConfirmedEmail) {
      void import('../src/services/analytics').then(({ track }) =>
        track({ type: 'scan_blocked_by_email_gate' }),
      );
      router.push({ pathname: '/upgrade-account', params: { gate: 'email' } });
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const profile: CatProfileSummary | null = cat
        ? {
            name: cat.name,
            breed: cat.breed,
            // Resolve age fresh from dob_iso when present — keeps age live
            // as the cat actually ages, doesn't rely on stored snapshot.
            age_months: resolveCatAgeMonths(cat),
            weight_kg: cat.weight_kg,
            sex: cat.sex,
            indoor_outdoor: cat.indoor_outdoor,
            conditions: cat.conditions,
            medications: cat.medications,
          }
        : null;

      // Auto-classify the image (if any) and use the result both to:
      //   (a) pick the right specialized triage prompt (general vs litter_box)
      //   (b) BLOCK the triage entirely if the photo is high-confidence
      //       not-cat-related (garden, pizza, person, etc.) so we don't
      //       hallucinate a triage assessment on irrelevant content.
      // Latency: ~1-2s on gpt-4o-mini. Errors here soft-fail to 'general'.
      const { classifyPhotoFull } = await import('../src/ai/classify');
      const classification = await classifyPhotoFull(imageBase64);

      const analytics = await import('../src/services/analytics');

      // Relevance gate. If the model is high-confidence the photo isn't
      // cat-related, refuse the triage and surface the model's reason
      // so the user knows why. They can remove the photo and retry, or
      // attach a real cat / litter photo.
      if (classification.mode === 'irrelevant') {
        analytics.track({
          type: 'scan_rejected_irrelevant_photo',
          props: { kind: classification.kind, reason: classification.reason.slice(0, 120) },
        });
        setBusy(false);
        setError(
          `That photo doesn't look cat-related — ${classification.reason} ` +
            `Remove the photo (or attach a cat / litter-box photo) and try again.`,
        );
        return;
      }

      const detectedMode: ScanMode = classification.mode;

      analytics.track({
        type: 'scan_submitted',
        props: {
          has_photo: !!imageBase64,
          text_length: text.trim().length,
          mode: detectedMode,
        },
      });
      // Unified activation event for marketing-attribution funnels
      // (audit 2026-05-16). Fires alongside the granular event so
      // dashboards can union-filter on `core_feature_used` to measure
      // activation-by-install-source.
      analytics.track({ type: 'core_feature_used', props: { feature: 'scan' } });
      if (imageBase64) {
        analytics.track({
          type: 'scan_classified',
          props: { kind: detectedMode, mode_selected: detectedMode },
        });
      }

      // Build the shared CatContext so triage sees the same data every
      // other AI module sees — recent triage outcomes, behaviour-tag
      // patterns, conditions/medications. The legacy `catProfile` is
      // still passed for any prompt code that hasn't migrated yet.
      const catContext = cat
        ? (await import('../src/services/catContext')).buildCatContext(cat.id)
        : null;
      const result = await runTriage({
        userInput: text.trim(),
        catProfile: profile,
        catContext,
        recentScansSummary: recentScansSummary(recentScans),
        imageBase64,
        mode: detectedMode,
      });

      analytics.track({
        type: 'scan_result',
        props: {
          urgency: result.urgency,
          score: result.score,
          confidence: result.confidence,
          had_red_flags: result.red_flags.length > 0,
          hard_urgency: result._hard_urgency,
        },
      });
      const rec = triageToScanRecord(cat?.id ?? 'unknown', text.trim(), imageUri, result, detectedMode);
      addScan(rec);

      // Bump the server-side scan counter. Optimistically update the
      // hook so the UI reflects the new count immediately; the next
      // refresh reconciles against authoritative state.
      quota.incrementOptimistic();
      void import('../src/services/quota').then(({ incrementScanUsage }) =>
        incrementScanUsage(),
      );
      // Schedule a one-shot "how is {cat} doing?" check-in. Dynamic-imported
      // so `expo-notifications` isn't loaded at app boot — it crashes Expo Go
      // on Android. Best-effort: silently skipped in Expo Go.
      if (cat) {
        void import('../src/services/outcomeCheck')
          .then(({ scheduleOutcomeCheck }) =>
            scheduleOutcomeCheck({
              scanId: rec.id,
              catId: cat.id,
              catName: cat.name,
              urgency: rec.urgency,
            }),
          )
          .then((notifId) => {
            if (notifId) updateScan(rec.id, { outcome_notif_id: notifId });
          })
          .catch(() => {});
      }
      router.replace({ pathname: '/result', params: { id: rec.id } });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + space[8] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text token="heading1">{heading}</Text>
        <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[1] }}>
          {subheading}
        </Text>

        {/* Pre-flight nudge: if the email gate will trigger on submit,
            surface it up front so the user doesn't type a full scan and
            then get routed away. Same check as in onRun — keep in sync. */}
        {!quota.isPro && quota.used >= 1 && !auth.hasConfirmedEmail ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/upgrade-account', params: { gate: 'email' } })
            }
            accessibilityRole="button"
            accessibilityLabel="Confirm your email to continue scanning"
            style={({ pressed }) => [
              {
                marginTop: space[3],
                padding: space[3],
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.primary300,
                backgroundColor: t.primary50,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text token="body" color="primary700" style={{ fontFamily: 'Figtree_600SemiBold' }}>
              Confirm your email to keep scanning
            </Text>
            <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
              Free plan gives 3 scans per month — unlocked after a 6-digit email check.
            </Text>
          </Pressable>
        ) : null}

        <TextInput
          multiline
          editable={!busy}
          placeholder={placeholder}
          placeholderTextColor={t.textMuted}
          value={text}
          onChangeText={setText}
          style={{
            marginTop: space[5],
            minHeight: 140,
            padding: space[4],
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.borderStrong,
            backgroundColor: busy ? t.surfaceSunken : t.surfaceElevated,
            color: t.textPrimary,
            fontFamily: 'Figtree_400Regular',
            fontSize: 16,
            lineHeight: 24,
            textAlignVertical: 'top',
            opacity: busy ? 0.6 : 1,
          }}
          accessibilityLabel="Describe your cat's symptoms"
        />

        {imageUri ? (
          <View style={styles.imageWrap}>
            <View
              style={{
                borderRadius: radius.md,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: t.borderSubtle,
                aspectRatio: 1,
                backgroundColor: t.surfaceSunken,
              }}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityLabel="Attached cat photo"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove attached photo"
              onPress={() => {
                setImageUri(null);
                setImageBase64(null);
              }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: t.surfaceElevated,
                borderRadius: radius.full,
                padding: 6,
              }}
            >
              <X size={16} color={t.textPrimary} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
            <Button
              label="Photo"
              variant="secondary"
              onPress={takePhoto}
              leftIcon={<Camera size={18} color={t.textPrimary} />}
            />
            <Button
              label="Gallery"
              variant="secondary"
              onPress={pickImage}
              leftIcon={<ImageIcon size={18} color={t.textPrimary} />}
            />
          </View>
        )}

        {error ? (
          <Text token="caption" style={{ color: t.error, marginTop: space[3] }}>{error}</Text>
        ) : null}

        <View style={{ marginTop: space[6] }}>
          <Button
            label={
              busy
                ? 'Running triage…'
                : !quota.canScan
                  ? 'Unlock unlimited scans'
                  : 'Run triage'
            }
            onPress={onRun}
            disabled={busy || !text.trim()}
            size="lg"
            pill
            fullWidth
            leftIcon={<Stethoscope size={20} color={t.textInverse} weight="bold" />}
          />
          {busy ? (
            <Text
              token="caption"
              color="textMuted"
              style={{
                marginTop: space[3],
                textAlign: 'center',
                fontFamily: 'Figtree_400Regular',
                fontStyle: 'italic',
              }}
              accessibilityLiveRegion="polite"
            >
              {CAT_THINKING_WORDS[thinkingIndex]}…
            </Text>
          ) : null}
          <Text
            token="caption"
            color="textMuted"
            style={{ marginTop: space[2], textAlign: 'center' }}
          >
            {quota.isPro
              ? 'Informational only \u2014 not veterinary advice.'
              : quota.canScan
                ? `${quota.remaining} free scan${quota.remaining === 1 ? '' : 's'} left this month \u00b7 Not veterinary advice`
                : 'Free monthly scans used \u2014 upgrade for unlimited'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space[5], gap: space[2] },
  imageWrap: { marginTop: space[3] },
});
