#!/bin/bash
###############################################################################
# Map-Ping V3 Deployment Script
# 
# Deploys V3 updates to a running Map-Ping installation
# 
# Usage: bash deploy-v3.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Map-Ping V3 - Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then 
  echo -e "${YELLOW}⚠️  Running as root - this is not recommended${NC}"
  echo -e "${YELLOW}   Consider running as app user instead${NC}\n"
fi

# Step 1: Create backup
echo -e "${BLUE}📦 Step 1: Creating backup...${NC}"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-pre-v3-$TIMESTAMP.tar.gz"

tar -czf "$BACKUP_FILE" \
  backend/data/ \
  backend/.env \
  2>/dev/null || true

if [ -f "$BACKUP_FILE" ]; then
  echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}\n"
else
  echo -e "${RED}✗ Backup failed - aborting deployment${NC}"
  exit 1
fi

# Step 2: Stop services
echo -e "${BLUE}📛 Step 2: Stopping services...${NC}"
if systemctl is-active --quiet map-ping-backend; then
  sudo systemctl stop map-ping-backend
  echo -e "${GREEN}✓ Backend stopped${NC}"
fi

if systemctl is-active --quiet map-ping-frontend; then
  sudo systemctl stop map-ping-frontend
  echo -e "${GREEN}✓ Frontend stopped${NC}"
fi
echo ""

# Step 3: Pull latest code (if using git)
if [ -d ".git" ]; then
  echo -e "${BLUE}📥 Step 3: Pulling latest code...${NC}"
  git fetch origin
  git pull origin main
  echo -e "${GREEN}✓ Code updated${NC}\n"
else
  echo -e "${YELLOW}ℹ️  Step 3: Not a git repository, skipping pull${NC}\n"
fi

# Step 4: Install dependencies
echo -e "${BLUE}📦 Step 4: Installing dependencies...${NC}"

echo "  → Backend dependencies..."
cd backend
npm install --production > /dev/null 2>&1
echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"

echo "  → Frontend dependencies..."
cd ../frontend
npm install --production > /dev/null 2>&1
echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}\n"

# Step 5: Build frontend
echo -e "${BLUE}🏗️  Step 5: Building frontend...${NC}"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Frontend built${NC}\n"

# Step 6: Run database migration
echo -e "${BLUE}🗄️  Step 6: Running database migration...${NC}"
cd "$SCRIPT_DIR/backend"
node migrations/v2-to-v3.js
echo ""

# Step 7: Install Telegraf (if not already installed)
echo -e "${BLUE}📡 Step 7: Checking Telegraf installation...${NC}"
if command -v telegraf &> /dev/null; then
  echo -e "${GREEN}✓ Telegraf already installed${NC}\n"
else
  echo -e "${YELLOW}⚠️  Telegraf not installed${NC}"
  echo -e "${BLUE}Installing Telegraf...${NC}"
  sudo bash "$SCRIPT_DIR/backend/install-telegraf.sh"
  echo ""
fi

# Step 8: Set up permissions
echo -e "${BLUE}🔐 Step 8: Setting up permissions...${NC}"
if [ -f "/etc/sudoers.d/map-ping" ]; then
  echo -e "${GREEN}✓ Permissions already configured${NC}\n"
else
  echo -e "${BLUE}Configuring permissions...${NC}"
  sudo bash "$SCRIPT_DIR/backend/setup-permissions.sh"
  echo ""
fi

# Step 9: Generate Telegraf configuration
echo -e "${BLUE}⚙️  Step 9: Generating Telegraf configuration...${NC}"
cd "$SCRIPT_DIR/backend"
node -e "
const { updateTelegrafConfig } = require('./telegraf-manager');
const config = require('./data/config.json');
updateTelegrafConfig(config).then(result => {
  if (result.success) {
    console.log('✓ Telegraf configuration generated');
    process.exit(0);
  } else {
    console.error('✗ Failed:', result.error);
    process.exit(1);
  }
});
" || echo -e "${YELLOW}⚠️  Telegraf config generation failed (may work manually)${NC}"
echo ""

# Step 10: Start Telegraf
echo -e "${BLUE}🚀 Step 10: Starting Telegraf...${NC}"
if ! systemctl is-active --quiet telegraf; then
  sudo systemctl start telegraf
  sleep 2
fi

if systemctl is-active --quiet telegraf; then
  echo -e "${GREEN}✓ Telegraf running${NC}\n"
else
  echo -e "${YELLOW}⚠️  Telegraf not running (check logs: sudo journalctl -u telegraf -n 50)${NC}\n"
fi

# Step 11: Start services
echo -e "${BLUE}▶️  Step 11: Starting services...${NC}"
sudo systemctl start map-ping-backend
sleep 3
sudo systemctl start map-ping-frontend

if systemctl is-active --quiet map-ping-backend; then
  echo -e "${GREEN}✓ Backend started${NC}"
else
  echo -e "${RED}✗ Backend failed to start${NC}"
  echo -e "${YELLOW}Check logs: sudo journalctl -u map-ping-backend -n 50${NC}"
fi

if systemctl is-active --quiet map-ping-frontend; then
  echo -e "${GREEN}✓ Frontend started${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend not started (may not be configured)${NC}"
fi
echo ""

# Step 12: Health check
echo -e "${BLUE}🏥 Step 12: Running health check...${NC}"
sleep 5

if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Backend health check passed${NC}"
else
  echo -e "${RED}✗ Backend health check failed${NC}"
  echo -e "${YELLOW}Check logs: sudo journalctl -u map-ping-backend -n 50${NC}"
fi

if curl -f http://localhost:5000/api/monitoring/status > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Monitoring status endpoint responding${NC}"
else
  echo -e "${YELLOW}⚠️  Monitoring status endpoint not responding${NC}"
fi
echo ""

# Print summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}📊 Status:${NC}"
echo -e "  Backend:  $(systemctl is-active map-ping-backend || echo 'inactive')"
echo -e "  Frontend: $(systemctl is-active map-ping-frontend || echo 'inactive')"
echo -e "  Telegraf: $(systemctl is-active telegraf || echo 'inactive')"
echo -e "  Redis:    $(systemctl is-active redis-server || echo 'inactive')"
echo ""

echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "  1. Check monitoring status: curl http://localhost:5000/api/monitoring/status | jq"
echo -e "  2. View backend logs: sudo journalctl -u map-ping-backend -f"
echo -e "  3. View Telegraf logs: sudo journalctl -u telegraf -f"
echo -e "  4. Access application: http://your-domain.com (or http://localhost:3000)"
echo ""

echo -e "${BLUE}🔧 Troubleshooting:${NC}"
echo -e "  - Backend logs: sudo journalctl -u map-ping-backend -n 100"
echo -e "  - Telegraf logs: sudo journalctl -u telegraf -n 100"
echo -e "  - Test Telegraf: sudo telegraf --config /etc/telegraf/telegraf.conf --test"
echo -e "  - Check Redis: redis-cli ping"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo -e "  - Installation Guide: V3_INSTALL_GUIDE.md"
echo -e "  - TODO Tracking: V3_IMPLEMENTATION_TODO.md"
echo -e "  - Rollback: tar -xzf $BACKUP_FILE"
echo ""

echo -e "${GREEN}Deployment completed at: $(date)${NC}"


