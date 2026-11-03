#!/usr/bin/env node
/**
 * image-size.mjs - read the intrinsic size of image files. Part of the image-optimization skill.
 * Use it to write correct width/height attributes (and og:image:width/height) instead of guessing.
 *
 * Usage:
 *   node image-size.mjs <file-or-folder> [...] [--json]
 *
 * Formats: JPEG (with EXIF orientation), PNG, GIF, WebP, AVIF/HEIC (with irot), SVG, BMP.
 * Node 18+, no dependencies. Reads only the file header.
 */
import { openSync, readSync, closeSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative, basename } from 'node:path';
import { sizeFromBuffer, ratioLabel } from './lib/image-header.mjs';

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const targets = argv.filter((a) => !a.startsWith('--'));
if (targets.length === 0 || argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: node image-size.mjs <file-or-folder> [...] [--json]');
  process.exit(targets.length === 0 ? 1 : 0);
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.avif', '.heic', '.heif', '.svg', '.bmp']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.nuxt', '.output', '.svelte-kit', '.astro', 'coverage']);

function readHead(file, max = 4 * 1024 * 1024) {
  const size = statSync(file).size;
  const len = Math.min(size, max);
  const buf = Buffer.alloc(len);
  const fd = openSync(file, 'r');
  try { readSync(fd, buf, 0, len, 0); } finally { closeSync(fd); }
  return buf;
}

function sizeOf(file) {
  const r = sizeFromBuffer(readHead(file), extname(file).toLowerCase());
  return r ? { file, ...r } : { file, error: 'unknown or unsupported format' };
}

const files = [];
function walk(p, depth = 0) {
  let st;
  try { st = statSync(p); } catch { console.error(`Not found: ${p}`); return; }
  if (st.isDirectory()) {
    if (depth > 0 && SKIP_DIRS.has(basename(p))) return;
    for (const n of readdirSync(p)) walk(join(p, n), depth + 1);
  } else if (st.isFile() && (depth === 0 || IMAGE_EXTS.has(extname(p).toLowerCase()))) files.push(p);
}
targets.forEach((t) => walk(t));

const results = files.map((f) => { try { return sizeOf(f); } catch (e) { return { file: f, error: e.message }; } });
const cwd = process.cwd();
results.forEach((r) => { r.file = relative(cwd, r.file) || r.file; });

if (JSON_OUT) {
  console.log(JSON.stringify(results.map((r) => ({ ...r, ratio: r.width ? ratioLabel(r.width, r.height) : undefined })), null, 2));
} else {
  for (const r of results) {
    if (r.error) { console.log(`${r.file}\n  error: ${r.error}`); continue; }
    if (!r.width) { console.log(`${r.file}\n  ${r.format}: ${r.note}`); continue; }
    console.log(`${r.file}`);
    console.log(`  ${r.format}  ${r.width} x ${r.height}  ratio ${ratioLabel(r.width, r.height)}   ->  width="${r.width}" height="${r.height}"`);
    if (r.swapped) console.log(`  note: stored as ${r.storedWidth} x ${r.storedHeight} and rotated when displayed (EXIF/irot). Re-export with the rotation applied if you can.`);
    if (r.note) console.log(`  note: ${r.note}`);
  }
  if (results.length === 0) console.log('No image files found.');
}
