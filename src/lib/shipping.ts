// Shared between the cart (preview) and the order API (source of truth).

// All amounts are in euro cents.
export const FREE_SHIPPING_THRESHOLD_CENTS = 45_000;

export type ShippingZone = "americas" | "europe" | "asia";

export const COUNTRIES: { code: string; name: string; zone: ShippingZone }[] = [
  { code: "US", name: "United States", zone: "americas" },
  { code: "CA", name: "Canada", zone: "americas" },
  { code: "GB", name: "United Kingdom", zone: "europe" },
  { code: "IE", name: "Ireland", zone: "europe" },
  { code: "FR", name: "France", zone: "europe" },
  { code: "DE", name: "Germany", zone: "europe" },
  { code: "NL", name: "Netherlands", zone: "europe" },
  { code: "BE", name: "Belgium", zone: "europe" },
  { code: "CH", name: "Switzerland", zone: "europe" },
  { code: "AT", name: "Austria", zone: "europe" },
  { code: "IT", name: "Italy", zone: "europe" },
  { code: "ES", name: "Spain", zone: "europe" },
  { code: "PT", name: "Portugal", zone: "europe" },
  { code: "SE", name: "Sweden", zone: "europe" },
  { code: "NO", name: "Norway", zone: "europe" },
  { code: "DK", name: "Denmark", zone: "europe" },
  { code: "FI", name: "Finland", zone: "europe" },
  { code: "JP", name: "Japan", zone: "asia" },
];

export type ShippingMethodId = "standard" | "express";

export const SHIPPING_METHODS: {
  id: ShippingMethodId;
  label: string;
  detail: string;
}[] = [
  { id: "standard", label: "Insured standard", detail: "5–8 business days" },
  { id: "express", label: "Insured express", detail: "2–3 business days" },
];

const RATES: Record<ShippingZone, Record<ShippingMethodId, number>> = {
  americas: { standard: 3_900, express: 8_200 },
  europe: { standard: 5_400, express: 10_900 },
  asia: { standard: 6_000, express: 12_500 },
};

export function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

/** Returns shipping in cents, or null when the country / method is unknown. */
export function calculateShipping(
  countryCode: string,
  method: ShippingMethodId,
  subtotalCents: number,
): number | null {
  const country = getCountry(countryCode);
  if (!country) return null;
  if (method === "standard" && subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) return 0;
  return RATES[country.zone][method];
}
