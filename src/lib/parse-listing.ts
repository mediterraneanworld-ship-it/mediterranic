export type ParsedImage = { src: string; alt: string; label: string };

export type ParsedListing = {
  name: string;
  species: string;
  period: string;
  lengthMm: string;
  locality: string;
  formation: string;
  preparation: string;
  priceDollars: string;
  compareAtDollars: string;
  hasCertificate: boolean;
  videoUrl: string;
  collection: string;
  collections: string[];
  shortDescription: string;
  description: string;
  provenance: string;
  images: ParsedImage[];
  found: string[];
  missing: string[];
};

const PERIODS = ["Devonian", "Ordovician", "Cambrian", "Silurian", "Permian", "Carboniferous"];
const KNOWN_LOCALITIES = [
  "Jbel Mrakib", "Mrakib", "Souss", "Igoudine", "Ait Ou Amar", "Taroudant",
  "Asrir", "Bou Izargane", "Foum Zguid", "Zguilma", "Atchana", "Oufaten",
  "Jbel Issoumour",
  "Jebel Ofaten",
  "Hamar Laghdad",
  "El Kaid Errami",
  "Fezouata",
  "Tafraoute",
  "Tafraout",
  "Alnif",
  "Erfoud",
  "Zagora",
  "Mecissi",
  "Issafen",
  "Maider",
  "Oufaten",
  "Boutschrafin",
  "Laatchana",
  "Tafilalt",
  "Anti-Atlas",
];
const KNOWN_GENERA = [
  "Bigotina", "Bigotinops", "Daguinaspis", "Perrector", "Agerina", "Brevipelta",
  "Fallotaspis", "Eofallotaspis", "Hupetina", "Choubertella", "Saukianda",
  "Psedosaukianda", "Hamatolenus", "Kingaspis", "Termierella", "Gigantopygus",
  "Asaphellus", "Cyphaspis", "Hollardops", "Morocops", "Barrandeops",
  "Leonaspis", "Ceratarges", "Coltraneia", "Morocconites", "Phacops",
  "Drotops",
  "Walliserops",
  "Asteropyge",
  "Reedops",
  "Neseuretus",
  "Dalmanitina",
  "Erbenochile",
  "Dicranurus",
  "Comura",
  "Ceratonurus",
  "Psychopyge",
  "Hollardops",
  "Gerastos",
  "Cyclopyge",
  "Acadoparadoxides",
  "Crotalocephalus",
  "Phacops",
  "Odontochile",
  "Kolihapeltis",
  "Quadrops",
  "Koneprusia",
  "Metacanthina",
  "Paralejurus",
  "Zlichovaspis",
  "Lichas",
  "Selenopeltis",
  "Placoparia",
  "Eodalmanitina",
  "Hypsipariops",
  "Megistaspis",
  "Asaphus",
  "Illaeus",
  "Cryptolithus",
  "Trimerus",
  "Calymene",
  "Flexicalymene",
  "Elrathia",
  "Olenoides",
];

// Authoritative period per genus: Catawiki pages often mention several periods,
// so the genus (from the lot title) wins over prose on the page.
const GENUS_PERIOD: Record<string, "Cambrian" | "Ordovician" | "Devonian"> = {
  // Cambrian
  Paradoxides: "Cambrian", Bigotina: "Cambrian", Bigotinops: "Cambrian", Perrector: "Cambrian",
  Daguinaspis: "Cambrian", Brevipelta: "Cambrian", Fallotaspis: "Cambrian", Eofallotaspis: "Cambrian",
  Hupetina: "Cambrian", Choubertella: "Cambrian", Hamatolenus: "Cambrian", Kingaspis: "Cambrian",
  Termierella: "Cambrian", Gigantopygus: "Cambrian", Saukianda: "Cambrian", Psedosaukianda: "Cambrian",
  // Ordovician
  Neseuretus: "Ordovician", Dalmanitina: "Ordovician", Asaphellus: "Ordovician", Agerina: "Ordovician",
  Cyclopyge: "Ordovician", Placoparia: "Ordovician", Selenopeltis: "Ordovician", Eodalmanitina: "Ordovician",
  // Devonian
  Drotops: "Devonian", Walliserops: "Devonian", Asteropyge: "Devonian", Reedops: "Devonian",
  Erbenochile: "Devonian", Dicranurus: "Devonian", Comura: "Devonian", Ceratonurus: "Devonian",
  Psychopyge: "Devonian", Hollardops: "Devonian", Gerastos: "Devonian", Crotalocephalus: "Devonian",
  Phacops: "Devonian", Odontochile: "Devonian", Kolihapeltis: "Devonian", Quadrops: "Devonian",
  Koneprusia: "Devonian", Metacanthina: "Devonian", Paralejurus: "Devonian", Zlichovaspis: "Devonian",
  Cyphaspis: "Devonian", Morocops: "Devonian", Barrandeops: "Devonian", Leonaspis: "Devonian",
  Ceratarges: "Devonian", Coltraneia: "Devonian", Morocconites: "Devonian",
};

const ALIASES: Record<string, string> = {
  morocco: "Morocco",
  maroc: "Morocco",
  marocco: "Morocco",
  tafraoute: "Tafraoute",
  issoumour: "Jbel Issoumour",
};

const SPECIES_STOPWORDS = new Set([
  "from", "with", "and", "the", "this", "that", "period", "specimen", "specimens",
  "trilobite", "trilobites", "fossil", "fossils", "matrix", "original", "natural",
  "width", "length", "size", "price", "reserve", "auction", "condition", "certificate",
]);

function trimSpecies(value: string): string {
  const words = value.trim().split(/\s+/);
  if (words.length === 0) return "";
  const genus = words[0];
  const second = words[1] ?? "";
  if (!second || SPECIES_STOPWORDS.has(second.toLowerCase()) || second.length < 3) return genus;
  return `${genus} ${second.toLowerCase()}`;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1]
        .replace(/[\n\r]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/[.,;:]+$/, "")
        .trim();
      if (cleaned.length > 1 && cleaned.length < 160) return cleaned;
    }
  }
  return "";
}

export function parseListingText(raw: string, sourceUrl = "", fallbackPrice = "", titleHint = ""): ParsedListing {
  const text = raw.replace(/\r/g, "").replace(/[ \t]{2,}/g, " ");
  const lower = text.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];

  // --- Species -------------------------------------------------------------
  // The lot title is the most reliable source: e.g. "Orange ultra rare Bigotina n. sp..."
  let titleSpecies = "";
  if (titleHint) {
    const genusInTitle = KNOWN_GENERA.find((g) => new RegExp(`\\b${g}\\b`, "i").test(titleHint));
    if (genusInTitle) {
      const pair = titleHint.match(new RegExp(`\\b(${genusInTitle})\\s+([A-Za-z]{3,})`, "i"));
      titleSpecies = pair ? `${pair[1]} ${pair[2]}` : genusInTitle;
    } else {
      const binomial = titleHint.match(/\b([A-Z][a-z]{3,})\s+([a-z]{3,})\b/);
      if (binomial && !SPECIES_STOPWORDS.has(binomial[2].toLowerCase())) {
        titleSpecies = `${binomial[1]} ${binomial[2]}`;
      }
    }
  }

  let species = titleSpecies || firstMatch(text, [
    /scientific name\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[a-z.]{2,})?)/i,
    /\bspecies\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[a-z.]{2,})?)/i,
    /(?:name|taxonomy)\s*[:\-]?\s*([A-Z][a-z]{3,}(?:\s+[a-z]{3,})?)/,
  ]);

  if (!species) {
    const genus = KNOWN_GENERA.find((g) => new RegExp(`\\b${g}\\b`, "i").test(text));
    if (genus) {
      const pair = text.match(new RegExp(`\\b(${genus})\\s+([a-z]{3,})\\b`));
      species = pair ? `${pair[1]} ${pair[2]}` : genus;
    }
  }
  if (!species) {
    const binomial = text.match(/\b([A-Z][a-z]{3,})\s+([a-z]{4,})\b/);
    if (binomial) species = `${binomial[1]} ${binomial[2]}`;
  }
  if (species) {
    species = trimSpecies(titleCase(species))
      .replace(/\bSp\b/i, "sp.")
      .replace(/\bN Sp\b/i, "n. sp.");
  }
  if (species) found.push("species");
  else missing.push("species");

  // --- Period --------------------------------------------------------------
  const titleGenusMatch = species.match(/^([A-Z][a-z]{2,})/);
  const genusPeriod = titleGenusMatch ? GENUS_PERIOD[titleGenusMatch[1]] : undefined;
  const periodRaw =
    PERIODS.find((p) => new RegExp(`\\b${p}\\b`, "i").test(titleHint)) ??
    genusPeriod ??
    PERIODS.find((p) => new RegExp(`\\b${p}\\b`, "i").test(text)) ??
    "";
  const period = periodRaw ? periodRaw : "";
  if (period) found.push("period");
  else missing.push("period");

  // --- Dimensions ----------------------------------------------------------
  let lengthMm = "";
  const pairDims = text.match(/specimen(?:\s*size)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(cm|mm)/i);
  if (pairDims) {
    const unit = pairDims[3].toLowerCase();
    const a = Number(pairDims[1].replace(",", "."));
    const b = Number(pairDims[2].replace(",", "."));
    const mm = Math.max(a, b) * (unit === "cm" ? 10 : 1);
    if (mm > 0 && mm < 3000) lengthMm = String(Math.round(mm));
  }
  const specimenLength = lengthMm
    ? null
    : text.match(/(?:specimen length|length|size|width)[^0-9]{0,18}(\d+(?:[.,]\d+)?)\s*(mm|cm)/i);
  const cmMatch = text.match(/(\d+(?:[.,]\d+)?)\s*cm\b/i);
  const mmMatch = text.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i);
  // "14 complete trilobites" or "42 x 23.5 cm" describe the slab, not the animal.
  const rawLength = specimenLength ?? mmMatch ?? cmMatch;
  if (rawLength) {
    const value = Number(rawLength[1].replace(",", "."));
    const unit = (rawLength[2] ?? (rawLength === cmMatch ? "cm" : "mm")).toLowerCase();
    const mm = unit === "cm" ? value * 10 : value;
    if (mm > 0 && mm < 3000) lengthMm = String(Math.round(mm));
  }
  if (lengthMm) found.push("dimensions");
  else missing.push("dimensions");

  // --- Locality ------------------------------------------------------------
  let locality = firstMatch(text, [
    /(?:finding locality|locality|location|provenance|found(?:\s+in)?|origin|country of origin|deposit|finding location)\s*[:\-]\s*([^\n.;]{3,90})/i,
    /((?:[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){0,3})\s+quarry[^\n.;]{0,40})/,
  ]);
  if (locality) {
    locality = locality
      .replace(/\)\s*\d*\s*$/g, "")
      .replace(/\b(form|formation|age)\b.*$/i, "")
      .replace(/^(?:al|the)\s+/i, "")
      .trim();
    const looksLikeSlug = /-[a-z]{3,}-/.test(locality);
    const isNoise = /authenticity|condition|natural|price|original|cleaned|restor|fossilised|lagerstatte-fossilised/i.test(
      locality,
    );
    if (looksLikeSlug || isNoise || !/^[A-Za-zÀ-ÿ' .\-]+$/.test(locality)) locality = "";
  }
  if (!locality) {
    const known = KNOWN_LOCALITIES.find((l) => lower.includes(l.toLowerCase()));
    if (known) locality = /\bmorocco\b/i.test(text) && !/morocco/i.test(known) ? `${known}, Morocco` : known;
  }
  if (!locality && /\bmorocco\b/i.test(text)) locality = "Morocco";
  const aliasKey = locality.toLowerCase().split(",")[0].trim();
  if (ALIASES[aliasKey]) locality = ALIASES[aliasKey] + (locality.includes(",") ? ", Morocco" : "");
  if (locality) found.push("locality");
  else missing.push("locality");

  // --- Formation -----------------------------------------------------------
  // Only trust an explicitly labelled formation — unlabelled matches on the page
  // often belong to neighbouring lots and would be wrong data.
  let formation = firstMatch(text, [
    /formation\s*[:\-|]\s*([A-Z][A-Za-z'\-]+(?:\s+[A-Za-z'\-]+){0,3}\s+Formation)\b/,
    /formation\s*[:\-|]\s*([^\n.|]{3,60})/i,
  ]);
  if (formation) {
    if (!/[A-Za-z]{3}/.test(formation) || /^[*\s.|-]+$/.test(formation)) formation = "";
    if (/cambrian|ordovician|silurian|permian|carboniferous/i.test(formation) && period === "Devonian") {
      formation = "";
    }
  }

  // --- Preparation / restoration ------------------------------------------
  let preparation = "";
  const treatment = firstMatch(text, [/treatment\s*[:|]\s*([A-Za-z ,\-/]{3,40})/i]);
  const condition = firstMatch(text, [/condition\s*[:|]\s*([A-Za-z ,\-/]{3,40})/i]);
  if (condition || treatment) {
    const parts = [condition && `${condition} condition`, treatment && treatment.toLowerCase()]
      .filter(Boolean)
      .join(" · ");
    preparation = parts;
  } else if (/no restoration|unrestored|100%\s*natural|natural\b/i.test(text)) {
    preparation = "No restoration · 100% natural";
  } else if (/restoration|restored|reconstructed|composite/i.test(text)) {
    preparation = "Restored / consolidated (see condition notes)";
  } else if (/prepar/i.test(text)) {
    preparation = "Hand-prepared under magnification";
  }
  if (preparation) found.push("preparation");

  // --- Price ---------------------------------------------------------------
  let priceDollars = fallbackPrice;
  let compareAtDollars = "";
  const estimate = text.match(/estimate\s*€?\s*([\d.,]+)(?:\s*-\s*€?\s*([\d.,]+))?/i);
  const currentBidExplicit = text.match(/(?:current bid|buy now|price)\s*[:\-]?\s*€?\s*([\d.,]{2,9})/i);
  const eurPrice = text.match(/€\s?([\d]{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d{2})?/);
  const usdPrice = text.match(/\$\s?([\d]{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d{2})?/);
  const currentBid = text.match(/(?:current bid|estimate|bid)\s*[:\-]?\s*€?\s?([\d.]{2,7})/i);
  const parseMoney = (value: string) => Number(value.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  // Prices are stored and displayed in EUR.
  // Catawiki lots commonly start at €1, so small amounts are legitimate.
  const plausible = (value: string) => {
    const n = parseMoney(value);
    return Number.isFinite(n) && n >= 1 && n <= 500_000;
  };
  priceDollars = "";
  if (eurPrice && plausible(eurPrice[1])) priceDollars = String(Math.round(parseMoney(eurPrice[1])));
  else if (currentBidExplicit && plausible(currentBidExplicit[1]))
    priceDollars = String(Math.round(parseMoney(currentBidExplicit[1])));
  else if (currentBid) priceDollars = String(Math.round(parseMoney(currentBid[1])));
  else if (usdPrice) priceDollars = String(Math.round(parseMoney(usdPrice[1]) * 0.92));
  // The expert estimate is NOT a compare-at price: showing it as a discount would
  // misrepresent the auction. It is reported in the description instead.
  const estimateNote = estimate
    ? ` Catawiki expert estimate for this lot: €${estimate[1].replace(/\s/g, "")}${
        estimate[2] ? ` – €${estimate[2].replace(/\s/g, "")}` : ""
      }.`
    : "";
  if (!priceDollars) missing.push("price");
  else found.push("price");

  // --- Images --------------------------------------------------------------
  const images: ParsedImage[] = [];
  const imageRegex = /https?:\/\/[^\s"'<>)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>)]*)?/gi;
  const seen = new Set<string>();
  for (const match of text.matchAll(imageRegex)) {
    const src = match[0].replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, "/s-l1600.$1");
    if (!seen.has(src) && images.length < 8) {
      seen.add(src);
      images.push({
        src,
        alt: "Imported specimen view",
        label: images.length === 0 ? "Whole slab — top view" : `View ${images.length + 1}`,
      });
    }
  }
  if (images.length > 0) found.push("photos");

  // --- Collection follows the geological period ---
  const collection =
    period === "Cambrian"
      ? "cambrian-dawn"
      : period === "Ordovician"
        ? "ordovician-mariners"
        : period === "Devonian"
          ? "devonian-crown"
          : "the-connoisseur";

  // --- Generated sales copy ------------------------------------------------
  const genus = /^[A-Z][a-z]{2,}$/.test(species.split(" ")[0] ?? "") ? species.split(" ")[0] : "Moroccan";
  // Titles are the scientific name — collectors expect binomials, not invented epithets.
  const name = species || "Moroccan trilobite";

  const specs: string[] = [];
  if (species) specs.push(species);
  if (period) specs.push(period);
  if (locality) specs.push(locality);
  if (lengthMm) specs.push(`${lengthMm} mm`);

  const shortDescription = `${genus} trilobite${locality ? ` from ${locality}` : " from Morocco"}${
    period ? `, ${period}` : ""
  }${lengthMm ? `, measuring ${lengthMm} mm` : ""}. ${preparation || "Prepared and documented"} in the studio.${
    sourceUrl.includes("catawiki") ? " Originally listed on Catawiki." : sourceUrl.includes("ebay") ? " Originally listed on eBay." : ""
  }`;

  const description = [
    `A ${species || "Moroccan"} trilobite from ${
      locality || "the Tafilalt and Anti-Atlas region of Morocco"
    }${period ? `, dating to the ${period} period` : ""}.`,
    lengthMm
      ? `The specimen measures ${lengthMm} mm as offered.`
      : "Dimensions are stated on the certificate accompanying the specimen.",
    preparation
      ? `Preparation: ${preparation.toLowerCase()}.`
      : "Prepared by hand in our studio under binocular magnification.",
    formation ? `Geology: ${formation}.` : "",
    "Supplied with a signed certificate of authenticity and a geological data card recording locality, formation and age.",
  ]
    .filter(Boolean)
    .join(" ") + estimateNote;

  const provenance = [
    `Sourced in ${locality || "Morocco"} through our licensed quarry network of nearly 23 years.`,
    formation ? `Stratigraphy: ${formation}.` : "",
    "Delivered fully insured with museum-grade packing to North America, Europe and Japan.",
    "Verified seller on eBay and Catawiki with thousands of positive feedbacks.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name,
    species: species || "",
    period,
    hasCertificate: false,
    lengthMm,
    locality,
    formation,
    preparation,
    priceDollars,
    compareAtDollars: "",
    shortDescription,
    description,
    provenance,
    images,
    videoUrl: "",
    collection,
    collections: [collection],
    found,
    missing,
  };
}

/** Formats a specimen as ready-to-paste Catawiki / eBay listing copy. */
export function buildMarketplaceCopy(input: {
  name: string;
  species: string;
  period: string;
  age: string;
  locality: string;
  formation: string;
  lengthMm: string;
  preparation: string;
  priceDollars: string;
  description: string;
  provenance: string;
}): string {
  return [
    `Title: ${input.name} — ${input.species}${input.lengthMm ? ` — ${input.lengthMm} mm` : ""}`,
    "",
    `Scientific name: ${input.species}`,
    input.period ? `Geological period: ${input.period}` : "",
    input.locality ? `Locality: ${input.locality}` : "",
    input.formation ? `Formation: ${input.formation}` : "",
    input.lengthMm ? `Dimensions: ${input.lengthMm} mm` : "",
    input.preparation ? `Preparation / restoration: ${input.preparation}` : "",
    input.priceDollars ? `Price: €${input.priceDollars} EUR` : "",
    "",
    "Description:",
    input.description,
    "",
    "Provenance & shipping:",
    input.provenance,
    "",
    "Sold with signed certificate of authenticity and geological data card.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
