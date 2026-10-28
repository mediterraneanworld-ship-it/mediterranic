import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedImages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const [img] = await db
    .select()
    .from(uploadedImages)
    .where(eq(uploadedImages.id, numericId))
    .limit(1);

  if (!img) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = Buffer.from(img.dataBase64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": img.mimeType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
