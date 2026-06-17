import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db";
import {
  BASE_COMMENT,
  COMMENT_ID,
  POST_ID,
  USER_ID,
  makeCommentRow,
} from "@/tests/helpers/comment-fixtures";
import { mockReset, type DeepMockProxy, type PrismaClient } from "@/tests/helpers/repository-setup";

vi.mock("@/server/db");

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} = await import("@/server/repositories/comment");

describe("comment repository", () => {
  afterEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // listComments
  // ---------------------------------------------------------------------------

  describe("listComments", () => {
    it("returns items in createdAt asc order (by mock order)", async () => {
      const row1 = makeCommentRow({ id: "cc1", createdAt: new Date("2024-01-01") });
      const row2 = makeCommentRow({ id: "cc2", createdAt: new Date("2024-01-02") });
      prismaMock.comment.findMany.mockResolvedValue([row1, row2] as never);
      const result = await listComments({ postId: POST_ID });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe("cc1");
    });

    it("respects limit", async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        makeCommentRow({ id: `cc${i}`, createdAt: new Date(`2024-01-0${i + 1}`) }),
      );
      prismaMock.comment.findMany.mockResolvedValue(rows as never);
      const result = await listComments({ postId: POST_ID, limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it("returns nextCursor: null on last page", async () => {
      prismaMock.comment.findMany.mockResolvedValue([makeCommentRow()] as never);
      const result = await listComments({ postId: POST_ID, limit: 20 });
      expect(result.nextCursor).toBeNull();
    });

    it("applies cursor skip on second page call", async () => {
      prismaMock.comment.findMany.mockResolvedValue([makeCommentRow()] as never);
      const cursor = Buffer.from(`${BASE_COMMENT.createdAt.toISOString()}|${COMMENT_ID}`).toString(
        "base64",
      );
      await listComments({ postId: POST_ID, cursor });
      expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: COMMENT_ID }, skip: 1 }),
      );
    });

    it("throws VALIDATION_ERROR on malformed cursor", async () => {
      const badCursor = Buffer.from("no-pipe-here").toString("base64");
      await expect(listComments({ postId: POST_ID, cursor: badCursor })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("returns empty list when post has no comments", async () => {
      prismaMock.comment.findMany.mockResolvedValue([] as never);
      const result = await listComments({ postId: POST_ID });
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("uses admin select shape when isAdmin: true", async () => {
      prismaMock.comment.findMany.mockResolvedValue([
        { ...makeCommentRow(), authorId: USER_ID, author: { id: USER_ID, name: "Alice", email: "a@b.com" } },
      ] as never);
      const result = await listComments({ postId: POST_ID, isAdmin: true });
      expect(result.items[0]).toHaveProperty("authorId");
    });
  });

  // ---------------------------------------------------------------------------
  // createComment
  // ---------------------------------------------------------------------------

  describe("createComment", () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation(
        ((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) as never,
      );
    });

    it("persists and returns CreatedComment with correct fields", async () => {
      prismaMock.comment.create.mockResolvedValue(BASE_COMMENT as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      const result = await createComment({
        postId: POST_ID,
        authorId: USER_ID,
        guestName: null,
        body: "Test comment",
      });
      expect(result.id).toBe(COMMENT_ID);
      expect(result.postId).toBe(POST_ID);
    });

    it("calls post.update with commentCount increment inside transaction", async () => {
      prismaMock.comment.create.mockResolvedValue(BASE_COMMENT as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      await createComment({ postId: POST_ID, authorId: USER_ID, guestName: null, body: "x" });
      expect(prismaMock.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: POST_ID },
          data: { commentCount: { increment: 1 } },
        }),
      );
    });

    it("sets authorId from input", async () => {
      prismaMock.comment.create.mockResolvedValue({ ...BASE_COMMENT, authorId: USER_ID } as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      await createComment({ postId: POST_ID, authorId: USER_ID, guestName: null, body: "x" });
      expect(prismaMock.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ authorId: USER_ID }) }),
      );
    });

    it("sets guestName when authorId is null", async () => {
      prismaMock.comment.create.mockResolvedValue({
        ...BASE_COMMENT,
        authorId: null,
        guestName: "Alice Guest",
      } as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      await createComment({ postId: POST_ID, authorId: null, guestName: "Alice Guest", body: "x" });
      expect(prismaMock.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authorId: null, guestName: "Alice Guest" }),
        }),
      );
    });

    it("passes null guestName when authorId is set", async () => {
      prismaMock.comment.create.mockResolvedValue(BASE_COMMENT as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      await createComment({ postId: POST_ID, authorId: USER_ID, guestName: null, body: "x" });
      expect(prismaMock.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ guestName: null }) }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateComment
  // ---------------------------------------------------------------------------

  describe("updateComment", () => {
    it("returns updated AdminCommentView on success", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({ authorId: USER_ID } as never);
      const updatedRow = {
        ...makeCommentRow(),
        authorId: USER_ID,
        author: { id: USER_ID, name: "Alice", email: "a@b.com" },
        body: "updated body",
      };
      prismaMock.comment.update.mockResolvedValue(updatedRow as never);
      const result = await updateComment(
        COMMENT_ID,
        { body: "updated body" },
        { isAdmin: false, callerId: USER_ID },
      );
      expect(result.body).toBe("updated body");
    });

    it("throws NOT_FOUND when id absent", async () => {
      prismaMock.comment.findUnique.mockResolvedValue(null);
      await expect(
        updateComment("cnotfound000000001", { body: "x" }, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN when callerId !== authorId and isAdmin is false", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({ authorId: "cother0000000001" } as never);
      await expect(
        updateComment(COMMENT_ID, { body: "x" }, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("succeeds when isAdmin is true regardless of authorId", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({ authorId: "csomeone0000001" } as never);
      prismaMock.comment.update.mockResolvedValue({
        ...makeCommentRow(),
        authorId: "csomeone0000001",
        author: { id: "csomeone0000001", name: "Bob", email: "b@b.com" },
        body: "admin edit",
      } as never);
      const result = await updateComment(
        COMMENT_ID,
        { body: "admin edit" },
        { isAdmin: true, callerId: "cadmin1234567890" },
      );
      expect(result.body).toBe("admin edit");
    });

    it("on P2025 during update (tombstone race), returns post-tombstone comment state", async () => {
      prismaMock.comment.findUnique
        .mockResolvedValueOnce({ authorId: USER_ID } as never)
        .mockResolvedValueOnce({
          ...makeCommentRow(),
          authorId: null,
          author: null,
          body: "[deleted]",
        } as never);
      const p2025 = new Prisma.PrismaClientKnownRequestError("Record not found.", {
        code: "P2025",
        clientVersion: "5.x",
      });
      prismaMock.comment.update.mockRejectedValueOnce(p2025 as never);
      const result = await updateComment(
        COMMENT_ID,
        { body: "new body" },
        { isAdmin: false, callerId: USER_ID },
      );
      expect(result.body).toBe("[deleted]");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteComment
  // ---------------------------------------------------------------------------

  describe("deleteComment", () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation(
        ((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) as never,
      );
    });

    it("returns { id } on success", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        authorId: USER_ID,
        postId: POST_ID,
      } as never);
      prismaMock.comment.delete.mockResolvedValue({} as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      const result = await deleteComment(COMMENT_ID, { isAdmin: false, callerId: USER_ID });
      expect(result.id).toBe(COMMENT_ID);
    });

    it("calls $executeRaw with GREATEST floor-0 expression inside transaction", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        authorId: USER_ID,
        postId: POST_ID,
      } as never);
      prismaMock.comment.delete.mockResolvedValue({} as never);
      await deleteComment(COMMENT_ID, { isAdmin: false, callerId: USER_ID });
      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when id absent", async () => {
      prismaMock.comment.findUnique.mockResolvedValue(null);
      await expect(
        deleteComment("cnotfound000000001", { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN when callerId !== authorId and isAdmin is false", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        authorId: "cother0000000001",
        postId: POST_ID,
      } as never);
      await expect(
        deleteComment(COMMENT_ID, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("succeeds when isAdmin is true regardless of authorId", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        authorId: "csomeone0000001",
        postId: POST_ID,
      } as never);
      prismaMock.comment.delete.mockResolvedValue({} as never);
      prismaMock.post.update.mockResolvedValue({} as never);
      const result = await deleteComment(COMMENT_ID, {
        isAdmin: true,
        callerId: "cadmin1234567890",
      });
      expect(result.id).toBe(COMMENT_ID);
    });

    it("throws NOT_FOUND when comment deleted concurrently (P2025 from transaction)", async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        authorId: USER_ID,
        postId: POST_ID,
      } as never);
      const p2025 = new Prisma.PrismaClientKnownRequestError("Record not found.", {
        code: "P2025",
        clientVersion: "5.x",
      });
      prismaMock.comment.delete.mockRejectedValue(p2025 as never);
      await expect(
        deleteComment(COMMENT_ID, { isAdmin: false, callerId: USER_ID }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
