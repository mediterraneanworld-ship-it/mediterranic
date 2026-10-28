"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { selectItemCount, selectSubtotal, useCart, useHydrated } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import {
  calculateShipping,
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_METHODS,
  type ShippingMethodId,
} from "@/lib/shipping";

const field =
  "w-full rounded-sm border border-ink/15 bg-white/70 px-4 py-3.5 text-[15px] outline-none transition placeholder:text-ink/35 focus:border-sea focus:ring-2 focus:ring-sea/15";

const label = "text-[11px] uppercase tracking-[0.22em] text-ink/60";

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-6 border-t border-ink/10 pt-10">
      <header className="flex items-baseline gap-4">
        <span className="font-display text-2xl text-brass">{number}</span>
        <h2 className="font-display text-3xl text-ink">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [method, setMethod] = useState<ShippingMethodId>("standard");
  const [country, setCountry] = useState("US");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  if (!hydrated) {
    return (
      <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="skeleton h-[60vh] rounded-sm" />
        <div className="skeleton h-96 rounded-sm" />
      </div>
    );
  }

  if (items.length === 0 && orderPlaced) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-4xl text-ink">Confirming your order…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <p className="font-display text-5xl text-ink">Your cabinet is empty</p>
        <p className="mx-auto mt-5 max-w-md text-ink/65">
          Choose a specimen first. Everything in your selection will be waiting here.
        </p>
        <Link
          href="/shop"
          className="mt-10 inline-flex h-14 items-center rounded-full bg-ink px-9 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta"
        >
          Browse the collection
        </Link>
      </div>
    );
  }

  const subtotal = selectSubtotal(items);
  const count = selectItemCount(items);
  const shipping = calculateShipping(country, method, subtotal) ?? 0;
  const total = subtotal + shipping;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotal);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          phone: data.get("phone"),
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          country,
          addressLine1: data.get("addressLine1"),
          addressLine2: data.get("addressLine2"),
          city: data.get("city"),
          postalCode: data.get("postalCode"),
          shippingMethod: method,
          items: items.map((i) => ({ slug: i.slug, quantity: i.quantity })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string };

      if (!response.ok || !payload.id) {
        setError(payload.error ?? "We could not place your order. Please try again.");
        setSubmitting(false);
        return;
      }

      setOrderPlaced(true);
      clear();
      router.push(`/orders/${payload.id}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[1fr_400px]">
      <form onSubmit={onSubmit} className="space-y-12" noValidate={false}>
        <Section number="01" title="Contact">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className={label}>Email for your certificate</span>
              <input name="email" type="email" required autoComplete="email" className={field} placeholder="you@example.com" />
            </label>
            <label className="space-y-2">
              <span className={label}>Phone (for the courier)</span>
              <input name="phone" type="tel" autoComplete="tel" className={field} placeholder="Optional" />
            </label>
          </div>
        </Section>

        <Section number="02" title="Delivery address">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2">
              <span className={label}>First name</span>
              <input name="firstName" required autoComplete="given-name" className={field} />
            </label>
            <label className="space-y-2">
              <span className={label}>Last name</span>
              <input name="lastName" required autoComplete="family-name" className={field} />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className={label}>Country</span>
              <select
                name="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                autoComplete="country"
                className={`${field} cursor-pointer appearance-none`}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className={label}>Street address</span>
              <input name="addressLine1" required autoComplete="address-line1" className={field} />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className={label}>Apartment, suite, etc.</span>
              <input name="addressLine2" autoComplete="address-line2" className={field} placeholder="Optional" />
            </label>
            <label className="space-y-2">
              <span className={label}>City</span>
              <input name="city" required autoComplete="address-level2" className={field} />
            </label>
            <label className="space-y-2">
              <span className={label}>Postal code</span>
              <input name="postalCode" required autoComplete="postal-code" className={field} />
            </label>
          </div>
        </Section>

        <Section number="03" title="Delivery method">
          <div className="grid gap-4 md:grid-cols-2">
            {SHIPPING_METHODS.map((m) => {
              const cost = calculateShipping(country, m.id, subtotal) ?? 0;
              const selected = method === m.id;
              return (
                <label
                  key={m.id}
                  className={`relative flex cursor-pointer flex-col gap-3 rounded-sm border p-6 transition ${
                    selected ? "border-ink bg-white shadow-[0_12px_30px_rgba(11,32,48,0.08)]" : "border-ink/15 hover:border-ink/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="shippingMethod"
                    value={m.id}
                    checked={selected}
                    onChange={() => setMethod(m.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <span className="font-medium text-ink">{m.label}</span>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full border ${
                        selected ? "border-ink bg-ink text-parchment" : "border-ink/30"
                      }`}
                    >
                      {selected && <Check size={12} />}
                    </span>
                  </span>
                  <span className="text-sm text-ink/60">{m.detail}</span>
                  <span className="font-display text-2xl text-ink">
                    {cost === 0 ? "Complimentary" : formatPrice(cost)}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-ink/55">
            Every shipment is fully insured. Duties and local taxes are confirmed by the carrier before dispatch.
          </p>
        </Section>

        <Section number="04" title="Payment">
          <div className="space-y-5 rounded-sm bg-bone/70 p-6 md:p-8">
            <div className="flex flex-col items-center gap-4 rounded-sm bg-white p-6 text-center">
              <p className="text-[11px] uppercase tracking-[0.24em] text-ink/55">You will be redirected to PayPal</p>
              <p className="font-display text-3xl text-ink">Pay with PayPal</p>
              <p className="max-w-sm text-sm leading-relaxed text-ink/65">
                PayPal accepts every major debit and credit card, your bank account and your PayPal balance — no
                account required to pay by card.
              </p>
              <p className="text-xs text-ink/50">
                Card · Visa · Mastercard · Amex · Discover · Bank transfer · PayPal balance
              </p>
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink/60">
              <Lock size={13} strokeWidth={1.6} className="mt-0.5 shrink-0" />
              Demo checkout: PayPal is not yet connected to a live account, so no money is taken and no card is
              charged. Enquiries and invoices are still sent to you by email.
            </p>
          </div>
        </Section>

        {error && (
          <p role="alert" className="rounded-sm border border-terracotta/30 bg-terracotta/5 px-5 py-4 text-sm text-terracotta">
            {error}
          </p>
        )}

        <div className="space-y-4 border-t border-ink/10 pt-10">
          <button
            type="submit"
            disabled={submitting}
            className="group inline-flex h-16 w-full items-center justify-center gap-3 rounded-full bg-ink text-[13px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? "Redirecting to PayPal…" : `Continue to PayPal · ${formatPrice(total)}`}
            {!submitting && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
          </button>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-ink/55">
            <ShieldCheck size={14} strokeWidth={1.5} />
            Stock is reserved as you order. Returns accepted within 30 days.
          </p>
        </div>
      </form>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-sm border border-ink/10 bg-white/60 p-6 md:p-8">
          <div className="flex items-baseline justify-between border-b border-ink/10 pb-5">
            <h2 className="font-display text-3xl">Your selection</h2>
            <span className="text-sm text-ink/50">{count} {count === 1 ? "item" : "items"}</span>
          </div>

          <ul className="divide-y divide-ink/10">
            {items.map((item) => (
              <li key={item.slug} className="flex gap-4 py-5">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-bone">
                  <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl leading-tight text-ink">{item.name}</p>
                    <p className="mt-1 text-xs text-ink/55">Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium">{formatPrice(item.priceCents * item.quantity)}</p>
                </div>
              </li>
            ))}
          </ul>

          <dl className="space-y-3 border-t border-ink/10 pt-5 text-sm">
            <div className="flex justify-between text-ink/70">
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-ink/70">
              <dt>Shipping</dt>
              <dd>{shipping === 0 ? "Complimentary" : formatPrice(shipping)}</dd>
            </div>
            {remaining > 0 && method === "standard" && (
              <p className="text-xs text-sea">
                Add {formatPrice(remaining)} to unlock complimentary standard shipping.
              </p>
            )}
            <div className="flex items-baseline justify-between border-t border-ink/10 pt-4">
              <dt className="text-ink">Total (EUR)</dt>
              <dd className="font-display text-4xl text-ink">{formatPrice(total)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-5 text-center text-xs text-ink/55">
          Need to change something?{" "}
          <Link href="/shop" className="underline underline-offset-4 hover:text-ink">
            Return to the collection
          </Link>
        </p>
      </aside>
    </div>
  );
}
