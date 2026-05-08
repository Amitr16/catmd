/**
 * Triage tab — the medical surface of CatMD.
 *
 * Mental model: three verbs the worried owner needs.
 *
 *   1. SCAN  — symptom-checker / triage AI for "something's wrong right now"
 *   2. TRACK — longitudinal log: vaccinations, meds, weight, appointments,
 *              symptom timeline, food-safety lookup, vet PDF, library
 *   3. WATCH — cat-specific early-warning monitors (SRR for heart disease,
 *              Feline Grimace Scale for pain, CKD/thyroid/litter triads)
 *
 * Track + Watch were previously their own "Health hub" reachable from
 * Settings. We folded them in here because (a) the same urgency mindset
 * brings owners to triage and to log a symptom, and (b) Settings is for
 * account/data/legal, not clinical workflow. The sub-routes under
 * /health/* still own the actual screens — this tab is the entry point.
 */
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  Books,
  CalendarCheck,
  CaretDown,
  CaretRight,
  FileText,
  FirstAid,
  Heartbeat,
  Images,
  Pill,
  Scales,
  Stethoscope,
  Syringe,
  Toilet,
} from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useCatStore } from '../../src/state/catStore';
import { useScanStore } from '../../src/state/scanStore';
import {
  latestWeight,
  nextAppointment,
  nextVaccineDue,
  useHealthStore,
} from '../../src/state/healthStore';
import { useScanQuota } from '../../src/hooks/useScanQuota';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

type RowDef = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
};

export default function TriageTab() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const allScans = useScanStore((s) => s.scans);
  const recentScans = useMemo(
    () => (cat ? allScans.filter((x) => x.cat_id === cat.id) : allScans).slice(0, 10),
    [allScans, cat],
  );

  // Collapsible Track + Watch sections — earlier flat-list rendering
  // showed 13 rows on first paint, which read as overwhelming
  // ("intimidating" per user feedback). Default both to COLLAPSED so
  // the screen leads with the primary scan CTA + recent scans, and
  // users tap to expand the longitudinal logbook (Track) or the
  // disease-specific monitors (Watch) when they're actually looking
  // for those.
  const [trackOpen, setTrackOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const quota = useScanQuota();

  // Health-state derivations for dynamic Track-row subtitles.
  const events = useHealthStore((s) => s.events);
  const catEvents = useMemo(
    () => (cat ? events.filter((e) => e.cat_id === cat.id) : []),
    [events, cat],
  );
  const weight = latestWeight(catEvents);
  const vax = nextVaccineDue(catEvents);
  const appt = nextAppointment(catEvents);

  const trackRows: RowDef[] = [
    {
      title: 'Vaccinations',
      subtitle: vax
        ? `Next: ${vax.vaccine} on ${new Date(vax.next_due).toLocaleDateString()}`
        : 'Log vaccines and get due-date reminders',
      icon: <Syringe size={22} color={t.primary700} />,
      href: '/health/vaccinations',
    },
    {
      title: 'Medications',
      subtitle: 'Daily doses, refills, side-effect notes',
      icon: <Pill size={22} color={t.primary700} />,
      href: '/health/medications',
    },
    {
      title: 'Weight',
      subtitle: weight
        ? `${weight.weight_kg} kg${weight.bcs ? ` · BCS ${weight.bcs}/9` : ''}`
        : 'Log weight — catch trends early',
      icon: <Scales size={22} color={t.primary700} />,
      href: '/health/weight',
    },
    {
      title: 'Appointments',
      subtitle: appt
        ? `${appt.title} — ${new Date(appt.scheduled_for).toLocaleString()}`
        : 'Track upcoming vet visits',
      icon: <CalendarCheck size={22} color={t.primary700} />,
      href: '/health/appointments',
    },
    {
      title: 'Symptom timeline',
      subtitle: 'Date-stamped photos of a healing wound, rash, or eye issue',
      icon: <Images size={22} color={t.primary700} />,
      href: '/health/symptom-timeline',
    },
    {
      title: 'Is this safe?',
      subtitle: 'First-aid + food / plant / drug lookup — toxic vs OK',
      icon: <FirstAid size={22} color={t.primary700} />,
      href: '/health/food-safety',
    },
    {
      title: 'Vet visit summary (PDF)',
      subtitle: '12-month shareable report — symptoms, weight, check-ins',
      icon: <FileText size={22} color={t.primary700} />,
      href: '/health/summary',
    },
    {
      title: 'Article library',
      subtitle: 'Every article CatMD uses to reason about your cat',
      icon: <Books size={22} color={t.primary700} />,
      href: '/health/articles',
    },
  ];

  const watchRows: RowDef[] = [
    {
      title: 'Breathing rate',
      subtitle: '30-second tap-per-breath — heart-disease early warning',
      icon: <Heartbeat size={22} color={t.primary700} />,
      href: '/health/srr',
    },
    // Pain check (FGS) was previously here — promoted up to a top-level
    // CTA on the Triage page so the validated University-of-Montreal
    // clinical scale isn't buried inside a collapsed group.
    {
      title: 'Kidney watch',
      subtitle: 'Water · litter · weight — catches kidney disease early',
      icon: <Scales size={22} color={t.primary700} />,
      href: '/health/ckd',
    },
    {
      title: 'Thyroid watch',
      subtitle: 'Weight loss · big appetite · thirst — the hyperthyroid triad',
      icon: <Stethoscope size={22} color={t.primary700} />,
      href: '/health/hyperthyroid',
    },
    {
      title: 'Litter box',
      subtitle: 'Frequency + abnormal flag — spots blockage + over-peeing',
      icon: <Toilet size={22} color={t.primary700} />,
      href: '/health/litter',
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + space[5],
        paddingHorizontal: space[5],
        paddingBottom: insets.bottom + space[8],
        gap: space[4],
      }}
    >
      <Text token="displayLg" style={{ marginBottom: space[1] }}>
        Triage
      </Text>
      <Text token="body" color="textMuted">
        Vet-grade symptom check. Plus the Feline Grimace Scale — a
        research-validated facial pain scoring system from the
        University of Montreal.
      </Text>

      <Button
        label={quota.canScan ? 'Scan now' : 'Unlock more scans'}
        onPress={() =>
          router.push(
            quota.canScan
              ? '/scan'
              : { pathname: '/paywall', params: { source: 'scan_quota' } },
          )
        }
        size="lg"
        pill
        fullWidth
        leftIcon={<Stethoscope size={20} color={t.textInverse} weight="bold" />}
        style={{ marginTop: space[3] }}
      />

      {/* Face pain check (FGS) — promoted out of the collapsible
          Watch group up to a secondary CTA right below Scan now.
          Research-grade clinical scale (Evangelista et al., 2019)
          deserves prominence — it was one of CatMD's strongest
          credibility signals but had been buried two collapses deep.
          Sage tint distinguishes it from the primary Scan now button
          while keeping it clearly above-the-fold. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Face pain check using the Feline Grimace Scale"
        onPress={() => router.push('/health/pain' as never)}
        style={({ pressed }) => [
          {
            marginTop: space[2],
            padding: space[4],
            borderRadius: radius.lg,
            backgroundColor: t.secondary100,
            borderWidth: 1,
            borderColor: t.secondary500,
            opacity: pressed ? 0.9 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
          },
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: t.surfaceElevated,
            borderWidth: 1,
            borderColor: t.secondary500,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Stethoscope size={20} color={t.secondary700} weight="bold" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            token="caption"
            style={{
              color: t.secondary700,
              fontFamily: 'Figtree_600SemiBold',
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              fontSize: 10,
            }}
          >
            Validated clinical scale
          </Text>
          <Text token="heading3" style={{ color: t.secondary900, marginTop: 2 }}>
            Face pain check
          </Text>
          <Text token="caption" color="textSecondary" style={{ marginTop: 2, lineHeight: 17 }}>
            Feline Grimace Scale — Univ. of Montreal, 2019. Snap a
            face photo, get a 0–10 pain score with rationale.
          </Text>
        </View>
        <CaretRight size={16} color={t.secondary700} />
      </Pressable>

      {/* Recent scans */}
      <View style={{ marginTop: space[4] }}>
        <Text token="heading3" style={{ marginBottom: space[3] }}>
          Recent scans
        </Text>
        {recentScans.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
            ]}
          >
            <Text token="body" color="textMuted" style={{ textAlign: 'center' }}>
              No scans yet. Run one to start building {cat?.name ?? 'your cat'}'s health timeline.
            </Text>
          </View>
        ) : (
          recentScans.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: '/result', params: { id: s.id } })}
              style={({ pressed }) => [
                styles.scanCard,
                {
                  backgroundColor: t.surfaceElevated,
                  borderColor: t.borderSubtle,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text token="caption" color="textMuted" style={{ marginBottom: 2 }}>
                  {new Date(s.created_at).toLocaleDateString()} · {s.urgency}
                </Text>
                <Text token="body" numberOfLines={2}>
                  {s.headline}
                </Text>
              </View>
              <CaretRight size={18} color={t.textMuted} />
            </Pressable>
          ))
        )}
      </View>

      {/* TRACK — longitudinal logbook (collapsible) */}
      <View style={{ marginTop: space[4] }}>
        <Pressable
          onPress={() => setTrackOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${trackOpen ? 'Collapse' : 'Expand'} Track section: longitudinal logbook`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: space[2],
          }}
        >
          <View style={{ flex: 1 }}>
            <Text token="heading3" style={{ marginBottom: space[1] }}>
              Track
            </Text>
            <Text token="caption" color="textMuted">
              The record that makes every future scan smarter.
              {!trackOpen ? `  ·  ${trackRows.length} items` : ''}
            </Text>
          </View>
          {trackOpen ? (
            <CaretDown size={18} color={t.textMuted} />
          ) : (
            <CaretRight size={18} color={t.textMuted} />
          )}
        </Pressable>
        {trackOpen ? (
          <View style={{ marginTop: space[3] }}>
            <RowGroup rows={trackRows} />
          </View>
        ) : null}
      </View>

      {/* WATCH — cat-specific early-warning monitors (collapsible) */}
      <View style={{ marginTop: space[4] }}>
        <Pressable
          onPress={() => setWatchOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${watchOpen ? 'Collapse' : 'Expand'} Watch section: disease-specific monitors`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: space[2],
          }}
        >
          <View style={{ flex: 1 }}>
            <Text token="heading3" style={{ marginBottom: space[1] }}>
              Watch
            </Text>
            <Text token="caption" color="textMuted">
              Disease-specific monitors — catch the silent ones early.
              {!watchOpen ? `  ·  ${watchRows.length} items` : ''}
            </Text>
          </View>
          {watchOpen ? (
            <CaretDown size={18} color={t.textMuted} />
          ) : (
            <CaretRight size={18} color={t.textMuted} />
          )}
        </Pressable>
        {watchOpen ? (
          <View style={{ marginTop: space[3] }}>
            <RowGroup rows={watchRows} />
          </View>
        ) : null}
      </View>

      {/* External web library — kept as a separate visual tile to make
          it obvious this opens the browser, not an in-app screen. */}
      <Pressable
        onPress={() => Linking.openURL('https://catmd.pet/library')}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: t.surfaceElevated,
            borderColor: t.borderSubtle,
            opacity: pressed ? 0.85 : 1,
            marginTop: space[2],
          },
        ]}
      >
        <View style={[styles.tileIcon, { backgroundColor: t.primary100, borderColor: t.borderSubtle }]}>
          <BookOpen size={22} color={t.primary700} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text token="heading3" style={{ marginBottom: 2 }}>
            Web library
          </Text>
          <Text token="caption" color="textMuted">
            Long-form vet-sourced articles on cat symptoms. Opens in browser.
          </Text>
        </View>
        <CaretRight size={20} color={t.textMuted} />
      </Pressable>
    </ScrollView>
  );
}

function RowGroup({ rows }: { rows: RowDef[] }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Card padded={false}>
      {rows.map((row, i) => (
        <View key={row.title}>
          {i > 0 ? (
            <View
              style={{
                height: 1,
                backgroundColor: t.borderSubtle,
                marginHorizontal: space[4],
              }}
            />
          ) : null}
          <Pressable
            onPress={() => router.push(row.href as any)}
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: t.surfaceSunken } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}. ${row.subtitle}`}
          >
            {row.icon}
            <View style={{ flex: 1 }}>
              <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                {row.title}
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                {row.subtitle}
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[2],
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    borderRadius: radius.md,
  },
});
