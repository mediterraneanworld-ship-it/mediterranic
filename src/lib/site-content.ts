/**
 * Every editable text and photograph of the public storefront.
 *
 * The back-office writes this document into `site_settings.content` (jsonb).
 * Pages read it through `getSiteContent()`, which merges whatever is stored
 * over these defaults — so a brand-new database, or a database saved before a
 * field existed, still renders complete pages. Nothing here is ever deleted by
 * a deploy: the stored document wins, field by field.
 */

import { DEFAULT_HOME_ORDER, normalizeHomeOrder, type HomeSectionId } from "@/lib/home-sections";

export type ContentPair = { title: string; text: string };
export type LinkCardContent = { eyebrow: string; title: string; text: string };
export type CollectionCardContent = { title: string; label: string; description: string; href: string };

export type SiteContent = {
  /** Homepage block order. H0/H1 and H13 are the fixed global frame. */
  layout: { home: HomeSectionId[] };
  header: {
    trustBar: string[];
    /** Logo image URL; empty = the text wordmark "Mediterranic". */
    logoImage: string;
    wordmark: string;
    tagline: string;
    navShopAll: string;
    navSiteOnly: string;
    navEbay: string;
    navCatawiki: string;
    navConnoisseur: string;
  };
  footer: {
    tagline: string;
    newsletterTitle: string;
    newsletterCopy: string;
    collectionsTitle: string;
    clientCareTitle: string;
    clientCare: string[];
    archiveLabel: string;
    correspondenceTitle: string;
    correspondence: string[];
    marketplacesTitle: string;
    ebayLabel: string;
    catawikiLabel: string;
    instagramLabel: string;
    facebookLabel: string;
    bottomLine: string;
    legalNote: string;
    navShop: string;
    navFeatured: string;
    navArchive: string;
    navShipping: string;
    navContact: string;
  };
  home: {
    hero: {
      eyebrow: string;
      title: string;
      titleItalic: string;
      description: string;
      image: string;
      caption: string;
      primaryCta: string;
      secondaryCta: string;
      /** Labels above the four hero numbers. Two values are automatic:
       *  specimens = available now (site + eBay + Catawiki), eras = distinct
       *  geological periods currently offered. */
      stats: {
        years: string;
        feedbacks: string;
        specimens: string;
        eras: string;
      };
    };
    trust: { items: ContentPair[] };
    channels: {
      eyebrow: string;
      title: string;
      description: string;
      directBadge: string;
      directTitle: string;
      directText: string;
      directCta: string;
      ebayBadge: string;
      ebayTitle: string;
      ebayText: string;
      ebayCta: string;
      catawikiBadge: string;
      catawikiTitle: string;
      catawikiText: string;
      catawikiCta: string;
    };
    collections: {
      eyebrow: string;
      title: string;
      subtitle: string;
      /** Geological ages shown once, in a line under the four cards. */
      ages: string;
      covers: {
        devonianCrown: string;
        ordovicianMariners: string;
        cambrianDawn: string;
        connoisseur: string;
      };
      cards: {
        devonianCrown: CollectionCardContent;
        ordovicianMariners: CollectionCardContent;
        cambrianDawn: CollectionCardContent;
        connoisseur: CollectionCardContent;
      };
      pieceSingular: string;
      piecePlural: string;
      explore: string;
    };
    featured: { eyebrow: string; title: string; cta: string };
    provenance: {
      eyebrow: string;
      title: string;
      titleItalic: string;
      body: string;
      image: string;
      badge: string;
      quote: string;
      imageBadge: string;
      steps: ContentPair[];
    };
    testimonials: { eyebrow: string; title: string };
    marketplaces: {
      ebayLabel: string;
      catawikiLabel: string;
      instagramLabel: string;
      facebookLabel: string;
    };
    links: {
      eyebrow: string;
      title: string;
      description: string;
      footnote: string;
      cards: {
        ebay: LinkCardContent;
        catawiki: LinkCardContent;
        trustami: LinkCardContent;
        instagram: LinkCardContent;
        facebook: LinkCardContent;
        whatsapp: LinkCardContent;
      };
    };
    closing: {
      titleLead: string;
      titleItalic: string;
      text: string;
      ctaShop: string;
      soussLabel: string;
      soussUrl: string;
      ctaArchive: string;
      archiveEyebrow: string;
      archiveTitle: string;
      archiveCta: string;
      alsoOn: string;
      ebayLabel: string;
      catawikiLabel: string;
    };
  };
  shop: {
    eyebrow: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyText: string;
  };
  archive: {
    eyebrow: string;
    title: string;
    description: string;
    badge: string;
    empty: string;
    cta: string;
  };
  shipping: {
    eyebrow: string;
    title: string;
    intro: string;
    dispatch: { title: string; items: string[] };
    packing: { title: string; items: string[] };
    rates: { title: string; items: string[] };
    customs: { title: string; items: string[] };
    returns: { title: string; items: string[] };
    damaged: { title: string; items: string[] };
    archive: { title: string; items: string[] };
    newsletterTitle: string;
    newsletterCopy: string;
    contactNote: string;
  };
  checkout: { eyebrow: string; title: string };
  product: {
    descriptionTitle: string;
    provenanceTitle: string;
    detailsTitle: string;
    shippingTitle: string;
    reviewsTitle: string;
    certificateLabel: string;
    unavailableNote: string;
  };
  notFound: { title: string; text: string; homeCta: string; shopCta: string };
  analytics: {
    enabled: boolean;
    /** Raw <script> HTML pasted in the back-office (e.g. Statcounter), injected at the end of <body>. */
    bodyScripts: string;
  };
  commerce: {
    /** When on, every order ships free and no other delivery option is offered. */
    freeShipping: boolean;
    /** Discover/reconcile active listings before the daily price refresh. */
    autoSyncInventory: boolean;
  };
  site: {
    /** Favicon URL shown in the browser tab. Uploadable in the back-office. */
    favicon: string;
  };
};

export const DEFAULT_CONTENT: SiteContent = {
  layout: { home: DEFAULT_HOME_ORDER },
  header: {
    trustBar: ["23 Years in the Field", "eBay & Catawiki Verified", "Safe Worldwide Shipping"],
    logoImage: "/images/logo-m-emblem.png",
    wordmark: "Mediterranic",
    tagline: "Moroccan Trilobites",
    navShopAll: "Shop all",
    navSiteOnly: "Only on Site",
    navEbay: "Live on eBay",
    navCatawiki: "Live on Catawiki",
    navConnoisseur: "Connoisseur",
  },
  footer: {
    tagline:
      "Museum-grade Moroccan trilobites, documented from quarry to study. Sourced under licence, prepared by specialists, delivered with care.",
    newsletterTitle: "Field notes",
    newsletterCopy:
      "New specimens, preparation stories and auction dates. Twice a month, never more.",
    collectionsTitle: "Collections",
    clientCareTitle: "Client care",
    archiveLabel: "The archive",
    correspondenceTitle: "Correspondence",
    ebayLabel: "eBay store",
    catawikiLabel: "Catawiki seller page",
    instagramLabel: "Instagram",
    facebookLabel: "Facebook",
    navShop: "Shop",
    navFeatured: "Featured & New",
    navArchive: "Archive",
    navShipping: "Shipping & returns",
    navContact: "Contact",
    clientCare: [
      "Worldwide delivery",
      "30-day considered returns",
      "Certificate of authenticity",
      "Private viewings by appointment",
    ],
    correspondence: [
      "23 years · eBay & Catawiki verified",
      "All prices in euro (EUR)",
      "Ships safely to North America, Europe & Japan",
    ],
    marketplacesTitle: "Our marketplaces",
    bottomLine: "Every specimen ships with full documentation.",
    legalNote:
      "Fossils are natural objects sourced under Moroccan regulations for private collecting.",
  },
  home: {
    hero: {
      eyebrow: "Moroccan Trilobites · 23 Years of Curatorship",
      title: "Five hundred million years,",
      titleItalic: "in your keeping.",
      description:
        "Museum-grade Moroccan trilobites from the Cambrian, Ordovician and Devonian of the Anti-Atlas. Direct from nearly 23 years of specialist work, verified on eBay and Catawiki, with safe worldwide shipping.",
      image: "/images/hero-morocco.jpg",
      caption: "Hand-prepared · Anti-Atlas, Morocco",
      primaryCta: "Explore the collection",
      secondaryCta: "23 years of provenance",
      stats: {
        years: "Years in the field",
        feedbacks: "Verified feedbacks",
        specimens: "Specimens",
        eras: "Eras offered",
      },
    },
    trust: {
      items: [
        {
          title: "23 years · eBay & Catawiki",
          text: "5,000+ verified feedbacks from worldwide collectors",
        },
        {
          title: "23 years of shipping mastery",
          text: "Custom crating & safe delivery to USA, Europe & Japan",
        },
        {
          title: "Certificate of authenticity",
          text: "Every piece ships with signed geological documentation",
        },
        {
          title: "30-day considered returns",
          text: "Examine in your study with complete peace of mind",
        },
      ],
    },
    channels: {
      eyebrow: "Where to acquire our specimens",
      title: "Three live channels — one single standard",
      description:
        "We keep 20 to 40 curated pieces active at a time. Some are exclusively available here; others are currently on live auction on eBay or Catawiki and return here if unsold.",
      directBadge: "Only on This Site",
      directTitle: "Direct Storefront Exclusives",
      directText:
        "Available for immediate acquisition right here on Mediterranic, with no auction wait and no third-party buyer premiums.",
      directCta: "Browse Site Exclusives",
      ebayBadge: "Live on eBay",
      ebayTitle: "Currently Listed on eBay",
      ebayText:
        "Specimens currently active in our verified eBay store. Direct website checkout is paused while live; unsold pieces return exclusively to this site.",
      ebayCta: "View eBay Specimens",
      catawikiBadge: "Live on Catawiki",
      catawikiTitle: "Currently on Catawiki Auction",
      catawikiText:
        "Featured in curated Catawiki Natural History auctions. Follow the live bidding link, or acquire here if the reserve is not met.",
      catawikiCta: "View Catawiki Lots",
    },
    collections: {
      eyebrow: "Curated collections",
      title: "Four ways into deep time",
      subtitle: "Cambrian · Ordovician · Devonian · Museum grade",
      ages: "",
      covers: {
        devonianCrown: "/images/products/drotops-armatus.jpg",
        ordovicianMariners: "/images/products/neseuretus-tristani.jpg",
        cambrianDawn: "/images/imported/perrector-falloti-the-perrector-field-specimen-1.jpg",
        connoisseur: "/covers/connoisseur-cyphaspis.jpg",
      },
      cards: {
        devonianCrown: {
          title: "The Devonian Crown",
          label: "",
          description: "Phacopid and proetid specimens from the Tafilalt and Anti-Atlas. These are the trilobites most collectors picture first: armoured, sculpted and unmistakably ancient.",
          href: "",
        },
        ordovicianMariners: {
          title: "The Ordovician Mariners",
          label: "",
          description: "Older still. Fezouata Shale and Alnif assemblages from the early Palaeozoic seafloor, when the first great marine communities were taking shape.",
          href: "",
        },
        cambrianDawn: {
          title: "Souss Lagerstätte",
          label: "",
          description: "The earliest chapter. Paradoxides and the great Cambrian assemblages of the Anti-Atlas, from the seas that first filled with complex animal life.",
          href: "https://www.mediterranic.com/Souss-Lagerst%C3%A4tte-site",
        },
        connoisseur: {
          title: "The Connoisseur",
          label: "Museum grade",
          description: "Rare, large and exceptionally preserved. Pieces we would be proud to see in a private study, a boardroom or a foundation's collection.",
          href: "",
        },
      },
      pieceSingular: "piece",
      piecePlural: "pieces",
      explore: "Explore",
    },
    featured: {
      eyebrow: "Most collected",
      title: "Pieces our collectors keep returning to",
      cta: "View all specimens",
    },
    provenance: {
      eyebrow: "Nearly 23 Years in the Field",
      title: "Known by collectors.",
      titleItalic: "Proven across thousands of shipments.",
      body: "For nearly 23 years we have worked directly with licensed quarry families across Morocco. Every specimen here is a real, hand-prepared piece currently listed on Catawiki or eBay.",
      image: "/images/seafloor-plate.jpg",
      badge: "Established reputation · 23 years",
      quote:
        "A whole seafloor, sealed in stone. Packed by hands that have shipped thousands of delicate specimens across the Northern Hemisphere.",
      imageBadge: "Whole plate · top view",
      steps: [
        {
          title: "Licensed at source in Morocco",
          text: "Every specimen is acquired directly from trusted quarry families in the Tafilalt and Anti-Atlas, traceable to a named locality and formation.",
        },
        {
          title: "Prepared with collector honesty",
          text: "Cleaned under magnification with full transparency regarding matrix and restoration — the standard that earned us thousands of five-star feedbacks.",
        },
        {
          title: "Battle-tested international shipping",
          text: "Nearly 23 years of custom suspension-packing ensures fragile spines and matrix slabs arrive intact in the US, UK, EU, Switzerland, Canada and Japan.",
        },
      ],
    },
    testimonials: {
      eyebrow: "5,000+ verified feedbacks across eBay, Catawiki & direct clients",
      title: "From collectors who have been where you are",
    },
    marketplaces: {
      ebayLabel: "eBay Verified Store",
      catawikiLabel: "Catawiki Expert Seller",
      instagramLabel: "Instagram",
      facebookLabel: "Facebook",
    },
    links: {
      eyebrow: "Everywhere we are",
      title: "One catalogue, many places to find us",
      description:
        "The same specimens are also listed on eBay and Catawiki. Choose where you prefer to buy — the price and the certificate are identical.",
      footnote:
        "Scientific references for our Cambrian and Ordovician material are published on our Catawiki seller page.",
      cards: {
        ebay: { eyebrow: "Marketplace", title: "eBay store", text: "Fixed prices and best offers" },
        catawiki: { eyebrow: "Auctions", title: "Catawiki", text: "Weekly Natural History auctions" },
        trustami: { eyebrow: "Verified rating", title: "", text: "verified ratings" },
        instagram: { eyebrow: "Photography", title: "Instagram", text: "New arrivals and macro detail" },
        facebook: { eyebrow: "Community", title: "Facebook", text: "Fossils from Morocco" },
        whatsapp: { eyebrow: "Direct", title: "WhatsApp", text: "Ask for photos or a shipping quote" },
      },
    },
    closing: {
      titleLead: "Begin with one specimen,",
      titleItalic: "or a whole shelf.",
      text: "From a Miniature for the desk to a Museum-scale monarch, every piece arrives documented, safely packed and ready to be lived with. Direct enquiries welcome at",
      ctaShop: "Shop the collection",
      soussLabel: "Souss Lagerstätte",
      soussUrl: "https://www.mediterranic.com/Souss-Lagerst%C3%A4tte-site",
      ctaArchive: "The Archive",
      archiveEyebrow: "From the archive",
      archiveTitle: "Pieces that found their collectors",
      archiveCta: "View all →",
      alsoOn: "Also on",
      ebayLabel: "Our eBay store",
      catawikiLabel: "Our Catawiki auctions",
    },
  },
  shop: {
    eyebrow: "The collection",
    title: "Every specimen, one standard",
    description:
      "Moroccan trilobites, minerals and instruments for the discerning collector — available directly on Mediterranic, or live on eBay and Catawiki.",
    emptyTitle: "No specimens match those filters",
    emptyText: "Try widening the price band, the period or the channel — the catalogue changes weekly.",
  },
  archive: {
    eyebrow: "The Archive",
    title: "Pieces that found their collectors",
    description:
      "A record of specimens that have passed through our hands. None is for sale — but if one speaks to you, we can look for a comparable piece.",
    badge: "Archive",
    empty: "The archive is being assembled.",
    cta: "Request a similar specimen",
  },
  shipping: {
    eyebrow: "Client care",
    title: "Shipping & Returns",
    intro:
      "Every specimen travels carefully packed, documented to museum standard. Here is exactly what that means, what it costs, and what happens if a piece is not right for your collection.",
    dispatch: {
      title: "Dispatch times",
      items: [
        "Orders confirmed before 14:00 (WET, Lisbon time) on a business day are packed and handed to the carrier the same day. Anything confirmed later leaves the following business day.",
        "Preparation: 1–2 business days for cradling, labelling and photographic record before the crate is closed.",
        "Tracking details are provided once the carrier label is created.",
        "Auction pieces: a specimen that is live on eBay or Catawiki ships under that marketplace's own schedule. When the auction ends and the piece returns to Site Only, it ships under the terms on this page.",
      ],
    },
    packing: {
      title: "How a trilobite is packed",
      items: [
        "Fossilised calcite is brittle and matrix cleaves along old bedding planes. A specimen that survives a quarry does not automatically survive a parcel network, so packing is treated as part of the preparation.",
        "The specimen is surface-dried, then wrapped in acid-free tissue and immobilised in a fitted foam cradle — nothing presses directly on spines, eyes or cephalic sutures.",
        "The cradle floats inside a rigid double-wall box with at least 5 cm of cushioning on every face, so a drop on any corner is absorbed before it reaches the stone.",
        "Larger slabs travel crated and banded. High-value pieces are shipped in two independent parcels when the carrier allows it.",
        "Each order includes the printed specimen data — species, locality, formation, period, length and preparation notes — and a certificate of authenticity for pieces marked as certified on their product page.",
      ],
    },
    rates: {
      title: "Safe delivery rates",
      items: [
        "Rates below are per order, not per piece, and include careful packing and tracking.",
        "Countries outside these zones: write to us with the destination and the specimen reference, and we will quote a delivery route before you commit to anything.",
      ],
    },
    customs: {
      title: "Customs, duties and paperwork",
      items: [
        "Specimens leave Portugal/EU under a commercial invoice describing the goods as “fossil specimens for private collection”, with the HS code for collector's items and the declared value matching what you paid.",
        "Import duty and any local sales tax are the buyer's responsibility and are not included in the shipping price shown at checkout.",
        "We never under-declare value or mark a commercial shipment as a gift. Incorrect declarations can cause customs problems and delays.",
        "Moroccan fossil exports are legal under the national framework for privately collected material; every piece is sourced through licensed quarry families and the documentation travels with the specimen.",
      ],
    },
    returns: {
      title: "Returns within 30 days",
      items: [
        "A specimen is bought on photography and description, and the two are never quite the same object in the hand. If it does not belong in your collection, you have 30 days from delivery to return it.",
        "Write to us with the order reference (MED-XXXXXXXX) and we reply with a return authorisation and the address.",
        "The piece must come back in the same packing it arrived in, with the matrix, labels, certificate and documentation. Please do not clean, consolidate, re-prepare or repair anything.",
        "The refund is issued to the original payment method within 5 business days of the parcel being inspected, and covers the price of the specimen. Outbound shipping is refunded only where the return is our fault.",
        "Return postage is paid by the buyer unless the piece arrived damaged or is materially different from its listing — in those cases we cover it in full.",
      ],
    },
    damaged: {
      title: "If a piece arrives damaged",
      items: [
        "It is rare, and we handle it directly. Please follow this order so the case can be opened straight away:",
        "Photograph the outer box before opening it if the packaging is visibly crushed, pierced or wet, and note any damage with the carrier at the door.",
        "Photograph the specimen and the packing exactly as you found it. Do not discard anything, including the foam cradle and fragments — they help us assess the damage.",
        "Email us within 48 hours of delivery with the order reference and the photographs.",
        "We open the claim and offer you a replacement, a partial refund or a full refund including shipping. You are never left holding a broken stone.",
      ],
    },
    archive: {
      title: "Pieces already placed",
      items: [
        "Specimens that have found their collectors are moved to the public archive. They are shown for the record only — no price and no availability. If one of them is the piece you were looking for, use “Request a similar specimen” on its page and we will search the next quarry batches and auction catalogues on your behalf.",
        "A piece marked Unavailable in the shop is in the same situation: it has left our stock, and the price is deliberately not shown.",
      ],
    },
    newsletterTitle: "Stay in touch",
    newsletterCopy:
      "Delivery notices, new quarry batches and auction dates. Twice a month.",
    contactNote:
      "Questions about a specific order? Write to us with your order reference — we answer personally, usually the same day.",
  },
  checkout: { eyebrow: "Secure checkout", title: "Complete your acquisition" },
  product: {
    descriptionTitle: "Description",
    provenanceTitle: "Provenance & preparation",
    detailsTitle: "Specimen details",
    shippingTitle: "Shipping & returns",
    reviewsTitle: "Collector reviews",
    certificateLabel: "Certificate of authenticity",
    unavailableNote: "This specimen is no longer available.",
  },
  analytics: {
    enabled: true,
    bodyScripts: "",
  },
  commerce: {
    freeShipping: true,
    autoSyncInventory: true,
  },
  site: {
    favicon: "/images/favicon-m-caribbean.png",
  },
  notFound: {
    title: "This specimen has not been found yet",
    text: "The page you are looking for has moved or never existed. The collection itself is well worth a browse.",
    homeCta: "Back to home",
    shopCta: "View the collection",
  },
};

/* ------------------------------------------------------------------ */
/* Merge / read helpers                                                */
/* ------------------------------------------------------------------ */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges a stored document over the defaults. Only keys that exist in the
 * defaults survive, and only values of the right type are accepted, so a
 * corrupted or hand-edited jsonb column can never break a page.
 */
function mergeValue<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(override)) return base;
    // A stored list wins as a whole — including when the curator deleted every
    // line. Only the *shape* of each item comes from the defaults.
    if (base.length > 0 && typeof base[0] === "string") {
      return override.filter((value): value is string => typeof value === "string") as T;
    }
    const template = base[0];
    return override.map((item) => mergeValue(template, item)) as T;
  }
  if (isPlainObject(base)) {
    if (!isPlainObject(override)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base)) {
      if (key in override) out[key] = mergeValue((base as Record<string, unknown>)[key], override[key]);
    }
    return out as T;
  }
  if (typeof base === "string") {
    return (typeof override === "string" ? override : base) as T;
  }
  if (typeof base === "boolean") {
    return (typeof override === "boolean" ? override : base) as T;
  }
  if (typeof base === "number") {
    return (typeof override === "number" && Number.isFinite(override) ? override : base) as T;
  }
  return base;
}

export function mergeContent(stored: unknown): SiteContent {
  const merged = mergeValue(DEFAULT_CONTENT, stored);
  merged.layout.home = normalizeHomeOrder(merged.layout.home);
  return merged;
}

/** Reads a value by path, e.g. `readContent(content, ["home", "hero", "title"])`. */
export function readContent(content: SiteContent, path: string[]): unknown {
  let cursor: unknown = content;
  for (const key of path) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

/** Immutable write by path, used by the back-office form. */
export function writeContent(content: SiteContent, path: string[], value: unknown): SiteContent {
  const clone = JSON.parse(JSON.stringify(content)) as SiteContent;
  let cursor: Record<string, unknown> = clone as unknown as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i += 1) {
    const next = cursor[path[i]];
    if (!isPlainObject(next)) return content;
    cursor = next;
  }
  cursor[path[path.length - 1]] = value;
  return clone;
}

/* ------------------------------------------------------------------ */
/* Back-office schema: drives the "Page texts & photos" tab            */
/* ------------------------------------------------------------------ */

export type ContentFieldType = "text" | "textarea" | "image" | "lines" | "pairs" | "toggle";

export type ContentField = {
  path: string[];
  label: string;
  type: ContentFieldType;
  hint?: string;
  /** Labels for the two inputs of a "pairs" field. */
  itemLabels?: [string, string];
  placeholder?: string;
};

export type ContentGroup = {
  id: string;
  label: string;
  note?: string;
  fields: ContentField[];
};

const pairFields = (path: string[], label: string, hint?: string): ContentField => ({
  path,
  label,
  type: "pairs",
  itemLabels: ["Title", "Text"],
  hint,
});

const collectionCardFields = (
  key: "devonianCrown" | "ordovicianMariners" | "cambrianDawn" | "connoisseur",
  label: string,
): ContentField[] => [
  { path: ["home", "collections", "cards", key, "title"], label: `${label} · title`, type: "text" },
  { path: ["home", "collections", "cards", key, "label"], label: `${label} · small label (optional)`, type: "text" },
  { path: ["home", "collections", "cards", key, "description"], label: `${label} · description`, type: "textarea" },
  { path: ["home", "collections", "cards", key, "href"], label: `${label} · custom link (optional)`, type: "text", hint: "Leave empty to open this collection in the shop. External links open in a new tab." },
];

const linkCardFields = (
  key: "ebay" | "catawiki" | "trustami" | "instagram" | "facebook" | "whatsapp",
  label: string,
): ContentField[] => [
  { path: ["home", "links", "cards", key, "eyebrow"], label: `${label} · small label`, type: "text" },
  { path: ["home", "links", "cards", key, "title"], label: `${label} · title${key === "trustami" ? " (empty = live rating)" : key === "catawiki" ? " (alternative text for the wordmark)" : ""}`, type: "text" },
  { path: ["home", "links", "cards", key, "text"], label: `${label} · description`, type: "text" },
];

export const CONTENT_GROUPS: ContentGroup[] = [
  {
    id: "h0",
    label: "H0 · Top Bar",
    note: "Fixed at the very top of every page. Three short trust messages, one per line.",
    fields: [
      { path: ["header", "trustBar"], label: "Trust bar (one item per line)", type: "lines" },
    ],
  },
  {
    id: "h1",
    label: "H1 · Header",
    note: "Fixed below H0 on every page. Wordmark, emblem and navigation labels.",
    fields: [
      { path: ["header", "wordmark"], label: "Wordmark", type: "text" },
      { path: ["header", "tagline"], label: "Line below the wordmark", type: "text" },
      { path: ["header", "logoImage"], label: "Emblem / logo (optional)", type: "image" },
      { path: ["header", "navShopAll"], label: "Menu · Shop all", type: "text" },
      { path: ["header", "navSiteOnly"], label: "Menu · Only on Site", type: "text" },
      { path: ["header", "navEbay"], label: "Menu · Live on eBay", type: "text" },
      { path: ["header", "navCatawiki"], label: "Menu · Live on Catawiki", type: "text" },
      { path: ["header", "navConnoisseur"], label: "Menu · Connoisseur", type: "text" },
    ],
  },
  {
    id: "h2",
    label: "H2 · Hero",
    note: "Movable. Opening title, copy, buttons and circular photograph.",
    fields: [
      // Hero eyebrow line retired: not shown on the site and not editable.
      { path: ["home", "hero", "title"], label: "Title (first part)", type: "text" },
      { path: ["home", "hero", "titleItalic"], label: "Title (italic part)", type: "text" },
      { path: ["home", "hero", "description"], label: "Description", type: "textarea" },
      { path: ["home", "hero", "image"], label: "Photograph", type: "image" },
      { path: ["home", "hero", "caption"], label: "Caption under the photo", type: "text" },
      { path: ["home", "hero", "primaryCta"], label: "Button · primary", type: "text" },
      { path: ["home", "hero", "secondaryCta"], label: "Button · secondary", type: "text" },
    ],
  },
  {
    id: "h3",
    label: "H3 · Hero Stats",
    note: "Movable. Specimen and Era totals are always live. Years and feedback totals come from Store settings.",
    fields: [
      { path: ["home", "hero", "stats", "years"], label: "Stat label · years", type: "text" },
      { path: ["home", "hero", "stats", "feedbacks"], label: "Stat label · verified feedbacks", type: "text" },
      { path: ["home", "hero", "stats", "specimens"], label: "Stat label · specimens (number is automatic)", type: "text" },
      { path: ["home", "hero", "stats", "eras"], label: "Stat label · eras (number is automatic)", type: "text" },
    ],
  },
  {
    id: "h4",
    label: "H4 · Trust Strip",
    note: "Movable. Four guarantees with icons.",
    fields: [pairFields(["home", "trust", "items"], "Trust items", "Four items: title + one line of text.")],
  },
  {
    id: "h5",
    label: "H5 · Channels",
    note: "Movable. Site Only, eBay and Catawiki; the three totals are live.",
    fields: [
      { path: ["home", "channels", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["home", "channels", "title"], label: "Title", type: "text" },
      { path: ["home", "channels", "description"], label: "Description", type: "textarea" },
      { path: ["home", "channels", "directBadge"], label: "Site Only · badge", type: "text" },
      { path: ["home", "channels", "directTitle"], label: "Site Only · title", type: "text" },
      { path: ["home", "channels", "directText"], label: "Site Only · text", type: "textarea" },
      { path: ["home", "channels", "directCta"], label: "Site Only · link label", type: "text" },
      { path: ["home", "channels", "ebayBadge"], label: "eBay · badge", type: "text" },
      { path: ["home", "channels", "ebayTitle"], label: "eBay · title", type: "text" },
      { path: ["home", "channels", "ebayText"], label: "eBay · text", type: "textarea" },
      { path: ["home", "channels", "ebayCta"], label: "eBay · link label", type: "text" },
      { path: ["home", "channels", "catawikiBadge"], label: "Catawiki · badge", type: "text" },
      { path: ["home", "channels", "catawikiTitle"], label: "Catawiki · title", type: "text" },
      { path: ["home", "channels", "catawikiText"], label: "Catawiki · text", type: "textarea" },
      { path: ["home", "channels", "catawikiCta"], label: "Catawiki · link label", type: "text" },
    ],
  },
  {
    id: "h6",
    label: "H6 · Collections",
    note: "Movable. All four cards: text, photographs and optional links. Piece totals stay automatic.",
    fields: [
      { path: ["home", "collections", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["home", "collections", "title"], label: "Title", type: "text" },
      { path: ["home", "collections", "subtitle"], label: "Subtitle", type: "text" },
      // Geological ages line under the four cards retired: not shown and not editable.
      { path: ["home", "collections", "covers", "devonianCrown"], label: "Cover · Devonian Crown", type: "image" },
      {
        path: ["home", "collections", "covers", "ordovicianMariners"],
        label: "Cover · Ordovician Mariners",
        type: "image",
      },
      { path: ["home", "collections", "covers", "cambrianDawn"], label: "Cover · Cambrian", type: "image" },
      { path: ["home", "collections", "covers", "connoisseur"], label: "Cover · The Connoisseur", type: "image" },
      ...collectionCardFields("devonianCrown", "Devonian Crown"),
      ...collectionCardFields("ordovicianMariners", "Ordovician Mariners"),
      ...collectionCardFields("cambrianDawn", "Souss Lagerstätte"),
      ...collectionCardFields("connoisseur", "The Connoisseur"),
      { path: ["home", "collections", "pieceSingular"], label: "Count label · singular", type: "text" },
      { path: ["home", "collections", "piecePlural"], label: "Count label · plural", type: "text" },
      { path: ["home", "collections", "explore"], label: "Card link label", type: "text" },
    ],
  },
  {
    id: "h7",
    label: "H7 · Featured",
    fields: [
      { path: ["home", "featured", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["home", "featured", "title"], label: "Title", type: "text" },
      { path: ["home", "featured", "cta"], label: "Link label", type: "text" },
    ],
  },
  {
    id: "h8",
    label: "H8 · Provenance",
    note: "Movable. Story, seafloor photograph, quote and numbered steps.",
    fields: [
      { path: ["home", "provenance", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["home", "provenance", "title"], label: "Title", type: "text" },
      { path: ["home", "provenance", "titleItalic"], label: "Title (italic)", type: "text" },
      { path: ["home", "provenance", "body"], label: "Body", type: "textarea" },
      { path: ["home", "provenance", "image"], label: "Photograph", type: "image" },
      { path: ["home", "provenance", "badge"], label: "Badge on the photo", type: "text" },
      { path: ["home", "provenance", "quote"], label: "Quote on the photo", type: "textarea" },
      { path: ["home", "provenance", "imageBadge"], label: "Photo label (top right)", type: "text" },
      pairFields(["home", "provenance", "steps"], "Numbered steps", "Three steps: title + text."),
    ],
  },
  {
    id: "h9",
    label: "H9 · Marketplaces",
    note: "Movable. Verified marketplace and social buttons. Destination URLs remain in Store settings.",
    fields: [
      { path: ["home", "marketplaces", "ebayLabel"], label: "eBay button", type: "text" },
      { path: ["home", "marketplaces", "catawikiLabel"], label: "Catawiki button", type: "text" },
      { path: ["home", "marketplaces", "instagramLabel"], label: "Instagram button", type: "text" },
      { path: ["home", "marketplaces", "facebookLabel"], label: "Facebook button", type: "text" },
    ],
  },
  {
    id: "h10",
    label: "H10 · Reviews",
    note: "Movable. Only approved reviews appear; choose them in tab 6 Reviews.",
    fields: [
      { path: ["home", "testimonials", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["home", "testimonials", "title"], label: "Title", type: "text" },
    ],
  },
  {
    id: "h11",
    label: "H11 · Links",
    note: "Movable. Six compact link cards. Account and marketplace URLs remain in Store settings.",
    fields: [
      { path: ["home", "links", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["home", "links", "title"], label: "Title", type: "text" },
      { path: ["home", "links", "description"], label: "Description", type: "textarea" },
      ...linkCardFields("ebay", "eBay"),
      ...linkCardFields("catawiki", "Catawiki"),
      ...linkCardFields("trustami", "Trustami"),
      ...linkCardFields("instagram", "Instagram"),
      ...linkCardFields("facebook", "Facebook"),
      ...linkCardFields("whatsapp", "WhatsApp"),
      { path: ["home", "links", "footnote"], label: "Footnote", type: "textarea" },
    ],
  },
  {
    id: "h12",
    label: "H12 · Closing",
    note: "Movable. Final calls to action, archive selection and marketplace links.",
    fields: [
      { path: ["home", "closing", "titleLead"], label: "Title (first part)", type: "text" },
      { path: ["home", "closing", "titleItalic"], label: "Title (italic)", type: "text" },
      { path: ["home", "closing", "text"], label: "Text", type: "textarea" },
      { path: ["home", "closing", "ctaShop"], label: "Button · shop", type: "text" },
      { path: ["home", "closing", "soussLabel"], label: "Button · Souss Lagerstätte", type: "text" },
      { path: ["home", "closing", "soussUrl"], label: "Souss Lagerstätte · URL", type: "text" },
      { path: ["home", "closing", "ctaArchive"], label: "Button · archive", type: "text" },
      { path: ["home", "closing", "archiveEyebrow"], label: "Archive block · eyebrow", type: "text" },
      { path: ["home", "closing", "archiveTitle"], label: "Archive block · title", type: "text" },
      { path: ["home", "closing", "archiveCta"], label: "Archive block · link", type: "text" },
      { path: ["home", "closing", "alsoOn"], label: "Marketplace row · prefix", type: "text" },
      { path: ["home", "closing", "ebayLabel"], label: "Marketplace row · eBay", type: "text" },
      { path: ["home", "closing", "catawikiLabel"], label: "Marketplace row · Catawiki", type: "text" },
    ],
  },
  {
    id: "shop",
    label: "Shop page",
    fields: [
      { path: ["shop", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["shop", "title"], label: "Title", type: "text" },
      { path: ["shop", "description"], label: "Description", type: "textarea" },
      { path: ["shop", "emptyTitle"], label: "Empty state · title", type: "text" },
      { path: ["shop", "emptyText"], label: "Empty state · text", type: "textarea" },
    ],
  },
  {
    id: "archive",
    label: "Archive page",
    fields: [
      { path: ["archive", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["archive", "title"], label: "Title", type: "text" },
      { path: ["archive", "description"], label: "Description", type: "textarea" },
      { path: ["archive", "badge"], label: "Badge on each photo", type: "text" },
      { path: ["archive", "empty"], label: "Empty message", type: "text" },
      { path: ["archive", "cta"], label: "Link under each piece", type: "text" },
    ],
  },
  {
    id: "shipping",
    label: "Shipping & Returns page",
    note: "Each block is a title plus one line per paragraph.",
    fields: [
      { path: ["shipping", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["shipping", "title"], label: "Title", type: "text" },
      { path: ["shipping", "intro"], label: "Introduction", type: "textarea" },
      { path: ["shipping", "dispatch", "title"], label: "Dispatch · title", type: "text" },
      { path: ["shipping", "dispatch", "items"], label: "Dispatch · paragraphs", type: "lines" },
      { path: ["shipping", "packing", "title"], label: "Packing · title", type: "text" },
      { path: ["shipping", "packing", "items"], label: "Packing · paragraphs", type: "lines" },
      { path: ["shipping", "rates", "title"], label: "Rates · title", type: "text" },
      { path: ["shipping", "rates", "items"], label: "Rates · paragraphs", type: "lines" },
      { path: ["shipping", "customs", "title"], label: "Customs · title", type: "text" },
      { path: ["shipping", "customs", "items"], label: "Customs · paragraphs", type: "lines" },
      { path: ["shipping", "returns", "title"], label: "Returns · title", type: "text" },
      { path: ["shipping", "returns", "items"], label: "Returns · paragraphs", type: "lines" },
      { path: ["shipping", "damaged", "title"], label: "Damaged · title", type: "text" },
      { path: ["shipping", "damaged", "items"], label: "Damaged · paragraphs", type: "lines" },
      { path: ["shipping", "archive", "title"], label: "Archive · title", type: "text" },
      { path: ["shipping", "archive", "items"], label: "Archive · paragraphs", type: "lines" },
      { path: ["shipping", "newsletterTitle"], label: "Newsletter · title", type: "text" },
      { path: ["shipping", "newsletterCopy"], label: "Newsletter · text", type: "textarea" },
      { path: ["shipping", "contactNote"], label: "Closing note", type: "textarea" },
    ],
  },
  {
    id: "checkout",
    label: "Checkout page",
    fields: [
      { path: ["checkout", "eyebrow"], label: "Eyebrow", type: "text" },
      { path: ["checkout", "title"], label: "Title", type: "text" },
    ],
  },
  {
    id: "product",
    label: "Product page headings",
    fields: [
      { path: ["product", "descriptionTitle"], label: "Description heading", type: "text" },
      { path: ["product", "provenanceTitle"], label: "Provenance heading", type: "text" },
      { path: ["product", "detailsTitle"], label: "Details heading", type: "text" },
      { path: ["product", "shippingTitle"], label: "Shipping heading", type: "text" },
      { path: ["product", "reviewsTitle"], label: "Reviews heading", type: "text" },
      { path: ["product", "certificateLabel"], label: "Certificate label", type: "text" },
      { path: ["product", "unavailableNote"], label: "Unavailable note", type: "text" },
    ],
  },
  {
    id: "h13",
    label: "H13 · Footer",
    note: "Fixed at the bottom of every page. Newsletter, collections, client care, correspondence and legal links.",
    fields: [
      { path: ["footer", "tagline"], label: "Tagline", type: "textarea" },
      { path: ["footer", "newsletterTitle"], label: "Newsletter · title", type: "text" },
      { path: ["footer", "newsletterCopy"], label: "Newsletter · text", type: "textarea" },
      { path: ["footer", "collectionsTitle"], label: "Collections heading", type: "text" },
      { path: ["footer", "clientCareTitle"], label: "Client care heading", type: "text" },
      { path: ["footer", "clientCare"], label: "Client care list (one per line)", type: "lines" },
      { path: ["footer", "archiveLabel"], label: "Archive link", type: "text" },
      { path: ["footer", "correspondenceTitle"], label: "Correspondence heading", type: "text" },
      { path: ["footer", "correspondence"], label: "Correspondence list (one per line)", type: "lines" },
      { path: ["footer", "marketplacesTitle"], label: "Marketplaces heading", type: "text" },
      { path: ["footer", "ebayLabel"], label: "Marketplace · eBay", type: "text" },
      { path: ["footer", "catawikiLabel"], label: "Marketplace · Catawiki", type: "text" },
      { path: ["footer", "instagramLabel"], label: "Marketplace · Instagram", type: "text" },
      { path: ["footer", "facebookLabel"], label: "Marketplace · Facebook", type: "text" },
      { path: ["footer", "bottomLine"], label: "Bottom line", type: "text" },
      { path: ["footer", "legalNote"], label: "Legal note", type: "text" },
      { path: ["footer", "navShop"], label: "Bottom navigation · Shop", type: "text" },
      { path: ["footer", "navFeatured"], label: "Bottom navigation · Featured & New", type: "text" },
      { path: ["footer", "navArchive"], label: "Bottom navigation · Archive", type: "text" },
      { path: ["footer", "navShipping"], label: "Bottom navigation · Shipping", type: "text" },
      { path: ["footer", "navContact"], label: "Bottom navigation · Contact", type: "text" },
    ],
  },
  {
    id: "brand",
    label: "Brand · favicon",
    note: "The header wordmark and emblem are edited in H1 · Header.",
    fields: [
      { path: ["site", "favicon"], label: "Favicon (browser tab icon)", type: "image" },
    ],
  },
  {
    id: "commerce",
    label: "Shipping & payment",
    note: "Free shipping is the normal case. While it is on, the checkout offers no other delivery option. Switch it off to charge one rate per zone.",
    fields: [
      { path: ["commerce", "autoSyncInventory"], label: "Automatically reconcile active eBay and Catawiki inventory", type: "toggle", hint: "The cron discovers relistings and matches saved links or catalogue references. Ambiguous identities are flagged once; stored photos and text are kept." },
      {
        path: ["commerce", "freeShipping"],
        label: "Free shipping on every order",
        type: "toggle",
        hint: "On = only “Free shipping” at checkout. Off = one rate for the destination zone (5 zones).",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics & tracking (Statcounter)",
    note: "Paste the full Statcounter code here. It is injected at the end of every page, exactly as Statcounter gives it.",
    fields: [
      { path: ["analytics", "enabled"], label: "Enable visitor analytics", type: "toggle", hint: "Uses your Statcounter project. Does not load on admin, checkout or order pages." },
      {
        path: ["analytics", "bodyScripts"],
        label: "Statcounter / analytics code (raw HTML)",
        type: "textarea",
        hint: "Paste the whole code block from Statcounter, including the <script> tags.",
      },
    ],
  },
  {
    id: "not-found",
    label: "404 page",
    fields: [
      { path: ["notFound", "title"], label: "Title", type: "text" },
      { path: ["notFound", "text"], label: "Text", type: "textarea" },
      { path: ["notFound", "homeCta"], label: "Button · home", type: "text" },
      { path: ["notFound", "shopCta"], label: "Button · shop", type: "text" },
    ],
  },
];
