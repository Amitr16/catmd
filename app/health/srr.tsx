/**
 * Sleeping Respiratory Rate (SRR) tracker — the early-warning stethoscope
 * every cardiac cardiologist asks owners to run at home.
 *
 * Clinical basis: a healthy cat at rest breathes < 30 breaths/minute.
 * Sustained SRR ≥ 30 bpm — especially in a cat known to have a heart
 * murmur or diagnosed HCM — strongly predicts congestive heart failure
 * onset and typically precedes clinical signs by days. Daily home logs
 * let the vet adjust meds before emergency presentation.
 *
 * UI: count-one-breath-per-tap while the cat is sleeping. A 30-second
 * window is the standard clinical protocol (× 2 → bpm). We also offer
 * 15s and 60s for quick peeks or noisy/irregular breathing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Heartbeat, Play, Stop, Trash, WarningCircle } from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Text } from '../../src/components/Text';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import {
  useHealthStore,
  type HealthEvent,
  type SRRMeasurementPayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const DURATIONS: { label: string; seconds: number }[] = [
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
];

const ALERT_BPM = 30;

export default function SRRScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const history = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e): e is HealthEvent<'srr_measurement'> =>
        e.cat_id === cat.id && e.type === 'srr_measurement',
      )
      .sort((a, b) => b.ts.localeCompare(a.ts));
  }, [events, cat]);

  const chartData = useMemo(
    () => history
      .slice()
      .reverse()
      .map((e) => ({
        x: new Date(e.ts).getTime(),
        y: e.payload.bpm,
      })),
    [history],
  );

  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState(0);
  const [remaining, setRemaining] = useState(30);
  const [lastBpm, setLastBpm] = useState<number | null>(null);
  const [lastDurationS, setLastDurationS] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  if (!cat) return null;

  const start = () => {
    setTaps(0);
    setRemaining(duration);
    setRunning(true);
    setLastBpm(null);
    setLastDurationS(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (running && remaining === 0) {
      setRunning(false);
      const bpm = Math.round((taps / duration) * 60);
      setLastBpm(bpm);
      setLastDurationS(duration);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [running, remaining, taps, duration]);

  const stop = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRunning(false);
    const elapsed = duration - remaining;
    if (elapsed > 2) {
      const bpm = Math.round((taps / Math.max(1, elapsed)) * 60);
      setLastBpm(bpm);
      setLastDurationS(elapsed);
    }
  };

  const tap = () => {
    if (!running) return;
    setTaps((n) => n + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const save = () => {
    if (lastBpm == null || lastDurationS == null) return;
    addEvent({
      cat_id: cat.id,
      type: 'srr_measurement',
      payload: {
        bpm: lastBpm,
        duration_s: lastDurationS,
        measured_at: new Date().toISOString(),
        notes: notes.trim() || null,
      },
    });
    setLastBpm(null);
    setLastDurationS(null);
    setNotes('');
    setTaps(0);
    setRemaining(duration);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this measurement?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
  };

  const bpmColor = lastBpm == null
    ? t.textPrimary
    : lastBpm >= ALERT_BPM ? t.error : t.success;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Heartbeat size={22} color={t.primary700} weight="fill" />
        <Text token="heading1" style={{ flex: 1 }}>Breath count</Text>
      </View>
      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
        While {cat.name} sleeps, tap once per breath (one inhale + exhale = one
        breath). Healthy resting cats stay under {ALERT_BPM} bpm.
      </Text>

      {/* Duration selector */}
      <Card style={{ marginTop: space[4] }}>
        <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          Window
        </Text>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
          {DURATIONS.map((d) => (
            <Pressable
              key={d.seconds}
              onPress={() => { if (!running) { setDuration(d.seconds); setRemaining(d.seconds); } }}
              disabled={running}
              style={({ pressed }) => [
                styles.durationChip,
                {
                  borderColor: duration === d.seconds ? t.primary700 : t.borderStrong,
                  backgroundColor: duration === d.seconds ? t.primary700 : t.surface,
                  opacity: running ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                token="body"
                style={{
                  color: duration === d.seconds ? t.textInverse : t.textPrimary,
                  fontFamily: 'Figtree_500Medium',
                }}
              >
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Tap pad */}
      <Pressable
        onPress={tap}
        disabled={!running}
        accessibilityLabel="Tap to count one breath"
        style={({ pressed }) => [
          {
            marginTop: space[4],
            height: 220,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: running ? t.primary700 : t.surfaceSunken,
            borderWidth: 2,
            borderColor: running ? t.primary700 : t.borderStrong,
            opacity: pressed && running ? 0.85 : 1,
          },
        ]}
      >
        <Text
          token="displayLg"
          style={{
            color: running ? t.textInverse : t.textMuted,
            fontSize: 56,
            lineHeight: 60,
          }}
        >
          {taps}
        </Text>
        <Text
          token="caption"
          style={{
            color: running ? t.textInverse : t.textMuted,
            marginTop: space[1],
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {running ? `${remaining}s left · tap per breath` : 'Taps'}
        </Text>
      </Pressable>

      {!running && lastBpm == null ? (
        <Button
          label={`Start ${duration}s count`}
          onPress={start}
          leftIcon={<Play size={18} color={t.textInverse} weight="fill" />}
          fullWidth
          style={{ marginTop: space[4] }}
        />
      ) : null}

      {running ? (
        <Button
          label="Stop"
          variant="secondary"
          onPress={stop}
          leftIcon={<Stop size={18} color={t.textPrimary} weight="fill" />}
          fullWidth
          style={{ marginTop: space[4] }}
        />
      ) : null}

      {/* Result */}
      {!running && lastBpm != null ? (
        <Card style={{ marginTop: space[4], borderLeftWidth: 4, borderLeftColor: bpmColor }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            {lastBpm >= ALERT_BPM ? <WarningCircle size={22} color={t.error} weight="fill" /> : null}
            <Text token="heading2" style={{ color: bpmColor, flex: 1 }}>
              {lastBpm} bpm
            </Text>
          </View>
          <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
            {lastBpm >= ALERT_BPM
              ? `Sustained rates at or above ${ALERT_BPM} bpm can signal fluid on the lungs (CHF). Call your vet today — especially if ${cat.name} has a known murmur or HCM.`
              : `Normal range. Keep logging a few times a week so trends are obvious.`}
            {' '}({taps} breaths in {lastDurationS}s)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional: context (napping, deep sleep, post-play)"
            placeholderTextColor={t.textMuted}
            style={{
              marginTop: space[3],
              minHeight: 44,
              padding: space[3],
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: t.borderStrong,
              backgroundColor: t.surface,
              color: t.textPrimary,
              fontFamily: 'Figtree_400Regular',
              fontSize: 15,
            }}
          />
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
            <Button
              label="Redo"
              variant="ghost"
              onPress={() => {
                setLastBpm(null);
                setLastDurationS(null);
                setNotes('');
                setTaps(0);
                setRemaining(duration);
              }}
            />
            <Button label="Save measurement" onPress={save} />
          </View>
        </Card>
      ) : null}

      {/* History */}
      {history.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Trend · {history.length} measurement{history.length === 1 ? '' : 's'}
          </Text>
          <Card>
            <LineChart
              data={chartData}
              height={140}
              yLines={[ALERT_BPM]}
              yUnit=" bpm"
            />
          </Card>
          <View style={{ marginTop: space[3], gap: space[2] }}>
            {history.slice(0, 10).map((e) => {
              const isAlert = e.payload.bpm >= ALERT_BPM;
              return (
                <Card key={e.id} style={{ borderLeftWidth: 4, borderLeftColor: isAlert ? t.error : t.success }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <View style={{ flex: 1 }}>
                      <Text token="heading3" style={{ color: isAlert ? t.error : t.textPrimary }}>
                        {e.payload.bpm} bpm
                      </Text>
                      <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                        {new Date(e.ts).toLocaleString()} · {e.payload.duration_s}s window
                      </Text>
                      {e.payload.notes ? (
                        <Text token="body" style={{ marginTop: space[1] }}>{e.payload.notes}</Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => confirmDelete(e.id)} hitSlop={8}>
                      <Trash size={18} color={t.textMuted} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  durationChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
