# Sudoclaw QMS API Documentation

> 更新时间: 2026-04-23

## 基础信息

- **Base URL**: `http://localhost:6078/api/v1`
- **认证方式**: JWT Token (Web) 或 API Key (客户端)

## 认证

### JWT 认证 (Web Dashboard)

```http
Authorization: Bearer <jwt_token>
```

### API Key 认证 (客户端上报)

```http
X-API-Key: sk-xxxxxxxxxxxx
```

---

## 一、认证 API `/api/v1/auth`

### 登录

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_at": 1713859200000,
    "user": {
      "id": "uuid",
      "username": "admin",
      "role": "admin",
      "display_name": "Administrator"
    }
  }
}
```

### 登出

```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

### 获取当前用户

```http
GET /api/v1/auth/profile
Authorization: Bearer <token>
```

### 修改密码

```http
POST /api/v1/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "old_password": "current_password",
  "new_password": "new_password"
}
```

### 用户管理 (Admin)

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/users` | GET | 用户列表 | admin |
| `/users` | POST | 创建用户 | admin |
| `/users/:id` | PUT | 更新用户 | admin |
| `/users/:id` | DELETE | 删除用户 | admin |

### API Key 管理

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api-keys` | GET | API Key 列表 | 所有用户 |
| `/api-keys` | POST | 创建 API Key | 所有用户 |
| `/api-keys/:id` | DELETE | 删除 API Key | 所有用户 (admin 可删除任意) |

### 审计日志 (Admin)

```http
GET /api/v1/auth/audit-logs?user_id=xxx&action=login&limit=100
Authorization: Bearer <admin-token>
```

---

## 二、遥测上报 API `/api/v1/telemetry`

> 所有遥测端点需要 API Key 认证 (`X-API-Key` header)

### 批量上报 (支持加密)

```http
POST /api/v1/telemetry/batch
X-API-Key: sk-xxxxxxxxxxxx
Content-Type: application/json
X-Encryption: hybrid-v1  (可选，加密请求时添加)

{
  "perf": [...],
  "errors": [...],
  "conversations": [...],
  "installs": [...]
}
```

**加密请求格式 (hybrid-v1):**
```json
{
  "encrypted_key": "Base64(RSA-OAEP加密的AES密钥)",
  "encrypted_data": "Base64(AES-GCM加密的请求体)",
  "nonce": "Base64(12字节nonce)",
  "tag": "Base64(16字节auth tag)",
  "algorithm": "hybrid-v1",
  "timestamp": 1713859200000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "received": {
      "perf": 1,
      "errors": 1,
      "conversations": 1,
      "installs": 1
    },
    "timestamp": 1713859200000
  }
}
```

### 单条上报

| 端点 | 方法 | 说明 |
|------|------|------|
| `/perf` | POST | 单条性能事件 |
| `/error` | POST | 单条错误事件 |
| `/conversation` | POST | 单条对话事件 |
| `/install` | POST | 单条安装事件 |

### 性能指标类型

| Metric | 说明 |
|--------|------|
| `startup_time` | 应用启动耗时 |
| `response_time` | API 响应时间 |
| `processing_time` | 内部处理耗时 |
| `first_token_time` | 首 token 时间 |

### 对话状态

| Status | 说明 |
|--------|------|
| `success` | 对话成功完成 |
| `error` | 对话出错失败 |
| `user_cancel` | 用户取消对话 |

### 安装类型

| Type | 说明 |
|------|------|
| `fresh` | 新安装 |
| `update` | 更新安装 |

---

## 三、Crash 监控 API `/api/v1/crash`

> Crash 上报端点需要 API Key 认证

### 数据上报

| 端点 | 方法 | 说明 |
|------|------|------|
| `/events/batch` | POST | 批量 Crash 上报 (支持加密) |
| `/events` | POST | 单条 Crash 上报 |

**Crash 事件结构:**
```json
{
  "type": "js_exception",
  "timestamp": 1713859200000,
  "version": "1.0.0",
  "platform": "darwin",
  "arch": "arm64",
  "process_type": "renderer",
  "error_name": "TypeError",
  "error_message": "Cannot read property 'x' of undefined",
  "stack_trace": "at foo (file.js:10)\n...",
  "context": {
    "breadcrumbs": [...]
  }
}
```

### Crash 类型

| Type | 说明 |
|------|------|
| `native_crash` | 原生 Crash |
| `renderer_crash` | 渲染进程 Crash |
| `js_exception` | JS 异常 |

### Issue 管理

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/issues` | GET | Issue 列表 | JWT |
| `/issues/:id` | GET | Issue 详情 | JWT |
| `/issues/:id` | PUT | 更新 Issue | JWT |
| `/issues/:id/resolve` | POST | 标记已解决 | JWT |
| `/issues/:id/ignore` | POST | 标记忽略 | JWT |

**Issue 查询参数:**
```
status=unresolved&level=error&type=js_exception&version=1.0.0&limit=50&offset=0
```

### 事件查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/events` | GET | 事件列表 |
| `/events/:id` | GET | 事件详情 |

### 统计接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/stats/summary` | GET | 统计摘要 |
| `/stats/trend` | GET | Crash 趋势 |
| `/stats/distribution` | GET | Crash 分布 |

**统计摘要:**
```json
{
  "success": true,
  "data": {
    "total_events": 100,
    "unresolved_issues": 10,
    "fatal_issues": 2,
    "error_issues": 8,
    "recent_24h": 15,
    "recent_7d": 50
  }
}
```

### Admin 接口

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/admin/aggregate` | POST | 手动触发聚合 | JWT |
| `/admin/cleanup` | POST | 手动触发清理 | JWT |

---

## 四、Dashboard API `/api/v1/dashboard`

> 需要 JWT 认证

### 总览数据

```http
GET /api/v1/dashboard/overview?start_time=1713800000000&end_time=1713859200000
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": { "start": 1713800000000, "end": 1713859200000 },
    "conversations": {
      "total": 1000,
      "success": 950,
      "error": 30,
      "user_cancel": 20,
      "success_rate": 95.0,
      "avg_duration_ms": 5000,
      "avg_tokens": 1500,
      "trend": 5.2
    },
    "errors": {
      "total": 50,
      "error_rate": 5.0,
      "top_errors": [...],
      "trend": -2.1
    },
    "performance": {
      "metrics": [
        {
          "metric": "startup_time",
          "p50": 1000,
          "p90": 1500,
          "p95": 2000,
          "avg": 1200,
          "count": 100,
          "trend": 1.5
        }
      ]
    },
    "installs": {
      "total": 500,
      "success": 480,
      "failed": 20,
      "success_rate": 96.0,
      "avg_duration_ms": 30000,
      "by_version": [...],
      "by_platform": [...]
    }
  }
}
```

### 趋势数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/perf/trend` | GET | 性能趋势 |
| `/errors/trend` | GET | 错误趋势 |
| `/conversations/trend` | GET | 对话趋势 |
| `/installs/trend` | GET | 安装趋势 |

---

## 五、告警 API `/api/v1/alerts`

> 需要 JWT 认证

### 告警配置

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/configs` | GET | 配置列表 | viewer/operator/admin |
| `/configs/:id` | GET | 配置详情 | viewer/operator/admin |
| `/configs` | POST | 创建配置 | operator/admin |
| `/configs/:id` | PUT | 更新配置 | operator/admin |
| `/configs/:id` | DELETE | 删除配置 | admin |
| `/configs/:id/test` | POST | 测试告警 | operator/admin |

**告警配置结构:**
```json
{
  "name": "High Error Rate",
  "type": "conversation",
  "metric": "error_rate",
  "threshold": 5,
  "comparison": "gt",
  "level": "warning",
  "channels": ["dingtalk", "email"],
  "enabled": true,
  "cooldown_minutes": 30,
  "description": "当错误率超过5%时告警"
}
```

### 告警历史

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/history` | GET | 告警历史 | viewer/operator/admin |
| `/history/:id/acknowledge` | POST | 确认告警 | operator/admin |

### 告警类型

| Type | 可用 Metric |
|------|-------------|
| `perf` | 性能指标名称 (startup_time, response_time 等) |
| `error` | error_count |
| `conversation` | error_rate, avg_duration |
| `install` | failure_count |

### 告警级别

| Level | 说明 |
|-------|------|
| `info` | 信息告警 |
| `warning` | 警告告警 |
| `critical` | 严重告警 |

### 比较运算符

| Operator | 说明 |
|----------|------|
| `gt` | 大于 |
| `gte` | 大于等于 |
| `lt` | 小于 |
| `lte` | 小于等于 |
| `eq` | 等于 |
| `neq` | 不等于 |

### 通知渠道

| Channel | 说明 |
|---------|------|
| `dingtalk` | 钉钉 |
| `lark` | 飞书 |
| `email` | 邮件 |

---

## 六、系统 API `/api/v1/system`

> 需要 JWT 认证，部分需要 admin 权限

### 健康检查 (公开)

```http
GET /api/v1/system/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": true
  }
}
```

### 系统统计 (Admin)

```http
GET /api/v1/system/stats
Authorization: Bearer <admin-token>
```

### 系统配置 (Admin)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/config` | GET | 配置列表 |
| `/config/:key` | GET | 单项配置 |
| `/config/:key` | PUT | 更新配置 |

### 通知状态 (Admin)

```http
GET /api/v1/system/notifications
Authorization: Bearer <admin-token>
```

---

## 七、用户角色权限

| 角色 | 权限 |
|------|------|
| `admin` | 完全访问，包括用户管理、系统配置 |
| `operator` | 告警管理、确认告警、Dashboard |
| `viewer` | 只读访问 Dashboard |

---

## 八、API Key 权限

| 权限 | 说明 |
|------|------|
| `telemetry:write` | 上报遥测数据 |
| `telemetry:read` | 读取遥测数据 |
| `alerts:write` | 创建/更新告警 |
| `alerts:read` | 读取告警配置 |
| `system:read` | 读取系统状态 |
| `system:write` | 修改系统配置 |

---

## 九、加密相关

### 加密请求头

| Header | 说明 |
|--------|------|
| `X-Encryption` | 加密算法版本 (hybrid-v1) |
| `X-API-Key` | API Key (加密请求也需要) |

### 加密算法

- **算法**: hybrid-v1 (RSA-2048 + AES-256-GCM)
- **流程**:
  1. 客户端生成临时 AES-256 密钥
  2. RSA-OAEP 加密 AES 密钥
  3. AES-GCM 加密请求体
  4. Base64 编码传输

### 加密错误码

| Code | HTTP Status | 说明 |
|------|-------------|------|
| `ENCRYPTION_REQUIRED` | 400 | 服务端要求加密 |
| `DECRYPTION_FAILED` | 400 | 解密失败 |
| `RSA_DECRYPT_ERROR` | 400 | RSA 解密错误 |
| `AES_DECRYPT_ERROR` | 400 | AES 解密错误 |

---

## 十、错误响应格式

所有错误遵循统一格式:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### 常见错误码

| Code | HTTP Status | 说明 |
|------|-------------|------|
| `UNAUTHORIZED` | 401 | 未认证 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `DUPLICATE_ENTRY` | 409 | 资源已存在 |
| `INVALID_CREDENTIALS` | 401 | 用户名/密码错误 |
| `INVALID_TOKEN` | 401 | JWT 无效或过期 |
| `INVALID_API_KEY` | 401 | API Key 无效 |
| `EXPIRED_API_KEY` | 401 | API Key 已过期 |
| `MISSING_API_KEY` | 401 | 缺少 API Key |
| `MISSING_FIELD` | 400 | 缺少必填字段 |
| `NO_UPDATE` | 400 | 无更新内容 |
| `CANNOT_DELETE_SELF` | 400 | 不能删除自己 |
| `INTERNAL_ERROR` | 500 | 服务器错误 |

---

## 十一、请求/响应时间格式

- 所有时间戳使用 Unix 毫秒格式 (`number`)
- 查询参数: `start_time`, `end_time`
- 默认时间范围: 最近 24 小时或 7 天