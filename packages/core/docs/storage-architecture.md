# Sudoclaw QMS 存储架构文档

## 架构概述

Sudoclaw QMS 使用 **PostgreSQL + TimescaleDB** 作为生产级存储方案，提供高性能时序数据处理能力。

```
┌─────────────────────────────────────────────────────────┐
│                    应用层                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────┐
              │   postgres.js     │  ← 轻量级 PostgreSQL 客户端
              │   连接池           │
              └───────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────┐
        │   PostgreSQL + TimescaleDB      │
        │   ────────────────────────────  │
        │   • Hypertables (时序分区表)    │
        │   • Continuous Aggregates       │
        │   • Compression Policies        │
        │   • Retention Policies          │
        └─────────────────────────────────┘
```

---

## 数据库配置

### 连接参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `DB_HOST` | localhost | PostgreSQL 主机地址 |
| `DB_PORT` | 5432 | PostgreSQL 端口 |
| `DB_NAME` | sudoclaw_qms | 数据库名称 |
| `DB_USER` | postgres | 用户名 |
| `DB_PASSWORD` | postgres | 密码 |
| `DB_MAX_CONNECTIONS` | 20 | 连接池大小 |

### 开发环境启动

```bash
# 使用 Docker Compose 启动 TimescaleDB
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f timescaledb
```

---

## 数据表结构

### 时序数据表 (Hypertables)

#### 1. telemetry_perf_raw - 性能原始数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL | 主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 (darwin/win32/linux) |
| `arch` | TEXT | 架构 (x64/arm64) |
| `metric` | TEXT | 指标名称 |
| `value_ms` | INTEGER | 值 (毫秒) |
| `session_id` | TEXT | 会话ID |
| `created_at` | TIMESTAMPTZ | 入库时间 |

**TimescaleDB 配置**:
```sql
-- Hypertable
SELECT create_hypertable('telemetry_perf_raw', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- 压缩策略 (7天后压缩)
SELECT add_compression_policy('telemetry_perf_raw', INTERVAL '7 days');

-- 保留策略 (90天后删除)
SELECT add_retention_policy('telemetry_perf_raw', INTERVAL '90 days');
```

#### 2. telemetry_errors - 错误原始数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL | 主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `error_code` | TEXT | 错误代码 |
| `error_source` | TEXT | 错误来源 |
| `session_id` | TEXT | 会话ID |
| `context` | TEXT | 上下文 |
| `created_at` | TIMESTAMPTZ | 入库时间 |

**TimescaleDB 配置**: 同 telemetry_perf_raw

#### 3. telemetry_conversations - 对话原始数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL | 主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `session_id` | TEXT | 会话ID (唯一) |
| `model_id` | TEXT | 模型ID |
| `model_provider` | TEXT | 模型提供商 |
| `status` | TEXT | 状态 (success/error/user_cancel) |
| `duration_ms` | INTEGER | 持续时间 |
| `tokens_used` | INTEGER | Token使用量 |
| `input_tokens` | INTEGER | 输入Token |
| `output_tokens` | INTEGER | 输出Token |
| `error_code` | TEXT | 错误代码 |
| `created_at` | TIMESTAMPTZ | 入库时间 |

**TimescaleDB 配置**: 保留180天

#### 4. telemetry_install - 安装原始数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `install_id` | TEXT | 安装ID (主键) |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `status` | TEXT | 状态 (success/failed) |
| `duration_ms` | INTEGER | 安装耗时 |
| `install_type` | TEXT | 类型 (fresh/update) |
| `previous_version` | TEXT | 旧版本 |
| `error_message` | TEXT | 错误消息 |
| `created_at` | TIMESTAMPTZ | 入库时间 |

### 崩溃报告表

#### 5. crash_events - 崩溃事件

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL | 主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `type` | TEXT | 类型 (native_crash/js_exception) |
| `crash_reason` | TEXT | 崩溃原因 |
| `error_name` | TEXT | 错误名称 |
| `error_message` | TEXT | 错误消息 |
| `stack_trace` | TEXT | 堆栈 |
| `context` | JSONB | 上下文 (JSON) |
| `fingerprint` | TEXT | 指纹 (聚合标识) |
| `issue_id` | INTEGER | 关联Issue ID |
| `created_at` | TIMESTAMPTZ | 入库时间 |

#### 6. crash_issues - 崩溃聚合Issue

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键 |
| `fingerprint` | TEXT | 指纹 (唯一) |
| `title` | TEXT | Issue标题 |
| `type` | TEXT | 类型 |
| `level` | TEXT | 级别 (fatal/error/warning) |
| `count` | INTEGER | 发生次数 |
| `first_seen` | TIMESTAMPTZ | 首次发现 |
| `last_seen` | TIMESTAMPTZ | 最后发现 |
| `status` | TEXT | 状态 (unresolved/resolved/ignored) |

### 业务数据表

#### 7. users - 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | UUID主键 |
| `username` | TEXT | 用户名 (唯一) |
| `password_hash` | TEXT | 密码哈希 |
| `email` | TEXT | 邮箱 |
| `display_name` | TEXT | 显示名称 |
| `role` | TEXT | 角色 (admin/operator/viewer) |
| `enabled` | BOOLEAN | 是否启用 |

#### 8. api_keys - API密钥表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | UUID主键 |
| `user_id` | TEXT | 所属用户 |
| `name` | TEXT | 密钥名称 |
| `key_hash` | TEXT | 密钥哈希 |
| `key_prefix` | TEXT | 密钥前缀 |
| `permissions` | TEXT | 权限列表 (JSON) |
| `expires_at` | TIMESTAMPTZ | 过期时间 |

---

## TimescaleDB 连续聚合

### 性能数据日聚合

```sql
CREATE MATERIALIZED VIEW telemetry_perf_daily
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
  AVG(value_ms)::INTEGER as avg_value,
  COUNT(*) as count
FROM telemetry_perf_raw
GROUP BY bucket, version, platform, arch, metric
WITH NO DATA;

-- 自动刷新策略
SELECT add_continuous_aggregate_policy('telemetry_perf_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

### 错误数据日聚合

```sql
CREATE MATERIALIZED VIEW telemetry_errors_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', timestamp) AS bucket,
  version,
  platform,
  arch,
  error_code,
  error_source,
  COUNT(*) as count
FROM telemetry_errors
GROUP BY bucket, version, platform, arch, error_code, error_source;
```

### 对话数据日聚合

```sql
CREATE MATERIALIZED VIEW telemetry_conversations_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', timestamp) AS bucket,
  version,
  platform,
  arch,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
  COUNT(*) as total_count,
  AVG(duration_ms)::INTEGER as avg_duration_ms,
  ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100) as success_rate
FROM telemetry_conversations
GROUP BY bucket, version, platform, arch;
```

---

## 压缩策略

所有时序数据表启用压缩，配置如下：

```sql
ALTER TABLE telemetry_perf_raw SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'metric,platform,version',
  timescaledb.compress_orderby = 'timestamp DESC'
);

-- 7天后自动压缩
SELECT add_compression_policy('telemetry_perf_raw', INTERVAL '7 days');
```

**压缩效果**: 通常达到 90%+ 压缩率

---

## 数据保留策略

| 表 | 保留期限 | 说明 |
|------|----------|------|
| `telemetry_perf_raw` | 90天 | 性能明细数据 |
| `telemetry_errors` | 90天 | 错误明细数据 |
| `telemetry_conversations` | 180天 | 对话明细数据 |
| `telemetry_install` | 90天 | 安装明细数据 |
| `crash_events` | 90天 | 崩溃明细数据 |

**配置示例**:
```sql
SELECT add_retention_policy('telemetry_perf_raw', INTERVAL '90 days');
```

---

## 高可用方案

### 主从复制 (流复制)

```
┌─────────────────┐     WAL流复制     ┌─────────────────┐
│  Primary (读写) │ ──────────────→ │  Replica (只读) │
│  TimescaleDB    │                  │  TimescaleDB    │
└─────────────────┘                  └─────────────────┘
```

### Patroni 自动故障转移

```
┌───────┐  ┌───────┐  ┌───────┐
│ Node1 │  │ Node2 │  │ Node3 │  ← PostgreSQL节点
└───────┘  └───────┘  └───────┘
     │         │         │
     └─────────┼─────────┘
               ▼
        ┌──────────┐
        │   etcd   │  ← Leader选举
        └──────────┘
```

### 迁移成本

从单机到高可用变更成本：
- **运维配置**: Patroni约2小时
- **代码改动**: 连接发现逻辑约10行
- **数据迁移**: 无需（流复制自动同步）

---

## 非TimescaleDB环境

当 TimescaleDB 扩展不可用时，系统自动回退到标准 PostgreSQL：

1. 使用普通表替代 Hypertables
2. 创建日聚合表 (telemetry_perf_daily 等)
3. 定时任务手动执行聚合和清理

---

## 性能优化建议

### 索引优化

```sql
-- 时间范围查询索引
CREATE INDEX idx_perf_raw_timestamp ON telemetry_perf_raw(timestamp DESC);
CREATE INDEX idx_perf_raw_created_at ON telemetry_perf_raw(created_at DESC);

-- 指标查询索引
CREATE INDEX idx_perf_raw_metric ON telemetry_perf_raw(metric);

-- 版本/平台索引
CREATE INDEX idx_perf_raw_version ON telemetry_perf_raw(version);
CREATE INDEX idx_perf_raw_platform ON telemetry_perf_raw(platform);
```

### 连接池配置

```typescript
// postgres.js 连接池配置
const db = postgres({
  max: 20,              // 最大连接数
  idle_timeout: 30000,  // 空闲超时
  connect_timeout: 10000, // 连接超时
});
```

---

## 监控指标

建议监控以下指标：

| 指标 | 说明 |
|------|------|
| 连接池使用率 | 当前连接数 / 最大连接数 |
| 查询延迟 | 平均查询响应时间 |
| 数据量增长 | 每日数据入库量 |
| 压缩比率 | 已压缩数据占比 |
| 聚合延迟 | 连续聚合刷新延迟 |

---

## 运维命令

```bash
# 连接数据库
docker exec -it sudowork-qms-db psql -U postgres -d sudoclaw_qms

# 查看Hypertable信息
SELECT hypertable_name, chunk_interval 
FROM timescaledb_information.hypertables;

# 查看压缩状态
SELECT hypertable_name, chunk_name, is_compressed 
FROM timescaledb_information.chunks;

# 手动刷新连续聚合
CALL refresh_continuous_aggregate('telemetry_perf_daily', NULL, NULL);

# 数据备份
pg_dump -U postgres sudoclaw_qms > backup.sql
```
