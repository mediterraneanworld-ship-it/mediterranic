/** Shared validation; NULL identifies comments already public before moderation existed. */
export const REVIEW_MODERATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewModerationStatus = typeof REVIEW_MODERATION_STATUSES[number];

export function isReviewModerationStatus(value: unknown): value is ReviewModerationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function reviewModerationStatus(value: unknown): ReviewModerationStatus {
  if (value === null || value === undefined) return "approved";
  return isReviewModerationStatus(value) ? value : "pending";
}

export function isPublicReview(value: unknown): boolean {
  return value === null || value === undefined || value === "approved";
}
