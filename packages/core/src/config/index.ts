/**
 * Application configuration
 */

// Bun automatically loads .env files, no need to call loadEnv()

export const config = {
  // Server
  port: parseInt(process.env.PORT || "6078", 10),
  host: process.env.HOST || "0.0.0.0",

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3000"],

  // Database (PostgreSQL + TimescaleDB)
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "sudowork_qms",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20", 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "10000", 10),
  },

  // Redis (for queue and session storage)
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    keyPrefix: "qms:",
  },

  // Queue settings
  queue: {
    flushIntervalMs: parseInt(process.env.QUEUE_FLUSH_INTERVAL || "3000", 10), // 3 seconds
    batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || "50", 10),
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || "sudo-qms-secret-key-change-in-production",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
    apiKeyHeader: process.env.API_KEY_HEADER || "X-API-Key",
    defaultApiKey: process.env.DEFAULT_API_KEY,
  },

  // Telemetry
  telemetry: {
    dataRetentionDays: {
      perf: parseInt(process.env.PERF_RETENTION_DAYS || "90", 10),
      conversations: parseInt(process.env.CONVERSATION_RETENTION_DAYS || "180", 10),
    },
    aggregationCron: process.env.AGGREGATION_CRON || "0 1 * * *",
    cleanupCron: process.env.CLEANUP_CRON || "0 2 * * *",
  },

  // Notifications
  notifications: {
    lark: {
      webhookUrl: process.env.LARK_WEBHOOK_URL,
    },
    email: {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      from: process.env.ALERT_EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO,
    },
  },

  // Encryption (hybrid RSA + AES-GCM)
  encryption: {
    /** RSA-2048 private key PEM for decryption */
    privateKeyPem: process.env.TELEMETRY_PRIVATE_KEY,
    /** Whether encryption is required for telemetry/crash endpoints */
    encryptionRequired: process.env.TELEMETRY_ENCRYPTION_REQUIRED === "true",
    /** Encryption algorithm version */
    algorithm: (process.env.TELEMETRY_ENCRYPTION_ALGORITHM || "hybrid-v1") as "hybrid-v1",
  },

  // Admin frontend
  serveAdmin: process.env.SERVE_ADMIN === "true" || process.env.NODE_ENV === "production",

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // Environment
  env: process.env.NODE_ENV || "development",
};