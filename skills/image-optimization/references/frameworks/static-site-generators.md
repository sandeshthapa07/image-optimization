# Static site generators: Eleventy, Hugo, Jekyll, Docusaurus

## Eleventy (`@11ty/eleventy-img`)

### HTML transform (Eleventy 3): optimize every `<img>` in the output

```js
// eleventy.config.js
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ['avif', 'webp', 'auto'],
    widths: [480, 960, 1600, 'auto'],
    htmlOptions: {
      imgAttributes: { loading: 'lazy', decoding: 'async' }, // the defaults for all images
    },
  });
}
```

- Attributes that you write on an `<img>` in the source win over the defaults. On the hero, write `loading="eager" fetchpriority="high"`:

  ```html
  <img src="./hero.jpg" alt="..." sizes="100vw" loading="eager" fetchpriority="high">
  ```

- With more than one width, every image needs a `sizes` attribute. Eleventy Image reports an error when it is missing.
- `width` and `height` are added automatically.

### Shortcode (Eleventy 2 and 3)

Use `Image(src, options)` and `Image.generateHTML(metadata, attributes)` in a shortcode. Pass `sizes`, `loading` and `fetchpriority` in `attributes`.

## Hugo (image processing)

Images must be page resources or in `assets/` (not in `static/`).

```go-html-template
{{/* layouts/partials/img.html — call with (dict "src" "images/hero.jpg" "alt" "..." "sizes" "100vw" "priority" true) */}}
{{ $img := resources.Get .src }}
{{ $widths := slice 480 768 1200 1600 2400 }}
{{ $srcset := slice }}
{{ range $widths }}
  {{ if le . $img.Width }}
    {{ $r := $img.Resize (printf "%dx webp q75" .) }}
    {{ $srcset = $srcset | append (printf "%s %dw" $r.RelPermalink .) }}
  {{ end }}
{{ end }}
{{ $fallback := $img.Resize "1200x webp q75" }}
<img src="{{ $fallback.RelPermalink }}" srcset="{{ delimit $srcset ", " }}" sizes="{{ .sizes }}"
     width="{{ $img.Width }}" height="{{ $img.Height }}" alt="{{ .alt }}"
     {{ if .priority }}fetchpriority="high"{{ else }}loading="lazy" decoding="async"{{ end }}>
```

- `.Fill "800x600 center"` crops to an exact ratio. `.Fit` fits inside a box. `.Process` (newer Hugo versions) combines operations.
- If the source is smaller than 1200px, the fallback upscales it. Use `.Width` to choose a smaller fallback.
- To make Markdown images responsive and lazy, add a render hook: `layouts/_default/_markup/render-image.html` that calls the partial.

## Jekyll

Use the `jekyll_picture_tag` plugin to generate widths and formats, or generate the files with a build script (sharp) and write `srcset` yourself. Set `loading`/`fetchpriority` per image by role.

## Docusaurus

Use `@docusaurus/plugin-ideal-image` for responsive images in MDX (`<Image img={require('./img.png')} />`). For the hero on the home page, use a plain `<img>` with `fetchpriority="high"` and explicit dimensions.
