# Social meta tags in each framework

Rules for every framework (details in `07-social-share-images.md`):

1. The tags must be in the **server HTML**. Use SSR, SSG or prerendering. Tags added only in the browser are invisible to crawlers.
2. `og:image` must be an **absolute** `https://` URL. Build it from a site URL setting.
3. Use a **1200 × 630** JPG/PNG under ~300 KB. Add `og:image:width`, `og:image:height`, `og:image:alt` and `twitter:card`.
4. Set the tags **per page**, with a site-wide default.

Check the result: `node scripts/check-social-meta.mjs https://your-page` (or a built HTML file with `--public=<dir>`).

---

## Plain HTML / any server templates

Copy `examples/social-meta-tags.html`. In templates, build the absolute URL from a config value: `{{ site.url }}{{ page.image }}`.

## Next.js (App Router, 13.4+)

### Static metadata

```ts
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'), // makes relative image URLs absolute
  title: { default: 'Acme', template: '%s | Acme' },
  openGraph: {
    type: 'website',
    siteName: 'Acme',
    images: [{ url: '/social/default-og-1200x630.jpg', width: 1200, height: 630, alt: 'Acme' }],
  },
  twitter: { card: 'summary_large_image', site: '@acme' },
};
```

### Per page

```ts
// app/shoes/[slug]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; // Next.js 15+: params is a Promise (await also works in 13/14)
  const shoe = await getShoe(slug);
  return {
    title: shoe.name,
    description: shoe.summary,
    alternates: { canonical: `/shoes/${slug}` },
    openGraph: {
      title: shoe.name,
      description: shoe.summary,
      url: `/shoes/${slug}`,
      images: [{ url: shoe.ogImage, width: 1200, height: 630, alt: shoe.name }],
    },
    twitter: { card: 'summary_large_image' },
  };
}
```

- A nested `openGraph` object **replaces** the parent's `openGraph` (it does not merge field by field). Repeat the fields you need, or share them in a helper.
- Without `metadataBase`, relative image URLs cause a build warning or an error.

### File conventions (no code)

Put `opengraph-image.jpg` (+ `opengraph-image.alt.txt`) and optionally `twitter-image.jpg` in a route folder. Next.js adds the tags, including width and height.

### Generated images with `next/og`

```tsx
// app/shoes/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const alt = 'Acme shoe';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shoe = await getShoe(slug);
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%',
                    padding: 80, background: '#111827', color: '#fff' }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{shoe.name}</div>
        <div style={{ fontSize: 36, marginTop: 24, color: '#e11d48' }}>{shoe.price}</div>
      </div>
    ),
    { ...size },
  );
}
```

- `ImageResponse` uses Satori: only flexbox layout, a subset of CSS, and every `<div>` with more than one child needs `display: 'flex'`.
- Custom fonts: load TTF/OTF/WOFF data (not WOFF2) and pass `fonts: [{ name, data, weight, style }]`.
- The output is PNG. Large photo backgrounds make big files; keep generated images simple.

### Pages Router

```tsx
import Head from 'next/head';
<Head>
  <meta property="og:image" content="https://acme.com/social/og-1200x630.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
</Head>
```

## React SPA (Vite, Create React App)

A client-rendered SPA serves the same `index.html` for every route, so **every shared link gets the tags in `index.html`**. `react-helmet-async` and React 19 `<meta>` in components do not help crawlers here.

Options, from best to simplest:

1. Move to a framework with SSR/SSG (Next.js, React Router framework mode, Astro).
2. Prerender the routes at build time (for example a Vite prerender plugin), so each route has its own HTML with tags.
3. Put site-wide default tags in `index.html` (one image for all pages).
4. Edge middleware that injects tags for crawler User-Agents (complex; last resort).

## React Router v7 (framework mode) / Remix v2

```ts
// app/routes/shoes.$slug.tsx
import type { Route } from './+types/shoes.$slug';

export function meta({ data }: Route.MetaArgs) {
  const url = `https://acme.com/shoes/${data.shoe.slug}`;
  return [
    { title: data.shoe.name },
    { property: 'og:title', content: data.shoe.name },
    { property: 'og:url', content: url },
    { property: 'og:image', content: data.shoe.ogImage }, // absolute
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: data.shoe.name },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
}
```

The `meta` of a child route **replaces** the parent's meta. Repeat the defaults (or merge them from `matches`).

## Gatsby

```jsx
// in a page or template
export const Head = ({ data }) => {
  const siteUrl = 'https://acme.com';
  const og = getSrc(data.post.ogImage); // gatsbyImageData(width: 1200, height: 630, layout: FIXED, formats: [JPG])
  return (
    <>
      <meta property="og:image" content={`${siteUrl}${og}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
};
```

## Vue (SPA) and `@unhead/vue`

```ts
import { useSeoMeta } from '@unhead/vue';
useSeoMeta({
  ogImage: 'https://acme.com/social/og-1200x630.jpg',
  ogImageWidth: 1200, ogImageHeight: 630, ogImageAlt: 'Acme',
  twitterCard: 'summary_large_image',
});
```

This reaches crawlers only with SSR or prerendering (Nuxt, `vite-ssg`). In a plain Vite SPA, use `index.html` defaults (see React SPA above).

## Nuxt 3 / 4

```ts
// pages/shoes/[slug].vue  <script setup>
const { data: shoe } = await useFetch(`/api/shoes/${useRoute().params.slug}`);
const site = useRuntimeConfig().public.siteUrl; // e.g. https://acme.com
useSeoMeta({
  title: () => shoe.value.name,
  ogTitle: () => shoe.value.name,
  ogDescription: () => shoe.value.summary,
  ogUrl: () => `${site}/shoes/${shoe.value.slug}`,
  ogImage: () => `${site}${shoe.value.ogImage}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => shoe.value.name,
  twitterCard: 'summary_large_image',
});
```

- `useSeoMeta` renders on the server by default in Nuxt (SSR or `nuxi generate`).
- Generated images: the `nuxt-og-image` module (part of Nuxt SEO) renders images from Vue components. Check the API of the installed version (for example `defineOgImageComponent(...)`).
- With `@nuxt/image`, make the URL absolute: `${site}${useImage()('/og.jpg', { width: 1200, height: 630, fit: 'cover', format: 'jpg' })}`.

## Angular

```ts
import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export class ShoePage {
  private meta = inject(Meta);
  private title = inject(Title);

  setTags(shoe: Shoe) {
    this.title.setTitle(shoe.name);
    this.meta.updateTag({ property: 'og:title', content: shoe.name });
    this.meta.updateTag({ property: 'og:image', content: `https://acme.com${shoe.ogImage}` });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
  }
}
```

Crawlers see these tags only with server-side rendering or prerendering (`@angular/ssr`, `ng add @angular/ssr`). Call `setTags` before the server finishes rendering (for example with data from a resolver).

## SvelteKit

```svelte
<!-- src/routes/shoes/[slug]/+page.svelte -->
<script>
  import { page } from '$app/state'; // SvelteKit 2.12+; older: import { page } from '$app/stores' and use $page
  let { data } = $props();
  const image = `${page.url.origin}${data.shoe.ogImage}`;
</script>

<svelte:head>
  <title>{data.shoe.name}</title>
  <meta property="og:title" content={data.shoe.name} />
  <meta property="og:image" content={image} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={data.shoe.name} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```

When prerendering, `page.url.origin` may not be your real domain. Use a config value (for example `PUBLIC_SITE_URL`) instead. Generated images: a `+server.ts` endpoint with Satori + resvg (see [Satori recipe](#satori-recipe-any-framework)).

## SolidStart

```tsx
import { Meta, Title } from '@solidjs/meta';

<Title>{shoe().name}</Title>
<Meta property="og:image" content={`https://acme.com${shoe().ogImage}`} />
<Meta property="og:image:width" content="1200" />
<Meta property="og:image:height" content="630" />
<Meta name="twitter:card" content="summary_large_image" />
```

## Astro

```astro
---
// src/layouts/Base.astro (needs `site: 'https://acme.com'` in astro.config.mjs)
import { getImage } from 'astro:assets';
import defaultCover from '../assets/default-cover.jpg';
const { title, description, cover = defaultCover } = Astro.props;
const og = await getImage({ src: cover, width: 1200, height: 630, format: 'jpg' });
const ogUrl = new URL(og.src, Astro.site).href;
---
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={new URL(Astro.url.pathname, Astro.site).href} />
<meta property="og:image" content={ogUrl} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

- Check that `getImage` with both `width` and `height` crops to 1200 × 630 in your Astro version (Astro 5.10+ supports `fit: 'cover'` and `position`). If not, crop the file beforehand with `make-social-images.mjs`.
- Generated images per post: a static endpoint `src/pages/og/[slug].png.ts` with Satori + resvg, or a package such as `astro-og-canvas`.

## Qwik City

```ts
export const head: DocumentHead = ({ resolveValue, url }) => {
  const shoe = resolveValue(useShoe);
  return {
    title: shoe.name,
    meta: [
      { property: 'og:image', content: new URL(shoe.ogImage, 'https://acme.com').href },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  };
};
```

## WordPress

- **With an SEO plugin (Yoast, Rank Math, SEOPress):** set the default social image (1200 × 630) in the plugin settings, and a per-post image in the post's Social tab. The plugin outputs all tags. Do not add tags in the theme as well (duplicates).
- **Without a plugin:**

  ```php
  add_action( 'after_setup_theme', function () {
    add_image_size( 'og-image', 1200, 630, true ); // hard crop to 1.91:1
  } );

  add_action( 'wp_head', function () {
    if ( ! is_singular() || ! has_post_thumbnail() ) return;
    [ $url, $w, $h ] = wp_get_attachment_image_src( get_post_thumbnail_id(), 'og-image' );
    printf( '<meta property="og:image" content="%s">' . "\n", esc_url( $url ) );
    printf( '<meta property="og:image:width" content="%d">' . "\n", $w );
    printf( '<meta property="og:image:height" content="%d">' . "\n", $h );
    echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
  }, 5 );
  ```

  New image sizes apply only to new uploads. Regenerate thumbnails (for example with WP-CLI `wp media regenerate`) for old images.

## Shopify

The theme snippet (`snippets/meta-tags.liquid` in Dawn-based themes) uses `page_image`. Set the default in Online Store → Preferences → Social sharing image. For a 1.91:1 crop:

```liquid
{%- if page_image -%}
  {%- assign og_url = page_image | image_url: width: 1200, height: 630, crop: 'center' -%}
  <meta property="og:image" content="https:{{ og_url }}">
  <meta property="og:image:secure_url" content="https:{{ og_url }}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{{ page_image.alt | escape }}">
{%- endif -%}
<meta name="twitter:card" content="summary_large_image">
```

`image_url` returns a protocol-relative URL (`//cdn.shopify.com/...`), so prefix `https:`.

## Static site generators

- **Hugo:** built-in Open Graph and Twitter Card templates read `images` from the front matter (or page resources named like `*feature*`, `*cover*`). The call is `{{ template "_internal/opengraph.html" . }}` in older versions and a partial in newer ones; check the docs for your version. Crop with `.Fill "1200x630 smart"` and use `.Permalink` for the absolute URL.
- **Eleventy:** write the tags in the base layout with an absolute URL from site data (`{{ site.url }}{{ ogImage }}`). Generate 1200 × 630 files with `@11ty/eleventy-img` (crop via its sharp options), or a Satori-based OG image plugin.
- **Jekyll:** the `jekyll-seo-tag` plugin (`{% seo %}`) reads `image` from the front matter; set `url` in `_config.yml`.
- **Docusaurus:** `themeConfig.image: 'img/social-card.jpg'` for the default, and `image:` in a page's front matter.

## Satori recipe (any framework)

For SvelteKit, Astro, Remix, Express, Cloudflare Workers, and others: `npm i satori @resvg/resvg-js` (on edge runtimes use the WASM version, `@resvg/resvg-wasm`).

```ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';

const font = await readFile('./fonts/Inter-Bold.ttf'); // TTF/OTF/WOFF, not WOFF2

export async function renderOgImage(title: string): Promise<Uint8Array> {
  const svg = await satori(
    { type: 'div', props: {
        style: { display: 'flex', alignItems: 'center', width: '100%', height: '100%', padding: 80,
                 background: '#111827', color: '#fff', fontSize: 72, fontFamily: 'Inter' },
        children: title } },
    { width: 1200, height: 630, fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }] },
  );
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

// Serve with: Content-Type: image/png, Cache-Control: public, max-age=31536000, immutable
// Use a URL that changes when the content changes, e.g. /og/my-post.png?v=<hash>
```

Generate at build time when possible (static endpoints / prerendered routes). On-demand rendering costs CPU on each cache miss.
