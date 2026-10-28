import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const password = (body.password ?? "").trim();
  if (password !== getAdminPassword()) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, getAdminPassword(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE_NAME);
  return Response.json({ ok: true });
}
