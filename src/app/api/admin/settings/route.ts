import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DEFAULT_SITE_SETTINGS } from "@/lib/catalog";
import { mergeContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const existing = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  const row = existing[0] ?? { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date() };
  // The editor always receives a complete document, defaults included.
  return Response.json({ settings: { ...row, content: mergeContent(row.content) } });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const values = {
    heroEyebrow: String(body.heroEyebrow ?? DEFAULT_SITE_SETTINGS.heroEyebrow).trim(),
    heroTitle: String(body.heroTitle ?? DEFAULT_SITE_SETTINGS.heroTitle).trim(),
    heroTitleItalic: String(body.heroTitleItalic ?? DEFAULT_SITE_SETTINGS.heroTitleItalic).trim(),
    heroDescription: String(body.heroDescription ?? DEFAULT_SITE_SETTINGS.heroDescription).trim(),
    provenanceEyebrow: String(body.provenanceEyebrow ?? DEFAULT_SITE_SETTINGS.provenanceEyebrow).trim(),
    provenanceTitle: String(body.provenanceTitle ?? DEFAULT_SITE_SETTINGS.provenanceTitle).trim(),
    provenanceTitleItalic: String(
      body.provenanceTitleItalic ?? DEFAULT_SITE_SETTINGS.provenanceTitleItalic,
    ).trim(),
    provenanceBody: String(body.provenanceBody ?? DEFAULT_SITE_SETTINGS.provenanceBody).trim(),
    yearsExperience: Math.max(1, Number(body.yearsExperience ?? DEFAULT_SITE_SETTINGS.yearsExperience)),
    feedbacksLabel: String(body.feedbacksLabel ?? DEFAULT_SITE_SETTINGS.feedbacksLabel).trim(),
    ebayUrl: String(body.ebayUrl ?? "").trim(),
    catawikiUrl: String(body.catawikiUrl ?? "").trim(),
    instagramUrl: String(body.instagramUrl ?? "").trim(),
    facebookUrl: String(body.facebookUrl ?? "").trim(),
    contactEmail: String(body.contactEmail ?? DEFAULT_SITE_SETTINGS.contactEmail).trim(),
    trustamiUrl: String(body.trustamiUrl ?? DEFAULT_SITE_SETTINGS.trustamiUrl).trim(),
    trustamiRating: String(body.trustamiRating ?? DEFAULT_SITE_SETTINGS.trustamiRating).trim(),
    trustamiRatings: String(body.trustamiRatings ?? DEFAULT_SITE_SETTINGS.trustamiRatings).trim(),
    whatsappPhone: String(body.whatsappPhone ?? DEFAULT_SITE_SETTINGS.whatsappPhone).trim(),
    provenanceImage: String(body.provenanceImage ?? DEFAULT_SITE_SETTINGS.provenanceImage).trim(),
    heroImage: String(body.heroImage ?? DEFAULT_SITE_SETTINGS.heroImage).trim(),
    // Page texts & photographs: only known keys and correct types survive.
    content: mergeContent(body.content),
    updatedAt: new Date(),
  };

  const existing = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);

  // The hero and provenance blocks are edited from two places (this tab and
  // "Page texts & photos"). Mirror them into the content document so the two
  // editors can never disagree.
  const baseContent = mergeContent(existing[0]?.content);
  values.content = {
    ...baseContent,
    home: {
      ...baseContent.home,
      hero: {
        ...baseContent.home.hero,
        eyebrow: values.heroEyebrow,
        title: values.heroTitle,
        titleItalic: values.heroTitleItalic,
        description: values.heroDescription,
        image: values.heroImage,
      },
      provenance: {
        ...baseContent.home.provenance,
        eyebrow: values.provenanceEyebrow,
        title: values.provenanceTitle,
        titleItalic: values.provenanceTitleItalic,
        body: values.provenanceBody,
        image: values.provenanceImage,
      },
    },
  };

  if (existing.length === 0) {
    const [inserted] = await db
      .insert(siteSettings)
      .values({ id: 1, ...values })
      .returning();
    return Response.json({ settings: inserted });
  }

  const [updated] = await db
    .update(siteSettings)
    .set(values)
    .where(eq(siteSettings.id, 1))
    .returning();

  return Response.json({ settings: updated });
}
