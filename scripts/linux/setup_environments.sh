#!/bin/bash

echo "========================================"
echo "GlucoBeat Environment Setup (Linux)"
echo "========================================"

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

echo "[1/6] Creating and setting up backend_mcp virtual environment..."
if [ ! -d "backend_mcp" ]; then
    echo "Creating backend_mcp virtual environment..."
    python3 -m venv backend_mcp
fi
echo "Activating backend_mcp and installing dependencies..."
source backend_mcp/bin/activate
echo "Installing backend_mcp_requirement.txt..."
pip install -r backend_mcp_requirement.txt
echo "Installing main requirement.txt..."
pip install -r requirement.txt
deactivate

echo "[2/6] Creating and setting up simglucose_g2p2c virtual environment..."
if [ ! -d "simglucose_g2p2c" ]; then
    echo "Creating simglucose_g2p2c virtual environment..."
    python3 -m venv simglucose_g2p2c
fi
echo "Activating simglucose_g2p2c and installing dependencies..."
source simglucose_g2p2c/bin/activate
echo "Installing simglucose_g2p2c_requirements.txt..."
pip install -r simglucose_g2p2c_requirements.txt
deactivate

echo "[3/6] Setting up frontend dependencies..."
cd frontend
if [ -f "package.json" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "Warning: package.json not found in frontend, skipping npm install"
fi
cd ..

echo "[4/6] Setting up algo-oref0 dependencies..."
cd algo-oref0/oref0
if [ -f "package.json" ]; then
    echo "Installing algo-oref0 dependencies..."
    npm install
else
    echo "Warning: package.json not found in algo-oref0/oref0, skipping npm install"
fi
cd ../..

echo "[5/6] Setting up oref0-official dependencies..."
cd oref0-official
if [ -f "package.json" ]; then
    echo "Installing oref0-official dependencies..."
    npm install
else
    echo "Warning: package.json not found in oref0-official, skipping npm install"
fi
cd ..

echo "[6/6] Verification..."
echo "Checking virtual environments:"
if [ -f "backend_mcp/bin/python" ]; then
    echo "✓ backend_mcp virtual environment created"
else
    echo "✗ backend_mcp virtual environment failed"
fi
if [ -f "simglucose_g2p2c/bin/python" ]; then
    echo "✓ simglucose_g2p2c virtual environment created"
else
    echo "✗ simglucose_g2p2c virtual environment failed"
fi

echo "========================================"
echo "Environment setup completed!"
echo "========================================"
echo "Virtual environments created:"
echo "- backend_mcp (for backend services)"
echo "- simglucose_g2p2c (for ML and simulation)"
echo "Node.js dependencies installed for frontend and algorithm modules"
echo "========================================" 