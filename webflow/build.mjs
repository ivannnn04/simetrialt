// Assembles the copy-paste Webflow embeds from src/ partials.
// Run: node webflow/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');
const b64 = (f) => readFileSync(join(root, 'assets', f)).toString('base64');

const arrow = src('_arrow.html').trim();
const footer = src('_footer.html').trim();
const navTpl = src('_nav.html').trim();

let css = src('trivium.css');
// light minify: strip comments except the IMAGE MAP hints, collapse whitespace
css = css
  .replace(/\/\*\s*=+[\s\S]*?=+\s*\*\//g, '')
  .replace(/\/\* -{5,}[^*]*\*\//g, '')
  .replace(/\n\s+/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .trim();

const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">';

const nav = (page) => navTpl.replace(/\{\{ACTIVE:(\w+)\}\}/g, (_, p) => (p === page ? ' is-active' : ''));

const pages = ['home', 'about', 'intelligence'];
mkdirSync(join(root, 'dist'), { recursive: true });
const sizes = {};
for (const p of pages) {
  const body = src(`${p}.body.html`)
    .replace(/\{\{NAV:(\w+)\}\}/g, (_, page) => nav(page))
    .replace(/\{\{FOOTER\}\}/g, footer)
    .replace(/\{\{ARROW\}\}/g, arrow)
    .trim();
  const embed = `<!-- TRIVIUM :: ${p} page — paste this whole file into ONE Webflow Embed element on a blank page -->\n${fonts}\n<style>\n${css}\n</style>\n${body}\n`;
  writeFileSync(join(root, 'dist', `${p}.html`), embed);
  sizes[`${p}.html`] = embed.length;
  // standalone preview (identical content wrapped in a document)
  const preview = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trivium – ${p}</title></head><body style="margin:0">\n${embed}</body></html>\n`;
  writeFileSync(join(root, 'dist', `preview-${p}.html`), preview);
}
// shared pieces for the "site-wide CSS + small per-page embed" alternative
writeFileSync(join(root, 'dist', 'global-styles.html'), `${fonts}\n<style>\n${css}\n</style>\n`);
for (const p of pages) {
  const body = src(`${p}.body.html`)
    .replace(/\{\{NAV:(\w+)\}\}/g, (_, page) => nav(page))
    .replace(/\{\{FOOTER\}\}/g, footer)
    .replace(/\{\{ARROW\}\}/g, arrow)
    .trim();
  writeFileSync(join(root, 'dist', `${p}.markup-only.html`), body + '\n');
  sizes[`${p}.markup-only.html`] = body.length;
}
sizes['global-styles.html'] = readFileSync(join(root, 'dist', 'global-styles.html'), 'utf8').length;
console.log(JSON.stringify(sizes, null, 2));
