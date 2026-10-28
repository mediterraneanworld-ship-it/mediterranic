"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { useEffect } from "react";
import { formatPrice } from "@/lib/format";
import { selectItemCount, selectSubtotal, useCart, useHydrated } from "@/lib/cart-store";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close]);

  const visibleItems = hydrated ? items : [];
  const subtotal = selectSubtotal(visibleItems);
  const count = selectItemCount(visibleItems);
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD_CENTS) * 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cart-backdrop"
            onClick={close}
            className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.aside
            key="cart-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col bg-parchment shadow-[-30px_0_80px_rgba(11,29,42,0.25)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-brass">Your selection</p>
                <h2 className="font-display text-3xl text-ink">
                  Cart <span className="text-ink/40">({count})</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close cart"
                className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-ink/5"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {visibleItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-bone text-sea">
                  <ShoppingBag strokeWidth={1.2} />
                </div>
                <p className="font-display text-3xl text-ink">Your cabinet is empty</p>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink/60">
                  Every specimen is unique and documented. When one catches your eye, it will wait for you here.
                </p>
                <Link
                  href="/shop"
                  onClick={close}
                  className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-8 text-[12px] uppercase tracking-[0.2em] text-parchment transition hover:bg-sea"
                >
                  Browse the collection
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                  <AnimatePresence initial={false}>
                    {visibleItems.map((item) => (
                      <motion.li
                        key={item.slug}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.35 }}
                        className="flex gap-4"
                      >
                        <Link
                          href={`/shop/${item.slug}`}
                          onClick={close}
                          className="relative h-28 w-24 shrink-0 overflow-hidden rounded-sm bg-bone"
                        >
                          <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <Link href={`/shop/${item.slug}`} onClick={close} className="font-display text-xl leading-tight text-ink hover:text-sea">
                              {item.name}
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeItem(item.slug)}
                              aria-label={`Remove ${item.name}`}
                              className="rounded-full p-1.5 text-ink/40 transition hover:bg-ink/5 hover:text-terracotta"
                            >
                              <Trash2 size={15} strokeWidth={1.5} />
                            </button>
                          </div>
                          <p className="mt-1 text-sm text-ink/60">{formatPrice(item.priceCents)}</p>
                          <div className="mt-auto flex items-center justify-between pt-3">
                            <div className="inline-flex items-center rounded-full border border-ink/15">
                              <button
                                type="button"
                                onClick={() => setQuantity(item.slug, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                aria-label="Decrease quantity"
                                className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-30"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="w-7 text-center text-sm tabular-nums">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => setQuantity(item.slug, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                aria-label="Increase quantity"
                                className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-30"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            <span className="text-sm font-medium text-ink">
                              {formatPrice(item.priceCents * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <div className="space-y-5 border-t border-ink/10 bg-bone/60 px-6 py-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-ink/70">
                      <span className="flex items-center gap-2">
                        <Truck size={14} strokeWidth={1.5} />
                        {remaining > 0
                          ? `Add ${formatPrice(remaining)} for complimentary insured shipping`
                          : "Complimentary insured shipping unlocked"}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-ink/10">
                      <motion.div
                        className="h-full rounded-full bg-brass"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink/70">Subtotal</span>
                    <span className="font-display text-3xl text-ink">{formatPrice(subtotal)}</span>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-ink/55">
                    <ShieldCheck size={14} strokeWidth={1.5} />
                    Shipping is calculated at checkout. Duties and local taxes are shown before you pay.
                  </p>

                  <Link
                    href="/checkout"
                    onClick={close}
                    className="flex h-14 w-full items-center justify-center rounded-full bg-ink text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta"
                  >
                    Proceed to checkout
                  </Link>
                  <button
                    type="button"
                    onClick={close}
                    className="w-full text-center text-[12px] uppercase tracking-[0.2em] text-ink/60 transition hover:text-ink"
                  >
                    Continue browsing
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
