import { unsubscribeByToken } from "@/lib/newsletter-send";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058): mail clients POST here when the reader
 * taps "Unsubscribe" in the mail app. The token in the List-Unsubscribe URL
 * is the only credential needed.
 */
export async function POST(request: Request) {
  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    const url = new URL(request.url);
    token = url.searchParams.get("token") ?? "";
  }
  const done = await unsubscribeByToken(token);
  return Response.json({ ok: done }, { status: done ? 200 : 404 });
}
