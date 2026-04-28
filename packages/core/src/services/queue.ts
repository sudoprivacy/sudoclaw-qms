/**
 * Queue service for telemetry data
 * Uses Redis List as message queue with batch processing
 */

import { getRedis } from "../db/redis.js";
import { db } from "../db/index.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import type { PerfRawData, ConversationRawData, InstallRawData } from "../types/telemetry.js";

// Queue keys
const QUEUE_KEYS = {
  perf: "telemetry:perf",
  conversations: "telemetry:conversations",
  installs: "telemetry:installs",
};

/**
 * Push telemetry data to Redis queue
 */
export async function pushToQueue(
  type: "perf" | "conversations" | "installs",
  items: PerfRawData[] | ConversationRawData[] | InstallRawData[]
): Promise<number> {
  const redis = getRedis();
  const key = QUEUE_KEYS[type];

  // Serialize items as JSON strings
  const serialized = items.map(item => JSON.stringify(item));

  // Push to queue (LPUSH for FIFO with RPOP)
  const result = await redis.lpush(key, ...serialized);

  logger.debug(`[Queue] Pushed ${items.length} items to ${type} queue (total: ${result})`);

  return result;
}

/**
 * Pop items from queue (up to batchSize)
 */
async function popFromQueue(key: string, batchSize: number): Promise<string[]> {
  const redis = getRedis();
  const items: string[] = [];

  for (let i = 0; i < batchSize; i++) {
    const item = await redis.rpop(key);
    if (!item) break;
    items.push(item);
  }

  return items;
}

/**
 * Bulk insert perf data
 */
async function bulkInsertPerf(items: PerfRawData[]): Promise<number> {
  if (items.length === 0) return 0;

  const now = new Date();
  const values = items.map(item => {
    const timestamp = new Date(item.timestamp);
    const sessionId = item.session_id ? `'${item.session_id}'` : 'NULL';
    const arch = item.arch || 'unknown';
    return `('${timestamp.toISOString()}', '${item.version}', '${item.platform}', '${arch}', '${item.metric}', ${item.value_ms}, ${sessionId}, '${now.toISOString()}')`;
  });

  const sql = `
    INSERT INTO telemetry_perf_raw (timestamp, version, platform, arch, metric, value_ms, session_id, created_at)
    VALUES ${values.join(',')}
  `;

  await db.unsafe(sql);
  return items.length;
}

/**
 * Bulk insert conversation data
 */
async function bulkInsertConversations(items: ConversationRawData[]): Promise<number> {
  if (items.length === 0) return 0;

  const now = new Date();
  const values = items.map(item => {
    const timestamp = new Date(item.timestamp);
    const modelProvider = item.model_provider ? `'${item.model_provider}'` : 'NULL';
    const tokensUsed = item.tokens_used ?? 'NULL';
    const inputTokens = item.input_tokens ?? 'NULL';
    const outputTokens = item.output_tokens ?? 'NULL';
    const errorCode = item.error_code ? `'${item.error_code}'` : 'NULL';
    const arch = item.arch || 'unknown';
    return `('${timestamp.toISOString()}', '${item.version}', '${item.platform}', '${arch}', '${item.session_id}', '${item.model_id}', ${modelProvider}, '${item.status}', ${item.duration_ms}, ${tokensUsed}, ${inputTokens}, ${outputTokens}, ${errorCode}, '${now.toISOString()}')`;
  });

  const sql = `
    INSERT INTO telemetry_conversations (timestamp, version, platform, arch, session_id, model_id, model_provider, status, duration_ms, tokens_used, input_tokens, output_tokens, error_code, created_at)
    VALUES ${values.join(',')}
  `;

  await db.unsafe(sql);
  return items.length;
}

/**
 * Bulk insert install data
 */
async function bulkInsertInstalls(items: InstallRawData[]): Promise<number> {
  if (items.length === 0) return 0;

  const now = new Date();
  const values = items.map(item => {
    const timestamp = new Date(item.timestamp);
    const installType = item.install_type ? `'${item.install_type}'` : 'NULL';
    const previousVersion = item.previous_version ? `'${item.previous_version}'` : 'NULL';
    const errorMessage = item.error_message ? `'${item.error_message.replace(/'/g, "''")}'` : 'NULL';
    const arch = item.arch || 'unknown';
    return `('${item.install_id}', '${timestamp.toISOString()}', '${item.version}', '${item.platform}', '${arch}', '${item.status}', ${item.duration_ms}, ${installType}, ${previousVersion}, ${errorMessage}, '${now.toISOString()}')`;
  });

  const sql = `
    INSERT INTO telemetry_install (install_id, timestamp, version, platform, arch, status, duration_ms, install_type, previous_version, error_message, created_at)
    VALUES ${values.join(',')}
  `;

  await db.unsafe(sql);
  return items.length;
}

/**
 * Process queue - pop and bulk insert
 */
export async function processQueue(): Promise<void> {
  const batchSize = config.queue.batchSize;
  const redis = getRedis();

  // Check queue depths
  const depths = await Promise.all([
    redis.llen(QUEUE_KEYS.perf),
    redis.llen(QUEUE_KEYS.conversations),
    redis.llen(QUEUE_KEYS.installs),
  ]);

  const totalDepth = depths.reduce((a, b) => a + b, 0);

  if (totalDepth === 0) {
    logger.debug("[Queue] No items to process");
    return;
  }

  logger.info(`[Queue] Processing queues: perf=${depths[0]}, conv=${depths[1]}, installs=${depths[2]}`);

  let processed = 0;

  // Process each queue type
  try {
    // Perf
    const perfItems = await popFromQueue(QUEUE_KEYS.perf, batchSize);
    if (perfItems.length > 0) {
      const data = perfItems.map(s => JSON.parse(s) as PerfRawData);
      processed += await bulkInsertPerf(data);
      logger.debug(`[Queue] Inserted ${perfItems.length} perf items`);
    }

    // Conversations
    const convItems = await popFromQueue(QUEUE_KEYS.conversations, batchSize);
    if (convItems.length > 0) {
      const data = convItems.map(s => JSON.parse(s) as ConversationRawData);
      processed += await bulkInsertConversations(data);
      logger.debug(`[Queue] Inserted ${convItems.length} conversation items`);
    }

    // Installs
    const installItems = await popFromQueue(QUEUE_KEYS.installs, batchSize);
    if (installItems.length > 0) {
      const data = installItems.map(s => JSON.parse(s) as InstallRawData);
      processed += await bulkInsertInstalls(data);
      logger.debug(`[Queue] Inserted ${installItems.length} install items`);
    }

    logger.info(`[Queue] Total processed: ${processed} items`);
  } catch (error) {
    logger.error("[Queue] Processing error:", error);
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  perf: number;
  conversations: number;
  installs: number;
}> {
  const redis = getRedis();

  const [perf, conversations, installs] = await Promise.all([
    redis.llen(QUEUE_KEYS.perf),
    redis.llen(QUEUE_KEYS.conversations),
    redis.llen(QUEUE_KEYS.installs),
  ]);

  return { perf, conversations, installs };
}