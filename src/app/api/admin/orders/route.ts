import { isAdminAuthenticated } from "@/lib/admin-auth";
import { applyOrderAction, OrderError, type OrderAction } from "@/lib/order-service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: OrderAction[] = ["confirm", "ship", "complete", "cancel", "tracking"];

/**
 * Back-office order handling: confirm an invoice payment, mark shipped (with
 * tracking), complete, or cancel (paid orders return their specimens to
 * stock). Every change is transactional in `applyOrderAction`.
 */
export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const action = typeof body.action === "string" ? (body.action.trim() as OrderAction) : ("" as OrderAction);
  if (!UUID.test(orderId) || !ACTIONS.includes(action)) {
    return Response.json({ error: "Invalid order or action." }, { status: 400 });
  }

  try {
    const order = await applyOrderAction(orderId, action, {
      carrier: typeof body.trackingCarrier === "string" ? body.trackingCarrier : null,
      number: typeof body.trackingNumber === "string" ? body.trackingNumber : null,
    });
    return Response.json({ ok: true, order });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin order action failed", error);
    return Response.json({ error: "Could not update the order. Nothing was changed." }, { status: 500 });
  }
}
