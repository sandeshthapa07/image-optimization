# Svelte and SvelteKit (`@sveltejs/enhanced-img`)

## Plain Svelte

Svelte uses normal HTML attribute names: `srcset`, `sizes`, `fetchpriority`, `loading`, `decoding`, `class`. All the HTML recipes in `SKILL.md` work as they are.

```svelte
<img src={hero.src} srcset={hero.srcset} sizes="100vw" width={hero.width} height={hero.height}
     alt={hero.alt} fetchpriority="high" />
```

## SvelteKit: `@sveltejs/enhanced-img` for local images

It creates AVIF/WebP, `width`/`height` and `srcset` at build time.

```bash
npm i -D @sveltejs/enhanced-img
```

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [enhancedImages(), sveltekit()], // enhancedImages() must come before sveltekit()
});
```

```svelte
<enhanced:img src="./hero.jpg" alt="..." />
```

- It renders a `<picture>` with AVIF/WebP sources and an `<img>` with intrinsic `width`/`height`.
- **Use source files at 2× the display size.** By default it creates 1x and 2x candidates.
- Large images (a hero or a full-width image): add `sizes`, then it also creates smaller widths:

  ```svelte
  <enhanced:img src="./hero.jpg" sizes="min(1280px, 100vw)" alt="..." fetchpriority="high" />
  ```

- Your own widths: `src="./hero.jpg?w=1280;640;400"` together with matching `sizes`.
- Other attributes (`class`, `loading`, `fetchpriority`, `decoding`) are passed to the `<img>`.

### Dynamic images

The `src` must be known at build time. For a dynamic choice, import the files with `?enhanced`:

```svelte
<script>
  import Hero from '$lib/assets/hero.jpg?enhanced';
  const images = import.meta.glob('$lib/assets/gallery/*.{avif,gif,heif,jpeg,jpg,png,tiff,webp}', {
    eager: true, query: { enhanced: true },
  });
  // alt text per file (required: every image needs a filled alt)
  const captions = {
    '/src/lib/assets/gallery/lake.jpg': 'Mountain lake at sunrise',
    '/src/lib/assets/gallery/trail.jpg': 'Runner on a forest trail',
  };
</script>

<enhanced:img src={Hero} alt="..." fetchpriority="high" />
{#each Object.entries(images) as [path, img]}
  <enhanced:img src={img.default} alt={captions[path]} loading="lazy" sizes="(min-width: 768px) 33vw, 100vw" />
{/each}
```

### Remote and CMS images

`enhanced-img` works only with local files. For images from a CMS or CDN, use the CDN's resize parameters, or `@unpic/svelte` (`unpic-and-image-cdns.md`).

## Roles in SvelteKit

| Role | Code |
|---|---|
| LCP | `<enhanced:img src="./hero.jpg" sizes="100vw" fetchpriority="high" alt="..." />` |
| Below the fold | `<enhanced:img src={img} sizes="..." loading="lazy" alt="..." />` |
| Fixed size | `<enhanced:img src="./logo.png" alt="Acme" />` (source at 2× the display size, no `sizes`) |

## Stretching

The `<img>` gets the intrinsic `width`/`height`. Style it with a class:

```svelte
<enhanced:img src={item.image} class="cover" alt={item.alt} />

<style>
  /* :global() makes sure the style reaches the generated <img> */
  :global(img.cover) { width: 100%; height: 100%; object-fit: cover; }
</style>
```

## Preload (only if the image is not in the server HTML)

```svelte
<svelte:head>
  <link rel="preload" as="image" fetchpriority="high" imagesrcset={srcset} imagesizes="100vw" />
</svelte:head>
```

With SSR (the SvelteKit default), an `<enhanced:img fetchpriority="high">` is already in the HTML, so you usually do not need this.
