#!/bin/bash
echo "========================================"
echo "GlucoBeat Environment Setup (Linux)"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "[1/6] Setting up backend_mcp virtual environment..."
if [ -f "scripts/backend_mcp/bin/python" ]; then
    echo "Using existing backend_mcp virtual environment..."
    source scripts/backend_mcp/bin/activate
    echo "Installing backend_mcp_requirement.txt..."
    pip install -r scripts/backend_mcp_requirement.txt
    deactivate
else
    echo "Error: backend_mcp virtual environment not found in scripts/backend_mcp/"
    echo "Please create the virtual environment first."
    exit 1
fi

echo "[2/6] Setting up simglucose_g2p2c virtual environment..."
if [ -f "scripts/simglucose_g2p2c/bin/python" ]; then
    echo "Using existing simglucose_g2p2c virtual environment..."
    source scripts/simglucose_g2p2c/bin/activate
    echo "Installing simglucose_g2p2c_requirements.txt..."
    pip install -r scripts/simglucose_g2p2c_requirements.txt
    deactivate
else
    echo "Error: simglucose_g2p2c virtual environment not found in scripts/simglucose_g2p2c/"
    echo "Please create the virtual environment first."
    exit 1
fi

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

echo "[5/6] Setting up ml-g2p2c dependencies..."
if [ -f "ml-g2p2c/G2P2C/requirements.txt" ]; then
    echo "Installing ml-g2p2c requirements..."
    source scripts/simglucose_g2p2c/bin/activate
    pip install -r ml-g2p2c/G2P2C/requirements.txt
    deactivate
else
    echo "Warning: requirements.txt not found in ml-g2p2c/G2P2C, skipping pip install"
fi

echo "[6/6] Verification..."
echo "Checking virtual environments:"
if [ -f "scripts/backend_mcp/bin/python" ]; then
    echo "✓ backend_mcp virtual environment found"
else
    echo "✗ backend_mcp virtual environment not found"
fi
if [ -f "scripts/simglucose_g2p2c/bin/python" ]; then
    echo "✓ simglucose_g2p2c virtual environment found"
else
    echo "✗ simglucose_g2p2c virtual environment not found"
fi

echo "========================================"
echo "Environment setup completed!"
echo "========================================"
echo "Virtual environments used:"
echo "- scripts/backend_mcp (for backend services)"
echo "- scripts/simglucose_g2p2c (for ML and simulation)"
echo "Node.js dependencies installed for frontend and algorithm modules"
echo "========================================" 