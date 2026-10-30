#!/bin/bash

# Stop script for AI Interview Assistant
# Stops all running services

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}[Stop]${NC} $1"
}

print_error() {
    echo -e "${RED}[Error]${NC} $1"
}

# Stop backend
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        print_message "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
    fi
    rm -f .backend.pid
fi

# Stop frontend
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        print_message "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
    fi
    rm -f .frontend.pid
fi

# Fallback: kill by port
print_message "Checking for orphaned processes..."

# Kill process on port 8000 (backend)
BACKEND_PORT_PID=$(lsof -ti:8000 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PID" ]; then
    print_message "Killing process on port 8000 (PID: $BACKEND_PORT_PID)..."
    kill $BACKEND_PORT_PID 2>/dev/null || true
fi

# Kill process on port 5173 (frontend)
FRONTEND_PORT_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PID" ]; then
    print_message "Killing process on port 5173 (PID: $FRONTEND_PORT_PID)..."
    kill $FRONTEND_PORT_PID 2>/dev/null || true
fi

print_message "All services stopped. ✓"
