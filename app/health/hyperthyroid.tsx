/**
 * Hyperthyroid monitor — dashboard of the four home-trackable signals
 * that form the classic feline hyperthyroid triad + weight loss:
 *
 *   1. Weight loss  (esp. after age 10)
 *   2. Increased appetite (polyphagia) — THE differentiator from CKD
 *   3. Increased water intake / urination
 *   4. Behavioural signs (restlessness, vocalisation) — loose proxy
 *
 * Without #2 it's usually CKD; with #2 it's usually hyperthyroidism.
 * The suite flags the triad pattern and tells the owner to ask their
 * vet for a total-T4 blood test.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BowlFood,
  Fire,
  Scales,
  Trash,
  WarningCircle,
} from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type FeedingPayload,
  type HealthEvent,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const DAY = 24 * 60 * 60 * 1000;

type Appetite = FeedingPayload['appetite'];

const APPETITE_OPTIONS: { key: Appetite; label: string; tone: 'normal' | 'warning' | 'danger' | 'info' }[] = [
  { key: 'normal',    label: 'Normal',     tone: 'normal' },
  { key: 'increased', label: 'Ate more',   tone: 'info' },
  { key: 'reduced',   label: 'Ate less',   tone: 'warning' },
  { key: 'none',      label: 'Didn\u2019t eat', tone: 'danger' },
];

export default function HyperthyroidScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const [notes, setNotes] = useState('');
  const [amountG, setAmountG] = useState('');

  const stats = useMemo(() => {
    if (!cat) return null;
    return compute(events, cat.id, cat.weight_kg);
  }, [events, cat]);

  if (!cat) return null;

  const logAppetite = (appetite: Appetite) => {
    addEvent({
      cat_id: cat.id,
      type: 'feeding',
      payload: {
        appetite,
        food_type: null,
        amount_g: amountG ? parseFloat(amountG) : null,
        logged_at: new Date().toISOString(),
        notes: notes.trim() || null,
      },
    });
    setNotes('');
    setAmountG('');
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this log?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
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
        <Fire size={22} color={t.primary700} weight="fill" />
        <Text token="heading1" style={{ flex: 1 }}>Thyroid watch</Text>
      </View>
      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
        Hyperthyroidism is the most common hormonal disease in older cats.
        Classic sign: eating more but losing weight.
      </Text>

      {/* Triad warning */}
      {s.triad ? (
        <Card style={{ marginTop: space[4], borderLeftWidth: 4, borderLeftColor: t.error }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
            <WarningCircle size={22} color={t.error} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text token="heading3" style={{ color: t.error }}>
                Classic hyperthyroid pattern
              </Text>
              <Text token="body" style={{ marginTop: space[1] }}>
                {s.triadReason}
              </Text>
              <Text token="caption" color="textMuted" style={{ marginTop: space[2] }}>
                Ask your vet for a total-T4 (thyroxine) blood test. Left untreated,
                hyperthyroidism strains the heart and damages the kidneys.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Signals grid */}
      <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
        <Stat
          label="Weight Δ 3mo"
          value={s.weight.delta3mo != null ? `${s.weight.delta3mo >= 0 ? '+' : ''}${s.weight.delta3mo.toFixed(2)} kg` : '—'}
          sub={s.weight.deltaPct != null ? `${s.weight.deltaPct >= 0 ? '+' : ''}${s.weight.deltaPct.toFixed(1)}%` : null}
          tone={s.weight.deltaPct != null && s.weight.deltaPct <= -5 ? 'warning' : 'normal'}
        />
        <Stat
          label="Appetite 14d"
          value={`${s.appetite.increasedDays}/${s.appetite.totalDays}`}
          sub="days elevated"
          tone={s.appetite.elevated ? 'warning' : 'normal'}
        />
        <Stat
          label="Water vs target"
          value={s.water.ratio != null ? `${Math.round(s.water.ratio * 100)}%` : '—'}
          sub={s.water.today != null ? `${s.water.today} ml today` : null}
          tone={s.water.ratio != null && s.water.ratio >= 1.5 ? 'warning' : 'normal'}
        />
      </View>

      {/* Appetite log */}
      <Card style={{ marginTop: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <BowlFood size={18} color={t.primary700} weight="fill" />
          <Text token="heading3" style={{ flex: 1 }}>How did {cat.name} eat today?</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3], flexWrap: 'wrap' }}>
          {APPETITE_OPTIONS.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => logAppetite(o.key)}
              style={({ pressed }) => [
                styles.appetiteBtn,
                { borderColor: toneColor(o.tone, t), opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={o.label}
            >
              <Text token="body" style={{ color: toneColor(o.tone, t), fontFamily: 'Figtree_600SemiBold' }}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
          <TextInput
            value={amountG}
            onChangeText={setAmountG}
            placeholder="Grams eaten (optional)"
            keyboardType="numeric"
            placeholderTextColor={t.textMuted}
            style={styles.input(t)}
          />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes"
            placeholderTextColor={t.textMuted}
            style={[styles.input(t), { flex: 2 }]}
          />
        </View>
      </Card>

      {/* Weight chart */}
      {s.weight.points.length >= 2 ? (
        <View style={{ marginTop: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
            <Scales size={14} color={t.textMuted} />
            <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Weight · 6 months
            </Text>
          </View>
          <Card>
            <LineChart
              data={s.weight.points.map((p) => ({ x: new Date(p.ts).getTime(), y: p.kg }))}
              height={120}
              yUnit=" kg"
            />
          </Card>
        </View>
      ) : null}

      {/* Cross-link */}
      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[5] }}>
        <Button
          label="Log weight"
          variant="secondary"
          leftIcon={<Scales size={16} color={t.textPrimary} />}
          onPress={() => router.push('/health/weight')}
          style={{ flex: 1 }}
        />
        <Button
          label="CKD watch"
          variant="secondary"
          onPress={() => router.push('/health/ckd')}
          style={{ flex: 1 }}
        />
      </View>

      {/* Recent appetite logs */}
      {s.feedingHistory.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Recent appetite
          </Text>
          <View style={{ gap: space[2] }}>
            {s.feedingHistory.slice(0, 14).map((e) => (
              <Card key={e.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      token="body"
                      style={{
                        fontFamily: 'Figtree_500Medium',
                        color: appetiteLabelColor(e.payload.appetite, t),
                      }}
                    >
                      {appetiteLabel(e.payload.appetite)}
                      {e.payload.amount_g ? `  ·  ${e.payload.amount_g} g` : ''}
                    </Text>
                    <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                      {new Date(e.ts).toLocaleString()}
                    </Text>
                    {e.payload.notes ? (
                      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
                        {e.payload.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => confirmDelete(e.id)} hitSlop={8}>
                    <Trash size={18} color={t.textMuted} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function compute(all: HealthEvent[], catId: string, profileWeightKg: number | null) {
  const now = Date.now();
  const mine = all.filter((e) => e.cat_id === catId);

  // Weight (last 6 months)
  const weight = mine
    .filter((e): e is HealthEvent<'weight'> => e.type === 'weight')
    .filter((e) => now - new Date(e.ts).getTime() <= 180 * DAY)
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const weightPoints = weight.map((e) => ({ ts: e.ts, kg: e.payload.weight_kg }));
  const threeMonthsAgo = now - 90 * DAY;
  const past = weight.find((e) => new Date(e.ts).getTime() >= threeMonthsAgo);
  const latest = weight[weight.length - 1];
  const delta3mo = past && latest && past.id !== latest.id
    ? latest.payload.weight_kg - past.payload.weight_kg
    : null;
  const deltaPct = delta3mo != null && past
    ? (delta3mo / past.payload.weight_kg) * 100
    : null;

  // Feeding / appetite, last 14 days
  const feedingHistory = mine
    .filter((e): e is HealthEvent<'feeding'> => e.type === 'feeding')
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const recentFeeding = feedingHistory.filter(
    (e) => now - new Date(e.ts).getTime() <= 14 * DAY,
  );
  // Dedup by day (one decision per day); prefer most-recent log.
  const byDay = new Map<number, Appetite>();
  for (const e of recentFeeding.slice().reverse()) {
    const k = Math.floor(new Date(e.ts).getTime() / DAY);
    byDay.set(k, e.payload.appetite);
  }
  const totalDays = byDay.size;
  const increasedDays = Array.from(byDay.values()).filter((a) => a === 'increased').length;
  const elevated = totalDays >= 5 && increasedDays / totalDays >= 0.5;

  // Water
  const water = mine.filter((e): e is HealthEvent<'water_intake'> => e.type === 'water_intake');
  const waterToday = water
    .filter((e) => now - new Date(e.ts).getTime() <= DAY)
    .reduce((n, e) => n + e.payload.ml, 0);
  // Prefer the cat's profile weight (set up front) over the latest logged
  // weight event — most owners never log a weight manually, so the profile
  // is the only reliable source for the per-kg water-intake target.
  const effectiveWeightKg = profileWeightKg ?? latest?.payload.weight_kg ?? null;
  const targetMl = effectiveWeightKg ? Math.round(effectiveWeightKg * 60) : null;
  const ratio = targetMl && targetMl > 0 ? waterToday / targetMl : null;

  // Triad: weight loss >=5% AND appetite elevated AND water elevated.
  // Accept 2-of-3 as "partial triad".
  const hits =
    ((deltaPct != null && deltaPct <= -5) ? 1 : 0) +
    (elevated ? 1 : 0) +
    ((ratio != null && ratio >= 1.5) ? 1 : 0);
  let triadReason = '';
  if (hits >= 2) {
    const parts: string[] = [];
    if (deltaPct != null && deltaPct <= -5) parts.push(`weight down ${Math.abs(deltaPct).toFixed(1)}% in 3 months`);
    if (elevated) parts.push(`appetite elevated ${increasedDays}/${totalDays} days`);
    if (ratio != null && ratio >= 1.5) parts.push(`water intake ${(ratio * 100).toFixed(0)}% of target`);
    triadReason = parts.join(' · ') +
      '. Two or more of these together warrant a thyroid workup, not just a wait-and-see.';
  }

  return {
    weight: { points: weightPoints, delta3mo, deltaPct },
    appetite: { increasedDays, totalDays, elevated },
    water: { today: waterToday, ratio },
    feedingHistory,
    triad: hits >= 2,
    triadReason,
  };
}

function appetiteLabel(a: Appetite): string {
  if (a === 'increased') return 'Ate more than usual';
  if (a === 'reduced') return 'Ate less than usual';
  if (a === 'none') return 'Did not eat';
  return 'Ate normally';
}

function appetiteLabelColor(a: Appetite, t: ReturnType<typeof useTheme>): string {
  if (a === 'none') return t.error;
  if (a === 'reduced') return t.warning;
  if (a === 'increased') return t.primary700;
  return t.textPrimary;
}

function toneColor(tone: 'normal' | 'warning' | 'danger' | 'info', t: ReturnType<typeof useTheme>): string {
  if (tone === 'danger') return t.error;
  if (tone === 'warning') return t.warning;
  if (tone === 'info') return t.primary700;
  return t.success;
}

function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string | null; tone: 'normal' | 'warning' | 'danger' }) {
  const t = useTheme();
  const color = tone === 'danger' ? t.error : tone === 'warning' ? t.warning : t.primary700;
  return (
    <Card style={{ flex: 1 }}>
      <Text token="heading2" style={{ color }}>{value}</Text>
      <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>{label}</Text>
      {sub ? <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>{sub}</Text> : null}
    </Card>
  );
}

const styles = {
  root: { paddingHorizontal: space[5] },
  appetiteBtn: {
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: (t: ReturnType<typeof useTheme>) => ({
    flex: 1,
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surface,
    color: t.textPrimary,
    fontFamily: 'Figtree_400Regular' as const,
    fontSize: 15,
  }),
};
