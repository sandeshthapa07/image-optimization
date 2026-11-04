# Performance Cheatsheet

| Problem                                   | Solution                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Slow LCP, hero image loads last           | Remove `loading="lazy"` from the hero, add `fetchpriority="high"`        |
| No image gets priority                    | `fetchpriority="high"` on one image per page only                        |
| Layout jumps when images load (CLS)       | `width` and `height` attributes with the real file ratio                 |
| Grid images download too large            | `sizes` that matches the rendered CSS width                              |
| `srcset` picks a file that is too big     | Add `sizes`: without it the browser assumes `100vw`                      |
| Above-the-fold image found late           | No JavaScript lazy loading (`data-src`) above the fold                   |
| CSS background hero loads late            | Use `<img>` + `object-fit`, or a preload with `fetchpriority="high"`     |
| Mobile and desktop images both download   | One `<picture>`, not two `<img>` hidden with `display: none`             |
| Hidden carousel slides slow the first one | `loading="lazy"` + `fetchpriority="low"` on hidden slides                |
| Lazy and preload on the same image        | Pick one: they conflict                                                  |
| JPG and PNG files are heavy               | AVIF or WebP, with a JPG/PNG fallback                                    |
| Animated GIF is megabytes                 | `<video autoplay muted loop playsinline>`                                |
| Files much bigger than needed             | Largest file about 2× the largest rendered width                         |
| Repeat visits download images again       | Hashed file names + `Cache-Control: public, max-age=31536000, immutable` |
