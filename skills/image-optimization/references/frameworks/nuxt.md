# Nuxt 3 / 4 (`@nuxt/image`)

Install: `npx nuxi module add image`. Components: `<NuxtImg>` (one `<img>`) and `<NuxtPicture>` (`<picture>` with modern formats). Composable: `useImage()`.

The default provider is **IPX** (local resizing with sharp). Other providers: Cloudinary, Imgix, Vercel, Netlify, Cloudflare, ImageKit, Storyblok, Sanity, Contentful, and many more.

## Important differences from plain HTML

### `sizes` uses breakpoint prefixes, not media queries

```vue
<!-- 100vw on small screens, 50vw from md (768px), 400px from lg (1024px) -->
<NuxtImg src="/photo.jpg" sizes="100vw md:50vw lg:400px" width="800" height="533" alt="..." />
```

- A value without a prefix applies to the smallest screens. A prefix means "from this breakpoint and up".
- Default screens: `xs` 320, `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `xxl`/`2xl` 1536. You can change them in `nuxt.config` → `image.screens`.
- Do not write `(min-width: ...)` media queries in `sizes`. Nuxt builds the real `sizes` attribute and the `srcset` from the prefixes.

### `fit` resizes the file; it is not CSS object-fit

`fit="cover"` (also `contain`, `fill`, `inside`, `outside`) tells the provider how to crop or resize the **file**. If the display box has a different shape, you still need CSS `object-fit: cover`.

## LCP hero

```vue
<NuxtImg
  src="/hero.jpg"
  width="1920" height="1080"
  sizes="100vw"
  format="webp"
  loading="eager"
  fetchpriority="high"
  preload
  alt="..."
  class="hero-img"
/>
```

- `preload` adds a `<link rel="preload">` to the head. Newer versions also accept `:preload="{ fetchPriority: 'high' }"`. Check the installed version.
- Because a server-rendered `<img>` is already in the HTML, `fetchpriority="high"` alone is usually enough. Use `preload` when the image is rendered late.

## Modern formats

```vue
<NuxtPicture
  src="/hero.jpg" format="avif,webp" sizes="100vw"
  width="1920" height="1080" alt="..."
  :img-attrs="{ class: 'hero-img', fetchpriority: 'high', loading: 'eager' }"
/>
```

On `<NuxtPicture>`, pass `class`, `style`, `fetchpriority` and similar attributes for the inner `<img>` through `img-attrs`.

## Cards (lazy, cropped)

```vue
<div class="card-media"> <!-- aspect-ratio: 4/3; overflow: hidden -->
  <NuxtImg :src="item.image" width="640" height="480" fit="cover"
           sizes="100vw sm:50vw lg:320px" loading="lazy" :alt="item.title"
           class="card-img" /> <!-- .card-img { width:100%; height:100%; object-fit:cover } -->
</div>
```

## Other useful props

`quality`, `densities` (`"x1 x2"` for fixed-size images), `placeholder` (blurred preview), `provider`, `preset` (shared settings in `nuxt.config`), `modifiers` (provider-specific).

## Background images

```vue
<script setup>
const img = useImage();
const bg = computed(() => `url('${img('/banner.jpg', { width: 1600, format: 'webp', quality: 70 })}')`);
useHead({ link: [{ rel: 'preload', as: 'image', href: img('/banner.jpg', { width: 1600, format: 'webp', quality: 70 }), fetchpriority: 'high' }] });
</script>

<template>
  <section class="banner" :style="{ backgroundImage: bg }" />
</template>
```

Only preload the background if it is above the fold. Better: use `<NuxtImg>` with `object-fit` (`05-css-backgrounds.md`).

## Static generation

With `nuxi generate`, IPX images are created at build time. Images that are not found by the crawler may be missing. Use a provider (CDN) for CMS images, or list the routes to prerender.
