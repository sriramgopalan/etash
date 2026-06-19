"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/trpc";
import type { PostStatus } from "@/types/post";

const LOCKED_STATUSES: PostStatus[] = ["SHIPPED", "CLOSED"];

interface Props {
  postId: string;
  initialTitle: string;
  initialDescription: string | null;
  status: PostStatus;
  isAdmin: boolean;
}

export function EditPostForm({
  postId,
  initialTitle,
  initialDescription,
  status,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);

  const isLocked = !isAdmin && LOCKED_STATUSES.includes(status);

  const update = api.posts.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      setError(null);
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  if (isLocked) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        Edit
      </button>
    );
  }

  function handleCancel() {
    setEditing(false);
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 5) {
      setError("Title must be at least 5 characters.");
      return;
    }
    update.mutate({
      id: postId,
      title: trimmedTitle,
      description: description.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Edit post</p>

      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          placeholder="Post title"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p
          className={`mt-0.5 text-right text-xs ${
            title.length > 140 ? "text-orange-500" : "text-gray-400"
          }`}
        >
          {title.length}/150
        </p>
      </div>

      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Description (optional)"
          className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p
          className={`mt-0.5 text-right text-xs ${
            description.length > 1900 ? "text-orange-500" : "text-gray-400"
          }`}
        >
          {description.length}/2000
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
