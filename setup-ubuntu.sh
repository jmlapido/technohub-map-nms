#!/bin/bash

echo "========================================"
echo "Network Link Map Monitor - Ubuntu Setup"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please run as regular user (not root)"
   echo "The script will ask for sudo when needed"
   exit 1
fi

echo "[1/5] Updating package list..."
sudo apt update

echo ""
echo "[2/5] Installing Node.js and npm..."
if ! command -v node &> /dev/null; then
    # Install Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

echo ""
echo "[3/5] Installing project dependencies..."
npm install

echo ""
echo "[4/5] Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "[5/5] Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""
echo "To start the application, run:"
echo "  ./start.sh"
echo ""
echo "Or manually:"
echo "  npm run dev"
echo ""

