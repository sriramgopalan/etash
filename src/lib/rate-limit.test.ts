import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

const redisMock = vi.hoisted(() => ({
  incr: vi.fn<() => Promise<number>>(),
  expire: vi.fn<() => Promise<number>>(),
}));

vi.mock("@/lib/redis", () => ({ redis: redisMock }));

// Import after mock is set up
const { rateLimit } = await import("@/lib/rate-limit");

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments counter and sets expiry on first call", async () => {
    redisMock.incr.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);

    await rateLimit("test:key", { max: 5, windowSeconds: 60 });

    expect(redisMock.incr).toHaveBeenCalledWith("rl:test:key");
    expect(redisMock.expire).toHaveBeenCalledWith("rl:test:key", 60);
  });

  it("does not set expiry after first call", async () => {
    redisMock.incr.mockResolvedValue(2);

    await rateLimit("test:key", { max: 5, windowSeconds: 60 });

    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it("throws RATE_LIMITED when count exceeds max", async () => {
    redisMock.incr.mockResolvedValue(6);

    await expect(rateLimit("test:key", { max: 5, windowSeconds: 60 })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("throws AppError on rate limit exceeded", async () => {
    redisMock.incr.mockResolvedValue(100);

    const err = await rateLimit("test:key", { max: 10, windowSeconds: 60 }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("RATE_LIMITED");
  });

  it("allows requests up to the max limit", async () => {
    redisMock.incr.mockResolvedValue(5);
    redisMock.expire.mockResolvedValue(1);

    await expect(rateLimit("test:key", { max: 5, windowSeconds: 60 })).resolves.toBeUndefined();
  });
});
