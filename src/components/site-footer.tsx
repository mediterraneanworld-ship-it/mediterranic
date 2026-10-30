import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { COLLECTIONS } from "@/lib/collections";
import { getSiteSettings } from "@/lib/catalog";

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Mediterranic",
    email: settings.contactEmail,
    description:
      "Moroccan trilobites — Cambrian, Ordovician and Devonian. Specialist curatorship for collectors, verified on eBay and Catawiki.",
    sameAs: [settings.ebayUrl, settings.catawikiUrl, settings.instagramUrl, settings.facebookUrl, settings.trustamiUrl]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index),
  };

  return (
    <footer className="mt-32 bg-midnight text-parchment/80">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="space-y-5 lg:col-span-1">
          <p className="font-display text-3xl uppercase tracking-[0.2em] text-parchment">Mediterranic</p>
          <p className="max-w-xs text-sm leading-relaxed text-parchment/65">
            Museum-grade Moroccan trilobites, documented from quarry to study. Sourced under licence, prepared by
            specialists, delivered insured.
          </p>
        </div>

        <div>
          <h3 className="mb-5 text-[11px] uppercase tracking-[0.3em] text-brass">Collections</h3>
          <ul className="space-y-3 text-sm">
            {COLLECTIONS.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop?collection=${c.slug}`} className="transition hover:text-parchment">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-5 text-[11px] uppercase tracking-[0.3em] text-brass">Client care</h3>
          <ul className="space-y-3 text-sm">
            <li>Insured worldwide delivery</li>
            <li>30-day considered returns</li>
            <li>Certificate of authenticity</li>
            <li>Private viewings by appointment</li>
          </ul>
        </div>

        <div>
          <h3 className="mb-5 text-[11px] uppercase tracking-[0.3em] text-brass">Correspondence</h3>
          <ul className="space-y-3 text-sm">
            <li>
              <a href={`mailto:${settings.contactEmail}`} className="transition hover:text-parchment">
                {settings.contactEmail}
              </a>
            </li>
            <li>23 years · eBay &amp; Catawiki verified</li>
            <li>All prices in euro (EUR)</li>
            <li>Ships insured to North America, Europe &amp; Japan</li>
          </ul>

          <h3 className="mb-4 mt-8 text-[11px] uppercase tracking-[0.3em] text-brass">Our marketplaces</h3>
          <ul className="space-y-2.5 text-sm">
            {settings.ebayUrl && (
              <li>
                <a
                  href={settings.ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-parchment"
                >
                  eBay store <ExternalLink size={11} className="text-brass" />
                </a>
              </li>
            )}
            {settings.catawikiUrl && (
              <li>
                <a
                  href={settings.catawikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-parchment"
                >
                  Catawiki seller page <ExternalLink size={11} className="text-brass" />
                </a>
              </li>
            )}
            {settings.instagramUrl && (
              <li>
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-parchment"
                >
                  Instagram <ExternalLink size={11} className="text-brass" />
                </a>
              </li>
            )}
            {settings.facebookUrl && (
              <li>
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-parchment"
                >
                  Facebook <ExternalLink size={11} className="text-brass" />
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-parchment/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-parchment/50 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} Mediterranic. Every specimen ships with full documentation.</p>
          <p>Fossils are natural objects sourced under Moroccan regulations for private collecting.</p>
        </div>
      </div>
    </footer>
  );
}
