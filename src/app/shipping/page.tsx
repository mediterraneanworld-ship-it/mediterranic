import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Clock,
  Globe2,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { NewsletterForm } from "@/components/newsletter-form";
import { formatPrice } from "@/lib/format";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_METHODS,
  ZONE_LABELS,
  ZONE_ORDER,
  countriesInZone,
  getZoneRates,
} from "@/lib/shipping";
import { getSiteSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Insured worldwide delivery for Moroccan trilobites, museum-level packing, delivery times by zone, customs notes and 30-day considered returns.",
};

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-ink/10 py-12 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-sea">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">{title}</h2>
          <div className="mt-4 max-w-3xl space-y-4 text-[15px] leading-relaxed text-ink/72">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default async function ShippingPage() {
  const settings = await getSiteSettings();

  return (
    <div className="bg-parchment">
      <header className="border-b border-ink/10 bg-midnight text-parchment">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Client care</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1] md:text-7xl">
            Shipping <span className="italic text-brass">&amp;</span> Returns
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-parchment/70">
            Every specimen travels insured, packed to museum standard and documented. Here is exactly what that
            means, what it costs, and what happens if a piece is not right for your collection.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[11px] uppercase tracking-[0.2em] text-parchment/55">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={14} className="text-brass" /> Fully insured in transit
            </span>
            <span className="inline-flex items-center gap-2">
              <Truck size={14} className="text-brass" /> Worldwide delivery
            </span>
            <span className="inline-flex items-center gap-2">
              <RotateCcw size={14} className="text-brass" /> 30-day returns
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <Section id="dispatch" title="Dispatch times" icon={<Clock size={18} strokeWidth={1.6} />}>
          <p>
            Orders confirmed before 14:00 (WET, Lisbon time) on a business day are packed and handed to the carrier
            the same day. Anything confirmed later leaves the following business day.
          </p>
          <ul className="ml-1 space-y-2">
            <li>
              <strong className="text-ink">Preparation:</strong> 1–2 business days for cradling, labelling and
              photographic record before the crate is closed.
            </li>
            <li>
              <strong className="text-ink">Tracking:</strong> sent by email the moment the label is created, with the
              insurance reference attached.
            </li>
            <li>
              <strong className="text-ink">Auction pieces:</strong> a specimen that is live on eBay or Catawiki ships
              under that marketplace&apos;s own schedule. When the auction ends and the piece returns to Site Only, it
              ships under the terms on this page.
            </li>
          </ul>
        </Section>

        <Section id="packing" title="How a trilobite is packed" icon={<PackageCheck size={18} strokeWidth={1.6} />}>
          <p>
            Fossilised calcite is brittle and matrix cleaves along old bedding planes. A specimen that survives a
            quarry does not automatically survive a parcel network, so packing is treated as part of the preparation.
          </p>
          <ul className="ml-1 space-y-2">
            <li>
              The specimen is surface-dried, then wrapped in acid-free tissue and immobilised in a fitted foam cradle
              — nothing presses directly on spines, eyes or cephalic sutures.
            </li>
            <li>
              The cradle floats inside a rigid double-wall box with at least 5 cm of cushioning on every face, so a
              drop on any corner is absorbed before it reaches the stone.
            </li>
            <li>
              Larger slabs travel crated and banded. High-value pieces are shipped in two independent parcels when the
              carrier allows it.
            </li>
            <li>
              Each order includes the printed specimen data — species, locality, formation, period, length and
              preparation notes — and a <strong className="text-ink">certificate of authenticity</strong> for pieces
              marked as certified on their product page.
            </li>
          </ul>
        </Section>

        <Section id="rates" title="Insured delivery rates" icon={<Globe2 size={18} strokeWidth={1.6} />}>
          <p>
            Rates below are per order, not per piece, and include full transit insurance and tracking. Orders over{" "}
            <strong className="text-ink">{formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)}</strong> ship free of charge on
            the insured standard service.
          </p>
          <div className="mt-2 overflow-x-auto rounded-sm border border-ink/12 bg-white/70">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/12 bg-bone/60 text-[11px] uppercase tracking-[0.18em] text-ink/70">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Zone
                  </th>
                  {SHIPPING_METHODS.map((m) => (
                    <th key={m.id} scope="col" className="px-4 py-3 font-medium">
                      {m.label}
                      <span className="ml-2 normal-case tracking-normal text-ink/45">{m.detail}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ZONE_ORDER.map((zone) => {
                  const rates = getZoneRates(zone);
                  return (
                    <tr key={zone} className="border-b border-ink/8 last:border-0 align-top">
                      <th scope="row" className="px-4 py-4 text-left font-normal">
                        <span className="block text-ink">{ZONE_LABELS[zone]}</span>
                        <span className="mt-1 block text-xs text-ink/50">
                          {countriesInZone(zone).join(" · ")}
                        </span>
                      </th>
                      {SHIPPING_METHODS.map((m) => (
                        <td key={m.id} className="px-4 py-4 text-ink">
                          {formatPrice(rates[m.id])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink/55">
            Countries outside these zones: write to{" "}
            <a href={`mailto:${settings.contactEmail}`} className="text-sea underline underline-offset-2">
              {settings.contactEmail}
            </a>{" "}
            with the destination and the specimen reference, and we will quote an insured route before you commit to
            anything.
          </p>
        </Section>

        <Section id="customs" title="Customs, duties and paperwork" icon={<BadgeCheck size={18} strokeWidth={1.6} />}>
          <p>
            Specimens leave Portugal/EU under a commercial invoice describing the goods as
            &ldquo;fossil specimens for private collection&rdquo;, with the HS code for collector&apos;s items and the
            declared value matching what you paid.
          </p>
          <ul className="ml-1 space-y-2">
            <li>
              Import duty and any local sales tax are the buyer&apos;s responsibility and are not included in the
              shipping price shown at checkout.
            </li>
            <li>
              We never under-declare value or mark a commercial shipment as a gift. It invalidates the insurance and
              holds the parcel at the border.
            </li>
            <li>
              Moroccan fossil exports are legal under the national framework for privately collected material; every
              piece is sourced through licensed quarry families and the documentation travels with the specimen.
            </li>
          </ul>
        </Section>

        <Section id="returns" title="Returns within 30 days" icon={<RotateCcw size={18} strokeWidth={1.6} />}>
          <p>
            A specimen is bought on photography and description, and the two are never quite the same object in the
            hand. If it does not belong in your collection, you have{" "}
            <strong className="text-ink">30 days from delivery</strong> to return it.
          </p>
          <ul className="ml-1 space-y-2">
            <li>
              Write to{" "}
              <a href={`mailto:${settings.contactEmail}`} className="text-sea underline underline-offset-2">
                {settings.contactEmail}
              </a>{" "}
              with the order reference (MED-XXXXXXXX) and we reply with a return authorisation and the address.
            </li>
            <li>
              The piece must come back in the same packing it arrived in, with the matrix, labels, certificate and
              documentation. Please do not clean, consolidate, re-prepare or repair anything.
            </li>
            <li>
              The refund is issued to the original payment method within 5 business days of the parcel being
              inspected, and covers the price of the specimen. Outbound shipping is refunded only where the return is
              our fault.
            </li>
            <li>
              Return postage is paid by the buyer unless the piece arrived damaged or is materially different from
              its listing — in those cases we cover it in full.
            </li>
          </ul>
        </Section>

        <Section id="damaged" title="If a piece arrives damaged" icon={<ShieldCheck size={18} strokeWidth={1.6} />}>
          <p>
            It is rare, and it is insured. Please follow this order so the claim can be filed straight away:
          </p>
          <ol className="ml-1 list-decimal space-y-2 pl-4">
            <li>
              Photograph the outer box <em>before</em> opening it if the packaging is visibly crushed, pierced or wet,
              and note any damage with the carrier at the door.
            </li>
            <li>
              Photograph the specimen and the packing exactly as you found it. Do not discard anything, including the
              foam cradle and fragments — insurers ask for them.
            </li>
            <li>
              Email {settings.contactEmail} within 48 hours of delivery with the order reference and the photographs.
            </li>
            <li>
              We open the claim and offer you a replacement, a partial refund or a full refund including shipping. You
              are never left holding a broken stone.
            </li>
          </ol>
        </Section>

        <Section id="archive" title="Pieces already placed" icon={<PackageCheck size={18} strokeWidth={1.6} />}>
          <p>
            Specimens that have found their collectors are moved to the public{" "}
            <Link href="/archive" className="text-sea underline underline-offset-2">
              archive
            </Link>
            . They are shown for the record only — no price and no availability. If one of them is the piece you were
            looking for, use <strong className="text-ink">&ldquo;Request a similar specimen&rdquo;</strong> on its page
            and we will search the next quarry batches and auction catalogues on your behalf.
          </p>
          <p>
            A piece marked <strong className="text-ink">Unavailable</strong> in the shop is in the same situation: it
            has left our stock, and the price is deliberately not shown.
          </p>
        </Section>

        <div className="mt-6 rounded-sm border border-ink/12 bg-white/70 p-8">
          <NewsletterForm
            tone="light"
            source="shipping"
            title="Stay in touch"
            copy="Delivery notices, new quarry batches and auction dates. About once a month."
          />
        </div>

        <p className="mt-10 text-sm text-ink/60">
          Questions about a specific order? Write to{" "}
          <a href={`mailto:${settings.contactEmail}`} className="text-sea underline underline-offset-2">
            {settings.contactEmail}
          </a>{" "}
          with your order reference — we answer personally, usually the same day.
        </p>
      </div>
    </div>
  );
}
