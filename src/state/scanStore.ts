/**
 * Scan history — last 100 scans persisted locally. Each scan stores the
 * user input, triage result, and (optional) image URI. Supabase sync comes
 * later when we introduce auth.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Confidence,
  Differential,
  FollowUpAnswer,
  FollowUpQuestion,
  NextStep,
  TriageResult,
  UrgencyTier,
} from '../ai/triage';
import { deleteScanFromCloud, syncScanToCloud } from '../services/sync';

export type ScanMode = 'general' | 'litter_box';

export type ScanRecord = {
  id: string;
  cat_id: string;
  created_at: string;             // ISO
  mode: ScanMode;
  user_input: string;
  image_uri: string | null;

  // Core triage output
  urgency: UrgencyTier;
  score: number;
  confidence: Confidence;
  headline: string;
  explanation: string;
  photo_observations: string | null;

  // Rich triage detail
  red_flags: string[];
  differentials: Differential[];
  reassurances: string[];
  next_steps: NextStep[];
  what_to_monitor: string[];
  home_checks: string[];
  vet_questions: string[];
  vet_preparations: string[];
  trend_note: string | null;
  citation_topics: string[];

  // Ada-style follow-up loop. `pending_questions` is what the LLM asked;
  // once the user answers, we re-run triage and push the Q/A pair into
  // `follow_up_qa` so it becomes part of the scan's audit trail.
  pending_questions: FollowUpQuestion[];
  follow_up_qa: FollowUpAnswer[];

  hard_urgency: boolean;          // Layer-1 keyword emergency

  // Outcome check-in (24–48h post-scan push).
  //  - outcome_notif_id: local-notification id we scheduled on scan save,
  //    so deleteScan can cancel it cleanly.
  //  - outcome_responded: flipped true when the user answers the check-in.
  //  - outcome_dismissed_at: set when the user explicitly dismisses the
  //    banner on /result or the home-screen nudge (so we stop asking).
  outcome_notif_id: string | null;
  outcome_responded: boolean;
  outcome_dismissed_at: string | null;
};

const MAX_HISTORY = 100;

type State = {
  scans: ScanRecord[];
  addScan: (scan: ScanRecord) => void;
  updateScan: (id: string, patch: Partial<ScanRecord>) => void;
  deleteScan: (id: string) => void;
  clear: () => void;
  recentForCat: (catId: string, limit?: number) => ScanRecord[];
};

export const useScanStore = create<State>()(
  persist(
    (set, get) => ({
      scans: [],
      addScan: (scan) => {
        set((s) => ({ scans: [scan, ...s.scans].slice(0, MAX_HISTORY) }));
        void syncScanToCloud(scan).catch(() => {});
      },
      updateScan: (id, patch) => {
        let merged: ScanRecord | null = null;
        set((s) => ({
          scans: s.scans.map((x) => {
            if (x.id !== id) return x;
            merged = { ...x, ...patch };
            return merged;
          }),
        }));
        if (merged) void syncScanToCloud(merged).catch(() => {});
      },
      deleteScan: (id) => {
        const victim = get().scans.find((x) => x.id === id);
        set((s) => ({ scans: s.scans.filter((x) => x.id !== id) }));
        if (victim?.outcome_notif_id) {
          // Dynamic import so `expo-notifications` isn't loaded at app
          // boot — it throws a red-box error in Expo Go on Android
          // (SDK 53+ removed remote-push support from Expo Go).
          import('../services/notifications')
            .then(({ cancelNotification }) => cancelNotification(victim.outcome_notif_id))
            .catch(() => {});
        }
        void deleteScanFromCloud(id).catch(() => {});
      },
      clear: () => set({ scans: [] }),
      recentForCat: (catId, limit = 10) =>
        get().scans.filter((s) => s.cat_id === catId).slice(0, limit),
    }),
    {
      name: 'catmd-scan-history',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted: any, version) => {
        // Older builds had a flat `top_concerns` list and lacked the rich
        // triage fields (differentials, red_flags, home_checks, etc.).
        // Promote every stored scan to the current schema so the UI doesn't
        // crash on `.map`/`.filter` of undefined after a release upgrade.
        if (version < 2 && persisted?.scans) {
          persisted.scans = persisted.scans.map((s: any) => ({
            ...s,
            mode: s.mode ?? 'general',
            confidence: s.confidence ?? 'moderate',
            photo_observations: s.photo_observations ?? null,
            red_flags: Array.isArray(s.red_flags) ? s.red_flags : [],
            differentials: Array.isArray(s.differentials) ? s.differentials : [],
            reassurances: Array.isArray(s.reassurances) ? s.reassurances : [],
            next_steps: Array.isArray(s.next_steps) ? s.next_steps : [],
            what_to_monitor: Array.isArray(s.what_to_monitor) ? s.what_to_monitor : [],
            home_checks: Array.isArray(s.home_checks) ? s.home_checks : [],
            vet_preparations: Array.isArray(s.vet_preparations) ? s.vet_preparations : [],
            vet_questions: Array.isArray(s.vet_questions) ? s.vet_questions : [],
            trend_note: s.trend_note ?? null,
            citation_topics: Array.isArray(s.citation_topics) ? s.citation_topics : [],
            pending_questions: Array.isArray(s.pending_questions) ? s.pending_questions : [],
            follow_up_qa: Array.isArray(s.follow_up_qa) ? s.follow_up_qa : [],
            hard_urgency: !!s.hard_urgency,
          }));
        }
        // v3: add outcome check-in tracking fields.
        if (version < 3 && persisted?.scans) {
          persisted.scans = persisted.scans.map((s: any) => ({
            ...s,
            outcome_notif_id: s.outcome_notif_id ?? null,
            outcome_responded: !!s.outcome_responded,
            outcome_dismissed_at: s.outcome_dismissed_at ?? null,
          }));
        }
        return persisted;
      },
    },
  ),
);

export function triageToScanRecord(
  catId: string,
  userInput: string,
  imageUri: string | null,
  t: TriageResult,
  mode: ScanMode = 'general',
): ScanRecord {
  return {
    id: `scan_${Date.now().toString(36)}`,
    cat_id: catId,
    created_at: new Date().toISOString(),
    mode,
    user_input: userInput,
    image_uri: imageUri,

    urgency: t.urgency,
    score: t.score,
    confidence: t.confidence,
    headline: t.headline,
    explanation: t.explanation,
    photo_observations: t.photo_observations,

    red_flags: t.red_flags,
    differentials: t.differentials,
    reassurances: t.reassurances,
    next_steps: t.next_steps,
    what_to_monitor: t.what_to_monitor,
    home_checks: t.home_checks,
    vet_questions: t.vet_questions,
    vet_preparations: t.vet_preparations,
    trend_note: t.trend_note,
    citation_topics: t.citations,

    pending_questions: t.follow_up_questions ?? [],
    follow_up_qa: [],

    hard_urgency: t._hard_urgency,

    outcome_notif_id: null,
    outcome_responded: false,
    outcome_dismissed_at: null,
  };
}

/** Rebuild a ScanRecord after a follow-up re-run, preserving history. */
export function applyRerunToScan(
  existing: ScanRecord,
  answered: FollowUpAnswer[],
  t: TriageResult,
): Partial<ScanRecord> {
  return {
    urgency: t.urgency,
    score: t.score,
    confidence: t.confidence,
    headline: t.headline,
    explanation: t.explanation,
    photo_observations: t.photo_observations,
    red_flags: t.red_flags,
    differentials: t.differentials,
    reassurances: t.reassurances,
    next_steps: t.next_steps,
    what_to_monitor: t.what_to_monitor,
    home_checks: t.home_checks,
    vet_questions: t.vet_questions,
    vet_preparations: t.vet_preparations,
    trend_note: t.trend_note,
    citation_topics: t.citations,

    // The model may choose to ask more questions or conclude.
    pending_questions: t.follow_up_questions ?? [],
    // Append answers to history.
    follow_up_qa: [...existing.follow_up_qa, ...answered],
  };
}

/** Short summary used as context in future triage prompts. */
export function recentScansSummary(scans: ScanRecord[]): string | undefined {
  if (!scans.length) return undefined;
  return scans
    .slice(0, 5)
    .map(
      (s, i) =>
        `${i + 1}. ${new Date(s.created_at).toLocaleDateString()} — [${s.urgency}] ${s.headline}`,
    )
    .join('\n');
}
