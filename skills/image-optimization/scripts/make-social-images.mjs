#!/usr/bin/env node
/**
 * make-social-images.mjs - create social share images in the right size for each platform
 * from one source image, compress them under a size budget, and print the meta tags.
 * Part of the image-optimization skill.
 *
 * Needs sharp in the project where you run it:   npm i -D sharp
 *
 * Usage:
 *   node make-social-images.mjs <source-image> [options]
 *
 * Options:
 *   --out=<dir>           output folder (default: public/social)
 *   --name=<base>         file name prefix (default: name of the source file)
 *   --presets=<list>      comma list (default: og,twitter). Available:
 *                           og         1200x630   Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, iMessage
 *                           twitter    1200x600   X summary_large_image (2:1), optional
 *                           square     800x800    X summary card, square thumbnails
 *                           pinterest  1000x1500  Pinterest (2:3)
 *                           google     1200x675 (16:9), 1200x900 (4:3), 1200x1200 (1:1) for structured data
 *   --fit=cover|contain   cover crops to fill (default); contain letterboxes (good for logos)
 *   --position=<p>        crop focus for cover: attention (default), entropy, center, top, bottom, left, right
 *   --background=<color>  background for contain and transparent images (default #ffffff)
 *   --padding=<percent>   contain only: empty margin around the image, % of the short side (default 12)
 *   --format=jpg|png|webp output format (default jpg; jpg/png work on every platform)
 *   --max-kb=<n>          size budget per file in KB (default 300, WhatsApp-safe)
 *   --alt="<text>"        description of the image for og:image:alt / twitter:image:alt (required by the alt policy)
 *   --base-url=<url>      site URL for the printed tags (default https://example.com)
 *   --url-path=<path>     public URL path of the output folder (default /social)
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const src = argv.find((a) => !a.startsWith('--'));
if (!src || argv.includes('--help')) {
  const me = readFileSync(new URL(import.meta.url), 'utf8');
  console.log(me.split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''));
  process.exit(src ? 0 : 1);
}

// load sharp from the current project first, then next to this script
let sharp;
try { sharp = createRequire(join(process.cwd(), 'noop.js'))('sharp'); } catch {
  try { sharp = (await import('sharp')).default; } catch {
    console.error('This script needs sharp. Install it in your project:  npm i -D sharp   (then run the script from the project folder)');
    process.exit(1);
  }
}

const PRESETS = {
  og: [{ id: 'og', w: 1200, h: 630, use: 'og:image (Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, iMessage)' }],
  twitter: [{ id: 'twitter', w: 1200, h: 600, use: 'twitter:image (X summary_large_image, 2:1)' }],
  square: [{ id: 'square', w: 800, h: 800, use: 'twitter:image for twitter:card=summary, square thumbnails' }],
  pinterest: [{ id: 'pinterest', w: 1000, h: 1500, use: 'Pinterest (2:3): data-pin-media on an <img>' }],
  google: [
    { id: 'google-16x9', w: 1200, h: 675, use: 'structured data image (16:9)' },
    { id: 'google-4x3', w: 1200, h: 900, use: 'structured data image (4:3)' },
    { id: 'google-1x1', w: 1200, h: 1200, use: 'structured data image (1:1)' },
  ],
};
const outDir = resolve(opt('out', 'public/social'));
const base = opt('name', basename(src, extname(src)));
const presetIds = opt('presets', 'og,twitter').split(',').map((s) => s.trim()).filter(Boolean);
const fit = opt('fit', 'cover');
const position = opt('position', 'attention');
const background = opt('background', '#ffffff');
const padding = Math.max(0, Math.min(40, Number(opt('padding', 12))));
const format = opt('format', 'jpg').replace('jpeg', 'jpg');
const maxBytes = Number(opt('max-kb', 300)) * 1024;
const baseUrl = opt('base-url', 'https://example.com').replace(/\/$/, '');
const altText = (opt('alt', '') || '').trim();
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const altValue = altText ? escAttr(altText) : 'REQUIRED: describe the image';
const urlPath = '/' + opt('url-path', '/social').replace(/^\/|\/$/g, '');

const unknown = presetIds.filter((p) => !PRESETS[p]);
if (unknown.length) { console.error(`Unknown preset(s): ${unknown.join(', ')}. Use: ${Object.keys(PRESETS).join(', ')}`); process.exit(1); }
if (!['cover', 'contain'].includes(fit)) { console.error('--fit must be cover or contain'); process.exit(1); }
if (!['jpg', 'png', 'webp'].includes(format)) { console.error('--format must be jpg, png or webp'); process.exit(1); }

const positionValue = position === 'attention' ? sharp.strategy.attention : position === 'entropy' ? sharp.strategy.entropy : position;
const meta = await sharp(src).metadata();
const srcW = meta.autoOrient?.width ?? meta.width;
const srcH = meta.autoOrient?.height ?? meta.height;
mkdirSync(outDir, { recursive: true });

async function encode(pipeline, q) {
  const p = pipeline.clone();
  if (format === 'jpg') return p.flatten({ background }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: q >= 90 ? '4:4:4' : '4:2:0' }).toBuffer();
  if (format === 'webp') return p.webp({ quality: q }).toBuffer();
  return p.png({ compressionLevel: 9, palette: q < 90, quality: q }).toBuffer();
}

const results = [];
for (const id of presetIds) {
  for (const preset of PRESETS[id]) {
    let pipeline;
    if (fit === 'cover') {
      pipeline = sharp(src).rotate().resize({ width: preset.w, height: preset.h, fit: 'cover', position: positionValue }).toColourspace('srgb');
    } else {
      // contain: fit inside a padded box, then extend to the full size with the background colour
      const pad = Math.round(Math.min(preset.w, preset.h) * (padding / 100));
      pipeline = sharp(src).rotate()
        .resize({ width: preset.w - 2 * pad, height: preset.h - 2 * pad, fit: 'contain', background })
        .extend({ top: pad, bottom: pad, left: pad, right: pad, background })
        .toColourspace('srgb');
    }
    let q = 85;
    let buf = await encode(pipeline, q);
    while (buf.length > maxBytes && q > 45) { q -= 5; buf = await encode(pipeline, q); }
    const file = join(outDir, `${base}-${preset.id}-${preset.w}x${preset.h}.${format}`);
    writeFileSync(file, buf);
    results.push({ ...preset, file, bytes: buf.length, quality: q, overBudget: buf.length > maxBytes });
  }
}

console.log(`Source: ${src} (${srcW}x${srcH})`);
if (fit === 'cover' && (srcW < 1200 || srcH < 630)) console.log('warning: the source is smaller than 1200x630, so it was upscaled and may look soft. Use a larger source.');
if (fit === 'contain' && srcW < 600) console.log('warning: the source is narrow; it was enlarged and may look soft. Use an SVG or a larger PNG of the logo.');
for (const r of results) {
  console.log(`  ${basename(r.file).padEnd(44)} ${String(Math.round(r.bytes / 1024)).padStart(4)} KB  q${r.quality}${r.overBudget ? '  (over budget: simplify the image or use --format=jpg)' : ''}   ${r.use}`);
}
if (fit === 'cover') console.log(`\nCrops use "${position}" focus. Check that text and logos are not cut off; for logos or text-heavy images use --fit=contain.`);

const og = results.find((r) => r.id === 'og');
const tw = results.find((r) => r.id === 'twitter') || results.find((r) => r.id === 'square');
const urlOf = (r) => `${baseUrl}${urlPath}/${basename(r.file)}`;
const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
if (og || tw) {
  console.log(altText ? '\n<!-- Paste into <head>. -->' : '\n<!-- Paste into <head>. The alt text is REQUIRED: replace it, or run again with --alt="..." -->');
  if (og) {
    console.log(`<meta property="og:image" content="${urlOf(og)}">`);
    console.log(`<meta property="og:image:type" content="${mime}">`);
    console.log(`<meta property="og:image:width" content="${og.w}">`);
    console.log(`<meta property="og:image:height" content="${og.h}">`);
    console.log(`<meta property="og:image:alt" content="${altValue}">`);
  }
  console.log(`<meta name="twitter:card" content="${tw && tw.id === 'square' ? 'summary' : 'summary_large_image'}">`);
  if (tw) console.log(`<meta name="twitter:image" content="${urlOf(tw)}">`);
  if (tw || og) console.log(`<meta name="twitter:image:alt" content="${altValue}">`);
}
const pin = results.find((r) => r.id === 'pinterest');
if (pin) console.log(`\n<!-- Pinterest: on the page image --> data-pin-media="${urlOf(pin)}" (the <img> still needs its own filled alt)`);
if (!altText) console.log('\nwarning: no --alt given. Every image must have a filled alt; write one that describes this image.');
