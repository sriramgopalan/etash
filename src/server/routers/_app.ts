import { authRouter } from "@/server/routers/auth";
import { createTRPCRouter } from "@/server/trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
