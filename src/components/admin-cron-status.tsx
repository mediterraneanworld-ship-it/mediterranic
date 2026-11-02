"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

type Run = {
  id: number;
  source: string;
  ok: boolean;
  checked: number;
  changed: number;
  ended: number;
  summary: string;
  ranAt: string;
};

type Status = {
  cronSecretConfigured: boolean;
  ebayApiConfigured: boolean;
  schedule: string;
  runs: Run[];
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

/**
 * Shows whether the daily price job actually ran, and the two reasons it can
 * silently do nothing: no CRON_SECRET, or no eBay API keys (eBay blocks the
 * page scrape from servers).
 */
export function AdminCronStatus({ refreshKey = 0 }: { refreshKey?: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cron-status", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as Status);
    } catch {
      // Keep the last known result if the network is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  if (!status) {
    return <p className="mt-3 text-[11px] text-ink/50">Loading last runs…</p>;
  }

  const lastCron = status.runs.find((r) => r.source === "cron");
  const last = status.runs[0];

  return (
    <div className="mt-4 rounded-sm border border-ink/15 bg-white/85 p-3 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold uppercase tracking-[0.18em] text-ink/70">Did the daily job run?</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-ink/60 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> refresh
        </button>
      </div>

      <ul className="mt-2 space-y-1.5">
        <li className="flex items-start gap-2">
          {status.cronSecretConfigured ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-sea" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-terracotta" />
          )}
          <span>
            <strong>CRON_SECRET</strong>{" "}
            {status.cronSecretConfigured
              ? "is set — check the actual executions below; this alone does not prove the schedule ran."
              : "is NOT set on this deployment. Add CRON_SECRET in Vercel → Settings → Environment Variables, then redeploy to authorise scheduled calls."}
          </span>
        </li>
        <li className="flex items-start gap-2">
          {status.ebayApiConfigured ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-sea" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-terracotta" />
          )}
          <span>
            <strong>eBay API keys</strong>{" "}
            {status.ebayApiConfigured
              ? "are set — use Test eBay API to verify authorisation. Each scheduled run reconciles active inventories before checking prices."
              : "are NOT set. eBay blocks server reads (HTTP 403), so eBay pieces are left unchanged until EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are added. Catawiki is unaffected."}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Clock size={14} className="mt-0.5 shrink-0 text-ink/50" />
          <span>
            Schedule: {status.schedule}. Last scheduled run:{" "}
            {lastCron ? (
              <strong className={lastCron.ok ? "text-sea" : "text-terracotta"}>
                {when(lastCron.ranAt)} — {lastCron.summary}
              </strong>
            ) : (
              <strong className="text-terracotta">never recorded</strong>
            )}
          </span>
        </li>
      </ul>

      {status.runs.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-ink/60">Last {status.runs.length} runs</summary>
          <ul className="mt-1 divide-y divide-ink/10">
            {status.runs.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-3 py-1">
                <span className="w-28 shrink-0 tabular-nums text-ink/60">{when(r.ranAt)}</span>
                <span className="w-14 shrink-0 uppercase tracking-wider text-ink/50">{r.source}</span>
                <span className={r.ok ? "text-ink/80" : "text-terracotta"}>{r.summary}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {last && !last.ok && (
        <p className="mt-2 text-terracotta">
          The most recent attempt was incomplete or failed — see the reason above. Unreadable listings are kept unchanged; other listings may have been updated.
        </p>
      )}
    </div>
  );
}
