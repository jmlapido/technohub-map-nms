#!/bin/bash

echo "========================================"
echo "TechnoHub Network Monitor - Ubuntu Install"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please run as regular user (not root)${NC}"
   echo "The script will ask for sudo when needed"
   exit 1
fi

# Get current user
CURRENT_USER=$(whoami)
echo -e "${GREEN}Installing for user: $CURRENT_USER${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[1/6] Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}[1/6] Node.js already installed: $(node --version)${NC}"
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo ""
    echo -e "${YELLOW}[2/6] Installing PM2...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}[2/6] PM2 already installed${NC}"
fi

# Install project dependencies
echo ""
echo -e "${YELLOW}[3/6] Installing project dependencies...${NC}"
npm install

echo ""
echo -e "${YELLOW}[4/6] Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

echo ""
echo -e "${YELLOW}[5/6] Installing backend dependencies...${NC}"
cd backend
npm install
cd ..

# Setup PM2 ecosystem
echo ""
echo -e "${YELLOW}[6/6] Setting up PM2...${NC}"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'map-ping-backend',
      script: './backend/server.js',
      cwd: '/home/USERNAME/map-ping',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'map-ping-frontend',
      script: 'npm',
      args: 'run start',
      cwd: '/home/USERNAME/map-ping/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
EOF

# Replace USERNAME in ecosystem.config.js
sed -i "s|/home/USERNAME/map-ping|$(pwd)|g" ecosystem.config.js

# Create logs directory
mkdir -p logs

# Build frontend for production
echo ""
echo -e "${YELLOW}Building frontend for production...${NC}"
cd frontend
npm run build
cd ..

# Start with PM2
echo ""
echo -e "${YELLOW}Starting application with PM2...${NC}"
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 startup script
echo ""
echo -e "${YELLOW}Setting up PM2 to start on boot...${NC}"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $CURRENT_USER --hp /home/$CURRENT_USER

echo ""
echo "========================================"
echo -e "${GREEN}Installation Complete!${NC}"
echo "========================================"
echo ""
echo -e "${GREEN}✓ Application is running${NC}"
echo -e "${GREEN}✓ Auto-start on boot is configured${NC}"
echo ""
echo "Access the application at:"
echo -e "  ${YELLOW}Frontend:${NC} http://$(hostname -I | awk '{print $1}'):4000"
echo -e "  ${YELLOW}Backend API:${NC} http://$(hostname -I | awk '{print $1}'):5000/api"
echo ""
echo "PM2 Commands:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart application"
echo "  pm2 stop all        - Stop application"
echo "  pm2 delete all      - Remove from PM2"
echo ""
echo "Firewall:"
echo "  sudo ufw allow 4000/tcp"
echo "  sudo ufw allow 5000/tcp"
echo ""


