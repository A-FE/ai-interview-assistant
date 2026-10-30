# Vercel 前端部署指南

本项目采用混合部署架构：前端部署到 Vercel，后端部署到支持长运行容器的平台（Railway / Render / Fly.io）。

## 快速部署

### 1. 部署前端到 Vercel

#### 方式一：通过 Vercel CLI（推荐）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

#### 方式二：通过 Vercel Dashboard

1. 访问 [vercel.com](https://vercel.com)
2. 导入 GitHub 仓库
3. Vercel 会自动检测到 `vercel.json` 配置
4. 点击 Deploy

### 2. 配置环境变量

在 Vercel Dashboard 中设置环境变量：

```
VITE_API_BASE_URL=https://your-backend-api.railway.app
```

⚠️ **重要**：每次修改环境变量后需要重新部署。

### 3. 部署后端

后端需要部署到支持以下特性的平台：
- 长运行容器（非 Serverless）
- 持久化文件系统（SQLite + ChromaDB）
- 支持 Python 3.11+

推荐平台：
- **Railway**：免费套餐 500 小时/月
- **Render**：免费套餐（启动较慢）
- **Fly.io**：免费套餐 3 个小型应用

## 后端部署步骤（以 Railway 为例）

### Railway 部署

1. 访问 [railway.app](https://railway.app)
2. 创建新项目 → 从 GitHub 导入仓库
3. 添加环境变量：
   ```
   DASHSCOPE_API_KEY=your_api_key
   LLM_MODEL=qwen3.8-max
   SECRET_KEY=your_secret_key_change_this
   ```
4. 设置启动命令：
   ```
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
5. Railway 会自动生成公网地址（如 `https://xxx.railway.app`）

### 更新后端 CORS 配置

部署后，需要更新 `backend/main.py` 的 CORS 配置：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://your-vercel-app.vercel.app",  # 添加你的 Vercel 域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 本地开发配置

在 `frontend/` 目录下创建 `.env.local`：

```bash
cp frontend/.env.example frontend/.env.local
```

编辑 `frontend/.env.local`：

```
VITE_API_BASE_URL=http://localhost:8000
```

## 验证部署

1. 访问 Vercel 分配的域名（如 `https://your-app.vercel.app`）
2. 打开浏览器开发者工具 → Network
3. 检查 API 请求是否正确指向后端地址
4. 测试完整流程：注册 → JD 分析 → 复习计划 → 模拟面试

## 常见问题

### Q: 前端部署成功，但 API 请求失败？

A: 检查以下项：
1. Vercel 环境变量 `VITE_API_BASE_URL` 是否配置正确
2. 后端 CORS 是否包含 Vercel 域名
3. 后端服务是否正常运行（访问 `https://your-backend.railway.app/health`）

### Q: 为什么不能把后端也部署到 Vercel？

A: Vercel Serverless Functions 的限制：
- 无持久化文件系统（SQLite 数据库会丢失）
- 执行时间限制（Hobby 10 秒，Pro 60 秒）
- ChromaDB 向量库无法持久化

### Q: 有没有完全免费的部署方案？

A: 有！
- 前端：Vercel（免费，无限流量）
- 后端：Railway（免费 500 小时/月）或 Render（免费，启动慢）

## 项目架构

```
[用户浏览器]
    ↓
[Vercel CDN] ← 前端静态资源
    ↓
[Railway/Render] ← 后端 API + SQLite + ChromaDB
    ↓
[阿里云百炼 API] ← LLM 服务
```
