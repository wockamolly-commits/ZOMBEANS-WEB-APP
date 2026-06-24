// Vectorize the official Zombeans logo PNG into a BIMI-compliant SVG_PS file.
//
// Approach: classify every pixel to the nearest brand color, then trace each
// color as a cumulative back-to-front mask (each layer includes every layer in
// front of it) so the layers nest without anti-alias seams. Output is true
// vector (no embedded raster), square, with a solid background, a <title>, and
// the SVG Tiny Portable/Secure profile attributes BIMI requires.
//
// Run: node scripts/trace-bimi-logo.mjs
// Requires: sharp (in deps) + potrace (npm i potrace --no-save)

import sharp from "sharp";
import potracePkg from "potrace";
import { writeFileSync } from "node:fs";

const { Potrace } = potracePkg;

const SRC = "public/images/brand/zombeans-logo.png";
const OUT = "public/images/brand/zombeans-logo-bimi.svg";
const SIZE = 1024; // canvas + trace resolution (square, BIMI-friendly)
const PAD = 0.1; // fraction of canvas kept as margin around the logo
const BG = "#203222"; // brand primary (BIMI forbids transparency)

// Palette sampled from the official PNG. Ordered BACK -> FRONT: each entry is
// drawn over the previous, so the white sticker border and black keyline become
// outlines once the fills are painted on top. The logo is a die-cut sticker, so
// its outermost ring is white (#fff) — that must be its own layer, otherwise
// those pixels classify to the nearest color (pink) and halo the whole bean.
const LAYERS = [
  { name: "sticker", color: "#ffffff", rgb: [255, 255, 255] },
  { name: "outline", color: "#0a0a08", rgb: [10, 10, 8] },
  { name: "bean-light", color: "#a85e27", rgb: [168, 94, 39] },
  { name: "bean-dark", color: "#622402", rgb: [98, 36, 2] },
  { name: "brain", color: "#e5a9b2", rgb: [229, 169, 178] },
  { name: "brain-fold", color: "#c0737f", rgb: [192, 115, 127] },
  { name: "slime", color: "#13cb0d", rgb: [19, 203, 13] },
];

function nearest(r, g, b) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < LAYERS.length; i++) {
    const [pr, pg, pb] = LAYERS[i].rgb;
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function tracePath(maskPng, color) {
  return new Promise((resolve, reject) => {
    const p = new Potrace({
      turdSize: 60, // drop specks smaller than this (px area)
      optTolerance: 0.6,
      turnPolicy: "minority",
      blackOnWhite: true, // trace the black pixels of the mask
      color,
    });
    p.loadImage(maskPng, (err) => {
      if (err) return reject(err);
      // Round coordinates to 1 decimal to keep the file well under BIMI's
      // ~32 KB ceiling without visible loss at avatar size.
      const tag = p.getPathTag().replace(/-?\d+\.\d+/g, (n) => (+n).toFixed(1));
      resolve(tag);
    });
  });
}

async function main() {
  // Trim transparent margins, fit the logo into a padded square, flatten onto
  // the brand background so classification sees real RGB everywhere.
  const inner = Math.round(SIZE * (1 - 2 * PAD));
  const { data, info } = await sharp(SRC)
    .trim()
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.round((SIZE - inner) / 2),
      bottom: SIZE - inner - Math.round((SIZE - inner) / 2),
      left: Math.round((SIZE - inner) / 2),
      right: SIZE - inner - Math.round((SIZE - inner) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const npx = width * height;

  // klass[i] = layer index of nearest palette color, or -1 for background.
  const klass = new Int8Array(npx);
  for (let i = 0; i < npx; i++) {
    const o = i * 4;
    klass[i] = data[o + 3] < 128 ? -1 : nearest(data[o], data[o + 1], data[o + 2]);
  }

  const paths = [];
  for (let L = 0; L < LAYERS.length; L++) {
    // Cumulative mask: this layer plus every layer stacked in front of it, so
    // the layers nest without anti-alias seams.
    const mask = Buffer.alloc(npx, 255); // white = ignored
    let any = false;
    for (let i = 0; i < npx; i++) {
      if (klass[i] >= L) {
        mask[i] = 0; // black = traced
        any = true;
      }
    }
    if (!any) continue;
    const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer();
    const tag = await tracePath(maskPng, LAYERS[L].color);
    // potrace emits a transl/scale group sometimes; getPathTag gives a bare
    // <path ...>. Normalize whitespace and keep as-is.
    paths.push(`  ${tag.trim()}`);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.2" baseProfile="tiny-ps" xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <title>Zombeans</title>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${BG}"/>
${paths.join("\n")}
</svg>
`;

  writeFileSync(OUT, svg);
  console.log(`Wrote ${OUT} (${(svg.length / 1024).toFixed(1)} KB, ${paths.length} layers)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
