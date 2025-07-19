@echo off
echo ========================================
echo GlucoBeat Environment Setup (Windows)
echo ========================================

cd /d "%~dp0..\.."

echo [1/6] Setting up backend_mcp virtual environment...
if exist "scripts\backend_mcp\Scripts\python.exe" (
    echo Using existing backend_mcp virtual environment...
    call scripts\backend_mcp\Scripts\activate
    echo Installing backend_mcp_requirement.txt...
    pip install -r scripts\backend_mcp_requirement.txt
    call scripts\backend_mcp\Scripts\deactivate
) else (
    echo Error: backend_mcp virtual environment not found in scripts\backend_mcp\
    echo Please create the virtual environment first.
    pause
    exit /b 1
)

echo [2/6] Setting up simglucose_g2p2c virtual environment...
if exist "scripts\simglucose_g2p2c\Scripts\python.exe" (
    echo Using existing simglucose_g2p2c virtual environment...
    call scripts\simglucose_g2p2c\Scripts\activate
    echo Installing simglucose_g2p2c_requirements.txt...
    pip install -r scripts\simglucose_g2p2c_requirements.txt
    call scripts\simglucose_g2p2c\Scripts\deactivate
) else (
    echo Error: simglucose_g2p2c virtual environment not found in scripts\simglucose_g2p2c\
    echo Please create the virtual environment first.
    pause
    exit /b 1
)

echo [3/6] Setting up frontend dependencies...
cd frontend
if exist "package.json" (
    echo Installing frontend dependencies...
    npm install
) else (
    echo Warning: package.json not found in frontend, skipping npm install
)
cd ..

echo [4/6] Setting up algo-oref0 dependencies...
cd algo-oref0\oref0
if exist "package.json" (
    echo Installing algo-oref0 dependencies...
    npm install
) else (
    echo Warning: package.json not found in algo-oref0/oref0, skipping npm install
)
cd ..\..

echo [5/6] Setting up ml-g2p2c dependencies...
if exist "ml-g2p2c\G2P2C\requirements.txt" (
    echo Installing ml-g2p2c requirements...
    call scripts\simglucose_g2p2c\Scripts\activate
    pip install -r ml-g2p2c\G2P2C\requirements.txt
    call scripts\simglucose_g2p2c\Scripts\deactivate
) else (
    echo Warning: requirements.txt not found in ml-g2p2c\G2P2C, skipping pip install
)

echo [6/6] Verification...
echo Checking virtual environments:
if exist "scripts\backend_mcp\Scripts\python.exe" (
    echo ✓ backend_mcp virtual environment found
) else (
    echo ✗ backend_mcp virtual environment not found
)
if exist "scripts\simglucose_g2p2c\Scripts\python.exe" (
    echo ✓ simglucose_g2p2c virtual environment found
) else (
    echo ✗ simglucose_g2p2c virtual environment not found
)

echo ========================================
echo Environment setup completed!
echo ========================================
echo Virtual environments used:
echo - scripts\backend_mcp (for backend services)
echo - scripts\simglucose_g2p2c (for ML and simulation)
echo Node.js dependencies installed for frontend and algorithm modules
echo ========================================
pause 