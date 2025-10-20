# Ubuntu VM Setup Guide

## Quick Setup

### 1. Transfer Files to Ubuntu VM

From your Windows machine:
```powershell
# Copy the entire project to Ubuntu VM
scp -r map-ping user@your-vm-ip:/home/user/
```

Or use Git:
```bash
# On Ubuntu VM
git clone <your-repo-url>
cd map-ping
```

### 2. Run Setup Script

```bash
# Make scripts executable
chmod +x setup-ubuntu.sh start.sh

# Run setup
./setup-ubuntu.sh
```

This will:
- Install Node.js 20.x
- Install all npm dependencies
- Configure the project

### 3. Start the Application

```bash
./start.sh
```

Or manually:
```bash
npm run dev
```

### 4. Access from Browser

- **Frontend:** `http://your-vm-ip:4000`
- **Backend API:** `http://your-vm-ip:5000/api`

## Manual Setup (if scripts don't work)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm run install:all

# Start application
npm run dev
```

## Running as a Service (Auto-start on boot)

### 1. Create Service File

```bash
# Copy service file
sudo cp map-ping.service /etc/systemd/system/

# Edit the service file
sudo nano /etc/systemd/system/map-ping.service
```

Update these lines:
```
User=your-username
WorkingDirectory=/home/your-username/map-ping
```

### 2. Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable map-ping

# Start service
sudo systemctl start map-ping

# Check status
sudo systemctl status map-ping
```

### 3. View Logs

```bash
# View logs
sudo journalctl -u map-ping -f

# View last 50 lines
sudo journalctl -u map-ping -n 50
```

## Firewall Configuration

If you can't access from outside the VM:

```bash
# Allow ports 4000 and 5000
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp

# Check status
sudo ufw status
```

## Troubleshooting

### Port Already in Use
```bash
# Find what's using the port
sudo lsof -i :4000
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>
```

### Permission Denied for Ping
```bash
# Option 1: Run with sudo
sudo npm run dev

# Option 2: Allow ping without sudo
sudo setcap cap_net_raw+ep $(which node)
```

### Can't Connect from Browser
1. Check firewall: `sudo ufw status`
2. Check if service is running: `sudo systemctl status map-ping`
3. Check VM network settings (bridged/NAT)
4. Try accessing from VM itself: `curl http://localhost:4000`

## Network Configuration

### Find VM IP Address
```bash
ip addr show
# or
hostname -I
```

### Test Backend API
```bash
curl http://localhost:5000/api/status
```

### Test Frontend
```bash
curl http://localhost:4000
```

## Production Tips

1. **Use PM2 for process management:**
```bash
npm install -g pm2
pm2 start npm --name "map-ping" -- run dev
pm2 save
pm2 startup
```

2. **Use Nginx as reverse proxy:**
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

3. **Enable HTTPS with Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Performance Monitoring

```bash
# Check Node.js process
ps aux | grep node

# Check memory usage
free -h

# Check disk usage
df -h

# Check system resources
htop
```

## Backup Configuration

```bash
# Backup config
cp backend/config.json backend/config.json.backup

# Backup database
cp backend/database.sqlite backend/database.sqlite.backup
```

## Update Application

```bash
# Pull latest changes
git pull

# Reinstall dependencies if needed
npm run install:all

# Restart service
sudo systemctl restart map-ping
```

## Useful Commands

```bash
# Check if ports are listening
sudo netstat -tulpn | grep -E ':(4000|5000)'

# Check Node.js version
node --version

# Check npm version
npm --version

# View running processes
ps aux | grep npm

# Kill all Node.js processes
pkill node
```

## Support

If you encounter issues:
1. Check logs: `sudo journalctl -u map-ping -f`
2. Check backend logs in terminal
3. Verify Node.js version (should be 18+)
4. Check firewall settings
5. Verify network connectivity



