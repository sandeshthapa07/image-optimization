# Qwik and Qwik City

Package names: Qwik 1 uses `@builder.io/qwik` / `@builder.io/qwik-city`; Qwik 2 uses `@qwik.dev/core` / `@qwik.dev/router`. Check the docs for the installed version.

## Built-in image optimization: `?jsx` imports

Qwik includes `vite-imagetools`. Importing a local image with `?jsx` gives you a component with `srcset`, `width` and `height`:

```tsx
import HeroImage from '~/media/hero.jpg?jsx';
import CardImage from '~/media/card.jpg?w=320;640;960&jsx'; // your own widths

export default component$(() => (
  <>
    <HeroImage alt="..." loading="eager" fetchPriority="high" style={{ width: '100%', height: 'auto' }} />
    <CardImage alt="..." loading="lazy" decoding="async" sizes="(min-width: 1024px) 320px, 100vw" />
  </>
));
```

- Props are passed to the `<img>`. Use the attribute spelling that your version's types accept (`fetchPriority` or `fetchpriority`). Check the rendered HTML.
- Set `loading` yourself. Use `loading="lazy"` for images below the fold, and no lazy on the hero.
- Set `sizes` for fluid images.

## Remote and CMS images

Use `@unpic/qwik` (`unpic-and-image-cdns.md`), or the CDN's resize parameters with a plain `<img>`.

## Preload

Qwik City renders on the server, so a hero `<img>` with high fetch priority is already in the HTML. Use the route's `head` export (`links: [...]`) only for images that are not in the HTML, such as CSS backgrounds.

## Notes

- Qwik's resumability does not change the image rules: images in the server HTML are found early by the preload scanner.
- Avoid JavaScript-driven lazy loading. Native `loading="lazy"` needs no JavaScript and fits Qwik's model.
