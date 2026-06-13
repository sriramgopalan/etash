
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRedisMock } from "@/tests/helpers/auth-setup";
import {
  createPrismaMock,
  mockReset,
  type DeepMockProxy,
  type PrismaClient,
} from "@/tests/helpers/repository-setup";

let prismaMock: DeepMockProxy<PrismaClient>;
const redisMock = makeRedisMock();

vi.mock("@/server/db", async () => {
  prismaMock = await createPrismaMock();
  return { prisma: prismaMock };
});

vi.mock("@/lib/redis", () => ({ redis: redisMock }));

const {
  cacheSession,
  getCachedSession,
  invalidateSessionCache,
  invalidateAllUserSessionCaches,
  getSessionFromDb,
  deleteSessionsForUser,
} = await import("@/server/repositories/session");

const FUTURE = new Date(Date.now() + 60_000);

describe("session repository", () => {
  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  describe("cacheSession", () => {
    it("sets session key and adds to user set", async () => {
      redisMock.set.mockResolvedValue("OK");
      redisMock.sadd.mockResolvedValue(1);

      await cacheSession("tok-1", "user-1", FUTURE);

      expect(redisMock.set).toHaveBeenCalledWith(
        "session:tok-1",
        expect.stringContaining("user-1"),
        "EX",
        60,
      );
      expect(redisMock.sadd).toHaveBeenCalledWith("user:user-1:sessions", "tok-1");
    });
  });

  describe("getCachedSession", () => {
    it("returns parsed session when cached", async () => {
      const payload = JSON.stringify({ userId: "user-1", expires: FUTURE.toISOString() });
      redisMock.get.mockResolvedValue(payload);

      const result = await getCachedSession("tok-1");
      expect(result?.userId).toBe("user-1");
      expect(result?.expires).toBeInstanceOf(Date);
    });

    it("returns null on cache miss", async () => {
      redisMock.get.mockResolvedValue(null);
      expect(await getCachedSession("tok-missing")).toBeNull();
    });
  });

  describe("invalidateSessionCache", () => {
    it("deletes session key and removes from user set", async () => {
      redisMock.del.mockResolvedValue(1);
      redisMock.srem.mockResolvedValue(1);

      await invalidateSessionCache("tok-1", "user-1");

      expect(redisMock.del).toHaveBeenCalledWith("session:tok-1");
      expect(redisMock.srem).toHaveBeenCalledWith("user:user-1:sessions", "tok-1");
    });
  });

  describe("invalidateAllUserSessionCaches", () => {
    it("deletes all session keys for user", async () => {
      redisMock.smembers.mockResolvedValue(["tok-1", "tok-2"]);
      redisMock.del.mockResolvedValue(2);

      await invalidateAllUserSessionCaches("user-1");

      expect(redisMock.smembers).toHaveBeenCalledWith("user:user-1:sessions");
      expect(redisMock.del).toHaveBeenCalledWith(
        "session:tok-1",
        "session:tok-2",
        "user:user-1:sessions",
      );
    });

    it("no-ops when user has no cached sessions", async () => {
      redisMock.smembers.mockResolvedValue([]);
      await invalidateAllUserSessionCaches("user-1");
      expect(redisMock.del).not.toHaveBeenCalled();
    });
  });

  describe("getSessionFromDb", () => {
    it("returns session when found", async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        userId: "user-1",
        expires: FUTURE,
      } as never);

      const result = await getSessionFromDb("tok-1");
      expect(result?.userId).toBe("user-1");
    });

    it("returns null when not found", async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      expect(await getSessionFromDb("tok-missing")).toBeNull();
    });
  });

  describe("deleteSessionsForUser", () => {
    it("deletes all sessions for user", async () => {
      prismaMock.session.deleteMany.mockResolvedValue({ count: 2 });
      await deleteSessionsForUser("user-1");
      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });
});
