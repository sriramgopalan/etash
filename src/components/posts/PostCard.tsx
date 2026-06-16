import { Pin } from "lucide-react";
import Link from "next/link";

import type { PostListItem } from "@/types/post";

import { StatusBadge } from "./StatusBadge";
import { VoteButton } from "./VoteButton";

interface Props {
  post: PostListItem;
  boardSlug: string;
}

export function PostCard({ post, boardSlug }: Props) {
  return (
    <article
      className={`flex gap-4 rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
        post.isPinned ? "border-blue-200" : "border-gray-200"
      }`}
    >
      <VoteButton
        postId={post.id}
        initialVoteCount={post.voteCount}
        initialHasVoted={post.hasVoted}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {post.isPinned && (
            <Pin
              className="h-4 w-4 fill-blue-500 text-blue-500"
              aria-label="Pinned"
            />
          )}
          <Link
            href={`/boards/${boardSlug}/posts/${post.postNumber}`}
            className="truncate font-semibold text-gray-900 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {post.title}
          </Link>
          <StatusBadge status={post.status} />
        </div>

        {post.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">{post.description}</p>
        )}

        <p className="mt-2 text-xs text-gray-400">
          #{post.postNumber} · {new Date(post.createdAt).toLocaleDateString()}
          {post.author?.name && ` · ${post.author.name}`}
          {!post.author && post.guestName && ` · ${post.guestName}`}
        </p>
      </div>
    </article>
  );
}
