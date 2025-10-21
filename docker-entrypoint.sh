#!/bin/sh

# Create backend data directory if it doesn't exist
mkdir -p /app/backend/data

# Ensure proper permissions
chmod 755 /app/backend/data

# Copy config.json to data directory if it doesn't exist
if [ -f /app/backend/config.json ] && [ ! -f /app/backend/data/config.json ]; then
  cp /app/backend/config.json /app/backend/data/config.json
fi

# Create an empty database file if it doesn't exist to ensure directory is writable
touch /app/backend/data/database.sqlite
chmod 644 /app/backend/data/database.sqlite

# Start backend in background
echo "Starting backend server..."
cd /app/backend
node server.js &

# Wait for backend to be ready
sleep 3

# Start frontend
echo "Starting frontend server..."
cd /app/frontend
npm start

