/**
 * Authentication middleware
 * Uses Redis for session validation instead of PostgreSQL
 */

import type { Context, Next } from "hono";
import { verifyJwt } from "../utils/jwt.js";
import { validateSession } from "../services/session.js";
import { db } from "../db/index.js";
import { config } from "../config/index.js";
import type { User } from "../types/auth.js";

/**
 * JWT authentication middleware for web sessions
 * Validates JWT token and checks Redis session
 */
export async function jwtAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
      },
      401
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);

  if (!payload) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Invalid or expired token" },
      },
      401
    );
  }

  // Check Redis session exists
  const sessionValid = await validateSession(payload.user_id, payload.token_id);

  if (!sessionValid) {
    return c.json(
      {
        success: false,
        error: { code: "SESSION_EXPIRED", message: "Session has expired or been logged out" },
      },
      401
    );
  }

  // Verify user still exists and is enabled
  const users = await db`
    SELECT * FROM users WHERE id = ${payload.user_id} AND enabled = TRUE
  `;

  const user = users[0] as User | undefined;

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: "USER_DISABLED", message: "User not found or disabled" },
      },
      401
    );
  }

  // Set user and tokenId in context
  c.set("user", user);
  c.set("userId", user.id);
  c.set("userRole", user.role);
  c.set("tokenId", payload.token_id);

  await next();
}

/**
 * API Key authentication middleware for telemetry and other API access
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const apiKeyHeader = config.auth.apiKeyHeader;
  const apiKey = c.req.header(apiKeyHeader);
  const defaultApiKey = config.auth.defaultApiKey;

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: { code: "MISSING_API_KEY", message: `Missing ${apiKeyHeader} header` },
      },
      401
    );
  }

  if (!defaultApiKey) {
    return c.json(
      {
        success: false,
        error: { code: "API_KEY_NOT_CONFIGURED", message: "API key not configured on server" },
      },
      500
    );
  }

  if (apiKey !== defaultApiKey) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_API_KEY", message: "Invalid API key" },
      },
      401
    );
  }

  await next();
}

/**
 * Optional authentication - allows both JWT and API Key
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = config.auth.apiKeyHeader;
  const apiKey = c.req.header(apiKeyHeader);
  const defaultApiKey = config.auth.defaultApiKey;

  if (apiKey && apiKey === defaultApiKey) {
    // API key auth passed
    await next();
    return;
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    // Try JWT auth
    const token = authHeader.slice(7);
    const payload = await verifyJwt(token);

    if (payload) {
      // Check Redis session
      const sessionValid = await validateSession(payload.user_id, payload.token_id);

      if (sessionValid) {
        const users = await db`
          SELECT * FROM users WHERE id = ${payload.user_id} AND enabled = TRUE
        `;

        const user = users[0] as User | undefined;

        if (user) {
          c.set("user", user);
          c.set("userId", user.id);
          c.set("userRole", user.role);
          c.set("tokenId", payload.token_id);
        }
      }
    }
  }

  await next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const userRole = c.get("userRole") as string | undefined;

    if (!userRole || !roles.includes(userRole)) {
      return c.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Insufficient permissions" },
        },
        403
      );
    }

    await next();
  };
}