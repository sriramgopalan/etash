import Link from "next/link";

export interface TopListItem {
  id: string;
  label: string;
  sublabel?: string;
  href?: string;
  metric: string;
}

interface Props {
  items: TopListItem[];
  /** Shown when there are no items. */
  emptyMessage: string;
}

/** A compact ranked leaderboard list (reused for top posts and top boards). */
export function TopList({ items, emptyMessage }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-gray-50" role="list">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            {item.href ? (
              <Link
                href={item.href}
                className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {item.label}
              </Link>
            ) : (
              <p className="truncate text-sm font-medium text-gray-900">{item.label}</p>
            )}
            {item.sublabel && <p className="truncate text-xs text-gray-500">{item.sublabel}</p>}
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700">
            {item.metric}
          </span>
        </li>
      ))}
    </ul>
  );
}
