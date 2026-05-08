/**
 * Health hub — entry point into every longitudinal tracker for the
 * active cat. Sub-pages live in app/health/*.tsx. This screen is
 * intentionally dense: it's the "home" for health state, so every
 * section shows a one-line summary plus the call-to-action to drill in.
 */
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Books,
  CalendarCheck,
  CaretRight,
  FileText,
  FirstAid,
  Images,
  Pill,
  Scales,
  Syringe,
} from 'phosphor-react-native';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  latestWeight,
  nextAppointment,
  nextVaccineDue,
  useHealthStore,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function HealthHub() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);

  const catEvents = cat ? events.filter((e) => e.cat_id === cat.id) : [];
  const weight = latestWeight(catEvents);
  const vax = nextVaccineDue(catEvents);
  const appt = nextAppointment(catEvents);

  const rows: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    href: string;
  }[] = [
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
      title: 'First aid + food safety',
      subtitle: 'Quick lookup: is this food / plant / drug safe?',
      icon: <FirstAid size={22} color={t.primary700} />,
      href: '/health/food-safety',
    },
    {
      title: '12-month report',
      subtitle: 'Shareable PDF summary for your vet',
      icon: <FileText size={22} color={t.primary700} />,
      href: '/health/summary',
    },
    {
      title: 'Library',
      subtitle: 'Browse every article CatMD uses to reason about your cat',
      icon: <Books size={22} color={t.primary700} />,
      href: '/health/articles',
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.top + space[4],
          paddingBottom: insets.bottom + space[10],
        },
      ]}
    >
      <Text token="heading1">{cat?.name ?? 'Your cat'}&apos;s health</Text>
      <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[1] }}>
        Everything about {cat?.name ?? 'your cat'} in one place. Share with your vet in one tap.
      </Text>

      <View style={{ marginTop: space[6] }}>
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
                  <Text
                    token="body"
                    style={{ fontFamily: 'Figtree_600SemiBold' }}
                  >
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
      </View>

      <View style={{ marginTop: space[6] }}>
        <Text
          token="caption"
          color="textMuted"
          style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
        >
          Cat-specific monitors
        </Text>
        <Card padded={false}>
          <Pressable
            onPress={() => router.push('/health/srr' as any)}
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: t.surfaceSunken } : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                Sleeping respiratory rate
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Early warning for heart disease. 30-second tap-per-breath.
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} />
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: t.borderSubtle,
              marginHorizontal: space[4],
            }}
          />
          <Pressable
            onPress={() => router.push('/health/pain' as any)}
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: t.surfaceSunken } : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                Pain check (Feline Grimace Scale)
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Snap a face photo — we score ears, eyes, muzzle, whiskers, head.
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} />
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: t.borderSubtle,
              marginHorizontal: space[4],
            }}
          />
          <Pressable
            onPress={() => router.push('/health/ckd' as any)}
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: t.surfaceSunken } : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                CKD watch
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Water intake · litter frequency · weight. The early-warning
                stack for chronic kidney disease.
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} />
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: t.borderSubtle,
              marginHorizontal: space[4],
            }}
          />
          <Pressable
            onPress={() => router.push('/health/hyperthyroid' as any)}
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: t.surfaceSunken } : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                Thyroid watch
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Weight loss + increased appetite + thirst = hyperthyroid triad.
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} />
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: t.borderSubtle,
              marginHorizontal: space[4],
            }}
          />
          <Pressable
            onPress={() => router.push('/health/litter' as any)}
            style={({ pressed }) => [
              styles.row,
              pressed ? { backgroundColor: t.surfaceSunken } : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                Litter box
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                Frequency + abnormal flag. Spots urinary blockage + polyuria.
              </Text>
            </View>
            <CaretRight size={16} color={t.textMuted} />
          </Pressable>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    borderRadius: radius.md,
  },
});
