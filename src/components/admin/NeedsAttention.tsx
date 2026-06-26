import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Props {
  pendingPosts: number;
}

/** Surfaces items awaiting an admin action. v1: posts pending moderation (AD-08). */
export function NeedsAttention({ pendingPosts }: Props) {
  if (pendingPosts <= 0) return null;

  return (
    <Link
      href="/admin/posts?status=PENDING"
      className="mb-8 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="flex-1">
        <strong className="font-semibold">
          {pendingPosts} {pendingPosts === 1 ? "post" : "posts"}
        </strong>{" "}
        awaiting review
      </span>
      <span className="flex items-center gap-1 font-medium">
        Review
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
