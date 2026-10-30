import type { Metadata } from "next";
import { AdminGate } from "@/components/admin-gate";
import {
  getAllOrdersWithItems,
  getAllProducts,
  getNewsletterSubscribers,
  getSiteSettings,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Curator Back-Office",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const [products, settings, orders, subscribers] = await Promise.all([
    getAllProducts({ includeDrafts: true }),
    getSiteSettings(),
    getAllOrdersWithItems(),
    getNewsletterSubscribers(2000),
  ]);

  return (
    <AdminGate
      products={products}
      settings={settings}
      orders={orders}
      subscribers={subscribers}
    />
  );
}
