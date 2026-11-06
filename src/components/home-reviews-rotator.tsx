"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { StarRating } from "@/components/star-rating";

export type Testimonial = {
  id: number;
  authorName: string;
  authorCountry: string;
  rating: number;
  title: string;
  body: string;
  productName: string;
  productSlug: string;
};

export function HomeReviewsRotator({
  testimonials,
  eyebrow,
  title,
}: {
  testimonials: Testimonial[];
  eyebrow: string;
  title: string;
}) {
  // Random shuffle on mount
  const [shuffled, setShuffled] = useState<Testimonial[]>(testimonials);
  const [page, setPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Initial random shuffle
    setShuffled([...testimonials].sort(() => Math.random() - 0.5));
  }, [testimonials]);

  // Determine items per page: mobile displays 2, desktop displays 3 or 6
  // We can cycle the array or paginate so users always see at least 2 side by side on mobile and 3 on desktop
  const total = shuffled.length;

  // Auto-rotate every 7 seconds when not paused and when we have more than 2 reviews
  useEffect(() => {
    if (total <= 2 || isPaused) return;
    const interval = setInterval(() => {
      setPage((p) => (p + 1) % Math.max(1, Math.ceil(total / 2)));
    }, 7000);
    return () => clearInterval(interval);
  }, [total, isPaused]);

  function shuffleNow() {
    setShuffled((prev) => [...prev].sort(() => Math.random() - 0.5));
    setPage(0);
  }

  function next() {
    setPage((p) => (p + 1) % Math.max(1, Math.ceil(total / 2)));
  }

  function prev() {
    setPage((p) => (p - 1 + Math.max(1, Math.ceil(total / 2))) % Math.max(1, Math.ceil(total / 2)));
  }

  // Calculate slice or rotated items:
  // If total <= 3, show all (fits 2 on mobile, 3 on desktop)
  // If total > 3, show a rotated window of reviews
  const displayed = useMemo(() => {
    if (total <= 3) return shuffled;
    // Rotate array based on page index
    const shift = (page * 2) % total;
    const rotated = [...shuffled.slice(shift), ...shuffled.slice(0, shift)];
    // Return up to 6 items (3 rows of 2 on mobile, 2 rows of 3 on desktop)
    return rotated.slice(0, Math.min(total, 6));
  }, [shuffled, page, total]);

  return (
    <section
      className="bg-midnight py-14 text-parchment sm:py-20 md:py-28"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-brass">{eyebrow}</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl leading-[1.02] sm:text-5xl md:text-6xl">
            {title}
          </h2>
        </div>

        {total > 2 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-parchment/60">
            <button
              type="button"
              onClick={shuffleNow}
              className="inline-flex items-center gap-1.5 rounded-full border border-parchment/20 px-3.5 py-1.5 text-[11px] uppercase tracking-wider text-parchment/80 transition hover:border-parchment hover:text-parchment"
              title="Shuffle reviews randomly"
            >
              <Shuffle size={12} /> Randomize
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous reviews"
                className="grid h-7 w-7 place-items-center rounded-full border border-parchment/20 text-parchment/80 transition hover:border-parchment hover:text-parchment"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next reviews"
                className="grid h-7 w-7 place-items-center rounded-full border border-parchment/20 text-parchment/80 transition hover:border-parchment hover:text-parchment"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Responsive grid: always 2 side by side on mobile (grid-cols-2), 3 side by side on desktop (lg:grid-cols-3) */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {displayed.map((t) => (
            <figure
              key={t.id}
              className="flex h-full flex-col rounded-sm border border-parchment/10 bg-parchment/[0.03] p-4 sm:p-6 md:p-8"
            >
              <StarRating rating={t.rating} size={13} />
              <blockquote className="mt-4 flex-1">
                <p className="line-clamp-2 font-display text-base leading-snug text-parchment sm:text-xl md:text-2xl">
                  &ldquo;{t.title}.&rdquo;
                </p>
                <p className="mt-2.5 line-clamp-4 text-xs leading-relaxed text-parchment/70 sm:mt-3 sm:line-clamp-none sm:text-sm">
                  {t.body}
                </p>
              </blockquote>
              <figcaption className="mt-5 border-t border-parchment/10 pt-3 sm:mt-6 sm:pt-4">
                <p className="text-xs font-medium sm:text-sm">{t.authorName}</p>
                <p className="truncate text-[11px] text-parchment/50 sm:text-xs">
                  {t.authorCountry} ·{" "}
                  <Link href={`/shop/${t.productSlug}`} className="text-brass hover:underline">
                    {t.productName}
                  </Link>
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
