// DEPLOYMENT REQUIREMENT: reverse proxy must overwrite x-forwarded-for with the
// real client IP. Without this, guest vote deduplication can be bypassed by
// spoofing the XFF header. See docs/deployment-requirements.md
import { AppError } from "@/lib/errors";
import { redis } from "@/lib/redis";

interface RateLimitOptions {
  max: number;
  windowSeconds: number;
}

export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<void> {
  const redisKey = `rl:${key}`;
  const pipeline = redis.pipeline();
  pipeline.incr(redisKey);
  pipeline.expire(redisKey, opts.windowSeconds, "NX");
  const results = await pipeline.exec();
  const count = results?.[0]?.[1] as number;
  if (count > opts.max) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please try again later.",
    );
  }
}
