# 面试助手

> AI 驱动的技术面试备考助手 —— 毕业设计演示原型

## 功能简介

- **JD 智能解析**：粘贴 JD，自动提取技术要求、评估匹配度
- **个性化复习清单**：基于 JD + 历史面试薄弱点，生成针对性复习计划
- **多轮模拟面试**：面试官连环追问 + 代码沙箱在线判题
- **面试评估报告**：结构化评分，薄弱点汇总，持久保存
- **薄弱点追踪**：二次面试自动读取历史报告，优先考察上次暴露的薄弱知识点
- **简历优化**（免费辅助）：对照 JD 优化简历描述

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python + FastAPI + SQLAlchemy（SQLite） |
| Agent 编排 | LangGraph + LangChain |
| RAG 知识库 | ChromaDB |
| LLM | Qwen（阿里云百炼 API） |
| 代码沙箱 | Python subprocess + resource 限制 |
| 前端 | Vite + React + TypeScript + Tailwind CSS |
| 代码编辑器 | Monaco Editor |

## 快速启动

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入你的 DASHSCOPE_API_KEY
```

### 2. 一键启动（首次会自动初始化 RAG 知识库）

```bash
./start.sh
```

访问：
- 前端：http://localhost:5173
- 后端 API 文档：http://localhost:8000/docs

### 手动启动（可选）

```bash
# 后端
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 初始化 RAG 知识库（首次执行一次）
.venv/bin/python -m backend.rag.init_kb

# 前端
cd frontend && npm run dev
```

## 项目结构

```
.
├── backend/
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置（读取 .env）
│   ├── database.py             # SQLite + SQLAlchemy
│   ├── models/                 # ORM 模型（User/JD/Interview/Report）
│   ├── schemas/                # Pydantic 请求/响应
│   ├── routers/                # API 路由（auth/jd/study/interview/report/resume）
│   ├── agents/                 # LangGraph Agents
│   │   ├── jd_parser.py        # JD 解析 Agent
│   │   ├── study_planner.py    # 复习规划 Agent（支持薄弱点模式）
│   │   ├── interviewer.py      # 技术面试官 Agent
│   │   ├── evaluator.py        # 面试评估 Agent
│   │   └── resume_optimizer.py # 简历优化 Agent
│   ├── tools/
│   │   ├── code_sandbox.py     # 代码沙箱（subprocess）
│   │   ├── rag_tool.py         # ChromaDB 检索
│   │   └── report_reader.py    # 历史报告解析
│   └── rag/
│       ├── init_kb.py          # 知识库初始化脚本
│       └── data/               # 面试知识文档（5篇 Markdown）
├── frontend/                   # Vite + React + TS
│   └── src/
│       ├── pages/              # Home/Login/JDAnalysis/StudyPlan/Interview/Report/UserCenter
│       ├── components/         # Header/ChatWindow/MarkdownRenderer
│       ├── api/                # Axios + SSE 封装
│       └── hooks/              # useAuth
├── .env.example
├── start.sh
└── docs/prd.md
```

## 答辩演示脚本

1. 首页 → 游客体验 → 粘贴后端岗位 JD → 解析岗位技术栈 + 匹配度
2. 生成第一轮复习清单 → 开始模拟面试 → 提交代码题 → 沙箱运行 → 面试官追问
3. 结束面试 → 生成并保存评估报告（含薄弱点汇总）
4. **回到复习清单页** → 系统读取历史报告 → 生成「✅ 已掌握 / ⚠️ 薄弱点」板块
5. **再次开始面试** → 面试官优先针对历史薄弱点出题（对比第一轮效果）

## 注意事项

- 代码沙箱仅限 Demo 使用，已限制执行时长（10s）和内存（128MB），请勿在生产环境使用
- 所有功能免费开放，无付费逻辑
