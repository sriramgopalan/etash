import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

const { redisMock, pipelineMock } = vi.hoisted(() => {
  const pipelineMock = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn<() => Promise<[Error | null, unknown][]>>(),
  };
  const redisMock = {
    pipeline: vi.fn(() => pipelineMock),
  };
  return { redisMock, pipelineMock };
});

vi.mock("@/lib/redis", () => ({ redis: redisMock }));

// Import after mock is set up
const { rateLimit } = await import("@/lib/rate-limit");

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends INCR and EXPIRE NX atomically via pipeline", async () => {
    pipelineMock.exec.mockResolvedValue([[null, 1], [null, 1]]);

    await rateLimit("test:key", { max: 5, windowSeconds: 60 });

    expect(redisMock.pipeline).toHaveBeenCalled();
    expect(pipelineMock.incr).toHaveBeenCalledWith("rl:test:key");
    expect(pipelineMock.expire).toHaveBeenCalledWith("rl:test:key", 60, "NX");
    expect(pipelineMock.exec).toHaveBeenCalled();
  });

  it("always calls expire with NX regardless of count", async () => {
    pipelineMock.exec.mockResolvedValue([[null, 5], [null, 0]]);

    await rateLimit("test:key", { max: 10, windowSeconds: 60 });

    expect(pipelineMock.expire).toHaveBeenCalledWith("rl:test:key", 60, "NX");
  });

  it("throws RATE_LIMITED when count exceeds max", async () => {
    pipelineMock.exec.mockResolvedValue([[null, 6], [null, 1]]);

    await expect(rateLimit("test:key", { max: 5, windowSeconds: 60 })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("throws AppError on rate limit exceeded", async () => {
    pipelineMock.exec.mockResolvedValue([[null, 100], [null, 0]]);

    const err = await rateLimit("test:key", { max: 10, windowSeconds: 60 }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("RATE_LIMITED");
  });

  it("allows requests up to the max limit", async () => {
    pipelineMock.exec.mockResolvedValue([[null, 5], [null, 0]]);

    await expect(rateLimit("test:key", { max: 5, windowSeconds: 60 })).resolves.toBeUndefined();
  });
});
