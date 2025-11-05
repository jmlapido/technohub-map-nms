# Ubuntu Installation Guide - Map-Ping v2.0.0

## 🚀 Quick Start (Docker - Recommended)

Map-Ping v2.0.0 includes Redis for real-time caching and WebSocket support. Docker is the easiest way to deploy.

### Prerequisites

- Ubuntu 20.04 or later
- Docker and Docker Compose installed
- Git (optional, for cloning)

### Step 1: Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose v2
sudo apt install docker-compose-plugin -y

# Log out and back in for group changes to take effect
# Or run: newgrp docker
```

### Step 2: Clone or Transfer the Application

**Option A: Clone from GitHub**
```bash
git clone https://github.com/jmlapido/technohub-map-nms.git
cd technohub-map-nms
```

**Option B: Transfer from Windows**
```powershell
# From Windows PowerShell
scp -r C:\Users\Administrator\map-ping user@ubuntu-ip:/home/user/
```

```bash
# On Ubuntu
cd ~/map-ping
```

### Step 3: Start with Docker Compose

```bash
# Start all services (Redis + Application)
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 4: Configure Firewall (if needed)

```bash
sudo ufw allow 4000/tcp  # Frontend
sudo ufw allow 5000/tcp  # Backend API
sudo ufw status
```

### Step 5: Access the Application

```
Frontend: http://your-ubuntu-ip:4000
Backend:  http://your-ubuntu-ip:5000/api
```

**That's it!** The application is now running with:
- ✅ Redis for real-time status caching
- ✅ WebSocket for live updates (70-80% bandwidth reduction)
- ✅ Queue-based scheduler (handles 100+ devices efficiently)
- ✅ Database write batching (95% write reduction)

---

## 📦 Manual Installation (Alternative)

If you prefer manual installation without Docker:

### Step 1: Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version
```

### Step 2: Install Redis

**Map-Ping v2.0.0 requires Redis for real-time caching.**

```bash
# Install Redis
sudo apt update
sudo apt install redis-server -y

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis connection
redis-cli ping  # Should return "PONG"

# Verify Redis is running
sudo systemctl status redis-server
```

### Step 3: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### Step 4: Clone/Transfer Application

```bash
# Clone from GitHub
git clone https://github.com/jmlapido/technohub-map-nms.git
cd technohub-map-nms

# Or navigate to transferred directory
cd ~/map-ping
```

### Step 5: Install Dependencies

```bash
# Install all dependencies (root, frontend, backend)
npm run install:all

# Or install manually:
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### Step 6: Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### Step 7: Configure Environment Variables (Optional)

Create `.env` file in root directory (optional, defaults work):

```bash
cat > .env << EOF
NODE_ENV=production
BACKEND_PORT=5000
FRONTEND_PORT=4000
REDIS_HOST=localhost
REDIS_PORT=6379
EOF
```

### Step 8: Start Application with PM2

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# View status
pm2 status

# View logs
pm2 logs
```

### Step 9: Configure Auto-Start on Boot

```bash
# Generate startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# This will output a command - run it
# Example: sudo systemctl enable pm2-$USER
```

### Step 10: Configure Firewall

```bash
sudo ufw allow 4000/tcp  # Frontend
sudo ufw allow 5000/tcp  # Backend API
sudo ufw status
```

---

## 🔧 Management Commands

### Docker Management

```bash
# View logs
docker compose logs -f              # All services
docker compose logs -f map-ping      # Application only
docker compose logs -f redis         # Redis only

# Restart services
docker compose restart              # All services
docker compose restart map-ping     # Application only
docker compose restart redis        # Redis only

# Stop services
docker compose stop

# Start services
docker compose start

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (⚠️ removes data)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build
```

### PM2 Management (Manual Installation)

```bash
# View status
pm2 status

# View logs
pm2 logs                    # All logs (real-time)
pm2 logs map-ping-backend   # Backend only
pm2 logs map-ping-frontend  # Frontend only

# Restart
pm2 restart all             # Restart everything
pm2 restart map-ping-backend
pm2 restart map-ping-frontend

# Stop
pm2 stop all

# Start
pm2 start all

# Delete from PM2
pm2 delete all

# Monitor resources
pm2 monit
```

### Redis Management

```bash
# Check Redis status
sudo systemctl status redis-server

# Start Redis
sudo systemctl start redis-server

# Stop Redis
sudo systemctl stop redis-server

# Restart Redis
sudo systemctl restart redis-server

# Test Redis connection
redis-cli ping

# Monitor Redis
redis-cli monitor

# View Redis info
redis-cli info

# Clear all data (⚠️ use with caution)
redis-cli FLUSHALL
```

---

## 🧪 Verify Installation

### 1. Check Services are Running

**Docker:**
```bash
docker compose ps
# Should show: map-ping (Up) and redis (Up)
```

**Manual:**
```bash
pm2 status
# Should show: map-ping-backend (online) and map-ping-frontend (online)

sudo systemctl status redis-server
# Should show: active (running)
```

### 2. Test API Endpoints

```bash
# Test backend API
curl http://localhost:5000/api/status

# Test system stats (includes Redis and scheduler info)
curl http://localhost:5000/api/system/stats

# Test WebSocket endpoint
curl http://localhost:5000  # Should return HTML
```

### 3. Check Frontend

Open browser: `http://your-ubuntu-ip:4000`

You should see:
- Network map with devices
- Real-time status updates (via WebSocket)
- Status bar with device information
- Settings page

### 4. Verify WebSocket Connection

1. Open browser DevTools (F12)
2. Go to Network tab → WS (WebSocket)
3. You should see a WebSocket connection to `/socket.io/`
4. Status updates should appear in real-time without page refresh

### 5. Check Redis Integration

```bash
# Connect to Redis
redis-cli

# Check for cached status data
KEYS *

# Check a specific device status
GET device:status:device-id

# Exit
exit
```

---

## 🔄 Update Application

### Docker Update

```bash
# Stop services
docker compose down

# Pull latest code
git pull

# Rebuild and start
docker compose up -d --build

# Verify
docker compose logs -f
```

### Manual Update

```bash
# Stop application
pm2 stop all

# Pull latest code
git pull

# Install new dependencies
npm run install:all

# Rebuild frontend
cd frontend
npm run build
cd ..

# Restart application
pm2 restart all
pm2 save
```

---

## 🐛 Troubleshooting

### Application Won't Start

**Docker:**
```bash
# Check logs
docker compose logs -f

# Check container status
docker compose ps

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(4000|5000)'
```

**Manual:**
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Check Node.js version (should be 20.x)
node --version

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(4000|5000)'
```

### Redis Connection Issues

```bash
# Check Redis is running
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping

# Check Redis logs
sudo journalctl -u redis-server -f

# Restart Redis
sudo systemctl restart redis-server

# Check Redis configuration
sudo nano /etc/redis/redis.conf
```

### WebSocket Not Working

```bash
# Check backend logs for WebSocket errors
docker compose logs map-ping | grep -i websocket
# Or
pm2 logs map-ping-backend | grep -i websocket

# Verify WebSocket endpoint
curl http://localhost:5000/socket.io/

# Check firewall (WebSocket uses HTTP upgrade)
sudo ufw status
```

### High CPU/Memory Usage

**v2.0.0 includes optimizations for 100+ devices:**

```bash
# Check system stats endpoint
curl http://localhost:5000/api/system/stats

# Monitor resources
# Docker:
docker stats

# Manual:
pm2 monit
htop
```

### Can't Access from Browser

```bash
# Check firewall
sudo ufw status

# Allow ports
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp

# Check if application is running
# Docker:
docker compose ps

# Manual:
pm2 status

# Check application logs
docker compose logs -f
# Or
pm2 logs
```

### Ping Not Working

```bash
# Test ping manually
ping -c 3 8.8.8.8

# Check ping permissions (Linux requires special permissions)
sudo setcap cap_net_raw+ep $(which node)

# Restart application
# Docker:
docker compose restart map-ping

# Manual:
pm2 restart all
```

---

## 💾 Backup & Restore

### Backup

```bash
# Backup configuration
cp backend/data/config.json backend/data/config.json.backup

# Backup database
cp backend/data/database.sqlite backend/data/database.sqlite.backup

# Backup Redis data (if using manual installation)
sudo cp /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.backup

# Backup entire project
tar -czf map-ping-backup-$(date +%Y%m%d).tar.gz .
```

### Restore

```bash
# Stop application
docker compose down
# Or
pm2 stop all

# Restore files
tar -xzf map-ping-backup-YYYYMMDD.tar.gz

# Restart application
docker compose up -d
# Or
pm2 start all
```

---

## 🔒 Security Recommendations

### 1. Firewall Configuration

```bash
# Allow only specific IPs (recommended)
sudo ufw allow from 192.168.1.0/24 to any port 4000
sudo ufw allow from 192.168.1.0/24 to any port 5000

# Or allow specific IP
sudo ufw allow from YOUR_IP_ADDRESS to any port 4000
sudo ufw allow from YOUR_IP_ADDRESS to any port 5000
```

### 2. Nginx Reverse Proxy (Optional)

```bash
# Install Nginx
sudo apt install nginx -y

# Create configuration
sudo nano /etc/nginx/sites-available/map-ping
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/map-ping /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### 4. Redis Security (Manual Installation)

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Set password (uncomment and set):
# requirepass your-strong-password

# Bind to localhost only (for security)
# bind 127.0.0.1

# Restart Redis
sudo systemctl restart redis-server
```

**Note:** If you set a Redis password, update your `.env` file:
```
REDIS_PASSWORD=your-strong-password
```

---

## 📊 Performance Monitoring

### System Stats Endpoint

```bash
# Get system statistics
curl http://localhost:5000/api/system/stats | jq

# This includes:
# - Scheduler statistics (queue size, processed devices)
# - Redis connection status
# - Batch writer statistics
# - WebSocket connections
```

### Resource Monitoring

```bash
# Docker stats
docker stats

# PM2 monitoring
pm2 monit

# System resources
htop
# Or
top

# Disk usage
df -h

# Memory usage
free -h
```

---

## 🗑️ Uninstall

### Docker Uninstall

```bash
# Stop and remove containers
docker compose down

# Remove volumes (⚠️ removes all data)
docker compose down -v

# Remove application directory
cd ..
rm -rf map-ping
```

### Manual Uninstall

```bash
# Stop and remove from PM2
pm2 delete all
pm2 unstartup

# Remove PM2 (optional)
sudo npm uninstall -g pm2

# Stop Redis (if not used elsewhere)
sudo systemctl stop redis-server
sudo systemctl disable redis-server

# Remove application
cd ..
rm -rf map-ping
```

---

## 📚 Quick Reference

### Docker Commands
```bash
docker compose up -d          # Start
docker compose down           # Stop
docker compose restart        # Restart
docker compose logs -f        # Logs
docker compose ps             # Status
```

### PM2 Commands
```bash
pm2 start ecosystem.config.js # Start
pm2 stop all                  # Stop
pm2 restart all               # Restart
pm2 logs                      # Logs
pm2 status                    # Status
pm2 save                      # Save config
```

### Redis Commands
```bash
sudo systemctl start redis-server    # Start
sudo systemctl stop redis-server     # Stop
sudo systemctl restart redis-server  # Restart
redis-cli ping                        # Test
```

### Firewall Commands
```bash
sudo ufw allow 4000/tcp       # Allow frontend
sudo ufw allow 5000/tcp       # Allow backend
sudo ufw status               # Check status
```

---

## 🎯 What's New in v2.0.0

- ✅ **Redis Integration**: Real-time status caching for improved performance
- ✅ **WebSocket Support**: Live updates with 70-80% bandwidth reduction
- ✅ **Queue-Based Scheduler**: Handles 100+ devices efficiently (single timer)
- ✅ **Database Write Batching**: 95% reduction in database writes
- ✅ **Circuit Breaker**: Automatic handling of failing devices
- ✅ **Performance Optimizations**: CPU usage <15% with 100 devices

---

## 📞 Support

If you encounter issues:

1. **Check logs:**
   - Docker: `docker compose logs -f`
   - Manual: `pm2 logs`

2. **Check status:**
   - Docker: `docker compose ps`
   - Manual: `pm2 status`

3. **Check system stats:**
   - `curl http://localhost:5000/api/system/stats`

4. **Verify services:**
   - Redis: `redis-cli ping`
   - Backend: `curl http://localhost:5000/api/status`
   - Frontend: Open `http://localhost:4000` in browser

5. **Check firewall:**
   - `sudo ufw status`

---

**Ready to deploy Map-Ping v2.0.0!** 🚀

For more information, see:
- `README.md` - General documentation
- `DOCKER_README.md` - Docker-specific guide
- `TODO.md` - Development roadmap

