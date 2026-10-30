# Railway 部署指南

## 前置准备

1. 注册 [Railway](https://railway.app) 账号
2. 准备阿里云百炼 API Key（访问 [百炼控制台](https://bailian.console.aliyun.com/)）

## 部署步骤

### 方式一：通过 Railway Dashboard（推荐）

1. **创建新项目**
   - 访问 [railway.app/new](https://railway.app/new)
   - 选择 "Deploy from GitHub repo"
   - 授权并选择本仓库

2. **配置环境变量**
   
   在 Railway Dashboard → Variables 中添加：
   
   ```bash
   DASHSCOPE_API_KEY=your_dashscope_api_key_here
   LLM_MODEL=qwen3.8-max
   LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
   SECRET_KEY=your_super_secret_jwt_key_change_this_in_production
   DATABASE_URL=sqlite+aiosqlite:///./jobprep.db
   CHROMA_PERSIST_DIR=./chroma_db
   ```

3. **配置端口**
   
   Railway 会自动注入 `$PORT` 环境变量，项目已配置为使用该端口。

4. **部署**
   
   - Railway 自动检测到 `railway.json` 配置
   - 点击 "Deploy" 开始构建
   - 等待 5-10 分钟完成首次部署

5. **获取公网地址**
   
   - 部署完成后，在 Settings → Networking 中点击 "Generate Domain"
   - 复制生成的域名（如 `https://your-app.railway.app`）

### 方式二：通过 Railway CLI

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 添加环境变量
railway variables set DASHSCOPE_API_KEY=your_key
railway variables set SECRET_KEY=your_secret

# 部署
railway up
```

## 部署后配置

### 1. 初始化 RAG 知识库

首次部署后，需要通过 Railway Shell 初始化知识库：

```bash
# 在 Railway Dashboard 中打开 Shell
python -m backend.rag.init_kb
```

或者本地运行后上传 `chroma_db/` 目录（不推荐，文件较大）。

### 2. 更新前端 API 地址

将 Railway 生成的域名配置到 Vercel：

```bash
# Vercel Dashboard → Settings → Environment Variables
VITE_API_BASE_URL=https://your-app.railway.app
```

### 3. 更新后端 CORS

编辑 `backend/main.py`，添加 Vercel 域名：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://your-vercel-app.vercel.app",  # 添加这行
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

提交更改后，Railway 会自动重新部署。

## 验证部署

### 1. 检查健康状态

```bash
curl https://your-app.railway.app/health
```

应返回：
```json
{"status": "ok", "service": "JobPrep Agent"}
```

### 2. 测试 API 文档

访问：`https://your-app.railway.app/docs`

### 3. 查看日志

在 Railway Dashboard → Deployments → View Logs

## 数据持久化说明

Railway 提供持久化磁盘存储：
- SQLite 数据库（`jobprep.db`）会保留
- ChromaDB 向量库（`chroma_db/`）会保留
- 上传的简历文件会保留

⚠️ **注意**：如果删除项目或服务，数据将丢失。建议定期备份重要数据。

## 常见问题

### Q: 部署失败，提示找不到模块？

A: 确保 `requirements.txt` 包含所有依赖，Railway 会自动安装。

### Q: 应用启动后立即崩溃？

A: 检查日志，常见原因：
1. `DASHSCOPE_API_KEY` 未配置
2. 端口配置错误（应使用 `$PORT`）
3. RAG 知识库未初始化（可以延后初始化）

### Q: ChromaDB 初始化失败？

A: 首次部署时可以跳过 RAG 知识库，应用仍可正常运行（RAG 功能不可用）。部署成功后再通过 Shell 初始化。

### Q: Railway 免费额度是多少？

A: 
- 免费套餐：500 小时/月（约 20 天连续运行）
- 512 MB RAM
- 1 GB 存储
- 足够本项目使用

### Q: 如何监控资源使用？

A: Railway Dashboard → Metrics 可查看 CPU、内存、网络使用情况。

## 成本优化

### 1. 按需启动（节省免费额度）

如果不是 24/7 运行，可以在不使用时暂停服务：

```bash
railway down  # 停止服务
railway up    # 重新启动
```

### 2. 升级到 Pro（$5/月）

- 移除 500 小时限制
- 2 GB RAM
- 优先级更高的构建和部署

## 其他平台部署

如果不想用 Railway，也可以选择：

### Render
- 免费套餐（启动较慢，15 分钟无活动会休眠）
- 参考 `DEPLOY_RENDER.md`

### Fly.io
- 免费 3 个小型应用
- 更接近 Docker 部署方式
- 参考 `DEPLOY_FLY.md`

## 下一步

1. ✅ 部署成功后，复制 Railway 域名
2. ✅ 在 Vercel 配置 `VITE_API_BASE_URL`
3. ✅ 更新 `backend/main.py` 的 CORS 配置
4. ✅ 初始化 RAG 知识库（可选）
5. ✅ 访问 Vercel 前端，测试完整流程
