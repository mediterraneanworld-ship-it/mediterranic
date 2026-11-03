import type { Metadata } from "next";
import { ShopExplorer } from "@/components/shop-explorer";
import { getAllProducts, getSiteContent } from "@/lib/catalog";
import { publicProducts } from "@/lib/product-visibility";
import { offeredSpecimen } from "@/lib/inventory-rules";
import { normalizeShopPeriod } from "@/lib/shop-links";
import { getCollection } from "@/lib/collections";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ collection?: string; channel?: string; period?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { collection, period } = await searchParams;
  const match = collection ? getCollection(collection) : undefined;
  const validPeriod = normalizeShopPeriod(period);
  return {
    title: match ? match.title : validPeriod !== "all" ? `${validPeriod} specimens` : "The Collection",
    description:
      match?.description ??
      "Moroccan trilobites, minerals and instruments for the discerning collector — available directly on Mediterranic, or live on eBay and Catawiki.",
  };
}

export default async function ShopPage({ searchParams }: Props) {
  const { collection, channel, period } = await searchParams;
  const [products, content] = await Promise.all([getAllProducts(), getSiteContent()]);
  // Unavailable pieces lose their price before reaching the browser.
  const visible = publicProducts(products.filter(offeredSpecimen));

  return (
    <ShopExplorer
      products={visible}
      initialCollection={collection ?? "all"}
      initialChannel={channel ?? "all"}
      initialPeriod={period ?? "all"}
      copy={content.shop}
    />
  );
}
