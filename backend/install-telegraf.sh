#!/bin/bash
###############################################################################
# Telegraf & fping Installation Script
# 
# Installs Telegraf and fping for Map-Ping V3 monitoring
# 
# Usage: sudo bash install-telegraf.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Map-Ping V3 - Telegraf Installation${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Please run as root (use sudo)${NC}"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}❌ Cannot detect OS${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Detected OS: $OS $VER${NC}\n"

# Install based on OS
case $OS in
    ubuntu|debian)
        echo -e "${YELLOW}📦 Installing for Ubuntu/Debian...${NC}\n"
        
        # Clean up any existing InfluxData repository configuration first
        echo "→ Cleaning up any existing InfluxData repository configuration..."
        rm -f /etc/apt/sources.list.d/influxdata.list
        rm -f /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg
        rm -f /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg.asc
        rm -f /tmp/influxdata-archive_compat.key
        
        # Install prerequisites first (without updating, to avoid errors)
        echo "→ Installing prerequisites..."
        apt-get install -y -qq wget gnupg2 curl apt-transport-https software-properties-common ca-certificates 2>/dev/null || \
        apt-get install -y wget gnupg2 curl apt-transport-https software-properties-common ca-certificates
        
        # Add InfluxData repository
        echo "→ Adding InfluxData repository..."
        
        # Download and import GPG key using multiple methods for reliability
        KEY_FILE="/tmp/influxdata-archive_compat.key"
        KEY_IMPORTED=false
        
        # Method 1: Try downloading and importing directly with curl
        echo "→ Downloading GPG key..."
        if curl -fsSL https://repos.influxdata.com/influxdata-archive_compat.key | gpg --dearmor -o /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg 2>/dev/null; then
            echo "✓ GPG key imported successfully (method 1)"
            KEY_IMPORTED=true
        else
            # Method 2: Try using wget and import
            echo "→ Trying alternative key import method..."
            if wget -q -O "$KEY_FILE" https://repos.influxdata.com/influxdata-archive_compat.key 2>/dev/null; then
                if cat "$KEY_FILE" | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null 2>&1; then
                    rm -f "$KEY_FILE"
                    echo "✓ GPG key imported successfully (method 2)"
                    KEY_IMPORTED=true
                else
                    rm -f "$KEY_FILE"
                fi
            fi
        fi
        
        # Method 3: Use keyserver as fallback if previous methods failed
        if [ "$KEY_IMPORTED" = false ]; then
            echo "→ Trying GPG keyserver method..."
            if gpg --keyserver keyserver.ubuntu.com --recv-keys D8FF8E1F7DF8B07E 2>/dev/null || \
               gpg --keyserver pgp.mit.edu --recv-keys D8FF8E1F7DF8B07E 2>/dev/null || \
               gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys D8FF8E1F7DF8B07E 2>/dev/null; then
                if gpg --export D8FF8E1F7DF8B07E 2>/dev/null | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null 2>&1; then
                    echo "✓ GPG key imported via keyserver (method 3)"
                    KEY_IMPORTED=true
                fi
            fi
        fi
        
        if [ "$KEY_IMPORTED" = false ]; then
            echo -e "${RED}❌ Failed to import GPG key. Please check your internet connection.${NC}"
            exit 1
        fi
        
        # Add repository
        echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | \
        tee /etc/apt/sources.list.d/influxdata.list > /dev/null
        
        # Update package list
        echo "→ Updating package list..."
        apt-get update -qq
        
        # Install Telegraf
        echo "→ Installing Telegraf..."
        apt-get install -y -qq telegraf
        
        # Install fping
        echo "→ Installing fping..."
        apt-get install -y -qq fping
        
        # Set fping permissions (allow telegraf user to use it)
        chmod u+s $(which fping)
        
        ;;
        
    centos|rhel|rocky|almalinux)
        echo -e "${YELLOW}📦 Installing for CentOS/RHEL...${NC}\n"
        
        # Add InfluxData repository
        echo "→ Adding InfluxData repository..."
        cat <<EOF | tee /etc/yum.repos.d/influxdata.repo
[influxdata]
name = InfluxData Repository - Stable
baseurl = https://repos.influxdata.com/stable/\$basearch/main
enabled = 1
gpgcheck = 1
gpgkey = https://repos.influxdata.com/influxdata-archive_compat.key
EOF
        
        # Install Telegraf
        echo "→ Installing Telegraf..."
        yum install -y telegraf
        
        # Install fping
        echo "→ Installing fping..."
        yum install -y fping
        
        # Set fping permissions
        chmod u+s $(which fping)
        
        ;;
        
    *)
        echo -e "${RED}❌ Unsupported OS: $OS${NC}"
        echo -e "${YELLOW}Please install Telegraf manually from: https://docs.influxdata.com/telegraf/latest/install/${NC}"
        exit 1
        ;;
esac

# Verify installations
echo -e "\n${YELLOW}🔍 Verifying installations...${NC}\n"

# Check Telegraf
if command -v telegraf &> /dev/null; then
    TELEGRAF_VERSION=$(telegraf version | head -n 1)
    echo -e "${GREEN}✓ Telegraf installed: $TELEGRAF_VERSION${NC}"
else
    echo -e "${RED}✗ Telegraf installation failed${NC}"
    exit 1
fi

# Check fping
if command -v fping &> /dev/null; then
    FPING_VERSION=$(fping -v 2>&1 | head -n 1)
    echo -e "${GREEN}✓ fping installed: $FPING_VERSION${NC}"
else
    echo -e "${RED}✗ fping installation failed${NC}"
    exit 1
fi

# Configure Telegraf service
echo -e "\n${YELLOW}⚙️  Configuring Telegraf service...${NC}\n"

# Enable Telegraf service (but don't start yet - config needs to be generated first)
systemctl enable telegraf
echo -e "${GREEN}✓ Telegraf service enabled${NC}"

# Create telegraf user if doesn't exist
if ! id telegraf &>/dev/null; then
    useradd -r -s /bin/false telegraf
    echo -e "${GREEN}✓ Created telegraf user${NC}"
fi

# Set ownership and permissions
chown telegraf:telegraf /etc/telegraf
chmod 755 /etc/telegraf
echo -e "${GREEN}✓ Set permissions on /etc/telegraf${NC}"

# Test Telegraf configuration (if config exists)
if [ -f /etc/telegraf/telegraf.conf ]; then
    echo -e "\n${YELLOW}🧪 Testing Telegraf configuration...${NC}"
    if telegraf --config /etc/telegraf/telegraf.conf --test --quiet 2>&1 | head -n 5; then
        echo -e "${GREEN}✓ Configuration test passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Configuration test failed (this is normal if config not yet generated)${NC}"
    fi
fi

# Test fping
echo -e "\n${YELLOW}🧪 Testing fping...${NC}"
if fping -c 1 -t 1000 8.8.8.8 &> /dev/null; then
    echo -e "${GREEN}✓ fping test successful${NC}"
else
    echo -e "${YELLOW}⚠️  fping test failed (check network connectivity)${NC}"
fi

# Print next steps
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Run permission setup:"
echo -e "   ${GREEN}sudo bash backend/setup-permissions.sh${NC}"
echo -e ""
echo -e "2. Generate Telegraf configuration from your app"
echo -e ""
echo -e "3. Start Telegraf service:"
echo -e "   ${GREEN}sudo systemctl start telegraf${NC}"
echo -e ""
echo -e "4. Check Telegraf status:"
echo -e "   ${GREEN}sudo systemctl status telegraf${NC}"
echo -e ""
echo -e "5. View Telegraf logs:"
echo -e "   ${GREEN}sudo journalctl -u telegraf -f${NC}"
echo -e ""

echo -e "${YELLOW}📚 Documentation:${NC}"
echo -e "   - Telegraf: https://docs.influxdata.com/telegraf/"
echo -e "   - Map-Ping V3 Guide: See V3_INSTALL_GUIDE.md"
echo -e ""


