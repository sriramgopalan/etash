import type { StatusBreakdownItem } from "@/types/admin";
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

// Saturated fills from the same hue families as StatusBadge (src/components/posts/StatusBadge.tsx).
const STATUS_FILLS: Record<PostStatus, string> = {
  PENDING: "bg-gray-400",
  OPEN: "bg-blue-500",
  UNDER_REVIEW: "bg-purple-500",
  PLANNED: "bg-indigo-500",
  IN_PROGRESS: "bg-amber-500",
  SHIPPED: "bg-green-500",
  CLOSED: "bg-gray-300",
};

const STATUS_ORDER: PostStatus[] = [
  "PENDING",
  "OPEN",
  "UNDER_REVIEW",
  "PLANNED",
  "IN_PROGRESS",
  "SHIPPED",
  "CLOSED",
];

interface Props {
  items: StatusBreakdownItem[];
}

export function StatusBreakdownBar({ items }: Props) {
  const counts = new Map(items.map((i) => [i.status, i.count]));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  const present = STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0);

  if (total === 0) {
    return <p className="text-sm text-gray-400">No posts yet.</p>;
  }

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={`Posts by status: ${present
          .map((s) => `${STATUS_LABELS[s]} ${counts.get(s)}`)
          .join(", ")}`}
      >
        {present.map((status) => (
          <div
            key={status}
            className={STATUS_FILLS[status]}
            style={{ width: `${((counts.get(status) ?? 0) / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {present.map((status) => (
          <li key={status} className="flex items-center gap-2 text-gray-600">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_FILLS[status]}`} aria-hidden="true" />
            <span>{STATUS_LABELS[status]}</span>
            <span className="ml-auto font-medium text-gray-900">{counts.get(status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
