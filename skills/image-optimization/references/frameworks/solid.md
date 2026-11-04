# SolidJS and SolidStart

Solid has no built-in image component. Solid JSX uses **HTML attribute names**: `class` (not `className`), `srcset`, `sizes`, `fetchpriority`, `loading`, `decoding`.

```tsx
<img
  src="/img/hero-1280.jpg"
  srcset="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w"
  sizes="100vw"
  width={1920}
  height={1080}
  alt="..."
  fetchpriority="high"
  class="hero-img"
/>
```

If the TypeScript types of your Solid version do not accept an attribute, `attr:fetchpriority="high"` forces Solid to set it as an attribute.

## A reusable component

```tsx
import { splitProps, type JSX } from 'solid-js';

type Props = JSX.ImgHTMLAttributes<HTMLImageElement> & {
  width: number; height: number; alt: string; priority?: boolean;
};

export function Img(props: Props) {
  const [local, rest] = splitProps(props, ['priority']);
  return (
    <img
      {...rest}
      loading={local.priority ? 'eager' : rest.loading ?? 'lazy'}
      decoding={local.priority ? undefined : rest.decoding ?? 'async'}
      fetchpriority={local.priority ? 'high' : undefined}
      style={{ 'max-width': '100%', height: 'auto' }}
    />
  );
}
```

Note: in Solid, `style` objects use CSS property names (`'max-width'`), not camelCase.

## SolidStart: preload with `@solidjs/meta`

Only needed when the image is not in the server HTML (CSS background, client-only rendering):

```tsx
import { Link } from '@solidjs/meta';

<Link rel="preload" as="image" fetchpriority="high"
      imagesrcset="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w" imagesizes="100vw" />
```

## Generating files

- **Local images:** `vite-imagetools` (SolidStart uses Vite). Add the plugin to the `vite` option in `app.config.ts`, then import `./hero.jpg?w=640;1280;1920&format=webp&as=srcset`. See `react.md` for the import queries.
- **CDN and CMS images:** `@unpic/solid` (`unpic-and-image-cdns.md`).

## Client-rendered Solid (Vite SPA)

Add the LCP preload to `index.html`. See `03-loading-priority.md`.
