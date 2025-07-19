@echo off
echo ========================================
echo GlucoBeat Web Runner (Windows)
echo ========================================

cd /d "%~dp0..\.."

echo Starting Backend Services...
echo [1/4] Starting backend-orchestrator...
start "Backend Orchestrator" cmd /k "call scripts\backend_mcp\Scripts\activate && cd backend-orchestrator && python main.py"

echo [2/4] Starting mcp-db-server...
start "MCP DB Server" cmd /k "call scripts\backend_mcp\Scripts\activate && cd mcp-db-server && python main.py"

powershell -Command "Start-Sleep -Seconds 5" >nul

echo [3/4] Starting frontend development server...
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev"

echo [4/4] Opening browser...
echo Waiting 10 seconds for all services to start properly...
powershell -Command "Start-Sleep -Seconds 10" >nul
echo Opening browser now...
start http://localhost:3000

echo ========================================
echo Web development environment started!
echo ========================================
echo Frontend: http://localhost:3000 (auto-opened)
echo Backend API: Check backend logs for port
echo ========================================
echo Browser will open automatically in 10 seconds
echo If not, manually open: http://localhost:3000
echo ========================================
echo Press any key to stop all services...
pause >nul

echo Stopping all services...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo Services stopped.
pause 