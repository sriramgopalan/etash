import { redis } from "@/lib/redis";
import { prisma } from "@/server/db";

const SESSION_CACHE_TTL_SECONDS = 60;
const SESSION_KEY_PREFIX = "session:";
const USER_SESSIONS_KEY_PREFIX = "user:";
const USER_SESSIONS_SUFFIX = ":sessions";

function sessionKey(token: string): string {
  return `${SESSION_KEY_PREFIX}${token}`;
}

function userSessionsKey(userId: string): string {
  return `${USER_SESSIONS_KEY_PREFIX}${userId}${USER_SESSIONS_SUFFIX}`;
}

export async function cacheSession(
  sessionToken: string,
  userId: string,
  expires: Date,
): Promise<void> {
  const payload = JSON.stringify({ userId, expires: expires.toISOString() });
  await Promise.all([
    redis.set(sessionKey(sessionToken), payload, "EX", SESSION_CACHE_TTL_SECONDS),
    redis.sadd(userSessionsKey(userId), sessionToken),
  ]);
}

interface CachedSession {
  userId: string;
  expires: Date;
}

export async function getCachedSession(
  sessionToken: string,
): Promise<CachedSession | null> {
  const raw = await redis.get(sessionKey(sessionToken));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { userId: string; expires: string };
  return { userId: parsed.userId, expires: new Date(parsed.expires) };
}

export async function invalidateSessionCache(sessionToken: string, userId: string): Promise<void> {
  await Promise.all([
    redis.del(sessionKey(sessionToken)),
    redis.srem(userSessionsKey(userId), sessionToken),
  ]);
}

export async function invalidateAllUserSessionCaches(userId: string): Promise<void> {
  const tokens = await redis.smembers(userSessionsKey(userId));
  if (tokens.length > 0) {
    const sessionKeys = tokens.map(sessionKey);
    await redis.del(...sessionKeys, userSessionsKey(userId));
  }
}

export async function getSessionFromDb(
  sessionToken: string,
): Promise<{ userId: string; expires: Date } | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: { userId: true, expires: true },
  });
  return session;
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
