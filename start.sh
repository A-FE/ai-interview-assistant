#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv/bin"

echo "=== AI 面试助手启动脚本 ==="

# Check .env
if [ ! -f "$ROOT/.env" ]; then
  echo "⚠️  未找到 .env 文件，请先复制并填写 API Key："
  echo "   cp .env.example .env"
  echo "   然后编辑 .env 填入 DASHSCOPE_API_KEY"
  exit 1
fi

# Check / create virtual environment
if [ ! -f "$VENV/python" ]; then
  echo "🔧 未找到虚拟环境，正在创建 .venv ..."
  python3 -m venv "$ROOT/.venv"
fi

# Install / sync Python dependencies
echo "📦 检查 Python 依赖..."
"$VENV/pip" install -q -r "$ROOT/requirements.txt"

# Install frontend dependencies if needed
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "📦 安装前端依赖..."
  cd "$ROOT/frontend" && npm install
fi

# Init RAG knowledge base if not already done
if [ ! -d "$ROOT/chroma_db" ]; then
  echo "🔄 首次启动，初始化 RAG 知识库..."
  cd "$ROOT"
  "$VENV/python" -m backend.rag.init_kb
fi

# Start backend
echo "🚀 启动后端 (http://localhost:8000) ..."
cd "$ROOT"
"$VENV/uvicorn" backend.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-exclude '.venv' \
  --reload-exclude 'frontend' \
  --reload-exclude 'chroma_db' \
  --reload-exclude '*.db' &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"

# Start frontend
echo "🚀 启动前端 (http://localhost:5173) ..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"

echo ""
echo "✅ 服务已启动："
echo "   前端:          http://localhost:5173"
echo "   后端 API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

# Wait and cleanup on exit
trap "echo '正在停止...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
