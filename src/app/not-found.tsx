import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
      <p className="font-display text-[9rem] leading-none text-brass/80">404</p>
      <h1 className="mt-4 font-display text-5xl text-ink">This specimen has not been found yet</h1>
      <p className="mt-6 max-w-md text-ink/65">
        The page you are looking for has moved or never existed. The collection itself is well worth a browse.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="inline-flex h-13 items-center rounded-full bg-ink px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta"
        >
          Back to home
        </Link>
        <Link
          href="/shop"
          className="inline-flex h-13 items-center rounded-full border border-ink/25 px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-ink transition hover:border-ink"
        >
          View the collection
        </Link>
      </div>
    </div>
  );
}
