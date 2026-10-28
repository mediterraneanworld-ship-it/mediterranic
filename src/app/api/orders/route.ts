import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { calculateShipping, getCountry, type ShippingMethodId } from "@/lib/shipping";

export const dynamic = "force-dynamic";

class OrderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const METHODS: ShippingMethodId[] = ["standard", "express"];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = text(body.email, 200).toLowerCase();
  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 80);
  const phone = text(body.phone, 40) || null;
  const country = text(body.country, 2).toUpperCase();
  const addressLine1 = text(body.addressLine1, 160);
  const addressLine2 = text(body.addressLine2, 160) || null;
  const city = text(body.city, 80);
  const postalCode = text(body.postalCode, 20);
  const method = text(body.shippingMethod, 20) as ShippingMethodId;

  if (!EMAIL.test(email)) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!firstName || !lastName) return Response.json({ error: "Please enter your full name." }, { status: 400 });
  if (!getCountry(country)) return Response.json({ error: "We do not ship to that country yet." }, { status: 400 });
  if (addressLine1.length < 4) return Response.json({ error: "Please enter your street address." }, { status: 400 });
  if (!city) return Response.json({ error: "Please enter your city." }, { status: 400 });
  if (postalCode.length < 3) return Response.json({ error: "Please enter your postal code." }, { status: 400 });
  if (!METHODS.includes(method)) return Response.json({ error: "Choose a delivery method." }, { status: 400 });

  const rawItems = Array.isArray(body.items) ? (body.items as { slug?: unknown; quantity?: unknown }[]) : [];
  const items = rawItems.map((i) => ({ slug: text(i.slug, 120), quantity: Number(i.quantity) }));
  if (items.length === 0 || items.length > 25) {
    return Response.json({ error: "Your cart is empty." }, { status: 400 });
  }
  const slugs = items.map((i) => i.slug);
  if (new Set(slugs).size !== slugs.length) {
    return Response.json({ error: "Duplicate items in cart." }, { status: 400 });
  }
  if (items.some((i) => !i.slug || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10)) {
    return Response.json({ error: "Invalid quantities in cart." }, { status: 400 });
  }

  try {
    await ensureSeeded();

    const result = await db.transaction(async (tx) => {
      const rows = await tx.select().from(products).where(inArray(products.slug, slugs));
      const bySlug = new Map(rows.map((r) => [r.slug, r]));

      let subtotal = 0;
      const lines = items.map((item) => {
        const product = bySlug.get(item.slug);
        if (!product) throw new OrderError("One of the specimens in your cart is no longer available.", 409);
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

      const shipping = calculateShipping(country, method, subtotal);
      if (shipping === null) throw new OrderError("We could not calculate shipping for that address.", 400);
      const total = subtotal + shipping;

      const [order] = await tx
        .insert(orders)
        .values({
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
          subtotalCents: subtotal,
          shippingCents: shipping,
          totalCents: total,
          status: "confirmed",
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));

      for (const line of lines) {
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${line.quantity}` })
          .where(and(eq(products.id, line.productId), gte(products.stock, line.quantity)))
          .returning({ id: products.id });
        if (updated.length === 0) {
          throw new OrderError(`${line.productName} has just sold out. Please update your cart.`, 409);
        }
      }

      return { id: order.id };
    });

    return Response.json({ id: result.id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Order placement failed", error);
    return Response.json({ error: "We could not place your order. Please try again." }, { status: 500 });
  }
}
