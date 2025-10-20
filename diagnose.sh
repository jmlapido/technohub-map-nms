#!/bin/bash

echo "========================================"
echo "Network Monitor - Diagnostic Script"
echo "========================================"
echo ""

echo "1. Checking PM2 Status..."
pm2 status
echo ""

echo "2. Checking Backend Logs (last 20 lines)..."
pm2 logs map-ping-backend --lines 20 --nostream
echo ""

echo "3. Checking Frontend Logs (last 20 lines)..."
pm2 logs map-ping-frontend --lines 20 --nostream
echo ""

echo "4. Checking if ports are listening..."
echo "Port 5000 (Backend):"
sudo netstat -tlnp | grep 5000 || echo "  ❌ Port 5000 not listening"
echo ""
echo "Port 4000 (Frontend):"
sudo netstat -tlnp | grep 4000 || echo "  ❌ Port 4000 not listening"
echo ""

echo "5. Testing Backend API..."
curl -s http://localhost:5000/api/status | head -c 100
echo ""
echo ""

echo "6. Checking Firewall..."
sudo ufw status | head -5
echo ""

echo "7. Checking if backend server.js exists..."
if [ -f "backend/server.js" ]; then
    echo "  ✓ backend/server.js exists"
else
    echo "  ❌ backend/server.js NOT FOUND"
fi
echo ""

echo "========================================"
echo "Diagnostic Complete"
echo "========================================"
echo ""
echo "Common Issues:"
echo "1. If PM2 shows 'errored' or 'stopped' - run: pm2 restart all"
echo "2. If ports not listening - check logs for errors"
echo "3. If firewall blocking - run: sudo ufw allow 5000/tcp && sudo ufw allow 4000/tcp"
echo "4. If backend API test fails - backend is not running properly"
echo ""

