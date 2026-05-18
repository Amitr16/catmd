/**
 * Behavior screen — Layer A of the (planned) Body Language Triage stack.
 *
 * One unified pipeline: every input becomes a short video, and we extract
 * 6 frames at 1-second intervals before the AI sees anything. Two ways
 * to feed it:
 *
 *   1. CAPTURE: live record a 6-second video from the device camera. Frames
 *      extracted at 0/1/2/3/4/5 seconds.
 *
 *   2. UPLOAD: pick a video from the gallery. If ≤ 7 seconds, extract 6
 *      frames straight-through. If longer, show a reel-style trim picker
 *      (8 evenly-spaced thumbnails) and let the user tap the thumbnail
 *      closest to the start of the 6-second window they care about.
 *
 * Both paths hand the same shape (string[] of base64 JPEGs) to
 * `analyzeBehaviorWithContext()`. Daily-limit gate, downstream rendering,
 * and persistence are unchanged.
 *
 * Behaviour is observational, not diagnostic — the prompt + UI footer make
 * that wall obvious. See src/services/behaviorObservation.ts.
 *
 * UX honesty: at 1-frame-per-second, the AI catches posture, tail position,
 * ear position, and gross movement — but NOT sub-second motion (whisker
 * twitches, fast tail flicks, blink rate). The mode-picker screen says so
 * up front so users don't expect what we can't deliver.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowSquareOut, Camera as CameraIcon, ClockCounterClockwise, Eye, FilmStrip, Sparkle } from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { ObservationBody } from '../src/components/ObservationBody';
import { useProGate } from '../src/services/paywallGate';
import { useCatStore } from '../src/state/catStore';
import { useHealthStore } from '../src/state/healthStore';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';
import {
  analyzeBehaviorWithContext,
  NoCatDetectedError,
  transcribeBehaviorAudio,
} from '../src/services/behaviorObservation';
import { buildCatContext } from '../src/services/catContext';

// Cycled while the model is thinking — same vibe as the scan flow.
const THINKING_WORDS = [
  'observing',
  'reading the tail',
  'checking the ears',
  'tracking eyes',
  'noticing posture',
  'parsing whisker tilt',
  'measuring slow blinks',
  'reading the tells',
];

const BURST_FRAMES = 6;                  // frames sent to the model
const RECORD_SECONDS = 6;                // live-capture clip length (seconds)
const SHORT_VIDEO_THRESHOLD_SEC = 7;     // < this → no trim picker, take first 6s
const REEL_THUMB_COUNT = 8;              // thumbnails in the trim reel
const FREE_DAILY_LIMIT = 3;

// Long-form explainer article on catmd.pet — what AI body-language
// readers actually do, the five channels, the per-cat memory layer,
// what they don't claim. Linked from the mode picker + the done stage
// so curious users can build trust in the read.
const HOW_BODY_LANGUAGE_READER_WORKS_URL =
  'https://catmd.pet/library/how-body-language-readers-work';

/**
 * Open the long-form explainer in the OS browser. Fire-and-forget;
 * silent failure if the URL can't be opened (corporate device, no
 * browser, etc.) — never breaks the user's flow.
 */
async function openBodyLanguageExplainer(
  source: 'mode_picker' | 'done_stage',
): Promise<void> {
  void import('../src/services/analytics').then(({ track }) =>
    track({
      type: 'behavior_how_it_works_opened',
      props: { source },
    }),
  );
  try {
    const ok = await Linking.canOpenURL(HOW_BODY_LANGUAGE_READER_WORKS_URL);
    if (ok) await Linking.openURL(HOW_BODY_LANGUAGE_READER_WORKS_URL);
  } catch {
    // Silent — never block the user.
  }
}

type Stage =
  | 'pick'              // initial — choose Capture vs Upload
  | 'capture'           // live camera, ready to burst
  | 'capturing'         // burst in progress (counter)
  | 'processing-video'  // pulling frames out of an uploaded video
  | 'trim'              // long video — user picking 6s window
  | 'analyzing'         // sending to AI
  | 'done'              // observation rendered
  | 'error';

type ReelThumb = {
  uri: string;          // file:// to a local JPEG
  atSec: number;        // timestamp this thumb represents
};

export default function BehaviorScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const proGate = useProGate();
  const addEvent = useHealthStore((s) => s.addEvent);
  const events = useHealthStore((s) => s.events);

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [observation, setObservation] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload-flow state
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [reel, setReel] = useState<ReelThumb[]>([]);
  const [trimStartSec, setTrimStartSec] = useState<number>(0);

  const todayCount = (() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return events.filter(
      (e) =>
        e.type === 'behavior_observation' &&
        cat &&
        e.cat_id === cat.id &&
        new Date(e.ts).getTime() >= startMs,
    ).length;
  })();
  // Lifetime count for the active cat — drives the "See past readings (N)"
  // chip on the mode picker. Reused on the done stage to show the same.
  const totalReadings = (() => {
    if (!cat) return 0;
    return events.filter(
      (e) => e.type === 'behavior_observation' && e.cat_id === cat.id,
    ).length;
  })();
  const dailyLimitHit = todayCount >= FREE_DAILY_LIMIT;

  useEffect(() => {
    if (stage !== 'analyzing') return;
    const id = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % THINKING_WORDS.length);
    }, 1300);
    return () => clearInterval(id);
  }, [stage]);

  // Recording counter — increments once per second while the camera is
  // recording. Driven by the stage state so it auto-stops when the
  // recording finishes (recordAsync resolves and stage flips).
  useEffect(() => {
    if (stage !== 'capturing') return;
    setProgress(0);
    const id = setInterval(() => {
      setProgress((p) => Math.min(p + 1, RECORD_SECONDS));
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  // ── CAPTURE PATH ─────────────────────────────────────────────────────────

  const goToCapture = async () => {
    // Pro gate — paid / trial / whitelisted only. Routes to /paywall
    // if blocked. Fires `paywall_gate_blocked` analytics. Loading
    // state always passes through (optimistic) so we don't flash the
    // paywall on cold start.
    if (!proGate.check('behavior')) return;
    // Lazy permission ask — user explicitly chose the camera path. We need
    // BOTH camera (always) and microphone (because we record audio for the
    // Whisper transcription that feeds the AI observation). If the user
    // declines microphone we still let them record — recordAsync just
    // produces a video without an audio track and the observation runs
    // visual-only.
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setErrorMsg('Camera permission was declined. Try the Upload option instead.');
        setStage('error');
        return;
      }
    }
    if (!micPermission?.granted) {
      // Request once. If declined, we proceed silently — the camera will
      // record video without audio (no crash). Audio analysis just won't
      // run for this clip.
      await requestMicPermission();
    }
    setStage('capture');
  };

  /**
   * Live capture flow — record a short video, then run the same
   * `extractFramesFromVideo()` helper used by the upload path. Unifying
   * on a single video-then-extract pipeline keeps both flows coherent and
   * means improvements to frame extraction benefit both paths.
   *
   * `recordAsync({ maxDuration: RECORD_SECONDS })` auto-stops the camera
   * at the time limit, so we don't have to manually manage stopRecording.
   * The on-screen counter is a parallel UI clock (driven by useEffect
   * elsewhere) that runs while stage === 'capturing'.
   */
  const recordAndExtract = async () => {
    if (!cameraRef.current || !cat) {
      setErrorMsg(cat ? 'Camera not ready' : 'Add a cat profile first.');
      setStage('error');
      return;
    }
    setStage('capturing');
    setProgress(0);
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'behavior_observation_started', props: { source: 'camera' } }),
    );

    try {
      // Record the clip. expo-camera v17 returns { uri } on a successful
      // recording. mute=true avoids triggering microphone permission for
      // a feature that doesn't use audio.
      const result = await cameraRef.current.recordAsync({
        maxDuration: RECORD_SECONDS,
      });
      if (!result?.uri) throw new Error('Recording produced no file');

      setStage('processing-video');
      const frames = await extractFramesFromVideo(
        result.uri,
        0,
        BURST_FRAMES,
        RECORD_SECONDS,
      );
      if (frames.length === 0) {
        throw new Error('No frames could be extracted from the recording.');
      }
      await runAnalyze(frames, result.uri);
    } catch (err) {
      handleError(err);
    }
  };

  // ── UPLOAD PATH ──────────────────────────────────────────────────────────

  const pickVideo = async () => {
    if (!proGate.check('behavior')) return;
    if (!cat) {
      setErrorMsg('Add a cat profile first.');
      setStage('error');
      return;
    }
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'behavior_observation_started', props: { source: 'library' } }),
    );
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg('Photo library permission was declined.');
        setStage('error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // SDK 54 still accepts the legacy MediaTypeOptions enum
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.[0]) return; // user backed out
      const asset = result.assets[0];
      const durationSec = asset.duration != null ? asset.duration / 1000 : null;
      if (durationSec == null || durationSec < 1) {
        setErrorMsg("Couldn't read that video's duration. Try a different file.");
        setStage('error');
        return;
      }
      if (durationSec < 3) {
        setErrorMsg('That clip is too short — please use one at least 3 seconds long.');
        setStage('error');
        return;
      }
      setVideoUri(asset.uri);
      setVideoDurationSec(durationSec);

      // ≤7s → no trim picker, take first 6s (or fewer if super short)
      if (durationSec <= SHORT_VIDEO_THRESHOLD_SEC) {
        setStage('processing-video');
        await processVideoFromStart(asset.uri, 0, durationSec);
        return;
      }

      // Longer → load reel + go to trim picker
      setStage('processing-video');
      const newReel = await loadReelThumbnails(asset.uri, durationSec, REEL_THUMB_COUNT);
      setReel(newReel);
      // Default start at 0 — user can move it before confirming
      setTrimStartSec(0);
      setStage('trim');
    } catch (err) {
      handleError(err);
    }
  };

  const confirmTrimAndProcess = async () => {
    if (!videoUri || videoDurationSec == null) return;
    setStage('processing-video');
    try {
      await processVideoFromStart(videoUri, trimStartSec, videoDurationSec);
    } catch (err) {
      handleError(err);
    }
  };

  const processVideoFromStart = async (
    uri: string,
    startSec: number,
    durationSec: number,
  ) => {
    // Cap so we never read past end of video
    const safeStart = Math.max(0, Math.min(startSec, durationSec - 1));
    const frames = await extractFramesFromVideo(uri, safeStart, BURST_FRAMES, durationSec);
    if (frames.length === 0) throw new Error('No frames could be extracted from that video.');
    // Pass the full source video URI for audio transcription. Whisper
    // analyses the entire audio track — we don't need to trim it. Trade-off
    // is small (a few extra cents of Whisper) and the result is still
    // useful: any meow in the chosen window will be in the source clip too.
    await runAnalyze(frames, uri);
  };

  // ── ANALYZE (shared by both paths) ───────────────────────────────────────

  const runAnalyze = async (frames: string[], videoUriForAudio: string | null) => {
    if (!cat) {
      setErrorMsg('Add a cat profile first.');
      setStage('error');
      return;
    }
    setStage('analyzing');
    // Kick off audio transcription in parallel with the analyse spinner.
    // Failures are non-fatal — null transcript = visual-only flow, which
    // is exactly the previous behaviour. Whisper costs ~$0.0006 per call
    // so this is effectively free even for false positives.
    const audioPromise: Promise<string | null> = videoUriForAudio
      ? transcribeBehaviorAudio(videoUriForAudio).catch(() => null)
      : Promise.resolve(null);
    const context = buildCatContext(cat.id);
    const audioTranscript = await audioPromise;

    // Multi-cat handling — pass the profile photo to the analyzer so
    // it can focus on the right cat in multi-cat households. SKIP the
    // identity check entirely for single-cat households (the common
    // case): the model occasionally false-rejects with "doesn't appear
    // in this clip" when lighting / angle / pose differs from the
    // profile photo, even though the user knows perfectly well it's
    // their cat. Mirrors the same skip rule in
    // `photoStudioStore.runIdentityCheck` (lines 349-364) so the
    // behaviour is consistent across surfaces.
    //
    // Best-effort: silent fallback if the file read fails.
    const onlyCatInApp = useCatStore.getState().cats.length === 1;
    let profileBase64: string | null = null;
    if (cat.photo_uri && !onlyCatInApp) {
      try {
        const FileSystem = await import('expo-file-system/legacy');
        profileBase64 = await FileSystem.readAsStringAsync(cat.photo_uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e) {
        console.warn('[Behavior] profile photo read failed (non-fatal):', e);
      }
    }

    const result = await analyzeBehaviorWithContext({
      framesBase64: frames,
      context,
      audioTranscript,
      profileBase64,
    });

    addEvent({
      cat_id: cat.id,
      type: 'behavior_observation',
      payload: {
        observation: result.observation,
        tags: result.tags,
        frame_count: frames.length,
        duration_sec: BURST_FRAMES,
        model: result.model,
        notes: null,
        observed_at: new Date().toISOString(),
      },
    });

    // Telemetry: success path was previously invisible — only the
    // no-cat-detected failure was tracked. This event is the entire
    // Read [cat] success funnel.
    void import('../src/services/analytics').then(({ track }) => {
      track({
        type: 'behavior_observation_completed',
        props: {
          frame_count: frames.length,
          had_audio: !!audioTranscript && audioTranscript.length > 0,
          tag_count: result.tags.length,
          top_tags: result.tags.slice(0, 3).join(','),
          observation_length: result.observation.length,
        },
      });
      // Unified activation event for marketing-attribution funnels
      // (audit 2026-05-16). Fires alongside behavior_observation_completed.
      track({ type: 'core_feature_used', props: { feature: 'behavior' } });
    });

    setObservation(result.observation);
    setTags(result.tags);
    setStage('done');

    // Silent world extraction — same frame buffer, separate model
    // call, fire-and-forget. Pulls objects/places/environment markers
    // from the clip and feeds them into the worldStore candidate
    // pool. Behaviour reading already shipped — this never blocks the
    // user-visible flow. Cost ~$0.001-0.005 per clip; cheap relative
    // to the body-language call we just made.
    void (async () => {
      try {
        const { extractWorldFromVideoFrames } = await import(
          '../src/services/worldExtraction'
        );
        await extractWorldFromVideoFrames({
          catId: cat.id,
          catName: cat.name,
          framesBase64: frames,
        });
      } catch (e) {
        console.warn('[Behavior] world extraction skipped:', e);
      }
    })();
  };

  const handleError = (err: unknown) => {
    // Specific friendly path for the no-cat-detected gate. Surfaces the
    // model's reason so the user knows why we refused (e.g. "looks like
    // a garden") and what to do (record again with the cat in frame).
    if (err instanceof NoCatDetectedError) {
      void import('../src/services/analytics').then(({ track }) =>
        track({
          type: 'behavior_rejected_no_cat',
          props: { reason: err.classifierReason.slice(0, 120) },
        }),
      );
      setErrorMsg(
        `We couldn't see ${cat?.name ?? 'your cat'} in this clip — ${err.classifierReason} ` +
          `Record again with ${cat?.name ?? 'your cat'} clearly in frame.`,
      );
      setStage('error');
      return;
    }
    const msg = err instanceof Error ? err.message : 'Something went wrong';
    setErrorMsg(msg);
    setStage('error');
    void import('../src/services/analytics').then(({ track }) =>
      track({
        type: 'behavior_observation_failed',
        props: { reason: msg.slice(0, 200) },
      }),
    );
  };

  const reset = () => {
    setObservation(null);
    setTags([]);
    setProgress(0);
    setVideoUri(null);
    setVideoDurationSec(null);
    setReel([]);
    setTrimStartSec(0);
    setErrorMsg(null);
    setStage('pick');
  };

  // ── RENDER ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
        </Pressable>
        <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
          Body Language
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {stage === 'pick' && (
        <ModePicker
          catName={cat?.name ?? 'your cat'}
          dailyLimitHit={dailyLimitHit}
          todayCount={todayCount}
          freeLimit={FREE_DAILY_LIMIT}
          totalReadings={totalReadings}
          onCapture={goToCapture}
          onUpload={pickVideo}
          onViewHistory={() =>
            router.push('/behavior-history?source=mode_picker' as never)
          }
        />
      )}

      {(stage === 'capture' || stage === 'capturing') && (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="video"
            // Disable audio capture if user declined the mic permission.
            // recordAsync would otherwise throw a RECORD_AUDIO permission
            // error on Android. Audio analysis simply won't run for this clip.
            mute={!micPermission?.granted}
          />
          {stage === 'capturing' && (
            <View style={styles.captureOverlay} pointerEvents="none">
              <View style={[styles.recDot, { backgroundColor: t.error }]} />
              <Text token="heading2" style={{ color: '#fff' }}>
                Recording… {progress}/{RECORD_SECONDS}s
              </Text>
              <Text token="body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
                Keep {cat?.name ?? 'your cat'} in frame
              </Text>
            </View>
          )}
          {stage === 'capture' && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + space[4] }]}>
              <Text token="caption" style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: space[2] }}>
                We&apos;ll record {RECORD_SECONDS} seconds, then read the body language.
              </Text>
              <Button label="Record" onPress={recordAndExtract} fullWidth />
            </View>
          )}
        </View>
      )}

      {stage === 'processing-video' && (
        <View style={styles.center}>
          <FilmStrip size={36} color={t.secondary700} weight="duotone" />
          <Text token="heading2" style={{ marginTop: space[4] }}>
            Loading video…
          </Text>
          <Text token="body" style={{ color: t.textMuted, marginTop: space[2], textAlign: 'center' }}>
            Reading frames from your clip.
          </Text>
        </View>
      )}

      {stage === 'trim' && (
        <TrimPicker
          reel={reel}
          videoDurationSec={videoDurationSec ?? 0}
          startSec={trimStartSec}
          onChangeStart={setTrimStartSec}
          onConfirm={confirmTrimAndProcess}
          onCancel={reset}
        />
      )}

      {stage === 'analyzing' && (
        <View style={styles.center}>
          <Sparkle size={36} color={t.secondary700} weight="duotone" />
          <Text token="heading2" style={{ marginTop: space[4] }}>
            {THINKING_WORDS[thinkingIndex]}…
          </Text>
          {/* Time estimate updated 2026-05-11 — split into TWO lines
              so users don't confuse the analysis-time with the
              recording duration. Recording = 6 sec fixed; analysis =
              up to 25 sec (frames + Whisper + vision pass + world
              extraction running in parallel). */}
          <Text token="body" style={{ color: t.textMuted, marginTop: space[2], textAlign: 'center' }}>
            Reading the 6-second clip — frames + audio.
          </Text>
          <Text token="caption" style={{ color: t.textMuted, marginTop: space[1], textAlign: 'center' }}>
            Analysis takes up to 25 sec.
          </Text>
        </View>
      )}

      {stage === 'done' && observation && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space[6], paddingBottom: insets.bottom + space[6] }}>
          <View style={[styles.card, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
            <Text token="caption" style={{ color: t.secondary700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: space[1] }}>
              What I noticed
            </Text>
            <ObservationBody text={observation} />

            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.map((tag) => (
                  <View
                    key={tag}
                    style={[styles.tag, { backgroundColor: t.secondary100, borderColor: t.borderSubtle }]}
                  >
                    <Text token="caption" style={{ color: t.secondary900 }}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={[styles.disclaimer, { borderTopColor: t.borderSubtle }]}>
              <Text token="caption" style={{ color: t.textMuted, lineHeight: 18 }}>
                Behaviour observation — not a diagnosis. For symptoms or anything that worries you, run a triage scan instead.
              </Text>
              {/* Trust-deepener on the done stage — users who just saw a
                  read often wonder "how reliable is this?" Pair with the
                  pre-record link in the mode picker so the explainer is
                  reachable at both moments of doubt. */}
              <Pressable
                onPress={() => openBodyLanguageExplainer('done_stage')}
                accessibilityRole="link"
                accessibilityLabel="Read how modern body-language readers work"
                style={({ pressed }) => [
                  styles.howItWorksLink,
                  { marginTop: space[2], opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  token="caption"
                  style={{
                    color: t.secondary700,
                    fontFamily: 'Figtree_600SemiBold',
                    fontSize: 12,
                    letterSpacing: 0.3,
                  }}
                >
                  How modern body-language readers work
                </Text>
                <ArrowSquareOut size={12} color={t.secondary700} weight="bold" />
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[6] }}>
            <View style={{ flex: 1 }}>
              <Button label="Run another" variant="ghost" fullWidth onPress={reset} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Done" onPress={() => router.back()} fullWidth />
            </View>
          </View>

          {/* Past readings link — sits below the primary actions on the
              done stage so the user knows readings ARE saved + viewable.
              Source-attributed via the ?source=done_stage param so we
              can measure the post-success → re-engagement path in
              PostHog separately from the mode-picker entry. */}
          <Pressable
            onPress={() =>
              router.replace('/behavior-history?source=done_stage' as never)
            }
            style={({ pressed }) => [
              styles.donePastLink,
              {
                borderColor: t.borderSubtle,
                backgroundColor: t.surfaceSunken,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Eye size={16} color={t.textSecondary} weight="duotone" />
            <Text token="caption" style={{ marginLeft: space[2], color: t.textSecondary, fontWeight: '600' }}>
              View all past readings — they all stay in {cat?.name ?? 'the cat'}&apos;s memory
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {stage === 'error' && (
        <View style={styles.center}>
          <Text token="heading2" style={{ color: t.warning, marginBottom: space[2] }}>
            Couldn&apos;t analyse
          </Text>
          <Text token="body" style={{ color: t.textMuted, marginBottom: space[6], textAlign: 'center' }}>
            {errorMsg}
          </Text>
          <Button label="Try again" fullWidth onPress={reset} />
        </View>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ModePicker({
  catName,
  dailyLimitHit,
  todayCount,
  freeLimit,
  totalReadings,
  onCapture,
  onUpload,
  onViewHistory,
}: {
  catName: string;
  dailyLimitHit: boolean;
  todayCount: number;
  freeLimit: number;
  totalReadings: number;
  onCapture: () => void;
  onUpload: () => void;
  onViewHistory: () => void;
}) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space[6], gap: space[4] }}
    >
      <Text token="bodyLg" style={{ color: t.textMuted, marginBottom: space[2] }}>
        Record 6 seconds of {catName} — the AI reads posture, tail, ears, and voice, then tells you what they&apos;re feeling.
      </Text>

      <Pressable
        onPress={dailyLimitHit ? undefined : onCapture}
        disabled={dailyLimitHit}
        style={({ pressed }) => [
          styles.optionCard,
          {
            backgroundColor: t.surfaceElevated,
            borderColor: t.borderSubtle,
            opacity: dailyLimitHit ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.optionIcon, { backgroundColor: t.secondary100, borderColor: t.borderSubtle }]}>
          <CameraIcon size={28} color={t.secondary700} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text token="heading3" style={{ marginBottom: 2 }}>
            Record now
          </Text>
          <Text token="caption" color="textMuted">
            6-second video. AI reads posture, tail, ears, voice. Best for spontaneous moments.
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={dailyLimitHit ? undefined : onUpload}
        disabled={dailyLimitHit}
        style={({ pressed }) => [
          styles.optionCard,
          {
            backgroundColor: t.surfaceElevated,
            borderColor: t.borderSubtle,
            opacity: dailyLimitHit ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.optionIcon, { backgroundColor: t.secondary100, borderColor: t.borderSubtle }]}>
          <FilmStrip size={28} color={t.secondary700} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text token="heading3" style={{ marginBottom: 2 }}>
            Upload a video
          </Text>
          <Text token="caption" color="textMuted">
            Pick from your gallery. If it&apos;s longer than 7s, you choose the 6-second window.
          </Text>
        </View>
      </Pressable>

      <View style={[styles.tipBox, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}>
        <Text token="caption" color="textMuted" style={{ lineHeight: 18 }}>
          <Text token="caption" style={{ color: t.textPrimary, fontWeight: '600' }}>How it reads:</Text>
          {' '}AI watches the video and listens to the audio — picking up posture, tail position, ears, eye state, broad movement, and any vocalisations (meows, purrs, trills).
        </Text>
        {/* Trust hook — long-form research-backed explainer. Mirrors
            the pattern on /translate so curious users can verify the
            methodology before committing to a recording. */}
        <Pressable
          onPress={() => openBodyLanguageExplainer('mode_picker')}
          accessibilityRole="link"
          accessibilityLabel="Read how the body-language reader works"
          style={({ pressed }) => [
            styles.howItWorksLink,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text
            token="caption"
            style={{
              color: t.secondary700,
              fontFamily: 'Figtree_600SemiBold',
              fontSize: 12,
              letterSpacing: 0.3,
            }}
          >
            Read how it works
          </Text>
          <ArrowSquareOut size={12} color={t.secondary700} weight="bold" />
        </Pressable>
      </View>

      {dailyLimitHit ? (
        <View style={[styles.limitBox, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}>
          <Text token="body" style={{ marginBottom: 4 }}>
            Daily limit reached
          </Text>
          <Text token="caption" color="textMuted">
            You&apos;ve logged {todayCount} behaviour check-ins today. Free cap resets at midnight.
          </Text>
        </View>
      ) : (
        <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[2] }}>
          {todayCount}/{freeLimit} free check-ins used today.
        </Text>
      )}

      {/* Past readings entry — sits below the primary CTAs so it's
          discoverable without competing with "Record" / "Upload". The
          count itself is the value prop ("you have N readings on file");
          if there are zero readings we hide the link entirely so the
          empty state on the picker stays uncluttered. */}
      {totalReadings > 0 ? (
        <Pressable
          onPress={onViewHistory}
          style={({ pressed }) => [
            styles.historyLink,
            {
              borderColor: t.borderSubtle,
              backgroundColor: t.surfaceSunken,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <ClockCounterClockwise size={18} color={t.secondary700} weight="duotone" />
          <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, flex: 1 }}>
            See past readings
          </Text>
          <View style={[styles.historyCount, { backgroundColor: t.secondary100 }]}>
            <Text token="caption" style={{ color: t.secondary900, fontWeight: '600' }}>
              {totalReadings}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function TrimPicker({
  reel,
  videoDurationSec,
  startSec,
  onChangeStart,
  onConfirm,
  onCancel,
}: {
  reel: ReelThumb[];
  videoDurationSec: number;
  startSec: number;
  onChangeStart: (s: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // The 6-second window starts at `startSec` — clamp so it never overflows
  const maxStart = Math.max(0, videoDurationSec - BURST_FRAMES);
  const safeStart = Math.min(startSec, maxStart);
  const endSec = Math.min(safeStart + BURST_FRAMES, videoDurationSec);

  // The big preview is whichever reel thumb sits closest to safeStart.
  const previewThumb =
    reel.find((r) => r.atSec >= safeStart) ?? reel[0] ?? null;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space[6], paddingBottom: insets.bottom + space[6], gap: space[4] }}
    >
      <Text token="heading3">Pick the 6-second window</Text>
      <Text token="caption" color="textMuted">
        Tap a frame in the reel to set the start of the 6-second clip we&apos;ll analyze.
      </Text>

      {previewThumb && (
        <Image
          source={{ uri: previewThumb.uri }}
          style={[styles.preview, { borderColor: t.borderSubtle }]}
          resizeMode="cover"
        />
      )}

      <Text token="caption" color="textMuted" style={{ textAlign: 'center' }}>
        Window: {fmtSec(safeStart)} → {fmtSec(endSec)} of {fmtSec(videoDurationSec)}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: space[2] }}
      >
        {reel.map((r) => {
          const isSelected = Math.abs(r.atSec - safeStart) < 0.5;
          const isInWindow = r.atSec >= safeStart && r.atSec <= endSec;
          return (
            <Pressable
              key={`${r.atSec}-${r.uri}`}
              onPress={() => onChangeStart(Math.min(r.atSec, maxStart))}
              style={({ pressed }) => [
                styles.reelItem,
                {
                  borderColor: isSelected ? t.secondary700 : isInWindow ? t.secondary300 : t.borderSubtle,
                  borderWidth: isSelected ? 3 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Image source={{ uri: r.uri }} style={styles.reelImage} />
              <View style={[styles.reelLabel, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Text token="caption" style={{ color: '#fff', fontSize: 10 }}>
                  {fmtSec(r.atSec)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancel" variant="ghost" fullWidth onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Analyze this clip" fullWidth onPress={onConfirm} />
        </View>
      </View>
    </ScrollView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate `count` evenly-spaced thumbnails across the video, plus the
 * implied timestamp in seconds. Used for the trim picker reel.
 */
async function loadReelThumbnails(
  uri: string,
  durationSec: number,
  count: number,
): Promise<ReelThumb[]> {
  const out: ReelThumb[] = [];
  for (let i = 0; i < count; i++) {
    const atSec = (durationSec * i) / count;
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: Math.floor(atSec * 1000),
        quality: 0.4,
      });
      out.push({ uri: thumbUri, atSec });
    } catch {
      // skip a frame that fails — others are usually fine
    }
  }
  return out;
}

/**
 * Pull `count` frames from `uri` starting at `startSec`, spaced 1s apart.
 * Returns base64 JPEGs in chronological order.
 */
async function extractFramesFromVideo(
  uri: string,
  startSec: number,
  count: number,
  durationSec: number,
): Promise<string[]> {
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const atSec = startSec + i;
    if (atSec > durationSec) break;
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: Math.floor(atSec * 1000),
        quality: 0.5,
      });
      const base64 = await FileSystem.readAsStringAsync(thumbUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      frames.push(base64);
    } catch {
      // best-effort — if one frame fails, keep the rest
    }
  }
  return frames;
}

function fmtSec(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const r = total % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  captureOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space[6],
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space[4],
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  disclaimer: {
    marginTop: space[4],
    paddingTop: space[4],
    borderTopWidth: 1,
  },
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: space[6],
    gap: space[4],
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  limitBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space[4],
  },
  tipBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space[4],
    marginTop: space[2],
  },
  howItWorksLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space[2],
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── History link (mode picker secondary action) ──
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[3],
  },
  historyCount: {
    minWidth: 26,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Done-stage past-readings link ──
  donePastLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[3],
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#000',
  },
  reelItem: {
    width: 80,
    height: 60,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  reelImage: { width: '100%', height: '100%' },
  reelLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  recDot: {
    // backgroundColor is themed inline (t.error) — see render site.
    // Keeping this pure-shape style so layout + tokens stay separated.
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: space[3],
  },
});
