# CSS background images

## When a background image is fine and when it is not

| Fine | Not fine |
|---|---|
| Decorative textures, patterns, gradients | Content images (products, people, articles) |
| Small images below the fold | The LCP / hero image (unless you preload it) |
| Images that must tile or repeat | Images that need `alt` text |

Problems with background images:

1. The browser finds them late: first it downloads the CSS, parses it, and matches the selectors. The preload scanner does not see them, and it does not read inline `style` attributes either.
2. There is no native lazy loading.
3. There is no `alt`. Screen readers do not announce them.
4. There is no `srcset`/`sizes`. You need `image-set()` and media queries instead.

## Best fix: use an `<img>` with object-fit

Text over an image works with an `<img>` too:

```html
<section class="hero">
  <img class="hero__img" src="hero-1280.jpg"
       srcset="hero-640.jpg 640w, hero-1280.jpg 1280w, hero-1920.jpg 1920w, hero-2560.jpg 2560w"
       sizes="100vw" width="2560" height="1440" alt="Runner on a mountain trail at sunrise" fetchpriority="high">
  <div class="hero__content"><h1>Title</h1><p>Text</p></div>
</section>
```

```css
.hero { position: relative; min-height: 70vh; display: grid; align-items: center; }
.hero__img {
  position: absolute; inset: 0;             /* fills the section; does not change its height */
  width: 100%; height: 100%;
  object-fit: cover; object-position: 50% 40%;
}
.hero__content { position: relative; padding: 2rem; }  /* above the image */
```

The alt must be filled (policy). If the image only decorates the heading, keep a short description and add `aria-hidden="true"` so screen readers skip it.

## If it must stay a background

### Responsive with image-set() and media queries

```css
.hero {
  aspect-ratio: 16 / 9;                     /* reserve space: no CLS */
  background-size: cover;
  background-position: 50% 40%;
  background-image: url("hero-1280.jpg");   /* fallback */
  background-image: image-set(
    "hero-1280.avif" type("image/avif"),
    "hero-1280.webp" type("image/webp"),
    "hero-1280.jpg"  type("image/jpeg")
  );
}
@media (max-width: 767px) {
  .hero {
    aspect-ratio: 4 / 5;
    background-image: url("hero-tall-750.jpg");
    background-image: image-set(
      "hero-tall-750.avif" type("image/avif"),
      "hero-tall-750.webp" type("image/webp"),
      "hero-tall-750.jpg"  type("image/jpeg")
    );
  }
}
```

- `image-set()` can also choose by resolution: `image-set("a-1x.jpg" 1x, "a-2x.jpg" 2x)`.
- Old Safari versions need `-webkit-image-set()`. The `url()` fallback line covers them.
- Give the element an `aspect-ratio` or a `min-height`, so the space is reserved.

### Preload the above-the-fold background

The preload must match the URL that the CSS chooses:

```html
<link rel="preload" as="image" fetchpriority="high" media="(max-width: 767px)" href="hero-tall-750.avif" type="image/avif">
<link rel="preload" as="image" fetchpriority="high" media="(min-width: 768px)" href="hero-1280.avif" type="image/avif">
```

- With `type="image/avif"`, browsers without AVIF support skip the preload. They still get the image from CSS, but later.
- Do not add a second preload for WebP. Browsers that support both formats would download both.
- Simpler: switch to an `<img>`. Then you need no preload.

### Lazy-load below-the-fold backgrounds

```html
<div class="promo lazy-bg"></div>
<script>
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }
  }, { rootMargin: '600px 0px' });
  document.querySelectorAll('.lazy-bg').forEach((el) => io.observe(el));
</script>
```

```css
.promo { aspect-ratio: 3 / 1; background-size: cover; }
.promo.is-visible { background-image: url("promo.webp"); }
```

Or use an `<img loading="lazy">` with `object-fit`. That needs no JavaScript.

## Frameworks

- Next.js: `getImageProps()` gives you a `srcSet` to turn into `image-set()`. See `frameworks/nextjs.md`.
- Nuxt: the `useImage()` composable builds optimized URLs for `style` bindings.
- Astro: `getImage()` returns an optimized `src` for inline styles.
- WordPress page builders: use an image widget/block with `object-fit` instead of a section background for heroes, or preload the background in `wp_head`.
