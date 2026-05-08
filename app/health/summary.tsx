/**
 * 12-month health summary — the "annual wellness report" a vet actually
 * wants to see. Renders an on-screen overview and lets the owner share
 * it as a PDF before a vet visit.
 *
 * Sections:
 *   - Cat snapshot (age, current weight, BCS)
 *   - Triage scans: count, urgency distribution, worst headline
 *   - Weight trend: latest, delta over the window, sparkline
 *   - Vaccinations: last given + next due
 *   - Medications: distinct meds + total doses logged
 *   - Vet appointments: completed + upcoming
 *   - Symptom concerns: list (count + first/last photo dates)
 *   - Outcome check-ins: better/same/worse split + adherence to advice
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bandaids,
  CalendarCheck,
  ChartLine,
  FileText,
  HeartStraight,
  Pill,
  Syringe,
} from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type AppointmentPayload,
  type HealthEvent,
  type MedicationDosePayload,
  type OutcomeCheckPayload,
  type SymptomPhotoPayload,
  type VaccinationPayload,
  type WeightPayload,
} from '../../src/state/healthStore';
import { useScanStore } from '../../src/state/scanStore';
import { shareHealthSummaryAsPdf } from '../../src/services/pdf';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 365;

export default function HealthSummary() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const scans = useScanStore((s) => s.scans);
  const [sharing, setSharing] = useState(false);

  const stats = useMemo(() => {
    if (!cat) return null;
    const cutoffMs = Date.now() - WINDOW_DAYS * DAY;
    const inWindow = (iso: string) => new Date(iso).getTime() >= cutoffMs;

    const catEvents = events.filter((e) => e.cat_id === cat.id && inWindow(e.ts));
    const catScans = scans.filter((s) => s.cat_id === cat.id && inWindow(s.created_at));

    return buildSummary(catEvents, catScans);
  }, [cat, events, scans]);

  if (!cat) return null;

  const onShare = async () => {
    setSharing(true);
    try {
      if (!stats) return;
      await shareHealthSummaryAsPdf({
        cat,
        stats,
        windowDays: WINDOW_DAYS,
      });
    } finally {
      setSharing(false);
    }
  };

  const s = stats!;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <FileText size={22} color={t.primary700} />
        <Text token="heading1" style={{ flex: 1 }}>12-month report</Text>
      </View>
      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
        Everything logged for {cat.name} in the last 12 months — ready to share
        with your vet.
      </Text>

      <Button
        label={sharing ? 'Preparing PDF\u2026' : 'Share as PDF'}
        variant="secondary"
        onPress={onShare}
        disabled={sharing}
        fullWidth
        style={{ marginTop: space[4] }}
      />

      {/* Scans */}
      <Section icon={<HeartStraight size={18} color={t.primary700} />} title="Triage scans">
        <KeyValueRow label="Total" value={String(s.scans.total)} />
        <KeyValueRow label="Urgent / concern / monitor / routine"
          value={`${s.scans.byUrgency.urgent} / ${s.scans.byUrgency.concern} / ${s.scans.byUrgency.monitor} / ${s.scans.byUrgency.routine}`} />
        {s.scans.worstHeadline ? (
          <KeyValueRow label="Most urgent" value={s.scans.worstHeadline} />
        ) : null}
        {s.outcome.total > 0 ? (
          <KeyValueRow
            label="Owner check-ins"
            value={`${s.outcome.total} answered · ${s.outcome.better} better, ${s.outcome.same} same, ${s.outcome.worse} worse`}
          />
        ) : null}
      </Section>

      {/* Weight */}
      <Section icon={<ChartLine size={18} color={t.primary700} />} title="Weight">
        {s.weight.points.length === 0 ? (
          <EmptyText>No weights logged yet.</EmptyText>
        ) : (
          <>
            <KeyValueRow
              label="Latest"
              value={`${s.weight.latestKg!.toFixed(2)} kg${s.weight.latestBcs ? ` · BCS ${s.weight.latestBcs}/9` : ''}`}
            />
            {s.weight.deltaKg != null ? (
              <KeyValueRow
                label="Change over period"
                value={`${s.weight.deltaKg >= 0 ? '+' : ''}${s.weight.deltaKg.toFixed(2)} kg`}
              />
            ) : null}
            <View style={{ marginTop: space[3] }}>
              <LineChart
                data={s.weight.points.map((p) => ({ x: new Date(p.ts).getTime(), y: p.kg }))}
                height={120}
              />
            </View>
          </>
        )}
      </Section>

      {/* Vaccinations */}
      <Section icon={<Syringe size={18} color={t.primary700} />} title="Vaccinations">
        {s.vaccinations.list.length === 0 ? (
          <EmptyText>No vaccinations logged in this period.</EmptyText>
        ) : (
          s.vaccinations.list.map((v, i) => (
            <KeyValueRow
              key={i}
              label={v.vaccine}
              value={`given ${formatDate(v.given_on)}${v.next_due ? ` · next ${formatDate(v.next_due)}` : ''}`}
            />
          ))
        )}
      </Section>

      {/* Medications */}
      <Section icon={<Pill size={18} color={t.primary700} />} title="Medications">
        {s.medications.perMed.length === 0 ? (
          <EmptyText>No medication doses logged.</EmptyText>
        ) : (
          s.medications.perMed.map((m, i) => (
            <KeyValueRow
              key={i}
              label={m.medication}
              value={`${m.doses} dose${m.doses === 1 ? '' : 's'} · last ${formatDate(m.lastAt)}`}
            />
          ))
        )}
      </Section>

      {/* Appointments */}
      <Section icon={<CalendarCheck size={18} color={t.primary700} />} title="Vet visits">
        <KeyValueRow label="Completed" value={String(s.appointments.completed.length)} />
        <KeyValueRow label="Upcoming" value={String(s.appointments.upcoming.length)} />
        {s.appointments.completed.slice(0, 3).map((a, i) => (
          <KeyValueRow
            key={`c${i}`}
            label={formatDate(a.scheduled_for)}
            value={`${a.title}${a.vet ? ` · ${a.vet}` : ''}${a.outcome_notes ? ` — ${a.outcome_notes}` : ''}`}
          />
        ))}
      </Section>

      {/* Symptom concerns */}
      <Section icon={<Bandaids size={18} color={t.primary700} />} title="Symptom concerns">
        {s.symptoms.concerns.length === 0 ? (
          <EmptyText>No concern photos tracked.</EmptyText>
        ) : (
          s.symptoms.concerns.map((c) => (
            <KeyValueRow
              key={c.slug}
              label={c.label}
              value={`${c.photos} photo${c.photos === 1 ? '' : 's'} · ${formatDate(c.firstAt)} → ${formatDate(c.lastAt)}`}
            />
          ))
        )}
      </Section>

      <Text
        token="caption"
        color="textMuted"
        style={{ textAlign: 'center', marginTop: space[6] }}
      >
        Window: last {WINDOW_DAYS} days · Generated {new Date().toLocaleDateString()}
      </Text>
    </ScrollView>
  );
}

// ── Shared stats shape used by the screen + PDF renderer ────────────────────

export type HealthSummaryStats = {
  scans: {
    total: number;
    byUrgency: { urgent: number; concern: number; monitor: number; routine: number };
    worstHeadline: string | null;
  };
  weight: {
    points: { ts: string; kg: number }[];
    latestKg: number | null;
    latestBcs: number | null;
    deltaKg: number | null;
  };
  vaccinations: {
    list: VaccinationPayload[];
  };
  medications: {
    perMed: { medication: string; doses: number; lastAt: string }[];
  };
  appointments: {
    upcoming: AppointmentPayload[];
    completed: AppointmentPayload[];
  };
  symptoms: {
    concerns: { slug: string; label: string; photos: number; firstAt: string; lastAt: string }[];
  };
  outcome: {
    total: number;
    better: number;
    same: number;
    worse: number;
  };
};

export function buildSummary(
  events: HealthEvent[],
  scans: { urgency: string; headline: string }[],
): HealthSummaryStats {
  // Scans
  const byUrgency = { urgent: 0, concern: 0, monitor: 0, routine: 0 };
  let worstHeadline: string | null = null;
  const urgencyRank: Record<string, number> = { urgent: 4, concern: 3, monitor: 2, routine: 1 };
  let worstRank = 0;
  for (const sc of scans) {
    const k = sc.urgency as keyof typeof byUrgency;
    if (k in byUrgency) byUrgency[k]++;
    const r = urgencyRank[sc.urgency] ?? 0;
    if (r > worstRank) {
      worstRank = r;
      worstHeadline = sc.headline;
    }
  }

  // Weight
  const weights = events
    .filter((e): e is HealthEvent<'weight'> => e.type === 'weight')
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const points = weights.map((e) => ({ ts: e.ts, kg: (e.payload as WeightPayload).weight_kg }));
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const deltaKg =
    latest && first && latest.id !== first.id
      ? (latest.payload as WeightPayload).weight_kg - (first.payload as WeightPayload).weight_kg
      : null;

  // Vaccinations
  const vaccinations = events
    .filter((e): e is HealthEvent<'vaccination'> => e.type === 'vaccination')
    .map((e) => e.payload as VaccinationPayload)
    .sort((a, b) => b.given_on.localeCompare(a.given_on));

  // Meds — roll up per medication
  const medMap = new Map<string, { doses: number; lastAt: string }>();
  for (const e of events) {
    if (e.type !== 'medication_dose') continue;
    const p = e.payload as MedicationDosePayload;
    const cur = medMap.get(p.medication) ?? { doses: 0, lastAt: p.given_at };
    cur.doses++;
    if (p.given_at > cur.lastAt) cur.lastAt = p.given_at;
    medMap.set(p.medication, cur);
  }
  const perMed = Array.from(medMap.entries())
    .map(([medication, v]) => ({ medication, ...v }))
    .sort((a, b) => b.doses - a.doses);

  // Appointments
  const now = Date.now();
  const appts = events
    .filter((e): e is HealthEvent<'appointment'> => e.type === 'appointment')
    .map((e) => e.payload as AppointmentPayload);
  const upcoming = appts
    .filter((a) => !a.completed && new Date(a.scheduled_for).getTime() >= now)
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  const completed = appts
    .filter((a) => a.completed || new Date(a.scheduled_for).getTime() < now)
    .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for));

  // Symptom concerns
  const concernMap = new Map<
    string,
    { slug: string; label: string; photos: number; firstAt: string; lastAt: string }
  >();
  for (const e of events) {
    if (e.type !== 'symptom_photo') continue;
    const p = e.payload as SymptomPhotoPayload;
    const cur =
      concernMap.get(p.concern_slug) ??
      { slug: p.concern_slug, label: p.concern_label, photos: 0, firstAt: e.ts, lastAt: e.ts };
    cur.photos++;
    if (e.ts < cur.firstAt) cur.firstAt = e.ts;
    if (e.ts > cur.lastAt) cur.lastAt = e.ts;
    concernMap.set(p.concern_slug, cur);
  }
  const concerns = Array.from(concernMap.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  // Outcome check-ins
  let better = 0, same = 0, worse = 0;
  for (const e of events) {
    if (e.type !== 'outcome_check') continue;
    const p = e.payload as OutcomeCheckPayload;
    if (p.direction === 'better') better++;
    else if (p.direction === 'same') same++;
    else if (p.direction === 'worse') worse++;
  }

  return {
    scans: {
      total: scans.length,
      byUrgency,
      worstHeadline,
    },
    weight: {
      points,
      latestKg: latest ? (latest.payload as WeightPayload).weight_kg : null,
      latestBcs: latest ? (latest.payload as WeightPayload).bcs : null,
      deltaKg,
    },
    vaccinations: { list: vaccinations },
    medications: { perMed },
    appointments: { upcoming, completed },
    symptoms: { concerns },
    outcome: { total: better + same + worse, better, same, worse },
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[6] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
        {icon}
        <Text token="heading3">{title}</Text>
      </View>
      <Card>{children}</Card>
    </View>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space[3],
        paddingVertical: space[2],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.borderSubtle,
      }}
    >
      <Text token="caption" color="textMuted" style={{ flex: 1 }}>{label}</Text>
      <Text token="body" style={{ flex: 2, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <Text token="body" color="textSecondary">{children}</Text>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
});
