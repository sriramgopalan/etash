"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/trpc";
import type { PublicCommentView } from "@/types/comment";

import { CommentCard } from "./CommentCard";
import { CommentForm } from "./CommentForm";

interface Props {
  postId: string;
  callerId?: string;
  isAdmin?: boolean;
  isSignedIn: boolean;
}

export function CommentList({ postId, callerId, isAdmin, isSignedIn }: Props) {
  const utils = api.useUtils();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = api.comments.list.useQuery({ postId, limit: 50 });

  const comments = ((data?.items ?? []) as PublicCommentView[]).filter(
    (c) => !deletedIds.has(c.id),
  );

  function handleDeleted(id: string) {
    setDeletedIds((prev) => new Set([...prev, id]));
  }

  function handleCommentCreated() {
    setDeletedIds(new Set());
    void utils.comments.list.invalidate({ postId });
  }

  // Reset deletedIds when data refreshes (invalidation-triggered refetch)
  useEffect(() => {
    setDeletedIds(new Set());
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Could not load comments. Please refresh the page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              callerId={callerId}
              isAdmin={isAdmin}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Leave a comment</h3>
        <CommentForm postId={postId} isSignedIn={isSignedIn} onSuccess={handleCommentCreated} />
      </div>
    </div>
  );
}
