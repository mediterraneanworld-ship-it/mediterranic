import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/catalog";
import { ZONES, parseShippingRows, weightClassLabels } from "@/lib/shipping";
import {
  ShippingTableError,
  getMissingWeightPieces,
  getShippingTable,
  saveShippingTable,
} from "@/lib/shipping-table";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** The table as the back-office edits it, plus the live pieces that still lack a weight. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const [table, content, missingWeight] = await Promise.all([
    getShippingTable(),
    getSiteContent(),
    getMissingWeightPieces(),
  ]);
  const labels = weightClassLabels(table.classes);
  return Response.json(
    {
      classes: [...table.classes]
        .sort((a, b) => a.position - b.position)
        .map((cls) => ({ ...cls, label: labels[cls.id] })),
      rates: table.rates,
      regions: ZONES.map((zone) => ({ id: zone.id, label: zone.label, days: zone.days })),
      freeShipping: content.commerce.freeShipping,
      missingWeight,
    },
    { headers },
  );
}

/** Replaces the whole table after checking it. Nothing is saved if any rule fails. */
export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const parsed = parseShippingRows(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers });
  try {
    await saveShippingTable(parsed.rows);
  } catch (error) {
    if (error instanceof ShippingTableError) {
      return Response.json({ error: error.message }, { status: 409, headers });
    }
    throw error;
  }
  return Response.json({ ok: true }, { headers });
}
