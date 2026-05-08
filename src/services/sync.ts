/**
 * Offline-first sync: local Zustand writes win immediately; Supabase is a
 * best-effort mirror. Failures are logged but never surfaced as errors to
 * the UI — the app keeps working offline.
 *
 * Each mutation in the stores calls the matching sync function as
 * fire-and-forget. On app cold-start we optionally `pullFromCloud()` to
 * restore state after a fresh install.
 */
import { supabase } from './supabase';
import type { CatProfile } from '../state/catStore';
import type { ScanRecord } from '../state/scanStore';
import type { DirectoryEntry } from '../state/subjectDirectoryStore';
import type { SelfFact } from '../state/selfFactsStore';
import type { WorldEntry } from '../state/worldStore';
import type { FacetId, Stage } from './becoming';

// ─── push: local → server ──────────────────────────────────────────────────
export async function syncCatToCloud(cat: CatProfile): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cats').upsert(
    {
      id: cat.id,
      user_id: user.id,
      name: cat.name,
      breed: cat.breed,
      age_months: cat.age_months,
      weight_kg: cat.weight_kg,
      sex: cat.sex,
      spayed_neutered: cat.spayed_neutered,
      indoor_outdoor: cat.indoor_outdoor,
      conditions: cat.conditions,
      medications: cat.medications,
      photo_url: cat.photo_uri,
      dob_iso: cat.dob_iso,
      adopted_on_iso: cat.adopted_on_iso,
      notes: cat.notes,
      emergency_vet_name: cat.emergency_vet_name,
      emergency_vet_phone: cat.emergency_vet_phone,
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncCatToCloud:', error.message);
}

/**
 * Backfill every local cat to Supabase. Called on app boot so a cat that
 * failed to sync earlier (e.g. before the UUID→text migration) still lands
 * on the server before any scan/event tries to reference it. Fire-and-
 * forget — individual failures are logged but don't block the app.
 */
export async function backfillCatsToCloud(cats: CatProfile[]): Promise<void> {
  if (cats.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await Promise.all(cats.map((c) => syncCatToCloud(c).catch(() => {})));
}

export async function syncScanToCloud(scan: ScanRecord): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: scan.id,
      user_id: user.id,
      cat_id: scan.cat_id,
      type: 'scan',
      ts: scan.created_at,
      payload: {
        mode: scan.mode,
        user_input: scan.user_input,
        image_uri: scan.image_uri,
        urgency: scan.urgency,
        score: scan.score,
        confidence: scan.confidence,
        headline: scan.headline,
        explanation: scan.explanation,
        photo_observations: scan.photo_observations,
        red_flags: scan.red_flags,
        differentials: scan.differentials,
        reassurances: scan.reassurances,
        next_steps: scan.next_steps,
        what_to_monitor: scan.what_to_monitor,
        home_checks: scan.home_checks,
        vet_questions: scan.vet_questions,
        vet_preparations: scan.vet_preparations,
        trend_note: scan.trend_note,
        citation_topics: scan.citation_topics,
        pending_questions: scan.pending_questions,
        follow_up_qa: scan.follow_up_qa,
        hard_urgency: scan.hard_urgency,
        // Outcome check-in state — the notif id is device-local (never
        // restored from cloud) but responded/dismissed flags sync so the
        // banner doesn't re-appear on another device after you answer.
        outcome_responded: scan.outcome_responded,
        outcome_dismissed_at: scan.outcome_dismissed_at,
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncScanToCloud:', error.message);
}

export async function deleteCatFromCloud(catId: string): Promise<void> {
  const { error } = await supabase.from('cats').delete().eq('id', catId);
  if (error) console.warn('[CatMD] deleteCatFromCloud:', error.message);
}

export async function deleteScanFromCloud(scanId: string): Promise<void> {
  const { error } = await supabase
    .from('cat_events').delete().eq('id', scanId).eq('type', 'scan');
  if (error) console.warn('[CatMD] deleteScanFromCloud:', error.message);
}

// ─── pull: server → local (post-install recovery / new device) ────────────
export type PulledState = {
  cats: CatProfile[];
  scans: ScanRecord[];
  /**
   * Non-scan health events — daily check-ins, weights, vaccines, body
   * language reads, pain scores, watch monitors, etc. The full taxonomy
   * is HealthEventType in `src/state/healthStore.ts`. Untyped here
   * because importing the full union triggers a circular dep through
   * the store layer; the consumer (`restoreFromCloudIfNeeded`) casts
   * back into HealthEvent[] before applying.
   */
  events: Array<{
    id: string;
    cat_id: string;
    type: string;
    ts: string;
    payload: Record<string, unknown>;
  }>;
};

export async function pullFromCloud(): Promise<PulledState> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { cats: [], scans: [], events: [] };

  // Three parallel fetches: cats, scan-type events (mapped to ScanRecord
  // shape for the scanStore), and all OTHER event types (mapped 1:1
  // into the healthStore). The `cat_events` table is a single union of
  // all event types discriminated by `type`, so we filter in two
  // queries rather than loading everything and partitioning client-side.
  const [{ data: catRows }, { data: scanRows }, { data: eventRows }] = await Promise.all([
    supabase.from('cats').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'scan')
      .order('ts', { ascending: false }).limit(200),
    supabase.from('cat_events').select('*').eq('user_id', user.id).neq('type', 'scan')
      .order('ts', { ascending: false }).limit(2000),
  ]);

  const cats: CatProfile[] = (catRows ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    breed: r.breed,
    // Postgres `date` values deserialize as "YYYY-MM-DD" strings already,
    // which is exactly the shape the client stores.
    dob_iso: r.dob_iso ?? null,
    age_months: r.age_months,
    adopted_on_iso: r.adopted_on_iso ?? null,
    weight_kg: r.weight_kg,
    sex: r.sex ?? 'unknown',
    spayed_neutered: r.spayed_neutered,
    indoor_outdoor: r.indoor_outdoor ?? 'indoor',
    conditions: r.conditions ?? [],
    medications: r.medications ?? [],
    notes: r.notes ?? null,
    photo_uri: r.photo_url,
    emergency_vet_name: r.emergency_vet_name ?? null,
    emergency_vet_phone: r.emergency_vet_phone ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
  }));

  const scans: ScanRecord[] = (scanRows ?? []).map((r: any) => ({
    id: r.id,
    cat_id: r.cat_id ?? '',
    created_at: r.ts,
    mode: r.payload?.mode === 'litter_box' ? 'litter_box' : 'general',
    user_input: r.payload?.user_input ?? '',
    image_uri: r.payload?.image_uri ?? null,

    urgency: r.payload?.urgency ?? 'monitor',
    score: r.payload?.score ?? 0,
    confidence: r.payload?.confidence ?? 'moderate',
    headline: r.payload?.headline ?? '',
    explanation: r.payload?.explanation ?? '',
    photo_observations: r.payload?.photo_observations ?? null,

    red_flags: r.payload?.red_flags ?? [],
    differentials: r.payload?.differentials ?? [],
    reassurances: r.payload?.reassurances ?? [],
    next_steps: r.payload?.next_steps ?? [],
    what_to_monitor: r.payload?.what_to_monitor ?? [],
    home_checks: r.payload?.home_checks ?? [],
    vet_questions: r.payload?.vet_questions ?? [],
    vet_preparations: r.payload?.vet_preparations ?? [],
    trend_note: r.payload?.trend_note ?? null,
    citation_topics: r.payload?.citation_topics ?? [],

    pending_questions: r.payload?.pending_questions ?? [],
    follow_up_qa: r.payload?.follow_up_qa ?? [],

    hard_urgency: !!r.payload?.hard_urgency,

    // Cloud rehydration never restores the scheduled local-notification id
    // (notifications live on the device); outcome responses are stored as
    // health events, so we seed these from the payload if present.
    outcome_notif_id: null,
    outcome_responded: !!r.payload?.outcome_responded,
    outcome_dismissed_at: r.payload?.outcome_dismissed_at ?? null,
  }));

  const events = (eventRows ?? []).map((r: any) => ({
    id: r.id,
    cat_id: r.cat_id ?? '',
    type: r.type as string,
    ts: r.ts,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));

  return { cats, scans, events };
}

/**
 * One-shot restore. Pulls the user's cats / scans / events from Supabase
 * and applies them to the local Zustand stores — provided the local
 * state is empty (i.e. it's a fresh install). If the local state isn't
 * empty we DO NOT clobber it; the user's local data wins. Returns a
 * summary of what was restored so the caller can show a toast / modal
 * confirming the restore.
 *
 * Why this lives in sync.ts (not in each store's actions): we use direct
 * Zustand `setState` calls to bypass the per-action cloud-sync side
 * effects. Calling `addCat` / `addScan` / `addEvent` for each restored
 * row would fire push-to-cloud for every entry — wasteful and risks a
 * sync feedback loop where the cloud row gets re-upserted. Direct
 * setState writes only the local state and persists to AsyncStorage.
 */
export type RestoreSummary = {
  appliedCats: number;
  appliedScans: number;
  appliedEvents: number;
  /** Subject directory entries restored. */
  appliedSubjects: number;
  /** Self-facts restored. */
  appliedSelfFacts: number;
  /** Cats whose becoming snapshot was restored. */
  appliedBecomingCats: number;
  // Phase B counts
  appliedDiaryEntries: number;
  appliedChatTurns: number;
  appliedPersonalityCats: number;
  appliedPostcards: number;
  appliedCatStudioPosters: number;
  appliedWeeklyReadings: number;
  appliedReminderCats: number;
  appliedNotifPrefs: boolean;
  /** World Memory entries restored (objects, places, toys, environment). */
  appliedWorldEntries: number;
  skipped: 'local_not_empty' | 'cloud_empty' | null;
};

export async function restoreFromCloudIfNeeded(): Promise<RestoreSummary> {
  // Lazy-import the stores to avoid a circular dep at module-load time
  // (stores import sync.ts for push helpers; sync.ts importing stores
  // statically would create a cycle).
  const { useCatStore } = await import('../state/catStore');
  const { useScanStore } = await import('../state/scanStore');
  const { useHealthStore } = await import('../state/healthStore');

  const localCatsEmpty = useCatStore.getState().cats.length === 0;
  const localScansEmpty = useScanStore.getState().scans.length === 0;
  const localEventsEmpty = useHealthStore.getState().events.length === 0;

  // Only restore when ALL THREE local stores are empty. If the user has
  // any local data, treat it as authoritative — they may be reinstalling
  // intentionally to start fresh, or they had data we shouldn't blow away.
  const allLocalEmpty = localCatsEmpty && localScansEmpty && localEventsEmpty;
  if (!allLocalEmpty) {
    return {
      appliedCats: 0,
      appliedScans: 0,
      appliedEvents: 0,
      appliedSubjects: 0,
      appliedSelfFacts: 0,
      appliedBecomingCats: 0,
      appliedDiaryEntries: 0,
      appliedChatTurns: 0,
      appliedPersonalityCats: 0,
      appliedPostcards: 0,
      appliedCatStudioPosters: 0,
      appliedWeeklyReadings: 0,
      appliedReminderCats: 0,
      appliedNotifPrefs: false,
      appliedWorldEntries: 0,
      skipped: 'local_not_empty',
    };
  }

  // Pull cats/scans/events AND identity AND Phase B AND world memory in
  // parallel — independent table queries; bundling cuts post-install
  // restore latency from sequential.
  const [pulled, pulledIdentity, pulledPhaseB, pulledWorld] = await Promise.all([
    pullFromCloud(),
    pullIdentityFromCloud(),
    pullPhaseBFromCloud(),
    pullWorldFromCloud(),
  ]);

  const identityEmpty =
    pulledIdentity.subjects.length === 0 &&
    pulledIdentity.selfFacts.length === 0 &&
    Object.keys(pulledIdentity.becomingByCat).length === 0;
  const phaseBEmpty =
    pulledPhaseB.diary.length === 0 &&
    Object.keys(pulledPhaseB.chatTurnsByCat).length === 0 &&
    Object.keys(pulledPhaseB.personalityByCat).length === 0 &&
    Object.keys(pulledPhaseB.postcardsByCat).length === 0 &&
    Object.keys(pulledPhaseB.catStudioPostersByCat).length === 0 &&
    Object.keys(pulledPhaseB.weeklyReadingsByCat).length === 0 &&
    Object.keys(pulledPhaseB.remindersByCat).length === 0 &&
    !pulledPhaseB.notifPrefsEnabled;
  const worldEmpty = pulledWorld.length === 0;
  const cloudEmpty =
    pulled.cats.length === 0 &&
    pulled.scans.length === 0 &&
    pulled.events.length === 0 &&
    identityEmpty &&
    phaseBEmpty &&
    worldEmpty;
  if (cloudEmpty) {
    return {
      appliedCats: 0,
      appliedScans: 0,
      appliedEvents: 0,
      appliedSubjects: 0,
      appliedSelfFacts: 0,
      appliedBecomingCats: 0,
      appliedDiaryEntries: 0,
      appliedChatTurns: 0,
      appliedPersonalityCats: 0,
      appliedPostcards: 0,
      appliedCatStudioPosters: 0,
      appliedWeeklyReadings: 0,
      appliedReminderCats: 0,
      appliedNotifPrefs: false,
      appliedWorldEntries: 0,
      skipped: 'cloud_empty',
    };
  }

  // Apply cats. setState replaces the whole `cats` array, derives
  // activeCatId from the first cat, and flips hasOnboarded so the user
  // doesn't get sent back through the onboarding flow.
  if (pulled.cats.length > 0) {
    useCatStore.setState({
      cats: pulled.cats,
      activeCatId: pulled.cats[0]?.id ?? null,
      hasOnboarded: true,
    } as Parameters<typeof useCatStore.setState>[0]);
  }

  // Apply scans. ScanRecord shape already matches what scanStore stores.
  if (pulled.scans.length > 0) {
    useScanStore.setState({ scans: pulled.scans });
  }

  // Apply non-scan events. The shape from cloud `{id, cat_id, type, ts,
  // payload}` is exactly the HealthEvent shape; we cast through unknown
  // to satisfy the generic discriminator on HealthEvent<T>.
  if (pulled.events.length > 0) {
    useHealthStore.setState({
      events: pulled.events as unknown as Parameters<typeof useHealthStore.setState>[0] extends infer S
        ? S extends { events: infer E }
          ? E
          : never
        : never,
    } as Parameters<typeof useHealthStore.setState>[0]);
  }

  // Apply the identity bundle (subjects, self-facts, becoming).
  // applyPulledIdentity bypasses each store's per-mutation cloud sync
  // by writing via setState — no feedback loop where pulled rows
  // immediately re-upsert.
  await applyPulledIdentity(pulledIdentity);

  // Apply Phase B (diary, chat, personality, postcards, posters, weekly
  // readings, reminders, notif prefs). Same setState-direct pattern.
  await applyPulledPhaseB(pulledPhaseB);

  // Apply World Memory (objects, places, toys). Same direct-setState
  // pattern to avoid the per-mutator cloud-resync feedback loop.
  await applyPulledWorld(pulledWorld);

  return {
    appliedCats: pulled.cats.length,
    appliedScans: pulled.scans.length,
    appliedEvents: pulled.events.length,
    appliedSubjects: pulledIdentity.subjects.length,
    appliedSelfFacts: pulledIdentity.selfFacts.length,
    appliedBecomingCats: Object.keys(pulledIdentity.becomingByCat).length,
    appliedDiaryEntries: pulledPhaseB.diary.length,
    appliedChatTurns: Object.values(pulledPhaseB.chatTurnsByCat)
      .reduce((sum, list) => sum + list.length, 0),
    appliedPersonalityCats: Object.keys(pulledPhaseB.personalityByCat).length,
    appliedPostcards: Object.values(pulledPhaseB.postcardsByCat)
      .reduce((sum, list) => sum + list.length, 0),
    appliedCatStudioPosters: Object.values(pulledPhaseB.catStudioPostersByCat)
      .reduce((sum, list) => sum + list.length, 0),
    appliedWeeklyReadings: Object.values(pulledPhaseB.weeklyReadingsByCat)
      .reduce((sum, list) => sum + list.length, 0),
    appliedReminderCats: Object.keys(pulledPhaseB.remindersByCat).length,
    appliedNotifPrefs: !!pulledPhaseB.notifPrefsEnabled,
    appliedWorldEntries: pulledWorld.length,
    skipped: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Becoming + Subject Directory + Self-Facts cloud sync (added 2026-05-04)
// ═══════════════════════════════════════════════════════════════════════════
//
// These three stores hold the most personal slice of a cat's identity:
// the named people & pets in its life, the "you love tuna" facts the
// user has told it, and the per-cat seven-facet stage snapshot. All
// three are local-first (Zustand+AsyncStorage) and best-effort mirrored
// to Supabase via the helpers below. Write-paths are fire-and-forget;
// pull-path is bundled into the existing cold-start restore flow.

// ─── Subject Directory ────────────────────────────────────────────────────

/**
 * Push a single directory entry to Supabase. Called by every mutator
 * in subjectDirectoryStore (upsertFromTag, patchEntry, removeAppearance)
 * as fire-and-forget. Idempotent — upsert on id.
 */
export async function syncSubjectToCloud(entry: DirectoryEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('subject_directory').upsert(
    {
      id: entry.id,
      user_id: user.id,
      cat_id: entry.cat_id,
      name: entry.name,
      kind: entry.kind,
      species: entry.species ?? null,
      relationship: entry.relationship ?? null,
      appearances: entry.appearances,
      total_appearances: entry.total_appearances,
      first_seen: entry.first_seen,
      last_seen: entry.last_seen,
      vibe: entry.vibe ?? null,
      vibe_updated_at: entry.vibe_updated_at ?? null,
      // Path 2 — rich description for cross-photo matching. JSONB
      // on the server side; null for legacy entries.
      canonical_description: entry.canonical_description ?? null,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncSubjectToCloud:', error.message);
}

/** Delete a single directory entry from Supabase. */
export async function deleteSubjectFromCloud(subjectId: string): Promise<void> {
  const { error } = await supabase
    .from('subject_directory')
    .delete()
    .eq('id', subjectId);
  if (error) console.warn('[CatMD] deleteSubjectFromCloud:', error.message);
}

/**
 * Bulk push every directory entry for a cat. Useful for clearForCat /
 * recovery flows. Currently unused by the stores — they sync per-mutation
 * — but kept here for parity with the cats/events backfill helpers.
 */
export async function backfillSubjectsToCloud(
  entries: DirectoryEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await Promise.all(entries.map((e) => syncSubjectToCloud(e).catch(() => {})));
}

// ─── Self-Facts ───────────────────────────────────────────────────────────

export async function syncSelfFactToCloud(fact: SelfFact): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('self_facts').upsert(
    {
      id: fact.id,
      user_id: user.id,
      cat_id: fact.cat_id,
      fact: fact.fact,
      category: fact.category,
      source: fact.source,
      confidence: fact.confidence,
      source_turn_id: fact.source_turn_id ?? null,
      assertion_count: fact.assertion_count,
      created_at: fact.created_at,
      updated_at: fact.updated_at,
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncSelfFactToCloud:', error.message);
}

export async function deleteSelfFactFromCloud(factId: string): Promise<void> {
  const { error } = await supabase
    .from('self_facts')
    .delete()
    .eq('id', factId);
  if (error) console.warn('[CatMD] deleteSelfFactFromCloud:', error.message);
}

// ─── Becoming State ───────────────────────────────────────────────────────

/**
 * Sync the per-cat becoming snapshot. Single row per (user, cat) so we
 * upsert on the composite primary key.
 */
export async function syncBecomingStateToCloud(opts: {
  catId: string;
  lastStages: Partial<Record<FacetId, Stage>>;
  consumedMilestones: string[];
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('becoming_state').upsert(
    {
      user_id: user.id,
      cat_id: opts.catId,
      last_stages: opts.lastStages,
      consumed_milestones: opts.consumedMilestones,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,cat_id' },
  );
  if (error) console.warn('[CatMD] syncBecomingStateToCloud:', error.message);
}

// ─── Pull (extends restoreFromCloudIfNeeded for the three new stores) ────

export type PulledIdentityState = {
  subjects: DirectoryEntry[];
  selfFacts: SelfFact[];
  /** Per-cat snapshot. Keys are cat ids. */
  becomingByCat: Record<
    string,
    {
      last_stages: Partial<Record<FacetId, Stage>>;
      consumed_milestones: string[];
    }
  >;
};

/**
 * Pull all becoming-related data for the authenticated user. Called
 * by `restoreFromCloudIfNeeded` after the cats/scans/events pull,
 * gated by the same "all local stores empty" check.
 */
export async function pullIdentityFromCloud(): Promise<PulledIdentityState> {
  const empty: PulledIdentityState = {
    subjects: [],
    selfFacts: [],
    becomingByCat: {},
  };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const [{ data: subjectRows }, { data: factRows }, { data: becomingRows }] =
    await Promise.all([
      supabase.from('subject_directory').select('*').eq('user_id', user.id),
      supabase.from('self_facts').select('*').eq('user_id', user.id),
      supabase.from('becoming_state').select('*').eq('user_id', user.id),
    ]);

  const subjects: DirectoryEntry[] = (subjectRows ?? []).map((r: any) => ({
    id: r.id,
    cat_id: r.cat_id,
    name: r.name,
    kind: r.kind,
    ...(r.species ? { species: r.species } : {}),
    ...(r.relationship ? { relationship: r.relationship } : {}),
    appearances: Array.isArray(r.appearances) ? r.appearances : [],
    total_appearances: r.total_appearances ?? 0,
    first_seen: r.first_seen,
    last_seen: r.last_seen,
    ...(r.vibe ? { vibe: r.vibe } : {}),
    ...(r.vibe_updated_at ? { vibe_updated_at: r.vibe_updated_at } : {}),
    // Hydrate canonical_description if present. Legacy rows have null.
    ...(r.canonical_description
      ? { canonical_description: r.canonical_description }
      : {}),
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
  }));

  const selfFacts: SelfFact[] = (factRows ?? []).map((r: any) => ({
    id: r.id,
    cat_id: r.cat_id,
    fact: r.fact,
    category: r.category,
    source: r.source,
    confidence: typeof r.confidence === 'number' ? r.confidence : 1,
    ...(r.source_turn_id ? { source_turn_id: r.source_turn_id } : {}),
    assertion_count: r.assertion_count ?? 1,
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
  }));

  const becomingByCat: PulledIdentityState['becomingByCat'] = {};
  for (const r of becomingRows ?? []) {
    const cid = (r as any).cat_id as string;
    becomingByCat[cid] = {
      last_stages: ((r as any).last_stages ?? {}) as Partial<Record<FacetId, Stage>>,
      consumed_milestones: Array.isArray((r as any).consumed_milestones)
        ? ((r as any).consumed_milestones as string[])
        : [],
    };
  }

  return { subjects, selfFacts, becomingByCat };
}

/**
 * Apply a pulled identity-state bundle to the local stores. Bypasses
 * each store's per-mutation cloud-sync (we don't want a sync feedback
 * loop where pulled rows immediately re-upsert) by writing directly
 * via setState.
 *
 * Called by the extended `restoreFromCloudIfNeeded` after the local
 * store-empty check passes — same guarantee as the cats/scans/events
 * pull: only fires on a fresh install with empty local data.
 */
export async function applyPulledIdentity(
  pulled: PulledIdentityState,
): Promise<void> {
  if (
    pulled.subjects.length === 0 &&
    pulled.selfFacts.length === 0 &&
    Object.keys(pulled.becomingByCat).length === 0
  ) {
    return;
  }

  const [{ useSubjectDirectoryStore }, { useSelfFactsStore }, { useBecomingStore }] =
    await Promise.all([
      import('../state/subjectDirectoryStore'),
      import('../state/selfFactsStore'),
      import('../state/becomingStore'),
    ]);

  // Subjects — group by cat_id.
  if (pulled.subjects.length > 0) {
    const byCat: Record<string, DirectoryEntry[]> = {};
    for (const s of pulled.subjects) {
      (byCat[s.cat_id] ??= []).push(s);
    }
    useSubjectDirectoryStore.setState({ entries: byCat } as Parameters<
      typeof useSubjectDirectoryStore.setState
    >[0]);
  }

  // Self-facts — group by cat_id.
  if (pulled.selfFacts.length > 0) {
    const byCat: Record<string, SelfFact[]> = {};
    for (const f of pulled.selfFacts) {
      (byCat[f.cat_id] ??= []).push(f);
    }
    useSelfFactsStore.setState({ facts: byCat } as Parameters<
      typeof useSelfFactsStore.setState
    >[0]);
  }

  // Becoming — write last_stages + consumed_milestones for each cat.
  const beCount = Object.keys(pulled.becomingByCat).length;
  if (beCount > 0) {
    const lastStages: Record<string, Partial<Record<FacetId, Stage>>> = {};
    const consumed: Record<string, string[]> = {};
    for (const [cid, snap] of Object.entries(pulled.becomingByCat)) {
      lastStages[cid] = snap.last_stages;
      consumed[cid] = snap.consumed_milestones;
    }
    useBecomingStore.setState({
      lastStages,
      consumedMilestones: consumed,
    } as Parameters<typeof useBecomingStore.setState>[0]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase B (2026-05-06) — full-data backup + cross-platform restore
//
// Pre-Phase-B: 6 of 13 stores synced (cats / scans / health events / subjects
// / self-facts / becoming). The user-facing critical losses on device-change
// were diary entries, chat history, personality quiz, postcards, cat studio
// posters, weekly readings, reminders, and push prefs.
//
// Phase B closes those gaps. All payloads ride on existing `cat_events`
// using new type discriminators (see schema-cloud-backup-phase-b.sql) plus
// two new dedicated tables (`cat_reminders` for per-cat reminder times and
// `notif_prefs` for per-user push prefs).
//
// All push helpers follow the established offline-first pattern:
// fire-and-forget, errors logged but never surfaced. All pull helpers
// fetch the user's full slice via auth.uid()-keyed queries.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Diary entries ────────────────────────────────────────────────────────

/**
 * Push one diary entry to Supabase. Diary entries are text payloads in
 * `cat_events` with type='diary_entry'. Idempotent — upsert on id.
 */
export async function syncDiaryEntryToCloud(entry: {
  id: string;
  cat_id: string;
  date: string;                 // YYYY-MM-DD (the entry's local date)
  generated_at: string;         // ISO timestamp
  entry: string;
  mood_word?: string | null;
  is_empty_day?: boolean;
  facets_referenced?: string[];
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: entry.id,
      user_id: user.id,
      cat_id: entry.cat_id,
      type: 'diary_entry',
      ts: entry.generated_at,
      payload: {
        date: entry.date,
        generated_at: entry.generated_at,
        entry: entry.entry,
        mood_word: entry.mood_word ?? null,
        is_empty_day: entry.is_empty_day ?? false,
        facets_referenced: entry.facets_referenced ?? [],
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncDiaryEntryToCloud:', error.message);
}

export async function deleteDiaryEntryFromCloud(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('cat_events').delete().eq('id', entryId).eq('type', 'diary_entry');
  if (error) console.warn('[CatMD] deleteDiaryEntryFromCloud:', error.message);
}

// ─── Chat turns ───────────────────────────────────────────────────────────

/**
 * Push one chat turn to Supabase. Uses the existing 'chat' type in
 * `cat_events`. Per-turn sync (not per-thread batch) so a partial network
 * failure doesn't lose the rest of the conversation. Idempotent on id.
 *
 * Note: chat threads can grow large (100s of turns over time); we cap
 * server-side recovery at 2000 events on pull.
 */
export async function syncChatTurnToCloud(opts: {
  catId: string;
  turn: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    cited_cards?: Array<{ topic: string; category: string }>;
    actions?: string[];
    learned_facts?: Array<{ fact: string; category: string; is_new: boolean }>;
    field_updates?: unknown[];
  };
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: opts.turn.id,
      user_id: user.id,
      cat_id: opts.catId,
      type: 'chat',
      ts: opts.turn.created_at,
      payload: {
        role: opts.turn.role,
        content: opts.turn.content,
        cited_cards: opts.turn.cited_cards ?? [],
        actions: opts.turn.actions ?? [],
        learned_facts: opts.turn.learned_facts ?? [],
        field_updates: opts.turn.field_updates ?? [],
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncChatTurnToCloud:', error.message);
}

// ─── Personality quiz + computed profile ──────────────────────────────────

/**
 * Push the per-cat personality bundle (quiz answers + last computed
 * profile). Stored as a single 'personality_quiz' row in cat_events,
 * keyed by a deterministic id so repeated saves upsert in place.
 */
export async function syncPersonalityToCloud(opts: {
  catId: string;
  quizAnswers: unknown | null;
  profile: unknown | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const id = `personality:${opts.catId}`;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id,
      user_id: user.id,
      cat_id: opts.catId,
      type: 'personality_quiz',
      ts: new Date().toISOString(),
      payload: {
        quiz_answers: opts.quizAnswers,
        profile: opts.profile,
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncPersonalityToCloud:', error.message);
}

// ─── Postcards ────────────────────────────────────────────────────────────

/**
 * Push one postcard to Supabase. Photo URIs in the payload are LOCAL
 * file:// references — they only survive cross-device restore if Phase B3
 * (Supabase Storage upload) has uploaded them too.
 */
export async function syncPostcardToCloud(opts: {
  catId: string;
  postcard: {
    id: string;
    date: string;
    caption: string;
    caption_ai_original?: string;
    photos: Array<{ uri: string; width?: number; height?: number }>;
    generated_at: string;
  };
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: opts.postcard.id,
      user_id: user.id,
      cat_id: opts.catId,
      type: 'postcard',
      ts: opts.postcard.generated_at,
      payload: {
        date: opts.postcard.date,
        caption: opts.postcard.caption,
        caption_ai_original: opts.postcard.caption_ai_original ?? null,
        photos: opts.postcard.photos,
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncPostcardToCloud:', error.message);
}

// ─── Cat Studio posters ───────────────────────────────────────────────────

/**
 * Push one Cat Studio poster to Supabase. Same caveat as postcards —
 * the rendered PNG is a local file URI until Phase B3 lands.
 */
export async function syncCatStudioPosterToCloud(opts: {
  catId: string;
  poster: {
    id: string;
    week_id: string;
    variant_id: string;
    theme: string;
    photo_uri: string;
    generated_at: string;
    metadata?: Record<string, unknown>;
  };
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: opts.poster.id,
      user_id: user.id,
      cat_id: opts.catId,
      type: 'cat_studio_poster',
      ts: opts.poster.generated_at,
      payload: {
        week_id: opts.poster.week_id,
        variant_id: opts.poster.variant_id,
        theme: opts.poster.theme,
        photo_uri: opts.poster.photo_uri,
        metadata: opts.poster.metadata ?? {},
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncCatStudioPosterToCloud:', error.message);
}

// ─── Weekly readings ──────────────────────────────────────────────────────

/**
 * Push one weekly reading ("she reads YOU") to Supabase. Text payload.
 */
export async function syncWeeklyReadingToCloud(opts: {
  catId: string;
  reading: {
    id: string;
    body: string;
    generated_at: string;
    consumed_at?: string | null;
  };
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: opts.reading.id,
      user_id: user.id,
      cat_id: opts.catId,
      type: 'weekly_reading',
      ts: opts.reading.generated_at,
      payload: {
        body: opts.reading.body,
        consumed_at: opts.reading.consumed_at ?? null,
      },
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncWeeklyReadingToCloud:', error.message);
}

// ─── Reminders (med + checkin) — dedicated table, per-cat ─────────────────

/**
 * Push the cat's reminder configuration to `cat_reminders`. Single row
 * per (user, cat). med_notif_id and checkin_notif_id are device-local
 * and never round-tripped — the receiving device re-schedules its own.
 */
export async function syncCatRemindersToCloud(opts: {
  catId: string;
  medTime: string | null;
  checkinTime: string | null;
  checkinWeekday: number | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_reminders').upsert(
    {
      user_id: user.id,
      cat_id: opts.catId,
      med_time: opts.medTime,
      checkin_time: opts.checkinTime,
      checkin_weekday: opts.checkinWeekday,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,cat_id' },
  );
  if (error) console.warn('[CatMD] syncCatRemindersToCloud:', error.message);
}

// ─── Per-user notification prefs — dedicated table, single row per user ──

export async function syncNotifPrefsToCloud(
  enabled: Record<string, boolean>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('notif_prefs').upsert(
    {
      user_id: user.id,
      enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) console.warn('[CatMD] syncNotifPrefsToCloud:', error.message);
}

// ─── Pull: extended state bundle for Phase B ──────────────────────────────

export type PulledPhaseBState = {
  diary: Array<{
    id: string; cat_id: string; date: string; generated_at: string;
    entry: string; mood_word: string | null; is_empty_day: boolean;
    facets_referenced: string[];
  }>;
  chatTurnsByCat: Record<string, Array<{
    id: string; role: 'user' | 'assistant'; content: string; created_at: string;
    cited_cards: Array<{ topic: string; category: string }>;
    actions: string[];
    learned_facts: Array<{ fact: string; category: string; is_new: boolean }>;
    field_updates: unknown[];
  }>>;
  personalityByCat: Record<string, {
    quizAnswers: unknown | null;
    profile: unknown | null;
  }>;
  postcardsByCat: Record<string, Array<{
    id: string; date: string; caption: string;
    caption_ai_original: string | null;
    photos: Array<{ uri: string; width?: number; height?: number }>;
    generated_at: string;
  }>>;
  catStudioPostersByCat: Record<string, Array<{
    id: string; week_id: string; variant_id: string; theme: string;
    photo_uri: string; generated_at: string; metadata: Record<string, unknown>;
  }>>;
  weeklyReadingsByCat: Record<string, Array<{
    id: string; body: string; generated_at: string;
    consumed_at: string | null;
  }>>;
  remindersByCat: Record<string, {
    medTime: string | null;
    checkinTime: string | null;
    checkinWeekday: number | null;
  }>;
  notifPrefsEnabled: Record<string, boolean> | null;
};

export async function pullPhaseBFromCloud(): Promise<PulledPhaseBState> {
  const empty: PulledPhaseBState = {
    diary: [],
    chatTurnsByCat: {},
    personalityByCat: {},
    postcardsByCat: {},
    catStudioPostersByCat: {},
    weeklyReadingsByCat: {},
    remindersByCat: {},
    notifPrefsEnabled: null,
  };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  // Five cat_events queries (one per Phase-B type) + two dedicated tables.
  // We batch with Promise.all so total restore latency stays bounded.
  const [
    { data: diaryRows },
    { data: chatRows },
    { data: personalityRows },
    { data: postcardRows },
    { data: posterRows },
    { data: weeklyRows },
    { data: reminderRows },
    { data: prefsRow },
  ] = await Promise.all([
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'diary_entry')
      .order('ts', { ascending: false }).limit(500),
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'chat')
      .order('ts', { ascending: true }).limit(2000),
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'personality_quiz'),
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'postcard')
      .order('ts', { ascending: false }).limit(200),
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'cat_studio_poster')
      .order('ts', { ascending: false }).limit(100),
    supabase.from('cat_events').select('*').eq('user_id', user.id).eq('type', 'weekly_reading')
      .order('ts', { ascending: false }).limit(50),
    supabase.from('cat_reminders').select('*').eq('user_id', user.id),
    supabase.from('notif_prefs').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  const out: PulledPhaseBState = { ...empty, notifPrefsEnabled: null };

  // Diary
  out.diary = (diaryRows ?? []).map((r: any) => ({
    id: r.id,
    cat_id: r.cat_id ?? '',
    date: r.payload?.date ?? r.ts.slice(0, 10),
    generated_at: r.payload?.generated_at ?? r.ts,
    entry: r.payload?.entry ?? '',
    mood_word: r.payload?.mood_word ?? null,
    is_empty_day: !!r.payload?.is_empty_day,
    facets_referenced: r.payload?.facets_referenced ?? [],
  }));

  // Chat — group by cat_id
  for (const r of chatRows ?? []) {
    const cid = (r as any).cat_id ?? '';
    if (!cid) continue;
    (out.chatTurnsByCat[cid] ??= []).push({
      id: (r as any).id,
      role: (r as any).payload?.role === 'user' ? 'user' : 'assistant',
      content: (r as any).payload?.content ?? '',
      created_at: (r as any).ts,
      cited_cards: (r as any).payload?.cited_cards ?? [],
      actions: (r as any).payload?.actions ?? [],
      learned_facts: (r as any).payload?.learned_facts ?? [],
      field_updates: (r as any).payload?.field_updates ?? [],
    });
  }

  // Personality — one row per cat
  for (const r of personalityRows ?? []) {
    const cid = (r as any).cat_id ?? '';
    if (!cid) continue;
    out.personalityByCat[cid] = {
      quizAnswers: (r as any).payload?.quiz_answers ?? null,
      profile: (r as any).payload?.profile ?? null,
    };
  }

  // Postcards — group by cat_id
  for (const r of postcardRows ?? []) {
    const cid = (r as any).cat_id ?? '';
    if (!cid) continue;
    (out.postcardsByCat[cid] ??= []).push({
      id: (r as any).id,
      date: (r as any).payload?.date ?? (r as any).ts.slice(0, 10),
      caption: (r as any).payload?.caption ?? '',
      caption_ai_original: (r as any).payload?.caption_ai_original ?? null,
      photos: (r as any).payload?.photos ?? [],
      generated_at: (r as any).ts,
    });
  }

  // Cat Studio posters — group by cat_id
  for (const r of posterRows ?? []) {
    const cid = (r as any).cat_id ?? '';
    if (!cid) continue;
    (out.catStudioPostersByCat[cid] ??= []).push({
      id: (r as any).id,
      week_id: (r as any).payload?.week_id ?? '',
      variant_id: (r as any).payload?.variant_id ?? '',
      theme: (r as any).payload?.theme ?? '',
      photo_uri: (r as any).payload?.photo_uri ?? '',
      generated_at: (r as any).ts,
      metadata: (r as any).payload?.metadata ?? {},
    });
  }

  // Weekly readings — group by cat_id
  for (const r of weeklyRows ?? []) {
    const cid = (r as any).cat_id ?? '';
    if (!cid) continue;
    (out.weeklyReadingsByCat[cid] ??= []).push({
      id: (r as any).id,
      body: (r as any).payload?.body ?? '',
      generated_at: (r as any).ts,
      consumed_at: (r as any).payload?.consumed_at ?? null,
    });
  }

  // Reminders — one row per cat
  for (const r of reminderRows ?? []) {
    const cid = (r as any).cat_id;
    if (!cid) continue;
    out.remindersByCat[cid] = {
      medTime: (r as any).med_time ?? null,
      checkinTime: (r as any).checkin_time ?? null,
      checkinWeekday: (r as any).checkin_weekday ?? null,
    };
  }

  // Notif prefs — single row, may be null
  if (prefsRow) {
    out.notifPrefsEnabled = ((prefsRow as any).enabled ?? null) as Record<string, boolean> | null;
  }

  return out;
}

/**
 * Apply a Phase B pulled bundle to the local stores. Same setState-direct
 * pattern as applyPulledIdentity — bypasses per-mutator cloud-resync.
 */
export async function applyPulledPhaseB(
  pulled: PulledPhaseBState,
): Promise<void> {
  // Lazy imports — same circular-dep avoidance as restoreFromCloudIfNeeded.
  const stores = await Promise.all([
    import('../state/diaryStore'),
    import('../state/chatStore'),
    import('../state/personalityStore'),
    import('../state/postcardStore'),
    import('../state/catStudioStore'),
    import('../state/weeklyReadingStore'),
    import('../state/notificationStore'),
    import('../state/notifPrefsStore'),
  ]);
  const [
    { useDiaryStore },
    { useChatStore },
    { usePersonalityStore },
    { usePostcardStore },
    { useCatStudioStore },
    { useWeeklyReadingStore },
    { useNotificationStore },
    { useNotifPrefsStore },
  ] = stores;

  // Diary — cache key is `${catId}:${date}`
  if (pulled.diary.length > 0) {
    const entries: Record<string, unknown> = {};
    for (const d of pulled.diary) {
      entries[`${d.cat_id}:${d.date}`] = {
        id: d.id,
        cat_id: d.cat_id,
        date: d.date,
        generated_at: d.generated_at,
        entry: d.entry,
        mood_word: d.mood_word,
        is_empty_day: d.is_empty_day,
        facets_referenced: d.facets_referenced,
      };
    }
    useDiaryStore.setState({
      entries: entries as Parameters<typeof useDiaryStore.setState>[0] extends infer S
        ? S extends { entries: infer E } ? E : never : never,
    } as Parameters<typeof useDiaryStore.setState>[0]);
  }

  // Chat — threads by cat_id
  if (Object.keys(pulled.chatTurnsByCat).length > 0) {
    useChatStore.setState({
      threads: pulled.chatTurnsByCat as unknown as Parameters<typeof useChatStore.setState>[0] extends infer S
        ? S extends { threads: infer T } ? T : never : never,
    } as Parameters<typeof useChatStore.setState>[0]);
  }

  // Personality
  if (Object.keys(pulled.personalityByCat).length > 0) {
    const profiles: Record<string, unknown> = {};
    const quizAnswers: Record<string, unknown> = {};
    for (const [cid, p] of Object.entries(pulled.personalityByCat)) {
      if (p.profile) profiles[cid] = p.profile;
      if (p.quizAnswers) quizAnswers[cid] = p.quizAnswers;
    }
    usePersonalityStore.setState({
      profiles: profiles as Parameters<typeof usePersonalityStore.setState>[0] extends infer S
        ? S extends { profiles: infer P } ? P : never : never,
      quizAnswers: quizAnswers as Parameters<typeof usePersonalityStore.setState>[0] extends infer S
        ? S extends { quizAnswers: infer Q } ? Q : never : never,
    } as Parameters<typeof usePersonalityStore.setState>[0]);
  }

  // Postcards — store keyed by `${catId}:${date}`
  if (Object.keys(pulled.postcardsByCat).length > 0) {
    const postcards: Record<string, unknown> = {};
    for (const [cid, list] of Object.entries(pulled.postcardsByCat)) {
      for (const p of list) {
        postcards[`${cid}:${p.date}`] = {
          id: p.id,
          cat_id: cid,
          date: p.date,
          caption: p.caption,
          caption_ai_original: p.caption_ai_original ?? p.caption,
          photos: p.photos,
          generated_at: p.generated_at,
        };
      }
    }
    usePostcardStore.setState({
      postcards: postcards as Parameters<typeof usePostcardStore.setState>[0] extends infer S
        ? S extends { postcards: infer P } ? P : never : never,
    } as Parameters<typeof usePostcardStore.setState>[0]);
  }

  // Cat Studio posters — store keyed by `${catId}:${week_id}:${variant_id}` typically
  if (Object.keys(pulled.catStudioPostersByCat).length > 0) {
    // Restore via setState; the catStudioStore reads its own shape.
    useCatStudioStore.setState({
      // Fall back to a generic posters-by-cat structure; the store consumer
      // reads list-by-cat helpers, so the underlying dict shape is internal.
      // We pass the raw per-cat lists; the store's actions normalise.
      postersByCat: pulled.catStudioPostersByCat,
    } as unknown as Parameters<typeof useCatStudioStore.setState>[0]);
  }

  // Weekly readings
  if (Object.keys(pulled.weeklyReadingsByCat).length > 0) {
    useWeeklyReadingStore.setState({
      readingsByCat: pulled.weeklyReadingsByCat,
    } as unknown as Parameters<typeof useWeeklyReadingStore.setState>[0]);
  }

  // Reminders — populate notificationStore.byCat with the times. Notif ids
  // stay null on restore — the receiving device re-schedules its own pushes
  // when the user opens the cat-profile reminder UI (or via a boot-time
  // reschedule pass we can add later).
  if (Object.keys(pulled.remindersByCat).length > 0) {
    const byCat: Record<string, unknown> = {};
    for (const [cid, r] of Object.entries(pulled.remindersByCat)) {
      byCat[cid] = {
        med_time: r.medTime,
        med_notif_id: null,
        checkin_time: r.checkinTime,
        checkin_weekday: r.checkinWeekday,
        checkin_notif_id: null,
      };
    }
    useNotificationStore.setState({
      byCat: byCat as Parameters<typeof useNotificationStore.setState>[0] extends infer S
        ? S extends { byCat: infer B } ? B : never : never,
    } as Parameters<typeof useNotificationStore.setState>[0]);
  }

  // Notif prefs — single object, no merge needed (overwrite local with cloud
  // since restore only fires on local-empty).
  if (pulled.notifPrefsEnabled) {
    const prev = useNotifPrefsStore.getState() as { enabled?: Record<string, boolean> };
    useNotifPrefsStore.setState({
      enabled: { ...(prev.enabled ?? {}), ...pulled.notifPrefsEnabled },
    } as unknown as Parameters<typeof useNotifPrefsStore.setState>[0]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// World Memory (2026-05-06) — objects, places, toys the cat actually knows
//
// Different from subject_directory (named people/pets, photo-tag driven).
// World entries are user-input — "the green chair", "the garden", "my cat
// tree by the window". They ground the cat's voice in REAL items so chat
// replies stop hallucinating ("the cup is closer to the edge" → only fired
// when there's actually a cup in the data).
// ═══════════════════════════════════════════════════════════════════════════

/** Push a single world entry to Supabase. Idempotent — upsert on id. */
export async function syncWorldEntryToCloud(entry: WorldEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_world').upsert(
    {
      id: entry.id,
      user_id: user.id,
      cat_id: entry.cat_id,
      name: entry.name,
      kind: entry.kind,
      description: entry.description ?? null,
      color: entry.color ?? null,
      location: entry.location ?? null,
      sentiment: entry.sentiment ?? null,
      acquired_at: entry.acquired_at ?? null,
      // Provenance + evidence (added 2026-05-05 alongside silent
      // vision-derived entries). source_type defaults to 'user_added'
      // server-side for legacy rows that lack the field; new rows
      // carry the actual provenance so the UI can show evidence chips.
      source_type: entry.source_type ?? null,
      evidence_count: entry.evidence_count ?? null,
      last_referenced_at: entry.last_referenced_at ?? null,
      reference_count: entry.reference_count,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncWorldEntryToCloud:', error.message);
}

/** Delete a world entry from Supabase. */
export async function deleteWorldEntryFromCloud(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('cat_world')
    .delete()
    .eq('id', entryId);
  if (error) console.warn('[CatMD] deleteWorldEntryFromCloud:', error.message);
}

/** Bulk push (used by recovery flows). Currently unused; kept for parity. */
export async function backfillWorldToCloud(entries: WorldEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await Promise.all(entries.map((e) => syncWorldEntryToCloud(e).catch(() => {})));
}

/** Pull world memory for the authenticated user (called by restore). */
export async function pullWorldFromCloud(): Promise<WorldEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: rows } = await supabase
    .from('cat_world')
    .select('*')
    .eq('user_id', user.id);
  return (rows ?? []).map((r: any) => ({
    id: r.id,
    cat_id: r.cat_id,
    name: r.name,
    kind: r.kind,
    description: r.description ?? undefined,
    color: r.color ?? undefined,
    location: r.location ?? undefined,
    sentiment: r.sentiment ?? undefined,
    acquired_at: r.acquired_at ?? undefined,
    source_type: r.source_type ?? undefined,
    evidence_count: r.evidence_count ?? undefined,
    last_referenced_at: r.last_referenced_at ?? undefined,
    reference_count: r.reference_count ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
  })) as WorldEntry[];
}

/**
 * Apply pulled world entries to the local store. Bypasses per-mutator
 * cloud-resync (same setState-direct pattern as applyPulledIdentity).
 * Called by the extended `restoreFromCloudIfNeeded` after the local
 * store-empty check passes.
 */
export async function applyPulledWorld(entries: WorldEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { useWorldStore } = await import('../state/worldStore');
  // Group by cat_id
  const byCat: Record<string, WorldEntry[]> = {};
  for (const e of entries) {
    (byCat[e.cat_id] ??= []).push(e);
  }
  useWorldStore.setState({
    entriesByCat: byCat,
  } as unknown as Parameters<typeof useWorldStore.setState>[0]);
}
