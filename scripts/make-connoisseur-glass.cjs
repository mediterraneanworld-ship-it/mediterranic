/**
 * Builds the cover for "The Connoisseur" from a real photograph of one of the
 * curator's pieces. The photograph is cropped to the cover's 3:4 frame and a
 * layer of glass is added on top: a window reflection, a diagonal sheen, a
 * light glint, a bright bevelled edge and a faint inner line. The specimen in
 * the centre is never retouched; the script reports how much the central
 * specimen area changed.
 *
 *   node scripts/make-connoisseur-glass.cjs <source.jpg> <output.jpg> [centerX]
 *
 * centerX is the horizontal centre of the crop, in source pixels (default: middle).
 */
const sharp = require("sharp");

const [, , source, output, centreArg] = process.argv;
if (!source || !output) {
  console.error("usage: node scripts/make-connoisseur-glass.cjs <source.jpg> <output.jpg> [centerX]");
  process.exit(1);
}

const MAX_WIDTH = 1200;

/** Reflections and light on the glass surface (added with the screen blend). */
function glassLight(w, h, edge) {
  const inset = edge * 2.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0.00" stop-color="#fff" stop-opacity="0.30"/>
      <stop offset="0.12" stop-color="#fff" stop-opacity="0.26"/>
      <stop offset="0.24" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.60" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.70" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="0.80" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1.00" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="tint" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0.72" stop-color="#d6f1ff" stop-opacity="0"/>
      <stop offset="1" stop-color="#d6f1ff" stop-opacity="0.16"/>
    </radialGradient>
    <linearGradient id="bevel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.92"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="inner" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${Math.round(w * 0.02)}"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sheen)"/>
  <rect width="${w}" height="${h}" fill="url(#tint)"/>
  <rect x="${w * 0.05}" y="${h * 0.02}" width="${w * 0.44}" height="${h * 0.16}" rx="${w * 0.04}" fill="#fff" fill-opacity="0.34" filter="url(#soft)"/>
  <line x1="${w * 0.70}" y1="0" x2="${w * 0.94}" y2="${h * 0.16}" stroke="#fff" stroke-opacity="0.32" stroke-width="${Math.max(2, edge * 0.5)}"/>
  <rect x="${edge / 2}" y="${edge / 2}" width="${w - edge}" height="${h - edge}" fill="none" stroke="url(#bevel)" stroke-width="${edge}"/>
  <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="url(#inner)" stroke-width="${Math.max(1, edge * 0.4)}"/>
</svg>`;
}

/** Thickness of the glass plate: a dark bevel on the far edges (multiply blend). */
function glassShade(w, h, edge) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="thick" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0.03"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.40"/>
    </linearGradient>
  </defs>
  <rect x="${edge * 1.2}" y="${edge * 1.2}" width="${w - edge * 2.4}" height="${h - edge * 2.4}" fill="none" stroke="url(#thick)" stroke-width="${Math.max(1, edge * 0.7)}"/>
</svg>`;
}

async function main() {
  // Work on the photograph as the browser sees it (EXIF orientation applied).
  const oriented = await sharp(source).rotate().toBuffer({ resolveWithObject: true });
  const W0 = oriented.info.width;
  const H0 = oriented.info.height;

  // Largest 3:4 portrait window. Landscape photographs keep the full height.
  let cropH = H0;
  let cropW = Math.round((cropH * 3) / 4);
  if (cropW > W0) {
    cropW = W0;
    cropH = Math.round((cropW * 4) / 3);
  }
  const centre = centreArg ? Number(centreArg) : W0 / 2;
  const left = Math.min(W0 - cropW, Math.max(0, Math.round(centre - cropW / 2)));
  const top = Math.round((H0 - cropH) / 2);

  const cropped = await sharp(oriented.data)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const edge = Math.max(4, Math.round(Math.min(cropW, cropH) * 0.018));
  const glassed = await sharp(cropped)
    .composite([
      { input: Buffer.from(glassLight(cropW, cropH, edge)), blend: "screen" },
      { input: Buffer.from(glassShade(cropW, cropH, edge)), blend: "multiply" },
    ])
    .png()
    .toBuffer();

  // Central specimen area: how far its pixels moved (glass layer only).
  const region = (w, h) => ({
    left: Math.round(w * 0.25),
    top: Math.round(h * 0.25),
    width: Math.round(w * 0.5),
    height: Math.round(h * 0.5),
  });
  const before = await sharp(cropped).removeAlpha().extract(region(cropW, cropH)).raw().toBuffer();
  const after = await sharp(glassed).removeAlpha().extract(region(cropW, cropH)).raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < before.length; i += 1) sum += Math.abs(after[i] - before[i]);
  const meanChange = sum / before.length;

  await sharp(glassed)
    .resize({ width: Math.min(MAX_WIDTH, cropW), withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(output);

  const out = await sharp(output).metadata();
  console.log(
    JSON.stringify({
      output,
      width: out.width,
      height: out.height,
      crop: { left, top, width: cropW, height: cropH },
      specimenMeanChangeLevels: Number(meanChange.toFixed(2)),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
