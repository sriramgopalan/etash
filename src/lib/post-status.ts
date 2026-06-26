import type { PostStatus } from "@/types/post";

/** Human-readable labels for each post status, shared across status UIs. */
export const STATUS_LABELS: Record<PostStatus, string> = {
  PENDING: "Pending",
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  SHIPPED: "Shipped",
  CLOSED: "Closed",
};
