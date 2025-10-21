#!/bin/sh

# Create backend data directory if it doesn't exist
mkdir -p /app/backend/data

# Copy config.json to data directory if it doesn't exist
if [ -f /app/backend/config.json ] && [ ! -f /app/backend/data/config.json ]; then
  cp /app/backend/config.json /app/backend/data/config.json
fi

# Start backend in background
echo "Starting backend server..."
cd /app/backend
node server.js &

# Wait for backend to be ready
sleep 3

# Start frontend
echo "Starting frontend server..."
cd /app/frontend
PORT=4000 npm start

