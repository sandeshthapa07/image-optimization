# Social share images (Open Graph, X/Twitter cards, LinkedIn, WhatsApp, ...)

When someone shares a link, the platform's crawler downloads the page HTML, reads the `<meta>` tags in `<head>`, and downloads the image named in `og:image` (or `twitter:image`). The image is never shown on your own page. It exists only for link previews.

Important facts:

- **Crawlers do not run JavaScript.** Tags that are added in the browser (react-helmet in a client-rendered SPA, `useHead` without SSR, Angular `Meta` without SSR) are invisible. The tags must be in the HTML that the server sends: SSR, SSG or prerendering.
- **The image URL must be absolute** (`https://example.com/og.jpg`), public, and fast.
- **Platforms cache previews** for days. After you change an image, use a new URL and refresh the platform's cache (see [Testing and refreshing](#testing-and-refreshing)).

## One image that works everywhere

For most sites, **one image** is enough:

| Property | Value |
|---|---|
| Size | **1200 × 630 px** (ratio 1.91:1) |
| Format | **JPG** (photos) or **PNG** (flat graphics, text, logos). Not SVG, not AVIF. WebP works on most platforms but not all. |
| File size | **Under 300 KB** (WhatsApp often drops bigger images). Hard limits: 5 MB (X, LinkedIn), 8 MB (Facebook). |
| Colour | sRGB |
| Safe zone | Keep text and logos inside the centre **1080 × 510 px** (60 px margin). For square crops, keep the logo inside the centre 630 × 630. |
| URL | Absolute `https://`, returns 200, `Content-Type: image/jpeg` or `image/png`, no login, no redirect chain |

Create it with `node scripts/make-social-images.mjs <source-image>`. Check it with `node scripts/check-social-meta.mjs <url>`.

## Platform reference (2026)

Platforms change their limits without notice. These are the documented values, or (where marked) commonly tested values. Confirm with the platform's tools.

| Platform | Tags it reads | Recommended | Ratio | Minimum | Max file | Notes |
|---|---|---|---|---|---|---|
| **Facebook / Messenger** | `og:*` | 1200 × 630 | 1.91:1 | 200 × 200 (below 600 × 315: small thumbnail) | 8 MB | Add `og:image:width`/`height`, or the first share may have no image |
| **LinkedIn** | `og:*` | 1200 × 627 | 1.91:1 | small images show as a thumbnail | 5 MB | Refresh with Post Inspector |
| **X (Twitter), large card** | `twitter:*`, then `og:*` | 1200 × 600 (1200 × 630 is cropped a little) | 2:1 | 300 × 157 | 5 MB | Needs `twitter:card=summary_large_image`. JPG, PNG, WebP, GIF (first frame). Max 4096 × 4096 |
| **X, small card** | `twitter:*`, then `og:*` | 800 × 800 | 1:1 | 144 × 144 | 5 MB | `twitter:card=summary` |
| **WhatsApp** | `og:*` | 1200 × 630 | 1.91:1 | about 300 px wide (tested) | **keep under ~300 KB** (tested) | Not documented. Big or slow images often show no preview |
| **Slack** | `og:*`, `twitter:*` | 1200 × 630 | 1.91:1 | | | Extra rows with `twitter:label1` / `twitter:data1` |
| **Discord** | `og:*`, `twitter:card` | 1200 × 630 | 1.91:1 | | | `summary_large_image` gives the big image; `theme-color` sets the embed colour |
| **Telegram** | `og:*` | 1200 × 630 | 1.91:1 | | | Refresh with @WebpageBot |
| **iMessage, Teams, Bluesky, Threads, Mastodon** | `og:*` | 1200 × 630 | 1.91:1 | | | 1.91:1 works well everywhere |
| **Pinterest** | `og:*` (Rich Pins), images on the page | 1000 × 1500 | 2:3 | | | Tall pins perform better; use `data-pin-media` for a pin-specific image |
| **Google Search / Discover** | structured data `image`, `og:image` | at least 1200 px wide | 16:9, 4:3 and 1:1 | 50 000 px (w × h) | | Discover needs `<meta name="robots" content="max-image-preview:large">` |

## The tags

```html
<head>
  <!-- Open Graph: Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, iMessage, ... -->
  <meta property="og:type" content="website">                       <!-- "article" for blog posts -->
  <meta property="og:site_name" content="Acme">
  <meta property="og:title" content="Trail running shoes">            <!-- about 60 characters -->
  <meta property="og:description" content="Lightweight shoes for trail and road.">  <!-- about 110-160 characters -->
  <meta property="og:url" content="https://acme.com/shoes/trail">     <!-- the canonical URL -->
  <meta property="og:image" content="https://acme.com/social/trail-og-1200x630.jpg">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Red trail running shoe on a rocky path">

  <!-- X (Twitter): uses og:* when a twitter:* tag is missing, but twitter:card is required -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@acme">                          <!-- optional -->
  <meta name="twitter:image" content="https://acme.com/social/trail-twitter-1200x600.jpg"> <!-- optional: exact 2:1 -->
  <meta name="twitter:image:alt" content="Red trail running shoe on a rocky path">          <!-- max 420 characters -->

  <!-- Optional extras -->
  <meta name="theme-color" content="#e11d48">                         <!-- Discord embed colour, mobile browser UI -->
  <meta name="robots" content="max-image-preview:large">              <!-- large images in Google Discover -->
  <link rel="canonical" href="https://acme.com/shoes/trail">
</head>
```

| Tag | Required? | Rules |
|---|---|---|
| `og:title`, `og:image`, `og:url`, `og:type` | Yes (Open Graph core) | `property=` attribute, not `name=` |
| `og:description` | Recommended | |
| `og:image:width`, `og:image:height` | Strongly recommended | The **real** file size. Without them Facebook may show no image on the first share |
| `og:image:alt`, `twitter:image:alt` | Recommended | Describe the image, like `alt` |
| `og:image:type` | Optional | `image/jpeg` or `image/png` |
| `og:image:secure_url` | Optional | Only needed if `og:image` is `http://` (do not do that) |
| `twitter:card` | Yes, for X | `summary_large_image` (big image) or `summary` (small square) |
| `twitter:image` | Optional | Only when X needs a different crop (2:1) than `og:image` |

- Use **one set of tags per page**. Duplicates often come from a theme and an SEO plugin both adding tags. Platforms usually take the first one.
- Use one `og:image` per page. You may add more, but most platforms use the first one.
- Use a different image per page where possible (product photo, article cover). Fall back to a site default.
- HTML-escape the values (`&amp;`, `&quot;`).

## Designing the image

```
1200 x 630
+--------------------------------------------------------------+
|  60px margin                                                 |
|   +------------------------------------------------------+   |
|   |                                                      |   |
|   |      SAFE ZONE  1080 x 510                           |   |
|   |      title, logo, key visual                         |   |
|   |              +------------------+                    |   |
|   |              |  centre 630x630  |  <- square crops   |   |
|   |              |  (logo here)     |     keep this part |   |
|   |              +------------------+                    |   |
|   +------------------------------------------------------+   |
|  X crops about 15px from top and bottom (2:1)                |
+--------------------------------------------------------------+
```

- Big text: about 60–80 px for the title at 1200 px width. Previews are often shown at 300–500 px wide on phones.
- Strong contrast. Do not rely on thin fonts or small details.
- Some platforms put the title, domain or a play icon over the image, or round the corners. Keep the edges calm.
- Do not put "Click here" or fake buttons in the image.
- Make the image larger than 1200 × 630 only if you have a reason. Bigger files load slower and break the WhatsApp limit.
- Photos: crop to 1.91:1 with the subject in the centre (`make-social-images.mjs` uses smart "attention" cropping).
- Logos: letterbox them on a brand colour (`make-social-images.mjs --fit=contain --background=#111827`).
- Template: `examples/og-image-template.html` is a 1200 × 630 page with safe-zone guides. Screenshot it with headless Chrome, or use it as a design for dynamic images (Satori / `next/og`).

## Platform-specific extras (optional)

- **X exact crop:** `twitter:image` with a 1200 × 600 file (`make-social-images.mjs --presets=og,twitter`).
- **Pinterest:** put a 1000 × 1500 version on the page image for the Save button: `<img src="product.jpg" data-pin-media="https://acme.com/social/product-pinterest-1000x1500.jpg" ...>`.
- **Google structured data:** give `image` in three ratios (16:9, 4:3, 1:1), each at least 1200 px wide (`--presets=google`):

  ```html
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "Article", "headline": "...",
    "image": ["https://acme.com/social/post-google-16x9-1200x675.jpg",
              "https://acme.com/social/post-google-4x3-1200x900.jpg",
              "https://acme.com/social/post-google-1x1-1200x1200.jpg"] }
  </script>
  ```

- **Slack extra rows:** `<meta name="twitter:label1" content="Price"><meta name="twitter:data1" content="$129">`.

## Hosting rules for crawlers

| Rule | Why |
|---|---|
| Absolute `https://` URL on the production domain | Crawlers do not resolve relative URLs reliably; `localhost` and preview URLs behind auth cannot be reached |
| HTTP 200, `Content-Type: image/jpeg` or `image/png` | Redirects, 403 and HTML error pages give no preview |
| Do not block the crawlers | Allow `facebookexternalhit`, `Facebot`, `Twitterbot`, `LinkedInBot`, `WhatsApp`, `Slackbot`, `Discordbot`, `TelegramBot`, `Pinterestbot` in `robots.txt`, the firewall and bot protection (for example, Cloudflare bot rules), and hotlink protection |
| Fast: under ~1–2 s | Crawlers time out |
| Fixed format from image CDNs | Crawlers' `Accept` headers differ. Force the format in the URL (`f_jpg`, `fm=jpg`, `format=jpg`), not "auto" |
| Stable URL, long cache | Platforms fetch the image again later |
| New URL when the image changes | Platforms cache old images; `og-v2.jpg` or `og.jpg?v=2` forces a new download |

## Testing and refreshing

| Platform | Tool |
|---|---|
| Facebook, Messenger, Instagram link stickers | Sharing Debugger: `https://developers.facebook.com/tools/debug/` (use "Scrape Again" to refresh the cache) |
| LinkedIn | Post Inspector: `https://www.linkedin.com/post-inspector/` (also refreshes the cache) |
| X | The Card Validator no longer shows previews. Paste the link into a new post (do not publish) to see the card. The cache lasts about 7 days; a changed URL (`?v=2`) shows the new card |
| Telegram | Send the link to `@WebpageBot` to refresh |
| Slack, Discord, WhatsApp | Post the link in a private chat. Use a new URL (`?v=2`) to bypass the cache |
| All | `node scripts/check-social-meta.mjs https://your-page` (any crawler User-Agent: `--ua=linkedin`, `--ua=twitter`, ...) |

Local development: crawlers cannot reach `localhost`. Test on a deployed preview URL that does not need a login, or use a tunnel (ngrok, Cloudflare Tunnel). Run `check-social-meta.mjs` on local HTML files with `--public=public` to check the tags and the image file before you deploy.

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| No image at all | Relative URL; tags added by JavaScript; image blocked (403), redirected, or too big; SVG/AVIF | Absolute URL, SSR/prerender, allow crawlers, JPG/PNG under 5 MB |
| No image on the first Facebook share only | No `og:image:width`/`height` | Add them |
| Old image still shows | Platform cache | Change the image URL; use the debugger to scrape again |
| Image is cropped | Not 1.91:1 (or 2:1 on X) | 1200 × 630; separate `twitter:image` at 1200 × 600 if needed |
| Small thumbnail instead of a big image | Image below about 600 × 315; `twitter:card=summary`; missing `twitter:card` on X | 1200 × 630; `summary_large_image` |
| No preview in WhatsApp | File over ~300 KB, slow server, not `https` | Compress to 100–300 KB (JPG q75–85) |
| Blurry image | Source smaller than 1200 × 630, or upscaled | Use a larger source; for logos use PNG/SVG source with `--fit=contain` |
| Different image on every share | Several `og:image` tags, or a plugin and the theme both add tags | One set of tags |
| Works on Facebook, not on LinkedIn | LinkedIn is stricter about size (5 MB) and caching | Compress; Post Inspector |
| Wrong page title or image on a subpage | Child route tags do not merge with parent tags (Remix/React Router), or a static `index.html` is served for every route (SPA) | Set full tags per route; SSR/prerender each route |

## Generating images

- **Static:** one image per page, created at build time or by hand. Use `scripts/make-social-images.mjs`, a design tool, or `examples/og-image-template.html`.
- **Dynamic:** an endpoint that renders the image from the page data (title, author, price). Use `next/og` (`ImageResponse`) in Next.js, or Satori + resvg anywhere. Cache the result; rendering is slow. See `08-social-meta-frameworks.md`.
- **SaaS / CMS:** many CMSs and SEO plugins (Yoast, Rank Math, Shopify themes) have a "social image" field. Set a site-wide default, then per page.

## Other images in `<head>`: icons

| Purpose | Tag | Size |
|---|---|---|
| Browser tab icon | `<link rel="icon" href="/favicon.ico" sizes="32x32">` | 32 × 32 (ICO) |
| Modern browsers (scalable, can support dark mode) | `<link rel="icon" href="/icon.svg" type="image/svg+xml">` | SVG |
| iOS home screen | `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` | 180 × 180 PNG, no transparency |
| Android / PWA | `<link rel="manifest" href="/manifest.webmanifest">` with icons | 192 × 192 and 512 × 512 PNG; add a 512 × 512 `"purpose": "maskable"` icon with the logo inside the centre 80% |
| Browser UI colour | `<meta name="theme-color" content="#e11d48">` | |

Next.js App Router creates these tags from files: `app/favicon.ico`, `app/icon.png` / `icon.svg`, `app/apple-icon.png`. Other frameworks: put the files in the public folder and add the tags in the root layout.
