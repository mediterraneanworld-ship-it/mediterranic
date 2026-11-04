import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getAllProducts } from "@/lib/catalog";
import { getNewsletterSettings, selectNewsletterPieces } from "@/lib/newsletter-send";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Featured and New Pieces",
  description:
    "Featured specimens and the newest arrivals at Mediterranic — museum-grade Moroccan trilobites, documented and ready to ship.",
};

/** Current curator selection, with availability rechecked whenever the page opens. */
export default async function FeaturedPage() {
  const [products, settings] = await Promise.all([getAllProducts(), getNewsletterSettings()]);
  const byId = new Map(products.map((product) => [product.id, product]));
  const pieces = selectNewsletterPieces(products, settings.pieceIds).flatMap(({ id }) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 lg:px-8">
      <header className="mb-12 border-b border-ink/10 pb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Field notes · Every 15 days</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.02] text-ink md:text-6xl">Featured and New Pieces</h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/65">
          A short selection of specimens currently offered — featured pieces and the newest arrivals. Every piece
          is unique; when one sells, it is gone.
        </p>
      </header>

      {pieces.length === 0 ? (
        <div className="rounded-sm border border-dashed border-ink/20 px-8 py-20 text-center">
          <p className="font-display text-4xl text-ink">New pieces are being prepared</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-ink/60">
            The next selection is on its way. Browse the full collection in the meantime.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-8 text-[12px] uppercase tracking-[0.2em] text-parchment transition hover:bg-terracotta"
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
          {pieces.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
