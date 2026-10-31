/**
 * Visibility/price rules for a piece, in a module with **no** database imports
 * so it can be used from client components without dragging `pg` into the
 * browser bundle.
 */

type VisibilityShape = {
  archived: boolean;
  stock: number;
  listingChannel: string | null;
};

/**
 * A piece is genuinely on sale only when it is in stock, not archived and
 * offered somewhere (Site Only, eBay or Catawiki). Everything else is a
 * catalogue entry that must never be counted as "for sale".
 */
export function isAvailable(product: VisibilityShape): boolean {
  return !product.archived && product.stock > 0 && Boolean(product.listingChannel);
}

type PricedShape = VisibilityShape & {
  priceCents: number;
  compareAtCents: number | null;
  siteOnlyPriceCents: number | null;
};

/**
 * Strips every money field from a piece that is not for sale.
 *
 * Server components can hide a price with an `if`, but any object handed to a
 * client component is serialised into the page source — so an "Unavailable"
 * piece would still carry its price in the HTML. Everything that crosses into
 * a client component goes through here first.
 */
export function publicProduct<T extends PricedShape>(product: T): T {
  if (isAvailable(product)) return product;
  return {
    ...product,
    priceCents: 0,
    compareAtCents: null,
    siteOnlyPriceCents: null,
  };
}

export function publicProducts<T extends PricedShape>(list: T[]): T[] {
  return list.map(publicProduct);
}
