import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { prisma } from "@/server/db";
import type {
  AdminCommentView,
  CommentListResult,
  CreatedComment,
  PublicCommentView,
} from "@/types/comment";

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------

const PUBLIC_COMMENT_SELECT = {
  id: true,
  postId: true,
  guestName: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} as const;

const ADMIN_COMMENT_SELECT = {
  id: true,
  postId: true,
  guestName: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

const CREATED_COMMENT_SELECT = {
  id: true,
  postId: true,
  authorId: true,
  guestName: true,
  body: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicRow = Prisma.CommentGetPayload<{ select: typeof PUBLIC_COMMENT_SELECT }>;
type AdminRow = Prisma.CommentGetPayload<{ select: typeof ADMIN_COMMENT_SELECT }>;
type CreatedRow = Prisma.CommentGetPayload<{ select: typeof CREATED_COMMENT_SELECT }>;

// ---------------------------------------------------------------------------
// Input contracts
// ---------------------------------------------------------------------------

interface CreateCommentInput {
  postId: string;
  authorId: string | null;
  guestName: string | null;
  body: string;
}

interface UpdateCommentInput {
  body: string;
}

export interface ListCommentsOptions {
  postId: string;
  cursor?: string;
  limit?: number;
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getCommentById(
  id: string,
  viewer: { isAdmin: boolean },
): Promise<PublicCommentView | AdminCommentView | null> {
  if (viewer.isAdmin) {
    const row: AdminRow | null = await prisma.comment.findUnique({
      where: { id },
      select: ADMIN_COMMENT_SELECT,
    });
    return row;
  }
  const row: PublicRow | null = await prisma.comment.findUnique({
    where: { id },
    select: PUBLIC_COMMENT_SELECT,
  });
  return row;
}

export async function listComments(opts: ListCommentsOptions): Promise<CommentListResult> {
  const { postId, cursor, limit = 20, isAdmin = false } = opts;
  const clampedLimit = Math.min(Math.max(1, limit), 50);
  const orderBy = [{ createdAt: "asc" as const }, { id: "asc" as const }];

  const cursorId = cursor ? decodeCursor(cursor) : undefined;

  if (isAdmin) {
    const rows = cursorId
      ? await prisma.comment.findMany({
          where: { postId },
          orderBy,
          take: clampedLimit + 1,
          cursor: { id: cursorId },
          skip: 1,
          select: ADMIN_COMMENT_SELECT,
        })
      : await prisma.comment.findMany({
          where: { postId },
          orderBy,
          take: clampedLimit + 1,
          select: ADMIN_COMMENT_SELECT,
        });

    const hasNextPage = rows.length > clampedLimit;
    const page = hasNextPage ? rows.slice(0, clampedLimit) : rows;
    const lastItem = page[page.length - 1];
    const nextCursor =
      hasNextPage && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null;

    return { items: page as unknown as PublicCommentView[], nextCursor };
  }

  const rows = cursorId
    ? await prisma.comment.findMany({
        where: { postId },
        orderBy,
        take: clampedLimit + 1,
        cursor: { id: cursorId },
        skip: 1,
        select: PUBLIC_COMMENT_SELECT,
      })
    : await prisma.comment.findMany({
        where: { postId },
        orderBy,
        take: clampedLimit + 1,
        select: PUBLIC_COMMENT_SELECT,
      });

  const hasNextPage = rows.length > clampedLimit;
  const page = hasNextPage ? rows.slice(0, clampedLimit) : rows;
  const lastItem = page[page.length - 1];
  const nextCursor =
    hasNextPage && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null;

  return { items: page as PublicCommentView[], nextCursor };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createComment(input: CreateCommentInput): Promise<CreatedComment> {
  return prisma.$transaction(async (tx) => {
    const row: CreatedRow = await tx.comment.create({
      data: {
        postId: input.postId,
        authorId: input.authorId,
        guestName: input.guestName,
        body: input.body,
      },
      select: CREATED_COMMENT_SELECT,
    });
    await tx.post.update({
      where: { id: input.postId },
      data: { commentCount: { increment: 1 } },
    });
    return row;
  });
}

export async function updateComment(
  id: string,
  data: UpdateCommentInput,
  viewer: { isAdmin: boolean; callerId: string },
): Promise<AdminCommentView> {
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!existing) throw new AppError("NOT_FOUND", "Comment not found.");

  if (!viewer.isAdmin && existing.authorId !== viewer.callerId) {
    throw new AppError("FORBIDDEN", "You don't have permission to edit this comment.");
  }

  const row: AdminRow = await prisma.comment.update({
    where: { id },
    data: { body: data.body },
    select: ADMIN_COMMENT_SELECT,
  });

  return row;
}

export async function deleteComment(
  id: string,
  viewer: { isAdmin: boolean; callerId: string },
): Promise<{ id: string }> {
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true, postId: true },
  });

  if (!existing) throw new AppError("NOT_FOUND", "Comment not found.");

  if (!viewer.isAdmin && existing.authorId !== viewer.callerId) {
    throw new AppError("FORBIDDEN", "You don't have permission to delete this comment.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id } });
    await tx.post.update({
      where: { id: existing.postId },
      data: { commentCount: { decrement: 1 } },
    });
  });

  return { id };
}
