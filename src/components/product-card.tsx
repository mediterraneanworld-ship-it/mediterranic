import Image from "next/image";
import Link from "next/link";
import { ChannelPill, normalizeChannel } from "@/components/channel-badge";
import { StarRating } from "@/components/star-rating";
import type { ProductWithStats } from "@/lib/catalog";
import { isAvailable } from "@/lib/product-visibility";
import { shopChannelHref, shopPeriodFromLabel } from "@/lib/shop-links";
import { formatPrice } from "@/lib/format";

export function ProductCard({ product, priority = false }: { product: ProductWithStats; priority?: boolean }) {
  // Not for sale: archived, out of stock, or offered on no channel at all.
  const soldOut = !isAvailable(product);
  const onSale = !soldOut && product.compareAtCents && product.compareAtCents > product.priceCents;
  const channel = normalizeChannel(product.listingChannel);
  const period = shopPeriodFromLabel(product.period);
  const channelName = channel === "ebay" ? "eBay" : channel === "catawiki" ? "Catawiki" : "Site Only";

  return (
    <article className="group block">
      {/* Category labels sit ABOVE the photograph and have their own links. */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-1.5">
        {product.period ? (
          period ? (
            <Link
              href={`/shop?period=${encodeURIComponent(period)}`}
              aria-label={`View all ${period} specimens`}
              className="rounded-full bg-bone px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink/75 transition hover:bg-brass/20 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea sm:tracking-[0.2em]"
            >
              {product.period}
            </Link>
          ) : (
            <span className="rounded-full bg-bone px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink/75 sm:tracking-[0.2em]">
              {product.period}
            </span>
          )
        ) : (
          <span />
        )}
        {!soldOut && channel ? (
          <Link
            href={shopChannelHref(channel) ?? "/shop"}
            aria-label={`View all ${channelName} specimens`}
            className="rounded-full transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2"
          >
            <ChannelPill channel={channel} />
          </Link>
        ) : (
          <ChannelPill channel={null} soldOut={soldOut} />
        )}
      </div>

      <Link
        href={`/shop/${product.slug}`}
        className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-4"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-bone">
          <Image
            src={product.images[0].src}
            alt={product.images[0].alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
            className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
          />
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
    </article>
  );
}
