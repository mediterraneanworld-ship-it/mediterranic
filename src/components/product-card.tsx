import Image from "next/image";
import Link from "next/link";
import { ChannelPill, normalizeChannel } from "@/components/channel-badge";
import { StarRating } from "@/components/star-rating";
import type { ProductWithStats } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";

export function ProductCard({ product, priority = false }: { product: ProductWithStats; priority?: boolean }) {
  const soldOut = product.stock <= 0;
  const onSale = product.compareAtCents && product.compareAtCents > product.priceCents;
  const channel = normalizeChannel(product.listingChannel);

  return (
    <Link href={`/shop/${product.slug}`} className="group block focus-visible:outline-none">
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-bone">
        <Image
          src={product.images[0].src}
          alt={product.images[0].alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
          className={`object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06] ${soldOut ? "opacity-60 grayscale" : ""}`}
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-1.5 p-3">
          {product.period ? (
            <span className="rounded-full bg-parchment/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink backdrop-blur">
              {product.period}
            </span>
          ) : (
            <span />
          )}

          <ChannelPill channel={channel} soldOut={soldOut} />
        </div>
        <div className="absolute inset-x-3 bottom-3 translate-y-2 rounded-sm bg-ink/90 py-3 text-center text-[11px] uppercase tracking-[0.25em] text-parchment opacity-0 backdrop-blur transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          {soldOut
            ? "Unavailable"
            : channel === "catawiki"
              ? "Live on Catawiki · View details"
              : channel === "ebay"
                ? "Live on eBay · View details"
                : "Site Exclusive · View specimen"}
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight text-ink">{product.name}</h3>
        </div>
        <p className="text-sm italic text-ink/60">{product.species}</p>
        <div className="flex items-center justify-between pt-1">
          {soldOut ? (
            /* Price is never shown for a piece that is no longer available. */
            <span className="text-sm text-ink/45">Request a similar specimen</span>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-medium text-ink">{formatPrice(product.priceCents)}</span>
              {onSale && (
                <span className="text-sm text-ink/40 line-through">{formatPrice(product.compareAtCents!)}</span>
              )}
            </div>
          )}
          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-ink/60">
              <StarRating rating={product.rating} size={12} />
              <span>({product.reviewCount})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
