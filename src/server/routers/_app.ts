import { authRouter } from "@/server/routers/auth";
import { boardRouter } from "@/server/routers/board";
import { commentRouter } from "@/server/routers/comment";
import { postRouter } from "@/server/routers/post";
import { createTRPCRouter } from "@/server/trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  boards: boardRouter,
  posts: postRouter,
  comments: commentRouter,
});

export type AppRouter = typeof appRouter;
