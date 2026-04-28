# Sudoclaw QMS Database Schema

> 更新时间: 2026-04-23

## 概述

Sudoclaw QMS 使用 **PostgreSQL + TimescaleDB** 作为数据库，支持时序数据的高效存储和查询。

**数据库特点:**
- TimescaleDB 自动分区 (Hypertables)
- 自动压缩策略 (7 天后压缩)
- 自动保留策略 (90/180 天后删除)
- 连续聚合视图 (Continuous Aggregates)
- 高效的时间范围查询

**表总数:** 22 个表 + 4 个聚合视图

---

## 一、遥测原始数据表

### 1.1 telemetry_perf_raw (性能原始数据)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 (带时区) |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 (darwin/win32/linux) |
| `arch` | TEXT | 架构 (arm64/x64) |
| `metric` | TEXT | 指标名称 |
| `value_ms` | INTEGER | 指标值 (毫秒) |
| `session_id` | TEXT | 会话 ID |
| `created_at` | TIMESTAMPTZ | 记录创建时间 |

**索引:**
- `idx_perf_raw_timestamp` (timestamp DESC)
- `idx_perf_raw_version` (version)
- `idx_perf_raw_metric` (metric)
- `idx_perf_raw_created_at` (created_at DESC)

**TimescaleDB:**
- Hypertable: 按 `timestamp` 分区
- 压缩: 7 天后压缩，按 metric/platform/version 分段
- 保留: 90 天后删除

### 1.2 telemetry_errors (错误原始数据)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `error_code` | TEXT | 错误代码 (E001-E010，详见错误码定义表) |
| `error_source` | TEXT | 错误来源 (cli/api/ui) |
| `session_id` | TEXT | 会话 ID |
| `context` | TEXT | JSON 上下文 |
| `created_at` | TIMESTAMPTZ | 记录创建时间 |

**索引:**
- `idx_errors_timestamp` (timestamp DESC)
- `idx_errors_error_code` (error_code)
- `idx_errors_session_id` (session_id)
- `idx_errors_created_at` (created_at DESC)

**TimescaleDB:**
- Hypertable: 按 `timestamp` 分区
- 压缩: 7 天后压缩，按 error_code/platform/version 分段
- 保留: 90 天后删除

### 1.3 telemetry_conversations (对话原始数据)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `session_id` | TEXT | 会话 ID (UNIQUE) |
| `model_id` | TEXT | 模型 ID |
| `model_provider` | TEXT | 模型提供商 |
| `status` | TEXT | 状态 (success/error/user_cancel) |
| `duration_ms` | INTEGER | 对话时长 |
| `tokens_used` | INTEGER | 总 token 数 |
| `input_tokens` | INTEGER | 输入 token |
| `output_tokens` | INTEGER | 输出 token |
| `error_code` | TEXT | 错误代码 |
| `created_at` | TIMESTAMPTZ | 记录创建时间 |

**索引:**
- `idx_conversations_timestamp` (timestamp DESC)
- `idx_conversations_status` (status)
- `idx_conversations_created_at` (created_at DESC)

**TimescaleDB:**
- Hypertable: 按 `timestamp` 分区
- 压缩: 7 天后压缩，按 platform/version 分段
- 保留: 180 天后删除

### 1.4 telemetry_install (安装原始数据)

| Column | Type | Description |
|--------|------|-------------|
| `install_id` | TEXT PK | 安装 ID |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 安装版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `status` | TEXT | 状态 (success/failed) |
| `duration_ms` | INTEGER | 安装时长 |
| `install_type` | TEXT | 安装类型 (fresh/update) |
| `previous_version` | TEXT | 前一版本 |
| `error_message` | TEXT | 错误信息 |
| `created_at` | TIMESTAMPTZ | 记录创建时间 |

**索引:**
- `idx_install_timestamp` (timestamp DESC)
- `idx_install_status` (status)
- `idx_install_created_at` (created_at DESC)

**TimescaleDB:**
- Hypertable: 按 `timestamp` 分区
- 压缩: 7 天后压缩
- 保留: 90 天后删除

---

## 二、每日聚合表 (Continuous Aggregates)

> TimescaleDB 自动维护，每小时刷新

### 2.1 telemetry_perf_daily (性能每日聚合)

| Column | Type | Description |
|--------|------|-------------|
| `bucket` | TIMESTAMPTZ | 时间桶 (每天) |
| `version` | TEXT | 版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `metric` | TEXT | 指标名称 |
| `p50` | INTEGER | 50 分位 |
| `p90` | INTEGER | 90 分位 |
| `p95` | INTEGER | 95 分位 |
| `p99` | INTEGER | 99 分位 |
| `min_value` | INTEGER | 最小值 |
| `max_value` | INTEGER | 最大值 |
| `avg_value` | INTEGER | 平均值 |
| `count` | BIGINT | 样本数 |

**刷新策略:** 每小时刷新，处理最近 3 天数据

### 2.2 telemetry_errors_daily (错误每日聚合)

| Column | Type | Description |
|--------|------|-------------|
| `bucket` | TIMESTAMPTZ | 时间桶 |
| `version` | TEXT | 版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `error_code` | TEXT | 错误代码 |
| `error_source` | TEXT | 错误来源 |
| `count` | BIGINT | 错误数 |

### 2.3 telemetry_conversations_daily (对话每日聚合)

| Column | Type | Description |
|--------|------|-------------|
| `bucket` | TIMESTAMPTZ | 时间桶 |
| `version` | TEXT | 版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `success_count` | BIGINT | 成功数 |
| `error_count` | BIGINT | 错误数 |
| `user_cancel_count` | BIGINT | 取消数 |
| `total_count` | BIGINT | 总数 |
| `avg_duration_ms` | INTEGER | 平均时长 |
| `avg_tokens` | INTEGER | 平均 token |
| `success_rate` | DECIMAL | 成功率 (%) |
| `error_rate` | DECIMAL | 错误率 (%) |

### 2.4 telemetry_install_daily (安装每日聚合)

| Column | Type | Description |
|--------|------|-------------|
| `bucket` | TIMESTAMPTZ | 时间桶 |
| `version` | TEXT | 版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `install_type` | TEXT | 安装类型 |
| `success_count` | BIGINT | 成功数 |
| `failed_count` | BIGINT | 失败数 |
| `total_count` | BIGINT | 总数 |
| `avg_duration_ms` | INTEGER | 平均时长 |
| `success_rate` | DECIMAL | 成功率 (%) |

---

## 三、Crash 监控表

### 3.1 crash_events (Crash 事件明细)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `timestamp` | TIMESTAMPTZ | 事件时间 |
| `version` | TEXT | 应用版本 |
| `platform` | TEXT | 平台 |
| `arch` | TEXT | 架构 |
| `process_type` | TEXT | 进程类型 (main/renderer) |
| `type` | TEXT | Crash 类型 (native_crash/renderer_crash/js_exception) |
| `crash_reason` | TEXT | Crash 原因 |
| `exit_code` | INTEGER | 退出码 |
| `signal` | TEXT | 信号 |
| `error_name` | TEXT | 错误名称 |
| `error_message` | TEXT | 错误消息 |
| `stack_trace` | TEXT | 堆栈 |
| `context` | JSONB | 上下文 (含面包屑) |
| `release` | TEXT | 发布版本 |
| `environment` | TEXT | 环境 |
| `fingerprint` | TEXT | 指纹 (用于聚合) |
| `issue_id` | INTEGER | 关联 Issue ID |
| `created_at` | TIMESTAMPTZ | 创建时间 |

**索引:**
- `idx_crash_events_timestamp` (timestamp DESC)
- `idx_crash_events_type` (type)
- `idx_crash_events_fingerprint` (fingerprint)
- `idx_crash_events_issue_id` (issue_id)
- `idx_crash_events_version` (version)
- `idx_crash_events_platform` (platform)
- `idx_crash_events_process_type` (process_type)
- `idx_crash_events_created_at` (created_at DESC)

**TimescaleDB:**
- Hypertable: 按 `timestamp` 分区
- 压缩: 7 天后压缩，按 type/platform/version 分段
- 保留: 90 天后删除

### 3.2 crash_issues (Crash Issue 聚合)

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | 自增主键 |
| `fingerprint` | TEXT UNIQUE | 唯一指纹 |
| `title` | TEXT | Issue 标题 |
| `type` | TEXT | Crash 类型 |
| `level` | TEXT | 级别 (fatal/error/warning) |
| `count` | INTEGER | 发生次数 |
| `user_count` | INTEGER | 影响用户数 |
| `first_seen` | TIMESTAMPTZ | 首次出现 |
| `last_seen` | TIMESTAMPTZ | 最近出现 |
| `status` | TEXT | 状态 (unresolved/resolved/ignored) |
| `assigned_to` | INTEGER | 分配用户 ID |
| `first_release` | TEXT | 首次出现版本 |
| `last_release` | TEXT | 最近出现版本 |
| `stack_summary` | TEXT | 堆栈摘要 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

**索引:**
- `idx_crash_issues_fingerprint` (fingerprint)
- `idx_crash_issues_status` (status)
- `idx_crash_issues_level` (level)
- `idx_crash_issues_type` (type)
- `idx_crash_issues_last_seen` (last_seen DESC)
- `idx_crash_issues_count` (count DESC)

### 3.3 crash_daily_stats (Crash 每日统计)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `bucket` | TIMESTAMPTZ | 时间桶 |
| `version` | TEXT | 版本 |
| `platform` | TEXT | 平台 |
| `type` | TEXT | Crash 类型 |
| `count` | INTEGER | 发生数 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

**唯一约束:** (bucket, version, platform, type)

### 3.4 source_maps (Source Map 存储)

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | 自增主键 |
| `version` | TEXT | 版本 |
| `platform` | TEXT | 平台 |
| `file_name` | TEXT | 文件名 |
| `map_content` | TEXT | Source Map 内容 |
| `uploaded_at` | TIMESTAMPTZ | 上传时间 |
| `uploaded_by` | INTEGER | 上传用户 |

**唯一约束:** (version, platform, file_name)

---

## 四、告警系统表

### 4.1 alert_config (告警配置)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | 配置 ID (UUID) |
| `name` | TEXT | 告警名称 |
| `type` | TEXT | 告警类型 |
| `metric` | TEXT | 监控指标 |
| `threshold` | REAL | 阈值 |
| `comparison` | TEXT | 比较运算符 |
| `level` | TEXT | 告警级别 |
| `channels` | TEXT | 通知渠道 (JSON) |
| `enabled` | BOOLEAN | 是否启用 |
| `cooldown_minutes` | INTEGER | 冷却时间 |
| `description` | TEXT | 描述 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

### 4.2 alert_history (告警历史)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `config_id` | TEXT | 配置 ID |
| `type` | TEXT | 告警类型 |
| `title` | TEXT | 告警标题 |
| `detail` | TEXT | 详情 |
| `level` | TEXT | 级别 |
| `channels` | TEXT | 渠道 (JSON) |
| `sent_at` | TIMESTAMPTZ | 发送时间 |
| `success` | BOOLEAN | 发送成功 |
| `error_message` | TEXT | 错误信息 |
| `acknowledged` | BOOLEAN | 已确认 |
| `acknowledged_at` | TIMESTAMPTZ | 确认时间 |
| `acknowledged_by` | TEXT | 确认人 |

---

## 五、认证系统表

### 5.1 users (用户表)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | 用户 ID (UUID) |
| `username` | TEXT UNIQUE | 用户名 |
| `password_hash` | TEXT | 密码哈希 |
| `email` | TEXT UNIQUE | 邮箱 |
| `display_name` | TEXT | 显示名 |
| `role` | TEXT | 角色 (admin/operator/viewer) |
| `enabled` | BOOLEAN | 是否启用 |
| `last_login_at` | TIMESTAMPTZ | 最后登录 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

### 5.2 api_keys (API Key 表)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Key ID (UUID) |
| `user_id` | TEXT FK | 所属用户 |
| `name` | TEXT | Key 名称 |
| `key_hash` | TEXT | Key 哈希 |
| `key_prefix` | TEXT | Key 前缀 (sk-xxxxx) |
| `permissions` | TEXT | 权限 (JSON) |
| `last_used_at` | TIMESTAMPTZ | 最后使用 |
| `expires_at` | TIMESTAMPTZ | 过期时间 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### 5.3 sessions (会话表)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | 会话 ID |
| `user_id` | TEXT FK | 用户 ID |
| `token_hash` | TEXT | Token 哈希 |
| `ip_address` | TEXT | IP 地址 |
| `user_agent` | TEXT | User Agent |
| `expires_at` | TIMESTAMPTZ | 过期时间 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### 5.4 audit_logs (审计日志)

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | 自增主键 |
| `user_id` | TEXT | 用户 ID |
| `action` | TEXT | 操作类型 |
| `resource` | TEXT | 资源类型 |
| `resource_id` | TEXT | 资源 ID |
| `detail` | TEXT | 详情 |
| `ip_address` | TEXT | IP 地址 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

---

## 六、系统配置表

### 6.1 system_config (系统配置)

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | 配置键 |
| `value` | TEXT | 配置值 |
| `description` | TEXT | 描述 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

**默认配置键:**
- `data_retention_perf_days` - 性能数据保留天数 (90)
- `data_retention_conversations_days` - 对话数据保留天数 (180)
- `aggregation_cron` - 聚合任务时间
- `cleanup_cron` - 清理任务时间
- `default_alert_channels` - 默认告警渠道

---

## 七、数据保留策略

| 表 | 保留时间 | 压缩 |
|----|----------|------|
| telemetry_perf_raw | 90 天 | 7 天后 |
| telemetry_errors | 90 天 | 7 天后 |
| telemetry_conversations | 180 天 | 7 天后 |
| telemetry_install | 90 天 | 7 天后 |
| crash_events | 90 天 | 7 天后 |
| 聚合视图 | 永久 | 不压缩 |

---

## 八、表统计

| 类别 | 表数 | 说明 |
|------|------|------|
| 遥测原始数据 | 4 | perf, errors, conversations, install |
| 每日聚合 | 4 | TimescaleDB Continuous Aggregates |
| Crash 数据 | 4 | events, issues, daily_stats, source_maps |
| 告警系统 | 2 | config, history |
| 认证系统 | 4 | users, api_keys, sessions, audit_logs |
| 系统配置 | 1 | system_config |
| **总计** | **22** | |

---

## 九、TimescaleDB 特性

### Hypertables
自动按时间分区，提升时序数据查询性能:
- `telemetry_perf_raw`
- `telemetry_errors`
- `telemetry_conversations`
- `telemetry_install`
- `crash_events`

### Compression Policies
7 天后自动压缩数据，节省存储空间 90%+

### Retention Policies
自动清理过期数据，无需手动维护

### Continuous Aggregates
实时聚合视图，每小时自动刷新:
- `telemetry_perf_daily`
- `telemetry_errors_daily`
- `telemetry_conversations_daily`
- `telemetry_install_daily`

---

## 十、错误码定义

客户端上报的错误码定义表：

| 错误码 | 错误类型 | 定位代码 | 上游组件 |
|--------|----------|----------|----------|
| E001 | HTTP 5xx / 连接错误 | RotatingApiClient.ts | nova-gateway |
| E002 | HTTP 超时 | RotatingApiClient.ts | nova-gateway |
| E003 | SSE 中断 | AcpConnection.ts | acp |
| E004 | 空响应 | AcpAgent.ts | openclaw |
| E005 | ACP 解析错 | AcpMessagePipeline.ts | acp |
| E006 | Gateway 鉴权失败 | AuthService.ts | nova-gateway |
| E007 | Gateway 余额不足 | BillingService.ts | nova-gateway |
| E008 | 渲染进程 crash | ConversationPage.tsx | client |
| E009 | Agent 内部错误 | AcpAgent.ts / OpenClawAgent.ts | client |
| E010 | Gateway 断开连接 | OpenClawAgent.ts | sudoclaw |

### 触发场景说明

| 错误码 | 触发场景 |
|--------|----------|
| E001 | API 调用返回 HTTP 5xx、网络连接失败 (ECONNREFUSED/ENOTFOUND) |
| E002 | API 调用超时 (timeout/timed out) |
| E003 | SSE 流中断、JSON-RPC 流解析失败 |
| E004 | Agent 返回空响应 |
| E005 | ACP 协议消息解析错误 |
| E006 | Gateway 鉴权失败 (HTTP 401/403) |
| E007 | Gateway 余额不足 (HTTP 402) |
| E008 | 渲染进程 JavaScript 异常崩溃 |
| E009 | Agent 处理过程中未分类的内部异常（默认错误码） |
| E010 | Sudoclaw Gateway WebSocket 断开连接 |