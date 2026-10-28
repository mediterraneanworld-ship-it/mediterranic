import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CartDrawer } from "@/components/cart-drawer";
import { MotionProvider } from "@/components/motion-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Mediterranic · Moroccan Trilobites for Collectors",
    template: "%s · Mediterranic",
  },
  description:
    "Museum-grade Moroccan trilobites from the Tafilalt, Anti-Atlas and Fezouata Shale. Certified, documented and delivered insured to collectors in North America, Europe and Japan.",
  openGraph: {
    title: "Mediterranic · Moroccan Trilobites",
    description:
      "Museum-grade Moroccan trilobites — Cambrian, Ordovician and Devonian. Nearly 23 years of specialist curatorship, verified on eBay and Catawiki.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2030",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
          <SiteHeader />
          <main className="min-h-[70svh]">{children}</main>
          <SiteFooter />
          <CartDrawer />
        </MotionProvider>
      </body>
    </html>
  );
}
