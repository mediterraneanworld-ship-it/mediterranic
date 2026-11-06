import Link from "next/link";
import { unsubscribeByToken } from "@/lib/newsletter-send";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

/** Public one-click unsubscribe, linked from every mailing. */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const done = token ? await unsubscribeByToken(token) : false;

  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="text-[11px] uppercase tracking-[0.32em] text-brass">Mediterranic</p>
      <h1 className="mt-4 font-display text-5xl text-ink">
        {done ? "You are unsubscribed." : "Nothing to unsubscribe."}
      </h1>
      <p className="mx-auto mt-5 max-w-md leading-relaxed text-ink/65">
        {done
          ? "You will no longer receive the twice-a-month mailing. No hard feelings — and you can rejoin anytime from the shop footer."
          : "This link does not match any subscriber. If you still receive our mailings, write to mediterranean.world@gmail.com and we will remove you personally."}
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex h-14 items-center rounded-full bg-ink px-9 text-[12px] uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta"
      >
        Back to the shop
      </Link>
    </div>
  );
}
