# Anti-patterns: before and after

Each item: what is wrong, why it is wrong, and the fix.

## 1. Lazy-loaded hero

```html
<!-- BAD -->
<img src="hero.jpg" loading="lazy" alt="...">
<!-- GOOD -->
<img src="hero.jpg" srcset="..." sizes="100vw" width="2400" height="1350" fetchpriority="high" alt="...">
```

The browser must wait for layout before it loads a lazy image. LCP is often 0.5–2 s slower.

## 2. fetchpriority="high" on every image

```html
<!-- BAD: 12 product images, all "high" -->
<img src="p1.jpg" fetchpriority="high" ...> <img src="p2.jpg" fetchpriority="high" ...>
<!-- GOOD: only the LCP image -->
<img src="p1.jpg" fetchpriority="high" ...> <img src="p2.jpg" ...>
```

When everything is high priority, nothing is. The images also compete with CSS and fonts.

## 3. srcset with w descriptors and no sizes

```html
<!-- BAD: the browser assumes 100vw, so a 300px card downloads the 1600px file -->
<img src="c.jpg" srcset="c-400.jpg 400w, c-800.jpg 800w, c-1600.jpg 1600w" alt="Blue backpack">
<!-- GOOD -->
<img src="c.jpg" srcset="c-400.jpg 400w, c-800.jpg 800w, c-1600.jpg 1600w"
     sizes="(min-width: 1024px) 300px, 50vw" width="1600" height="1200" alt="Blue backpack">
```

## 4. sizes="100vw" on everything

`sizes="100vw"` on a 4-column grid makes each card download a file about 4× too wide. Calculate the slot width from the CSS (`references/02-responsive-sizing.md`).

## 5. width: 100% without height: auto

```css
/* BAD: the height attribute (600) stays, the width changes -> squished */
img { width: 100%; }
/* GOOD */
img { width: 100%; height: auto; }
```

## 6. Fixed width and height without object-fit

```css
/* BAD */
.avatar { width: 64px; height: 64px; border-radius: 50%; }
/* GOOD */
.avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
```

## 7. Images squished in a flex row

```css
/* BAD: the image shrinks horizontally; its height stays */
.item { display: flex; } .item img { width: 120px; height: 120px; }
/* GOOD */
.item img { width: 120px; height: 120px; flex-shrink: 0; object-fit: cover; }
```

## 8. Different crops in one srcset

```html
<!-- BAD: portrait file for small screens, landscape for large ones, in one srcset -->
<img srcset="tall-600.jpg 600w, wide-1600.jpg 1600w" sizes="100vw" width="1600" height="900" alt="Runner on a mountain trail">
<!-- GOOD: art direction -->
<picture>
  <source media="(min-width: 768px)" srcset="wide-1600.jpg 1600w, wide-2400.jpg 2400w" sizes="100vw" width="2400" height="1350">
  <img src="tall-600.jpg" srcset="tall-600.jpg 600w, tall-1080.jpg 1080w" sizes="100vw" width="1080" height="1350" alt="Runner on a mountain trail">
</picture>
```

## 9. Two images switched with display: none

```html
<!-- BAD: both download; the hidden one is wasted -->
<img class="mobile-only" src="hero-mobile.jpg" alt="Summer collection">
<img class="desktop-only" src="hero-desktop.jpg" alt="Summer collection">
```

Fix: one `<picture>` with `<source media>` (see 8).

## 10. JavaScript lazy loading on the hero

```html
<!-- BAD: the preload scanner cannot see data-src -->
<img data-src="hero.jpg" class="lazyload" alt="Summer collection">
<!-- GOOD -->
<img src="hero.jpg" fetchpriority="high" width="..." height="..." alt="Summer collection">
```

## 11. CSS background hero without a preload

```css
.hero { background-image: url(hero.jpg); } /* found only after the CSS is parsed */
```

Fix: an `<img>` with `object-fit: cover`, or a `<link rel="preload" as="image" fetchpriority="high">` (`references/05-css-backgrounds.md`).

## 12. A preload that does not match the image

```html
<!-- BAD: the preload gets hero.jpg, the <img> chooses hero-1280.jpg from srcset -> two downloads -->
<link rel="preload" as="image" href="hero.jpg">
<img src="hero.jpg" srcset="hero-640.jpg 640w, hero-1280.jpg 1280w" sizes="100vw" alt="Summer collection">
<!-- GOOD -->
<link rel="preload" as="image" imagesrcset="hero-640.jpg 640w, hero-1280.jpg 1280w" imagesizes="100vw" fetchpriority="high">
```

Even better: if the `<img>` is in the HTML, remove the preload and use `fetchpriority="high"` on the `<img>`.

## 13. Lazy images without dimensions

Without `width`/`height`, lazy images are 0×0 until they load. Many of them are "in the viewport" at once, so they all load, and the page jumps when they appear.

## 14. Upscaled small images and huge originals

- A 400px image shown at 1200px looks pixelated. Use a larger source.
- A 6000px camera original shown at 600px wastes megabytes. Resize it.

## 15. Animated GIF

A 5 MB GIF is often a 300 KB MP4. Use `<video autoplay muted loop playsinline>` (`references/04-formats-compression.md`).

## 16. Next.js `fill` without sizes and object-fit

```tsx
// BAD: stretched, and 100vw files for a small card
<Image src={src} fill alt={product.name} />
// GOOD
<div className="relative aspect-[4/3]">
  <Image src={src} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" alt={product.name} />
</div>
```

## 17. Attributes on the wrong element in `<picture>`

```html
<!-- BAD: loading and fetchpriority on <source> are ignored -->
<picture><source srcset="a.avif" type="image/avif" loading="lazy"><img src="a.jpg" alt="Red running shoe"></picture>
<!-- GOOD -->
<picture><source srcset="a.avif" type="image/avif"><img src="a.jpg" loading="lazy" width="800" height="600" alt="Red running shoe"></picture>
```

## 18. Missing or useless alt

```html
<!-- BAD --> <img src="shoe.jpg"> <img src="shoe.jpg" alt="image"> <img src="divider.png" alt="divider">
<!-- GOOD --> <img src="shoe.jpg" alt="Red running shoe, side view">
<!-- GOOD (decorative: filled alt + aria-hidden so screen readers skip it) -->
<img src="divider.png" alt="Decorative wave divider" aria-hidden="true">
```

## 19. Carousel library lazy-loads slide 1

Many slider libraries add JavaScript lazy loading to all slides. Turn it off for slide 1, give slide 1 `fetchpriority="high"`, and use native `loading="lazy"` for the other slides.

## 20. Relative or local og:image

```html
<!-- BAD: crawlers cannot use these -->
<meta property="og:image" content="/og.png">
<meta property="og:image" content="http://localhost:3000/og.png">
<!-- GOOD -->
<meta property="og:image" content="https://acme.com/social/og-1200x630.jpg">
```

## 21. Social tags added by client JavaScript

`react-helmet` or `useHead` in a client-rendered SPA changes the tags only in the browser. Crawlers read the raw HTML and see only `index.html`. Fix: SSR, SSG or prerendering (`references/08-social-meta-frameworks.md`).

## 22. Wrong og:image file

```html
<!-- BAD: SVG logo; or a 4000x3000 7 MB camera photo; or width/height that do not match the file -->
<meta property="og:image" content="https://acme.com/logo.svg">
<meta property="og:image" content="https://acme.com/uploads/IMG_2041.jpg">
<meta property="og:image:width" content="1200"> <!-- real file is 4000x3000 -->
<!-- GOOD: 1200x630 JPG under 300 KB, real dimensions -->
<meta property="og:image" content="https://acme.com/social/og-1200x630.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

## 23. og tags with name= and no twitter:card

```html
<!-- BAD -->
<meta name="og:image" content="https://acme.com/og.jpg">
<!-- GOOD -->
<meta property="og:image" content="https://acme.com/og.jpg">
<meta name="twitter:card" content="summary_large_image">
```

## 24. Fade-in on the LCP image

```css
/* BAD: LCP is recorded only when opacity becomes > 0, after JavaScript runs */
.hero img { opacity: 0; transition: opacity .5s; } .hero img.loaded { opacity: 1; }
```

Fix: no fade-in on the LCP image. Use a background colour or a blurred placeholder on the wrapper instead.
