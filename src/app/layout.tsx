import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { BackToTop } from "@/components/back-to-top";
import { CartDrawer } from "@/components/cart-drawer";
import { MotionProvider } from "@/components/motion-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteContent } from "@/lib/catalog";
import { PUBLIC_SITE_URL } from "@/lib/site-url";
import { SiteAnalytics } from "@/components/site-analytics";

export const dynamic = "force-dynamic";

/**
 * Icons come from the back-office ("Brand · logo & favicon"), so the curator
 * can upload their own favicon. Defaults live in /public.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const favicon = content.site.favicon.trim() || "/images/favicon-m-caribbean.png";
  const faviconType = favicon.endsWith(".svg") ? "image/svg+xml" : favicon.endsWith(".png") ? "image/png" : favicon.endsWith(".ico") ? "image/x-icon" : undefined;
  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title: {
      default: "Mediterranic · Moroccan Trilobites for Collectors",
      template: "%s · Mediterranic",
    },
    description:
      "Museum-grade Moroccan trilobites from the Tafilalt, Anti-Atlas and Fezouata Shale. Certified, documented and delivered with care to collectors in North America, Europe and Japan.",
    icons: {
      icon: [
        { url: favicon, type: faviconType },
      ],
      shortcut: [{ url: favicon, type: faviconType }],
      apple: [{ url: favicon }],
    },
    openGraph: {
      title: "Mediterranic · Moroccan Trilobites",
      description:
        "Museum-grade Moroccan trilobites — Cambrian, Ordovician and Devonian. Nearly 23 years of specialist curatorship, verified on eBay and Catawiki.",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b2030",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const content = await getSiteContent();
  const customAnalytics = content.analytics.bodyScripts.trim();
  const usesStatcounter = !customAnalytics || /statcounter/i.test(customAnalytics);
  const project = Number(customAnalytics.match(/sc_project\s*=\s*([0-9]+)/)?.[1] ?? 13364233);
  const security = customAnalytics.match(/sc_security\s*=\s*["']([a-z0-9]+)["']/i)?.[1] ?? "b5ec7882";

  return (
    <html lang="en" translate="yes">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap"
        />
      </head>
      <body className="min-h-svh bg-parchment font-sans text-ink antialiased">
        <MotionProvider>
          <SiteHeader content={content.header} />
          <main id="main-content" tabIndex={-1} className="min-h-[70svh] focus:outline-none">
            {children}
          </main>
          <SiteFooter />
          <CartDrawer freeShipping={content.commerce.freeShipping} />
          <BackToTop />
          {usesStatcounter && <SiteAnalytics project={project} security={security} enabled={content.analytics.enabled} />}
        </MotionProvider>
        {content.analytics.enabled && !usesStatcounter && customAnalytics !== "" && (
          <div
            aria-hidden
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: content.analytics.bodyScripts }}
          />
        )}
      </body>
    </html>
  );
}
