"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Edit3,
  ExternalLink,
  LogOut,
  Package,
  Plus,
  Save,
  Settings,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { ProductImage } from "@/db/schema";
import type { ProductWithStats, SiteSettings } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/collections";
import { formatDate, formatPrice } from "@/lib/format";

type OrderEntry = {
  order: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    country: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    shippingMethod: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    status: string;
    createdAt: Date;
  };
  items: {
    id: number;
    productName: string;
    productSlug: string;
    unitPriceCents: number;
    quantity: number;
  }[];
};

type EditableProduct = {
  id: number | null;
  slug: string;
  name: string;
  species: string;
  category: string;
  collection: string;
  collections: string[];
  period: string;
  locality: string;
  formation: string;
  lengthMm: string;
  preparation: string;
  priceDollars: string;
  compareAtDollars: string;
  stock: string;
  featured: boolean;
  published: boolean;
  hasCertificate: boolean;
  listingChannel: string;
  externalListingUrl: string;
  videoUrl: string;
  shortDescription: string;
  description: string;
  provenance: string;
  images: ProductImage[];
};

const EMPTY_PRODUCT: EditableProduct = {
  id: null,
  slug: "",
  name: "",
  species: "",
  category: "specimen",
  collection: "devonian-crown",
  collections: ["devonian-crown"],
  period: "Devonian",
  locality: "Alnif / Erfoud, Morocco",
  formation: "",
  lengthMm: "60",
  preparation: "Hand-prepared, 100% natural matrix",
  priceDollars: "850",
  compareAtDollars: "",
  stock: "1",
  featured: true,
  published: true,
  hasCertificate: false,
  listingChannel: "direct",
  externalListingUrl: "",
  videoUrl: "",
  shortDescription: "",
  description: "",
  provenance:
    "Directly sourced from licensed Moroccan quarry family. Accompanied by signed certificate of authenticity and geological data card.",
  images: [],
};

function toEditable(p: ProductWithStats): EditableProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    species: p.species,
    category: p.category,
    collection: p.collection,
    collections: (p.collections && p.collections.length > 0
      ? p.collections.filter((c) => COLLECTIONS.some((x) => x.slug === c))
      : [p.collection]) as string[],
    period: p.period ?? "",
    locality: p.locality,
    formation: p.formation ?? "",
    lengthMm: p.lengthMm ? String(p.lengthMm) : "",
    preparation: p.preparation,
    priceDollars: (p.priceCents / 100).toFixed(0),
    compareAtDollars: p.compareAtCents ? (p.compareAtCents / 100).toFixed(0) : "",
    stock: String(p.stock),
    featured: p.featured,
    published: p.published ?? true,
    hasCertificate: p.hasCertificate ?? false,
    listingChannel: p.listingChannel ?? "direct",
    externalListingUrl: p.externalListingUrl ?? "",
    videoUrl: p.videoUrl ?? "",
    shortDescription: p.shortDescription,
    description: p.description,
    provenance: p.provenance,
    images: p.images ?? [],
  };
}

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("mediterranic23");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Incorrect password.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Connection error.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-24">
      <div className="rounded-sm border border-ink/15 bg-white/80 p-8 shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Mediterranic · Backoffice</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Curator Login</h1>
        <p className="mt-2 text-sm text-ink/65">
          Manage your 20–40 specimens, upload real photographs, switch pieces between Catawiki, eBay and Site Only, and
          edit fixed storefront texts.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.2em] text-ink/60">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:border-sea"
              required
            />
          </label>
          <p className="text-xs text-ink/50">
            Default password: <code className="rounded bg-bone px-1.5 py-0.5 text-ink">mediterranic23</code> (pre-filled
            for 1-click sign-in).
          </p>
          {error && <p className="text-sm text-terracotta">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-ink text-xs uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Enter Curator Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminDashboard({
  initialProducts,
  initialSettings,
  orders,
  onSignOut,
}: {
  initialProducts: ProductWithStats[];
  initialSettings: SiteSettings;
  orders: OrderEntry[];
  onSignOut: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "settings" | "orders">("products");
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [sellerUrl, setSellerUrl] = useState("https://www.catawiki.com/en/u/3881635-mediterranic");
  const [ebaySellerUrl, setEbaySellerUrl] = useState("https://www.ebay.com/str/mederranic");
  const [sellerLots, setSellerLots] = useState<{ id: string; url: string; title: string }[] | null>(null);
  const [sellerBusy, setSellerBusy] = useState(false);
  const [sellerProgress, setSellerProgress] = useState<string | null>(null);
  const [parsingText, setParsingText] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customImageLabel, setCustomImageLabel] = useState("Dorsal view");
  const [provenanceUploading, setProvenanceUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [priceReport, setPriceReport] = useState<
    { name: string; channel: string; previousCents: number; currentCents: number | null; error?: string }[] | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState({
    heroEyebrow: initialSettings.heroEyebrow,
    heroTitle: initialSettings.heroTitle,
    heroTitleItalic: initialSettings.heroTitleItalic,
    heroDescription: initialSettings.heroDescription,
    provenanceEyebrow: initialSettings.provenanceEyebrow,
    provenanceTitle: initialSettings.provenanceTitle,
    provenanceTitleItalic: initialSettings.provenanceTitleItalic,
    provenanceBody: initialSettings.provenanceBody,
    yearsExperience: String(initialSettings.yearsExperience),
    feedbacksLabel: initialSettings.feedbacksLabel,
    ebayUrl: initialSettings.ebayUrl,
    catawikiUrl: initialSettings.catawikiUrl,
    instagramUrl: initialSettings.instagramUrl,
    facebookUrl: initialSettings.facebookUrl,
    contactEmail: initialSettings.contactEmail,
    trustamiUrl: initialSettings.trustamiUrl,
    trustamiRating: initialSettings.trustamiRating,
    trustamiRatings: initialSettings.trustamiRatings,
    whatsappPhone: initialSettings.whatsappPhone,
    provenanceImage: initialSettings.provenanceImage,
    heroImage: initialSettings.heroImage,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  function notify(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 4000);
  }



  async function handleQuickChannel(
    product: ProductWithStats,
    target: "direct" | "catawiki" | "ebay" | "sold",
  ) {
    if (target === "sold") {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-stock", id: product.id, stock: 0 }),
      });
      if (res.ok) {
        notify(`"${product.name}" marked as SOLD.`);
        router.refresh();
      }
      return;
    }

    const ensuredStock = product.stock > 0 ? product.stock : 1;
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set-channel",
        id: product.id,
        listingChannel: target,
        stock: ensuredStock,
      }),
    });
    if (res.ok) {
      const label =
        target === "direct"
          ? "Site Only (Direct Sale)"
          : target === "catawiki"
            ? "Live on Catawiki"
            : "Live on eBay";
      notify(`"${product.name}" switched to ${label}.`);
      router.refresh();
    }
  }

  async function handleRestoreBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !window.confirm(
        `Restore "${file.name}"?\n\nPieces in the file are updated or added by slug. Nothing is deleted.`,
      )
    ) {
      e.target.value = "";
      return;
    }
    setRestoring(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = (await res.json()) as {
        updated?: number;
        inserted?: number;
        totalProducts?: number;
        error?: string;
      };
      if (!res.ok) {
        notify(data.error ?? "Restore failed.");
        return;
      }
      notify(
        `Restored: ${data.updated ?? 0} updated, ${data.inserted ?? 0} added. The shop now has ${data.totalProducts ?? 0} pieces.`,
      );
      router.refresh();
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  }

  async function handleRefreshPrices() {
    setRefreshing(true);
    setPriceReport(null);
    try {
      const res = await fetch("/api/admin/refresh-prices", { method: "POST" });
      const data = (await res.json()) as {
        results?: {
          name: string;
          channel: string;
          previousCents: number;
          currentCents: number | null;
          error?: string;
        }[];
        changed?: number;
        error?: string;
      };
      if (!res.ok) {
        notify(data.error ?? "Could not refresh prices.");
        return;
      }
      setPriceReport(data.results ?? []);
      notify(
        `Prices checked. ${data.changed ?? 0} changed. ${
          (data.results ?? []).filter((r) => r.error).length
        } listing(s) could not be read.`,
      );
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickVideo(product: ProductWithStats) {
    const current = product.videoUrl ?? "";
    const answer = window.prompt(
      `Specimen film for "${product.name}"\n\nPaste a YouTube, Vimeo or .mp4 address. Leave empty to remove.`,
      current,
    );
    if (answer === null) return;
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-video", id: product.id, videoUrl: answer.trim() }),
    });
    if (res.ok) {
      notify(answer.trim() ? "Specimen film saved." : "Specimen film removed.");
      router.refresh();
    } else {
      notify("Could not save the film link.");
    }
  }

  async function handleTogglePublished(product: ProductWithStats, next: boolean) {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-published", id: product.id, published: next }),
    });
    if (res.ok) {
      notify(next ? `"${product.name}" is now live on the storefront.` : `"${product.name}" moved to drafts (hidden from the shop).`);
      router.refresh();
    } else {
      notify("Could not change visibility.");
    }
  }

  async function handleDeleteProduct(product: ProductWithStats) {
    if (!window.confirm(`Delete "${product.name}" from the catalogue?`)) return;
    const res = await fetch(`/api/admin/products?id=${product.id}`, { method: "DELETE" });
    if (res.ok) {
      notify(`"${product.name}" deleted.`);
      router.refresh();
    }
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !editing) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { files?: { url: string; filename: string }[]; error?: string };
      if (res.ok && data.files) {
        const added: ProductImage[] = data.files.map((f, i) => ({
          src: f.url,
          alt: `${editing.name || "Trilobite"} - ${f.filename}`,
          label: editing.images.length === 0 && i === 0 ? "Whole slab — top view" : `Angle ${editing.images.length + i + 1}`,
        }));
        setEditing({ ...editing, images: [...editing.images, ...added] });
        notify(`${added.length} photograph(s) uploaded to database.`);
      } else {
        notify(data.error ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleImportFromUrl() {
    if (!importUrl.trim()) return;
    setImportingUrl(true);
    try {
      const res = await fetch("/api/admin/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = (await res.json()) as {
        imported?: Partial<EditableProduct> & { images?: ProductImage[] };
        error?: string;
      };
      if (!res.ok || !data.imported) {
        notify(data.error ?? "Could not import automatically from this link.");
        return;
      }
      const imp = data.imported;
      const draft: EditableProduct = {
        ...EMPTY_PRODUCT,
        name: imp.name || EMPTY_PRODUCT.name,
        species: imp.species || EMPTY_PRODUCT.species,
        listingChannel: imp.listingChannel || "direct",
        externalListingUrl: imp.externalListingUrl || importUrl.trim(),
        period: imp.period || "Devonian",
        collection: (imp as { collection?: string }).collection || EMPTY_PRODUCT.collection,
        collections:
          ((imp as { collections?: string[] }).collections?.filter((c) =>
            COLLECTIONS.some((x) => x.slug === c),
          ) ?? []) as string[],
        lengthMm: imp.lengthMm || "",
        locality: imp.locality || EMPTY_PRODUCT.locality,
        formation: imp.formation || "",
        preparation: imp.preparation || EMPTY_PRODUCT.preparation,
        priceDollars: imp.priceDollars || EMPTY_PRODUCT.priceDollars,
        compareAtDollars: (imp as { compareAtDollars?: string }).compareAtDollars || "",
        shortDescription: imp.shortDescription || "",
        description: imp.description || "",
        provenance: imp.provenance || EMPTY_PRODUCT.provenance,
        images: imp.images && imp.images.length > 0 ? imp.images : [],
      };

      // Publish immediately: the specimen must appear on the storefront without a second step.
      const saveRes = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const saved = (await saveRes.json()) as { product?: { slug: string }; error?: string };

      if (!saveRes.ok || !saved.product) {
        // Keep everything in the form so nothing is lost.
        setEditing(draft);
        notify(saved.error ?? "Read the listing but could not publish it. Review the form and press Save.");
        return;
      }

      const storedPhotos = (imp as { photosStored?: number }).photosStored ?? draft.images.length;
      setImportUrl("");
      setEditing(null);
      setPublishedSlug(saved.product.slug);
      notify(
        `Published to your storefront with ${storedPhotos} photo(s). It is live now — open it from the list below.`,
      );
    } finally {
      setImportingUrl(false);
    }
  }

  async function handleParsePastedText() {
    if (pasteText.trim().length < 15) {
      notify("Paste the Catawiki or eBay lot title and description first.");
      return;
    }
    setParsingText(true);
    try {
      const res = await fetch("/api/admin/parse-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, url: importUrl.trim(), price: "" }),
      });
      const data = (await res.json()) as {
        parsed?: Partial<EditableProduct> & { images?: ProductImage[] };
        found?: string[];
        missing?: string[];
        error?: string;
      };
      if (!res.ok || !data.parsed) {
        notify(data.error ?? "Could not read that text.");
        return;
      }
      const parsed = data.parsed;
      setEditing({
        ...EMPTY_PRODUCT,
        name: parsed.name || EMPTY_PRODUCT.name,
        species: parsed.species || EMPTY_PRODUCT.species,
        listingChannel: parsed.listingChannel || "direct",
        externalListingUrl: parsed.externalListingUrl || importUrl.trim(),
        period: parsed.period || "Devonian",
        collection: (parsed as { collection?: string }).collection || EMPTY_PRODUCT.collection,
        collections:
          ((parsed as { collections?: string[] }).collections?.filter((c) =>
            COLLECTIONS.some((x) => x.slug === c),
          ) ?? []) as string[],
        lengthMm: parsed.lengthMm || "",
        locality: parsed.locality || "Morocco",
        formation: parsed.formation || "",
        preparation: parsed.preparation || "Hand-prepared",
        priceDollars: parsed.priceDollars || EMPTY_PRODUCT.priceDollars,
        compareAtDollars: (parsed as { compareAtDollars?: string }).compareAtDollars || "",
        shortDescription: parsed.shortDescription || "",
        description: parsed.description || "",
        provenance: parsed.provenance || "",
        images: parsed.images && parsed.images.length > 0 ? parsed.images : [],
      });
      const missing = (data.missing ?? []).filter(Boolean);
      notify(
        missing.length > 0
          ? `Filled automatically. Please confirm: ${missing.join(", ")}. Review below, then Save.`
          : "Everything was read and filled in. Review below, then click Save.",
      );
    } finally {
      setParsingText(false);
    }
  }

  const alreadyImported = (lotUrl: string) =>
    initialProducts.some((p) => (p.externalListingUrl ?? "").includes(lotUrl.split("/").pop() ?? "___"));

  async function findEbayLots() {
    setSellerBusy(true);
    setSellerProgress(null);
    try {
      const res = await fetch("/api/admin/import-ebay-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ebaySellerUrl }),
      });
      const data = (await res.json()) as {
        lots?: { id: string; url: string; title: string; price: string }[];
        excluded?: number;
        error?: string;
      };
      if (!res.ok) {
        setSellerLots(null);
        notify(data.error ?? "Could not read the eBay store.");
        return;
      }
      setSellerLots(data.lots ?? []);
      notify(
        `Found ${data.lots?.length ?? 0} trilobite listing(s) on your eBay store${
          data.excluded ? ` — ${data.excluded} shell(s) and mineral(s) excluded` : ""
        }.`,
      );
    } finally {
      setSellerBusy(false);
    }
  }

  async function findSellerLots() {
    setSellerBusy(true);
    setSellerProgress(null);
    try {
      const res = await fetch("/api/admin/import-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sellerUrl }),
      });
      const data = (await res.json()) as {
        lots?: { id: string; url: string; title: string }[];
        excluded?: number;
        error?: string;
      };
      if (!res.ok || !data.lots) {
        setSellerLots(null);
        notify(data.error ?? "Could not read the seller page.");
        return;
      }
      setSellerLots(data.lots);
      notify(
        `Found ${data.lots.length} trilobite lot(s) on your Catawiki seller page${
          data.excluded ? ` — ${data.excluded} non-trilobite lot(s) excluded (minerals, shells, etc.)` : ""
        }.`,
      );
    } finally {
      setSellerBusy(false);
    }
  }

  async function importSellerLots(lots: { id: string; url: string; title: string }[]) {
    setSellerBusy(true);
    let ok = 0;
    let skipped = 0;
    try {
      for (const [index, lot] of lots.entries()) {
        if (alreadyImported(lot.url)) {
          skipped += 1;
          continue;
        }
        setSellerProgress(`Importing ${index + 1} of ${lots.length}: ${lot.title.slice(0, 48)}…`);
        const readRes = await fetch("/api/admin/import-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: lot.url, title: lot.title }),
        });
        const read = (await readRes.json()) as {
          imported?: Record<string, unknown> & { images?: ProductImage[] };
          error?: string;
        };
        if (!readRes.ok || !read.imported) continue;

        const saveRes = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...read.imported, stock: "1", published: false }),
        });
        if (saveRes.ok) ok += 1;
      }
      setSellerProgress(null);
      notify(
        `Finished: ${ok} draft(s) created with photos, ${skipped} already on the site and skipped. Open a draft, set its price, then press Publish.`,
      );
      router.refresh();
    } finally {
      setSellerBusy(false);
    }
  }

  function copyForMarketplace() {
    if (!editing) return;
    const copy = [
      `Title: ${editing.name} — ${editing.species}${editing.lengthMm ? ` — ${editing.lengthMm} mm` : ""}`,
      "",
      `Scientific name: ${editing.species}`,
      editing.period ? `Geological period: ${editing.period}` : "",
      editing.locality ? `Locality: ${editing.locality}` : "",
      editing.formation ? `Formation: ${editing.formation}` : "",
      editing.lengthMm ? `Dimensions: ${editing.lengthMm} mm` : "",
      editing.preparation ? `Preparation: ${editing.preparation}` : "",
      "",
      "Description:",
      editing.description,
      "",
      "Provenance & shipping:",
      editing.provenance,
      "",
      "Ships with a signed certificate of authenticity and geological data card.",
    ]
      .filter((line) => line !== "")
      .join("\n");
    void navigator.clipboard.writeText(copy);
    notify("Listing text copied — paste it straight into Catawiki or eBay.");
  }

  function moveImage(from: number, to: number) {
    if (!editing || from === to || to < 0 || to >= editing.images.length) return;
    const next = [...editing.images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEditing({ ...editing, images: next });
  }

  function handleAddImageUrl() {
    if (!editing || !customImageUrl.trim()) return;
    const nextImg: ProductImage = {
      src: customImageUrl.trim(),
      alt: `${editing.name || "Specimen"} - ${customImageLabel}`,
      label: customImageLabel.trim() || "Specimen view",
    };
    setEditing({ ...editing, images: [...editing.images, nextImg] });
    setCustomImageUrl("");
  }

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingProduct(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify(data.error ?? "Failed to save specimen.");
        setSavingProduct(false);
        return;
      }
      notify(editing.id ? "Specimen updated in database!" : "New specimen created in database!");
      setEditing(null);
      router.refresh();
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleSettingPhotoUpload(
    e: ChangeEvent<HTMLInputElement>,
    field: "heroImage" | "provenanceImage",
  ) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setProvenanceUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { files?: { url: string }[]; error?: string };
      if (res.ok && data.files?.[0]) {
        setSettingsForm({ ...settingsForm, [field]: data.files[0].url });
        notify("Photograph uploaded. Now press Save Texts to Database to publish it.");
      } else {
        notify(data.error ?? "Upload failed.");
      }
    } finally {
      setProvenanceUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) {
        notify("Storefront copy & marketplace links saved to database!");
        router.refresh();
      } else {
        notify("Error saving settings.");
      }
    } finally {
      setSavingSettings(false);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-ink/20 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-sea focus:ring-2 focus:ring-sea/15";
  const labelClass = "block text-[11px] uppercase tracking-[0.2em] text-ink/65 mb-1.5";

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Mediterranic · Curator Studio</p>
          <h1 className="mt-2 font-display text-5xl text-ink">Curator Admin</h1>
          <p className="mt-2 text-sm text-ink/65">
            Switch specimens between <strong>Site Only</strong>, <strong>Live on Catawiki</strong>,{" "}
            <strong>Live on eBay</strong>, or <strong>mark it unavailable</strong> in one click, upload real photographs, and edit
            storefront texts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/mediterranic.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brass px-5 text-xs font-semibold uppercase tracking-[0.18em] text-ink hover:bg-ink hover:text-parchment"
          >
            Open Pure HTML Version (mediterranic.html) <ExternalLink size={13} />
          </a>
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/20 px-5 text-xs uppercase tracking-[0.18em] text-ink hover:border-ink"
          >
            View Public Storefront <ExternalLink size={13} />
          </Link>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-xs uppercase tracking-[0.18em] text-ink/70 hover:text-terracotta"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mt-6 flex items-center justify-between rounded-sm bg-sea px-5 py-3.5 text-sm text-parchment shadow">
          <span className="flex items-center gap-2">
            <Check size={16} /> {feedback}
          </span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {publishedSlug && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-brass/50 bg-brass/15 px-5 py-3.5 text-sm">
          <span className="flex items-center gap-2 font-medium text-ink">
            <Check size={16} className="text-sea" /> New specimen published and live on your storefront.
          </span>
          <span className="flex items-center gap-2">
            <a
              href={`/shop/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-parchment hover:bg-sea"
            >
              View on storefront <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={() => setPublishedSlug(null)}
              className="rounded-full p-1.5 text-ink/50 hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-ink/10 pb-4">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.2em] transition ${
            tab === "products" ? "bg-ink text-parchment" : "bg-bone/70 text-ink/75 hover:bg-bone"
          }`}
        >
          <Package size={15} /> 1. Specimens &amp; Marketplace Labels ({initialProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.2em] transition ${
            tab === "settings" ? "bg-ink text-parchment" : "bg-bone/70 text-ink/75 hover:bg-bone"
          }`}
        >
          <Settings size={15} /> 2. Fixed Storefront Texts &amp; Links (eBay / Catawiki)
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.2em] transition ${
            tab === "orders" ? "bg-ink text-parchment" : "bg-bone/70 text-ink/75 hover:bg-bone"
          }`}
        >
          <ShoppingBag size={15} /> 3. Orders ({orders.length})
        </button>
      </div>

      {/* TAB 1: PRODUCTS */}
      {tab === "products" && (
        <div className="mt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-ink">Specimens Catalogue</h2>
              <p className="text-sm text-ink/60">
                While a piece is on auction, click <strong>On Catawiki</strong> or <strong>On eBay</strong>. If it does
                not sell there, click <strong>Site Only</strong> and it returns immediately to direct sale on the site.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing({ ...EMPTY_PRODUCT })}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-terracotta px-6 text-xs uppercase tracking-[0.2em] text-parchment transition hover:bg-ink"
            >
              <Plus size={16} /> Add New Specimen
            </button>
          </div>

          {/* Backup & restore — protects back-office work across deployments */}
          <div className="mb-4 rounded-sm border-2 border-ink/25 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
              Backup &amp; restore
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Download a full copy of the shop — every piece, photograph setting, price and all the
              storefront text — before any development work. If anything is ever lost, the same file puts
              it all back.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href="/api/admin/backup"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.16em] text-parchment transition hover:bg-sea"
              >
                ⬇ Download backup
              </a>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink/25 px-5 text-[11px] uppercase tracking-[0.16em] text-ink transition hover:border-ink">
                {restoring ? "Restoring…" : "⬆ Restore from file"}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreBackup}
                  disabled={restoring}
                  className="sr-only"
                />
              </label>
              <span className="text-[11px] text-ink/55">
                Restoring never deletes: pieces are matched by name and updated.
              </span>
            </div>
          </div>

          {/* Automatic marketplace price refresh */}
          <div className="mb-4 rounded-sm border-2 border-brass/40 bg-brass/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
              Refresh marketplace prices
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Reads the current bid from Catawiki and the current price from your eBay store, and updates the shop.
              Runs automatically every 30 minutes once the site is published — or press the button now.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefreshPrices}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.16em] text-parchment transition hover:bg-sea disabled:opacity-50"
              >
                {refreshing ? "Checking listings…" : "Check prices now"}
              </button>
              <span className="text-[11px] text-ink/55">
                Only pieces still in stock are checked.
              </span>
            </div>

            {priceReport && (
              <div className="mt-4 max-h-64 overflow-y-auto rounded-sm border border-ink/15 bg-white/85 p-3">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-[9px] uppercase tracking-[0.18em] text-ink/50">
                    <tr>
                      <th className="pb-2">Specimen</th>
                      <th className="pb-2">Channel</th>
                      <th className="pb-2">Was</th>
                      <th className="pb-2">Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {priceReport.map((r) => (
                      <tr key={r.name + r.channel}>
                        <td className="py-1.5 pr-2 text-ink">{r.name}</td>
                        <td className="py-1.5 pr-2 text-ink/60">{r.channel}</td>
                        <td className="py-1.5 pr-2 text-ink/60">€{(r.previousCents / 100).toFixed(0)}</td>
                        <td className="py-1.5">
                          {r.currentCents === null ? (
                            <span className="text-terracotta">{r.error ?? "not read"}</span>
                          ) : (
                            <span className={r.currentCents !== r.previousCents ? "font-semibold text-sea" : "text-ink/60"}>
                              €{(r.currentCents / 100).toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* eBay store sync */}
          <div className="mb-4 rounded-sm border-2 border-sea/30 bg-sea/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
              Sync all trilobite listings from your eBay store
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Paste your eBay store link. Only trilobites are listed — seashells and minerals are filtered out
              automatically. Each listing is saved as a draft with its photograph.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={ebaySellerUrl}
                onChange={(e) => setEbaySellerUrl(e.target.value)}
                placeholder="https://www.ebay.com/str/mederranic"
                className="w-full rounded-sm border border-ink/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-sea"
              />
              <button
                type="button"
                onClick={findEbayLots}
                disabled={sellerBusy}
                className="inline-flex h-9 items-center justify-center rounded-full bg-sea px-5 text-[11px] uppercase tracking-[0.16em] text-parchment hover:bg-ink disabled:opacity-50"
              >
                {sellerBusy ? "Working…" : "Find my eBay listings"}
              </button>
            </div>
          </div>

          {/* Catawiki seller sync */}
          <div className="mb-4 rounded-sm border-2 border-brass/40 bg-brass/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
              Sync all lots from your Catawiki seller page
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Paste your seller page link once. All live auctions are listed, and each one is imported with its photos,
              title, species and period — saved as a <strong>draft</strong>, never live, so nothing wrong reaches the shop.
              Catawiki does not expose price or exact locality reliably to automated reading: confirm those two fields,
              then press <strong>Publish</strong>.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <input
                value={sellerUrl}
                onChange={(e) => setSellerUrl(e.target.value)}
                placeholder="https://www.catawiki.com/en/u/3881635-mediterranic"
                className="w-full rounded-sm border border-ink/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-sea"
              />
              <button
                type="button"
                onClick={findSellerLots}
                disabled={sellerBusy}
                className="inline-flex h-9 items-center justify-center rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.16em] text-parchment hover:bg-sea disabled:opacity-50"
              >
                {sellerBusy ? "Working…" : "Find my lots"}
              </button>
              <button
                type="button"
                disabled={!sellerLots || sellerBusy || sellerLots.length === 0}
                onClick={() => sellerLots && importSellerLots(sellerLots)}
                className="inline-flex h-9 items-center justify-center rounded-full bg-terracotta px-5 text-[11px] uppercase tracking-[0.16em] text-parchment hover:bg-ink disabled:opacity-40"
              >
                Import all new
              </button>
            </div>
            {sellerProgress && <p className="mt-2 text-xs text-sea">{sellerProgress}</p>}
            {sellerLots && (
              <div className="mt-3 rounded-sm border border-ink/15 bg-white/80 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink/60">
                  {sellerLots.length} live lot(s) found
                </p>
                <ul className="mt-2 divide-y divide-ink/10">
                  {sellerLots.map((lot) => {
                    const done = alreadyImported(lot.url);
                    return (
                      <li key={lot.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-ink/85" title={lot.title}>
                          {lot.title}
                        </span>
                        {done ? (
                          <span className="rounded-full bg-sea/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-sea">
                            Already on site
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={sellerBusy}
                            onClick={() => importSellerLots([lot])}
                            className="rounded-full border border-ink/20 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-ink hover:border-ink disabled:opacity-40"
                          >
                            Import this
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Import from eBay / Catawiki */}
          <div className="mb-8 rounded-sm border border-ink/15 bg-bone/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
              Import a specimen — enter once, publish everywhere
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Catawiki blocks automatic reading, so paste the lot text below (title, description, details). Species, period,
              age, locality, size, price and photos are read automatically, and the English sales copy is written for you.
            </p>

            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="Listing link (optional, e.g. https://www.catawiki.com/en/l/... or https://www.ebay.com/itm/...)"
                className="w-full rounded-sm border border-ink/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-sea"
              />
              <button
                type="button"
                onClick={handleImportFromUrl}
                disabled={importingUrl || !importUrl.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.16em] text-parchment transition hover:bg-sea disabled:opacity-50"
              >
                {importingUrl ? "Reading…" : "Try reading link"}
              </button>
            </div>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder="Paste here the Catawiki/eBay lot text, e.g. 'Trilobite - Gerastos - Devonian - 6.9 cm - Locality: Alnif, Morocco - No restoration - €450'"
              className="mt-2 w-full rounded-sm border border-ink/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-sea"
            />

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleParsePastedText}
                disabled={parsingText}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-terracotta px-5 text-[11px] uppercase tracking-[0.18em] text-parchment transition hover:bg-ink disabled:opacity-50"
              >
                {parsingText ? "Reading text…" : "Read pasted text & fill the form"}
              </button>
              <span className="text-[11px] text-ink/55">
                No double typing: one entry here becomes your website page, Catawiki listing and eBay listing.
              </span>
            </div>
          </div>

          {/* Product Editor Form */}
          {editing && (
            <form
              onSubmit={handleSaveProduct}
              className="mb-12 rounded-sm border-2 border-sea/30 bg-white p-6 shadow-xl md:p-8"
            >
              <div className="flex items-center justify-between border-b border-ink/10 pb-4">
                <h3 className="font-display text-3xl text-ink">
                  {editing.id ? `Edit Specimen: ${editing.name}` : "Add New Specimen"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Title / Display Name *</label>
                  <input
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. The Erfoud Sentinel"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Scientific Species *</label>
                  <input
                    required
                    value={editing.species}
                    onChange={(e) => setEditing({ ...editing, species: e.target.value })}
                    placeholder="e.g. Drotops armatus"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <span className={labelClass}>
                    Collections — tick every one this piece belongs to (era and/or Connoisseur)
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {COLLECTIONS.map((c) => {
                      const checked = editing.collections.includes(c.slug);
                      return (
                        <label
                          key={c.slug}
                          className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 text-xs transition ${
                            checked ? "border-ink bg-bone/70" : "border-ink/15 hover:border-ink/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...editing.collections, c.slug]
                                : editing.collections.filter((x) => x !== c.slug);
                              const safe = next.length > 0 ? next : [editing.collection];
                              setEditing({ ...editing, collections: safe, collection: safe[0] });
                            }}
                            className="h-4 w-4 accent-sea"
                          />
                          <span>
                            <span className="block text-ink">{c.title}</span>
                            <span className="text-[10px] uppercase tracking-[0.16em] text-ink/50">
                              {c.eyebrow}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Marketplace Channel & URL */}
                <div>
                  <label className={labelClass}>Listing Channel (Where is it right now?)</label>
                  <select
                    value={editing.listingChannel}
                    onChange={(e) => setEditing({ ...editing, listingChannel: e.target.value })}
                    className={inputClass}
                  >
                    <option value="direct">Site Only (Direct Sale on Mediterranic)</option>
                    <option value="catawiki">Live on Catawiki (Shows Catawiki Badge)</option>
                    <option value="ebay">Live on eBay (Shows eBay Badge)</option>
                  </select>
                </div>
                {/* Specimen film — kept high in the form so it is easy to find */}
                <div className="md:col-span-3 rounded-sm border border-sea/30 bg-sea/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
                    🎬 Specimen film (optional)
                  </p>
                  <p className="mt-1 text-xs text-ink/65">
                    Paste a link to the film of this piece. YouTube, Vimeo or a direct <code>.mp4</code> address all
                    work. Paste the address of a film you already have on YouTube or Vimeo — a link, not a file, keeps
                    the shop fast.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={editing.videoUrl}
                      onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=… · https://vimeo.com/… · https://…/specimen.mp4"
                      className={`${inputClass} min-w-[260px] flex-1`}
                    />
                    {editing.videoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, videoUrl: "" })}
                        className="rounded-full border border-ink/20 px-4 text-xs uppercase tracking-[0.16em] text-ink/70 hover:text-ink"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {editing.videoUrl && (
                    <p className="mt-2 text-[11px] text-sea">
                      {/\.mp4($|\?)/i.test(editing.videoUrl)
                        ? "Direct video file — the shop will play it in its own player."
                        : "Video link detected — it will be embedded on the product page."}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>
                    External Listing URL (Optional link to the eBay or Catawiki auction)
                  </label>
                  <input
                    value={editing.externalListingUrl}
                    onChange={(e) => setEditing({ ...editing, externalListingUrl: e.target.value })}
                    placeholder="https://www.catawiki.com/en/l/... or https://www.ebay.com/itm/..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Price (EUR €) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={editing.priceDollars}
                    onChange={(e) => setEditing({ ...editing, priceDollars: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Compare-At Price (EUR €, optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editing.compareAtDollars}
                    onChange={(e) => setEditing({ ...editing, compareAtDollars: e.target.value })}
                    placeholder="Leave blank if not discounted"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stock Quantity (0 = unavailable)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editing.stock}
                    onChange={(e) => setEditing({ ...editing, stock: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Geological Period</label>
                  <select
                    value={editing.period}
                    onChange={(e) => setEditing({ ...editing, period: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Not stated</option>
                    <option value="Cambrian">Cambrian</option>
                    <option value="Ordovician">Ordovician</option>
                    <option value="Devonian">Devonian</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Locality (Morocco) *</label>
                  <input
                    required
                    value={editing.locality}
                    onChange={(e) => setEditing({ ...editing, locality: e.target.value })}
                    placeholder="e.g. Jbel Issoumour / Alnif, Morocco"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Formation</label>
                  <input
                    value={editing.formation}
                    onChange={(e) => setEditing({ ...editing, formation: e.target.value })}
                    placeholder="e.g. Erfoud Formation (Emsian)"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Length (mm)</label>
                  <input
                    type="number"
                    value={editing.lengthMm}
                    onChange={(e) => setEditing({ ...editing, lengthMm: e.target.value })}
                    placeholder="e.g. 62"
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Preparation &amp; Restoration Notes *</label>
                  <input
                    required
                    value={editing.preparation}
                    onChange={(e) => setEditing({ ...editing, preparation: e.target.value })}
                    placeholder="e.g. Hand-prepared under microscope, 100% natural matrix"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-3 pb-2">
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={editing.featured}
                      onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                      className="h-4 w-4 accent-sea"
                    />
                    Feature on Home Page
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={editing.hasCertificate}
                      onChange={(e) => setEditing({ ...editing, hasCertificate: e.target.checked })}
                      className="h-4 w-4 accent-brass"
                    />
                    Ships with certificate of authenticity
                  </label>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className={labelClass}>Short Summary (Top of Product Page)</label>
                  <textarea
                    rows={2}
                    value={editing.shortDescription}
                    onChange={(e) => setEditing({ ...editing, shortDescription: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Full Specimen Description</label>
                    <textarea
                      rows={4}
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Provenance &amp; Certification</label>
                    <textarea
                      rows={4}
                      value={editing.provenance}
                      onChange={(e) => setEditing({ ...editing, provenance: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Image Manager — 6 slots with an editor for each photo */}
              <div className="mt-8 rounded-sm border border-ink/15 bg-bone/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink">
                      Specimen Photographs — {editing.images.length} of 6 slots used
                    </p>
                    <p className="mt-1 text-xs text-ink/60">
                      Upload up to six photographs. For each one you can turn it, mirror it and set the crop (zoom and
                      focal point). The first photograph is the cover.
                    </p>
                  </div>
                  <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-sea px-5 text-xs uppercase tracking-[0.18em] text-parchment transition hover:bg-ink">
                    <Upload size={14} />
                    {uploading ? "Uploading…" : "Upload Photographs"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploading || editing.images.length >= 6}
                      className="sr-only"
                    />
                  </label>
                </div>

                {editing.images.length >= 6 && (
                  <p className="mt-2 text-[11px] text-terracotta">
                    All six slots are in use. Remove one before adding another.
                  </p>
                )}

                {editing.images.length > 0 &&
                  !editing.images.some((img) => /whole slab/i.test(img.label ?? "")) && (
                    <p className="mt-2 rounded-sm bg-terracotta/10 px-3 py-2 text-[11px] text-terracotta">
                      No whole-plate photograph yet. Use <strong>Whole slab</strong> on the photo that shows the entire
                      rock, so buyers see the full piece before any close-up.
                    </p>
                  )}

                {/* Add by URL */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="Or paste an image URL…"
                    className="min-w-[220px] flex-1 rounded-sm border border-ink/20 bg-white px-3 py-2 text-xs outline-none"
                  />
                  <input
                    value={customImageLabel}
                    onChange={(e) => setCustomImageLabel(e.target.value)}
                    placeholder="Caption"
                    className="w-40 rounded-sm border border-ink/20 bg-white px-3 py-2 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    disabled={editing.images.length >= 6}
                    className="rounded-sm bg-ink px-4 py-2 text-xs uppercase tracking-[0.15em] text-parchment disabled:opacity-40"
                  >
                    Add URL
                  </button>
                </div>

                {/* Slots */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {editing.images.map((img, idx) => {
                    const zoom = img.zoom ?? { x: 50, y: 45, scale: 1 };
                    const rotate = ((img.rotate ?? 0) % 360 + 360) % 360;
                    const setImage = (patch: Partial<typeof img>) => {
                      const next = [...editing.images];
                      next[idx] = { ...next[idx], ...patch };
                      setEditing({ ...editing, images: next });
                    };
                    return (
                      <div
                        key={`${img.src}-${idx}`}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragEnter={() => setDragOverIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={() => {
                          if (dragIndex !== null && dragOverIndex !== null) moveImage(dragIndex, dragOverIndex);
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={`cursor-grab rounded-sm border bg-white p-3 active:cursor-grabbing ${
                          dragOverIndex === idx && dragIndex !== null && dragIndex !== idx
                            ? "border-sea ring-2 ring-sea/30"
                            : "border-ink/15"
                        }`}
                        title="Drag to reorder"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-sm bg-bone">
                          <div
                            className="absolute inset-0"
                            style={{
                              transform: `rotate(${rotate}deg)${img.flipH ? " scaleX(-1)" : ""}${img.flipV ? " scaleY(-1)" : ""}`,
                              transition: "transform .4s ease",
                            }}
                          >
                            <Image
                              src={img.src}
                              alt={img.alt}
                              fill
                              sizes="220px"
                              style={{
                                transform: `scale(${zoom.scale})`,
                                transformOrigin: `${zoom.x}% ${zoom.y}%`,
                              }}
                              className="object-contain"
                            />
                          </div>
                          {idx === 0 && (
                            <span className="absolute left-1.5 top-1.5 rounded bg-ink/85 px-2 py-0.5 text-[9px] uppercase tracking-wider text-parchment">
                              Cover
                            </span>
                          )}
                          <span className="absolute right-1.5 top-1.5 rounded bg-parchment/90 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink/70">
                            ⠿ drag
                          </span>
                        </div>

                        <input
                          value={img.label}
                          onChange={(e) => setImage({ label: e.target.value })}
                          className="mt-2 w-full rounded border border-ink/15 px-2 py-1 text-xs"
                          placeholder="Caption"
                        />

                        {/* Turn / mirror */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button
                            type="button"
                            title="Turn 90° to the left"
                            onClick={() => setImage({ rotate: (rotate + 270) % 360 })}
                            className="rounded border border-ink/20 px-2 py-1 text-[10px] uppercase hover:bg-bone"
                          >
                            ↺ 90°
                          </button>
                          <button
                            type="button"
                            title="Turn 90° to the right"
                            onClick={() => setImage({ rotate: (rotate + 90) % 360 })}
                            className="rounded border border-ink/20 px-2 py-1 text-[10px] uppercase hover:bg-bone"
                          >
                            ↻ 90°
                          </button>
                          <button
                            type="button"
                            title="Mirror horizontally"
                            onClick={() => setImage({ flipH: !img.flipH })}
                            className={`rounded border px-2 py-1 text-[10px] uppercase hover:bg-bone ${img.flipH ? "border-ink bg-bone" : "border-ink/20"}`}
                          >
                            ⇋ Flip H
                          </button>
                          <button
                            type="button"
                            title="Mirror vertically"
                            onClick={() => setImage({ flipV: !img.flipV })}
                            className={`rounded border px-2 py-1 text-[10px] uppercase hover:bg-bone ${img.flipV ? "border-ink bg-bone" : "border-ink/20"}`}
                          >
                            ⇅ Flip V
                          </button>
                          <button
                            type="button"
                            title="Reset orientation"
                            onClick={() => setImage({ rotate: 0, flipH: false, flipV: false })}
                            className="rounded border border-ink/20 px-2 py-1 text-[10px] uppercase hover:bg-bone"
                          >
                            Reset
                          </button>
                        </div>

                        {/* Crop */}
                        <div className="mt-3 space-y-2 border-t border-ink/10 pt-2">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-ink/50">Crop</p>
                          <label className="flex items-center gap-2 text-[11px] text-ink/70">
                            <span className="w-12">Zoom</span>
                            <input
                              type="range"
                              min="1"
                              max="3"
                              step="0.05"
                              value={zoom.scale}
                              onChange={(e) => setImage({ zoom: { ...zoom, scale: Number(e.target.value) } })}
                              className="flex-1 accent-sea"
                            />
                            <span className="w-8 text-right tabular-nums">{zoom.scale.toFixed(2)}×</span>
                          </label>
                          <label className="flex items-center gap-2 text-[11px] text-ink/70">
                            <span className="w-12">Centre X</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={zoom.x}
                              onChange={(e) => setImage({ zoom: { ...zoom, x: Number(e.target.value) } })}
                              className="flex-1 accent-sea"
                            />
                            <span className="w-8 text-right tabular-nums">{zoom.x}</span>
                          </label>
                          <label className="flex items-center gap-2 text-[11px] text-ink/70">
                            <span className="w-12">Centre Y</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={zoom.y}
                              onChange={(e) => setImage({ zoom: { ...zoom, y: Number(e.target.value) } })}
                              className="flex-1 accent-sea"
                            />
                            <span className="w-8 text-right tabular-nums">{zoom.y}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setImage({ zoom: { x: 50, y: 45, scale: 1 } })}
                            className="text-[10px] uppercase tracking-[0.14em] text-sea hover:underline"
                          >
                            Reset crop
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-ink/10 pt-2 text-[11px]">
                          <div className="flex gap-2">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...editing.images];
                                  const [picked] = next.splice(idx, 1);
                                  next.unshift({ ...picked, label: "Whole slab — top view" });
                                  setEditing({ ...editing, images: next });
                                }}
                                className="text-sea hover:underline"
                              >
                                Make cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({ ...editing, images: editing.images.filter((_, i) => i !== idx) })
                              }
                              className="text-terracotta hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                          <span className="text-ink/40">{idx + 1}/6</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, 6 - editing.images.length) }).map((_, i) => (
                    <label
                      key={`empty-${i}`}
                      className="grid aspect-square cursor-pointer place-items-center rounded-sm border border-dashed border-ink/25 bg-white/60 text-center text-[11px] text-ink/45 transition hover:border-ink/50 hover:text-ink/70"
                    >
                      <span>
                        <Upload size={18} className="mx-auto mb-1.5" />
                        Slot {editing.images.length + i + 1} — add photograph
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={copyForMarketplace}
                  className="h-12 rounded-full border border-sea/40 bg-sea/5 px-6 text-xs uppercase tracking-[0.2em] text-sea hover:bg-sea/10"
                >
                  Copy listing text for Catawiki / eBay
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-12 rounded-full border border-ink/20 px-6 text-xs uppercase tracking-[0.2em] text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-8 text-xs uppercase tracking-[0.2em] text-parchment transition hover:bg-terracotta disabled:opacity-50"
                >
                  <Save size={15} /> {savingProduct ? "Saving…" : "Save Specimen to Database"}
                </button>
              </div>
            </form>
          )}

          {/* Product Table */}
          <div className="overflow-x-auto rounded-sm border border-ink/10 bg-white/70">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-bone/60 text-[10px] uppercase tracking-[0.22em] text-ink/60">
                <tr>
                  <th className="px-4 py-3.5">Specimen</th>
                  <th className="px-4 py-3.5">Species / Period</th>
                  <th className="px-4 py-3.5">Price</th>
                  <th className="px-4 py-3.5">1-Click Channel &amp; Status Switcher</th>
                  <th className="px-4 py-3.5 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {initialProducts.map((p) => {
                  const isSold = p.stock <= 0;
                  const channel = p.listingChannel ?? "direct";
                  return (
                    <tr key={p.id} className="hover:bg-white">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-sm bg-bone">
                            <Image
                              src={p.images[0]?.src ?? "/images/hero.jpg"}
                              alt={p.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <Link href={`/shop/${p.slug}`} className="font-display text-xl text-ink hover:text-sea">
                              {p.name}
                            </Link>
                            <p className="text-xs text-ink/50">{p.locality}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="italic text-ink/80">{p.species}</p>
                        <p className="text-xs text-ink/50">
                          {p.hasCertificate ? "Certificate" : "No certificate"} · {p.period ?? "Specimen"} ·{" "}
                          {(p.collections && p.collections.length > 0 ? p.collections : [p.collection])
                            .map((slug) => COLLECTIONS.find((c) => c.slug === slug)?.title.replace("The ", "") ?? slug)
                            .join(" + ")}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-medium">{formatPrice(p.priceCents)}</td>
                      <td className="px-4 py-4">
                        <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-bone/70 p-1">
                          <button
                            type="button"
                            onClick={() => handleQuickChannel(p, "direct")}
                            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                              !isSold && channel === "direct"
                                ? "bg-ink font-semibold text-parchment shadow-sm"
                                : "text-ink/70 hover:text-ink"
                            }`}
                          >
                            Site Only
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickChannel(p, "catawiki")}
                            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                              !isSold && channel === "catawiki"
                                ? "bg-brass font-semibold text-ink shadow-sm"
                                : "text-ink/70 hover:text-ink"
                            }`}
                          >
                            On Catawiki
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickChannel(p, "ebay")}
                            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                              !isSold && channel === "ebay"
                                ? "bg-sea font-semibold text-parchment shadow-sm"
                                : "text-ink/70 hover:text-ink"
                            }`}
                          >
                            On eBay
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickChannel(p, "sold")}
                            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                              isSold
                                ? "bg-terracotta font-semibold text-parchment shadow-sm"
                                : "text-ink/70 hover:text-terracotta"
                            }`}
                          >
                            Unavailable
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {p.published ? (
                            <span className="rounded-full bg-sea/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-sea">
                              Live
                            </span>
                          ) : (
                            <span className="rounded-full bg-terracotta/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-terracotta">
                              Draft
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleTogglePublished(p, !p.published)}
                            className="rounded-full border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink hover:border-ink"
                          >
                            {p.published ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickVideo(p)}
                            className="rounded-full border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink hover:border-ink"
                          >
                            {p.videoUrl ? "Edit film" : "Add film"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(toEditable(p));
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-parchment hover:bg-sea"
                          >
                            <Edit3 size={12} /> Edit / Photos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            aria-label={`Delete ${p.name}`}
                            className="rounded-full p-2 text-ink/40 hover:bg-terracotta/10 hover:text-terracotta"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SITE SETTINGS & FIXED TEXTS */}
      {tab === "settings" && (
        <form
          onSubmit={handleSaveSettings}
          className="mt-10 max-w-4xl space-y-8 rounded-sm border border-ink/10 bg-white/80 p-6 md:p-8"
        >
          <div>
            <h2 className="font-display text-3xl text-ink">Fixed Storefront Texts &amp; Marketplace Links</h2>
            <p className="mt-1 text-sm text-ink/60">
              Edit any headline or paragraph on the Home Page, your years of experience, and your official eBay,
              Catawiki, Instagram and Facebook URLs. All text is in English; international visitors can use their
              browser&apos;s built-in translation if desired.
            </p>
          </div>

          <div className="space-y-4 border-t border-ink/10 pt-6">
            <h3 className="font-display text-2xl text-ink">1. Home Hero Section</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Top Eyebrow</label>
                <input
                  value={settingsForm.heroEyebrow}
                  onChange={(e) => setSettingsForm({ ...settingsForm, heroEyebrow: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Main Headline (Part 1)</label>
                <input
                  value={settingsForm.heroTitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, heroTitle: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Main Headline (Brass Italic Part)</label>
                <input
                  value={settingsForm.heroTitleItalic}
                  onChange={(e) => setSettingsForm({ ...settingsForm, heroTitleItalic: e.target.value })}
                  className={inputClass}
                />
              </div>
              {/* Hero photograph */}
              <div className="md:col-span-2 rounded-sm border border-ink/15 bg-bone/50 p-4">
                <span className={labelClass}>Home page photograph (the large image at the top)</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  <input
                    value={settingsForm.heroImage}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroImage: e.target.value })}
                    placeholder="/images/hero.jpg or https://…"
                    className={`${inputClass} min-w-[240px] flex-1`}
                  />
                  <label className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full bg-sea px-5 text-xs uppercase tracking-[0.16em] text-parchment transition hover:bg-ink">
                    <Upload size={14} />
                    {provenanceUploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSettingPhotoUpload(e, "heroImage")}
                      disabled={provenanceUploading}
                      className="sr-only"
                    />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-ink/55">
                  Landscape photographs work best. The text sits on the left, so keep the right third visually calm.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Introductory Paragraph</label>
                <textarea
                  rows={3}
                  value={settingsForm.heroDescription}
                  onChange={(e) => setSettingsForm({ ...settingsForm, heroDescription: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-ink/10 pt-6">
            <h3 className="font-display text-2xl text-ink">2. Provenance &amp; 23 Years Reputation</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Years of Experience</label>
                <input
                  type="number"
                  value={settingsForm.yearsExperience}
                  onChange={(e) => setSettingsForm({ ...settingsForm, yearsExperience: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Verified Feedbacks Label (e.g. 5,000+)</label>
                <input
                  value={settingsForm.feedbacksLabel}
                  onChange={(e) => setSettingsForm({ ...settingsForm, feedbacksLabel: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Provenance Eyebrow</label>
                <input
                  value={settingsForm.provenanceEyebrow}
                  onChange={(e) => setSettingsForm({ ...settingsForm, provenanceEyebrow: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Provenance Headline</label>
                <input
                  value={settingsForm.provenanceTitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, provenanceTitle: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Provenance Headline (Italic)</label>
                <input
                  value={settingsForm.provenanceTitleItalic}
                  onChange={(e) => setSettingsForm({ ...settingsForm, provenanceTitleItalic: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Provenance &amp; Shipping Mastery Paragraph</label>
                <textarea
                  rows={4}
                  value={settingsForm.provenanceBody}
                  onChange={(e) => setSettingsForm({ ...settingsForm, provenanceBody: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-ink/10 pt-6">
            <h3 className="font-display text-2xl text-ink">3. Your Official Marketplace &amp; Social Links</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>eBay Store URL</label>
                <input
                  value={settingsForm.ebayUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, ebayUrl: e.target.value })}
                  placeholder="https://www.ebay.com/usr/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Catawiki Seller URL</label>
                <input
                  value={settingsForm.catawikiUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, catawikiUrl: e.target.value })}
                  placeholder="https://www.catawiki.com/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Instagram URL</label>
                <input
                  value={settingsForm.instagramUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, instagramUrl: e.target.value })}
                  placeholder="https://www.instagram.com/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Facebook URL</label>
                <input
                  value={settingsForm.facebookUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, facebookUrl: e.target.value })}
                  placeholder="https://www.facebook.com/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Store Contact Email</label>
                <input
                  type="email"
                  value={settingsForm.contactEmail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>WhatsApp (international format)</label>
                <input
                  value={settingsForm.whatsappPhone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, whatsappPhone: e.target.value })}
                  placeholder="+351961300710"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>
                  Provenance panel photo — upload the photograph, or paste a path/URL
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={settingsForm.provenanceImage}
                    onChange={(e) => setSettingsForm({ ...settingsForm, provenanceImage: e.target.value })}
                    placeholder="/images/seafloor-plate.jpg or https://images.unsplash.com/photo-..."
                    className={`${inputClass} min-w-[240px] flex-1`}
                  />
                  <label className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full bg-sea px-5 text-xs uppercase tracking-[0.16em] text-parchment transition hover:bg-ink">
                    <Upload size={14} />
                    {provenanceUploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSettingPhotoUpload(e, "provenanceImage")}
                      disabled={provenanceUploading}
                      className="sr-only"
                    />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-ink/55">
                  Uploading stores the photograph in your own database, so it can never disappear or be blocked.
                </p>
              </div>
              <div>
                <label className={labelClass}>Trustami review page URL</label>
                <input
                  value={settingsForm.trustamiUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, trustamiUrl: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Verified rating shown on site</label>
                <input
                  value={settingsForm.trustamiRating}
                  onChange={(e) => setSettingsForm({ ...settingsForm, trustamiRating: e.target.value })}
                  placeholder="4.98/5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Number of verified ratings</label>
                <input
                  value={settingsForm.trustamiRatings}
                  onChange={(e) => setSettingsForm({ ...settingsForm, trustamiRatings: e.target.value })}
                  placeholder="200"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-ink/10 pt-6">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex h-13 items-center gap-2 rounded-full bg-ink px-8 text-xs uppercase tracking-[0.22em] text-parchment transition hover:bg-terracotta disabled:opacity-50"
            >
              <Save size={15} /> {savingSettings ? "Saving…" : "Save Texts to Database"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: ORDERS */}
      {tab === "orders" && (
        <div className="mt-10 space-y-4">
          <h2 className="font-display text-3xl text-ink">Received Orders</h2>
          {orders.length === 0 ? (
            <div className="rounded-sm border border-dashed border-ink/20 p-12 text-center text-sm text-ink/60">
              No direct orders recorded yet.
            </div>
          ) : (
            orders.map(({ order, items }) => (
              <div key={order.id} className="rounded-sm border border-ink/10 bg-white/75 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-brass">
                      MED-{order.id.slice(0, 8).toUpperCase()} · {formatDate(order.createdAt)}
                    </p>
                    <p className="mt-1 font-display text-2xl text-ink">
                      {order.firstName} {order.lastName} ({order.email})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl text-ink">{formatPrice(order.totalCents)}</p>
                    <p className="text-xs text-ink/55">
                      Shipping: {order.shippingMethod} · {order.country}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="text-xs text-ink/70">
                    <p className="font-medium uppercase tracking-wider text-ink">Delivery Address:</p>
                    <p className="mt-1">
                      {order.addressLine1} {order.addressLine2 ? `, ${order.addressLine2}` : ""} — {order.postalCode}{" "}
                      {order.city}, {order.country}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-ink">Items:</p>
                    <ul className="mt-1 space-y-1 text-xs text-ink/80">
                      {items.map((item) => (
                        <li key={item.id}>
                          {item.quantity}× {item.productName} ({formatPrice(item.unitPriceCents)})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
