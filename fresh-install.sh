#!/bin/bash

echo "========================================"
echo "🔄 Fresh Install from GitHub"
echo "========================================"
echo ""
echo "This script will:"
echo "  1. Stop and remove all PM2 processes"
echo "  2. Remove the old installation directory"
echo "  3. Clone fresh from GitHub"
echo "  4. Run the installation script"
echo "  5. Start the application"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Installation cancelled."
    exit 0
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory name from the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INSTALL_DIR="$SCRIPT_DIR"

echo ""
echo -e "${YELLOW}Step 1: Stopping PM2 processes...${NC}"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
echo -e "${GREEN}✓ PM2 processes stopped${NC}"
echo ""

echo -e "${YELLOW}Step 2: Removing old installation...${NC}"
cd "$INSTALL_DIR/.."
rm -rf "$INSTALL_DIR"
echo -e "${GREEN}✓ Old installation removed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Cloning from GitHub...${NC}"
git clone https://github.com/jmlapido/technohub-map-nms.git
cd technohub-map-nms
echo -e "${GREEN}✓ Repository cloned${NC}"
echo ""

echo -e "${YELLOW}Step 4: Running installation script...${NC}"
chmod +x install-ubuntu.sh
./install-ubuntu.sh
echo ""

echo "========================================"
echo -e "${GREEN}✅ Fresh Installation Complete!${NC}"
echo "========================================"
echo ""
echo "Your application is now running at:"
echo "  • Domain: https://map.jmlapido.com"
echo "  • Local IP: http://$(hostname -I | awk '{print $1}'):4000"
echo "  • Localhost: http://localhost:4000"
echo ""
echo "PM2 Commands:"
echo "  pm2 status          - Check status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart"
echo ""

