import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { calculateShipping, getCountry, shippingMethodId } from "@/lib/shipping";
import { getSiteContent } from "@/lib/catalog";

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type OrderInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  country: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  shippingMethod: string;
  items: { slug: string; quantity: number }[];
};

export function parseOrderInput(body: Record<string, unknown>): OrderInput {
  const email = text(body.email, 200).toLowerCase();
  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 80);
  const phone = text(body.phone, 40) || null;
  const country = text(body.country, 2).toUpperCase();
  const addressLine1 = text(body.addressLine1, 160);
  const addressLine2 = text(body.addressLine2, 160) || null;
  const city = text(body.city, 80);
  const postalCode = text(body.postalCode, 20);
  // The delivery option is decided by the shop, not by the browser.
  const method = text(body.shippingMethod, 20) || "free";

  if (!EMAIL.test(email)) throw new OrderError("Please enter a valid email address.", 400);
  if (!firstName || !lastName) throw new OrderError("Please enter your full name.", 400);
  if (!getCountry(country)) throw new OrderError("We do not ship to that country yet.", 400);
  if (addressLine1.length < 4) throw new OrderError("Please enter your street address.", 400);
  if (!city) throw new OrderError("Please enter your city.", 400);
  if (postalCode.length < 3) throw new OrderError("Please enter your postal code.", 400);

  const rawItems = Array.isArray(body.items) ? (body.items as { slug?: unknown; quantity?: unknown }[]) : [];
  const items = rawItems.map((i) => ({ slug: text(i.slug, 120), quantity: Number(i.quantity) }));
  if (items.length === 0 || items.length > 25) throw new OrderError("Your cart is empty.", 400);
  const slugs = items.map((i) => i.slug);
  if (new Set(slugs).size !== slugs.length) throw new OrderError("Duplicate items in cart.", 400);
  if (items.some((i) => !i.slug || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10)) {
    throw new OrderError("Invalid quantities in cart.", 400);
  }

  return {
    email,
    firstName,
    lastName,
    phone,
    country,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    shippingMethod: method,
    items,
  };
}

export type BuiltOrder = {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** "free" or "protected", decided by the back-office setting. */
  shippingMethod: string;
  lines: {
    productId: number;
    productName: string;
    productSlug: string;
    unitPriceCents: number;
    quantity: number;
  }[];
};

/**
 * Validates the cart against the database and prices everything server-side.
 * Never trusts prices sent by the browser. Checks stock but does NOT decrement
 * it — that happens in `confirmOrder` once payment is certain.
 */
export async function buildOrder(input: OrderInput): Promise<BuiltOrder> {
  await ensureSeeded();
  const slugs = input.items.map((i) => i.slug);
  const rows = await db.select().from(products).where(inArray(products.slug, slugs));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  let subtotal = 0;
  const lines = input.items.map((item) => {
    const product = bySlug.get(item.slug);
    if (!product) throw new OrderError("One of the specimens in your cart is no longer available.", 409);
    if (!product.published || product.listingChannel !== "direct" || product.archived || product.priceCents <= 0) {
      throw new OrderError(`${product.name} is not available for direct purchase right now.`, 409);
    }
    if (product.stock < item.quantity) {
      throw new OrderError(
        product.stock <= 0
          ? `${product.name} has just sold out. Please remove it to continue.`
          : `Only ${product.stock} of ${product.name} remain. Please update your cart.`,
        409,
      );
    }
    subtotal += product.priceCents * item.quantity;
    return {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
    };
  });

  const { commerce } = await getSiteContent();
  const shipping = calculateShipping(input.country, commerce.freeShipping);
  if (shipping === null) throw new OrderError("We could not calculate shipping for that address.", 400);

  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    totalCents: subtotal + shipping,
    shippingMethod: shippingMethodId(commerce.freeShipping),
    lines,
  };
}

/** Inserts the order + items with the given status. Returns the order id. */
export async function insertOrder(
  input: OrderInput,
  built: BuiltOrder,
  extra: { status: string; paymentMethod: string; paypalOrderId?: string | null },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [order] = await tx
    .insert(orders)
    .values({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      country: input.country,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      postalCode: input.postalCode,
      shippingMethod: built.shippingMethod,
      subtotalCents: built.subtotalCents,
      shippingCents: built.shippingCents,
      totalCents: built.totalCents,
      status: extra.status,
      paymentMethod: extra.paymentMethod,
      paypalOrderId: extra.paypalOrderId ?? null,
    })
    .returning({ id: orders.id });

    await tx.insert(orderItems).values(built.lines.map((line) => ({ ...line, orderId: order.id })));
    return order.id;
  });
}

/**
 * Confirms a pending order: decrements stock atomically and flips the status.
 * Used after a successful PayPal capture.
 */
type OrderTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function confirmOrder(orderId: string, transaction?: OrderTransaction): Promise<void> {
  const confirm = async (tx: OrderTransaction) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order) throw new OrderError("Order not found.", 404);
    if (order.status === "confirmed") return;
    if (order.status !== "pending_payment" && order.status !== "payment_pending" && order.status !== "payment_review" && order.status !== "pending_invoice") {
      throw new OrderError("This order is no longer awaiting payment.", 409);
    }
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const line of [...items].sort((a, b) => a.productId - b.productId)) {
      const [updated] = await tx.update(products)
        .set({ stock: sql`${products.stock} - ${line.quantity}` })
        .where(and(eq(products.id, line.productId), eq(products.listingChannel, "direct"), eq(products.published, true), eq(products.archived, false), gte(products.stock, line.quantity)))
        .returning({ id: products.id, stock: products.stock });
      if (!updated) throw new OrderError(`${line.productName} is no longer available. Please contact us before paying again.`, 409);
      if (updated.stock === 0) {
        await tx.update(products).set({ archived: true, listingChannel: null }).where(eq(products.id, updated.id));
      }
    }
    await tx.update(orders).set({ status: "confirmed" }).where(eq(orders.id, orderId));
  };
  if (transaction) return confirm(transaction);
  return db.transaction(confirm);
}

export async function markOrderStatus(
  orderId: string,
  status: string,
  paypalOrderId?: string | null,
): Promise<void> {
  await db
    .update(orders)
    .set({ status, ...(paypalOrderId !== undefined ? { paypalOrderId } : {}) })
    .where(eq(orders.id, orderId));
}

/* ------------------------------------------------------------------ */
/* Back-office order handling                                          */
/* ------------------------------------------------------------------ */

export type OrderAction = "confirm" | "ship" | "complete" | "cancel" | "tracking";

export type OrderTransitionPlan =
  | { ok: true; to: string; restoreStock: boolean }
  | { ok: false; error: string };

/**
 * Which back-office actions make sense from each order status. Stock is only
 * ever taken by `confirmOrder` (at payment), so cancelling an unpaid order
 * touches no stock, while cancelling a paid/shipped one must give it back.
 * Pure — the admin UI and the tests share these exact rules.
 */
export function planOrderTransition(status: string, action: OrderAction): OrderTransitionPlan {
  switch (action) {
    case "confirm":
      return status === "pending_invoice" || status === "payment_review"
        ? { ok: true, to: "confirmed", restoreStock: false }
        : { ok: false, error: `Only an invoice order or an order under review can be confirmed manually (current status: ${status}).` };
    case "ship":
      return status === "confirmed"
        ? { ok: true, to: "shipped", restoreStock: false }
        : { ok: false, error: `Only a paid, confirmed order can be marked as shipped (current status: ${status}).` };
    case "complete":
      return status === "shipped" || status === "confirmed"
        ? { ok: true, to: "completed", restoreStock: false }
        : { ok: false, error: `Only a shipped order can be marked as completed (current status: ${status}).` };
    case "cancel":
      if (status === "pending_payment" || status === "payment_pending" || status === "pending_invoice" || status === "payment_review") {
        return { ok: true, to: "cancelled", restoreStock: false };
      }
      if (status === "confirmed" || status === "shipped") {
        return { ok: true, to: "cancelled", restoreStock: true };
      }
      return { ok: false, error: `This order can no longer be cancelled (current status: ${status}).` };
    case "tracking":
      return status === "shipped" || status === "completed"
        ? { ok: true, to: status, restoreStock: false }
        : { ok: false, error: "Tracking can only be recorded once the order has shipped." };
  }
}

/**
 * Applies one back-office action to an order, transactionally. "confirm"
 * reuses the guarded stock decrement (it fails, changing nothing, if a
 * specimen was meanwhile sold through another channel). Cancelling a paid
 * order returns its specimens to stock; a piece that sold out and was
 * auto-archived by the sale returns to Site Only, exactly as it was.
 * Refunds are NOT issued here — PayPal refunds happen in PayPal.
 */
export async function applyOrderAction(
  orderId: string,
  action: OrderAction,
  tracking: { carrier?: string | null; number?: string | null } = {},
): Promise<typeof orders.$inferSelect> {
  const carrier = tracking.carrier?.trim().slice(0, 80) || null;
  const number = tracking.number?.trim().slice(0, 120) || null;

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order) throw new OrderError("Order not found.", 404);
    const plan = planOrderTransition(order.status, action);
    if (!plan.ok) throw new OrderError(plan.error, 409);

    if (action === "confirm") {
      await confirmOrder(orderId, tx);
    } else {
      if (plan.restoreStock) {
        const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        for (const line of [...lines].sort((a, b) => a.productId - b.productId)) {
          const [p] = await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${line.quantity}` })
            .where(eq(products.id, line.productId))
            .returning({ id: products.id, stock: products.stock, archived: products.archived, listingChannel: products.listingChannel });
          if (p && p.archived && p.listingChannel === null && p.stock > 0) {
            await tx.update(products).set({ archived: false, listingChannel: "direct" }).where(eq(products.id, p.id));
          }
        }
      }
      const patch: { status: string; shippedAt?: Date; trackingCarrier?: string | null; trackingNumber?: string | null } = { status: plan.to };
      if (action === "ship") {
        patch.shippedAt = new Date();
        patch.trackingCarrier = carrier;
        patch.trackingNumber = number;
      }
      if (action === "tracking") {
        patch.trackingCarrier = carrier;
        patch.trackingNumber = number;
      }
      await tx.update(orders).set(patch).where(eq(orders.id, orderId));
    }

    const [updated] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return updated;
  });
}
