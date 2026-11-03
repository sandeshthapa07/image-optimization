# WordPress

## What core does automatically (check the WordPress version)

| Feature | Since |
|---|---|
| `srcset` + `sizes` on content images and `wp_get_attachment_image()` | 4.4 |
| `width`/`height` added to content images | 5.5 |
| `loading="lazy"` added by default | 5.5 (improved in 5.9 and 6.3 to skip the first images) |
| WebP uploads | 5.8 |
| `decoding="async"` added | 6.1 |
| `fetchpriority="high"` added to the image that is probably the LCP | 6.3 |
| AVIF uploads | 6.5 |
| `sizes="auto"` on lazy images | 6.7 |

Core uses heuristics to choose the LCP image and which images are lazy. **Custom theme templates, page builders and background images are often wrong.** Fix them in the template.

## Theme templates: pass the attributes yourself

```php
// Hero (LCP)
echo wp_get_attachment_image( $hero_id, 'full', false, array(
  'loading'       => 'eager',
  'fetchpriority' => 'high',
  'sizes'         => '100vw',
  'class'         => 'hero__img',
) );

// Card (below the fold)
echo wp_get_attachment_image( $thumb_id, 'card', false, array(
  'loading' => 'lazy',
  'sizes'   => '(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw',
  'class'   => 'card__img',
) );
```

- `wp_get_attachment_image()` adds `width`, `height`, `srcset`, `alt` (from the media library) and `decoding`.
- Do not echo `<img src="<?php echo wp_get_attachment_url( $id ); ?>">`. That loses `srcset`, `sizes` and the dimensions.

## Image sizes and srcset

```php
add_action( 'after_setup_theme', function () {
  add_image_size( 'card', 640, 480, true );      // true = hard crop to 4:3
  add_image_size( 'card-2x', 1280, 960, true );  // same ratio, so it joins the srcset
} );
```

- WordPress puts only sizes with the **same aspect ratio** into the `srcset`. Hard-crop sizes with the same ratio, so that the `srcset` has enough candidates.
- The default `sizes` attribute is `(max-width: {width}px) 100vw, {width}px`. That is often wrong for grids. Change it in the template (as above), or with the `wp_calculate_image_sizes` filter.

## Change the lazy/priority heuristics

- The `wp_get_loading_optimization_attributes` filter (6.3+) changes `loading`/`fetchpriority` decisions.
- The `wp_omit_loading_attr_threshold` filter sets how many content images are not lazy-loaded.
- Prefer explicit attributes in the template over filters.

## Background images in themes and page builders

- Hero sections built with a "section background" (Elementor, Divi, WPBakery) are CSS backgrounds: they are found late and they have no `srcset`. Use an image widget/block with `object-fit: cover` for the hero, or preload it:

```php
add_action( 'wp_head', function () {
  if ( ! is_front_page() ) return;
  $id = get_theme_mod( 'hero_image_id' );
  if ( ! $id ) return;
  printf(
    '<link rel="preload" as="image" fetchpriority="high" imagesrcset="%s" imagesizes="100vw">' . "\n",
    esc_attr( wp_get_attachment_image_srcset( $id, 'full' ) )
  );
}, 1 );
```

- The Cover block uses an `<img>` with `object-fit` (unless "fixed background" is on). That is good for the LCP.

## Plugins from the WordPress Performance Team

- **Modern Image Formats:** creates WebP/AVIF versions of uploads.
- **Image Prioritizer:** uses real visitor data to set `fetchpriority` on the real LCP image and to lazy-load background images.
- **Enhanced Responsive Images:** improves `sizes`.

Check that they are compatible with the theme and other plugins before you install them.

## WooCommerce

The product images in the shop loop and on the product page use theme templates and the `woocommerce_thumbnail` / `woocommerce_single` sizes. Make the crop consistent in WooCommerce → Settings → Products, and check that the main product image is not lazy-loaded.
