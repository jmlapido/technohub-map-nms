#!/bin/bash

# Map-Ping v2.0 - Comprehensive Test Script
# Tests all Phase 1 components

echo "========================================"
echo "Map-Ping v2.0 - Test Suite"
echo "Task 1.6: Testing & Validation"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if backend is running
check_backend() {
    echo -n "Checking if backend is running... "
    if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo -e "${YELLOW}⚠ Backend not running. Please start it first:${NC}"
        echo "  cd backend && npm start"
        return 1
    fi
}

# Check if Redis is running
check_redis() {
    echo -n "Checking if Redis is running... "
    if docker ps | grep -q map-ping-redis; then
        echo -e "${GREEN}✓${NC}"
        return 0
    elif redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} (local Redis)"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Redis not detected (may affect some tests)"
        echo "  Start Redis: docker-compose up -d redis"
        return 1
    fi
}

# Run test suite
run_test_suite() {
    echo ""
    echo -e "${BLUE}Running Test Suite...${NC}"
    echo "========================================"
    cd backend
    node tests/test-suite.js
    cd ..
}

# Run performance tests
run_performance() {
    echo ""
    echo -e "${BLUE}Running Performance Tests...${NC}"
    echo "========================================"
    cd backend
    node tests/performance-test.js
    cd ..
}

# Run WebSocket tests
run_websocket() {
    echo ""
    echo -e "${BLUE}Running WebSocket Tests...${NC}"
    echo "========================================"
    cd backend
    node tests/test-websocket.js
    cd ..
}

# Run Redis fallback tests
run_redis_test() {
    echo ""
    echo -e "${BLUE}Running Redis Fallback Tests...${NC}"
    echo "========================================"
    cd backend
    node tests/test-redis-fallback.js
    cd ..
}

# Main execution
main() {
    # Pre-flight checks
    echo "Pre-flight Checks:"
    echo "=================="
    check_backend
    check_redis
    echo ""
    
    # Run all tests
    run_test_suite
    run_performance
    run_websocket
    run_redis_test
    
    echo ""
    echo "========================================"
    echo "Test Suite Complete"
    echo "========================================"
    echo ""
    echo "📝 Manual Testing Checklist:"
    echo "  [ ] Test with 100+ devices configuration"
    echo "  [ ] Monitor CPU usage (should be <15%)"
    echo "  [ ] Monitor memory usage (should be <200MB)"
    echo "  [ ] Test WebSocket reconnection"
    echo "  [ ] Test Redis fallback (stop Redis temporarily)"
    echo "  [ ] Verify batch writes are committed"
    echo "  [ ] Test circuit breaker with failing devices"
    echo ""
}

main

