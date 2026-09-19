// Generates every icon the app needs from the plane mark. Run with `npm run icons`.
// The geometry below mirrors PlaneGlyph in src/components/ui/Marks.tsx — change both together.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const plane = `
  <polygon points="44,4 3,21 19,28" fill="#22bdf0"/>
  <polygon points="44,4 19,28 27,45" fill="#ee2a8b"/>
  <polygon points="19,28 18,41 24.6,34.2" fill="#5d38dc"/>
  <rect x="2" y="33.5" width="10" height="3.6" rx="1.8" fill="#ffd21f" transform="rotate(-38 7 35.3)"/>
  <rect x="7" y="40" width="7" height="3.6" rx="1.8" fill="#ffd21f" transform="rotate(-38 10.5 41.8)"/>`;

/** `pad` is the share of the canvas left empty around the plane; `radius` rounds the tile (0 = square, for maskable). */
function icon({ size, pad, radius, bg = '#0f0d1a' }) {
  const inner = size * (1 - pad * 2);
  const scale = inner / 48;
  const offset = size * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * radius}" fill="${bg}"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${plane}</g>
  </svg>`;
}

function glyph({ size, bg, draw }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="24" fill="${bg}"/>${draw}</svg>`;
}

const out = new URL('../public/', import.meta.url);
await mkdir(new URL('icons/', out), { recursive: true });

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(new URL(file, out).pathname);

await Promise.all([
  // Standard icons: rounded ink tile, as drawn in the app.
  png(icon({ size: 192, pad: 0.17, radius: 0.24 }), 'icons/icon-192.png'),
  png(icon({ size: 512, pad: 0.17, radius: 0.24 }), 'icons/icon-512.png'),
  // Maskable: full-bleed square with the plane inside the safe zone, so any launcher shape can crop it.
  png(icon({ size: 192, pad: 0.26, radius: 0 }), 'icons/maskable-192.png'),
  png(icon({ size: 512, pad: 0.26, radius: 0 }), 'icons/maskable-512.png'),
  // iOS ignores the manifest and wants an opaque square it rounds itself.
  png(icon({ size: 180, pad: 0.2, radius: 0 }), 'apple-touch-icon.png'),
  png(icon({ size: 32, pad: 0.1, radius: 0.22 }), 'icons/favicon-32.png'),
  // Home-screen shortcut icons.
  png(glyph({ size: 96, bg: '#ee2a8b', draw: '<path d="M48 26v44M26 48h44" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' }), 'icons/shortcut-new.png'),
  png(glyph({ size: 96, bg: '#22bdf0', draw: '<rect x="24" y="30" width="48" height="38" rx="7" fill="none" stroke="#0f0d1a" stroke-width="7"/><path d="M24 42h48" stroke="#0f0d1a" stroke-width="7"/>' }), 'icons/shortcut-projects.png'),
  png(glyph({ size: 96, bg: '#ffd21f', draw: '<path d="M24 38l24-12 24 12v26a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="none" stroke="#0f0d1a" stroke-width="7" stroke-linejoin="round"/><path d="M24 40l24 14 24-14" fill="none" stroke="#0f0d1a" stroke-width="7" stroke-linejoin="round"/>' }), 'icons/shortcut-opps.png'),
  writeFile(new URL('favicon.svg', out), icon({ size: 64, pad: 0.12, radius: 0.24 })),
]);

console.log('Icons written to public/ and public/icons/');
