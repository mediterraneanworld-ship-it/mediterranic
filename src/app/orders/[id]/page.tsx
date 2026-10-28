import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Mail, Truck } from "lucide-react";
import { getOrderWithItems } from "@/lib/catalog";
import { getCountry, SHIPPING_METHODS } from "@/lib/shipping";
import { formatDate, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const data = await getOrderWithItems(id);
  if (!data) notFound();

  const { order, items } = data;
  const method = SHIPPING_METHODS.find((m) => m.id === order.shippingMethod);
  const countryName = getCountry(order.country)?.name ?? order.country;
  const reference = `MED-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-16 lg:px-8">
      <div className="animate-fade-up text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sea text-parchment">
          <Check size={28} strokeWidth={1.6} />
        </div>
        <p className="mt-8 text-[11px] uppercase tracking-[0.32em] text-brass">Order confirmed · {reference}</p>
        <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">
          Thank you, {order.firstName}.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink/70">
          Your specimens are being packed by hand and insured for transit. Your certificate of authenticity and a
          tracking number will follow to <span className="text-ink">{order.email}</span>.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <section className="rounded-sm border border-ink/10 bg-white/60 p-6 md:p-8">
          <h2 className="font-display text-3xl">Your specimens</h2>
          <ul className="mt-6 divide-y divide-ink/10">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-5">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-bone">
                  <Image
                    src={`/images/products/${item.productSlug}.jpg`}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/${item.productSlug}`} className="font-display text-xl leading-tight hover:text-sea">
                    {item.productName}
                  </Link>
                  <p className="mt-1 text-xs text-ink/55">
                    {item.quantity} × {formatPrice(item.unitPriceCents)}
                  </p>
                </div>
                <p className="text-sm font-medium">{formatPrice(item.unitPriceCents * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-3 border-t border-ink/10 pt-5 text-sm">
            <div className="flex justify-between text-ink/70">
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between text-ink/70">
              <dt>Shipping</dt>
              <dd>{order.shippingCents === 0 ? "Complimentary" : formatPrice(order.shippingCents)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink/10 pt-4">
              <dt className="text-ink">Total paid</dt>
              <dd className="font-display text-4xl">{formatPrice(order.totalCents)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-sm border border-ink/10 bg-white/60 p-6 md:p-8">
            <div className="flex items-center gap-3 text-sea">
              <Truck size={18} strokeWidth={1.5} />
              <h2 className="font-display text-2xl text-ink">Delivery</h2>
            </div>
            <p className="mt-4 text-sm font-medium">{method?.label ?? "Insured delivery"}</p>
            <p className="text-sm text-ink/60">{method?.detail}</p>
            <address className="mt-5 text-sm not-italic leading-relaxed text-ink/75">
              {order.firstName} {order.lastName}
              <br />
              {order.addressLine1}
              {order.addressLine2 && (
                <>
                  <br />
                  {order.addressLine2}
                </>
              )}
              <br />
              {order.city}, {order.postalCode}
              <br />
              {countryName}
            </address>
          </section>

          <section className="rounded-sm bg-midnight p-6 text-parchment md:p-8">
            <div className="flex items-center gap-3 text-brass">
              <Mail size={18} strokeWidth={1.5} />
              <p className="text-[11px] uppercase tracking-[0.25em]">What happens next</p>
            </div>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed text-parchment/75">
              <li>1. Specialists verify each specimen and prepare its documentation.</li>
              <li>2. Your piece is packed in archival materials and insured.</li>
              <li>3. A tracking link arrives by email on dispatch.</li>
            </ol>
          </section>

          <Link
            href="/shop"
            className="flex h-14 w-full items-center justify-center rounded-full border border-ink/20 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:border-ink"
          >
            Continue collecting
          </Link>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-ink/50">Placed on {formatDate(order.createdAt)}.</p>
    </div>
  );
}
