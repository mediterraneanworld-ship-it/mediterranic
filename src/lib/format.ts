const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPrice(cents: number): string {
  return eur.format(cents / 100);
}

/** Compact EUR label without decimals, e.g. "€1,140". */
export function formatPriceShort(cents: number): string {
  return `€${Math.round(cents / 100).toLocaleString("en-IE")}`;
}

export function formatRating(value: number): string {
  return value > 0 ? value.toFixed(1) : "New";
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
