#!/bin/bash

echo "========================================"
echo "Network Link Map Monitor - Test Script"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test functions
test_node() {
    echo -n "Testing Node.js installation... "
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓${NC} $(node --version)"
        return 0
    else
        echo -e "${RED}✗ Not installed${NC}"
        return 1
    fi
}

test_npm() {
    echo -n "Testing npm installation... "
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✓${NC} $(npm --version)"
        return 0
    else
        echo -e "${RED}✗ Not installed${NC}"
        return 1
    fi
}

test_dependencies() {
    echo -n "Testing dependencies... "
    if [ -d "node_modules" ] && [ -d "frontend/node_modules" ] && [ -d "backend/node_modules" ]; then
        echo -e "${GREEN}✓ Installed${NC}"
        return 0
    else
        echo -e "${RED}✗ Not installed${NC}"
        return 1
    fi
}

test_backend_port() {
    echo -n "Testing backend port 5000... "
    if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ In use (backend running)${NC}"
        return 0
    else
        echo -e "${YELLOW}○ Not in use (backend not running)${NC}"
        return 1
    fi
}

test_frontend_port() {
    echo -n "Testing frontend port 4000... "
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ In use (frontend running)${NC}"
        return 0
    else
        echo -e "${YELLOW}○ Not in use (frontend not running)${NC}"
        return 1
    fi
}

test_backend_api() {
    echo -n "Testing backend API... "
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/status 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ Responding (HTTP $response)${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding (HTTP $response)${NC}"
        return 1
    fi
}

test_frontend() {
    echo -n "Testing frontend... "
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ Responding (HTTP $response)${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding (HTTP $response)${NC}"
        return 1
    fi
}

test_ping_permissions() {
    echo -n "Testing ping permissions... "
    if ping -c 1 -W 1 8.8.8.8 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Can ping (no sudo needed)${NC}"
        return 0
    else
        echo -e "${YELLOW}○ Cannot ping (may need sudo)${NC}"
        return 1
    fi
}

test_database() {
    echo -n "Testing database... "
    if [ -f "backend/database.sqlite" ]; then
        echo -e "${GREEN}✓ Database exists${NC}"
        return 0
    else
        echo -e "${YELLOW}○ Database not created yet (will be created on first run)${NC}"
        return 1
    fi
}

# Run tests
echo ""
echo "System Requirements:"
echo "===================="
test_node
test_npm
echo ""

echo "Project Setup:"
echo "=============="
test_dependencies
test_database
test_ping_permissions
echo ""

echo "Running Services:"
echo "================="
test_backend_port
test_frontend_port
echo ""

echo "API Tests:"
echo "=========="
test_backend_api
test_frontend
echo ""

echo "========================================"
echo "Test Complete"
echo "========================================"
echo ""

# Summary
if test_node && test_npm && test_dependencies; then
    echo -e "${GREEN}✓ System is ready!${NC}"
    echo ""
    echo "To start the application:"
    echo "  ./start.sh"
    echo "  or"
    echo "  npm run dev"
    echo ""
    echo "Then access:"
    echo "  Frontend: http://localhost:4000"
    echo "  Backend:  http://localhost:5000/api"
else
    echo -e "${RED}✗ System needs setup${NC}"
    echo ""
    echo "Run setup script:"
    echo "  ./setup-ubuntu.sh"
fi

echo ""



