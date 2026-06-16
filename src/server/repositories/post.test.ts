import { PostStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redis } from "@/lib/redis";
import { prisma } from "@/server/db";
import { mockReset, type DeepMockProxy, type PrismaClient } from "@/tests/helpers/repository-setup";

vi.mock("@/server/db");
vi.mock("@/lib/redis");

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const redisMock = redis as unknown as {
  exists: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  mget: ReturnType<typeof vi.fn>;
};

const {
  createPost,
  deletePost,
  getPostById,
  getSimilarPosts,
  hashIp,
  listPosts,
  setPostPin,
  setPostStatus,
  toggleVote,
  updatePost,
} = await import("@/server/repositories/post");

const BOARD_ID = "cboard1234567890";
const POST_ID = "cpost12345678901";
const USER_ID = "cuser12345678901";

const BASE_POST = {
  id: POST_ID,
  postNumber: 1,
  boardId: BOARD_ID,
  authorId: USER_ID,
  guestName: null,
  title: "My feature request",
  description: "Please add this",
  status: PostStatus.OPEN,
  isPinned: false,
  pinnedAt: null,
  voteCount: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  author: { id: USER_ID, name: "Alice", email: "alice@example.com" },
};

describe("post repository", () => {
  afterEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // hashIp
  // ---------------------------------------------------------------------------

  describe("hashIp", () => {
    it("returns a 64-char hex string", () => {
      const h = hashIp("1.2.3.4");
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]+$/);
    });

    it("produces same hash for same input", () => {
      expect(hashIp("10.0.0.1")).toBe(hashIp("10.0.0.1"));
    });

    it("produces different hashes for different IPs", () => {
      expect(hashIp("1.1.1.1")).not.toBe(hashIp("2.2.2.2"));
    });
  });

  // ---------------------------------------------------------------------------
  // createPost
  // ---------------------------------------------------------------------------

  describe("createPost", () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation(
        ((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) as never,
      );
      prismaMock.post.aggregate.mockResolvedValue({ _max: { postNumber: null } } as never);
    });

    it("creates post with postNumber 1 when board is empty", async () => {
      prismaMock.post.create.mockResolvedValue({ id: POST_ID, postNumber: 1 } as never);
      const result = await createPost({
        boardId: BOARD_ID,
        authorId: USER_ID,
        guestName: null,
        title: "Test",
        description: null,
        initialStatus: PostStatus.OPEN,
      });
      expect(result.postNumber).toBe(1);
      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ postNumber: 1 }) }),
      );
    });

    it("increments postNumber by 1", async () => {
      prismaMock.post.aggregate.mockResolvedValue({ _max: { postNumber: 5 } } as never);
      prismaMock.post.create.mockResolvedValue({ id: POST_ID, postNumber: 6 } as never);
      const result = await createPost({
        boardId: BOARD_ID,
        authorId: null,
        guestName: "Guest",
        title: "Guest post",
        description: null,
        initialStatus: PostStatus.PENDING,
      });
      expect(result.postNumber).toBe(6);
    });

    it("sets PENDING status when moderation enabled", async () => {
      prismaMock.post.create.mockResolvedValue({ id: POST_ID, postNumber: 1 } as never);
      await createPost({
        boardId: BOARD_ID,
        authorId: USER_ID,
        guestName: null,
        title: "Moderated post",
        description: null,
        initialStatus: PostStatus.PENDING,
      });
      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PostStatus.PENDING }),
        }),
      );
    });

    it("throws CONFLICT AppError on P2002", async () => {
      const { Prisma } = await import("@prisma/client");
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      prismaMock.post.create.mockRejectedValue(p2002);
      await expect(
        createPost({
          boardId: BOARD_ID,
          authorId: USER_ID,
          guestName: null,
          title: "Test",
          description: null,
          initialStatus: PostStatus.OPEN,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  // ---------------------------------------------------------------------------
  // getPostById
  // ---------------------------------------------------------------------------

  describe("getPostById", () => {
    it("returns admin view to admin", async () => {
      prismaMock.post.findUnique.mockResolvedValue(BASE_POST as never);
      prismaMock.vote.findMany.mockResolvedValue([]);
      const result = await getPostById(POST_ID, { isAdmin: true, callerId: USER_ID });
      expect(result).toMatchObject({ id: POST_ID, authorId: USER_ID });
    });

    it("returns null when post not found", async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);
      const result = await getPostById("notfound", { isAdmin: false });
      expect(result).toBeNull();
    });

    it("returns null for post on private board to non-admin", async () => {
      const publicRow = {
        id: POST_ID, postNumber: 1, boardId: BOARD_ID, guestName: null,
        title: "Test", description: null, status: PostStatus.OPEN,
        isPinned: false, voteCount: 0, createdAt: new Date(),
      };
      prismaMock.post.findUnique.mockResolvedValue(publicRow as never);
      prismaMock.board.findUnique.mockResolvedValue({ isPublic: false } as never);
      const result = await getPostById(POST_ID, { isAdmin: false });
      expect(result).toBeNull();
    });

    it("returns public view without author fields to non-admin", async () => {
      const publicRow = {
        id: POST_ID,
        postNumber: 1,
        boardId: BOARD_ID,
        guestName: null,
        title: "Test",
        description: null,
        status: PostStatus.OPEN,
        isPinned: false,
        voteCount: 5,
        createdAt: new Date(),
      };
      prismaMock.post.findUnique.mockResolvedValue(publicRow as never);
      prismaMock.board.findUnique.mockResolvedValue({ isPublic: true } as never);
      prismaMock.vote.findMany.mockResolvedValue([]);
      const result = await getPostById(POST_ID, { isAdmin: false, callerId: USER_ID });
      expect(result).not.toHaveProperty("authorId");
      expect(result).not.toHaveProperty("author");
    });

    it("returns null for PENDING post when caller is not the author", async () => {
      const pendingRow = {
        id: POST_ID,
        postNumber: 1,
        boardId: BOARD_ID,
        guestName: null,
        title: "Pending",
        description: null,
        status: PostStatus.PENDING,
        isPinned: false,
        voteCount: 0,
        createdAt: new Date(),
      };
      prismaMock.post.findUnique
        .mockResolvedValueOnce(pendingRow as never)
        .mockResolvedValueOnce({ authorId: "different-user" } as never);
      prismaMock.board.findUnique.mockResolvedValue({ isPublic: true } as never);
      const result = await getPostById(POST_ID, { isAdmin: false, callerId: USER_ID });
      expect(result).toBeNull();
    });

    it("sets hasVoted=true when authenticated user has voted", async () => {
      const publicRow = {
        id: POST_ID,
        postNumber: 1,
        boardId: BOARD_ID,
        guestName: null,
        title: "Test",
        description: null,
        status: PostStatus.OPEN,
        isPinned: false,
        voteCount: 3,
        createdAt: new Date(),
      };
      prismaMock.post.findUnique.mockResolvedValue(publicRow as never);
      prismaMock.board.findUnique.mockResolvedValue({ isPublic: true } as never);
      prismaMock.vote.findMany.mockResolvedValue([{ postId: POST_ID }] as never);
      const result = await getPostById(POST_ID, { isAdmin: false, callerId: USER_ID });
      expect(result?.hasVoted).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // updatePost
  // ---------------------------------------------------------------------------

  describe("updatePost", () => {
    it("throws NOT_FOUND when post not found", async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);
      await expect(
        updatePost("notfound", { title: "New" }, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN when non-author tries to update", async () => {
      prismaMock.post.findUnique.mockResolvedValue({
        authorId: "other-user",
        status: PostStatus.OPEN,
        boardId: BOARD_ID,
      } as never);
      await expect(
        updatePost(POST_ID, { title: "New" }, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws VALIDATION_ERROR when author edits SHIPPED post", async () => {
      prismaMock.post.findUnique.mockResolvedValue({
        authorId: USER_ID,
        status: PostStatus.SHIPPED,
        boardId: BOARD_ID,
      } as never);
      await expect(
        updatePost(POST_ID, { title: "New" }, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("allows admin to edit SHIPPED post", async () => {
      prismaMock.post.findUnique.mockResolvedValue({
        authorId: "other-user",
        status: PostStatus.SHIPPED,
        boardId: BOARD_ID,
      } as never);
      prismaMock.post.update.mockResolvedValue({ ...BASE_POST, title: "Admin edit" } as never);
      prismaMock.vote.findMany.mockResolvedValue([]);
      const result = await updatePost(POST_ID, { title: "Admin edit" }, { isAdmin: true, callerId: USER_ID });
      expect(result.title).toBe("Admin edit");
    });

    it("updates title and description", async () => {
      prismaMock.post.findUnique.mockResolvedValue({
        authorId: USER_ID,
        status: PostStatus.OPEN,
        boardId: BOARD_ID,
      } as never);
      prismaMock.post.update.mockResolvedValue({ ...BASE_POST, title: "New title" } as never);
      prismaMock.vote.findMany.mockResolvedValue([]);
      const result = await updatePost(POST_ID, { title: "New title" }, { isAdmin: false, callerId: USER_ID });
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: "New title" }) }),
      );
      expect(result.title).toBe("New title");
    });
  });

  // ---------------------------------------------------------------------------
  // deletePost
  // ---------------------------------------------------------------------------

  describe("deletePost", () => {
    it("deletes votes then post in transaction", async () => {
      prismaMock.$transaction.mockImplementation(
        ((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) as never,
      );
      prismaMock.vote.deleteMany.mockResolvedValue({ count: 3 } as never);
      prismaMock.post.delete.mockResolvedValue({ id: POST_ID } as never);

      const result = await deletePost(POST_ID);
      expect(result.id).toBe(POST_ID);
      expect(result.deletedCounts.votes).toBe(3);
      expect(prismaMock.vote.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { postId: POST_ID } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // setPostStatus
  // ---------------------------------------------------------------------------

  describe("setPostStatus", () => {
    it("returns null when post not found", async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);
      expect(await setPostStatus(POST_ID, PostStatus.PLANNED)).toBeNull();
    });

    it("returns current post without update when status unchanged (no-op)", async () => {
      prismaMock.post.findUnique
        .mockResolvedValueOnce({ status: PostStatus.OPEN } as never)
        .mockResolvedValueOnce({ id: POST_ID, status: PostStatus.OPEN, updatedAt: new Date() } as never);
      const result = await setPostStatus(POST_ID, PostStatus.OPEN);
      expect(prismaMock.post.update).not.toHaveBeenCalled();
      expect(result?.status).toBe(PostStatus.OPEN);
    });

    it("updates status when it changes", async () => {
      prismaMock.post.findUnique.mockResolvedValue({ status: PostStatus.OPEN } as never);
      prismaMock.post.update.mockResolvedValue({
        id: POST_ID,
        status: PostStatus.PLANNED,
        updatedAt: new Date(),
      } as never);
      const result = await setPostStatus(POST_ID, PostStatus.PLANNED);
      expect(result?.status).toBe(PostStatus.PLANNED);
    });
  });

  // ---------------------------------------------------------------------------
  // setPostPin
  // ---------------------------------------------------------------------------

  describe("setPostPin", () => {
    it("returns null when post not found", async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);
      expect(await setPostPin(POST_ID, true)).toBeNull();
    });

    it("no-op when already pinned", async () => {
      prismaMock.post.findUnique
        .mockResolvedValueOnce({ isPinned: true } as never)
        .mockResolvedValueOnce({ id: POST_ID, isPinned: true, pinnedAt: new Date() } as never);
      await setPostPin(POST_ID, true);
      expect(prismaMock.post.update).not.toHaveBeenCalled();
    });

    it("pins a post and sets pinnedAt", async () => {
      prismaMock.post.findUnique.mockResolvedValue({ isPinned: false } as never);
      prismaMock.post.update.mockResolvedValue({
        id: POST_ID,
        isPinned: true,
        pinnedAt: new Date(),
      } as never);
      await setPostPin(POST_ID, true);
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPinned: true, pinnedAt: expect.any(Date) }),
        }),
      );
    });

    it("unpins a post and clears pinnedAt", async () => {
      prismaMock.post.findUnique.mockResolvedValue({ isPinned: true } as never);
      prismaMock.post.update.mockResolvedValue({
        id: POST_ID,
        isPinned: false,
        pinnedAt: null,
      } as never);
      await setPostPin(POST_ID, false);
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPinned: false, pinnedAt: null }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // toggleVote
  // ---------------------------------------------------------------------------

  describe("toggleVote — authenticated", () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation(
        ((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) as never,
      );
    });

    it("creates vote and increments voteCount when not yet voted", async () => {
      prismaMock.vote.findUnique.mockResolvedValue(null);
      prismaMock.vote.create.mockResolvedValue({} as never);
      prismaMock.post.update.mockResolvedValue({ voteCount: 1 } as never);

      const result = await toggleVote(POST_ID, {
        userId: USER_ID,
        hashedIp: undefined,
        boardId: BOARD_ID,
      });
      expect(result.voteCount).toBe(1);
      expect(result.userHasVoted).toBe(true);
    });

    it("deletes vote and decrements voteCount when already voted", async () => {
      prismaMock.vote.findUnique.mockResolvedValue({ id: "vote-1" } as never);
      prismaMock.vote.delete.mockResolvedValue({} as never);
      prismaMock.post.update.mockResolvedValue({ voteCount: 0 } as never);

      const result = await toggleVote(POST_ID, {
        userId: USER_ID,
        hashedIp: undefined,
        boardId: BOARD_ID,
      });
      expect(result.voteCount).toBe(0);
      expect(result.userHasVoted).toBe(false);
    });
  });

  describe("toggleVote — guest", () => {
    it("rejects when Redis key already exists (already voted)", async () => {
      // M1: atomic SET NX returns null when key already exists
      redisMock.set.mockResolvedValue(null);
      await expect(
        toggleVote(POST_ID, {
          userId: undefined,
          hashedIp: hashIp("1.2.3.4"),
          boardId: BOARD_ID,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("creates vote and sets Redis key atomically when not yet voted", async () => {
      // M1: atomic SET NX returns "OK" when key is newly acquired
      redisMock.set.mockResolvedValue("OK");
      prismaMock.$transaction.mockImplementation(
        ((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) as never,
      );
      prismaMock.vote.create.mockResolvedValue({} as never);
      prismaMock.post.update.mockResolvedValue({ voteCount: 1 } as never);

      const result = await toggleVote(POST_ID, {
        userId: undefined,
        hashedIp: hashIp("1.2.3.4"),
        boardId: BOARD_ID,
      });
      expect(result.voteCount).toBe(1);
      expect(result.userHasVoted).toBe(false);
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining("vote:guest:"),
        "1",
        "EX",
        2592000,
        "NX",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listPosts
  // ---------------------------------------------------------------------------

  describe("listPosts", () => {
    it("returns items and null nextCursor when fewer than limit+1", async () => {
      prismaMock.post.findMany.mockResolvedValue([BASE_POST] as never);
      prismaMock.vote.findMany.mockResolvedValue([]);

      const result = await listPosts({ boardId: BOARD_ID, isAdmin: false });
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor when more items exist", async () => {
      // Return limit+1 items to signal more pages
      const posts = Array.from({ length: 21 }, (_, i) => ({
        ...BASE_POST,
        id: `post-${i}`,
        postNumber: i + 1,
      }));
      prismaMock.post.findMany.mockResolvedValue(posts as never);
      prismaMock.vote.findMany.mockResolvedValue([]);

      const result = await listPosts({ boardId: BOARD_ID, limit: 20, isAdmin: false });
      expect(result.items).toHaveLength(20);
      // L3: cursor is base64("createdAt|id") compound format
      const lastPost = posts[19];
      const expectedCursor = lastPost
        ? Buffer.from(`${lastPost.createdAt.toISOString()}|${lastPost.id}`).toString("base64")
        : null;
      expect(result.nextCursor).toBe(expectedCursor);
    });

    it("includes hasVoted=true for authenticated voter", async () => {
      prismaMock.post.findMany.mockResolvedValue([BASE_POST] as never);
      prismaMock.vote.findMany.mockResolvedValue([{ postId: POST_ID }] as never);

      const result = await listPosts({ boardId: BOARD_ID, callerId: USER_ID, isAdmin: false });
      expect(result.items[0]?.hasVoted).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getSimilarPosts
  // ---------------------------------------------------------------------------

  describe("getSimilarPosts", () => {
    it("calls $queryRaw and returns shaped results", async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { postNumber: 1, title: "Similar post", voteCount: 3, status: "OPEN" },
      ] as never);

      const result = await getSimilarPosts(BOARD_ID, "my post title");
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe("OPEN");
    });

    it("returns empty array when no similar posts", async () => {
      prismaMock.$queryRaw.mockResolvedValue([] as never);
      const result = await getSimilarPosts(BOARD_ID, "unique title");
      expect(result).toHaveLength(0);
    });
  });
});
