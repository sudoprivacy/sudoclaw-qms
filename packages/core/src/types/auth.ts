/**
 * Authentication type definitions
 */

// ============================================
// User Types
// ============================================

export type UserRole = "admin" | "operator" | "viewer";

export interface User {
  id: string;
  username: string;
  password_hash: string;  // 包含密码哈希，用于验证
  email?: string;
  display_name?: string;
  role: UserRole;
  enabled: boolean | number;  // PostgreSQL 可能返回 number (0/1)
  last_login_at?: number | Date;
  created_at: number | Date;
  updated_at: number | Date;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  display_name?: string;
  role?: UserRole;
  enabled?: boolean;
}

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
}

// ============================================
// Session Types
// ============================================

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: number;
  created_at: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_at: number;
  user: Omit<User, "password_hash">;
}

// ============================================
// Audit Log Types
// ============================================

export type AuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "password_change"
  | "user_create"
  | "user_update"
  | "user_delete"
  | "config_update"
  | "alert_create"
  | "alert_update"
  | "alert_delete"
  | "alert_test";

export interface AuditLog {
  id: number;
  user_id?: string;
  action: AuditAction;
  resource?: string;
  resource_id?: string;
  detail?: string;
  ip_address?: string;
  created_at: number;
}

export interface AuditLogQuery {
  user_id?: string;
  action?: AuditAction;
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
}

// ============================================
// JWT Types
// ============================================

export interface JwtPayload {
  user_id: string;
  username: string;
  role: UserRole;
  token_id: string;  // Unique session identifier
  iat: number;
  exp: number;
}

// ============================================
// Auth Context Types
// ============================================

export interface AuthContext {
  user: User;
  session_id: string;
}