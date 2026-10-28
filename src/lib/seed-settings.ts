import type { SiteSettings } from "@/lib/catalog";

/**
 * The storefront copy, marketplace links and trust signals, as last saved in
 * the back-office. This file is the source of truth: the live database is
 * re-seeded from it on every deployment, so anything saved in the admin must
 * be captured here before a rebuild or it will be lost.
 */
export const SEED_SETTINGS: Omit<SiteSettings, "updatedAt"> = {
  id: 1,
  heroEyebrow: "Moroccan Trilobites · 23 Years of Curatorship",
  heroTitle: "Five hundred million years,",
  heroTitleItalic: "in your keeping.",
  heroDescription: "Museum-grade Moroccan trilobites from the Cambrian, Ordovician and Devonian of the Anti-Atlas. Direct from nearly 23 years of specialist work, verified on eBay and Catawiki, with insured worldwide shipping.",
  provenanceEyebrow: "Nearly 23 Years in the Field",
  provenanceTitle: "Known by collectors.",
  provenanceTitleItalic: "Proven across thousands of shipments.",
  provenanceBody: "For nearly 23 years we have worked directly with licensed quarry families across Morocco. Every specimen here is a real, hand-prepared piece currently listed on Catawiki or eBay.",
  yearsExperience: 23,
  feedbacksLabel: "7,500+",
  ebayUrl: "https://www.ebay.com/str/mederranic",
  catawikiUrl: "https://www.catawiki.com/en/u/3881635-mediterranic",
  instagramUrl: "https://www.instagram.com/mediterranic.store/",
  facebookUrl: "https://www.facebook.com/Fossils.from.Morocco/",
  contactEmail: "mediterranean.world@gmail.com",
  trustamiUrl: "https://www.trustami.com/review/mediterranic-ecwid-com-rating",
  trustamiRating: "4.98/5",
  trustamiRatings: "200",
  whatsappPhone: "+351961300710",
  heroImage: "/images/hero-morocco.jpg",
  provenanceImage: "/images/seafloor-plate.jpg",
};
