# Cheatsheet

| Problem                                     | Solution                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Image stretched in a card or thumbnail      | `object-fit: cover`, plus `object-position` for the focal point           |
| Image squished after making it responsive   | Add `height: auto` next to `width: 100%`                                  |
| Avatar squished into an oval in a flex row  | `flex-shrink: 0` on the image                                             |
| Tailwind `w-full h-64` image distorted      | Add `object-cover`                                                        |
| Next.js `fill` image stretched              | `object-fit: cover` through `style` or `className`                        |
| Image distorted after adding `aspect-ratio` | Add `object-fit: cover`                                                   |
| Crop is wrong on mobile                     | `<picture>` + `<source media>`, with `width`/`height` on each source      |
| Photo blurry on retina screens              | Larger `srcset` candidates (about 2× the rendered width), correct `sizes` |
| Logo or icon blurry                         | Use SVG, with `width`/`height` or a `viewBox`                             |
| Photo sideways, or reserved space is wrong  | EXIF rotation: re-export the file with the orientation applied            |
| Screen reader says "image" or a file name   | A filled, descriptive `alt`                                               |
| Decorative image read aloud                 | Filled `alt` + `aria-hidden="true"`                                       |
| Shared link shows no image                  | Absolute `https://` `og:image` in the server HTML, 1200×630 JPG or PNG    |
| Link preview shows the old image            | New image URL, then refresh the platform cache                            |
| Text cut off in the X preview               | Keep text in the centre safe zone: X crops to 2:1                         |
