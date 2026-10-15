# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作提供指引。

## 项目简介

AI 驱动的技术面试备考助手（毕业设计演示原型）。用户粘贴 JD，获取个性化复习清单，与模拟面试官进行多轮面试，收到结构化评估报告，并可在后续面试中针对历史薄弱点进行专项训练。

## 快速启动

```bash
# 一键启动（首次运行会自动初始化 RAG 知识库）
./start.sh

# 手动启动
cp .env.example .env   # 填入 DASHSCOPE_API_KEY
.venv/bin/uvicorn backend.main:app --reload --port 8000
.venv/bin/python -m backend.rag.init_kb   # 仅首次执行
cd frontend && npm run dev
```

- 后端 API 文档：http://localhost:8000/docs
- 前端：http://localhost:5173

## 常用命令

```bash
# 后端
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 前端
cd frontend && npm run dev      # 开发服务器
cd frontend && npm run build    # 生产构建（tsc + vite）
cd frontend && npm run lint     # oxlint

# RAG 知识库（backend/rag/data/ 下文档有改动时重新执行）
.venv/bin/python -m backend.rag.init_kb

# 临时测试 / 演示
.venv/bin/python tests/base_demo.py
.venv/bin/python tests/langgraph_demo.py
```

## 架构说明

### 后端（`backend/`）

**入口**：`main.py` — 注册所有路由，并在启动时调用 `init_db()`。

**配置**：`config.py` 通过 pydantic-settings 读取 `.env`。关键变量：`DASHSCOPE_API_KEY`、`LLM_MODEL`（默认 `qwen3.8-max`）、`LLM_BASE_URL`（阿里云百炼）。JWT 和沙箱限制也在此处配置。

**数据库**：`database.py` — 基于 async SQLAlchemy + SQLite（`jobprep.db`）。所有模型继承 `Base`，启动时自动建表。Session 依赖为 `get_db()`。

**路由**（`routers/`）：每个文件对应一个业务域（`auth`、`jd`、`study`、`interview`、`report`、`resume`、`rag`）。面试/学习相关接口大多返回 `StreamingResponse`（`text/event-stream` SSE），前端以 Server-Sent Events 方式消费。

**Agents**（`agents/`）：
- `state.py` — 共享的 `AgentState` TypedDict 和 `get_llm()` 工厂函数（通过 OpenAI 兼容接口连接阿里云百炼）。
- `jd_parser.py` — 流式输出 JD 分析；完成后调用 `extract_jd_summary()` 存储结构化 JSON。
- `study_planner.py` — 两种模式：全新模式（无历史记录）和薄弱点优先模式（有历史报告）。结果缓存在 `JDSession.study_plan_cache`。
- `interviewer.py` — 每次请求无状态，完整对话历史随请求传入。检测输出中的 `[CODE_QUESTION]` 标记以触发前端展示 Monaco 编辑器。
- `evaluator.py` — 面试结束时调用，生成含薄弱点汇总的结构化报告。
- `resume_optimizer.py` — 对比简历与 JD，流式输出优化建议。

**工具**（`tools/`）：
- `rag_tool.py` — 对 `backend/rag/data/` 下的 Markdown 文档进行 ChromaDB 语义检索。
- `code_sandbox.py` — 在子进程中运行用户提交的 Python 代码，限制 10 秒超时和 128MB 内存。**仅供演示，不可用于生产环境。**
- `report_reader.py` — 从已存储的 `InterviewReport.report_json` 中提取薄弱点，用于薄弱点模式。

**RAG**（`rag/`）：`init_kb.py` 将 `rag/data/` 下的 Markdown 文件分块、向量化后存入 `chroma_db/`。知识文档有变动时需重新执行。

### 前端（`frontend/src/`）

React 19 + React Router v7 + Tailwind CSS v4。页面：`Home`、`Login`、`JDAnalysis`、`StudyPlan`、`Interview`、`Report`、`UserCenter`。关键组件：`ChatWindow`（SSE 流式展示）、`MarkdownRenderer`（react-markdown + remark-gfm）、Monaco Editor（代码提交）。

`api/` 包含 Axios 封装和 SSE 工具函数。认证状态维护在 `hooks/useAuth`。

### 数据流：核心面试闭环

1. 用户提交 JD → `POST /api/jd/analyze` 流式输出分析结果，并存储含 `jd_analysis` 和 `summary_json` 的 `JDSession`。
2. `GET /api/study/plan/{jd_id}` 流式返回复习清单（有缓存则直接读取，否则重新生成）。
3. `POST /api/interview/start` 创建 `InterviewSession`，流式输出开场问题。
4. `POST /api/interview/answer` 流式返回面试官回复；如有代码提交则运行沙箱并将结果注入上下文。
5. `POST /api/interview/end` 流式输出评估报告，保存 `InterviewReport`，并触发后台任务以薄弱点模式重新生成复习清单缓存。
6. 第二轮面试：复习清单和面试官均读取已保存的报告，优先考察薄弱点。

## 关键配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | *（必填）* | 阿里云百炼 API Key |
| `LLM_MODEL` | `qwen3.8-max` | 阿里云百炼上的模型名称 |
| `SECRET_KEY` | `jobprep-secret-change-in-prod` | JWT 签名密钥 — 实际部署时务必修改 |
| `DATABASE_URL` | `sqlite+aiosqlite:///./jobprep.db` | |
| `CHROMA_PERSIST_DIR` | `./chroma_db` | |
