import { PUBLIC_SITE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = PUBLIC_SITE_URL;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/checkout", "/orders/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
