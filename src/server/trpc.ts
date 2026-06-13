import { TRPCError, initTRPC } from "@trpc/server";
import type { Session } from "next-auth";
import superjson from "superjson";

import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";


export type Context = {
  session: Session | null;
  ip: string;
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (cause instanceof AppError) {
      return {
        ...shape,
        message: cause.message,
        data: { ...shape.data, appErrorCode: cause.code },
      };
    }
    if (error.code === "INTERNAL_SERVER_ERROR") {
      logger.error({ err: error }, "unhandled tRPC error");
      return { ...shape, message: "An unexpected error occurred" };
    }
    return shape;
  },
});

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      cause: new AppError("UNAUTHORIZED", "Not authenticated"),
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as Session & {
        user: NonNullable<Session["user"]> & { id: string };
      },
    },
  });
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);
