# Sudoclaw QMS

**Sudoclaw Quality Management System** - Sudoclaw 质量监控系统，用于 Sudoclaw Electron 应用的遥测数据收集、Crash 监控和可视化分析。

## 功能概述

### 遥测数据收集
- **性能指标**: 冷启动时间、首Token响应、对话响应等性能数据采集
- **对话分析**: AI对话成功率、错误类型、Token使用量统计
- **安装统计**: 安装成功率、安装耗时、失败原因追踪
- **数据聚合**: 自动每小时聚合，支持 P50/P90/P95/P99 百分位计算

### Crash 监控
- **原生崩溃**: macOS/Windows/Linux 原生 Crash 捕获与分析
- **JS异常**: JavaScript 异常堆栈追踪与 Issue 聚合
- **Issue 管理**: 自动聚合、状态管理（未解决/已解决/忽略）
- **Source Map**: 支持 Source Map 上传，还原压缩代码原始位置

### Dashboard 可视化
- **总览面板**: 关键指标一览、趋势图表
- **性能分析**: 按版本/平台/指标的性能趋势与分布
- **对话统计**: 成功率、错误类型分布、响应时间分析
- **安装统计**: 安装成功率、安装类型分布
- **Crash分析**: Issue列表、趋势图、平台分布

### 告警系统
- **阈值告警**: 支持多种指标阈值监控
- **多通道通知**: 飞书、邮件通知
- **告警管理**: 配置、历史、确认机制

### 数据安全
- **混合加密**: RSA-2048 + AES-GCM 混合加密方案
- **敏感数据**: 支持遥测数据加密传输
- **认证系统**: JWT 认证 + 用户角色权限控制

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Bun + Hono |
| 数据库 | PostgreSQL + TimescaleDB |
| 缓存/队列 | Redis |
| 前端框架 | React 18 + Ant Design 5 |
| 构建工具 | Vite 5 |
| 图表库 | @ant-design/plots |

## 端口配置

| 服务 | 端口 |
|------|------|
| 后端 API | 6078 |
| 前端开发 | 5173 (Vite) |
| PostgreSQL | 5432 |
| Redis | 6379 |

## 项目结构

```
sudoclaw-qms/
├── packages/
│   ├── core/                    # 后端 API 服务
│   │   ├── src/
│   │   │   ├── config/          # 配置管理
│   │   │   ├── constants/       # 常量/错误码
│   │   │   ├── db/              # 数据库 schema + 初始化
│   │   │   ├── middleware/      # 认证、CORS、加密、错误处理
│   │   │   ├── routes/          # API 路由 (telemetry, dashboard, alerts, auth, system, crash)
│   │   │   ├── services/        # 业务服务 (聚合、告警、通知、队列)
│   │   │   ├── tasks/           # 定时任务调度器
│   │   │   ├── types/           # TypeScript 类型定义
│   │   │   ├── utils/           # JWT、日志、密码、统计工具
│   │   │   └── index.ts         # 入口文件
│   │   └── package.json
│   │
│   ├── admin/                   # 前端 Dashboard
│   │   ├── src/
│   │   │   ├── api/             # API 客户端 + 类型
│   │   │   ├── components/      # Layout、StatCard 等组件
│   │   │   ├── constants/       # 错误码常量
│   │   │   ├── hooks/           # useAuth Hook
│   │   │   ├── pages/           # 10 个页面组件
│   │   │   │   ├── Dashboard    # 总览面板
│   │   │   │   ├── Performance  # 性能分析
│   │   │   │   ├── Conversations# 对话统计
│   │   │   │   ├── Installs     # 安装统计
│   │   │   │   ├── Alerts       # 告警配置
│   │   │   │   ├── CrashIssues  # Crash Issue 管理
│   │   │   │   ├── CrashStats   # Crash 统计
│   │   │   │   ├── Users        # 用户管理
│   │   │   │   ├── System       # 系统设置
│   │   │   │   └── Login        # 登录页面
│   │   │   ├── App.tsx          # 路由配置
│   │   │   └── main.tsx         # 入口文件
│   │   └── package.json
│   │
│   └── shared/                  # 共享类型定义
│       ├── src/
│       │   ├── types/           # 公共类型
│       │   └── utils/           # 共享工具
│       └── package.json
│
├── scripts/                     # 构建/部署脚本
│   ├── build.sh                 # 构建脚本
│   ├── deploy.sh                # 部署脚本
│   └── setup.sh                 # 初始化脚本
│
├── docs/                        # 文档
│   ├── API.md                   # API 详细文档
│   └── DATABASE.md              # 数据库设计文档
│
├── deploy/                      # 部署配置
│   ├── systemd/                 # Systemd 服务配置
│   └── nginx/                   # Nginx 配置
│
├── Dockerfile                   # Docker 构建文件
├── docker-compose.yml           # Docker Compose 配置
├── package.json                 # Workspace 配置
└── tsconfig.json                # TypeScript 配置
```

## 快速开始

### 前置条件

- [Bun](https://bun.sh) v1.0+
- PostgreSQL 14+ (建议安装 TimescaleDB 扩展)
- Redis 6+

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd sudoclaw-qms

# 安装依赖
bun install

# 配置环境变量
cp packages/core/.env.example packages/core/.env
```

### 环境变量配置

创建 `packages/core/.env` 文件：

```bash
# 服务配置
PORT=6078
HOST=0.0.0.0
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sudowork_qms
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 认证
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# 数据加密 (可选)
TELEMETRY_PRIVATE_KEY=<RSA-2048 PEM>
TELEMETRY_ENCRYPTION_REQUIRED=false

# 通知配置 (可选)
LARK_WEBHOOK_URL=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

### 启动服务

**开发模式 - 后端**
```bash
bun run dev
# 或
bun run dev:core
```

**开发模式 - 前端**
```bash
bun run dev:admin
```

**生产模式**
```bash
# 构建前后端
bun run build

# 启动服务 (自动托管前端)
cd packages/core
bun run start
```

### 服务地址

| 地址 | 说明 |
|------|------|
| http://localhost:6078 | 后端 API + 前端 (生产模式) |
| http://localhost:6078/api/v1 | API 端点 |
| http://localhost:6078/admin | Dashboard (生产模式) |
| http://localhost:6078/health | 健康检查 |
| http://localhost:5173 | 前端开发服务器 |

### 默认账号

- **用户名**: `admin`
- **密码**: `admin123`

> 生产环境请立即修改默认密码！

## API 端点

### 认证 `/api/v1/auth`

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| POST | /login | 用户登录 | - |
| POST | /logout | 用户登出 | 登录 |
| GET | /profile | 当前用户信息 | 登录 |
| POST | /change-password | 修改密码 | 登录 |
| GET | /users | 用户列表 | admin |
| POST | /users | 创建用户 | admin |
| PUT | /users/:id | 更新用户 | admin |
| DELETE | /users/:id | 删除用户 | admin |

### 遥测数据 `/api/v1/telemetry`

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /batch | 批量上报遥测数据 |
| POST | /perf | 单条性能数据 |
| POST | /conversation | 单条对话数据 |
| POST | /install | 单条安装数据 |

### Dashboard `/api/v1/dashboard`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /overview | 总览统计数据 |
| GET | /perf/trend | 性能趋势数据 |
| GET | /perf/distribution | 性能分布数据 |
| GET | /conversations/trend | 对话趋势数据 |
| GET | /conversations/errors | 对话错误统计 |
| GET | /installs/trend | 安装趋势数据 |
| GET | /installs/distribution | 安装分布数据 |

### Crash 监控 `/api/v1/crash`

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /events/batch | 批量 Crash 上报 |
| POST | /events | 单条 Crash 上报 |
| GET | /issues | Issue 列表 |
| GET | /issues/:id | Issue 详情 |
| PUT | /issues/:id | 更新 Issue |
| POST | /issues/:id/resolve | 标记已解决 |
| POST | /issues/:id/ignore | 标记忽略 |
| GET | /events | Crash 事件列表 |
| GET | /events/:id | Crash 事件详情 |
| GET | /stats/summary | Crash 统计摘要 |
| GET | /stats/trend | Crash 趋势数据 |
| GET | /stats/distribution | Crash 分布数据 |

### 告警 `/api/v1/alerts`

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | /configs | 告警配置列表 | 登录 |
| POST | /configs | 创建告警配置 | operator |
| PUT | /configs/:id | 更新告警配置 | operator |
| DELETE | /configs/:id | 删除告警配置 | admin |
| GET | /history | 告警历史 | 登录 |
| POST | /history/:id/acknowledge | 确认告警 | operator |
| POST | /configs/:id/test | 测试告警通知 | operator |

### 系统 `/api/v1/system`

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | /stats | 系统统计 | admin |
| GET | /config | 系统配置 | admin |
| PUT | /config/:key | 更新配置 | admin |
| GET | /notifications | 通知状态 | admin |
| GET | /queue/stats | 队列统计 | admin |

## 数据库设计

### 时序数据表 (Hypertables)

TimescaleDB 自动将以下表转换为 Hypertable：

| 表名 | 说明 | 分区键 |
|------|------|------|
| telemetry_perf_raw | 性能原始数据 | timestamp |
| telemetry_conversations | 对话原始数据 | timestamp |
| telemetry_install | 安装原始数据 | timestamp |
| crash_events | Crash 事件明细 | timestamp |

### 聚合表 (Continuous Aggregates)

TimescaleDB 自动维护的物化视图：

| 表名 | 说明 | 聚合周期 |
|------|------|------|
| telemetry_perf_daily | 性能每日聚合 (P50/P90/P95/P99) | 1 day |
| telemetry_conversations_daily | 对话每日聚合 | 1 day |
| telemetry_conversation_errors_daily | 对话错误每日聚合 | 1 day |
| telemetry_install_daily | 安装每日聚合 | 1 day |
| crash_daily_stats | Crash 每日统计 | 1 day |

### 业务表

| 表名 | 说明 |
|------|------|
| users | 用户账户 |
| alert_config | 告警配置 |
| alert_history | 告警历史 |
| crash_issues | Crash Issue 聚合 |
| source_maps | Source Map 存储 |
| system_config | 系统配置 |
| audit_logs | 审计日志 |

### 数据保留策略

TimescaleDB 自动清理策略：

| 数据类型 | 原始数据保留 | 聚合数据保留 |
|----------|--------------|--------------|
| 性能数据 | 90 天 | 365 天 |
| 对话数据 | 180 天 | 365 天 |
| 安装数据 | 90 天 | 365 天 |
| Crash 数据 | 90 天 | - |

## Dashboard 页面

| 页面 | 路径 | 权限 | 说明 |
|------|------|------|------|
| 总览 | / | 登录 | 关键指标一览、趋势图表 |
| 性能分析 | /performance | 登录 | 按版本/平台性能趋势 |
| 对话统计 | /conversations | 登录 | 成功率、错误分布 |
| 安装统计 | /installs | 登录 | 安装成功率趋势 |
| 告警配置 | /alerts | operator | 告警规则管理 |
| Crash Issues | /crash-issues | 登录 | Issue 列表与状态管理 |
| Crash 统计 | /crash-stats | 登录 | Crash 趋势与分布 |
| 用户管理 | /users | admin | 用户 CRUD |
| 系统设置 | /system | admin | 配置与通知管理 |

## 用户角色

| 角色 | 权限范围 |
|------|----------|
| admin | 完全访问：用户管理、系统配置、告警配置 |
| operator | 告警管理、确认告警 |
| viewer | 只读访问：查看 Dashboard |

## 定时任务

| 任务 | 间隔 | 说明 |
|------|------|------|
| telemetry-aggregation | 每小时 | 遥测数据聚合 |
| telemetry-cleanup | 每 6 小时 | 清理过期遥测数据 |
| crash-aggregation | 每小时 | Crash 数据聚合与 Issue 更新 |
| crash-cleanup | 每 6 小时 | 清理过期 Crash 数据 |
| alert-check | 每 5 分钟 | 告警阈值检测 |

## 数据加密

系统支持 RSA-2048 + AES-GCM 混合加密方案：

### 加密流程

1. 客户端生成随机 AES-256-GCM 密钥
2. 使用 AES 密钥加密数据
3. 使用 RSA-2048 公钥加密 AES 密钥
4. 上报加密后的数据 + 加密后的密钥

### 配置

```bash
# 生成 RSA 密钥对
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# 配置环境变量
TELEMETRY_PRIVATE_KEY=<private.pem 内容>
TELEMETRY_ENCRYPTION_REQUIRED=true  # 强制加密
```

## 部署

### Docker Compose

```bash
docker-compose up -d
```

`docker-compose.yml` 包含：
- PostgreSQL + TimescaleDB
- Redis
- Sudoclaw QMS 服务

### 手动部署

```bash
# 构建
bash scripts/build.sh

# 部署 systemd 服务
bash scripts/deploy.sh

# 管理服务
systemctl status sudoclaw-qms
systemctl restart sudoclaw-qms
journalctl -u sudoclaw-qms -f
```

### 生产配置建议

1. **数据库**: 安装 TimescaleDB 扩展获得最佳性能
2. **加密**: 生产环境启用数据加密
3. **JWT**: 修改 `JWT_SECRET`
4. **通知**: 配置飞书/邮件通知
5. **保留**: 根据需求调整数据保留天数

## 开发指南

### 本地开发

```bash
# 启动后端
bun run dev

# 启动前端 (另一终端)
bun run dev:admin
```

### 构建

```bash
bun run build        # 构建全部
bun run build:core   # 仅构建后端
bun run build:admin  # 仅构建前端
```

### 测试

```bash
bun test
```

### 类型检查

```bash
bun run --cwd packages/core typecheck
```

## 测试 API

```bash
# 健康检查
curl http://localhost:6078/health

# 登录
curl -X POST http://localhost:6078/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 上报遥测数据
curl -X POST http://localhost:6078/api/v1/telemetry/batch \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"perf","timestamp":1713849600000,"version":"1.0.0","platform":"darwin","metric":"cold_start","value_ms":1500}]}'

# 上报 Crash
curl -X POST http://localhost:6078/api/v1/crash/events \
  -H "Content-Type: application/json" \
  -d '{"type":"js_exception","timestamp":1713849600000,"version":"1.0.0","platform":"darwin","process_type":"main","error_name":"TypeError","error_message":"test error","stack_trace":"at foo (file.js:10)","fingerprint":"abc123"}'

# 查看统计
curl http://localhost:6078/api/v1/dashboard/overview
curl http://localhost:6078/api/v1/crash/stats/summary
```

## 文档

- [API 详细文档](docs/API.md)
- [数据库设计文档](docs/DATABASE.md)

## License

MIT

## Contributing

1. Fork 项目
2. 创建特性分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request