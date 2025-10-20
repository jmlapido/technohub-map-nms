#!/bin/bash

# TechnoHub Network Monitor - Production Startup Script
# This script starts both frontend and backend in production mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting TechnoHub Network Monitor...${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend
    npm install
    cd ..
fi

# Build frontend if not already built
if [ ! -d "frontend/.next" ]; then
    echo -e "${YELLOW}Building frontend...${NC}"
    cd frontend
    npm run build
    cd ..
fi

# Start backend
echo -e "${GREEN}Starting backend server...${NC}"
cd backend
node server.js &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo -e "${GREEN}Starting frontend server...${NC}"
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✓ TechnoHub Network Monitor started successfully!${NC}"
echo -e "${GREEN}  Frontend: http://localhost:4000${NC}"
echo -e "${GREEN}  Backend API: http://localhost:5000${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}Services stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait for processes
wait



