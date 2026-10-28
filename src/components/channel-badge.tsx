import { ExternalLink, Globe, ShieldCheck } from "lucide-react";

export type ListingChannel = "direct" | "catawiki" | "ebay";

export const CHANNEL_META: Record<
  ListingChannel,
  {
    shortLabel: string;
    fullLabel: string;
    subtext: string;
    pillClass: string;
    dotClass: string;
  }
> = {
  direct: {
    shortLabel: "Site Exclusive",
    fullLabel: "Available Only on Mediterranic",
    subtext: "Direct acquisition · Ready for immediate insured dispatch",
    pillClass: "bg-parchment/95 text-ink border border-ink/15",
    dotClass: "bg-sea",
  },
  catawiki: {
    shortLabel: "Live on Catawiki",
    fullLabel: "Currently Live on Catawiki Auction",
    subtext: "Direct site checkout paused while auction is active · Returns to Site Only if it does not sell",
    pillClass: "bg-brass text-ink font-semibold shadow-sm",
    dotClass: "bg-ink animate-pulse",
  },
  ebay: {
    shortLabel: "Live on eBay",
    fullLabel: "Currently Listed on eBay",
    subtext: "Direct site checkout paused while listing is active · Returns to Site Only if it does not sell",
    pillClass: "bg-sea text-parchment font-semibold shadow-sm",
    dotClass: "bg-parchment animate-pulse",
  },
};

export function normalizeChannel(value: string | null | undefined): ListingChannel {
  if (value === "catawiki" || value === "ebay") return value;
  return "direct";
}

export function ChannelPill({
  channel,
  soldOut = false,
}: {
  channel: string | null | undefined;
  soldOut?: boolean;
}) {
  if (soldOut) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-parchment">
        Unavailable
      </span>
    );
  }

  const normalized = normalizeChannel(channel);
  const meta = CHANNEL_META[normalized];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur ${meta.pillClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
      {meta.shortLabel}
    </span>
  );
}

export function ChannelBanner({
  channel,
  externalUrl,
  soldOut = false,
}: {
  channel: string | null | undefined;
  externalUrl?: string | null;
  soldOut?: boolean;
}) {
  if (soldOut) return null;
  const normalized = normalizeChannel(channel);
  const meta = CHANNEL_META[normalized];

  if (normalized === "direct") {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-sm border border-sea/25 bg-sea/5 px-4 py-3 text-xs text-ink/80">
        <ShieldCheck size={16} className="shrink-0 text-sea" />
        <div>
          <span className="font-semibold uppercase tracking-[0.16em] text-sea">{meta.fullLabel}</span>
          <span className="ml-2 text-ink/65">— {meta.subtext}</span>
        </div>
      </div>
    );
  }

  const platformName = normalized === "catawiki" ? "Catawiki" : "eBay";
  const targetUrl =
    externalUrl?.trim() || (normalized === "catawiki" ? "https://www.catawiki.com" : "https://www.ebay.com");

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-brass/50 bg-bone/80 px-4 py-3.5 text-xs text-ink">
      <div className="flex items-center gap-2.5">
        <Globe size={16} className="shrink-0 text-terracotta" />
        <div>
          <p className="font-semibold uppercase tracking-[0.16em] text-ink">{meta.fullLabel}</p>
          <p className="mt-0.5 text-ink/65">{meta.subtext}</p>
        </div>
      </div>
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-parchment transition hover:bg-terracotta"
      >
        Open on {platformName} <ExternalLink size={12} />
      </a>
    </div>
  );
}
