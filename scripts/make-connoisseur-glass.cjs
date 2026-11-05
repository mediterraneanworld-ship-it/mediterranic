/**
 * Builds the cover for "The Connoisseur" from the curator's own photograph.
 *
 * - The specimens are never redrawn: their pixels are copied from the photograph.
 * - Zoom: the visible width is the photograph width divided by the zoom factor.
 *   The frame keeps the 3:4 card format. When the photograph is shorter than the
 *   frame, the top and bottom strips are extended from the photograph's own edge
 *   colours (softened; no fossil content is copied).
 * - A glass layer (window reflection, sheen, bevelled edge) sits on top.
 *
 *   node scripts/make-connoisseur-glass.cjs [source] [output] [centreX] [zoom]
 *
 * Defaults: the Cyphaspis photograph, written to src/assets/connoisseur-cyphaspis-glass.jpg,
 * centred on the first piece (x = 420 px of 1016 px), zoom 1.3.
 * The JSON printed at the end records the zoom, the share of the width shown and the
 * change applied to the specimen area by the glass layer (should stay near zero).
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const SOURCE = process.argv[2] || "public/images/imported/cyphaspis-walteri-the-cyphaspis-patriarch-1.jpg";
const OUTPUT = process.argv[3] || "src/assets/connoisseur-cyphaspis-glass.jpg";
const CENTRE_X = Number(process.argv[4] || 420);
const ZOOM = Number(process.argv[5] || 1.3);
const MAX_WIDTH = 1200;
const STRIP_ROWS = 6;
const EDGE_BLUR = 22;

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
  if (!(ZOOM >= 1)) throw new Error("zoom must be 1 or more");

  // Work on the photograph as the browser sees it (EXIF orientation applied).
  const oriented = await sharp(SOURCE).rotate().toBuffer({ resolveWithObject: true });
  const W0 = oriented.info.width;
  const H0 = oriented.info.height;

  const visibleW = Math.round(W0 / ZOOM);
  const frameH = Math.round((visibleW * 4) / 3);
  const left = Math.min(W0 - visibleW, Math.max(0, Math.round(CENTRE_X - visibleW / 2)));

  let cropTop = 0;
  let cropH = H0;
  let bandTop = 0;
  let bandBottom = 0;
  if (frameH <= H0) {
    cropH = frameH;
    cropTop = Math.round((H0 - frameH) / 2);
  } else {
    bandTop = Math.floor((frameH - H0) / 2);
    bandBottom = frameH - H0 - bandTop;
  }

  const photo = await sharp(oriented.data)
    .extract({ left, top: cropTop, width: visibleW, height: cropH })
    .png()
    .toBuffer();
  const layers = [{ input: photo, left: 0, top: bandTop }];

  if (bandTop > 0) {
    // Background strips: the photograph's own top and bottom rows, stretched and softened.
    const topStrip = await sharp(photo)
      .extract({ left: 0, top: 0, width: visibleW, height: STRIP_ROWS })
      .resize(visibleW, bandTop, { fit: "fill" })
      .blur(EDGE_BLUR)
      .png()
      .toBuffer();
    const bottomStrip = await sharp(photo)
      .extract({ left: 0, top: cropH - STRIP_ROWS, width: visibleW, height: STRIP_ROWS })
      .resize(visibleW, bandBottom, { fit: "fill" })
      .blur(EDGE_BLUR)
      .png()
      .toBuffer();
    // Soft depth towards the outer edges only; the photograph itself is untouched.
    const depth = `<svg xmlns="http://www.w3.org/2000/svg" width="${visibleW}" height="${frameH}">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.26"/></linearGradient>
  </defs>
  <rect x="0" y="0" width="${visibleW}" height="${bandTop}" fill="url(#top)"/>
  <rect x="0" y="${bandTop + cropH}" width="${visibleW}" height="${bandBottom}" fill="url(#bottom)"/>
</svg>`;
    layers.unshift({ input: topStrip, left: 0, top: 0 }, { input: bottomStrip, left: 0, top: bandTop + cropH });
    layers.push({ input: Buffer.from(depth), left: 0, top: 0 });
  }

  const framed = await sharp({ create: { width: visibleW, height: frameH, channels: 3, background: "#000" } })
    .composite(layers)
    .png()
    .toBuffer();

  const edge = Math.max(4, Math.round(Math.min(visibleW, frameH) * 0.018));
  const glassed = await sharp(framed)
    .composite([
      { input: Buffer.from(glassLight(visibleW, frameH, edge)), blend: "screen" },
      { input: Buffer.from(glassShade(visibleW, frameH, edge)), blend: "multiply" },
    ])
    .png()
    .toBuffer();

  // Central area of the frame, where the specimens are: how far the glass layer moved its pixels.
  const region = {
    left: Math.round(visibleW * 0.25),
    top: Math.round(frameH * 0.25),
    width: Math.round(visibleW * 0.5),
    height: Math.round(frameH * 0.5),
  };
  const before = await sharp(framed).removeAlpha().extract(region).raw().toBuffer();
  const after = await sharp(glassed).removeAlpha().extract(region).raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < before.length; i += 1) sum += Math.abs(after[i] - before[i]);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  await sharp(glassed)
    .resize({ width: Math.min(MAX_WIDTH, visibleW), withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(OUTPUT);

  const out = await sharp(OUTPUT).metadata();
  console.log(
    JSON.stringify({
      output: OUTPUT,
      frame: `${out.width}x${out.height}`,
      zoom: Number((W0 / visibleW).toFixed(2)),
      photoWidthShownPercent: Math.round((visibleW / W0) * 100),
      centreX: CENTRE_X,
      cropLeft: left,
      bandsPx: { top: bandTop, bottom: bandBottom },
      specimenMeanChangeLevels: Number((sum / before.length).toFixed(2)),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
