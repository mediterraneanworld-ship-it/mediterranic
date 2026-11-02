import { isAvailable } from "@/lib/product-visibility";

export type ShelfCandidate = {
  id: number;
  slug: string;
  period?: string | null;
  collection?: string | null;
  published?: boolean;
  featured?: boolean;
  archived: boolean;
  stock: number;
  listingChannel: string | null;
  marketplaceActive?: boolean | null;
};

const COLLECTION_TO_ERA: Record<string, string> = {
  "cambrian-dawn": "cambrian",
  "ordovician-mariners": "ordovician",
  "devonian-crown": "devonian",
};

const GEOLOGICAL_ERAS = [
  "ediacaran",
  "cambrian",
  "ordovician",
  "silurian",
  "devonian",
  "carboniferous",
  "permian",
  "triassic",
  "jurassic",
  "cretaceous",
] as const;

/**
 * Resolves the canonical shelf key (geological Era/Period) for a specimen.
 * Handles qualifiers such as "Lower Cambrian" or "Middle Devonian" so pieces
 * from the same geological Era share one shelf. Falls back to collection only
 * when no geological period is recorded.
 */
export function geologicalShelfKey(
  item: Pick<ShelfCandidate, "period" | "collection">,
): string {
  const rawPeriod = (item.period ?? "").trim().toLowerCase();
  if (rawPeriod) {
    const canonical = GEOLOGICAL_ERAS.find((era) => rawPeriod.includes(era));
    return `era:${canonical ?? rawPeriod}`;
  }
  const rawCollection = (item.collection ?? "").trim().toLowerCase();
  if (rawCollection && COLLECTION_TO_ERA[rawCollection]) {
    return `era:${COLLECTION_TO_ERA[rawCollection]}`;
  }
  return rawCollection ? `collection:${rawCollection}` : "other";
}

/**
 * Selects specimens for "Further from the same shelf":
 * 1. Only specimens from the same shelf (same geological Era) are considered.
 * 2. Available specimens always come first.
 * 3. Unavailable specimens are moved to the end and are ONLY included when
 *    there are not enough available specimens from the same geological Era
 *    to fill `limit` slots.
 */
export function selectSameShelfProducts<T extends ShelfCandidate>(
  current: Pick<ShelfCandidate, "id" | "slug" | "period" | "collection">,
  catalogue: T[],
  limit = 4,
): T[] {
  if (limit <= 0) return [];
  const targetShelf = geologicalShelfKey(current);

  const sameShelf = catalogue.filter(
    (candidate) =>
      candidate.slug !== current.slug &&
      candidate.id !== current.id &&
      candidate.published !== false &&
      geologicalShelfKey(candidate) === targetShelf,
  );

  const available = sameShelf
    .filter((candidate) => isAvailable(candidate))
    .sort(
      (a, b) =>
        Number(b.collection === current.collection) - Number(a.collection === current.collection) ||
        Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
        a.id - b.id,
    );

  if (available.length >= limit) {
    return available.slice(0, limit);
  }

  const unavailable = sameShelf
    .filter((candidate) => !isAvailable(candidate))
    .sort(
      (a, b) =>
        Number(Boolean(a.archived)) - Number(Boolean(b.archived)) ||
        Number(b.collection === current.collection) - Number(a.collection === current.collection) ||
        a.id - b.id,
    );

  return [...available, ...unavailable.slice(0, limit - available.length)];
}
