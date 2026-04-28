# Sudoclaw QMS Changelog

All notable changes to Sudoclaw QMS will be documented in this file.

## [1.0.0] - 2026-04-22

### Initial Release

#### Features

- **Telemetry Collection**
  - Performance metrics upload (startup_time, response_time, processing_time)
  - Error event tracking with context
  - Conversation analytics (success/error/user_cancel)
  - Installation statistics (fresh/update)
  - Batch upload API for efficient data transmission

- **Data Aggregation**
  - Daily performance aggregation with percentile calculations (P50/P90/P95/P99)
  - Daily error aggregation by error_code
  - Daily conversation aggregation with success rates
  - Daily installation aggregation by install type

- **Dashboard API**
  - Overview summary with trends
  - Performance trends over time
  - Error distribution and trends
  - Conversation statistics and trends
  - Installation statistics by version/platform

- **Alert System**
  - Threshold-based alert configuration
  - Multiple alert levels (info, warning, critical)
  - Multiple comparison operators (gt, gte, lt, lte, eq, neq)
  - Alert cooldown period
  - Alert history tracking
  - Alert acknowledgment

- **Notifications**
  - DingTalk webhook support with signature
  - Lark webhook support with rich cards
  - Email notification (SMTP)

- **Authentication**
  - JWT-based web session authentication
  - API key authentication for telemetry
  - User management (admin/operator/viewer roles)
  - API key management with permissions
  - Session tracking
  - Audit logging

- **System Management**
  - Health check endpoint
  - System statistics API
  - Configuration management
  - Notification status check

- **Scheduled Tasks**
  - Daily aggregation task (1 AM)
  - Daily cleanup task (2 AM)
  - Alert check task (every 5 minutes)

#### Infrastructure

- SQLite database with WAL mode
- Bun runtime for high performance
- Hono web framework
- Docker support
- Systemd service support
- Deployment scripts

#### Documentation

- README with quick start guide
- API documentation
- Database schema documentation

### Technical Details

- Runtime: Bun 1.x
- Framework: Hono 4.x
- Database: SQLite (bun:sqlite)
- Authentication: Bun built-in JWT and password hashing
- Port: 6078 (configurable)

### Default Configuration

- Admin username: `admin`
- Admin password: `admin123` (⚠️ change immediately)
- JWT expiry: 24 hours
- Perf retention: 90 days
- Conversation retention: 180 days
- CORS: localhost:5173, localhost:3000