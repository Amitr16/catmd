/**
 * Multi-cat profile state. Persisted to AsyncStorage and mirrored to
 * Supabase `cats` (offline-first; local writes win, cloud syncs best-effort).
 *
 * Data model:
 *   - cats: CatProfile[]         — everyone lives here, including the first
 *   - activeCatId: string | null — the cat that "owns" the current UI surface
 *
 * Migration from v1 (single `cat`) → v2 (array + activeCatId) is handled by
 * Zustand's persist `migrate` callback below. Existing users keep their data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  deleteCatFromCloud,
  syncCatToCloud,
} from '../services/sync';

export type Sex = 'male' | 'female' | 'unknown';
export type Lifestyle = 'indoor' | 'outdoor' | 'both';

export type CatProfile = {
  id: string;
  name: string;
  breed: string | null;

  // Two ways to express age — we store both and keep them consistent.
  // dob_iso is authoritative when present; otherwise we fall back to age_months.
  dob_iso: string | null;       // e.g. "2021-03-14"
  age_months: number | null;

  // Optional — when the cat joined the household. Used for the adoption-
  // iversary push notification + future Memory Book features. Distinct
  // from dob_iso because cats are often adopted as adults.
  adopted_on_iso: string | null;

  weight_kg: number | null;
  sex: Sex;
  spayed_neutered: boolean | null;
  indoor_outdoor: Lifestyle;

  // Illness + meds history — flat strings for v1. Upgrading to
  // `{name, diagnosed_date, resolved_date}` is a v2 schema change.
  conditions: string[];
  medications: string[];

  notes: string | null;         // free-form owner notes
  photo_uri: string | null;     // local file:// for now; Supabase Storage in v2

  // Emergency contacts — surfaced in the /result urgent action bar. Optional,
  // but when present they turn "call your vet" from advice into a one-tap
  // dial. Stored per-cat because multi-cat households may use different
  // clinics (e.g. specialty cat hospital for one, general vet for another).
  emergency_vet_name: string | null;
  emergency_vet_phone: string | null;

  created_at: string;
  updated_at: string;
};

type State = {
  cats: CatProfile[];
  activeCatId: string | null;
  hasOnboarded: boolean;

  // Selectors / derived
  getActiveCat: () => CatProfile | null;
  getCatById: (id: string) => CatProfile | null;

  // CRUD
  addCat: (cat: CatProfile) => void;
  patchCat: (id: string, fields: Partial<CatProfile>) => void;
  deleteCat: (id: string) => void;
  setActiveCat: (id: string) => void;

  /** Wipe every cat. Does NOT clear scan history or reminders — the
   *  caller (settings forget-everything flow) handles those separately
   *  so each store can sync to Supabase independently. */
  clearAllCats: () => void;

  setHasOnboarded: (v: boolean) => void;
};

function now(): string {
  return new Date().toISOString();
}

/**
 * Single source of truth for "how old is this cat right now."
 *
 * Per the catStore contract, `dob_iso` is authoritative when present —
 * the cat actually ages over time and stored `age_months` becomes stale.
 * Onboarding writes `age_months` from a coarse age bucket (Kitten / Young
 * / Adult / Senior); cat-profile saves a precise DOB if the owner knows
 * it. This helper enforces the contract: every display, prompt, or
 * downstream consumer should call this — never read `cat.age_months`
 * directly.
 *
 * Returns null if neither field is set.
 */
export function resolveCatAgeMonths(cat: CatProfile | null | undefined): number | null {
  if (!cat) return null;
  if (cat.dob_iso) {
    const dob = new Date(cat.dob_iso);
    if (!Number.isNaN(dob.getTime())) {
      const ms = Date.now() - dob.getTime();
      if (ms >= 0) {
        // 30.44 average days per month across the year
        return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
      }
    }
  }
  return cat.age_months;
}

/** Convenience: same data, but in years (1 decimal). */
export function resolveCatAgeYears(cat: CatProfile | null | undefined): number | null {
  const months = resolveCatAgeMonths(cat);
  if (months == null) return null;
  return Math.round((months / 12) * 10) / 10;
}

export function newCat(name: string): CatProfile {
  const ts = now();
  return {
    id: `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Cat',
    breed: null,
    dob_iso: null,
    age_months: null,
    adopted_on_iso: null,
    weight_kg: null,
    sex: 'unknown',
    spayed_neutered: null,
    indoor_outdoor: 'indoor',
    conditions: [],
    medications: [],
    notes: null,
    photo_uri: null,
    emergency_vet_name: null,
    emergency_vet_phone: null,
    created_at: ts,
    updated_at: ts,
  };
}

/** Derive age_months from DOB. Returns null if DOB is missing or invalid. */
export function ageMonthsFromDob(dobIso: string | null): number | null {
  if (!dobIso) return null;
  const d = new Date(dobIso);
  if (Number.isNaN(d.getTime())) return null;
  const now_d = new Date();
  let months = (now_d.getFullYear() - d.getFullYear()) * 12 +
               (now_d.getMonth() - d.getMonth());
  if (now_d.getDate() < d.getDate()) months -= 1;
  return Math.max(0, months);
}

export const useCatStore = create<State>()(
  persist(
    (set, get) => ({
      cats: [],
      activeCatId: null,
      hasOnboarded: false,

      getActiveCat: () => {
        const { cats, activeCatId } = get();
        return cats.find((c) => c.id === activeCatId) ?? null;
      },
      getCatById: (id) => get().cats.find((c) => c.id === id) ?? null,

      addCat: (cat) => {
        let cat_count_after = 0;
        set((s) => {
          const cats = [...s.cats, cat];
          cat_count_after = cats.length;
          return { cats, activeCatId: s.activeCatId ?? cat.id };
        });
        void syncCatToCloud(cat).catch(() => {});
        void import('../services/analytics').then(({ track }) =>
          track({ type: 'cat_added', props: { cat_count_after } }),
        );
      },

      patchCat: (id, fields) => {
        let next: CatProfile | null = null;
        set((s) => ({
          cats: s.cats.map((c) => {
            if (c.id !== id) return c;
            const merged: CatProfile = {
              ...c,
              ...fields,
              updated_at: now(),
            };
            // Keep age_months in sync with dob_iso
            if (fields.dob_iso !== undefined) {
              merged.age_months = ageMonthsFromDob(merged.dob_iso);
            }
            next = merged;
            return merged;
          }),
        }));
        if (next) void syncCatToCloud(next).catch(() => {});
      },

      deleteCat: (id) => {
        set((s) => {
          const cats = s.cats.filter((c) => c.id !== id);
          const activeCatId =
            s.activeCatId === id ? (cats[0]?.id ?? null) : s.activeCatId;
          return { cats, activeCatId };
        });
        void deleteCatFromCloud(id).catch(() => {});
        // Drop orphaned scans, health events, and reminders for this
        // cat. Dynamic imports avoid a circular dep with the child
        // stores (they already import from here).
        import('./scanStore')
          .then(({ useScanStore }) => {
            const { scans, deleteScan } = useScanStore.getState();
            scans.filter((s) => s.cat_id === id).forEach((s) => deleteScan(s.id));
          })
          .catch(() => {});
        import('./healthStore')
          .then(({ useHealthStore }) => {
            useHealthStore.getState().clearForCat(id);
          })
          .catch(() => {});
        import('./notificationStore')
          .then(({ useNotificationStore }) => {
            void useNotificationStore.getState().clearForCat(id).catch(() => {});
          })
          .catch(() => {});
      },

      setActiveCat: (id) => set({ activeCatId: id }),

      clearAllCats: () => {
        const ids = get().cats.map((c) => c.id);
        set({ cats: [], activeCatId: null });
        // Best-effort server wipe per cat. The forget_me() RPC called
        // elsewhere also wipes the user's rows, so this is defensive.
        ids.forEach((id) => {
          void deleteCatFromCloud(id).catch(() => {});
        });
      },

      setHasOnboarded: (v) => set({ hasOnboarded: v }),
    }),
    {
      name: 'catmd-cat-profile',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted: any, version) => {
        // v1 shape: { cat: CatProfile | null, hasOnboarded }
        if (version < 2 && persisted) {
          const { cat, hasOnboarded } = persisted ?? {};
          if (cat && cat.id) {
            // Upgrade to v2 shape with array + activeCatId
            const merged: CatProfile = {
              ...cat,
              dob_iso: cat.dob_iso ?? null,
              notes: cat.notes ?? null,
              updated_at: cat.updated_at ?? cat.created_at ?? now(),
            };
            return { cats: [merged], activeCatId: merged.id, hasOnboarded };
          }
          return { cats: [], activeCatId: null, hasOnboarded: !!hasOnboarded };
        }
        return persisted;
      },
    },
  ),
);
