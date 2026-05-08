/**
 * CKD monitoring suite — chronic kidney disease is the #1 killer of older
 * cats. Early signs show up at home long before a vet visit: increased
 * thirst, increased urination, gradual weight loss. We pull those three
 * streams together in one at-a-glance dashboard.
 *
 * Inputs:
 *   - water_intake events (logged here — quick +50/+100 ml buttons)
 *   - litter_box_use events (logged on /health/litter)
 *   - weight events (logged on /health/weight)
 *
 * Clinical reference points:
 *   - Healthy cat water intake: ~60 ml per kg body weight per day
 *   - Polyuria threshold: 5+ urinations / 24h
 *   - Significant weight loss: > 5% over 3 months
 *   - IRIS CKD staging happens at the vet with blood work (creatinine, SDMA);
 *     we surface the home-visible proxies and prompt the vet visit.
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
  Drop,
  Scales,
  Toilet,
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
  type HealthEvent,
  type WaterIntakePayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const DAY = 24 * 60 * 60 * 1000;
const QUICK_ML = [25, 50, 100];
const ML_PER_KG_HEALTHY = 60;

export default function CkdScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const [customMl, setCustomMl] = useState('');

  const d = useMemo(() => {
    if (!cat) return null;
    return computeDashboard(events, cat.id, cat.weight_kg);
  }, [events, cat]);

  if (!cat) return null;

  const logWater = (ml: number) => {
    addEvent({
      cat_id: cat.id,
      type: 'water_intake',
      payload: { ml, logged_at: new Date().toISOString() },
    });
  };

  const logCustom = () => {
    const n = parseFloat(customMl);
    if (!Number.isFinite(n) || n <= 0) return;
    logWater(Math.round(n));
    setCustomMl('');
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this log?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
  };

  const s = d!;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Drop size={22} color={t.primary700} weight="fill" />
        <Text token="heading1" style={{ flex: 1 }}>CKD watch</Text>
      </View>
      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
        Chronic kidney disease hides for months. Tracking water, pees, and
        weight together is the earliest home signal we have.
      </Text>

      {/* Alert summary */}
      {s.flags.length > 0 ? (
        <Card style={{ marginTop: space[4], borderLeftWidth: 4, borderLeftColor: t.warning }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
            <WarningCircle size={22} color={t.warning} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text token="heading3" style={{ color: t.warning }}>Pattern to discuss with your vet</Text>
              {s.flags.map((f, i) => (
                <Text key={i} token="body" style={{ marginTop: space[1] }}>· {f}</Text>
              ))}
              <Text token="caption" color="textMuted" style={{ marginTop: space[2] }}>
                Ask for a urinalysis, blood urea nitrogen (BUN), creatinine, and SDMA panel.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Stats grid */}
      <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
        <StatBox
          label="Water today"
          value={`${s.water.today} ml`}
          sub={s.water.targetMl ? `target ~${s.water.targetMl} ml` : null}
          tone={
            s.water.targetMl && s.water.today > s.water.targetMl * 1.5
              ? 'warning'
              : 'normal'
          }
        />
        <StatBox
          label="Pees today"
          value={String(s.urinations.today)}
          sub={`7d avg ${s.urinations.avg7.toFixed(1)}`}
          tone={s.urinations.today >= 5 ? 'warning' : 'normal'}
        />
        <StatBox
          label="Weight Δ 3mo"
          value={s.weight.delta3mo != null ? `${s.weight.delta3mo >= 0 ? '+' : ''}${s.weight.delta3mo.toFixed(2)} kg` : '—'}
          sub={s.weight.deltaPct != null ? `${s.weight.deltaPct >= 0 ? '+' : ''}${s.weight.deltaPct.toFixed(1)}%` : null}
          tone={s.weight.deltaPct != null && s.weight.deltaPct <= -5 ? 'warning' : 'normal'}
        />
      </View>

      {/* Water log */}
      <Card style={{ marginTop: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Drop size={18} color={t.primary700} weight="fill" />
          <Text token="heading3" style={{ flex: 1 }}>Log water intake</Text>
        </View>
        <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
          {cat.weight_kg
            ? `Target ~${Math.round(cat.weight_kg * ML_PER_KG_HEALTHY)} ml/day for a ${cat.weight_kg} kg cat.`
            : 'Set a weight on the profile for a per-kg target.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
          {QUICK_ML.map((ml) => (
            <Button
              key={ml}
              label={`+${ml} ml`}
              variant="secondary"
              onPress={() => logWater(ml)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2], alignItems: 'center' }}>
          <TextInput
            value={customMl}
            onChangeText={setCustomMl}
            placeholder="Custom ml"
            keyboardType="numeric"
            placeholderTextColor={t.textMuted}
            style={{
              flex: 1,
              height: 44,
              paddingHorizontal: space[3],
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: t.borderStrong,
              backgroundColor: t.surface,
              color: t.textPrimary,
              fontFamily: 'Figtree_400Regular',
              fontSize: 15,
            }}
          />
          <Button label="Add" onPress={logCustom} disabled={!customMl.trim()} />
        </View>
      </Card>

      {/* Trends */}
      {s.water.daily.length >= 2 ? (
        <View style={{ marginTop: space[4] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Water · 14 days
          </Text>
          <Card>
            <LineChart
              data={s.water.daily.map((p) => ({ x: p.x, y: p.ml }))}
              height={120}
              yUnit=" ml"
              yLines={s.water.targetMl ? [s.water.targetMl] : []}
            />
          </Card>
        </View>
      ) : null}

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

      {/* Cross-links */}
      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[5] }}>
        <Button
          label="Litter log"
          variant="secondary"
          leftIcon={<Toilet size={16} color={t.textPrimary} />}
          onPress={() => router.push('/health/litter')}
          style={{ flex: 1 }}
        />
        <Button
          label="Weight log"
          variant="secondary"
          leftIcon={<Scales size={16} color={t.textPrimary} />}
          onPress={() => router.push('/health/weight')}
          style={{ flex: 1 }}
        />
      </View>

      {/* Recent water events */}
      {s.water.recent.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Recent water
          </Text>
          <View style={{ gap: space[2] }}>
            {s.water.recent.map((e) => (
              <Card key={e.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <Drop size={18} color={t.primary700} weight="fill" />
                  <View style={{ flex: 1 }}>
                    <Text token="body" style={{ fontFamily: 'Figtree_500Medium' }}>
                      {e.payload.ml} ml
                    </Text>
                    <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                      {new Date(e.ts).toLocaleString()}
                    </Text>
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

function computeDashboard(
  all: HealthEvent[],
  catId: string,
  weightKg: number | null,
) {
  const now = Date.now();
  const mine = all.filter((e) => e.cat_id === catId);

  // Water
  const water = mine.filter((e): e is HealthEvent<'water_intake'> => e.type === 'water_intake');
  const waterToday = sum(water, (e) => now - new Date(e.ts).getTime() <= DAY, (e) => (e.payload as WaterIntakePayload).ml);
  const targetMl = weightKg ? Math.round(weightKg * ML_PER_KG_HEALTHY) : null;

  const byDay = new Map<number, number>();
  for (const e of water) {
    const ts = new Date(e.ts).getTime();
    if (now - ts > 14 * DAY) continue;
    const dayKey = Math.floor(ts / DAY);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + (e.payload as WaterIntakePayload).ml);
  }
  const waterDaily: { x: number; ml: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = Math.floor((now - i * DAY) / DAY);
    waterDaily.push({ x: d * DAY + DAY / 2, ml: byDay.get(d) ?? 0 });
  }

  // Urinations
  const litter = mine.filter((e) => e.type === 'litter_box_use');
  const urinationsToday = litter.filter(
    (e) => now - new Date(e.ts).getTime() <= DAY &&
      ((e.payload as { kind: string }).kind === 'urine' || (e.payload as { kind: string }).kind === 'both'),
  ).length;
  const last7 = litter.filter(
    (e) => now - new Date(e.ts).getTime() <= 7 * DAY &&
      ((e.payload as { kind: string }).kind === 'urine' || (e.payload as { kind: string }).kind === 'both'),
  );
  const avg7 = last7.length / 7;

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

  // Flags synthesised from signals
  const flags: string[] = [];
  if (targetMl && waterToday > targetMl * 1.5) {
    flags.push(`Water intake today (${waterToday} ml) is well above the target for a ${weightKg} kg cat — possible polydipsia.`);
  }
  if (urinationsToday >= 5) {
    flags.push(`${urinationsToday} urinations in the last 24h — possible polyuria.`);
  }
  if (deltaPct != null && deltaPct <= -5) {
    flags.push(`${Math.abs(deltaPct).toFixed(1)}% weight loss over the last 3 months.`);
  }

  return {
    water: {
      today: waterToday,
      targetMl,
      daily: waterDaily,
      recent: water.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10),
    },
    urinations: { today: urinationsToday, avg7 },
    weight: { points: weightPoints, delta3mo, deltaPct },
    flags,
  };
}

function sum<T>(arr: T[], pred: (x: T) => boolean, f: (x: T) => number): number {
  let n = 0;
  for (const x of arr) if (pred(x)) n += f(x);
  return Math.round(n);
}

function StatBox({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string | null; tone: 'normal' | 'warning' | 'danger' }) {
  const t = useTheme();
  const color = tone === 'danger' ? t.error : tone === 'warning' ? t.warning : t.primary700;
  return (
    <Card style={{ flex: 1 }}>
      <Text token="heading2" style={{ color }}>{value}</Text>
      <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>{label}</Text>
      {sub ? (
        <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>{sub}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
});
