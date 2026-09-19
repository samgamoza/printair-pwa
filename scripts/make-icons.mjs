// Generates the in-app logo and every app icon from the brand mark. Run with `npm run icons`.
//
// Source: brand/printair-mark-source.png — the PrintAir paper plane, used exactly as supplied.
// The supplied file has a grey-and-white "transparency" checkerboard painted into it rather than
// real transparency, so the only processing is to make that backdrop genuinely transparent.
// The artwork itself (shapes, colours, gradients) is not redrawn, recoloured or reshaped.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = new URL('public/', root);
await mkdir(new URL('icons/', out), { recursive: true });

/* ---------- 1. Lift the mark off its painted-in backdrop ---------- */

const { data, info } = await sharp(new URL('brand/printair-mark-source.png', root).pathname)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = info;

// Backdrop pixels are near-white and colourless. Flood-fill inwards from the edges so that only
// backdrop connected to the outside is cleared; light pixels inside the plane are left alone.
const isBackdrop = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return Math.min(r, g, b) >= 236 && Math.max(r, g, b) - Math.min(r, g, b) <= 10;
};
const seen = new Uint8Array(width * height);
const queue = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (seen[p] || !isBackdrop(p * 4)) return;
  seen[p] = 1;
  queue.push(p);
};
for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
while (queue.length) {
  const p = queue.pop();
  data[p * 4 + 3] = 0;
  const x = p % width, y = (p - x) / width;
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
}
// Soften the cut: edge pixels that are a blend of artwork and white backdrop get partial
// transparency in proportion to how white they are, so no pale fringe shows on dark surfaces.
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const p = y * width + x;
    if (seen[p]) continue;
    if (!(seen[p - 1] || seen[p + 1] || seen[p - width] || seen[p + width])) continue;
    const i = p * 4;
    const whiteness = Math.min(data[i], data[i + 1], data[i + 2]) / 255;
    if (whiteness > 0.55) data[i + 3] = Math.round(255 * (1 - (whiteness - 0.55) / 0.45));
  }
}

const mark = await sharp(data, { raw: { width, height, channels: 4 } }).trim().png().toBuffer();
const markMeta = await sharp(mark).metadata();

// Square it up (transparent padding only) so it sits centred wherever it is placed.
const side = Math.max(markMeta.width, markMeta.height);
const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: mark, gravity: 'centre' }])
  .png()
  .toBuffer();

await sharp(square).resize(512, 512).png().toFile(new URL('logo-mark.png', out).pathname);

/* ---------- 2. App icons: the mark on a white tile ---------- */

/** `pad` is the share of the canvas left empty around the mark; `radius` rounds the tile (0 = square). */
async function icon(file, { size, pad, radius }) {
  const inner = Math.round(size * (1 - pad * 2));
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="#ffffff"/></svg>`,
  );
  const art = await sharp(square).resize(inner, inner).png().toBuffer();
  await sharp(tile).composite([{ input: art, gravity: 'centre' }]).png().toFile(new URL(file, out).pathname);
}

function glyph({ bg, draw }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="${bg}"/>${draw}</svg>`);
}
const png = (svg, file) => sharp(svg).png().toFile(new URL(file, out).pathname);

await Promise.all([
  icon('icons/icon-192.png', { size: 192, pad: 0.1, radius: 0.24 }),
  icon('icons/icon-512.png', { size: 512, pad: 0.1, radius: 0.24 }),
  // Maskable: full-bleed square with the mark inside the safe zone, so any launcher shape can crop it.
  icon('icons/maskable-192.png', { size: 192, pad: 0.2, radius: 0 }),
  icon('icons/maskable-512.png', { size: 512, pad: 0.2, radius: 0 }),
  // iOS ignores the manifest and wants an opaque square it rounds itself.
  icon('apple-touch-icon.png', { size: 180, pad: 0.12, radius: 0 }),
  icon('icons/favicon-32.png', { size: 32, pad: 0.04, radius: 0.22 }),
  icon('icons/favicon-64.png', { size: 64, pad: 0.04, radius: 0.22 }),
  // Home-screen shortcut icons.
  png(glyph({ bg: '#ee2a8b', draw: '<path d="M48 26v44M26 48h44" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' }), 'icons/shortcut-new.png'),
  png(glyph({ bg: '#22bdf0', draw: '<rect x="24" y="30" width="48" height="38" rx="7" fill="none" stroke="#0f0d1a" stroke-width="7"/><path d="M24 42h48" stroke="#0f0d1a" stroke-width="7"/>' }), 'icons/shortcut-projects.png'),
  png(glyph({ bg: '#ffd21f', draw: '<path d="M24 38l24-12 24 12v26a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="none" stroke="#0f0d1a" stroke-width="7" stroke-linejoin="round"/><path d="M24 40l24 14 24-14" fill="none" stroke="#0f0d1a" stroke-width="7" stroke-linejoin="round"/>' }), 'icons/shortcut-opps.png'),
]);

console.log('Logo written to public/logo-mark.png; icons to public/ and public/icons/');
