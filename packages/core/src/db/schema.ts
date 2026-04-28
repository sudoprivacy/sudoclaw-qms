/**
 * Database schema definitions for PostgreSQL + TimescaleDB
 *
 * Table Types:
 * 1. Regular Tables - Business tables (users, alert_config, etc.)
 * 2. Hypertables - Time-series raw data tables (telemetry_perf_raw, telemetry_errors, etc.)
 * 3. Continuous Aggregates - Materialized views for daily statistics (TimescaleDB)
 *    OR Regular Aggregation Tables - Fallback without TimescaleDB
 */

import { db } from "./index.js";
import { logger } from "../utils/logger.js";

// Track TimescaleDB availability for other modules
let timescaleDBAvailable = false;

/**
 * Check if TimescaleDB is available
 */
export function isTimescaleDBAvailable(): boolean {
  return timescaleDBAvailable;
}

/**
 * Initialize database schema
 */
export async function initSchema(): Promise<void> {
  logger.info("[DB] Creating schema...");

  // ============================================
  // Step 1: Check TimescaleDB availability
  // ============================================

  timescaleDBAvailable = await checkTimescaleDB();

  if (timescaleDBAvailable) {
    logger.info("[DB] TimescaleDB extension available - using hypertables + continuous aggregates");
  } else {
    logger.info("[DB] TimescaleDB extension not available - using regular tables + manual aggregation");
  }

  // ============================================
  // Step 2: Create Regular Tables (Business Tables)
  // These tables don't need TimescaleDB features
  // ============================================

  await createRegularTables();

  // ============================================
  // Step 3: Create Time-Series Raw Data Tables
  // These will be converted to hypertables if TimescaleDB is available
  // ============================================

  await createTimeSeriesTables();

  // ============================================
  // Step 4: Create Aggregation Tables/Views
  // Continuous aggregates (TimescaleDB) or regular tables (fallback)
  // ============================================

  await createAggregationTables();

  // ============================================
  // Step 5: Configure TimescaleDB Policies
  // Only if TimescaleDB is available
  // ============================================

  if (timescaleDBAvailable) {
    await configureTimescaleDBPolicies();
  }

  // ============================================
  // Step 6: Initialize Default Alert Configs
  // ============================================

  await initDefaultAlertConfigs();

  logger.info("[DB] Schema created successfully");
}

/**
 * Check if TimescaleDB extension is available
 */
async function checkTimescaleDB(): Promise<boolean> {
  try {
    // Try to create extension first (requires superuser privilege)
    await db`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`;
    logger.info("[DB] TimescaleDB extension created/enabled");

    const result = await db`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
      ) as available
    `;
    return result[0]?.available ?? false;
  } catch (error) {
    logger.warn("[DB] TimescaleDB extension not available:", error);
    return false;
  }
}

/**
 * Create regular business tables (no TimescaleDB features needed)
 */
async function createRegularTables(): Promise<void> {
  logger.info("[DB] Creating regular business tables...");

  // Alert System Tables
  await db`
    CREATE TABLE IF NOT EXISTS alert_config (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      metric TEXT NOT NULL,
      threshold REAL NOT NULL,
      comparison TEXT NOT NULL,
      level TEXT NOT NULL,
      channels TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      cooldown_minutes INTEGER DEFAULT 30,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_alert_config_enabled ON alert_config(enabled)`;
  await db`CREATE INDEX IF NOT EXISTS idx_alert_config_type ON alert_config(type)`;

  await db`
    CREATE TABLE IF NOT EXISTS alert_history (
      id BIGSERIAL PRIMARY KEY,
      config_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      level TEXT NOT NULL,
      channels TEXT NOT NULL,
      channel_results TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success BOOLEAN DEFAULT TRUE,
      error_message TEXT,
      acknowledged BOOLEAN DEFAULT FALSE,
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by TEXT
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON alert_history(sent_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged ON alert_history(acknowledged)`;
  await db`CREATE INDEX IF NOT EXISTS idx_alert_history_level ON alert_history(level)`;

  // Authentication System Tables
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      enabled BOOLEAN DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_enabled ON users(enabled)`;

  await db`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      resource_id TEXT,
      detail TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`;
  await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`;

  // System Configuration Table
  await db`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Crash Issues Table (aggregation table, not time-series)
  await db`
    CREATE TABLE IF NOT EXISTS crash_issues (
      id SERIAL PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'error',
      count INTEGER NOT NULL DEFAULT 0,
      user_count INTEGER DEFAULT 0,
      first_seen TIMESTAMPTZ NOT NULL,
      last_seen TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'unresolved',
      assigned_to INTEGER,
      first_release TEXT,
      last_release TEXT,
      stack_summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_issues_fingerprint ON crash_issues(fingerprint)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_issues_status ON crash_issues(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_issues_level ON crash_issues(level)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_issues_type ON crash_issues(type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_issues_last_seen ON crash_issues(last_seen DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_issues_count ON crash_issues(count DESC)`;

  // Source Maps Table
  await db`
    CREATE TABLE IF NOT EXISTS source_maps (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      file_name TEXT NOT NULL,
      map_content TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      uploaded_by INTEGER,
      UNIQUE(version, platform, file_name)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_source_maps_version ON source_maps(version)`;
  await db`CREATE INDEX IF NOT EXISTS idx_source_maps_platform ON source_maps(platform)`;

  logger.info("[DB] Regular business tables created");
}

/**
 * Create time-series raw data tables
 * These store incoming telemetry data
 */
async function createTimeSeriesTables(): Promise<void> {
  logger.info("[DB] Creating time-series raw data tables...");

  // Telemetry Performance Raw
  // TimescaleDB requires partition column in primary key, so use composite key
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_perf_raw (
      id BIGSERIAL,
      timestamp TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      metric TEXT NOT NULL,
      value_ms BIGINT NOT NULL,
      session_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, timestamp)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_perf_raw_timestamp ON telemetry_perf_raw(timestamp DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_perf_raw_version ON telemetry_perf_raw(version)`;
  await db`CREATE INDEX IF NOT EXISTS idx_perf_raw_metric ON telemetry_perf_raw(metric)`;
  await db`CREATE INDEX IF NOT EXISTS idx_perf_raw_created_at ON telemetry_perf_raw(created_at DESC)`;

  // Telemetry Conversations Raw
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_conversations (
      id BIGSERIAL,
      timestamp TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      session_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_provider TEXT,
      status TEXT NOT NULL,
      duration_ms BIGINT NOT NULL,
      tokens_used INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, timestamp),
      UNIQUE (session_id, timestamp)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON telemetry_conversations(timestamp DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversations_status ON telemetry_conversations(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversations_error_code ON telemetry_conversations(error_code)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON telemetry_conversations(created_at DESC)`;

  // Telemetry Install Raw
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_install (
      install_id TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      status TEXT NOT NULL,
      duration_ms BIGINT NOT NULL,
      install_type TEXT,
      previous_version TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (install_id, timestamp)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_install_timestamp ON telemetry_install(timestamp DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_install_status ON telemetry_install(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_install_created_at ON telemetry_install(created_at DESC)`;

  // Crash Events Raw
  await db`
    CREATE TABLE IF NOT EXISTS crash_events (
      id BIGSERIAL,
      timestamp TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      process_type TEXT NOT NULL,
      type TEXT NOT NULL,
      crash_reason TEXT,
      exit_code INTEGER,
      signal TEXT,
      error_name TEXT,
      error_message TEXT,
      stack_trace TEXT,
      context JSONB,
      release TEXT,
      environment TEXT,
      fingerprint TEXT NOT NULL,
      issue_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, timestamp)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_timestamp ON crash_events(timestamp DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_type ON crash_events(type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_fingerprint ON crash_events(fingerprint)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_issue_id ON crash_events(issue_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_version ON crash_events(version)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_platform ON crash_events(platform)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_process_type ON crash_events(process_type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_events_created_at ON crash_events(created_at DESC)`;

  // Crash Daily Stats (aggregation table for non-TimescaleDB fallback)
  await db`
    CREATE TABLE IF NOT EXISTS crash_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      bucket TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bucket, version, platform, type)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_daily_stats_bucket ON crash_daily_stats(bucket DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_daily_stats_version ON crash_daily_stats(version)`;
  await db`CREATE INDEX IF NOT EXISTS idx_crash_daily_stats_type ON crash_daily_stats(type)`;

  // Convert to hypertables if TimescaleDB is available
  if (timescaleDBAvailable) {
    await convertToHypertables();
  }

  logger.info("[DB] Time-series raw data tables created");
}

/**
 * Convert time-series tables to hypertables
 */
async function convertToHypertables(): Promise<void> {
  logger.info("[DB] Converting tables to hypertables...");

  // Telemetry tables
  await db`SELECT create_hypertable('telemetry_perf_raw', 'timestamp', if_not_exists => TRUE)`;
  await db`SELECT create_hypertable('telemetry_conversations', 'timestamp', if_not_exists => TRUE)`;
  await db`SELECT create_hypertable('telemetry_install', 'timestamp', if_not_exists => TRUE)`;

  // Crash events table
  await db`SELECT create_hypertable('crash_events', 'timestamp', if_not_exists => TRUE)`;

  logger.info("[DB] Hypertables created successfully");
}

/**
 * Create aggregation tables or continuous aggregates
 */
async function createAggregationTables(): Promise<void> {
  if (timescaleDBAvailable) {
    await createContinuousAggregates();
  } else {
    await createRegularAggregationTables();
  }
}

/**
 * Create TimescaleDB continuous aggregates
 */
export async function createContinuousAggregates(): Promise<void> {
  logger.info("[DB] Creating continuous aggregates...");

  // Performance daily aggregate
  await db`
    CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_perf_daily
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', timestamp) AS bucket,
      version,
      platform,
      arch,
      metric,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY value_ms) as p50,
      percentile_cont(0.90) WITHIN GROUP (ORDER BY value_ms) as p90,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms) as p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY value_ms) as p99,
      MIN(value_ms) as min_value,
      MAX(value_ms) as max_value,
      AVG(value_ms)::BIGINT as avg_value,
      COUNT(*) as count
    FROM telemetry_perf_raw
    GROUP BY bucket, version, platform, arch, metric
    WITH NO DATA
  `;

  // Conversations daily aggregate
  await db`
    CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_conversations_daily
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', timestamp) AS bucket,
      version,
      platform,
      arch,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN status = 'user_cancel' THEN 1 ELSE 0 END) as user_cancel_count,
      COUNT(*) as total_count,
      AVG(duration_ms)::BIGINT as avg_duration_ms,
      AVG(tokens_used)::BIGINT as avg_tokens,
      ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100) as success_rate,
      ROUND((SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100) as error_rate
    FROM telemetry_conversations
    GROUP BY bucket, version, platform, arch
    WITH NO DATA
  `;

  // Conversation errors daily aggregate (by error_code)
  await db`
    CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_conversation_errors_daily
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', timestamp) AS bucket,
      version,
      platform,
      arch,
      error_code,
      COUNT(*) as count
    FROM telemetry_conversations
    WHERE status = 'error' AND error_code IS NOT NULL
    GROUP BY bucket, version, platform, arch, error_code
    WITH NO DATA
  `;

  // Install daily aggregate
  await db`
    CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_install_daily
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', timestamp) AS bucket,
      version,
      platform,
      arch,
      install_type,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
      COUNT(*) as total_count,
      AVG(duration_ms)::BIGINT as avg_duration_ms,
      ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100) as success_rate
    FROM telemetry_install
    GROUP BY bucket, version, platform, arch, install_type
    WITH NO DATA
  `;

  logger.info("[DB] Continuous aggregates created successfully");
}

/**
 * Create regular aggregation tables (fallback without TimescaleDB)
 */
async function createRegularAggregationTables(): Promise<void> {
  logger.info("[DB] Creating regular aggregation tables...");

  // Performance daily
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_perf_daily (
      id BIGSERIAL PRIMARY KEY,
      bucket TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      metric TEXT NOT NULL,
      p50 BIGINT NOT NULL,
      p90 BIGINT NOT NULL,
      p95 BIGINT NOT NULL,
      p99 BIGINT,
      min_value BIGINT NOT NULL,
      max_value BIGINT NOT NULL,
      avg_value BIGINT NOT NULL,
      count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bucket, version, platform, arch, metric)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_perf_daily_bucket ON telemetry_perf_daily(bucket DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_perf_daily_metric ON telemetry_perf_daily(metric)`;

  // Conversations daily
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_conversations_daily (
      id BIGSERIAL PRIMARY KEY,
      bucket TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      success_count INTEGER NOT NULL,
      error_count INTEGER NOT NULL,
      user_cancel_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      avg_duration_ms BIGINT NOT NULL,
      avg_tokens INTEGER,
      success_rate INTEGER NOT NULL,
      error_rate INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bucket, version, platform, arch)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_conversations_daily_bucket ON telemetry_conversations_daily(bucket DESC)`;

  // Conversation errors daily (by error_code)
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_conversation_errors_daily (
      id BIGSERIAL PRIMARY KEY,
      bucket TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      error_code TEXT NOT NULL,
      count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bucket, version, platform, arch, error_code)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_conversation_errors_daily_bucket ON telemetry_conversation_errors_daily(bucket DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversation_errors_daily_error_code ON telemetry_conversation_errors_daily(error_code)`;

  // Install daily
  await db`
    CREATE TABLE IF NOT EXISTS telemetry_install_daily (
      id BIGSERIAL PRIMARY KEY,
      bucket TIMESTAMPTZ NOT NULL,
      version TEXT NOT NULL,
      platform TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'unknown',
      install_type TEXT NOT NULL,
      success_count INTEGER NOT NULL,
      failed_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      avg_duration_ms BIGINT NOT NULL,
      success_rate INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bucket, version, platform, arch, install_type)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_install_daily_bucket ON telemetry_install_daily(bucket DESC)`;

  logger.info("[DB] Regular aggregation tables created");
}

/**
 * Configure TimescaleDB policies (compression, retention, refresh)
 */
async function configureTimescaleDBPolicies(): Promise<void> {
  logger.info("[DB] Configuring TimescaleDB policies...");

  // Compression settings
  await db`
    ALTER TABLE telemetry_perf_raw SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'metric,platform,version',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `;
  await db`
    ALTER TABLE telemetry_conversations SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'platform,version',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `;
  await db`
    ALTER TABLE telemetry_install SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'platform,version',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `;
  await db`
    ALTER TABLE crash_events SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'type,platform,version',
      timescaledb.compress_orderby = 'timestamp DESC'
    )
  `;

  // Compression policies (compress data older than 7 days)
  await db`SELECT add_compression_policy('telemetry_perf_raw', INTERVAL '7 days', if_not_exists => TRUE)`;
  await db`SELECT add_compression_policy('telemetry_conversations', INTERVAL '7 days', if_not_exists => TRUE)`;
  await db`SELECT add_compression_policy('telemetry_install', INTERVAL '7 days', if_not_exists => TRUE)`;
  await db`SELECT add_compression_policy('crash_events', INTERVAL '7 days', if_not_exists => TRUE)`;

  // Retention policies (delete raw data after retention period)
  await db`SELECT add_retention_policy('telemetry_perf_raw', INTERVAL '90 days', if_not_exists => TRUE)`;
  await db`SELECT add_retention_policy('telemetry_install', INTERVAL '90 days', if_not_exists => TRUE)`;
  await db`SELECT add_retention_policy('telemetry_conversations', INTERVAL '180 days', if_not_exists => TRUE)`;
  await db`SELECT add_retention_policy('crash_events', INTERVAL '90 days', if_not_exists => TRUE)`;

  // Aggregation retention (keep aggregated data longer)
  await db`SELECT add_retention_policy('telemetry_perf_daily', INTERVAL '365 days', if_not_exists => TRUE)`;
  await db`SELECT add_retention_policy('telemetry_conversations_daily', INTERVAL '365 days', if_not_exists => TRUE)`;
  await db`SELECT add_retention_policy('telemetry_conversation_errors_daily', INTERVAL '365 days', if_not_exists => TRUE)`;
  await db`SELECT add_retention_policy('telemetry_install_daily', INTERVAL '365 days', if_not_exists => TRUE)`;

  // Continuous aggregate refresh policies
  await db`
    SELECT add_continuous_aggregate_policy('telemetry_perf_daily',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `;
  await db`
    SELECT add_continuous_aggregate_policy('telemetry_conversations_daily',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `;
  await db`
    SELECT add_continuous_aggregate_policy('telemetry_conversation_errors_daily',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `;
  await db`
    SELECT add_continuous_aggregate_policy('telemetry_install_daily',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `;

  logger.info("[DB] TimescaleDB policies configured");
}

/**
 * Initialize Crash schema (deprecated - now included in main schema)
 * Kept for backward compatibility
 */
export async function initCrashSchema(): Promise<void> {
  logger.info("[DB] Crash schema already included in main schema, skipping...");
}

/**
 * Initialize default alert configurations
 * Creates sample alert configs for common use cases (disabled by default)
 */
async function initDefaultAlertConfigs(): Promise<void> {
  logger.info("[DB] Initializing default alert configs...");

  const defaultConfigs = [
    // Performance alerts
    {
      id: "alert-perf-cold-start",
      name: "冷启动时间过长",
      type: "perf",
      metric: "cold_start",
      threshold: 3000,
      comparison: "gt",
      level: "warning",
      channels: JSON.stringify(["lark"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当冷启动时间超过3秒时触发告警",
    },
    {
      id: "alert-perf-first-token",
      name: "首Token响应时间过长",
      type: "perf",
      metric: "first_token",
      threshold: 2000,
      comparison: "gt",
      level: "warning",
      channels: JSON.stringify(["lark"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当首Token响应时间超过2秒时触发告警",
    },
    // Error alerts
    {
      id: "alert-error-count",
      name: "对话错误数量过多",
      type: "error",
      metric: "error_count",
      threshold: 50,
      comparison: "gte",
      level: "critical",
      channels: JSON.stringify(["lark", "email"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当最近5分钟内对话错误数量超过50次时触发告警",
    },
    {
      id: "alert-error-rate",
      name: "对话错误率过高",
      type: "error",
      metric: "error_rate",
      threshold: 10,
      comparison: "gte",
      level: "critical",
      channels: JSON.stringify(["lark", "email"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当对话错误率超过10%时触发告警",
    },

    // Conversation alerts
    {
      id: "alert-conv-duration",
      name: "对话响应时间过长",
      type: "conversation",
      metric: "avg_duration",
      threshold: 5000,
      comparison: "gt",
      level: "warning",
      channels: JSON.stringify(["lark"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当平均对话时长超过5秒时触发告警",
    },
    {
      id: "alert-conv-error-rate",
      name: "对话错误率告警",
      type: "conversation",
      metric: "error_rate",
      threshold: 5,
      comparison: "gte",
      level: "warning",
      channels: JSON.stringify(["lark"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当对话错误率超过5%时触发告警",
    },

    // Install alerts
    {
      id: "alert-install-failure",
      name: "安装失败数量过多",
      type: "install",
      metric: "failure_count",
      threshold: 5,
      comparison: "gte",
      level: "critical",
      channels: JSON.stringify(["lark", "email"]),
      enabled: false,
      cooldown_minutes: 60,
      description: "当最近5分钟内安装失败数量超过5次时触发告警",
    },

    // Crash alerts
    {
      id: "alert-crash-count",
      name: "崩溃事件数量过多",
      type: "crash",
      metric: "crash_count",
      threshold: 10,
      comparison: "gte",
      level: "critical",
      channels: JSON.stringify(["lark", "email"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当最近5分钟内崩溃事件超过10次时触发告警",
    },
    {
      id: "alert-crash-native",
      name: "原生崩溃数量过多",
      type: "crash",
      metric: "native_crash_count",
      threshold: 3,
      comparison: "gte",
      level: "critical",
      channels: JSON.stringify(["lark", "email"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当最近5分钟内原生崩溃超过3次时触发告警",
    },
    {
      id: "alert-crash-js",
      name: "JS异常数量过多",
      type: "crash",
      metric: "js_exception_count",
      threshold: 5,
      comparison: "gte",
      level: "warning",
      channels: JSON.stringify(["lark"]),
      enabled: false,
      cooldown_minutes: 30,
      description: "当最近5分钟内JS异常超过5次时触发告警",
    },
  ];

  const now = new Date();

  for (const config of defaultConfigs) {
    // Check if config already exists
    const existing = await db`
      SELECT id FROM alert_config WHERE id = ${config.id}
    `;

    if (existing.length === 0) {
      await db`
        INSERT INTO alert_config (
          id, name, type, metric, threshold, comparison, level, channels,
          enabled, cooldown_minutes, description, created_at, updated_at
        )
        VALUES (
          ${config.id}, ${config.name}, ${config.type}, ${config.metric},
          ${config.threshold}, ${config.comparison}, ${config.level},
          ${config.channels}, ${config.enabled}, ${config.cooldown_minutes},
          ${config.description}, ${now}, ${now}
        )
      `;
    }
  }

  logger.info("[DB] Default alert configs initialized");
}