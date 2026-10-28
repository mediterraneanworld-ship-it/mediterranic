import type { Product } from "@/lib/catalog";
import { COLLECTIONS, type CollectionSlug } from "@/lib/collections";

/**
 * A piece can sit in several collections at once — e.g. a Devonian specimen
 * that is also museum-grade belongs to both "The Devonian Crown" and
 * "The Connoisseur". Older rows only carry the single primary collection.
 */
export function collectionsOf(product: Pick<Product, "collection" | "collections">): string[] {
  const list = Array.isArray(product.collections) ? product.collections : [];
  const valid = list.filter((slug) => COLLECTIONS.some((c) => c.slug === slug));
  if (valid.length > 0) return valid;
  return [product.collection];
}

export function inCollection(
  product: Pick<Product, "collection" | "collections">,
  slug: string,
): boolean {
  return collectionsOf(product).includes(slug);
}

export function isCollectionSlug(value: string): value is CollectionSlug {
  return COLLECTIONS.some((c) => c.slug === value);
}
