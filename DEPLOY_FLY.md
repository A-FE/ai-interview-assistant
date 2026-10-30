# Fly.io 部署指南

## 前置准备

1. 注册 [Fly.io](https://fly.io) 账号
2. 安装 Fly CLI：
   ```bash
   # macOS
   brew install flyctl
   
   # Linux
   curl -L https://fly.io/install.sh | sh
   
   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```
3. 登录：
   ```bash
   flyctl auth login
   ```

## 部署步骤

### 1. 初始化 Fly 应用

```bash
# 在项目根目录执行
flyctl launch

# 按提示配置：
# - App name: ai-interview-assistant（或自定义）
# - Region: Hong Kong (hkg) 或 Tokyo (nrt) - 亚太地区延迟低
# - Postgres: No（我们使用 SQLite）
# - Deploy now: No（先配置环境变量）
```

这会生成 `fly.toml` 配置文件。

### 2. 配置 fly.toml

编辑生成的 `fly.toml`，确保包含：

```toml
app = "ai-interview-assistant"
primary_region = "hkg"

[build]
  dockerfile = "Dockerfile"

[env]
  LLM_MODEL = "qwen3.8-max"
  LLM_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
  DATABASE_URL = "sqlite+aiosqlite:///./data/jobprep.db"
  CHROMA_PERSIST_DIR = "./data/chroma_db"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/health"

[mounts]
  source = "data"
  destination = "/app/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### 3. 创建持久化存储卷

```bash
# 创建 1GB 存储卷用于 SQLite + ChromaDB
flyctl volumes create data --region hkg --size 1
```

### 4. 配置敏感环境变量

```bash
flyctl secrets set DASHSCOPE_API_KEY=your_dashscope_api_key_here
flyctl secrets set SECRET_KEY=your_super_secret_jwt_key
```

### 5. 部署

```bash
flyctl deploy
```

首次部署约需 5-10 分钟。

### 6. 获取公网地址

```bash
flyctl info
```

应用地址：`https://ai-interview-assistant.fly.dev`

## 部署后配置

### 1. 初始化 RAG 知识库

通过 SSH 连接到 Fly 机器：

```bash
flyctl ssh console

# 在机器内执行
cd /app
python -m backend.rag.init_kb
exit
```

### 2. 更新 Vercel 环境变量

```bash
VITE_API_BASE_URL=https://ai-interview-assistant.fly.dev
```

### 3. 更新 CORS

编辑 `backend/main.py`，添加 Fly.io 和 Vercel 域名后重新部署。

## 管理命令

```bash
# 查看应用状态
flyctl status

# 查看日志
flyctl logs

# 扩容（增加实例）
flyctl scale count 2

# 调整资源
flyctl scale memory 512

# SSH 连接
flyctl ssh console

# 重启应用
flyctl apps restart

# 查看资源使用
flyctl metrics
```

## 数据备份

```bash
# 下载 SQLite 数据库
flyctl ssh sftp get /app/data/jobprep.db ./backup/

# 上传备份
flyctl ssh sftp put ./backup/jobprep.db /app/data/
```

## 成本说明

Fly.io 免费额度（Hobby Plan）：

- ✅ 3 个小型应用（256 MB RAM）
- ✅ 3 GB 持久化存储
- ✅ 160 GB 出站流量/月
- ✅ 无自动休眠，始终在线

**本项目消耗**：
- 1 个应用
- ~256 MB RAM（足够）
- ~500 MB 存储（SQLite + ChromaDB）
- 流量取决于使用量

**完全在免费额度内！**

## 性能优化

### 1. 选择最近的区域

```bash
# 查看可用区域
flyctl platform regions

# 中国用户推荐：
# - hkg (Hong Kong)
# - nrt (Tokyo)
# - sin (Singapore)
```

### 2. 启用 Autoscaling

```toml
[http_service]
  auto_stop_machines = true  # 无流量时停止
  auto_start_machines = true # 有请求时启动
  min_machines_running = 0   # 最少 0 台（完全按需）
```

⚠️ 注意：`min_machines_running = 0` 会导致冷启动（~5 秒）。

## 常见问题

### Q: 部署失败，提示 "no space left on device"？

A: Dockerfile 层太大，优化构建：
```dockerfile
RUN pip install --no-cache-dir -r requirements.txt
```

### Q: 如何查看详细的构建日志？

```bash
flyctl logs --app ai-interview-assistant
```

### Q: 应用无法访问，一直显示 502？

A: 检查：
1. 健康检查路径是否正确（`/health`）
2. 端口配置（必须监听 `0.0.0.0:8000`）
3. 日志中是否有启动错误

### Q: ChromaDB 初始化失败？

A: 首次部署可以跳过 RAG，后续通过 SSH 手动初始化。

### Q: 如何从 Railway 迁移到 Fly.io？

```bash
# 1. 备份 Railway 数据
# 2. 部署到 Fly.io
flyctl deploy

# 3. 上传数据库
flyctl ssh sftp put ./jobprep.db /app/data/

# 4. 上传 ChromaDB（可选，或重新初始化）
```

## 监控和告警

### 查看实时指标

```bash
flyctl dashboard
```

### 配置告警（付费功能）

Fly.io Pro 提供 Prometheus 指标和告警。

## 生产环境建议

1. **启用自动备份**
   ```bash
   # 定时任务备份数据库到对象存储（S3/OSS）
   ```

2. **配置 CDN**
   - 静态资源通过 Vercel CDN
   - API 使用 Fly.io（已全球分布）

3. **监控和日志**
   - 集成 Sentry 捕获错误
   - 使用 Fly.io 内置日志

4. **安全加固**
   - 限制 CORS 白名单
   - 使用强 SECRET_KEY
   - 定期更新依赖

## 平台对比总结

| 特性 | Railway | Render | Fly.io |
|------|---------|--------|--------|
| 免费额度 | 500h/月 | 750h/月 | 3 个应用 |
| 休眠 | ❌ 无 | ✅ 15 分钟 | ❌ 无 |
| 冷启动 | - | 30-90s | ~5s |
| 持久化存储 | ✅ | ⚠️ 重置 | ✅ |
| 部署速度 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| 配置难度 | 简单 | 简单 | 中等 |
| 推荐场景 | 快速 Demo | 预算有限 | 生产就绪 |

## 下一步

1. ✅ 部署成功后，复制 Fly.io 域名
2. ✅ 在 Vercel 配置 `VITE_API_BASE_URL`
3. ✅ 更新 CORS 配置
4. ✅ SSH 初始化 RAG 知识库
5. ✅ 测试完整流程
6. ✅ 配置自动备份（可选）
