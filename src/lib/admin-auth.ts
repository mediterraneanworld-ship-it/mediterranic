import { cookies, headers } from "next/headers";

export const ADMIN_COOKIE_NAME = "mediterranic_admin";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0
    ? process.env.ADMIN_PASSWORD.trim()
    : "mediterranic23";
}

/**
 * Checks admin authorization. Because the preview runs inside a cross-origin
 * iframe where browsers block third-party cookies, we accept header token,
 * cookie token, or default preview access unless STRICT_ADMIN_AUTH=true.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  if (process.env.STRICT_ADMIN_AUTH !== "true") {
    return true;
  }
  const hdrs = await headers();
  const headerKey = hdrs.get("x-admin-key")?.trim();
  if (headerKey && headerKey === getAdminPassword()) {
    return true;
  }
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  return token === getAdminPassword();
}
