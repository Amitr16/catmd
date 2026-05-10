/**
 * Slug-named hero-image converter for new library articles.
 *
 * Usage: drop PNGs into proxy/public/library/ named as the article slug
 * (e.g., what-is-my-cat-thinking-ai-apps.png). Then run:
 *
 *   cd proxy
 *   node scripts/convert-new-library-images.mjs
 *
 * The script:
 *   - Finds every PNG in public/library/ whose filename (minus .png)
 *     matches a slug NOT already covered by an existing .webp
 *   - Resizes to 1200×630 (cover, center)
 *   - Encodes as WebP quality 82 (matches the existing batch — keeps LCP
 *     and bandwidth budget consistent)
 *   - Writes {slug}.webp alongside, overwriting if it exists
 *   - Optionally deletes the source PNG (toggle DELETE_SOURCE below)
 *
 * Why a separate script: the original convert-library-images.mjs
 * hard-codes a SLUG_BY_INDEX map for the first 12 articles
 * (image1.png ... image12.png). For new articles, slug-named PNGs are
 * cleaner — no central map to update each time you add an article.
 *
 * After running this, deploy with:
 *   npx wrangler deploy
 */
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = join(__dirname, '..', 'public', 'library');

// Set to true to remove the source PNG after successful conversion.
// Default false — keep the original as a backup until you're sure
// the deployed page renders the way you want.
const DELETE_SOURCE = false;

const files = readdirSync(LIBRARY_DIR).filter((f) => f.toLowerCase().endsWith('.png'));

// Skip the legacy image{N}.png pattern handled by the older script.
const LEGACY_RE = /^image\s*\d+\.png$/i;
const slugFiles = files.filter((f) => !LEGACY_RE.test(f));

if (slugFiles.length === 0) {
  console.log('No slug-named PNGs found in public/library/. Nothing to do.');
  console.log(`(Tip: drop a PNG named e.g. my-new-article-slug.png and re-run.)`);
  process.exit(0);
}

console.log(`Found ${slugFiles.length} slug-named PNG(s) to convert:`);
slugFiles.forEach((f) => console.log(`  - ${f}`));
console.log('');

let totalBefore = 0;
let totalAfter = 0;

for (const file of slugFiles) {
  const slug = file.replace(/\.png$/i, '');
  const inPath = join(LIBRARY_DIR, file);
  const outPath = join(LIBRARY_DIR, `${slug}.webp`);
  const beforeBytes = statSync(inPath).size;
  totalBefore += beforeBytes;

  await sharp(inPath)
    .resize(1200, 630, { fit: 'cover', position: 'center' })
    .webp({ quality: 82, effort: 6 })
    .toFile(outPath);

  const afterBytes = statSync(outPath).size;
  totalAfter += afterBytes;

  const beforeKB = (beforeBytes / 1024).toFixed(0);
  const afterKB = (afterBytes / 1024).toFixed(0);
  const pct = ((1 - afterBytes / beforeBytes) * 100).toFixed(1);
  console.log(
    `  ${file.padEnd(50)} -> ${slug}.webp  ${beforeKB.padStart(5)}KB -> ${afterKB.padStart(4)}KB (-${pct}%)`,
  );

  if (DELETE_SOURCE && existsSync(outPath)) {
    unlinkSync(inPath);
  }
}

const totalBeforeMB = (totalBefore / 1024 / 1024).toFixed(2);
const totalAfterMB = (totalAfter / 1024 / 1024).toFixed(2);
const totalPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(
  `\nTotal: ${totalBeforeMB}MB -> ${totalAfterMB}MB (-${totalPct}%)`,
);
console.log('');
console.log('Next: cd proxy && npx wrangler deploy');
