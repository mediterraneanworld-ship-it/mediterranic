import { db } from "@/db";
import { products } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Full catalogue export, including drafts, so the state can be captured to the repo. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await db.select().from(products).orderBy(asc(products.id));
  return Response.json({ products: rows });
}
