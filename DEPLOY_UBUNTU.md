# Ubuntu Deployment Guide

## Prerequisites

- Ubuntu 20.04 LTS or newer
- Root or sudo access
- Internet connection

## Quick Installation

### Option 1: Automated Installation (Recommended)

```bash
# Download and run the installation script
curl -fsSL https://raw.githubusercontent.com/your-repo/map-ping/main/install-ubuntu.sh | bash

# Or if you have the project locally
chmod +x install-ubuntu.sh
sudo ./install-ubuntu.sh
```

### Option 2: Manual Installation

#### Step 1: Install Node.js and Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Verify installations
node --version  # Should be v18.x or higher
npm --version
pm2 --version
```

#### Step 2: Install Project Dependencies

```bash
# Navigate to project directory
cd /path/to/map-ping

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Return to root
cd ..
```

#### Step 3: Configure Environment

```bash
# Create environment file for frontend
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000
EOF

# Build frontend for production
cd frontend
npm run build
cd ..
```

#### Step 4: Configure PM2

```bash
# Start the application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown (usually copy and run a sudo command)
```

#### Step 5: Configure Firewall

```bash
# Allow HTTP (port 4000)
sudo ufw allow 4000/tcp

# Allow backend API (port 5000) - optional, only if external access needed
sudo ufw allow 5000/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

#### Step 6: Verify Installation

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Test the application
curl http://localhost:4000
```

## Management Commands

### Start/Stop/Restart

```bash
# Start
pm2 start map-ping

# Stop
pm2 stop map-ping

# Restart
pm2 restart map-ping

# Reload (zero-downtime)
pm2 reload map-ping
```

### Monitoring

```bash
# View status
pm2 status

# View logs
pm2 logs map-ping

# View real-time logs
pm2 logs map-ping --lines 50

# Monitor resources
pm2 monit
```

### Maintenance

```bash
# Update application
git pull
cd frontend && npm install && npm run build && cd ..
cd backend && npm install && cd ..
pm2 restart map-ping

# Clear old logs
pm2 flush

# Delete old logs
pm2 flush map-ping
```

## Configuration

### Update Network Configuration

Edit `backend/config.json` to add your network areas, devices, and links:

```bash
sudo nano backend/config.json
```

After editing, restart the service:

```bash
pm2 restart map-ping
```

### Change Ports

Edit `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'map-ping',
    script: './start.sh',
    cwd: '/path/to/map-ping',
    env: {
      NODE_ENV: 'production',
      FRONTEND_PORT: 4000,
      BACKEND_PORT: 5000
    }
  }]
}
```

Then restart:

```bash
pm2 restart map-ping
```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs map-ping --err

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(4000|5000)'

# Check Node.js version
node --version
```

### Database Issues

```bash
# Check database file
ls -lh backend/network.db

# Backup database
cp backend/network.db backend/network.db.backup

# Delete and recreate (will lose history)
rm backend/network.db
pm2 restart map-ping
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /path/to/map-ping

# Fix permissions
chmod +x start.sh stop.sh restart.sh logs.sh
```

### Firewall Issues

```bash
# Check firewall status
sudo ufw status verbose

# Allow specific port
sudo ufw allow 4000/tcp

# Disable firewall (for testing only)
sudo ufw disable
```

## Backup and Restore

### Backup

```bash
# Create backup directory
mkdir -p ~/backups/map-ping

# Backup configuration
cp backend/config.json ~/backups/map-ping/config.json.$(date +%Y%m%d)

# Backup database
cp backend/network.db ~/backups/map-ping/network.db.$(date +%Y%m%d)

# Backup entire project
tar -czf ~/backups/map-ping/map-ping-backup-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='frontend/.next' \
  --exclude='backend/network.db' \
  /path/to/map-ping
```

### Restore

```bash
# Restore configuration
cp ~/backups/map-ping/config.json.20240101 backend/config.json

# Restore database
cp ~/backups/map-ping/network.db.20240101 backend/network.db

# Restore entire project
tar -xzf ~/backups/map-ping/map-ping-backup-20240101.tar.gz -C /path/to/
```

## Security Considerations

1. **Change Default Ports**: Use non-standard ports in production
2. **Use HTTPS**: Set up Nginx reverse proxy with SSL
3. **Restrict API Access**: Don't expose port 5000 publicly
4. **Regular Updates**: Keep Node.js and dependencies updated
5. **Firewall**: Always use UFW or similar
6. **Backups**: Regular automated backups

## Nginx Reverse Proxy (Optional)

For production with HTTPS:

```bash
# Install Nginx
sudo apt install nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/map-ping
```

Add configuration:

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
        proxy_cache_bypass $http_upgrade;
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

## Uninstallation

```bash
# Stop and delete PM2 process
pm2 delete map-ping
pm2 save

# Remove PM2 from startup
pm2 unstartup

# Uninstall PM2
sudo npm uninstall -g pm2

# Remove application files
rm -rf /path/to/map-ping

# Remove firewall rules
sudo ufw delete allow 4000/tcp
```

## Support

For issues and questions:
- Check logs: `pm2 logs map-ping`
- Review configuration: `backend/config.json`
- Check system resources: `pm2 monit`

---

**TechnoHub Network Monitor** - Production Ready! 🚀


