# Image optimization rules

Use these rules whenever you add, change or review images on a website: `<img>`, `<picture>`, framework image components and CSS background images. They prevent stretched images, layout shift (CLS), wrong file sizes and a slow LCP.

## Workflow

1. **Detect the stack:** read `package.json` (or the theme files). Find the framework and its major version. Image props change between versions.
2. **Classify each image** with a role from the table below. The LCP image is the largest image in the first viewport (hero, banner, main product image). There is one per page (sometimes one for mobile and one for desktop).
3. **Apply the recipe for the role.** Fix stretching with the stretching table.
4. **Verify:** Lighthouse/PageSpeed (LCP, CLS, "Improve image delivery"), and DevTools (hover the `<img>`: the rendered and intrinsic aspect ratios must match).
5. **Report** for each image: role, problem, fix. Say what you could not verify. Say when a fix crops the image.

## Image roles

| Role | loading | fetchpriority | decoding | srcset / sizes | width + height |
|---|---|---|---|---|---|
| LCP / hero (one per page) | omit or eager | high | omit | w descriptors + accurate sizes | required |
| Above the fold, not LCP | omit or eager | omit | async | w + sizes | required |
| Below the fold | lazy | omit | async | w + sizes (`sizes="auto, ..."` allowed) | required |
| Fixed size (avatar, logo, icon) | lazy if below the fold | omit | async | `1x, 2x` | required |
| Carousel / tab / modal, not visible at load | lazy | low | async | w + sizes | required |
| CSS background above the fold | n/a | high on a preload link | n/a | `image-set()` | `aspect-ratio` on the element |
| Decorative | by position | omit | async | by position | required; filled `alt` + `aria-hidden="true"` |

```html
<!-- LCP -->
<img src="/img/hero-1200.jpg"
     srcset="/img/hero-640.jpg 640w, /img/hero-1200.jpg 1200w, /img/hero-1920.jpg 1920w, /img/hero-2400.jpg 2400w"
     sizes="100vw" width="2400" height="1350" alt="..." fetchpriority="high">
<!-- Below the fold, 1/2/3 column grid -->
<img src="/img/card-640.jpg" srcset="/img/card-320.jpg 320w, /img/card-640.jpg 640w, /img/card-960.jpg 960w"
     sizes="auto, (min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
     width="960" height="640" alt="..." loading="lazy" decoding="async">
```

```css
img, picture, video, svg { max-width: 100%; height: auto; }
```

## Golden rules

1. Every `<img>` has `width` and `height` with the intrinsic aspect ratio of the file. Read the real size; do not guess.
2. If CSS sets one dimension, the other is `auto`. To fill a box of another shape, use `object-fit`.
3. The default `object-fit` is `fill`, and it stretches. Use `cover` (crop) or `contain` (letterbox), and `object-position`.
4. All candidates in one `srcset` have the same ratio. Different crops per screen: `<picture>` + `<source media>` with `width`/`height` on each source.
5. A `srcset` with `w` descriptors always has `sizes`. Without it, the browser assumes `100vw`.
6. `sizes` = the rendered CSS width at each breakpoint. First matching condition wins; put the largest `min-width` first.
7. Never lazy-load the LCP image or any image in the first viewport.
8. `fetchpriority="high"` on one image per page (two only for separate mobile/desktop heroes).
9. Preload only images that the HTML does not contain (CSS backgrounds, JavaScript-inserted images, client-rendered SPAs). The preload must use the same `imagesrcset`/`imagesizes` as the image.
10. No JavaScript lazy loading (`data-src`) above the fold.
11. Prefer `<img>` + `object-fit` over CSS backgrounds for content and LCP images.
12. AVIF/WebP with a fallback; SVG for logos and icons; `<video>` instead of animated GIFs.
13. Largest file ≈ 2× the largest rendered width.
14. On `<picture>`, put `loading`, `fetchpriority`, `alt` on the `<img>`.
15. Never switch two `<img>` elements with `display: none` for mobile/desktop: the eager one downloads anyway. Use `<picture>`.
16. **Every image has a filled, descriptive `alt`** (see the alt text policy below).

## Alt text policy

- Every image must have a filled `alt`: `<img>`, framework image components, Markdown `![alt](src)`, `<input type="image">`, content CSS backgrounds (`role="img"` + `aria-label`), inline SVG images (`role="img"` + `<title>`/`aria-label`), and `og:image:alt` / `twitter:image:alt`.
- Write what the image shows that matters in this context (product + variant, person + role, link action, chart's main point). Under ~125 characters. No "Image of ...".
- Source of the text: existing alt/CMS field → data next to the image (product name, heading, link text) → the image itself. If unsure, write the best description and list it as "alt needs review" in your report.
- Decorative or duplicate images: filled alt + `aria-hidden="true"` (screen readers skip them). Never `aria-hidden` on informative images or on the only content of a link/button.
- Dynamic values fall back to a description, never to an empty string: `alt={img.alt || product.name}`.
- Never: missing alt, `alt=""`, `<img alt>`, generic alt ("image", "photo", "logo", "placeholder"), file names ("IMG_2041.jpg"), keyword stuffing, the same alt on different images.

## Stretching

| Symptom | Cause | Fix |
|---|---|---|
| Squished after making it responsive | `width: 100%` + height attribute, no `height: auto` | `height: auto` |
| Stretched in a fixed box | Both dimensions set, `object-fit: fill` | `object-fit: cover` |
| Squished in a flex row | `flex-shrink` reduces the width only | `flex-shrink: 0`, or wrap the image |
| Stretched in flex/grid | Stretch alignment / `height: 100%` | Wrap the image, `align-self: start`, or `object-fit` |
| Shape changes per screen | Different crops in one `srcset` | `<picture>` art direction |
| `aspect-ratio` on the image distorts it | Overrides the natural ratio | `object-fit: cover` |
| Next.js/Angular `fill` stretched | Default `object-fit: fill` | `object-fit: cover` |
| Tailwind `w-full h-64` distorted | No object-fit utility | `object-cover` |
| Blurry on retina | File narrower than rendered width × DPR | Larger candidates, correct `sizes` |

## Social share images (og:image, X cards)

- One **1200 × 630** (1.91:1) JPG or PNG, **under ~300 KB** (WhatsApp), works on Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, iMessage. Never SVG/AVIF. Limits: Facebook 8 MB (min 200 × 200; below 600 × 315 shows small), LinkedIn 5 MB (1200 × 627), X 5 MB (`summary_large_image` is 2:1, 1200 × 600; `summary` is 1:1, min 144 × 144). Pinterest prefers 2:3 (1000 × 1500). Google structured data: 16:9, 4:3 and 1:1, each ≥ 1200 px wide.
- **Absolute `https://` URL** on the production domain; HTTP 200; `image/jpeg` or `image/png`; not blocked for crawlers (facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp, Slackbot, Discordbot, TelegramBot).
- **Tags must be in the server HTML.** Crawlers do not run JavaScript, so tags set in a client-rendered SPA are invisible (use SSR/SSG/prerender).
- Required set: `og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt` (all with `property=`), and `<meta name="twitter:card" content="summary_large_image">`. Optional `twitter:image` with an exact 2:1 crop.
- Keep text and logos inside the centre (60 px margins); X crops to 2:1 and square thumbnails crop to the centre.
- On change: new image URL (`og-v2.jpg` or `?v=2`), then refresh caches with the Facebook Sharing Debugger and LinkedIn Post Inspector; preview X by drafting a post.
- Frameworks: Next.js `metadata`/`generateMetadata` with `metadataBase`, `opengraph-image.tsx` + `next/og`; Nuxt `useSeoMeta`; Angular `Meta.updateTag` + SSR; SvelteKit `<svelte:head>`; Astro layout with `new URL(src, Astro.site)`; React Router/Remix `meta` export (child replaces parent); WordPress SEO plugin or `add_image_size('og-image', 1200, 630, true)`; Shopify `page_image | image_url: width: 1200, height: 630, crop: 'center'` with an `https:` prefix.

## Framework notes (check the installed version)

- **Next.js** `next/image`: lazy by default. LCP: `priority` (13–15) or `loading="eager" fetchPriority="high"` (16+, `priority` deprecated). Remote images need `width`/`height`. `fill` needs a positioned, sized parent, `sizes` and `objectFit: 'cover'`. CSS-resized images: `style={{ width: '100%', height: 'auto' }}`. Art direction: `getImageProps()`.
- **React** (Vite/CRA): plain `<img>`. `fetchPriority` in React 19+, lowercase `fetchpriority` in React ≤18. Client-rendered SPA: preload the LCP image in `index.html`. React 19: `preload()` from `react-dom`.
- **React Router v7 / Remix**: no image component; `links` export for preloads; `@unpic/react` for CDN images.
- **Gatsby**: `StaticImage`/`GatsbyImage` are lazy by default; LCP `loading="eager"`.
- **Vue**: plain `<img>` (`:srcset`, `fetchpriority`). Vuetify `v-img`: `eager` for LCP, `cover`, `aspect-ratio`. Quasar `q-img`: `loading`, `fetchpriority`, `ratio`.
- **Nuxt** `@nuxt/image`: `sizes="100vw sm:50vw md:400px"` (breakpoint prefixes, not media queries). `fit` resizes the file; CSS `object-fit` is separate. LCP: `loading="eager" fetchpriority="high" preload`. `<NuxtPicture>`: pass `<img>` attributes with `img-attrs`.
- **Angular** `NgOptimizedImage`: `ngSrc` + `width`/`height` (or `fill`). `priority` on the LCP image only. A loader is needed for automatic `srcset`. `fill` needs `sizes` and `object-fit`. Read the dev-mode console warnings.
- **Svelte/SvelteKit**: HTML attribute names. `@sveltejs/enhanced-img` for local images: `<enhanced:img src="./x.jpg" sizes="..." fetchpriority="high">`; use source files at 2×.
- **SolidJS**: HTML attribute names (`srcset`, `fetchpriority`, `class`). Preload with `@solidjs/meta` `<Link>`.
- **Astro** `astro:assets`: `<Image>` is lazy by default; 5.10+: `layout`, `fit`, `position`, `priority`. Older: `loading="eager" fetchpriority="high"`. `public/` images are not optimized.
- **Qwik**: `import Img from '~/media/x.jpg?jsx'`; set `loading` and `sizes` yourself.
- **WordPress**: `wp_get_attachment_image( $id, $size, false, [ 'loading' => 'eager', 'fetchpriority' => 'high', 'sizes' => '100vw' ] )` for the hero. Same-ratio image sizes for a good `srcset`.
- **Shopify**: `image_url | image_tag: widths: '...', sizes: '...', loading: ..., fetchpriority: ...`; use `section.index == 1` to detect the hero.
- **CDN/CMS images in any framework**: `@unpic/<framework>`, or build the `srcset` from the CDN's resize parameters.

## Do not

- Do not add `fetchpriority="high"`, `priority` or `preload` to every image.
- Do not combine `loading="lazy"` with `fetchpriority="high"` or a preload.
- Do not guess intrinsic dimensions.
- Do not leave any image without a filled, descriptive alt.
- Do not crop or change how an image looks without telling the user.
- Do not use framework image props from memory; check the version.
