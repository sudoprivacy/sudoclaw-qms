/**
 * Telemetry aggregation service
 *
 * Two modes:
 * 1. TimescaleDB mode: Continuous aggregates auto-refresh (no manual work needed)
 * 2. Regular mode: Manual aggregation via scheduled task
 */

import { db } from "../db/index.js";
import { isTimescaleDBAvailable } from "../db/schema.js";
import { logger } from "../utils/logger.js";

/**
 * Check if a table is a TimescaleDB continuous aggregate (materialized view)
 */
async function isContinuousAggregate(tableName: string): Promise<boolean> {
  try {
    const result = await db`
      SELECT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = ${tableName}
      ) as is_cagg
    `;
    return result[0]?.is_cagg ?? false;
  } catch {
    // If timescaledb_information schema doesn't exist, it's not a continuous aggregate
    return false;
  }
}

/**
 * Check if aggregation is handled by TimescaleDB continuous aggregates
 */
async function isUsingContinuousAggregates(): Promise<boolean> {
  if (!isTimescaleDBAvailable()) {
    return false;
  }

  // Check if all daily tables are continuous aggregates
  const tables = [
    "telemetry_perf_daily",
    "telemetry_conversations_daily",
    "telemetry_conversation_errors_daily",
    "telemetry_install_daily",
  ];

  for (const table of tables) {
    if (!await isContinuousAggregate(table)) {
      return false;
    }
  }

  return true;
}

class AggregationService {
  /**
   * Refresh continuous aggregates or run manual aggregation
   * Called by scheduled task every hour
   */
  async refreshContinuousAggregates(): Promise<void> {
    const usingCagg = await isUsingContinuousAggregates();

    if (!usingCagg) {
      logger.info("[Aggregation] Not using continuous aggregates, running manual aggregation...");
      await this.runManualAggregation();
      return;
    }

    logger.info("[Aggregation] Refreshing continuous aggregates...");

    try {
      // TimescaleDB auto-refreshes based on policy, but we can trigger manual refresh
      await db`CALL refresh_continuous_aggregate('telemetry_perf_daily', NULL, NULL)`;
      await db`CALL refresh_continuous_aggregate('telemetry_conversations_daily', NULL, NULL)`;
      await db`CALL refresh_continuous_aggregate('telemetry_conversation_errors_daily', NULL, NULL)`;
      await db`CALL refresh_continuous_aggregate('telemetry_install_daily', NULL, NULL)`;

      logger.info("[Aggregation] Continuous aggregates refreshed");
    } catch (error) {
      logger.warn("[Aggregation] Refresh failed (may be auto-refreshed):", error);
    }
  }

  /**
   * Manual aggregation for regular tables mode
   * Aggregates today's and yesterday's data into daily tables
   * Today's aggregation covers data up to the current hour
   */
  async runManualAggregation(): Promise<void> {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    logger.info(`[Aggregation] Running manual aggregation for ${yesterdayStr} and ${todayStr}`);

    // Aggregate yesterday (complete day)
    const yesterdayBucket = new Date(yesterdayStr);
    const yesterdayStart = new Date(yesterdayBucket);
    const yesterdayEnd = new Date(yesterdayBucket);
    yesterdayEnd.setHours(23, 59, 59, 999);

    await this.aggregatePerfData(yesterdayBucket, yesterdayStart, yesterdayEnd);
    await this.aggregateConversationData(yesterdayBucket, yesterdayStart, yesterdayEnd);
    await this.aggregateConversationErrorData(yesterdayBucket, yesterdayStart, yesterdayEnd);
    await this.aggregateInstallData(yesterdayBucket, yesterdayStart, yesterdayEnd);

    // Aggregate today (up to current time for near-real-time visibility)
    const todayBucket = new Date(todayStr);
    const todayStart = new Date(todayBucket);
    const todayEnd = now;

    await this.aggregatePerfData(todayBucket, todayStart, todayEnd);
    await this.aggregateConversationData(todayBucket, todayStart, todayEnd);
    await this.aggregateConversationErrorData(todayBucket, todayStart, todayEnd);
    await this.aggregateInstallData(todayBucket, todayStart, todayEnd);

    logger.info("[Aggregation] Manual aggregation completed");
  }

  /**
   * Aggregate performance data for a specific day
   */
  private async aggregatePerfData(bucket: Date, dayStart: Date, dayEnd: Date): Promise<void> {
    const rawData = await db`
      SELECT version, platform, arch, metric, value_ms
      FROM telemetry_perf_raw
      WHERE created_at >= ${dayStart} AND created_at < ${dayEnd}
    `;

    if (rawData.length === 0) {
      logger.info("[Aggregation] Performance: no data for this period");
      return;
    }

    // Group and calculate percentiles
    const groups: Record<string, number[]> = {};

    for (const row of rawData) {
      const key = `${row.version}|${row.platform}|${row.arch}|${row.metric}`;
      if (!groups[key]) groups[key] = [];
      // Convert BIGINT string to number
      groups[key].push(Number(row.value_ms));
    }

    // Insert aggregated data
    for (const [key, values] of Object.entries(groups)) {
      const [version, platform, arch, metric] = key.split("|");
      const sorted = values.sort((a, b) => a - b);

      const p50 = sorted[Math.floor(sorted.length * 0.50)];
      const p90 = sorted[Math.floor(sorted.length * 0.90)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      const count = values.length;

      await db`
        INSERT INTO telemetry_perf_daily (bucket, version, platform, arch, metric, p50, p90, p95, p99, min_value, max_value, avg_value, count, created_at)
        VALUES (${bucket}, ${version}, ${platform}, ${arch}, ${metric}, ${p50}, ${p90}, ${p95}, ${p99}, ${min}, ${max}, ${avg}, ${count}, NOW())
        ON CONFLICT (bucket, version, platform, arch, metric) DO UPDATE SET
          p50 = ${p50}, p90 = ${p90}, p95 = ${p95}, p99 = ${p99},
          min_value = ${min}, max_value = ${max}, avg_value = ${avg}, count = ${count}, created_at = NOW()
      `;
    }

    logger.info(`[Aggregation] Performance: ${Object.keys(groups).length} groups`);
  }

  /**
   * Aggregate conversation data for a specific day
   */
  private async aggregateConversationData(bucket: Date, dayStart: Date, dayEnd: Date): Promise<void> {
    const aggregated = await db`
      SELECT
        version,
        platform,
        arch,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN status = 'user_cancel' THEN 1 ELSE 0 END) as user_cancel_count,
        COUNT(*) as total_count,
        AVG(duration_ms)::INTEGER as avg_duration_ms,
        AVG(tokens_used)::INTEGER as avg_tokens
      FROM telemetry_conversations
      WHERE created_at >= ${dayStart} AND created_at < ${dayEnd}
      GROUP BY version, platform, arch
    `;

    if (aggregated.length === 0) {
      logger.info("[Aggregation] Conversations: no data for this period");
      return;
    }

    for (const row of aggregated) {
      const successRate = Math.round((row.success_count / row.total_count) * 100);
      const errorRate = Math.round((row.error_count / row.total_count) * 100);

      await db`
        INSERT INTO telemetry_conversations_daily (bucket, version, platform, arch, success_count, error_count, user_cancel_count, total_count, avg_duration_ms, avg_tokens, success_rate, error_rate, created_at)
        VALUES (${bucket}, ${row.version}, ${row.platform}, ${row.arch}, ${row.success_count}, ${row.error_count}, ${row.user_cancel_count}, ${row.total_count}, ${row.avg_duration_ms}, ${row.avg_tokens}, ${successRate}, ${errorRate}, NOW())
        ON CONFLICT (bucket, version, platform, arch) DO UPDATE SET
          success_count = ${row.success_count}, error_count = ${row.error_count}, user_cancel_count = ${row.user_cancel_count},
          total_count = ${row.total_count}, avg_duration_ms = ${row.avg_duration_ms}, avg_tokens = ${row.avg_tokens},
          success_rate = ${successRate}, error_rate = ${errorRate}, created_at = NOW()
      `;
    }

    logger.info(`[Aggregation] Conversations: ${aggregated.length} records`);
  }

  /**
   * Aggregate conversation error data by error_code for a specific day
   * This provides detailed error statistics from conversations
   */
  private async aggregateConversationErrorData(bucket: Date, dayStart: Date, dayEnd: Date): Promise<void> {
    const aggregated = await db`
      SELECT
        version,
        platform,
        arch,
        error_code,
        COUNT(*) as count
      FROM telemetry_conversations
      WHERE created_at >= ${dayStart} AND created_at < ${dayEnd}
        AND status = 'error'
        AND error_code IS NOT NULL
      GROUP BY version, platform, arch, error_code
    `;

    if (aggregated.length === 0) {
      logger.info("[Aggregation] Conversation Errors: no data for this period");
      return;
    }

    for (const row of aggregated) {
      await db`
        INSERT INTO telemetry_conversation_errors_daily (bucket, version, platform, arch, error_code, count, created_at)
        VALUES (${bucket}, ${row.version}, ${row.platform}, ${row.arch}, ${row.error_code}, ${row.count}, NOW())
        ON CONFLICT (bucket, version, platform, arch, error_code) DO UPDATE SET
          count = ${row.count}, created_at = NOW()
      `;
    }

    logger.info(`[Aggregation] Conversation Errors: ${aggregated.length} records`);
  }

  /**
   * Aggregate install data for a specific day
   */
  private async aggregateInstallData(bucket: Date, dayStart: Date, dayEnd: Date): Promise<void> {
    const aggregated = await db`
      SELECT
        version,
        platform,
        arch,
        install_type,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        COUNT(*) as total_count,
        AVG(duration_ms)::INTEGER as avg_duration_ms
      FROM telemetry_install
      WHERE created_at >= ${dayStart} AND created_at < ${dayEnd}
      GROUP BY version, platform, arch, install_type
    `;

    if (aggregated.length === 0) {
      logger.info("[Aggregation] Installs: no data for this period");
      return;
    }

    for (const row of aggregated) {
      const successRate = Math.round((row.success_count / row.total_count) * 100);

      await db`
        INSERT INTO telemetry_install_daily (bucket, version, platform, arch, install_type, success_count, failed_count, total_count, avg_duration_ms, success_rate, created_at)
        VALUES (${bucket}, ${row.version}, ${row.platform}, ${row.arch}, ${row.install_type}, ${row.success_count}, ${row.failed_count}, ${row.total_count}, ${row.avg_duration_ms}, ${successRate}, NOW())
        ON CONFLICT (bucket, version, platform, arch, install_type) DO UPDATE SET
          success_count = ${row.success_count}, failed_count = ${row.failed_count}, total_count = ${row.total_count},
          avg_duration_ms = ${row.avg_duration_ms}, success_rate = ${successRate}, created_at = NOW()
      `;
    }

    logger.info(`[Aggregation] Installs: ${aggregated.length} records`);
  }

  /**
   * Run aggregation for multiple days (catch-up or backfill)
   */
  async runAggregationForRange(startDays: number, endDays: number): Promise<void> {
    const usingCagg = await isUsingContinuousAggregates();

    if (usingCagg) {
      logger.info("[Aggregation] Using continuous aggregates, no manual aggregation needed");
      return;
    }

    logger.info(`[Aggregation] Running manual aggregation for days ${startDays} to ${endDays}`);

    for (let i = startDays; i <= endDays; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const bucket = new Date(date.toISOString().split("T")[0]);
      const dayStart = new Date(bucket);
      const dayEnd = new Date(bucket);
      dayEnd.setHours(23, 59, 59, 999);

      await this.aggregatePerfData(bucket, dayStart, dayEnd);
      await this.aggregateConversationData(bucket, dayStart, dayEnd);
      await this.aggregateConversationErrorData(bucket, dayStart, dayEnd);
      await this.aggregateInstallData(bucket, dayStart, dayEnd);
    }

    logger.info("[Aggregation] Manual aggregation for range completed");
  }

  /**
   * Get aggregation mode info
   */
  async getAggregationInfo(): Promise<{ mode: string; usingContinuousAggregates: boolean }> {
    const usingCagg = await isUsingContinuousAggregates();
    return {
      mode: usingCagg ? "timescaledb_continuous_aggregates" : "manual_aggregation",
      usingContinuousAggregates: usingCagg,
    };
  }
}

export const aggregationService = new AggregationService();
export default aggregationService;