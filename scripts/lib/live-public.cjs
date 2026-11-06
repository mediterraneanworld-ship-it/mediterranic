/** Pure, offline-tested helpers for the production -> LOCAL public mirror. */
const { load } = require("cheerio");

function assertLocalDatabase(value) {
  if (!value) throw new Error("DATABASE_URL is required; refusing to guess a database.");
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("pull-live only writes to a loopback PostgreSQL sandbox. Production databases are forbidden.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("A local PostgreSQL URL is required.");
  return url;
}

function balancedJson(text, start) {
  const open = text[start];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) return null;
  let depth = 0, quoted = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\\") i++;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function decodeFlight(html) {
  const $ = load(html);
  let result = "";
  $("script").each((_, element) => {
    const match = $(element).html()?.match(/self\.__next_f\.push\((\[[\s\S]*?\])\)/);
    if (!match) return;
    try {
      const value = JSON.parse(match[1]);
      if (typeof value[1] === "string") result += value[1];
    } catch { /* An incomplete flight is not an empty catalogue. */ }
  });
  return result;
}

function valuesAfter(blob, key) {
  const values = [];
  const needle = JSON.stringify(key) + ":";
  let at = 0;
  while ((at = blob.indexOf(needle, at)) !== -1) {
    const start = at + needle.length;
    const raw = balancedJson(blob, start);
    at = start + Math.max(1, raw?.length ?? 1);
    if (!raw) continue;
    try { values.push(JSON.parse(raw)); } catch { /* Keep other verified values. */ }
  }
  return values;
}

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
function text($, element) { return clean($(element).text()); }
function assign(target, key, value) {
  if (typeof value === "string") target[key] = clean(value);
}
function heading($, section) {
  const h2 = $(section).find("h2").first();
  const parent = h2.parent();
  return {
    title: text($, h2),
    eyebrow: text($, parent.children("p").first()),
    description: text($, parent.next("p")),
  };
}
function publicImagePath(value) {
  if (typeof value !== "string") return null;
  if (/^\/(?:api\/uploads\/\d+|images\/[a-zA-Z0-9_./-]+)(?:\?[^#]*)?$/.test(value)) return value;
  return null;
}

function productFromHtml(html, slug) {
  const $ = load(html);
  const blob = decodeFlight(html);
  const images = valuesAfter(blob, "images")
    .filter((list) => Array.isArray(list) && list.length && list.every((image) => image && typeof image.src === "string"))
    .sort((a, b) => b.length - a.length)[0];
  let purchase = null;
  const needle = `"slug":${JSON.stringify(slug)},"name":`;
  const marker = blob.indexOf(needle);
  if (marker >= 0) {
    const start = blob.lastIndexOf("{", marker);
    try { purchase = JSON.parse(balancedJson(blob, start)); } catch { /* Preserve local commerce data. */ }
  }
  const specs = {};
  $("dt").each((_, dt) => {
    const dd = $(dt).next("dd");
    if (dd.length) specs[text($, dt)] = text($, dd);
  });
  const sectionByHeading = (label) => $("h2").filter((_, el) => text($, el) === label).first().next("p");
  const reviews = [];
  $("figure").each((_, figure) => {
    const item = $(figure);
    const link = item.find('figcaption a[href^="/shop/"]').first();
    if (!link.length) return;
    const quote = item.find("blockquote p").first();
    const body = item.find("blockquote p").eq(1);
    const author = item.find("figcaption p").first();
    const meta = item.find("figcaption p").eq(1).clone();
    meta.find("a").remove();
    const rating = Number(item.find('[aria-label*="out of 5"]').first().attr("aria-label")?.match(/[1-5](?:\.\d+)?/)?.[0]);
    const title = text($, quote).replace(/^[“"]\s*/, "").replace(/\s*[.”"]+$/, "");
    if (title && text($, body) && text($, author)) reviews.push({
      title, body: text($, body), authorName: text($, author),
      authorCountry: clean(text($, meta).replace(/[·\s]+$/, "")),
      rating: Number.isFinite(rating) ? Math.round(rating) : null,
      productSlug: link.attr("href").split("/").pop(), productName: text($, link),
    });
  });
  return {
    slug, purchase, images: images ?? null, specs, reviews,
    name: text($, $("h1").first()) || null,
    description: text($, sectionByHeading("About this piece")) || null,
    provenance: text($, sectionByHeading("Where it came from")) || null,
    reference: clean($('[data-testid="specimen-ref"]').first().text()) || null,
  };
}

function homeFromHtml(html) {
  const $ = load(html);
  const result = { home: {}, header: {}, footer: {}, settings: {}, covers: {}, reviews: [] };
  const heroImage = $('main img[alt^="A hand-prepared"]').first();
  const hero = heroImage.closest("section");
  const h1 = hero.find("h1").first();
  const italic = h1.find("em").first();
  const lead = h1.clone(); lead.find("em").remove();
  assign(result.home, "heroTitle", text($, lead));
  assign(result.home, "heroTitleItalic", text($, italic));
  assign(result.home, "heroDescription", text($, h1.nextAll("p").first()));
  assign(result.home, "heroCaption", text($, hero.find("p").first()));
  assign(result.home, "heroPrimary", text($, hero.find('a[href="/shop"]').first()));
  assign(result.home, "heroSecondary", text($, hero.find('a[href="#provenance"]').first()));
  result.covers.hero = publicImagePath(heroImage.attr("src"));
  const statLabels = hero.closest("main").find("dt").slice(0, 4).map((_, el) => text($, el)).get();
  if (statLabels.length === 4) result.home.statLabels = statLabels;
  const statValues = hero.closest("main").find("dd").slice(0, 4).map((_, el) => text($, el)).get();
  if (statValues.length >= 2) {
    if (/^\d+$/.test(statValues[0])) result.settings.yearsExperience = Number(statValues[0]);
    assign(result.settings, "feedbacksLabel", statValues[1]);
  }

  const logo = $("header a[href='/']").first();
  result.covers.logo = publicImagePath(logo.find("img").first().attr("src"));
  const logoText = logo.find("span.whitespace-nowrap");
  assign(result.header, "wordmark", text($, logoText.first()));
  assign(result.header, "tagline", text($, logoText.eq(1)));
  result.header.trustBar = $("header .bg-ink span").filter((_, el) => text($, el) !== "·").map((_, el) => text($, el)).get();
  result.header.nav = {};
  const navKeys = { "/shop": "navShopAll", "/shop?channel=direct": "navSiteOnly", "/shop?channel=ebay": "navEbay", "/shop?channel=catawiki": "navCatawiki", "/shop?collection=the-connoisseur": "navConnoisseur" };
  $("header nav a").each((_, a) => { const key = navKeys[$(a).attr("href")]; if (key) assign(result.header.nav, key, text($, a)); });
  const favicon = $("link[rel~='icon']").first().attr("href");
  result.covers.favicon = publicImagePath(favicon);

  const trust = [];
  $("main section li").each((_, li) => {
    const ps = $(li).find("p");
    if (ps.length === 2 && $(li).find("svg").length && !$(li).closest("#provenance").length) trust.push({ title: text($, ps.first()), text: text($, ps.eq(1)) });
  });
  if (trust.length === 4) result.home.trust = trust;
  result.home.channels = {};
  for (const channel of ["direct", "ebay", "catawiki"]) {
    const card = $(`main a[href="/shop?channel=${channel}"]`).first();
    if (!card.length) continue;
    const info = heading($, card.closest("section"));
    for (const key of ["eyebrow", "title", "description"]) if (info[key]) assign(result.home.channels, key, info[key]);
    assign(result.home.channels, channel + "Badge", text($, card.find("span").first()));
    assign(result.home.channels, channel + "Title", text($, card.find("h3").first()));
    assign(result.home.channels, channel + "Text", text($, card.find("p").first()));
    assign(result.home.channels, channel + "Cta", text($, card.children("span").last()));
  }

  const firstCollection = $('main a[href*="collection="]').filter((_, a) => $(a).find("h3").length && $(a).find("img").length).first();
  const collectionSection = firstCollection.closest("section");
  if (collectionSection.length) {
    result.home.collections = heading($, collectionSection);
    const subtitle = collectionSection.find("h2").first().parent().children("p").last();
    assign(result.home.collections, "subtitle", text($, subtitle));
    result.home.collectionCards = [];
    collectionSection.find("a").filter((_, a) => $(a).find("h3").length && $(a).find("img").length).each((index, a) => {
      const card = $(a), h3 = card.find("h3").first(), image = card.find("img").first();
      const label = h3.prev("p");
      result.home.collectionCards.push({
        index, href: card.attr("href"), title: text($, h3),
        label: text($, label), description: text($, h3.next("p")),
        src: publicImagePath(image.attr("src")),
      });
    });
  }
  const featured = $("main section").filter((_, section) => $(section).find('a[href="/shop"]').length && $(section).find('a[href^="/shop/"]').length && $(section).find("h2").length).first();
  if (featured.length) {
    result.home.featured = heading($, featured);
    assign(result.home.featured, "cta", text($, featured.find('a[href="/shop"]').first()));
  }
  const provenance = $("#provenance");
  if (provenance.length) {
    const ph = provenance.find("h2").first(), em = ph.find("em").first(), lead = ph.clone(); lead.find("em").remove();
    result.home.provenance = { steps: [] };
    assign(result.home.provenance, "title", text($, lead));
    assign(result.home.provenance, "titleItalic", text($, em));
    assign(result.home.provenance, "eyebrow", text($, ph.prev("p")));
    assign(result.home.provenance, "body", text($, ph.nextAll("p").first()));
    const photo = provenance.find('img[alt="A whole seafloor sealed in stone"]').first();
    result.covers.provenance = publicImagePath(photo.attr("src"));
    assign(result.home.provenance, "imageBadge", text($, photo.parent().find("span").first()));
    const quote = photo.parent().parent().children("div").last();
    assign(result.home.provenance, "badge", text($, quote.find("p").first()));
    assign(result.home.provenance, "quote", text($, quote.find("p").eq(1)).replace(/^[“"]|[”"]$/g, ""));
    provenance.find("ol li").each((_, li) => result.home.provenance.steps.push({ title: text($, $(li).find("h3").first()), text: text($, $(li).find("p").first()) }));
  }
  const reviewSection = $("main section").filter((_, section) => $(section).find("figure figcaption a").length).first();
  if (reviewSection.length) result.home.testimonials = heading($, reviewSection);
  result.reviews = productFromHtml(html, "").reviews;

  const links = $("#links");
  if (links.length) {
    result.home.links = { ...heading($, links), cards: {} };
    assign(result.home.links, "footnote", text($, links.children().first().children("p").last()));
    links.find("a[href]").each((_, a) => {
      const card = $(a), href = card.attr("href") || "";
      let key;
      try {
        const host = new URL(href).hostname;
        if (/(^|\.)ebay\.[a-z.]+$/.test(host)) key = "ebay";
        else if (/(^|\.)catawiki\.com$/.test(host)) key = "catawiki";
        else if (/(^|\.)trustami\.com$/.test(host)) key = "trustami";
        else if (/(^|\.)instagram\.com$/.test(host)) key = "instagram";
        else if (/(^|\.)facebook\.com$/.test(host)) key = "facebook";
        else if (host === "wa.me") key = "whatsapp";
      } catch { return; }
      const ps = card.find("p");
      result.home.links.cards[key] = {
        eyebrow: text($, ps.first()),
        title: key === "catawiki" ? card.find("img").first().attr("alt") || "Catawiki" : text($, ps.eq(1)),
        text: text($, ps.last()),
      };
      if (key === "whatsapp") result.settings.whatsappPhone = new URL(href).pathname.replace(/\D/g, "");
      else result.settings[key + "Url"] = href;
    });
  }
  const closingTitle = $("main h2").filter((_, el) => $(el).find("em.text-terracotta").length).first();
  if (closingTitle.length) {
    const closing = closingTitle.closest("section"), em = closingTitle.find("em").first(), lead = closingTitle.clone(); lead.find("em").remove();
    result.home.closing = {};
    assign(result.home.closing, "titleLead", text($, lead));
    assign(result.home.closing, "titleItalic", text($, em));
    const description = closingTitle.nextAll("p").first().clone(); description.find("a").remove();
    assign(result.home.closing, "text", text($, description).replace(/[.\s]+$/, ""));
    assign(result.home.closing, "ctaShop", text($, closing.find('a[href="/shop"]').first()));
    assign(result.home.closing, "ctaArchive", text($, closing.find('a[href="/archive"]').first()));
    assign(result.home.closing, "archiveEyebrow", text($, closing.find("h3").first().prev("p")));
    assign(result.home.closing, "archiveTitle", text($, closing.find("h3").first()));
  }
  const footer = $("footer");
  const firstColumn = footer.children("div").first().children("div").first();
  assign(result.footer, "tagline", text($, firstColumn.children("p").eq(1)));
  const newsletter = firstColumn.find("form").first().parent();
  assign(result.footer, "newsletterTitle", text($, newsletter.children("h3").first()));
  assign(result.footer, "newsletterCopy", text($, newsletter.children("p").first()));
  footer.children("div").first().children("div").each((index, column) => {
    const title = text($, $(column).find("h3").first());
    if (index === 1) assign(result.footer, "collectionsTitle", title);
    if (index === 2) {
      assign(result.footer, "clientCareTitle", title);
      result.footer.clientCare = $(column).find("ul li").slice(0, -1).map((_, li) => text($, li)).get();
      assign(result.footer, "archiveLabel", text($, $(column).find("ul li").last()));
    }
    if (index === 3) {
      assign(result.footer, "correspondenceTitle", title);
      result.footer.correspondence = $(column).children("ul").first().children("li").slice(1).map((_, li) => text($, li)).get();
      assign(result.footer, "marketplacesTitle", text($, $(column).find("h3").eq(1)));
      const email = $(column).find('a[href^="mailto:"]').first().attr("href");
      if (email) assign(result.settings, "contactEmail", email.slice(7));
    }
  });
  const bottom = footer.children("div").last();
  const bottomPs = bottom.find("p");
  assign(result.footer, "bottomLine", text($, bottomPs.first()).replace(/^© \d{4} Mediterranic\.\s*/, ""));
  assign(result.footer, "legalNote", text($, bottomPs.last()));
  const nav = bottom.find("nav a");
  for (const [index, key] of ["navShop", "navFeatured", "navArchive", "navShipping", "navContact"].entries()) assign(result.footer, key, text($, nav.eq(index)));
  return result;
}

function shippingFromHtml(html) {
  const $ = load(html);
  const result = { sections: {} };
  assign(result, "eyebrow", text($, $("main header p").first()));
  assign(result, "intro", text($, $("main header h1").next("p")));
  for (const id of ["dispatch", "packing", "rates", "customs", "returns", "damaged", "archive"]) {
    const section = $("#" + id);
    if (!section.length) continue;
    result.sections[id] = { title: text($, section.find("h2").first()), items: section.find("ul").first().children("li").map((_, li) => text($, li)).get() };
  }
  if ($("main strong").filter((_, el) => text($, el) === "Free shipping on every order").length) result.freeShipping = true;
  else if ($("#rates").text().includes("The rate depends on the total weight")) result.freeShipping = false;
  return result;
}

/** Only maps strings; never changes names, prices, REFs, dimensions or moderation. */
function replaceImageReferences(value, mapping) {
  if (typeof value === "string") return mapping.get(value.split("?")[0]) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceImageReferences(item, mapping));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceImageReferences(item, mapping)]));
  return value;
}

module.exports = { assertLocalDatabase, balancedJson, decodeFlight, valuesAfter, productFromHtml, homeFromHtml, shippingFromHtml, publicImagePath, replaceImageReferences };
