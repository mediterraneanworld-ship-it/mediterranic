/**
 * Home page testimonials ("From collectors who have been where you are").
 * The curator chooses the reviews. These are the pure rules; the database
 * reads and writes live in catalog.ts and in the admin review API.
 */

/** The home page shows at most this many chosen reviews. */
export const HOME_REVIEW_LIMIT = 6;

/** With nothing chosen, the home keeps its automatic rule: the newest 5-star public reviews. */
export const HOME_REVIEW_AUTOMATIC = 3;

export type HomePickDecision = { ok: true; showOnHome: boolean } | { ok: false; error: string };

/**
 * Whether a review may be placed on, or removed from, the home page.
 * Only public reviews can be placed there, and never more than HOME_REVIEW_LIMIT.
 * Removing a review is always allowed.
 */
export function decideHomePick(input: {
  requested: boolean;
  publicNow: boolean;
  alreadyPicked: boolean;
  pickedElsewhere: number;
}): HomePickDecision {
  if (!input.requested) return { ok: true, showOnHome: false };
  if (!input.publicNow) {
    return { ok: false, error: "Publish this review before showing it on the home page." };
  }
  if (input.alreadyPicked) return { ok: true, showOnHome: true };
  if (input.pickedElsewhere >= HOME_REVIEW_LIMIT) {
    return { ok: false, error: `The home page shows up to ${HOME_REVIEW_LIMIT} reviews. Remove one first.` };
  }
  return { ok: true, showOnHome: true };
}

/** A review keeps its place on the home page only while it stays public (approved). */
export function homePickSurvivesStatus(status: "pending" | "approved" | "rejected"): boolean {
  return status === "approved";
}
