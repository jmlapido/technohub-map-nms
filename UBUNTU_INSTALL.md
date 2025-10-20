# Ubuntu Installation Guide - TechnoHub Network Monitor

## Quick Install (Recommended)

### Step 1: Transfer Files to Ubuntu

From Windows:
```powershell
scp -r C:\Users\Administrator\map-ping user@ubuntu-ip:/home/user/
```

Or use Git:
```bash
git clone <your-repo-url>
cd map-ping
```

### Step 2: Run Installation Script

```bash
chmod +x install-ubuntu.sh
./install-ubuntu.sh
```

**That's it!** The script will:
- ✅ Install Node.js 20.x
- ✅ Install PM2 (process manager)
- ✅ Install all dependencies
- ✅ Build frontend for production
- ✅ Start the application
- ✅ Configure auto-start on boot

### Step 3: Configure Firewall

```bash
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp
sudo ufw status
```

## Access the Application

```
Frontend: http://your-ubuntu-ip:4000
Backend:  http://your-ubuntu-ip:5000/api
```

## PM2 Management Commands

### Check Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs                    # All logs
pm2 logs map-ping-backend   # Backend only
pm2 logs map-ping-frontend  # Frontend only
```

### Restart Application
```bash
pm2 restart all             # Restart everything
pm2 restart map-ping-backend
pm2 restart map-ping-frontend
```

### Stop Application
```bash
pm2 stop all
```

### Start Application
```bash
pm2 start all
```

### Remove from PM2
```bash
pm2 delete all
```

## Auto-Start on Boot

PM2 is configured to start automatically on boot. To verify:

```bash
# Check PM2 startup
pm2 startup

# Check if services are running
systemctl status pm2-USERNAME
```

## Manual Installation (Alternative)

If you prefer manual installation:

### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Install PM2
```bash
sudo npm install -g pm2
```

### 3. Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 4. Build Frontend
```bash
cd frontend
npm run build
cd ..
```

### 5. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 6. Setup Auto-Start
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs

# Check Node.js version
node --version

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(4000|5000)'
```

### PM2 Not Starting on Boot

```bash
# Re-run startup command
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Save PM2 configuration
pm2 save

# Test reboot
sudo reboot
```

### Can't Access from Browser

```bash
# Check firewall
sudo ufw status

# Allow ports
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp

# Check if application is running
pm2 status

# Check application logs
pm2 logs
```

### Ping Not Working

```bash
# Test ping manually
ping -c 3 8.8.8.8

# Check ping permissions
sudo setcap cap_net_raw+ep $(which node)

# Or run PM2 with sudo (not recommended)
sudo pm2 restart all
```

### View Logs

```bash
# PM2 logs (real-time)
pm2 logs

# Backend logs
tail -f logs/backend-out.log
tail -f logs/backend-error.log

# Frontend logs
tail -f logs/frontend-out.log
tail -f logs/frontend-error.log

# System logs
journalctl -u pm2-$USER -f
```

## Update Application

```bash
# Stop application
pm2 stop all

# Pull latest changes
git pull

# Install new dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Rebuild frontend
cd frontend
npm run build
cd ..

# Restart application
pm2 restart all
pm2 save
```

## Backup & Restore

### Backup
```bash
# Backup configuration
cp backend/config.json backend/config.json.backup

# Backup database
cp backend/database.sqlite backend/database.sqlite.backup

# Backup entire project
tar -czf map-ping-backup-$(date +%Y%m%d).tar.gz .
```

### Restore
```bash
# Stop application
pm2 stop all

# Restore files
tar -xzf map-ping-backup-YYYYMMDD.tar.gz

# Restart application
pm2 restart all
```

## Performance Monitoring

```bash
# PM2 monitoring
pm2 monit

# System resources
htop

# Disk usage
df -h

# Memory usage
free -h
```

## Security Recommendations

### 1. Firewall
```bash
# Allow only specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 4000
sudo ufw allow from 192.168.1.0/24 to any port 5000
```

### 2. Nginx Reverse Proxy (Optional)
```bash
sudo apt install nginx

# Configure
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
        proxy_cache_bypass $http_upgrade;
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
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Uninstall

```bash
# Stop and remove from PM2
pm2 delete all
pm2 unstartup

# Remove PM2
sudo npm uninstall -g pm2

# Remove application
cd ..
rm -rf map-ping
```

## Support

If you encounter issues:
1. Check logs: `pm2 logs`
2. Check status: `pm2 status`
3. Check firewall: `sudo ufw status`
4. Check Node.js: `node --version`
5. Check system resources: `htop`

## Quick Reference

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop all

# Restart
pm2 restart all

# Status
pm2 status

# Logs
pm2 logs

# Save configuration
pm2 save

# Auto-start setup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Firewall
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp

# Access
http://your-ubuntu-ip:4000
```

---

**Ready to deploy!** 🚀

