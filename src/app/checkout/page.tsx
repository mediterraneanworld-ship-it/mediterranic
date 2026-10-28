import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 lg:px-8">
      <header className="mb-14 border-b border-ink/10 pb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Secure checkout</p>
        <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">Complete your acquisition</h1>
      </header>
      <CheckoutForm />
    </div>
  );
}
