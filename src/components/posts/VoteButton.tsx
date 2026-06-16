"use client";

import { ChevronUp } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/trpc";

interface Props {
  postId: string;
  initialVoteCount: number;
  initialHasVoted: boolean;
}

export function VoteButton({ postId, initialVoteCount, initialHasVoted }: Props) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);

  const toggleVote = api.posts.toggleVote.useMutation({
    onSuccess(data) {
      setVoteCount(data.voteCount);
      setHasVoted(data.userHasVoted);
    },
  });

  function handleClick() {
    toggleVote.mutate({ postId });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggleVote.isPending}
      aria-label={hasVoted ? "Remove vote" : "Vote for this post"}
      aria-pressed={hasVoted}
      className={`flex w-14 flex-col items-center rounded-lg border px-2 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        hasVoted
          ? "border-blue-200 bg-blue-50 text-blue-600"
          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <ChevronUp className="h-4 w-4" aria-hidden="true" />
      <span className="text-base font-bold leading-tight">{voteCount}</span>
    </button>
  );
}
