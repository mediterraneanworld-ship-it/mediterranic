import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Play, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { ChannelBanner } from "@/components/channel-badge";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ReviewForm } from "@/components/review-form";
import { StarRating } from "@/components/star-rating";
import {
  getAllProducts,
  getProductBySlug,
  getProductReviews,
  getRatingBreakdown,
  getSiteSettings,
} from "@/lib/catalog";
import { getCollection } from "@/lib/collections";
import { collectionsOf } from "@/lib/product-collections";
import { formatDate, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Specimen not found" };
  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: { title: product.name, description: product.shortDescription, images: [product.images[0].src] },
  };
}

type VideoSource =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "file"; url: string }
  | { kind: "link"; url: string };

function resolveVideo(url: string | null | undefined): VideoSource | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const youtube = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,15})/,
  );
  if (youtube) return { kind: "youtube", id: youtube[1] };

  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vimeo) return { kind: "vimeo", id: vimeo[1] };

  if (/\.(mp4|webm|mov|m4v)($|\?)/i.test(trimmed)) return { kind: "file", url: trimmed };
  // Anything else that is still a web address becomes an explicit link rather
  // than being silently dropped.
  if (/^https?:\/\//i.test(trimmed)) return { kind: "link", url: trimmed };
  return null;
}

function SpecimenVideo({ video, name }: { video: VideoSource; name: string }) {
  if (video.kind === "link") {
    return (
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-sm border border-sea/30 bg-sea/5 px-4 py-3.5 transition hover:border-sea"
      >
        <Play size={18} strokeWidth={1.5} className="shrink-0 text-sea" />
        <span>
          <span className="block text-[11px] uppercase tracking-[0.2em] text-sea">Specimen film</span>
          <span className="block text-sm text-ink/75">Watch the film of this piece →</span>
        </span>
      </a>
    );
  }

  return (
    <div className="rounded-sm border border-ink/10 bg-white/60 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-brass">Specimen film</p>
      <div className="relative aspect-video overflow-hidden rounded-sm bg-ink">
        {video.kind === "youtube" && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1`}
            title={`${name} — specimen film`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        )}
        {video.kind === "vimeo" && (
          <iframe
            src={`https://player.vimeo.com/video/${video.id}`}
            title={`${name} — specimen film`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        )}
        {video.kind === "file" && (
          <video
            src={video.url}
            controls
            preload="metadata"
            playsInline
            className="absolute inset-0 h-full w-full"
          />
        )}
      </div>
    </div>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, breakdown, allProducts, settings] = await Promise.all([
    getProductReviews(product.id),
    getRatingBreakdown(product.id),
    getAllProducts(),
    getSiteSettings(),
  ]);

  const productCollections = collectionsOf(product);
  const collection = getCollection(productCollections[0] ?? product.collection);
  const related = allProducts
    .filter((p) => p.slug !== product.slug)
    .map((p) => ({
      p,
      score: (p.collection === product.collection ? 2 : 0) + (p.period === product.period ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.p.id - b.p.id)
    .slice(0, 4)
    .map((x) => x.p);

  const totalReviews = reviews.length;
  const video = resolveVideo(product.videoUrl);
  const isAuction = product.listingChannel === "catawiki" || product.listingChannel === "ebay";
  const discount =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.compareAtCents) * 100)
      : null;

  const specs: [string, string | null][] = [
    ["Species", product.species],
    ["Period", product.period],
    ["Formation", product.formation],
    ["Locality", product.locality],
    ["Length", product.lengthMm ? `${product.lengthMm} mm` : null],
    ["Preparation", product.preparation],
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-[0.2em] text-ink/50">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="hover:text-ink">Shop</Link>
          </li>
          {collection && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/shop?collection=${collection.slug}`} className="hover:text-ink">
                  {collection.title}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li className="text-ink/80">{product.name}</li>
        </ol>
      </nav>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start space-y-6">
          <ProductGallery images={product.images} name={product.name} />
          {video && <SpecimenVideo video={video} name={product.name} />}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-brass">
            {productCollections.map((slug) => getCollection(slug)?.title).filter(Boolean).join(" · ")}
            {product.period ? ` · ${product.period}` : ""}
          </p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">{product.name}</h1>
          <p className="mt-3 font-display text-2xl italic text-ink/60">{product.species}</p>

          <ChannelBanner
            channel={product.listingChannel}
            externalUrl={product.externalListingUrl}
            soldOut={product.stock <= 0}
          />

          <a href="#reviews" className="mt-6 inline-flex items-center gap-3 text-sm text-ink/70 transition hover:text-ink">
            {totalReviews > 0 ? (
              <>
                <StarRating rating={product.rating} size={16} />
                <span>
                  {product.rating.toFixed(1)} · {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                </span>
              </>
            ) : (
              <span>Be the first to review this specimen</span>
            )}
          </a>

          <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-ink/10 pt-8">
            {product.stock <= 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-ink/50">Availability</p>
                <a
                  href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Similar specimen to ${product.name}`)}`}
                  className="font-display text-3xl text-ink/70 underline decoration-ink/25 underline-offset-4 transition hover:text-terracotta hover:decoration-terracotta md:text-4xl"
                >
                  Request a similar specimen
                </a>
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-ink/50">
                  {isAuction ? "Current price" : "Price"}
                </p>
                <span className="font-display text-5xl text-ink">{formatPrice(product.priceCents)}</span>
              </div>
            )}
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <>
                <span className="text-lg text-ink/40 line-through">{formatPrice(product.compareAtCents)}</span>
                <span className="rounded-full bg-terracotta/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-terracotta">
                  Save {discount}%
                </span>
              </>
            )}
          </div>

          <p className="mt-6 text-lg leading-relaxed text-ink/75">{product.shortDescription}</p>

          <div className="mt-8">
            <AddToCart
              product={{
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                image: product.images[0].src,
                stock: product.stock,
                listingChannel: product.listingChannel,
                externalListingUrl: product.externalListingUrl,
              }}
            />
          </div>

          <ul className="mt-10 grid gap-4 text-sm text-ink/70">
            {product.hasCertificate ? (
              <li className="flex items-start gap-3">
                <ShieldCheck size={18} strokeWidth={1.4} className="mt-0.5 shrink-0 text-sea" />
                Signed certificate of authenticity and geological data card included
              </li>
            ) : (
              <li className="flex items-start gap-3">
                <ShieldCheck size={18} strokeWidth={1.4} className="mt-0.5 shrink-0 text-ink/35" />
                Offered without a certificate of authenticity — condition is described in full above
              </li>
            )}
            <li className="flex items-start gap-3">
              <Truck size={18} strokeWidth={1.4} className="mt-0.5 shrink-0 text-sea" />
              Fully insured delivery. Complimentary standard shipping over €450
            </li>
            <li className="flex items-start gap-3">
              <RotateCcw size={18} strokeWidth={1.4} className="mt-0.5 shrink-0 text-sea" />
              30-day considered returns, no questions about why
            </li>
          </ul>

          <dl className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
            {specs
              .filter((row): row is [string, string] => Boolean(row[1]))
              .map(([label, value]) => (
                <div key={label} className="grid grid-cols-[140px_1fr] gap-4 py-4 text-sm">
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-ink/50">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {/* Story & provenance */}
      <section className="mt-32 grid gap-16 border-t border-ink/10 pt-20 lg:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-brass">The specimen</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-ink md:text-5xl">About this piece</h2>
          <p className="mt-8 text-base leading-[1.8] text-ink/75">{product.description}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Provenance</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-ink md:text-5xl">Where it came from</h2>
          <p className="mt-8 text-base leading-[1.8] text-ink/75">{product.provenance}</p>
          <div className="mt-8 flex items-start gap-4 rounded-sm bg-bone p-6">
            <Check size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-sea" />
            <p className="text-sm leading-relaxed text-ink/75">
              Accompanied by a signed certificate of authenticity from Mediterranic specialists and a geological data
              card recording locality, formation and age.
            </p>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="mt-32 scroll-mt-28 border-t border-ink/10 pt-20">
        <div className="grid gap-16 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-10 lg:sticky lg:top-28 lg:self-start">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Collector reviews</p>
              <h2 className="mt-4 font-display text-4xl text-ink md:text-5xl">What owners say</h2>
              {totalReviews > 0 ? (
                <div className="mt-8 flex items-end gap-5">
                  <span className="font-display text-7xl leading-none text-ink">{product.rating.toFixed(1)}</span>
                  <div className="pb-2">
                    <StarRating rating={product.rating} size={18} />
                    <p className="mt-2 text-sm text-ink/60">
                      Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-6 text-sm text-ink/60">No reviews yet. Owners are invited to share their experience below.</p>
              )}

              {totalReviews > 0 && (
                <ul className="mt-8 space-y-3">
                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const count = breakdown[star];
                    const pct = totalReviews ? (count / totalReviews) * 100 : 0;
                    return (
                      <li key={star} className="grid grid-cols-[32px_1fr_32px] items-center gap-3 text-sm">
                        <span className="text-ink/60">{star}★</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                          <span className="block h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-right text-ink/50 tabular-nums">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <ReviewForm productSlug={product.slug} />
          </aside>

          <div>
            {reviews.length === 0 ? (
              <div className="rounded-sm border border-dashed border-ink/20 p-10 text-center text-ink/60">
                Be the first collector to share a review of {product.name}.
              </div>
            ) : (
              <ul className="divide-y divide-ink/10">
                {reviews.map((review) => (
                  <li key={review.id} className="py-9 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <StarRating rating={review.rating} size={14} />
                      <time dateTime={new Date(review.createdAt).toISOString()} className="text-xs text-ink/50">
                        {formatDate(review.createdAt)}
                      </time>
                    </div>
                    <h3 className="mt-4 font-display text-2xl text-ink">{review.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-ink/75">{review.body}</p>
                    <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/60">
                      <span className="font-medium text-ink">{review.authorName}</span>
                      <span>·</span>
                      <span>{review.authorCountry}</span>
                      {review.verifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sea/10 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-sea">
                          <Check size={11} /> Verified owner
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-32 border-t border-ink/10 pt-20">
          <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Pairs well with</p>
              <h2 className="mt-4 font-display text-4xl text-ink md:text-5xl">Further from the same shelf</h2>
            </div>
            <Link href="/shop" className="text-[12px] uppercase tracking-[0.2em] text-ink hover:text-terracotta">
              Back to the collection
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
