/** Reproducible, non-generative cover: original photographed slab, digital glass.
 * Only border-connected dark backdrop is masked. Interior fossil/stone pixels
 * keep their original RGB; the specimen is never repainted, reshaped or enhanced.
 * Run with the project's existing Sharp dependency: node scripts/make-connoisseur-cover.cjs
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const sharp = require('sharp');

const source = 'public/images/imported/sandblasted-mortality-the-sandblasted-patriarch-1.jpg';
const output = 'public/images/connoisseur-glass.png';
const width = 1080, height = 1440;

(async () => {
  const original = fs.readFileSync(source);
  const { data, info } = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let tail = 0, head = 0;
  function visit(index) {
    if (outside[index]) return;
    const p = index * info.channels;
    const luminance = data[p] * .2126 + data[p + 1] * .7152 + data[p + 2] * .0722;
    if (luminance > 78 || Math.max(data[p], data[p + 1], data[p + 2]) > 124) return;
    outside[index] = 1; queue[tail++] = index;
  }
  for (let x = 0; x < info.width; x++) { visit(x); visit((info.height - 1) * info.width + x); }
  for (let y = 0; y < info.height; y++) { visit(y * info.width); visit(y * info.width + info.width - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % info.width, y = Math.floor(p / info.width);
    if (x) visit(p - 1); if (x + 1 < info.width) visit(p + 1);
    if (y) visit(p - info.width); if (y + 1 < info.height) visit(p + info.width);
  }
  // The entire slab is a single connected foreground. Remove detached cloth
  // speckles left by JPEG noise, never pixels belonging to that slab.
  const labels = new Int32Array(n);
  let label = 0, largest = 0, largestSize = 0;
  for (let start = 0; start < n; start++) {
    if (outside[start] || labels[start]) continue;
    label++; head = 0; tail = 1; queue[0] = start; labels[start] = label;
    while (head < tail) {
      const at = queue[head++], x = at % info.width, y = Math.floor(at / info.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) continue;
        const next = ny * info.width + nx;
        if (outside[next] || labels[next]) continue;
        labels[next] = label; queue[tail++] = next;
      }
    }
    if (tail > largestSize) { largest = label; largestSize = tail; }
  }
  for (let i = 0; i < n; i++) if (labels[i] !== largest) outside[i] = 1;
  const rgba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = data[i * info.channels];
    rgba[i * 4 + 1] = data[i * info.channels + 1];
    rgba[i * 4 + 2] = data[i * info.channels + 2];
    rgba[i * 4 + 3] = outside[i] ? 0 : 255;
  }
  const photograph = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 4 }).resize({ width: 810, height: 570, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const photo = await sharp(photograph).metadata();
  const photoLeft = Math.round((width - photo.width) / 2);
  const photoTop = 890 - photo.height;

  const background = Buffer.from(`<svg width="1080" height="1440" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="room" cx="47%" cy="37%" r="76%"><stop stop-color="#34414b"/><stop offset=".48" stop-color="#15212b"/><stop offset="1" stop-color="#070f17"/></radialGradient>
      <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#32302b"/><stop offset=".2" stop-color="#15191c"/><stop offset=".7" stop-color="#0b1117"/><stop offset="1" stop-color="#25282a"/></linearGradient>
      <radialGradient id="top"><stop stop-color="#3b3328"/><stop offset="1" stop-color="#11171c"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="21"/></filter>
    </defs>
    <rect width="1080" height="1440" fill="url(#room)"/>
    <ellipse cx="540" cy="1084" rx="475" ry="59" fill="#000" opacity=".52" filter="url(#blur)"/>
    <path d="M65 956 A475 87 0 0 0 1015 956 L1015 1035 A475 88 0 0 1 65 1035Z" fill="url(#base)"/>
    <ellipse cx="540" cy="956" rx="475" ry="87" fill="url(#top)" stroke="#897c58" stroke-opacity=".38" stroke-width="2"/>
    <ellipse cx="540" cy="967" rx="458" ry="79" fill="none" stroke="#d1c09c" stroke-opacity=".1" stroke-width="2"/>
    <path d="M126 937 L126 507 C126 49 954 49 954 507 L954 937 Q540 1031 126 937Z" fill="#d0edec" fill-opacity=".016"/>
    <ellipse cx="540" cy="902" rx="340" ry="36" fill="#000" opacity=".42" filter="url(#blur)"/>
    <path d="M445 873 L461 926 L616 926 L634 873" fill="#111a20" stroke="#4a4e4c" stroke-width="2"/>
  </svg>`);
  const glass = Buffer.from(`<svg width="1080" height="1440" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="edge"><stop stop-color="#acc6c6" stop-opacity=".36"/><stop offset=".08" stop-color="#fff" stop-opacity=".88"/><stop offset=".3" stop-color="#e5ffff" stop-opacity=".12"/><stop offset=".67" stop-color="#fff" stop-opacity=".11"/><stop offset=".92" stop-color="#e6cf9d" stop-opacity=".67"/><stop offset="1" stop-color="#b2dfdf" stop-opacity=".3"/></linearGradient>
      <linearGradient id="reflection" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".51"/><stop offset=".52" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter>
    </defs>
    <path d="M126 937 L126 507 C126 49 954 49 954 507 L954 937" fill="none" stroke="#bbd9da" stroke-width="9" stroke-opacity=".11" filter="url(#soft)"/>
    <path d="M126 937 L126 507 C126 49 954 49 954 507 L954 937" fill="none" stroke="url(#edge)" stroke-width="3.1"/>
    <path d="M133 934 L133 509 C133 61 947 61 947 509 L947 934" fill="none" stroke="#f4ffff" stroke-width="1.1" stroke-opacity=".28"/>
    <path d="M174 609 L174 468 C174 323 252 228 329 208 L314 238 C249 268 202 360 202 474 L199 612Z" fill="url(#reflection)"/>
    <path d="M885 370 Q916 435 916 515 L916 849 L904 869 L905 507 Q905 431 883 392Z" fill="url(#reflection)" opacity=".48"/>
    <path d="M270 243 Q476 102 707 200" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="5" filter="url(#soft)"/>
    <path d="M126 937 C126 993 954 993 954 937" fill="none" stroke="url(#edge)" stroke-width="3.5"/>
    <path d="M132 938 C132 982 948 982 948 938" fill="none" stroke="#ecffff" stroke-opacity=".24" stroke-width="1.2"/>
    <path d="M126 937 C126 885 954 885 954 937" fill="none" stroke="#defcfc" stroke-opacity=".11" stroke-width="1.4"/>
  </svg>`);
  const composed = await sharp(background).composite([
    { input: photograph, left: photoLeft, top: photoTop }, { input: glass, left: 0, top: 0 },
  ]).png().toBuffer();
  fs.writeFileSync(output, composed);
  // Backwards-compatible alias for the old bundled cover, including admin
  // content that still points to it. Uploaded/custom cover URLs are untouched.
  await sharp(composed).jpeg({ quality: 94, mozjpeg: true }).toFile('public/images/products/erbenochile-erbeni.jpg');
  const metadata = {
    title: 'The Connoisseur — Fezouata slab under digital glass',
    source: '/' + source.replace(/^public\//, ''),
    sourceSha256: crypto.createHash('sha256').update(original).digest('hex'),
    output: '/images/connoisseur-glass.png', width, height,
    method: 'Non-generative photo compositing. Only border-connected dark cloth masked; original specimen RGB retained before proportional resizing. Digital display glass added.',
    specimenRedrawn: false,
    note: 'Editorial cover only. No glass display is included with a specimen unless expressly stated.',
  };
  fs.writeFileSync('public/images/connoisseur-glass-info.json', JSON.stringify(metadata, null, 2) + '\n');
  console.log('Original photo unchanged:', metadata.sourceSha256);
  console.log('Created cover and legacy bundled-cover alias:', output);
})().catch((error) => { console.error(error); process.exit(1); });
