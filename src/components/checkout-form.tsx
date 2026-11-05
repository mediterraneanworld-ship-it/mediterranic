"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { selectItemCount, selectSubtotal, useCart, useHydrated } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { basketWeightGrams, COUNTRIES, getZone, shippingMethodId, shippingQuote, type ShippingTable } from "@/lib/shipping";

/* 16px minimum: iOS Safari auto-zooms on smaller inputs, which breaks the
   checkout layout every time a field is tapped. */
const field =
  "w-full rounded-sm border border-ink/15 bg-white/70 px-4 py-3.5 text-base outline-none transition placeholder:text-ink/35 focus:border-sea focus:ring-2 focus:ring-sea/15";

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

export function CheckoutForm({
  freeShipping,
  shippingTable,
  weightsBySlug,
}: {
  freeShipping: boolean;
  shippingTable: ShippingTable;
  weightsBySlug: Record<string, number | null>;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [country, setCountry] = useState("US");
  const [submitting, setSubmitting] = useState(false);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [paypalNote, setPaypalNote] = useState<string | null>(null);
  /** The invoice option opens a small box for the buyer's note before confirming. */
  const [invoiceBoxOpen, setInvoiceBoxOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const paypalHandledRef = useRef(false);

  // Return from PayPal: capture the approved payment and finish the order once.
  useEffect(() => {
    const action = searchParams.get("paypal");
    const orderId = searchParams.get("order");
    const token = searchParams.get("token");
    if (!action || !orderId || paypalHandledRef.current) return;

    if (action === "return" && token) {
      paypalHandledRef.current = true;
      setPaypalBusy(true);
      (async () => {
        try {
          const res = await fetch("/api/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, paypalOrderId: token }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; orderId?: string; error?: string };
          if (res.ok && data.ok && data.orderId) {
            setOrderPlaced(true);
            clear();
            router.push(`/orders/${data.orderId}`);
          } else {
            setError(data.error ?? "The payment could not be confirmed. Check your PayPal activity before paying again.");
            setPaypalBusy(false);
          }
        } catch {
          setError("Network error while confirming the payment. Check your PayPal activity and contact us before paying again.");
          setPaypalBusy(false);
        }
      })();
    } else if (action === "cancel") {
      paypalHandledRef.current = true;
      fetch("/api/paypal/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      }).catch(() => {});
      setPaypalNote("Payment cancelled on PayPal — nothing was charged. Your cabinet is unchanged.");
    }
  }, [searchParams, clear, router]);

  if (!hydrated) {
    return (
      <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="skeleton h-[60vh] rounded-sm" />
        <div className="skeleton h-96 rounded-sm" />
      </div>
    );
  }

  if ((items.length === 0 && orderPlaced) || (searchParams.get("paypal") === "return" && paypalBusy)) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-4xl text-ink">Confirming your PayPal payment…</p>
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
  // One delivery option only: free (the normal case) or the rate of the
  // destination zone. No standard/express upsell any more.
  // The basket's total weight picks the weight class; the region comes from the country.
  const grams = basketWeightGrams(
    items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
    weightsBySlug,
  );
  const quote = shippingQuote(shippingTable, country, grams, freeShipping);
  const method = quote?.methodId ?? shippingMethodId(freeShipping);
  const zoneInfo = quote ? getZone(quote.zone) : null;
  const shipping = quote?.cents ?? 0;
  const total = subtotal + shipping;

  function collectPayload(data: FormData) {
    return {
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
      customerNote: String(data.get("customerNote") ?? ""),
      items: items.map((i) => ({ slug: i.slug, quantity: i.quantity })),
    };
  }

  /** Real PayPal: create the order on our server, then send the buyer to approve it. */
  async function onPaypal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPaypalNote(null);
    const data = new FormData(event.currentTarget);
    if (!data.get("email") || !data.get("firstName") || !data.get("lastName") || !data.get("addressLine1") || !data.get("city") || !data.get("postalCode")) {
      setError("Please fill in the contact and delivery details above first.");
      return;
    }
    setPaypalBusy(true);
    try {
      const response = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectPayload(data)),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        approveUrl?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok || !payload.approveUrl) {
        if (payload.code === "PAYPAL_NOT_CONFIGURED") {
          setError("Online payment is not enabled yet — please use the button below to place the order by invoice.");
        } else {
          setError(payload.error ?? "Could not start the PayPal payment. Please try again.");
        }
        setPaypalBusy(false);
        return;
      }
      window.location.href = payload.approveUrl;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPaypalBusy(false);
    }
  }

  function openInvoiceBox() {
    setError(null);
    const form = formRef.current;
    if (form && !form.reportValidity()) return;
    setInvoiceBoxOpen(true);
  }

  useEffect(() => {
    if (!invoiceBoxOpen) return;
    noteRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setInvoiceBoxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [invoiceBoxOpen, submitting]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "paypal") {
      await onPaypal(event);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectPayload(data)),
      });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string };

      if (!response.ok || !payload.id) {
        setError(payload.error ?? "We could not place your order. Please try again.");
        setInvoiceBoxOpen(false);
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
      <form ref={formRef} onSubmit={onSubmit} className="space-y-12" noValidate={false}>
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
          <div className="rounded-sm border border-ink/15 bg-white/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">
                  {freeShipping ? "Free shipping" : "Safe delivery"}
                  {!freeShipping && zoneInfo ? ` · ${zoneInfo.label}${quote ? ` · ${quote.classLabel}` : ""}` : ""}
                </p>
                <p className="mt-1 text-sm text-ink/60">
                  {freeShipping
                    ? "Complimentary, carefully packed and tracked. The only option we offer."
                    : `${zoneInfo?.days ?? "Carefully packed and tracked"} · carefully packed and tracked.`}
                </p>
              </div>
              <span className="font-display text-2xl text-ink">
                {shipping === 0 ? "Free" : formatPrice(shipping)}
              </span>
            </div>
            <input type="hidden" name="shippingMethod" value={method} />
          </div>
          <p className="text-xs text-ink/55">
            Every shipment is packed for safe transit. Duties and local taxes are confirmed by the carrier before dispatch.
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
              You will be redirected to PayPal to approve the payment. The order is only confirmed after PayPal
              confirms the capture — if you cancel, nothing is charged.
            </p>
          </div>
        </Section>

        {error && (
          <p role="alert" className="rounded-sm border border-terracotta/30 bg-terracotta/5 px-5 py-4 text-sm text-terracotta">
            {error}
          </p>
        )}

        {paypalNote && (
          <p role="status" className="rounded-sm border border-sea/30 bg-sea/5 px-5 py-4 text-sm text-sea">
            {paypalNote}
          </p>
        )}
        <div className="space-y-4 border-t border-ink/10 pt-10">
          <button
            type="submit"
            name="payment"
            value="paypal"
            disabled={paypalBusy || submitting}
            className="group inline-flex h-16 w-full items-center justify-center gap-3 rounded-full bg-[#ffc439] text-[13px] font-semibold uppercase tracking-[0.18em] text-[#003087] transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
          >
            {paypalBusy ? "Redirecting to PayPal…" : `Pay ${formatPrice(total)} with PayPal`}
            {!paypalBusy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
          </button>
          <button
            type="button"
            onClick={openInvoiceBox}
            disabled={submitting || paypalBusy}
            aria-haspopup="dialog"
            aria-expanded={invoiceBoxOpen}
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-ink/25 px-5 py-3 text-center text-[12px] uppercase leading-snug tracking-[0.2em] text-ink transition hover:border-ink disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? "Placing order…"
              : "PLACE ORDER BY INVOICE (EMAIL) - USE FOR ALTERNATIVE PAYMENT METHODS AND OFFERS"}
          </button>

          {invoiceBoxOpen && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) setInvoiceBoxOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="invoice-note-title"
                className="w-full max-w-lg rounded-sm border border-ink/15 bg-parchment p-6 shadow-2xl"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-brass">Order by invoice</p>
                <h2 id="invoice-note-title" className="mt-2 font-display text-3xl text-ink">
                  A note for the curator
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  Tell us how you would like to proceed — an alternative payment method (bank transfer, another
                  currency), an offer for this piece, or any question. Nothing is charged now: we reply by e-mail to
                  agree the details. The listed price stays until we confirm otherwise in writing.
                </p>
                <label className="mt-4 block space-y-2">
                  <span className={label}>Your message (optional)</span>
                  <textarea
                    ref={noteRef}
                    name="customerNote"
                    rows={5}
                    maxLength={1000}
                    className={`${field} min-h-32 resize-y`}
                    placeholder="e.g. I would like to pay by bank transfer, or offer €… for this specimen."
                  />
                </label>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                  <button
                    type="submit"
                    name="payment"
                    value="invoice"
                    disabled={submitting}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[12px] uppercase tracking-[0.2em] text-parchment transition hover:bg-sea disabled:cursor-wait disabled:opacity-60"
                  >
                    {submitting ? "Placing order…" : "Send order request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceBoxOpen(false)}
                    disabled={submitting}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-ink/25 px-6 text-[12px] uppercase tracking-[0.2em] text-ink transition hover:border-ink disabled:opacity-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          )}
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
              <dd>{shipping === 0 ? "Free shipping" : formatPrice(shipping)}</dd>
            </div>
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
