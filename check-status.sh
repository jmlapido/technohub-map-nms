#!/bin/bash

echo "========================================"
echo "🔍 Network Monitor - Status Check"
echo "========================================"
echo ""

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status
echo ""

# Check backend logs
echo "📝 Backend Logs (last 10 lines):"
pm2 logs map-ping-backend --lines 10 --nostream 2>/dev/null || echo "  No backend logs found"
echo ""

# Check frontend logs
echo "📝 Frontend Logs (last 10 lines):"
pm2 logs map-ping-frontend --lines 10 --nostream 2>/dev/null || echo "  No frontend logs found"
echo ""

# Test backend
echo "🔌 Testing Backend API:"
if curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
    echo "  ✅ Backend is responding"
    curl -s http://localhost:5000/api/status | head -c 100
    echo "..."
else
    echo "  ❌ Backend is NOT responding"
fi
echo ""

# Check ports
echo "🔌 Port Status:"
if sudo netstat -tlnp 2>/dev/null | grep -q ":5000"; then
    echo "  ✅ Port 5000 is listening"
else
    echo "  ❌ Port 5000 is NOT listening"
fi

if sudo netstat -tlnp 2>/dev/null | grep -q ":4000"; then
    echo "  ✅ Port 4000 is listening"
else
    echo "  ❌ Port 4000 is NOT listening"
fi
echo ""

# Check firewall
echo "🔥 Firewall Status:"
sudo ufw status | head -3
echo ""

# Server IP
echo "🌐 Server IP Address:"
hostname -I | awk '{print $1}'
echo ""

echo "========================================"
echo "💡 Quick Fixes:"
echo "========================================"
echo ""
echo "If backend is not running:"
echo "  pm2 restart map-ping-backend"
echo ""
echo "If ports are blocked by firewall:"
echo "  sudo ufw allow 5000/tcp"
echo "  sudo ufw allow 4000/tcp"
echo ""
echo "If accessing from another computer:"
echo "  Use: http://$(hostname -I | awk '{print $1}'):4000"
echo ""

