import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DEFAULT_SITE_SETTINGS } from "@/lib/catalog";
import { mergeContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

/**
 * Saves the editable page texts & photographs.
 *
 * Deliberately separate from /api/admin/settings: that route rewrites every
 * column of site_settings, so posting a partial document there would reset the
 * hero and provenance texts to their defaults. This route touches `content`
 * only, so the two editors can never overwrite each other.
 */
export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return Response.json({ error: "Invalid data." }, { status: 400 });
  }

  // Only known keys, with the right types, survive.
  const content = mergeContent(body.content);

  const existing = await db.select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);

  // Keep the older hero/provenance columns in step, so the "Fixed storefront
  // texts" tab always shows what the site is actually rendering.
  const hero = content.home.hero;
  const provenance = content.home.provenance;
  const mirrored = {
    heroEyebrow: hero.eyebrow,
    heroTitle: hero.title,
    heroTitleItalic: hero.titleItalic,
    heroDescription: hero.description,
    heroImage: hero.image,
    provenanceEyebrow: provenance.eyebrow,
    provenanceTitle: provenance.title,
    provenanceTitleItalic: provenance.titleItalic,
    provenanceBody: provenance.body,
    provenanceImage: provenance.image,
  };

  if (existing.length === 0) {
    await db
      .insert(siteSettings)
      .values({ ...DEFAULT_SITE_SETTINGS, ...mirrored, content, updatedAt: new Date() })
      .onConflictDoNothing();
  } else {
    await db
      .update(siteSettings)
      .set({ ...mirrored, content, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1));
  }

  return Response.json({ ok: true, content });
}
