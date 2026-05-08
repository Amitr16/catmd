/**
 * One-shot script: convert raw PNG hero images (image1.png .. image12.png)
 * to optimized WebP files named after their article slug.
 *
 * Why: Sora exports PNGs at 2-2.5MB each, which murders LCP scores on
 * mobile and bleeds Cloudflare bandwidth. Converting to WebP at quality
 * 82 with proper 1200x630 sizing reduces each to ~150-300KB while staying
 * visually indistinguishable.
 *
 * Run once: `node scripts/convert-library-images.mjs`
 * Then commit the .webp outputs and delete the .png originals (or keep as backup).
 */
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = join(__dirname, '..', 'public', 'library');

// image1 .. image12 → article slug (in the order Claude drafted the prompts).
const SLUG_BY_INDEX = {
  1: 'cat-vomiting-when-to-see-vet',
  2: 'cat-not-eating',
  3: 'cat-straining-to-urinate',
  4: 'cat-hiding-illness',
  5: 'cat-losing-weight',
  6: 'cat-lethargy',
  7: 'cat-eye-discharge',
  8: 'cat-gum-color',
  9: 'cat-breathing-fast-sleeping',
  10: 'cat-litter-box-changes',
  11: 'cat-ate-lily-emergency',
  12: 'cat-sneezing',
};

// Match image1.png, image01.png, "image 1.png", "image 10.png", etc.
const RE = /^image\s*(\d+)\.png$/i;

const files = readdirSync(LIBRARY_DIR).filter((f) => RE.test(f));
console.log(`Found ${files.length} PNG files to convert.`);

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const m = file.match(RE);
  const idx = Number(m[1]);
  const slug = SLUG_BY_INDEX[idx];
  if (!slug) {
    console.warn(`  skip ${file} — no slug mapping for index ${idx}`);
    continue;
  }
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
    `  ${file.padEnd(15)} -> ${slug.padEnd(34)} ${beforeKB.padStart(5)}KB -> ${afterKB.padStart(4)}KB (-${pct}%)`,
  );
}

const totalBeforeMB = (totalBefore / 1024 / 1024).toFixed(2);
const totalAfterMB = (totalAfter / 1024 / 1024).toFixed(2);
const totalPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(
  `\nTotal: ${totalBeforeMB}MB -> ${totalAfterMB}MB (-${totalPct}%)`,
);
