"use client";

import { useCallback, useEffect, useState } from "react";

type Run = {
  id: number;
  source: string;
  status: string;
  detail: string | null;
  checked: number;
  changed: number;
  ended: number;
  createdAt: string;
  finishedAt: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  "vercel-cron": "Automatic (Vercel, daily)",
  external: "Automatic (external scheduler)",
  manual: "Manual (Check prices now)",
};

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

/**
 * History of every price check, so the curator can see at a glance whether the
 * daily automatic check ran, was refused, or failed — and why.
 */
export function PriceRunsLog({ refreshKey = 0 }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [cronOk, setCronOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/refresh-prices", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { runs: Run[]; cronSecretConfigured: boolean };
      setRuns(data.runs);
      setCronOk(data.cronSecretConfigured);
    } catch {
      // the log is informative only
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lastAuto = runs?.find((r) => r.source !== "manual" && r.status === "ok");

  return (
    <div className="mt-4 rounded-sm border border-ink/10 bg-white/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">Check history</p>
        {cronOk === false && (
          <span className="rounded-full bg-terracotta px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-parchment">
            CRON_SECRET missing in Vercel — the daily check cannot run
          </span>
        )}
        {cronOk === true && (
          <span className="rounded-full bg-sea/15 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-sea">
            CRON_SECRET configured (schedule not verified)
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink/60">
        Last successful automatic check:{" "}
        <strong className="text-ink">{lastAuto ? when(lastAuto.createdAt) : "none recorded yet"}</strong>
        <span className="text-ink/45"> (Lisbon time)</span>
      </p>

      {runs && runs.length > 0 ? (
        <ul className="mt-3 divide-y divide-ink/10 text-xs">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-ink">
                  {when(r.createdAt)} · {SOURCE_LABEL[r.source] ?? r.source}
                </p>
                {r.detail && <p className="mt-0.5 text-ink/55">{r.detail}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                  r.status === "ok"
                    ? "bg-sea/15 text-sea"
                    : r.status === "running"
                      ? "bg-brass/20 text-ink"
                      : "bg-terracotta/15 text-terracotta"
                }`}
              >
                {r.status === "ok"
                  ? `${r.checked} checked · ${r.changed} changed`
                  : r.status === "unauthorized"
                    ? "refused"
                    : r.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink/50">No checks recorded yet.</p>
      )}
    </div>
  );
}
