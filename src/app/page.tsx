import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, ExternalLink, Gem, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { StarRating } from "@/components/star-rating";
import { COLLECTIONS } from "@/lib/collections";
import { collectionsOf } from "@/lib/product-collections";
import { getAllProducts, getSiteSettings, getStoreStats, getTopReviews } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, stats, testimonials, settings] = await Promise.all([
    getAllProducts(),
    getStoreStats(),
    getTopReviews(3),
    getSiteSettings(),
  ]);

  const featuredAll = products.filter((p) => p.featured);
  const featured = (featuredAll.length > 0 ? featuredAll : products).slice(0, 4);
  const collections = COLLECTIONS.map((c) => ({
    ...c,
    count: products.filter((p) => collectionsOf(p).includes(c.slug)).length,
  }));
  // The provenance panel always shows the whole seafloor plate.
  const story = products.find((p) => p.slug === "sandblasted-mortality-the-sandblasted-patriarch") ?? products[0];
  const directCount = products.filter((p) => (p.listingChannel ?? "direct") === "direct").length;
  const ebayCount = products.filter((p) => p.listingChannel === "ebay").length;
  const catawikiCount = products.filter((p) => p.listingChannel === "catawiki").length;

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
              {settings.heroEyebrow}
            </p>
            <h1
              className="animate-fade-up mt-6 font-display text-[clamp(3rem,6.5vw,6.5rem)] leading-[0.94] text-parchment"
              style={{ animationDelay: "0.15s" }}
            >
              {settings.heroTitle}{" "}
              <em className="font-normal italic text-brass">{settings.heroTitleItalic}</em>
            </h1>
            <p
              className="animate-fade-up mt-8 max-w-xl text-base leading-relaxed text-parchment/75 md:text-lg"
              style={{ animationDelay: "0.3s" }}
            >
              {settings.heroDescription}
            </p>
            <div className="animate-fade-up mt-10 flex flex-wrap gap-4" style={{ animationDelay: "0.45s" }}>
              <Link
                href="/shop"
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-parchment px-8 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:bg-brass"
              >
                Explore the collection
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#provenance"
                className="inline-flex h-14 items-center rounded-full border border-parchment/30 px-8 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:border-parchment hover:bg-parchment/5"
              >
                {settings.yearsExperience} years of provenance
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
                <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">{stats.productCount}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.25em] text-parchment/50 md:text-[11px]">Eras offered</dt>
                <dd className="mt-1 font-display text-4xl text-parchment md:text-5xl">3</dd>
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
                src={settings.heroImage || "/images/hero.jpg"}
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
              Hand-prepared · Anti-Atlas, Morocco
            </p>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-ink/10 bg-bone/70">
        <ul className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {[
            {
              icon: Award,
              title: `${settings.yearsExperience} years · eBay & Catawiki`,
              text: `${settings.feedbacksLabel} verified feedbacks from worldwide collectors`,
            },
            {
              icon: Truck,
              title: "23 years of shipping mastery",
              text: "Custom crating & insured delivery to USA, Europe & Japan",
            },
            {
              icon: ShieldCheck,
              title: "Certificate of authenticity",
              text: "Every piece ships with signed geological documentation",
            },
            {
              icon: RotateCcw,
              title: "30-day considered returns",
              text: "Examine in your study with complete peace of mind",
            },
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
              <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Where to acquire our specimens</p>
              <h2 className="mt-2 font-display text-4xl text-ink md:text-5xl">
                Three live channels — one single standard
              </h2>
            </div>
            <p className="max-w-md text-sm text-ink/65">
              We keep 20 to 40 curated pieces active at a time. Some are exclusively available here; others are
              currently on live auction on eBay or Catawiki and return here if unsold.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Link
              href="/shop?channel=direct"
              className="group flex flex-col justify-between rounded-sm border border-ink/15 bg-white/80 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-parchment">
                    <span className="h-1.5 w-1.5 rounded-full bg-brass" /> Only on This Site
                  </span>
                  <span className="font-display text-3xl text-ink">{directCount}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl text-ink">Direct Storefront Exclusives</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  Available for immediate acquisition right here on Mediterranic, with no auction wait and no third-party
                  buyer premiums.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sea group-hover:translate-x-1 transition-transform">
                Browse Site Exclusives <ArrowRight size={13} />
              </span>
            </Link>

            <Link
              href="/shop?channel=ebay"
              className="group flex flex-col justify-between rounded-sm border border-ink/15 bg-white/80 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-sea px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-parchment">
                    <span className="h-1.5 w-1.5 rounded-full bg-parchment animate-pulse" /> Live on eBay
                  </span>
                  <span className="font-display text-3xl text-ink">{ebayCount}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl text-ink">Currently Listed on eBay</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  Specimens currently active in our verified eBay store. Direct website checkout is paused while live;
                  unsold pieces return exclusively to this site.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sea group-hover:translate-x-1 transition-transform">
                View eBay Specimens <ArrowRight size={13} />
              </span>
            </Link>

            <Link
              href="/shop?channel=catawiki"
              className="group flex flex-col justify-between rounded-sm border border-ink/15 bg-white/80 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brass px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulse" /> Live on Catawiki
                  </span>
                  <span className="font-display text-3xl text-ink">{catawikiCount}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl text-ink">Currently on Catawiki Auction</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  Featured in curated Catawiki Natural History auctions. Follow the live bidding link, or acquire here
                  if the reserve is not met.
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sea group-hover:translate-x-1 transition-transform">
                View Catawiki Lots <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Curated collections</p>
          <h2 className="mt-4 max-w-2xl font-display text-5xl leading-[1.02] text-ink md:text-6xl">
            Four ways into deep time
          </h2>
          <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-ink/50">
            Cambrian · Ordovician · Devonian · Museum grade
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.12}>
              <Link
                href={`/shop?collection=${c.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-sm bg-midnight text-parchment"
              >
                <Image
                  src={c.cover}
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
              <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Most collected</p>
              <h2 className="mt-4 font-display text-5xl leading-[1.02] text-ink md:text-6xl">
                Pieces our collectors keep returning to
              </h2>
            </div>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.22em] text-ink hover:text-terracotta"
            >
              View all specimens
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
                src={settings.provenanceImage || story?.images[0]?.src || "/images/seafloor-plate.jpg"}
                alt="A whole seafloor sealed in stone"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute bottom-5 left-5 right-5 rounded-sm bg-parchment/95 p-5 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.28em] text-brass">
                  Established reputation · {settings.yearsExperience} years
                </p>
                <p className="mt-2 font-display text-2xl leading-snug text-ink">
                  &ldquo;A whole seafloor, sealed in stone. Packed by hands that have shipped thousands of delicate
                  specimens across the Northern Hemisphere.&rdquo;
                </p>
              </div>
              <span className="absolute right-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-parchment backdrop-blur">
                Whole plate · top view
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{settings.provenanceEyebrow}</p>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] text-ink md:text-6xl">
              {settings.provenanceTitle}{" "}
              <em className="italic text-sea">{settings.provenanceTitleItalic}</em>
            </h2>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-ink/70">{settings.provenanceBody}</p>

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
                {
                  n: "01",
                  title: "Licensed at source in Morocco",
                  text: "Every specimen is acquired directly from trusted quarry families in the Tafilalt and Anti-Atlas, traceable to a named locality and formation.",
                },
                {
                  n: "02",
                  title: "Prepared with collector honesty",
                  text: "Cleaned under magnification with full transparency regarding matrix and restoration — the standard that earned us thousands of five-star feedbacks.",
                },
                {
                  n: "03",
                  title: "Battle-tested international shipping",
                  text: "Nearly 23 years of custom suspension-packing ensures fragile spines and matrix slabs arrive intact in the US, UK, EU, Switzerland, Canada and Japan.",
                },
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
              {settings.feedbacksLabel} verified feedbacks across eBay, Catawiki &amp; direct clients
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-center font-display text-5xl leading-[1.02] md:text-6xl">
              From collectors who have been where you are
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
            <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Everywhere we are</p>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-5xl leading-[1.02] text-ink md:text-6xl">
              One catalogue, many places to find us
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink/65">
              The same specimens are also listed on eBay and Catawiki. Choose where you prefer to buy — the price and the
              certificate are identical.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href={settings.ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-sm border border-ink/15 bg-white/90 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-brass">Marketplace</p>
                <p className="mt-2 font-display text-3xl text-ink">eBay store</p>
                <p className="mt-1 text-sm text-ink/60">Fixed prices and best offers</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
            </a>

            <a
              href={settings.catawikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-sm border border-ink/15 bg-white/90 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-brass">Auctions</p>
                <p className="mt-2 font-display text-3xl text-ink">Catawiki</p>
                <p className="mt-1 text-sm text-ink/60">Weekly Natural History auctions</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
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
              className="group flex items-center justify-between gap-4 rounded-sm border border-ink/15 bg-white/90 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-brass">Photography</p>
                <p className="mt-2 font-display text-3xl text-ink">Instagram</p>
                <p className="mt-1 text-sm text-ink/60">New arrivals and macro detail</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
            </a>

            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-sm border border-ink/15 bg-white/90 p-6 transition hover:border-ink hover:shadow-md"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-brass">Community</p>
                <p className="mt-2 font-display text-3xl text-ink">Facebook</p>
                <p className="mt-1 text-sm text-ink/60">Fossils from Morocco</p>
              </div>
              <ExternalLink size={18} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
            </a>

            {settings.whatsappPhone && (
              <a
                href={`https://wa.me/${settings.whatsappPhone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-sm border border-sea/40 bg-sea/5 p-6 transition hover:border-sea hover:shadow-md"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-brass">Direct</p>
                  <p className="mt-2 font-display text-3xl text-ink">WhatsApp</p>
                  <p className="mt-1 text-sm text-ink/60">Ask for photos or a shipping quote</p>
                </div>
                <ExternalLink size={18} className="shrink-0 text-ink/40 transition group-hover:text-terracotta" />
              </a>
            )}
          </div>

          <p className="mt-10 text-center text-sm text-ink/60">
            Scientific references for our Cambrian and Ordovician material are published on our{" "}
            <a
              href={settings.catawikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-brass underline-offset-4 hover:text-ink"
            >
              Catawiki seller page
            </a>
            .
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-5 py-28 text-center lg:px-8">
        <Reveal>
          <div className="hairline mx-auto mb-12 w-40" />
          <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[1.02] text-ink md:text-7xl">
            Begin with one specimen, <em className="italic text-terracotta">or a whole shelf.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink/65">
            From a Miniature for the desk to a Museum-scale monarch, every piece arrives documented, insured and ready
            to be lived with. Direct enquiries welcome at{" "}
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
              Shop the collection
            </Link>
            <Link
              href="/shop?collection=cambrian-dawn"
              className="inline-flex h-14 items-center rounded-full border border-ink/25 px-9 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:border-ink"
            >
              The Cambrian Dawn
            </Link>
          </div>

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
