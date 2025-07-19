#!/bin/bash

echo "========================================"
echo "GlucoBeat Simulation Runner (macOS)"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "Starting Backend Services..."
echo "[1/5] Starting backend-orchestrator..."
osascript -e 'tell app "Terminal" to do script "source scripts/backend_mcp/bin/activate && cd backend-orchestrator && python main.py"'

echo "[2/5] Starting mcp-db-server..."
osascript -e 'tell app "Terminal" to do script "source scripts/backend_mcp/bin/activate && cd mcp-db-server && python main.py"'

sleep 3

echo "[3/5] Starting algo-oref0 Node.js server..."
osascript -e 'tell app "Terminal" to do script "cd algo-oref0/oref0 && node server.js"'

sleep 3

echo "[4/5] Starting ml-g2p2c..."
osascript -e 'tell app "Terminal" to do script "source scripts/simglucose_g2p2c/bin/activate && cd ml-g2p2c && python main.py"'

echo "[5/5] Starting simglucose simulation..."
osascript -e 'tell app "Terminal" to do script "source scripts/simglucose_g2p2c/bin/activate && cd simglucose && python run_simulation_programmatic.py"'

echo "========================================"
echo "All simulation components started!"
echo "========================================"
echo "Check the opened Terminal windows for service status."
echo "To stop services, close the Terminal windows or use Ctrl+C in each terminal."
echo "========================================" 