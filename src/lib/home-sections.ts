/** Canonical names shared by the storefront, the back-office and the handover docs. */
export const HOME_SECTIONS = [
  { id: "h0", number: "H0", label: "Top Bar", fixed: "top" },
  { id: "h1", number: "H1", label: "Header", fixed: "top" },
  { id: "h2", number: "H2", label: "Hero", fixed: null },
  { id: "h3", number: "H3", label: "Hero Stats", fixed: null },
  { id: "h4", number: "H4", label: "Trust Strip", fixed: null },
  { id: "h5", number: "H5", label: "Channels", fixed: null },
  { id: "h6", number: "H6", label: "Collections", fixed: null },
  { id: "h7", number: "H7", label: "Featured", fixed: null },
  { id: "h8", number: "H8", label: "Provenance", fixed: null },
  { id: "h9", number: "H9", label: "Marketplaces", fixed: null },
  { id: "h10", number: "H10", label: "Reviews", fixed: null },
  { id: "h11", number: "H11", label: "Links", fixed: null },
  { id: "h12", number: "H12", label: "Closing", fixed: null },
  { id: "h13", number: "H13", label: "Footer", fixed: "bottom" },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]["id"];
export type MovableHomeSectionId = Exclude<HomeSectionId, "h0" | "h1" | "h13">;

export const DEFAULT_HOME_ORDER: HomeSectionId[] = HOME_SECTIONS.map((section) => section.id);
export const MOVABLE_HOME_SECTIONS = DEFAULT_HOME_ORDER.filter(
  (id): id is MovableHomeSectionId => id !== "h0" && id !== "h1" && id !== "h13",
);

const VALID_IDS = new Set<string>(DEFAULT_HOME_ORDER);

/**
 * Stored layout is additive and defensive: unknown IDs are ignored, duplicates
 * collapse, and sections introduced by a later deploy are appended. H0/H1 and
 * H13 always remain the global header and footer.
 */
export function normalizeHomeOrder(value: unknown): HomeSectionId[] {
  const requested = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  const middle = requested.filter(
    (id, index): id is MovableHomeSectionId =>
      MOVABLE_HOME_SECTIONS.includes(id as MovableHomeSectionId) && requested.indexOf(id) === index,
  );
  for (const id of MOVABLE_HOME_SECTIONS) if (!middle.includes(id)) middle.push(id);
  return ["h0", "h1", ...middle, "h13"];
}

export function isRenderableHomeSection(id: HomeSectionId): id is MovableHomeSectionId {
  return VALID_IDS.has(id) && id !== "h0" && id !== "h1" && id !== "h13";
}

/** Move before the target, used by drag-and-drop and by the accessible arrows. */
export function moveHomeSection(order: unknown, id: HomeSectionId, targetId: HomeSectionId): HomeSectionId[] {
  const current = normalizeHomeOrder(order);
  if (!isRenderableHomeSection(id) || !isRenderableHomeSection(targetId) || id === targetId) return current;
  const middle = current.filter(isRenderableHomeSection).filter((item) => item !== id);
  const targetIndex = middle.indexOf(targetId);
  middle.splice(targetIndex < 0 ? middle.length : targetIndex, 0, id);
  return normalizeHomeOrder(middle);
}

export function moveHomeSectionBy(order: unknown, id: HomeSectionId, delta: -1 | 1): HomeSectionId[] {
  const current = normalizeHomeOrder(order);
  if (!isRenderableHomeSection(id)) return current;
  const middle = current.filter(isRenderableHomeSection);
  const from = middle.indexOf(id);
  const to = Math.max(0, Math.min(middle.length - 1, from + delta));
  if (from === to) return current;
  middle.splice(from, 1);
  middle.splice(to, 0, id);
  return normalizeHomeOrder(middle);
}
