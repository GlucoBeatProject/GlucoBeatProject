#!/bin/bash

echo "========================================"
echo "GlucoBeat Web Runner (macOS)"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "Starting Backend Services..."
echo "[1/3] Starting backend-orchestrator..."
osascript -e 'tell app "Terminal" to do script "source scripts/backend_mcp/bin/activate && cd backend-orchestrator && python main.py"'

echo "[2/3] Starting mcp-db-server..."
osascript -e 'tell app "Terminal" to do script "source scripts/backend_mcp/bin/activate && cd mcp-db-server && python main.py"'

sleep 5

echo "[3/3] Starting frontend development server..."
osascript -e 'tell app "Terminal" to do script "cd frontend && npm run dev"'

echo "========================================"
echo "Web development environment started!"
echo "========================================"
echo "Frontend: http://localhost:3000"
echo "Backend API: Check backend logs for port"
echo "========================================"
echo "Check the opened Terminal windows for service status."
echo "To stop services, close the Terminal windows or use Ctrl+C in each terminal."
echo "========================================" 