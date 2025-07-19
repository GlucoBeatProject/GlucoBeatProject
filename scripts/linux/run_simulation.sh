#!/bin/bash

echo "========================================"
echo "GlucoBeat Simulation Runner (Linux)"
echo "========================================"

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

# PID 파일들을 저장할 임시 디렉토리
PIDDIR="/tmp/glucobeat_pids"
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
echo "[1/5] Starting backend-orchestrator..."
cd backend-orchestrator
source ../backend_mcp/Scripts/activate
python main.py &
echo $! > "$PIDDIR/backend_orchestrator.pid"
cd ..

echo "[2/5] Starting mcp-db-server..."
cd mcp-db-server
source ../backend_mcp/Scripts/activate
python main.py &
echo $! > "$PIDDIR/mcp_db_server.pid"
cd ..

sleep 3

echo "[3/5] Starting algo-oref0 Node.js server..."
cd algo-oref0/oref0
node server.js &
echo $! > "$PIDDIR/algo_oref0.pid"
cd ../..

sleep 3

echo "[4/5] Starting ml-g2p2c..."
cd ml-g2p2c
source ../simglucose_g2p2c/Scripts/activate
python main.py &
echo $! > "$PIDDIR/ml_g2p2c.pid"
cd ..

echo "[5/5] Starting simglucose simulation..."
cd simglucose
source ../simglucose_g2p2c/Scripts/activate
python run_simulation_programmatic.py &
echo $! > "$PIDDIR/simglucose.pid"
cd ..

echo "========================================"
echo "All simulation components started!"
echo "========================================"
echo "Press Ctrl+C to stop all services..."

# 무한 대기
while true; do
    sleep 1
done 