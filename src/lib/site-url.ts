/**
 * Canonical shop address — hardcoded on purpose.
 *
 * The Vercel project once carried NEXT_PUBLIC_SITE_URL=https://shop.mediterranic.com,
 * a domain that does not exist and never will, which silently pointed every
 * absolute link (e-mails, sitemap, metadata) at a dead address. The shop
 * lives on mediterranic.vercel.app until the project moves to
 * mediterranic.com at the very end — change this one line then.
 */
export const PUBLIC_SITE_URL = "https://mediterranic.vercel.app";
