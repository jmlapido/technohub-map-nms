#!/bin/bash

# Start TechnoHub Network Monitor with PM2

echo "Starting TechnoHub Network Monitor..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 is not installed. Installing..."
    sudo npm install -g pm2
fi

# Check if ecosystem.config.js exists
if [ ! -f "ecosystem.config.js" ]; then
    echo "Error: ecosystem.config.js not found"
    echo "Please run install-ubuntu.sh first"
    exit 1
fi

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo ""
echo "✓ Application started!"
echo ""
echo "Access at: http://$(hostname -I | awk '{print $1}'):4000"
echo ""
echo "Commands:"
echo "  pm2 status  - Check status"
echo "  pm2 logs    - View logs"
echo "  pm2 stop all - Stop application"
echo ""
