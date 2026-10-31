/**
 * Extracts SmugMug images in exactly the order in which the gallery presents
 * them. This handles both the original HTML (where an image may occur many
 * times at different sizes) and Jina's Markdown (where every photo is a link).
 *
 * The gallery thumbnail URLs are real photo URLs, not the icons of the page.
 * We leave their signed URL intact — SmugMug rejects arbitrary size changes.
 */

/** One signed image URL per gallery item; no logo, spacer or duplicate image. */
export function smugmugGalleryImages(text: string): string[] {
  const decoded = text
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&");

  const matches = decoded.matchAll(
    /https:\/\/(?:photos|cdn)\.smugmug\.com\/[^\s"'<>()[\]\\]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>()[\]\\]*)?/gi,
  );

  const images: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const src = match[0];
    if (/\b(?:spacer|logo|watermark|icon|avatar|blank)\b/i.test(src)) continue;

    const id = src.match(/\/(i-[a-z0-9]+)(?:\/|$)/i)?.[1] ?? src;
    if (seen.has(id)) continue;
    seen.add(id);
    images.push(src);
  }

  return images;
}

/** The editor must never replace its existing photos with a single og:image. */
export function firstGalleryPhotos(text: string, count = 3): string[] {
  return smugmugGalleryImages(text).slice(0, Math.max(0, count));
}

export function galleryPhotoLabel(index: number): string {
  return ["Full specimen", "Second view", "Third view"][index] ?? `View ${index + 1}`;
}
