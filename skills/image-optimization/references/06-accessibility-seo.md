# Accessibility and SEO for images

## The alt text policy

**Every image must have a filled, descriptive `alt`. Never missing, never empty, never a placeholder.**

This applies to:

- `<img>`, `<input type="image">` and `<area>`,
- framework image components (`<Image>`, `<NuxtImg>`, `<enhanced:img>`, `<StaticImage>`, Unpic, ...),
- Markdown images: `![Red running shoe, side view](./shoe.jpg)`, never `![](./shoe.jpg)`,
- CSS backgrounds that show content: `role="img"` + a filled `aria-label` on the element,
- inline SVG used as an image: `role="img"` + `<title>` or `aria-label`,
- social share images: `og:image:alt` and `twitter:image:alt`.

### Purely decorative images

The WCAG pattern for decorative images is `alt=""`, so that screen readers skip them. This skill's policy requires a filled alt on every image. To keep screen readers quiet anyway, add `aria-hidden="true"`:

```html
<!-- Decorative: filled alt (policy) + aria-hidden (screen readers skip it) -->
<img src="/img/wave-divider.svg" alt="Decorative wave divider" aria-hidden="true" width="1200" height="40">

<!-- Avatar next to the visible name: filled alt, hidden because the name is already read -->
<img src="/img/jane-48.jpg" alt="Jane Doe" aria-hidden="true" width="48" height="48">
```

- Use `aria-hidden="true"` **only** when the image adds nothing for a screen-reader user: decoration, or an exact duplicate of text next to it.
- Never use `aria-hidden` on an image that carries information, or that is the only content of a link or button.
- Purely decorative graphics (patterns, textures, flourishes) can also be drawn with CSS instead of an `<img>`.

## How to write the alt

| Image type | Write | Example |
|---|---|---|
| Informative (shows information) | What the image shows that matters here | `alt="Red trail running shoe, side view"` |
| Product | Product name + the visible variant (colour, angle) | `alt="Acme Trail 2, red, sole view"` |
| Person | Name, and the role if useful | `alt="Jane Doe, head of design"` |
| Functional (alone in a link or button) | The action or the destination | `alt="Go to cart"`, `alt="Acme home"` |
| Logo | The company name (+ "home" if it links home) | `alt="Acme"`, `alt="Acme home"` |
| With a caption | A short alt; the caption gives the details | `alt="Team at the 2026 offsite"` + `<figcaption>` |
| Complex (chart, diagram, map) | The main point; full data in nearby text or a table | `alt="Sales grew 20% from Q1 to Q3 2026. Data in the table below."` |
| Text in an image | The same text | `alt="Summer sale: 30% off everything"` (better: real HTML text) |
| Decorative | A short neutral description + `aria-hidden="true"` | `alt="Decorative wave divider" aria-hidden="true"` |

Rules:

- Describe the content and its purpose. Do not describe the file.
- Do not start with "Image of", "Picture of" or "Photo of". Screen readers already say "image".
- Keep it under about 125 characters. Put longer details in a caption or nearby text.
- No keyword stuffing.
- Do not use the same alt for different images on a page (for example, the product name on all 6 gallery photos). Add what is different: "front view", "sole view", "on foot".

### Where an agent gets the alt text, in this order

1. **The alt field that already exists:** WordPress media library, Shopify `image.alt`, Contentful/Sanity/Strapi image description fields, a JSON `alt` field.
2. **Data next to the image:** product name + variant, article title, person name, the heading of the section, the link text.
3. **The image itself:** if you can see the image, describe what matters in this context.
4. **Not enough information:** write the best description from the context, and list the image in your report as **"alt needs review"**. Never use a placeholder like "image", and never leave it empty.

### Dynamic values: fall back to a description, never to an empty string

```tsx
// BAD: empty when the CMS field is missing
<img src={p.image.url} alt={p.image.alt || ''} />

// GOOD
<img src={p.image.url} alt={p.image.alt || `${p.name}, ${p.colour}`} />
```

```liquid
{%- assign image_alt = image.alt | default: product.title -%}
{{ image | image_url: width: 800 | image_tag: alt: image_alt }}
```

```php
// WordPress: fall back when an attachment has no alt text (then fix the alt in the media library)
add_filter( 'wp_get_attachment_image_attributes', function ( $attr, $attachment ) {
  if ( trim( $attr['alt'] ?? '' ) === '' ) {
    $caption = wp_get_attachment_caption( $attachment->ID );
    $parent  = wp_get_post_parent_id( $attachment->ID );
    $attr['alt'] = $caption ?: ( $parent ? get_the_title( $parent ) : get_bloginfo( 'name' ) );
  }
  return $attr;
}, 10, 2 );
```

Do not fall back to the attachment title or the file name: they are often `IMG_2041`.

### Bad alt text (the audit scripts report these)

| Bad | Why |
|---|---|
| no `alt`, `alt=""`, `<img alt>` | Missing or empty (policy) |
| `alt="image"`, `"photo"`, `"picture"`, `"icon"`, `"logo"`, `"banner"`, `"placeholder"`, `"untitled"`, `"null"`, `"undefined"` | Says nothing |
| `alt="IMG_2041.jpg"`, `"hero-1600"`, `"DSC0012"`, `"screenshot-2026-01-04"` | A file name, not a description |
| `alt="Image of a red shoe"` | Redundant prefix ("a red shoe" is enough) |
| `alt="shoes running shoes best running shoes cheap shoes"` | Keyword stuffing |
| 300 characters of description | Too long; use a caption |

## Framework notes

- **Next.js, Astro, Gatsby:** their image components require an `alt` prop (type error, build error or warning), but `alt=""` passes their check. This policy needs a filled value.
- **React/JSX:** `alt={undefined}` removes the attribute. Make sure that the value is always a string.
- **Vue:** `:alt="image.alt"` renders nothing when the value is `null`. Use `:alt="image.alt || product.name"`.
- **Markdown/MDX (Astro, Docusaurus, Hugo, Eleventy):** write the alt in the brackets: `![...](...)`.
- **WordPress:** the media library alt field is used by `wp_get_attachment_image()` and the Image block. Fill it on upload; use the filter above as a safety net.
- **Shopify:** add alt text to product media in the admin; in themes, assign a fallback first (`assign image_alt = image.alt | default: product.title`) and pass `alt: image_alt` to `image_tag`.

## SVG

```html
<!-- As <img>: alt works as usual -->
<img src="chart.svg" alt="Revenue grew 20% in Q3" width="600" height="300">

<!-- Inline, informative -->
<svg role="img" aria-labelledby="t1" viewBox="0 0 24 24"><title id="t1">Warning</title>...</svg>

<!-- Inline icon next to visible text (inline SVG has no alt attribute; the text already says it) -->
<button><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">...</svg> Delete</button>

<!-- Inline icon alone in a button: the button needs the label -->
<button aria-label="Delete"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">...</svg></button>
```

## CSS backgrounds with content

```html
<section class="hero" role="img" aria-label="Runner on a mountain trail at sunrise">...</section>
```

Better: use an `<img>` with `object-fit` (`05-css-backgrounds.md`).

## Other accessibility points

- Animated images and video: respect `prefers-reduced-motion`, and give the user a pause control for long animations.
- Do not put important text inside an image. It cannot be resized, translated or read by every assistive technology.
- Check text contrast over images. Use an overlay gradient or a text shadow.

## SEO

- Descriptive alt text helps image search and gives context to the page.
- Use descriptive file names: `red-running-shoe.jpg`, not `IMG_2041.jpg`.
- Google indexes images that use native `loading="lazy"`. JavaScript lazy loading that never sets `src` may hide images from crawlers.
- Put important images in `<img>` (crawlers do not index CSS background images as content).
- Social share images: see `07-social-share-images.md` (1200 × 630, absolute URL, `og:image:alt`).
- Structured data (`Product`, `Article`, `Recipe`) can list images. Use crawlable, high-resolution URLs.
- An image sitemap helps when images are loaded by JavaScript.
- Faster LCP and lower CLS improve Core Web Vitals, which are a ranking signal.

## Checking

| Tool | Checks |
|---|---|
| `scripts/audit-images.mjs` | `missing-alt`, `empty-alt` (errors); `alt-not-descriptive`, `alt-is-filename`, `alt-empty-fallback`, missing `twitter:image:alt` (warnings); `alt-redundant-prefix`, `alt-too-long` (info); missing `og:image:alt` (error) |
| `scripts/browser-audit.js` | The same rules on the rendered page (catches alt text that comes from a CMS or JavaScript), plus `role="img"` elements without a label |
| `scripts/check-social-meta.mjs` | `og:image:alt` (error when missing or empty), `twitter:image:alt` |
