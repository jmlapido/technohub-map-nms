# Quick Start - Ubuntu Deployment

## 🚀 5-Minute Setup

### 1. Install Node.js and PM2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Verify
node --version
pm2 --version
```

### 2. Install Application

```bash
# Clone or copy the project to your server
cd /opt  # or your preferred directory
# If using git:
# git clone <your-repo-url> map-ping
# Or copy the files manually

cd map-ping

# Install all dependencies
npm run install:all
```

### 3. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### 4. Start with PM2

```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
# Copy and run the command shown (usually starts with 'sudo env...')
```

### 5. Configure Firewall

```bash
# Allow HTTP access
sudo ufw allow 4000/tcp
sudo ufw enable

# Check status
sudo ufw status
```

## ✅ Verify Installation

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs map-ping

# Test the application
curl http://localhost:4000
```

Open in browser: `http://your-server-ip:4000`

## 🔧 Management Commands

```bash
# Start
pm2 start map-ping

# Stop
pm2 stop map-ping

# Restart
pm2 restart map-ping

# View logs
pm2 logs map-ping

# Monitor
pm2 monit
```

## 📝 Configure Your Network

Edit `backend/config.json` to add your areas, devices, and links:

```bash
nano backend/config.json
```

After editing, restart:

```bash
pm2 restart map-ping
```

## 🔐 Security (Production)

### Option 1: Nginx Reverse Proxy with HTTPS

```bash
# Install Nginx
sudo apt install nginx

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### Option 2: Change Default Ports

Edit `ecosystem.config.js` and change ports:

```javascript
env: {
  NODE_ENV: 'production',
  FRONTEND_PORT: 8080,  // Change from 4000
  BACKEND_PORT: 5000    // Keep or change
}
```

Then restart:

```bash
pm2 restart map-ping
sudo ufw allow 8080/tcp
```

## 📊 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View process info
pm2 info map-ping

# View memory usage
pm2 show map-ping

# Restart if memory exceeds 500MB
pm2 restart map-ping --max-memory-restart 500M
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :4000

# Kill process
sudo kill -9 <PID>
```

### Application Won't Start

```bash
# Check logs
pm2 logs map-ping --err

# Check Node.js version (should be v18+)
node --version

# Reinstall dependencies
rm -rf node_modules frontend/node_modules backend/node_modules
npm run install:all
```

### Can't Access from Browser

```bash
# Check firewall
sudo ufw status

# Allow port
sudo ufw allow 4000/tcp

# Check if service is running
pm2 status

# Check logs
pm2 logs map-ping
```

## 🔄 Updates

```bash
# Pull latest changes
git pull

# Rebuild frontend
cd frontend
npm install
npm run build
cd ..

# Update backend
cd backend
npm install
cd ..

# Restart
pm2 restart map-ping
```

## 📦 Backup

```bash
# Create backup directory
mkdir -p ~/backups/map-ping

# Backup configuration
cp backend/config.json ~/backups/map-ping/config-$(date +%Y%m%d).json

# Backup database
cp backend/network.db ~/backups/map-ping/network-$(date +%Y%m%d).db
```

## 🗑️ Uninstall

```bash
# Stop and remove PM2 process
pm2 delete map-ping
pm2 save

# Remove from startup
pm2 unstartup

# Remove firewall rule
sudo ufw delete allow 4000/tcp

# Delete application (optional)
rm -rf /opt/map-ping
```

## 📞 Support

- **Logs**: `pm2 logs map-ping`
- **Status**: `pm2 status`
- **Monitor**: `pm2 monit`
- **Configuration**: `backend/config.json`

---

**TechnoHub Network Monitor** - Ready in 5 minutes! ⚡


