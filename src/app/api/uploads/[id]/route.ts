import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedImages } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Database IDs are mutable in the admin: never advertise them as immutable. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return new Response("Not found", { status: 404 });
  const [image] = await db.select().from(uploadedImages).where(eq(uploadedImages.id, numericId)).limit(1);
  if (!image) return new Response("Not found", { status: 404 });
  const bytes = Buffer.from(image.dataBase64, "base64");
  const etag = `"${createHash("sha256").update(bytes).digest("hex")}"`;
  const headers = {
    "Content-Type": image.mimeType || "application/octet-stream",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(bytes), { status: 200, headers: { ...headers, "Content-Length": String(bytes.length) } });
}
