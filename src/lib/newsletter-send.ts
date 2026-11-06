import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  newsletterSends,
  newsletterSettings,
  newsletterSubscribers,
  products,
  uploadedImages,
} from "@/db/schema";
import { ensureSchema } from "@/lib/schema-migrate";
import { escapeHtml, mailShell, mailTransport, sendMail, type MailAttachment } from "@/lib/mailer";
import { offeredSpecimen } from "@/lib/inventory-rules";
import { formatPrice } from "@/lib/format";
import { PUBLIC_SITE_URL } from "@/lib/site-url";

// sharp and the filesystem are loaded on first use only. This file is also
// imported by the public /featured page, which must never depend on native code.

/**
 * Photos are inlined as CID attachments (resend only) so the e-mail renders
 * in every client: mail apps block remote images by default and Outlook
 * desktop never fetches them at all. Each photo is downscaled to keep the
 * message small enough for fast inboxes.
 */
const EMAIL_IMAGE_WIDTH = 540;
const EMAIL_IMAGE_QUALITY = 70;
/** Without sharp, a photo is attached as it is only when it is small enough. */
const MAX_UNSHRUNK_BYTES = 300 * 1024;

type PieceEmailImage = {
  contentId: string;
  /** Base64 bytes: a JPEG after shrinking, or the original photo when it is small. */
  content: string;
  contentType: string;
  width: number;
  height: number;
};

/** Raw bytes for a stored image, from the uploads table, /public or a URL. */
async function readImageBytes(src: string, uploads: Map<number, { dataBase64: string }>): Promise<Buffer | null> {
  try {
    const uploadMatch = src.match(/^\/api\/uploads\/(\d+)(?:\?.*)?$/);
    if (uploadMatch) {
      const row = uploads.get(Number(uploadMatch[1]));
      return row ? Buffer.from(row.dataBase64, "base64") : null;
    }
    // Repository photos (/images/...) are read from disk when they are bundled
    // with the server. On Vercel the public folder is served from the CDN and
    // is not part of the function's filesystem, so the same photo is downloaded
    // from the shop itself. Either way the photo still travels inline.
    if (src.startsWith("/")) {
      try {
        const { promises: fs } = await import("node:fs");
        const path = await import("node:path");
        const file = path.join(process.cwd(), "public", src.split("?")[0]);
        return Buffer.from(await fs.readFile(file));
      } catch {
        // Not bundled with the server: fetched from the shop below.
      }
    }
    const url = /^https?:\/\//i.test(src) ? src : `${PUBLIC_SITE_URL}${src}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Downscales a photo with sharp, loaded on demand. Null when sharp is unavailable or fails. */
async function shrinkForEmail(bytes: Buffer): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(bytes, { animated: false })
      .rotate()
      .resize({ width: EMAIL_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: EMAIL_IMAGE_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/** The real image type from the first bytes, so each attachment is labelled correctly. */
function sniffImageType(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (bytes.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  return null;
}

export async function resolvePieceImages(pieces: NewsletterPiece[]): Promise<Map<number, PieceEmailImage>> {
  const out = new Map<number, PieceEmailImage>();
  const firsts = pieces
    .map((p) => ({ id: p.id, src: p.images[0]?.src }))
    .filter((x): x is { id: number; src: string } => Boolean(x.src));
  const uploadIds = [...new Set(firsts.map((x) => Number(x.src.match(/^\/api\/uploads\/(\d+)/)?.[1] ?? 0)).filter((n) => Number.isInteger(n) && n > 0))];
  let uploads = new Map<number, { dataBase64: string }>();
  if (uploadIds.length > 0) {
    const rows = await db
      .select({ id: uploadedImages.id, dataBase64: uploadedImages.dataBase64 })
      .from(uploadedImages)
      .where(inArray(uploadedImages.id, uploadIds));
    uploads = new Map(rows.map((r) => [r.id, { dataBase64: r.dataBase64 }]));
  }
  for (const [index, { id, src }] of firsts.entries()) {
    const bytes = await readImageBytes(src, uploads);
    if (!bytes) continue;
    const contentId = `piece-${index + 1}`;
    const shrunk = await shrinkForEmail(bytes);
    if (shrunk) {
      out.set(id, {
        contentId,
        content: shrunk.data.toString("base64"),
        contentType: "image/jpeg",
        width: shrunk.width,
        height: shrunk.height,
      });
      continue;
    }
    // Without sharp a small photo still travels inline; a large one keeps its
    // link. Either way one photo can never cancel the whole mailing.
    const type = sniffImageType(bytes);
    if (type && bytes.length <= MAX_UNSHRUNK_BYTES) {
      out.set(id, { contentId, content: bytes.toString("base64"), contentType: type, width: 0, height: 0 });
    }
  }
  return out;
}

/** The mailing goes out twice a month: never more often than every 15 days. */
export const NEWSLETTER_CADENCE_DAYS = 15;
export const NEWSLETTER_PIECE_COUNT = 10;
export const DEFAULT_NEWSLETTER_SUBJECT = "Featured and New Pieces";

export type NewsletterPiece = {
  id: number;
  slug: string;
  name: string;
  specimenReference: string | null;
  lengthMm: string | null;
  priceCents: number;
  listingChannel: string | null;
  archived: boolean;
  stock: number;
  published: boolean;
  featured?: boolean;
  createdAt?: Date;
  images: { src: string; alt: string; label: string }[];
};

/**
 * Mixed selection: the curator's manual picks win when set; otherwise the
 * featured pieces first, then the newest arrivals — always only pieces that
 * are genuinely offered right now (never archived or unavailable).
 */
export function selectNewsletterPieces(
  all: NewsletterPiece[],
  manualIds?: number[],
): NewsletterPiece[] {
  const available = all.filter((p) => offeredSpecimen(p));
  if (manualIds && manualIds.length > 0) {
    const byId = new Map(available.map((p) => [p.id, p]));
    return manualIds
      .map((id) => byId.get(id))
      .filter((p): p is NewsletterPiece => Boolean(p))
      .slice(0, NEWSLETTER_PIECE_COUNT);
  }
  return [...available]
    .sort(
      (a, b) =>
        Number(b.featured ?? false) - Number(a.featured ?? false) ||
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    )
    .slice(0, NEWSLETTER_PIECE_COUNT);
}

/** Same rule as the product page: bare numbers are legacy millimetres. */
function formatDimensions(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return /^\d+(?:[.,]\d+)?$/.test(text) ? `${text} mm` : text;
}

function absolute(src: string): string {
  return src.startsWith("http") ? src : `${PUBLIC_SITE_URL}${src}`;
}

function pieceLine(piece: NewsletterPiece): string {
  const ref = piece.specimenReference?.trim();
  const dims = formatDimensions(piece.lengthMm);
  const parts = [ref, dims].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}

function piecePrice(piece: NewsletterPiece): string {
  if (piece.listingChannel === "ebay") return "Live on eBay";
  if (piece.listingChannel === "catawiki") return "Live on Catawiki";
  return formatPrice(piece.priceCents);
}

/** Short mailing with the pieces inside — not just a link to the shop. */
export function buildNewsletterEmail(input: {
  subject: string;
  pieces: NewsletterPiece[];
  unsubscribeUrl: string;
  /**
   * Inlined photo per piece. With a contentId the HTML uses `cid:` (renders
   * in every client); without one it falls back to the remote URL.
   */
  pieceImages?: Map<number, PieceEmailImage>;
}): { text: string; html: string } {
  const { subject, pieces, unsubscribeUrl, pieceImages } = input;
  const intro =
    "Twice a month we share the pieces we are most excited about — featured specimens and the newest arrivals from the quarries and preparators.";

  const text = [
    subject,
    "",
    intro,
    "",
    ...pieces.flatMap((p) => [
      `${p.name}${pieceLine(p) ? ` — ${pieceLine(p)}` : ""} — ${piecePrice(p)}`,
      `${PUBLIC_SITE_URL}/shop/${p.slug}`,
      "",
    ]),
    `View all pieces: ${PUBLIC_SITE_URL}/shop`,
    "",
    `You receive this twice a month. Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const bodyHtml = pieces
    .map((p) => {
      const image = p.images[0];
      const inlined = pieceImages?.get(p.id);
      const line = pieceLine(p);
      return `<div style="margin:0 0 22px">
        ${
          image
            ? inlined
              ? `<a href="${PUBLIC_SITE_URL}/shop/${p.slug}"><img src="cid:${inlined.contentId}" alt="${escapeHtml(image.alt || p.name)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:4px;border:1px solid #e3dccc" /></a>`
              : `<a href="${PUBLIC_SITE_URL}/shop/${p.slug}"><img src="${absolute(image.src)}" alt="${escapeHtml(image.alt || p.name)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:4px;border:1px solid #e3dccc" /></a>`
            : ""
        }
        <p style="margin:10px 0 2px;font-family:Georgia,serif;font-size:19px"><a href="${PUBLIC_SITE_URL}/shop/${p.slug}" style="color:#0c1b26;text-decoration:none">${escapeHtml(p.name)}</a></p>
        ${line ? `<p style="margin:0 0 2px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6b76">${escapeHtml(line)}</p>` : ""}
        <p style="margin:0;font-size:14px;color:#0c1b26"><strong>${escapeHtml(piecePrice(p))}</strong> · <a href="${PUBLIC_SITE_URL}/shop/${p.slug}" style="color:#1d4a5c">View piece →</a></p>
      </div>`;
    })
    .join("");

  const html = mailShell({
    heading: subject,
    intro,
    bodyHtml: `${bodyHtml}<p style="margin:6px 0 0"><a href="${PUBLIC_SITE_URL}/shop" style="display:inline-block;background:#0c1b26;color:#f7f2e8;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:12px;letter-spacing:.18em;text-transform:uppercase">View all pieces</a></p>`,
    footer: `You receive this twice a month. <a href="${unsubscribeUrl}" style="color:#1d4a5c">Unsubscribe</a> — no hard feelings, and you can rejoin anytime from the shop footer.`,
  });

  return { text, html };
}

export type NewsletterCadence = {
  lastSentAt: Date | null;
  daysSince: number | null;
  due: boolean;
};

export async function getNewsletterCadence(): Promise<NewsletterCadence> {
  await ensureSchema();
  const [last] = await db
    .select({ createdAt: newsletterSends.createdAt })
    .from(newsletterSends)
    .where(eq(newsletterSends.status, "sent"))
    .orderBy(desc(newsletterSends.createdAt))
    .limit(1);
  // A partially delivered mailing still counts: subscribers were contacted.
  const [lastPartial] = await db
    .select({ createdAt: newsletterSends.createdAt })
    .from(newsletterSends)
    .where(eq(newsletterSends.status, "partial"))
    .orderBy(desc(newsletterSends.createdAt))
    .limit(1);
  const candidates = [last?.createdAt, lastPartial?.createdAt].filter(
    (d): d is Date => Boolean(d),
  );
  const lastSentAt = candidates.length ? new Date(Math.max(...candidates.map((d) => d.getTime()))) : null;
  if (!lastSentAt) return { lastSentAt: null, daysSince: null, due: true };
  const daysSince = Math.floor((Date.now() - lastSentAt.getTime()) / 86_400_000);
  return { lastSentAt, daysSince, due: daysSince >= NEWSLETTER_CADENCE_DAYS };
}

export type NewsletterSettings = { autoEnabled: boolean; pieceIds: number[] };

export async function getNewsletterSettings(): Promise<NewsletterSettings> {
  await ensureSchema();
  const [row] = await db.select().from(newsletterSettings).where(eq(newsletterSettings.id, 1)).limit(1);
  if (row) return { autoEnabled: row.autoEnabled, pieceIds: row.pieceIds ?? [] };
  await db.insert(newsletterSettings).values({ id: 1 }).onConflictDoNothing();
  return { autoEnabled: false, pieceIds: [] };
}

export async function updateNewsletterSettings(patch: {
  autoEnabled?: boolean;
  pieceIds?: number[];
}): Promise<NewsletterSettings> {
  await ensureSchema();
  const current = await getNewsletterSettings();
  const next = {
    autoEnabled: patch.autoEnabled ?? current.autoEnabled,
    pieceIds: patch.pieceIds ?? current.pieceIds,
  };
  await db
    .insert(newsletterSettings)
    .values({ id: 1, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: newsletterSettings.id, set: { ...next, updatedAt: new Date() } });
  return next;
}

export async function getNewsletterSends(limit = 20) {
  await ensureSchema();
  return db.select().from(newsletterSends).orderBy(desc(newsletterSends.createdAt)).limit(limit);
}

export type SendNewsletterResult =
  | { ok: true; sent: number; failed: number; recipients: number; pieces: number; status: string }
  | { ok: false; reason: "cadence" | "no-recipients" | "no-pieces" | "not-configured" | "failed"; detail: string; daysSince?: number | null };

export async function sendNewsletter(input: {
  source: "manual" | "cron";
  subject?: string;
  pieceIds?: number[];
  force?: boolean;
}): Promise<SendNewsletterResult> {
  await ensureSchema();
  const subject = input.subject?.trim() || DEFAULT_NEWSLETTER_SUBJECT;
  const settings = await getNewsletterSettings();

  const cadence = await getNewsletterCadence();
  if (!input.force && !cadence.due) {
    return {
      ok: false,
      reason: "cadence",
      detail: `The last mailing went out ${cadence.daysSince} day(s) ago. The cadence is once every ${NEWSLETTER_CADENCE_DAYS} days.`,
      daysSince: cadence.daysSince,
    };
  }

  const recipients = await db
    .select()
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.confirmed, true),
        isNull(newsletterSubscribers.unsubscribedAt),
        eq(newsletterSubscribers.segment, "all"),
      ),
    );

  const allProducts = await db.select().from(products);
  const pieces = selectNewsletterPieces(
    allProducts as never,
    input.pieceIds ?? settings.pieceIds,
  ) as NewsletterPiece[];

  if (pieces.length === 0) {
    await db.insert(newsletterSends).values({
      subject,
      pieceIds: pieces.map((p) => p.id),
      recipientCount: recipients.length,
      status: "failed",
      detail: "No pieces available for this mailing.",
      source: input.source,
    });
    return { ok: false, reason: "no-pieces", detail: "No pieces available for this mailing." };
  }

  if (recipients.length === 0) {
    await db.insert(newsletterSends).values({
      subject,
      pieceIds: pieces.map((p) => p.id),
      recipientCount: 0,
      status: "skipped",
      detail: "No confirmed subscribers to mail.",
      source: input.source,
    });
    return { ok: false, reason: "no-recipients", detail: "No confirmed subscribers to mail." };
  }

  let sent = 0;
  let failed = 0;
  let firstFailure: string | null = null;
  let notConfigured = false;

  // Resend is the only transport that supports cid: inline images.
  const useInline = mailTransport() === "resend";
  const pieceImages = useInline ? await resolvePieceImages(pieces) : undefined;
  const attachments: MailAttachment[] | undefined = useInline
    ? [...pieceImages?.values() ?? []].map((img, index) => ({
        filename: `piece-${index + 1}.${img.contentType.split("/")[1]}`,
        content: img.content,
        contentType: img.contentType,
        contentId: img.contentId,
      }))
    : undefined;

  for (const sub of recipients) {
    let token = sub.unsubscribeToken;
    if (!token) {
      token = randomUUID();
      await db
        .update(newsletterSubscribers)
        .set({ unsubscribeToken: token })
        .where(eq(newsletterSubscribers.id, sub.id));
    }
    const unsubscribeUrl = `${PUBLIC_SITE_URL}/unsubscribe?token=${token}`;
    const { text, html } = buildNewsletterEmail({ subject, pieces, unsubscribeUrl, pieceImages });
    const result = await sendMail({
      to: sub.email,
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      ...(attachments?.length ? { attachments } : {}),
    });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (!firstFailure) firstFailure = result.detail;
      if (result.notConfigured) notConfigured = true;
    }
  }

  const status = failed === 0 ? "sent" : sent > 0 ? "partial" : "failed";
  await db.insert(newsletterSends).values({
    subject,
    pieceIds: pieces.map((p) => p.id),
    recipientCount: recipients.length,
    sentCount: sent,
    failedCount: failed,
    status,
    detail: firstFailure,
    source: input.source,
  });

  if (sent === 0) {
    return {
      ok: false,
      reason: notConfigured ? "not-configured" : "failed",
      detail: firstFailure ?? "The mailing could not be delivered.",
    };
  }
  return { ok: true, sent, failed, recipients: recipients.length, pieces: pieces.length, status };
}

/** One-click unsubscribe. Returns true when the token belongs to a subscriber. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  await ensureSchema();
  const clean = token.trim();
  if (!clean) return false;
  const [row] = await db
    .select({ id: newsletterSubscribers.id, unsubscribedAt: newsletterSubscribers.unsubscribedAt })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.unsubscribeToken, clean))
    .limit(1);
  if (!row) return false;
  if (!row.unsubscribedAt) {
    await db
      .update(newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.id, row.id));
  }
  return true;
}
