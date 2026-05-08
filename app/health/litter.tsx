/**
 * Litter box frequency tracker — FLUTD (feline lower urinary tract disease)
 * early-warning + CKD signal.
 *
 * Clinical rationale:
 *   - Zero pees in 24h in a male cat = urinary obstruction suspicion. This
 *     is a <24h emergency; cats die of this.
 *   - 5+ pees in 24h = polyuria. Classic early CKD, diabetes, or
 *     hyperthyroidism sign.
 *   - Straining, blood, or abnormal deposits → cystitis, stones, blockage.
 *
 * UI: one-tap logging (tap emoji-button) with optional abnormal flag + notes.
 * Dashboard shows 7-day rolling counts and surfaces the two alert conditions.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Drop,
  Plus,
  Question,
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
  type LitterBoxUsePayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Kind = LitterBoxUsePayload['kind'];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'urine', label: 'Pee' },
  { kind: 'stool', label: 'Poo' },
  { kind: 'both', label: 'Both' },
  { kind: 'unknown', label: 'Unknown' },
];

export default function LitterBoxScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const [abnormal, setAbnormal] = useState(false);
  const [notes, setNotes] = useState('');

  const history = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e): e is HealthEvent<'litter_box_use'> =>
        e.cat_id === cat.id && e.type === 'litter_box_use',
      )
      .sort((a, b) => b.ts.localeCompare(a.ts));
  }, [events, cat]);

  const stats = useMemo(() => compute(history), [history]);

  if (!cat) return null;

  const quickLog = (kind: Kind) => {
    addEvent({
      cat_id: cat.id,
      type: 'litter_box_use',
      payload: {
        kind,
        abnormal,
        notes: notes.trim() || null,
        logged_at: new Date().toISOString(),
      },
    });
    setNotes('');
    setAbnormal(false);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this log?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Toilet size={22} color={t.primary700} />
        <Text token="heading1" style={{ flex: 1 }}>Litter box</Text>
      </View>
      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
        Log each use — we&rsquo;ll spot urinary-tract emergencies (zero pees)
        and CKD/diabetes red flags (too many pees).
      </Text>

      {/* Alert banners */}
      {stats.urinaryBlockageRisk ? (
        <Card style={{ marginTop: space[4], borderLeftWidth: 4, borderLeftColor: t.error }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
            <WarningCircle size={22} color={t.error} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text token="heading3" style={{ color: t.error }}>Possible urinary blockage</Text>
              <Text token="body" style={{ marginTop: space[1] }}>
                No urinations logged in the last 24 hours. If {cat.name} is a
                male cat or straining, this is a life-threatening emergency.
                Call your vet immediately.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
      {stats.polyuriaRisk ? (
        <Card style={{ marginTop: space[3], borderLeftWidth: 4, borderLeftColor: t.warning }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
            <WarningCircle size={22} color={t.warning} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text token="heading3" style={{ color: t.warning }}>Drinking &amp; peeing more than usual?</Text>
              <Text token="body" style={{ marginTop: space[1] }}>
                {stats.today.urine}+ urinations today. Persistent polyuria is
                an early sign of kidney disease, diabetes, or hyperthyroidism.
                Worth a vet visit and a urinalysis.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Quick log */}
      <Card style={{ marginTop: space[4] }}>
        <Text token="heading3">Log a visit</Text>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
          {KINDS.map((k) => (
            <Pressable
              key={k.kind}
              onPress={() => quickLog(k.kind)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${k.label}`}
              style={({ pressed }) => [
                styles.kindBtn,
                {
                  borderColor: t.primary700,
                  backgroundColor: pressed ? t.primary50 : t.surface,
                },
              ]}
            >
              {iconForKind(k.kind, t)}
              <Text token="caption" style={{ color: t.primary700, fontFamily: 'Figtree_600SemiBold', marginTop: 2 }}>
                {k.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: space[3], flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Pressable
            onPress={() => setAbnormal((v) => !v)}
            hitSlop={6}
            accessibilityRole="switch"
            accessibilityState={{ checked: abnormal }}
            style={{
              width: 22, height: 22,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: abnormal ? t.error : t.borderStrong,
              backgroundColor: abnormal ? t.error : t.surface,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {abnormal ? (
              <Text style={{ color: t.textInverse, fontSize: 14, lineHeight: 14 }}>{'\u2713'}</Text>
            ) : null}
          </Pressable>
          <Text token="body" style={{ flex: 1 }}>
            Mark as abnormal (blood, straining, diarrhea, outside box)
          </Text>
        </View>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional note (e.g. \u201Cstrained for 2min\u201D, \u201Chard stool\u201D)"
          placeholderTextColor={t.textMuted}
          style={{
            marginTop: space[3],
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
      </Card>

      {/* Today + 7-day rollup */}
      <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
        <StatBox
          label="Today pee"
          value={stats.today.urine}
          tone={stats.today.urine === 0 ? 'danger' : stats.today.urine >= 5 ? 'warning' : 'normal'}
        />
        <StatBox
          label="Today poo"
          value={stats.today.stool}
          tone={stats.today.stool === 0 && history.length > 5 ? 'warning' : 'normal'}
        />
        <StatBox label="7-day total" value={stats.last7.total} tone="normal" />
      </View>

      {/* Chart */}
      {stats.daily.length >= 2 ? (
        <View style={{ marginTop: space[4] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Last 14 days · daily visits
          </Text>
          <Card>
            <LineChart
              data={stats.daily.map((d) => ({ x: d.x, y: d.count }))}
              height={120}
              yUnit=""
            />
          </Card>
        </View>
      ) : null}

      {/* History list */}
      {history.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Recent
          </Text>
          <View style={{ gap: space[2] }}>
            {history.slice(0, 20).map((e) => (
              <Card key={e.id} style={e.payload.abnormal ? { borderLeftWidth: 4, borderLeftColor: t.error } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text token="body" style={{ fontFamily: 'Figtree_500Medium', textTransform: 'capitalize' }}>
                      {labelForKind(e.payload.kind)}
                      {e.payload.abnormal ? ' · abnormal' : ''}
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

function compute(history: HealthEvent<'litter_box_use'>[]) {
  const now = Date.now();
  const in24h = (iso: string) => now - new Date(iso).getTime() <= DAY;
  const in7d = (iso: string) => now - new Date(iso).getTime() <= 7 * DAY;

  const todayUrine = history.filter((e) =>
    in24h(e.ts) && (e.payload.kind === 'urine' || e.payload.kind === 'both'),
  ).length;
  const todayStool = history.filter((e) =>
    in24h(e.ts) && (e.payload.kind === 'stool' || e.payload.kind === 'both'),
  ).length;

  const last7Total = history.filter((e) => in7d(e.ts)).length;

  // 14-day daily counts. We need at least some history before flagging zero-pee
  // as a blockage risk — otherwise a brand-new user always trips it.
  const start = now - 14 * DAY;
  const byDay = new Map<number, number>();
  for (const e of history) {
    const ts = new Date(e.ts).getTime();
    if (ts < start) continue;
    const dayKey = Math.floor(ts / DAY);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
  }
  const daily: { x: number; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = Math.floor((now - i * DAY) / DAY);
    daily.push({ x: d * DAY + DAY / 2, count: byDay.get(d) ?? 0 });
  }

  // Blockage risk: no urine events in the last 24h AND we have enough
  // history to suggest the user logs regularly (at least 3 events in prior 7 days).
  const priorWeekLogs = history.filter(
    (e) => now - new Date(e.ts).getTime() > DAY && now - new Date(e.ts).getTime() <= 8 * DAY,
  ).length;
  const urinaryBlockageRisk = todayUrine === 0 && priorWeekLogs >= 3;

  // Polyuria: 5+ pees in 24h.
  const polyuriaRisk = todayUrine >= 5;

  return {
    today: { urine: todayUrine, stool: todayStool },
    last7: { total: last7Total },
    daily,
    urinaryBlockageRisk,
    polyuriaRisk,
  };
}

function iconForKind(kind: Kind, t: ReturnType<typeof useTheme>) {
  const common = { size: 24, color: t.primary700, weight: 'fill' as const };
  if (kind === 'urine') return <Drop {...common} />;
  if (kind === 'stool') return <Toilet {...common} />;
  if (kind === 'both') return <Plus {...common} />;
  return <Question {...common} />;
}

function labelForKind(kind: Kind): string {
  if (kind === 'urine') return 'Pee';
  if (kind === 'stool') return 'Poo';
  if (kind === 'both') return 'Both';
  return 'Unknown';
}

function StatBox({ label, value, tone }: {
  label: string; value: number; tone: 'normal' | 'warning' | 'danger';
}) {
  const t = useTheme();
  const color = tone === 'danger' ? t.error : tone === 'warning' ? t.warning : t.primary700;
  return (
    <Card style={{ flex: 1, alignItems: 'center' }}>
      <Text token="heading1" style={{ color }}>{value}</Text>
      <Text token="caption" color="textMuted" style={{ marginTop: 2, textAlign: 'center' }}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  kindBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
  },
});
