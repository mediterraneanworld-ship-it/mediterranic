export type CollectionSlug =
  | "devonian-crown"
  | "ordovician-mariners"
  | "cambrian-dawn"
  | "the-connoisseur";

export type Collection = {
  slug: CollectionSlug;
  title: string;
  eyebrow: string;
  description: string;
  /** Product image used as the collection cover */
  cover: string;
};

export const COLLECTIONS: Collection[] = [
  {
    slug: "devonian-crown",
    title: "The Devonian Crown",
    eyebrow: "c. 390–410 million years",
    description:
      "Phacopid and proetid specimens from the Tafilalt and Anti-Atlas. These are the trilobites most collectors picture first: armoured, sculpted and unmistakably ancient.",
    cover: "/images/products/drotops-armatus.jpg",
  },
  {
    slug: "ordovician-mariners",
    title: "The Ordovician Mariners",
    eyebrow: "c. 450–480 million years",
    description:
      "Older still. Fezouata Shale and Alnif assemblages from the early Palaeozoic seafloor, when the first great marine communities were taking shape.",
    cover: "/images/products/neseuretus-tristani.jpg",
  },
  {
    slug: "cambrian-dawn",
    title: "The Cambrian Dawn",
    eyebrow: "c. 485–541 million years",
    description:
      "The earliest chapter. Paradoxides and the great Cambrian assemblages of the Anti-Atlas, from the seas that first filled with complex animal life.",
    cover: "/images/imported/perrector-falloti-the-perrector-field-specimen-1.jpg",
  },
  {
    slug: "the-connoisseur",
    title: "The Connoisseur",
    eyebrow: "Museum grade",
    description:
      "Rare, large and exceptionally preserved. Pieces we would be proud to see in a private study, a boardroom or a foundation's collection.",
    cover: "/images/products/erbenochile-erbeni.jpg",
  },
];

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}
