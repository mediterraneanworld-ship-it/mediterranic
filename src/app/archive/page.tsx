import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAllProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Archive",
  description:
    "Specimens that have found their collectors. A record of Moroccan trilobites curated by Mediterranic over the years.",
};

export default async function ArchivePage() {
  const pieces = (await getAllProducts()).filter((p) => p.archived);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 lg:px-8">
      <header className="mb-14 border-b border-ink/10 pb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-brass">The Archive</p>
        <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">
          Pieces that found their collectors
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/65">
          A record of specimens that have passed through our hands. None is for sale — but if one speaks to you, we
          can look for a comparable piece.
        </p>
      </header>

      {pieces.length === 0 ? (
        <p className="text-ink/60">The archive is being assembled.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-4">
          {pieces.map((p) => (
            <Link key={p.slug} href={`/shop/${p.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-bone">
                {p.images[0] && (
                  <Image
                    src={p.images[0].src}
                    alt={p.images[0].alt}
                    fill
                    sizes="(min-width: 1024px) 22vw, 46vw"
                    className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.05]"
                  />
                )}
                <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-parchment">
                  Archive
                </span>
              </div>
              <h3 className="mt-4 font-display text-2xl leading-tight text-ink">{p.name}</h3>
              <p className="text-sm italic text-ink/60">{p.period ?? p.species}</p>
              <p className="mt-1 text-xs text-ink/45">Request a similar specimen</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
