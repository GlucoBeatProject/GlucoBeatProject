@echo off
echo ========================================
echo GlucoBeat Simulation Runner (Windows)
echo ========================================

cd /d "%~dp0.."

echo Starting Backend Services...
echo [1/5] Starting backend-orchestrator...
start "Backend Orchestrator" cmd /k "call backend_mcp\Scripts\activate && cd backend-orchestrator && python main.py"

echo [2/5] Starting mcp-db-server...
start "MCP DB Server" cmd /k "call backend_mcp\Scripts\activate && cd mcp-db-server && python main.py"

timeout /t 3 /nobreak >nul

echo [3/5] Starting algo-oref0 Node.js server...
start "Algo-Oref0 Server" cmd /k "cd algo-oref0\oref0 && node server.js"

timeout /t 3 /nobreak >nul

echo [4/5] Starting ml-g2p2c...
start "ML-G2P2C" cmd /k "call simglucose_g2p2c\Scripts\activate && cd ml-g2p2c && python main.py"

echo [5/5] Starting simglucose simulation...
start "SimGlucose" cmd /k "call simglucose_g2p2c\Scripts\activate && cd simglucose && python run_simulation_programmatic.py"

echo ========================================
echo All simulation components started!
echo ========================================
echo Press any key to stop all services...
pause >nul

echo Stopping all services...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo Services stopped.
pause 