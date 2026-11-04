# React (Vite, Create React App, any setup without Next.js) and Preact

React has no built-in image component. Use a plain `<img>` with the right attributes, a build tool for the files, and a preload for client-rendered apps.

## JSX attribute names

| HTML | React JSX |
|---|---|
| `srcset` | `srcSet` |
| `fetchpriority` | `fetchPriority` (React 19+). React 18 and older do not know it: use lowercase `fetchpriority="high"` (React passes unknown lowercase attributes to the DOM). |
| `imagesrcset` / `imagesizes` on `<link>` | `imageSrcSet` / `imageSizes` |
| `class` | `className` |
| `sizes`, `loading`, `decoding`, `width`, `height`, `alt` | the same |

Check the installed React version before you choose `fetchPriority` or `fetchpriority`.

## A reusable component

```tsx
type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  width: number;
  height: number;
  alt: string;
  priority?: boolean; // true only for the LCP image
};

export function Img({ priority = false, loading, decoding, ...rest }: Props) {
  return (
    <img
      {...rest}
      loading={priority ? 'eager' : loading ?? 'lazy'}
      decoding={priority ? undefined : decoding ?? 'async'}
      fetchPriority={priority ? 'high' : rest.fetchPriority} // React 18: use {...{ fetchpriority: 'high' }}
      style={{ maxWidth: '100%', height: 'auto', ...rest.style }}
    />
  );
}
```

```tsx
<Img priority src="/img/hero-1280.jpg"
     srcSet="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w"
     sizes="100vw" width={1920} height={1080} alt="..." />
```

## Client-rendered apps (Vite, CRA): preload the LCP image

The `<img>` does not exist until the JavaScript bundle runs. Add a preload to `index.html`:

```html
<link rel="preload" as="image" fetchpriority="high"
      imagesrcset="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w"
      imagesizes="100vw">
```

Better, when possible: prerender or server-render the page (React Router framework mode, Next.js, Astro).

## React 19: `preload()` from react-dom

In server-rendered React 19 apps (and React Server Components), call `preload` during render. React puts the `<link>` in the `<head>`:

```tsx
import { preload } from 'react-dom';

export function Hero() {
  preload('/img/hero-1280.jpg', {
    as: 'image',
    fetchPriority: 'high',
    imageSrcSet: '/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w',
    imageSizes: '100vw',
  });
  return <img src="/img/hero-1280.jpg" srcSet="..." sizes="100vw" width={1920} height={1080} alt="..." fetchPriority="high" />;
}
```

You need this only when the image is not in the first HTML. An `<img>` in server HTML needs only `fetchPriority="high"`.

## Generate widths and formats in Vite: vite-imagetools

```ts
// vite.config.ts
import { imagetools } from 'vite-imagetools';
export default { plugins: [imagetools()] };
```

```tsx
import heroAvif from './hero.jpg?w=640;1280;1920&format=avif&as=srcset';
import heroWebp from './hero.jpg?w=640;1280;1920&format=webp&as=srcset';
import hero from './hero.jpg?w=1280&as=metadata';

<picture>
  <source type="image/avif" srcSet={heroAvif} sizes="100vw" />
  <source type="image/webp" srcSet={heroWebp} sizes="100vw" />
  <img src={hero.src} width={hero.width} height={hero.height} sizes="100vw" alt="..." fetchPriority="high" />
</picture>
```

Add a TypeScript declaration for the import queries if needed (see the vite-imagetools docs). For CMS or CDN images, use `@unpic/react` (see `unpic-and-image-cdns.md`).

## Lazy-loading libraries

`react-lazyload`, `react-lazy-load-image-component` and similar libraries are usually not needed. Use native `loading="lazy"`. If a library stays, do not use it for above-the-fold images.

## UI libraries

Component libraries (MUI, Chakra, Mantine, shadcn/ui) wrap a plain `<img>`, or give it an `aspect-ratio` box. Check the HTML that they render: the same rules apply (`width`/`height`, `object-fit`, no lazy on the hero). For example, Mantine `<Image fit="cover">`, MUI `<CardMedia component="img">` and shadcn `<AspectRatio>` + `<img className="object-cover">`.

## Preact

- Lowercase HTML names always work: `srcset`, `fetchpriority`, `class`.
- With `preact/compat`, React names (`srcSet`, `className`) also work.
- Preact has no image component. Use the same patterns as above.
