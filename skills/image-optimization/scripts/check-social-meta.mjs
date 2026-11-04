#!/usr/bin/env node
/**
 * check-social-meta.mjs - check Open Graph / Twitter (X) card tags and the share image.
 * Part of the image-optimization skill.
 *
 * Usage:
 *   node check-social-meta.mjs <url-or-html-file> [...] [options]
 *
 * Options:
 *   --ua=<name|string>  crawler User-Agent: facebook (default), twitter, linkedin, slack, discord,
 *                       whatsapp, telegram, pinterest, browser, or any custom string
 *   --public=<dir>      local files: folder that "/" in image URLs maps to (e.g. public, dist, static)
 *   --json              print JSON
 *   --no-fail           exit 0 even if errors are found (default: exit 1 on errors)
 *
 * What it does:
 *   - reads the HTML the way a crawler does (crawlers do not run JavaScript)
 *   - checks og:*, twitter:* and related tags
 *   - downloads og:image / twitter:image and checks status, type, file size, real dimensions and ratio
 *   - estimates how the preview looks on Facebook, LinkedIn, X, WhatsApp, Slack/Discord/Telegram
 *
 * Platform limits change. The numbers here are the documented/commonly tested values (2026).
 * Confirm with the platforms' own tools (see references/07-social-share-images.md).
 * Node 18+, no dependencies.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { sizeFromBuffer, ratioLabel } from './lib/image-header.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const targets = argv.filter((a) => !a.startsWith('--'));
if (targets.length === 0 || argv.includes('--help')) {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  console.log(src.split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''));
  process.exit(targets.length === 0 ? 1 : 0);
}
const JSON_OUT = argv.includes('--json');
const NO_FAIL = argv.includes('--no-fail');
const PUBLIC_DIR = opt('public', null);
const UAS = {
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  twitter: 'Twitterbot/1.0',
  linkedin: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; +https://www.linkedin.com)',
  slack: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  whatsapp: 'WhatsApp/2.23.20.0',
  telegram: 'TelegramBot (like TwitterBot)',
  pinterest: 'Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)',
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
const uaOpt = opt('ua', 'facebook');
const UA = UAS[uaOpt] || uaOpt;
const KB = 1024, MB = 1024 * 1024;

// ---------------------------------------------------------------- HTML parsing (head tags only)
function parseAttrs(tag) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  const inner = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
  while ((m = re.exec(inner))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}
function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function parseHtml(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const meta = [];
  for (const m of clean.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content !== undefined) meta.push({ key, content: a.content.trim(), attr: a.property ? 'property' : a.name ? 'name' : 'itemprop' });
  }
  const links = [...clean.matchAll(/<link\b[^>]*>/gi)].map((m) => parseAttrs(m[0]));
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(clean) || [])[1];
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(clean) || [, clean])[1];
  const bodyText = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '').trim();
  const csrShell = bodyText.length < 50 && /<(div|main)\s+id=["'](root|app|__next|__nuxt|svelte)["'][^>]*>\s*<\/\1>|<app-root[^>]*>\s*<\/app-root>/i.test(body);
  return { meta, links, title: title ? decode(title.trim()) : null, csrShell };
}
const first = (meta, key) => meta.find((m) => m.key === key)?.content;
const all = (meta, key) => meta.filter((m) => m.key === key).map((m) => m.content);

// ---------------------------------------------------------------- fetching
async function fetchText(url, ua = UA) {
  const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  return { status: res.status, finalUrl: res.url, redirected: res.redirected, contentType: res.headers.get('content-type') || '', text };
}
async function fetchImage(url, ua = UA) {
  const t0 = Date.now();
  // crawlers do not send image/avif in Accept: an image CDN with "auto format" must answer with JPEG/PNG/WebP
  const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'image/webp,image/png,image/jpeg,image/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, finalUrl: res.url, redirected: res.redirected, contentType: res.headers.get('content-type') || '', bytes: buf.length, ms: Date.now() - t0, buf, cache: res.headers.get('cache-control') || '' };
}

// ---------------------------------------------------------------- checks
function platformVerdicts(img, card) {
  if (!img || !img.width) return null;
  const { width: w, height: h, bytes, format } = img;
  const r = w / h;
  const off = (target) => Math.abs(r - target) / target;
  const fmtOk = ['jpeg', 'png', 'gif', 'webp'].includes(format);
  const v = {};
  // Facebook: min 200x200; large preview from about 600x315; 1.91:1 avoids crop; 8 MB
  v.facebook = !fmtOk || bytes > 8 * MB || w < 200 || h < 200 ? 'no image' :
    w < 600 || h < 315 ? 'small thumbnail' : off(1.91) > 0.05 ? 'large, cropped (not 1.91:1)' : 'large';
  // LinkedIn: 1.91:1, about 1200x627 recommended, 5 MB
  v.linkedin = !fmtOk || bytes > 5 * MB ? 'no image' : w < 400 ? 'small thumbnail' : off(1.91) > 0.05 ? 'large, cropped (not 1.91:1)' : w < 1200 ? 'large (below the recommended 1200px width)' : 'large';
  // X: summary_large_image 2:1, min 300x157, max 4096, 5 MB; summary 1:1, min 144x144
  if (card === 'summary_large_image') {
    v.x = !fmtOk || bytes > 5 * MB || w < 300 || h < 157 ? 'no image' : w > 4096 || h > 4096 ? 'too large (max 4096px)' : off(2) > 0.03 ? 'large card, cropped to 2:1' : 'large card';
  } else if (card === 'summary') {
    v.x = !fmtOk || bytes > 5 * MB || w < 144 || h < 144 ? 'no image' : 'small square card (center crop)';
  } else v.x = 'no twitter:card: X may show no image card';
  // WhatsApp: not documented; images above ~300 KB often do not show
  v.whatsapp = !fmtOk ? 'no image' : bytes > 600 * KB ? 'probably no image (file > 600 KB)' : bytes > 300 * KB ? 'may not show (file > 300 KB)' : w < 300 ? 'small thumbnail' : 'ok';
  // Slack / Discord / Telegram / iMessage: og:image, 1.91:1 works well
  v['slack/discord/telegram'] = !fmtOk || bytes > 5 * MB ? 'no image' : 'ok';
  return v;
}

async function checkTarget(target) {
  const findings = [];
  const add = (severity, rule, message) => findings.push({ severity, rule, message });
  let html, baseUrl = null, localDir = null, page = {};

  if (/^https?:\/\//i.test(target)) {
    try {
      let r = await fetchText(target);
      if (r.status !== 200 && uaOpt !== 'browser') {
        const r2 = await fetchText(target, UAS.browser);
        if (r2.status === 200) {
          add('warn', 'crawler-ua-blocked', `The page returned HTTP ${r.status} to the ${uaOpt} User-Agent from this machine, but 200 to a browser. Many sites block fake crawler User-Agents that do not come from the platform's IP addresses, so the real crawler may be fine. Confirm with the platform's debugger. The checks below use the browser response.`);
          r = r2;
        } else add('error', 'page-status', `The page returned HTTP ${r.status} to the ${uaOpt} crawler User-Agent and ${r2.status} to a browser. Crawlers need a 200 response (check bot protection, auth, geo-blocking).`);
      }
      page = { status: r.status, finalUrl: r.finalUrl, redirected: r.redirected };
      html = r.text;
      baseUrl = r.finalUrl;
      if (r.status === 200 && !/html/i.test(r.contentType)) add('warn', 'page-content-type', `The page Content-Type is "${r.contentType}", not HTML.`);
    } catch (e) {
      add('error', 'page-fetch', `Could not fetch the page: ${e.message}`);
      return { target, findings, tags: {}, images: [] };
    }
  } else {
    const file = resolve(target);
    if (!existsSync(file)) { add('error', 'not-found', `File not found: ${target}`); return { target, findings, tags: {}, images: [] }; }
    html = readFileSync(file, 'utf8');
    localDir = dirname(file);
  }

  const { meta, links, title, csrShell } = parseHtml(html);
  const T = (k) => first(meta, k);
  const tags = {};
  for (const k of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'og:image', 'og:image:secure_url', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt',
    'twitter:card', 'twitter:site', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt', 'description', 'theme-color', 'robots']) {
    if (T(k) !== undefined) tags[k] = T(k);
  }
  const canonical = links.find((l) => (l.rel || '').toLowerCase() === 'canonical')?.href;

  // --- tag checks
  const ogCount = meta.filter((m) => m.key.startsWith('og:')).length;
  if (ogCount === 0 && csrShell) add('error', 'csr-shell', 'No Open Graph tags in the HTML, and the page looks like a client-rendered app shell. Crawlers do not run JavaScript: tags added by react-helmet/useHead/Meta service in the browser are invisible to them. Render the tags on the server (SSR/SSG/prerender).');
  if (!T('og:title')) add('error', 'og-title-missing', `og:title is missing${title ? ' (platforms fall back to <title>, but set og:title)' : ''}.`);
  if (!T('og:description')) add('warn', 'og-description-missing', 'og:description is missing.');
  if (!T('og:url')) add('warn', 'og-url-missing', `og:url is missing (use the canonical URL${canonical ? `: ${canonical}` : ''}).`);
  if (!T('og:type')) add('info', 'og-type-missing', 'og:type is missing (use "website", or "article" for posts).');
  if (!T('og:image')) add('error', 'og-image-missing', 'og:image is missing: most platforms show no image.');
  for (const m of meta) if (m.key.startsWith('og:') && m.attr !== 'property') add('warn', 'og-name-attribute', `<meta name="${m.key}"> should be <meta property="${m.key}"> (Open Graph uses the property attribute).`);
  for (const k of ['og:title', 'og:description', 'og:url', 'twitter:card']) if (all(meta, k).length > 1) add('warn', 'duplicate-tag', `${k} appears ${all(meta, k).length} times (often a theme and an SEO plugin both add tags). Platforms usually use the first one.`);
  if (all(meta, 'og:image').length > 1) add('info', 'multiple-og-images', `${all(meta, 'og:image').length} og:image tags. Most platforms use the first one.`);
  const card = T('twitter:card');
  if (!card) add('warn', 'twitter-card-missing', 'twitter:card is missing. Add <meta name="twitter:card" content="summary_large_image"> for a large image on X (X uses og:* for the rest).');
  else if (!['summary', 'summary_large_image', 'app', 'player'].includes(card)) add('error', 'twitter-card-invalid', `twitter:card="${card}" is not valid (use summary_large_image or summary).`);
  if (T('og:image') && !(T('og:image:width') && T('og:image:height'))) add('warn', 'og-image-dimensions-missing', 'og:image:width / og:image:height are missing. Without them Facebook may show no image on the first share (it has to download the image first).');
  if (T('og:image') && T('og:image:alt') === undefined) add('error', 'og-image-alt-missing', 'og:image:alt is missing. Every image must have a filled alt, including the share image.');
  else if (T('og:image') && !T('og:image:alt').trim()) add('error', 'og-image-alt-empty', 'og:image:alt is empty. Describe the share image.');
  if ((T('twitter:image') || T('og:image')) && card && !(T('twitter:image:alt') || '').trim()) add('warn', 'twitter-image-alt-missing', 'twitter:image:alt is missing or empty (X uses it as the image description; max 420 characters).');
  const tAlt = T('twitter:image:alt');
  if (tAlt && tAlt.length > 420) add('warn', 'twitter-alt-too-long', `twitter:image:alt is ${tAlt.length} characters (max 420).`);
  const robots = (T('robots') || '').toLowerCase();
  if (robots && !/max-image-preview:large/.test(robots) && !/noindex/.test(robots)) add('info', 'max-image-preview', 'robots meta has no max-image-preview:large. Google Discover shows large images only with it.');

  // --- image checks
  const images = [];
  const imageUrls = [...new Set([T('og:image'), T('twitter:image')].filter(Boolean))];
  for (const raw of imageUrls) {
    const role = raw === T('og:image') ? (raw === T('twitter:image') ? 'og:image + twitter:image' : 'og:image') : 'twitter:image';
    const info = { role, url: raw };
    images.push(info);
    const isAbs = /^https?:\/\//i.test(raw);
    if (!isAbs) add('error', 'image-url-relative', `${role} "${raw}" is not an absolute URL. Use https://your-domain/... (crawlers do not resolve relative URLs reliably).`);
    else if (/^http:\/\//i.test(raw)) add('warn', 'image-url-http', `${role} uses http://. Use https:// (some platforms do not load http images).`);
    if (/\.(svg|avif|heic|heif|tiff?)(\?|#|$)/i.test(raw)) add('error', 'image-format-unsupported', `${role} points to ${extname(raw.split(/[?#]/)[0])}. Social platforms do not support SVG/AVIF/HEIC/TIFF previews. Use JPG or PNG.`);
    if (/localhost|127\.0\.0\.1|\.local\b|\.test\b/i.test(raw)) add('error', 'image-url-local', `${role} points to a local address (${raw}). Crawlers cannot reach it. Use the production domain, or a tunnel for testing.`);

    // fetch or read the image
    let img = null;
    try {
      if (isAbs && !localDir) {
        let r = await fetchImage(raw);
        if (r.status !== 200 && uaOpt !== 'browser') {
          const r2 = await fetchImage(raw, UAS.browser);
          if (r2.status === 200) {
            add('warn', 'crawler-ua-blocked-image', `${role} returned HTTP ${r.status} to the ${uaOpt} User-Agent from this machine, but 200 to a browser (fake crawler User-Agents are often blocked; the real crawler may be fine). Checked with the browser response.`);
            r = r2;
          }
        }
        info.status = r.status; info.contentType = r.contentType; info.bytes = r.bytes; info.ms = r.ms; info.redirected = r.redirected;
        if (r.status !== 200) add('error', 'image-status', `${role} returned HTTP ${r.status} to the crawler User-Agent.`);
        if (r.redirected) add('info', 'image-redirect', `${role} redirects to ${r.finalUrl}. Use the final URL directly.`);
        if (r.status === 200 && !/^image\//i.test(r.contentType)) add('error', 'image-content-type', `${role} is served as "${r.contentType}", not an image.`);
        if (r.ms > 3000) add('warn', 'image-slow', `${role} took ${r.ms} ms to download. Crawlers time out on slow images.`);
        if (r.status === 200) img = sizeFromBuffer(r.buf, r.contentType);
      } else {
        // local mode: map the URL to a file
        let p = raw;
        if (isAbs) { try { p = new URL(raw).pathname; } catch {} }
        p = decodeURIComponent(p.split(/[?#]/)[0]);
        const candidates = [];
        if (PUBLIC_DIR) candidates.push(join(resolve(PUBLIC_DIR), p));
        candidates.push(p.startsWith('/') ? join(localDir, p) : resolve(localDir, p));
        for (const dir of ['public', 'static', 'dist', 'build', 'out']) candidates.push(join(localDir, dir, p));
        const file = candidates.find((c) => existsSync(c) && statSync(c).isFile());
        if (!file) add('info', 'image-not-local', `${role}: could not find "${p}" locally (use --public=<dir>, or check the live URL).`);
        else {
          const buf = readFileSync(file);
          info.file = file; info.bytes = buf.length;
          img = sizeFromBuffer(buf, extname(file));
        }
      }
    } catch (e) {
      add('error', 'image-fetch', `${role}: could not download the image: ${e.message}`);
    }
    if (!img) continue;
    Object.assign(info, { format: img.format, width: img.width, height: img.height, ratio: ratioLabel(img.width, img.height) });
    const { width: w, height: h, format } = img;
    const bytes = info.bytes ?? 0;
    if (['svg', 'avif', 'heic', 'heif/avif', 'bmp'].includes(format)) add('error', 'image-format-unsupported', `${role} is ${format.toUpperCase()}. Social platforms need JPG or PNG (WebP works on most, not all).`);
    if (format === 'webp') add('warn', 'image-format-webp', `${role} is WebP. Most platforms accept it, but not every app does. JPG or PNG is the safe choice.`);
    if (format === 'gif') add('info', 'image-format-gif', `${role} is GIF: platforms show only the first frame.`);
    if (bytes > 8 * MB) add('error', 'image-too-big', `${role} is ${(bytes / MB).toFixed(1)} MB. Facebook max 8 MB, X and LinkedIn max 5 MB.`);
    else if (bytes > 5 * MB) add('error', 'image-too-big', `${role} is ${(bytes / MB).toFixed(1)} MB. X and LinkedIn max 5 MB.`);
    else if (bytes > 300 * KB) add('warn', 'image-heavy', `${role} is ${Math.round(bytes / KB)} KB. WhatsApp often shows no preview above ~300 KB. Aim for 100-300 KB (JPG quality 75-85 at 1200x630).`);
    if (w && h) {
      if (w < 200 || h < 200) add('error', 'image-too-small', `${role} is ${w}x${h}. Facebook needs at least 200x200; large previews need about 1200x630.`);
      else if (w < 600 || h < 315) add('warn', 'image-small', `${role} is ${w}x${h}. Below 600x315 most platforms show a small thumbnail. Use 1200x630.`);
      else if (w < 1200) add('info', 'image-below-recommended', `${role} is ${w}x${h}. 1200x630 is recommended for sharp previews on high-density screens.`);
      if (w > 4096 || h > 4096) add('warn', 'image-over-4096', `${role} is ${w}x${h}. X accepts at most 4096x4096. 1200x630 is enough everywhere.`);
      const r = w / h;
      if (role.startsWith('og:image') && Math.abs(r - 1.91) / 1.91 > 0.05) add('warn', 'image-ratio', `${role} ratio is ${ratioLabel(w, h)}. Facebook, LinkedIn and others show 1.91:1 (1200x630); this image will be cropped or shown small.`);
      if (role === 'twitter:image' && card === 'summary_large_image' && Math.abs(r - 2) / 2 > 0.05) add('info', 'twitter-ratio', `twitter:image ratio is ${ratioLabel(w, h)}; X large cards are 2:1 (1200x600). It will be cropped.`);
      const dw = Number(T('og:image:width')), dh = Number(T('og:image:height'));
      if (role.startsWith('og:image') && dw && dh && (dw !== w || dh !== h)) add('error', 'image-dimensions-mismatch', `og:image:width/height say ${dw}x${dh}, but the file is ${w}x${h}. Use the real size.`);
    }
    const v = platformVerdicts({ width: w, height: h, bytes, format }, card);
    if (v && role === 'twitter:image') info.verdicts = { x: v.x };           // only X reads twitter:image
    else if (v && role === 'og:image' && T('twitter:image')) { delete v.x; info.verdicts = v; } // X uses twitter:image
    else info.verdicts = v;
  }
  return { target, page, tags, images, findings };
}

// ---------------------------------------------------------------- run + print
const results = [];
for (const t of targets) results.push(await checkTarget(t));
const counts = { error: 0, warn: 0, info: 0 };
for (const r of results) for (const f of r.findings) counts[f.severity]++;

if (JSON_OUT) {
  console.log(JSON.stringify({ userAgent: UA, counts, results }, null, 2));
} else {
  const tty = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
  const sev = { error: c('31', 'error'), warn: c('33', 'warn '), info: c('36', 'info ') };
  for (const r of results) {
    console.log(c('1', `\n${r.target}`) + c('2', `  (User-Agent: ${uaOpt})`));
    if (r.page?.redirected) console.log(c('2', `  redirected to ${r.page.finalUrl}`));
    for (const [k, v] of Object.entries(r.tags)) console.log(`  ${c('2', k.padEnd(22))} ${v.length > 100 ? v.slice(0, 97) + '...' : v}`);
    for (const img of r.images) {
      const size = img.width ? `${img.width}x${img.height} (${img.ratio}), ${img.format}` : 'size unknown';
      const kb = img.bytes ? `, ${Math.round(img.bytes / 1024)} KB` : '';
      console.log(`\n  ${c('1', img.role)}: ${size}${kb}${img.ms ? `, ${img.ms} ms` : ''}`);
      if (img.verdicts) for (const [p, v] of Object.entries(img.verdicts)) console.log(`    ${p.padEnd(24)} ${/no image|not|may|cropped|small|too|below/.test(v) ? c('33', v) : c('32', v)}`);
    }
    console.log('');
    const order = { error: 0, warn: 1, info: 2 };
    for (const f of [...r.findings].sort((a, b) => order[a.severity] - order[b.severity])) console.log(`  ${sev[f.severity]}  ${c('2', f.rule.padEnd(28))} ${f.message}`);
    if (r.findings.length === 0) console.log(c('32', '  No problems found.'));
  }
  console.log(`\n${counts.error} errors, ${counts.warn} warnings, ${counts.info} info`);
  console.log(c('2', 'Platform previews are estimates. Confirm with the Facebook Sharing Debugger and LinkedIn Post Inspector, and with a draft post on X.'));
}
process.exit(counts.error > 0 && !NO_FAIL ? 1 : 0);
