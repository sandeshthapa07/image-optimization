/*!
 * browser-audit.js - image audit for the rendered page. Part of the image-optimization skill.
 *
 * How to use:
 *   1. Open the page. Set the width (DevTools device toolbar): about 390px (mobile), later about 1440px (desktop).
 *   2. Reload the page. Do not scroll or click (LCP stops at the first interaction). Wait until it has loaded.
 *   3. Paste this whole file into the DevTools console and press Enter.
 *   4. Read the tables and warnings. Click an element in the output to find it in the Elements panel.
 *   Results are also in window.__imageAudit. To copy them: copy(JSON.stringify(__imageAudit, null, 2))
 *
 * It checks: the LCP element, stretched images, oversized and blurry downloads, sizes accuracy,
 * lazy/eager/fetchpriority mistakes, missing dimensions, hidden images that still download,
 * large CSS background images in the first viewport, and unused preloads.
 * It works best in Chromium browsers (Chrome, Edge). Other browsers may not report LCP.
 */
(async () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const dpr = devicePixelRatio || 1;
  const GENERIC_ALT_RE = /^(an?\s+|the\s+)?(image|img|images|photo|photograph|picture|pic|graphic|icon|logo|banner|thumbnail|thumb|placeholder|untitled|alt|alt text|alttext|null|undefined|none|nan|todo|tbd|test|default|hero|hero image|cover|background|bg|spacer|blank|figure|media|asset|file|\.+|-+|_+)\s*\d*$/i;
  const FILENAME_ALT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic)$|^(img|dsc|dscn|dscf|pxl|mvimg|image|screenshot|screen shot|photo|wp|whatsapp image)[-_ ]?\d{2,}|^[a-z0-9]+([-_][a-z0-9]+)*[-_]\d{3,}(x\d+)?$/i;
  const abs = (u) => { try { return new URL(u, document.baseURI).href; } catch { return u; } };
  const short = (u) => {
    if (!u) return '';
    if (u.startsWith('data:')) return u.slice(0, 30) + '...';
    try { const x = new URL(u); const p = x.pathname + x.search; return p.length > 60 ? '...' + p.slice(-57) : p; } catch { return u.slice(-60); }
  };

  // ---------------------------------------------------------------- LCP
  let lcp = null;
  const lcpSupported = typeof PerformanceObserver !== 'undefined' &&
    (PerformanceObserver.supportedEntryTypes || []).includes('largest-contentful-paint');
  if (lcpSupported) {
    lcp = await new Promise((resolve) => {
      let last = null;
      try {
        const po = new PerformanceObserver((list) => { const e = list.getEntries(); if (e.length) last = e[e.length - 1]; });
        po.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => { po.disconnect(); resolve(last); }, 300);
      } catch { resolve(null); }
    });
  }

  // ---------------------------------------------------------------- helpers
  const resources = new Map();
  for (const r of performance.getEntriesByType('resource')) if (!resources.has(r.name)) resources.set(r.name, r);

  function parseSrcset(s) {
    const out = [];
    s = s || '';
    let i = 0;
    while (i < s.length) {
      while (i < s.length && /[\s,]/.test(s[i])) i++;
      if (i >= s.length) break;
      let j = i;
      while (j < s.length && !/\s/.test(s[j])) j++;
      let url = s.slice(i, j);
      let desc = '';
      if (/,$/.test(url)) url = url.replace(/,+$/, '');
      else {
        let k = j;
        while (k < s.length && s[k] !== ',') k++;
        desc = s.slice(j, k).trim();
        j = k;
      }
      const m = /^(\d+(?:\.\d+)?)([wx])$/.exec(desc);
      if (url) out.push({ url: abs(url), w: m && m[2] === 'w' ? Number(m[1]) : null, x: m && m[2] === 'x' ? Number(m[1]) : desc ? null : 1 });
      i = j + 1;
    }
    return out;
  }

  const preloads = [...document.querySelectorAll('link[rel~="preload"][as="image"]')].map((l) => ({
    el: l,
    href: l.getAttribute('href') ? l.href : '',
    cands: parseSrcset(l.getAttribute('imagesrcset')),
    fp: (l.getAttribute('fetchpriority') || '').toLowerCase(),
    media: l.media || '',
    used: false,
  }));
  const isPreloaded = (url) => preloads.find((p) => p.href === url || p.cands.some((c) => c.url === url));

  // ---------------------------------------------------------------- images
  const imgs = [...document.images];
  const rows = [];
  const issues = [];

  // No LCP entry (not supported, or the browser did not report one): estimate it as the
  // image with the largest visible area in the first viewport.
  let estimatedLcp = null;
  if (!lcp || !lcp.element) {
    let best = 0;
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const top = r.top + scrollY;
      const left = r.left + scrollX;
      const visW = Math.max(0, Math.min(left + r.width, vw) - Math.max(left, 0));
      const visH = Math.max(0, Math.min(top + r.height, vh) - Math.max(top, 0));
      if (visW * visH > best) { best = visW * visH; estimatedLcp = img; }
    }
  }
  const lcpWord = estimatedLcp && !(lcp && lcp.element) ? 'Estimated LCP image (largest image in the first viewport)' : 'LCP image';
  const highCount = imgs.filter((i) => (i.getAttribute('fetchpriority') || '').toLowerCase() === 'high').length;

  imgs.forEach((img, index) => {
    const id = `#${index}`;
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    const hidden = r.width === 0 || r.height === 0 || cs.visibility === 'hidden';
    const top = r.top + scrollY;
    const left = r.left + scrollX;
    const inFirstViewport = !hidden && top < vh && top + r.height > 0 && left < vw && left + r.width > 0;
    const src = img.currentSrc || img.src || '';
    const isSvg = /\.svg(\?|#|$)/i.test(src) || src.startsWith('data:image/svg');
    const loaded = img.complete && img.naturalWidth > 0;
    const loading = (img.getAttribute('loading') || 'eager').toLowerCase();
    const fp = (img.getAttribute('fetchpriority') || 'auto').toLowerCase();
    const isLcp = !!(lcp && lcp.element === img) || img === estimatedLcp;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const px = (v) => parseFloat(v) || 0;
    const cw = r.width - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
    const ch = r.height - px(cs.paddingTop) - px(cs.paddingBottom) - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
    const fit = cs.objectFit || 'fill';
    const list = [];
    const add = (sev, msg) => { list.push(sev); issues.push({ sev, image: id, src: short(src), msg, el: img }); };
    const pre = isPreloaded(src);
    if (pre) pre.used = true;

    // srcset candidates (img and <picture> sources) and the one the browser chose
    const sets = [];
    if (img.parentElement && img.parentElement.tagName === 'PICTURE') {
      for (const s of img.parentElement.querySelectorAll('source')) sets.push({ cands: parseSrcset(s.getAttribute('srcset')), sizes: s.getAttribute('sizes') });
    }
    sets.push({ cands: parseSrcset(img.getAttribute('srcset')), sizes: img.getAttribute('sizes') });
    const chosenSet = sets.find((s) => s.cands.some((c) => c.url === src));
    const chosen = chosenSet ? chosenSet.cands.find((c) => c.url === src) : null;

    // naturalWidth is density-corrected for srcset images; get the real pixel size of the file
    let fileW = nw;
    let fileH = nh;
    if (loaded && chosen && chosen.w) { fileW = chosen.w; fileH = Math.round((chosen.w * nh) / nw); }
    else if (loaded && chosen && chosen.x && chosen.x !== 1) { fileW = Math.round(nw * chosen.x); fileH = Math.round(nh * chosen.x); }

    // effective width that the file must cover
    let effW = cw;
    if (loaded && nh > 0 && ch > 0) {
      const nr = nw / nh;
      if (fit === 'cover') effW = Math.max(cw, ch * nr);
      else if (fit === 'contain' || fit === 'scale-down') effW = Math.min(cw, ch * nr);
    }

    // 1. stretching
    if (loaded && !isSvg && cw > 1 && ch > 1 && nw > 0 && nh > 0 && fit === 'fill') {
      const dr = cw / ch;
      const nr = nw / nh;
      const diff = Math.abs(dr - nr) / nr;
      if (diff > 0.03) add('error', `STRETCHED: displayed ratio ${dr.toFixed(3)} vs file ratio ${nr.toFixed(3)} (${(diff * 100).toFixed(1)}% off). Use height: auto, or object-fit: cover/contain.`);
    }

    // 2. file size vs display size
    if (loaded && !isSvg && effW > 1) {
      const need = effW * dpr;
      const needCapped = effW * Math.min(dpr, 2);
      if (fileW > need * 1.5 && fileW - need > 200) {
        const wc = chosenSet ? chosenSet.cands.filter((c) => c.w) : [];
        const smallerFits = wc.some((c) => c.w >= need && c.w < fileW);
        if (chosen && chosen.w && wc.length > 1 && !smallerFits) {
          add('info', `SRCSET STEPS: the browser chose the smallest candidate that is large enough (${fileW}w), but the slot needs only about ${Math.round(need)}px. Add a candidate near ${Math.round(need)}w.`);
        } else if (!(chosen && chosen.w && smallerFits)) { // when a smaller candidate fits, the sizes check below reports it
          add('warn', `OVERSIZED: file is ${fileW}px wide; about ${Math.round(need)}px is enough (${Math.round(effW)}px x DPR ${dpr}).${chosen && chosen.w ? '' : ' Add a srcset with smaller widths.'}`);
        }
      }
      if (fileW < needCapped * 0.85) add('warn', `BLURRY RISK: file is ${fileW}px wide; ${Math.round(effW)}px x DPR ${Math.min(dpr, 2)} needs about ${Math.round(needCapped)}px.`);
    }

    // 3. srcset / sizes
    for (const s of sets) {
      if (s.cands.some((c) => c.w) && !s.sizes) { add('error', 'srcset with w descriptors but no sizes: the browser assumes 100vw.'); break; }
    }
    if (chosenSet && loaded && effW > 1) {
      const wc = chosenSet.cands.filter((c) => c.w);
      if (chosen && chosen.w && wc.length > 1) {
        const need = effW * dpr;
        const enough = wc.filter((c) => c.w >= need).sort((a, b) => a.w - b.w)[0];
        if (enough && chosen.w > enough.w * 1.3) add('warn', `SIZES TOO LARGE?: the browser chose ${chosen.w}w, but ${enough.w}w is enough for ${Math.round(effW)}px x DPR ${dpr}. Check sizes="${chosenSet.sizes || '(missing = 100vw)'}". (A larger file in the cache can also cause this: retest in a private window.)`);
      }
    }

    // 4. loading priority
    if (isLcp && loading === 'lazy') add('error', `${lcpWord} is loading="lazy". Remove it.`);
    if (isLcp && fp !== 'high' && !(pre && pre.fp === 'high')) add('warn', `${lcpWord} without fetchpriority="high".`);
    if (isLcp && (img.hasAttribute('data-src') || img.hasAttribute('data-srcset'))) add('warn', `${lcpWord} uses JavaScript lazy loading (data-src). Use a real src/srcset in the HTML.`);
    if (!isLcp && inFirstViewport && loading === 'lazy') add('warn', 'Visible in the first viewport but loading="lazy".');
    if (!hidden && !inFirstViewport && top > vh * 1.25 && loading !== 'lazy') add('info', 'Below the fold but not lazy. Add loading="lazy" if it is below the fold at every screen width.');
    if (hidden && loading !== 'lazy' && loaded) add('info', 'Hidden image that was downloaded anyway (not lazy). Use loading="lazy", or <picture> for mobile/desktop variants.');
    if (fp === 'high' && !inFirstViewport) add('warn', 'fetchpriority="high" on an image that is not in the first viewport at this width.');
    if (fp === 'high' && loading === 'lazy') add('error', 'fetchpriority="high" together with loading="lazy".');

    // 5. dimensions
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      const ar = cs.aspectRatio;
      if (!ar || ar === 'auto') add('warn', 'No width/height attributes and no CSS aspect-ratio: layout shift risk (unless CSS gives it a fixed width and height).');
    }

    // 6. alt (policy: every image has a filled, descriptive alt)
    const alt = img.getAttribute('alt');
    if (alt === null) add('error', 'MISSING ALT: every image must have a filled, descriptive alt.');
    else if (!alt.trim()) add('error', 'EMPTY ALT: every image must have a filled alt. Decorative or duplicate image: describe it and add aria-hidden="true".');
    else if (GENERIC_ALT_RE.test(alt.trim())) add('warn', `ALT NOT DESCRIPTIVE: alt="${alt.trim()}" does not describe the image.`);
    else if (FILENAME_ALT_RE.test(alt.trim())) add('warn', `ALT IS A FILE NAME: alt="${alt.trim()}".`);
    else if (/^(an?\s+)?(image|picture|photo|photograph|graphic|pic)\s+(of|showing|with)\b/i.test(alt.trim())) add('info', `ALT PREFIX: "${alt.trim().split(/\s+/).slice(0, 2).join(' ')} ..." (screen readers already say "image"; start with the content).`);
    else if (alt.trim().length > 150) add('info', `ALT TOO LONG: ${alt.trim().length} characters (keep it under ~125; use a caption for details).`);
    if (alt && alt.trim() && img.getAttribute('aria-hidden') === 'true' && img.closest('a, button') && !(img.closest('a, button').textContent || '').trim()) {
      add('error', 'aria-hidden image is the only content of a link/button: the link has no name. Remove aria-hidden.');
    }

    // 7. gif
    if (/\.gif(\?|$)/i.test(src)) {
      const res = resources.get(src);
      const kb = res ? Math.round((res.encodedBodySize || res.transferSize || 0) / 1024) : 0;
      if (kb > 100) add('info', `GIF of ${kb} KB. An animated GIF is usually much smaller as <video>.`);
    }

    const res = resources.get(src);
    const bytes = res ? (res.encodedBodySize || res.transferSize || 0) : 0;
    rows.push({
      image: id,
      role: isLcp ? (img === estimatedLcp ? 'LCP (estimated)' : 'LCP') : hidden ? 'hidden' : inFirstViewport ? 'first viewport' : 'below fold',
      src: short(src),
      displayed: hidden ? '-' : `${Math.round(cw)}x${Math.round(ch)}`,
      file: loaded ? `${fileW}x${fileH}` : 'not loaded',
      KB: bytes ? Math.round(bytes / 1024) : '?',
      loading,
      fetchpriority: fp,
      'request start (ms)': res ? Math.round(res.startTime) : '?',
      problems: list.length ? list.join(',') : 'ok',
    });
  });

  // ---------------------------------------------------------------- page-level
  const page = [];
  if (highCount > 2) page.push({ sev: 'warn', msg: `${highCount} images have fetchpriority="high". Use it on the LCP image only.` });

  // alt policy for non-<img> images: role="img" (CSS backgrounds, inline SVG), <input type="image">, <area>
  for (const el of document.querySelectorAll('[role="img"]:not(img)')) {
    const label = (el.getAttribute('aria-label') || '').trim() ||
      (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((i) => (document.getElementById(i)?.textContent || '').trim()).join(' ').trim() ||
      (el.tagName.toLowerCase() === 'svg' ? (el.querySelector('title')?.textContent || '').trim() : '');
    if (!label) page.push({ sev: 'error', msg: `<${el.tagName.toLowerCase()} role="img"> has no label. Add a filled aria-label (or <title> for SVG).`, el });
  }
  for (const el of document.querySelectorAll('input[type="image"], area[href]')) {
    if (!(el.getAttribute('alt') || '').trim()) page.push({ sev: 'error', msg: `<${el.tagName.toLowerCase()}> without a filled alt.`, el });
  }
  // social share image alt (in the HTML head)
  const ogImg = document.querySelector('meta[property="og:image"]');
  const ogAlt = document.querySelector('meta[property="og:image:alt"]');
  if (ogImg && !(ogAlt && (ogAlt.getAttribute('content') || '').trim())) page.push({ sev: 'error', msg: 'og:image has no filled og:image:alt.' });

  let lcpText = '';
  const estimateNote = estimatedLcp ? ` The checks use the largest image in the first viewport (image #${imgs.indexOf(estimatedLcp)}) as the estimated LCP.` : '';
  if (!lcpSupported) lcpText = `This browser does not report LCP. For exact LCP checks use Chrome or Edge.${estimateNote}`;
  else if (!lcp) lcpText = `The browser reported no LCP entry. Reload and run again without scrolling or clicking; if it is still missing, find the LCP element in the DevTools Performance panel.${estimateNote}`;
  else {
    const el = lcp.element;
    const t = Math.round(lcp.renderTime || lcp.loadTime || lcp.startTime);
    if (el && el.tagName === 'IMG') lcpText = `LCP: <img> ${short(lcp.url)} at ${t} ms (image ${imgs.indexOf(el) >= 0 ? '#' + imgs.indexOf(el) : ''})`;
    else if (lcp.url) {
      lcpText = `LCP: <${el ? el.tagName.toLowerCase() : '?'}> with image ${short(lcp.url)} at ${t} ms. This is a CSS background, a video poster or an SVG image.`;
      const pre = isPreloaded(lcp.url);
      if (pre) pre.used = true;
      if (!pre) page.push({ sev: 'warn', msg: 'The LCP image is a CSS background (or poster) and is not preloaded. Preload it with fetchpriority="high", or use an <img> with object-fit.' });
    } else lcpText = `LCP: text (<${el ? el.tagName.toLowerCase() : '?'}>) at ${t} ms. Images are not the LCP on this viewport.`;
    const lres = lcp.url ? resources.get(lcp.url) : null;
    if (lres) lcpText += ` Request started at ${Math.round(lres.startTime)} ms, finished at ${Math.round(lres.responseEnd)} ms.`;
  }

  // large CSS backgrounds in the first viewport
  const bgs = [];
  for (const el of document.querySelectorAll('body *')) {
    if (bgs.length > 20) break;
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none' || !bg.includes('url(')) continue;
    const r = el.getBoundingClientRect();
    const top = r.top + scrollY;
    if (top >= vh || r.width * r.height < vw * vh * 0.1) continue;
    const url = (/url\(["']?([^"')]+)["']?\)/.exec(bg) || [])[1];
    const pre = url ? isPreloaded(abs(url)) : null;
    if (pre) pre.used = true;
    bgs.push({ element: el, url: short(abs(url || '')), preloaded: !!pre });
  }
  for (const b of bgs) if (!b.preloaded) page.push({ sev: 'info', msg: `Large CSS background image in the first viewport: ${b.url}. If it is the LCP, preload it or switch to <img>.`, el: b.element });

  for (const p of preloads) {
    if (!p.used && (!p.media || matchMedia(p.media).matches)) page.push({ sev: 'warn', msg: `Image preload not used by any image on this page: ${short(p.href || (p.cands[0] && p.cands[0].url))}. Check that imagesrcset/imagesizes match the image exactly.`, el: p.el });
  }

  // ---------------------------------------------------------------- output
  const log = { error: console.error, warn: console.warn, info: console.info };
  console.group('%cimage-optimization: browser audit', 'font-weight:bold;font-size:14px');
  console.log(`Viewport ${vw}x${vh}, DPR ${dpr}, ${imgs.length} <img> elements. Run again at ${vw < 768 ? 'a desktop' : 'a mobile'} width.`);
  if (lcpText) console.log(lcpText, lcp && lcp.element ? lcp.element : '');
  console.table(rows);
  const all = [...page, ...issues];
  const order = { error: 0, warn: 1, info: 2 };
  all.sort((a, b) => order[a.sev] - order[b.sev]);
  for (const i of all) log[i.sev](`[${i.sev}]${i.image ? ' ' + i.image : ''}${i.src ? ' ' + i.src : ''}: ${i.msg}`, i.el || '');
  const counts = all.reduce((acc, i) => { acc[i.sev] = (acc[i.sev] || 0) + 1; return acc; }, {});
  console.log(`${counts.error || 0} errors, ${counts.warn || 0} warnings, ${counts.info || 0} info`);
  console.groupEnd();

  window.__imageAudit = {
    viewport: { width: vw, height: vh, dpr },
    lcp: lcpText,
    images: rows,
    issues: all.map(({ el, ...rest }) => rest),
    counts,
  };
  return window.__imageAudit.counts;
})();
