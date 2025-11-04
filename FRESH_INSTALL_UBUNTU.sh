#!/bin/bash

# Fresh Install Script for Map-Ping on Ubuntu
# This script removes any existing installation and installs from scratch

set -e  # Exit on error

echo "========================================="
echo "Map-Ping Fresh Install for Ubuntu"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git not found. Installing git...${NC}"
    sudo apt update
    sudo apt install -y git
fi

# Get repository URL (default to the known repository)
REPO_URL=${1:-"https://github.com/jmlapido/technohub-map-nms.git"}
PROJECT_DIR="map-ping"

echo -e "${YELLOW}Repository: ${REPO_URL}${NC}"
echo -e "${YELLOW}Target directory: ~/${PROJECT_DIR}${NC}"
echo ""

# Step 1: Remove existing installation
if [ -d ~/$PROJECT_DIR ]; then
    echo -e "${YELLOW}Removing existing installation...${NC}"
    rm -rf ~/$PROJECT_DIR
    echo -e "${GREEN}✓ Removed old installation${NC}"
else
    echo -e "${GREEN}✓ No existing installation found${NC}"
fi

# Step 2: Clone fresh from GitHub
echo ""
echo -e "${YELLOW}Cloning repository from GitHub...${NC}"
cd ~
git clone $REPO_URL $PROJECT_DIR
cd $PROJECT_DIR
echo -e "${GREEN}✓ Repository cloned${NC}"

# Step 3: Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo ""
    echo -e "${YELLOW}Node.js not found. Installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installed${NC}"
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js found: ${NODE_VERSION}${NC}"
fi

# Step 4: Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm run install:all
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 5: Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# Environment Variables
# Set your API URL if deploying with a custom domain
# Leave empty for auto-detection
NEXT_PUBLIC_API_URL=

# Ports (optional - defaults are used)
# BACKEND_PORT=5000
# FRONTEND_PORT=4000
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
fi

# Step 6: Make scripts executable
echo ""
echo -e "${YELLOW}Making scripts executable...${NC}"
chmod +x *.sh 2>/dev/null || true
echo -e "${GREEN}✓ Scripts made executable${NC}"

# Step 7: Display summary
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Navigate to project: cd ~/$PROJECT_DIR"
echo "  2. Start development: npm run dev"
echo "  3. Or use Docker: docker compose up -d"
echo ""
echo "Access the application:"
echo "  - Frontend: http://localhost:4000"
echo "  - Backend API: http://localhost:5000/api"
echo ""

