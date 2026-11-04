"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, RefreshCw } from "lucide-react";
import type { CronConfiguration } from "@/lib/cron-configuration";

/** Refreshing this panel inspects configuration; it never triggers a mailing. */
export function AdminNewsletterCronStatus({ automaticEnabled }: { automaticEnabled: boolean }) {
  const [status, setStatus] = useState<CronConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cron-configuration", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Configuration could not be checked. Sign in again or retry; do not replace the secret.");
      const data = await response.json() as CronConfiguration;
      if (!controller.signal.aborted) setStatus(data);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setStatus(null);
        setError(failure instanceof Error ? failure.message : "Configuration could not be checked. Please retry.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
    return () => request.current?.abort();
  }, [check]);

  return (
    <section aria-label="Newsletter schedule configuration" className="rounded-sm border border-sea/20 bg-sea/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">Schedule configuration · read-only</h3>
        <button type="button" onClick={() => void check()} disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white/70 px-4 text-xs text-ink transition hover:border-sea focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea disabled:opacity-50">
          <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
          {loading ? "Checking…" : "Check configuration"}
        </button>
      </div>
      <div aria-live="polite" className="mt-3 space-y-3 text-sm leading-relaxed text-ink/75">
        {error && <p role="alert" className="text-terracotta">{error}</p>}
        {status && (
          <>
            <p className="flex items-start gap-2">
              {status.cronSecretConfigured ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-sea" aria-hidden="true" /> : <Info size={17} className="mt-0.5 shrink-0 text-brass" aria-hidden="true" />}
              <span><strong>CRON_SECRET:</strong>{" "}{status.cronSecretConfigured
                ? "configured on this deployment. Keep the existing value; do not create a second variable."
                : "not available on this deployment. If it already exists in Vercel, check its Production scope and redeploy instead of creating another."}</span>
            </p>
            <p><strong>Environment:</strong> {status.environment}. {status.vercelProductionDeployment
              ? "This is a Production deployment; confirm both jobs are enabled in Vercel → Settings → Cron Jobs."
              : "Vercel does not automatically run these schedules in Preview, development or this sandbox."}</p>
            <p><strong>Automatic newsletter:</strong> {automaticEnabled ? "on" : "off"}. Sending also requires the 15-day interval to be due, available pieces, confirmed subscribers and a working e-mail provider.</p>
            <ul className="space-y-1 border-t border-sea/15 pt-3 text-xs">
              {status.jobs.map((job) => <li key={job.path}><strong>{job.timeUtc}</strong> · {job.name}<br /><code className="break-all text-ink/60">{job.path}</code></li>)}
            </ul>
          </>
        )}
        <p className="text-xs">Production + Preview selected for the same variable is fine. Only Production is scheduled by Vercel. Leave the Git branch filter empty for Production.</p>
        <p className="text-xs">This check never sends e-mails and does not prove a job ran. Use Vercel’s View Logs and the mailing history to verify execution. On Hobby, execution can occur within the scheduled hour.</p>
      </div>
    </section>
  );
}
