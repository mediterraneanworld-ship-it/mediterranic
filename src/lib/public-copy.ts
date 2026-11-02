/** Display-only corrections. Never rewrites the owner's stored Neon text. */
export function safeShippingText(text: string): string {
  return text
    .replace(/with the insurance reference attached/gi, "with the delivery reference attached")
    .replace(/It invalidates the insurance and holds the parcel at the border\./gi, "It can cause customs problems and delay delivery.")
    .replace(/insurers ask for them/gi, "they help us assess the damage")
    .replace(/full transit insurance and tracking/gi, "protective packing and tracking")
    .replace(/It is rare, and it is insured\./gi, "It is rare, and we handle it directly.")
    .replace(/fully insured and tracked/gi, "carefully packed and tracked")
    .replace(/insured worldwide shipping/gi, "safe worldwide shipping")
    .replace(/insured worldwide delivery/gi, "safe worldwide delivery")
    .replace(/insured delivery/gi, "safe delivery")
    .replace(/delivered fully insured with/gi, "delivered with")
    .replace(/delivered insured/gi, "delivered with care")
    .replace(/fully insured/gi, "carefully packed")
    .replace(/\binsured\b/gi, "safely packed");
}

export function safeContent<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    if (/script|url|image|favicon|cover|logo/i.test(key)) return value;
    return safeShippingText(value) as T;
  }
  if (Array.isArray(value)) return value.map((item) => safeContent(item, key)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, safeContent(item, name)])) as T;
  return value;
}
