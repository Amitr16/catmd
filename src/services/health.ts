/**
 * Mirror health events (vaccinations, med doses, weights, appointments,
 * symptom photos, water intake, litter-box uses, SRR readings, pain
 * scores, outcome checks) into Supabase `cat_events` under the typed
 * event taxonomy defined in schema-users.sql.
 *
 * Failures are logged but never surfaced — offline-first. The Zustand
 * store is the source of truth on-device; Supabase is a best-effort
 * copy for cross-device recovery.
 */
import type { HealthEvent } from '../state/healthStore';
import { supabase } from './supabase';

export async function syncHealthEventToCloud(event: HealthEvent): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('cat_events').upsert(
    {
      id: event.id,
      user_id: user.id,
      cat_id: event.cat_id,
      type: event.type,
      ts: event.ts,
      payload: event.payload,
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[CatMD] syncHealthEventToCloud:', error.message);
}

export async function deleteHealthEventFromCloud(id: string): Promise<void> {
  const { error } = await supabase.from('cat_events').delete().eq('id', id);
  if (error) console.warn('[CatMD] deleteHealthEventFromCloud:', error.message);
}
