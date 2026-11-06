"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

type Target = { id: number; name: string; slug: string; specimenReference: string | null };

export function AdminDeleteProductDialog({ product, busy, error, onClose, onConfirm }: {
  product: Target;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="delete-specimen-title" aria-describedby="delete-specimen-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-sm border border-terracotta/30 bg-parchment p-5 text-ink shadow-2xl backdrop:bg-midnight/60 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <h2 id="delete-specimen-title" className="font-display text-3xl">Delete permanently?</h2>
        <button type="button" aria-label="Cancel permanent deletion" disabled={busy} onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-40"><X size={18} /></button>
      </div>
      <p className="mt-3 break-words font-medium">{product.specimenReference ? `${product.specimenReference} · ` : ""}{product.name}</p>
      <p id="delete-specimen-description" className="mt-3 text-sm leading-relaxed text-ink/75">
        This removes the specimen from the catalogue, public shop and archive. It is not moved to Draft or Archive and there is no undo button. Download a backup first.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-ink/65">
        <li>Order receipts and existing review moderation history are retained.</li>
        <li>Shared uploaded photographs are not erased.</li>
        <li>This does not cancel listings on eBay or Catawiki.</li>
        <li>Specimens with payments in progress are protected.</li>
      </ul>
      <form className="mt-5" onSubmit={(event) => { event.preventDefault(); if (typed === "DELETE" && !busy) void onConfirm(); }}>
        <label className="block text-sm" htmlFor="delete-specimen-confirmation">Type <strong>DELETE</strong> to confirm this specimen:</label>
        <input id="delete-specimen-confirmation" autoComplete="off" spellCheck={false} value={typed} onChange={(event) => setTyped(event.target.value)} disabled={busy}
          className="mt-2 min-h-11 w-full rounded-sm border border-ink/25 bg-white px-3 text-base outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/15" />
        {error && <p role="alert" className="mt-4 rounded-sm bg-terracotta/10 p-3 text-sm text-terracotta">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-full border border-ink/25 px-5 text-xs uppercase tracking-wider disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={typed !== "DELETE" || busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-5 text-xs uppercase tracking-wider text-white disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
