"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  LogOut,
  Mail,
  Package,
  Plus,
  Save,
  Settings,
  ShoppingBag,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { ProductImage } from "@/db/schema";
import type { NewsletterSubscriber, ProductWithStats, SiteSettings } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/collections";
import { formatDate, formatPrice } from "@/lib/format";
import { AdminContentEditor } from "@/components/admin-content-editor";
import { AdminCronStatus } from "@/components/admin-cron-status";
import { InventorySyncPanel } from "@/components/inventory-sync-panel";
import type { InventorySyncReport } from "@/lib/inventory-rules";
import { EbayConnectionCheck } from "@/components/ebay-connection-check";
import { readContent, type SiteContent } from "@/lib/site-content";
import { CODE_VERSION } from "@/lib/version";
import { listingKey, matchListing, marketplaceOf, savedListing, type ListingMatch } from "@/lib/marketplace-links";

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
    paymentMethod: string;
    paypalOrderId: string | null;
    customerNote: string | null;
    trackingUrl: string | null;
    trackingSentAt: Date | null;
    createdAt: Date;
  };
  items: {
    id: number;
    productName: string;
    productSlug: string;
    unitPriceCents: number;
    quantity: number;
  }[];
  notifications?: {
    event: string;
    status: string;
    recipient: string;
    detail: string | null;
    sentAt: Date | null;
  }[];
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  confirmed: "Paid · ready to ship",
  shipped: "Shipped",
  pending_payment: "Awaiting payment",
  payment_pending: "PayPal is reviewing",
  payment_review: "Needs review",
  cancelled: "Cancelled",
};

type SellerLot = { id: string; url: string; title: string; priceCents?: number | null; match?: ListingMatch };

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
  siteOnlyPriceDollars: string;
  archived: boolean;
  listingChannel: string;
  externalListingUrl: string;
  ebayListingUrl: string;
  catawikiListingUrl: string;
  specimenReference: string;
  weightGrams: string;
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
  siteOnlyPriceDollars: "",
  archived: false,
  listingChannel: "direct",
  externalListingUrl: "",
  ebayListingUrl: "",
  catawikiListingUrl: "",
  specimenReference: "",
  weightGrams: "",
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
    priceDollars: (p.priceCents / 100).toFixed(2),
    compareAtDollars: p.compareAtCents ? (p.compareAtCents / 100).toFixed(2) : "",
    stock: String(p.stock),
    featured: p.featured,
    published: p.published ?? true,
    hasCertificate: p.hasCertificate ?? false,
    siteOnlyPriceDollars: p.siteOnlyPriceCents ? (p.siteOnlyPriceCents / 100).toFixed(2) : "",
    archived: p.archived ?? false,
    listingChannel: p.listingChannel ?? "direct",
    externalListingUrl: p.externalListingUrl ?? "",
    ebayListingUrl: savedListing(p, "ebay") ?? "",
    catawikiListingUrl: savedListing(p, "catawiki") ?? "",
    specimenReference: p.specimenReference ?? "",
    weightGrams: p.weightGrams ? String(p.weightGrams) : "",
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
  initialSubscribers,
  initialContent,
  onSignOut,
}: {
  initialProducts: ProductWithStats[];
  initialSettings: SiteSettings;
  orders: OrderEntry[];
  initialSubscribers: NewsletterSubscriber[];
  initialContent: SiteContent;
  onSignOut: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "settings" | "content" | "orders" | "newsletter">("products");
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>(initialSubscribers);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [sellerUrl, setSellerUrl] = useState("https://www.catawiki.com/en/u/3881635-mediterranic");
  const [ebaySellerUrl, setEbaySellerUrl] = useState("https://www.ebay.com/str/mederranic");
  const [sellerLots, setSellerLots] = useState<SellerLot[] | null>(null);
  const [linkChoices, setLinkChoices] = useState<Record<string, string>>({});
  /** Quick channel box: link + price (+ archive choice for Unavailable). */
  const [channelBox, setChannelBox] = useState<{
    product: ProductWithStats;
    target: "direct" | "catawiki" | "ebay" | "sold";
  } | null>(null);
  const [channelForm, setChannelForm] = useState({
    link: "",
    price: "",
    archive: false,
  });
  const [channelBusy, setChannelBusy] = useState(false);
  const [sellerBusy, setSellerBusy] = useState(false);
  const [sellerSource, setSellerSource] = useState<"ebay" | "catawiki" | null>(null);
  const [sellerFeedback, setSellerFeedback] = useState<string | null>(null);
  const [sellerProgress, setSellerProgress] = useState<string | null>(null);
  const [parsingText, setParsingText] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pastedPhotos, setPastedPhotos] = useState("");
  const [pastingBusy, setPastingBusy] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customImageLabel, setCustomImageLabel] = useState("Dorsal view");
  const [provenanceUploading, setProvenanceUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [runsKey, setRunsKey] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [orderActionBusy, setOrderActionBusy] = useState<string | null>(null);
  const [emailTest, setEmailTest] = useState<{ transport: string; recipient: string; from: string; status?: string; detail?: string } | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [messageDraft, setMessageDraft] = useState<Record<string, string>>({});
  const [messageOpen, setMessageOpen] = useState<string | null>(null);
  const [priceReport, setPriceReport] = useState<
    {
      name: string;
      channel: string;
      previousCents: number;
      currentCents: number | null;
      status?: "live" | "sold" | "unsold" | "ended" | "unknown";
      markedUnavailable?: boolean;
      error?: string;
    }[] | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState({
    heroEyebrow: String(readContent(initialContent, ["home","hero","eyebrow"]) ?? initialSettings.heroEyebrow),
    heroTitle: String(readContent(initialContent, ["home","hero","title"]) ?? initialSettings.heroTitle),
    heroTitleItalic: String(readContent(initialContent, ["home","hero","titleItalic"]) ?? initialSettings.heroTitleItalic),
    heroDescription: String(readContent(initialContent, ["home","hero","description"]) ?? initialSettings.heroDescription),
    provenanceEyebrow: String(readContent(initialContent, ["home","provenance","eyebrow"]) ?? initialSettings.provenanceEyebrow),
    provenanceTitle: String(readContent(initialContent, ["home","provenance","title"]) ?? initialSettings.provenanceTitle),
    provenanceTitleItalic: String(readContent(initialContent, ["home","provenance","titleItalic"]) ?? initialSettings.provenanceTitleItalic),
    provenanceBody: String(readContent(initialContent, ["home","provenance","body"]) ?? initialSettings.provenanceBody),
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
    provenanceImage: String(readContent(initialContent, ["home","provenance","image"]) ?? initialSettings.provenanceImage),
    heroImage: String(readContent(initialContent, ["home","hero","image"]) ?? initialSettings.heroImage),
  });
  const [savingSettings, setSavingSettings] = useState(false);

  function notify(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 4000);
  }

  /** Removes one address when a reader asks to be taken off the list. */
  async function handleRemoveSubscriber(email: string) {
    if (!window.confirm(`Remove ${email} from the newsletter list?`)) return;
    const res = await fetch(`/api/newsletter?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    if (res.ok) {
      setSubscribers((list) => list.filter((s) => s.email !== email));
      notify(`${email} removed from the list.`);
    } else {
      notify("Could not remove that address.");
    }
  }

  /* ---------------- Received orders actions ---------------- */

  function orderRef(order: OrderEntry["order"]): string {
    return `MED-${order.id.slice(0, 8).toUpperCase()}`;
  }

  /** Flat delivery summary for the carrier label. */
  function orderDetailsText(entry: OrderEntry): string {
    const { order, items } = entry;
    return [
      orderRef(order),
      `${order.firstName} ${order.lastName}`,
      order.addressLine1 + (order.addressLine2 ? `, ${order.addressLine2}` : ""),
      `${order.postalCode} ${order.city}, ${order.country}`,
      order.phone ? `Tel: ${order.phone}` : "",
      order.email,
      order.customerNote ? `Message: ${order.customerNote}` : "",
      "Items: " + items.map((i) => `${i.quantity}x ${i.productName}`).join(", "),
      `Total: ${formatPrice(order.totalCents)} (${order.paymentMethod})`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copyOrderDetails(entry: OrderEntry) {
    try {
      await navigator.clipboard.writeText(orderDetailsText(entry));
      notify(`${orderRef(entry.order)} copied — paste it on the carrier label.`);
    } catch {
      notify("The clipboard is blocked by the browser; select the text and copy manually.");
    }
  }

  async function markOrderShipped(entry: OrderEntry) {
    const { order } = entry;
    if (!window.confirm(`Mark ${orderRef(order)} as shipped?`)) return;
    setOrderActionBusy(order.id);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: "shipped" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        notify(`${orderRef(order)} marked as shipped.`);
        router.refresh();
      } else {
        notify(data.error ?? "Could not update the order status.");
      }
    } catch {
      notify("The order could not be updated. Try again.");
    } finally {
      setOrderActionBusy(null);
    }
  }

  /** Test orders and mistakes. Deletion NEVER restores stock — the curator
      re-lists the piece from the channel box after refunding the buyer. */
  async function deleteOrder(entry: OrderEntry) {
    const { order } = entry;
    const ref = orderRef(order);
    if (
      !window.confirm(
        `Delete ${ref} (${order.firstName} ${order.lastName}, ${formatPrice(order.totalCents)})?\n\n` +
          "This removes the order record only. Stock is NOT restored and the piece stays as it is — " +
          "refund the buyer in PayPal first, then re-list the piece from the channel box if you need it back for sale.",
      )
    )
      return;
    if (!window.confirm(`Really delete ${ref}? This cannot be undone.`)) return;
    setOrderActionBusy(order.id);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        notify(`${ref} deleted. Stock was not touched.`);
        router.refresh();
      } else {
        notify(data.error ?? "The order could not be deleted.");
      }
    } catch {
      notify("The order could not be deleted. Try again.");
    } finally {
      setOrderActionBusy(null);
    }
  }

  /** Resends the curator e-mail for one order (never changes the order). */
  async function resendOrderEmail(entry: OrderEntry) {
    const { order } = entry;
    const ref = orderRef(order);
    setOrderActionBusy(order.id + ":mail");
    try {
      const res = await fetch("/api/admin/orders/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, event: order.paymentMethod === "paypal" ? "paid" : "placed" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        detail?: string;
        error?: string;
        recipient?: string;
        transport?: string;
      };
      if (res.ok && data.status === "sent") {
        notify(`E-mail for ${ref} sent to ${data.recipient}.`);
        router.refresh();
      } else {
        notify(
          data.error ||
            (data.status === "not_configured"
              ? `E-mail not sent: no provider configured. Add RESEND_API_KEY (or BREVO_API_KEY) in the environment; the recipient will be ${data.recipient ?? "the curator mailbox"}.`
              : `E-mail not sent (${data.status ?? "error"}): ${data.detail ?? "unknown error"}`),
        );
      }
    } catch {
      notify("The e-mail could not be sent. The order was not changed.");
    } finally {
      setOrderActionBusy(null);
    }
  }

  async function loadEmailStatus() {
    try {
      const res = await fetch("/api/admin/email-test", { cache: "no-store" });
      if (res.ok) setEmailTest((await res.json()) as { transport: string; recipient: string; from: string });
    } catch {}
  }

  async function sendTestEmail() {
    setEmailTesting(true);
    try {
      const res = await fetch("/api/admin/email-test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { transport?: string; recipient?: string; from?: string; status?: string; detail?: string };
      setEmailTest({ transport: data.transport ?? "none", recipient: data.recipient ?? "", from: data.from ?? "", status: data.status, detail: data.detail });
      notify(
        data.status === "sent"
          ? `Test e-mail accepted by ${data.transport}. Check ${data.recipient} (and the spam folder).`
          : data.detail || "The test e-mail could not be sent.",
      );
    } catch {
      notify("The test e-mail could not be sent.");
    } finally {
      setEmailTesting(false);
    }
  }

  async function sendTracking(entry: OrderEntry, saveOnly: boolean) {
    const { order } = entry;
    const value = (trackingDraft[order.id] ?? order.trackingUrl ?? "").trim();
    if (!value) {
      notify("Paste the carrier tracking link or number first.");
      return;
    }
    if (!saveOnly && !window.confirm(`Send the tracking details for ${orderRef(order)} to ${order.email}?`)) return;
    setOrderActionBusy(`${order.id}:tracking`);
    try {
      const res = await fetch("/api/admin/orders/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, tracking: value, saveOnly }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: boolean;
        buyer?: { ok: boolean; detail: string };
      };
      if (res.ok && data.sent) {
        notify(`Tracking sent to ${order.email} and copied to your mailbox.`);
        router.refresh();
      } else if (res.ok) {
        notify("Tracking saved. It was not e-mailed yet.");
        router.refresh();
      } else {
        notify(data.error ?? "The tracking details could not be saved.");
        router.refresh();
      }
    } catch {
      notify("The tracking details could not be saved. Try again.");
    } finally {
      setOrderActionBusy(null);
    }
  }

  async function sendMessageToBuyer(entry: OrderEntry) {
    const { order } = entry;
    const message = (messageDraft[order.id] ?? "").trim();
    if (message.length < 2) {
      notify("Write the message you want to send.");
      return;
    }
    setOrderActionBusy(`${order.id}:message`);
    try {
      const res = await fetch("/api/admin/orders/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; to?: string };
      if (res.ok) {
        notify(`Message sent to ${data.to ?? order.email}.`);
        setMessageDraft((d) => ({ ...d, [order.id]: "" }));
        setMessageOpen(null);
        router.refresh();
      } else {
        notify(data.error ?? "The message was not sent.");
      }
    } catch {
      notify("The message was not sent. Try again.");
    } finally {
      setOrderActionBusy(null);
    }
  }

  function exportOrdersCsv() {
    const esc = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Reference", "Date", "Status", "Payment", "Buyer", "Email", "Phone", "Country",
      "Address", "City", "Postal code", "Buyer message", "Items", "Subtotal (EUR)", "Shipping (EUR)", "Total (EUR)",
    ];
    const rows = orders.map(({ order, items }) => [
      orderRef(order),
      new Date(order.createdAt).toISOString(),
      order.status,
      order.paymentMethod,
      `${order.firstName} ${order.lastName}`,
      order.email,
      order.phone ?? "",
      order.country,
      order.addressLine1 + (order.addressLine2 ? `, ${order.addressLine2}` : ""),
      order.city,
      order.postalCode,
      order.customerNote ?? "",
      items.map((i) => `${i.quantity}x ${i.productName}`).join("; "),
      (order.subtotalCents / 100).toFixed(2),
      (order.shippingCents / 100).toFixed(2),
      (order.totalCents / 100).toFixed(2),
    ]);
    const csv = [header, ...rows].map((row) => row.map(esc).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mediterranic-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }



  /**
   * Opens the channel box instead of switching immediately: a listing link and
   * a price have to travel with the piece when it moves platform. For
   * "Unavailable" only the price and the archive choice apply.
   */
  function openChannelBox(product: ProductWithStats, target: "direct" | "catawiki" | "ebay" | "sold") {
    const knownLink =
      target === "direct"
        ? product.externalListingUrl ?? ""
        : target === "sold"
          ? ""
          : savedListing(product, target) ?? "";
    setChannelForm({
      link: knownLink,
      price: target === "sold" ? "" : (product.priceCents / 100).toFixed(2),
      archive: target === "sold" ? true : product.archived,
    });
    setChannelBox({ product, target });
  }

  async function submitChannelBox() {
    if (!channelBox) return;
    const { product, target } = channelBox;
    const priceCents = Math.round(Number(channelForm.price.replace(",", ".") || 0) * 100);
    setChannelBusy(true);
    try {
      if (target === "sold") {
        // Only send a price when one was typed: an empty box must keep the
        // existing euro price instead of resetting it to zero (which the
        // publish validation would then reject).
        const body: Record<string, unknown> = {
          id: product.id,
          stock: 0,
          archived: channelForm.archive,
          listingChannel: null,
        };
        if (channelForm.price) body.priceDollars = channelForm.price;
        if (channelForm.archive) body.published = false;
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          notify(
            channelForm.archive
              ? `"${product.name}" is Unavailable and moved to the public archive (no price shown).`
              : `"${product.name}" is Unavailable and kept out of the archive.`,
          );
          setChannelBox(null);
          router.refresh();
        } else {
          notify("Could not save. Nothing was changed.");
        }
        return;
      }

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          listingChannel: target,
          externalListingUrl: channelForm.link || "",
          priceDollars: channelForm.price || "0",
          stock: product.stock > 0 ? product.stock : 1,
          archived: false,
          published: true,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (res.ok) {
        const label =
          target === "direct" ? "Site Only" : target === "catawiki" ? "Live on Catawiki" : "Live on eBay";
        notify(`"${product.name}" saved as ${label}${channelForm.link ? ` with its link` : ""}.`);
        setChannelBox(null);
        router.refresh();
      } else {
        notify(data.error ?? "Could not save. Check the link and the price.");
      }
    } finally {
      setChannelBusy(false);
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
          status?: "live" | "sold" | "unsold" | "ended" | "unknown";
          markedUnavailable?: boolean;
          error?: string;
        }[];
        changed?: number;
        inventory?: InventorySyncReport | null;
        ended?: number;
        error?: string;
      };
      if (!res.ok) {
        notify(data.error ?? "Could not refresh prices.");
        return;
      }
      setPriceReport(data.results ?? []);
      setRunsKey((k) => k + 1);
      const endedCount = data.ended ?? 0;
      notify(
        `${data.inventory ? `Inventory ${data.inventory.status}: ${data.inventory.linked} relinked, ${data.inventory.created} imported, ${data.inventory.issues.length} warning(s). ` : ""}Checked ${(data.results ?? []).length} listing(s). ${data.changed ?? 0} price change(s)${endedCount ? ` · ${endedCount} closed auction(s) handled` : ""}. ${(data.results ?? []).filter((r) => r.error).length} could not be read.`,
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
    if (!window.confirm(`Remove "${product.name}" from the storefront? The record, photos and history will be kept as an archive draft.`)) return;
    const res = await fetch(`/api/admin/products?id=${product.id}`, { method: "DELETE" });
    if (res.ok) {
      notify(`"${product.name}" removed from the storefront; archive draft kept.`);
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
        imported?: Partial<EditableProduct> & { images?: ProductImage[]; photoWarning?: string; photosStored?: number };
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
        priceDollars: imp.priceDollars ?? "",
        compareAtDollars: (imp as { compareAtDollars?: string }).compareAtDollars || "",
        shortDescription: imp.shortDescription || "",
        description: imp.description || "",
        provenance: imp.provenance || EMPTY_PRODUCT.provenance,
        images: imp.images && imp.images.length > 0 ? imp.images : [],
        published: imp.published !== false && Number(imp.priceDollars) > 0 && Boolean(imp.images?.length) && Boolean(imp.description || imp.shortDescription),
      };

      // Never silently publish a partial gallery. SmugMug has the 3-first-photo
      // rule; if any of them failed, keep the actual imported photos in the
      // editor and ask for the missing ones instead of guessing or duplicating.
      if (imp.photoWarning) {
        setEditing({ ...draft, published: false });
        notify(imp.photoWarning);
        return;
      }

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

      const storedPhotos = imp.photosStored ?? draft.images.length;
      setImportUrl("");
      setEditing(null);
      setPublishedSlug(draft.published ? saved.product.slug : null);
      notify(draft.published
        ? `Published to your storefront with ${storedPhotos} photo(s).`
        : "Saved as a draft. Complete the euro price, photographs and description before publishing.");
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

  const knownMatch = (lot: SellerLot) => lot.match ?? matchListing(lot, initialProducts);
  const chosenProduct = (lot: SellerLot) => linkChoices[lot.id] === "new" ? null
    : Number(linkChoices[lot.id] || knownMatch(lot).productId) || null;
  const alreadyImported = (url: string) => initialProducts.some((p) => {
    const channel = marketplaceOf(url);
    return Boolean(channel && p.listingChannel === channel && !p.archived && listingKey(savedListing(p, channel)) === listingKey(url));
  });

  async function findEbayLots() {
    setSellerSource("ebay");
    setSellerLots(null);
    setSellerBusy(true);
    setSellerProgress(null);
    setSellerFeedback(null);
    try {
      const res = await fetch("/api/admin/import-ebay-seller", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ebaySellerUrl }),
      });
      const data = await res.json() as {
        lots?: SellerLot[];
        excluded?: number; error?: string; message?: string; via?: string;
      };
      if (!res.ok) { setSellerFeedback(data.error ?? "Could not read eBay."); return; }
      setSellerLots(data.lots ?? []);
      setSellerFeedback(
        `Found ${data.lots?.length ?? 0} listing(s)${data.via === "ebay-api" ? " through the official API" : ""}. ${data.excluded ?? 0} non-trilobite listing(s) excluded. ${data.message ?? ""}`,
      );
    } catch {
      setSellerFeedback("Network error while contacting eBay. Nothing was imported.");
    } finally { setSellerBusy(false); }
  }

  async function findSellerLots() {
    setSellerSource("catawiki");
    setSellerFeedback(null);
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

  async function importSellerLots(lots: SellerLot[], marketplace: "ebay" | "catawiki" = "ebay") {
    const moving = lots.filter((lot) => chosenProduct(lot) && !alreadyImported(lot.url));
    if (moving.length && !window.confirm(
      `Link ${moving.length} listing(s) to existing specimen records and set their active marketplace? Photos, texts and the Site Only price stay unchanged. End any other live auction yourself — this does not change eBay or Catawiki.`,
    )) return;
    setSellerBusy(true);
    let live = 0, linked = 0, drafts = 0, skipped = 0, choose = 0, failed = 0;
    let lastError = "";
    try {
      for (const [index, lot] of lots.entries()) {
        if (alreadyImported(lot.url)) { skipped++; continue; }
        setSellerProgress(`Reading ${index + 1} of ${lots.length}: ${lot.title.slice(0, 48)}…`);
        const channel = marketplaceOf(lot.url) ?? marketplace;
        const existingId = chosenProduct(lot);
        if (existingId) {
          const specimen = initialProducts.find((p) => p.id === existingId);
          const res = await fetch("/api/admin/marketplace-link", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: existingId, channel, url: lot.url,
              restoreStock: Boolean(specimen && !specimen.archived && specimen.stock <= 0) }),
          });
          const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
          if (res.ok) linked++; else { failed++; lastError = data.error ?? "Could not link this listing."; }
          continue;
        }
        if (knownMatch(lot).kind === "candidate" && linkChoices[lot.id] !== "new") { choose++; continue; }
        const readRes = await fetch("/api/admin/import-url", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: lot.url, title: lot.title }),
        });
        const read = await readRes.json() as { imported?: Record<string, unknown> & { images?: ProductImage[]; priceCents?: number | string }; error?: string };
        if (!readRes.ok || !read.imported) { failed++; lastError = read.error ?? "Could not read the listing."; continue; }
        const parsedPrice = Number(read.imported.priceCents ?? Number(read.imported.priceDollars ?? 0) * 100);
        const priceCents = parsedPrice > 0 ? Math.round(parsedPrice) : lot.priceCents ?? 0;
        const canPublish = priceCents > 0 && Boolean(read.imported.images?.length) && Boolean(read.imported.description || read.imported.shortDescription);
        const saveRes = await fetch("/api/admin/products", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...read.imported, stock: "1", listingChannel: channel, archived: false,
            published: canPublish, priceDollars: priceCents > 0 ? (priceCents / 100).toFixed(2) : "",
            siteOnlyPriceDollars: String(read.imported.siteOnlyPriceDollars ?? "") }),
        });
        const saved = await saveRes.json().catch(() => ({})) as { error?: string };
        if (saveRes.ok) { if (canPublish) live++; else drafts++; } else { failed++; lastError = saved.error ?? "Could not save the specimen."; }
      }
      const summary = `${linked} existing specimen(s) linked, ${live} new listing(s) published, ${drafts} draft(s), ${skipped} already active, ${choose} awaiting your choice, ${failed} failed.${lastError ? ` ${lastError}` : ""}`;
      setSellerFeedback(summary); notify(summary); router.refresh();
    } catch { setSellerFeedback("Network error. Previously completed actions are kept; check the list before retrying."); }
    finally { setSellerBusy(false); setSellerProgress(null); }
  }

  function renderSellerResults() {
    return (
      <div className="mt-3 space-y-3">
        {sellerFeedback && <p role="status" className="rounded-sm border border-ink/15 bg-white/85 p-3 text-xs leading-relaxed text-ink/80">{sellerFeedback}</p>}
        {sellerProgress && <p className="text-xs text-sea">{sellerProgress}</p>}
        {sellerLots && sellerLots.length > 0 && (
          <div className="rounded-sm border border-ink/15 bg-white/80 p-3">
            <button type="button" disabled={sellerBusy} onClick={() => importSellerLots(sellerLots, sellerSource ?? "ebay")}
              className="min-h-11 rounded-full bg-terracotta px-4 text-[11px] uppercase tracking-[0.14em] text-parchment disabled:opacity-40">Sync selected / import new</button>
            <p className="mt-2 text-xs text-ink/60">A returned listing can be linked to its existing specimen — do not import another copy. Similar names are suggestions only.</p>
            <ul className="mt-2 divide-y divide-ink/10">
              {sellerLots.map((lot) => {
                const match = knownMatch(lot);
                const selected = linkChoices[lot.id] ?? (match.productId ? String(match.productId) : "");
                return (
                  <li key={lot.id} className="space-y-2 py-3 text-xs">
                    <p className="font-medium text-ink">{lot.title}</p>
                    {alreadyImported(lot.url) ? <p className="text-sea">Already active on this marketplace</p> : (
                      <>
                        <label className="block">
                          <span className="text-ink/65">Link to existing specimen, or create a distinct new specimen</span>
                          <select aria-label={`Specimen for ${lot.title}`} value={selected}
                            onChange={(event) => setLinkChoices((old) => ({ ...old, [lot.id]: event.target.value }))}
                            className="mt-1 min-h-11 w-full min-w-0 rounded-sm border border-ink/20 bg-white px-2 text-xs">
                            <option value="">{match.kind === "candidate" ? "Choose — possible existing specimen found" : "Choose an existing specimen if this is a relisting"}</option>
                            <option value="new">Create a NEW, distinct specimen</option>
                            {initialProducts.map((specimen) => <option key={specimen.id} value={specimen.id}>{specimen.specimenReference ? `${specimen.specimenReference} · ` : ""}{specimen.name} · {specimen.archived ? "Archive" : specimen.listingChannel ?? "Unavailable"}</option>)}
                          </select>
                        </label>
                        {match.productId && <p className="text-sea">Recognised by a saved listing or specimen reference. The existing photos and text will be kept.</p>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={sellerBusy || (match.kind === "candidate" && !selected)} onClick={() => importSellerLots([lot], sellerSource ?? "ebay")}
                            className="min-h-11 rounded-full border border-ink/25 px-4 text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">{chosenProduct(lot) ? "Link / reactivate this specimen" : "Import this"}</button>
                          <button type="button" onClick={() => addLotManually(lot)} className="min-h-11 rounded-full border border-ink/20 px-4 text-[10px] uppercase tracking-[0.12em]">Open a new draft manually</button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  /**
   * eBay (and sometimes Catawiki) block servers, but never the curator's own
   * browser. Copying the listing and pasting it here gives us the title, price,
   * text and photo addresses — the images come from a CDN that is not blocked.
   */
  async function handlePastedListing() {
    if (!pastedText.trim() && !pastedPhotos.trim()) {
      notify("Paste the listing text or at least one photo address first.");
      return;
    }
    setPastingBusy(true);
    try {
      const res = await fetch("/api/admin/import-pasted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pastedText,
          imageUrls: pastedPhotos.split(/[\s,]+/).filter(Boolean),
          url: importUrl.trim(),
        }),
      });
      const data = (await res.json()) as {
        imported?: Partial<EditableProduct> & { images?: ProductImage[]; photosStored?: number; priceCents?: number };
        missing?: string[];
        error?: string;
      };
      if (!res.ok || !data.imported) {
        notify(data.error ?? "Could not read the pasted listing.");
        return;
      }
      const imp = data.imported;
      setEditing({
        ...EMPTY_PRODUCT,
        name: imp.name || EMPTY_PRODUCT.name,
        species: imp.species || EMPTY_PRODUCT.species,
        listingChannel: "ebay",
        externalListingUrl: imp.externalListingUrl || importUrl.trim(),
        period: imp.period || EMPTY_PRODUCT.period,
        collection: (imp as { collection?: string }).collection || EMPTY_PRODUCT.collection,
        collections: ((imp as { collections?: string[] }).collections ?? []).filter((c) =>
          COLLECTIONS.some((x) => x.slug === c),
        ),
        lengthMm: imp.lengthMm || "",
        locality: imp.locality || EMPTY_PRODUCT.locality,
        formation: imp.formation || "",
        preparation: imp.preparation || EMPTY_PRODUCT.preparation,
        priceDollars: imp.priceDollars || "",
        siteOnlyPriceDollars: imp.priceDollars || "",
        shortDescription: imp.shortDescription || "",
        description: imp.description || "",
        provenance: imp.provenance || EMPTY_PRODUCT.provenance,
        images: imp.images ?? [],
      });
      const missing = data.missing ?? [];
      notify(
        missing.length > 0
          ? `Read the listing. Still missing: ${missing.join(", ")}. Complete it in the form and press Save (it stays a draft until complete).`
          : "Listing read in full — check the details and press Save to publish it.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      notify("Could not read the pasted listing. Please try again.");
    } finally {
      setPastingBusy(false);
    }
  }

  /** Last-resort path: pre-fill the form from the link when eBay blocks reading. */
  function addLotManually(lot: { url: string; title: string; priceCents?: number | null }) {
    const price = lot.priceCents && lot.priceCents > 0 ? (lot.priceCents / 100).toFixed(2) : "";
    setEditing({
      ...EMPTY_PRODUCT,
      name: lot.title.slice(0, 140),
      listingChannel: "ebay",
      externalListingUrl: lot.url,
      priceDollars: price,
      siteOnlyPriceDollars: price,
      stock: "1",
      images: [],
    });
    notify("Form ready — add the photos, check the price and press Save. The piece is already set to Live on eBay.");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // The specimen editor renders inline, directly under the row being edited,
  // so the list never has to be scrolled past to reach the form.
  const editorForm = editing ? (
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
                    onChange={(e) => { const channel = e.target.value; setEditing({ ...editing, listingChannel: channel, externalListingUrl: channel === "ebay" || channel === "catawiki" ? savedListing(editing, channel) ?? "" : editing.externalListingUrl }); }}
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

                <div className="rounded-sm border border-ink/15 bg-bone/40 p-4 md:col-span-2">
                  <p className="mb-3 text-sm font-medium text-ink">One specimen, separate marketplace links</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-ink/65">
                      <span className="block">REF · collection reference (shown under the title)</span>
                      <input value={editing.specimenReference} onChange={(e) => setEditing({ ...editing, specimenReference: e.target.value })} placeholder="PAIS9676 or 9676" className={`${inputClass} mt-1`} /></label>
                    <label className="text-xs text-ink/65">
                      <span className="block">Weight with box (g)</span>
                      <input value={editing.weightGrams} onChange={(e) => setEditing({ ...editing, weightGrams: e.target.value })} inputMode="numeric" placeholder="456" className={`${inputClass} mt-1`} /></label>
                    <label className="text-xs text-ink/65">Saved eBay item URL
                      <input value={editing.ebayListingUrl} onChange={(e) => setEditing({ ...editing, ebayListingUrl: e.target.value })} placeholder="https://www.ebay.com/itm/..." className={`${inputClass} mt-1`} /></label>
                    <label className="text-xs text-ink/65">Saved Catawiki lot URL
                      <input value={editing.catawikiListingUrl} onChange={(e) => setEditing({ ...editing, catawikiListingUrl: e.target.value })} placeholder="https://www.catawiki.com/en/l/..." className={`${inputClass} mt-1`} /></label>
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    The REF is the unique number this piece keeps on eBay, Catawiki and the site, so a relisting is
                    recognised by its number instead of by a name or a photograph. Changing channels keeps both links
                    and their history. Only the selected active channel is checked automatically — end any competing
                    live listing yourself.
                  </p>
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
                  <label className={labelClass}>When in Site Only — price (EUR €)</label>
                  <input
                    type="number"
                    min="0"
                    value={editing.siteOnlyPriceDollars}
                    onChange={(e) => setEditing({ ...editing, siteOnlyPriceDollars: e.target.value })}
                    placeholder="Used if the auction ends unsold"
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
                      checked={editing.archived}
                      onChange={(e) => setEditing({ ...editing, archived: e.target.checked })}
                      className="h-4 w-4 accent-brass"
                    />
                    Show in public archive (sold pieces, no price)
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
  ) : null;

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
        <button
          type="button"
          onClick={() => setTab("newsletter")}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.2em] transition ${
            tab === "newsletter" ? "bg-ink text-parchment" : "bg-bone/70 text-ink/75 hover:bg-bone"
          }`}
        >
          <Mail size={15} /> 4. Newsletter ({subscribers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("content")}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.2em] transition ${
            tab === "content" ? "bg-ink text-parchment" : "bg-bone/70 text-ink/75 hover:bg-bone"
          }`}
        >
          <Edit3 size={15} /> 5. Page texts &amp; photos
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

          <InventorySyncPanel specimens={initialProducts.map((p) => ({ id: p.id, name: p.name, archived: p.archived }))} refreshKey={runsKey} />

          {/* Automatic marketplace price refresh */}
          <div className="mb-4 rounded-sm border-2 border-brass/40 bg-brass/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
              Refresh marketplace prices
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Reads the current bid from Catawiki and the current price from your eBay store, and updates the shop.
              If an auction has <strong>ended</strong>, the piece is automatically marked <strong>Unavailable</strong>
              (price hidden). Runs once a day — or press the button now.
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
                Only pieces that are <strong>already on the site</strong> are checked. A brand-new listing is brought in by{" "}
              <strong>“Find my eBay listings”</strong> below, not by this button.
              </span>
            </div>

            <AdminCronStatus refreshKey={runsKey} />

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
                          {r.status === "sold" || r.status === "ended" ? (
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] uppercase tracking-wider text-parchment">
                              Sold → Archive
                            </span>
                          ) : r.status === "unsold" ? (
                            <span className="rounded-full bg-sea px-2 py-0.5 text-[10px] uppercase tracking-wider text-parchment">
                              Unsold → Site Only €{((r.currentCents ?? 0) / 100).toFixed(0)}
                            </span>
                          ) : r.currentCents === null ? (
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
              automatically. Each listing comes in with its photograph <strong>and goes live straight away</strong> at
              the eBay price, marked “Live on eBay”. If eBay did not show a price, the piece is saved as a draft for
              you to complete. Existing specimens are not overwritten by discovery or import.
            </p>
            <div className="mt-3"><EbayConnectionCheck onSellerDetected={(seller) => setEbaySellerUrl(`https://www.ebay.com/usr/${encodeURIComponent(seller)}`)} /></div>
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

            {sellerSource === "ebay" && renderSellerResults()}

            {/* Paste is a fallback if the API is not available. */}
            <details className="mt-3 rounded-sm border border-ink/15 bg-white/80 p-3">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">
                eBay blocking? Paste the listing here — no keys needed
              </summary>
              <p className="mt-2 text-xs text-ink/65">
                Open the listing in your browser, select everything (<kbd>Ctrl</kbd>+<kbd>A</kbd>), copy and paste it
                below. Right-click the main photo → <em>Copy image address</em> and paste it in the second box. We read
                the title, price, description and keep the photos in the shop database.
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={5}
                placeholder="Paste the listing text (or the page source) here…"
                className="mt-3 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-xs outline-none focus:border-sea"
              />
              <textarea
                value={pastedPhotos}
                onChange={(e) => setPastedPhotos(e.target.value)}
                rows={2}
                placeholder="Photo addresses, one per line — https://i.ebayimg.com/images/g/…"
                className="mt-2 w-full rounded-sm border border-ink/20 bg-white px-3 py-2 text-xs outline-none focus:border-sea"
              />
              <button
                type="button"
                onClick={handlePastedListing}
                disabled={pastingBusy}
                className="mt-2 inline-flex h-9 items-center justify-center rounded-full bg-ink px-5 text-[11px] uppercase tracking-[0.16em] text-parchment hover:bg-terracotta disabled:opacity-50"
              >
                {pastingBusy ? "Reading…" : "Read pasted listing"}
              </button>
            </details>
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

            </div>
            {sellerSource === "catawiki" && renderSellerResults()}
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

          {/* New specimen (no row yet): the editor sits above the table. */}
          {editing && editing.id === null && editorForm}


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
                    <>
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
                            onClick={() => openChannelBox(p, "direct")}
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
                            onClick={() => openChannelBox(p, "catawiki")}
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
                            onClick={() => openChannelBox(p, "ebay")}
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
                            onClick={() => openChannelBox(p, "sold")}
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
                    {/* Editor inline, immediately below the piece being edited */}
                    {editing && editing.id === p.id && (
                      <tr className="hover:bg-transparent">
                        <td colSpan={5} className="bg-bone/40 p-0 align-top">
                          <div className="m-3 md:m-4 [&>form]:mb-0 [&>form]:shadow-none">
                            {editorForm}
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
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
                <p className="mt-1 text-[11px] leading-relaxed text-ink/55">
                  Shown in the hero as “Verified feedbacks”. The <strong>Specimens</strong> and{" "}
                  <strong>Eras offered</strong> numbers are always calculated from pieces available now (Site Only +
                  eBay + Catawiki) and cannot be typed here. The four labels themselves are edited in{" "}
                  <strong>5. Page texts &amp; photos</strong>.
                </p>
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

      {/* TAB 5: PAGE TEXTS & PHOTOGRAPHS */}
      {tab === "content" && (
        <div className="mt-10">
          <AdminContentEditor initialContent={initialContent} notify={notify} />
        </div>
      )}

      {/* TAB 3: ORDERS */}
      {tab === "orders" && (
        <div className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-ink">Received Orders</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink/60">
                Copy the delivery details for the carrier, mark a paid order as shipped, export the list as CSV, or
                delete a test order. Deleting an order <strong>never restores stock</strong> — refund the buyer in
                PayPal first and re-list the piece from the channel box if it should go back on sale.
              </p>
            </div>
            <button
              type="button"
              onClick={exportOrdersCsv}
              disabled={orders.length === 0}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-xs uppercase tracking-[0.2em] text-parchment transition hover:bg-sea disabled:opacity-40"
            >
              <Download size={15} /> Download CSV
            </button>
          </div>

          <div className="rounded-sm border border-sea/30 bg-sea/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">Order notification e-mail</p>
                <p className="mt-1 text-xs text-ink/65">
                  Every order is e-mailed to <strong>{emailTest?.recipient || "mediterranean.world@gmail.com"}</strong>.
                  {" "}Provider: <strong>{emailTest?.transport && emailTest.transport !== "none" ? emailTest.transport : "not configured"}</strong>
                  {emailTest?.from ? ` · from ${emailTest.from}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-ink/45">Code version: {CODE_VERSION}</p>
                {emailTest?.status && (
                  <p className={`mt-1 text-xs ${emailTest.status === "sent" ? "text-sea" : "text-terracotta"}`}>
                    {emailTest.status === "sent" ? "Test sent — check that mailbox (and spam)." : emailTest.detail}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadEmailStatus()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[11px] uppercase tracking-[0.14em] text-ink transition hover:border-ink"
                >
                  Check settings
                </button>
                <button
                  type="button"
                  onClick={() => void sendTestEmail()}
                  disabled={emailTesting}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-sea px-4 text-[11px] uppercase tracking-[0.14em] text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  <Mail size={13} /> {emailTesting ? "Sending…" : "Send test e-mail"}
                </button>
              </div>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-sm border border-dashed border-ink/20 p-12 text-center text-sm text-ink/60">
              No direct orders recorded yet.
            </div>
          ) : (
            orders.map(({ order, items, notifications }) => {
              const entryNotifications = notifications ?? [];
              const busy = orderActionBusy === order.id;
              const busyMail = orderActionBusy === `${order.id}:mail`;
              const busyTracking = orderActionBusy === `${order.id}:tracking`;
              const busyMessage = orderActionBusy === `${order.id}:message`;
              const statusLabel = ORDER_STATUS_LABEL[order.status] ?? order.status;
              const awaitingPayment = ["pending_payment", "payment_pending", "payment_review"].includes(order.status);
              return (
                <div key={order.id} className="rounded-sm border border-ink/10 bg-white/75 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-brass">
                        {orderRef(order)} · {formatDate(order.createdAt)}
                      </p>
                      <p className="mt-1 font-display text-2xl text-ink">
                        {order.firstName} {order.lastName} ({order.email})
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
                            awaitingPayment
                              ? "bg-brass/15 text-[#8a6a1f]"
                              : order.status === "shipped"
                                ? "bg-sea/10 text-sea"
                                : "bg-bone text-ink/75"
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span className="rounded-full bg-bone px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-ink/60">
                          Paid via {order.paymentMethod === "paypal" ? "PayPal" : "invoice"}
                          {order.paypalOrderId ? ` · ${order.paypalOrderId}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl text-ink">{formatPrice(order.totalCents)}</p>
                      <p className="text-xs text-ink/55">
                        Shipping: {order.shippingMethod} · {order.country}
                      </p>
                    </div>
                  </div>
                  {order.customerNote && (
                    <div className="mt-4 rounded-sm border-l-2 border-brass bg-brass/10 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">
                        Buyer message
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{order.customerNote}</p>
                    </div>
                  )}
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="text-xs text-ink/70">
                      <p className="font-medium uppercase tracking-wider text-ink">Delivery Address:</p>
                      <p className="mt-1">
                        {order.addressLine1} {order.addressLine2 ? `, ${order.addressLine2}` : ""} — {order.postalCode}{" "}
                        {order.city}, {order.country}
                      </p>
                      {order.phone && <p className="mt-1">Phone: {order.phone}</p>}
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
                  {(() => {
                    const latest = (entryNotifications ?? [])[0];
                    return (
                      <p className="mt-3 text-[11px] text-ink/60">
                        Curator e-mail:{" "}
                        {latest ? (
                          <strong className={latest.status === "sent" ? "text-sea" : "text-terracotta"}>
                            {latest.status === "sent"
                              ? `sent to ${latest.recipient}${latest.sentAt ? ` · ${formatDate(latest.sentAt)}` : ""}`
                              : latest.status === "not_configured"
                                ? "no e-mail provider configured — add RESEND_API_KEY"
                                : `not sent (${latest.detail ?? latest.status})`}
                          </strong>
                        ) : (
                          <span>not recorded yet</span>
                        )}
                      </p>
                    );
                  })()}
                  <div className="mt-4 rounded-sm border border-brass/40 bg-brass/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">Tracking</p>
                    <div className="mt-2 flex flex-col gap-2 md:flex-row">
                      <input
                        value={trackingDraft[order.id] ?? order.trackingUrl ?? ""}
                        onChange={(e) => setTrackingDraft((d) => ({ ...d, [order.id]: e.target.value }))}
                        placeholder="Paste the carrier link (https://…) or the tracking number"
                        className="min-h-11 w-full min-w-0 rounded-sm border border-ink/20 bg-white px-3 text-sm outline-none focus:border-sea"
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void sendTracking({ order, items }, false)}
                          disabled={busy || busyTracking}
                          className="inline-flex h-11 items-center gap-2 rounded-full bg-sea px-4 text-[11px] uppercase tracking-[0.14em] text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          <Truck size={13} /> {busyTracking ? "Sending…" : "Save & send"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendTracking({ order, items }, true)}
                          disabled={busy || busyTracking}
                          className="inline-flex h-11 items-center rounded-full border border-ink/25 px-4 text-[11px] uppercase tracking-[0.14em] text-ink transition hover:border-ink disabled:opacity-50"
                        >
                          Save only
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-ink/55">
                      {order.trackingSentAt
                        ? `Buyer notified ${formatDate(order.trackingSentAt)}.`
                        : order.trackingUrl
                          ? "Saved, not sent yet."
                          : "The buyer and your mailbox both receive the tracking details."}
                    </p>
                  </div>

                  {messageOpen === order.id && (
                    <div className="mt-3 rounded-sm border border-sea/40 bg-sea/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sea">
                        Message to {order.firstName} ({order.email})
                      </p>
                      <textarea
                        rows={4}
                        value={messageDraft[order.id] ?? ""}
                        onChange={(e) => setMessageDraft((d) => ({ ...d, [order.id]: e.target.value }))}
                        placeholder="Write your reply. The order reference and items are added automatically."
                        className="mt-2 w-full min-h-24 resize-y rounded-sm border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-sea"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void sendMessageToBuyer({ order, items })}
                          disabled={busyMessage}
                          className="inline-flex h-10 items-center gap-2 rounded-full bg-sea px-4 text-[11px] uppercase tracking-[0.14em] text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          <Mail size={13} /> {busyMessage ? "Sending…" : "Send to buyer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageOpen(null)}
                          className="inline-flex h-10 items-center rounded-full border border-ink/25 px-4 text-[11px] uppercase tracking-[0.14em] text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
                    <button
                      type="button"
                      onClick={() => setMessageOpen((open) => (open === order.id ? null : order.id))}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[11px] uppercase tracking-[0.14em] text-ink transition hover:border-ink"
                    >
                      <Mail size={13} /> Message buyer
                    </button>
                    <button
                      type="button"
                      onClick={() => void resendOrderEmail({ order, items, notifications: entryNotifications })}
                      disabled={busy || busyMail}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-sea/40 bg-sea/5 px-4 text-[11px] uppercase tracking-[0.14em] text-sea transition hover:bg-sea/10 disabled:opacity-50"
                    >
                      <Mail size={13} /> {busyMail ? "Sending…" : "E-mail curator"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyOrderDetails({ order, items })}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[11px] uppercase tracking-[0.14em] text-ink transition hover:border-ink"
                    >
                      <Copy size={13} /> Copy details
                    </button>
                    {order.status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() => void markOrderShipped({ order, items })}
                        disabled={busy}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-sea px-4 text-[11px] uppercase tracking-[0.14em] text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Truck size={13} /> {busy ? "Working…" : "Mark as shipped"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteOrder({ order, items })}
                      disabled={busy || awaitingPayment}
                      title={awaitingPayment ? "Cannot delete an order that is still awaiting payment." : "Delete this order record (stock is not restored)"}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-terracotta/40 px-4 text-[11px] uppercase tracking-[0.14em] text-terracotta transition hover:bg-terracotta/10 disabled:opacity-40"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: NEWSLETTER */}
      {tab === "newsletter" && (
        <div className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-ink">Newsletter subscribers</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink/60">
                Addresses collected by the public form in the footer and on the Shipping &amp; Returns page. The list
                only grows — a deploy never removes anyone. Download it as CSV and send your mailings from Gmail,
                Mailchimp or Brevo.
              </p>
            </div>
            <a
              href="/api/newsletter?format=csv"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-xs uppercase tracking-[0.2em] text-parchment transition hover:bg-sea"
            >
              <Mail size={15} /> Download CSV
            </a>
          </div>

          {subscribers.length === 0 ? (
            <div className="rounded-sm border border-dashed border-ink/20 p-12 text-center text-sm text-ink/60">
              No subscribers yet. The sign-up form is live in the footer of the public shop.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-ink/10 bg-white/75">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-bone/60 text-[11px] uppercase tracking-[0.18em] text-ink/70">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Subscribed
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Source
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id} className="border-b border-ink/8 last:border-0">
                      <td className="px-4 py-3 text-ink">{s.email}</td>
                      <td className="px-4 py-3 text-ink/65">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3 text-ink/65">{s.source}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSubscriber(s.email)}
                          aria-label={`Remove ${s.email}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink/70 transition hover:border-terracotta hover:text-terracotta"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Channel box: link + price travel with the piece when it changes platform. */}
      {channelBox && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-sm border border-ink/15 bg-parchment p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-brass">
                  {channelBox.target === "sold"
                    ? "Unavailable"
                    : channelBox.target === "direct"
                      ? "Site Only"
                      : channelBox.target === "catawiki"
                        ? "Live on Catawiki"
                        : "Live on eBay"}
                </p>
                <h3 className="mt-1 font-display text-3xl leading-tight text-ink">{channelBox.product.name}</h3>
                {channelBox.product.specimenReference && (
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/50">
                    {channelBox.product.specimenReference}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setChannelBox(null)}
                aria-label="Close"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {channelBox.target === "sold" ? (
                <p className="rounded-sm bg-bone/60 p-3 text-xs leading-relaxed text-ink/70">
                  No listing link applies to an unavailable piece. Choose whether it should also appear in the
                  public archive — where pieces are shown for the record, without any price.
                </p>
              ) : (
                <label className="block">
                  <span className={labelClass}>
                    {channelBox.target === "direct"
                      ? "Link (optional — usually none for Site Only)"
                      : channelBox.target === "catawiki"
                        ? "Catawiki lot link"
                        : "eBay item link"}
                  </span>
                  <input
                    type="text"
                    inputMode="url"
                    value={channelForm.link}
                    onChange={(e) => setChannelForm({ ...channelForm, link: e.target.value })}
                    placeholder={
                      channelBox.target === "catawiki"
                        ? "https://www.catawiki.com/en/l/..."
                        : channelBox.target === "ebay"
                          ? "https://www.ebay.com/itm/..."
                          : "https://…"
                    }
                    className={`${inputClass} mt-1`}
                  />
                  <span className="mt-1 block text-[11px] text-ink/45">
                    The link changes every time the piece moves platform. Leave it empty if it is not listed yet.
                  </span>
                </label>
              )}

              <label className="block">
                <span className={labelClass}>
                  {channelBox.target === "sold" ? "Price (EUR €) — optional" : "Price (EUR €)"}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={channelForm.price}
                  onChange={(e) => setChannelForm({ ...channelForm, price: e.target.value })}
                  placeholder="0"
                  className={`${inputClass} mt-1`}
                />
                {channelBox.target === "direct" && (
                  <span className="mt-1 block text-[11px] text-ink/45">
                    This is the direct-sale price. When the piece later returns from an unsold auction, this is the
                    value used — never the last auction bid.
                  </span>
                )}
              </label>

              {channelBox.target === "sold" && (
                <div>
                  <span className={labelClass}>Show in the public archive?</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: true, label: "Yes — add to /archive" },
                      { value: false, label: "No — keep it off the site" },
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        type="button"
                        onClick={() => setChannelForm({ ...channelForm, archive: option.value })}
                        className={`min-h-11 rounded-full border px-4 text-[11px] uppercase tracking-[0.14em] transition ${
                          channelForm.archive === option.value
                            ? "border-ink bg-ink text-parchment"
                            : "border-ink/25 text-ink/70 hover:border-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
              <button
                type="button"
                disabled={channelBusy}
                onClick={submitChannelBox}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-6 text-[11px] uppercase tracking-[0.16em] text-parchment transition hover:bg-sea disabled:opacity-50"
              >
                {channelBusy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setChannelBox(null)}
                className="inline-flex min-h-11 items-center rounded-full border border-ink/25 px-5 text-[11px] uppercase tracking-[0.16em] text-ink/70 transition hover:border-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
