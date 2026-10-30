# Render 部署指南

## 前置准备

1. 注册 [Render](https://render.com) 账号
2. 准备阿里云百炼 API Key

## 部署步骤

### 1. 创建 Web Service

1. 访问 [Render Dashboard](https://dashboard.render.com/)
2. 点击 "New +" → "Web Service"
3. 连接 GitHub 仓库并选择本项目
4. 配置如下：

   | 字段 | 值 |
   |------|-----|
   | Name | `ai-interview-assistant` |
   | Environment | `Python 3` |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | `Free` |

### 2. 配置环境变量

在 Environment Variables 中添加：

```bash
DASHSCOPE_API_KEY=your_dashscope_api_key_here
LLM_MODEL=qwen3.8-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
SECRET_KEY=your_super_secret_jwt_key_change_this
DATABASE_URL=sqlite+aiosqlite:///./jobprep.db
CHROMA_PERSIST_DIR=./chroma_db
PYTHON_VERSION=3.12.9
```

### 3. 部署

点击 "Create Web Service"，Render 会自动：
- 克隆仓库
- 安装依赖
- 启动服务

首次部署约需 5-10 分钟。

### 4. 获取公网地址

部署完成后，Render 会分配一个地址：
- `https://your-app.onrender.com`

## 重要提醒：免费套餐限制

⚠️ **Render 免费套餐的关键限制**：

1. **自动休眠**：15 分钟无活动后自动休眠
2. **冷启动慢**：休眠后首次访问需要 30-90 秒唤醒
3. **512 MB RAM**：足够本项目使用
4. **每月 750 小时**：可 24/7 运行

### 解决休眠问题

如果无法接受冷启动延迟，可以：

**方案 A：定时 ping（推荐）**

使用 [Cron-Job.org](https://cron-job.org) 或 [UptimeRobot](https://uptimerobot.com/) 每 10 分钟 ping 一次：

```
https://your-app.onrender.com/health
```

**方案 B：升级到付费套餐（$7/月）**

- 无自动休眠
- 更多 RAM 和 CPU
- 更快的构建速度

## 部署后配置

### 1. 初始化 RAG 知识库

Render Shell 访问：Dashboard → 你的服务 → Shell

```bash
python -m backend.rag.init_kb
```

### 2. 更新 Vercel 环境变量

```bash
VITE_API_BASE_URL=https://your-app.onrender.com
```

### 3. 更新 CORS 配置

编辑 `backend/main.py`：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://your-vercel-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

提交后 Render 会自动重新部署。

## 数据持久化

Render 免费套餐的磁盘存储特点：

- ✅ 在服务运行期间持久化
- ❌ 重新部署时会重置
- ❌ 服务删除后数据丢失

**解决方案**：

1. **使用外部数据库**（推荐生产环境）
   - PostgreSQL：Render 提供免费 PostgreSQL
   - 需要修改代码从 SQLite 迁移到 PostgreSQL

2. **接受数据重置**（适合 Demo）
   - 每次重新部署后用户数据会丢失
   - 适合演示和测试

## 查看日志

Dashboard → 你的服务 → Logs

实时查看应用日志，便于调试。

## 自定义域名（可选）

Render 支持免费绑定自定义域名：

1. Dashboard → Settings → Custom Domain
2. 添加域名并配置 DNS CNAME 记录
3. Render 自动配置 SSL 证书

## 常见问题

### Q: 构建失败，提示依赖安装错误？

A: 检查 `requirements.txt` 版本兼容性，可以尝试：
```bash
pip install -r requirements.txt
```
在本地测试。

### Q: 服务启动后立即崩溃？

A: 查看 Logs，常见原因：
1. 环境变量未配置
2. 端口绑定错误（必须使用 `$PORT`）
3. Python 版本不匹配

### Q: 冷启动太慢，用户体验差？

A: 选择以下方案之一：
1. 使用定时 ping 服务保持唤醒
2. 升级到付费套餐（$7/月）
3. 迁移到 Railway（免费无休眠）

### Q: 如何备份数据？

A: 免费套餐建议定期手动备份：
```bash
# 在 Render Shell 中
sqlite3 jobprep.db .dump > backup.sql
```

## 性能对比

| 平台 | 优点 | 缺点 |
|------|------|------|
| **Render** | 简单易用，自动 SSL | 免费版会休眠，冷启动慢 |
| **Railway** | 无休眠，启动快 | 免费额度有限（500h/月） |
| **Fly.io** | 更接近生产环境 | 配置复杂，需要 Dockerfile |

## 推荐选择

- **Demo 演示**：Railway（快速访问，无冷启动）
- **长期运行**：Render 付费版（$7/月，稳定可靠）
- **学习实践**：Render 免费版（可接受冷启动）

## 下一步

1. ✅ 部署成功后，复制 Render 域名
2. ✅ 配置定时 ping 服务（避免休眠）
3. ✅ 在 Vercel 配置 `VITE_API_BASE_URL`
4. ✅ 更新 CORS 配置
5. ✅ 测试完整流程（注意首次访问需等待唤醒）
