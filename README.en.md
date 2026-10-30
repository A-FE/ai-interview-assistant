<div align="center">

# 🎯 AI Interview Assistant

**AI-Powered Technical Interview Preparation Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.143+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)

English | [简体中文](./README.md)

[Live Demo](#) • [Quick Start](#-quick-start) • [Deployment Guide](./DEPLOY.md) • [Contributing](./CONTRIBUTING.md)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 Smart JD Analysis
- Auto-extract tech stack & requirements
- AI-powered job matching assessment
- Identify skill gaps and learning priorities

</td>
<td width="50%">

### 📚 Personalized Study Plan
- Generate targeted review checklists based on JD
- RAG knowledge base with authoritative resources
- Prioritized learning path for efficient preparation

</td>
</tr>
<tr>
<td width="50%">

### 🎤 Realistic Mock Interviews
- Multi-round interviews with follow-up questions
- Online code editor with sandbox execution
- Support for theory, algorithms, and system design

</td>
<td width="50%">

### 📊 Structured Evaluation Reports
- Detailed scoring (theory/code/expression/analysis)
- Weakness summary and improvement suggestions
- Persistent storage for future reference

</td>
</tr>
<tr>
<td width="50%">

### 🔄 Weakness Tracking
- Auto-read historical interview records
- Prioritize weak areas in subsequent interviews
- Avoid repetition, improve training efficiency

</td>
<td width="50%">

### ✍️ Resume Optimizer
- Optimize project descriptions against JD
- Align technical keywords
- Improve resume pass rate

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Alibaba Cloud Bailian API Key ([Get it here](https://bailian.console.aliyun.com/))

### One-Click Setup

```bash
# 1. Clone the repository
git clone https://github.com/A-FE/ai-interview-assistant.git
cd ai-interview-assistant

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add your DASHSCOPE_API_KEY

# 3. Start (auto-install dependencies + init knowledge base)
./start.sh
```

### Access

- 🌐 Frontend: http://localhost:5173
- 📡 Backend API Docs: http://localhost:8000/docs

---

## 🏗️ Tech Stack

| Module | Technology |
|--------|------------|
| **Backend** | FastAPI + SQLAlchemy (Async) |
| **AI Orchestration** | LangGraph + LangChain |
| **LLM** | Qwen (Alibaba Cloud Bailian API) |
| **Vector DB** | ChromaDB |
| **Database** | SQLite (Migratable to PostgreSQL) |
| **Frontend** | React 19 + TypeScript + Vite |
| **UI Framework** | Tailwind CSS v4 |
| **Code Editor** | Monaco Editor |
| **Router** | React Router v7 |

---

## 🌐 Deployment

### Cloud Deployment (Recommended)

Deploy frontend and backend separately:

- **Frontend**: Deploy to [Vercel](https://vercel.com) (Free)
- **Backend**: Deploy to [Railway](https://railway.app) / [Fly.io](https://fly.io) / [Render](https://render.com)

#### Quick Deploy

```bash
# Deploy frontend to Vercel
npm i -g vercel
vercel --prod

# Deploy backend to Railway
npm i -g @railway/cli
railway login
railway up
```

📚 **Detailed Deployment Guides**:
- [Vercel Frontend Deployment](./DEPLOY.md)
- [Railway Backend Deployment](./DEPLOY_RAILWAY.md) (Recommended)
- [Fly.io Deployment](./DEPLOY_FLY.md) (Production-ready)
- [Render Deployment](./DEPLOY_RENDER.md) (Simple)

### Docker Deployment

```bash
# One-click start with Docker Compose
docker-compose up -d

# Access:
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
```

---

## 🤝 Contributing

We welcome all contributions!

- 🐛 [Report Bugs](https://github.com/A-FE/ai-interview-assistant/issues/new)
- 💡 [Request Features](https://github.com/A-FE/ai-interview-assistant/issues/new)
- 📝 Improve Documentation
- 🔀 Submit Pull Requests

Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

---

## 📊 Roadmap

- [x] Core Features
  - [x] Smart JD Analysis
  - [x] Study Plan Generation
  - [x] Mock Interview + Code Sandbox
  - [x] Evaluation Report + Weakness Tracking
  - [x] Resume Optimization
- [x] Deployment Support
  - [x] Vercel Frontend Deployment
  - [x] Railway / Fly.io / Render Backend Deployment
  - [x] Docker / Docker Compose
- [ ] Feature Enhancements
  - [ ] More Programming Languages (JavaScript, Java, Go)
  - [ ] System Design Questions
  - [ ] Behavioral Interview Support
  - [ ] Interview Recording Playback
  - [ ] Multi-user Collaboration
- [ ] Technical Improvements
  - [ ] Unit Tests & Integration Tests
  - [ ] PostgreSQL Support
  - [ ] Improve RAG Retrieval Accuracy
  - [ ] Redis Caching
- [ ] Internationalization
  - [ ] English UI
  - [ ] Multi-language Support

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

## 🙏 Acknowledgments

### Open Source Projects

- [FastAPI](https://fastapi.tiangolo.com/)
- [LangChain](https://www.langchain.com/) / [LangGraph](https://langchain-ai.github.io/langgraph/)
- [ChromaDB](https://www.trychroma.com/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

### AI Services

- [Alibaba Cloud Bailian](https://www.aliyun.com/product/bailian) - Qwen LLM API

---

## 📮 Contact

- Project Homepage: https://github.com/A-FE/ai-interview-assistant
- Issue Tracker: [GitHub Issues](https://github.com/A-FE/ai-interview-assistant/issues)
- Discussions: [GitHub Discussions](https://github.com/A-FE/ai-interview-assistant/discussions)

---

<div align="center">

**If this project helps you, please give it a ⭐️ Star!**

Made with ❤️ by [A-FE](https://github.com/A-FE) and [Contributors](https://github.com/A-FE/ai-interview-assistant/graphs/contributors)

</div>
