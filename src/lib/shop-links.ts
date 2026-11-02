export const SHOP_PERIODS = ["Cambrian", "Ordovician", "Devonian"] as const;
export type ShopPeriod = (typeof SHOP_PERIODS)[number];

export function normalizeShopPeriod(value: string | null | undefined): ShopPeriod | "all" {
  return SHOP_PERIODS.find((period) => period === value) ?? "all";
}

/** Maps labels such as "Lower Cambrian" to the shop's Cambrian filter. */
export function shopPeriodFromLabel(value: string | null | undefined): ShopPeriod | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return SHOP_PERIODS.find((period) => normalized.includes(period.toLowerCase())) ?? null;
}

export function shopPeriodHref(value: string | null | undefined): string | null {
  const period = shopPeriodFromLabel(value);
  return period ? `/shop?period=${encodeURIComponent(period)}` : null;
}

export const SHOP_CHANNELS = ["direct", "catawiki", "ebay"] as const;
export type ShopChannel = (typeof SHOP_CHANNELS)[number];

export function normalizeShopChannel(value: string | null | undefined): ShopChannel | "all" {
  return SHOP_CHANNELS.find((channel) => channel === value) ?? "all";
}

export function shopChannelHref(value: string | null | undefined): string | null {
  const channel = normalizeShopChannel(value);
  return channel === "all" ? null : `/shop?channel=${channel}`;
}
