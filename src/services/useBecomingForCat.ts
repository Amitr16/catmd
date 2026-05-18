/**
 * useBecomingForCat — shared hook that computes the "Becoming" snapshot
 * (composite depth + per-facet stages + today's milestone) for a single
 * cat.
 *
 * Why a hook: bond.tsx originally inlined the ~50-line useMemo that
 * subscribes to every store the becoming derivation needs. The same
 * computation is now needed in chat.tsx and diary.tsx (PersonalityProgressBanner)
 * to set user expectations early-on ("she may sound generic — keep going").
 * Duplicating the inline useMemo three times is brittle: the next time a
 * facet is added to becoming.ts, three call-sites would drift.
 *
 * This hook centralises:
 *   - the photo / chat / body-language / check-in-streak / subjects /
 *     personality-quiz / diary-entry signal extraction
 *   - the streak walk that derives consecutive daily-checkin days from
 *     the health-event stream
 *   - the call to deriveBecoming()
 *
 * Returns null when there is no cat (matches deriveBecoming's contract).
 */
import { useMemo } from 'react';
import { useChatStore } from '../state/chatStore';
import { useDiaryEntriesForCat } from '../state/diaryStore';
import { useHealthStore } from '../state/healthStore';
import { usePersonalityProfile } from '../state/personalityStore';
import { usePhotoStudioStore } from '../state/photoStudioStore';
import { useSubjectsForCat } from '../state/subjectDirectoryStore';
import { deriveBecoming, type Becoming } from './becoming';

export function useBecomingForCat(
  catId: string | null | undefined,
): Becoming | null {
  const allHealthEvents = useHealthStore((s) => s.events);
  const photosCountForCat = usePhotoStudioStore((s) =>
    catId ? (s.photos[catId] ?? []).length : 0,
  );
  const chatTurns = useChatStore((s) =>
    catId ? (s.threads[catId] ?? []).length : 0,
  );
  const diaryEntriesCount = useDiaryEntriesForCat(catId).length;
  const subjectsCount = useSubjectsForCat(catId).length;
  const personalityProfile = usePersonalityProfile(catId);

  return useMemo(() => {
    if (!catId) return null;
    const catEvents = allHealthEvents.filter((e) => e.cat_id === catId);

    // Daily-check-in streak: walk back day-by-day from today, counting
    // consecutive days that had a check-in event. Stops on the first
    // gap (after the streak started). Mirrors the logic in bond.tsx.
    const checkinDates = new Set<string>();
    for (const e of catEvents) {
      if (e.type !== 'daily_checkin') continue;
      try {
        const d = new Date(e.ts);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        checkinDates.add(k);
      } catch {
        // skip malformed ts
      }
    }
    let streak = 0;
    const cursor = new Date();
    let firstHit = false;
    for (let i = 0; i < 365; i += 1) {
      const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (checkinDates.has(k)) {
        firstHit = true;
        streak += 1;
      } else if (firstHit) {
        break;
      } else if (i > 0) {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return deriveBecoming({
      photoCount: photosCountForCat,
      chatTurnCount: chatTurns,
      bodyLanguageSessionCount: catEvents.filter(
        (e) => e.type === 'behavior_observation',
      ).length,
      checkinStreak: streak,
      namedSubjectsCount: subjectsCount,
      personalityArchetypeSet: !!personalityProfile,
      diaryEntryCount: diaryEntriesCount,
      previousStages: null,
    });
  }, [
    catId,
    allHealthEvents,
    photosCountForCat,
    chatTurns,
    diaryEntriesCount,
    subjectsCount,
    personalityProfile,
  ]);
}
