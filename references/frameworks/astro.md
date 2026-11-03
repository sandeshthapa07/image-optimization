# Astro (`astro:assets`)

```astro
---
import { Image, Picture, getImage } from 'astro:assets';
import hero from '../assets/hero.jpg'; // local file in src/: width and height are read automatically
---
```

## Basics

- Images in `src/` that you import are optimized (resized, converted, given `width`/`height`).
- Images in `public/` are **not** optimized; they are copied as they are. Pass `width` and `height` yourself.
- Remote images: allow the host in `astro.config.mjs` (`image.domains` or `image.remotePatterns`), and pass `width` + `height`, or `inferSize`.
- `<Image>` defaults: `loading="lazy"`, `decoding="async"`. **Override them on the LCP image.**
- Components from `astro:assets` work only in `.astro` and `.mdx` files. Inside React/Vue/Svelte islands, call `getImage()` in the `.astro` parent and pass `src`/`srcset` as props.

## Check the version: responsive images

- **Astro 5.10+:** responsive images are stable. Props: `layout` (`constrained`, `full-width`, `fixed`, `none`), `fit` (CSS object-fit: `cover`, `contain`, ...), `position` (object-position), and `priority`.
  - `priority` sets `loading="eager"`, `decoding="sync"` and `fetchpriority="high"`. Use it on the LCP image only.
  - With a `layout`, Astro generates `srcset` and `sizes` for you, and (with `responsiveStyles`) adds CSS that prevents stretching.
  - Global default: `image: { layout: 'constrained', responsiveStyles: true }` in `astro.config.mjs`.
- **Astro 5.0–5.9:** the same feature is behind `experimental.responsiveImages`.
- **Astro 4 and earlier, or no layout:** use `widths`/`densities` and `sizes` yourself, and set `loading`/`fetchpriority` yourself.

## Recipes

### LCP hero

```astro
<!-- Astro 5.10+ -->
<Image src={hero} alt="..." layout="full-width" priority />

<!-- Older versions, or without layout -->
<Image src={hero} alt="..." widths={[640, 960, 1280, 1920, 2400]} sizes="100vw"
       loading="eager" fetchpriority="high" decoding="sync" />
```

### Cards (lazy, same shape)

```astro
<Image src={post.cover} alt={post.title} width={640} height={480} fit="cover"
       layout="constrained" sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" />
```

Without the responsive-images feature, crop with CSS: wrap the image in a box with `aspect-ratio`, and give the image `width: 100%; height: 100%; object-fit: cover`.

### Modern formats

```astro
<Picture src={hero} formats={['avif', 'webp']} alt="..." widths={[640, 1280, 1920]} sizes="100vw"
         loading="eager" fetchpriority="high" pictureAttributes={{ class: 'hero' }} />
```

`<Image>` already outputs WebP by default. Use `<Picture>` when you want AVIF with a fallback.

### Fixed size

```astro
<Image src={logo} alt="Acme" width={160} height={40} densities={[1, 2]} />
```

### Background image

```astro
---
const bg = await getImage({ src: hero, width: 1600, format: 'webp' });
---
<link rel="preload" as="image" href={bg.src} fetchpriority="high" slot="head" />
<section style={`background-image: url(${bg.src}); background-size: cover; aspect-ratio: 16 / 9;`}></section>
```

Put the `<link>` in the `<head>` of the layout (the `slot="head"` line assumes a layout with a named head slot). Better: use `<Image>` with `object-fit`.

### Markdown and content collections

- `![alt](./image.jpg)` in Markdown/MDX is optimized automatically (lazy by default).
- For the hero of a blog post, render it with `<Image>` in the layout, not in the Markdown. Then you can set `priority`.
- In content collection schemas, use the `image()` helper. Then `post.data.cover` works with `<Image>`.
