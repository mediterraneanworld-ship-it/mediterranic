import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/collections";

export const dynamic = "force-dynamic";

/**
 * Dynamic sitemap: every published piece, collection and marketplace channel
 * is listed so search engines find new specimens as soon as they appear.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://shop.mediterranic.com").replace(/\/$/, "");
  const now = new Date();
  const products = await getAllProducts();

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/shop?channel=direct`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/shop?channel=catawiki`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/shop?channel=ebay`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...COLLECTIONS.map((c) => ({
      url: `${base}/shop?collection=${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...products
      .filter((p) => p.published)
      .map((p) => ({
        url: `${base}/shop/${p.slug}`,
        lastModified: p.createdAt ? new Date(p.createdAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ];

  return urls;
}
