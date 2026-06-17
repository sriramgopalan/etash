import { TRPCError } from "@trpc/server";

import type { BoardSettings } from "@/lib/board-settings";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getBoardById } from "@/server/repositories/board";
import { hashIp } from "@/server/repositories/post";
import type { PostViewer } from "@/types/post";

export function getViewer(
  ctx: { session: { user: { id: string; role: string } } | null; ip: string },
): PostViewer {
  return {
    isAdmin: ctx.session?.user?.role === "ADMIN",
    callerId: ctx.session?.user?.id,
    hashedIp: hashIp(ctx.ip),
  };
}

export async function requireBoardVisible(
  boardId: string,
  isAdmin: boolean,
  context: string,
): Promise<{ settings: BoardSettings; isPublic: boolean }> {
  const board = await getBoardById(boardId);
  if (!board) {
    logger.info({ boardId }, context + ": board not found");
    throw new TRPCError({
      code: "NOT_FOUND",
      cause: new AppError("NOT_FOUND", "This board doesn't exist."),
    });
  }
  if (!board.isPublic && !isAdmin) {
    logger.info({ boardId }, context + ": private board blocked non-admin");
    throw new TRPCError({
      code: "NOT_FOUND",
      cause: new AppError("NOT_FOUND", "This board doesn't exist."),
    });
  }
  return { settings: board.settings, isPublic: board.isPublic };
}
