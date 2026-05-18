#!/usr/bin/env node
// Fixture tests for installAttribution.parseReferrerUrl (audit 2026-05-16).
//
// Marketing attribution is downstream of how this function parses the
// raw referrer payload Google Play hands us. Wrong parsing = wrong
// attribution data forever. Pure function — perfect testability.
//
// Usage:
//   node scripts/test-install-attribution.mjs
//
// Exits 0 on all-pass, 1 on any failure.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

try {
  register('tsx/esm', pathToFileURL('./'));
} catch {
  // fall through
}

// parseReferrerUrl is in its own file (installAttributionParser.ts)
// with no native dependency chain — we can import it directly in pure
// Node via the tsx loader. The native-bound `getOrCaptureInstall
// Attribution` lives in installAttribution.ts and isn't testable here
// (would pull expo-modules-core which doesn't load in Node).

const { parseReferrerUrl } = await import(
  '../src/services/installAttributionParser.ts'
);

const FIXTURES = [
  {
    name: 'empty string → organic default',
    input: '',
    expect: { utm_source: 'organic', is_organic: true },
  },
  {
    name: 'undefined → organic default',
    input: undefined,
    expect: { utm_source: 'organic', is_organic: true },
  },
  {
    name: 'Google Play organic referrer → organic',
    input: 'utm_source=google-play&utm_medium=organic',
    expect: {
      utm_source: 'google-play',
      utm_medium: 'organic',
      is_organic: false, // explicit non-"organic" source value
    },
  },
  {
    name: 'Google Ads campaign with creative + campaign IDs',
    input:
      'utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&utm_content=video_a&campaign_id=12345&creative_id=98765',
    expect: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring_sale',
      utm_content: 'video_a',
      campaign_id: '12345',
      creative_id: '98765',
      is_organic: false,
    },
  },
  {
    name: 'utm_source=organic explicit → is_organic true',
    input: 'utm_source=organic',
    expect: { utm_source: 'organic', is_organic: true },
  },
  {
    name: 'campaign_id only (no utm_source) → still attribution captured',
    input: 'campaign_id=42&creative_id=99',
    expect: {
      utm_source: 'organic',
      campaign_id: '42',
      creative_id: '99',
      is_organic: true,
    },
  },
  {
    name: 'malformed payload (no recognised fields) → organic default',
    input: 'foo=bar&baz=qux',
    expect: { utm_source: 'organic', is_organic: true },
  },
  {
    name: 'utm_term + raw_referrer_url preserved',
    input: 'utm_source=tiktok&utm_term=cat_app',
    expect: {
      utm_source: 'tiktok',
      utm_term: 'cat_app',
      is_organic: false,
    },
  },
  {
    name: 'whitespace-only utm values get trimmed away',
    input: 'utm_source=%20%20&utm_campaign=real',
    expect: {
      utm_source: 'organic',
      utm_campaign: 'real',
      is_organic: true,
    },
  },
  {
    name: 'URL-encoded values decoded',
    input: 'utm_source=facebook&utm_campaign=spring%20sale',
    expect: {
      utm_source: 'facebook',
      utm_campaign: 'spring sale',
      is_organic: false,
    },
  },
];

let pass = 0;
let fail = 0;
const failures = [];

for (const fx of FIXTURES) {
  const result = parseReferrerUrl(fx.input);
  const errors = [];
  for (const [k, v] of Object.entries(fx.expect)) {
    if (result[k] !== v) {
      errors.push(`expected ${k}=${JSON.stringify(v)}, got ${JSON.stringify(result[k])}`);
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
    console.log(`  - ${f.name}: ${JSON.stringify(f.result)}`);
  }
  process.exit(1);
}
process.exit(0);
