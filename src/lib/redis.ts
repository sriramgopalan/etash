import Redis from "ioredis";

import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  client.on("error", () => {
    // Errors logged by caller — redis client emits continuously, avoid log spam
  });
  return client;
}

export const redis =
  globalThis._redis ??
  (() => {
    const client = createRedisClient();
    if (env.NODE_ENV !== "production") globalThis._redis = client;
    return client;
  })();
