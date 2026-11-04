# Unpic and image CDNs (any framework)

## Unpic: one image component for many frameworks and CDNs

Unpic detects the image CDN from the URL (Cloudinary, Imgix, Shopify, Contentful, Sanity, Storyblok, Cloudflare, Vercel, Netlify, Bunny, WordPress.com and many more). It builds `srcset`, `sizes`, the styles that prevent stretching and layout shift, and the loading attributes.

| Framework | Package |
|---|---|
| React | `@unpic/react` |
| Preact | `@unpic/preact` |
| Vue | `@unpic/vue` |
| Svelte | `@unpic/svelte` |
| Solid | `@unpic/solid` |
| Angular | `@unpic/angular` |
| Qwik | `@unpic/qwik` |
| Astro | `@unpic/astro` |
| Lit / Web Components | `@unpic/lit`, `@unpic/webc` |

```tsx
import { Image } from '@unpic/react';

// LCP
<Image src="https://cdn.shopify.com/s/files/.../hero.jpg" layout="fullWidth" height={600} alt="..." priority />

// Card
<Image src={product.imageUrl} layout="constrained" width={640} height={480} alt={product.name} />

// Fixed size
<Image src={user.avatarUrl} layout="fixed" width={48} height={48} alt={user.name} />
```

- `layout`: `constrained` (shrinks, never grows past the width), `fullWidth`, `fixed`.
- `priority`: eager loading + `fetchpriority="high"`. Use it on the LCP image only. Without it, images are lazy.
- `background`: a placeholder colour or `"auto"` (a low-resolution version, where the CDN supports it).
- Check the props in the docs for the installed version.

## CDN URL parameters (cheat sheet)

Verify the exact parameters in the provider's docs. The common ones:

| CDN | Resize | Format / quality | Crop |
|---|---|---|---|
| Cloudinary | `w_800` (path segment) | `f_auto,q_auto` | `c_fill,ar_16:9,g_auto` |
| Imgix | `?w=800` | `&auto=format,compress` | `&h=450&fit=crop&crop=faces,entropy` |
| Cloudflare Images (transform via URL) | `/cdn-cgi/image/width=800/...` | `format=auto,quality=75` | `fit=cover,gravity=auto` |
| Netlify Image CDN | `/.netlify/images?url=/img.jpg&w=800` | `&fm=avif&q=75` (automatic format without `fm`) | `&h=450&fit=cover` |
| Vercel (Next.js) | `/_next/image?url=...&w=800&q=75` | automatic | use `fill` + CSS |
| ImageKit | `?tr=w-800` | `f-auto,q-75` | `h-450,c-maintain_ratio` / `fo-auto` |
| Contentful Images API | `?w=800` | `&fm=avif&q=75` | `&h=450&fit=fill&f=faces` |
| Sanity (`@sanity/image-url`) | `.width(800)` | `.auto('format')` | `.height(450).fit('crop')` + hotspot |
| Storyblok | `/m/800x0` | `/filters:format(webp):quality(75)` | `/m/800x450/smart` |
| Shopify CDN | `?width=800` | automatic | `&height=450&crop=center` |

## Build a srcset for any CDN

```js
// template(w) returns the CDN URL for width w
function buildSrcset(template, widths = [320, 480, 640, 960, 1280, 1600, 1920, 2400]) {
  return widths.map((w) => `${template(w)} ${w}w`).join(', ');
}

const tpl = (w) => `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_${w}/sample.jpg`;
const srcset = buildSrcset(tpl, [480, 960, 1440, 1920]);
// <img src={tpl(960)} srcset={srcset} sizes="..." width={W} height={H} alt="..." />
```

- Get `W` and `H` (or the ratio) from the CMS/CDN metadata API. Do not guess them.
- Do not add widths that are larger than the original. Many CDNs upscale, which wastes bytes and looks soft.
- Add `<link rel="preconnect" href="https://<cdn-host>">` when the LCP image is on the CDN.
