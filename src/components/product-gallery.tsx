"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import type { ProductImage } from "@/db/schema";

const HOVER_SCALE = 2.4;

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const view = images[index] ?? images[0];

  const go = (direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0) setIndex(images.length - 1);
    else if (next >= images.length) setIndex(0);
    else setIndex(next);
  };

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  /** Combines the stored crop with the live hover magnification. */
  const transformFor = (img: ProductImage, hovering: { x: number; y: number } | null) => {
    const zoom = img.zoom ?? { x: 50, y: 45, scale: 1 };
    if (hovering) return `scale(${HOVER_SCALE})`;
    return `scale(${zoom.scale ?? 1})`;
  };

  const originFor = (img: ProductImage, hovering: { x: number; y: number } | null) => {
    const zoom = img.zoom ?? { x: 50, y: 45 };
    return `${hovering ? hovering.x : zoom.x}% ${hovering ? hovering.y : zoom.y}%`;
  };

  const orientation = (img: ProductImage) => {
    const rotate = ((img.rotate ?? 0) % 360 + 360) % 360;
    const flip = `${img.flipH ? " scaleX(-1)" : ""}${img.flipV ? " scaleY(-1)" : ""}`;
    return { transform: `rotate(${rotate}deg)${flip}`, transition: "transform .6s cubic-bezier(.22,1,.36,1)" };
  };

  return (
    <div className="space-y-4">
      {/* Main frame */}
      <div className="relative">
        <div
          onMouseMove={handleMove}
          onMouseLeave={() => setPointer(null)}
          className="group relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-sm bg-ink/5"
        >
          {images.map((img, i) => (
            <div
              key={`${img.src}-${img.label}`}
              className="absolute inset-0"
              style={{
                ...orientation(img),
                opacity: i === index ? 1 : 0,
                pointerEvents: i === index ? "auto" : "none",
                transition: "opacity .5s ease, transform .6s cubic-bezier(.22,1,.36,1)",
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 45vw, 100vw"
                style={{
                  transform: transformFor(img, i === index ? pointer : null),
                  transformOrigin: originFor(img, i === index ? pointer : null),
                }}
                className="object-contain transition-transform duration-700 ease-out"
              />
            </div>
          ))}

          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-parchment/90 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-ink backdrop-blur">
            <ZoomIn size={13} strokeWidth={1.5} />
            {pointer ? "Inspecting" : "Hover to inspect"}
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-ink/70 px-3 py-1 text-[11px] tabular-nums text-parchment backdrop-blur">
            {index + 1} / {images.length}
          </div>
        </div>

        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photograph"
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-parchment/90 text-ink shadow-md backdrop-blur transition hover:bg-parchment hover:scale-105"
            >
              <ChevronLeft size={20} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photograph"
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-parchment/90 text-ink shadow-md backdrop-blur transition hover:bg-parchment hover:scale-105"
            >
              <ChevronRight size={20} strokeWidth={1.6} />
            </button>
          </>
        )}
      </div>

      {/* Horizontal filmstrip — scrolls with the arrows too */}
      <div className="relative">
        <div
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const slide = el.scrollWidth / Math.max(1, images.length);
            const next = Math.round(el.scrollLeft / Math.max(1, slide));
            if (next !== index && next >= 0 && next < images.length) setIndex(next);
          }}
        >
          {images.map((img, i) => (
            <button
              key={`thumb-${img.src}-${img.label}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${img.label.toLowerCase()} of ${name}`}
              aria-current={i === index}
              className={`group/thumb relative w-24 shrink-0 snap-center overflow-hidden rounded-sm bg-bone transition sm:w-28 ${
                i === index ? "ring-2 ring-ink ring-offset-2 ring-offset-parchment" : "opacity-60 hover:opacity-100"
              }`}
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={img.src}
                  alt=""
                  fill
                  sizes="112px"
                  style={orientation(img)}
                  className="object-contain"
                />
              </div>
              <span className="absolute inset-x-0 bottom-0 truncate bg-ink/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-parchment">
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        {images.length > 4 && (
          <>
            <button
              type="button"
              aria-label="Scroll thumbnails left"
              onClick={(e) => {
                const strip = e.currentTarget.previousElementSibling;
                if (strip instanceof HTMLElement) strip.scrollBy({ left: -140, behavior: "smooth" });
              }}
              className="absolute -left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-parchment shadow ring-1 ring-ink/10 transition hover:scale-105"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              aria-label="Scroll thumbnails right"
              onClick={(e) => {
                const strip = e.currentTarget.previousElementSibling;
                if (strip instanceof HTMLElement) strip.scrollBy({ left: 140, behavior: "smooth" });
              }}
              className="absolute -right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-parchment shadow ring-1 ring-ink/10 transition hover:scale-105"
            >
              <ChevronRight size={15} />
            </button>
          </>
        )}
      </div>

      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-ink/50">{view.label}</p>
    </div>
  );
}
