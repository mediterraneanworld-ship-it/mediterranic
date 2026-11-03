"use client";

import { useEffect, useState } from "react";

type Probe = { environment: string; ok: boolean; status?: number; paypalName?: string | null; message?: string };

type PaypalStatus = {
  configured?: boolean;
  explicitEnvironment?: string | null;
  resolvedEnvironment?: string | null;
  clientIdTail?: string | null;
  clientIdSource?: string | null;
  secretSource?: string | null;
  ok?: boolean;
  probes?: Probe[];
  diagnosis?: string;
  error?: string;
};

/**
 * Real PayPal diagnosis. Requests an OAuth token in the environment the shop
 * would use (and in the other one if the keys are rejected there), so a
 * sandbox/live mix-up is visible in one click. Nothing is written to the shop
 * and no order or charge is created.
 */
export function PaypalConnectionCheck() {
  const [config, setConfig] = useState<PaypalStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PaypalStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/paypal-status", { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as PaypalStatus) : null))
      .then((data) => {
        if (alive) setConfig(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/paypal-status", { method: "POST" });
      const data = (await response.json()) as PaypalStatus;
      setResult(data);
      setConfig(data);
    } catch {
      setResult({ error: "Connection failed. Try again; no shop data was changed." });
    } finally {
      setBusy(false);
    }
  }

  const configured = result?.configured ?? config?.configured ?? false;
  const effective = result?.resolvedEnvironment ?? config?.resolvedEnvironment ?? config?.explicitEnvironment ?? null;

  return (
    <div className="mb-3 rounded-sm border border-ink/15 bg-white/80 p-3 text-xs">
      <p className="font-medium text-ink">
        {configured ? "PayPal keys detected on this deployment" : "No PayPal keys on this deployment"}
      </p>
      <p className="mt-1 leading-relaxed text-ink/65">
        {configured ? (
          <>
            Detected keys do not prove they work: a Client ID/Secret pair from a <strong>sandbox</strong> app is
            rejected by the <strong>live</strong> API (and vice versa) with <em>invalid_client</em> — the checkout then
            shows a generic “could not start” message. Run the diagnosis: it asks PayPal for a token in the
            environment this shop would use, and in the other one if needed. No order or charge is created.
          </>
        ) : (
          <>
            Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (same REST app on developer.paypal.com) in the Vercel
            environment variables for this deployment, then redeploy. Variables saved for Production are not visible
            in the development sandbox or Preview deployments.
          </>
        )}
      </p>

      {config && (
        <dl className="mt-3 space-y-1 rounded-sm bg-bone/50 p-3 text-ink/75">
          <div>
            <dt className="inline font-medium">Environment: </dt>
            <dd className="inline">
              {config.explicitEnvironment
                ? `pinned to ${config.explicitEnvironment} (PAYPAL_ENVIRONMENT)`
                : effective
                  ? `auto-detected: ${effective}`
                  : "not pinned — auto-detected from the keys at checkout"}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Client ID: </dt>
            <dd className="inline">
              {config.clientIdTail ? `…${config.clientIdTail}` : "—"}
              {config.clientIdSource ? ` (from ${config.clientIdSource})` : ""}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Secret: </dt>
            <dd className="inline">{config.secretSource ? `set (from ${config.secretSource})` : "missing"}</dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={test}
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.14em] text-parchment transition hover:bg-sea disabled:opacity-50"
      >
        {busy ? "Testing…" : "Diagnose PayPal API"}
      </button>

      {result && (
        <div
          role="status"
          className={`mt-3 rounded-sm border p-3 leading-relaxed ${
            result.ok ? "border-sea/25 bg-sea/5 text-ink" : "border-terracotta/30 bg-terracotta/5 text-terracotta"
          }`}
        >
          <p className="font-medium">{result.diagnosis ?? result.error}</p>
          {result.probes?.length ? (
            <ul className="mt-2 space-y-1 text-ink/75">
              {result.probes.map((probe) => (
                <li key={probe.environment}>
                  {probe.ok ? "✓" : "✗"} {probe.environment}:{" "}
                  {probe.ok
                    ? "token issued — credentials accepted"
                    : `${probe.message ?? "rejected"}${probe.paypalName ? ` (${probe.paypalName})` : ""}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
