import type { Metadata } from "next";
import { ShopExplorer } from "@/components/shop-explorer";
import { getAllProducts } from "@/lib/catalog";
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
  const products = await getAllProducts();

  return (
    <ShopExplorer
      products={products}
      initialCollection={collection ?? "all"}
      initialChannel={channel ?? "all"}
    />
  );
}
