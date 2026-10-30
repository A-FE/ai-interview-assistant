# 部署指南

本文档说明如何将 AI 面试助手部署到生产环境。

## 快速配置

### 后端部署（Render / 其他平台）

1. **设置环境变量**

```bash
# 必填项
DASHSCOPE_API_KEY=your_actual_api_key

# CORS 配置（重要！）
# 添加你的前端域名，逗号分隔，无空格
CORS_ORIGINS=https://your-frontend-domain.com,https://ai-interview-assistant-f8oi.onrender.com

# 安全配置（生产环境必须修改）
SECRET_KEY=your_random_strong_secret_key_here

# 其他配置（可选）
LLM_MODEL=qwen3.8-max
DATABASE_URL=sqlite+aiosqlite:///./jobprep.db
```

2. **初始化 RAG 知识库**

首次部署后需要初始化向量数据库（如果使用持久化存储）：

```bash
python -m backend.rag.init_kb
```

### 前端部署（Vercel / Netlify / 静态托管）

1. **创建环境变量文件**

在项目根目录创建 `frontend/.env.production`：

```bash
# 指向你的后端 API 地址
VITE_API_BASE_URL=https://ai-interview-assistant-f8oi.onrender.com
```

2. **构建生产版本**

```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist/` 目录，上传到静态托管服务即可。

## 平台特定说明

### Render.com

**后端服务**：
- Build Command: `pip install -r requirements.txt && python -m backend.rag.init_kb`
- Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- 在 Environment 页面添加上述环境变量

**前端服务**（如果也托管在 Render）：
- Build Command: `cd frontend && npm install && npm run build`
- Publish Directory: `frontend/dist`
- 添加环境变量 `VITE_API_BASE_URL`

### Vercel（前端）

1. 导入 GitHub 仓库
2. Root Directory 设置为 `frontend`
3. Framework Preset 选择 `Vite`
4. 添加环境变量：
   - `VITE_API_BASE_URL`: 你的后端 API 地址

### Railway / Fly.io

配置类似 Render，注意：
- Railway 会自动检测 Python 项目并安装依赖
- Fly.io 需要创建 `fly.toml` 配置文件

## 安全检查清单

部署前务必检查：

- [ ] `SECRET_KEY` 已修改为强随机密钥（生成方法：`openssl rand -hex 32`）
- [ ] `CORS_ORIGINS` 仅包含你的前端域名，不包含通配符 `*`
- [ ] `DASHSCOPE_API_KEY` 妥善保管，不要提交到 Git
- [ ] 生产数据库使用持久化存储（非 SQLite 或挂载持久卷）
- [ ] 代码沙箱限制已启用（`SANDBOX_TIMEOUT_SECONDS` 和 `SANDBOX_MAX_MEMORY_MB`）

## 常见问题

### Q1: 前端无法连接后端，报 CORS 错误

**原因**：后端 `CORS_ORIGINS` 未包含前端域名。

**解决**：在后端环境变量中添加：
```bash
CORS_ORIGINS=https://your-frontend-domain.com
```

### Q2: API 返回 401 Unauthorized

**原因**：JWT token 过期或 `SECRET_KEY` 不一致。

**解决**：
1. 确保后端 `SECRET_KEY` 在所有实例上一致
2. 用户重新登录以获取新 token

### Q3: RAG 知识检索返回空结果

**原因**：向量数据库未初始化。

**解决**：
```bash
python -m backend.rag.init_kb
```

### Q4: 首次部署数据库表不存在

**原因**：数据库未初始化。

**解决**：FastAPI 启动时会自动调用 `init_db()`，如果仍有问题，检查数据库文件权限。

## 监控与日志

### 健康检查端点

```bash
curl https://your-backend-domain.com/health
# 预期返回: {"status":"ok","service":"JobPrep Agent"}
```

### 查看日志

应用使用 Python logging，日志级别为 INFO。在云平台控制台查看实时日志。

## 数据备份

### SQLite 数据库备份

```bash
# 备份数据库文件
cp jobprep.db jobprep.db.backup

# 定期备份脚本（可添加到 cron）
tar -czf backup-$(date +%Y%m%d).tar.gz jobprep.db chroma_db/
```

### 向量数据库备份

```bash
# 备份整个 chroma_db 目录
tar -czf chroma_db_backup.tar.gz chroma_db/
```

## 性能优化建议

1. **启用 CDN**：静态资源（前端 dist/）通过 CDN 分发
2. **数据库升级**：生产环境建议使用 PostgreSQL 替代 SQLite
3. **缓存策略**：复习计划已有缓存，考虑添加 Redis 缓存热点数据
4. **并发限制**：LLM 调用添加速率限制，防止 API 配额耗尽

## 回滚流程

如遇问题需要回滚：

1. **后端**：在云平台控制台选择上一个部署版本
2. **前端**：重新部署上一个 Git commit
3. **数据库**：从备份恢复（谨慎操作）

---

**当前线上环境**：
- 后端 API: https://ai-interview-assistant-f8oi.onrender.com
- 前端域名：（待配置）
