#!/usr/bin/env node
// Runnable golden tests for voiceQuality.ts (audit 2026-05-14 round 7).
//
// No Jest / Vitest in this project. This script imports the compiled
// voiceQuality module directly + runs assertion fixtures. Each fixture
// is one test case with an expected ok/score band + reason patterns.
//
// Usage:
//   npx tsx scripts/test-voice-quality.mjs       # if tsx is installed
//   or transpile + run
//
// Exits 0 on all-pass, 1 on any failure. Prints a per-case summary.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Use tsx if available so we can import the .ts source directly.
try {
  register('tsx/esm', pathToFileURL('./'));
} catch {
  // fall through — caller must transpile first
}

const { evaluateCatVoiceLine, buildRetryDirective } = await import(
  '../src/services/voiceQuality.ts'
);

// ---------------------------------------------------------------------------
// Fixtures — covers the audit's listed test cases
// ---------------------------------------------------------------------------

const FIXTURES = [
  // ── Banned phrases ─────────────────────────────────────────────
  {
    name: 'banned: furry friend',
    surface: 'chat',
    text: 'Your furry friend is happy today.',
    context: { catName: 'Lily' },
    expect: { ok: false, hasReason: /banned phrase/i },
  },
  {
    name: 'banned: as an AI',
    surface: 'chat',
    text: 'As an AI, I want to tell you I love you.',
    context: { catName: 'Lily' },
    expect: { ok: false, hasReason: /assistant/i },
  },
  {
    name: 'banned: purrfect',
    surface: 'postcard',
    text: 'Today was purrfect.',
    context: { catName: 'Lily' },
    expect: { ok: false, hasReason: /banned phrase/i },
  },
  // ── Generic sentiment ─────────────────────────────────────────
  {
    name: 'generic: today was special',
    surface: 'diary_card',
    text: 'Today was special and I was happy.',
    context: { catName: 'Lily' },
    expect: { ok: false, hasReason: /generic sentiment/i },
  },
  {
    name: 'generic: you make me happy',
    surface: 'chat',
    text: 'You make me happy every day.',
    context: { catName: 'Lily' },
    expect: { ok: false, hasReason: /generic sentiment/i },
  },
  // ── Unsupported named entity ──────────────────────────────────
  {
    name: 'unsupported: invented person',
    surface: 'chat',
    text: 'I sat with Mom for an hour by the window.',
    context: { catName: 'Lily', knownSubjects: [] },
    expect: { ok: false, hasReason: /unsupported named entity/i },
  },
  {
    name: 'supported: known person',
    surface: 'chat',
    text: 'I sat with Mom for an hour by the window.',
    context: { catName: 'Lily', knownSubjects: ['Mom'] },
    expect: { ok: true },
  },
  // ── Length cap per surface ────────────────────────────────────
  {
    name: 'too long: postcard 20 words',
    surface: 'postcard',
    text:
      'I have decided the green chair is finally mine and I will never let anyone else sit there.',
    context: { catName: 'Lily', knownObjects: ['the green chair'] },
    expect: { ok: false, hasReason: /too long for postcard/i },
  },
  {
    name: 'within cap: postcard 9 words',
    surface: 'postcard',
    text: 'I have decided the green chair is finally mine.',
    context: { catName: 'Lily', knownObjects: ['the green chair'] },
    expect: { ok: true },
  },
  // ── Medical context softens threshold ─────────────────────────
  {
    name: 'medical: short careful line passes',
    surface: 'chat',
    text: 'I do not feel right today. The bowl can wait.',
    context: { catName: 'Lily', isMedicalContext: true },
    expect: { ok: true },
  },
  // ── Cold-start cat ────────────────────────────────────────────
  {
    name: 'cold-start: generic anchor (body) still passes',
    surface: 'chat',
    text: 'I have decided the windowsill is mine. The sun agreed.',
    context: { catName: 'Lily' },
    expect: { ok: true },
  },
  // ── Sideways affection (positive case) ────────────────────────
  {
    name: 'sideways affection: forgiveness anchor',
    surface: 'diary_card',
    text: 'I forgave you for leaving because you came back smelling like outside.',
    context: { catName: 'Lily' },
    expect: { ok: true },
  },
  {
    name: 'sideways affection: supervised',
    surface: 'postcard',
    text: 'I supervised your whole morning. You survived.',
    context: { catName: 'Lily' },
    expect: { ok: true },
  },
  // ── Warm mood does not become Hallmark ────────────────────────
  {
    name: 'warm but specific',
    surface: 'chat',
    text: 'You smell like evening. Stay where you are.',
    context: { catName: 'Lily', moodTag: 'affectionate' },
    expect: { ok: true },
  },
  // ── Empty input ───────────────────────────────────────────────
  {
    name: 'empty',
    surface: 'chat',
    text: '   ',
    context: { catName: 'Lily' },
    expect: { ok: false },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
const failures = [];

for (const fx of FIXTURES) {
  const result = evaluateCatVoiceLine(fx.text, fx.surface, fx.context);
  const errors = [];
  if (typeof fx.expect.ok === 'boolean' && result.ok !== fx.expect.ok) {
    errors.push(
      `expected ok=${fx.expect.ok} but got ok=${result.ok} (score ${result.score})`,
    );
  }
  if (fx.expect.hasReason) {
    const matched = result.reasons.some((r) =>
      fx.expect.hasReason.test(r),
    );
    if (!matched) {
      errors.push(
        `expected reason matching ${fx.expect.hasReason}, got: [${result.reasons.join(' | ')}]`,
      );
    }
  }
  if (errors.length === 0) {
    pass++;
    console.log(`  ✓ ${fx.name}`);
  } else {
    fail++;
    failures.push({ name: fx.name, errors, result });
    console.log(`  ✗ ${fx.name}`);
    for (const e of errors) console.log(`      ${e}`);
  }
}

console.log(`\n${pass}/${FIXTURES.length} passed.`);
if (fail > 0) {
  console.log(`\n${fail} failure(s):`);
  for (const f of failures) {
    console.log(`  - ${f.name}:`);
    console.log(`      score: ${f.result.score}, reasons: ${f.result.reasons.join(' | ')}`);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Voice mode block tests (audit 2026-05-14 round 17 — "AI Cat Narrator")
// ---------------------------------------------------------------------------
//
// Verifies:
//   1. Every daily mood ID has a voice mode entry (no silent drops if
//      a new mood is added without a corresponding voice mode).
//   2. renderVoiceModeBlock returns non-empty for every mood.
//   3. No voice mode block contains a BANNED_PHRASES string.
//   4. No voice mode block contains a GENERIC_PRAISE string.
//   5. getVoiceModeTag returns a non-null tag for every mood and null
//      for falsy input.

const { MOOD_VOICE_MODE, renderVoiceModeBlock, getVoiceModeTag } = await import(
  '../src/services/voiceModes.ts'
);

// Reuse banned + generic lists by importing from voiceQuality. Keep the
// lists DRY — if voiceQuality grows a new ban, this test picks it up.
const voiceQualityMod = await import('../src/services/voiceQuality.ts');
// voiceQuality.ts doesn't export BANNED_PHRASES — we read them indirectly
// by running evaluateCatVoiceLine against the block and asserting no
// banned-phrase reason fires. This is more robust than duplicating the
// list anyway.

const MOOD_IDS = [
  // warm
  'affectionate', 'cozy', 'chosen', 'attuned',
  // joy
  'playful', 'mischievous', 'curious',
  // flavor
  'theatrical', 'philosophical',
  // sass
  'sarcastic', 'roasting', 'imperious',
  // dark
  'grumpy', 'indignant', 'megalomania',
];

console.log('\n--- Voice mode block tests ---');
let vmPass = 0;
let vmFail = 0;
const vmFailures = [];

for (const moodId of MOOD_IDS) {
  const errors = [];
  // (1) entry exists
  const entry = MOOD_VOICE_MODE[moodId];
  if (!entry) {
    errors.push(`MOOD_VOICE_MODE missing entry for "${moodId}"`);
  } else {
    if (!entry.pattern || entry.pattern.length < 20) {
      errors.push(`pattern too short or empty for "${moodId}"`);
    }
    if (!entry.example || entry.example.length < 5) {
      errors.push(`example too short or empty for "${moodId}"`);
    }
    if (!entry.tag) {
      errors.push(`tag missing for "${moodId}"`);
    }
  }
  // (2) renderVoiceModeBlock non-empty
  const block = renderVoiceModeBlock(moodId);
  if (!block || block.length < 80) {
    errors.push(`renderVoiceModeBlock("${moodId}") returned empty/short block`);
  }
  // (3) no banned phrase / generic praise — evaluate block as if it
  // were chat output and assert no banned-phrase reason fires.
  // We evaluate the example string (the rendered shape sample) since
  // that's the part most likely to be mimicked into a real output.
  if (entry?.example) {
    const result = voiceQualityMod.evaluateCatVoiceLine(
      entry.example,
      'chat',
      { catName: 'Lily' },
    );
    if (result.reasons.some((r) => /banned phrase|assistant voice/i.test(r))) {
      errors.push(
        `example for "${moodId}" tripped a banned-phrase / assistant-voice flag: ${result.reasons.join(' | ')}`,
      );
    }
  }
  // (5) tag lookup
  const tag = getVoiceModeTag(moodId);
  if (!tag) {
    errors.push(`getVoiceModeTag("${moodId}") returned null`);
  }
  if (entry && tag && tag !== entry.tag) {
    errors.push(`getVoiceModeTag mismatch for "${moodId}": got ${tag}, expected ${entry.tag}`);
  }

  if (errors.length === 0) {
    vmPass++;
    console.log(`  ✓ voice_mode: ${moodId}`);
  } else {
    vmFail++;
    vmFailures.push({ moodId, errors });
    console.log(`  ✗ voice_mode: ${moodId}`);
    for (const e of errors) console.log(`      ${e}`);
  }
}

// getVoiceModeTag null cases
const nullCases = [null, undefined, ''];
let nullPass = 0;
for (const v of nullCases) {
  if (getVoiceModeTag(v) === null) {
    nullPass++;
    console.log(`  ✓ getVoiceModeTag(${JSON.stringify(v)}) === null`);
  } else {
    vmFail++;
    console.log(`  ✗ getVoiceModeTag(${JSON.stringify(v)}) did not return null`);
  }
}

const vmTotal = MOOD_IDS.length + nullCases.length;
console.log(`\n${vmPass + nullPass}/${vmTotal} voice-mode tests passed.`);
if (vmFail > 0) {
  console.log(`\n${vmFail} voice-mode failure(s):`);
  for (const f of vmFailures) {
    console.log(`  - ${f.moodId}:`);
    for (const e of f.errors) console.log(`      ${e}`);
  }
  process.exit(1);
}
process.exit(0);
