# React Router v7 (framework mode), Remix v2, TanStack Start

These frameworks render React on the server but have **no built-in image component**. Use:

- plain `<img>` with the rules in `react.md`, or
- `@unpic/react` for CDN and CMS images (`unpic-and-image-cdns.md`), or
- `vite-imagetools` for local files (they all use Vite).

Because the HTML is server-rendered, an LCP `<img>` with `fetchPriority="high"` (React 19) / `fetchpriority="high"` (React 18) is enough. Use a preload only when the image is not in the first HTML (CSS background, or rendered after a client fetch).

## Preload with the `links` export (React Router v7 / Remix v2)

```tsx
// app/routes/_index.tsx
import type { Route } from './+types/_index'; // React Router v7 type generation

export const links: Route.LinksFunction = () => [
  {
    rel: 'preload',
    as: 'image',
    imageSrcSet: '/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w',
    imageSizes: '100vw',
    fetchPriority: 'high', // remove this line if your types do not accept it
  },
];
```

- Remix v2: `import type { LinksFunction } from '@remix-run/node'`.
- The preload must use the same `srcset`/`sizes` as the `<img>`.
- When the hero URL depends on loader data, render the `<link>` in the route component. React 19 hoists `<link>` elements to the `<head>`. Or use `preload()` from `react-dom` (see `react.md`).

## TanStack Start

Add preloads with the route's `head()` option (`links: [...]`). Check the property names in the installed version's docs.

## Example LCP route component

```tsx
export default function Home() {
  return (
    <img
      src="/img/hero-1280.jpg"
      srcSet="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w"
      sizes="100vw"
      width={1920}
      height={1080}
      alt="..."
      fetchPriority="high"
      style={{ width: '100%', height: 'auto' }}
    />
  );
}
```

## Pitfalls

- A hero that is rendered in `clientLoader` or after `useEffect` is not in the server HTML. Render it on the server, or preload it.
- With SPA mode (`ssr: false`), treat the app as a client-rendered SPA: add the preload to the root HTML.
