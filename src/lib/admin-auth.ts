import { cookies, headers } from "next/headers";

export const ADMIN_COOKIE_NAME = "mediterranic_admin";

/** Local development preview only. Never bypass authentication on Vercel. */
export function isAdminPreview(): boolean {
  return !process.env.VERCEL && process.env.STRICT_ADMIN_AUTH !== "true";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || (isAdminPreview() ? "mediterranic23" : "");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (isAdminPreview()) return true;
  const password = getAdminPassword();
  if (!password) return false; // Misconfigured production must fail closed.
  const hdrs = await headers();
  const key = hdrs.get("x-admin-key")?.trim();
  if (key && key === password) return true;
  return (await cookies()).get(ADMIN_COOKIE_NAME)?.value === password;
}
