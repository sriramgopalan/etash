import type { PostStatus } from "@/types/post";

const STATUS_LABELS: Record<PostStatus, string> = {
  PENDING: "Pending",
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  SHIPPED: "Shipped",
  CLOSED: "Closed",
};

const STATUS_CLASSES: Record<PostStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  OPEN: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-purple-50 text-purple-700",
  PLANNED: "bg-indigo-50 text-indigo-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  SHIPPED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

interface Props {
  status: PostStatus;
}

export function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
