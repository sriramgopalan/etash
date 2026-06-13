import type { Session } from "next-auth";

import type { Context } from "@/server/trpc";

export function createTestContext(overrides?: Partial<Context>): Context {
  return {
    session: null,
    ip: "127.0.0.1",
    ...overrides,
  };
}

export function createAuthedContext(
  userId: string,
  email = "user@example.com",
): Context {
  const session: Session = {
    user: { id: userId, email, name: null, image: null },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  return { session, ip: "127.0.0.1" };
}
