"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/trpc";
import type { PostStatus } from "@/types/post";

const STATUS_OPTIONS: { value: Exclude<PostStatus, "PENDING">; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "CLOSED", label: "Closed" },
];

interface Props {
  postId: string;
  status: PostStatus;
  isPinned: boolean;
}

export function AdminPostActions({ postId, status, isPinned }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(
    null,
  );

  function flash(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2000);
  }

  const setStatus = api.posts.setStatus.useMutation({
    onSuccess: () => {
      flash("success", "Saved");
      router.refresh();
    },
    onError: (e) => flash("error", e.message),
  });

  const setPin = api.posts.setPin.useMutation({
    onSuccess: () => {
      flash("success", "Saved");
      router.refresh();
    },
    onError: (e) => flash("error", e.message),
  });

  const isPending = setStatus.isPending || setPin.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label
          htmlFor="admin-post-status"
          className="w-14 shrink-0 text-xs font-medium text-gray-500"
        >
          Status
        </label>
        <select
          id="admin-post-status"
          defaultValue={status === "PENDING" ? undefined : status}
          onChange={(e) =>
            setStatus.mutate({
              id: postId,
              status: e.target.value as Exclude<PostStatus, "PENDING">,
            })
          }
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          {status === "PENDING" && (
            <option value="PENDING" disabled>
              Pending (moderation)
            </option>
          )}
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-xs font-medium text-gray-500">Pin</span>
        <button
          type="button"
          onClick={() => setPin.mutate({ id: postId, pinned: !isPinned })}
          disabled={isPending}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            isPinned
              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {isPinned ? "Unpin" : "Pin to top"}
        </button>
      </div>

      {feedback && (
        <p
          className={`text-sm font-medium ${
            feedback.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {feedback.msg}
        </p>
      )}
    </div>
  );
}
