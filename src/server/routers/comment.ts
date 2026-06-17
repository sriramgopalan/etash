import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { stripHtml } from "@/lib/sanitize";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "@/server/repositories/comment";
import { getPostById } from "@/server/repositories/post";
import { getViewer, requireBoardVisible } from "@/server/routers/_helpers";
import {
  applyRateLimit,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/trpc";
import type { PublicCommentView } from "@/types/comment";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const ListCommentsInput = z
  .object({
    postId: z.string().cuid(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const CreateCommentInput = z
  .object({
    postId: z.string().cuid(),
    body: z
      .string()
      .trim()
      .min(1, "Comment cannot be empty.")
      .max(2000, "Comment must be 2 000 characters or fewer."),
    guestName: z
      .string()
      .trim()
      .min(2, "Guest name must be at least 2 characters.")
      .max(50, "Guest name must be 50 characters or fewer.")
      .optional(),
  })
  .strict();

const UpdateCommentInput = z
  .object({
    id: z.string().cuid(),
    body: z
      .string()
      .trim()
      .min(1, "Comment cannot be empty.")
      .max(2000, "Comment must be 2 000 characters or fewer."),
  })
  .strict();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const commentRouter = createTRPCRouter({
  list: publicProcedure.input(ListCommentsInput).query(async ({ input, ctx }) => {
    const viewer = getViewer(ctx);

    const post = await getPostById(input.postId, viewer);
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        cause: new AppError("NOT_FOUND", "Post not found."),
      });
    }

    try {
      return await listComments({
        postId: input.postId,
        cursor: input.cursor,
        limit: input.limit,
        isAdmin: viewer.isAdmin,
      });
    } catch (e) {
      if (e instanceof AppError && e.code === "VALIDATION_ERROR") {
        throw new TRPCError({ code: "BAD_REQUEST", cause: e });
      }
      logger.error({ err: e, postId: input.postId }, "comments.list: db error");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        cause: new AppError("INTERNAL_ERROR", "Something went wrong."),
      });
    }
  }),

  create: publicProcedure.input(CreateCommentInput).mutation(async ({ input, ctx }) => {
    const viewer = getViewer(ctx);
    await applyRateLimit(`comments:create:${viewer.hashedIp}`, 20, 3600);

    const post = await getPostById(input.postId, viewer);
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        cause: new AppError("NOT_FOUND", "Post not found."),
      });
    }

    const { settings } = await requireBoardVisible(
      post.boardId,
      viewer.isAdmin,
      "comments.create",
    );
    const { whoCanPost } = settings;

    if (whoCanPost === "ADMINS_ONLY" && !viewer.isAdmin) {
      logger.info({ postId: input.postId }, "comments.create: ADMINS_ONLY blocked");
      throw new TRPCError({
        code: "NOT_FOUND",
        cause: new AppError("NOT_FOUND", "This board doesn't exist."),
      });
    }

    if (whoCanPost === "AUTHENTICATED" && !viewer.callerId) {
      logger.info({ postId: input.postId }, "comments.create: unauthenticated blocked");
      throw new TRPCError({
        code: "UNAUTHORIZED",
        cause: new AppError("UNAUTHORIZED", "You must be signed in to comment."),
      });
    }

    if (!viewer.callerId && !input.guestName) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        cause: new AppError("VALIDATION_ERROR", "A guest name is required."),
      });
    }

    try {
      return await createComment({
        postId: input.postId,
        authorId: viewer.callerId ?? null,
        guestName: input.guestName ? stripHtml(input.guestName) : null,
        body: stripHtml(input.body),
      });
    } catch (e) {
      logger.error({ err: e, postId: input.postId }, "comments.create: db error");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        cause: new AppError("INTERNAL_ERROR", "Something went wrong. Please try again."),
      });
    }
  }),

  update: protectedProcedure.input(UpdateCommentInput).mutation(async ({ input, ctx }) => {
    const viewer = getViewer(ctx);
    await applyRateLimit(`comments:update:${viewer.hashedIp}`, 30, 3600);
    const callerId = ctx.session.user.id;

    try {
      const comment = await updateComment(
        input.id,
        { body: stripHtml(input.body) },
        { isAdmin: viewer.isAdmin, callerId },
      );

      if (!viewer.isAdmin) {
        const { id, postId, guestName, body, createdAt, updatedAt, author } = comment;
        const publicAuthor = author ? { id: author.id, name: author.name } : null;
        return { id, postId, guestName, body, createdAt, updatedAt, author: publicAuthor } as PublicCommentView;
      }
      return comment;
    } catch (e) {
      if (e instanceof AppError) {
        if (e.code === "NOT_FOUND") {
          logger.info({ commentId: input.id, userId: callerId }, "comments.update: not found");
          throw new TRPCError({ code: "NOT_FOUND", cause: e });
        }
        if (e.code === "FORBIDDEN") {
          logger.warn({ commentId: input.id, userId: callerId }, "comments.update: not author");
          throw new TRPCError({
            code: "NOT_FOUND",
            cause: new AppError("NOT_FOUND", "Comment not found."),
          });
        }
      }
      logger.error({ err: e, commentId: input.id }, "comments.update: db error");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        cause: new AppError("INTERNAL_ERROR", "Something went wrong."),
      });
    }
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const viewer = getViewer(ctx);
      await applyRateLimit(`comments:delete:${viewer.hashedIp}`, 20, 3600);
      const callerId = ctx.session.user.id;

      try {
        return await deleteComment(input.id, { isAdmin: viewer.isAdmin, callerId });
      } catch (e) {
        if (e instanceof AppError) {
          if (e.code === "NOT_FOUND") {
            logger.info({ commentId: input.id, userId: callerId }, "comments.delete: not found");
            throw new TRPCError({ code: "NOT_FOUND", cause: e });
          }
          if (e.code === "FORBIDDEN") {
            logger.warn({ commentId: input.id, userId: callerId }, "comments.delete: not author");
            throw new TRPCError({
              code: "NOT_FOUND",
              cause: new AppError("NOT_FOUND", "Comment not found."),
            });
          }
        }
        logger.error({ err: e, commentId: input.id }, "comments.delete: db error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          cause: new AppError("INTERNAL_ERROR", "Something went wrong."),
        });
      }
    }),
});
