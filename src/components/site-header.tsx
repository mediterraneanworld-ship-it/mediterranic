"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { selectItemCount, useCart, useHydrated } from "@/lib/cart-store";
import type { SiteContent } from "@/lib/site-content";

export function SiteHeader({ content }: { content: SiteContent["header"] }) {
  const NAV = [
    { href: "/shop", label: content.navShopAll },
    { href: "/shop?channel=direct", label: content.navSiteOnly },
    { href: "/shop?channel=ebay", label: content.navEbay },
    { href: "/shop?channel=catawiki", label: content.navCatawiki },
    { href: "/shop?collection=the-connoisseur", label: content.navConnoisseur },
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const openCart = useCart((s) => s.open);
  const count = useCart((s) => selectItemCount(s.items));
  const hydrated = useHydrated();

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-parchment/90 backdrop-blur-xl">
      {/* Customer-facing trust bar (no admin links here) */}
      <div className="bg-ink text-parchment">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-5 py-2 text-center text-[10px] uppercase tracking-[0.22em] lg:px-8">
          <span className="text-brass">{content.trustBar[0]}</span>
          <span className="hidden text-parchment/30 sm:inline">·</span>
          <span className="text-parchment/70">{content.trustBar[1]}</span>
          <span className="hidden text-parchment/30 sm:inline">·</span>
          <Link href="/shipping" className="text-parchment/70 underline-offset-4 transition hover:text-brass hover:underline">
            {content.trustBar[2]}
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <Link href="/" className="group flex items-center gap-3.5 leading-none" onClick={() => setMobileOpen(false)}>
          {content.logoImage && (
            <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-midnight ring-1 ring-brass/45 transition group-hover:ring-brass">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  content.logoImage === "/images/logo-mediterranic.png"
                    ? "/images/icon-mediterranic.png"
                    : content.logoImage
                }
                alt=""
                aria-hidden="true"
                className="h-11 w-11 scale-110 object-cover transition duration-300 group-hover:scale-115"
              />
            </span>
          )}
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.65rem] uppercase tracking-[0.22em] text-ink transition-colors group-hover:text-sea">
              Mediterranic
            </span>
            <span className="mt-1.5 text-[9px] uppercase tracking-[0.42em] text-brass">Moroccan Trilobites</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-[12px] uppercase tracking-[0.18em] transition-colors hover:text-terracotta ${
                  active ? "font-medium text-ink" : "text-ink/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart, ${hydrated ? count : 0} items`}
            className="relative grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-ink/5"
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            <AnimatePresence>
              {hydrated && count > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-semibold text-parchment"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-ink/5 lg:hidden"
          >
            {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.nav
            key="mobile-nav"
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-ink/10 lg:hidden"
          >
            <ul className="flex flex-col px-5 py-4">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-3.5 font-display text-2xl text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
