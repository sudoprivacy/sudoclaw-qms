/**
 * Database seed data
 */

import { db } from "./index.js";
import { hashPassword } from "../utils/password.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";

/**
 * Seed initial data
 */
export async function seedData(): Promise<void> {
  logger.info("[DB] Seeding initial data...");

  // 1. Default system config
  const configData = [
    { key: "data_retention_perf_days", value: "90", description: "性能明细数据保留天数" },
    { key: "data_retention_conversations_days", value: "180", description: "对话明细数据保留天数" },
    { key: "aggregation_cron", value: "0 1 * * *", description: "预聚合任务执行时间" },
    { key: "cleanup_cron", value: "0 2 * * *", description: "数据清理任务执行时间" },
    { key: "default_alert_channels", value: "dingtalk", description: "默认告警通道" },
    { key: "system_name", value: "Sudoclaw QMS", description: "系统名称" },
    { key: "system_version", value: "1.0.0", description: "系统版本" },
  ];

  for (const item of configData) {
    await db`
      INSERT INTO system_config (key, value, description, updated_at)
      VALUES (${item.key}, ${item.value}, ${item.description}, NOW())
      ON CONFLICT (key) DO NOTHING
    `;
  }

  // 2. Default admin user (if not exists)
  const adminExists = await db`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;

  if (adminExists.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const passwordHash = await hashPassword(adminPassword);
    const adminId = uuidv4();

    await db`
      INSERT INTO users (id, username, password_hash, display_name, role, enabled, created_at, updated_at)
      VALUES (${adminId}, 'admin', ${passwordHash}, 'Administrator', 'admin', TRUE, NOW(), NOW())
    `;

    logger.info("[DB] Default admin user created (username: admin, password: admin123)");
    logger.info("[DB] ⚠️  Please change the default password after first login!");
  }

  logger.info("[DB] Seed data completed");
}