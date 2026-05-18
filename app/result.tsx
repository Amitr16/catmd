/**
 * Result screen — the triage output. This is the "magic moment" screen
 * the whole product revolves around; the ScoreRing is the hero.
 *
 * Layout (top → bottom):
 *   - Urgency callout (non-dismissible for "urgent")
 *   - ScoreRing + urgency badge
 *   - Headline (display serif, 1 sentence)
 *   - Explanation
 *   - Possible concerns (chips)
 *   - Reassurances
 *   - Vet-question checklist (exportable later)
 *   - Sources (chips, LLM-internal clearly badged)
 *   - Disclaimer footer
 */
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Eye,
  HeartStraight,
  HouseLine,
  ListChecks,
  Question,
  Share as ShareIcon,
  Stethoscope,
  Trash,
  WarningCircle,
  XCircle,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { EmergencyActionBar } from '../src/components/EmergencyActionBar';
import { InlineCitationText } from '../src/components/InlineCitationText';
import { ScoreRing } from '../src/components/ScoreRing';
import { SourceChip } from '../src/components/SourceChip';
import { Text } from '../src/components/Text';
import { UrgencyBadge } from '../src/components/UrgencyBadge';
import { useScanStore } from '../src/state/scanStore';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useCatStore } from '../src/state/catStore';
import { shareScanAsPdf } from '../src/services/pdf';
import { urgencyTier } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // If the caller passes an id (normal case), find that scan. If no id is
  // passed (fresh navigation after scan submit with replace + params set),
  // fall back to the most recent scan. But do NOT fall back on an INVALID
  // id — that hides bugs and makes "not found" unreachable.
  const scan = useScanStore((s) =>
    id ? s.scans.find((x) => x.id === id) : s.scans[0],
  );
  const deleteScan = useScanStore((s) => s.deleteScan);
  const updateScan = useScanStore((s) => s.updateScan);
  const activeCat = useActiveCat();
  const catForScan = useCatStore((s) =>
    scan ? s.cats.find((c) => c.id === scan.cat_id) ?? activeCat : activeCat,
  );
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    if (!scan) return;
    setSharing(true);
    await shareScanAsPdf(scan, catForScan);
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'scan_shared_pdf' }),
    );
    setSharing(false);
  };

  const onDelete = () => {
    if (!scan) return;
    Alert.alert(
      'Delete this scan?',
      'It will be removed from your history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteScan(scan.id);
            router.replace('/(main)');
          },
        },
      ],
    );
  };

  if (!scan) {
    return (
      <View style={{ flex: 1, padding: space[5], justifyContent: 'center' }}>
        <Text token="heading2">No scan found</Text>
        <Text token="body" color="textSecondary" style={{ marginTop: space[2] }}>
          Run a scan from the home screen first.
        </Text>
        <Button label="Back home" onPress={() => router.replace('/(main)')} style={{ marginTop: space[4] }} />
      </View>
    );
  }

  const isUrgent = scan.urgency === 'urgent';
  const tierCopy = urgencyTier[scan.urgency].copy;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + space[10] },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {isUrgent && (
        <EmergencyActionBar
          scan={scan}
          cat={catForScan ?? null}
          onEditVet={() => router.push('/cat-profile')}
          onShare={onShare}
        />
      )}

      {scan.image_uri ? (
        <View style={styles.photoWrap}>
          <Image
            source={{ uri: scan.image_uri }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg }}
            resizeMode="cover"
            accessibilityLabel="Photo submitted with this scan"
          />
        </View>
      ) : null}

      <View style={{ alignItems: 'center', marginTop: space[3] }}>
        <ScoreRing score={scan.score} size={200} />
        <View style={{ marginTop: space[3] }}>
          <UrgencyBadge tier={scan.urgency} />
        </View>
        <Text token="caption" color="textMuted" style={{ marginTop: space[2], textAlign: 'center' }}>
          {tierCopy}
        </Text>
      </View>

      <View style={{ marginTop: space[6] }}>
        <Text token="heading1" style={{ marginBottom: space[2] }}>
          {scan.headline}
        </Text>
        {scan.explanation ? (
          <InlineCitationText token="bodyLg" color="textSecondary">
            {scan.explanation}
          </InlineCitationText>
        ) : null}
      </View>

      {scan.pending_questions.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sharpen this triage by answering ${scan.pending_questions.length} follow-up questions`}
          onPress={() => router.push({ pathname: '/follow-up', params: { id: scan.id } })}
          style={({ pressed }) => [
            {
              marginTop: space[5],
              borderRadius: radius.lg,
              backgroundColor: t.primary50,
              borderWidth: 1,
              borderColor: t.primary300,
              padding: space[4],
              flexDirection: 'row',
              gap: space[3],
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Question size={24} color={t.primary700} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text token="heading3" color="primary700">
              Sharpen this triage
            </Text>
            <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
              Answer {scan.pending_questions.length} quick{' '}
              {scan.pending_questions.length === 1 ? 'question' : 'questions'} to narrow
              the assessment.
            </Text>
          </View>
          <ArrowRight size={18} color={t.primary700} weight="bold" />
        </Pressable>
      )}

      {/* Outcome check-in nudge. Shows once the scan is at least 6 hours
          old — gives the owner time to actually observe change — and only
          if they haven't already answered or dismissed. Suppressed while a
          follow-up sharpen is still pending so we don't stack CTAs. In
          dev mode (__DEV__) the 6h gate drops to 0 so the flow is testable. */}
      {scan.pending_questions.length === 0 &&
        !scan.outcome_responded &&
        !scan.outcome_dismissed_at &&
        (__DEV__ || Date.now() - new Date(scan.created_at).getTime() > 6 * 60 * 60 * 1000) && (
          <View
            style={{
              marginTop: space[5],
              borderRadius: radius.lg,
              backgroundColor: t.primary50,
              borderWidth: 1,
              borderColor: t.primary300,
              padding: space[4],
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
            }}
          >
            <HeartStraight size={22} color={t.primary700} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text token="heading3" color="primary700">
                How&rsquo;s {catForScan?.name ?? 'your cat'} doing?
              </Text>
              <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
                A 15-second check-in helps us learn which advice worked.
              </Text>
              <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
                <Button
                  label="Check in"
                  size="sm"
                  onPress={() =>
                    router.push({ pathname: '/outcome-check', params: { scanId: scan.id } })
                  }
                  leftIcon={<CheckCircle size={16} color={t.textInverse} weight="bold" />}
                />
                <Button
                  label="Dismiss"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    updateScan(scan.id, { outcome_dismissed_at: new Date().toISOString() })
                  }
                />
              </View>
            </View>
          </View>
        )}

      {scan.follow_up_qa.length > 0 && (
        <View style={{ marginTop: space[5] }}>
          <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}>
            Based on your answers
          </Text>
          <Card>
            {scan.follow_up_qa.map((qa, i) => (
              <View key={qa.id || i} style={{ marginTop: i === 0 ? 0 : space[2] }}>
                <Text token="caption" color="textMuted">{qa.question}</Text>
                <Text token="body" style={{ marginTop: 2 }}>{qa.answer}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {scan.photo_observations ? (
        <Section title="What we observed in the photo" icon={<Eye size={16} color={t.primary700} />}>
          <Card>
            <Text token="body">{scan.photo_observations}</Text>
          </Card>
        </Section>
      ) : null}

      {scan.red_flags.length > 0 && (
        <Section title="Red flags" icon={<WarningCircle size={16} color={t.error} />}>
          <Card style={{ borderLeftWidth: 3, borderLeftColor: t.error }}>
            {scan.red_flags.map((f, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: space[2],
                  marginTop: i === 0 ? 0 : space[2],
                }}
              >
                <WarningCircle size={16} color={t.error} weight="fill" style={{ marginTop: 3 }} />
                <Text token="body" style={{ flex: 1, color: t.textPrimary }}>{f}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {scan.trend_note ? (
        <Section title="Trend" icon={<ListChecks size={16} color={t.primary700} />}>
          <Card>
            <Text token="body">{scan.trend_note}</Text>
          </Card>
        </Section>
      ) : null}

      {scan.differentials.length > 0 && (
        <Section title="What this could be" icon={<Stethoscope size={16} color={t.primary700} />}>
          <View style={{ gap: space[2] }}>
            {scan.differentials.map((d, i) => (
              <DifferentialCard key={i} d={d} />
            ))}
          </View>
        </Section>
      )}

      {scan.reassurances.length > 0 && (
        <Section title="What it probably isn't" icon={<CheckCircle size={16} color={t.primary700} />}>
          <Card>
            {scan.reassurances.map((r, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: space[2], marginTop: i === 0 ? 0 : space[2] }}
              >
                <CheckCircle size={16} color={t.primary700} weight="fill" style={{ marginTop: 3 }} />
                <Text token="body" style={{ flex: 1 }}>{r}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {scan.home_checks.length > 0 && (
        <Section title="Check at home now" icon={<HouseLine size={16} color={t.primary700} />}>
          <Card>
            {scan.home_checks.map((h, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: space[2], marginTop: i === 0 ? 0 : space[3] }}
              >
                <Text token="body" color="primary700" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                  {i + 1}.
                </Text>
                <Text token="body" style={{ flex: 1 }}>{h}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {scan.what_to_monitor.length > 0 && (
        <Section title="Watch for the next 24–48h" icon={<Eye size={16} color={t.primary700} />}>
          <Card>
            {scan.what_to_monitor.map((m, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: space[2], marginTop: i === 0 ? 0 : space[2] }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: t.borderStrong,
                    marginTop: 3,
                  }}
                />
                <Text token="body" style={{ flex: 1 }}>{m}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {scan.next_steps.length > 0 && (
        <Section title="Decision guide" icon={<ListChecks size={16} color={t.primary700} />}>
          <View style={{ gap: space[2] }}>
            {scan.next_steps.map((n, i) => (
              <Card key={i}>
                <Text token="caption" color="primary700" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                  When
                </Text>
                <Text token="body" style={{ marginTop: 2 }}>{n.when}</Text>
                <Text
                  token="caption"
                  color="secondary700"
                  style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: space[2] }}
                >
                  Do this
                </Text>
                <Text token="body" style={{ marginTop: 2 }}>{n.action}</Text>
              </Card>
            ))}
          </View>
        </Section>
      )}

      {/* Vet-share nudge — only for monitor / concern tier. Pre-fills a
          short observation-summary template the owner can WhatsApp /
          SMS / email to their vet. Pairs with the existing PDF export
          on the bottom action bar; this is the lighter, faster path.
          Audit 2026-05-16. */}
      {(scan.urgency === 'monitor' || scan.urgency === 'concern') && (
        <Section
          title="Share with your vet"
          icon={<Stethoscope size={16} color={t.primary700} />}
        >
          <Card>
            <Text token="body">
              Would you like to share this with your vet?
            </Text>
            <Text token="caption" color="textMuted" style={{ marginTop: space[2] }}>
              Sends a short observation summary (urgency, score, main concern,
              what you noticed) as a message. Pick the app on the share sheet —
              WhatsApp, SMS, email all work. Not a diagnosis.
            </Text>
            <Button
              label="Share scan summary"
              variant="secondary"
              onPress={async () => {
                const topConcern =
                  scan.differentials?.[0]?.condition || scan.headline;
                const redFlags =
                  scan.red_flags.length > 0
                    ? scan.red_flags.join(', ')
                    : 'none flagged';
                const ownerSymptoms = scan.user_input?.trim() || '(none added)';
                const message = [
                  `I used CatMD to document something I noticed with ${catForScan?.name ?? 'my cat'}.`,
                  '',
                  'Scan result:',
                  `• Urgency: ${scan.urgency}`,
                  `• Health score: ${scan.score}/99`,
                  `• Main concern: ${topConcern}`,
                  `• Red flags: ${redFlags}`,
                  `• Notes: ${ownerSymptoms}`,
                  '',
                  "I'm sharing this as an observation summary, not a diagnosis. Could you let me know if this is worth a visit?",
                ].join('\n');
                try {
                  await Share.share({
                    message,
                    title: `${catForScan?.name ?? 'My cat'} — CatMD observation`,
                  });
                  void import('../src/services/analytics').then(({ track }) =>
                    track({
                      type: 'scan_shared_pdf',
                      // Re-use the existing share event for funnel
                      // continuity; the new event would be over-specced
                      // for what's effectively the same outcome.
                    }),
                  );
                } catch {
                  // User cancelled or share failed — no-op.
                }
              }}
              leftIcon={<ShareIcon size={18} color={t.primary700} weight="bold" />}
              fullWidth
              style={{ marginTop: space[3] }}
            />
          </Card>
        </Section>
      )}

      {scan.vet_questions.length > 0 && (
        <Section title="Questions for your vet" icon={<Stethoscope size={16} color={t.primary700} />}>
          <Card>
            {scan.vet_questions.map((q, i) => (
              <Text
                key={i}
                token="body"
                style={{ marginTop: i === 0 ? 0 : space[2] }}
              >
                {i + 1}. {q}
              </Text>
            ))}
          </Card>
        </Section>
      )}

      {scan.vet_preparations.length > 0 && (
        <Section title="Bring to the vet" icon={<ClipboardText size={16} color={t.primary700} />}>
          <Card>
            {scan.vet_preparations.map((p, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: space[2], marginTop: i === 0 ? 0 : space[2] }}
              >
                <Text token="body" color="primary700" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                  •
                </Text>
                <Text token="body" style={{ flex: 1 }}>{p}</Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {scan.citation_topics.length > 0 && (
        <Section title="Sources">
          <View style={styles.chips}>
            {scan.citation_topics.map((topic) => (
              <SourceChip
                key={topic}
                url="https://catmd.pet/sources"
                title={topic}
              />
            ))}
          </View>
        </Section>
      )}

      <Text token="caption" color="textMuted" style={{ marginTop: space[6], textAlign: 'center' }}>
        AI confidence: {scan.confidence}
      </Text>

      <View style={{ marginTop: space[6], flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
        <Button
          label={sharing ? 'Preparing…' : 'Share with vet'}
          variant="secondary"
          disabled={sharing}
          onPress={onShare}
          leftIcon={<ShareIcon size={18} color={t.textPrimary} />}
        />
        <Button
          label="New scan"
          onPress={() => router.replace('/scan')}
          leftIcon={<Stethoscope size={18} color={t.textInverse} weight="bold" />}
        />
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete this scan"
          hitSlop={8}
          style={{
            marginLeft: 'auto',
            height: 48,
            minWidth: 48,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space[3],
          }}
        >
          <Trash size={20} color={t.textMuted} />
        </Pressable>
      </View>

      <Text
        token="caption"
        color="textMuted"
        style={{ marginTop: space[6], textAlign: 'center' }}
      >
        Informational only — not veterinary advice.
      </Text>
    </ScrollView>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: space[6] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
        {icon ?? null}
        <Text token="heading3">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DifferentialCard({ d }: { d: import('../src/ai/triage').Differential }) {
  const t = useTheme();
  const pal =
    d.likelihood === 'likely'
      ? { bg: t.secondary50, fg: t.secondary700, label: 'Likely' }
      : d.likelihood === 'possible'
        ? { bg: t.primary100, fg: t.primary700, label: 'Possible' }
        : { bg: t.surfaceSunken, fg: t.textMuted, label: 'Less likely' };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
        <Text token="heading3" style={{ flex: 1, minWidth: 0 }}>{d.condition}</Text>
        <View
          style={{
            paddingHorizontal: space[2],
            paddingVertical: 2,
            borderRadius: radius.full,
            backgroundColor: pal.bg,
          }}
        >
          <Text token="caption" style={{ color: pal.fg }}>{pal.label}</Text>
        </View>
      </View>

      {d.reasoning ? (
        <InlineCitationText token="body" color="textSecondary" style={{ marginTop: space[2] }}>
          {d.reasoning}
        </InlineCitationText>
      ) : null}

      {d.supporting_signs.length > 0 ? (
        <View style={{ marginTop: space[3] }}>
          <Text
            token="caption"
            color="primary700"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}
          >
            Supports this
          </Text>
          {d.supporting_signs.map((s, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: space[2], marginTop: i === 0 ? 0 : 2 }}
            >
              <CheckCircle size={14} color={t.primary700} weight="fill" style={{ marginTop: 3 }} />
              <Text token="body" style={{ flex: 1 }}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {d.against_signs.length > 0 ? (
        <View style={{ marginTop: space[3] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}
          >
            Against this
          </Text>
          {d.against_signs.map((s, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: space[2], marginTop: i === 0 ? 0 : 2 }}
            >
              <XCircle size={14} color={t.textMuted} weight="fill" style={{ marginTop: 3 }} />
              <Text token="body" color="textSecondary" style={{ flex: 1 }}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {d.related_card ? (
        <View style={{ marginTop: space[3] }}>
          <SourceChip url="https://catmd.pet/sources" title={d.related_card} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: space[5] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  photoWrap: { marginBottom: space[5] },
});
