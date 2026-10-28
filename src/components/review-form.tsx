"use client";

import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    if (rating === 0) {
      setStatus("error");
      setMessage("Please choose a rating.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          rating,
          authorName: data.get("authorName"),
          authorCountry: data.get("authorCountry"),
          title: data.get("title"),
          body: data.get("body"),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "We could not publish your review. Please try again.");
        return;
      }

      form.reset();
      setRating(0);
      setStatus("success");
      setMessage("Thank you. Your review is now published below.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  const field =
    "w-full rounded-sm border border-ink/15 bg-white/70 px-4 py-3 text-sm outline-none transition placeholder:text-ink/35 focus:border-sea focus:ring-2 focus:ring-sea/15";

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-sm border border-ink/10 bg-white/50 p-6 md:p-8">
      <div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-ink/60">Your rating</p>
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= (hovered || rating);
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHovered(n)}
                onClick={() => setRating(n)}
                className="rounded p-1 transition hover:scale-110"
              >
                <Star size={24} strokeWidth={1.4} className={active ? "fill-brass text-brass" : "text-ink/25"} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-[11px] uppercase tracking-[0.25em] text-ink/60">Name</span>
          <input name="authorName" required minLength={2} maxLength={60} placeholder="e.g. Julian M." className={field} />
        </label>
        <label className="space-y-2">
          <span className="text-[11px] uppercase tracking-[0.25em] text-ink/60">Country</span>
          <input name="authorCountry" required minLength={2} maxLength={60} placeholder="e.g. United Kingdom" className={field} />
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-[11px] uppercase tracking-[0.25em] text-ink/60">Headline</span>
        <input name="title" required minLength={3} maxLength={120} placeholder="Sum it up in a line" className={field} />
      </label>
      <label className="block space-y-2">
        <span className="text-[11px] uppercase tracking-[0.25em] text-ink/60">Your experience</span>
        <textarea
          name="body"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          placeholder="How does it look in your study? How was the documentation and delivery?"
          className={`${field} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-12 rounded-full bg-ink px-8 text-[12px] uppercase tracking-[0.2em] text-parchment transition hover:bg-terracotta disabled:opacity-60"
        >
          {status === "submitting" ? "Publishing…" : "Publish review"}
        </button>
        {message && (
          <p
            role={status === "error" ? "alert" : "status"}
            className={`text-sm ${status === "error" ? "text-terracotta" : "text-sea"}`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
