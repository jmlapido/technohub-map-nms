# Auto-Start on Boot Guide

## Answer: No, it won't auto-start automatically

The `FRESH_INSTALL_UBUNTU.sh` script only installs the application - it does **NOT** set it up to auto-start on system reboot.

## Quick Setup (Recommended)

Run this script to enable auto-start:

```bash
cd ~/map-ping
chmod +x SETUP_AUTO_START.sh
./SETUP_AUTO_START.sh
```

This will:
- ✅ Create a systemd service file
- ✅ Enable the service to start on boot
- ✅ Start the service immediately
- ✅ Show you the status

## Manual Setup

### Step 1: Create Service File

```bash
sudo nano /etc/systemd/system/map-ping.service
```

Paste this (replace `YOUR_USERNAME` with your actual username):

```ini
[Unit]
Description=TechnoHub Network Link Map Monitor
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/map-ping
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Step 2: Enable and Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable map-ping

# Start service now
sudo systemctl start map-ping

# Check status
sudo systemctl status map-ping
```

## Service Management Commands

```bash
# Check if service is running
sudo systemctl status map-ping

# View logs (real-time)
sudo journalctl -u map-ping -f

# View last 100 lines
sudo journalctl -u map-ping -n 100

# Stop service
sudo systemctl stop map-ping

# Start service
sudo systemctl start map-ping

# Restart service
sudo systemctl restart map-ping

# Disable auto-start (but keep service)
sudo systemctl disable map-ping

# Enable auto-start again
sudo systemctl enable map-ping
```

## Verify It's Working

After reboot, check:

```bash
# Check if service is running
sudo systemctl status map-ping

# Check if ports are listening
netstat -tulpn | grep -E ':(4000|5000)'

# Test API
curl http://localhost:5000/api/health

# Test frontend
curl http://localhost:4000
```

## Troubleshooting

### Service fails to start

```bash
# Check logs
sudo journalctl -u map-ping -n 50

# Check if Node.js path is correct
which node
which npm

# Verify working directory exists
ls -la /home/YOUR_USERNAME/map-ping
```

### Service starts but ports not accessible

```bash
# Check firewall
sudo ufw status

# Allow ports
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp
```

### Service won't restart automatically

```bash
# Check if service is enabled
systemctl is-enabled map-ping

# Re-enable if needed
sudo systemctl enable map-ping
```

## Alternative: Using Docker with Auto-Start

If you're using Docker, Docker Compose can auto-start:

```bash
# Create override file
cat > ~/.docker-compose.yml << EOF
version: '3.8'
services:
  map-ping:
    restart: unless-stopped
EOF

# Or use systemd to start Docker Compose
sudo systemctl enable docker
```

Then create a systemd service that runs `docker compose up -d` on boot.

