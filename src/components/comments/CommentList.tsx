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
  const [extraComments, setExtraComments] = useState<PublicCommentView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading, error } = api.comments.list.useQuery({ postId, limit: 20 });

  // Sync cursor and reset accumulated pages whenever the first page refreshes
  useEffect(() => {
    if (data) {
      setExtraComments([]);
      setNextCursor(data.nextCursor);
      setDeletedIds(new Set());
    }
  }, [data]);

  const firstPage = (data?.items ?? []) as PublicCommentView[];
  const allComments = [...firstPage, ...extraComments].filter((c) => !deletedIds.has(c.id));

  function handleDeleted(id: string) {
    setDeletedIds((prev) => new Set([...prev, id]));
  }

  function handleCommentCreated() {
    setExtraComments([]);
    setNextCursor(null);
    setDeletedIds(new Set());
    void utils.comments.list.invalidate({ postId });
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await utils.comments.list.fetch({ postId, limit: 20, cursor: nextCursor });
      setExtraComments((prev) => [...prev, ...(result.items as PublicCommentView[])]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

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
      {allComments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-3">
          {allComments.map((comment) => (
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

      {nextCursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more comments"}
          </button>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Leave a comment</h3>
        <CommentForm postId={postId} isSignedIn={isSignedIn} onSuccess={handleCommentCreated} />
      </div>
    </div>
  );
}
