@echo off
echo ========================================
echo GlucoBeat Environment Setup (Windows)
echo ========================================

cd /d "%~dp0.."

echo [1/6] Creating and setting up backend_mcp virtual environment...
if not exist "backend_mcp" (
    echo Creating backend_mcp virtual environment...
    python -m venv backend_mcp
)
echo Activating backend_mcp and installing dependencies...
call backend_mcp\Scripts\activate
echo Installing backend_mcp_requirement.txt...
pip install -r backend_mcp_requirement.txt
echo Installing main requirement.txt...
pip install -r requirement.txt
call backend_mcp\Scripts\deactivate

echo [2/6] Creating and setting up simglucose_g2p2c virtual environment...
if not exist "simglucose_g2p2c" (
    echo Creating simglucose_g2p2c virtual environment...
    python -m venv simglucose_g2p2c
)
echo Activating simglucose_g2p2c and installing dependencies...
call simglucose_g2p2c\Scripts\activate
echo Installing simglucose_g2p2c_requirements.txt...
pip install -r simglucose_g2p2c_requirements.txt
call simglucose_g2p2c\Scripts\deactivate

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
cd ..\.

echo [5/6] Setting up oref0-official dependencies...
cd oref0-official
if exist "package.json" (
    echo Installing oref0-official dependencies...
    npm install
) else (
    echo Warning: package.json not found in oref0-official, skipping npm install
)
cd ..

echo [6/6] Verification...
echo Checking virtual environments:
if exist "backend_mcp\Scripts\python.exe" (
    echo ✓ backend_mcp virtual environment created
) else (
    echo ✗ backend_mcp virtual environment failed
)
if exist "simglucose_g2p2c\Scripts\python.exe" (
    echo ✓ simglucose_g2p2c virtual environment created
) else (
    echo ✗ simglucose_g2p2c virtual environment failed
)

echo ========================================
echo Environment setup completed!
echo ========================================
echo Virtual environments created:
echo - backend_mcp (for backend services)
echo - simglucose_g2p2c (for ML and simulation)
echo Node.js dependencies installed for frontend and algorithm modules
echo ========================================
pause 