import type { RecentUser } from "@/types/admin";

interface Props {
  users: RecentUser[];
}

/** Compact list of the most recent signups (AD-06). */
export function RecentSignups({ users }: Props) {
  if (users.length === 0) {
    return <p className="text-sm text-gray-400">No users yet.</p>;
  }

  return (
    <ul className="divide-y divide-gray-50" role="list">
      {users.map((user) => (
        <li key={user.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{user.name ?? "Unnamed user"}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <time
            dateTime={user.createdAt.toISOString()}
            className="shrink-0 text-xs text-gray-400"
          >
            {user.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </time>
        </li>
      ))}
    </ul>
  );
}
