"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { MarketplaceBox } from "@/lib/site-content";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { CONNOISSEUR_GLASS_IMAGE } from "@/lib/release-info";
import {
  DEFAULT_HOME_ORDER,
  HOME_SECTIONS,
  moveHomeSection,
  moveHomeSectionBy,
  normalizeHomeOrder,
  type HomeSectionId,
  type MovableHomeSectionId,
} from "@/lib/home-sections";
import {
  CONTENT_GROUPS,
  readContent,
  writeContent,
  type ContentField,
  type ContentGroup,
  type ContentPair,
  type SiteContent,
} from "@/lib/site-content";

const inputClass =
  "w-full rounded-sm border border-ink/20 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-sea focus:ring-2 focus:ring-sea/15";
const labelClass = "block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/60";

/**
 * Back-office editor for every text, photograph, link and section of the shop.
 *
 * Provides two modes:
 *  1) "Home sections (H0–H13)": visual reordering (drag & drop or accessible arrows)
 *     and click-to-expand inline editing of every field in every home section.
 *  2) "Other pages & settings": standard page-by-page editor (Shop, Archive, Shipping,
 *     Checkout, Product headings, Brand, Commerce, 404, Analytics).
 */
export function AdminContentEditor({
  initialContent,
  notify,
}: {
  initialContent: SiteContent;
  notify: (message: string) => void;
}) {
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [mainTab, setMainTab] = useState<"home" | "other">("home");
  const [otherGroupId, setOtherGroupId] = useState<string>("shop");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [draggedId, setDraggedId] = useState<HomeSectionId | null>(null);
  const [dragOverId, setDragOverId] = useState<HomeSectionId | null>(null);
  const [draggedBoxIdx, setDraggedBoxIdx] = useState<number | null>(null);
  const [dragOverBoxIdx, setDragOverBoxIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const homeOrder = useMemo(
    () => normalizeHomeOrder(content.layout.home),
    [content.layout.home],
  );

  const groupById = useMemo(() => {
    const map = new Map<string, ContentGroup>();
    for (const g of CONTENT_GROUPS) map.set(g.id, g);
    return map;
  }, []);

  const otherGroups = useMemo(
    () => CONTENT_GROUPS.filter((g) => !g.id.startsWith("h")),
    [],
  );

  const activeOtherGroup = useMemo(
    () => groupById.get(otherGroupId) ?? otherGroups[0],
    [groupById, otherGroupId, otherGroups],
  );

  function update(path: string[], value: unknown) {
    setContent((prev) => writeContent(prev, path, value));
    setDirty(true);
  }

  function setSectionOrder(nextOrder: HomeSectionId[]) {
    update(["layout", "home"], nextOrder);
  }

  function toggleSectionOpen(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAllHome() {
    const next: Record<string, boolean> = {};
    for (const s of HOME_SECTIONS) next[s.id] = true;
    setOpenSections(next);
  }

  function collapseAllHome() {
    setOpenSections({});
  }

  function resetHomeOrder() {
    setSectionOrder([...DEFAULT_HOME_ORDER]);
    notify("Home section order reset to default. Save all pages to publish.");
  }

  const marketplaceBoxes = useMemo(() => {
    const raw = readContent(content, ["home", "marketplaces", "boxes"]);
    return (Array.isArray(raw) ? raw : []) as MarketplaceBox[];
  }, [content]);

  function updateMarketplaceBoxes(boxes: MarketplaceBox[]) {
    update(["home", "marketplaces", "boxes"], boxes);
  }

  function updateBox(index: number, key: keyof MarketplaceBox, val: unknown) {
    const next = [...marketplaceBoxes];
    if (next[index]) {
      next[index] = { ...next[index], [key]: val };
      updateMarketplaceBoxes(next);
    }
  }

  function addMarketplaceBox() {
    const next = [
      ...marketplaceBoxes,
      {
        id: `box-${Date.now()}`,
        title: "New Marketplace",
        eyebrow: "Storefront",
        text: "Direct verified link",
        url: "https://",
        logo: "",
        bgColor: "#0b2030",
        textColor: "white" as const,
      },
    ];
    updateMarketplaceBoxes(next);
    notify("Marketplace box added. Edit details and save changes.");
  }

  function deleteMarketplaceBox(index: number) {
    const next = marketplaceBoxes.filter((_, i) => i !== index);
    updateMarketplaceBoxes(next);
    notify("Marketplace box removed.");
  }

  function moveMarketplaceBox(from: number, to: number) {
    if (from < 0 || to < 0 || from >= marketplaceBoxes.length || to >= marketplaceBoxes.length || from === to) return;
    const next = [...marketplaceBoxes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateMarketplaceBoxes(next);
  }

  async function handleBoxLogoUpload(boxIndex: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = `box-logo-${boxIndex}`;
    setUploading(key);
    try {
      const body = new FormData();
      body.append("files", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { files?: { url: string }[]; error?: string };
      if (res.ok && data.files?.[0]) {
        updateBox(boxIndex, "logo", data.files[0].url);
        notify("Marketplace logo uploaded.");
      } else {
        notify(data.error ?? "Upload failed.");
      }
    } catch {
      notify("Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  async function handleUpload(field: ContentField, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = field.path.join(".");
    setUploading(key);
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
      if (fileInputs.current[key]) {
        fileInputs.current[key]!.value = "";
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
        notify("All page texts, photographs and section positions saved.");
      } else {
        notify(data.error ?? "Could not save.");
      }
    } catch {
      notify("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: ContentField) {
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
            <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-sea" : "bg-ink/20"}`}>
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
                  <span className="text-[10px] uppercase tracking-[0.2em] text-brass">Item {index + 1}</span>
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
            onChange={(e) => update(field.path, e.target.value.split("\n"))}
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
                  {uploading === key ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload photo
                </button>
                {key === "home.collections.covers.connoisseur" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        update(field.path, CONNOISSEUR_GLASS_IMAGE);
                        notify("Glass display cover selected. Save all pages to publish.");
                      }}
                      className="inline-flex min-h-10 items-center rounded-full border border-brass/50 bg-brass/10 px-3 text-[11px] uppercase tracking-[0.12em] text-ink hover:border-brass"
                    >
                      Use glass display cover
                    </button>
                    <a
                      href={CONNOISSEUR_GLASS_IMAGE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sea underline underline-offset-4"
                    >
                      View photograph
                    </a>
                  </>
                )}
                {src && (
                  <button
                    type="button"
                    onClick={() => update(field.path, "")}
                    className="text-xs text-ink/50 hover:text-terracotta"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                ref={(el) => {
                  fileInputs.current[key] = el;
                }}
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(field, e)}
                className="hidden"
              />
            </div>
          </div>
          {field.hint && <p className="mt-1 text-[11px] text-ink/45">{field.hint}</p>}
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
          {field.hint && <span className="mt-1 block text-[11px] text-ink/45">{field.hint}</span>}
        </label>
      );
    }

    return (
      <label key={key} className="block">
        <span className={labelClass}>{field.label}</span>
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => update(field.path, e.target.value)}
          placeholder={field.placeholder}
          className={`${inputClass} mt-1.5`}
        />
        {field.hint && <span className="mt-1 block text-[11px] text-ink/45">{field.hint}</span>}
      </label>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-ink">Page texts &amp; photographs</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink/60">
            Every text, photograph, link and section of the shop. Reorder the homepage blocks (H0–H13) by dragging or
            using the arrows. Click any block to expand and edit its content in full. Everything is stored in Neon and
            survives deployments.
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

      {/* Main mode tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <div className="inline-flex rounded-full bg-bone/70 p-1">
          <button
            type="button"
            onClick={() => setMainTab("home")}
            className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.16em] transition ${
              mainTab === "home" ? "bg-ink font-medium text-parchment shadow-sm" : "text-ink/70 hover:text-ink"
            }`}
          >
            Home sections (H0–H13)
          </button>
          <button
            type="button"
            onClick={() => setMainTab("other")}
            className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.16em] transition ${
              mainTab === "other" ? "bg-ink font-medium text-parchment shadow-sm" : "text-ink/70 hover:text-ink"
            }`}
          >
            Other pages &amp; settings
          </button>
        </div>

        {mainTab === "home" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={expandAllHome}
              className="rounded-full border border-ink/20 px-3 py-1.5 uppercase tracking-[0.12em] text-ink/70 hover:border-ink hover:text-ink"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAllHome}
              className="rounded-full border border-ink/20 px-3 py-1.5 uppercase tracking-[0.12em] text-ink/70 hover:border-ink hover:text-ink"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={resetHomeOrder}
              className="inline-flex items-center gap-1 rounded-full border border-ink/20 px-3 py-1.5 uppercase tracking-[0.12em] text-ink/70 hover:border-ink hover:text-ink"
            >
              <RotateCcw size={12} /> Reset order
            </button>
          </div>
        )}
      </div>

      {/* MODE 1: HOME SECTIONS (H0–H13) */}
      {mainTab === "home" && (
        <div className="space-y-3">
          <p className="text-xs text-ink/55">
            <strong>H0 Top Bar</strong> and <strong>H1 Header</strong> are fixed at the top; <strong>H13 Footer</strong> is
            fixed at the bottom. <strong>H2–H12</strong> can be reordered freely. Click a section’s row to open or close
            its editor; the grip and movement buttons keep their own actions.
          </p>

          <ol className="space-y-3">
            {homeOrder.map((sectionId, orderIndex) => {
              const meta = HOME_SECTIONS.find((s) => s.id === sectionId);
              const group = groupById.get(sectionId);
              if (!meta || !group) return null;
              const isFixed = Boolean(meta.fixed);
              const isOpen = Boolean(openSections[sectionId]);
              const isDragging = draggedId === sectionId;
              const isDragTarget = dragOverId === sectionId && draggedId !== sectionId;

              return (
                <li
                  key={sectionId}
                  draggable={!isFixed}
                  onDragStart={(e) => {
                    if (isFixed) return;
                    setDraggedId(sectionId);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", sectionId);
                  }}
                  onDragOver={(e) => {
                    if (isFixed || !draggedId || draggedId === sectionId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverId !== sectionId) setDragOverId(sectionId);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === sectionId) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggedId || isFixed) return;
                    setSectionOrder(moveHomeSection(homeOrder, draggedId, sectionId));
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={`rounded-sm border bg-white transition ${
                    isDragTarget
                      ? "border-sea ring-2 ring-sea/30"
                      : isDragging
                        ? "opacity-50"
                        : "border-ink/15 hover:border-ink/30"
                  }`}
                >
                  {/* Clicking anywhere in the header row expands this section.
                      Native controls stop propagation so moving/saving never toggles it. */}
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3 p-3.5 hover:bg-bone/30 sm:p-4"
                    onClick={(event) => {
                      const target = event.target;
                      if (!(target instanceof Element) || target.closest("button, input, textarea, select, a, label, [data-no-toggle]")) return;
                      toggleSectionOpen(sectionId);
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {!isFixed ? (
                        <span
                          data-no-toggle
                          draggable={!isFixed}
                          className="cursor-grab text-ink/35 active:cursor-grabbing hover:text-ink"
                          title="Drag to reposition"
                        >
                          <GripVertical size={18} />
                        </span>
                      ) : (
                        <span className="w-[18px]" />
                      )}

                      <button
                        type="button"
                        onClick={() => toggleSectionOpen(sectionId)}
                        className="group flex min-w-0 items-center gap-3 text-left"
                      >
                        <span className="inline-flex h-7 min-w-10 items-center justify-center rounded bg-ink px-2 font-mono text-xs font-semibold text-parchment">
                          {meta.number}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink group-hover:text-sea">
                            {meta.label}
                          </p>
                          <p className="truncate text-[11px] text-ink/50">
                            {isFixed
                              ? meta.fixed === "top"
                                ? "Fixed header frame · all pages"
                                : "Fixed footer frame · all pages"
                              : `Position #${orderIndex + 1} on homepage`}
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                      {!isFixed && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSectionOrder(moveHomeSectionBy(homeOrder, sectionId, -1))}
                            aria-label={`Move ${meta.number} up`}
                            title="Move up"
                            className="grid h-8 w-8 place-items-center rounded border border-ink/15 text-ink/65 hover:border-ink hover:text-ink"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSectionOrder(moveHomeSectionBy(homeOrder, sectionId, 1))}
                            aria-label={`Move ${meta.number} down`}
                            title="Move down"
                            className="grid h-8 w-8 place-items-center rounded border border-ink/15 text-ink/65 hover:border-ink hover:text-ink"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleSectionOpen(sectionId)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${meta.number}` : `Expand ${meta.number}`}
                        className="grid h-8 w-8 place-items-center rounded border border-ink/15 text-ink/65 hover:border-ink hover:text-ink"
                      >
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Inline content editor */}
                  {isOpen && (
                    <div className="border-t border-ink/10 bg-parchment/30 p-4 sm:p-6">
                      {group.note && <p className="mb-4 text-xs leading-relaxed text-ink/60">{group.note}</p>}
                      <div className="grid gap-4 md:grid-cols-2">{group.fields.map((f) => renderField(f))}</div>

                      {/* H9 Dedicated Marketplace Box Manager with Drag & Reorder, Logo and Colors */}
                      {sectionId === "h9" && (
                        <div className="mt-8 border-t border-ink/10 pt-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="font-display text-xl text-ink">Marketplace Boxes &amp; Links</h4>
                              <p className="text-xs text-ink/60">
                                Reorder boxes by dragging or with arrows. Add boxes, pick background colors or brand presets, and upload logos.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={addMarketplaceBox}
                              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-[0.14em] text-parchment transition hover:bg-sea"
                            >
                              <Plus size={13} /> Add marketplace box
                            </button>
                          </div>

                          <div className="mt-5 space-y-4">
                            {marketplaceBoxes.map((box, bIdx) => {
                              const isBoxDragging = draggedBoxIdx === bIdx;
                              const isBoxTarget = dragOverBoxIdx === bIdx && draggedBoxIdx !== bIdx;
                              const isPreset = ["ebay-quad", "cw-grad", "ig-grad", "fb-grad", "wa-grad"].includes(box.bgColor || "");

                              return (
                                <div
                                  key={box.id || `box-${bIdx}`}
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedBoxIdx(bIdx);
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData("text/plain", String(bIdx));
                                  }}
                                  onDragOver={(e) => {
                                    if (draggedBoxIdx === null || draggedBoxIdx === bIdx) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    if (dragOverBoxIdx !== bIdx) setDragOverBoxIdx(bIdx);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverBoxIdx === bIdx) setDragOverBoxIdx(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedBoxIdx !== null && draggedBoxIdx !== bIdx) {
                                      moveMarketplaceBox(draggedBoxIdx, bIdx);
                                    }
                                    setDraggedBoxIdx(null);
                                    setDragOverBoxIdx(null);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedBoxIdx(null);
                                    setDragOverBoxIdx(null);
                                  }}
                                  className={`rounded-sm border bg-white p-4 transition ${
                                    isBoxTarget
                                      ? "border-sea ring-2 ring-sea/30"
                                      : isBoxDragging
                                        ? "opacity-50"
                                        : "border-ink/15 hover:border-ink/30"
                                  }`}
                                >
                                  {/* Box Bar */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                                    <div className="flex items-center gap-2">
                                      <span className="cursor-grab text-ink/35 active:cursor-grabbing hover:text-ink" title="Drag to reorder box">
                                        <GripVertical size={16} />
                                      </span>
                                      <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink">
                                        Box #{bIdx + 1}
                                      </span>
                                      <span className="font-medium text-sm text-ink">{box.title || "Untitled box"}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => moveMarketplaceBox(bIdx, bIdx - 1)}
                                        disabled={bIdx === 0}
                                        aria-label={`Move box ${bIdx + 1} up`}
                                        title="Move up"
                                        className="grid h-7 w-7 place-items-center rounded border border-ink/15 text-ink/60 hover:border-ink hover:text-ink disabled:opacity-30"
                                      >
                                        <ArrowUp size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveMarketplaceBox(bIdx, bIdx + 1)}
                                        disabled={bIdx === marketplaceBoxes.length - 1}
                                        aria-label={`Move box ${bIdx + 1} down`}
                                        title="Move down"
                                        className="grid h-7 w-7 place-items-center rounded border border-ink/15 text-ink/60 hover:border-ink hover:text-ink disabled:opacity-30"
                                      >
                                        <ArrowDown size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteMarketplaceBox(bIdx)}
                                        aria-label={`Delete box ${bIdx + 1}`}
                                        title="Delete box"
                                        className="grid h-7 w-7 place-items-center rounded border border-ink/15 text-ink/40 hover:border-terracotta hover:text-terracotta"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Box Fields */}
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <label className="block">
                                      <span className={labelClass}>Title</span>
                                      <input
                                        value={box.title || ""}
                                        onChange={(e) => updateBox(bIdx, "title", e.target.value)}
                                        placeholder="eBay store, Catawiki, etc."
                                        className={`${inputClass} mt-1`}
                                      />
                                    </label>

                                    <label className="block">
                                      <span className={labelClass}>Small label (eyebrow)</span>
                                      <input
                                        value={box.eyebrow || ""}
                                        onChange={(e) => updateBox(bIdx, "eyebrow", e.target.value)}
                                        placeholder="Marketplace, Auctions, etc."
                                        className={`${inputClass} mt-1`}
                                      />
                                    </label>

                                    <label className="block sm:col-span-2 lg:col-span-1">
                                      <span className={labelClass}>Link destination (URL)</span>
                                      <input
                                        value={box.url || ""}
                                        onChange={(e) => updateBox(bIdx, "url", e.target.value)}
                                        placeholder="https://..."
                                        className={`${inputClass} mt-1`}
                                      />
                                    </label>

                                    <label className="block sm:col-span-2">
                                      <span className={labelClass}>Description / subtitle</span>
                                      <input
                                        value={box.text || ""}
                                        onChange={(e) => updateBox(bIdx, "text", e.target.value)}
                                        placeholder="Fixed prices and best offers"
                                        className={`${inputClass} mt-1`}
                                      />
                                    </label>

                                    {/* Logo selector */}
                                    <div className="block sm:col-span-2 lg:col-span-1">
                                      <span className={labelClass}>Logo / icon image</span>
                                      <div className="mt-1 flex items-center gap-2">
                                        <input
                                          value={box.logo || ""}
                                          onChange={(e) => updateBox(bIdx, "logo", e.target.value)}
                                          placeholder="/images/... or upload"
                                          className={`${inputClass}`}
                                        />
                                        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded bg-ink px-2.5 py-2 text-[10px] uppercase tracking-wider text-parchment hover:bg-sea">
                                          <Upload size={12} />
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => void handleBoxLogoUpload(bIdx, e)}
                                            className="hidden"
                                          />
                                        </label>
                                        {box.logo && (
                                          <button
                                            type="button"
                                            onClick={() => updateBox(bIdx, "logo", "")}
                                            className="text-xs text-ink/40 hover:text-terracotta"
                                            title="Clear logo"
                                          >
                                            <X size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Background Color & Style Presets */}
                                  <div className="mt-4 border-t border-ink/10 pt-3">
                                    <span className={labelClass}>Background color &amp; brand style</span>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateBox(bIdx, "bgColor", "ebay-quad")}
                                        className={`rounded-sm px-3 py-1.5 text-xs text-white transition ${
                                          box.bgColor === "ebay-quad" ? "ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"
                                        } ebay-quad`}
                                      >
                                        eBay Quad (102°)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateBox(bIdx, "bgColor", "cw-grad");
                                          if (!box.logo) updateBox(bIdx, "logo", "/images/catawiki-logo-white.svg");
                                        }}
                                        className={`rounded-sm px-3 py-1.5 text-xs text-white transition ${
                                          box.bgColor === "cw-grad" ? "ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"
                                        } cw-grad`}
                                      >
                                        Catawiki (#0033FF)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateBox(bIdx, "bgColor", "wa-grad")}
                                        className={`rounded-sm px-3 py-1.5 text-xs text-white transition ${
                                          box.bgColor === "wa-grad" ? "ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"
                                        } wa-grad`}
                                      >
                                        WhatsApp (#25D366)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateBox(bIdx, "bgColor", "ig-grad")}
                                        className={`rounded-sm px-3 py-1.5 text-xs text-white transition ${
                                          box.bgColor === "ig-grad" ? "ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"
                                        } ig-grad`}
                                      >
                                        Instagram
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateBox(bIdx, "bgColor", "fb-grad")}
                                        className={`rounded-sm px-3 py-1.5 text-xs text-white transition ${
                                          box.bgColor === "fb-grad" ? "ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"
                                        } fb-grad`}
                                      >
                                        Facebook (#1877F2)
                                      </button>

                                      {/* Custom color picker */}
                                      <div className="flex items-center gap-1.5 rounded-sm border border-ink/20 bg-parchment/50 px-2 py-1">
                                        <input
                                          type="color"
                                          value={isPreset ? "#0b2030" : box.bgColor || "#0b2030"}
                                          onChange={(e) => updateBox(bIdx, "bgColor", e.target.value)}
                                          className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                                          title="Pick custom hex color"
                                        />
                                        <input
                                          value={isPreset ? "" : box.bgColor || ""}
                                          onChange={(e) => updateBox(bIdx, "bgColor", e.target.value)}
                                          placeholder="Custom hex (#...)"
                                          className="w-24 text-xs bg-transparent outline-none font-mono"
                                        />
                                      </div>
                                    </div>

                                    {/* Mini Live Preview */}
                                    <div className="mt-3 flex items-center gap-2">
                                      <span className="text-[10px] uppercase tracking-wider text-ink/40">Preview:</span>
                                      <div
                                        className={`inline-flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-xs shadow-sm ${
                                          isPreset ? box.bgColor : ""
                                        }`}
                                        style={!isPreset && box.bgColor ? { backgroundColor: box.bgColor, color: "#fff" } : undefined}
                                      >
                                        {box.logo && (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img src={box.logo} alt="" className="h-3.5 w-auto object-contain" />
                                        )}
                                        <span className="font-semibold text-white">{box.title || "Marketplace"}</span>
                                        {box.eyebrow && <span className="text-[10px] text-white/75">· {box.eyebrow}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
                        <span className="text-[11px] text-ink/55">
                          Save changes to <strong>{meta.number} · {meta.label}</strong> (saves all pages to Neon).
                        </span>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex h-10 items-center gap-2 rounded-full bg-terracotta px-5 text-xs uppercase tracking-[0.18em] text-parchment transition hover:bg-ink disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          {saving ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* MODE 2: OTHER PAGES & SETTINGS */}
      {mainTab === "other" && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Other pages" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {otherGroups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setOtherGroupId(g.id)}
                    className={`w-full rounded-sm px-3 py-2 text-left text-[12px] transition ${
                      g.id === activeOtherGroup.id ? "bg-ink text-parchment" : "bg-bone/60 text-ink/75 hover:bg-bone"
                    }`}
                  >
                    {g.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="rounded-sm border border-ink/10 bg-white/75 p-5">
            <div className="mb-4 border-b border-ink/10 pb-3">
              <h3 className="font-display text-2xl text-ink">{activeOtherGroup.label}</h3>
              {activeOtherGroup.note && <p className="mt-1 text-xs text-ink/55">{activeOtherGroup.note}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">{activeOtherGroup.fields.map((f) => renderField(f))}</div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
              <span className="text-[11px] text-ink/55">
                Save changes to <strong>{activeOtherGroup.label}</strong> (saves all pages to Neon).
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-terracotta px-5 text-xs uppercase tracking-[0.18em] text-parchment transition hover:bg-ink disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
