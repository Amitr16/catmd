#!/usr/bin/env node
// One-off helper: list each react/no-unescaped-entities violation with
// its file path + line number, so we can fix them with surgical edits.
const { ESLint } = require('eslint');

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles([
    'app/**/*.tsx',
    'src/**/*.ts',
    'src/**/*.tsx',
  ]);
  const rows = [];
  for (const r of results) {
    for (const m of r.messages) {
      if (m.ruleId === 'react/no-unescaped-entities') {
        rows.push(`${r.filePath}:${m.line}:${m.column}`);
      }
    }
  }
  console.log(rows.join('\n'));
  console.log(`---\nTotal: ${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
