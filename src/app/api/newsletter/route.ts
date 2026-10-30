import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { addNewsletterSubscriber, getNewsletterSubscribers } from "@/lib/catalog";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Best-effort throttle. On a serverless platform each instance keeps its own
 * counter, which is enough to stop a hand-written spam loop without needing an
 * external service. Nothing is stored in the database for this.
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Public sign-up from the footer / shipping page form. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  if (throttled(ip)) {
    return Response.json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const raw = (body as { email?: unknown }).email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const source =
    typeof (body as { source?: unknown }).source === "string"
      ? ((body as { source: string }).source.trim().slice(0, 40) || "footer")
      : "footer";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const { added } = await addNewsletterSubscriber(email, source);
    return Response.json({
      ok: true,
      added,
      message: added
        ? "You are on the list. New specimens and field notes, about once a month."
        : "That address is already on the list — thank you.",
    });
  } catch (error) {
    console.error("newsletter subscribe failed", error);
    return Response.json({ error: "Could not sign you up right now. Please try again." }, { status: 500 });
  }
}

/**
 * Back-office read. `?format=csv` downloads a spreadsheet-ready file, otherwise
 * the raw list is returned as JSON.
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rows = await getNewsletterSubscribers(5000);
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "csv") {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      "email,source,subscribed_at",
      ...rows.map((r) =>
        [escape(r.email), escape(r.source), escape(new Date(r.createdAt).toISOString())].join(","),
      ),
    ];
    return new Response("\uFEFF" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mediterranic-newsletter-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  return Response.json({ count: rows.length, subscribers: rows });
}

/** Back-office removal of a single address (requested unsubscribes). */
export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Missing email." }, { status: 400 });

  const removed = await db
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .returning({ id: newsletterSubscribers.id });

  return Response.json({ ok: true, removed: removed.length });
}
