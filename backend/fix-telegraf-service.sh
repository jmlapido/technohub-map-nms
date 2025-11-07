#!/bin/bash
###############################################################################
# Telegraf Service Fix Script
# 
# Fixes common telegraf service issues:
# 1. TELEGRAF_OPTS environment variable not set
# 2. Missing outputs in telegraf config
# 
# Usage: sudo bash fix-telegraf-service.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Telegraf Service Fix${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Please run as root (use sudo)${NC}"
  exit 1
fi

# Find telegraf service file
TELEGRAF_SERVICE_FILE=""
if [ -f "/lib/systemd/system/telegraf.service" ]; then
    TELEGRAF_SERVICE_FILE="/lib/systemd/system/telegraf.service"
elif [ -f "/etc/systemd/system/telegraf.service" ]; then
    TELEGRAF_SERVICE_FILE="/etc/systemd/system/telegraf.service"
else
    echo -e "${RED}❌ Telegraf service file not found${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Found service file: ${TELEGRAF_SERVICE_FILE}${NC}\n"

# Backup original service file
BACKUP_FILE="${TELEGRAF_SERVICE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$TELEGRAF_SERVICE_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✓ Backed up service file to: ${BACKUP_FILE}${NC}"

# Fix 1: Remove or set TELEGRAF_OPTS
echo -e "\n${YELLOW}🔧 Fixing TELEGRAF_OPTS environment variable...${NC}"

# Check if TELEGRAF_OPTS is referenced
if grep -q "TELEGRAF_OPTS" "$TELEGRAF_SERVICE_FILE"; then
    # Check if it's in Environment= line
    if grep -q "Environment=.*TELEGRAF_OPTS" "$TELEGRAF_SERVICE_FILE"; then
        # Replace with empty string
        sed -i 's/Environment=.*TELEGRAF_OPTS.*/Environment="TELEGRAF_OPTS="/' "$TELEGRAF_SERVICE_FILE"
        echo -e "${GREEN}✓ Set TELEGRAF_OPTS to empty string${NC}"
    elif grep -q "\${TELEGRAF_OPTS}" "$TELEGRAF_SERVICE_FILE"; then
        # Remove from ExecStart if present
        sed -i 's/\${TELEGRAF_OPTS} *//g' "$TELEGRAF_SERVICE_FILE"
        echo -e "${GREEN}✓ Removed TELEGRAF_OPTS from ExecStart${NC}"
    else
        # Add Environment line to set it to empty
        if ! grep -q "Environment=" "$TELEGRAF_SERVICE_FILE"; then
            # Add after [Service] section
            sed -i '/\[Service\]/a Environment="TELEGRAF_OPTS="' "$TELEGRAF_SERVICE_FILE"
        else
            # Add to existing Environment line or create new one
            sed -i '/\[Service\]/,/^\[/ { /Environment=/a Environment="TELEGRAF_OPTS=" }' "$TELEGRAF_SERVICE_FILE"
        fi
        echo -e "${GREEN}✓ Added TELEGRAF_OPTS environment variable${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  TELEGRAF_OPTS not found in service file (may not be needed)${NC}"
fi

# Fix 2: Check and fix telegraf config
echo -e "\n${YELLOW}🔧 Checking Telegraf configuration...${NC}"

TELEGRAF_CONFIG="/etc/telegraf/telegraf.conf"

if [ ! -f "$TELEGRAF_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  Telegraf config file not found at ${TELEGRAF_CONFIG}${NC}"
    echo -e "${YELLOW}   Creating minimal valid configuration...${NC}"
    
    # Create minimal config with outputs
    mkdir -p /etc/telegraf
    cat > "$TELEGRAF_CONFIG" <<'EOF'
# Telegraf Configuration
# Minimal configuration with outputs

[agent]
  interval = "10s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000
  collection_jitter = "0s"
  flush_interval = "10s"
  flush_jitter = "0s"
  debug = false
  quiet = false
  hostname = ""
  omit_hostname = false

# Output plugin - required for telegraf to start
[[outputs.file]]
  files = ["stdout"]
  data_format = "influx"

# Input plugin - basic system metrics
[[inputs.cpu]]
  percpu = true
  totalcpu = true
  collect_cpu_time = false
  report_active = false

[[inputs.mem]]

[[inputs.disk]]
  ignore_fs = ["tmpfs", "devtmpfs", "devfs", "iso9660", "overlay", "aufs", "squashfs"]
EOF
    
    chown telegraf:telegraf "$TELEGRAF_CONFIG"
    chmod 644 "$TELEGRAF_CONFIG"
    echo -e "${GREEN}✓ Created minimal telegraf configuration${NC}"
else
    # Check if config has outputs
    if ! grep -q "^\[\[outputs\." "$TELEGRAF_CONFIG"; then
        echo -e "${RED}❌ No outputs found in telegraf configuration${NC}"
        echo -e "${YELLOW}   Adding minimal output...${NC}"
        
        # Backup config
        cp "$TELEGRAF_CONFIG" "${TELEGRAF_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Add output section if not present
        if ! grep -q "\[\[outputs" "$TELEGRAF_CONFIG"; then
            cat >> "$TELEGRAF_CONFIG" <<'EOF'

###############################################################################
#                            OUTPUT PLUGINS                                    #
###############################################################################

# File output (stdout) - minimal output to allow telegraf to start
[[outputs.file]]
  files = ["stdout"]
  data_format = "influx"
EOF
            echo -e "${GREEN}✓ Added output section to configuration${NC}"
        fi
    else
        echo -e "${GREEN}✓ Configuration has outputs${NC}"
    fi
    
    # Validate config
    echo -e "\n${YELLOW}🧪 Validating configuration...${NC}"
    if telegraf --config "$TELEGRAF_CONFIG" --test --quiet > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Configuration is valid${NC}"
    else
        echo -e "${YELLOW}⚠️  Configuration validation failed (but may still work)${NC}"
        echo -e "${YELLOW}   Run 'telegraf --config ${TELEGRAF_CONFIG} --test' for details${NC}"
    fi
fi

# Reload systemd
echo -e "\n${YELLOW}🔄 Reloading systemd daemon...${NC}"
systemctl daemon-reload
echo -e "${GREEN}✓ Systemd daemon reloaded${NC}"

# Reset failed state
echo -e "\n${YELLOW}🔄 Resetting failed service state...${NC}"
systemctl reset-failed telegraf 2>/dev/null || true
echo -e "${GREEN}✓ Service state reset${NC}"

# Try to start telegraf
echo -e "\n${YELLOW}🚀 Starting telegraf service...${NC}"
if systemctl start telegraf; then
    sleep 2
    if systemctl is-active --quiet telegraf; then
        echo -e "${GREEN}✓ Telegraf service started successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Service started but may not be active yet${NC}"
    fi
else
    echo -e "${RED}❌ Failed to start telegraf service${NC}"
    echo -e "${YELLOW}   Check logs with: sudo journalctl -u telegraf -n 50${NC}"
fi

# Show status
echo -e "\n${YELLOW}📊 Service Status:${NC}"
systemctl status telegraf --no-pager -l | head -20

# Print summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Fix Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}📝 Summary:${NC}"
echo -e "  Service file: ${GREEN}${TELEGRAF_SERVICE_FILE}${NC}"
echo -e "  Backup: ${GREEN}${BACKUP_FILE}${NC}"
echo -e "  Config: ${GREEN}${TELEGRAF_CONFIG}${NC}"
echo -e ""

echo -e "${YELLOW}🧪 Test Commands:${NC}"
echo -e "  ${GREEN}sudo systemctl status telegraf${NC}"
echo -e "  ${GREEN}sudo journalctl -u telegraf -n 50${NC}"
echo -e "  ${GREEN}sudo journalctl -u telegraf -f${NC}"
echo -e ""

if ! systemctl is-active --quiet telegraf; then
    echo -e "${YELLOW}⚠️  Note: If telegraf is still not running, you may need to:${NC}"
    echo -e "  1. Generate a proper telegraf config from your Map-Ping backend"
    echo -e "  2. Check the logs: ${GREEN}sudo journalctl -u telegraf -n 100${NC}"
    echo -e ""
fi

