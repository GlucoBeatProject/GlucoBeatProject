#!/bin/bash

echo "========================================"
echo "GlucoBeat Simulation Runner (Linux)"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "Starting Backend Services..."
echo "[1/5] Starting backend-orchestrator..."
gnome-terminal -- bash -c "source scripts/backend_mcp/bin/activate && cd backend-orchestrator && python main.py; exec bash"

echo "[2/5] Starting mcp-db-server..."
gnome-terminal -- bash -c "source scripts/backend_mcp/bin/activate && cd mcp-db-server && python main.py; exec bash"

sleep 3

echo "[3/5] Starting algo-oref0 Node.js server..."
gnome-terminal -- bash -c "cd algo-oref0/oref0 && node server.js; exec bash"

sleep 3

echo "[4/5] Starting ml-g2p2c..."
gnome-terminal -- bash -c "source scripts/simglucose_g2p2c/bin/activate && cd ml-g2p2c && python main.py; exec bash"

echo "[5/5] Starting simglucose simulation..."
gnome-terminal -- bash -c "source scripts/simglucose_g2p2c/bin/activate && cd simglucose && python run_simulation_programmatic.py; exec bash"

echo "========================================"
echo "All simulation components started!"
echo "========================================"
echo "Check the opened terminal windows for service status."
echo "To stop services, close the terminal windows or use Ctrl+C in each terminal."
echo "========================================" 