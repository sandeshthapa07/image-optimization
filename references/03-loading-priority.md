# Loading priority: lazy, eager, fetchpriority, decoding, preload

## How browsers load images

1. The **preload scanner** reads the raw HTML and finds `<img src/srcset>` early, before CSS and JavaScript run. Images that are not in the HTML (CSS backgrounds, JavaScript-inserted images, `data-src`) are found later.
2. Images start at low priority. Chromium raises the priority of images that are in the viewport after layout, and gives the first few large images medium priority.
3. `fetchpriority="high"` raises the image to high priority **from the start**, before layout. This is the main tool for a faster LCP.

## LCP (Largest Contentful Paint)

LCP is the time when the largest visible element in the first viewport is painted. It can be an `<img>`, an `<image>` inside SVG, a video poster, an element with a CSS `background-image` URL, or a text block.

Good LCP: 2.5 s or less (75th percentile of real users). An image LCP has 4 parts. Each part has a fix:

| Part | Cause | Fix |
|---|---|---|
| Time to first byte | Slow server | Caching, CDN, SSR/SSG |
| Resource load delay | Image found late or at low priority | Image in HTML, `fetchpriority="high"`, no lazy, preload if it is not in the HTML |
| Resource load duration | File too big | `srcset`/`sizes`, AVIF/WebP, compression, image CDN |
| Element render delay | Blocked by JavaScript, fonts, CSS, fade-in animations | Do not hide the image behind JavaScript, no fade-in on the LCP image |

## loading

| Value | Meaning |
|---|---|
| `eager` (default) | Load immediately |
| `lazy` | Load when the image is near the viewport. Chromium uses roughly 1250–2500px, depending on the connection. |

Rules:

- `loading="lazy"` on the LCP image is the most common image performance bug. The browser has to wait for layout before it can know that the image is in the viewport.
- Lazy images need `width`/`height`. Without them, they are 0×0, and many of them are "in the viewport" at once.
- Hidden images: with `display: none`, a lazy image does not load, but an **eager image still downloads**.
- Native `loading="lazy"` replaces JavaScript libraries (lazysizes, `vue-lazyload`, `react-lazyload`). If you keep a library, never use it for above-the-fold images.
- Many frameworks lazy-load by default: Next.js `<Image>`, Astro `<Image>`, Gatsby, Unpic, WordPress content images, Eleventy transform settings. Check the framework default before you change anything.

## fetchpriority

| Value | Use for |
|---|---|
| `high` | The LCP image. One per page (two only for separate mobile/desktop heroes). |
| `low` | Images that are in the HTML early but not important at first: carousel slides 2+, images in closed menus/tabs, decorative above-the-fold images |
| `auto` (default) | Everything else. Omit the attribute. |

- It works on `<img>`, `<link rel="preload">`, `<script>`, `<iframe>` and `fetch()`.
- Supported in all current major browsers. Older browsers ignore it safely.
- On `<picture>`, put it on the inner `<img>`.
- `fetchpriority="high"` + `loading="lazy"` on the same image is a contradiction. Remove the lazy.
- Too many `high` images compete with each other, and with CSS and fonts. The benefit disappears.

## decoding

- `async`: the browser may decode off the main thread. Use it for non-critical images. The effect is small.
- On the LCP image, omit it (default `auto`).
- Do not spend time on this attribute. Get `loading`, `fetchpriority` and `sizes` right first.

## preload

Use `<link rel="preload" as="image">` only when the browser cannot find the image early in the HTML:

- CSS `background-image` heroes,
- images inserted by JavaScript, client-rendered SPAs (Vite/CRA React, Vue, Svelte, Solid without SSR),
- an image inside a component that renders after data loads.

```html
<head>
  <!-- Responsive preload: use the same srcset and sizes as the image. No href, so older browsers do not download the wrong file. -->
  <link rel="preload" as="image" fetchpriority="high"
        imagesrcset="hero-640.jpg 640w, hero-1280.jpg 1280w, hero-1920.jpg 1920w"
        imagesizes="100vw">
</head>
```

- `imagesrcset`/`imagesizes` must match the real image exactly. If they do not match, the browser downloads two files.
- Different hero per breakpoint: use one preload per breakpoint, with `media`:

  ```html
  <link rel="preload" as="image" fetchpriority="high" media="(max-width: 767px)"
        imagesrcset="hero-tall-480.jpg 480w, hero-tall-1080.jpg 1080w" imagesizes="100vw">
  <link rel="preload" as="image" fetchpriority="high" media="(min-width: 768px)"
        imagesrcset="hero-wide-1280.jpg 1280w, hero-wide-2560.jpg 2560w" imagesizes="100vw">
  ```

- Do not preload format variants of `<picture type>` (AVIF and WebP). A browser that supports both downloads both. Use a CDN with automatic format, or rely on `fetchpriority="high"` on the `<img>`.
- Put preloads early in `<head>`, before scripts and stylesheets where possible.
- Do not preload images that are lazy-loaded or below the fold.
- Unused preloads show a console warning ("preloaded but not used within a few seconds"). That means the preload is wrong.
- Some hosts and frameworks can send the preload as an HTTP `Link` header or with 103 Early Hints. That is earlier than a `<link>` in the HTML.

## preconnect for image CDNs

If the LCP image is on another origin (a CDN), connect early:

```html
<link rel="preconnect" href="https://images.example-cdn.com">
```

Image requests normally do not use CORS, so do not add `crossorigin` unless the images are fetched with CORS. Use preconnect for one or two critical origins only.

## Patterns

### Hero image in server HTML

```html
<img src="hero-1280.jpg" srcset="..." sizes="100vw" width="2400" height="1350" alt="..." fetchpriority="high">
```

No preload is needed: the preload scanner finds it, and `fetchpriority` makes it high priority.

### Client-rendered SPA

Add the preload to `index.html` (or render the hero on the server). The JavaScript bundle must download and run before the `<img>` exists.

### Carousel / slider

```html
<!-- slide 1 is the LCP candidate -->
<img src="s1.jpg" ... fetchpriority="high" alt="...">
<!-- slides 2+ -->
<img src="s2.jpg" ... loading="lazy" fetchpriority="low" decoding="async" alt="...">
<img src="s3.jpg" ... loading="lazy" fetchpriority="low" decoding="async" alt="...">
```

- Carousel libraries often lazy-load every slide with JavaScript, including slide 1. Turn that off for slide 1.
- Autoplaying carousels often produce a late LCP, because the largest visible slide changes. Consider a static first slide.

### Mobile and desktop show different heroes

Use one `<picture>` with art direction. Do not use two `<img>` elements with `display: none` (the hidden eager image still downloads). If you must keep two elements, make both lazy except the one that the default layout shows, or switch them with `<picture>`.

### Tabs, accordions, modals, mega menus

`loading="lazy"`. Hidden content does not load until it is shown.

### Long lists and infinite scroll

`loading="lazy"` and `decoding="async"`, with dimensions. Optional: `content-visibility: auto` on the list items, with `contain-intrinsic-size`.

### Placeholders

- A dominant colour or a small blurred image (LQIP) as the background of the wrapper is fine.
- Do not set `opacity: 0` on the LCP image and fade it in with JavaScript. LCP is recorded only when the image is visible.
- Blurhash/ThumbHash decoded by JavaScript is fine for below-the-fold images. For the hero, a CSS background colour or an inline LQIP is enough.

## Quick decision

```
Is the image visible in the first viewport at load (at any common screen size)?
├─ No  -> loading="lazy" decoding="async"   (hidden carousel/tab: also fetchpriority="low")
└─ Yes -> no lazy
          Is it the LCP element (largest image above the fold)?
          ├─ No  -> no extra attributes (decoding="async" optional)
          └─ Yes -> fetchpriority="high"
                    Is it in the server HTML as <img>?
                    ├─ Yes -> done
                    └─ No (CSS background, JavaScript, SPA) -> <link rel="preload" as="image" fetchpriority="high" ...>
```
