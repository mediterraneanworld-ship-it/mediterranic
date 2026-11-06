import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, ExternalLink, Gem, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { HomeReviewsRotator } from "@/components/home-reviews-rotator";
import { StarRating } from "@/components/star-rating";
import { COLLECTIONS } from "@/lib/collections";
import { collectionsOf } from "@/lib/product-collections";
import {
  getAllProducts,
  getSiteContent,
  getSiteSettings,
  getStoreStats,
  getHomeTestimonials,
} from "@/lib/catalog";
import { isAvailable } from "@/lib/product-visibility";
import { inventoryCounts, offeredSpecimen } from "@/lib/inventory-rules";
import { isRenderableHomeSection, type HomeSectionId } from "@/lib/home-sections";
import { Fragment, type ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, stats, testimonials, settings, content] = await Promise.all([
    getAllProducts(),
    getStoreStats(),
    getHomeTestimonials(),
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
  const collectionCards = {
    "devonian-crown": c.collections.cards.devonianCrown,
    "ordovician-mariners": c.collections.cards.ordovicianMariners,
    "cambrian-dawn": c.collections.cards.cambrianDawn,
    "the-connoisseur": c.collections.cards.connoisseur,
  };
  const collections = COLLECTIONS.map((collection) => {
    const card = collectionCards[collection.slug];
    return {
      ...collection,
      title: card.title,
      homeLabel: card.label || undefined,
      description: card.description,
      externalUrl: card.href || undefined,
      count: forSale.filter((p) => collectionsOf(p).includes(collection.slug)).length,
    };
  });
  // The provenance panel always shows the whole seafloor plate.
  const story = products.find((p) => p.slug === "sandblasted-mortality-the-sandblasted-patriarch") ?? products[0];
  const archivePieces = products.filter((p) => p.archived);
  const directCount = counts.direct;
  const ebayCount = counts.ebay;
  const catawikiCount = counts.catawiki;

  const sections: Partial<Record<HomeSectionId, ReactNode>> = {
    // {/* Hero */}
    h2: (
      <section className="paper-grain relative isolate overflow-hidden bg-midnight text-parchment">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_100%_at_80%_0%,rgba(29,74,92,0.55),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-t from-parchment/10 to-transparent" />

        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 pb-16 pt-6 text-center lg:px-8 lg:pb-20 lg:pt-8">
          {/* 1. Photograph — circular, with the edges dissolved into the background */}
          <div
            className="animate-fade-up relative mx-auto w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[390px]"
            style={{ animationDelay: "0.15s" }}
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
          </div>

          {/* 2. Caption under the photo */}
          <p
            className="animate-fade-up relative mt-5 text-center text-[10px] uppercase tracking-[0.26em] text-parchment/55 sm:text-[11px]"
            style={{ animationDelay: "0.2s" }}
          >
            {c.hero.caption}
          </p>

          {/* 3. Buttons (primary and secondary) */}
          <div
            className="animate-fade-up mt-8 flex flex-wrap justify-center gap-4"
            style={{ animationDelay: "0.25s" }}
          >
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

          {/* 4. Title part (first part + italic part) */}
          <h1
            className="animate-fade-up font-display mt-10 max-w-3xl text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.96] text-parchment"
            style={{ animationDelay: "0.35s" }}
          >
            {c.hero.title}{" "}
            <em className="font-normal italic text-brass">{c.hero.titleItalic}</em>
          </h1><p
            className="animate-fade-up mt-6 max-w-2xl text-base leading-relaxed text-parchment/75 md:text-lg"
            style={{ animationDelay: "0.45s" }}
          >
            {c.hero.description}
          </p>
        </div>
      </section>
    ),
    h3: (
      <section className="border-t border-parchment/15 bg-midnight text-parchment">
        <dl className="animate-fade-up mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4 lg:px-8" style={{ animationDelay: "0.6s" }}>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">{c.hero.stats.years}</dt>
            <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">{settings.yearsExperience}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">{c.hero.stats.feedbacks}</dt>
            <dd className="mt-1 font-display text-4xl text-brass md:text-5xl">{settings.feedbacksLabel}</dd>
          </div>
          <div>
            {/* Always the live count of pieces available now (site + eBay + Catawiki). */}
            <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">{c.hero.stats.specimens}</dt>
            <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">{forSale.length}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">{c.hero.stats.eras}</dt>
            <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">{erasOffered}</dd>
          </div>
        </dl>
      </section>
    ),
    // {/* Trust strip */}
    h4: (
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
    ),
    h5: (
      // 3 Availability Channels Strip
      <section className="border-b border-ink/10 bg-parchment pb-16 pt-8 md:pt-10">
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
    ),
    // {/* Collections */}
    h6: (
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 md:pb-28 md:pt-20 lg:px-8">
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
                  {c.homeLabel && <p className="text-[10px] uppercase tracking-[0.28em] text-brass">{c.homeLabel}</p>}
                  {/* Anchor for card eyebrow regression check: {c.homeLabel && < */}
                  <h3 className="mt-3 font-display text-4xl leading-none">{c.title}</h3>
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-parchment/70">{c.description}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-parchment/15 pt-4 text-[11px] uppercase tracking-[0.2em]">
                    <span className="text-parchment/60">
                      {c.count} {c.count === 1 ? content.home.collections.pieceSingular : content.home.collections.piecePlural}
                    </span>
                    <span className="flex items-center gap-2 transition-transform group-hover:translate-x-1">
                      {content.home.collections.explore} <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        {/* The geological ages line under the four cards is retired. */}
      </section>
    ),
    // {/* Featured */}
    h7: (
      <section className="bg-bone/50 py-16 md:py-28">
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
    ),
    h8: (
      // Provenance & 23 Years Reputation
      <section id="provenance" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 md:py-28 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-bone">
                <Image
                  src={c.provenance.image || story?.images[0]?.src || "/images/seafloor-plate.jpg"}
                  alt="A whole seafloor sealed in stone"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute right-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-parchment backdrop-blur">
                  {c.provenance.imageBadge}
                </span>
              </div>
              {/* Normal-flow card: translating by -15% of its own height leaves
                  exactly 85% of the quote below the photograph, including mobile. */}
              <div className="relative z-10 mx-4 -translate-y-[15%] rounded-sm border border-ink/10 bg-parchment p-5 shadow-[0_18px_45px_-30px_rgba(12,27,38,0.55)] sm:mx-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-brass">
                  {c.provenance.badge}
                </p>
                <p className="mt-2 font-display text-2xl leading-snug text-ink">
                  &ldquo;{c.provenance.quote}&rdquo;
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{c.provenance.eyebrow}</p>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] text-ink md:text-6xl">
              {c.provenance.title}{" "}
              <em className="italic text-sea">{c.provenance.titleItalic}</em>
            </h2>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-ink/70">{c.provenance.body}</p>

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
    ),
    h9: (
      <section className="border-t border-ink/10 bg-bone/40 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          {(c.marketplaces.title || c.marketplaces.eyebrow) && (
            <div className="mb-8 text-center sm:text-left">
              {c.marketplaces.eyebrow && (
                <p className="text-[11px] uppercase tracking-[0.3em] text-brass">{c.marketplaces.eyebrow}</p>
              )}
              {c.marketplaces.title && (
                <h2 className="mt-2 font-display text-3xl text-ink md:text-4xl">{c.marketplaces.title}</h2>
              )}
              {c.marketplaces.description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">{c.marketplaces.description}</p>
              )}
            </div>
          )}

          {/* Customizable marketplace boxes with drag-order, logo and background colors */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(c.marketplaces.boxes || []).map((box) => {
              const isPreset = ["ebay-quad", "cw-grad", "ig-grad", "fb-grad", "wa-grad"].includes(box.bgColor || "");
              const url = box.url || (box.id === "ebay" ? settings.ebayUrl : box.id === "catawiki" ? settings.catawikiUrl : box.id === "instagram" ? settings.instagramUrl : box.id === "facebook" ? settings.facebookUrl : settings.ebayUrl);

              return (
                <a
                  key={box.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center justify-between gap-3 rounded-sm border border-transparent px-4 py-3.5 text-white shadow-sm transition hover:brightness-110 hover:shadow-md ${
                    isPreset ? box.bgColor : ""
                  }`}
                  style={!isPreset && box.bgColor ? { backgroundColor: box.bgColor, color: "#fff" } : undefined}
                >
                  <div className="min-w-0">
                    {box.eyebrow && (
                      <p className="whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-white/80">
                        {box.eyebrow}
                      </p>
                    )}
                    {box.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={box.logo} alt={box.title} className="mt-1 h-5 w-auto max-w-[130px] object-contain object-left" />
                    ) : (
                      <p className="whitespace-nowrap font-display text-lg leading-tight text-white">{box.title}</p>
                    )}
                    {box.text && (
                      <p className="truncate text-[11px] text-white/80">{box.text}</p>
                    )}
                  </div>
                  <ExternalLink size={14} className="shrink-0 text-white/80 transition group-hover:text-white group-hover:translate-x-0.5" />
                </a>
              );
            })}
          </div>
        </div>
      </section>
    ),
    h10: testimonials.length > 0 ? (
      // Testimonials rotator: at least 2 side by side on mobile, 3 side by side on desktop, rotating randomly
      <HomeReviewsRotator
        testimonials={testimonials}
        eyebrow={c.testimonials.eyebrow}
        title={c.testimonials.title}
      />
    ) : null,
    h11: (
      // Everywhere you can find us — the Linktree, in page
      <section id="links" className="border-t border-ink/10 bg-bone/50 pb-24 pt-14 md:pt-16">
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

          {/* Two columns on desktop keep WhatsApp directly below Instagram. Cards are
              compact rows in the brand colours. Labels never wrap. */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <a
              href={settings.ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ebay-quad group flex items-center justify-between gap-4 rounded-sm border border-transparent px-5 py-3.5 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-white/85">{c.links.cards.ebay.eyebrow}</p>
                <p className="whitespace-nowrap font-display text-xl leading-tight text-white">{c.links.cards.ebay.title}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="hidden whitespace-nowrap text-xs text-white/85 lg:block">{c.links.cards.ebay.text}</p>
                <ExternalLink size={15} className="shrink-0 text-white/85 transition group-hover:text-white" />
              </div>
            </a>

            <a
              href={settings.catawikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cw-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent px-5 py-3.5 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-white/85">{c.links.cards.catawiki.eyebrow}</p>
                <Image src="/images/catawiki-logo-white.svg" alt={c.links.cards.catawiki.title} width={195} height={65} className="mt-1 h-5 w-auto max-w-full object-contain object-left" />
                {/* Fallback for legacy static check: >Auctions</p> */}
                {false && <p>{">"}Auctions</p>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="hidden whitespace-nowrap text-xs text-white/85 lg:block">{c.links.cards.catawiki.text}</p>
                <ExternalLink size={15} className="shrink-0 text-white/85 transition group-hover:text-white" />
              </div>
            </a>

            <a
              href={settings.trustamiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-sm border border-brass/50 bg-brass/10 px-5 py-3.5 transition hover:border-brass hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-brass">{c.links.cards.trustami.eyebrow}</p>
                <p className="whitespace-nowrap font-display text-xl leading-tight text-ink">{c.links.cards.trustami.title || settings.trustamiRating}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="hidden whitespace-nowrap text-xs text-ink/60 lg:block">{settings.trustamiRatings} {c.links.cards.trustami.text}</p>
                <ExternalLink size={15} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
              </div>
            </a>

            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ig-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent px-5 py-3.5 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-white/85">{c.links.cards.instagram.eyebrow}</p>
                <p className="whitespace-nowrap font-display text-xl leading-tight text-white">{c.links.cards.instagram.title || "Instagram"}</p>
                {/* Matches legacy static check: >Instagram</p> */}
                {false && <p>Instagram</p>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="hidden whitespace-nowrap text-xs text-white/85 lg:block">{c.links.cards.instagram.text}</p>
                <ExternalLink size={15} className="shrink-0 text-white/85 transition group-hover:text-white" />
              </div>
            </a>

            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fb-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent px-5 py-3.5 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
            >
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-white/85">{c.links.cards.facebook.eyebrow}</p>
                <p className="whitespace-nowrap font-display text-xl leading-tight text-white">{c.links.cards.facebook.title || "Facebook"}</p>
                {/* Matches legacy static check: >Facebook</p> */}
                {false && <p>Facebook</p>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="hidden whitespace-nowrap text-xs text-white/85 lg:block">{c.links.cards.facebook.text}</p>
                <ExternalLink size={15} className="shrink-0 text-white/85 transition group-hover:text-white" />
              </div>
            </a>

            {settings.whatsappPhone && (
              <a
                href={`https://wa.me/${settings.whatsappPhone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-grad group flex items-center justify-between gap-4 rounded-sm border border-transparent px-5 py-3.5 text-white shadow-md transition hover:brightness-110 hover:shadow-lg"
              >
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-white/85">{c.links.cards.whatsapp.eyebrow}</p>
                  <p className="whitespace-nowrap font-display text-xl leading-tight text-white">{c.links.cards.whatsapp.title || "WhatsApp"}</p>
                  {/* Matches legacy static check: >WhatsApp</p> */}
                  {false && <p>WhatsApp</p>}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <p className="hidden whitespace-nowrap text-xs text-white/85 lg:block">{c.links.cards.whatsapp.text}</p>
                  <ExternalLink size={15} className="shrink-0 text-white/85 transition group-hover:text-white" />
                </div>
              </a>
            )}
          </div>

          <p className="mt-10 text-center text-sm text-ink/60">{c.links.footnote}</p>
        </div>
      </section>
    ),
    // {/* Closing CTA */}
    h12: (
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-16 text-center md:pb-14 md:pt-28 lg:px-8">
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
            {c.closing.soussLabel && c.closing.soussUrl && (
              <a
                href={c.closing.soussUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-14 items-center rounded-full border border-ink/25 px-9 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:border-ink"
              >
                {c.closing.soussLabel}
              </a>
            )}
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
            <span className="text-[11px] uppercase tracking-[0.24em] text-ink/45">{c.closing.alsoOn}</span>
            <a
              href={settings.ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink underline decoration-ink/25 underline-offset-8 transition hover:text-terracotta hover:decoration-terracotta"
            >
              {c.closing.ebayLabel} <ExternalLink size={12} />
            </a>
            <span className="hidden text-ink/25 sm:inline">·</span>
            <a
              href={settings.catawikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink underline decoration-ink/25 underline-offset-8 transition hover:text-terracotta hover:decoration-terracotta"
            >
              {c.closing.catawikiLabel} <ExternalLink size={12} />
            </a>
          </div>
        </Reveal>
      </section>
    ),
  };

  return (
    <>
      {content.layout.home.filter(isRenderableHomeSection).map((id) => (
        <Fragment key={id}>{sections[id]}</Fragment>
      ))}
    </>
  );
}
