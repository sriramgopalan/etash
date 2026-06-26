import { Prisma, type PostStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import type {
  AdminPostsResult,
  AdminUsersResult,
  DailyActivity,
  PendingPost,
  RecentUser,
  StatusBreakdownItem,
  TopBoard,
  TopPost,
  WorkspaceStats,
} from "@/types/admin";

export type { AdminPost, AdminPostsResult, AdminUser, AdminUsersResult, PendingPost, WorkspaceStats } from "@/types/admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * DAY_MS;

export async function getWorkspaceStats(): Promise<WorkspaceStats> {
  const now = Date.now();
  const since = new Date(now - THIRTY_DAYS_MS);
  const priorSince = new Date(now - 2 * THIRTY_DAYS_MS);
  const last30 = { createdAt: { gte: since } };
  const prev30 = { createdAt: { gte: priorSince, lt: since } };

  const [
    totalBoards,
    totalPosts,
    voteAggregate,
    totalComments,
    totalUsers,
    newPostsLast30Days,
    newUsersLast30Days,
    newCommentsLast30Days,
    newVotesLast30Days,
    newPostsPrev30Days,
    newUsersPrev30Days,
    newCommentsPrev30Days,
    newVotesPrev30Days,
  ] = await Promise.all([
    prisma.board.count(),
    prisma.post.count(),
    prisma.post.aggregate({ _sum: { voteCount: true } }),
    prisma.comment.count(),
    prisma.user.count(),
    prisma.post.count({ where: last30 }),
    prisma.user.count({ where: last30 }),
    prisma.comment.count({ where: last30 }),
    prisma.vote.count({ where: last30 }),
    prisma.post.count({ where: prev30 }),
    prisma.user.count({ where: prev30 }),
    prisma.comment.count({ where: prev30 }),
    prisma.vote.count({ where: prev30 }),
  ]);

  return {
    totalBoards,
    totalPosts,
    totalVotes: voteAggregate._sum.voteCount ?? 0,
    totalComments,
    totalUsers,
    newPostsLast30Days,
    newUsersLast30Days,
    newCommentsLast30Days,
    newVotesLast30Days,
    newPostsPrev30Days,
    newUsersPrev30Days,
    newCommentsPrev30Days,
    newVotesPrev30Days,
  };
}

/** One row from the per-day count queries (UTC day → count). */
interface DayCountRow {
  day: Date;
  count: bigint | number;
}

/**
 * Zero-fill a set of per-day count rows into a contiguous `days`-length series
 * ending today (UTC). Pure and unit-tested.
 */
export function bucketByDay(
  rows: { posts: DayCountRow[]; votes: DayCountRow[]; comments: DayCountRow[] },
  days: number,
  now: Date = new Date(),
): DailyActivity[] {
  const index = (input: DayCountRow[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of input) {
      map.set(toUtcDateKey(row.day), Number(row.count));
    }
    return map;
  };
  const posts = index(rows.posts);
  const votes = index(rows.votes);
  const comments = index(rows.comments);

  const series: DailyActivity[] = [];
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const key = toUtcDateKey(new Date(todayUtc - i * DAY_MS));
    series.push({
      date: key,
      posts: posts.get(key) ?? 0,
      votes: votes.get(key) ?? 0,
      comments: comments.get(key) ?? 0,
    });
  }
  return series;
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Daily activity buckets for posts, votes, and comments over the last `days` days (AD-04). */
export async function getActivityTimeseries(days = 30): Promise<DailyActivity[]> {
  const since = new Date(Date.now() - days * DAY_MS);

  const perDay = (table: Prisma.Sql) => prisma.$queryRaw<DayCountRow[]>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
    FROM ${table}
    WHERE "createdAt" >= ${since}
    GROUP BY day
  `;

  const [posts, votes, comments] = await Promise.all([
    perDay(Prisma.sql`"Post"`),
    perDay(Prisma.sql`"Vote"`),
    perDay(Prisma.sql`"Comment"`),
  ]);

  return bucketByDay({ posts, votes, comments }, days);
}

/** Count of posts in each PostStatus (AD-05). */
export async function getPostStatusBreakdown(): Promise<StatusBreakdownItem[]> {
  const rows = await prisma.post.groupBy({ by: ["status"], _count: { _all: true } });
  return rows.map((r) => ({ status: r.status, count: r._count._all }));
}

/** Top-voted posts, excluding PENDING and CLOSED (AD-06, AD-07). */
export async function getTopPosts(limit = 5): Promise<TopPost[]> {
  const posts = await prisma.post.findMany({
    where: { status: { notIn: ["PENDING", "CLOSED"] } },
    select: {
      id: true,
      postNumber: true,
      title: true,
      voteCount: true,
      board: { select: { slug: true, name: true } },
    },
    orderBy: { voteCount: "desc" },
    take: limit,
  });
  return posts;
}

/** Boards ranked by post count (AD-06). */
export async function getTopBoards(limit = 5): Promise<TopBoard[]> {
  const boards = await prisma.board.findMany({
    select: { id: true, slug: true, name: true, _count: { select: { posts: true } } },
    orderBy: { posts: { _count: "desc" } },
    take: limit,
  });
  return boards.map((b) => ({ id: b.id, slug: b.slug, name: b.name, postCount: b._count.posts }));
}

/** Most recently joined users (AD-06). */
export async function getRecentUsers(limit = 5): Promise<RecentUser[]> {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listAdminUsers({
  page,
  limit,
  search,
}: {
  page: number;
  limit: number;
  search?: string;
}): Promise<AdminUsersResult> {
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        suspendedAt: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPendingPostCount(): Promise<number> {
  return prisma.post.count({ where: { status: "PENDING" } });
}

export async function listAllPosts({
  status,
  boardId,
  page = 1,
  limit = 20,
}: {
  status?: PostStatus;
  boardId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AdminPostsResult> {
  const where = {
    ...(status !== undefined ? { status } : {}),
    ...(boardId !== undefined ? { boardId } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        postNumber: true,
        title: true,
        description: true,
        status: true,
        isPinned: true,
        voteCount: true,
        guestName: true,
        authorId: true,
        createdAt: true,
        board: { select: { id: true, slug: true, name: true } },
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, total, page, totalPages: Math.ceil(total / limit) };
}

export async function listPendingPosts(): Promise<PendingPost[]> {
  return prisma.post.findMany({
    where: { status: "PENDING" },
    select: {
      id: true,
      postNumber: true,
      title: true,
      description: true,
      guestName: true,
      createdAt: true,
      board: { select: { id: true, slug: true, name: true } },
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
