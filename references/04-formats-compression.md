# Formats, compression and delivery

## Which format

| Content | First choice | Fallback | Notes |
|---|---|---|---|
| Photos | AVIF | WebP, then JPEG | AVIF is often 30–50% smaller than JPEG at the same quality |
| Graphics with transparency | AVIF or WebP | PNG | |
| Logos, icons, simple illustrations | SVG | PNG | Optimize with SVGO |
| Screenshots, UI, text in images | WebP (lossless or high quality) or PNG | PNG | AVIF can blur sharp text at low quality |
| Animations | `<video>` (MP4 H.264, WebM/AV1) | Animated WebP/AVIF | Animated GIFs are often 5–10× bigger than video |

- WebP and AVIF are supported in all current major browsers. Keep a JPEG/PNG fallback in `<picture>`, or let a CDN choose the format.
- JPEG XL has limited browser support. Do not use it as the only format.

## Three ways to serve modern formats

### A. An image CDN with automatic format (simplest)

The CDN reads the browser's `Accept` header and sends AVIF, WebP or JPEG from one URL. You need only one `<img>` with a `srcset`.

- Cloudinary `f_auto,q_auto`; Imgix `auto=format,compress`; Cloudflare `format=auto`; Netlify Image CDN and Vercel do this automatically. See `frameworks/unpic-and-image-cdns.md`.
- The CDN must send `Vary: Accept` (the large CDNs do this for you).

### B. `<picture>` with `type` sources

See `02-responsive-sizing.md`, "Format switching with picture". Use this for static hosting without an image CDN.

### C. The framework builds the files

Next.js, Nuxt Image, Astro, SvelteKit enhanced-img, Gatsby, Angular with a loader, Eleventy Image and Hugo create the formats and widths for you. See the framework files.

## Quality starting points

Check visually, and lower the quality until you can see a difference, then go back one step.

| Format | Starting quality |
|---|---|
| AVIF | 45–65 |
| WebP | 70–80 |
| JPEG (mozjpeg) | 70–82 |

- Resize first, then compress. A 4000px file shown at 800px wastes far more than a bad quality setting.
- Remove metadata (EXIF, GPS). Convert to sRGB.
- Rough size targets (not strict limits): hero ≤ 150–250 KB on mobile; card thumbnails ≤ 30–60 KB; avatars ≤ 10 KB.

## Generating widths and formats yourself (Node + sharp)

```js
// npm i -D sharp
import sharp from 'sharp';
const widths = [480, 768, 1024, 1600, 2400];
for (const w of widths) {
  const img = sharp('src/hero.jpg').rotate().resize({ width: w, withoutEnlargement: true });
  await img.clone().avif({ quality: 55 }).toFile(`public/img/hero-${w}.avif`);
  await img.clone().webp({ quality: 75 }).toFile(`public/img/hero-${w}.webp`);
  await img.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(`public/img/hero-${w}.jpg`);
}
```

`.rotate()` with no arguments applies the EXIF orientation. `withoutEnlargement` prevents upscaling.

Other tools: `vite-imagetools` (Vite import queries), `vite-plugin-image-optimizer`, ImageMagick, libvips, `cwebp`, `avifenc`, Squoosh (web app).

## SVG

- Optimize with SVGO. Remove editor metadata and hidden layers.
- Give `<img src="logo.svg">` a `width` and `height`, or make sure that the SVG has a `viewBox`. Without one of them, the size can be 300×150 or 0.
- Inline SVG is good for icons that change colour with CSS (`currentColor`). An `<img>` SVG is good for large illustrations, because the browser can cache it.
- An SVG that contains an embedded JPEG/PNG (base64) is not a vector. Export the raster image separately.
- Next.js does not optimize SVG. Use `unoptimized`, or import it as a component.

## Animated GIF to video

```bash
ffmpeg -i anim.gif -movflags +faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" anim.mp4
ffmpeg -i anim.gif -c:v libvpx-vp9 -b:v 0 -crf 41 anim.webm
```

```html
<video autoplay muted loop playsinline width="640" height="360" poster="anim-poster.jpg">
  <source src="anim.webm" type="video/webm">
  <source src="anim.mp4" type="video/mp4">
</video>
```

- `muted` and `playsinline` are required for autoplay on mobile.
- Respect `prefers-reduced-motion`: pause the video, or show the poster image.

## Caching

- Use file names that contain a content hash (`hero.3f9a2c.avif`), plus `Cache-Control: public, max-age=31536000, immutable`.
- Without hashed file names, use a shorter `max-age` and revalidation.
- Frameworks and image CDNs handle this when you use their image pipeline.

## Responsive images and Retina

- Device pixel ratios: 1 (many desktops), 2 (most laptops and phones), 3 (many phones). Generating for 2× is usually enough. Above 2× most people cannot see a difference.
- With `w` descriptors, the browser applies the DPR automatically. You do not need separate 2x files.
