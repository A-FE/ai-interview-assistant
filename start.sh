#!/bin/bash

# AI Interview Assistant - Setup and Start Script
# This script automates the setup and launch process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    echo -e "${GREEN}[Setup]${NC} $1"
}

print_error() {
    echo -e "${RED}[Error]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[Warning]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_message "Checking prerequisites..."

if ! command_exists python3; then
    print_error "Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
print_message "Found Python $PYTHON_VERSION"

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node --version)
print_message "Found Node.js $NODE_VERSION"

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_message "Created .env from .env.example"
        print_warning "Please edit .env and add your DASHSCOPE_API_KEY before continuing."
        echo ""
        echo "Press Enter after you've configured .env..."
        read -r
    else
        print_error ".env.example not found. Please create a .env file manually."
        exit 1
    fi
fi

# Check if DASHSCOPE_API_KEY is set
if ! grep -q "DASHSCOPE_API_KEY=sk-" .env 2>/dev/null; then
    print_warning "DASHSCOPE_API_KEY does not appear to be set in .env"
    print_warning "Please make sure to configure it before using the application."
fi

# Setup backend
print_message "Setting up backend..."

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    print_message "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
print_message "Activating virtual environment..."
source .venv/bin/activate

# Install/upgrade pip
print_message "Upgrading pip..."
pip install --upgrade pip --quiet

# Install Python dependencies
print_message "Installing Python dependencies..."
pip install -r requirements.txt --quiet

# Initialize RAG knowledge base if needed
if [ ! -d "chroma_db" ]; then
    print_message "Initializing RAG knowledge base (this may take a few minutes)..."
    python -m backend.rag.init_kb
else
    print_message "RAG knowledge base already initialized. Skipping..."
fi

# Setup frontend
print_message "Setting up frontend..."

cd frontend

if [ ! -d "node_modules" ]; then
    print_message "Installing Node.js dependencies..."
    npm install
else
    print_message "Node.js dependencies already installed. Skipping..."
fi

cd ..

# Create necessary directories
mkdir -p uploads
mkdir -p logs

print_message "Setup complete! 🎉"
echo ""
print_message "Starting services..."
echo ""

# Start backend in background
print_message "Starting backend server on http://localhost:8000"
.venv/bin/uvicorn backend.main:app --reload --port 8000 > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
print_message "Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! ps -p $BACKEND_PID > /dev/null; then
    print_error "Backend failed to start. Check logs/backend.log for details."
    exit 1
fi

# Start frontend
print_message "Starting frontend server on http://localhost:5173"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 2

# Check if frontend is running
if ! ps -p $FRONTEND_PID > /dev/null; then
    print_error "Frontend failed to start. Check logs/frontend.log for details."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Backend PID:  $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "  Logs:"
echo "    - Backend:  logs/backend.log"
echo "    - Frontend: logs/frontend.log"
echo ""
echo "  To stop all services, run:"
echo "    kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Save PIDs to file for easy cleanup
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

# Wait for user interrupt
trap "print_message 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .backend.pid .frontend.pid; exit 0" INT TERM

# Keep script running
wait
