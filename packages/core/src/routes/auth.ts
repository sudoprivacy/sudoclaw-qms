/**
 * Authentication API routes
 * Uses Redis for session storage instead of PostgreSQL
 */

import { Hono } from "hono";
import { db } from "../db/index.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateSessionToken, verifyJwt } from "../utils/jwt.js";
import { jwtAuth, requireRole } from "../middleware/auth.js";
import { createSession, deleteSession, deleteUserSessions } from "../services/session.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  LoginRequest,
  LoginResponse,
  AuditLog,
  AuditLogQuery,
} from "../types/auth.js";

const auth = new Hono();

/**
 * Login endpoint - creates Redis session
 */
auth.post("/login", async (c) => {
  const body = await c.req.json<LoginRequest>();
  const ipAddress = c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "unknown";
  const userAgent = c.req.header("User-Agent") || "unknown";
  const now = new Date();

  // Find user
  const users = await db`
    SELECT * FROM users WHERE username = ${body.username} AND enabled = TRUE
  `;

  const user = users[0] as User | undefined;

  if (!user) {
    // Audit log for failed login
    await db`
      INSERT INTO audit_logs (action, detail, ip_address, created_at)
      VALUES ('login_failed', ${`username: ${body.username}`}, ${ipAddress}, ${now})
    `;

    return c.json(
      {
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
      },
      401
    );
  }

  // Verify password
  const isValid = await verifyPassword(body.password, user.password_hash);
  if (!isValid) {
    // Audit log for failed login
    await db`
      INSERT INTO audit_logs (user_id, action, detail, ip_address, created_at)
      VALUES (${user.id}, 'login_failed', 'invalid password', ${ipAddress}, ${now})
    `;

    return c.json(
      {
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
      },
      401
    );
  }

  // Generate session token with tokenId
  const { token, tokenId } = await generateSessionToken(user.id, user.username, user.role);

  // Create session in Redis
  await createSession(user.id, user.username, user.role, tokenId, ipAddress, userAgent);

  // Update last login in PostgreSQL
  await db`
    UPDATE users SET last_login_at = ${now}, updated_at = ${now} WHERE id = ${user.id}
  `;

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, ip_address, created_at)
    VALUES (${user.id}, 'login', ${ipAddress}, ${now})
  `;

  logger.info("User logged in: " + user.username + ", tokenId: " + tokenId);

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const response: LoginResponse = {
    token,
    expires_at: expiresAt.getTime(),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      enabled: user.enabled,
      last_login_at: now.getTime(),
      created_at: user.created_at instanceof Date ? user.created_at.getTime() : user.created_at,
      updated_at: now.getTime(),
    },
  };

  return c.json({
    success: true,
    data: response,
  });
});

/**
 * Logout endpoint - deletes Redis session
 */
auth.post("/logout", jwtAuth, async (c) => {
  const userId = c.get("userId") as string;
  const tokenId = c.get("tokenId") as string;
  const now = new Date();
  const ipAddress = c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "unknown";

  // Delete session from Redis
  await deleteSession(userId, tokenId);

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, ip_address, created_at)
    VALUES (${userId}, 'logout', ${ipAddress}, ${now})
  `;

  logger.info("User logged out: " + userId + ", tokenId: " + tokenId);

  return c.json({
    success: true,
    data: { message: "Logged out successfully" },
  });
});

/**
 * Logout all devices - deletes all user sessions
 */
auth.post("/logout-all", jwtAuth, async (c) => {
  const userId = c.get("userId") as string;
  const tokenId = c.get("tokenId") as string;
  const now = new Date();

  // Delete all sessions for this user
  const deletedCount = await deleteUserSessions(userId);

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, detail, created_at)
    VALUES (${userId}, 'logout_all', ${`deleted ${deletedCount} sessions`}, ${now})
  `;

  logger.info("User logged out all devices: " + userId + ", deleted: " + deletedCount);

  return c.json({
    success: true,
    data: { message: `Logged out from ${deletedCount} devices` },
  });
});

/**
 * Get current user profile
 */
auth.get("/profile", jwtAuth, (c) => {
  const user = c.get("user") as User;

  return c.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      enabled: user.enabled,
      last_login_at: user.last_login_at instanceof Date ? user.last_login_at.getTime() : user.last_login_at,
      created_at: user.created_at instanceof Date ? user.created_at.getTime() : user.created_at,
      updated_at: user.updated_at instanceof Date ? user.updated_at.getTime() : user.updated_at,
    },
  });
});

/**
 * Change password
 */
auth.post("/change-password", jwtAuth, async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json<ChangePasswordInput>();
  const now = new Date();

  const users = await db`SELECT * FROM users WHERE id = ${userId}`;
  const user = users[0] as User | undefined;

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      },
      404
    );
  }

  // Verify old password
  const isValid = await verifyPassword(body.old_password, user.password_hash);
  if (!isValid) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_PASSWORD", message: "Current password is incorrect" },
      },
      400
    );
  }

  // Hash new password
  const newPasswordHash = await hashPassword(body.new_password);

  // Update password
  await db`
    UPDATE users SET password_hash = ${newPasswordHash}, updated_at = ${now} WHERE id = ${userId}
  `;

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, created_at)
    VALUES (${userId}, 'password_change', ${now})
  `;

  logger.info("Password changed: " + userId);

  return c.json({
    success: true,
    data: { message: "Password changed successfully" },
  });
});

// ============================================
// User Management (Admin only)
// ============================================

/**
 * List all users
 */
auth.get("/users", jwtAuth, requireRole("admin"), async (c) => {
  const users = await db`
    SELECT * FROM users ORDER BY created_at DESC
  `;

  const result = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    enabled: Boolean(u.enabled),
    last_login_at: u.last_login_at instanceof Date ? u.last_login_at.getTime() : u.last_login_at,
    created_at: u.created_at instanceof Date ? u.created_at.getTime() : u.created_at,
    updated_at: u.updated_at instanceof Date ? u.updated_at.getTime() : u.updated_at,
  }));

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * Create new user
 */
auth.post("/users", jwtAuth, requireRole("admin"), async (c) => {
  const adminId = c.get("userId") as string;
  const body = await c.req.json<CreateUserInput>();
  const now = new Date();

  // Check if username exists
  const existing = await db`SELECT id FROM users WHERE username = ${body.username}`;

  if (existing.length > 0) {
    return c.json(
      {
        success: false,
        error: { code: "DUPLICATE_USERNAME", message: "Username already exists" },
      },
      409
    );
  }

  // Hash password
  const passwordHash = await hashPassword(body.password);
  const userId = uuidv4();

  await db`
    INSERT INTO users (id, username, password_hash, email, display_name, role, enabled, created_at, updated_at)
    VALUES (${userId}, ${body.username}, ${passwordHash}, ${body.email || null}, ${body.display_name || body.username}, ${body.role || "viewer"}, TRUE, ${now}, ${now})
  `;

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, resource, resource_id, detail, created_at)
    VALUES (${adminId}, 'user_create', 'user', ${userId}, ${body.username}, ${now})
  `;

  logger.info("User created: " + body.username);

  return c.json({
    success: true,
    data: {
      id: userId,
      username: body.username,
      email: body.email,
      display_name: body.display_name || body.username,
      role: body.role || "viewer",
      enabled: true,
      created_at: now.getTime(),
      updated_at: now.getTime(),
    },
  });
});

/**
 * Update user
 */
auth.put("/users/:id", jwtAuth, requireRole("admin"), async (c) => {
  const adminId = c.get("userId") as string;
  const userId = c.req.param("id") as string;
  const body = await c.req.json<UpdateUserInput>();
  const now = new Date();

  const existing = await db`SELECT * FROM users WHERE id = ${userId}`;

  if (existing.length === 0) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      },
      404
    );
  }

  const updateFields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (body.email !== undefined) {
    updateFields.push(`email = $${paramIndex++}`);
    params.push(body.email);
  }
  if (body.display_name !== undefined) {
    updateFields.push(`display_name = $${paramIndex++}`);
    params.push(body.display_name);
  }
  if (body.role !== undefined) {
    updateFields.push(`role = $${paramIndex++}`);
    params.push(body.role);
  }
  if (body.enabled !== undefined) {
    updateFields.push(`enabled = $${paramIndex++}`);
    params.push(body.enabled);
  }

  if (updateFields.length === 0) {
    return c.json(
      {
        success: false,
        error: { code: "NO_UPDATE", message: "No fields to update" },
      },
      400
    );
  }

  updateFields.push(`updated_at = $${paramIndex++}`);
  params.push(now);
  params.push(userId);

  await db.unsafe(`
    UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}
  `, params as (string | number | boolean | null | Date)[]);

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, resource, resource_id, detail, created_at)
    VALUES (${adminId}, 'user_update', 'user', ${userId}, ${JSON.stringify(body)}, ${now})
  `;

  logger.info("User updated: " + userId);

  return c.json({
    success: true,
    data: { id: userId, ...body, updated_at: now.getTime() },
  });
});

/**
 * Delete user - also deletes all their Redis sessions
 */
auth.delete("/users/:id", jwtAuth, requireRole("admin"), async (c) => {
  const adminId = c.get("userId") as string;
  const userId = c.req.param("id") as string;
  const now = new Date();

  const existing = await db`SELECT * FROM users WHERE id = ${userId}`;

  if (existing.length === 0) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      },
      404
    );
  }

  // Prevent deleting self
  if (userId === adminId) {
    return c.json(
      {
        success: false,
        error: { code: "CANNOT_DELETE_SELF", message: "Cannot delete your own account" },
      },
      400
    );
  }

  // Delete user's Redis sessions
  await deleteUserSessions(userId);

  // Delete user
  await db`DELETE FROM users WHERE id = ${userId}`;

  // Audit log
  await db`
    INSERT INTO audit_logs (user_id, action, resource, resource_id, detail, created_at)
    VALUES (${adminId}, 'user_delete', 'user', ${userId}, ${existing[0].username}, ${now})
  `;

  logger.info("User deleted: " + userId);

  return c.json({
    success: true,
    data: { id: userId },
  });
});

// ============================================
// Audit Logs
// ============================================

/**
 * List audit logs (admin only)
 */
auth.get("/audit-logs", jwtAuth, requireRole("admin"), async (c) => {
  const query = c.req.query() as AuditLogQuery;
  const limit = query.limit || 100;
  const offset = query.offset || 0;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.user_id) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(query.user_id);
  }
  if (query.action) {
    conditions.push(`action = $${params.length + 1}`);
    params.push(query.action);
  }
  if (query.start_time) {
    conditions.push(`created_at >= $${params.length + 1}`);
    params.push(new Date(query.start_time));
  }
  if (query.end_time) {
    conditions.push(`created_at < $${params.length + 1}`);
    params.push(new Date(query.end_time));
  }

  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const logs = await db.unsafe(`
    SELECT * FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params as (string | number | boolean | null | Date)[]);

  const formattedLogs = logs.map((l) => ({
    ...l,
    created_at: l.created_at instanceof Date ? l.created_at.getTime() : l.created_at,
  }));

  return c.json({
    success: true,
    data: {
      data: formattedLogs,
      total: logs.length,
      limit,
      offset,
    },
  });
});

export default auth;