# Angular (`NgOptimizedImage`)

`NgOptimizedImage` is in `@angular/common` (stable since Angular 15). Use it for every image that it can handle.

```ts
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `<img ngSrc="hero.jpg" width="1920" height="1080" priority alt="..." />`,
})
export class HeroComponent {}
```

(Standalone is the default in Angular 19+. NgModule apps add `NgOptimizedImage` to the module's `imports`.)

## Rules

- Use `ngSrc` instead of `src`. Do not set `src` or `srcset` yourself; use `ngSrcset`.
- `width` and `height` are **required** (the intrinsic ratio), unless you use `fill`.
- Images are lazy by default.
- `priority` = `loading="eager"` + `fetchpriority="high"`, plus a preload link when you use server-side rendering. Use it on the LCP image only.
- In development mode, Angular warns about:
  - an LCP image without `priority`,
  - a rendered aspect ratio that is different from the intrinsic ratio (**stretching**),
  - an image that is much larger than its rendered size,
  - a missing `preconnect` for the image CDN.

  Read the browser console. These warnings find most problems.

## Loaders (needed for automatic srcset)

Without a loader, Angular cannot create resized URLs. With a loader, it generates `srcset` automatically.

```ts
// app.config.ts
import { provideImgixLoader } from '@angular/common';
export const appConfig = { providers: [provideImgixLoader('https://my-site.imgix.net/')] };
```

Built-in loaders: `provideImgixLoader`, `provideCloudinaryLoader`, `provideImageKitLoader`, `provideCloudflareLoader`, `provideNetlifyLoader`.

### Custom loader for pre-generated files (no CDN)

```ts
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';

// Files on disk: /assets/img/hero-640.webp, hero-1280.webp, hero-1920.webp
export const appConfig = {
  providers: [{
    provide: IMAGE_LOADER,
    useValue: (config: ImageLoaderConfig) =>
      config.width ? `/assets/img/${config.src}-${config.width}.webp` : `/assets/img/${config.src}-1280.webp`,
  }],
};
```

```html
<img ngSrc="hero" ngSrcset="640w, 1280w, 1920w" sizes="100vw" width="1920" height="1080" priority alt="..." />
```

The widths in `ngSrcset` must exist as files.

## Responsive images

- With a loader and `sizes`, Angular generates a responsive `srcset` (`w` descriptors) from its breakpoint list.
- Without `sizes`, it generates `1x, 2x` (density descriptors). That is correct for fixed-size images.
- `ngSrcset="100w, 200w, 300w"` or `ngSrcset="1x, 2x"` sets the candidates yourself.
- `disableOptimizedSrcset` turns the automatic srcset off.

## Fill mode

```html
<div class="card-media"> <!-- position: relative; aspect-ratio: 4 / 3 -->
  <img ngSrc="product.jpg" fill sizes="(min-width: 1024px) 25vw, 50vw" alt="..." style="object-fit: cover" />
</div>
```

- The parent needs `position: relative`, `absolute` or `fixed`, and a size.
- Without `object-fit: cover`, the image stretches.
- Add `sizes`. Without it, the image is treated as full width.

## Placeholder (Angular 17.1+)

`placeholder` shows a blurred low-resolution image while loading (with a loader), or `placeholder="data:image/..."` for a base64 image. Keep base64 placeholders small (a few KB).

## Preconnect

If the LCP image is on a CDN: `<link rel="preconnect" href="https://my-site.imgix.net">` in `index.html`. Angular warns when it is missing.

## Plain `<img>` in Angular

For images that `NgOptimizedImage` cannot handle, use plain attributes. Static `fetchpriority="high"` works. For a dynamic value, bind it with `[attr.fetchpriority]="isHero ? 'high' : null"`.

## Pitfalls

| Pitfall | Fix |
|---|---|
| `priority` together with `loading="lazy"` | Angular throws an error; remove `loading` |
| `priority` on many images | Only the LCP image |
| `src` and `ngSrc` both set | Use only `ngSrc` |
| `width`/`height` are the display size, not the file's ratio | Use the intrinsic size (or the same ratio) |
| `fill` without `sizes` | Add `sizes` |
| Background images | `NgOptimizedImage` cannot help. Use an `<img>` with `object-fit`, or preload the background |
