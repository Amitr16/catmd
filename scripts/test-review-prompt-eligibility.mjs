#!/usr/bin/env node
// Fixture tests for services/reviewPrompt.isEligibleForReviewPrompt.
//
// The earned-prompt rule (2026-05-19 spec) lives as a pure function —
// these fixtures lock the rule with cases that document each gate.
//
// Usage:
//   node scripts/test-review-prompt-eligibility.mjs
//
// Exits 0 on all-pass, 1 on any failure.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

try {
  register('tsx/esm', pathToFileURL('./'));
} catch {
  // fall through
}

const { isEligibleForReviewPrompt } = await import(
  '../src/services/reviewPromptEligibility.ts'
);

const NOW = Date.parse('2026-05-19T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const INSTALL_3_DAYS_AGO = NOW - 3 * DAY;
const INSTALL_1_DAY_AGO = NOW - 1 * DAY;

function base(overrides) {
  return {
    firstSeenTs: INSTALL_3_DAYS_AGO,
    meaningfulSessionCount: 3,
    usefulInsightCount: 1,
    lastDismissedTs: null,
    lastShownTs: null,
    clickedReview: false,
    inHealthConcernFlow: false,
    now: NOW,
    ...overrides,
  };
}

const FIXTURES = [
  {
    name: 'baseline: all bars met → eligible',
    input: base({}),
    expect: true,
  },
  {
    name: 'gate: clickedReview=true → never re-prompt',
    input: base({ clickedReview: true }),
    expect: false,
  },
  {
    name: 'gate: in health-concern flow → suppressed',
    input: base({ inHealthConcernFlow: true }),
    expect: false,
  },
  {
    name: 'gate: install < 2 days old → too early',
    input: base({ firstSeenTs: INSTALL_1_DAY_AGO }),
    expect: false,
  },
  {
    name: 'gate: meaningful sessions = 2 → not enough',
    input: base({ meaningfulSessionCount: 2 }),
    expect: false,
  },
  {
    name: 'gate: useful insights = 0 → no value moment yet',
    input: base({ usefulInsightCount: 0 }),
    expect: false,
  },
  {
    name: 'gate: dismissed 10 days ago → still in cooldown (30d)',
    input: base({ lastDismissedTs: NOW - 10 * DAY }),
    expect: false,
  },
  {
    name: 'gate: dismissed 31 days ago → cooldown expired, eligible',
    input: base({ lastDismissedTs: NOW - 31 * DAY }),
    expect: true,
  },
  {
    name: 'gate: shown 12h ago → same-day re-show suppressed',
    input: base({ lastShownTs: NOW - 12 * 60 * 60 * 1000 }),
    expect: false,
  },
  {
    name: 'gate: shown 25h ago → ok to retry',
    input: base({ lastShownTs: NOW - 25 * 60 * 60 * 1000 }),
    expect: true,
  },
  {
    name: 'gate: firstSeenTs null → not installed yet (defensive)',
    input: base({ firstSeenTs: null }),
    expect: false,
  },
  {
    name: 'gate: way over the bar (10 sessions, 5 insights, 30d old) → eligible',
    input: base({
      firstSeenTs: NOW - 30 * DAY,
      meaningfulSessionCount: 10,
      usefulInsightCount: 5,
    }),
    expect: true,
  },
];

console.log('\n=== review-prompt eligibility fixtures ===');
let pass = 0;
let fail = 0;
const failures = [];
for (const fx of FIXTURES) {
  const got = isEligibleForReviewPrompt(fx.input);
  if (got === fx.expect) {
    pass++;
    console.log(`  ✓ ${fx.name}`);
  } else {
    fail++;
    failures.push({ name: fx.name, expected: fx.expect, got });
    console.log(`  ✗ ${fx.name}  (expected ${fx.expect}, got ${got})`);
  }
}
console.log(`\n${pass}/${FIXTURES.length} eligibility fixtures passed.`);
if (fail > 0) process.exit(1);
process.exit(0);
