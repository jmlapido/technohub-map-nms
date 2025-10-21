#!/bin/bash

# Install Docker Compose V2 (Modern Version)
# This fixes the distutils error with Python 3.12

echo "========================================="
echo "Installing Docker Compose V2"
echo "========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed!"
    echo "Please install Docker first:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    exit 1
fi

echo "Step 1: Removing old docker-compose (v1)..."
sudo apt-get remove -y docker-compose 2>/dev/null || true
sudo rm -f /usr/local/bin/docker-compose
sudo rm -f /usr/bin/docker-compose

echo ""
echo "Step 2: Installing Docker Compose V2 as a plugin..."
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

echo ""
echo "Step 3: Verifying installation..."
docker compose version

echo ""
echo "========================================="
echo "✓ Docker Compose V2 installed successfully!"
echo "========================================="
echo ""
echo "Usage:"
echo "  docker compose up -d    (note: no hyphen)"
echo "  docker compose down"
echo "  docker compose logs -f"
echo ""
echo "The command is now 'docker compose' (two words) instead of 'docker-compose' (one word)"
echo ""

