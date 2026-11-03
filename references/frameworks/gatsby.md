# Gatsby (`gatsby-plugin-image`)

Two components:

- `<StaticImage>`: the `src` is a fixed string (a local file or a remote URL). It is processed at build time. Props must be static values.
- `<GatsbyImage>`: dynamic images from GraphQL (`gatsbyImageData`), via `getImage()`.

Both generate `srcset`, WebP/AVIF, `width`/`height` and a placeholder. They **lazy-load by default**.

## Props that matter

| Prop | Use |
|---|---|
| `layout` | `constrained` (default; shrinks, never grows past the width), `fixed`, `fullWidth` |
| `width` / `height` / `aspectRatio` | Display size and crop |
| `loading` | `"eager"` for the LCP image |
| `placeholder` | `"dominantColor"`, `"blurred"`, `"tracedSVG"`, `"none"` |
| `formats` | `["auto", "webp", "avif"]` |
| `breakpoints`, `sizes` | Override the generated widths and `sizes` |
| `objectFit` / `objectPosition` | How the image fills its box (`cover` is common) |
| `transformOptions` | `{ fit: "cover", cropFocus: "attention" }` and other sharp options for the file itself |

## LCP hero

```jsx
import { StaticImage } from 'gatsby-plugin-image';

<StaticImage
  src="../images/hero.jpg"
  alt="..."
  layout="fullWidth"
  loading="eager"
  placeholder="dominantColor"
  formats={['auto', 'webp', 'avif']}
/>
```

`gatsby-plugin-image` may not forward `fetchpriority` to the inner `<img>`. Check the rendered HTML. If it is missing, add a preload in `gatsby-ssr.js` with `onRenderBody` → `setHeadComponents([<link rel="preload" as="image" ... fetchpriority="high" />])`, using the generated `srcset` and `sizes`.

## Cards

```jsx
<GatsbyImage image={getImage(node.cover)} alt={node.title} objectFit="cover" />
```

In the GraphQL query: `gatsbyImageData(width: 640, aspectRatio: 1.333, layout: CONSTRAINED)`. Then every card has the same ratio.

## Notes

- Gatsby is less active than other frameworks. For new projects, consider Astro or Next.js.
- With images from a CMS (Contentful, Sanity), use the source plugin's `gatsbyImageData`, so the CDN does the resizing.
