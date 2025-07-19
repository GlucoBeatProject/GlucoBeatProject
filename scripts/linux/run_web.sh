#!/bin/bash

echo "========================================"
echo "GlucoBeat Web Runner (Linux)"
echo "========================================"

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

# PID 파일들을 저장할 임시 디렉토리
PIDDIR="/tmp/glucobeat_web_pids"
mkdir -p "$PIDDIR"

# cleanup 함수
cleanup() {
    echo "Stopping all services..."
    for pidfile in "$PIDDIR"/*.pid; do
        if [ -f "$pidfile" ]; then
            PID=$(cat "$pidfile")
            if kill -0 "$PID" 2>/dev/null; then
                kill "$PID"
            fi
            rm -f "$pidfile"
        fi
    done
    echo "All services stopped."
    exit 0
}

# Ctrl+C 트랩
trap cleanup SIGINT SIGTERM

echo "Starting Backend Services..."
echo "[1/3] Starting backend-orchestrator..."
cd backend-orchestrator
source ../backend_mcp/bin/activate
python main.py &
echo $! > "$PIDDIR/backend_orchestrator.pid"
cd ..

echo "[2/3] Starting mcp-db-server..."
cd mcp-db-server
source ../backend_mcp/bin/activate
python main.py &
echo $! > "$PIDDIR/mcp_db_server.pid"
cd ..

sleep 5

echo "[3/3] Starting frontend development server..."
cd frontend
npm run dev &
echo $! > "$PIDDIR/frontend.pid"
cd ..

echo "========================================"
echo "Web development environment started!"
echo "========================================"
echo "Frontend: http://localhost:3000"
echo "Backend API: Check backend logs for port"
echo "========================================"
echo "Press Ctrl+C to stop all services..."

# 무한 대기
while true; do
    sleep 1
done 