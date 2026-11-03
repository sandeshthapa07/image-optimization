#!/usr/bin/env node
/**
 * audit-images.mjs - static audit of image markup. Part of the image-optimization skill.
 *
 * Usage:
 *   node audit-images.mjs [paths...] [options]
 *
 * Options:
 *   --json            print JSON instead of text
 *   --no-info         hide "info" findings
 *   --max-high=N      allowed fetchpriority="high"/priority images per file (default 2)
 *   --include-tests   also scan *.test.*, *.spec.*, *.stories.* files
 *   --no-fail         exit 0 even if errors are found (default: exit 1 on errors)
 *
 * Scans: .html .htm .jsx .tsx .js .ts .vue .svelte .astro .mdx .php .liquid .njk .hbs .ejs .erb .twig .cshtml .razor
 *        and CSS (.css .scss .less, and <style> blocks) for image rules that stretch images
 * Node 18+, no dependencies.
 *
 * The rules are heuristics: the script cannot see the rendered CSS layout.
 * Confirm the results in the browser with scripts/browser-audit.js.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, resolve, dirname, basename } from 'node:path';

// ---------------------------------------------------------------- options
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
const optValue = (name, def) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
if (flags.has('--help') || argv.includes('-h')) {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  console.log(src.split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''));
  process.exit(0);
}
const targets = argv.filter((a) => !a.startsWith('--'));
if (targets.length === 0) targets.push('.');
const MAX_HIGH = Number(optValue('max-high', 2));
const SHOW_INFO = !flags.has('--no-info');
const JSON_OUT = flags.has('--json');
const NO_FAIL = flags.has('--no-fail');
const INCLUDE_TESTS = flags.has('--include-tests');

const EXTS = new Set(['.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.mjs', '.vue', '.svelte', '.astro', '.mdx',
  '.php', '.liquid', '.njk', '.hbs', '.handlebars', '.ejs', '.erb', '.twig', '.cshtml', '.razor', '.css', '.scss', '.less']);
const JSX_EXTS = new Set(['.jsx', '.tsx', '.js', '.ts', '.mjs', '.mdx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.output', '.svelte-kit',
  '.astro', '.vercel', '.netlify', 'coverage', 'vendor', '.cache', '.turbo', '.parcel-cache', 'storybook-static',
  '.angular', '.expo', '.docusaurus', '_site', 'public/build']);
const MAX_FILE_BYTES = 1_500_000;

// ---------------------------------------------------------------- file discovery
function walk(p, out, depth = 0) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    if (depth > 0 && SKIP_DIRS.has(basename(p))) return;
    for (const name of readdirSync(p)) walk(join(p, name), out, depth + 1);
    return;
  }
  if (!st.isFile() || st.size > MAX_FILE_BYTES) return;
  const name = basename(p).toLowerCase();
  if (name.endsWith('.min.js') || name.endsWith('.d.ts')) return;
  if (!INCLUDE_TESTS && /\.(test|spec|stories)\.[a-z]+$/.test(name)) return;
  if (EXTS.has(extname(name))) out.push(p);
}

// ---------------------------------------------------------------- package.json (nearest, cached)
const pkgCache = new Map();
function nearestPackage(file) {
  let dir = dirname(resolve(file));
  const visited = [];
  for (;;) {
    if (pkgCache.has(dir)) { const v = pkgCache.get(dir); visited.forEach((d) => pkgCache.set(d, v)); return v; }
    visited.push(dir);
    const p = join(dir, 'package.json');
    if (existsSync(p)) {
      let deps = null;
      try { const j = JSON.parse(readFileSync(p, 'utf8')); deps = { ...j.dependencies, ...j.devDependencies, ...j.peerDependencies }; } catch {}
      visited.forEach((d) => pkgCache.set(d, deps));
      return deps;
    }
    const parent = dirname(dir);
    if (parent === dir) { visited.forEach((d) => pkgCache.set(d, null)); return null; }
    dir = parent;
  }
}
function majorOf(deps, name) {
  const v = deps?.[name];
  if (!v) return null;
  const m = /(\d+)/.exec(String(v));
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------- tiny tag parser
const TAG_RE = /<(img|source|link|meta|Meta|Image|Img|Picture|NuxtImg|nuxt-img|NuxtPicture|nuxt-picture|enhanced:img|StaticImage|GatsbyImage)(?=[\s/>])/g;
const PAGE_EXTS = new Set(['.html', '.htm', '.php', '.liquid', '.njk', '.hbs', '.handlebars', '.ejs', '.erb', '.twig', '.cshtml', '.razor', '.astro']);
const SOCIAL_IMAGE_KEYS = new Set(['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);

function skipString(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === q) return j;
  }
  return src.length;
}
function skipBalanced(src, i) { // src[i] === '{'
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return src.length;
}
function readTag(src, i) {
  const attrs = [];
  const n = src.length;
  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++;
    const c = src[i];
    if (c === undefined) break;
    if (c === '>') return { attrs, end: i + 1 };
    if (c === '/' && src[i + 1] === '>') return { attrs, end: i + 2 };
    if (c === '{') {
      const j = skipBalanced(src, i);
      const inner = src.slice(i + 1, j - 1).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(inner)) attrs.push({ name: inner, value: inner, kind: 'expr' }); // Svelte {src}
      else attrs.push({ name: '...', value: inner, kind: 'spread' });
      i = j;
      continue;
    }
    const m = /^[^\s=>/"'{}]+/.exec(src.slice(i, i + 256));
    if (!m) { i++; continue; }
    const name = m[0];
    i += name.length;
    let k = i;
    while (k < n && /\s/.test(src[k])) k++;
    if (src[k] !== '=') { attrs.push({ name, value: true, kind: 'bool' }); continue; }
    i = k + 1;
    while (i < n && /\s/.test(src[i])) i++;
    const q = src[i];
    if (q === '"' || q === "'") {
      const j = src.indexOf(q, i + 1);
      const end = j < 0 ? n : j;
      attrs.push({ name, value: src.slice(i + 1, end), kind: 'string' });
      i = end + 1;
    } else if (q === '{') {
      const j = skipBalanced(src, i);
      attrs.push({ name, value: src.slice(i + 1, j - 1), kind: 'expr' });
      i = j;
    } else {
      const mm = /^[^\s>]+/.exec(src.slice(i, i + 1024));
      let v = mm ? mm[0] : '';
      if (v.endsWith('/') && src[i + v.length] === '>') v = v.slice(0, -1);
      attrs.push({ name, value: v, kind: 'string' });
      i += v.length;
    }
  }
  return { attrs, end: n };
}
function normalizeAttrs(list) {
  const map = new Map();
  let dynamic = false;
  for (const a of list) {
    if (a.kind === 'spread') { dynamic = true; continue; }
    let { name, kind } = a;
    if (name.startsWith('<?') || name.startsWith('{%') || name.startsWith('{{')) { dynamic = true; continue; }
    if (name === 'v-bind') { dynamic = true; continue; }
    if (name.startsWith('v-bind:')) { name = name.slice(7); kind = 'expr'; }
    else if (name.startsWith(':')) { name = name.slice(1); kind = 'expr'; }
    else if (/^\[.+\]$/.test(name)) { name = name.slice(1, -1).replace(/^attr\./, ''); kind = 'expr'; }
    else if (name.startsWith('attr:')) name = name.slice(5);
    map.set(name.toLowerCase(), { name, value: a.value, kind });
  }
  return { map, dynamic };
}
/** literal value of an attribute: string, or null if unknown/dynamic, or undefined if absent */
function lit(map, key) {
  const a = map.get(key);
  if (!a) return undefined;
  if (a.kind === 'bool') return 'true';
  if (a.kind === 'string') return a.value;
  const v = String(a.value).trim();
  let m = /^(['"`])([^'"`$]*)\1$/.exec(v);
  if (m) return m[2];
  m = /^(true|false|-?\d+(?:\.\d+)?)$/.exec(v);
  if (m) return m[1];
  return null;
}
/** true | false | 'maybe' for boolean-ish props like priority */
function boolState(map, key) {
  const a = map.get(key);
  if (!a) return false;
  const v = lit(map, key);
  if (v === null) return 'maybe';
  return v !== 'false';
}
function stringsIn(a) { // all string literals inside an expression attribute (className={cn('a', x && 'b')})
  if (!a) return '';
  if (a.kind !== 'expr') return String(a.value);
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(String(a.value)))) out.push(m[2]);
  return out.join(' ');
}

// ---------------------------------------------------------------- helpers for rules
const HERO_RE = /(?:^|[^a-z0-9])(hero|banner|masthead|jumbotron|splash|lcp|key-?visual|above-?the-?fold)(?:[^a-z0-9]|$)/i;
const FILE_HERO_RE = /hero|banner|masthead|jumbotron|splash/i;
const decamel = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2');

function looksHero(map) {
  if (map.has('data-lcp') || map.has('data-hero')) return true;
  for (const k of ['class', 'classname', 'id', 'src', 'ngsrc', 'alt']) {
    const a = map.get(k);
    if (!a) continue;
    if (HERO_RE.test(decamel(a.kind === 'expr' ? a.value : a.value))) return true;
  }
  return false;
}
function stretchRisk(map) {
  const cls = [stringsIn(map.get('class')), stringsIn(map.get('classname'))].join(' ');
  const tokens = cls.split(/\s+/).filter(Boolean).map((t) => t.replace(/^!/, '').split(':').pop());
  const style = map.get('style') ? String(map.get('style').value) : '';
  const twW = tokens.find((t) => (/^w-/.test(t) && !/^w-(auto|fit|min|max)$/.test(t)) || /^size-/.test(t));
  const twH = tokens.find((t) => (/^h-/.test(t) && !/^h-(auto|fit|min|max)$/.test(t)) || /^size-/.test(t));
  const twAspect = tokens.some((t) => /^aspect-/.test(t) && t !== 'aspect-auto');
  const twFit = tokens.some((t) => /^object-(cover|contain|fill|none|scale-down)$/.test(t));
  const stW = /(?<![-\w])width\s*:\s*(?!\s*['"]?auto\b)/i.test(style);
  const stH = /(?<![-\w])height\s*:\s*(?!\s*['"]?auto\b)/i.test(style);
  const stAspect = /aspect-?ratio['"]?\s*:\s*(?!\s*['"]?auto\b)/i.test(style);
  const stFit = /object-?fit/i.test(style);
  if (twFit || stFit) return false;
  // square utility + square image (w-8 h-8 with width=height): no risk
  const wAttr = lit(map, 'width'), hAttr = lit(map, 'height');
  if (twW && twH && twW.slice(2) === twH.slice(2) && wAttr && wAttr === hAttr) return false;
  return Boolean(((twW || stW) && (twH || stH)) || twAspect || stAspect);
}
const isSvgUrl = (s) => typeof s === 'string' && /\.svg(\?|#|$)/i.test(s);
const hasW = (s) => typeof s === 'string' && /\d+w(\s|,|$)/.test(s);
const hasX = (s) => typeof s === 'string' && /\d(?:\.\d+)?x(\s|,|$)/.test(s);
const isIdentifierExpr = (a) => a && a.kind === 'expr' && /^[A-Za-z_$][\w$]*$/.test(String(a.value).trim());

// class names that hide an element at some screen widths
const RESPONSIVE_HIDE_RE = /^(hidden|d-none|invisible)$|^(mobile|desktop|tablet)[-_]?(only|show|hide|hidden|visible)$|^(show|hide|hidden|visible)[-_](on[-_])?(mobile|desktop|tablet|xs|sm|md|lg|xl)$|^(max-)?(xs|sm|md|lg|xl|2xl):(hidden|block|inline|inline-block|flex)$|^d-(xs|sm|md|lg|xl|xxl)-(none|block|inline|inline-block|flex)$/;
function hidesAtSomeWidth(map) {
  const raw = [stringsIn(map.get('class')), stringsIn(map.get('classname'))].join(' ').split(/\s+/).filter(Boolean);
  return raw.some((t) => RESPONSIVE_HIDE_RE.test(t.replace(/^!/, '')));
}

// srcset whose candidates look like different crops (tall/wide, mobile/desktop, ...)
const CROP_WORD_RE = /(?:^|[/_\-.])(tall|wide|portrait|landscape|mobile|desktop|square|vertical|horizontal)(?=[/_\-.]|$)/i;
function mixedCrops(ss) {
  if (typeof ss !== 'string') return false;
  const urls = ss.split(/,\s+/).map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
  if (urls.length < 2) return false;
  const words = new Set(urls.map((u) => (CROP_WORD_RE.exec(u) || [, '-'])[1].toLowerCase()));
  return words.size > 1;
}

// is the element rendered in a loop (.map, v-for, *ngFor, {#each})?
function inLoop(src, idx, map) {
  if (map.has('v-for') || map.has('*ngfor')) return true;
  const win = src.slice(Math.max(0, idx - 2000), idx);
  const mapPos = Math.max(win.lastIndexOf('.map('), win.lastIndexOf('.flatMap('));
  if (mapPos >= 0) {
    let bal = 0;
    for (const ch of win.slice(mapPos)) { if (ch === '(') bal++; else if (ch === ')') bal--; }
    if (bal > 0) return true;
  }
  const each = win.lastIndexOf('{#each');
  if (each >= 0 && win.lastIndexOf('{/each}') < each) return true;
  return false;
}

// hero context just before the element: class="hero ..." on a parent, or a Hero/Banner component
const CONTEXT_HERO_RE = /(?:class|className)\s*=\s*["'{`][^"'`}]*?(?:^|[^a-zA-Z0-9])(?:hero|banner|masthead|jumbotron|splash)(?:[^a-zA-Z0-9]|$)|(?:function|const|let|class)\s+\w*(?:Hero|Banner|Masthead|Jumbotron|Splash)\w*/g;
const IMAGE_TAG_RE = /<(img|Image|Img|NuxtImg|nuxt-img|NuxtPicture|enhanced:img|StaticImage|GatsbyImage)[\s/>]/;
function heroContext(src, idx) {
  const win = src.slice(Math.max(0, idx - 600), idx);
  let last = -1;
  for (const m of win.matchAll(CONTEXT_HERO_RE)) last = m.index + m[0].length;
  return last >= 0 && !IMAGE_TAG_RE.test(win.slice(last));
}

// ---------------------------------------------------------------- alt text policy
const ALT_FIX = 'Describe what the image shows (product + variant, person, link action). Decorative or duplicate images: filled alt + aria-hidden="true". See references/06-accessibility-seo.md.';
const GENERIC_ALT_RE = /^(an?\s+|the\s+)?(image|img|images|photo|photograph|picture|pic|graphic|icon|logo|banner|thumbnail|thumb|placeholder|untitled|alt|alt text|alttext|null|undefined|none|nan|todo|tbd|test|default|hero|hero image|cover|background|bg|spacer|blank|figure|media|asset|file|\.+|-+|_+)\s*\d*$/i;
const FILENAME_ALT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic)$|^(img|dsc|dscn|dscf|pxl|mvimg|image|screenshot|screen shot|photo|wp|whatsapp image)[-_ ]?\d{2,}|^[a-z0-9]+([-_][a-z0-9]+)*[-_]\d{3,}(x\d+)?$/i;
const REDUNDANT_PREFIX_RE = /^(an?\s+)?(image|picture|photo|photograph|graphic|pic)\s+(of|showing|with)\b/i;
const TEMPLATE_RE = /\{\{|\{%|<\?|\$\{|<%|@\{/;

function checkAlt(el, a, add) {
  // <img alt> (no value) is the same as alt=""
  if (a.kind === 'bool') { add(el, 'error', 'empty-alt', 'alt has no value (same as alt=""). Every image must have a filled alt.', ALT_FIX); return; }
  if (a.kind === 'expr') {
    const raw = String(a.value).trim();
    const literal = /^(['"`])([^'"`$]*)\1$/.exec(raw);
    if (literal) return checkAltText(el, literal[2], add);
    if (/(\|\||\?\?)\s*(''|""|``)\s*$/.test(raw) || /:\s*(''|""|``)\s*$/.test(raw)) add(el, 'warn', 'alt-empty-fallback', `alt={${raw}} falls back to an empty string.`, 'Fall back to a description, e.g. alt={image.alt || product.name}.');
    return;
  }
  checkAltText(el, String(a.value), add);
}
function checkAltText(el, value, add) {
  if (TEMPLATE_RE.test(value)) return; // server template value: checked in the browser audit
  const v = value.trim();
  if (!v) { add(el, 'error', 'empty-alt', 'alt is empty. Policy: every image must have a filled, descriptive alt.', ALT_FIX); return; }
  if (GENERIC_ALT_RE.test(v)) add(el, 'warn', 'alt-not-descriptive', `alt="${v}" does not describe the image.`, ALT_FIX);
  else if (FILENAME_ALT_RE.test(v)) add(el, 'warn', 'alt-is-filename', `alt="${v}" looks like a file name.`, ALT_FIX);
  else if (REDUNDANT_PREFIX_RE.test(v)) add(el, 'info', 'alt-redundant-prefix', `alt starts with "${v.split(/\s+/).slice(0, 2).join(' ')}": screen readers already say "image".`, 'Start with the content: "Red running shoe", not "Image of a red running shoe".');
  if (v.length > 150) add(el, 'info', 'alt-too-long', `alt is ${v.length} characters.`, 'Keep alt under ~125 characters; put details in a caption or nearby text.');
}

// ---------------------------------------------------------------- CSS helpers
const CSS_EXTS = new Set(['.css', '.scss', '.less']);
function cssBlocks(src, ext) {
  if (CSS_EXTS.has(ext)) return [{ css: src, offset: 0 }];
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(src))) out.push({ css: m[1], offset: m.index + m[0].indexOf('>') + 1 });
  return out;
}
function cssRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const selector = m[1].split(';').pop().trim(); // SCSS: text after the parent's declarations
    if (!selector || selector.startsWith('@')) continue;
    const decls = {};
    for (const part of m[2].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) decls[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).replace(/!important/i, '').trim().toLowerCase();
    }
    const lead = m[0].length - m[0].trimStart().length;
    rules.push({ selector, decls, index: m.index + lead + (m[1].trim().length - selector.length) });
  }
  return rules;
}
const lastCompound = (sel) => sel.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() || '';
const isFixed = (v) => v !== undefined && !/^(auto|fit-content|max-content|min-content|inherit|initial|unset|revert)/.test(v);
function hasImgHeightAutoReset(css) {
  if (/@tailwind\s+base|@import\s+["']tailwindcss/.test(css)) return true;
  return cssRules(css).some((r) => r.decls.height === 'auto' &&
    r.selector.split(',').some((s) => /^img$/i.test(lastCompound(s)) && s.trim().split(/\s+/).length === 1));
}
let GLOBAL_IMG_HEIGHT_AUTO = false; // set before auditing: a global img { height: auto } reset exists

// ---------------------------------------------------------------- audit one file
function auditFile(file) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { return { images: 0, findings: [] }; }
  // blank comments, keep offsets/newlines
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  src = src.replace(/<!--[\s\S]*?-->/g, blank).replace(/\{\/\*[\s\S]*?\*\/\}/g, blank);

  const ext = extname(file).toLowerCase();
  const deps = nearestPackage(file);
  const nextMajor = majorOf(deps, 'next');
  const reactMajor = majorOf(deps, 'react');
  const isJsx = JSX_EXTS.has(ext);
  const libs = {
    next: /from\s+['"]next\/image['"]|require\(\s*['"]next\/image['"]\s*\)/.test(src),
    nextLegacy: /from\s+['"]next\/legacy\/image['"]/.test(src),
    astro: /from\s+['"]astro:assets['"]/.test(src),
    unpic: /from\s+['"]@unpic\/[\w-]+(\/[\w-]+)?['"]/.test(src),
    gatsby: /from\s+['"]gatsby-plugin-image['"]/.test(src),
    native: /from\s+['"](react-native|expo-image)['"]/.test(src),
  };
  const fileIsHero = FILE_HERO_RE.test(basename(file).replace(/\.[^.]+$/, ''));
  const importedImages = new Set();
  for (const im of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+\.(?:jpe?g|png|gif|webp|avif|svg|tiff?)(?:\?[^'"]*)?['"]/g)) importedImages.add(im[1]);
  for (const im of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"][^'"]+\.(?:jpe?g|png|gif|webp|avif|svg)['"]\s*\)/g)) importedImages.add(im[1]);

  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  const pos = (idx) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: idx - lineStarts[lo] + 1 };
  };

  const findings = [];
  const elements = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src))) {
    const tag = m[1];
    const { attrs, end } = readTag(src, m.index + m[0].length);
    TAG_RE.lastIndex = Math.max(end, m.index + 1);
    if (attrs.length === 0) continue; // "<Image>" in a TS generic or in prose, not a real element
    const { map, dynamic } = normalizeAttrs(attrs);
    elements.push({ tag, map, dynamic, idx: m.index, ...pos(m.index) });
  }

  let images = 0;
  let firstImageSeen = false;
  const highLines = [];
  const preloads = [];
  const add = (el, severity, rule, message, fix) => {
    if (severity === 'info' && !SHOW_INFO) return;
    findings.push({ file, line: el.line, col: el.col, severity, rule, message, fix });
  };

  const metaKeys = new Set();
  const socialImageEls = [];
  for (const el of elements) {
    const { tag, map, dynamic } = el;
    const has = (k) => map.has(k);
    const L = (k) => lit(map, k);

    // ---------------- <meta> social share images (Open Graph / Twitter)
    if (tag === 'meta' || tag === 'Meta') {
      const key = (L('property') || L('name') || '').toLowerCase();
      if (!key) continue;
      metaKeys.add(key);
      if (key.startsWith('og:') && !has('property') && has('name')) add(el, 'warn', 'og-name-attribute', `<meta name="${key}">: Open Graph tags use the property attribute.`, `Use <meta property="${key}" content="...">.`);
      if ((key === 'og:image:alt' || key === 'twitter:image:alt') && typeof L('content') === 'string' && !/\{\{|\{%|<\?|\$\{|<%/.test(L('content'))) {
        const c = L('content').trim();
        if (!c) add(el, 'error', 'og-image-alt-empty', `${key} is empty. Every image must have a filled alt.`, 'Describe the share image (what it shows, e.g. the product or the article title).');
        else if (GENERIC_ALT_RE.test(c)) add(el, 'warn', 'alt-not-descriptive', `${key}="${c}" does not describe the image.`, 'Describe what the share image shows.');
      }
      if (SOCIAL_IMAGE_KEYS.has(key)) {
        socialImageEls.push({ el, key });
        const c = L('content');
        if (typeof c === 'string' && c && !/\{\{|\{%|<\?|\$\{|@\{|<%/.test(c) && !/^\{/.test(c.trim())) { // skip template expressions
          if (/localhost|127\.0\.0\.1/i.test(c)) add(el, 'error', 'og-image-local', `${key} points to a local address. Crawlers cannot reach it.`, 'Use the production URL (build it from the site URL setting).');
          else if (!/^https?:\/\//i.test(c)) add(el, 'error', 'og-image-relative', `${key}="${c}" is not an absolute URL. Social crawlers need https://your-domain/...`, 'Prefix the site URL (Next.js: metadataBase; Astro: Astro.site; Nuxt/SvelteKit: request origin or site config).');
          else if (/^http:\/\//i.test(c)) add(el, 'warn', 'og-image-http', `${key} uses http://.`, 'Use https://.');
          if (/\.(svg|avif|heic|heif|tiff?)(\?|#|$)/i.test(c)) add(el, 'error', 'og-image-format', `${key} is ${c.split(/[?#]/)[0].split('.').pop().toUpperCase()}: social platforms do not show SVG/AVIF/HEIC previews.`, 'Use a 1200x630 JPG or PNG (node scripts/make-social-images.mjs <source>).');
        }
      }
      continue;
    }

    // ---------------- <link rel="preload" as="image">
    if (tag === 'link') {
      const rel = (L('rel') || '').toLowerCase();
      if (!/\bpreload\b/.test(rel) || (L('as') || '').toLowerCase() !== 'image') continue;
      const iss = L('imagesrcset');
      preloads.push({ el, href: L('href'), imagesrcset: iss });
      if (hasW(iss) && !has('imagesizes')) add(el, 'error', 'preload-missing-imagesizes', 'Preload has imagesrcset with w descriptors but no imagesizes, so the browser may preload the wrong file.', 'Copy the image\'s sizes attribute to imagesizes.');
      if (!has('fetchpriority')) add(el, 'info', 'preload-no-fetchpriority', 'Image preload without fetchpriority="high". Preloads of LCP images should be high priority.', 'Add fetchpriority="high" (only for the LCP image).');
      continue;
    }

    // ---------------- <source> inside <picture>
    if (tag === 'source') {
      const ss = L('srcset');
      if (hasW(ss) && !has('sizes')) add(el, 'error', 'srcset-without-sizes', '<source> srcset uses w descriptors but has no sizes (sources do not inherit sizes from <img>).', 'Add the same sizes value as the <img>.');
      if (has('loading') || has('fetchpriority')) add(el, 'warn', 'attr-on-source', 'loading/fetchpriority on <source> are ignored.', 'Move them to the <img> inside the <picture>.');
      if (has('media') && !(has('width') && has('height'))) add(el, 'info', 'source-missing-dimensions', 'Art-direction <source> without width/height. If this crop has a different aspect ratio, the reserved space is wrong (CLS).', 'Add width and height of this crop to the <source>.');
      if (mixedCrops(ss)) add(el, 'warn', 'srcset-mixed-crops', 'The srcset candidates look like different crops (for example tall/wide or mobile/desktop). All candidates in one srcset must have the same aspect ratio.', 'Use separate <source media> elements for each crop.');
      continue;
    }

    // ---------------- image elements
    let kind; // 'img' | 'next' | 'astro' | 'unpic' | 'nuxt' | 'enhanced' | 'gatsby' | 'unknown'
    if (tag === 'img') kind = 'img';
    else if (tag === 'NuxtImg' || tag === 'nuxt-img' || tag === 'NuxtPicture' || tag === 'nuxt-picture') kind = 'nuxt';
    else if (tag === 'enhanced:img') kind = 'enhanced';
    else if (tag === 'StaticImage' || tag === 'GatsbyImage') kind = 'gatsby';
    else if (libs.native) continue;
    else if (tag === 'Image' && libs.next) kind = 'next';
    else if (tag === 'Image' && libs.nextLegacy) kind = 'unknown';
    else if ((tag === 'Image' || tag === 'Picture') && libs.astro) kind = 'astro';
    else if (tag === 'Image' && libs.unpic) kind = 'unpic';
    else if (tag === 'Picture') continue;
    else kind = 'unknown';

    images++;
    const isFirst = !firstImageSeen;
    firstImageSeen = true;
    const srcVal = L('src') ?? L('ngsrc');
    const loading = (L('loading') || '').toLowerCase();
    const fp = (L('fetchpriority') || '').toLowerCase();
    const priority = boolState(map, 'priority');
    const preloadProp = kind === 'next' || kind === 'nuxt' ? boolState(map, 'preload') : false;
    const high = fp === 'high' || priority === true || preloadProp === true;
    const looped = inLoop(src, el.idx, map);
    const hero = looksHero(map) || (fileIsHero && isFirst) || (!looped && heroContext(src, el.idx)) || high;
    const w = L('width'), h = L('height');
    if (w === '1' && h === '1') continue; // tracking pixel
    if (high) highLines.push(el.line);

    // --- conflicts
    const ngPriorityRule = kind === 'img' && has('ngsrc') && priority === true;
    if (loading === 'lazy' && high && !ngPriorityRule) add(el, 'error', 'lazy-and-high', 'The image is lazy-loaded and high priority at the same time.', 'Remove loading="lazy" if this is the LCP image; otherwise remove fetchpriority/priority/preload.');
    if (looped && high) add(el, 'warn', 'priority-in-loop', 'High priority (fetchpriority/priority/preload) on an image rendered in a loop: every item gets it.', 'Make it conditional, e.g. priority={index === 0}, only for the item that is the LCP.');
    if (hidesAtSomeWidth(map) && loading !== 'lazy') add(el, 'warn', 'hidden-variant-downloads', 'This image is hidden with CSS at some screen widths but is not lazy, so it downloads even when hidden.', 'Use one <picture> with <source media> for mobile/desktop variants (or loading="lazy" on the variant that is not the LCP).');

    // --- hero / LCP
    const defaultLazy = ['next', 'astro', 'unpic', 'gatsby'].includes(kind) || (kind === 'img' && has('ngsrc'));
    if (hero && loading === 'lazy' && !high) add(el, 'error', 'lazy-hero', 'Likely LCP/hero image is lazy-loaded. This delays LCP.', 'Remove loading="lazy" and add fetchpriority="high" (or the framework priority prop).');
    else if (hero && !high && loading !== 'eager' && defaultLazy && priority !== 'maybe' && fp !== 'high') add(el, 'warn', 'hero-default-lazy', `Likely LCP/hero image. ${kind === 'img' ? 'NgOptimizedImage' : kind} images are lazy by default.`, kindPriorityFix(kind, nextMajor));
    else if (hero && !high && !defaultLazy && loading !== 'lazy' && priority !== 'maybe' && !has('fetchpriority')) add(el, 'info', 'hero-no-fetchpriority', 'Likely LCP/hero image without fetchpriority="high".', 'If this is the LCP image, add fetchpriority="high" (one per page).');
    if (hero && (has('data-src') || has('data-srcset') || /\blazy(load)?\b/.test(stringsIn(map.get('class')) + ' ' + stringsIn(map.get('classname'))) || has('v-lazy'))) add(el, 'error', 'js-lazy-hero', 'Likely LCP/hero image uses JavaScript lazy loading (data-src / lazyload / v-lazy). The browser cannot find it early.', 'Use a real src/srcset, no lazy loading, fetchpriority="high".');
    else if (has('data-src') || has('data-srcset') || has('v-lazy')) add(el, 'info', 'js-lazy-loading', 'JavaScript lazy loading (data-src / v-lazy).', 'Prefer native loading="lazy" with a real src.');

    // --- alt (policy: every image has a filled, descriptive alt)
    if (!has('alt')) {
      const sev = dynamic || kind === 'unknown' ? 'info' : 'error';
      add(el, sev, 'missing-alt', `Missing alt attribute${dynamic ? ' (it may come from spread props: check)' : ''}. Every image must have a filled, descriptive alt.`, ALT_FIX);
    } else {
      checkAlt(el, map.get('alt'), add);
    }

    // --- per kind
    if (kind === 'img') {
      const isNg = has('ngsrc');
      const fill = isNg && boolState(map, 'fill');
      if (!fill && !(has('width') && has('height'))) {
        add(el, dynamic ? 'info' : 'error', 'missing-dimensions', `<img> without ${has('width') ? 'height' : has('height') ? 'width' : 'width and height'} attributes: the browser cannot reserve space (layout shift), and lazy loading misfires.`, 'Add width and height with the intrinsic size of the file (node scripts/image-size.mjs <file>). CSS still controls the display size.');
      }
      if (isNg && fill && !has('sizes')) add(el, 'warn', 'fill-without-sizes', 'NgOptimizedImage fill image without sizes: treated as full viewport width.', 'Add sizes for the real rendered width.');
      if (isNg && fill && !hasObjectFit(map)) add(el, 'warn', 'fill-without-object-fit', 'fill image without object-fit: it stretches to the parent box.', 'Add style="object-fit: cover" (or contain).');
      if (isNg && priority === true && loading) add(el, 'error', 'ng-priority-with-loading', 'NgOptimizedImage: priority must not be combined with a loading attribute.', 'Remove the loading attribute.');
      const ss = L('srcset');
      if (hasW(ss) && !has('sizes')) add(el, 'error', 'srcset-without-sizes', 'srcset uses w descriptors but there is no sizes attribute, so the browser assumes 100vw and downloads files that are too big.', 'Add sizes that match the rendered CSS width (references/02-responsive-sizing.md).');
      if (hasW(ss) && hasX(ss)) add(el, 'error', 'srcset-mixed-descriptors', 'srcset mixes w and x descriptors (invalid).', 'Use only w descriptors (+ sizes) or only x descriptors.');
      if (mixedCrops(ss)) add(el, 'warn', 'srcset-mixed-crops', 'The srcset candidates look like different crops (for example tall/wide or mobile/desktop). All candidates in one srcset must have the same aspect ratio, or the shape changes per screen.', 'Use <picture> with <source media> for each crop (references/02-responsive-sizing.md).');
      if (hasW(L('ngsrcset')) && !has('sizes')) add(el, 'warn', 'srcset-without-sizes', 'ngSrcset with w descriptors but no sizes.', 'Add sizes.');
      const sizes = L('sizes');
      if (sizes && /^\s*auto\b/i.test(sizes) && loading !== 'lazy') add(el, 'warn', 'sizes-auto-needs-lazy', 'sizes="auto" works only with loading="lazy".', 'Add loading="lazy", or replace auto with a real sizes value.');
      if (sizes && /^\s*auto\s*$/i.test(sizes)) add(el, 'info', 'sizes-auto-no-fallback', 'sizes="auto" without a fallback. Browsers without support use 100vw.', 'Use sizes="auto, <fallback sizes>".');
      if (isJsx && !isNg) {
        const fpAttr = map.get('fetchpriority');
        if (fpAttr && fpAttr.name === 'fetchpriority' && reactMajor && reactMajor >= 19 && !libs.native) add(el, 'info', 'react-fetchpriority-casing', 'React 19+ expects fetchPriority (camelCase) and warns about lowercase fetchpriority.', 'Rename to fetchPriority.');
        if (fpAttr && fpAttr.name === 'fetchPriority' && reactMajor && reactMajor < 19) add(el, 'warn', 'react-fetchpriority-casing', `React ${reactMajor} does not know fetchPriority (camelCase) and does not pass it on correctly.`, 'Use lowercase fetchpriority="high" until React 19.');
      }
      if (!isSvgUrl(srcVal) && stretchRisk(map)) add(el, 'warn', 'stretch-risk', 'CSS sets both width and height (or aspect-ratio) but no object-fit. The default object-fit is fill, which distorts the image when the ratios differ.', 'Add object-fit: cover (Tailwind: object-cover) or contain, or make one dimension auto.');
    }

    if (kind === 'next') {
      const fill = boolState(map, 'fill');
      const srcA = map.get('src');
      if (!fill && !(has('width') && has('height'))) {
        if (isIdentifierExpr(srcA) && importedImages.has(String(srcA.value).trim())) { /* static import gives the size */ }
        else if (srcA && srcA.kind === 'expr') add(el, 'warn', 'missing-dimensions', 'next/image with a dynamic src and no width/height or fill. Remote images need both (static imports do not).', 'Pass width and height from the CMS/API data, or use fill with a sized parent.');
        else add(el, 'error', 'missing-dimensions', 'next/image needs width and height (or fill) for non-imported images.', 'Add width and height with the intrinsic size, or use fill.');
      }
      if (fill === true && !has('sizes')) add(el, 'warn', 'fill-without-sizes', 'next/image fill without sizes: Next.js assumes 100vw and sends very large files.', 'Add sizes for the real rendered width, e.g. sizes="(min-width: 1024px) 25vw, 50vw".');
      if (fill === true && !hasObjectFit(map)) add(el, 'warn', 'fill-without-object-fit', 'next/image fill without object-fit: the image stretches to the parent box.', 'Add style={{ objectFit: \'cover\' }} or className="object-cover".');
      if (priority === true && nextMajor && nextMajor >= 16) add(el, 'info', 'next-priority-deprecated', `Next.js ${nextMajor}: the priority prop is deprecated.`, 'Use loading="eager" fetchPriority="high" (or preload when you need a preload link).');
      if (has('layout') || has('objectfit') || has('objectposition') || has('lazyboundary')) add(el, 'warn', 'next-legacy-props', 'Legacy next/image props (layout/objectFit/objectPosition/lazyBoundary) are not supported by next/image in Next.js 13+.', 'Use fill/sizes and style={{ objectFit }} (references/frameworks/nextjs.md).');
      if (L('placeholder') === 'blur' && srcA && srcA.kind !== 'expr' && !has('blurdataurl')) add(el, 'warn', 'next-blur-without-data', 'placeholder="blur" on a non-imported image needs blurDataURL.', 'Add blurDataURL, or use placeholder="empty".');
      if (stretchRisk(map) && fill !== true) add(el, 'warn', 'stretch-risk', 'CSS sets both width and height (or aspect-ratio) but no object-fit.', 'Add objectFit: \'cover\' or set one dimension to auto.');
      if (sizesLooksLikeNuxt(L('sizes'))) add(el, 'error', 'invalid-sizes', 'sizes uses Nuxt breakpoint syntax, which next/image does not understand.', 'Use a normal sizes attribute with media conditions.');
    }

    if (kind === 'astro') {
      const srcA = map.get('src');
      if (srcA && srcA.kind !== 'expr' && !(has('width') && has('height')) && !has('infersize')) add(el, 'error', 'missing-dimensions', 'astro:assets image with a string src (public/ or remote) needs width and height, or inferSize.', 'Import the file from src/ instead, or add width/height (or inferSize for remote images).');
      if (has('widths') && !has('sizes') && !has('layout')) add(el, 'error', 'srcset-without-sizes', 'widths without sizes: the srcset has w descriptors but no sizes.', 'Add sizes, or use the layout prop (Astro 5.10+).');
    }

    if (kind === 'unpic') {
      const layout = (L('layout') || '').toLowerCase();
      const ok = (has('width') && has('height')) || has('aspectratio') || (layout === 'fullwidth' && (has('height') || has('aspectratio')));
      if (!ok) add(el, 'warn', 'missing-dimensions', 'Unpic image without width+height or aspectRatio: space cannot be reserved.', 'Add width and height (or aspectRatio).');
    }

    if (kind === 'nuxt') {
      if (!(has('width') && has('height'))) add(el, 'warn', 'missing-dimensions', 'NuxtImg/NuxtPicture without width and height: the browser cannot reserve space.', 'Add width and height (intrinsic ratio).');
      const sizes = L('sizes');
      if (sizes && /\(\s*(min|max)-width/.test(sizes)) add(el, 'warn', 'nuxt-sizes-syntax', 'Nuxt Image sizes uses breakpoint prefixes ("100vw sm:50vw md:400px"), not media queries.', 'Rewrite sizes with Nuxt breakpoint prefixes.');
      if (stretchRisk(map)) add(el, 'warn', 'stretch-risk', 'CSS sets both width and height (or aspect-ratio) but no object-fit. Nuxt "fit" resizes the file; it is not CSS object-fit.', 'Add object-fit: cover in CSS (Tailwind: object-cover).');
    }

    if (kind === 'unknown') {
      if (!dynamic && stretchRisk(map) && !has('fill')) add(el, 'info', 'stretch-risk', `<${tag}> gets fixed width and height classes/styles without object-fit.`, 'Check the rendered element; add object-fit: cover if it stretches.');
    }

    if (/\.gif(\?|#|$)/i.test(srcVal || '')) add(el, 'info', 'animated-gif', 'GIF image. Animated GIFs are often 5-10x larger than video.', 'Use <video autoplay muted loop playsinline>, or animated WebP/AVIF.');
  }

  // ---------------- file level
  // social tags: only in page/layout templates, where all head tags are usually in one file
  const ogEl = socialImageEls.find((s) => s.key.startsWith('og:image'));
  if (ogEl && PAGE_EXTS.has(ext)) {
    if (!metaKeys.has('twitter:card')) add(ogEl.el, 'warn', 'twitter-card-missing', 'og:image without twitter:card: X shows no large image card.', 'Add <meta name="twitter:card" content="summary_large_image">.');
    if (!(metaKeys.has('og:image:width') && metaKeys.has('og:image:height'))) add(ogEl.el, 'info', 'og-image-dimensions-missing', 'og:image without og:image:width/height: Facebook may show no image on the first share.', 'Add og:image:width and og:image:height with the real size (1200 and 630).');
    if (!metaKeys.has('og:image:alt')) add(ogEl.el, 'error', 'og-image-alt-missing', 'og:image without og:image:alt. Every image must have a filled alt, including share images.', 'Add <meta property="og:image:alt" content="Describe the image">.');
  }
  const twEl = socialImageEls.find((s) => s.key.startsWith('twitter:image')) || ogEl;
  if (twEl && PAGE_EXTS.has(ext) && metaKeys.has('twitter:card') && !metaKeys.has('twitter:image:alt')) add(twEl.el, 'warn', 'twitter-image-alt-missing', 'X card without twitter:image:alt.', 'Add <meta name="twitter:image:alt" content="Describe the image"> (max 420 characters).');
  if (highLines.length > MAX_HIGH) {
    findings.push({ file, line: highLines[0], col: 1, severity: 'warn', rule: 'too-many-high', message: `${highLines.length} images are high priority (fetchpriority="high"/priority/preload) in this file, on lines ${highLines.join(', ')}. More than ${MAX_HIGH} cancels the benefit.`, fix: 'Keep high priority only on the LCP image.' });
  }
  for (const p of preloads) {
    const lazyMatch = elements.find((e) => e.tag === 'img' && (lit(e.map, 'loading') || '').toLowerCase() === 'lazy' &&
      ((p.href && lit(e.map, 'src') === p.href) || (p.imagesrcset && lit(e.map, 'srcset') === p.imagesrcset)));
    if (lazyMatch) findings.push({ file, line: p.el.line, col: p.el.col, severity: 'error', rule: 'preload-lazy-conflict', message: `Preloaded image is lazy-loaded at line ${lazyMatch.line}.`, fix: 'Remove loading="lazy" from the image, or remove the preload.' });
  }

  // ---------------- CSS rules (stylesheets and <style> blocks)
  const imgClasses = new Set();
  for (const e of elements) {
    if (e.tag === 'link' || e.tag === 'source') continue;
    for (const t of [stringsIn(e.map.get('class')), stringsIn(e.map.get('classname'))].join(' ').split(/\s+/)) if (t) imgClasses.add(t);
  }
  const blocks = cssBlocks(src, ext);
  const tailwind = Boolean(deps && (deps.tailwindcss || deps['@tailwindcss/vite'] || deps['@tailwindcss/postcss']));
  const resetHere = blocks.some((b) => hasImgHeightAutoReset(b.css));
  for (const b of blocks) {
    const rules = cssRules(b.css);
    const fitSelectors = new Set(rules.filter((r) => r.decls['object-fit']).map((r) => r.selector));
    for (const r of rules) {
      const at = pos(b.offset + r.index);
      const d = r.decls;
      for (const rawSel of r.selector.split(',')) {
        const sel = rawSel.trim();
        const last = lastCompound(sel);
        const classes = [...last.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
        const tagPart = ((/^[a-z][\w-]*/i.exec(last) || [''])[0]).toLowerCase();
        const targetsImg = tagPart === 'img' || (tagPart === '' && classes.some((c) => imgClasses.has(c)));
        if (targetsImg && !/:(hover|focus|active)/.test(last)) {
          const fit = Boolean(d['object-fit']) || fitSelectors.has(r.selector);
          const wFixed = isFixed(d.width);
          const hFixed = isFixed(d.height);
          const aspect = Boolean(d['aspect-ratio']) && d['aspect-ratio'] !== 'auto';
          if (!fit && ((wFixed && hFixed) || (aspect && d.height === undefined))) {
            add(at, 'warn', 'css-stretch-risk', `CSS rule "${sel}" sets ${wFixed && hFixed ? 'width and height' : 'aspect-ratio'} on an image without object-fit. The default object-fit is fill, which distorts images with a different ratio.`, 'Add object-fit: cover (or contain) and object-position.');
          } else if ((wFixed || d['max-width']) && d.height === undefined && !aspect && !fit && !(GLOBAL_IMG_HEIGHT_AUTO || resetHere || tailwind)) {
            add(at, 'warn', 'css-width-without-height-auto', `CSS rule "${sel}" changes the width of images but not the height. An image with a height attribute keeps that height and is squished.`, 'Add height: auto (or a global reset: img { max-width: 100%; height: auto; }).');
          }
        }
        if (HERO_RE.test(decamel(sel)) && /url\(/.test(`${d['background-image'] || ''} ${d.background || ''}`) && preloads.length === 0) {
          add(at, 'warn', 'css-background-hero', `Hero/banner "${sel}" uses a CSS background image: the browser finds it late, and it has no srcset.`, 'Use an <img> with object-fit: cover and fetchpriority="high", or preload the background (references/05-css-backgrounds.md).');
        }
      }
    }
  }
  return { images, findings };
}

function hasObjectFit(map) {
  const s = [stringsIn(map.get('class')), stringsIn(map.get('classname')), map.get('style') ? String(map.get('style').value) : ''].join(' ');
  return /object-?fit|(^|[\s:'"`])object-(cover|contain|fill|none|scale-down)\b/i.test(s);
}
function sizesLooksLikeNuxt(s) {
  return typeof s === 'string' && /(^|\s)(xs|sm|md|lg|xl|xxl|2xl):\d/.test(s);
}
function kindPriorityFix(kind, nextMajor) {
  switch (kind) {
    case 'next': return nextMajor && nextMajor >= 16 ? 'Add loading="eager" fetchPriority="high".' : 'Add the priority prop (Next.js 13-15) or loading="eager" fetchPriority="high" (Next.js 16+).';
    case 'astro': return 'Add priority (Astro 5.10+) or loading="eager" fetchpriority="high".';
    case 'unpic': return 'Add the priority prop.';
    case 'gatsby': return 'Add loading="eager".';
    case 'img': return 'Add the priority attribute (NgOptimizedImage).';
    default: return 'Make it eager and high priority.';
  }
}

// ---------------------------------------------------------------- run
const files = [];
for (const t of targets) walk(resolve(t), files);
// pre-pass: is there a global img { height: auto } reset anywhere?
for (const f of files) {
  const e = extname(f).toLowerCase();
  if (!CSS_EXTS.has(e) && !['.html', '.htm', '.vue', '.svelte', '.astro'].includes(e)) continue;
  try {
    if (cssBlocks(readFileSync(f, 'utf8'), e).some((b) => hasImgHeightAutoReset(b.css))) { GLOBAL_IMG_HEIGHT_AUTO = true; break; }
  } catch {}
}
let totalImages = 0;
const all = [];
for (const f of files) {
  const r = auditFile(f);
  totalImages += r.images;
  all.push(...r.findings);
}
const cwd = process.cwd();
for (const f of all) f.file = relative(cwd, f.file) || f.file;
const order = { error: 0, warn: 1, info: 2 };
all.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || order[a.severity] - order[b.severity]);
const counts = { error: 0, warn: 0, info: 0 };
for (const f of all) counts[f.severity]++;

if (JSON_OUT) {
  console.log(JSON.stringify({ filesScanned: files.length, images: totalImages, counts, findings: all }, null, 2));
} else {
  const tty = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
  const sevLabel = { error: c('31', 'error'), warn: c('33', 'warn '), info: c('36', 'info ') };
  console.log(c('1', `image-optimization audit: ${files.length} files, ${totalImages} images`));
  let current = '';
  for (const f of all) {
    if (f.file !== current) { current = f.file; console.log('\n' + c('4', current)); }
    console.log(`  ${String(f.line).padStart(4)}:${String(f.col).padEnd(3)} ${sevLabel[f.severity]}  ${c('2', f.rule.padEnd(26))} ${f.message}`);
    if (f.fix) console.log(`  ${' '.repeat(9)}        ${' '.repeat(26)} ${c('32', '-> ' + f.fix)}`);
  }
  console.log(`\n${counts.error} errors, ${counts.warn} warnings, ${counts.info} info`);
  console.log(c('2', 'Heuristic rules (hero detection, stretch risk) can be wrong. Confirm in the browser with scripts/browser-audit.js.'));
}
process.exit(counts.error > 0 && !NO_FAIL ? 1 : 0);
