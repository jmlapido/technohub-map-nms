#!/bin/bash

echo "========================================"
echo "🔍 Proxmox Container Network Diagnostic"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Container Network Configuration${NC}"
echo "----------------------------------------"
echo ""
echo "Container IP Addresses:"
ip addr show | grep "inet " | grep -v "127.0.0.1"
echo ""

echo "Default Route:"
ip route | grep default
echo ""

echo -e "${YELLOW}Step 2: PM2 Status${NC}"
echo "----------------------------------------"
pm2 status
echo ""

echo -e "${YELLOW}Step 3: Port Listening Status${NC}"
echo "----------------------------------------"
echo "Port 5000 (Backend):"
if ss -tlnp 2>/dev/null | grep -q ":5000"; then
    echo -e "  ${GREEN}✅ Port 5000 is listening${NC}"
    ss -tlnp | grep ":5000"
else
    echo -e "  ${RED}❌ Port 5000 is NOT listening${NC}"
fi
echo ""

echo "Port 4000 (Frontend):"
if ss -tlnp 2>/dev/null | grep -q ":4000"; then
    echo -e "  ${GREEN}✅ Port 4000 is listening${NC}"
    ss -tlnp | grep ":4000"
else
    echo -e "  ${RED}❌ Port 4000 is NOT listening${NC}"
fi
echo ""

echo -e "${YELLOW}Step 4: Local Service Tests${NC}"
echo "----------------------------------------"
echo "Testing backend API (localhost):"
if curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Backend is responding on localhost${NC}"
    curl -s http://localhost:5000/api/status | head -c 100
    echo "..."
else
    echo -e "  ${RED}❌ Backend is NOT responding on localhost${NC}"
fi
echo ""

echo "Testing frontend (localhost):"
if curl -s http://localhost:4000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Frontend is responding on localhost${NC}"
else
    echo -e "  ${RED}❌ Frontend is NOT responding on localhost${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Container IP Tests${NC}"
echo "----------------------------------------"
CONTAINER_IP=$(hostname -I | awk '{print $1}')
echo "Container IP: $CONTAINER_IP"
echo ""

echo "Testing backend API (container IP):"
if curl -s http://$CONTAINER_IP:5000/api/status > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Backend is responding on container IP${NC}"
else
    echo -e "  ${RED}❌ Backend is NOT responding on container IP${NC}"
fi
echo ""

echo "Testing frontend (container IP):"
if curl -s http://$CONTAINER_IP:4000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Frontend is responding on container IP${NC}"
else
    echo -e "  ${RED}❌ Frontend is NOT responding on container IP${NC}"
fi
echo ""

echo -e "${YELLOW}Step 6: Firewall Status${NC}"
echo "----------------------------------------"
if command -v ufw &> /dev/null; then
    echo "UFW Status:"
    sudo ufw status | head -5
else
    echo "UFW not installed"
fi
echo ""

echo -e "${YELLOW}Step 7: Network Connectivity${NC}"
echo "----------------------------------------"
echo "Testing internet connectivity:"
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Internet connectivity OK${NC}"
else
    echo -e "  ${RED}❌ No internet connectivity${NC}"
fi
echo ""

echo -e "${YELLOW}Step 8: Cloudflare Tunnel Test${NC}"
echo "----------------------------------------"
if curl -s https://map.jmlapido.com/api/status > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Cloudflare tunnel is working${NC}"
    curl -s https://map.jmlapido.com/api/status | head -c 100
    echo "..."
else
    echo -e "  ${RED}❌ Cloudflare tunnel is NOT working${NC}"
fi
echo ""

echo "========================================"
echo "📊 Diagnostic Summary"
echo "========================================"
echo ""

# Determine issues
ISSUES=0

if ! ss -tlnp 2>/dev/null | grep -q ":5000"; then
    echo -e "${RED}❌ Backend not listening on port 5000${NC}"
    ISSUES=$((ISSUES+1))
fi

if ! ss -tlnp 2>/dev/null | grep -q ":4000"; then
    echo -e "${RED}❌ Frontend not listening on port 4000${NC}"
    ISSUES=$((ISSUES+1))
fi

if ! curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend not responding locally${NC}"
    ISSUES=$((ISSUES+1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All services are running correctly!${NC}"
    echo ""
    echo "If you still can't access from outside:"
    echo "  1. Check Proxmox firewall configuration"
    echo "  2. Verify Cloudflare tunnel points to container IP"
    echo "  3. Check Proxmox host network settings"
else
    echo -e "${RED}Found $ISSUES issue(s)${NC}"
    echo ""
    echo "Common fixes:"
    echo "  • Restart services: pm2 restart all"
    echo "  • Check logs: pm2 logs --lines 50"
    echo "  • Allow firewall: sudo ufw allow 5000/tcp && sudo ufw allow 4000/tcp"
fi

echo ""
echo "========================================"
echo "💡 Next Steps"
echo "========================================"
echo ""
echo "1. If services not running:"
echo "   pm2 restart all"
echo ""
echo "2. If ports not accessible from outside:"
echo "   Check Proxmox firewall settings"
echo "   Check Cloudflare tunnel configuration"
echo ""
echo "3. If Cloudflare tunnel not working:"
echo "   Verify tunnel points to: $CONTAINER_IP:5000 and $CONTAINER_IP:4000"
echo ""
echo "Container IP: $CONTAINER_IP"
echo "Access URLs:"
echo "  • Local: http://localhost:4000"
echo "  • Container IP: http://$CONTAINER_IP:4000"
echo "  • Cloudflare: https://map.jmlapido.com"
echo ""

