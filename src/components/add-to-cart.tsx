"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";

export type CartableProduct = {
  slug: string;
  name: string;
  priceCents: number;
  image: string;
  stock: number;
  listingChannel?: string;
  externalListingUrl?: string | null;
};

export function AddToCart({ product }: { product: CartableProduct }) {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCart((s) => s.addItem);

  const maxQuantity = Math.min(product.stock, 10);
  const soldOut = product.stock <= 0;
  const channel = product.listingChannel; // undefined/null = not offered anywhere

  const handleAdd = () => {
    addItem(
      {
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        image: product.image,
        maxQuantity: product.stock,
      },
      quantity,
    );
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  if (soldOut) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          disabled
          className="h-14 w-full rounded-full bg-ink/10 text-[12px] uppercase tracking-[0.22em] text-ink/50"
        >
          Unavailable
        </button>
        <p className="text-sm text-ink/60">
          Each specimen is unique. Contact our studio if you wish to be notified when a comparable piece is prepared.
        </p>
      </div>
    );
  }

  if (channel === "catawiki" || channel === "ebay") {
    const platformName = channel === "catawiki" ? "Catawiki" : "eBay";
    const defaultUrl = channel === "catawiki" ? "https://www.catawiki.com" : "https://www.ebay.com";
    const targetUrl = product.externalListingUrl?.trim() || defaultUrl;

    return (
      <div className="space-y-4 rounded-sm border border-brass/50 bg-bone/70 p-6">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
              channel === "catawiki" ? "bg-brass text-ink" : "bg-sea text-parchment"
            }`}
          >
            Currently Live on {platformName}
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-ink/60">Direct checkout paused</span>
        </div>
        <p className="text-sm leading-relaxed text-ink/75">
          This specimen is currently featured in a live {platformName} listing. While active on {platformName}, direct
          website purchase is paused to prevent double-booking. If it remains unsold when the {platformName} listing
          closes, it will be released for direct sale exclusively here on Mediterranic.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta"
          >
            View Live Listing on {platformName} <ExternalLink size={15} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="inline-flex h-14 items-center justify-between rounded-full border border-ink/15 px-2 sm:w-40">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-ink/5 disabled:opacity-30"
          >
            <Minus size={15} />
          </button>
          <span className="text-base tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity}
            aria-label="Increase quantity"
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-ink/5 disabled:opacity-30"
          >
            <Plus size={15} />
          </button>
        </div>

        <motion.button
          type="button"
          onClick={handleAdd}
          whileTap={{ scale: 0.98 }}
          className={`relative inline-flex h-14 flex-1 items-center justify-center gap-3 overflow-hidden rounded-full text-[12px] uppercase tracking-[0.22em] transition-colors ${
            justAdded ? "bg-sea text-parchment" : "bg-ink text-parchment hover:bg-terracotta"
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {justAdded ? (
              <motion.span
                key="added"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="inline-flex items-center gap-2"
              >
                <Check size={16} /> Added to your cart
              </motion.span>
            ) : (
              <motion.span
                key="add"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="inline-flex items-center gap-2"
              >
                <ShoppingBag size={16} strokeWidth={1.5} />
                Add to cart · {formatPrice(product.priceCents * quantity)}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      {product.stock <= 3 && (
        <p className="text-sm text-terracotta">Only {product.stock} remaining. Each piece is one of a kind.</p>
      )}
    </div>
  );
}
