#!/bin/bash
###############################################################################
# Permission Setup Script
# 
# Sets up permissions for Map-Ping backend to manage Telegraf configuration
# 
# Usage: sudo bash setup-permissions.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Map-Ping V3 - Permission Setup${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Please run as root (use sudo)${NC}"
  exit 1
fi

# Get the user who invoked sudo (or current user if not using sudo)
if [ -n "$SUDO_USER" ]; then
    APP_USER="$SUDO_USER"
else
    APP_USER="$(whoami)"
fi

echo -e "${YELLOW}📋 Setting up permissions for user: ${GREEN}$APP_USER${NC}\n"

# Get the app directory (assuming script is run from backend/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}📁 Application directory: ${GREEN}$APP_DIR${NC}\n"

# Create sudoers file
SUDOERS_FILE="/etc/sudoers.d/map-ping"

echo -e "${YELLOW}⚙️  Creating sudoers configuration...${NC}"

cat > "$SUDOERS_FILE" <<EOF
# Map-Ping Backend Permissions
# Allows map-ping backend to manage Telegraf configuration
# 
# Created: $(date)
# User: $APP_USER

# Allow copying Telegraf configuration
$APP_USER ALL=(ALL) NOPASSWD: /bin/cp $APP_DIR/backend/data/telegraf.conf.tmp /etc/telegraf/telegraf.conf

# Allow Telegraf service management
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl reload telegraf
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart telegraf
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl status telegraf
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl start telegraf
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop telegraf

# Allow viewing Telegraf logs
$APP_USER ALL=(ALL) NOPASSWD: /bin/journalctl -u telegraf *

# Allow testing Telegraf binary
$APP_USER ALL=(ALL) NOPASSWD: /usr/bin/telegraf --config * --test *
EOF

# Set correct permissions on sudoers file
chmod 0440 "$SUDOERS_FILE"

echo -e "${GREEN}✓ Sudoers file created: $SUDOERS_FILE${NC}"

# Validate sudoers syntax
echo -e "\n${YELLOW}🔍 Validating sudoers configuration...${NC}"

if visudo -c -f "$SUDOERS_FILE"; then
    echo -e "${GREEN}✓ Sudoers configuration is valid${NC}"
else
    echo -e "${RED}✗ Sudoers configuration is invalid${NC}"
    echo -e "${RED}Removing invalid file...${NC}"
    rm -f "$SUDOERS_FILE"
    exit 1
fi

# Ensure data directory exists and has correct permissions
DATA_DIR="$APP_DIR/backend/data"

if [ ! -d "$DATA_DIR" ]; then
    echo -e "\n${YELLOW}📁 Creating data directory...${NC}"
    mkdir -p "$DATA_DIR"
    chown "$APP_USER:$APP_USER" "$DATA_DIR"
    chmod 755 "$DATA_DIR"
    echo -e "${GREEN}✓ Data directory created${NC}"
fi

# Set ownership on application files
echo -e "\n${YELLOW}📝 Setting file ownership...${NC}"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend"
echo -e "${GREEN}✓ File ownership set${NC}"

# Test sudo permissions
echo -e "\n${YELLOW}🧪 Testing sudo permissions...${NC}\n"

# Test as the app user
if su - "$APP_USER" -c "sudo systemctl status telegraf" &> /dev/null; then
    echo -e "${GREEN}✓ Sudo permissions test passed${NC}"
else
    echo -e "${YELLOW}⚠️  Sudo permissions test failed (Telegraf may not be running yet)${NC}"
fi

# Create a test config file
TEST_CONFIG="$DATA_DIR/telegraf.conf.tmp"
echo "# Test configuration" > "$TEST_CONFIG"
chown "$APP_USER:$APP_USER" "$TEST_CONFIG"

if su - "$APP_USER" -c "sudo cp $TEST_CONFIG /tmp/telegraf-test.conf" &> /dev/null; then
    echo -e "${GREEN}✓ File copy permissions test passed${NC}"
    rm -f /tmp/telegraf-test.conf
else
    echo -e "${RED}✗ File copy permissions test failed${NC}"
fi

rm -f "$TEST_CONFIG"

# Print summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Permission Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}📝 Summary:${NC}"
echo -e "  User: ${GREEN}$APP_USER${NC}"
echo -e "  Can reload Telegraf: ${GREEN}✓${NC}"
echo -e "  Can update config: ${GREEN}✓${NC}"
echo -e "  Can view logs: ${GREEN}✓${NC}"
echo -e ""

echo -e "${YELLOW}🧪 Test Commands (as $APP_USER):${NC}"
echo -e "  ${GREEN}sudo systemctl status telegraf${NC}"
echo -e "  ${GREEN}sudo journalctl -u telegraf -n 20${NC}"
echo -e ""

echo -e "${YELLOW}📚 Next Steps:${NC}"
echo -e "1. Start your Map-Ping backend"
echo -e "2. Add devices via the web UI"
echo -e "3. Backend will automatically generate and reload Telegraf config"
echo -e ""

