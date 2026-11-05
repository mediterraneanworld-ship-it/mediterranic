import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { COLLECTIONS } from "@/lib/collections";
import { getSiteContent, getSiteSettings } from "@/lib/catalog";
import { NewsletterForm } from "@/components/newsletter-form";

const CARE_LINKS = ["/shipping#rates", "/shipping#returns", "/shipping#packing", "/shipping"];

export async function SiteFooter() {
  const [settings, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const footer = content.footer;
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Mediterranic",
    email: settings.contactEmail,
    description: footer.tagline,
    sameAs: [settings.ebayUrl, settings.catawikiUrl, settings.instagramUrl, settings.facebookUrl, settings.trustamiUrl]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index),
  };

  return (
    <footer className="mt-16 bg-midnight text-parchment/80">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="space-y-5 lg:col-span-1">
          <p className="font-display text-3xl uppercase tracking-[0.2em] text-parchment">Mediterranic</p>
          <p className="max-w-xs text-sm leading-relaxed text-parchment/65">{footer.tagline}</p>
          <div className="pt-4">
            <NewsletterForm title={footer.newsletterTitle} copy={footer.newsletterCopy} />
          </div>
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
            {footer.clientCare.map((item, i) => (
              <li key={item}>
                <Link href={CARE_LINKS[i] ?? "/shipping"} className="transition hover:text-parchment">
                  {item}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/archive" className="transition hover:text-parchment">
                The archive
              </Link>
            </li>
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
            {footer.correspondence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3 className="mb-4 mt-8 text-[11px] uppercase tracking-[0.3em] text-brass">{footer.marketplacesTitle}</h3>
          <ul className="space-y-2.5 text-sm">
            {settings.ebayUrl && (
              <li>
                <a
                  href={settings.ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-[#4d94ff] transition hover:text-white"
                >
                  eBay store <ExternalLink size={11} className="text-[#4d94ff]" />
                </a>
              </li>
            )}
            {settings.catawikiUrl && (
              <li>
                <a
                  href={settings.catawikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-[#5b8cff] transition hover:text-white"
                >
                  Catawiki seller page <ExternalLink size={11} className="text-[#5b8cff]" />
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
          <p>
            © {new Date().getFullYear()} Mediterranic. {footer.bottomLine}
          </p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/shop" className="transition hover:text-parchment">
              Shop
            </Link>
            <Link href="/featured" className="transition hover:text-parchment">
              Featured &amp; New
            </Link>
            <Link href="/archive" className="transition hover:text-parchment">
              Archive
            </Link>
            <Link href="/shipping" className="transition hover:text-parchment">
              Shipping &amp; returns
            </Link>
            <a href={`mailto:${settings.contactEmail}`} className="transition hover:text-parchment">
              Contact
            </a>
          </nav>
          <p>{footer.legalNote}</p>
        </div>
      </div>
    </footer>
  );
}
