"use client";

import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Public newsletter sign-up. Used in the footer (dark) and on the shipping page
 * (light). The address is stored in the shop database and listed in the
 * back-office under "Newsletter".
 */
export function NewsletterForm({
  tone = "dark",
  source = "footer",
  title = "Field notes",
  copy = "New specimens, preparation stories and auction dates. About once a month, never more.",
}: {
  tone?: "dark" | "light";
  source?: string;
  title?: string;
  copy?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dark = tone === "dark";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setState(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.ok) {
        setState({ kind: "ok", text: data.message ?? "Thank you — you are on the list." });
        setEmail("");
      } else {
        setState({ kind: "error", text: data.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setState({ kind: "error", text: "Connection error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3
        className={`mb-3 text-[11px] uppercase tracking-[0.3em] ${dark ? "text-brass" : "text-brass"}`}
      >
        {title}
      </h3>
      <p className={`mb-4 max-w-xs text-sm leading-relaxed ${dark ? "text-parchment/65" : "text-ink/65"}`}>
        {copy}
      </p>
      <form onSubmit={handleSubmit} className="flex max-w-sm items-stretch gap-2">
        <label className="sr-only" htmlFor={`newsletter-${source}`}>
          Email address
        </label>
        <input
          id={`newsletter-${source}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoComplete="email"
          className={`h-11 w-full min-w-0 rounded-full px-4 text-sm outline-none transition focus:ring-2 ${
            dark
              ? "border border-parchment/20 bg-parchment/5 text-parchment placeholder:text-parchment/35 focus:border-brass focus:ring-brass/25"
              : "border border-ink/20 bg-white text-ink placeholder:text-ink/35 focus:border-sea focus:ring-sea/15"
          }`}
        />
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-[11px] uppercase tracking-[0.16em] transition disabled:opacity-50 ${
            dark
              ? "bg-brass text-ink hover:bg-parchment"
              : "bg-ink text-parchment hover:bg-terracotta"
          }`}
        >
          {busy ? "Sending…" : "Join"}
          {!busy && <Send size={12} strokeWidth={1.8} />}
        </button>
      </form>
      {state && (
        <p
          role="status"
          className={`mt-3 max-w-sm text-xs leading-relaxed ${
            state.kind === "ok"
              ? dark
                ? "text-brass"
                : "text-sea"
              : "text-terracotta"
          }`}
        >
          {state.text}
        </p>
      )}
    </div>
  );
}
