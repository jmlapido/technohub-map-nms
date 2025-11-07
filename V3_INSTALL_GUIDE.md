# Map-Ping Version 3.0 - Installation & Management Guide

**Complete Guide for Installing, Configuring, and Managing the Hybrid Monitoring System**

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Fresh Installation](#fresh-installation)
4. [Upgrading from V2](#upgrading-from-v2)
5. [Configuration](#configuration)
6. [Managing with GitHub](#managing-with-github)
7. [Troubleshooting](#troubleshooting)
8. [Performance Tuning](#performance-tuning)
9. [Backup & Recovery](#backup--recovery)

---

## 🎯 Overview

### What's New in V3.0?

**Major Changes:**
- ✅ **Telegraf Integration** - Enterprise-grade data collection
- ✅ **fping Support** - More reliable ICMP monitoring
- ✅ **SNMP Monitoring** - Interface status, speed, and error tracking
- ✅ **Flapping Detection** - Identify unstable connections
- ✅ **Redis Pub/Sub** - Real-time synchronization (fixes race conditions)
- ✅ **Dynamic Config** - Telegraf auto-updates when you add/remove devices
- ✅ **Optional Prometheus** - Advanced analytics and alerting

**Architecture:**
```
Devices (ICMP + SNMP)
    ↓
Telegraf (fping + SNMP plugins)
    ↓
Your Backend (Node.js)
    ↓
Redis (Real-time) + SQLite (Historical)
    ↓
WebSocket → Frontend (Real-time UI)
    ↓
Optional: Prometheus + Grafana
```

---

## 💻 System Requirements

### Minimum Requirements
- **OS:** Ubuntu 20.04+ / Debian 11+
- **RAM:** 2GB (4GB recommended)
- **CPU:** 2 cores
- **Disk:** 10GB free space
- **Network:** Static IP or Cloudflare Tunnel

### Software Dependencies
- **Node.js:** 18.x or 20.x
- **Redis:** 6.x or 7.x
- **Telegraf:** 1.28+ (auto-installed)
- **fping:** 4.0+ (auto-installed)
- **SQLite:** 3.x (included)

### Optional (Advanced Features)
- **Prometheus:** 2.40+
- **Grafana:** 9.0+
- **InfluxDB:** 2.x (alternative to SQLite)

---

## 🚀 Fresh Installation

### Step 1: Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl wget build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x
npm --version   # Should be 10.x
```

### Step 2: Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf

# In the Redis config file, find and modify these settings:
# (Remove any # at the start of these lines to uncomment them)
#
# 1. Change: # supervised no
#    To:     supervised systemd
#
# 2. Ensure this line is uncommented (no # at the start):
#    bind 127.0.0.1
#
# 3. Add or uncomment (remove # if present):
#    maxmemory 256mb
#
# 4. Add or uncomment (remove # if present):
#    maxmemory-policy allkeys-lru
#
# Save and exit: Ctrl+X, then Y, then Enter

# Restart Redis
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Test Redis
redis-cli ping  # Should return "PONG"
```

### Step 3: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/map-ping
sudo chown $USER:$USER /opt/map-ping
cd /opt/map-ping

# Clone from GitHub
git clone https://github.com/YOUR_USERNAME/map-ping.git .

# Or if already cloned, pull latest
git pull origin main
```

### Step 4: Install Application Dependencies

```bash
# Install root dependencies (concurrently, etc.)
cd /opt/map-ping
npm install

# Install backend dependencies
cd /opt/map-ping/backend
npm install

# Install frontend dependencies
cd /opt/map-ping/frontend
npm install

# Build frontend
npm run build
```

### Step 5: Install Telegraf & fping

```bash
# Run automated installer
cd /opt/map-ping
sudo bash backend/install-telegraf.sh

# Or manual installation:
# Add InfluxData repository
wget -q https://repos.influxdata.com/influxdata-archive_compat.key
echo '23a1c8836f0afc5ed24e0486339d7cc8f6790b83886c4c96995b88a061c5bb5d influxdata-archive_compat.key' | sha256sum -c && cat influxdata-archive_compat.key | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null
echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | sudo tee /etc/apt/sources.list.d/influxdata.list

# Install Telegraf and fping
sudo apt update
sudo apt install -y telegraf fping

# Verify installation
telegraf version
fping -v
```

### Step 6: Configure Permissions

```bash
# Run permission setup script
sudo bash backend/setup-permissions.sh

# Or manually:
# Create sudoers file for map-ping
sudo tee /etc/sudoers.d/map-ping <<EOF
# Allow map-ping backend to reload Telegraf
$USER ALL=(ALL) NOPASSWD: /bin/cp /opt/map-ping/backend/data/telegraf.conf.tmp /etc/telegraf/telegraf.conf
$USER ALL=(ALL) NOPASSWD: /bin/systemctl reload telegraf
$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart telegraf
$USER ALL=(ALL) NOPASSWD: /bin/systemctl status telegraf
EOF

# Set permissions
sudo chmod 0440 /etc/sudoers.d/map-ping

# Verify sudoers syntax
sudo visudo -c
```

### Step 7: Configure Environment

```bash
# Create .env file
cd /opt/map-ping/backend
cat > .env << EOF
# Backend Configuration
BACKEND_PORT=5000
NODE_ENV=production

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database Configuration
DB_PATH=/opt/map-ping/backend/data/database.sqlite

# Security
SESSION_SECRET=$(openssl rand -hex 32)
DEFAULT_PASSWORD=admin123

# Telegraf Integration
TELEGRAF_CONFIG_PATH=/etc/telegraf/telegraf.conf
TELEGRAF_ENABLED=true

# Optional: Prometheus
PROMETHEUS_ENABLED=false
PROMETHEUS_PORT=9090
EOF

# Frontend configuration
cd /opt/map-ping/frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000
EOF
```

### Step 8: Initialize Database

```bash
cd /opt/map-ping/backend

# Initialize database schema
node -e "
const db = require('./database');
db.initDatabase().then(() => {
  console.log('Database initialized successfully');
  process.exit(0);
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
"
```

### Step 9: Generate Initial Telegraf Config

```bash
cd /opt/map-ping/backend

# Generate initial config
node -e "
const { updateTelegrafConfig } = require('./telegraf-manager');
const config = require('./data/config.json');
updateTelegrafConfig(config).then(result => {
  if (result.success) {
    console.log('Telegraf configuration generated');
  } else {
    console.error('Failed:', result.error);
  }
  process.exit(result.success ? 0 : 1);
});
"

# Start Telegraf
sudo systemctl enable telegraf
sudo systemctl start telegraf

# Check status
sudo systemctl status telegraf
```

### Step 10: Set Up Systemd Services

```bash
# Backend service
sudo tee /etc/systemd/system/map-ping-backend.service <<EOF
[Unit]
Description=Map-Ping Backend API
After=network.target redis-server.service telegraf.service
Wants=redis-server.service telegraf.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/map-ping/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
sudo tee /etc/systemd/system/map-ping-frontend.service <<EOF
[Unit]
Description=Map-Ping Frontend
After=network.target map-ping-backend.service
Requires=map-ping-backend.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/map-ping/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable map-ping-backend map-ping-frontend
sudo systemctl start map-ping-backend map-ping-frontend

# Check status
sudo systemctl status map-ping-backend
sudo systemctl status map-ping-frontend
```

### Step 11: Configure Firewall

```bash
# Allow necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Frontend (if not using reverse proxy)
sudo ufw allow 5000/tcp  # Backend API

# Enable firewall
sudo ufw enable
sudo ufw status
```

### Step 12: Set Up Cloudflare Tunnel (Optional)

```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create map-ping

# Configure tunnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: map-ping
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Run tunnel as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## 🔄 Upgrading from V2

### Pre-Upgrade Checklist

- [ ] Backup database: `backend/data/database.sqlite`
- [ ] Backup config: `backend/data/config.json`
- [ ] Note Redis status
- [ ] Document current devices
- [ ] Backup entire directory

### Upgrade Steps

```bash
# 1. Stop services
sudo systemctl stop map-ping-backend map-ping-frontend

# 2. Backup
cd /opt/map-ping
tar -czf backup-v2-$(date +%Y%m%d-%H%M%S).tar.gz backend/data/

# 3. Pull V3 code
git fetch origin
git checkout v3.0
git pull origin v3.0

# 4. Install new dependencies
cd backend && npm install
cd ../frontend && npm install && npm run build

# 5. Run database migration
cd /opt/map-ping/backend
node migrations/v2-to-v3.js

# 6. Install Telegraf
sudo bash install-telegraf.sh

# 7. Set up permissions
sudo bash setup-permissions.sh

# 8. Generate Telegraf config from existing devices
node -e "
const { updateTelegrafConfig } = require('./telegraf-manager');
const config = require('./data/config.json');
updateTelegrafConfig(config);
"

# 9. Restart services
sudo systemctl start map-ping-backend map-ping-frontend

# 10. Verify
curl http://localhost:5000/api/monitoring/status
```

### Rollback (if needed)

```bash
# Stop services
sudo systemctl stop map-ping-backend map-ping-frontend

# Restore backup
cd /opt/map-ping
tar -xzf backup-v2-TIMESTAMP.tar.gz

# Checkout V2
git checkout v2.x

# Restart
sudo systemctl start map-ping-backend map-ping-frontend
```

---

## ⚙️ Configuration

### Adding SNMP-Enabled Devices

1. **Enable SNMP on Device** (LiteBeam example):
   ```
   SSH into device:
   ssh ubnt@192.168.1.10
   
   Enable SNMP:
   set service snmp community public authorization ro
   set service snmp community public network 192.168.1.0/24
   commit
   save
   ```

2. **Add Device via UI**:
   - Go to Settings → Add Device
   - Fill in device details
   - ☑️ Enable SNMP
   - Community: `public`
   - Version: `2c`
   - Save

3. **Verify**:
   - Check Telegraf config: `sudo cat /etc/telegraf/telegraf.conf`
   - Check Telegraf logs: `sudo journalctl -u telegraf -f`
   - Check interface status in UI

### Configuring Flapping Detection

```bash
# Edit backend/data/config.json
{
  "settings": {
    "flappingDetection": {
      "enabled": true,
      "windowMinutes": 10,
      "changeThreshold": 5,
      "minSpeedChange": 10  // Mbps
    }
  }
}
```

---

## 🔄 Managing with GitHub

### Deploying Updates from GitHub

```bash
#!/bin/bash
# deploy-update.sh

set -e

echo "🚀 Deploying Map-Ping updates from GitHub..."

# Navigate to app directory
cd /opt/map-ping

# Backup current state
echo "📦 Creating backup..."
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz backend/data/

# Stop services
echo "⏸️  Stopping services..."
sudo systemctl stop map-ping-backend map-ping-frontend

# Pull latest code
echo "📥 Pulling latest code..."
git fetch origin
git pull origin main

# Update dependencies
echo "📦 Installing dependencies..."
cd backend && npm install
cd ../frontend && npm install

# Rebuild frontend
echo "🏗️  Building frontend..."
cd /opt/map-ping/frontend
npm run build

# Run database migrations
echo "🗄️  Running migrations..."
cd /opt/map-ping/backend
if [ -f "migrations/migrate.js" ]; then
  node migrations/migrate.js
fi

# Update Telegraf config
echo "📡 Updating Telegraf configuration..."
node -e "
const { updateTelegrafConfig } = require('./telegraf-manager');
const config = require('./data/config.json');
updateTelegrafConfig(config).then(() => process.exit(0));
"

# Restart services
echo "▶️  Starting services..."
sudo systemctl start map-ping-backend map-ping-frontend

# Wait for services to start
sleep 5

# Health check
echo "🏥 Running health check..."
if curl -f http://localhost:5000/api/monitoring/status > /dev/null 2>&1; then
  echo "✅ Deployment successful!"
else
  echo "❌ Deployment failed! Check logs:"
  echo "   sudo journalctl -u map-ping-backend -n 50"
  exit 1
fi

echo "✨ Done! Version: $(git describe --tags)"
```

### Make Deploy Script Executable

```bash
chmod +x deploy-update.sh
```

### Automated GitHub Webhook (Optional)

```bash
# Install webhook listener
npm install -g webhook

# Create webhook config
cat > /opt/map-ping/webhook.json <<EOF
[
  {
    "id": "deploy-map-ping",
    "execute-command": "/opt/map-ping/deploy-update.sh",
    "command-working-directory": "/opt/map-ping",
    "response-message": "Deploying updates...",
    "trigger-rule": {
      "match": {
        "type": "payload-hash-sha1",
        "secret": "YOUR_GITHUB_SECRET",
        "parameter": {
          "source": "header",
          "name": "X-Hub-Signature"
        }
      }
    }
  }
]
EOF

# Run webhook listener
webhook -hooks webhook.json -verbose -port 9000
```

---

## 🔧 Troubleshooting

### Telegraf Not Receiving Data

**Symptoms:**
- No device status updates
- Telegraf running but no metrics

**Solutions:**

```bash
# 1. Check Telegraf status
sudo systemctl status telegraf

# 2. Test Telegraf config
sudo telegraf --config /etc/telegraf/telegraf.conf --test

# 3. Check Telegraf logs
sudo journalctl -u telegraf -f

# 4. Verify fping works
fping -c 3 8.8.8.8

# 5. Test backend endpoint
curl -X POST http://localhost:5000/api/telegraf/ping \
  -H "Content-Type: application/json" \
  -d '[{"name":"ping","tags":{},"fields":{"average_response_ms":10},"timestamp":1234567890}]'

# 6. Regenerate config
cd /opt/map-ping/backend
node -e "
const { updateTelegrafConfig } = require('./telegraf-manager');
const config = require('./data/config.json');
updateTelegrafConfig(config);
"
```

### SNMP Not Working

**Symptoms:**
- No interface data
- SNMP devices show no status

**Solutions:**

```bash
# 1. Test SNMP manually
snmpwalk -v 2c -c public 192.168.1.10 IF-MIB::ifTable

# 2. Check device SNMP is enabled
ssh ubnt@192.168.1.10
show service snmp

# 3. Check Telegraf SNMP config
sudo cat /etc/telegraf/telegraf.conf | grep -A 20 "inputs.snmp"

# 4. Test from Telegraf
sudo telegraf --config /etc/telegraf/telegraf.conf --input-filter snmp --test

# 5. Check firewall allows SNMP (UDP 161)
sudo ufw allow from 192.168.1.0/24 to any port 161 proto udp
```

### Redis Connection Issues

**Symptoms:**
- "Redis connection failed" errors
- Slow UI updates

**Solutions:**

```bash
# 1. Check Redis status
sudo systemctl status redis-server

# 2. Test Redis connection
redis-cli ping

# 3. Check Redis config
sudo nano /etc/redis/redis.conf
# Ensure: bind 127.0.0.1

# 4. Check backend connection
cd /opt/map-ping/backend
node -e "
const { getRedisManager } = require('./cache/RedisManager');
const redis = getRedisManager();
redis.connect().then(() => {
  console.log('Redis connected!');
  process.exit(0);
}).catch(err => {
  console.error('Redis failed:', err);
  process.exit(1);
});
"

# 5. Restart Redis
sudo systemctl restart redis-server
```

### Permission Denied Errors

**Symptoms:**
- "EACCES: permission denied" when updating Telegraf config

**Solutions:**

```bash
# 1. Check sudoers file exists
sudo cat /etc/sudoers.d/map-ping

# 2. Verify syntax
sudo visudo -c

# 3. Test sudo command
sudo cp /opt/map-ping/backend/data/telegraf.conf.tmp /etc/telegraf/telegraf.conf

# 4. Re-run permission setup
cd /opt/map-ping
sudo bash backend/setup-permissions.sh

# 5. Check file ownership
ls -la /etc/telegraf/telegraf.conf
# Should be: root:root
```

### Database Corruption

**Symptoms:**
- "database disk image is malformed"
- SQLite errors in logs

**Solutions:**

```bash
# 1. Stop backend
sudo systemctl stop map-ping-backend

# 2. Backup corrupted database
cp /opt/map-ping/backend/data/database.sqlite /tmp/database-corrupted-$(date +%s).sqlite

# 3. Try to repair
cd /opt/map-ping/backend/data
sqlite3 database.sqlite "PRAGMA integrity_check;"

# 4. If repair fails, restore from backup
cp backup-TIMESTAMP/database.sqlite database.sqlite

# 5. Or reset (loses history)
rm database.sqlite
cd /opt/map-ping/backend
node -e "const db = require('./database'); db.initDatabase();"

# 6. Restart backend
sudo systemctl start map-ping-backend
```

### High Memory Usage

**Symptoms:**
- System running out of memory
- OOM killer terminating processes

**Solutions:**

```bash
# 1. Check memory usage
free -h
htop

# 2. Check which service is using memory
sudo systemctl status map-ping-backend | grep Memory
sudo systemctl status telegraf | grep Memory

# 3. Configure Redis memory limit
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

# 4. Limit Node.js memory
sudo nano /etc/systemd/system/map-ping-backend.service
# Add: Environment=NODE_OPTIONS="--max-old-space-size=1024"

# 5. Clean old data
cd /opt/map-ping/backend
node -e "const db = require('./database'); db.cleanupOldData();"

# 6. Restart services
sudo systemctl daemon-reload
sudo systemctl restart map-ping-backend redis-server
```

---

## 🚀 Performance Tuning

### For 100-500 Devices

```toml
# /etc/telegraf/telegraf.conf
[agent]
  interval = "30s"
  flush_interval = "10s"
  metric_batch_size = 1000
  metric_buffer_limit = 10000
```

```bash
# Redis tuning
sudo nano /etc/redis/redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### For 500-1000 Devices

```toml
# /etc/telegraf/telegraf.conf
[agent]
  interval = "60s"
  flush_interval = "15s"
  metric_batch_size = 2000
  metric_buffer_limit = 20000
```

```bash
# Redis tuning
sudo nano /etc/redis/redis.conf
maxmemory 1gb
maxmemory-policy allkeys-lru

# Increase system limits
sudo nano /etc/systemd/system/map-ping-backend.service
[Service]
LimitNOFILE=65536
Environment=NODE_OPTIONS="--max-old-space-size=2048"
```

### For 1000+ Devices

Consider:
- Multiple Telegraf instances
- Prometheus for long-term storage
- Load balancer for backend
- Redis cluster
- Database sharding

---

## 💾 Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/map-ping"
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR

# Create backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

tar -czf $BACKUP_FILE \
  /opt/map-ping/backend/data/ \
  /etc/telegraf/telegraf.conf \
  /opt/map-ping/backend/.env

echo "✅ Backup created: $BACKUP_FILE"

# Delete old backups
find $BACKUP_DIR -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "🗑️  Cleaned backups older than $RETENTION_DAYS days"
```

### Schedule Daily Backups

```bash
# Add to crontab
crontab -e

# Add line:
0 2 * * * /opt/map-ping/backup.sh >> /var/log/map-ping-backup.log 2>&1
```

### Restore from Backup

```bash
# Stop services
sudo systemctl stop map-ping-backend map-ping-frontend

# Extract backup
tar -xzf backup-TIMESTAMP.tar.gz -C /

# Restart services
sudo systemctl start map-ping-backend map-ping-frontend
```

---

## 📞 Support & Resources

**Documentation:**
- Main README: `/opt/map-ping/README.md`
- API Docs: `/opt/map-ping/docs/API.md`
- Architecture: `/opt/map-ping/docs/ARCHITECTURE.md`

**Logs:**
- Backend: `sudo journalctl -u map-ping-backend -f`
- Frontend: `sudo journalctl -u map-ping-frontend -f`
- Telegraf: `sudo journalctl -u telegraf -f`
- Redis: `sudo journalctl -u redis-server -f`

**Configuration Files:**
- App Config: `/opt/map-ping/backend/data/config.json`
- Telegraf Config: `/etc/telegraf/telegraf.conf`
- Redis Config: `/etc/redis/redis.conf`
- Systemd Services: `/etc/systemd/system/map-ping-*.service`

**Useful Commands:**
```bash
# Service status
sudo systemctl status map-ping-backend telegraf redis-server

# View all logs
sudo journalctl -u map-ping-backend -u telegraf -f

# Test connectivity
curl http://localhost:5000/api/monitoring/status

# Reload Telegraf config
sudo systemctl reload telegraf

# Check database
sqlite3 /opt/map-ping/backend/data/database.sqlite ".tables"
```

---

**Version:** 3.0.0  
**Last Updated:** 2024-11-07  
**Maintained By:** Map-Ping Development Team

