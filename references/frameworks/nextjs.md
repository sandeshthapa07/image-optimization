# Next.js (`next/image`)

**First, check the version** in `package.json`. The props changed:

| Next.js | LCP image |
|---|---|
| 13–15 | `priority` (sets eager loading, high fetch priority and a preload) |
| 16+ | `priority` is deprecated. Use `loading="eager"` + `fetchPriority="high"`. Use `preload` only when you really need a `<link rel="preload">`. |
| 12 and older | `next/image` had `layout` and `objectFit` props. In 13+ these are in `next/legacy/image`. Migrate to `next/image`. |

Next.js 16 also changed some config defaults (for example `images.qualities` is `[75]`, so the `quality` prop must be in that list). Read the upgrade guide for the installed version before you change `next.config`.

## What `<Image>` does

- It generates a `srcset` and serves resized WebP (AVIF if configured) through `/_next/image`.
- Default `loading="lazy"`. **Every above-the-fold image must override this.**
- It requires `width` + `height`, or `fill`, or a static import (which gives the size automatically).
- It requires `alt`.

## Recipes

### LCP hero with a static import

```tsx
import Image from 'next/image';
import hero from '@/assets/hero.jpg'; // width, height and blurDataURL are automatic

// Next.js 13–15
<Image src={hero} alt="..." priority sizes="100vw" placeholder="blur"
       style={{ width: '100%', height: 'auto' }} />

// Next.js 16+
<Image src={hero} alt="..." loading="eager" fetchPriority="high" sizes="100vw" placeholder="blur"
       style={{ width: '100%', height: 'auto' }} />
```

### Fluid image with the intrinsic ratio (most content images)

```tsx
<Image src="/img/team.jpg" alt="..." width={1600} height={1067}
       sizes="(min-width: 1024px) 50vw, 100vw"
       style={{ width: '100%', height: 'auto' }} />
```

If you change one dimension with CSS, set the other to `auto`. Otherwise Next.js warns: *"Image with src ... has either width or height modified, but not the other."*

### Fill a box of a fixed shape (cards, covers)

```tsx
<div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
  <Image src={product.image} alt={product.name} fill
         sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
         style={{ objectFit: 'cover' }} />
</div>
```

- The parent needs `position: relative` (or `absolute`/`fixed`) and a size (`aspect-ratio` or a height).
- Without `objectFit: 'cover'`, the image **stretches**.
- Without `sizes`, Next.js assumes `100vw` and sends very large files to every card.
- Tailwind: `<div className="relative aspect-[4/3]"><Image fill className="object-cover" sizes="..." .../></div>`.

### Fixed-size image (avatar, logo)

```tsx
<Image src={user.avatar} alt={user.name} width={48} height={48} />
```

Without `sizes`, Next.js generates `1x, 2x` candidates from `width`. That is correct for fixed sizes.

### Remote images

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.example.com', pathname: '/**' }],
    formats: ['image/avif', 'image/webp'], // AVIF is not on by default
  },
};
```

Remote images need `width` + `height` (or `fill`). Read them from the CMS/API response. Do not guess them. `images.domains` is deprecated; use `remotePatterns`.

### Art direction with `getImageProps()` (Next.js 14+)

```tsx
import { getImageProps } from 'next/image';

export function Hero() {
  const common = { alt: 'Describe the image', sizes: '100vw' };
  const { props: { srcSet: desktop } } = getImageProps({ ...common, src: '/hero-desktop.jpg', width: 2560, height: 1080 });
  const { props: { srcSet: mobile, ...rest } } = getImageProps({ ...common, src: '/hero-mobile.jpg', width: 1080, height: 1350 });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop} width={2560} height={1080} />
      <img {...rest} loading="eager" fetchPriority="high" style={{ width: '100%', height: 'auto' }} />
    </picture>
  );
}
```

`getImageProps()` returns `loading="lazy"` by default, so the LCP `<img>` must override it **after** `{...rest}`, as above. For images that are not the LCP, drop the two overrides.

### Background image with `getImageProps()`

```tsx
import { getImageProps } from 'next/image';

function toImageSet(srcSet = '') {
  const set = srcSet.split(', ').map((s) => {
    const [url, dpi] = s.split(' ');
    return `url("${url}") ${dpi}`;
  }).join(', ');
  return `image-set(${set})`;
}

export function Banner() {
  const { props: { srcSet } } = getImageProps({ alt: 'Spring sale banner', width: 1600, height: 600, src: '/banner.jpg' });
  // a content background needs a label: role="img" + a filled aria-label
  return <section role="img" aria-label="Spring sale: 30% off running shoes"
                  style={{ backgroundImage: toImageSet(srcSet), backgroundSize: 'cover', aspectRatio: '8 / 3' }} />;
}
```

Without `sizes`, `getImageProps` returns x descriptors (`1x, 2x`). That is the format that `image-set()` needs.

## next.config images options (check the defaults for your version)

| Option | Use |
|---|---|
| `formats` | `['image/avif', 'image/webp']` to enable AVIF |
| `deviceSizes` / `imageSizes` | The widths used to build `srcset` (`deviceSizes` with `sizes`; `imageSizes` for small images) |
| `qualities` | Allowed values for the `quality` prop (Next.js 16 requires this list) |
| `remotePatterns` | Allowed remote hosts |
| `loader` / `loaderFile` | Use your own image CDN (Cloudinary, Imgix, ...) instead of `/_next/image` |
| `unoptimized` | Static export without an image server |
| `minimumCacheTTL` | Cache lifetime of optimized images |

## Next.js pitfalls

| Pitfall | Fix |
|---|---|
| Hero lazy-loaded (default) | `priority` (13–15) / `loading="eager"` + `fetchPriority="high"` (16+) |
| `priority` on many images | Only the LCP image |
| `fill` without `sizes` | Add `sizes` |
| `fill` without `objectFit` | `style={{ objectFit: 'cover' }}` or `className="object-cover"` |
| Only `width` changed in CSS | Also set `height: 'auto'` |
| `placeholder="blur"` on a remote image | Also pass `blurDataURL` |
| SVG through the optimizer | `unoptimized`, or import the SVG as a component |
| `output: 'export'` | `images.unoptimized: true`, or a custom loader to a CDN |
| Old `layout="responsive"` / `objectFit` props | `next/image` with `style`/`sizes`; for `fill`, use the `fill` prop |
