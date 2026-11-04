# Image audit checklist

Use this list to review a page or a pull request. Check the page at a **mobile width (about 390px)** and a **desktop width (about 1440px)**.

## 0. Preparation

- [ ] Framework and major version identified (`package.json` and similar files)
- [ ] Matching framework file read (`references/frameworks/`)
- [ ] All images listed: `<img>`, `<picture>`, framework components, CSS backgrounds
- [ ] Each image has a role: LCP, above the fold, below the fold, fixed size, hidden (carousel/tab/modal), background, decorative

## 1. Layout and stretching

- [ ] Every `<img>` has `width` and `height` with the intrinsic ratio (or the framework equivalent: static import, `fill`, `layout`)
- [ ] Base CSS has `img { max-width: 100%; height: auto; }`
- [ ] Every image that gets both a CSS width and a CSS height (or `aspect-ratio`) has `object-fit` (`cover` or `contain`)
- [ ] Images in flex rows cannot shrink without keeping their ratio (`flex-shrink: 0`, or `height: auto`, or a wrapper)
- [ ] No stretch alignment forces one dimension of an image
- [ ] `fill` images (Next.js, Angular) have a positioned parent with a size, and `object-fit`
- [ ] Containers that receive images later (JavaScript, CMS embeds) reserve space with `aspect-ratio`
- [ ] `browser-audit.js` reports no stretched images

## 2. Responsive sizing

- [ ] Fluid images use `srcset` with `w` descriptors
- [ ] Every `w`-descriptor `srcset` has a `sizes` that matches the CSS layout at every breakpoint
- [ ] Fixed-size images use `1x, 2x` descriptors
- [ ] All `srcset` candidates have the same aspect ratio. Different crops use `<picture>` + `<source media>` with `width`/`height`
- [ ] The largest candidate is about 2× the largest rendered width (not much bigger, not smaller)
- [ ] No two `<img>` elements switched with `display: none` for mobile/desktop
- [ ] `browser-audit.js` reports no oversized or blurry images

## 3. Loading priority

- [ ] The LCP image is identified (with `browser-audit.js` or DevTools Performance panel at both widths)
- [ ] The LCP image is not lazy (no `loading="lazy"`, no `data-src`, no framework lazy default)
- [ ] The LCP image has `fetchpriority="high"` (or the framework's priority prop)
- [ ] `fetchpriority="high"` is on one image (two at most, for separate mobile/desktop heroes)
- [ ] All other images in the first viewport are not lazy
- [ ] Images below the fold, and hidden images (slides 2+, tabs, modals), have `loading="lazy"`
- [ ] Hidden carousel slides have `fetchpriority="low"`
- [ ] Preloads exist only for images that are not in the HTML (CSS background, JavaScript, SPA), and match the image's `srcset`/`sizes`
- [ ] No image is both lazy and high priority (or preloaded)
- [ ] No fade-in animation or JavaScript gate delays the LCP image
- [ ] `preconnect` exists for the CDN origin of the LCP image (if it is on another origin)

## 4. Formats and compression

- [ ] Photos are served as AVIF or WebP (CDN, `<picture type>`, or framework pipeline) with a fallback
- [ ] Logos and icons are SVG (optimized) where possible
- [ ] No large animated GIFs (use `<video>`)
- [ ] Files are resized and compressed; no original camera files in production
- [ ] Image file names contain a hash, with long `Cache-Control` (or a CDN that manages this)

## 5. Accessibility and SEO

- [ ] Every image has a **filled, descriptive** `alt` (never missing, never empty, never "image" or a file name), including framework components and Markdown images
- [ ] Decorative or duplicate images: filled alt + `aria-hidden="true"`; no `aria-hidden` on informative images or on the only content of a link/button
- [ ] Dynamic alt values fall back to a description (`img.alt || product.name`), never to an empty string
- [ ] Content CSS backgrounds and inline SVG images have `role="img"` + a filled label; `og:image:alt` and `twitter:image:alt` are filled
- [ ] Alt text written without certainty is listed as "alt needs review" in the report
- [ ] No important content or text only in CSS backgrounds or inside images

## 6. Social share images (if the page can be shared)

- [ ] `og:title`, `og:description`, `og:url`, `og:type`, `og:image` exist, with `property=`
- [ ] `og:image` is an absolute `https://` URL on the production domain (not relative, not localhost, not behind a login)
- [ ] The image is 1200 × 630 (1.91:1), JPG or PNG, under ~300 KB (never SVG/AVIF)
- [ ] `og:image:width`/`og:image:height` match the real file; `og:image:alt` is set
- [ ] `<meta name="twitter:card" content="summary_large_image">` exists (optional `twitter:image` at 1200 × 600)
- [ ] The tags are in the server HTML (view the page source, or `check-social-meta.mjs`), not added by client JavaScript
- [ ] Each page has its own image where it makes sense (product, article), with a site default
- [ ] Only one set of tags (no theme + plugin duplicates)
- [ ] Text and logo are inside the safe zone (centre, 60 px margins)
- [ ] Crawlers are not blocked (robots.txt, firewall, bot protection, hotlink protection)
- [ ] `node scripts/check-social-meta.mjs <url>` reports no errors; Facebook Sharing Debugger and LinkedIn Post Inspector show the right preview

## 7. Verification

- [ ] `node scripts/audit-images.mjs <dir>` reports no errors
- [ ] `browser-audit.js` was run at mobile and desktop widths
- [ ] Lighthouse/PageSpeed: LCP image found early, no "lazily loaded LCP", no unsized images, "Improve image delivery" savings are small
- [ ] Report written: role, problem, fix and reason for each image; unverified items listed
