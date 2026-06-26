import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db";
import { mockReset, type DeepMockProxy, type PrismaClient } from "@/tests/helpers/repository-setup";

vi.mock("@/server/db");

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const admin = await import("@/server/repositories/admin");
const { getWorkspaceStats, listAdminUsers, listPendingPosts } = admin;
const { bucketByDay, getActivityTimeseries, getPostStatusBreakdown } = admin;
const { getTopPosts, getTopBoards, getRecentUsers } = admin;

describe("admin repository", () => {
  afterEach(() => {
    mockReset(prismaMock);
  });

  describe("getWorkspaceStats", () => {
    it("returns aggregated workspace statistics", async () => {
      prismaMock.board.count.mockResolvedValue(3);
      prismaMock.post.count.mockResolvedValue(10);
      prismaMock.post.aggregate.mockResolvedValue({ _sum: { voteCount: 42 } } as never);
      prismaMock.comment.count.mockResolvedValue(55);
      prismaMock.user.count.mockResolvedValue(7);
      prismaMock.vote.count.mockResolvedValue(4);

      const stats = await getWorkspaceStats();

      expect(stats.totalBoards).toBe(3);
      expect(stats.totalPosts).toBe(10);
      expect(stats.totalVotes).toBe(42);
      expect(stats.totalComments).toBe(55);
      expect(stats.totalUsers).toBe(7);
      expect(typeof stats.newPostsLast30Days).toBe("number");
      expect(typeof stats.newUsersLast30Days).toBe("number");
      expect(typeof stats.newCommentsLast30Days).toBe("number");
      expect(typeof stats.newVotesLast30Days).toBe("number");
      expect(typeof stats.newPostsPrev30Days).toBe("number");
      expect(typeof stats.newVotesPrev30Days).toBe("number");
    });

    it("returns 0 totalVotes when aggregate sum is null", async () => {
      prismaMock.board.count.mockResolvedValue(0);
      prismaMock.post.count.mockResolvedValue(0);
      prismaMock.post.aggregate.mockResolvedValue({ _sum: { voteCount: null } } as never);
      prismaMock.comment.count.mockResolvedValue(0);
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.vote.count.mockResolvedValue(0);

      const stats = await getWorkspaceStats();
      expect(stats.totalVotes).toBe(0);
    });
  });

  describe("bucketByDay", () => {
    const now = new Date("2026-06-26T12:00:00Z");

    it("zero-fills a contiguous N-day series ending today (UTC)", () => {
      const series = bucketByDay({ posts: [], votes: [], comments: [] }, 30, now);
      expect(series).toHaveLength(30);
      expect(series[0]?.date).toBe("2026-05-28");
      expect(series[29]?.date).toBe("2026-06-26");
      expect(series.every((d) => d.posts === 0 && d.votes === 0 && d.comments === 0)).toBe(true);
    });

    it("maps counts to the correct day and coerces bigint", () => {
      const series = bucketByDay(
        {
          posts: [{ day: new Date("2026-06-26T00:00:00Z"), count: 5n }],
          votes: [{ day: new Date("2026-06-25T00:00:00Z"), count: 3 }],
          comments: [],
        },
        30,
        now,
      );
      expect(series[29]).toMatchObject({ date: "2026-06-26", posts: 5, votes: 0, comments: 0 });
      expect(series[28]).toMatchObject({ date: "2026-06-25", votes: 3 });
    });

    it("ignores rows outside the window", () => {
      const series = bucketByDay(
        { posts: [{ day: new Date("2026-01-01T00:00:00Z"), count: 99 }], votes: [], comments: [] },
        7,
        now,
      );
      expect(series).toHaveLength(7);
      expect(series.some((d) => d.posts === 99)).toBe(false);
    });
  });

  describe("getActivityTimeseries", () => {
    it("runs three per-day queries and returns a zero-filled series", async () => {
      prismaMock.$queryRaw.mockResolvedValue([] as never);

      const series = await getActivityTimeseries(14);

      expect(series).toHaveLength(14);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
    });
  });

  describe("getPostStatusBreakdown", () => {
    it("maps groupBy rows to status/count items", async () => {
      // groupBy is an overloaded signature; the deep mock does not surface
      // mockResolvedValue on its type, so cast to a plain mock to set the return.
      vi.mocked(prismaMock.post.groupBy as unknown as () => Promise<unknown>).mockResolvedValue([
        { status: "OPEN", _count: { _all: 4 } },
        { status: "SHIPPED", _count: { _all: 2 } },
      ]);

      const items = await getPostStatusBreakdown();

      expect(items).toEqual([
        { status: "OPEN", count: 4 },
        { status: "SHIPPED", count: 2 },
      ]);
    });
  });

  describe("getTopPosts", () => {
    it("excludes PENDING and CLOSED and orders by voteCount desc", async () => {
      prismaMock.post.findMany.mockResolvedValue([] as never);

      await getTopPosts(5);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { notIn: ["PENDING", "CLOSED"] } },
          orderBy: { voteCount: "desc" },
          take: 5,
        }),
      );
    });
  });

  describe("getTopBoards", () => {
    it("maps board _count.posts into postCount", async () => {
      prismaMock.board.findMany.mockResolvedValue([
        { id: "b1", slug: "feedback", name: "Feedback", _count: { posts: 12 } },
      ] as never);

      const boards = await getTopBoards(5);

      expect(boards).toEqual([{ id: "b1", slug: "feedback", name: "Feedback", postCount: 12 }]);
      expect(prismaMock.board.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { posts: { _count: "desc" } }, take: 5 }),
      );
    });
  });

  describe("getRecentUsers", () => {
    it("returns newest users ordered by createdAt desc", async () => {
      prismaMock.user.findMany.mockResolvedValue([] as never);

      await getRecentUsers(5);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 5 }),
      );
    });
  });

  describe("listAdminUsers", () => {
    const mockUser = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      image: null,
      role: "MEMBER",
      suspendedAt: null,
      emailVerified: null,
      createdAt: new Date(),
      _count: { posts: 2, comments: 5 },
    };

    it("returns paginated users with totals", async () => {
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);
      prismaMock.user.count.mockResolvedValue(1);

      const result = await listAdminUsers({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("passes search filter to query", async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await listAdminUsers({ page: 1, limit: 20, search: "alice" });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it("skips correctly for page 2", async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await listAdminUsers({ page: 2, limit: 10 });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe("listPendingPosts", () => {
    it("returns only PENDING posts ordered by createdAt", async () => {
      const mockPost = {
        id: "post-1",
        postNumber: 1,
        title: "Test post",
        description: null,
        createdAt: new Date(),
        board: { id: "board-1", slug: "feedback", name: "Feedback" },
        author: null,
      };
      prismaMock.post.findMany.mockResolvedValue([mockPost] as never);

      const posts = await listPendingPosts();

      expect(posts).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
        }),
      );
    });
  });
});
