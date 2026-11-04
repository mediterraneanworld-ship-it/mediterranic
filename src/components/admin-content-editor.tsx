"use client";

import Image from "next/image";
import { Check, ImagePlus, Loader2, Save, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { CONNOISSEUR_GLASS_IMAGE } from "@/lib/release-info";
import {
  CONTENT_GROUPS,
  readContent,
  writeContent,
  type ContentField,
  type ContentPair,
  type SiteContent,
} from "@/lib/site-content";

const inputClass =
  "w-full rounded-sm border border-ink/20 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-sea focus:ring-2 focus:ring-sea/15";
const labelClass = "block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60";

/**
 * Back-office editor for every text and photograph of the public storefront.
 *
 * The fields are generated from CONTENT_GROUPS (src/lib/site-content.ts), so a
 * new field only has to be declared once — it appears here automatically and
 * the page that reads it falls back to its default until it is filled in.
 */
export function AdminContentEditor({
  initialContent,
  notify,
}: {
  initialContent: SiteContent;
  notify: (message: string) => void;
}) {
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [groupId, setGroupId] = useState<string>(CONTENT_GROUPS[0].id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const group = useMemo(
    () => CONTENT_GROUPS.find((g) => g.id === groupId) ?? CONTENT_GROUPS[0],
    [groupId],
  );

  function update(path: string[], value: unknown) {
    setContent((prev) => writeContent(prev, path, value));
    setDirty(true);
  }

  async function handleUpload(field: ContentField, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field.path.join("."));
    try {
      const body = new FormData();
      body.append("files", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { files?: { url: string }[]; error?: string };
      if (res.ok && data.files?.[0]) {
        update(field.path, data.files[0].url);
        notify(`Photograph updated: ${field.label}.`);
      } else {
        notify(data.error ?? "Upload failed.");
      }
    } catch {
      notify("Upload failed. Please try again.");
    } finally {
      setUploading(null);
      if (fileInputs.current[field.path.join(".")]) {
        fileInputs.current[field.path.join(".")]!.value = "";
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; content?: SiteContent; error?: string };
      if (res.ok && data.ok) {
        if (data.content) setContent(data.content);
        setDirty(false);
        notify("All page texts and photographs saved.");
      } else {
        notify(data.error ?? "Could not save.");
      }
    } catch {
      notify("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-ink">Page texts &amp; photographs</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink/60">
            Every text and every photograph of the public site, page by page. Pick a page on the left, edit, then
            press <strong>Save all pages</strong>. Photos can be uploaded straight from your computer — they are
            stored in the shop database, so they survive any deployment.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-terracotta px-6 text-xs uppercase tracking-[0.2em] text-parchment transition hover:bg-ink disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Saving…" : dirty ? "Save all pages" : "Saved"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Page list */}
        <nav aria-label="Pages" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {CONTENT_GROUPS.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setGroupId(g.id)}
                  className={`w-full rounded-sm px-3 py-2 text-left text-[12px] transition ${
                    g.id === groupId
                      ? "bg-ink text-parchment"
                      : "bg-bone/60 text-ink/75 hover:bg-bone"
                  }`}
                >
                  {g.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Fields */}
        <div className="rounded-sm border border-ink/10 bg-white/75 p-5">
          <div className="mb-4 border-b border-ink/10 pb-3">
            <h3 className="font-display text-2xl text-ink">{group.label}</h3>
            {group.note && <p className="mt-1 text-xs text-ink/55">{group.note}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {group.fields.map((field) => {
              const key = field.path.join(".");
              const value = readContent(content, field.path);

              if (field.type === "toggle") {
                const on = Boolean(value);
                return (
                  <div key={key} className="md:col-span-2">
                    <span className={labelClass}>{field.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => update(field.path, !on)}
                      className={`mt-2 inline-flex h-11 items-center gap-3 rounded-full border px-4 text-sm transition ${
                        on ? "border-sea bg-sea/10 text-ink" : "border-ink/20 bg-white text-ink/60"
                      }`}
                    >
                      <span
                        className={`relative h-6 w-11 rounded-full transition ${on ? "bg-sea" : "bg-ink/20"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            on ? "left-[1.4rem]" : "left-0.5"
                          }`}
                        />
                      </span>
                      {on ? "On" : "Off"}
                    </button>
                    {field.hint && <p className="mt-2 text-[11px] text-ink/45">{field.hint}</p>}
                  </div>
                );
              }

              if (field.type === "pairs") {
                const items = (Array.isArray(value) ? value : []) as ContentPair[];
                return (
                  <div key={key} className="md:col-span-2">
                    <span className={labelClass}>{field.label}</span>
                    {field.hint && <p className="mt-1 text-[11px] text-ink/45">{field.hint}</p>}
                    <div className="mt-2 space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="rounded-sm border border-ink/10 bg-parchment/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-brass">
                              Item {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                update(
                                  field.path,
                                  items.filter((_, i) => i !== index),
                                )
                              }
                              className="text-ink/40 transition hover:text-terracotta"
                              aria-label={`Remove item ${index + 1}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <input
                            value={item.title}
                            onChange={(e) => {
                              const next = [...items];
                              next[index] = { ...next[index], title: e.target.value };
                              update(field.path, next);
                            }}
                            placeholder={field.itemLabels?.[0] ?? "Title"}
                            className={`${inputClass} mt-2`}
                          />
                          <textarea
                            value={item.text}
                            rows={2}
                            onChange={(e) => {
                              const next = [...items];
                              next[index] = { ...next[index], text: e.target.value };
                              update(field.path, next);
                            }}
                            placeholder={field.itemLabels?.[1] ?? "Text"}
                            className={`${inputClass} mt-2`}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => update(field.path, [...items, { title: "", text: "" }])}
                        className="rounded-full border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink/70 transition hover:border-ink"
                      >
                        + Add item
                      </button>
                    </div>
                  </div>
                );
              }

              if (field.type === "lines") {
                const lines = Array.isArray(value) ? (value as string[]) : [];
                return (
                  <label key={key} className="block md:col-span-2">
                    <span className={labelClass}>{field.label}</span>
                    <textarea
                      value={lines.join("\n")}
                      rows={Math.min(10, Math.max(3, lines.length + 1))}
                      onChange={(e) =>
                        update(
                          field.path,
                          e.target.value.split("\n"),
                        )
                      }
                      className={`${inputClass} mt-1.5`}
                    />
                    <span className="mt-1 block text-[11px] text-ink/45">One item per line.</span>
                  </label>
                );
              }

              if (field.type === "image") {
                const src = typeof value === "string" ? value : "";
                return (
                  <div key={key} className="md:col-span-2">
                    <span className={labelClass}>{field.label}</span>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-sm border border-ink/15 bg-bone">
                        {src ? (
                          <Image src={src} alt={field.label} fill sizes="112px" className="object-cover" />
                        ) : (
                          <span className="grid h-full place-items-center text-ink/30">
                            <ImagePlus size={18} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 basis-48 flex-1">
                        <input
                          value={src}
                          onChange={(e) => update(field.path, e.target.value)}
                          placeholder="/images/… or https://…"
                          className={inputClass}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputs.current[key]?.click()}
                            disabled={uploading === key}
                            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-parchment transition hover:bg-sea disabled:opacity-50"
                          >
                            {uploading === key ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Upload size={12} />
                            )}
                            Upload photo
                          </button>
                          {key === "home.collections.covers.connoisseur" && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  update(field.path, CONNOISSEUR_GLASS_IMAGE);
                                  notify("Glass display cover selected. Save the page content to publish it.");
                                }}
                                className="inline-flex min-h-10 items-center rounded-full border border-brass/50 bg-brass/10 px-3 text-[11px] uppercase tracking-[0.12em] text-ink hover:border-brass"
                              >
                                Use glass display cover
                              </button>
                              <a href={CONNOISSEUR_GLASS_IMAGE} target="_blank" rel="noopener noreferrer" className="text-xs text-sea underline underline-offset-4">Preview glass cover</a>
                            </>
                          )}
                          {src && (
                            <button
                              type="button"
                              onClick={() => update(field.path, "")}
                              className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink/60 transition hover:border-terracotta hover:text-terracotta"
                            >
                              <Trash2 size={12} /> Reset
                            </button>
                          )}
                          <span className="text-[11px] text-ink/45">JPG or PNG, stored in the shop database.</span>
                        </div>
                      </div>
                    </div>
                    <input
                      ref={(el) => {
                        fileInputs.current[key] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleUpload(field, e)}
                    />
                  </div>
                );
              }

              if (field.type === "textarea") {
                return (
                  <label key={key} className="block md:col-span-2">
                    <span className={labelClass}>{field.label}</span>
                    <textarea
                      value={typeof value === "string" ? value : ""}
                      rows={3}
                      onChange={(e) => update(field.path, e.target.value)}
                      className={`${inputClass} mt-1.5`}
                    />
                  </label>
                );
              }

              return (
                <label key={key} className="block">
                  <span className={labelClass}>{field.label}</span>
                  <input
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => update(field.path, e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.16em] text-parchment transition hover:bg-sea disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Saving…" : "Save all pages"}
            </button>
            <span className="text-[11px] text-ink/50">
              {dirty ? "You have unsaved changes." : "Everything is saved."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
