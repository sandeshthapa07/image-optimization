# Responsive sizing: srcset, sizes, picture

There are two different problems. Use the right tool for each one.

| Problem | Tool |
|---|---|
| **Resolution switching:** the same picture, smaller or larger files for different screens | `srcset` + `sizes` on `<img>` |
| **Art direction:** a different crop or picture per screen size | `<picture>` + `<source media>` |
| **Format switching:** AVIF/WebP with a fallback | `<picture>` + `<source type>`, or a CDN with automatic format |

## x descriptors: fixed-size images

Use x descriptors when the image is always the same CSS size (avatars, logos, icons, fixed thumbnails).

```html
<img src="logo-160.png" srcset="logo-160.png 1x, logo-320.png 2x" width="160" height="40" alt="Acme">
```

- No `sizes` with x descriptors. Browsers ignore it.
- Do not mix `w` and `x` descriptors in one `srcset`. That is invalid.
- 3x is rarely worth the bytes. Users cannot see the difference at normal viewing distance.

## w descriptors + sizes: fluid images

```html
<img
  src="photo-960.jpg"
  srcset="photo-480.jpg 480w, photo-960.jpg 960w, photo-1440.jpg 1440w, photo-1920.jpg 1920w"
  sizes="(min-width: 1200px) 800px, (min-width: 768px) 66vw, 100vw"
  width="1920" height="1280" alt="...">
```

How the browser chooses:

1. It reads `sizes` from left to right and takes the **first media condition that matches**. That gives the slot width, for example `66vw`.
2. Slot width × device pixel ratio = the pixels needed. Example: 66vw at a 1024px viewport is 676px; × DPR 2 = 1352px.
3. It chooses a candidate that is at least that wide, here `photo-1440.jpg`. Browsers can choose differently: a larger file that is already cached, or a smaller one when data saving is on.

If `sizes` is missing, the browser uses `100vw`. A 300px thumbnail then downloads a full-screen file. **Always write `sizes` with `w` descriptors.**

## Writing sizes from the CSS

`sizes` must describe how wide the image **renders**. Read the CSS: container `max-width`, padding, grid columns, gaps, breakpoints.

The order matters. With `min-width` conditions, put the **largest** breakpoint first. The last value has no condition and is the default.

### Full-width hero

```
sizes="100vw"
```

### Content column with max-width 768px and 16px padding on each side

```
sizes="(min-width: 800px) 768px, calc(100vw - 32px)"
```

### Grid: 1 column on mobile, 2 from 640px, 3 from 1024px; container max 1200px; padding 24px; gap 24px

```
sizes="(min-width: 1248px) 384px,
       (min-width: 1024px) calc((100vw - 48px - 48px) / 3),
       (min-width: 640px) calc((100vw - 48px - 24px) / 2),
       calc(100vw - 48px)"
```

- At 1248px and wider, the container is 1200px: (1200 − 2 gaps × 24) / 3 = 384px.
- `calc()` is allowed in `sizes`. It is fine to round up a little.
- If the CSS uses `rem` breakpoints, `em`/`rem` in `sizes` media conditions use the browser default font size (usually 16px).

### Sidebar layout: image in a main column next to a 300px sidebar, from 1024px

```
sizes="(min-width: 1024px) calc(100vw - 300px - 64px), 100vw"
```

### Rules

- `sizes` uses **viewport** media conditions only. Container queries are not available in `sizes`. Calculate the width from the viewport.
- Slightly too large is better than too small. Too small looks blurry. Too large wastes bytes.
- Check the result: `scripts/browser-audit.js` reports when `sizes` makes the browser choose a much larger file than it needs.

## sizes="auto"

For lazy images, the browser can use the real layout width:

```html
<img loading="lazy" sizes="auto, (min-width: 1024px) 320px, 100vw" srcset="..." width="960" height="640" alt="Mountain lake at sunrise">
```

- It only works with `loading="lazy"`. On eager images it is ignored.
- Always add a fallback list after `auto, ...`. Browsers without support use the fallback.
- Supported in Chromium-based browsers (from Chrome 126). WordPress 6.7+ adds it automatically to lazy images.

## Which widths to generate

- Full-width images: `480, 768, 1024, 1366, 1600, 1920, 2400` (or similar).
- Cards and columns: from the smallest slot to about 2× the largest slot, for example `320, 480, 640, 800, 960`.
- Do not go above ~2× the largest rendered width.
- Use steps of about 25–40% in width. More candidates give a better match; each one costs build time or CDN storage.
- Use a mid-sized candidate as `src`. It is the fallback for very old browsers and for crawlers.

## Art direction with picture

```html
<picture>
  <!-- desktop: wide crop -->
  <source media="(min-width: 768px)"
          srcset="hero-wide-1280.jpg 1280w, hero-wide-1920.jpg 1920w, hero-wide-2560.jpg 2560w"
          sizes="100vw" width="2560" height="1080">
  <!-- mobile: tall crop -->
  <img src="hero-tall-750.jpg"
       srcset="hero-tall-480.jpg 480w, hero-tall-750.jpg 750w, hero-tall-1080.jpg 1080w"
       sizes="100vw" width="1080" height="1350"
       alt="..." fetchpriority="high">
</picture>
```

- The browser uses the **first matching `<source>`**. The `<img>` is the default and the element that is displayed.
- Put `width`/`height` on each `<source>` (its own ratio), and on the `<img>` (the default ratio).
- Put `alt`, `loading`, `fetchpriority`, `decoding` and the CSS class on the `<img>`. They apply to whichever source the browser uses.
- Only the matching source downloads. This is why `<picture>` is better than two `<img>` elements switched with `display: none`. With two images, an eager hidden image still downloads.

## Format switching with picture

```html
<picture>
  <source type="image/avif" srcset="p-480.avif 480w, p-960.avif 960w, p-1440.avif 1440w" sizes="(min-width: 768px) 50vw, 100vw">
  <source type="image/webp" srcset="p-480.webp 480w, p-960.webp 960w, p-1440.webp 1440w" sizes="(min-width: 768px) 50vw, 100vw">
  <img src="p-960.jpg" srcset="p-480.jpg 480w, p-960.jpg 960w, p-1440.jpg 1440w"
       sizes="(min-width: 768px) 50vw, 100vw" width="1440" height="960" alt="..." loading="lazy" decoding="async">
</picture>
```

- Put AVIF first, then WebP, then the `<img>` fallback.
- Repeat `sizes` on every `<source>`. Sources do not inherit it from the `<img>`.
- To combine art direction and formats, give each media query its own `type` sources: `media` + `type` on each `<source>`.
- An image CDN with automatic format (Accept header) is simpler: one `<img>` with a `srcset`. See `04-formats-compression.md`.

## Common sizing mistakes

| Mistake | Effect | Fix |
|---|---|---|
| `srcset` with `w` and no `sizes` | Downloads at full viewport width | Add `sizes` |
| `sizes="100vw"` on a grid thumbnail | 3–4× too many bytes | Calculate the slot width |
| Only 1x and 2x of the display size, on a fluid image | Blurry on wide screens, too big on small screens | Use `w` descriptors |
| `sizes` copied from another component | Wrong file chosen | Write it from this component's CSS |
| Largest candidate smaller than slot × 2 | Blurry on retina screens | Add a larger candidate |
| Candidates with different ratios | Shape changes, layout shift | Same ratio, or `<picture>` |
| `sizes` media conditions in the wrong order | The first match wins, so the wrong slot is used | Largest `min-width` first |
