#!/usr/bin/env node
/**
 * Slug-named hero-image converter for blog posts.
 *
 * Usage: drop PNGs into proxy/public/blog/ named as the post slug
 * (e.g., does-your-cat-hate-you.png). Then run:
 *
 *   cd proxy
 *   node scripts/convert-new-blog-images.mjs
 *
 * Mirror of convert-new-library-images.mjs, just pointed at the blog
 * folder instead. Same 1200×630 WebP quality-82 output for parity.
 *
 * After running, deploy with:
 *   npx wrangler deploy
 */
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'public', 'blog');

const DELETE_SOURCE = false;

const files = readdirSync(BLOG_DIR).filter((f) => f.toLowerCase().endsWith('.png'));

if (files.length === 0) {
  console.log('No PNGs found in public/blog/. Nothing to do.');
  console.log(`(Tip: drop a PNG named e.g. my-new-post-slug.png and re-run.)`);
  process.exit(0);
}

console.log(`Found ${files.length} PNG(s) to convert:`);
files.forEach((f) => console.log(`  - ${f}`));
console.log('');

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const slug = file.replace(/\.png$/i, '');
  const inPath = join(BLOG_DIR, file);
  const outPath = join(BLOG_DIR, `${slug}.webp`);
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
    `  ${file.padEnd(54)} -> ${slug}.webp  ${beforeKB.padStart(5)}KB -> ${afterKB.padStart(4)}KB (-${pct}%)`,
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
