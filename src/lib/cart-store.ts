"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type CartItem = {
  slug: string;
  name: string;
  priceCents: number;
  image: string;
  quantity: number;
  /** Current stock at the time the item was added; quantity never exceeds it. */
  maxQuantity: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clear: () => void;
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      addItem: (item, quantity = 1) => {
        if (item.maxQuantity <= 0) return;
        const existing = get().items.find((i) => i.slug === item.slug);
        if (existing) {
          set({
            isOpen: true,
            items: get().items.map((i) =>
              i.slug === item.slug
                ? {
                    ...i,
                    priceCents: item.priceCents,
                    maxQuantity: item.maxQuantity,
                    quantity: Math.min(item.maxQuantity, i.quantity + quantity),
                  }
                : i,
            ),
          });
        } else {
          set({
            isOpen: true,
            items: [
              ...get().items,
              { ...item, quantity: Math.min(item.maxQuantity, Math.max(1, quantity)) },
            ],
          });
        }
      },
      setQuantity: (slug, quantity) =>
        set({
          items: get()
            .items.map((i) =>
              i.slug === slug
                ? { ...i, quantity: Math.max(1, Math.min(i.maxQuantity, quantity)) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        }),
      removeItem: (slug) => set({ items: get().items.filter((i) => i.slug !== slug) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "mediterranic-cart",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export function selectItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function selectSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true once the client has mounted. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
