/**
 * Pain check — vision-assisted Feline Grimace Scale (FGS) scoring.
 *
 * Flow:
 *   1. Owner snaps or uploads a clear face photo of the cat.
 *   2. We send the photo to the vision model with a strict FGS schema.
 *   3. Each of five action units lands at 0 / 1 / 2 with a one-line
 *      rationale; composite is 0-10.
 *   4. The owner can override any AU (the model's not infallible) and
 *      save. Saved events feed the article library + longitudinal trend.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  HandHeart,
  Images,
  Spinner,
  Trash,
  WarningCircle,
} from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Text } from '../../src/components/Text';
import { scorePainFromPhoto, type FGSResult, type FGSUnit } from '../../src/ai/fgs';
import { useActiveCat } from '../../src/hooks/useActiveCat';
import { useProGate } from '../../src/services/paywallGate';
import {
  useHealthStore,
  type HealthEvent,
  type PainScorePayload,
} from '../../src/state/healthStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const UNITS: { key: keyof PainScorePayload['units']; label: string }[] = [
  { key: 'ear_position', label: 'Ears' },
  { key: 'orbital_tightening', label: 'Eyes' },
  { key: 'muzzle_tension', label: 'Muzzle' },
  { key: 'whisker_change', label: 'Whiskers' },
  { key: 'head_position', label: 'Head' },
];

const PAIN_THRESHOLD = 4;

export default function PainScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const proGate = useProGate();
  const events = useHealthStore((s) => s.events);
  const addEvent = useHealthStore((s) => s.addEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<FGSResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User may override the AI units — keep a separate state so the
  // rationales from the model stay pinned to what it ACTUALLY scored.
  const [overrides, setOverrides] = useState<Partial<PainScorePayload['units']>>({});

  const history = useMemo(() => {
    if (!cat) return [];
    return events
      .filter((e): e is HealthEvent<'pain_score'> =>
        e.cat_id === cat.id && e.type === 'pain_score',
      )
      .sort((a, b) => b.ts.localeCompare(a.ts));
  }, [events, cat]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const r = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });

    if (r.canceled || !r.assets[0]) return;
    setPhotoUri(r.assets[0].uri);
    setPhotoB64(r.assets[0].base64 ?? null);
    setResult(null);
    setOverrides({});
    setErrorMsg(null);
  };

  const runScore = async () => {
    if (!photoB64 || !cat) return;
    // Pro gate — FGS is research-grade vision AI (~$0.004/run). Hard
    // gate before spending. Photo stays loaded so they can resume
    // after subscribing.
    if (!proGate.check('pain')) return;
    setScoring(true);
    setErrorMsg(null);
    try {
      const r = await scorePainFromPhoto({ imageBase64: photoB64, catName: cat.name });
      setResult(r);
      setOverrides({});
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Could not score photo. Check connection.');
    } finally {
      setScoring(false);
    }
  };

  const overrideUnit = (key: keyof PainScorePayload['units'], value: FGSUnit) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const finalUnits = useMemo<PainScorePayload['units'] | null>(() => {
    if (!result) return null;
    return {
      ear_position: (overrides.ear_position ?? result.ear_position) as number,
      orbital_tightening: (overrides.orbital_tightening ?? result.orbital_tightening) as number,
      muzzle_tension: (overrides.muzzle_tension ?? result.muzzle_tension) as number,
      whisker_change: (overrides.whisker_change ?? result.whisker_change) as number,
      head_position: (overrides.head_position ?? result.head_position) as number,
    };
  }, [result, overrides]);

  const finalComposite = useMemo(() => {
    if (!finalUnits) return null;
    return Object.values(finalUnits).reduce((a, b) => a + b, 0);
  }, [finalUnits]);

  // Hook-order safety (2026-05-14 audit fix): early "no cat" return
  // used to live before the useMemo above, violating rules-of-hooks.
  // Moved here so every render runs the same hook sequence.
  if (!cat) return null;

  const save = () => {
    if (!result || !finalUnits || finalComposite == null) return;
    addEvent({
      cat_id: cat.id,
      type: 'pain_score',
      payload: {
        composite: finalComposite,
        units: finalUnits,
        photo_uri: photoUri,
        measured_at: new Date().toISOString(),
      },
    });
    // Reset for the next measurement.
    setPhotoUri(null);
    setPhotoB64(null);
    setResult(null);
    setOverrides({});
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Remove this pain score?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(id) },
    ]);
  };

  const chartData = history
    .slice()
    .reverse()
    .map((e) => ({ x: new Date(e.ts).getTime(), y: e.payload.composite }));

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      {/* Credibility eyebrow — added 2026-05-03. The Feline Grimace
          Scale (Evangelista et al., Univ. of Montreal, 2019) is a
          validated clinical instrument; this screen was previously
          presented like any other tile, which underplayed how rigorous
          the underlying scale actually is. The eyebrow plus the
          formal credit in the body copy below positions this as
          research-grade, not a casual heuristic. */}
      <Text
        token="caption"
        style={{
          color: t.secondary700,
          fontFamily: 'Figtree_600SemiBold',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        Validated · Univ. of Montreal · 2019
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1] }}>
        <HandHeart size={22} color={t.primary700} weight="fill" />
        <Text token="heading1" style={{ flex: 1 }}>Pain check</Text>
      </View>
      <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
        Feline Grimace Scale — Evangelista et al.&apos;s validated facial-expression
        pain scale. Snap a clear face photo while {cat.name} is calm.
        The AI scores 5 action units (ears, eyes, muzzle, whiskers, head)
        the same way the published rubric does, with a one-line rationale
        for each so you can sanity-check what the model saw.
      </Text>

      {/* Photo capture */}
      <Card style={{ marginTop: space[4] }}>
        <Text token="heading3">Photo</Text>
        <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
          Good lighting · face filling the frame · ears, eyes, muzzle, whiskers
          all visible.
        </Text>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{
              width: '100%',
              aspectRatio: 1,
              marginTop: space[3],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.borderSubtle,
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: '100%',
              aspectRatio: 1,
              marginTop: space[3],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.borderStrong,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text token="body" color="textMuted">No photo yet</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
          <Button
            label="Take photo"
            onPress={() => pickPhoto('camera')}
            leftIcon={<Camera size={18} color={t.textInverse} weight="bold" />}
            style={{ flex: 1 }}
          />
          <Button
            label="Gallery"
            variant="secondary"
            onPress={() => pickPhoto('library')}
            leftIcon={<Images size={18} color={t.textPrimary} />}
            style={{ flex: 1 }}
          />
        </View>

        {photoB64 && !result ? (
          <Button
            label={scoring ? 'Scoring\u2026' : 'Score with AI'}
            onPress={runScore}
            disabled={scoring}
            leftIcon={scoring
              ? <Spinner size={18} color={t.textInverse} />
              : <HandHeart size={18} color={t.textInverse} weight="fill" />}
            fullWidth
            style={{ marginTop: space[3] }}
          />
        ) : null}

        {errorMsg ? (
          <Text token="caption" color="error" style={{ marginTop: space[2] }}>
            {errorMsg}
          </Text>
        ) : null}
      </Card>

      {/* Result */}
      {result && finalUnits && finalComposite != null ? (
        <>
          {!result.photo_quality_ok ? (
            <Card style={{ marginTop: space[3], borderLeftWidth: 4, borderLeftColor: t.warning }}>
              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <WarningCircle size={20} color={t.warning} weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text token="heading3" style={{ color: t.warning }}>Photo quality</Text>
                  <Text token="body" style={{ marginTop: space[1] }}>
                    {result.photo_quality_notes ?? 'The model struggled to read the face. Try a clearer front-facing photo.'}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <Card
            style={{
              marginTop: space[3],
              borderLeftWidth: 4,
              borderLeftColor: finalComposite >= PAIN_THRESHOLD ? t.error : t.success,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
              <Text
                token="heading1"
                style={{ color: finalComposite >= PAIN_THRESHOLD ? t.error : t.success }}
              >
                {finalComposite}
              </Text>
              <Text token="body" color="textMuted" style={{ paddingBottom: 4 }}>
                / 10
              </Text>
              <Text
                token="caption"
                color="textMuted"
                style={{ flex: 1, textAlign: 'right', paddingBottom: 6 }}
              >
                {result.confidence} confidence
              </Text>
            </View>
            <Text token="body" style={{ marginTop: space[1] }}>
              {finalComposite >= PAIN_THRESHOLD
                ? `A score of ${PAIN_THRESHOLD}/10 or higher suggests ${cat.name} is in enough pain to warrant analgesia. Call your vet — do not give human painkillers; most are toxic to cats.`
                : 'Below the analgesia-needed threshold. Keep monitoring; re-score in a few hours if you suspect discomfort.'}
            </Text>
          </Card>

          {/* Per-unit overrides */}
          <View style={{ marginTop: space[3], gap: space[2] }}>
            {UNITS.map((u) => {
              const auto = result[u.key] as FGSUnit;
              const current = (overrides[u.key] ?? auto) as FGSUnit;
              const overridden = overrides[u.key] != null && overrides[u.key] !== auto;
              return (
                <Card key={u.key}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <View style={{ flex: 1 }}>
                      <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
                        {u.label}
                      </Text>
                      <Text token="caption" color="textSecondary" style={{ marginTop: 2 }}>
                        {result.rationale[u.key]}
                      </Text>
                      {overridden ? (
                        <Text token="caption" color="primary700" style={{ marginTop: 2 }}>
                          Overridden from AI score of {auto}.
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[0, 1, 2].map((v) => (
                        <Pressable
                          key={v}
                          onPress={() => overrideUnit(u.key, v as FGSUnit)}
                          style={({ pressed }) => [
                            styles.auBtn,
                            {
                              borderColor: current === v ? t.primary700 : t.borderStrong,
                              backgroundColor: current === v ? t.primary700 : t.surface,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                          accessibilityLabel={`${u.label} score ${v}`}
                        >
                          <Text
                            token="body"
                            style={{
                              color: current === v ? t.textInverse : t.textPrimary,
                              fontFamily: 'Figtree_600SemiBold',
                            }}
                          >
                            {v}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[4] }}>
            <Button
              label="Retake"
              variant="ghost"
              onPress={() => {
                setResult(null);
                setOverrides({});
                setPhotoUri(null);
                setPhotoB64(null);
              }}
            />
            <Button label="Save score" onPress={save} />
          </View>
        </>
      ) : null}

      {/* History */}
      {history.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <Text
            token="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
          >
            Trend · {history.length} score{history.length === 1 ? '' : 's'}
          </Text>
          <Card>
            <LineChart
              data={chartData}
              height={140}
              yLines={[PAIN_THRESHOLD]}
              yMin={0}
              yMax={10}
            />
          </Card>

          <View style={{ marginTop: space[3], gap: space[2] }}>
            {history.slice(0, 10).map((e) => {
              const overThreshold = e.payload.composite >= PAIN_THRESHOLD;
              return (
                <Card
                  key={e.id}
                  style={{ borderLeftWidth: 4, borderLeftColor: overThreshold ? t.error : t.success }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    {e.payload.photo_uri ? (
                      <Image
                        source={{ uri: e.payload.photo_uri }}
                        style={{
                          width: 56, height: 56, borderRadius: radius.sm,
                          borderWidth: 1, borderColor: t.borderSubtle,
                        }}
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text
                        token="heading3"
                        style={{ color: overThreshold ? t.error : t.textPrimary }}
                      >
                        {e.payload.composite} / 10
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
  auBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
