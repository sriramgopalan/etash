"use client";

import { useState } from "react";

import { api } from "@/lib/trpc";

interface Props {
  postId: string;
  isSignedIn: boolean;
  onSuccess: () => void;
}

export function CommentForm({ postId, isSignedIn, onSuccess }: Props) {
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = api.comments.create.useMutation({
    onSuccess() {
      setBody("");
      setGuestName("");
      setError(null);
      onSuccess();
    },
    onError(err) {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate({
      postId,
      body,
      guestName: isSignedIn ? undefined : guestName || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {!isSignedIn && (
        <div>
          <label htmlFor="comment-guest-name" className="mb-1 block text-sm font-medium text-gray-700">
            Your name
          </label>
          <input
            id="comment-guest-name"
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            maxLength={50}
            placeholder="Enter your name"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label htmlFor="comment-body" className="mb-1 block text-sm font-medium text-gray-700">
          Comment
        </label>
        <textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Write a comment…"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-right text-xs text-gray-400">{body.length}/2000</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={createMutation.isPending || !body.trim()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createMutation.isPending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
