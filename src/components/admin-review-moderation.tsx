"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, ExternalLink, RefreshCw, X } from "lucide-react";
import { StarRating } from "@/components/star-rating";
import type { ReviewModerationStatus } from "@/lib/review-moderation";

type Filter = ReviewModerationStatus | "all";
type ReviewEntry = {
  id: number; authorName: string; authorCountry: string; rating: number;
  title: string; body: string; productName: string; productSlug: string;
  moderationStatus: ReviewModerationStatus; moderatedAt: string | null;
  createdAt: string; verifiedPurchase: boolean; showOnHome: boolean;
};
type Queue = {
  reviews: ReviewEntry[]; counts: Record<Filter, number>; total: number; page: number; pageSize: number;
  home: { selected: number; limit: number; automatic: number };
};
const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Pending" }, { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" }, { id: "all", label: "All" },
];

export function AdminReviewModeration({
  products = [],
}: {
  products?: { id: number; name: string; slug: string }[];
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // New review form fields
  const [authorName, setAuthorName] = useState("");
  const [authorCountry, setAuthorCountry] = useState("");
  const [rating, setRating] = useState(5);
  const [productId, setProductId] = useState<number>(products[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showOnHome, setShowOnHome] = useState(true);
  const [verifiedPurchase, setVerifiedPurchase] = useState(true);

  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reviews?status=${filter}&page=${page}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Could not load reviews. Please sign in again or retry.");
      const data = await response.json() as Queue;
      if (!controller.signal.aborted) {
        setQueue(data);
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
        if (page > lastPage) setPage(lastPage);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load reviews.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  async function moderate(id: number, status: ReviewModerationStatus) {
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (!response.ok) throw new Error("Could not confirm the moderation change. Refresh the queue before retrying.");
      await load();
      setNotice(status === "approved" ? "Review approved. It is now public and included in the ratings."
        : status === "rejected" ? "Review rejected and hidden from the public site. The record is kept."
        : "Review returned to pending and hidden until approval.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not confirm the change.");
    } finally { setBusy(null); }
  }

    /** Shows a public review on the home page, or takes it off again. The server enforces the limit. */
  async function setHomePick(review: ReviewEntry, showOnHome: boolean) {
    setBusy(review.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: review.id, showOnHome }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not confirm the home page change. Refresh the queue before retrying.");
      await load();
      setNotice(showOnHome ? 'Shown on the home page under "From collectors who have been where you are".' : "Removed from the home page. It stays published on its piece page.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not confirm the change.");
    } finally { setBusy(null); }
  }

  async function handleCreateReview(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !title.trim() || !body.trim()) {
      setError("Author name, title and review text are required.");
      return;
    }
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          authorCountry: authorCountry.trim() || "Worldwide",
          rating,
          productId: productId || products[0]?.id || 1,
          title: title.trim(),
          body: body.trim(),
          showOnHome,
          verifiedPurchase,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not create review.");
      // Reset form
      setAuthorName("");
      setAuthorCountry("");
      setTitle("");
      setBody("");
      setShowAddForm(false);
      setFilter("approved");
      await load();
      setNotice(
        showOnHome
          ? "Review added and approved! It is now active and chosen for the home page."
          : "Review added and approved for its piece page.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create review.");
    } finally {
      setCreating(false);
    }
  }

  const pages = Math.max(1, Math.ceil((queue?.total ?? 0) / (queue?.pageSize ?? 20)));
  return (
    <section className="mt-10 space-y-6" aria-label="Review moderation">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-brass">Owners &amp; visitors</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Review moderation &amp; Curator reviews</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
            Manage visitor submissions or write real reviews you have received over the years to feature on the homepage.
            Only approved reviews appear publicly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-xs uppercase tracking-wider text-parchment hover:bg-sea"
          >
            {showAddForm ? "Cancel" : "+ Write real review"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy !== null}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-5 text-xs text-ink hover:border-sea disabled:opacity-50"
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Expandable Write Review Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateReview}
          className="rounded-sm border border-sea/30 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <div>
              <h3 className="font-display text-2xl text-ink">Add a genuine collector review</h3>
              <p className="text-xs text-ink/60">
                Write real reviews received over the years to display on the home page and in the catalogue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-ink/40 hover:text-ink text-sm"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">Author name *</span>
              <input
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Pierre D."
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">Country / location</span>
              <input
                value={authorCountry}
                onChange={(e) => setAuthorCountry(e.target.value)}
                placeholder="e.g. France, USA, Japan"
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">Rating (stars)</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
              >
                <option value={5}>★★★★★ (5 stars)</option>
                <option value={4}>★★★★☆ (4 stars)</option>
                <option value={3}>★★★☆☆ (3 stars)</option>
                <option value={2}>★★☆☆☆ (2 stars)</option>
                <option value={1}>★☆☆☆☆ (1 star)</option>
              </select>
            </label>

            {products.length > 0 && (
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">Associated piece / specimen</span>
                <select
                  value={productId || products[0]?.id}
                  onChange={(e) => setProductId(Number(e.target.value))}
                  className="mt-1 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">Review headline / title *</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exceptional Fezouata specimen, impeccably prepared"
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
              />
            </label>

            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60">Review body text *</span>
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="e.g. Arrived perfectly crated with museum documentation. Spines are sharp and natural."
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-4">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink">
                <input
                  type="checkbox"
                  checked={showOnHome}
                  onChange={(e) => setShowOnHome(e.target.checked)}
                  className="h-4 w-4 rounded border-ink/30 text-sea focus:ring-sea"
                />
                Show on home page (rotates with other chosen reviews)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink">
                <input
                  type="checkbox"
                  checked={verifiedPurchase}
                  onChange={(e) => setVerifiedPurchase(e.target.checked)}
                  className="h-4 w-4 rounded border-ink/30 text-sea focus:ring-sea"
                />
                Mark as verified owner
              </label>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sea px-6 text-xs uppercase tracking-wider text-parchment hover:bg-ink disabled:opacity-50"
            >
              {creating ? "Publishing…" : "Publish review"}
            </button>
          </div>
        </form>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Review filters">
        {FILTERS.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id} disabled={busy !== null}
          onClick={() => { setFilter(id); setPage(1); }}
          className={`min-h-11 rounded-full border px-5 text-xs uppercase tracking-wider transition ${filter === id ? "border-ink bg-ink text-parchment" : "border-ink/20 bg-white/70 text-ink hover:border-sea"}`}>
          {label}{queue ? ` (${queue.counts[id]})` : ""}
        </button>)}
      </div>
            {queue && (
        <p className="rounded-sm border border-ink/10 bg-bone/60 p-4 text-sm leading-relaxed text-ink/75">
          <span className="font-medium text-ink">Home page reviews:</span>{" "}
          {queue.home.selected > 0
            ? `${queue.home.selected} of ${queue.home.limit} chosen. The home shows only these, newest first.`
            : `None chosen. The home shows the ${queue.home.automatic} most recent 5-star reviews automatically. Choose up to ${queue.home.limit} below to take over.`}
        </p>
      )}
      {notice && <p role="status" className="rounded-sm bg-sea/10 p-4 text-sm text-sea">{notice}</p>}
      {error && <p role="alert" className="rounded-sm bg-terracotta/10 p-4 text-sm text-terracotta">{error}</p>}
      {loading ? <p role="status" className="py-8 text-sm text-ink/60">Loading reviews…</p> : queue?.reviews.length === 0 ? (
        <div className="rounded-sm border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">No reviews in this queue.</div>
      ) : (
        <div className="space-y-4">
          {queue?.reviews.map((review) => (
            <article key={review.id} data-review-id={review.id} className="min-w-0 rounded-sm border border-ink/15 bg-white/80 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <a href={`/shop/${review.productSlug}#reviews`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-sea underline underline-offset-4">
                  {review.productName}<ExternalLink size={13} aria-hidden="true" />
                </a>
                <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ${review.moderationStatus === "approved" ? "bg-sea/10 text-sea" : review.moderationStatus === "pending" ? "bg-brass/15 text-ink" : "bg-terracotta/10 text-terracotta"}`}>{review.moderationStatus}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink/60"><StarRating rating={review.rating} size={14} /><span>{review.authorName} · {review.authorCountry}</span><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("en-GB")}</time>{review.verifiedPurchase && <span>Verified owner</span>}</div>
              <h3 className="mt-3 font-display text-2xl text-ink">{review.title}</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/75">{review.body}</p>
              {review.moderatedAt && <p className="mt-3 text-xs text-ink/45">Last decision: {new Date(review.moderatedAt).toLocaleString("en-GB")}</p>}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
                <button type="button" onClick={() => void moderate(review.id, "approved")} disabled={busy !== null || review.moderationStatus === "approved"}
                  aria-label={`Approve review by ${review.authorName}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sea px-5 text-xs text-white disabled:opacity-40"><Check size={15} aria-hidden="true" />Approve</button>
                <button type="button" onClick={() => void moderate(review.id, "rejected")} disabled={busy !== null || review.moderationStatus === "rejected"}
                  aria-label={`Reject review by ${review.authorName}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-terracotta/40 px-5 text-xs text-terracotta disabled:opacity-40"><X size={15} aria-hidden="true" />Reject</button>
                <button type="button" onClick={() => void moderate(review.id, "pending")} disabled={busy !== null || review.moderationStatus === "pending"}
                  aria-label={`Return review by ${review.authorName} to pending`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-5 text-xs text-ink/70 disabled:opacity-40"><Clock size={15} aria-hidden="true" />Return to pending</button>
                {review.moderationStatus === "approved" && (review.showOnHome ? (
                  <button type="button" onClick={() => void setHomePick(review, false)} disabled={busy !== null}
                    aria-label={`Remove review by ${review.authorName} from the home page`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brass bg-brass/15 px-5 text-xs text-ink disabled:opacity-40">Remove from home page</button>
                ) : (
                  <button type="button" onClick={() => void setHomePick(review, true)} disabled={busy !== null || (queue?.home.selected ?? 0) >= (queue?.home.limit ?? 6)}
                    aria-label={`Show review by ${review.authorName} on the home page`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-5 text-xs text-ink disabled:opacity-40">Show on home page</button>
                ))}

              </div>
            </article>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60">
        <span>Page {page} of {pages} · {queue?.total ?? 0} reviews</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading || busy !== null} className="min-h-11 rounded-full border border-ink/20 px-4 disabled:opacity-35">Previous</button>
          <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= pages || loading || busy !== null} className="min-h-11 rounded-full border border-ink/20 px-4 disabled:opacity-35">Next</button>
        </div>
      </div>
    </section>
  );
}
