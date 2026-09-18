# Site imagery

> Currently every slot shows one temporary Unsplash photo (see `src/lib/placeholder.ts`).
> Set `NEXT_PUBLIC_PLACEHOLDER_IMAGE=""` in Vercel to switch back to the files listed below.

Photos from the Figma file could not be exported automatically (the design CDN is not reachable
from the build environment). Drop the exports here using these names — the pages already
reference them and fall back to a tonal gradient while a file is missing.

| Path | Used in | Figma layer |
| --- | --- | --- |
| `home/hero.jpg` | Home hero | hero |
| `home/why.jpg` | Home "Why architects" | 2 section (with image) |
| `home/features.jpg` | Home "Long-term partnerships" | features |
| `home/about.jpg` | Home "About" | about |
| `projects/prusta.jpg` | Home + Services "PRUSTA Jogailos butas" | projects |
| `services/lighting.jpg` | Services list / 01 | Service card image |
| `services/smart-home.jpg` | Services list / 02 | Service card image |
| `services/bespoke.jpg` | Services list / 03 | Service card image |
| `services/installation.jpg` | Services list / 04 | Service card image |
| `services/hero.jpg` | Services hero | image 6478 |
| `services/process-1.jpg` … `process-4.jpg` | Services process cards | 3 section / card |
| `services/cta.jpg` | Services CTA thumbnail | CTA section / image |
| `menu/icons.jpg`, `menu/outlet.jpg` | Products mega-menu cards | open menu / cards |
| `projects/<slug>/cover.jpg` | Projects grid card | card project / image |
| `projects/<slug>/hero.jpg`, `1.jpg`…`7.jpg` | Project detail page | hero case, images, images grid |
| `brands/<slug>.jpg` | Brand card hover photo | brand card (hover) |
| `brands/<slug>-collection-1.jpg`…`-4.jpg`, `brands/<slug>-cta.jpg` | Brand detail page | Signature collections, section cta |
| `about/hero.jpg`, `about/features.jpg`, `about/cta.jpg`, `about/banner.jpg`, `about/team-1.jpg`…`team-8.jpg` | About page | hero, features, CTA, banner, Team Member Card |
| `contact/hero.jpg` | Contact page | image 6478 |

Recommended size: 2880px wide for full-bleed sections (2× of 1440), JPEG quality ~80.
