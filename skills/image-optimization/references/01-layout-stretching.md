# Layout, stretching and layout shift (CLS)

## How the browser sizes an image

- Each image file has an **intrinsic size** (for example 2400×1350) and a **natural aspect ratio** (16:9).
- The `width` and `height` attributes do two things:
  1. They give a default display size, which CSS can override.
  2. They give the browser an aspect ratio **before the file downloads**. The browser maps them to `aspect-ratio: auto 2400 / 1350`, so it can reserve the correct space and prevent layout shift.
- CSS wins over the attributes. With `width: 100%; height: auto`, the image is as wide as its container and as tall as the ratio requires.
- After the file loads, the browser uses the file's natural ratio (that is what `auto` means). If the attributes have the wrong ratio, the layout shifts when the image loads.

### Base CSS for every project

```css
img, picture, video, svg {
  max-width: 100%;   /* never overflow the container */
  height: auto;      /* keep the ratio when the width changes */
}
img { display: block; } /* optional: removes the gap under inline images */
```

Tailwind's Preflight already includes `max-width: 100%; height: auto; display: block` for images.

## The 8 causes of stretched images

### 1. Responsive width, fixed height

```html
<!-- BAD: CSS makes the width 100%; the height attribute stays at 600px -->
<style> .post img { width: 100%; } </style>
<img src="photo.jpg" width="800" height="600" alt="Harbour at sunset">

<!-- GOOD -->
<style> .post img { width: 100%; height: auto; } </style>
```

### 2. Fixed width and height in CSS, no object-fit

```css
/* BAD: the box is 300×200, the photo is 4:5 -> stretched */
.thumb { width: 300px; height: 200px; }

/* GOOD: crop to fill the box */
.thumb { width: 300px; height: 200px; object-fit: cover; object-position: 50% 30%; }
```

The initial value of `object-fit` is `fill`, and `fill` stretches the image to the box. Any time CSS gives an image **both** dimensions, set `object-fit`.

### 3. CSS aspect-ratio on the image without object-fit

```css
/* BAD: aspect-ratio overrides the photo's natural ratio */
.card img { width: 100%; aspect-ratio: 16 / 9; }

/* GOOD */
.card img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
```

### 4. Flex shrink squishes the width

```css
/* BAD: in a row, flex-shrink reduces the image width; its height stays at the height attribute */
.media { display: flex; gap: 1rem; }

/* GOOD: choose one */
.media img { flex-shrink: 0; }                 /* keep the size */
.media img { min-width: 0; height: auto; }     /* allow shrinking, keep the ratio */
```

### 5. Flex or grid stretch alignment

Flex items stretch on the cross axis by default (`align-items: normal` behaves as `stretch` in flexbox). Grid can stretch images too when `stretch` alignment or `height: 100%` is set.

```css
/* GOOD: choose one */
.row { display: flex; align-items: flex-start; }
.row > img { align-self: flex-start; }
```

The most robust fix is to **wrap the image** and make the wrapper the flex or grid item:

```html
<div class="row">
  <div class="row__media"><img src="a.jpg" width="800" height="600" alt="Blue backpack, front view"></div>
  <div class="row__text">...</div>
</div>
```

### 6. `height: 100%` inside a box with a different shape

```css
/* BAD */
.tile { height: 320px; } .tile img { width: 100%; height: 100%; }

/* GOOD */
.tile img { width: 100%; height: 100%; object-fit: cover; }
```

### 7. srcset with different crops

The browser can choose any candidate in a `srcset`. If `hero-mobile.jpg` is 4:5 and `hero-desktop.jpg` is 16:9, the shape changes with the screen and the reserved space is wrong. Fix it with `<picture>` art direction. See `02-responsive-sizing.md`.

### 8. Framework fill modes

- Next.js `<Image fill>` and Angular `<img ngSrc fill>` position the image absolutely to fill the parent. Without `object-fit`, the image stretches. Add `style={{ objectFit: 'cover' }}` or a class.
- Tailwind: `w-full h-64` without `object-cover` stretches the image.
- Nuxt `fit="cover"` and Astro `fit` control how the **file is resized on the server**. Also check the CSS `object-fit` when the display box has a different shape.

## object-fit and object-position

| Value | Result | Use for |
|---|---|---|
| `fill` (default) | Stretches to the box | Almost never |
| `cover` | Fills the box; crops what is outside | Cards, heroes, thumbnails, avatars |
| `contain` | Fits inside the box; empty bands appear | Logos, product photos that must not be cropped |
| `scale-down` | `contain`, but never enlarges | Small images in big boxes |
| `none` | Natural size, cropped by the box | Rare |

`object-position` sets the focal point. The default is `50% 50%`. Faces near the top of the photo: `object-position: 50% 25%`.

`object-fit: cover` crops. Tell the user if important content (text in the image, a product edge) may be cut off.

## Reserving space: preventing CLS

1. `width` + `height` attributes on every `<img>`, with the intrinsic ratio (the size of the largest candidate is a good choice).
2. `<picture>` art direction: add `width` + `height` to each `<source>`, because each crop has its own ratio.
3. Containers that show an image of unknown size: give the container an `aspect-ratio` and use `object-fit` on the image.
4. Lazy images need dimensions too. Without them, lazy images start at 0×0, so many of them are inside the viewport and they all load at once.
5. Images added by JavaScript (carousels, CMS embeds): reserve space with a wrapper that has an `aspect-ratio`.
6. Placeholders are optional: `background-color`, a dominant colour, or a small blurred image (LQIP). Do not hide the LCP image with `opacity: 0` until JavaScript fades it in. That delays LCP.

### Card media pattern (works everywhere)

```html
<div class="card__media">
  <img src="card-640.jpg" srcset="card-320.jpg 320w, card-640.jpg 640w, card-960.jpg 960w"
       sizes="auto, (min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
       width="960" height="720" alt="..." loading="lazy" decoding="async">
</div>
```

```css
.card__media { aspect-ratio: 4 / 3; overflow: hidden; border-radius: 12px; }
.card__media img { width: 100%; height: 100%; object-fit: cover; }
```

### Different ratio per breakpoint, same file

When cropping with CSS is good enough (the same file at every width):

```css
.hero__media { aspect-ratio: 4 / 5; }
@media (min-width: 768px) { .hero__media { aspect-ratio: 16 / 9; } }
.hero__media img { width: 100%; height: 100%; object-fit: cover; }
```

When mobile needs a different crop or a different subject, use `<picture>` art direction instead. It downloads a smaller, better-cropped file.

## EXIF orientation

Phone photos can store "rotate 90°" in EXIF. Browsers apply it by default (`image-orientation: from-image`). This means the displayed size can be the stored size rotated, for example 3024×4032 stored and 4032×3024 displayed. `scripts/image-size.mjs` reports the oriented size. Better: re-export the file with the rotation applied, and strip the EXIF data.

## Debugging in DevTools

- Elements panel: hover the `<img>` to see the **rendered size vs. intrinsic size** and the **rendered vs. intrinsic aspect ratio**. If the two ratios are different and `object-fit` is `fill`, the image is stretched.
- Console: `$0.currentSrc`, `$0.naturalWidth`, `$0.getBoundingClientRect()`.
- Performance panel: the layout shift track shows which element moved. Lighthouse "Layout shift culprits" lists unsized images.
- `scripts/browser-audit.js` checks all of the above for the whole page.
