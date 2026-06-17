"use client";

import { useState } from "react";

import { api } from "@/lib/trpc";
import type { PublicCommentView } from "@/types/comment";

interface Props {
  comment: PublicCommentView;
  callerId?: string;
  isAdmin?: boolean;
  onDeleted: (id: string) => void;
}

export function CommentCard({ comment, callerId, isAdmin, onDeleted }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editError, setEditError] = useState<string | null>(null);

  const utils = api.useUtils();

  const canEdit = isAdmin || (!!callerId && callerId === comment.author?.id);

  const updateMutation = api.comments.update.useMutation({
    onSuccess() {
      setIsEditing(false);
      setEditError(null);
      void utils.comments.list.invalidate({ postId: comment.postId });
    },
    onError(err) {
      setEditError(err.message);
    },
  });

  const deleteMutation = api.comments.delete.useMutation({
    onSuccess() {
      onDeleted(comment.id);
    },
  });

  const authorLabel =
    comment.author?.name ?? comment.guestName ?? "Anonymous";

  const formattedDate = new Date(comment.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (isEditing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {editError && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {editError}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            onClick={() =>
              updateMutation.mutate({ id: comment.id, body: editBody })
            }
            disabled={updateMutation.isPending || !editBody.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditBody(comment.body);
              setEditError(null);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{authorLabel}</span>
            {" · "}
            {formattedDate}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.body}</p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Edit
            </button>
            <button
              onClick={() => deleteMutation.mutate({ id: comment.id })}
              disabled={deleteMutation.isPending}
              className="rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteMutation.isPending ? "…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
