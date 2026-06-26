import type { PostStatus } from "@prisma/client";

export interface WorkspaceStats {
  totalBoards: number;
  totalPosts: number;
  totalVotes: number;
  totalComments: number;
  totalUsers: number;
  newPostsLast30Days: number;
  newUsersLast30Days: number;
  newCommentsLast30Days: number;
  newVotesLast30Days: number;
  // Prior 30-day window (days 30–60 ago) for delta computation (AD-03).
  newPostsPrev30Days: number;
  newUsersPrev30Days: number;
  newCommentsPrev30Days: number;
  newVotesPrev30Days: number;
}

/** One calendar day's activity counts (AD-02, AD-04). */
export interface DailyActivity {
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  posts: number;
  votes: number;
  comments: number;
}

/** Post count for a single PostStatus (AD-05). */
export interface StatusBreakdownItem {
  status: PostStatus;
  count: number;
}

/** A top-voted post for the leaderboard (AD-06, AD-07). */
export interface TopPost {
  id: string;
  postNumber: number;
  title: string;
  voteCount: number;
  board: { slug: string; name: string };
}

/** A board ranked by post count (AD-06). */
export interface TopBoard {
  id: string;
  slug: string;
  name: string;
  postCount: number;
}

/** A recently-joined user (AD-06). */
export interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "ADMIN" | "MEMBER";
  suspendedAt: Date | null;
  emailVerified: Date | null;
  createdAt: Date;
  _count: { posts: number; comments: number };
}

export interface AdminUsersResult {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PendingPost {
  id: string;
  postNumber: number;
  title: string;
  description: string | null;
  guestName: string | null;
  createdAt: Date;
  board: { id: string; slug: string; name: string };
  author: { id: string; name: string | null } | null;
}

export interface AdminPost {
  id: string;
  postNumber: number;
  title: string;
  description: string | null;
  status: PostStatus;
  isPinned: boolean;
  voteCount: number;
  guestName: string | null;
  authorId: string | null;
  createdAt: Date;
  board: { id: string; slug: string; name: string };
  author: { id: string; name: string | null; email: string } | null;
}

export interface AdminPostsResult {
  posts: AdminPost[];
  total: number;
  page: number;
  totalPages: number;
}
