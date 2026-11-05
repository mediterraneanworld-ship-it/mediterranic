"use client";

import { Save, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { weightClassLabels, type ShippingZone } from "@/lib/shipping";

type ShippingPayload = {
  classes: { id: number; position: number; maxGrams: number | null; label: string }[];
  rates: Record<string, Partial<Record<ShippingZone, number>>>;
  regions: { id: ShippingZone; label: string; days: string }[];
  freeShipping: boolean;
  missingWeight: { id: number; name: string; slug: string }[];
};

/** One editable row per weight class. Values stay as typed until they are saved. */
type DraftRow = { classId: number; limit: string; prices: Record<string, string> };

function euros(cents: number | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** Typed euro text to cents. Empty or non-numeric text gives NaN, which is refused before saving. */
function cents(text: string | undefined): number {
  const normalised = (text ?? "").trim().replace(",", ".");
  if (normalised === "") return Number.NaN;
  return Math.round(Number(normalised) * 100);
}

const priceInput =
  "w-28 rounded-sm border border-ink/20 bg-white px-2 py-1 text-right text-sm outline-none focus:border-sea";

export function AdminShippingPanel() {
  const [payload, setPayload] = useState<ShippingPayload | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shipping", { cache: "no-store" });
      if (!res.ok) throw new Error("The shipping table could not be loaded. Sign in again and retry.");
      const data = (await res.json()) as ShippingPayload;
      setPayload(data);
      setDraft(
        data.classes.map((cls) => ({
          classId: cls.id,
          limit: cls.maxGrams === null ? "" : String(cls.maxGrams),
          prices: Object.fromEntries(
            data.regions.map((region) => [region.id, euros(data.rates[String(cls.id)]?.[region.id])]),
          ),
        })),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The shipping table could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLimit(index: number, limit: string) {
    setDraft((rows) => rows.map((row, i) => (i === index ? { ...row, limit } : row)));
  }

  function updatePrice(index: number, region: string, value: string) {
    setDraft((rows) =>
      rows.map((row, i) => (i === index ? { ...row, prices: { ...row.prices, [region]: value } } : row)),
    );
  }

  async function save() {
    if (!payload) return;
    setNotice("");
    setError("");
    const last = draft.length - 1;
    const rows = draft.map((row, index) => ({
      classId: row.classId,
      maxGrams: index === last ? null : Number(row.limit),
      prices: Object.fromEntries(payload.regions.map((region) => [region.id, cents(row.prices[region.id])])),
    }));
    if (rows.some((row) => Object.values(row.prices).some((value) => !Number.isFinite(value)))) {
      setError("Enter a euro amount in every cell.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The table was not saved. Nothing was changed.");
        return;
      }
      setNotice("Saved. Checkout and the Shipping page use these rates from now on.");
      await load();
    } catch {
      setError("Network error. Nothing was changed; try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return (
      <section className="mt-10 max-w-6xl rounded-sm border border-ink/10 bg-white/80 p-6 text-sm text-ink/60">
        {error || "Loading shipping rates…"}
      </section>
    );
  }

  const last = draft.length - 1;
  const labels = weightClassLabels(
    draft.map((row, index) => ({
      id: row.classId,
      position: index + 1,
      maxGrams: index === last ? null : Number(row.limit),
    })),
  );

  return (
    <section aria-label="Shipping rates" className="mt-10 max-w-6xl space-y-6 rounded-sm border border-ink/10 bg-white/80 p-6 md:p-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brass">Orders &amp; delivery</p>
        <h2 className="mt-2 flex items-center gap-3 font-display text-3xl text-ink">
          <Truck size={22} strokeWidth={1.6} aria-hidden="true" /> Shipping rates
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/65">
          Checkout adds up the weight of the pieces in the basket, protective box included, finds its weight class and
          charges the price for the buyer&apos;s region. Edit the upper limits and the euro prices, then save.
        </p>
      </div>

      {payload.freeShipping && (
        <p role="status" className="rounded-sm bg-brass/15 p-4 text-sm text-ink">
          Free shipping is switched on (tab 5, Page texts &amp; photos). While it stays on, checkout charges no
          shipping and these prices are not used.
        </p>
      )}
      {notice && <p role="status" className="rounded-sm bg-sea/10 p-4 text-sm text-sea">{notice}</p>}
      {error && <p role="alert" className="rounded-sm bg-terracotta/10 p-4 text-sm text-terracotta">{error}</p>}

      <div className="overflow-x-auto rounded-sm border border-ink/12">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink/12 bg-bone/60 text-[11px] uppercase tracking-[0.16em] text-ink/70">
              <th scope="col" className="px-4 py-3 font-medium">
                Weight class
              </th>
              {payload.regions.map((region) => (
                <th key={region.id} scope="col" className="px-4 py-3 font-medium">
                  {region.label}
                  <span className="mt-1 block text-[10px] normal-case tracking-normal text-ink/50">{region.days}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.map((row, index) => (
              <tr key={row.classId} className="border-b border-ink/8 align-top last:border-0">
                <th scope="row" className="px-4 py-4 font-normal">
                  <span className="block text-ink">{labels[row.classId]}</span>
                  {index < last ? (
                    <label className="mt-2 flex items-center gap-2 text-xs text-ink/60">
                      Up to
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100000}
                        step={1}
                        value={row.limit}
                        onChange={(event) => updateLimit(index, event.target.value)}
                        aria-label={`Upper limit of class ${index + 1}, grams`}
                        className="w-24 rounded-sm border border-ink/20 bg-white px-2 py-1 text-sm"
                      />
                      g
                    </label>
                  ) : (
                    <span className="mt-2 block text-xs text-ink/60">No upper limit</span>
                  )}
                </th>
                {payload.regions.map((region) => (
                  <td key={region.id} className="px-4 py-4">
                    <label className="flex items-center justify-end gap-2">
                      <span className="text-ink/50">€</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.prices[region.id] ?? ""}
                        onChange={(event) => updatePrice(index, region.id, event.target.value)}
                        aria-label={`${region.label}, ${labels[row.classId]}, euros`}
                        className={priceInput}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-sm border border-ink/12 bg-bone/50 p-5 text-sm text-ink/75">
        <p className="font-medium text-ink">Live pieces without a weight: {payload.missingWeight.length}</p>
        {payload.missingWeight.length === 0 ? (
          <p className="mt-2">Every live piece has its weight recorded.</p>
        ) : (
          <>
            <p className="mt-2">
              A basket with one of these pieces is charged at the heaviest class until its weight is entered (product
              editor → Weight with box).
            </p>
            <ul className="mt-2 list-disc pl-5">
              {payload.missingWeight.map((piece) => (
                <li key={piece.id}>{piece.name}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-xs text-ink/55">
          Upper limits are inclusive: 500 g belongs to the first class and 501 g to the second. Changing a limit renames
          its class automatically.
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || loading}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-8 text-xs uppercase tracking-[0.2em] text-parchment transition hover:bg-terracotta disabled:opacity-50"
        >
          <Save size={15} aria-hidden="true" /> {busy ? "Saving…" : "Save shipping rates"}
        </button>
      </div>
    </section>
  );
}
