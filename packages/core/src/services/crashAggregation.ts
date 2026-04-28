/**
 * Crash aggregation service
 * Handles crash event processing and issue aggregation
 */

import { createHash } from "crypto";
import { db } from "../db/index.js";
import { logger } from "../utils/logger.js";
import type {
  CrashEvent,
  CrashIssue,
  CrashIssueQueryOptions,
  CrashEventQueryOptions,
  CrashStatsSummary,
  CrashTrendItem,
  CrashDistributionItem,
} from "../types/crash.js";

/**
 * Generate fingerprint for crash aggregation
 */
export function generateFingerprint(event: CrashEvent): string {
  if (event.type === "native_crash" || event.type === "renderer_crash") {
    const stackLines = event.stack_trace?.split("\n").slice(0, 3).join("\n") || "";
    return `${event.crash_reason || "unknown"}:${hashString(stackLines)}`;
  }

  if (event.type === "js_exception") {
    const normalizedStack = normalizeStackTrace(event.stack_trace);
    return `${event.error_name || "Error"}:${hashString(normalizedStack)}`;
  }

  return `${event.type}:${hashString(event.error_message || "unknown")}`;
}

/**
 * Normalize stack trace
 */
function normalizeStackTrace(stack?: string): string {
  if (!stack) return "";
  return stack
    .split("\n")
    .map((line) => line.replace(/:(\d+):(\d+)\)?$/, ")"))
    .slice(0, 10)
    .join("\n");
}

/**
 * Hash utility
 */
function hashString(str: string): string {
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

/**
 * Generate issue title
 */
export function generateIssueTitle(event: CrashEvent): string {
  if (event.type === "native_crash" || event.type === "renderer_crash") {
    return `Native Crash: ${event.crash_reason || "Unknown"}`;
  }

  if (event.type === "js_exception") {
    const msg = event.error_message?.slice(0, 80) || "Unknown";
    return `${event.error_name || "Error"}: ${msg}`;
  }

  return `Crash: ${event.type}`;
}

/**
 * Determine issue level
 */
export function determineIssueLevel(event: CrashEvent): "fatal" | "error" | "warning" {
  if (event.type === "native_crash" || event.type === "renderer_crash") {
    return "fatal";
  }
  return "error";
}

/**
 * Process crash event (auto aggregate into issue)
 */
export async function processCrashEvent(event: CrashEvent, fingerprint: string): Promise<number> {
  const timestamp = new Date(event.timestamp);
  const release = event.release || event.version;

  // Check for existing issue
  const existingIssue = await db`
    SELECT id, count FROM crash_issues WHERE fingerprint = ${fingerprint}
  `;

  if (existingIssue.length > 0) {
    const issue = existingIssue[0];
    await db`
      UPDATE crash_issues
      SET count = count + 1, last_seen = ${timestamp}, last_release = ${release}, updated_at = NOW()
      WHERE id = ${issue.id}
    `;

    logger.info(`[Crash] Issue #${issue.id} updated, count: ${issue.count + 1}`);
    return issue.id;
  }

  // Create new issue
  const title = generateIssueTitle(event);
  const level = determineIssueLevel(event);
  const stackSummary = event.stack_trace?.slice(0, 500) || null;

  const result = await db`
    INSERT INTO crash_issues (fingerprint, title, type, level, count, first_seen, last_seen, first_release, last_release, stack_summary, status, created_at, updated_at)
    VALUES (${fingerprint}, ${title}, ${event.type}, ${level}, 1, ${timestamp}, ${timestamp}, ${release}, ${release}, ${stackSummary}, 'unresolved', NOW(), NOW())
    RETURNING id
  `;

  const issueId = result[0].id;
  logger.info(`[Crash] New issue #${issueId} created: ${title}`);
  return issueId;
}

/**
 * Insert crash event
 */
export async function insertCrashEvent(event: CrashEvent, fingerprint: string, issueId: number): Promise<void> {
  await db`
    INSERT INTO crash_events (timestamp, version, platform, arch, process_type, type, crash_reason, exit_code, signal, error_name, error_message, stack_trace, context, release, environment, fingerprint, issue_id, created_at)
    VALUES (
      ${new Date(event.timestamp)},
      ${event.version},
      ${event.platform},
      ${event.arch ?? "unknown"},
      ${event.process_type},
      ${event.type},
      ${event.crash_reason ?? null},
      ${event.exit_code ?? null},
      ${event.signal ?? null},
      ${event.error_name ?? null},
      ${event.error_message ?? null},
      ${event.stack_trace ?? null},
      ${event.context ? JSON.stringify(event.context) : null},
      ${event.release ?? null},
      ${event.environment ?? null},
      ${fingerprint},
      ${issueId},
      NOW()
    )
  `;
}

/**
 * Get crash issues list
 */
export async function getCrashIssues(options: CrashIssueQueryOptions = {}): Promise<CrashIssue[]> {
  const { status, level, type, version, limit = 50, offset = 0 } = options;

  // Build query conditions
  let query = db`
    SELECT * FROM crash_issues
    WHERE 1=1
  `;

  if (status) {
    query = db`SELECT * FROM crash_issues WHERE status = ${status}`;
  }

  // For complex conditions, use raw query
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = $1");
    params.push(status);
  }
  if (level) {
    conditions.push(`level = $${params.length + 1}`);
    params.push(level);
  }
  if (type) {
    conditions.push(`type = $${params.length + 1}`);
    params.push(type);
  }
  if (version) {
    conditions.push(`(first_release = $${params.length + 1} OR last_release = $${params.length + 1})`);
    params.push(version, version);
  }

  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const issues = await db.unsafe(`
    SELECT * FROM crash_issues
    ${whereClause}
    ORDER BY last_seen DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params as (string | number | boolean | null | Date)[]);

  return issues as unknown as CrashIssue[];
}

/**
 * Get crash issue by ID
 */
export async function getCrashIssueById(id: number): Promise<CrashIssue | undefined> {
  const result = await db`SELECT * FROM crash_issues WHERE id = ${id}`;
  return result[0] as CrashIssue | undefined;
}

/**
 * Get crash issue by fingerprint
 */
export async function getCrashIssueByFingerprint(fingerprint: string): Promise<CrashIssue | undefined> {
  const result = await db`SELECT * FROM crash_issues WHERE fingerprint = ${fingerprint}`;
  return result[0] as CrashIssue | undefined;
}

/**
 * Update crash issue
 */
export async function updateCrashIssue(id: number, updates: { status?: string; assigned_to?: number }): Promise<boolean> {
  const issue = await getCrashIssueById(id);
  if (!issue) return false;

  const updateFields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.status) {
    updateFields.push(`status = $${paramIndex++}`);
    params.push(updates.status);
  }
  if (updates.assigned_to !== undefined) {
    updateFields.push(`assigned_to = $${paramIndex++}`);
    params.push(updates.assigned_to);
  }

  if (updateFields.length === 0) return false;

  updateFields.push(`updated_at = $${paramIndex++}`);
  params.push(new Date());
  params.push(id);

  await db.unsafe(`
    UPDATE crash_issues SET ${updateFields.join(", ")} WHERE id = $${paramIndex}
  `, params as (string | number | boolean | null | Date)[]);

  logger.info(`[Crash] Issue #${id} updated`);
  return true;
}

/**
 * Get crash events list
 */
export async function getCrashEvents(options: CrashEventQueryOptions = {}): Promise<unknown[]> {
  const { issue_id, version, platform, type, limit = 100, offset = 0 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (issue_id) {
    conditions.push(`e.issue_id = $${params.length + 1}`);
    params.push(issue_id);
  }
  if (version) {
    conditions.push(`e.version = $${params.length + 1}`);
    params.push(version);
  }
  if (platform) {
    conditions.push(`e.platform = $${params.length + 1}`);
    params.push(platform);
  }
  if (type) {
    conditions.push(`e.type = $${params.length + 1}`);
    params.push(type);
  }

  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "WHERE 1=1";

  const events = await db.unsafe(`
    SELECT e.*, i.title as issue_title, i.level as issue_level, i.status as issue_status
    FROM crash_events e
    LEFT JOIN crash_issues i ON e.issue_id = i.id
    ${whereClause}
    ORDER BY e.timestamp DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params as (string | number | boolean | null | Date)[]);

  return events;
}

/**
 * Get crash event by ID
 */
export async function getCrashEventById(id: number): Promise<unknown | undefined> {
  const result = await db`
    SELECT e.*, i.title as issue_title, i.level as issue_level, i.status as issue_status
    FROM crash_events e
    LEFT JOIN crash_issues i ON e.issue_id = i.id
    WHERE e.id = ${id}
  `;
  return result[0];
}

/**
 * Get crash statistics summary
 */
export async function getCrashStatsSummary(): Promise<CrashStatsSummary> {
  const now = new Date();
  const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalResult] = await db`SELECT COUNT(*) as count FROM crash_events`;
  const [unresolvedResult] = await db`SELECT COUNT(*) as count FROM crash_issues WHERE status = 'unresolved'`;
  const [fatalResult] = await db`SELECT COUNT(*) as count FROM crash_issues WHERE level = 'fatal'`;
  const [errorResult] = await db`SELECT COUNT(*) as count FROM crash_issues WHERE level = 'error'`;
  const [recent24hResult] = await db`SELECT COUNT(*) as count FROM crash_events WHERE timestamp >= ${day24hAgo}`;
  const [recent7dResult] = await db`SELECT COUNT(*) as count FROM crash_events WHERE timestamp >= ${day7dAgo}`;

  return {
    total_events: totalResult?.count ?? 0,
    unresolved_issues: unresolvedResult?.count ?? 0,
    fatal_issues: fatalResult?.count ?? 0,
    error_issues: errorResult?.count ?? 0,
    recent_24h: recent24hResult?.count ?? 0,
    recent_7d: recent7dResult?.count ?? 0,
  };
}

/**
 * Get crash trend
 */
export async function getCrashTrend(days: number = 7): Promise<CrashTrendItem[]> {
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const startDateStr = startTime.toISOString().split("T")[0];

  const result = await db`
    SELECT bucket as date, type, SUM(count) as count
    FROM crash_daily_stats
    WHERE bucket >= ${startDateStr}
    GROUP BY bucket, type
    ORDER BY bucket ASC
  `;

  return result.map((r) => ({
    date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : r.date,
    type: r.type,
    count: r.count,
  })) as CrashTrendItem[];
}

/**
 * Get crash distribution
 */
export async function getCrashDistribution(by: "version" | "platform" | "type"): Promise<CrashDistributionItem[]> {
  const [totalResult] = await db`SELECT COUNT(*) as count FROM crash_events`;
  const total = totalResult?.count ?? 0;

  if (total === 0) return [];

  const results = await db.unsafe(`
    SELECT ${by} as key, COUNT(*) as count
    FROM crash_events
    GROUP BY ${by}
    ORDER BY count DESC
    LIMIT 10
  `);

  return results.map((r) => ({
    key: r.key,
    count: r.count,
    percentage: Math.round((r.count / total) * 100),
  })) as CrashDistributionItem[];
}

/**
 * Aggregate crash daily stats (manual, for non-TimescaleDB)
 * TimescaleDB handles this automatically when available
 */
export async function aggregateCrashDailyStats(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const bucket = new Date(yesterday.toISOString().split("T")[0]);

  const dayStart = new Date(bucket);
  const dayEnd = new Date(bucket);
  dayEnd.setHours(23, 59, 59, 999);

  logger.info(`[Crash] Aggregating daily stats for ${bucket.toISOString().split("T")[0]}`);

  const aggregated = await db`
    SELECT version, platform, type, COUNT(*) as count
    FROM crash_events
    WHERE timestamp >= ${dayStart} AND timestamp < ${dayEnd}
    GROUP BY version, platform, type
  `;

  for (const row of aggregated) {
    await db`
      INSERT INTO crash_daily_stats (bucket, version, platform, type, count, created_at)
      VALUES (${bucket}, ${row.version}, ${row.platform}, ${row.type}, ${row.count}, NOW())
      ON CONFLICT (bucket, version, platform, type) DO UPDATE SET count = ${row.count}, created_at = NOW()
    `;
  }

  logger.info(`[Crash] Daily stats aggregated: ${aggregated.length} records`);
}

/**
 * Cleanup old crash events (manual, for non-TimescaleDB)
 */
export async function cleanupOldCrashEvents(retentionDays: number = 90): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db`DELETE FROM crash_events WHERE created_at < ${cutoff}`;

  logger.info(`[Crash] Deleted ${result.count} old crash events (${retentionDays} days retention)`);

  // Remove orphaned issues (no events associated)
  await db`
    DELETE FROM crash_issues
    WHERE id NOT IN (SELECT DISTINCT issue_id FROM crash_events WHERE issue_id IS NOT NULL)
  `;
}

/**
 * Get issue count by status
 */
export async function getIssueCountByStatus(): Promise<Record<string, number>> {
  const results = await db`
    SELECT status, COUNT(*) as count FROM crash_issues GROUP BY status
  `;
  return Object.fromEntries(results.map((r) => [r.status, r.count]));
}

/**
 * Get issue count by level
 */
export async function getIssueCountByLevel(): Promise<Record<string, number>> {
  const results = await db`
    SELECT level, COUNT(*) as count FROM crash_issues GROUP BY level
  `;
  return Object.fromEntries(results.map((r) => [r.level, r.count]));
}