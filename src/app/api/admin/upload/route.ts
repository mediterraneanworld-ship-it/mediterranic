import { db } from "@/db";
import { uploadedImages } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");
    if (entries.length === 0) {
      return Response.json({ error: "Nenhum ficheiro enviado." }, { status: 400 });
    }

    const uploadedUrls: { url: string; filename: string }[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;
      const arrayBuffer = await entry.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = entry.type || "image/jpeg";
      const filename = entry.name || "specimen.jpg";

      const [inserted] = await db
        .insert(uploadedImages)
        .values({
          filename,
          mimeType,
          dataBase64: base64,
        })
        .returning({ id: uploadedImages.id });

      uploadedUrls.push({
        url: `/api/uploads/${inserted.id}`,
        filename,
      });
    }

    return Response.json({ files: uploadedUrls }, { status: 201 });
  } catch (error) {
    console.error("Image upload error", error);
    return Response.json({ error: "Erro ao carregar imagem." }, { status: 500 });
  }
}
