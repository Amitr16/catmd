/**
 * Translate screen — the Meow Translator (multimodal cat-voice interpreter).
 *
 * Capture flow (mirrors behavior.tsx but shorter — 4 sec instead of 6,
 * 4 frames instead of 6, ONE-LINE result instead of multi-channel
 * read):
 *
 *   1. CAPTURE: live record a 4-sec video. Frames extracted at
 *      0/1/2/3 seconds.
 *   2. UPLOAD: pick a video from the gallery (≤ 7 sec → first 4 sec;
 *      longer → no trim picker, take the first 4 sec, since the user
 *      ALMOST ALWAYS wants the moment they just captured).
 *
 * Both paths land at translateMeow() which returns a single
 * cat-voice line + classification. The result screen leans hard
 * into shareability — the translation is the hero, in massive
 * type, with a Share button right below it.
 *
 * Health-event side effect: each successful translation writes a
 * `meow_translation` event to healthStore. The catContext builder
 * surfaces the last 3 in `recentMeowSignals` so chat / diary
 * readings keep the cat's running voice consistent.
 *
 * The UX rule: if the model classifies as `intent: 'distress'`,
 * we show a soft "this might be worth a vet check" link to /scan,
 * but we do NOT block the share — the translation may still be
 * something the owner wants to send (e.g. "i'm not okay. eye still
 * hurts"). Distress translations are EARNEST, never cute (enforced
 * by the system prompt).
 */
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowSquareOut,
  Camera as CameraIcon,
  ClockCounterClockwise,
  FilmStrip,
  Microphone,
  ShareNetwork,
  Sparkle,
  Stethoscope,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useProGate } from '../src/services/paywallGate';
import { useCatStore } from '../src/state/catStore';
import { useHealthStore } from '../src/state/healthStore';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';
import {
  translateMeow,
  NoCatDetectedError,
  NoMeowDetectedError,
  type MeowTranslationResult,
} from '../src/services/meowTranslator';
import { buildCatContext } from '../src/services/catContext';

// Cycled while the model is thinking — keeps the user engaged through
// the 8-15 second wall clock.
const THINKING_WORDS = [
  'listening',
  'reading the room',
  'parsing the meow',
  'matching the voice',
  'finding the words',
  'channeling',
];

const BURST_FRAMES = 4;                  // frames sent to the model
const RECORD_SECONDS = 4;                // live-capture clip length
const SHORT_VIDEO_THRESHOLD_SEC = 7;     // < this → no trim picker, take first 4s
const FREE_DAILY_LIMIT = 5;              // generous — sharing is the funnel

// Long-form explainer article on catmd.pet — why multimodal cat
// translation works, how the research backs it, what the limits are.
// Linked from the mode picker + result screen so curious users can
// build trust in the output before / after they use it.
const HOW_IT_WORKS_URL = 'https://catmd.pet/library/how-meow-translators-work';

/**
 * Open the long-form explainer in the OS browser. Fire-and-forget;
 * silent failure if the URL can't be opened (corporate device, no
 * browser, etc.) — never breaks the user's flow.
 */
async function openHowItWorks(source: 'mode_picker' | 'result_view'): Promise<void> {
  void import('../src/services/analytics').then(({ track }) =>
    track({
      type: 'translation_how_it_works_opened',
      props: { source },
    }),
  );
  try {
    const ok = await Linking.canOpenURL(HOW_IT_WORKS_URL);
    if (ok) await Linking.openURL(HOW_IT_WORKS_URL);
  } catch {
    // Silent — never block the user.
  }
}

type Stage =
  | 'pick'              // initial — capture vs upload vs view history
  | 'capture'           // live camera preview, ready to record
  | 'capturing'         // recording in progress (counter)
  | 'processing-video'  // pulling frames from a video
  | 'trim'              // long upload — user picking 4s window
  | 'analyzing'         // translateMeow running
  | 'done'              // result rendered
  | 'no-meow'           // silent clip — route to /behavior instead
  | 'error';

const REEL_THUMB_COUNT = 8;              // thumbnails shown in the trim reel

type ReelThumb = {
  uri: string;          // file:// to a local JPEG
  atSec: number;        // timestamp this thumb represents
};

export default function TranslateScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const addEvent = useHealthStore((s) => s.addEvent);
  const events = useHealthStore((s) => s.events);
  const proGate = useProGate();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [result, setResult] = useState<MeowTranslationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload-flow state — used when a video > 7s is picked and the user
  // needs to choose which 4-second slice to translate.
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [reel, setReel] = useState<ReelThumb[]>([]);
  const [trimStartSec, setTrimStartSec] = useState<number>(0);

  // Daily-limit accounting — meow_translation events from today.
  const todayCount = (() => {
    if (!cat) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return events.filter(
      (e) =>
        e.type === 'meow_translation' &&
        e.cat_id === cat.id &&
        new Date(e.ts).getTime() >= startMs,
    ).length;
  })();
  const dailyLimitHit = todayCount >= FREE_DAILY_LIMIT;

  // Lifetime count — drives the "See past translations (N)" chip on
  // the mode picker + a smaller history link on the done stage. Mirrors
  // app/behavior.tsx's totalReadings pattern.
  const totalTranslations = (() => {
    if (!cat) return 0;
    return events.filter(
      (e) => e.type === 'meow_translation' && e.cat_id === cat.id,
    ).length;
  })();

  useEffect(() => {
    if (stage !== 'analyzing') return;
    const id = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % THINKING_WORDS.length);
    }, 1300);
    return () => clearInterval(id);
  }, [stage]);

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
    if (!proGate.check('translate')) return;
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setErrorMsg('Camera permission was declined. Try the Upload option instead.');
        setStage('error');
        return;
      }
    }
    if (!micPermission?.granted) {
      // Audio matters MORE here than in body-language. We still allow
      // recording without mic (silent body-read), but warn the user.
      await requestMicPermission();
    }
    setStage('capture');
  };

  const recordAndExtract = async () => {
    if (!cameraRef.current || !cat) {
      setErrorMsg(cat ? 'Camera not ready' : 'Add a cat profile first.');
      setStage('error');
      return;
    }
    setStage('capturing');
    setProgress(0);
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'translation_started', props: { source: 'direct' } }),
    );
    try {
      const recording = await cameraRef.current.recordAsync({
        maxDuration: RECORD_SECONDS,
      });
      if (!recording?.uri) throw new Error('Recording produced no file');

      setStage('processing-video');
      const frames = await extractFramesFromVideo(
        recording.uri,
        0,
        BURST_FRAMES,
        RECORD_SECONDS,
      );
      if (frames.length === 0) {
        throw new Error('No frames could be extracted from the recording.');
      }
      await runTranslate(frames, recording.uri);
    } catch (err) {
      handleError(err);
    }
  };

  // ── UPLOAD PATH ──────────────────────────────────────────────────────────

  const pickVideo = async () => {
    if (!proGate.check('translate')) return;
    if (!cat) {
      setErrorMsg('Add a cat profile first.');
      setStage('error');
      return;
    }
    void import('../src/services/analytics').then(({ track }) =>
      track({ type: 'translation_started', props: { source: 'direct' } }),
    );
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg('Photo library permission was declined.');
        setStage('error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const durationSec = asset.duration != null ? asset.duration / 1000 : null;
      if (durationSec == null || durationSec < 1) {
        setErrorMsg("Couldn't read that video's duration. Try a different file.");
        setStage('error');
        return;
      }
      if (durationSec < 2) {
        setErrorMsg('That clip is too short — please use one at least 2 seconds long.');
        setStage('error');
        return;
      }
      setVideoUri(asset.uri);
      setVideoDurationSec(durationSec);

      // Short clip (<=7s) → no trim picker needed, just take from start.
      // The translator wants 4s; if the source is < 4s we hand the whole
      // thing over (frame extraction caps at the clip's duration).
      if (durationSec <= SHORT_VIDEO_THRESHOLD_SEC) {
        setStage('processing-video');
        const safeDur = Math.min(durationSec, RECORD_SECONDS);
        const frames = await extractFramesFromVideo(asset.uri, 0, BURST_FRAMES, safeDur);
        if (frames.length === 0)
          throw new Error('No frames could be extracted from that video.');
        await runTranslate(frames, asset.uri);
        return;
      }

      // Longer clip → load reel thumbnails + show the trim picker so
      // the user picks WHICH 4 seconds to translate. Critical for the
      // meow translator specifically — the user almost always has a
      // particular meow in mind, not "the start of the clip".
      setStage('processing-video');
      const newReel = await loadReelThumbnails(asset.uri, durationSec, REEL_THUMB_COUNT);
      setReel(newReel);
      setTrimStartSec(0);
      setStage('trim');
    } catch (err) {
      handleError(err);
    }
  };

  /**
   * Called from the trim picker when the user has chosen their
   * 4-second start point. Extracts frames from `trimStartSec` and runs
   * the translator over them.
   */
  const confirmTrimAndTranslate = async () => {
    if (!videoUri || videoDurationSec == null) return;
    setStage('processing-video');
    try {
      const safeStart = Math.max(0, Math.min(trimStartSec, videoDurationSec - 1));
      const frames = await extractFramesFromVideo(
        videoUri,
        safeStart,
        BURST_FRAMES,
        videoDurationSec,
      );
      if (frames.length === 0) {
        throw new Error('No frames could be extracted from that window.');
      }
      // Pass the full source URI for audio transcription (Whisper
      // analyses the whole audio track — the meow may sit just outside
      // the chosen frame window).
      await runTranslate(frames, videoUri);
    } catch (err) {
      handleError(err);
    }
  };

  // ── TRANSLATE (shared by both paths) ─────────────────────────────────────

  const runTranslate = async (frames: string[], videoUri: string | null) => {
    if (!cat) {
      setErrorMsg('Add a cat profile first.');
      setStage('error');
      return;
    }
    setStage('analyzing');
    try {
      const context = buildCatContext(cat.id);
      const r = await translateMeow({
        framesBase64: frames,
        context,
        videoUri,
      });

      // Persist as a health event — surfaces in catContext.recentMeowSignals
      // so chat / diary stay consistent with the cat's running voice.
      addEvent({
        cat_id: cat.id,
        type: 'meow_translation',
        payload: {
          vocalization_type: r.vocalization_type,
          intent: r.intent,
          confidence: r.confidence,
          translation: r.translation,
          why: r.why,
          had_audio: r.had_audio,
          audio_transcript: r.audio_transcript,
          model: r.model,
          observed_at: new Date().toISOString(),
        },
      });

      void import('../src/services/analytics').then(({ track }) => {
        track({
          type: 'translation_completed',
          props: {
            vocalization_type: r.vocalization_type,
            intent: r.intent,
            confidence: r.confidence,
            had_audio: r.had_audio,
            translation_length: r.translation.length,
          },
        });
        // Unified activation event for marketing-attribution funnels
        // (audit 2026-05-16). Fires alongside translation_completed.
        track({ type: 'core_feature_used', props: { feature: 'translate' } });
      });

      setResult(r);
      setStage('done');
    } catch (err) {
      handleError(err);
    }
  };

  const handleError = (err: unknown) => {
    // Silent-clip gate — credibility move. The translator REQUIRES an
    // audible meow; we surface a dedicated "no-meow" stage with a
    // route to /behavior (Body Language Reader, which DOES handle
    // silent clips) instead of producing a low-credibility silent
    // translation.
    if (err instanceof NoMeowDetectedError) {
      void import('../src/services/analytics').then(({ track }) =>
        track({
          type: 'translation_rejected_no_meow',
        }),
      );
      setStage('no-meow');
      return;
    }
    if (err instanceof NoCatDetectedError) {
      void import('../src/services/analytics').then(({ track }) =>
        track({
          type: 'translation_rejected_no_cat',
          props: { reason: err.classifierReason.slice(0, 120) },
        }),
      );
      setErrorMsg(
        `We couldn't see ${cat?.name ?? 'your cat'} in this clip — ${err.classifierReason} ` +
          `Try again with ${cat?.name ?? 'your cat'} clearly in frame.`,
      );
      setStage('error');
      return;
    }
    const msg = err instanceof Error ? err.message : 'Something went wrong';
    setErrorMsg(msg);
    setStage('error');
    void import('../src/services/analytics').then(({ track }) =>
      track({
        type: 'translation_failed',
        props: { reason: msg.slice(0, 200) },
      }),
    );
  };

  const reset = () => {
    setResult(null);
    setProgress(0);
    setErrorMsg(null);
    setVideoUri(null);
    setVideoDurationSec(null);
    setReel([]);
    setTrimStartSec(0);
    setStage('pick');
  };

  const onShare = async () => {
    if (!result || !cat) return;
    // Format: cat name + line + tagline. Keeps the share text
    // self-explanatory if it lands on a platform without preview
    // (texts, DMs).
    const text = `${cat.name} says:\n\n"${result.translation}"\n\n— translated by CatMD`;
    try {
      await Share.share({ message: text });
      void import('../src/services/analytics').then(({ track }) =>
        track({
          type: 'translation_shared',
          props: {
            intent: result.intent,
            confidence: result.confidence,
          },
        }),
      );
    } catch (e) {
      console.warn('[Translate] share failed:', e);
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
        </Pressable>
        <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
          Meow Translator
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {stage === 'pick' && (
        <PickStage
          catName={cat?.name ?? 'your cat'}
          dailyLimitHit={dailyLimitHit}
          todayCount={todayCount}
          freeLimit={FREE_DAILY_LIMIT}
          totalTranslations={totalTranslations}
          onCapture={goToCapture}
          onUpload={pickVideo}
          onViewHistory={() => router.push('/translate-history' as never)}
        />
      )}

      {(stage === 'capture' || stage === 'capturing') && (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="video"
            mute={!micPermission?.granted}
          />
          {stage === 'capturing' && (
            <View style={styles.captureOverlay} pointerEvents="none">
              <View style={[styles.recDot, { backgroundColor: t.error }]} />
              <Text token="heading2" style={{ color: '#fff' }}>
                Recording… {progress}/{RECORD_SECONDS}s
              </Text>
              <Text token="body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
                Get {cat?.name ?? 'your cat'} talking
              </Text>
            </View>
          )}
          {stage === 'capture' && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + space[4] }]}>
              <Text token="caption" style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: space[2] }}>
                {RECORD_SECONDS} seconds. Sound + frames + memory → one line in {cat?.name ?? 'your cat'}&apos;s voice.
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
            Loading clip…
          </Text>
        </View>
      )}

      {stage === 'trim' && (
        <TrimPicker
          reel={reel}
          videoDurationSec={videoDurationSec ?? 0}
          startSec={trimStartSec}
          onChangeStart={setTrimStartSec}
          onConfirm={confirmTrimAndTranslate}
          onCancel={reset}
        />
      )}

      {stage === 'no-meow' && cat && (
        <NoMeowStage
          catName={cat.name}
          onTryAgain={reset}
          onOpenBodyLanguage={() => router.replace('/behavior' as never)}
        />
      )}

      {stage === 'analyzing' && (
        <View style={styles.center}>
          <Sparkle size={36} color={t.secondary700} weight="duotone" />
          <Text token="heading2" style={{ marginTop: space[4] }}>
            {THINKING_WORDS[thinkingIndex]}…
          </Text>
          <Text token="body" style={{ color: t.textMuted, marginTop: space[2], textAlign: 'center' }}>
            Reading the 4-second clip — frames + voice + memory.
          </Text>
          <Text token="caption" style={{ color: t.textMuted, marginTop: space[1], textAlign: 'center' }}>
            Analysis takes up to 20 sec.
          </Text>
        </View>
      )}

      {stage === 'done' && result && cat && (
        <ResultView
          catName={cat.name}
          result={result}
          onShare={onShare}
          onAgain={reset}
          onViewHistory={() => router.replace('/translate-history' as never)}
          onRunScan={() =>
            router.replace({ pathname: '/scan', params: { source: 'translate_distress' } } as never)
          }
        />
      )}

      {stage === 'error' && (
        <View style={styles.center}>
          <Text token="heading2" style={{ color: t.warning, marginBottom: space[2] }}>
            Couldn&apos;t translate
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

function PickStage({
  catName,
  dailyLimitHit,
  todayCount,
  freeLimit,
  totalTranslations,
  onCapture,
  onUpload,
  onViewHistory,
}: {
  catName: string;
  dailyLimitHit: boolean;
  todayCount: number;
  freeLimit: number;
  totalTranslations: number;
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
        Record {catName} for 4 seconds — voice, posture, AND memory go in. One screenshot-worthy line in {catName}&apos;s voice comes out.
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
          <Microphone size={28} color={t.secondary700} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text token="heading3" style={{ marginBottom: 2 }}>
            Record now
          </Text>
          <Text token="caption" color="textMuted">
            4-second video. Best when {catName} is meowing right at you.
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
            Upload a clip
          </Text>
          <Text token="caption" color="textMuted">
            Pick a video. We&apos;ll use the first 4 seconds.
          </Text>
        </View>
      </Pressable>

      <View style={[styles.tipBox, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}>
        <Text token="caption" color="textMuted" style={{ lineHeight: 18 }}>
          <Text token="caption" style={{ color: t.textPrimary, fontWeight: '600' }}>How it works:</Text>
          {' '}Audio-only translators print a generic label like &ldquo;Happy/Content&rdquo;. CatMD blends the meow + body language + everything {catName} has shown us into one line, in {catName}&apos;s actual voice. Screenshottable.
        </Text>
        {/* Trust hook — read the long-form research-backed explainer.
            Catches the "is this real or vibes?" doubt at the moment
            the user is about to commit to a recording. */}
        <Pressable
          onPress={() => openHowItWorks('mode_picker')}
          accessibilityRole="link"
          accessibilityLabel="Read how the meow translator works"
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
            You&apos;ve translated {todayCount} clips today. Free cap resets at midnight.
          </Text>
        </View>
      ) : (
        <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[2] }}>
          {todayCount}/{freeLimit} translations used today.
        </Text>
      )}

      {/* Past translations — same shape as behavior.tsx's "See past
          readings" chip. Hidden when there are zero so the empty
          state stays uncluttered. */}
      {totalTranslations > 0 ? (
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
            See past translations
          </Text>
          <View style={[styles.historyCount, { backgroundColor: t.secondary100 }]}>
            <Text token="caption" style={{ color: t.secondary900, fontWeight: '600' }}>
              {totalTranslations}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function ResultView({
  catName,
  result,
  onShare,
  onAgain,
  onViewHistory,
  onRunScan,
}: {
  catName: string;
  result: MeowTranslationResult;
  onShare: () => void;
  onAgain: () => void;
  onViewHistory: () => void;
  onRunScan: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isDistress = result.intent === 'distress';

  // Voice/body badge — tells the user which channels we used. "Voice +
  // body" when audio was present; "Body only" for silent clips.
  const channelLabel = result.had_audio ? 'voice + body' : 'body language only';

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space[6], paddingBottom: insets.bottom + space[6] }}
    >
      <Text token="caption" style={{ color: t.secondary700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: space[2] }}>
        {catName} says
      </Text>

      {/* The hero — translation in massive type. THE thing that gets
          screenshotted. Quotes around it; period at the end (model is
          told to do this; sanitizeTranslation strips stray wrappers). */}
      <View style={[styles.heroCard, { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle }]}>
        <Text token="heading1" style={{ fontStyle: 'italic', lineHeight: 36 }}>
          &ldquo;{result.translation}&rdquo;
        </Text>
      </View>

      {/* Tag row — vocalization / intent / confidence. Compact pills,
          no clinical register. */}
      <View style={styles.tagRow}>
        <Pill label={result.vocalization_type} />
        <Pill label={result.intent.replace(/_/g, ' ')} highlight />
        <Pill
          label={
            result.confidence === 'high'
              ? 'high confidence'
              : result.confidence === 'moderate'
                ? 'moderate confidence'
                : 'low confidence'
          }
        />
      </View>

      {/* Why card — small caption with the model's reasoning. Builds
          trust without taking visual weight from the hero. */}
      <View style={[styles.whyCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
        <Text token="caption" style={{ color: t.textMuted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Why we read it that way
        </Text>
        <Text token="caption" style={{ color: t.textSecondary, lineHeight: 18 }}>
          {result.why}
        </Text>
        <Text token="caption" style={{ color: t.textMuted, marginTop: 6 }}>
          Channels: {channelLabel}
          {result.had_audio && result.audio_transcript ? ` · we heard "${result.audio_transcript}"` : ''}
        </Text>
        {/* Trust-deepener — the long-form explainer. Users who just saw
            their first translation often wonder "is this reliable?"
            This is exactly the moment for research-backed reading. */}
        <Pressable
          onPress={() => openHowItWorks('result_view')}
          accessibilityRole="link"
          accessibilityLabel="Read the science behind how this translation was made"
          style={({ pressed }) => [
            styles.howItWorksLink,
            { marginTop: space[3], opacity: pressed ? 0.7 : 1 },
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
            How modern meow translators work
          </Text>
          <ArrowSquareOut size={12} color={t.secondary700} weight="bold" />
        </Pressable>
      </View>

      {/* Distress nudge — soft path to triage scan. Never blocks share;
          some distress translations are still the message the owner
          wants to send ("i'm not okay. eye still hurts"). */}
      {isDistress && (
        <Pressable
          onPress={onRunScan}
          style={({ pressed }) => [
            styles.distressCard,
            { borderColor: t.warning, backgroundColor: t.surfaceSunken, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Stethoscope size={20} color={t.warning} weight="duotone" />
          <View style={{ flex: 1, marginLeft: space[3] }}>
            <Text token="body" style={{ fontWeight: '600' }}>
              That read as distress
            </Text>
            <Text token="caption" color="textMuted">
              A quick triage scan is worth running if {catName} is showing physical signs too.
            </Text>
          </View>
        </Pressable>
      )}

      {/* Primary action — Share. The conversion-funnel proxy. */}
      <Button
        label={`Share ${catName}'s line`}
        onPress={onShare}
        leftIcon={<ShareNetwork size={18} color={t.textInverse} weight="bold" />}
        fullWidth
      />
      <View style={{ height: space[3] }} />
      <Button label="Translate another" variant="ghost" onPress={onAgain} fullWidth />

      {/* Past translations link — sits below the primary actions on
          the done stage so users know translations ARE saved + viewable.
          Mirrors the same pattern on app/behavior.tsx done stage. */}
      <Pressable
        onPress={onViewHistory}
        style={({ pressed }) => [
          styles.donePastLink,
          {
            borderColor: t.borderSubtle,
            backgroundColor: t.surfaceSunken,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <ClockCounterClockwise size={16} color={t.textSecondary} weight="duotone" />
        <Text token="caption" style={{ marginLeft: space[2], color: t.textSecondary, fontWeight: '600' }}>
          See past translations — they all stay in {catName}&apos;s memory
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Pill({ label, highlight }: { label: string; highlight?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: highlight ? t.secondary100 : t.surfaceSunken,
          borderColor: highlight ? t.secondary300 : t.borderSubtle,
        },
      ]}
    >
      <Text token="caption" style={{ color: highlight ? t.secondary900 : t.textSecondary, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

// ── TrimPicker + NoMeowStage components ───────────────────────────────────

/**
 * 8-thumbnail reel scrubber for choosing WHICH 4-second window inside
 * a longer upload to translate. Mirrors the body-language trim picker
 * but tuned for the 4-second window the translator wants (vs 6 for
 * body-language).
 *
 * The hero is a big preview of the currently-selected start frame so
 * the user can SEE what they're about to translate before committing.
 */
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
  const maxStart = Math.max(0, videoDurationSec - RECORD_SECONDS);
  const safeStart = Math.min(startSec, maxStart);
  const endSec = Math.min(safeStart + RECORD_SECONDS, videoDurationSec);
  const previewThumb =
    reel.find((r) => r.atSec >= safeStart) ?? reel[0] ?? null;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: space[6],
        paddingBottom: insets.bottom + space[6],
        gap: space[4],
      }}
    >
      <Text token="heading3">Pick the 4-second window</Text>
      <Text token="caption" color="textMuted">
        Tap a frame in the reel below to choose where the 4-second
        translation window starts. We&apos;ll listen to the whole clip for
        the meow — picking the frame just helps us SEE the right moment.
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
                  borderColor: isSelected
                    ? t.secondary700
                    : isInWindow
                      ? t.secondary300
                      : t.borderSubtle,
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
          <Button label="Translate this clip" fullWidth onPress={onConfirm} />
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * Empty / silent-clip stage — credibility move. Instead of producing a
 * "silent body-only" translation that the user can't trust, we tell
 * them we didn't hear a meow and route them to the Body Language
 * Reader (which DOES handle silent clips by design).
 */
function NoMeowStage({
  catName,
  onTryAgain,
  onOpenBodyLanguage,
}: {
  catName: string;
  onTryAgain: () => void;
  onOpenBodyLanguage: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: space[6],
        paddingBottom: insets.bottom + space[6],
        gap: space[4],
      }}
    >
      <View style={{ alignItems: 'center', marginTop: space[6] }}>
        <Microphone size={48} color={t.textMuted} weight="duotone" />
        <Text token="heading2" style={{ marginTop: space[4], textAlign: 'center' }}>
          We didn&apos;t hear a meow
        </Text>
        <Text
          token="body"
          color="textMuted"
          style={{ textAlign: 'center', marginTop: space[2], lineHeight: 22 }}
        >
          The Meow Translator needs an actual vocalization to interpret.
          Try recording again when {catName} is meowing, trilling, or
          chirping — or use Body Language to read posture without sound.
        </Text>
      </View>

      <View style={{ marginTop: space[6] }}>
        <Button label="Try again" fullWidth onPress={onTryAgain} />
        <View style={{ height: space[2] }} />
        <Button
          label="Read body language instead"
          variant="ghost"
          fullWidth
          onPress={onOpenBodyLanguage}
        />
      </View>

      <Text
        token="caption"
        color="textMuted"
        style={{ textAlign: 'center', marginTop: space[2], lineHeight: 18 }}
      >
        Tip: if mic permission was declined when you recorded, the audio
        track will be empty even if {catName} vocalised. Re-record with
        sound and we&apos;ll catch it.
      </Text>
    </ScrollView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate `count` evenly-spaced thumbnails across the video, plus
 * the timestamp each one represents. Powers the trim picker reel.
 * Mirrors the body-language helper in app/behavior.tsx.
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
      // skip — others usually succeed
    }
  }
  return out;
}

/** "0:07" / "1:23" format for the trim-picker timestamps. */
function fmtSec(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const r = total % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Pull `count` frames from `uri` starting at `startSec`, spaced 1s apart.
 * Returns base64 JPEGs in chronological order. Same shape as
 * extractFramesFromVideo in app/behavior.tsx.
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
      // best-effort — keep the rest if one frame fails
    }
  }
  return frames;
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
  recDot: { width: 12, height: 12, borderRadius: 6, marginBottom: space[2] },
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space[3],
  },
  optionIcon: {
    width: 52, height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  tipBox: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  limitBox: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  heroCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space[6],
    marginBottom: space[4],
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space[4],
  },
  pill: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  whyCard: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[4],
  },
  distressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[4],
  },
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
    minWidth: 28,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePastLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[5],
  },
  howItWorksLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space[2],
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  // Trim-picker reel styles — mirror behavior.tsx for visual parity.
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#000',
  },
  reelItem: {
    width: 90,
    height: 60,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  reelImage: {
    width: '100%',
    height: '100%',
  },
  reelLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
});
