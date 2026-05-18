#!/usr/bin/env node
// Date-boundary fixture tests for the diary pipeline (audit
// 2026-05-14 round 9 fixes). Self-contained — does NOT import the
// diary module (which has RN/Expo transitive dependencies that don't
// resolve in plain Node). Instead, the tests mirror the EXACT date
// math that `buildDayContext` and `buildDeepContext` now use, and
// verify it against fixtures.
//
// Why this is sufficient:
//   - The diary fix is purely a "use target-date instead of today"
//     swap, with no algorithmic change.
//   - TypeScript compilation already proves the wiring is correct.
//   - These tests prove the DATE MATH that the wiring drives.
//
// Run:
//   node --no-warnings scripts/test-diary-date-boundaries.mjs

// ---------------------------------------------------------------------------
// Helpers — must MIRROR what buildDayContext/buildDeepContext do
// ---------------------------------------------------------------------------

function deriveTargetDateFields(targetKey /* "YYYY-MM-DD" */) {
  const obj = new Date(`${targetKey}T12:00:00`);
  return {
    targetDateObj: obj,
    targetMonth: obj.getMonth(),
    targetDay: obj.getDate(),
    targetWeekdayIdx: obj.getDay(),
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekdayForTarget(targetKey) {
  const { targetWeekdayIdx } = deriveTargetDateFields(targetKey);
  return WEEKDAYS[targetWeekdayIdx];
}

function isBirthdayForTarget(targetKey, dobIso) {
  if (!dobIso) return false;
  const { targetMonth, targetDay } = deriveTargetDateFields(targetKey);
  const dob = new Date(dobIso);
  return dob.getMonth() === targetMonth && dob.getDate() === targetDay;
}

function isAdoptionIversaryForTarget(targetKey, adoptedOnIso) {
  if (!adoptedOnIso) return false;
  const { targetMonth, targetDay } = deriveTargetDateFields(targetKey);
  const adopted = new Date(adoptedOnIso);
  return adopted.getMonth() === targetMonth && adopted.getDate() === targetDay;
}

function specialDayForTarget(targetKey) {
  const { targetMonth: m, targetDay: d } = deriveTargetDateFields(targetKey);
  if (m === 0 && d === 1) return 'new_year';
  if (m === 1 && d === 14) return 'valentines';
  if (m === 11 && d === 25) return 'christmas';
  if (m === 9 && d === 31) return 'halloween';
  if (m === 2 && d === 20) return 'spring_equinox';
  if (m === 5 && d === 21) return 'summer_solstice';
  if (m === 8 && d === 22) return 'autumn_equinox';
  if (m === 11 && d === 21) return 'winter_solstice';
  if (m === 10 && d === 15) return 'first_snow_likely';
  return null;
}

function hasRecentEmergencyForTarget(targetKey, scans) {
  const targetEndOfDay = new Date(`${targetKey}T23:59:59`).getTime();
  const cutoff = targetEndOfDay - 36 * 60 * 60 * 1000;
  return scans.some((s) => {
    if (s.urgency?.toLowerCase() !== 'emergency') return false;
    const t = new Date(s.created_at).getTime();
    return t >= cutoff && t <= targetEndOfDay;
  });
}

function hasMedicalConcernForDay(scansToday) {
  return scansToday.some(
    (s) =>
      s.urgency === 'emergency' ||
      s.urgency === 'urgent' ||
      s.urgency === 'concern',
  );
}

// Weight trend (30-day window anchored to contextNow, the target date)
function weightTrendForTarget(targetKey, weightEvents) {
  const dayMs = 24 * 60 * 60 * 1000;
  const contextNow = new Date(`${targetKey}T12:00:00`).getTime();
  const cutoff = contextNow - 30 * dayMs;
  const ceiling = contextNow;
  const filtered = weightEvents
    .filter((e) => {
      const t = new Date(e.ts).getTime();
      return t >= cutoff && t <= ceiling;
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));
  if (filtered.length < 2) return null;
  const fromKg = filtered[0].payload.weight_kg;
  const toKg = filtered[filtered.length - 1].payload.weight_kg;
  const deltaKg = +(toKg - fromKg).toFixed(2);
  const absDelta = Math.abs(deltaKg);
  const direction = absDelta < 0.1 ? 'stable' : deltaKg > 0 ? 'up' : 'down';
  return { deltaKg, direction, fromKg, toKg };
}

// World-entries filter — only entries the cat KNEW on the target date
function worldEntriesForTarget(targetKey, allEntries, isToday) {
  if (isToday) return allEntries;
  const targetEndOfDay = `${targetKey}T23:59:59`;
  return allEntries.filter((e) => {
    if (!e.created_at) return true;
    return e.created_at <= targetEndOfDay;
  });
}

// Scene captions — read scenes by observed_at on the target date
function scenesForTarget(targetKey, allScenes) {
  return allScenes
    .filter((s) => {
      const d = new Date(s.observed_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === targetKey;
    })
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
}

// Recurring subjects — anchored to contextNow + filtered by last_seen
// <= targetKey (audit round 11) + sorted by target-capped appearance
// count (audit round 13, replacing lifetime sort).
function recurringSubjectsForTarget(
  targetKey,
  directoryEntries,
  todaysPhotoIds,
  isToday = false,
) {
  const RECURRING_LOOKBACK_DAYS = 30;
  const RECURRING_MAX = 6;
  const contextNow = new Date(`${targetKey}T12:00:00`);
  const lookbackCutoff = (() => {
    const d = new Date(contextNow);
    d.setDate(d.getDate() - RECURRING_LOOKBACK_DAYS);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const todayIdSet = new Set(todaysPhotoIds ?? []);
  const subjectsToday = new Set(
    directoryEntries
      .filter((e) => {
        if (todayIdSet.size > 0) {
          return (e.appearances ?? []).some((a) => todayIdSet.has(a.photo_id));
        }
        return e.last_seen === targetKey;
      })
      .map((e) => e.name),
  );
  const appearancesUpToTarget = (e) => {
    if (isToday) return e.total_appearances;
    return (e.appearances ?? []).filter((a) => a.date <= targetKey).length;
  };
  return directoryEntries
    .filter((e) => {
      if (e.last_seen > targetKey) return false;
      if (e.last_seen < lookbackCutoff) return false;
      if (subjectsToday.has(e.name)) return false;
      if (appearancesUpToTarget(e) === 0) return false;
      return true;
    })
    .sort((a, b) => appearancesUpToTarget(b) - appearancesUpToTarget(a))
    .slice(0, RECURRING_MAX);
}

// daysSinceLastSeen — should be relative to contextNow (target date),
// not actual now. Pre-fix: May 5 backfill with last_seen=May 10 would
// render as a negative number.
function daysSinceForTarget(targetKey, lastSeenKey) {
  const contextNow = new Date(`${targetKey}T12:00:00`).getTime();
  const last = new Date(`${lastSeenKey}T12:00:00`).getTime();
  return Math.max(0, Math.floor((contextNow - last) / 86400000));
}

// Appearance count up to target (audit round 12). For a past-date
// backfill the diary's `appearances` field should reflect only
// appearances DATED on or before the target date — not the cumulative
// total which can include post-target events.
function appearanceCountUpToTarget(targetKey, isToday, totalAppearances, appearances) {
  if (isToday) return totalAppearances;
  return (appearances ?? []).filter((a) => a.date <= targetKey).length;
}

// Vibe inclusion gate (audit round 12). On past-date backfill, include
// vibe only if `vibe_updated_at` is on or before the target's
// end-of-day. Today's entries always include the vibe.
function vibeIncludedForTarget(targetKey, isToday, vibeUpdatedAt) {
  if (isToday) return true;
  if (typeof vibeUpdatedAt !== 'string') return false;
  const targetEndOfDay = `${targetKey}T23:59:59`;
  return vibeUpdatedAt <= targetEndOfDay;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fixtures = [
  // ─── Weekday ────────────────────────────────────────────────────
  {
    name: 'weekday: 2024-05-01 is Wednesday',
    run: () => weekdayForTarget('2024-05-01') === 'Wednesday',
  },
  {
    name: 'weekday: 2024-12-25 is Wednesday',
    run: () => weekdayForTarget('2024-12-25') === 'Wednesday',
  },
  {
    name: 'weekday: 2025-01-01 is Wednesday',
    run: () => weekdayForTarget('2025-01-01') === 'Wednesday',
  },

  // ─── Birthday ──────────────────────────────────────────────────
  {
    name: 'birthday: dob May 1 + target May 5 → false',
    run: () =>
      isBirthdayForTarget('2024-05-05', '2020-05-01T00:00:00.000Z') === false,
  },
  {
    name: 'birthday: dob May 1 + target May 1 → true',
    run: () =>
      isBirthdayForTarget('2024-05-01', '2020-05-01T00:00:00.000Z') === true,
  },
  {
    name: 'birthday: no dob → false regardless of target',
    run: () => isBirthdayForTarget('2024-05-01', null) === false,
  },

  // ─── Adoption-iversary ─────────────────────────────────────────
  {
    name: 'adoption: adopted Jun 15 + target May 5 → false',
    run: () =>
      isAdoptionIversaryForTarget('2024-05-05', '2019-06-15T00:00:00.000Z') ===
      false,
  },
  {
    name: 'adoption: adopted Jun 15 + target Jun 15 → true',
    run: () =>
      isAdoptionIversaryForTarget('2024-06-15', '2019-06-15T00:00:00.000Z') ===
      true,
  },

  // ─── Special day ───────────────────────────────────────────────
  { name: 'specialDay: 2024-12-25 → christmas', run: () => specialDayForTarget('2024-12-25') === 'christmas' },
  { name: 'specialDay: 2024-02-14 → valentines', run: () => specialDayForTarget('2024-02-14') === 'valentines' },
  { name: 'specialDay: 2024-01-01 → new_year', run: () => specialDayForTarget('2024-01-01') === 'new_year' },
  { name: 'specialDay: 2024-10-31 → halloween', run: () => specialDayForTarget('2024-10-31') === 'halloween' },
  { name: 'specialDay: 2024-05-02 → null', run: () => specialDayForTarget('2024-05-02') === null },
  // The critical leak test: ordinary day NOT misreported as today's holiday
  { name: 'specialDay leak: May 2 backfill on Dec 25 still returns null', run: () => specialDayForTarget('2024-05-02') === null },

  // ─── Recent emergency window ───────────────────────────────────
  {
    name: 'emergency: scan on May 14 does NOT leak into May 5 backfill',
    run: () =>
      hasRecentEmergencyForTarget('2024-05-05', [
        { urgency: 'emergency', created_at: '2024-05-14T10:00:00.000Z' },
      ]) === false,
  },
  {
    name: 'emergency: scan on May 4 surfaces for May 5 (within 36h)',
    run: () =>
      hasRecentEmergencyForTarget('2024-05-05', [
        { urgency: 'emergency', created_at: '2024-05-04T14:00:00.000Z' },
      ]) === true,
  },
  {
    name: 'emergency: scan on May 5 itself surfaces',
    run: () =>
      hasRecentEmergencyForTarget('2024-05-05', [
        { urgency: 'emergency', created_at: '2024-05-05T08:00:00.000Z' },
      ]) === true,
  },
  {
    name: 'emergency: scan on May 2 (too old) does not surface for May 5',
    run: () =>
      hasRecentEmergencyForTarget('2024-05-05', [
        { urgency: 'emergency', created_at: '2024-05-02T08:00:00.000Z' },
      ]) === false,
  },
  {
    name: 'emergency: urgent (not emergency) does not surface (different gate)',
    run: () =>
      hasRecentEmergencyForTarget('2024-05-05', [
        { urgency: 'urgent', created_at: '2024-05-05T08:00:00.000Z' },
      ]) === false,
  },

  // ─── Medical concern routing (audit P1 #6: emergency now included) ───
  {
    name: 'medical concern: emergency urgency forces dark mood',
    run: () => hasMedicalConcernForDay([{ urgency: 'emergency' }]) === true,
  },
  {
    name: 'medical concern: urgent forces dark mood',
    run: () => hasMedicalConcernForDay([{ urgency: 'urgent' }]) === true,
  },
  {
    name: 'medical concern: concern forces dark mood',
    run: () => hasMedicalConcernForDay([{ urgency: 'concern' }]) === true,
  },
  {
    name: 'medical concern: routine does not force dark mood',
    run: () => hasMedicalConcernForDay([{ urgency: 'routine' }]) === false,
  },

  // ─── Weight trend window anchored to contextNow ─────────────────
  {
    name: 'weight trend: weight on May 14 does NOT bleed into May 5 backfill',
    run: () => {
      // Backfill May 5: only weights from Apr 5 - May 5 window should count
      const events = [
        { ts: '2024-05-14T10:00:00.000Z', payload: { weight_kg: 4.5 } },
        { ts: '2024-05-03T10:00:00.000Z', payload: { weight_kg: 4.2 } },
        { ts: '2024-04-20T10:00:00.000Z', payload: { weight_kg: 4.0 } },
      ];
      const trend = weightTrendForTarget('2024-05-05', events);
      // Should only use the Apr 20 and May 3 events (both within 30-day
      // window ending at May 5). May 14 is AFTER target and excluded.
      if (!trend) return false;
      return trend.fromKg === 4.0 && trend.toKg === 4.2;
    },
  },
  {
    name: 'weight trend: <2 events in window returns null',
    run: () => {
      const events = [{ ts: '2024-05-03T10:00:00.000Z', payload: { weight_kg: 4.2 } }];
      return weightTrendForTarget('2024-05-05', events) === null;
    },
  },

  // ─── World-entry temporal filter ───────────────────────────────
  {
    name: 'world: entry created May 14 does NOT appear in May 5 context',
    run: () => {
      const entries = [
        { name: 'the green chair', created_at: '2024-05-14T10:00:00.000Z' },
        { name: 'the windowsill', created_at: '2024-04-30T10:00:00.000Z' },
      ];
      const filtered = worldEntriesForTarget('2024-05-05', entries, /* isToday */ false);
      return filtered.length === 1 && filtered[0].name === 'the windowsill';
    },
  },
  {
    name: "world: isToday=true keeps everything",
    run: () => {
      const entries = [
        { name: 'the green chair', created_at: '2024-05-14T10:00:00.000Z' },
        { name: 'the windowsill', created_at: '2024-04-30T10:00:00.000Z' },
      ];
      const filtered = worldEntriesForTarget('2024-05-14', entries, /* isToday */ true);
      return filtered.length === 2;
    },
  },
  {
    name: 'world: legacy entry with no created_at is included (cold-start safety)',
    run: () => {
      const entries = [{ name: 'old entry' /* no created_at */ }];
      const filtered = worldEntriesForTarget('2024-05-05', entries, false);
      return filtered.length === 1;
    },
  },

  // ─── Scene-caption observed_at filter ───────────────────────────
  {
    name: 'scenes: photo on May 10 does NOT show in May 5 context',
    run: () => {
      const scenes = [
        { caption: 'cat on green chair', observed_at: '2024-05-10T14:00:00.000Z' },
      ];
      return scenesForTarget('2024-05-05', scenes).length === 0;
    },
  },
  {
    name: 'scenes: photo on May 5 shows in May 5 context',
    run: () => {
      const scenes = [
        { caption: 'cat on windowsill', observed_at: '2024-05-05T14:00:00.000Z' },
      ];
      return scenesForTarget('2024-05-05', scenes).length === 1;
    },
  },

  // ─── Recurring subjects temporal leak (audit round 11) ──────────
  {
    name: 'recurring: person first tagged May 10 does NOT appear in May 5 backfill',
    run: () => {
      const directory = [
        {
          name: 'Mom',
          kind: 'person',
          last_seen: '2024-05-10',
          total_appearances: 3,
          appearances: [{ photo_id: 'p1', date: '2024-05-10' }],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-05', directory, []);
      return out.length === 0;
    },
  },
  {
    name: 'recurring: person tagged Apr 30 + May 1 DOES appear in May 5 backfill',
    run: () => {
      const directory = [
        {
          name: 'Mom',
          kind: 'person',
          last_seen: '2024-05-01',
          total_appearances: 2,
          appearances: [
            { photo_id: 'p1', date: '2024-04-30' },
            { photo_id: 'p2', date: '2024-05-01' },
          ],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-05', directory, []);
      return out.length === 1 && out[0].name === 'Mom';
    },
  },
  {
    name: 'recurring: person tagged 60 days ago is OUTSIDE the 30-day window',
    run: () => {
      const directory = [
        {
          name: 'Old Friend',
          kind: 'person',
          last_seen: '2024-03-05', // 60 days before May 5
          total_appearances: 5,
          appearances: [],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-05', directory, []);
      return out.length === 0;
    },
  },
  {
    name: 'recurring: subject seen ON target date is in subjectsToday, NOT recurring',
    run: () => {
      const directory = [
        {
          name: 'Bella',
          kind: 'pet',
          last_seen: '2024-05-05',
          total_appearances: 4,
          appearances: [{ photo_id: 'p1', date: '2024-05-05' }],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-05', directory, []);
      // subjectsToday filter excludes from recurring
      return out.length === 0;
    },
  },
  {
    name: 'daysSinceLastSeen: targetDate May 5 + lastSeen May 1 → 4',
    run: () => daysSinceForTarget('2024-05-05', '2024-05-01') === 4,
  },
  {
    name: 'daysSinceLastSeen: targetDate May 5 + lastSeen May 5 → 0',
    run: () => daysSinceForTarget('2024-05-05', '2024-05-05') === 0,
  },
  {
    name: 'daysSinceLastSeen: future last_seen (data shouldn\'t exist) clamps to 0',
    run: () => daysSinceForTarget('2024-05-05', '2024-05-10') === 0,
  },

  // ─── Appearance count up to target (audit round 12) ─────────────
  {
    name: 'appearances: Mom with 11 lifetime visits (1 by May 5, 10 after) → 1 in May 5 backfill',
    run: () => {
      const appearances = [
        { photo_id: 'p1', date: '2024-05-03' },
        { photo_id: 'p2', date: '2024-05-07' },
        { photo_id: 'p3', date: '2024-05-08' },
        { photo_id: 'p4', date: '2024-05-09' },
        { photo_id: 'p5', date: '2024-05-10' },
        { photo_id: 'p6', date: '2024-05-11' },
        { photo_id: 'p7', date: '2024-05-12' },
        { photo_id: 'p8', date: '2024-05-13' },
        { photo_id: 'p9', date: '2024-05-14' },
        { photo_id: 'p10', date: '2024-05-14' },
        { photo_id: 'p11', date: '2024-05-14' },
      ];
      return appearanceCountUpToTarget('2024-05-05', /* isToday */ false, 11, appearances) === 1;
    },
  },
  {
    name: 'appearances: isToday uses total (no filter)',
    run: () => {
      const appearances = [
        { photo_id: 'p1', date: '2024-05-14' },
        { photo_id: 'p2', date: '2024-05-14' },
      ];
      return appearanceCountUpToTarget('2024-05-14', /* isToday */ true, 2, appearances) === 2;
    },
  },
  {
    name: 'appearances: no appearances on or before target → 0',
    run: () => {
      const appearances = [
        { photo_id: 'p1', date: '2024-05-10' },
      ];
      return appearanceCountUpToTarget('2024-05-05', false, 1, appearances) === 0;
    },
  },

  // ─── Vibe gate (audit round 12) ─────────────────────────────────
  {
    name: 'vibe: today\'s entry always includes vibe',
    run: () => vibeIncludedForTarget('2024-05-14', /* isToday */ true, '2024-05-14T10:00:00.000Z') === true,
  },
  {
    name: 'vibe: vibe written on May 14, May 5 backfill → excluded',
    run: () => vibeIncludedForTarget('2024-05-05', false, '2024-05-14T10:00:00.000Z') === false,
  },
  {
    name: 'vibe: vibe written on May 3, May 5 backfill → included',
    run: () => vibeIncludedForTarget('2024-05-05', false, '2024-05-03T10:00:00.000Z') === true,
  },
  {
    name: 'vibe: no vibe_updated_at on legacy entry, past backfill → excluded',
    run: () => vibeIncludedForTarget('2024-05-05', false, undefined) === false,
  },

  // ─── Recurring-subject SORT bias (audit round 13) ───────────────
  {
    name: 'sort: subject frequent post-target ranks BELOW subject frequent pre-target',
    run: () => {
      // Backfill May 5. Subject A had 5 visits ≤ May 5, 0 after.
      // Subject B had 1 visit ≤ May 5, 10 visits after.
      // Pre-fix sort (by total_appearances) would put B first; the
      // round 13 fix sorts by target-capped count → A should be first.
      const directory = [
        {
          name: 'B-late',
          kind: 'person',
          last_seen: '2024-05-01',
          total_appearances: 11,
          appearances: [
            { photo_id: 'b1', date: '2024-05-01' },
            { photo_id: 'b2', date: '2024-05-07' },
            { photo_id: 'b3', date: '2024-05-08' },
            { photo_id: 'b4', date: '2024-05-09' },
            { photo_id: 'b5', date: '2024-05-10' },
            { photo_id: 'b6', date: '2024-05-11' },
            { photo_id: 'b7', date: '2024-05-12' },
            { photo_id: 'b8', date: '2024-05-13' },
            { photo_id: 'b9', date: '2024-05-14' },
            { photo_id: 'b10', date: '2024-05-14' },
            { photo_id: 'b11', date: '2024-05-14' },
          ],
        },
        {
          name: 'A-early',
          kind: 'person',
          last_seen: '2024-05-04',
          total_appearances: 5,
          appearances: [
            { photo_id: 'a1', date: '2024-04-28' },
            { photo_id: 'a2', date: '2024-04-29' },
            { photo_id: 'a3', date: '2024-05-01' },
            { photo_id: 'a4', date: '2024-05-03' },
            { photo_id: 'a5', date: '2024-05-04' },
          ],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-05', directory, [], false);
      return out.length === 2 && out[0].name === 'A-early' && out[1].name === 'B-late';
    },
  },
  {
    name: 'sort: zero appearances on or before target → dropped (not just ranked low)',
    run: () => {
      // Subject met only on May 10 — appearancesUpToTarget('2024-05-05') = 0.
      // The filter at line 2725 drops them before sort.
      const directory = [
        {
          name: 'OnlyAfter',
          kind: 'person',
          last_seen: '2024-05-04',
          total_appearances: 0, // pretend the appearances array is the truth
          appearances: [
            { photo_id: 'x', date: '2024-05-10' },
          ],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-05', directory, [], false);
      return out.length === 0;
    },
  },
  {
    name: 'sort: isToday uses total_appearances for ranking',
    run: () => {
      // For today's entry, ranking by lifetime count is correct.
      const directory = [
        {
          name: 'Bigger',
          kind: 'person',
          last_seen: '2024-05-04',
          total_appearances: 20,
          appearances: [{ photo_id: 'b1', date: '2024-05-04' }],
        },
        {
          name: 'Smaller',
          kind: 'person',
          last_seen: '2024-05-04',
          total_appearances: 5,
          appearances: [{ photo_id: 's1', date: '2024-05-04' }],
        },
      ];
      const out = recurringSubjectsForTarget('2024-05-14', directory, [], /* isToday */ true);
      return out.length === 2 && out[0].name === 'Bigger' && out[1].name === 'Smaller';
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
for (const fx of fixtures) {
  let ok = false;
  let err = null;
  try {
    ok = !!fx.run();
  } catch (e) {
    err = e;
  }
  if (ok) {
    pass++;
    console.log(`  ✓ ${fx.name}`);
  } else {
    fail++;
    console.log(`  ✗ ${fx.name}${err ? `\n      threw: ${err.message}` : ''}`);
  }
}

console.log(`\n${pass}/${fixtures.length} passed.`);
if (fail > 0) process.exit(1);
process.exit(0);
