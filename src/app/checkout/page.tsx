import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout-form";
import { getSiteContent } from "@/lib/catalog";
import { getShippingTable, getWeightsBySlug } from "@/lib/shipping-table";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [content, shippingTable, weightsBySlug] = await Promise.all([
    getSiteContent(),
    getShippingTable(),
    getWeightsBySlug(),
  ]);
  const freeShipping = content.commerce.freeShipping;
  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 lg:px-8">
      <header className="mb-14 border-b border-ink/10 pb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{content.checkout.eyebrow}</p>
        <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">{content.checkout.title}</h1>
      </header>
      <Suspense fallback={<div className="skeleton h-[60vh] rounded-sm" />}>
        <CheckoutForm freeShipping={freeShipping} shippingTable={shippingTable} weightsBySlug={weightsBySlug} />
      </Suspense>
    </div>
  );
}
