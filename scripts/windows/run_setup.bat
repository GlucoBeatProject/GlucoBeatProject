@echo off
echo ========================================
echo GlucoBeat Fresh Setup (Windows)
echo ========================================
echo This will create new virtual environments
echo ========================================

cd /d "%~dp0..\.."
echo Project root: %CD%

echo.
echo [1/4] Cleaning old virtual environments...
if exist "scripts\backend_mcp" (
    echo Removing old backend_mcp virtual environment...
    rmdir /s /q scripts\backend_mcp
)
if exist "scripts\simglucose_g2p2c" (
    echo Removing old simglucose_g2p2c virtual environment...
    rmdir /s /q scripts\simglucose_g2p2c
)
echo ✓ Old environments removed

echo.
echo [2/4] Creating backend_mcp virtual environment (Python 3.12)...
py -3.12 -m venv scripts\backend_mcp
if errorlevel 1 (
    echo ✗ Failed to create Python 3.12 virtual environment
    echo Please install Python 3.12:
    echo   - Microsoft Store: Search "Python 3.12"
    echo   - Or download from: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✓ Backend MCP virtual environment created

echo.
echo [3/4] Creating simglucose_g2p2c virtual environment (Python 3.10)...
py -3.10 -m venv scripts\simglucose_g2p2c
if errorlevel 1 (
    echo ✗ Failed to create Python 3.10 virtual environment
    echo Please install Python 3.10:
    echo   - Microsoft Store: Search "Python 3.10"
    echo   - Or download from: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✓ SimGlucose_g2p2c virtual environment created

echo.
echo [4/4] Installing Python packages...
echo Installing backend_mcp packages...
scripts\backend_mcp\Scripts\python.exe -m pip install --upgrade pip
scripts\backend_mcp\Scripts\python.exe -m pip install -r scripts\backend_mcp_requirement.txt

echo Installing simglucose_g2p2c packages...
scripts\simglucose_g2p2c\Scripts\python.exe -m pip install --upgrade pip
scripts\simglucose_g2p2c\Scripts\python.exe -m pip install -r scripts\simglucose_g2p2c_requirements.txt

echo.
echo ========================================
echo Fresh Setup Complete!
echo ========================================
echo New virtual environments created
echo Python packages installed
echo Ready for this computer
echo.
