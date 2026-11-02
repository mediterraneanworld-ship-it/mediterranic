"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InventorySyncReport, SyncIssue } from "@/lib/inventory-rules";

type State = {
  report: InventorySyncReport | null;
  counts: { all: number; direct: number; ebay: number; catawiki: number };
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
        <p className="rounded-sm bg-bone/60 p-3 text-xs">Stored Site Only: <strong>{state?.counts.direct ?? "—"}</strong></p>
        <p className="rounded-sm bg-bone/60 p-3 text-xs">Stored eBay: <strong>{state?.counts.ebay ?? "—"}</strong> · active feed: <strong>{report?.sources.ebay.count ?? "not verified"}</strong></p>
        <p className="rounded-sm bg-bone/60 p-3 text-xs">Stored Catawiki: <strong>{state?.counts.catawiki ?? "—"}</strong> · active feed: <strong>{report?.sources.catawiki.count ?? "not verified"}</strong></p>
      </div>
      {report && Object.entries(report.sources).map(([name, source]) => source.error ? <p key={name} className="mt-2 text-xs leading-relaxed text-terracotta">{name}: {source.error}</p> : null)}
      {report?.message && <p className="mt-2 text-xs text-terracotta">{report.message}</p>}
      {message && <p role="status" className="mt-3 rounded-sm bg-bone/60 p-3 text-xs leading-relaxed text-ink">{message}</p>}
      {report?.issues.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-ink">{report.issues.length} identity/conflict warning(s) — resolve exceptions once</summary>
          <ul className="mt-2 divide-y divide-ink/10">
            {report.issues.map((issue, index) => (
              <li key={`${issue.url}-${index}`} className="space-y-2 py-3 text-xs">
                <p className="font-medium text-ink">{issue.title}</p><p className="text-ink/65">{issue.message}</p>
                <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-sea underline">Open active {issue.channel} offer</a>
                <label className="block"><span className="sr-only">Existing specimen for {issue.title}</span>
                  <select value={choices[issue.url] || ""} onChange={(e) => setChoices((old) => ({ ...old, [issue.url]: e.target.value }))} className="min-h-11 w-full min-w-0 rounded-sm border border-ink/20 bg-white px-2">
                    <option value="">Choose the existing physical specimen</option>
                    {specimens.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <button type="button" disabled={busy || !choices[issue.url]} onClick={() => resolve(issue)} className="min-h-11 rounded-full border border-ink/25 px-4 disabled:opacity-40">Save this identity / listing link</button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
