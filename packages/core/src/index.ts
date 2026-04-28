/**
 * Sudoclaw QMS Core - Main Entry Point
 */

import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { serveStatic } from "hono/bun";

// Database
import { initDatabase } from "./db/init.js";

// Middleware
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/request-logger.js";

// API Routes
import { routes } from "./routes/index.js";

// Tasks
import { createScheduler } from "./tasks/scheduler.js";
import { setSchedulerInstance } from "./tasks/index.js";

// Config
import { config } from "./config/index.js";

// Logger
import { logger } from "./utils/logger.js";

// Initialize database
await initDatabase();

// Start scheduled tasks
const scheduler = createScheduler();
scheduler.start();
setSchedulerInstance(scheduler);

// Create app
const app = new Hono();

// Global middleware
app.use("*", requestLogger);
app.use("*", corsMiddleware);
app.use("*", prettyJSON());

// Error handler
app.use("*", errorHandler);

// Mount API routes
app.route("/api/v1/telemetry", routes.telemetry);
app.route("/api/v1/dashboard", routes.dashboard);
app.route("/api/v1/alerts", routes.alerts);
app.route("/api/v1/auth", routes.auth);
app.route("/api/v1/system", routes.system);
app.route("/api/v1/crash", routes.crash);

// Health check endpoint (alias)
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend in production mode
if (config.serveAdmin) {
  const adminRoot = "./admin";

  // Serve static assets (JS, CSS, images, etc.)
  app.use("/assets/*", serveStatic({ root: adminRoot }));

  // Serve other static files (favicon, etc.)
  app.use("/favicon.svg", serveStatic({ root: adminRoot }));
  app.use("/vite.svg", serveStatic({ root: adminRoot }));

  // SPA fallback: serve index.html for all non-API routes
  app.get("*", async (c) => {
    const file = Bun.file("./admin/index.html");
    if (await file.exists()) {
      return new Response(await file.arrayBuffer(), {
        headers: { "Content-Type": "text/html" },
      });
    }
    return c.text("Frontend not built", 404);
  });
} else {
  // Development mode: show API info at root
  app.get("/", (c) => {
    return c.json({
      name: "Sudoclaw QMS",
      version: "1.0.0",
      description: "Quality Management System for Sudoclaw",
      endpoints: {
        telemetry: "/api/v1/telemetry",
        dashboard: "/api/v1/dashboard",
        alerts: "/api/v1/alerts",
        auth: "/api/v1/auth",
        system: "/api/v1/system",
        crash: "/api/v1/crash",
        health: "/health",
      },
    });
  });

  // Not found handler
  app.all("*", notFoundHandler);
}

// Start server
logger.info(`🚀 Sudoclaw QMS started on port ${config.port}`);
logger.info(`📍 API endpoint: http://localhost:${config.port}/api/v1`);
logger.info(`💚 Health check: http://localhost:${config.port}/health`);

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};