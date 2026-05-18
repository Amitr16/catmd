#!/usr/bin/env node
// One-off fixer: replaces unescaped ' and " in JSX text nodes with
// HTML entities so eslint's react/no-unescaped-entities passes.
// Driven by the ESLint diagnostic output — each (line, col) pair
// points at the exact offending character.
const fs = require('fs');
const { ESLint } = require('eslint');

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles([
    'app/**/*.tsx',
    'src/**/*.ts',
    'src/**/*.tsx',
  ]);

  // Group violations by file.
  const byFile = new Map();
  for (const r of results) {
    for (const m of r.messages) {
      if (m.ruleId !== 'react/no-unescaped-entities') continue;
      if (!byFile.has(r.filePath)) byFile.set(r.filePath, []);
      byFile.get(r.filePath).push({ line: m.line, column: m.column });
    }
  }

  let totalFixed = 0;
  for (const [filePath, locs] of byFile) {
    const src = fs.readFileSync(filePath, 'utf8');
    const lines = src.split('\n');

    // Sort descending by (line, column) so later fixes don't shift
    // earlier columns within the same line.
    locs.sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    for (const { line, column } of locs) {
      const idx = line - 1;
      if (idx < 0 || idx >= lines.length) continue;
      const text = lines[idx];
      const colIdx = column - 1;
      if (colIdx < 0 || colIdx >= text.length) continue;
      const ch = text[colIdx];
      let replacement;
      if (ch === "'") replacement = '&apos;';
      else if (ch === '"') replacement = '&quot;';
      else {
        console.warn(
          `[skip] ${filePath}:${line}:${column} — char "${ch}" is neither ' nor "`,
        );
        continue;
      }
      lines[idx] = text.slice(0, colIdx) + replacement + text.slice(colIdx + 1);
      totalFixed++;
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`fixed ${locs.length} in ${filePath}`);
  }

  console.log(`---\nTotal fixed: ${totalFixed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
