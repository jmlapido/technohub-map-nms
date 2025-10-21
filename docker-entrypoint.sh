#!/bin/sh

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

