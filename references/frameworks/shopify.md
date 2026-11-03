# Shopify (Liquid themes)

Use the `image_url` filter (it replaced the deprecated `img_url`) together with the `image_tag` filter. `image_tag` outputs `width`, `height`, `srcset`, `sizes` and `alt` for you. Extra parameters become HTML attributes.

## Hero (first section)

```liquid
{%- liquid
  assign loading = 'lazy'
  assign priority = 'auto'
  if section.index == 1
    assign loading = 'eager'
    assign priority = 'high'
  endif
-%}

{{ section.settings.image
  | image_url: width: 3840
  | image_tag:
    widths: '375, 550, 750, 1100, 1500, 1780, 2000, 3000, 3840',
    sizes: '100vw',
    loading: loading,
    fetchpriority: priority,
    class: 'hero__image'
}}
```

- `section.index` is the position of the section in the template (1 = the first one). Use it to decide whether the image is above the fold. Images in later sections are lazy.
- `image_tag` can also take `preload: true`, which sends a preload `Link` header. Use it for the LCP image only.

## Cards with the same shape

```liquid
<div class="card__media" style="aspect-ratio: 4 / 3;">
  {{ product.featured_image
    | image_url: width: 1200, height: 900, crop: 'center'
    | image_tag:
      widths: '300, 450, 600, 900, 1200',
      sizes: '(min-width: 990px) calc((100vw - 130px) / 4), (min-width: 750px) calc((100vw - 120px) / 3), calc((100vw - 35px) / 2)',
      loading: 'lazy',
      class: 'card__img'
  }}
</div>
```

```css
.card__media { overflow: hidden; }
.card__img { width: 100%; height: 100%; object-fit: cover; }
```

- `crop` (`center`, `top`, `bottom`, `left`, `right`) makes every candidate the same ratio.
- Write `sizes` from the theme grid (columns, page width, gaps). The example values are typical for a 4/3/2 column grid; calculate yours from the theme CSS.
- `image.aspect_ratio` gives the ratio of the original. Use it for an `aspect-ratio` wrapper when you do not crop.

## Formats and limits

- Shopify's CDN chooses modern formats (WebP/AVIF) automatically when the browser supports them.
- `image_url` cannot make an image larger than the original. Upload large originals (for example 3840px for full-width heroes).

## Common problems in themes

- Old themes use `img_url` with a single size, or `data-src` + lazysizes. Replace them with `image_url` + `image_tag`, and native lazy loading.
- Slideshows: slide 1 eager with `fetchpriority: 'high'`, the other slides lazy.
- Theme "section backgrounds" (CSS `background-image`) for the hero: change to an `<img>` with `object-fit: cover`.
