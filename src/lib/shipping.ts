// Shared between the cart (preview) and the order API (source of truth).

// All amounts are in euro cents.
export type ShippingZone = "europe" | "americas" | "asia" | "africa" | "oceania";

/**
 * Every ISO 3166-1 country, alphabetical by name — the standard checkout
 * behaviour. Zones drive the shipping rates below.
 */
export const COUNTRIES: { code: string; name: string; zone: ShippingZone }[] = [
  { code: "AL", name: "Albania", zone: "europe" },
  { code: "DZ", name: "Algeria", zone: "africa" },
  { code: "AD", name: "Andorra", zone: "europe" },
  { code: "AO", name: "Angola", zone: "africa" },
  { code: "AI", name: "Anguilla", zone: "americas" },
  { code: "AQ", name: "Antarctica", zone: "oceania" },
  { code: "AG", name: "Antigua and Barbuda", zone: "americas" },
  { code: "AR", name: "Argentina", zone: "americas" },
  { code: "AM", name: "Armenia", zone: "europe" },
  { code: "AW", name: "Aruba", zone: "americas" },
  { code: "AU", name: "Australia", zone: "oceania" },
  { code: "AT", name: "Austria", zone: "europe" },
  { code: "AZ", name: "Azerbaijan", zone: "europe" },
  { code: "BS", name: "Bahamas", zone: "americas" },
  { code: "BH", name: "Bahrain", zone: "asia" },
  { code: "BD", name: "Bangladesh", zone: "asia" },
  { code: "BB", name: "Barbados", zone: "americas" },
  { code: "BY", name: "Belarus", zone: "europe" },
  { code: "BE", name: "Belgium", zone: "europe" },
  { code: "BZ", name: "Belize", zone: "americas" },
  { code: "BJ", name: "Benin", zone: "africa" },
  { code: "BM", name: "Bermuda", zone: "americas" },
  { code: "BT", name: "Bhutan", zone: "asia" },
  { code: "BO", name: "Bolivia", zone: "americas" },
  { code: "BQ", name: "Bonaire, Sint Eustatius and Saba", zone: "americas" },
  { code: "BA", name: "Bosnia and Herzegovina", zone: "europe" },
  { code: "BW", name: "Botswana", zone: "africa" },
  { code: "BR", name: "Brazil", zone: "americas" },
  { code: "VG", name: "British Virgin Islands", zone: "americas" },
  { code: "BN", name: "Brunei", zone: "asia" },
  { code: "BG", name: "Bulgaria", zone: "europe" },
  { code: "BF", name: "Burkina Faso", zone: "africa" },
  { code: "BI", name: "Burundi", zone: "africa" },
  { code: "CV", name: "Cabo Verde", zone: "africa" },
  { code: "KH", name: "Cambodia", zone: "asia" },
  { code: "CM", name: "Cameroon", zone: "africa" },
  { code: "CA", name: "Canada", zone: "americas" },
  { code: "KY", name: "Cayman Islands", zone: "americas" },
  { code: "CF", name: "Central African Republic", zone: "africa" },
  { code: "TD", name: "Chad", zone: "africa" },
  { code: "CL", name: "Chile", zone: "americas" },
  { code: "CN", name: "China", zone: "asia" },
  { code: "CO", name: "Colombia", zone: "americas" },
  { code: "KM", name: "Comoros", zone: "africa" },
  { code: "CG", name: "Congo", zone: "africa" },
  { code: "CD", name: "Congo (DRC)", zone: "africa" },
  { code: "CR", name: "Costa Rica", zone: "americas" },
  { code: "HR", name: "Croatia", zone: "europe" },
  { code: "CU", name: "Cuba", zone: "americas" },
  { code: "CW", name: "Curaçao", zone: "americas" },
  { code: "CY", name: "Cyprus", zone: "europe" },
  { code: "CZ", name: "Czechia", zone: "europe" },
  { code: "CI", name: "Côte d'Ivoire", zone: "africa" },
  { code: "DK", name: "Denmark", zone: "europe" },
  { code: "DJ", name: "Djibouti", zone: "africa" },
  { code: "DM", name: "Dominica", zone: "americas" },
  { code: "DO", name: "Dominican Republic", zone: "americas" },
  { code: "EC", name: "Ecuador", zone: "americas" },
  { code: "EG", name: "Egypt", zone: "africa" },
  { code: "SV", name: "El Salvador", zone: "americas" },
  { code: "GQ", name: "Equatorial Guinea", zone: "africa" },
  { code: "ER", name: "Eritrea", zone: "africa" },
  { code: "EE", name: "Estonia", zone: "europe" },
  { code: "SZ", name: "Eswatini", zone: "africa" },
  { code: "ET", name: "Ethiopia", zone: "africa" },
  { code: "FK", name: "Falkland Islands", zone: "americas" },
  { code: "FJ", name: "Fiji", zone: "oceania" },
  { code: "FI", name: "Finland", zone: "europe" },
  { code: "FR", name: "France", zone: "europe" },
  { code: "GF", name: "French Guiana", zone: "americas" },
  { code: "PF", name: "French Polynesia", zone: "oceania" },
  { code: "GA", name: "Gabon", zone: "africa" },
  { code: "GM", name: "Gambia", zone: "africa" },
  { code: "GE", name: "Georgia", zone: "europe" },
  { code: "DE", name: "Germany", zone: "europe" },
  { code: "GH", name: "Ghana", zone: "africa" },
  { code: "GI", name: "Gibraltar", zone: "asia" },
  { code: "GR", name: "Greece", zone: "europe" },
  { code: "GL", name: "Greenland", zone: "americas" },
  { code: "GD", name: "Grenada", zone: "americas" },
  { code: "GP", name: "Guadeloupe", zone: "americas" },
  { code: "GU", name: "Guam", zone: "oceania" },
  { code: "GT", name: "Guatemala", zone: "americas" },
  { code: "GN", name: "Guinea", zone: "africa" },
  { code: "GW", name: "Guinea-Bissau", zone: "africa" },
  { code: "GY", name: "Guyana", zone: "americas" },
  { code: "HT", name: "Haiti", zone: "americas" },
  { code: "HN", name: "Honduras", zone: "americas" },
  { code: "HK", name: "Hong Kong", zone: "asia" },
  { code: "HU", name: "Hungary", zone: "europe" },
  { code: "IS", name: "Iceland", zone: "europe" },
  { code: "IN", name: "India", zone: "asia" },
  { code: "ID", name: "Indonesia", zone: "asia" },
  { code: "IR", name: "Iran", zone: "asia" },
  { code: "IQ", name: "Iraq", zone: "asia" },
  { code: "IE", name: "Ireland", zone: "europe" },
  { code: "IL", name: "Israel", zone: "asia" },
  { code: "IT", name: "Italy", zone: "europe" },
  { code: "JM", name: "Jamaica", zone: "americas" },
  { code: "JP", name: "Japan", zone: "asia" },
  { code: "JO", name: "Jordan", zone: "asia" },
  { code: "KZ", name: "Kazakhstan", zone: "asia" },
  { code: "KE", name: "Kenya", zone: "africa" },
  { code: "KI", name: "Kiribati", zone: "oceania" },
  { code: "KW", name: "Kuwait", zone: "asia" },
  { code: "KG", name: "Kyrgyzstan", zone: "asia" },
  { code: "LA", name: "Laos", zone: "asia" },
  { code: "LV", name: "Latvia", zone: "europe" },
  { code: "LB", name: "Lebanon", zone: "asia" },
  { code: "LS", name: "Lesotho", zone: "africa" },
  { code: "LR", name: "Liberia", zone: "africa" },
  { code: "LY", name: "Libya", zone: "africa" },
  { code: "LI", name: "Liechtenstein", zone: "europe" },
  { code: "LT", name: "Lithuania", zone: "europe" },
  { code: "LU", name: "Luxembourg", zone: "europe" },
  { code: "MO", name: "Macao", zone: "asia" },
  { code: "MG", name: "Madagascar", zone: "africa" },
  { code: "MW", name: "Malawi", zone: "africa" },
  { code: "MY", name: "Malaysia", zone: "asia" },
  { code: "MV", name: "Maldives", zone: "asia" },
  { code: "ML", name: "Mali", zone: "africa" },
  { code: "MT", name: "Malta", zone: "europe" },
  { code: "MH", name: "Marshall Islands", zone: "oceania" },
  { code: "MQ", name: "Martinique", zone: "americas" },
  { code: "MR", name: "Mauritania", zone: "africa" },
  { code: "MU", name: "Mauritius", zone: "africa" },
  { code: "YT", name: "Mayotte", zone: "africa" },
  { code: "MX", name: "Mexico", zone: "americas" },
  { code: "FM", name: "Micronesia", zone: "oceania" },
  { code: "MD", name: "Moldova", zone: "europe" },
  { code: "MC", name: "Monaco", zone: "europe" },
  { code: "MN", name: "Mongolia", zone: "asia" },
  { code: "ME", name: "Montenegro", zone: "europe" },
  { code: "MS", name: "Montserrat", zone: "americas" },
  { code: "MA", name: "Morocco", zone: "africa" },
  { code: "MZ", name: "Mozambique", zone: "africa" },
  { code: "MM", name: "Myanmar", zone: "asia" },
  { code: "NA", name: "Namibia", zone: "africa" },
  { code: "NR", name: "Nauru", zone: "oceania" },
  { code: "NP", name: "Nepal", zone: "asia" },
  { code: "NL", name: "Netherlands", zone: "europe" },
  { code: "NC", name: "New Caledonia", zone: "oceania" },
  { code: "NZ", name: "New Zealand", zone: "oceania" },
  { code: "NI", name: "Nicaragua", zone: "americas" },
  { code: "NE", name: "Niger", zone: "africa" },
  { code: "NG", name: "Nigeria", zone: "africa" },
  { code: "NU", name: "Niue", zone: "oceania" },
  { code: "NF", name: "Norfolk Island", zone: "oceania" },
  { code: "KP", name: "North Korea", zone: "asia" },
  { code: "MK", name: "North Macedonia", zone: "europe" },
  { code: "MP", name: "Northern Mariana Islands", zone: "asia" },
  { code: "NO", name: "Norway", zone: "europe" },
  { code: "OM", name: "Oman", zone: "asia" },
  { code: "PK", name: "Pakistan", zone: "asia" },
  { code: "PW", name: "Palau", zone: "oceania" },
  { code: "PS", name: "Palestine", zone: "asia" },
  { code: "PA", name: "Panama", zone: "americas" },
  { code: "PG", name: "Papua New Guinea", zone: "oceania" },
  { code: "PY", name: "Paraguay", zone: "americas" },
  { code: "PE", name: "Peru", zone: "americas" },
  { code: "PH", name: "Philippines", zone: "asia" },
  { code: "PL", name: "Poland", zone: "europe" },
  { code: "PT", name: "Portugal", zone: "europe" },
  { code: "PR", name: "Puerto Rico", zone: "asia" },
  { code: "QA", name: "Qatar", zone: "asia" },
  { code: "RO", name: "Romania", zone: "europe" },
  { code: "RU", name: "Russia", zone: "europe" },
  { code: "RW", name: "Rwanda", zone: "africa" },
  { code: "RE", name: "Réunion", zone: "africa" },
  { code: "KN", name: "Saint Kitts and Nevis", zone: "americas" },
  { code: "LC", name: "Saint Lucia", zone: "americas" },
  { code: "PM", name: "Saint Pierre and Miquelon", zone: "americas" },
  { code: "VC", name: "Saint Vincent and the Grenadines", zone: "americas" },
  { code: "WS", name: "Samoa", zone: "oceania" },
  { code: "SM", name: "San Marino", zone: "europe" },
  { code: "SA", name: "Saudi Arabia", zone: "asia" },
  { code: "SN", name: "Senegal", zone: "africa" },
  { code: "RS", name: "Serbia", zone: "europe" },
  { code: "SC", name: "Seychelles", zone: "africa" },
  { code: "SL", name: "Sierra Leone", zone: "africa" },
  { code: "SG", name: "Singapore", zone: "asia" },
  { code: "SX", name: "Sint Maarten", zone: "asia" },
  { code: "SK", name: "Slovakia", zone: "europe" },
  { code: "SI", name: "Slovenia", zone: "europe" },
  { code: "SB", name: "Solomon Islands", zone: "oceania" },
  { code: "SO", name: "Somalia", zone: "africa" },
  { code: "ZA", name: "South Africa", zone: "africa" },
  { code: "KR", name: "South Korea", zone: "asia" },
  { code: "SS", name: "South Sudan", zone: "africa" },
  { code: "ES", name: "Spain", zone: "europe" },
  { code: "LK", name: "Sri Lanka", zone: "asia" },
  { code: "SD", name: "Sudan", zone: "africa" },
  { code: "SR", name: "Suriname", zone: "americas" },
  { code: "SE", name: "Sweden", zone: "europe" },
  { code: "CH", name: "Switzerland", zone: "europe" },
  { code: "SY", name: "Syria", zone: "asia" },
  { code: "ST", name: "São Tomé and Príncipe", zone: "africa" },
  { code: "TW", name: "Taiwan", zone: "asia" },
  { code: "TJ", name: "Tajikistan", zone: "asia" },
  { code: "TZ", name: "Tanzania", zone: "africa" },
  { code: "TH", name: "Thailand", zone: "asia" },
  { code: "TL", name: "Timor-Leste", zone: "asia" },
  { code: "TG", name: "Togo", zone: "africa" },
  { code: "TK", name: "Tokelau", zone: "oceania" },
  { code: "TO", name: "Tonga", zone: "oceania" },
  { code: "TT", name: "Trinidad and Tobago", zone: "americas" },
  { code: "TN", name: "Tunisia", zone: "africa" },
  { code: "TM", name: "Turkmenistan", zone: "asia" },
  { code: "TC", name: "Turks and Caicos Islands", zone: "americas" },
  { code: "TV", name: "Tuvalu", zone: "oceania" },
  { code: "TR", name: "Türkiye", zone: "asia" },
  { code: "VI", name: "U.S. Virgin Islands", zone: "asia" },
  { code: "UG", name: "Uganda", zone: "africa" },
  { code: "UA", name: "Ukraine", zone: "europe" },
  { code: "AE", name: "United Arab Emirates", zone: "asia" },
  { code: "GB", name: "United Kingdom", zone: "europe" },
  { code: "US", name: "United States", zone: "americas" },
  { code: "UM", name: "United States Minor Outlying Islands", zone: "oceania" },
  { code: "UY", name: "Uruguay", zone: "americas" },
  { code: "UZ", name: "Uzbekistan", zone: "asia" },
  { code: "VU", name: "Vanuatu", zone: "oceania" },
  { code: "VA", name: "Vatican City", zone: "europe" },
  { code: "VE", name: "Venezuela", zone: "americas" },
  { code: "VN", name: "Vietnam", zone: "asia" },
  { code: "WF", name: "Wallis and Futuna", zone: "oceania" },
  { code: "EH", name: "Western Sahara", zone: "africa" },
  { code: "YE", name: "Yemen", zone: "asia" },
  { code: "ZM", name: "Zambia", zone: "africa" },
  { code: "ZW", name: "Zimbabwe", zone: "africa" },
];

/**
 * Delivery is either free (the owner switches this on in the back-office, and
 * it is the normal case) or a single protected-packing rate for the destination zone.
 * There are no "standard"/"express" upsells any more — five zones, five prices.
 */
export type ShippingMethodId = "free" | "protected";

export type ShippingZoneInfo = {
  id: ShippingZone;
  label: string;
  /** Per order, in euro cents. */
  rateCents: number;
  /** Typical transit time, shown to the customer. */
  days: string;
};

export const ZONES: ShippingZoneInfo[] = [
  { id: "europe", label: "Europe", rateCents: 5_400, days: "3–6 business days" },
  { id: "americas", label: "Americas", rateCents: 4_800, days: "5–8 business days" },
  { id: "asia", label: "Asia & Middle East", rateCents: 6_000, days: "5–9 business days" },
  { id: "africa", label: "Africa", rateCents: 7_200, days: "4–8 business days" },
  { id: "oceania", label: "Oceania", rateCents: 8_500, days: "7–12 business days" },
];

/** Kept for older imports: the five-zone order used across the site. */
export const ZONE_ORDER: ShippingZone[] = ZONES.map((z) => z.id);

export const ZONE_LABELS: Record<ShippingZone, string> = ZONES.reduce(
  (acc, zone) => ({ ...acc, [zone.id]: zone.label }),
  {} as Record<ShippingZone, string>,
);

export function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

/** Public labels for the three delivery zones, used on the Shipping & Returns page. */
/** The order in which zones are presented to customers. */
/** Shipping rates in cents for a zone — the same numbers the checkout charges. */
export function getZone(zone: ShippingZone): ShippingZoneInfo {
  return ZONES.find((z) => z.id === zone) ?? ZONES[0];
}

/** The zone a country belongs to, or null when we do not ship there. */
export function zoneOf(countryCode: string): ShippingZone | null {
  return getCountry(countryCode)?.zone ?? null;
}

/** Country names served in a zone, for the delivery table. */
export function countriesInZone(zone: ShippingZone): string[] {
  return COUNTRIES.filter((c) => c.zone === zone).map((c) => c.name);
}

/** Returns shipping in cents, or null when the country / method is unknown. */
export function shippingMethodId(freeShipping: boolean): ShippingMethodId {
  return freeShipping ? "free" : "protected";
}

/**
 * The one and only shipping price for an order: free when the owner enabled
 * free shipping in the back-office, otherwise the rate of the destination zone.
 * destination belongs to. `null` means the country is not served.
 */
export function calculateShipping(countryCode: string, freeShipping: boolean): number | null {
  const zone = zoneOf(countryCode);
  if (!zone) return null;
  if (freeShipping) return 0;
  return getZone(zone).rateCents;
}

/** "Free shipping" or "Safe delivery · Europe", for the order page. */
export function shippingLabel(countryCode: string, method: string): string {
  if (method === "free") return "Free shipping";
  const zone = zoneOf(countryCode);
  return zone ? `Safe delivery · ${ZONE_LABELS[zone]}` : "Safe delivery";
}
