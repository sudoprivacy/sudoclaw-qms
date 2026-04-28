/**
 * Telemetry API routes
 * Uses Redis queue for async batch insertion
 */

import { Hono } from "hono";
import { apiKeyAuth } from "../middleware/auth.js";
import { decryptMiddleware } from "../middleware/decrypt.js";
import { pushToQueue, getQueueStats } from "../services/queue.js";
import { logger } from "../utils/logger.js";
import type {
  TelemetryBatchRequest,
  PerfRawData,
  ConversationRawData,
  InstallRawData,
} from "../types/telemetry.js";
import type { DecryptedBatchRequest } from "../types/encryption.js";

const telemetry = new Hono();

// All telemetry endpoints require API key authentication
telemetry.use("/*", apiKeyAuth);

// Decrypt middleware for hybrid encryption support
telemetry.post("/batch", decryptMiddleware, async (c) => {
  // Get decrypted body from middleware (or plain body if encryption disabled)
  const decryptedBody = c.get("decryptedBody") as DecryptedBatchRequest | undefined;
  const body = decryptedBody || await c.req.json<TelemetryBatchRequest>();
  const now = Date.now();

  const results = {
    perf: 0,
    conversations: 0,
    installs: 0,
  };

  // Push to Redis queues (async, non-blocking)
  try {
    // Handle events array format (from newer clients)
    if (body.events && Array.isArray(body.events)) {
      const perfEvents: PerfRawData[] = [];
      const conversationEvents: ConversationRawData[] = [];
      const installEvents: InstallRawData[] = [];

      for (const event of body.events) {
        // Event format: { type, timestamp, version, platform, arch, data }
        // Need to merge top-level fields into data to match expected format
        const evt = event as {
          type: string;
          timestamp?: number;
          version?: string;
          platform?: string;
          arch?: string;
          data?: Record<string, unknown>;
        };

        if (!evt.data) continue;

        // Merge common fields from event level into data
        const mergedData = {
          ...evt.data,
          timestamp: evt.timestamp ?? evt.data.timestamp,
          version: evt.version ?? evt.data.version,
          platform: evt.platform ?? evt.data.platform,
          arch: evt.arch ?? evt.data.arch,
        };

        if (evt.type === "perf") {
          perfEvents.push(mergedData as PerfRawData);
        } else if (evt.type === "conversation") {
          conversationEvents.push(mergedData as ConversationRawData);
        } else if (evt.type === "install") {
          installEvents.push(mergedData as InstallRawData);
        }
      }

      if (perfEvents.length > 0) {
        await pushToQueue("perf", perfEvents);
        results.perf = perfEvents.length;
      }
      if (conversationEvents.length > 0) {
        await pushToQueue("conversations", conversationEvents);
        results.conversations = conversationEvents.length;
      }
      if (installEvents.length > 0) {
        await pushToQueue("installs", installEvents);
        results.installs = installEvents.length;
      }
    } else {
      // Handle legacy format (perf: [], conversations: [], etc.)
      if (body.perf && body.perf.length > 0) {
        await pushToQueue("perf", body.perf);
        results.perf = body.perf.length;
      }

      if (body.conversations && body.conversations.length > 0) {
        await pushToQueue("conversations", body.conversations);
        results.conversations = body.conversations.length;
      }

      if (body.installs && body.installs.length > 0) {
        await pushToQueue("installs", body.installs);
        results.installs = body.installs.length;
      }
    }

    logger.info("Telemetry batch queued:", results);
  } catch (error) {
    logger.error("Failed to push to queue:", error);
    return c.json(
      {
        success: false,
        error: { code: "QUEUE_ERROR", message: "Failed to queue telemetry data" },
      },
      500
    );
  }

  return c.json({
    success: true,
    data: {
      received: results,
      timestamp: now,
      queued: true, // Indicate data is queued for async processing
    },
  });
});

/**
 * Get queue statistics (for monitoring)
 */
telemetry.get("/queue/stats", async (c) => {
  const stats = await getQueueStats();

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * Single performance event upload (still uses queue)
 */
telemetry.post("/perf", async (c) => {
  const body = await c.req.json<PerfRawData>();

  try {
    await pushToQueue("perf", [body]);
    logger.debug("Perf event queued");
  } catch (error) {
    logger.error("Failed to queue perf event:", error);
    return c.json(
      {
        success: false,
        error: { code: "QUEUE_ERROR", message: "Failed to queue perf event" },
      },
      500
    );
  }

  return c.json({
    success: true,
    data: { timestamp: Date.now(), queued: true },
  });
});

/**
 * Single conversation event upload (still uses queue)
 */
telemetry.post("/conversation", async (c) => {
  const body = await c.req.json<ConversationRawData>();

  try {
    await pushToQueue("conversations", [body]);
    logger.debug("Conversation event queued");
  } catch (error) {
    logger.error("Failed to queue conversation event:", error);
    return c.json(
      {
        success: false,
        error: { code: "QUEUE_ERROR", message: "Failed to queue conversation event" },
      },
      500
    );
  }

  return c.json({
    success: true,
    data: { timestamp: Date.now(), queued: true },
  });
});

/**
 * Single install event upload (still uses queue)
 */
telemetry.post("/install", async (c) => {
  const body = await c.req.json<InstallRawData>();

  try {
    await pushToQueue("installs", [body]);
    logger.debug("Install event queued");
  } catch (error) {
    logger.error("Failed to queue install event:", error);
    return c.json(
      {
        success: false,
        error: { code: "QUEUE_ERROR", message: "Failed to queue install event" },
      },
      500
    );
  }

  return c.json({
    success: true,
    data: { timestamp: Date.now(), queued: true },
  });
});

export default telemetry;