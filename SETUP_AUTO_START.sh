#!/bin/bash

# Setup Auto-Start on Boot for Map-Ping
# This script configures systemd service to auto-start the application on system reboot

set -e

echo "========================================="
echo "Map-Ping Auto-Start Setup"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get current user
CURRENT_USER=$(whoami)
USER_HOME=$(eval echo ~$CURRENT_USER)
PROJECT_DIR="$USER_HOME/map-ping"

echo -e "${YELLOW}User: ${CURRENT_USER}${NC}"
echo -e "${YELLOW}Project directory: ${PROJECT_DIR}${NC}"
echo ""

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Project directory not found at ${PROJECT_DIR}${NC}"
    echo "Please run FRESH_INSTALL_UBUNTU.sh first"
    exit 1
fi

# Get Node.js path
NODE_PATH=$(which node)
NPM_PATH=$(which npm)

if [ -z "$NODE_PATH" ] || [ -z "$NPM_PATH" ]; then
    echo -e "${RED}Error: Node.js or npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found: ${NODE_PATH}${NC}"
echo -e "${GREEN}✓ npm found: ${NPM_PATH}${NC}"
echo ""

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/map-ping.service"

echo -e "${YELLOW}Creating systemd service file...${NC}"

sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=TechnoHub Network Link Map Monitor
Documentation=https://github.com/jmlapido/technohub-map-nms
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${PROJECT_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=${NPM_PATH} run dev
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Service file created${NC}"
echo ""

# Reload systemd
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload
echo -e "${GREEN}✓ Systemd daemon reloaded${NC}"
echo ""

# Enable service (auto-start on boot)
echo -e "${YELLOW}Enabling service to start on boot...${NC}"
sudo systemctl enable map-ping.service
echo -e "${GREEN}✓ Service enabled for auto-start${NC}"
echo ""

# Start service now
echo -e "${YELLOW}Starting service now...${NC}"
sudo systemctl start map-ping.service
echo -e "${GREEN}✓ Service started${NC}"
echo ""

# Wait a moment for service to start
sleep 2

# Check status
echo -e "${YELLOW}Checking service status...${NC}"
sudo systemctl status map-ping.service --no-pager -l
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "The application will now automatically start on system reboot."
echo ""
echo "Useful commands:"
echo "  - Check status:  sudo systemctl status map-ping"
echo "  - View logs:     sudo journalctl -u map-ping -f"
echo "  - Stop service:  sudo systemctl stop map-ping"
echo "  - Start service: sudo systemctl start map-ping"
echo "  - Restart:       sudo systemctl restart map-ping"
echo "  - Disable:       sudo systemctl disable map-ping"
echo ""

