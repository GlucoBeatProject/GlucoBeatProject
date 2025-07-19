@echo off
echo ========================================
echo GlucoBeat Web Runner (Windows)
echo ========================================

cd /d "%~dp0.."

echo Starting Backend Services...
echo [1/3] Starting backend-orchestrator...
start "Backend Orchestrator" cmd /k "call backend_mcp\Scripts\activate && cd backend-orchestrator && python main.py"

echo [2/3] Starting mcp-db-server...
start "MCP DB Server" cmd /k "call backend_mcp\Scripts\activate && cd mcp-db-server && python main.py"

timeout /t 5 /nobreak >nul

echo [3/3] Starting frontend development server...
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev"

echo ========================================
echo Web development environment started!
echo ========================================
echo Frontend: http://localhost:3000
echo Backend API: Check backend logs for port
echo ========================================
echo Press any key to stop all services...
pause >nul

echo Stopping all services...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo Services stopped.
pause 