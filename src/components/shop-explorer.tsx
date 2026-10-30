"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProductCard } from "@/components/product-card";
import { COLLECTIONS, getCollection } from "@/lib/collections";
import type { ProductWithStats } from "@/lib/catalog";
import { collectionsOf } from "@/lib/product-collections";

type Category = "all" | "specimen" | "accessory";
type Period = "all" | "Cambrian" | "Ordovician" | "Devonian";
type PriceBand = "all" | "under-500" | "500-1500" | "over-1500";
type Channel = "all" | "direct" | "catawiki" | "ebay";
type Sort = "featured" | "price-asc" | "price-desc" | "rating" | "name";

type Filters = {
  query: string;
  collection: string; // "all" or collection slug
  channel: Channel;
  category: Category;
  period: Period;
  price: PriceBand;
  inStockOnly: boolean;
};

const DEFAULT_FILTERS: Filters = {
  query: "",
  collection: "all",
  channel: "all",
  category: "all",
  period: "all",
  price: "all",
  inStockOnly: false,
};

const CHANNEL_LABELS: Record<Channel, string> = {
  all: "All channels",
  direct: "Site Only (Direct)",
  catawiki: "Live on Catawiki",
  ebay: "Live on eBay",
};

const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "name", label: "Name, A to Z" },
];

const PRICE_LABELS: Record<PriceBand, string> = {
  all: "Any price",
  "under-500": "Under €500",
  "500-1500": "€500 – €1,500",
  "over-1500": "Over €1,500",
};

function matchesPrice(cents: number, band: PriceBand) {
  const dollars = cents / 100;
  switch (band) {
    case "under-500":
      return dollars < 500;
    case "500-1500":
      return dollars >= 500 && dollars <= 1500;
    case "over-1500":
      return dollars > 1500;
    default:
      return true;
  }
}

export function ShopExplorer({
  products,
  initialCollection,
  initialChannel = "all",
}: {
  products: ProductWithStats[];
  initialCollection: string;
  initialChannel?: string;
}) {
  const validInitialChannel: Channel =
    initialChannel === "direct" || initialChannel === "catawiki" || initialChannel === "ebay"
      ? initialChannel
      : "all";

  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    collection: getCollection(initialCollection) ? initialCollection : "all",
    channel: validInitialChannel,
  });
  const [sort, setSort] = useState<Sort>("featured");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Header links change the URL while this component stays mounted
  // (e.g. /shop -> /shop?channel=ebay). Follow the URL so every link works.
  useEffect(() => {
    const collection = getCollection(initialCollection) ? initialCollection : "all";
    const channel: Channel =
      initialChannel === "direct" || initialChannel === "catawiki" || initialChannel === "ebay"
        ? initialChannel
        : "all";
    setFilters((prev) =>
      prev.collection === collection && prev.channel === channel
        ? prev
        : { ...DEFAULT_FILTERS, collection, channel },
    );
  }, [initialCollection, initialChannel]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const activeCount = [
    filters.collection !== "all",
    filters.channel !== "all",
    filters.category !== "all",
    filters.period !== "all",
    filters.price !== "all",
    filters.inStockOnly,
    filters.query.trim() !== "",
  ].filter(Boolean).length;

  const results = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (filters.collection !== "all" && !collectionsOf(p).includes(filters.collection)) return false;
      // Unavailable pieces (no channel) only appear under "All specimens".
      const pieceChannel = p.listingChannel;
      if (filters.channel !== "all") {
        if (filters.channel === "direct") {
          if (pieceChannel !== "direct") return false;
        } else if (pieceChannel !== filters.channel) return false;
      }
      if (filters.category !== "all" && p.category !== filters.category) return false;
      if (filters.period !== "all" && p.period !== filters.period) return false;
      if (!matchesPrice(p.priceCents, filters.price)) return false;
      if (filters.inStockOnly && p.stock <= 0) return false;
      if (q) {
        const haystack = `${p.name} ${p.species} ${p.locality} ${p.period ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.priceCents - b.priceCents);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.priceCents - a.priceCents);
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id);
    }
    return sorted;
  }, [products, filters, sort]);

  const activeCollection = filters.collection !== "all" ? getCollection(filters.collection) : undefined;
  const reset = () => setFilters(DEFAULT_FILTERS);

  const channelCounts = useMemo(
    () => ({
      all: products.length,
      direct: products.filter((p) => p.listingChannel === "direct").length,
      ebay: products.filter((p) => p.listingChannel === "ebay").length,
      catawiki: products.filter((p) => p.listingChannel === "catawiki").length,
    }),
    [products],
  );

  const filterPanel = (
    <FilterPanel
      filters={filters}
      update={update}
      reset={reset}
      activeCount={activeCount}
      counts={{
        all: products.length,
        collection: (slug: string) => products.filter((p) => collectionsOf(p).includes(slug)).length,
      }}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 lg:px-8">
      {/* Heading */}
      <header className="mb-10 grid gap-8 border-b border-ink/10 pb-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-brass">
            {activeCollection ? "Collection" : "The collection"}
          </p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">
            {activeCollection ? activeCollection.title : "Specimens & instruments"}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/65">
            {activeCollection
              ? activeCollection.description
              : "Every specimen is clearly badged by where it is currently offered: exclusively here on Mediterranic, or live on auction on eBay or Catawiki."}
          </p>
        </div>
        <p className="font-display text-xl italic text-ink/55 md:text-right">
          {products.length} pieces currently in the cabinet
        </p>
      </header>

      {/* 3-Channel Quick Switcher Bar */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-ink/10 bg-bone/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "All Specimens", count: channelCounts.all },
              { id: "direct", label: "Only on This Site", count: channelCounts.direct },
              { id: "ebay", label: "Live on eBay", count: channelCounts.ebay },
              { id: "catawiki", label: "Live on Catawiki", count: channelCounts.catawiki },
            ] as const
          ).map((tab) => {
            const selected = filters.channel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => update("channel", tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] transition ${
                  selected
                    ? "bg-ink font-medium text-parchment shadow-sm"
                    : "bg-parchment/80 text-ink/75 hover:bg-parchment hover:text-ink"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    selected ? "bg-parchment/20 text-parchment" : "bg-ink/10 text-ink/70"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-2 text-xs text-ink/60">
          eBay &amp; Catawiki lots that do not sell return automatically to <strong>Only on This Site</strong>.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[250px_1fr] lg:gap-14">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">{filterPanel}</div>
        </aside>

        <div className="min-w-0">
          {/* Toolbar */}
          <div className="sticky top-20 z-30 -mx-5 mb-8 flex flex-wrap items-center gap-3 border-b border-ink/10 bg-parchment/90 px-5 py-4 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Search specimens</span>
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
                placeholder="Search species, locality…"
                className="h-11 w-full rounded-full border border-ink/15 bg-white/60 pl-11 pr-4 text-sm outline-none transition placeholder:text-ink/40 focus:border-sea focus:ring-2 focus:ring-sea/15"
              />
            </label>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 px-5 text-[12px] uppercase tracking-[0.18em] lg:hidden"
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-terracotta px-1 text-[10px] text-parchment">
                  {activeCount}
                </span>
              )}
            </button>

            <label className="relative ml-auto inline-flex h-11 items-center">
              <span className="sr-only">Sort products</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-11 cursor-pointer appearance-none rounded-full border border-ink/15 bg-white/60 pl-5 pr-11 text-sm outline-none focus:border-sea"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-4 text-ink/50" />
            </label>
          </div>

          {/* Active chips */}
          <div className="mb-8 flex min-h-8 flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-ink/60">
              {results.length} {results.length === 1 ? "piece" : "pieces"}
            </p>
            <AnimatePresence>
              {activeCollection && (
                <Chip key="collection" onRemove={() => update("collection", "all")}>
                  {activeCollection.title}
                </Chip>
              )}
              {filters.channel !== "all" && (
                <Chip key="channel" onRemove={() => update("channel", "all")}>
                  {CHANNEL_LABELS[filters.channel]}
                </Chip>
              )}
              {filters.category !== "all" && (
                <Chip key="category" onRemove={() => update("category", "all")}>
                  {filters.category === "specimen" ? "Specimens" : "Accessories"}
                </Chip>
              )}
              {filters.period !== "all" && (
                <Chip key="period" onRemove={() => update("period", "all")}>
                  {filters.period}
                </Chip>
              )}
              {filters.price !== "all" && (
                <Chip key="price" onRemove={() => update("price", "all")}>
                  {PRICE_LABELS[filters.price]}
                </Chip>
              )}
              {filters.inStockOnly && (
                <Chip key="stock" onRemove={() => update("inStockOnly", false)}>
                  In stock
                </Chip>
              )}
            </AnimatePresence>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="ml-1 text-[11px] uppercase tracking-[0.2em] text-terracotta underline-offset-4 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-sm border border-dashed border-ink/20 px-8 py-20 text-center">
              <p className="font-display text-4xl text-ink">Nothing matches just yet</p>
              <p className="mx-auto mt-4 max-w-md text-sm text-ink/60">
                Try widening the price band or removing a period filter. New specimens are logged regularly.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-8 h-12 rounded-full bg-ink px-8 text-[12px] uppercase tracking-[0.2em] text-parchment transition hover:bg-terracotta"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-12 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {results.map((product) => (
                  <motion.div
                    key={product.slug}
                    layout
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          <p className="mt-16 text-center text-sm text-ink/55">
            Looking for something specific?{" "}
            <Link href="mailto:mediterranean.world@gmail.com" className="text-ink underline-offset-4 hover:underline">
              Ask our specialists
            </Link>{" "}
            for private viewings and acquisitions.
          </p>
        </div>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              key="sheet-backdrop"
              className="fixed inset-0 z-50 bg-ink/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl bg-parchment shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
                <h2 className="font-display text-3xl">Refine</h2>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close filters"
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
              <div className="overflow-y-auto px-6 py-6">{filterPanel}</div>
              <div className="border-t border-ink/10 p-5">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="h-13 w-full rounded-full bg-ink py-4 text-[12px] uppercase tracking-[0.2em] text-parchment"
                >
                  Show {results.length} {results.length === 1 ? "piece" : "pieces"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="inline-flex items-center gap-2 rounded-full bg-bone py-1.5 pl-4 pr-2 text-xs text-ink"
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${typeof children === "string" ? children : "filter"}`}
        className="grid h-5 w-5 place-items-center rounded-full hover:bg-ink/10"
      >
        <X size={12} />
      </button>
    </motion.span>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 border-b border-ink/10 pb-7">
      <legend className="mb-4 text-[11px] uppercase tracking-[0.28em] text-ink/60">{title}</legend>
      {children}
    </fieldset>
  );
}

function Option({
  checked,
  onChange,
  name,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  label: string;
  count?: number;
}) {
  return (
    <label className="group flex cursor-pointer items-center justify-between gap-3 text-sm text-ink/80">
      <span className="flex items-center gap-3">
        <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
        <span
          className={`grid h-4 w-4 place-items-center rounded-full border transition ${
            checked ? "border-ink" : "border-ink/30 group-hover:border-ink/60"
          }`}
        >
          <span className={`h-2 w-2 rounded-full bg-ink transition-transform ${checked ? "scale-100" : "scale-0"}`} />
        </span>
        <span className={checked ? "text-ink" : ""}>{label}</span>
      </span>
      {count !== undefined && <span className="text-xs text-ink/40">{count}</span>}
    </label>
  );
}

function FilterPanel({
  filters,
  update,
  reset,
  activeCount,
  counts,
}: {
  filters: Filters;
  update: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  reset: () => void;
  activeCount: number;
  counts: { all: number; collection: (slug: string) => number };
}) {
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <p className="font-display text-2xl">Refine</p>
        {activeCount > 0 && (
          <button type="button" onClick={reset} className="text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Reset
          </button>
        )}
      </div>

      <FilterGroup title="Collection">
        <Option
          name="collection"
          label="All collections"
          checked={filters.collection === "all"}
          onChange={() => update("collection", "all")}
          count={counts.all}
        />
        {COLLECTIONS.map((c) => (
          <Option
            key={c.slug}
            name="collection"
            label={c.title.replace("The ", "")}
            checked={filters.collection === c.slug}
            onChange={() => update("collection", c.slug)}
            count={counts.collection(c.slug)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Availability Channel">
        {(Object.keys(CHANNEL_LABELS) as Channel[]).map((value) => (
          <Option
            key={value}
            name="channel"
            label={CHANNEL_LABELS[value]}
            checked={filters.channel === value}
            onChange={() => update("channel", value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Geological period">
        {(["all", "Cambrian", "Ordovician", "Devonian"] as Period[]).map((value) => (
          <Option
            key={value}
            name="period"
            label={value === "all" ? "Any period" : value}
            checked={filters.period === value}
            onChange={() => update("period", value)}
          />
        ))}
      </FilterGroup>

            <FilterGroup title="Price">
        {(Object.keys(PRICE_LABELS) as PriceBand[]).map((value) => (
          <Option
            key={value}
            name="price"
            label={PRICE_LABELS[value]}
            checked={filters.price === value}
            onChange={() => update("price", value)}
          />
        ))}
      </FilterGroup>

      <label className="flex cursor-pointer items-center justify-between text-sm text-ink/80">
        <span>Available now</span>
        <span className="relative inline-flex h-6 w-11 items-center">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => update("inStockOnly", e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-ink/15 transition peer-checked:bg-sea" />
          <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    </div>
  );
}
