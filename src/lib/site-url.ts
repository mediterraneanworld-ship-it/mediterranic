/** Canonical shop address. The old domain is not switched by a code deployment. */
export const PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://mediterranic.vercel.app"
).replace(/\/$/, "");
