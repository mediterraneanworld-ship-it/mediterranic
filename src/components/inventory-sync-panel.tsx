"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { describeListingMarketplace, type InventorySyncReport, type SyncIssue } from "@/lib/inventory-rules";

type State = {
  report: InventorySyncReport | null;
  counts: { all: number; direct: number; ebay: number; catawiki: number };
  marketplaces?: { ebay: string; catawiki: string };
  automaticEnabled: boolean; automaticOnOpen: boolean; ebayConfigured: boolean; cronConfigured: boolean;
};
const time = (date: string) => new Date(date).toLocaleString("en-GB", { timeZone: "Europe/Lisbon" });

export function InventorySyncPanel({ specimens, refreshKey = 0 }: {
  specimens: { id: number; name: string; archived: boolean }[]; refreshKey?: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const started = useRef(false);
  async function load() {
    const response = await fetch("/api/admin/inventory-sync", { cache: "no-store" });
    if (!response.ok) return null;
    const next = await response.json() as State;
    setState(next); return next;
  }
  async function synchronize() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/inventory-sync", { method: "POST" });
      const data = await response.json() as { error?: string; inventory?: InventorySyncReport | null };
      setMessage(data.error || (data.inventory ? `Inventory ${data.inventory.status}: ${data.inventory.linked} relinked, ${data.inventory.created} imported, ${data.inventory.issues.length} warning(s).` : "Synchronization finished."));
      await load(); router.refresh();
    } catch { setMessage("The result could not be retrieved. The next status check will show whether the server finished; do not assume the inventory is empty."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let alive = true;
    load().then((next) => {
      if (!alive || !next || started.current) return;
      const last = next.report?.finishedAt;
      const retryAfter = 15 * 60 * 1000;
      const stale = !last || Date.now() - new Date(last).getTime() > retryAfter;
      if (next.automaticOnOpen && stale && next.report?.status !== "running") {
        started.current = true; void synchronize();
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    if (!busy && state?.report?.status !== "running") return;
    const timer = setInterval(() => { void load().catch(() => {}); }, 3000);
    return () => clearInterval(timer);
  }, [busy, state?.report?.status]);

  async function resolve(issue: SyncIssue) {
    const productId = Number(choices[issue.url]);
    if (!productId || !window.confirm("Link this active listing to the selected existing specimen? Photos and text are kept. No external auction is ended by this action.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/marketplace-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, channel: issue.channel, url: issue.url }) });
      const data = await response.json() as { error?: string; message?: string };
      setMessage(data.error || data.message || "Link saved. The saved identity will be used by the next synchronization.");
      await load(); router.refresh();
    } catch { setMessage("Could not link the listing. The previous data was kept."); }
    finally { setBusy(false); }
  }
  const report = state?.report;
  const ebayMarketplace = report?.sources.ebay.marketplace ?? state?.marketplaces?.ebay ?? "EBAY_US · United States (ebay.com)";
  const catawikiMarketplace = report?.sources.catawiki.marketplace ?? state?.marketplaces?.catawiki ?? "International / EU (catawiki.com/en · EUR)";
  const unverifiedFeeds = report
    ? (["ebay", "catawiki"] as const)
        .filter((channel) => !report.sources[channel]?.ok || !report.sources[channel]?.complete)
        .map((channel) => (channel === "ebay" ? "eBay" : "Catawiki"))
    : [];
  const heldSpecimens = (report?.heldProductIds ?? [])
    .map((id) => specimens.find((p) => p.id === id))
    .filter((entry): entry is { id: number; name: string; archived: boolean } => Boolean(entry));
  const issueCount = report?.issues.length ?? 0;

  return (
    <section className="mb-4 rounded-sm border-2 border-sea/35 bg-white/85 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">Inventory synchronization</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink/65">Discovers active offers, reconnects identified relistings and updates prices. The daily cron uses this same process — not just the previously selected listing URLs.</p>
        </div>
        <button type="button" disabled={busy || report?.status === "running"} onClick={synchronize}
          className="min-h-11 rounded-full bg-sea px-5 text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-50">{busy ? "Synchronizing…" : "Synchronize inventory now"}</button>
      </div>
      {!state?.ebayConfigured && state && <p className="mt-3 rounded-sm border border-terracotta/25 bg-terracotta/5 p-3 text-xs text-terracotta">No eBay keys on this deployment. Vercel keys are not copied into the development sandbox. The local stored distribution must not be presented as the verified live eBay inventory.</p>}
      {state && !state.cronConfigured && <p className="mt-2 text-xs text-terracotta">CRON_SECRET is not configured here. A production scheduler must be configured once; daily manual review is not the normal workflow.</p>}
      <p className="mt-3 text-xs text-ink/70">Last inventory synchronization: <strong>{report?.finishedAt ? `${time(report.finishedAt)} · ${report.status}` : "not yet verified on this deployment"}</strong> (Lisbon time)</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-sm bg-bone/60 p-3 text-xs">
          <p>Stored Site Only: <strong>{state?.counts.direct ?? "—"}</strong></p>
          <p className="mt-1 text-[11px] text-ink/60">Country / Marketplace: <strong>Direct gallery (EUR)</strong></p>
        </div>
        <div className="rounded-sm bg-bone/60 p-3 text-xs">
          <p>Stored eBay: <strong>{state?.counts.ebay ?? "—"}</strong> · active feed: <strong>{report?.sources.ebay.count ?? "not verified"}</strong></p>
          <p className="mt-1 text-[11px] text-ink/60">Country / Marketplace: <strong>{ebayMarketplace}</strong></p>
        </div>
        <div className="rounded-sm bg-bone/60 p-3 text-xs">
          <p>Stored Catawiki: <strong>{state?.counts.catawiki ?? "—"}</strong> · active feed: <strong>{report?.sources.catawiki.count ?? "not verified"}</strong></p>
          <p className="mt-1 text-[11px] text-ink/60">Country / Marketplace: <strong>{catawikiMarketplace}</strong></p>
        </div>
      </div>

      <div className={`mt-3 rounded-sm border p-3 text-xs ${issueCount > 0 || heldSpecimens.length > 0 ? "border-terracotta/35 bg-terracotta/5" : "border-ink/15 bg-bone/40"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink">
            <strong>Exceptions:</strong>{" "}
            {!report ? (
              <span className="text-ink/70">not yet checked on this deployment</span>
            ) : issueCount > 0 ? (
              <strong className="text-terracotta">{issueCount} pending exception(s) — curator action required</strong>
            ) : unverifiedFeeds.length > 0 ? (
              <span className="text-ink/75">0 detected ({unverifiedFeeds.join(" & ")} feed not verified)</span>
            ) : (
              <span className="text-sea font-medium">0 pending (all feeds verified)</span>
            )}
          </p>
          {report && (report.drafts > 0 || heldSpecimens.length > 0) && (
            <p className="text-[11px] text-ink/70">
              {heldSpecimens.length > 0 ? `Direct checkout paused: ${heldSpecimens.length}` : ""}
              {heldSpecimens.length > 0 && report.drafts > 0 ? " · " : ""}
              {report.drafts > 0 ? `Draft imports awaiting review: ${report.drafts}` : ""}
            </p>
          )}
        </div>
        {heldSpecimens.length > 0 && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-terracotta">
            Paused from direct sale pending identity check: <strong>{heldSpecimens.map((p) => p.name).join(", ")}</strong>.
          </p>
        )}
      </div>

      {report && Object.entries(report.sources).map(([name, source]) => source.error ? (
        <p key={name} className="mt-2 text-xs leading-relaxed text-terracotta">
          <strong>{name === "ebay" ? "eBay" : "Catawiki"}</strong> ({source.marketplace ?? (name === "ebay" ? ebayMarketplace : catawikiMarketplace)}): {source.error}
        </p>
      ) : null)}
      {report?.message && <p className="mt-2 text-xs text-terracotta">{report.message}</p>}
      {message && <p role="status" className="mt-3 rounded-sm bg-bone/60 p-3 text-xs leading-relaxed text-ink">{message}</p>}

      {issueCount > 0 && report ? (
        <details open className="mt-3 rounded-sm border border-terracotta/25 bg-white p-3">
          <summary className="cursor-pointer text-xs font-medium text-ink">
            {issueCount} identity / conflict exception(s) — resolve once to link future relistings
          </summary>
          <ul className="mt-2 divide-y divide-ink/10">
            {report.issues.map((issue, index) => {
              const issueMarket = issue.marketplace || describeListingMarketplace(issue.url, issue.channel, issue.channel === "ebay" ? ebayMarketplace : catawikiMarketplace);
              const candidateSet = new Set(issue.candidateIds);
              const availableSpecimens = specimens
                .filter((p) => !p.archived)
                .sort((a, b) => Number(candidateSet.has(b.id)) - Number(candidateSet.has(a.id)));
              return (
                <li key={`${issue.url}-${index}`} className="space-y-2 py-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-bone px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
                      {issue.channel === "ebay" ? "eBay" : "Catawiki"}
                    </span>
                    <span className="text-[11px] text-ink/65">{issueMarket}</span>
                  </div>
                  <p className="font-medium text-ink">{issue.title}</p>
                  <p className="text-ink/65">{issue.message}</p>
                  <a href={issue.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sea underline">
                    Open active {issue.channel === "ebay" ? "eBay" : "Catawiki"} offer
                  </a>
                  <label className="block">
                    <span className="sr-only">Existing specimen for {issue.title}</span>
                    <select
                      value={choices[issue.url] || ""}
                      onChange={(e) => setChoices((old) => ({ ...old, [issue.url]: e.target.value }))}
                      className="min-h-11 w-full min-w-0 rounded-sm border border-ink/20 bg-white px-2"
                    >
                      <option value="">Choose the existing physical specimen</option>
                      {availableSpecimens.map((p) => (
                        <option key={p.id} value={p.id}>
                          {candidateSet.has(p.id) ? `★ ${p.name} (candidate match)` : p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy || !choices[issue.url]}
                    onClick={() => resolve(issue)}
                    className="min-h-11 rounded-full border border-ink/25 px-4 disabled:opacity-40"
                  >
                    Save this identity / listing link
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
