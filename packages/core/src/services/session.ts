/**
 * Session service using Redis
 */

import { getRedis } from "../db/redis.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { UserRole } from "../types/auth.js";

// Session key format: session:{userId}:{tokenId}
const SESSION_KEY_PREFIX = "session:";
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface RedisSession {
  userId: string;
  username: string;
  role: UserRole;
  tokenId: string;
  createdAt: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a session in Redis
 */
export async function createSession(
  userId: string,
  username: string,
  role: UserRole,
  tokenId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const redis = getRedis();
  const key = `${SESSION_KEY_PREFIX}${userId}:${tokenId}`;

  const session: RedisSession = {
    userId,
    username,
    role,
    tokenId,
    createdAt: Date.now(),
    ipAddress,
    userAgent,
  };

  await redis.setex(key, SESSION_TTL_SECONDS, JSON.stringify(session));

  logger.debug(`[Session] Created session for user ${userId}, tokenId ${tokenId}`);
}

/**
 * Get session from Redis
 */
export async function getSession(userId: string, tokenId: string): Promise<RedisSession | null> {
  const redis = getRedis();
  const key = `${SESSION_KEY_PREFIX}${userId}:${tokenId}`;

  const data = await redis.get(key);

  if (!data) {
    return null;
  }

  return JSON.parse(data) as RedisSession;
}

/**
 * Delete session from Redis (logout)
 */
export async function deleteSession(userId: string, tokenId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${SESSION_KEY_PREFIX}${userId}:${tokenId}`;

  const result = await redis.del(key);

  if (result > 0) {
    logger.debug(`[Session] Deleted session for user ${userId}, tokenId ${tokenId}`);
    return true;
  }

  return false;
}

/**
 * Delete all sessions for a user (force logout all devices)
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const redis = getRedis();
  const pattern = `${SESSION_KEY_PREFIX}${userId}:*`;

  // Find all session keys for this user
  const keys = await redis.keys(pattern);

  if (keys.length === 0) {
    return 0;
  }

  // Delete all found keys
  const result = await redis.del(...keys);

  logger.debug(`[Session] Deleted ${result} sessions for user ${userId}`);

  return result;
}

/**
 * Check if session exists and is valid
 */
export async function validateSession(userId: string, tokenId: string): Promise<boolean> {
  const session = await getSession(userId, tokenId);
  return session !== null;
}

/**
 * Extend session TTL (refresh session)
 */
export async function extendSession(userId: string, tokenId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${SESSION_KEY_PREFIX}${userId}:${tokenId}`;

  const result = await redis.expire(key, SESSION_TTL_SECONDS);

  return result === 1;
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{ totalSessions: number; users: string[] }> {
  const redis = getRedis();
  const pattern = `${SESSION_KEY_PREFIX}*`;

  const keys = await redis.keys(pattern);

  const users = keys.map(key => {
    // Extract userId from key: session:{userId}:{tokenId}
    const parts = key.replace(config.redis.keyPrefix + SESSION_KEY_PREFIX, "").split(":");
    return parts[0];
  });

  return {
    totalSessions: keys.length,
    users: [...new Set(users)],
  };
}