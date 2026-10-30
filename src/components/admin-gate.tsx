"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { NewsletterSubscriber, ProductWithStats, SiteSettings } from "@/lib/catalog";
import { AdminDashboard } from "@/components/admin-dashboard";

type OrderEntry = Parameters<typeof AdminDashboard>[0]["orders"];

export function AdminGate({
  products,
  settings,
  orders,
  subscribers,
}: {
  products: ProductWithStats[];
  settings: SiteSettings;
  orders: OrderEntry;
  subscribers: NewsletterSubscriber[];
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("mediterranic23");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setAuthed(true);
      } else {
        setError(data.error ?? "Incorrect password.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
    setAuthed(false);
    setPassword("mediterranic23");
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-5 py-24">
        <div className="rounded-sm border border-ink/15 bg-white/85 p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-parchment">
              <Lock size={18} strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-brass">Private access</p>
              <h1 className="font-display text-3xl text-ink">Curator Back-Office</h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink/65">
            This area is reserved for the studio. Enter your curator password to manage specimens, upload real
            photographs, switch marketplace labels and edit storefront copy.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.2em] text-ink/60">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-sm border border-ink/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-sea focus:ring-2 focus:ring-sea/15"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-terracotta">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={checking}
              className="h-12 w-full rounded-full bg-ink text-xs uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta disabled:opacity-60"
            >
              {checking ? "Checking…" : "Enter Back-Office"}
            </button>
          </form>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink/50">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-sea" />
            Password is pre-filled for this private preview. Change it via the <code className="rounded bg-bone px-1">ADMIN_PASSWORD</code>{" "}
            environment variable before going live.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink/60 transition hover:text-ink"
          >
            <ArrowLeft size={13} /> Back to public storefront
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      initialProducts={products}
      initialSettings={settings}
      orders={orders}
      initialSubscribers={subscribers}
      onSignOut={handleSignOut}
    />
  );
}
