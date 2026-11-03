import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const CONFIRMATION = "DELETE_CANCELLED_ORDERS";
const BATCH_SIZE = 500;

/** Returns the exact number of cancelled records eligible for cleanup. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [{ value }] = await db.select({ value: count() }).from(orders).where(eq(orders.status, "cancelled"));
  return Response.json({ cancelledCount: Number(value) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Permanently deletes ONLY cancelled orders and their associated order items. */
export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { confirmation?: unknown; expectedCount?: unknown } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return Response.json({ error: "Explicit confirmation is required." }, { status: 400 });
  }
  const expectedCount = Number(body.expectedCount);
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    return Response.json({ error: "Invalid cancelled-order count. Refresh and try again." }, { status: 400 });
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      // Lock only cancelled records. A concurrent state change will be checked
      // again in the DELETE predicate, so non-cancelled orders cannot be erased.
      const candidates = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.status, "cancelled"))
        .for("update");
      const ids = candidates.map((order) => order.id);
      if (ids.length !== expectedCount) {
        return { deletedCount: 0, currentCount: ids.length, countChanged: true };
      }
      if (!ids.length) return { deletedCount: 0, currentCount: 0, countChanged: false };

      for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
        const batch = ids.slice(offset, offset + BATCH_SIZE);
        await tx.delete(orderItems).where(inArray(orderItems.orderId, batch));
      }

      const deleted = await tx
        .delete(orders)
        .where(and(eq(orders.status, "cancelled"), inArray(orders.id, ids)))
        .returning({ id: orders.id });
      return { deletedCount: deleted.length, currentCount: ids.length, countChanged: false };
    });

    if (outcome.countChanged) {
      return Response.json({
        error: `The number of cancelled orders changed from ${expectedCount} to ${outcome.currentCount}. Refresh the list and confirm again. No orders were deleted.`,
        cancelledCount: outcome.currentCount,
      }, { status: 409 });
    }
    return Response.json({ ok: true, deletedCount: outcome.deletedCount });
  } catch (error) {
    console.error("Cancelled order cleanup failed", error);
    return Response.json({ error: "Could not delete cancelled orders. Nothing was changed." }, { status: 500 });
  }
}
