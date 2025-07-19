@echo off
echo ========================================
echo GlucoBeat Python Setup (Windows)
echo ========================================

cd /d "%~dp0..\.."
echo Project root: %CD%

echo.
echo [1/3] Backend MCP Virtual Environment (Python 3.12)...
if not exist "scripts\backend_mcp\Scripts\python.exe" (
    echo Creating Python 3.12 virtual environment...
    py -3.12 -m venv scripts\backend_mcp
    if errorlevel 1 (
        echo ✗ Failed to create Python 3.12 virtual environment
        echo Please install Python 3.12 first
        pause
        exit /b 1
    )
)

if exist "scripts\backend_mcp\Scripts\python.exe" (
    echo Installing backend packages...
    scripts\backend_mcp\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
    scripts\backend_mcp\Scripts\python.exe -m pip install -r scripts\backend_mcp_requirement.txt
    echo ✓ Backend MCP setup complete
) else (
    echo ✗ Backend MCP virtual environment not found
)

echo.
echo [2/3] SimGlucose Virtual Environment (Python 3.10)...
if not exist "scripts\simglucose_g2p2c\Scripts\python.exe" (
    echo Creating Python 3.10 virtual environment...
    py -3.10 -m venv scripts\simglucose_g2p2c
    if errorlevel 1 (
        echo ✗ Failed to create Python 3.10 virtual environment
        echo Please install Python 3.10 first
        pause
        exit /b 1
    )
)

if exist "scripts\simglucose_g2p2c\Scripts\python.exe" (
    echo Installing simglucose_g2p2c packages...
    scripts\simglucose_g2p2c\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
    scripts\simglucose_g2p2c\Scripts\python.exe -m pip install -r scripts\simglucose_g2p2c_requirements.txt
    
) else (
    echo ✗ SimGlucose virtual environment not found
)

echo.
echo [3/3] Verification...
echo Checking Python environments:
if exist "scripts\backend_mcp\Scripts\python.exe" (
    echo ✓ Backend MCP:
    scripts\backend_mcp\Scripts\python.exe --version
    scripts\backend_mcp\Scripts\python.exe -c "import fastapi; print('  FastAPI:', fastapi.__version__)"
) else (
    echo ✗ Backend MCP not ready
)

if exist "scripts\simglucose_g2p2c\Scripts\python.exe" (
    echo ✓ SimGlucose:
    scripts\simglucose_g2p2c\Scripts\python.exe --version
    scripts\simglucose_g2p2c\Scripts\python.exe -c "import numpy; print('  NumPy:', numpy.__version__)"
) else (
    echo ✗ SimGlucose not ready
)

echo.
echo ========================================
echo Python Setup Complete!
echo ========================================
echo.