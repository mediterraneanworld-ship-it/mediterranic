import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock, Globe2, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { NewsletterForm } from "@/components/newsletter-form";
import { formatPrice } from "@/lib/format";
import { countriesInZone, weightClassLabels, ZONES } from "@/lib/shipping";
import { getShippingTable } from "@/lib/shipping-table";
import { getSiteContent, getSiteSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Worldwide delivery for Moroccan trilobites, museum-level packing, delivery times by zone, customs notes and 30-day considered returns.",
};

function Section({
  id,
  icon,
  title,
  items,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-ink/10 py-12 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-sea">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">{title}</h2>
          <ul className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-ink/72">
            {items.filter(Boolean).map((item, index) => (
              <li key={index} className="relative pl-4">
                <span aria-hidden className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-brass" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default async function ShippingPage() {
  const [settings, content, shippingTable] = await Promise.all([
    getSiteSettings(),
    getSiteContent(),
    getShippingTable(),
  ]);
  const classLabels = weightClassLabels(shippingTable.classes);
  const copy = content.shipping;
  const freeShipping = content.commerce.freeShipping;

  return (
    <div className="bg-parchment">
      <header className="border-b border-ink/10 bg-midnight text-parchment">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{copy.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1] md:text-7xl">
            Shipping <span className="italic text-brass">&amp;</span> Returns
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-parchment/70">{copy.intro}</p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[11px] uppercase tracking-[0.2em] text-parchment/55">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={14} className="text-brass" /> Carefully packed in transit
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
        <Section id="dispatch" title={copy.dispatch.title} items={copy.dispatch.items} icon={<Clock size={18} strokeWidth={1.6} />} />
        <Section
          id="packing"
          title={copy.packing.title}
          items={copy.packing.items}
          icon={<PackageCheck size={18} strokeWidth={1.6} />}
        />

        <section id="rates" className="scroll-mt-28 border-t border-ink/10 py-12">
          <div className="flex items-start gap-4">
            <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-sea">
              <Globe2 size={18} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">{copy.rates.title}</h2>
              <ul className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-ink/72">
                {copy.rates.items.filter(Boolean).map((item, index) => (
                  <li key={index} className="relative pl-4">
                    <span aria-hidden className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-brass" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink/60">
                {freeShipping ? (
                  <>
                    <strong className="text-ink">Free shipping on every order</strong> — carefully packed and tracked,
                    whichever zone you are in.
                  </>
                ) : (
                  <>
                    The rate depends on the total weight of your order, protective box included, and on the delivery zone. Nothing else is
                    added.
                  </>
                )}
              </p>
              {/* Phones: one card per region, so the table never has to be swiped sideways. */}
              <ul className="mt-4 divide-y divide-ink/10 rounded-sm border border-ink/12 bg-white/70 px-4 sm:hidden">
                {ZONES.map((zone) => (
                  <li key={zone.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-ink">{zone.label}</p>
                      <p className="text-xs text-ink/55">{zone.days}</p>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {shippingTable.classes.map((cls) => (
                        <div key={cls.id} className="flex items-baseline justify-between gap-2">
                          <dt className="text-ink/60">{classLabels[cls.id]}</dt>
                          <dd className="font-medium text-ink">
                            {freeShipping ? "Free" : formatPrice(shippingTable.rates[cls.id]?.[zone.id] ?? zone.rateCents)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <details className="mt-3 text-xs text-ink/55">
                      <summary className="cursor-pointer">Countries</summary>
                      <p className="mt-2 leading-relaxed">{countriesInZone(zone.id).join(" · ")}</p>
                    </details>
                  </li>
                ))}
              </ul>
              <div className="mt-4 hidden overflow-x-auto rounded-sm border border-ink/12 bg-white/70 sm:block">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/12 bg-bone/60 text-[11px] uppercase tracking-[0.18em] text-ink/70">
                      <th scope="col" className="px-4 py-3 font-medium">
                        Zone
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Transit
                      </th>
                      {shippingTable.classes.map((cls) => (
                        <th key={cls.id} scope="col" className="px-4 py-3 text-right font-medium">
                          {classLabels[cls.id]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ZONES.map((zone) => (
                      <tr key={zone.id} className="border-b border-ink/8 align-top last:border-0">
                        <th scope="row" className="px-4 py-4 text-left font-normal">
                          <span className="block text-ink">{zone.label}</span>
                          <span className="mt-1 block text-xs text-ink/50">{countriesInZone(zone.id).join(" · ")}</span>
                        </th>
                        <td className="px-4 py-4 text-ink/70">{zone.days}</td>
                        {shippingTable.classes.map((cls) => (
                          <td key={cls.id} className="px-4 py-4 text-right font-medium text-ink">
                            {freeShipping ? "Free" : formatPrice(shippingTable.rates[cls.id]?.[zone.id] ?? zone.rateCents)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {freeShipping && (
                <p className="mt-2 text-xs text-ink/55">
                  Free shipping is currently active, so no delivery options are shown at checkout.
                </p>
              )}
            </div>
          </div>
        </section>

        <Section id="customs" title={copy.customs.title} items={copy.customs.items} icon={<BadgeCheck size={18} strokeWidth={1.6} />} />
        <Section id="returns" title={copy.returns.title} items={copy.returns.items} icon={<RotateCcw size={18} strokeWidth={1.6} />} />
        <Section id="damaged" title={copy.damaged.title} items={copy.damaged.items} icon={<ShieldCheck size={18} strokeWidth={1.6} />} />
        <Section id="archive" title={copy.archive.title} items={copy.archive.items} icon={<PackageCheck size={18} strokeWidth={1.6} />} />

        <div className="mt-6 rounded-sm border border-ink/12 bg-white/70 p-8">
          <NewsletterForm tone="light" source="shipping" title={copy.newsletterTitle} copy={copy.newsletterCopy} />
        </div>

        <p className="mt-10 text-sm text-ink/60">
          {copy.contactNote}{" "}
          <a href={`mailto:${settings.contactEmail}`} className="text-sea underline underline-offset-2">
            {settings.contactEmail}
          </a>
        </p>

        <p className="mt-6 text-sm text-ink/60">
          Looking for a piece that is no longer listed?{" "}
          <Link href="/archive" className="text-sea underline underline-offset-2">
            The archive
          </Link>{" "}
          records every specimen that has found its collector.
        </p>
      </div>
    </div>
  );
}
