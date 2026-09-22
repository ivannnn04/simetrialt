# Trivium – Webflow embed code

Pixel-matched build of the Figma file **Trivium** (frames *Home page* `10122:556`, *about us* `10122:711`, *Intelligence* `10122:1124`), packaged as copy-paste HTML for Webflow.

## Paste into Webflow (one embed per page)

1. Create a blank page in Webflow (no navbar / footer components – the embed contains its own).
2. Drop one **Embed** element on the page, open it and paste the whole contents of
   `dist/home.html` (or `about.html`, `intelligence.html`).
3. Publish. Each file is under Webflow's 50,000-character Embed limit.

Alternative: paste `dist/global-styles.html` once in **Site settings → Custom code → Head**
and use the smaller `dist/*.markup-only.html` files in the page embeds.

## Add your images

All photos are intentionally left empty (solid placeholder colour). Upload the images to
Webflow's Asset panel, copy each asset URL and edit the **IMAGE MAP** at the top of the
`<style>` block in the embed:

```css
.tv-page{
  --tv-img-home-hero:url("https://cdn.prod.website-files.com/…/hero.jpg");
  --tv-img-home-cta:url("…");
  --tv-img-property-1:url("…"); --tv-img-property-2:url("…"); --tv-img-property-3:url("…");
  --tv-watermark:url("…");   /* faint "T" mark inside the pillar cards */
}
```

The logo is a normal `<img>` in the navbar and footer – replace `REPLACE_WITH_LOGO_URL`
(two occurrences per page) with the uploaded logo URL. Until an image has a URL the slot
is hidden / shows the placeholder colour, nothing breaks.

## Fonts

* **Inter** and **Geist** load from Google Fonts via the `<link>` at the top of the embed.
* **Guton** (all display headings) is a licensed font that is not on Google Fonts. Upload it in
  **Site settings → Fonts** in Webflow with the family name `Guton`; the CSS already references
  it and falls back to Geist/Inter until then.

## Files

| Path | What it is |
|---|---|
| `dist/home.html`, `dist/about.html`, `dist/intelligence.html` | Copy-paste embeds (fonts + CSS + markup) |
| `dist/global-styles.html` + `dist/*.markup-only.html` | Split variant (shared CSS in site head) |
| `dist/preview-*.html` | Same content wrapped in a full document – open locally to preview |
| `src/` | Editable sources (`trivium.css`, page bodies, nav/footer partials) |
| `assets/` | Vector assets exported from Figma (arrow icon, hero grid lines, divider) |
| `build.mjs` | `node webflow/build.mjs` regenerates `dist/` from `src/` |

## Notes on fidelity

* Layout, spacing, type scale, colours and component states follow the Figma frames at 1440px;
  tablet (≤991px) and mobile (≤767px) breakpoints were added since the design has no mobile frames.
* Property cards show the "View Property" overlay on hover / focus (Figma shows it on card 1 as the hover state).
* The Intelligence page's empty first grid slot is intentional – the Figma card there has opacity 0.
* Headings "A selective view. A deeper pipeline." and "From information to intelligence." are set in
  Inter in the Figma file (not Guton); the markup keeps that via the `tv-font-inter` class – remove the
  class if it was meant to be Guton.
