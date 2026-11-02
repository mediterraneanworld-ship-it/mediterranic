"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";

type Probe = {
  ok?: boolean;
  configured?: boolean;
  error?: string;
  diagnosis?: string;
  marketplace?: string;
  storeUrl?: string;
  sellerFromStoreUrl?: string | null;
  sellerUsernameOverride?: string | null;
  sellerUsed?: string;
  sellerFromListing?: string;
  seller?: string | null;
  activeListings?: number;
  ebayTotal?: number | null;
  warnings?: { code: string; message: string }[];
  sampleTitles?: string[];
  errorCode?: string;
  title?: string;
  currency?: string;
  euroPriceCents?: number | null;
};

/**
 * Real eBay API diagnosis. Shows which seller name was sent, how many active
 * listings eBay returned, and any eBay warning — without writing shop data.
 */
export function EbayConnectionCheck({ onSellerDetected }: { onSellerDetected?: (seller: string) => void }) {
  const [config, setConfig] = useState<Probe | null>(null);
  const [url, setUrl] = useState("https://www.ebay.com/itm/920090937900");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Probe | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/ebay-status", { cache: "no-store" })
      .then(async (response) => (response.ok ? (response.json() as Promise<Probe>) : null))
      .then((data) => { if (alive) setConfig(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/ebay-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json() as Probe;
      setResult(data);
      const detected = data.sellerFromListing ?? data.sellerUsed;
      if (data.ok && detected) onSellerDetected?.(detected);
    } catch {
      setResult({ error: "Connection failed. Try again; no shop data was changed." });
    } finally {
      setBusy(false);
    }
  }

  const configured = result?.configured ?? config?.configured ?? false;
  const storeSeller = config?.sellerFromStoreUrl ?? null;
  const effectiveSeller = config?.sellerUsernameOverride || storeSeller;

  return (
    <div className="mb-3 rounded-sm border border-ink/15 bg-white/80 p-3 text-xs">
      <p className="font-medium text-ink">
        {configured ? "eBay keys detected on this deployment" : "No eBay keys on this deployment"}
      </p>
      <p className="mt-1 leading-relaxed text-ink/65">
        {configured ? (
          <>
            Detected keys do not prove authorisation. Run the diagnosis below: it reports the seller name sent to
            eBay, the number of active listings returned and any eBay warning. Nothing is written to the shop.
          </>
        ) : (
          <>
            Keys saved in Vercel only apply to the environments they were saved for. A development sandbox or a Preview
            deployment needs its own variables — they are not copied from Production.
          </>
        )}
      </p>

      {configured && (
        <dl className="mt-3 space-y-1 rounded-sm bg-bone/50 p-3 text-ink/75">
          <div>
            <dt className="inline font-medium">Marketplace: </dt>
            <dd className="inline">{config?.marketplace ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Seller name used: </dt>
            <dd className="inline">
              {effectiveSeller
                ? String(effectiveSeller)
                : "not resolved — set EBAY_SELLER_USERNAME or paste a live listing URL below"}
            </dd>
          </div>
          {config?.sellerUsernameOverride && (
            <div className="text-sea">EBAY_SELLER_USERNAME override is set.</div>
          )}
          {!config?.sellerUsernameOverride && storeSeller && (
            <div className="text-ink/55">
              Taken from the store URL. A store name is not guaranteed to be the seller account name.
            </div>
          )}
        </dl>
      )}

      <label className="mt-3 block">
        <span className="text-ink/65">Optional: one live eBay listing URL (proves credentials and reveals the seller)</span>
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="mt-1 w-full min-w-0 rounded-sm border border-ink/20 bg-white px-3 py-2 outline-none focus:border-sea"
          placeholder="https://www.ebay.com/itm/..."
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={test}
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.14em] text-parchment transition hover:bg-sea disabled:opacity-50"
      >
        {busy ? "Testing…" : "Diagnose eBay API"}
      </button>

      {result && (
        <div
          role="status"
          className={`mt-3 rounded-sm border p-3 leading-relaxed ${
            result.ok ? "border-sea/25 bg-sea/5 text-ink" : "border-terracotta/30 bg-terracotta/5 text-terracotta"
          }`}
        >
          <p className="font-medium">{result.diagnosis ?? result.error}</p>
          {typeof result.activeListings === "number" && (
            <p className="mt-2 text-ink/75">
              Active listings returned by eBay: <strong>{result.activeListings}</strong>
              {result.sellerUsed ? ` for seller "${result.sellerUsed}"` : ""}
              {typeof result.ebayTotal === "number" ? ` (eBay total: ${result.ebayTotal})` : ""}
            </p>
          )}
          {result.warnings?.length ? (
            <ul className="mt-2 space-y-1 text-terracotta">
              {result.warnings.map((warning) => (
                <li key={warning.code}>
                  eBay warning {warning.code}: {warning.message}
                </li>
              ))}
            </ul>
          ) : null}
          {result.sampleTitles?.length ? (
            <ul className="mt-2 space-y-1 text-ink/75">
              {result.sampleTitles.map((title) => (
                <li key={title}>· {title}</li>
              ))}
            </ul>
          ) : null}
          {result.sellerFromListing && (
            <p className="mt-2 text-ink/75">Seller revealed by the listing: {result.sellerFromListing}</p>
          )}
          {result.errorCode && <p className="mt-2 text-ink/60">Code: {result.errorCode}</p>}
          {typeof result.euroPriceCents === "number" && (
            <p className="mt-2 text-ink/75">EUR price: {formatPrice(result.euroPriceCents)}</p>
          )}
        </div>
      )}
    </div>
  );
}
