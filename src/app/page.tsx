import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, ExternalLink, Gem, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { InventoryStatus } from "@/components/inventory-status";
import { Reveal } from "@/components/reveal";
import { StarRating } from "@/components/star-rating";
import { COLLECTIONS } from "@/lib/collections";
import { collectionsOf } from "@/lib/product-collections";
import {
  getAllProducts,
  getSiteContent,
  getSiteSettings,
  getStoreStats,
  getTopReviews,
} from "@/lib/catalog";
import { isAvailable } from "@/lib/product-visibility";
import { inventoryCounts, offeredSpecimen } from "@/lib/inventory-rules";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, stats, testimonials, settings, content] = await Promise.all([
    getAllProducts(),
    getStoreStats(),
    getTopReviews(3),
    getSiteSettings(),
    getSiteContent(),
  ]);
  const c = content.home;
  const covers: Record<string, string> = {
    "devonian-crown": c.collections.covers.devonianCrown,
    "ordovician-mariners": c.collections.covers.ordovicianMariners,
    "cambrian-dawn": c.collections.covers.cambrianDawn,
    "the-connoisseur": c.collections.covers.connoisseur,
  };

  // Only pieces genuinely on sale: in stock, not archived and offered somewhere.
  // Catalogue entries (archive, unavailable) never count in these figures.
  const forSale = products.filter(offeredSpecimen);
  const counts = inventoryCounts(products);
  const erasOffered = new Set(forSale.map((p) => p.period).filter(Boolean)).size;

  const featuredPool = products.filter((p) => p.featured && isAvailable(p));
  const featured = (featuredPool.length > 0 ? featuredPool : forSale).slice(0, 4);
  const collections = COLLECTIONS.map((c) => ({
    ...c,
    count: forSale.filter((p) => collectionsOf(p).includes(c.slug)).length,
  }));
  // The provenance panel always shows the whole seafloor plate.
  const story = products.find((p) => p.slug === "sandblasted-mortality-the-sandblasted-patriarch") ?? products[0];
  const archivePieces = products.filter((p) => p.archived);
  const directCount = counts.direct;
  const ebayCount = counts.ebay;
  const catawikiCount = counts.catawiki;

  return (
    <>
      {/* Hero */}
      <section className="paper-grain relative isolate overflow-hidden bg-midnight text-parchment">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_100%_at_80%_0%,rgba(29,74,92,0.55),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-t from-parchment/10 to-transparent" />

        <div className="mx-auto grid min-h-[620px] lg:min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
          {/* Copy */}
          <div className="max-w-2xl">
            <p className="animate-fade-up text-[11px] uppercase tracking-[0.42em] text-brass">
              {c.hero.eyebrow}
            </p>
            <h1
              className="animate-fade-up mt-6 font-display text-[clamp(3rem,6.5vw,6.5rem)] leading-[0.94] text-parchment"
              style={{ animationDelay: "0.15s" }}
            >
              {c.hero.title}{" "}
              <em className="font-normal italic text-brass">{c.hero.titleItalic}</em>
            </h1>
            <p
              className="animate-fade-up mt-8 max-w-xl text-base leading-relaxed text-parchment/75 md:text-lg"
              style={{ animationDelay: "0.3s" }}
            >
              {c.hero.description}
            </p>
            <div className="animate-fade-up mt-10 flex flex-wrap gap-4" style={{ animationDelay: "0.45s" }}>
              <Link
                href="/shop"
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-parchment px-8 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:bg-brass"
              >
                {c.hero.primaryCta}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#provenance"
                className="inline-flex h-14 items-center rounded-full border border-parchment/30 px-8 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:border-parchment hover:bg-parchment/5"
              >
                {c.hero.secondaryCta}
              </a>
            </div>

            <dl
              className="animate-fade-up mt-14 grid max-w-2xl grid-cols-2 gap-6 border-t border-parchment/15 pt-8 sm:grid-cols-4"
              style={{ animationDelay: "0.6s" }}
            >
              <div>
                <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">
                  Years in the field
                </dt>
                <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">
                  {settings.yearsExperience}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">
                  Verified feedbacks
                </dt>
                <dd className="mt-1 font-display text-4xl text-brass md:text-5xl">
                  {settings.feedbacksLabel}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">Specimens</dt>
                <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">{forSale.length}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">Eras offered</dt>
                <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">{erasOffered}</dd>
              </div>
            </dl>
          </div>

          {/* Photograph — circular, with the edges dissolved into the background */}
          <div
            className="animate-fade-up relative mx-auto w-full max-w-[300px] sm:max-w-[380px] lg:max-w-[460px]"
            style={{ animationDelay: "0.25s" }}
          >
            {/* soft halo behind the specimen */}
            <div
              aria-hidden
              className="absolute inset-[-12%] rounded-full opacity-70 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle at 50% 45%, rgba(184,145,76,0.30), rgba(29,74,92,0.22) 45%, transparent 72%)",
              }}
            />

            {/* the photograph itself */}
            <div
              className="relative aspect-square overflow-hidden rounded-full ring-1 ring-parchment/15"
              style={{
                // Feathers the rim so the picture melts into the page instead of
                // ending on a hard edge.
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 50%, #000 62%, rgba(0,0,0,0.35) 82%, transparent 94%)",
                maskImage:
                  "radial-gradient(circle at 50% 50%, #000 62%, rgba(0,0,0,0.35) 82%, transparent 94%)",
              }}
            >
              <Image
                src={c.hero.image || "/images/hero.jpg"}
                alt="A hand-prepared Moroccan trilobite, photographed in detail"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 70vw"
                className="animate-kenburns object-cover"
              />
            </div>

            {/* thin brass arc, like a collector's mount */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-brass/25"
              style={{ transform: "scale(1.045)" }}
            />

            <p className="relative mt-8 text-center text-[10px] uppercase tracking-[0.26em] text-parchment/55">
              {c.hero.caption}
            </p>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-ink/10 bg-bone/70">
        <ul className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {[
            { icon: Award, ...c.trust.items[0] },
            { icon: Truck, ...c.trust.items[1] },
            { icon: ShieldCheck, ...c.trust.items[2] },
            { icon: RotateCcw, ...c.trust.items[3] },
          ].map((item) => (
            <li key={item.title} className="flex items-start gap-4">
              <item.icon size={22} strokeWidth={1.4} className="mt-0.5 shrink-0 text-sea" />
              <div>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-0.5 text-sm text-ink/60">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 3 Availability Channels Strip */}
      <section className="border-b border-ink/10 bg-parchment py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.channels.eyebrow}</p>
              <h2 className="mt-2 font-display text-4xl text-ink md:text-5xl">
                {c.channels.title}
              </h2>
            </div>
            <p className="max-w-md text-sm text-ink/65">
              {c.channels.description}
            </p>
          </div>

          <InventoryStatus />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Link
              href="/shop?channel=direct"
              className="group flex flex-col justify-between rounded-sm border border-[#ff9f3d]/45 bg-white/80 p-6 transition hover:border-[#ff9f3d] hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="site-only inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink" /> {c.channels.directBadge}
                  </span>
                  <span className="font-display text-3xl text-ink">{directCount}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl text-ink">{c.channels.directTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {c.channels.directText}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#c9721f] group-hover:translate-x-1 transition-transform">
                {c.channels.directCta} <ArrowRight size={13} />
              </span>
            </Link>

            <Link
              href="/shop?channel=ebay"
              className="group flex flex-col justify-between rounded-sm border border-[#E53238]/30 bg-white/80 p-6 transition hover:border-[#E53238] hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full ebay-quad px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> {c.channels.ebayBadge}
                  </span>
                  <span className="font-display text-3xl text-ink">{ebayCount}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl text-ink">{c.channels.ebayTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {c.channels.ebayText}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#E53238] group-hover:translate-x-1 transition-transform">
                {c.channels.ebayCta} <ArrowRight size={13} />
              </span>
            </Link>

            <Link
              href="/shop?channel=catawiki"
              className="group flex flex-col justify-between rounded-sm border border-[#0033FF]/30 bg-white/80 p-6 transition hover:border-[#0033FF] hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#0033FF] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> {c.channels.catawikiBadge}
                  </span>
                  <span className="font-display text-3xl text-ink">{catawikiCount}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl text-ink">{c.channels.catawikiTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {c.channels.catawikiText}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#0033FF] group-hover:translate-x-1 transition-transform">
                {c.channels.catawikiCta} <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.collections.eyebrow}</p>
          <h2 className="mt-4 max-w-2xl font-display text-5xl leading-[1.02] text-ink md:text-6xl">
            {c.collections.title}
          </h2>
          <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-ink/50">
            {c.collections.subtitle}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.12}>
              <Link
                href={c.externalUrl ?? `/shop?collection=${c.slug}`}
                {...(c.externalUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group relative block aspect-[3/4] overflow-hidden rounded-sm bg-midnight text-parchment"
              >
                <Image
                  src={covers[c.slug] ?? c.cover}
                  alt={c.title}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover opacity-80 transition-all duration-[1.4s] ease-out group-hover:scale-105 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-7">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-brass">{c.eyebrow}</p>
                  <h3 className="mt-3 font-display text-4xl leading-none">{c.title}</h3>
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-parchment/70">{c.description}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-parchment/15 pt-4 text-[11px] uppercase tracking-[0.2em]">
                    <span className="text-parchment/60">{c.count} pieces</span>
                    <span className="flex items-center gap-2 transition-transform group-hover:translate-x-1">
                      Explore <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="bg-bone/50 py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.featured.eyebrow}</p>
              <h2 className="mt-4 font-display text-5xl leading-[1.02] text-ink md:text-6xl">
                {c.featured.title}
              </h2>
            </div>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-ink hover:text-terracotta"
            >
              {c.featured.cta}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>

          <div className="mt-14 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
            {featured.map((product, i) => (
              <Reveal key={product.id} delay={i * 0.1}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Provenance & 23 Years Reputation */}
      <section id="provenance" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-bone">
              <Image
                src={c.provenance.image || story?.images[0]?.src || "/images/seafloor-plate.jpg"}
                alt="A whole seafloor sealed in stone"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute bottom-5 left-5 right-5 rounded-sm bg-parchment/95 p-5 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.28em] text-brass">
                  {c.provenance.badge}
                </p>
                <p className="mt-2 font-display text-2xl leading-snug text-ink">
                  &ldquo;{c.provenance.quote}&rdquo;
                </p>
              </div>
              <span className="absolute right-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-parchment backdrop-blur">
                {c.provenance.imageBadge}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.provenance.eyebrow}</p>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] text-ink md:text-6xl">
              {c.provenance.title}{" "}
              <em className="italic text-sea">{c.provenance.titleItalic}</em>
            </h2>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-ink/70">{c.provenance.body}</p>

            {/* Verified Marketplaces & Social Proof */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {settings.ebayUrl && (
                <a
                  href={settings.ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink transition hover:border-ink hover:bg-white"
                >
                  eBay Verified Store <ExternalLink size={12} />
                </a>
              )}
              {settings.catawikiUrl && (
                <a
                  href={settings.catawikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink transition hover:border-ink hover:bg-white"
                >
                  Catawiki Expert Seller <ExternalLink size={12} />
                </a>
              )}
              {settings.instagramUrl && (
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink transition hover:border-ink hover:bg-white"
                >
                  Instagram <ExternalLink size={12} />
                </a>
              )}
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink transition hover:border-ink hover:bg-white"
                >
                  Facebook <ExternalLink size={12} />
                </a>
              )}
            </div>

            <ol className="mt-12 space-y-8">
              {[
                { n: "01", ...c.provenance.steps[0] },
                { n: "02", ...c.provenance.steps[1] },
                { n: "03", ...c.provenance.steps[2] },
              ].map((item) => (
                <li key={item.n} className="grid grid-cols-[auto_1fr] gap-6">
                  <span className="font-display text-3xl text-brass">{item.n}</span>
                  <div>
                    <h3 className="font-display text-2xl text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/65">{item.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* Testimonials (only genuine client reviews) */}
      {testimonials.length > 0 && (
      <section className="bg-midnight py-28 text-parchment">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="text-center text-[11px] uppercase tracking-[0.32em] text-brass">
              {c.testimonials.eyebrow}
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-center font-display text-5xl leading-[1.02] md:text-6xl">
              {c.testimonials.title}
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.12}>
                <figure className="flex h-full flex-col rounded-sm border border-parchment/10 bg-parchment/[0.03] p-8">
                  <StarRating rating={t.rating} size={14} />
                  <blockquote className="mt-6 flex-1">
                    <p className="font-display text-2xl leading-snug text-parchment">&ldquo;{t.title}.&rdquo;</p>
                    <p className="mt-4 text-sm leading-relaxed text-parchment/65">{t.body}</p>
                  </blockquote>
                  <figcaption className="mt-8 border-t border-parchment/10 pt-5">
                    <p className="text-sm font-medium">{t.authorName}</p>
                    <p className="text-xs text-parchment/50">
                      {t.authorCountry} ·{" "}
                      <Link href={`/shop/${t.productSlug}`} className="text-brass hover:underline">
                        {t.productName}
                      </Link>
                    </p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Everywhere you can find us — the Linktree, in page */}
      <section id="links" className="border-t border-ink/10 bg-bone/50 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.links.eyebrow}</p>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-5xl leading-[1.02] text-ink md:text-6xl">
              {c.links.title}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink/65">
              {c.links.description}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href={settings.ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ebay-quad group flex items-center justify-between gap-4 rounded-sm border border-transparent p-6 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/85">Marketplace</p>
                <p className="mt-2 font-display text-3xl text-white">eBay store</p>
                <p className="mt-1 text-sm text-white/85">Fixed prices and best offers</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-white/85 transition group-hover:text-white" />
            </a>

            <a
              href={settings.catawikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cw-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent p-6 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/85">Auctions</p>
                <p className="mt-2 font-display text-3xl text-white">Catawiki</p>
                <p className="mt-1 text-sm text-white/85">Weekly Natural History auctions</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-white/85 transition group-hover:text-white" />
            </a>

            <a
              href={settings.trustamiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-sm border border-brass/50 bg-brass/10 p-6 transition hover:border-brass hover:shadow-md"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-brass">Verified rating</p>
                <p className="mt-2 font-display text-3xl text-ink">{settings.trustamiRating}</p>
                <p className="mt-1 text-sm text-ink/60">{settings.trustamiRatings} verified ratings</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
            </a>

            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ig-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent p-6 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/85">Photography</p>
                <p className="mt-2 font-display text-3xl text-white">Instagram</p>
                <p className="mt-1 text-sm text-white/85">New arrivals and macro detail</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-white/85 transition group-hover:text-white" />
            </a>

            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fb-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent p-6 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/85">Community</p>
                <p className="mt-2 font-display text-3xl text-white">Facebook</p>
                <p className="mt-1 text-sm text-white/85">Fossils from Morocco</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-white/85 transition group-hover:text-white" />
            </a>

            {settings.whatsappPhone && (
              <a
                href={`https://wa.me/${settings.whatsappPhone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent p-6 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/85">Direct</p>
                  <p className="mt-2 font-display text-3xl text-white">WhatsApp</p>
                  <p className="mt-1 text-sm text-white/85">Ask for photos or a shipping quote</p>
                </div>
                <ExternalLink size={18} className="shrink-0 text-white/85 transition group-hover:text-white" />
              </a>
            )}
          </div>

          <p className="mt-10 text-center text-sm text-ink/60">{c.links.footnote}</p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-5 py-28 text-center lg:px-8">
        <Reveal>
          <div className="hairline mx-auto mb-12 w-40" />
          <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[1.02] text-ink md:text-7xl">
            {c.closing.titleLead} <em className="italic text-terracotta">{c.closing.titleItalic}</em>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink/65">
            {c.closing.text}{" "}
            <a href={`mailto:${settings.contactEmail}`} className="underline underline-offset-4 hover:text-terracotta">
              {settings.contactEmail}
            </a>
            .
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/shop"
              className="inline-flex h-14 items-center rounded-full bg-ink px-9 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta"
            >
              {c.closing.ctaShop}
            </Link>
            <a
              href="https://www.mediterranic.com/Souss-Lagerst%C3%A4tte-site"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center rounded-full border border-ink/25 px-9 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:border-ink"
            >
              Souss Lagerstätte
            </a>
            <Link
              href="/archive"
              className="inline-flex h-14 items-center rounded-full border border-ink/25 px-9 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:border-ink"
            >
              {c.closing.ctaArchive}
            </Link>
          </div>

          {archivePieces.length > 0 && (
            <div className="mt-16 text-left">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.closing.archiveEyebrow}</p>
                  <h3 className="mt-2 font-display text-3xl text-ink">{c.closing.archiveTitle}</h3>
                </div>
                <Link href="/archive" className="text-[11px] uppercase tracking-[0.2em] text-ink/60 hover:text-terracotta">
                  {c.closing.archiveCta}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {archivePieces.slice(0, 4).map((p) => (
                  <Link key={p.slug} href={`/shop/${p.slug}`} className="group block">
                    <div className="relative aspect-square overflow-hidden rounded-sm bg-bone">
                      {p.images[0] && (
                        <Image
                          src={p.images[0].src}
                          alt={p.images[0].alt}
                          fill
                          sizes="(min-width: 768px) 22vw, 46vw"
                          className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.05]"
                        />
                      )}
                    </div>
                    <p className="mt-3 font-display text-lg leading-tight text-ink">{p.name}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-ink/10 pt-8 sm:flex-row">
            <span className="text-[11px] uppercase tracking-[0.24em] text-ink/45">Also on</span>
            <a
              href={settings.ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink underline decoration-ink/25 underline-offset-8 transition hover:text-terracotta hover:decoration-terracotta"
            >
              Our eBay store <ExternalLink size={12} />
            </a>
            <span className="hidden text-ink/25 sm:inline">·</span>
            <a
              href={settings.catawikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink underline decoration-ink/25 underline-offset-8 transition hover:text-terracotta hover:decoration-terracotta"
            >
              Our Catawiki auctions <ExternalLink size={12} />
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
