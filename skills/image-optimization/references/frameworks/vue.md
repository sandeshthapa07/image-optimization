# Vue 3 (without Nuxt), Vuetify, Quasar

Vue has no built-in image component. In templates, use the normal HTML attribute names. Bind dynamic values with `:`.

```vue
<img
  :src="hero.src"
  :srcset="hero.srcset"
  sizes="100vw"
  :width="hero.width"
  :height="hero.height"
  :alt="hero.alt"
  fetchpriority="high"
/>
```

## A reusable component

```vue
<!-- ResponsiveImage.vue -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  src: string; alt: string; width: number; height: number;
  srcset?: string; sizes?: string; priority?: boolean;
}>(), { priority: false });
</script>

<template>
  <img
    :src="props.src" :srcset="props.srcset" :sizes="props.sizes"
    :width="props.width" :height="props.height" :alt="props.alt"
    :loading="props.priority ? 'eager' : 'lazy'"
    :decoding="props.priority ? undefined : 'async'"
    :fetchpriority="props.priority ? 'high' : undefined"
    class="responsive-image"
  />
</template>

<style scoped>
.responsive-image { max-width: 100%; height: auto; }
</style>
```

Use `priority` only on the LCP image.

## Client-rendered SPA (Vite): preload the LCP image

The `<img>` exists only after the app mounts. Add a preload to `index.html`:

```html
<link rel="preload" as="image" fetchpriority="high"
      imagesrcset="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w" imagesizes="100vw">
```

With SSR and `@unhead/vue`, you can add it from a component:

```ts
import { useHead } from '@unhead/vue';
useHead({
  link: [{ rel: 'preload', as: 'image', fetchpriority: 'high', imagesrcset: hero.srcset, imagesizes: '100vw' }],
});
```

## Build-time widths and formats

Vite + `vite-imagetools` works the same way as in React (`react.md`):

```ts
import heroSrcset from '@/assets/hero.jpg?w=640;1280;1920&format=webp&as=srcset';
```

For CMS/CDN images, use `@unpic/vue` (`unpic-and-image-cdns.md`).

## Lazy-load directives

`vue-lazyload` and `v-lazy` directives set `src` with JavaScript. Prefer native `loading="lazy"`. Never use a JavaScript lazy-load directive on the hero.

## Vuetify `<v-img>`

- It lazy-loads with an IntersectionObserver. For the LCP image, add `eager`.
- Use `cover` (crop) and `aspect-ratio` to avoid stretching and layout shift.
- It supports `srcset` and `sizes`.
- Check the rendered HTML for your Vuetify version, and add `fetchpriority` to the hero if the component forwards it. If it does not, use a plain `<img>` for the hero.

## Quasar `<q-img>`

- Props: `ratio` (reserves space), `fit` (default `cover`), `loading` (default `lazy`), `fetchpriority`, `srcset`, `sizes`.
- LCP image: `loading="eager" fetchpriority="high"`.
- Check the props in the docs for the installed Quasar version.
