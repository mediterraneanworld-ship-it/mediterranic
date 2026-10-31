import type { Metadata } from "next";
import { ShopExplorer } from "@/components/shop-explorer";
import { getAllProducts, getSiteContent } from "@/lib/catalog";
import { publicProducts } from "@/lib/product-visibility";
import { getCollection } from "@/lib/collections";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ collection?: string; channel?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { collection } = await searchParams;
  const match = collection ? getCollection(collection) : undefined;
  return {
    title: match ? match.title : "The Collection",
    description:
      match?.description ??
      "Moroccan trilobites, minerals and instruments for the discerning collector — available directly on Mediterranic, or live on eBay and Catawiki.",
  };
}

export default async function ShopPage({ searchParams }: Props) {
  const { collection, channel } = await searchParams;
  const [products, content] = await Promise.all([getAllProducts(), getSiteContent()]);
  // Unavailable pieces lose their price before reaching the browser.
  const visible = publicProducts(products.filter((p) => !p.archived));

  return (
    <ShopExplorer
      products={visible}
      initialCollection={collection ?? "all"}
      initialChannel={channel ?? "all"}
      copy={content.shop}
    />
  );
}
