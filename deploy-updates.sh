#!/bin/bash

echo "========================================"
echo "🚀 Deploying Updates"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get current directory
cd "$(dirname "$0")"

echo -e "${YELLOW}Step 1: Pulling latest changes...${NC}"
git pull
echo ""

echo -e "${YELLOW}Step 2: Installing backend dependencies...${NC}"
cd backend
npm install
cd ..
echo ""

echo -e "${YELLOW}Step 3: Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..
echo ""

echo -e "${YELLOW}Step 4: Rebuilding frontend...${NC}"
cd frontend
npm run build
cd ..
echo ""

echo -e "${YELLOW}Step 5: Restarting services...${NC}"
pm2 restart all
echo ""

echo -e "${YELLOW}Step 6: Checking status...${NC}"
pm2 status
echo ""

echo "========================================"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "Your application is now accessible at:"
echo "  • Domain: https://map.jmlapido.com"
echo "  • Local IP: http://$(hostname -I | awk '{print $1}'):4000"
echo "  • Localhost: http://localhost:4000"
echo ""
echo "Backend API:"
echo "  • Domain: https://map.jmlapido.com/api"
echo "  • Local IP: http://$(hostname -I | awk '{print $1}'):5000/api"
echo "  • Localhost: http://localhost:5000/api"
echo ""
echo "To view logs:"
echo "  pm2 logs"
echo ""

