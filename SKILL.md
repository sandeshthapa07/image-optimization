---
name: image-optimization
description: Diagnose and fix web image problems - stretched, squished or distorted images, blurry or oversized downloads, layout shift (CLS), wrong srcset/sizes, slow LCP, misuse of loading="lazy"/"eager", fetchpriority and preload - and social share images (og:image, Open Graph, Twitter/X cards, link previews on Facebook, LinkedIn, WhatsApp, Slack, Discord). Works with HTML/CSS, React, Next.js, Remix, Gatsby, Vue, Nuxt, Angular, Svelte, SolidJS, Astro, Qwik, WordPress, Shopify, Eleventy and Hugo. Use when images stretch, look blurry, load slowly, shift the layout or differ between mobile and desktop; when a shared link shows no image, the wrong image or a cropped image; or when the user asks about responsive images, srcset, sizes, picture, AVIF/WebP, lazy loading, fetchpriority, LCP, CLS, og:image sizes, meta tags, next/image, NgOptimizedImage, NuxtImg, astro:assets, enhanced:img or Lighthouse image warnings.
license: MIT
---

# Image Optimization

Fix website images so that, on every screen size, they:

- keep their shape (no stretching or squishing),
- reserve their space (no layout shift),
- download the right file size for the device,
- load with the right priority (fast LCP, nothing wasted),
- show the right preview image when the page is shared (Open Graph / X cards).

## The one idea to remember

**Give every image a role first, then apply the recipe for that role.**
Most image bugs come from treating all images the same, for example `loading="lazy"` on every image, or `fetchpriority="high"` on every image.

## Workflow

Do the steps in order. Do not skip step 2.

### Step 1: Detect the stack

Read `package.json` (or `composer.json`, theme files, `hugo.toml`, ...). Find the framework and its **major version**, then open the matching file from [Framework files](#framework-files). Image components change between major versions. For example, Next.js 16 deprecated `priority` in favour of `preload`.

### Step 2: Inventory and classify

List every image that the change touches: `<img>`, `<picture>`, framework components (`<Image>`, `<NuxtImg>`, `<enhanced:img>`, ...) and CSS `background-image`. Give each image a role from [Image roles](#image-roles). If the task is about sharing or link previews, also list the `og:*` / `twitter:*` tags and go to [Social share images](#social-share-images-ogimage-x-cards).

If you cannot see the rendered page, find the **LCP candidate** with these hints:

- It is the first large image in the first section of a page, route or layout (hero, banner, cover, product main image, article lead image).
- It is usually 50% or more of the viewport width on mobile.
- A page has **one** LCP image. Sometimes a page has two: one in the mobile layout and one in the desktop layout.

If you are not sure, say so in the report and ask the user to confirm with `scripts/browser-audit.js`.

### Step 3: Apply the recipe

- Use the role table and the recipes below.
- Fix stretching with [Stretching quick diagnosis](#stretching-quick-diagnosis).
- Write `sizes` from the real CSS layout. Read `references/02-responsive-sizing.md`.
- Get intrinsic dimensions from the files. Do not guess them: run `node scripts/image-size.mjs <file-or-folder>`.

### Step 4: Verify

1. **Static check:** `node scripts/audit-images.mjs <project-folder>` (Node 18+, no dependencies).
2. **Browser check:** paste `scripts/browser-audit.js` into the DevTools console. Do this at the top of the page, after a reload, at mobile width and at desktop width. The script reports the LCP image, stretched images, oversized or blurry downloads, and lazy or priority mistakes.
3. **Lighthouse / PageSpeed Insights:** check LCP, CLS, "Improve image delivery", "LCP request discovery" and "Layout shift culprits".
4. **Share previews:** `node scripts/check-social-meta.mjs <url-or-built-html>` reads the tags like a crawler and checks the real `og:image` (size, ratio, file weight, status).

If you cannot run a browser, give the user the exact steps for check 2.

### Step 5: Report

For each changed image, give: its role, what was wrong, what you changed, and why. List every alt text you wrote that needs review. Tell the user what you could not verify (for example: "LCP image identified from the code; confirm with browser-audit.js"). Tell the user when a fix crops the image (`object-fit: cover`) or changes how it looks.

## Image roles

| Role | `loading` | `fetchpriority` | `decoding` | `srcset` / `sizes` | `width` + `height` |
|---|---|---|---|---|---|
| **LCP / hero** (one per page) | omit or `eager` | `high` | omit | `w` descriptors + accurate `sizes` | required |
| **Above the fold, not LCP** | omit or `eager` | omit | `async` | `w` + `sizes` | required |
| **Below the fold** | `lazy` | omit | `async` | `w` + `sizes` (`sizes="auto, ..."` allowed) | required |
| **Fixed size** (avatar, logo, icon) | `lazy` if below the fold | omit | `async` | `x` descriptors (`1x, 2x`) | required |
| **Carousel / tab / modal, not visible at load** | `lazy` | `low` | `async` | `w` + `sizes` | required |
| **CSS background, above the fold** | n/a | `high` on a preload `<link>` | n/a | `image-set()` | `aspect-ratio` on the element |
| **Decorative** | as for its position | omit | `async` | as for its position | required; filled `alt` + `aria-hidden="true"` |

**Every role needs a filled, descriptive `alt`.** See [Alt text policy](#alt-text-policy).

### Recipes (plain HTML; framework versions are in the framework files)

```html
<!-- LCP / hero: never lazy, one fetchpriority="high" per page -->
<img
  src="/img/hero-1200.jpg"
  srcset="/img/hero-640.jpg 640w, /img/hero-960.jpg 960w, /img/hero-1200.jpg 1200w,
          /img/hero-1920.jpg 1920w, /img/hero-2400.jpg 2400w"
  sizes="100vw"
  width="2400" height="1350"
  alt="Describe the image"
  fetchpriority="high">

<!-- Below the fold, in a 1 / 2 / 3 column grid -->
<img
  src="/img/card-640.jpg"
  srcset="/img/card-320.jpg 320w, /img/card-640.jpg 640w, /img/card-960.jpg 960w"
  sizes="auto, (min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
  width="960" height="640"
  alt="Describe the image"
  loading="lazy" decoding="async">

<!-- Fixed size: x descriptors, no sizes -->
<img src="/img/avatar-48.jpg" srcset="/img/avatar-48.jpg 1x, /img/avatar-96.jpg 2x"
     width="48" height="48" alt="Jane Doe" loading="lazy" decoding="async">
```

```css
/* Base CSS that every site needs */
img, picture, video, svg { max-width: 100%; height: auto; }
```

## Golden rules

1. Every `<img>` has `width` and `height` attributes with the **intrinsic aspect ratio** of the file. They reserve space. CSS still controls the displayed size.
2. If CSS sets one dimension, the other must be `auto`. To fill a box of a different shape, use `object-fit`.
3. The default `object-fit` is `fill`, and `fill` **stretches**. Use `cover` (crops) or `contain` (letterboxes), and `object-position` for the focal point.
4. All candidates in one `srcset` have the **same aspect ratio**. For a different crop per screen size, use `<picture>` with `<source media>`, and put `width`/`height` on each `<source>`.
5. A `srcset` with `w` descriptors always has `sizes`. Without `sizes`, the browser assumes `100vw` and downloads files that are too big.
6. `sizes` describes the **rendered CSS width** of the image, not the file width. The browser uses the first condition that matches.
7. Never lazy-load the LCP image, or any image that is visible in the first viewport.
8. Use `fetchpriority="high"` on one image per page. Use it on two only for separate mobile and desktop heroes. More than that cancels the benefit.
9. Preload only images that the HTML does not contain: CSS backgrounds, images added by JavaScript, client-rendered apps. An `<img>` in server HTML needs only `fetchpriority="high"`.
10. Never use JavaScript lazy loading (`data-src`) on above-the-fold images. The browser cannot discover them early.
11. For content and LCP images, prefer `<img>` with `object-fit` over CSS `background-image`.
12. Serve AVIF or WebP with a fallback. Use SVG for logos and icons. Replace animated GIFs with `<video>`.
13. Make the largest file about 2× the largest rendered width. Bigger files rarely look better.
14. On `<picture>`, put `loading`, `fetchpriority`, `alt`, `width` and `height` on the inner `<img>`. Put `width`/`height` on `<source>` only for art direction.
15. Do not use two `<img>` elements switched with `display: none` for mobile and desktop. An eager image downloads even when hidden. Use `<picture>`.
16. **Every image has a filled, descriptive `alt`:** never missing, never empty, never "image" or a file name. Purely decorative images also get a filled alt, plus `aria-hidden="true"`.

## Alt text policy

Every image must have a filled `alt`. This includes framework components, Markdown images (`![alt](src)`), `<input type="image">`, content CSS backgrounds (`role="img"` + `aria-label`), inline SVG images (`role="img"` + `<title>`/`aria-label`), and social images (`og:image:alt`, `twitter:image:alt`).

- **Write what the image shows that matters here:** product + variant, person + role, the action of a link, the main point of a chart. Under ~125 characters, no "Image of ...".
- **Get the text from:** the existing alt/CMS field, then the data next to the image (product name, heading, link text), then the image itself. If you still are not sure, write the best description from the context and list it as **"alt needs review"** in the report.
- **Decorative or duplicate images** (dividers, textures, an avatar next to the visible name): filled alt + `aria-hidden="true"`, so screen readers skip them. Never use `aria-hidden` on informative images or on the only content of a link or button.
- **Dynamic values fall back to a description**, never to `''`: `alt={img.alt || product.name}`.
- **Never:** missing alt, `alt=""`, `<img alt>`, `alt="image"`/`"photo"`/`"logo"`/`"placeholder"`, file names (`IMG_2041.jpg`), keyword stuffing, or the same alt on different images.

In the reference code samples, `alt="..."` is a placeholder. Always write a real description.

Details and framework notes: `references/06-accessibility-seo.md`.

## Stretching quick diagnosis

| Symptom | Likely cause | Fix |
|---|---|---|
| Image squished after you made it responsive | CSS `width: 100%` plus a `height` attribute, and no `height: auto` | Add `height: auto` |
| Image stretched in a fixed-size box (card, thumbnail) | CSS sets width and height, and `object-fit` is the default `fill` | `object-fit: cover` and `object-position` |
| Image squished in a flex row | `flex-shrink` makes the width smaller, but the height stays fixed | `flex-shrink: 0`, or `height: auto` and `min-width: 0`, or wrap the image in a `<div>` |
| Image stretched in a flex or grid container | Stretch alignment or `height: 100%` forces one dimension | Wrap the image, or `align-self: start`, or `object-fit: cover` |
| Shape changes between mobile and desktop | One `srcset` mixes different crops | `<picture>` with `<source media>` and `width`/`height` on each source |
| CSS `aspect-ratio` is set and the image is distorted | `aspect-ratio` overrides the natural ratio, and `object-fit` is `fill` | Add `object-fit: cover` |
| Next.js `fill` or Angular `fill` image stretched | `fill` mode with the default `object-fit: fill` | `object-fit: cover` through `style` or a class |
| Tailwind `w-full h-64` image distorted | No object-fit utility | Add `object-cover` |
| Blurry on phones or retina screens | The file is narrower than rendered width × DPR, or `sizes` is too small | Add larger `srcset` candidates, fix `sizes` |
| Small image pixelated | CSS displays it larger than its natural size | Use a larger source, or cap the width with `max-width` |
| Photo is sideways, or the reserved space is wrong | EXIF orientation: the file is rotated when displayed | Swap `width`/`height`, or re-export the file with orientation applied |

## Do not

- Do not add `fetchpriority="high"`, `priority` or `preload` to every image.
- Do not add `loading="lazy"` to images in the first viewport.
- Do not use both `loading="lazy"` and `fetchpriority="high"`, or a preload, on the same image. They conflict.
- Do not guess intrinsic dimensions. Read them from the file (`scripts/image-size.mjs`), the CMS or the CDN metadata.
- Do not leave any image without a filled, descriptive `alt`, and do not invent details you cannot see; mark uncertain alt text for review.
- Do not change how an image looks (crop, focal point) without telling the user.
- Do not use framework image props from memory. Check the installed major version first.

## Social share images (og:image, X cards)

The `og:image` is not shown on the page. Platform crawlers download it when someone shares the link. Rules:

1. **One 1200 × 630 px image (1.91:1), JPG or PNG, under ~300 KB** works on Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, iMessage, Teams and Bluesky. Never SVG or AVIF.
2. **Absolute `https://` URL** on the production domain. Relative URLs, `localhost` and pages behind a login give no preview.
3. **Tags in the server HTML.** Crawlers do not run JavaScript, so tags set in a client-rendered SPA are invisible. Use SSR, SSG or prerendering.
4. Add `og:image:width`, `og:image:height` (the real size), `og:image:alt` and `<meta name="twitter:card" content="summary_large_image">`. Use `property=` for `og:*` and `name=` for `twitter:*`.
5. Keep text and logos in the centre safe zone (60 px margins; X crops to 2:1, square thumbnails crop to the centre).
6. When the image changes, use a **new URL** and refresh the platform caches (Facebook Sharing Debugger, LinkedIn Post Inspector).

| Platform | Size | Ratio | Max file |
|---|---|---|---|
| Facebook | 1200 × 630 (min 200 × 200; below 600 × 315 shows small) | 1.91:1 | 8 MB |
| LinkedIn | 1200 × 627 | 1.91:1 | 5 MB |
| X `summary_large_image` | 1200 × 600 (1200 × 630 is cropped slightly) | 2:1 | 5 MB |
| X `summary` | 800 × 800 (min 144 × 144) | 1:1 | 5 MB |
| WhatsApp | 1200 × 630 | 1.91:1 | ~300 KB (tested, not documented) |
| Pinterest | 1000 × 1500 | 2:3 | |
| Google structured data | ≥ 1200 px wide, three versions | 16:9, 4:3, 1:1 | |

Tools: `node scripts/make-social-images.mjs <source> --presets=og,twitter` creates the crops (needs `sharp`) and prints the tags. `examples/og-image-template.html` is a 1200 × 630 design template. Details: `references/07-social-share-images.md` (platforms, tags, design, hosting, troubleshooting) and `references/08-social-meta-frameworks.md` (Next.js metadata and `next/og`, Nuxt `useSeoMeta`, Angular `Meta`, SvelteKit, Astro, Remix, WordPress, Shopify, Satori, ...).

## Reference map

| Need | Read |
|---|---|
| Stretching, aspect ratio, CLS, object-fit, flex/grid | `references/01-layout-stretching.md` |
| srcset, sizes, picture, art direction, DPR, breakpoints | `references/02-responsive-sizing.md` |
| lazy/eager, fetchpriority, decoding, preload, LCP, carousels | `references/03-loading-priority.md` |
| AVIF/WebP, quality, SVG, GIF to video, caching | `references/04-formats-compression.md` |
| CSS background images, `image-set()` | `references/05-css-backgrounds.md` |
| Alt text policy, writing alt, decorative images, SEO | `references/06-accessibility-seo.md` |
| og:image / X cards: platform sizes, tags, design, hosting, testing, favicons | `references/07-social-share-images.md` |
| Social meta tags and generated OG images in each framework | `references/08-social-meta-frameworks.md` |
| Step-by-step review of a page | `checklists/audit-checklist.md` |
| Before/after of common mistakes | `checklists/anti-patterns.md` |
| Copy-paste HTML (incl. `social-meta-tags.html`, `og-image-template.html`) | `examples/` |

## Framework files

| Found in dependencies or files | Read |
|---|---|
| `next` | `references/frameworks/nextjs.md` |
| `react` without a meta-framework (Vite, CRA), or `preact` | `references/frameworks/react.md` |
| `react-router` v7 (framework mode), `@remix-run/*`, `@tanstack/react-start` | `references/frameworks/remix-react-router.md` |
| `gatsby` | `references/frameworks/gatsby.md` |
| `vue` without Nuxt (also Vuetify, Quasar) | `references/frameworks/vue.md` |
| `nuxt`, `@nuxt/image` | `references/frameworks/nuxt.md` |
| `@angular/core` | `references/frameworks/angular.md` |
| `svelte`, `@sveltejs/kit` | `references/frameworks/svelte.md` |
| `solid-js`, `@solidjs/start` | `references/frameworks/solid.md` |
| `astro` | `references/frameworks/astro.md` |
| `@builder.io/qwik`, `@qwik.dev/core` | `references/frameworks/qwik.md` |
| `wp-content/`, `functions.php`, `theme.json` | `references/frameworks/wordpress.md` |
| `*.liquid`, `layout/theme.liquid` | `references/frameworks/shopify.md` |
| `@11ty/eleventy`, `hugo.toml` / `config.toml`, Jekyll `_config.yml`, Docusaurus | `references/frameworks/static-site-generators.md` |
| Images from a CDN or CMS (Cloudinary, Imgix, Contentful, Sanity, Storyblok, Shopify CDN, ...) | `references/frameworks/unpic-and-image-cdns.md` |

## Report template

```
## Image fixes

| Image | Role | Problem | Fix |
|---|---|---|---|
| Hero (src/components/Hero.tsx:14) | LCP | loading="lazy", no sizes | removed lazy, fetchPriority="high", sizes="100vw" |
| Product cards (ProductCard.tsx:22) | below fold | stretched in 4:3 box | object-fit: cover (crops edges slightly) |

Not verified: <what and why>. To confirm, run scripts/browser-audit.js at 390px and 1440px widths.
```
