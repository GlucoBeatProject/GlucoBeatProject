#!/bin/bash

echo "========================================"
echo "GlucoBeat Web Runner (Linux)"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "Starting Backend Services..."
echo "[1/3] Starting backend-orchestrator..."
gnome-terminal -- bash -c "source scripts/backend_mcp/bin/activate && cd backend-orchestrator && python main.py; exec bash"

echo "[2/3] Starting mcp-db-server..."
gnome-terminal -- bash -c "source scripts/backend_mcp/bin/activate && cd mcp-db-server && python main.py; exec bash"

sleep 5

echo "[3/3] Starting frontend development server..."
gnome-terminal -- bash -c "cd frontend && npm run dev; exec bash"

echo "========================================"
echo "Web development environment started!"
echo "========================================"
echo "Frontend: http://localhost:3000"
echo "Backend API: Check backend logs for port"
echo "========================================"
echo "Check the opened terminal windows for service status."
echo "To stop services, close the terminal windows or use Ctrl+C in each terminal."
echo "========================================" 