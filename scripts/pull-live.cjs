/**
 * PASSO 0 de cada sessão de trabalho: espelhar a loja publicada para o
 * ambiente local, para que o preview mostre as peças e os textos REAIS.
 *
 *   node scripts/pull-live.cjs [https://mediterranic.vercel.app]
 *
 * Lê apenas as páginas públicas (sitemap, páginas de produto, /archive e a
 * home), por isso funciona sem a palavra-passe do back-office. Faz upsert por
 * slug na base de dados local — NUNCA apaga nada. As fotografias guardadas na
 * base de dados da loja (/api/uploads/N) são descarregadas e inseridas na base
 * local, com os URLs remapeados.
 *
 * Nota: isto espelha a produção -> sandbox. O caminho inverso (sandbox ->
 * produção) continua a ser o push do código; os dados de produção nunca são
 * tocados por este script.
 */
const { Client } = require("pg");

const BASE = (process.argv[2] || "https://mediterranic.vercel.app").replace(/\/$/, "");
const DB = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

/* ---------------- helpers ---------------- */

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "mediterranic-sync" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

function decodeRsc(html) {
  // Next serialises client-component props into self.__next_f.push([1,"..."])
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => m[1]);
  let blob = chunks.join("");
  blob = blob
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
  return blob;
}

/** Extracts one balanced JSON value starting at `start` in `text`. */
function balancedJson(text, start) {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function findJsonAfter(blob, key) {
  const idx = blob.indexOf(key);
  if (idx < 0) return null;
  const start = blob.indexOf(blob[idx + key.length] === "[" ? "[" : "{", idx + key.length - 1);
  const openIdx = idx + key.length;
  const raw = balancedJson(blob, openIdx);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&rsquo;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, re) {
  const m = html.match(re);
  return m ? stripTags(m[1]) : null;
}

/* ---------------- main ---------------- */

(async () => {
  const db = new Client({ connectionString: DB });
  await db.connect();

  console.log(`→ loja: ${BASE}`);

  // 1. slugs do sitemap
  const sitemap = await getText(`${BASE}/sitemap.xml`);
  const slugs = [...new Set([...sitemap.matchAll(/\/shop\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]))];
  console.log(`→ ${slugs.length} peças no sitemap`);

  // 2. peças no arquivo público (archived=true; podem não estar no sitemap)
  const archiveHtml = await getText(`${BASE}/archive`);
  const archivedSlugs = new Set([...archiveHtml.matchAll(/href="\/shop\/([a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const s of archivedSlugs) if (!slugs.includes(s)) slugs.push(s);
  console.log(`→ ${archivedSlugs.size} peças no arquivo público`);

  // cache de uploads remotos -> URL local
  const uploadMap = new Map();
  async function localiseImage(src) {
    if (!src || !src.startsWith("/api/uploads/")) return src; // /images/... vem do repo
    if (uploadMap.has(src)) return uploadMap.get(src);
    const res = await fetch(`${BASE}${src}`);
    if (!res.ok) {
      uploadMap.set(src, src);
      return src;
    }
    const mime = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    const { rows } = await db.query(
      `INSERT INTO uploaded_images (filename, mime_type, data_base64) VALUES ($1,$2,$3) RETURNING id`,
      [src.split("/").pop() + ".jpg", mime, buf.toString("base64")],
    );
    const local = `/api/uploads/${rows[0].id}`;
    uploadMap.set(src, local);
    console.log(`   foto ${src} → ${local} (${Math.round(buf.length / 1024)} kB)`);
    return local;
  }

  let updated = 0;
  let inserted = 0;

  for (const slug of slugs) {
    let html;
    try {
      html = await getText(`${BASE}/shop/${slug}`);
    } catch (e) {
      console.warn(`   ! ${slug}: ${e.message}`);
      continue;
    }
    const blob = decodeRsc(html);

    // props do AddToCart: slug,name,priceCents,image,stock,listingChannel,externalListingUrl
    const marker = `"slug":"${slug}","name":"`;
    const mi = blob.indexOf(marker);
    let core = null;
    if (mi >= 0) {
      const objStart = blob.lastIndexOf("{", mi);
      core = objStart >= 0 ? (() => { try { return JSON.parse(balancedJson(blob, objStart)); } catch { return null; } })() : null;
    }
    const images = findJsonAfter(blob, '"images":') || [];

    // specs visíveis
    const specs = Object.fromEntries(
      [...html.matchAll(/<dt[^>]*>([^<]+)<\/dt><dd[^>]*>([^<]+)<\/dd>/g)].map((m) => [stripTags(m[1]), stripTags(m[2])]),
    );
    const name = core?.name || firstMatch(html, /<h1[^>]*>(.*?)<\/h1>/s) || slug;
    const description = firstMatch(html, /About this piece<\/h2><p[^>]*>(.*?)<\/p>/s) || "";
    const provenance = firstMatch(html, /Where it came from<\/h2><p[^>]*>(.*?)<\/p>/s) || "";
    const shortDescription =
      firstMatch(html, /"description":"((?:[^"\\]|\\.)*)"/) || description.slice(0, 180) || name;
    const hasCertificate = html.includes("certificate of authenticity and geological data card included");
    const videoMatch = html.match(/src="(https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|player\.vimeo\.com)[^"]+)"/);
    const period = specs["Period"] || null;
    // Dimensions are free text on the live page ("Specimen: 8.7 x 9.0 cm");
    // older pages still label the row "Length". Keep exactly what is shown.
    const lengthMm = specs["Dimensions"] || specs["Length"] || null;
    const collection =
      period === "Devonian" ? "devonian-crown" : period === "Ordovician" ? "ordovician-mariners" : "cambrian-dawn";
    const archived = archivedSlugs.has(slug);

    // galeria com uploads localizados
    const localImages = [];
    for (const img of images) {
      localImages.push({ ...img, src: await localiseImage(img.src) });
    }
    if (localImages.length === 0) localImages.push({ src: "/images/hero.jpg", alt: name, label: "Specimen" });

    const row = {
      slug,
      name,
      species: specs["Species"] || name,
      category: "specimen",
      collection,
      period,
      locality: specs["Locality"] || "Morocco",
      formation: specs["Formation"] || null,
      lengthMm,
      preparation: specs["Preparation"] || "Hand prepared",
      priceCents: core?.priceCents ?? 0,
      stock: archived ? 0 : core?.stock ?? 0,
      listingChannel: archived ? null : core?.listingChannel ?? null,
      externalListingUrl: core?.externalListingUrl || null,
      videoUrl: videoMatch ? videoMatch[1] : null,
      hasCertificate,
      archived,
      shortDescription,
      description: description || shortDescription,
      provenance: provenance || "Sourced in Morocco through our licensed quarry network.",
      images: JSON.stringify(localImages),
    };

    const existing = await db.query(`SELECT id FROM products WHERE slug=$1`, [slug]);
    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE products SET name=$2, species=$3, collection=$4, period=$5, locality=$6, formation=$7,
           length_mm=$8, preparation=$9, price_cents=$10, stock=$11, listing_channel=$12,
           external_listing_url=$13, video_url=$14, has_certificate=$15, archived=$16,
           short_description=$17, description=$18, provenance=$19, images=$20::jsonb, published=true
         WHERE slug=$1`,
        [slug, row.name, row.species, row.collection, row.period, row.locality, row.formation,
          row.lengthMm, row.preparation, row.priceCents, row.stock, row.listingChannel,
          row.externalListingUrl, row.videoUrl, row.hasCertificate, row.archived,
          row.shortDescription, row.description, row.provenance, row.images],
      );
      updated += 1;
    } else {
      await db.query(
        `INSERT INTO products (slug, name, species, category, collection, period, locality, formation,
           length_mm, preparation, price_cents, stock, listing_channel, external_listing_url, video_url,
           has_certificate, archived, short_description, description, provenance, images, published, featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,true,false)`,
        [slug, row.name, row.species, row.category, row.collection, row.period, row.locality, row.formation,
          row.lengthMm, row.preparation, row.priceCents, row.stock, row.listingChannel, row.externalListingUrl,
          row.videoUrl, row.hasCertificate, row.archived, row.shortDescription, row.description,
          row.provenance, row.images],
      );
      inserted += 1;
    }
    console.log(
      `   ✓ ${slug} (${row.listingChannel ?? (archived ? "archive" : "unavailable")}${row.priceCents ? ", €" + Math.round(row.priceCents / 100) : ""})`,
    );
  }

  // 3. textos do hero e da proveniência, a partir da home pública
  try {
    const home = await getText(`${BASE}/`);
    // The eyebrow line is retired from the public home: only the title is mirrored.
    const heroBlock = home.match(/<h1[^>]*>(.*?)<em[^>]*>(.*?)<\/em>/s);
    const heroDescription = firstMatch(home, /<\/h1><p[^>]*>(.*?)<\/p>/s);
    const heroImage = home.match(/src="(\/(?:images|api\/uploads)[^"]+)"[^>]*alt="A hand-prepared/);
    if (heroBlock) {
      await db.query(
        `UPDATE site_settings SET hero_title=$1, hero_title_italic=$2,
           hero_description=COALESCE($3, hero_description),
           hero_image=COALESCE($4, hero_image), updated_at=now() WHERE id=1`,
        [
          stripTags(heroBlock[1]),
          stripTags(heroBlock[2]),
          heroDescription,
          heroImage ? await localiseImage(heroImage[1]) : null,
        ],
      );
      console.log(`→ textos do hero sincronizados ("${stripTags(heroBlock[1])} ${stripTags(heroBlock[2])}")`);
    }

    // Public social links are also the source used by the storefront cards.
    // Mirroring them keeps WhatsApp visible in the sandbox. COALESCE means a
    // temporarily missing link never clears a value already stored locally.
    const ebayUrl = home.match(/href="(https:\/\/(?:www\.)?ebay\.[^"/]+\/str\/[^"]+)"/i)?.[1] ?? null;
    const catawikiUrl = home.match(/href="(https:\/\/(?:www\.)?catawiki\.com\/[^"]*\/u\/[^"]+)"/i)?.[1] ?? null;
    const instagramUrl = home.match(/href="(https:\/\/(?:www\.)?instagram\.com\/[^"]+)"/i)?.[1] ?? null;
    const facebookUrl = home.match(/href="(https:\/\/(?:www\.)?facebook\.com\/[^"]+)"/i)?.[1] ?? null;
    const whatsappPhone = home.match(/href="https:\/\/wa\.me\/([0-9]+)"/i)?.[1] ?? null;
    await db.query(
      `UPDATE site_settings SET
         ebay_url=COALESCE($1, ebay_url), catawiki_url=COALESCE($2, catawiki_url),
         instagram_url=COALESCE($3, instagram_url), facebook_url=COALESCE($4, facebook_url),
         whatsapp_phone=COALESCE($5, whatsapp_phone), updated_at=now() WHERE id=1`,
      [ebayUrl, catawikiUrl, instagramUrl, facebookUrl, whatsappPhone],
    );
    console.log(`→ links sociais sincronizados${whatsappPhone ? " (WhatsApp incluído)" : ""}`);

    // Logo do cabeçalho e favicon (fundo azul turquesa caribenho com M caligráfico)
    const logoMatch = home.match(/<header.*?<a[^>]*href=\"\/\"[^>]*>.*?<img[^>]*src=\"([^\"]+)\"/s);
    const faviconMatch = home.match(/<link[^>]*rel=\"(?:shortcut )?icon\"[^>]*href=\"([^\"]+)\"/);
    const liveLogo = logoMatch ? await localiseImage(logoMatch[1]) : null;
    const liveFavicon = faviconMatch ? await localiseImage(faviconMatch[1]) : null;
    if (liveLogo || liveFavicon) {
      await db.query(
        `UPDATE site_settings SET
           content = jsonb_set(
             jsonb_set(
               COALESCE(content, '{}'::jsonb) || jsonb_build_object(
                 'header', COALESCE(content->'header', '{}'::jsonb),
                 'site', COALESCE(content->'site', '{}'::jsonb)
               ),
               '{header,logoImage}',
               to_jsonb(COALESCE($1, content->'header'->>'logoImage', '/images/favicon-m-caribbean.png')::text),
               true
             ),
             '{site,favicon}',
             to_jsonb(COALESCE($2, content->'site'->>'favicon', '/images/favicon-m-caribbean.png')::text),
               true
           ),
           updated_at=now() WHERE id=1`,
        [liveLogo, liveFavicon],
      );
      console.log(`→ logo e favicon sincronizados (turquesa caribenho com M caligráfico)`);
    }
  } catch (e) {
    console.warn(`! home: ${e.message}`);
  }

  await db.query(
    `SELECT setval(pg_get_serial_sequence('products','id'), COALESCE((SELECT MAX(id) FROM products), 1))`,
  );
  await db.end();
  console.log(`\n✓ sincronizado: ${updated} actualizadas, ${inserted} novas. Nada foi apagado.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
