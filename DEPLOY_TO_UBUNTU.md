# Deploy to Ubuntu VM - Step by Step

## ✅ Windows Test Results

**Status:** All systems operational!
- ✅ Backend API: http://localhost:5000/api - **WORKING**
- ✅ Frontend: http://localhost:4000 - **WORKING**
- ✅ Ping monitoring: Both devices responding (9ms latency)
- ✅ Database: Created and storing data

## 📦 Transfer to Ubuntu VM

### Option 1: Using SCP (from Windows PowerShell)

```powershell
# Navigate to project directory
cd C:\Users\Administrator\map-ping

# Transfer to Ubuntu VM (replace with your VM details)
scp -r . user@your-vm-ip:/home/user/map-ping

# Example:
# scp -r . ubuntu@192.168.1.100:/home/ubuntu/map-ping
```

### Option 2: Using Git (Recommended)

```bash
# On Ubuntu VM
git clone <your-repo-url>
cd map-ping
```

### Option 3: Using WinSCP (GUI Tool)

1. Download WinSCP: https://winscp.net/
2. Connect to your Ubuntu VM
3. Drag and drop the `map-ping` folder

## 🚀 Setup on Ubuntu VM

### Step 1: SSH into Ubuntu VM

```bash
ssh user@your-vm-ip
# Example: ssh ubuntu@192.168.1.100
```

### Step 2: Navigate to Project

```bash
cd map-ping
```

### Step 3: Make Scripts Executable

```bash
chmod +x setup-ubuntu.sh start.sh test.sh
```

### Step 4: Run Setup

```bash
./setup-ubuntu.sh
```

This will:
- ✅ Install Node.js 20.x
- ✅ Install all npm dependencies
- ✅ Configure the project

### Step 5: Test the Setup

```bash
./test.sh
```

Expected output:
```
✓ Node.js installation... v20.x.x
✓ npm installation... 10.x.x
✓ Dependencies... Installed
✓ Ping permissions... Can ping
```

### Step 6: Start the Application

```bash
./start.sh
```

Or manually:
```bash
npm run dev
```

## 🌐 Access from Anywhere

Once running on Ubuntu VM:

### From Windows Browser:
```
http://your-vm-ip:4000
```

### From Ubuntu VM Browser:
```
http://localhost:4000
```

### Test Backend API:
```bash
curl http://your-vm-ip:5000/api/status
```

## 🔧 Configure Firewall (if needed)

```bash
# Allow ports 4000 and 5000
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp

# Check status
sudo ufw status
```

## 🔄 Run as a Service (Auto-start on boot)

### 1. Create Service File

```bash
# Edit the service file
sudo nano /etc/systemd/system/map-ping.service
```

Paste this content:
```ini
[Unit]
Description=Network Link Map Monitor
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/map-ping
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Important:** Replace `YOUR_USERNAME` with your actual username!

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
# View logs in real-time
sudo journalctl -u map-ping -f

# View last 50 lines
sudo journalctl -u map-ping -n 50
```

## 📊 Monitoring Commands

```bash
# Check if services are running
netstat -tulpn | grep -E ':(4000|5000)'

# Check Node.js processes
ps aux | grep node

# Check system resources
htop

# Check disk usage
df -h
```

## 🐛 Troubleshooting

### Can't Connect from Outside VM

```bash
# Check firewall
sudo ufw status

# Allow ports
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp

# Check if service is running
sudo systemctl status map-ping

# Check VM network settings (bridged vs NAT)
```

### Ping Not Working

```bash
# Option 1: Run with sudo
sudo npm run dev

# Option 2: Allow ping without sudo
sudo setcap cap_net_raw+ep $(which node)

# Test ping
ping -c 3 8.8.8.8
```

### Port Already in Use

```bash
# Find what's using the port
sudo lsof -i :4000
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>
```

### Service Won't Start

```bash
# Check logs
sudo journalctl -u map-ping -n 50

# Check permissions
ls -la map-ping/

# Verify Node.js
node --version
npm --version
```

## 🔐 Security Recommendations

### 1. Use Nginx Reverse Proxy

```bash
# Install Nginx
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

### 2. Enable HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Restrict Access (Optional)

```bash
# Only allow specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 4000
sudo ufw allow from 192.168.1.0/24 to any port 5000
```

## 📝 Quick Reference

### Start Application
```bash
./start.sh
# or
npm run dev
```

### Stop Application
```bash
# Press Ctrl+C
# or
pkill node
```

### Restart Service
```bash
sudo systemctl restart map-ping
```

### View Logs
```bash
sudo journalctl -u map-ping -f
```

### Check Status
```bash
./test.sh
```

### Backup Config
```bash
cp backend/config.json backend/config.json.backup
cp backend/database.sqlite backend/database.sqlite.backup
```

## 🎯 Next Steps

1. ✅ Transfer files to Ubuntu VM
2. ✅ Run setup script
3. ✅ Start the application
4. ✅ Access from browser
5. ✅ Configure your network devices
6. ✅ Set up as a service (optional)
7. ✅ Configure firewall
8. ✅ Set up HTTPS (optional)

## 📞 Support

If you encounter issues:
1. Check logs: `sudo journalctl -u map-ping -f`
2. Run test script: `./test.sh`
3. Check firewall: `sudo ufw status`
4. Verify Node.js: `node --version`
5. Check network: `ping -c 3 8.8.8.8`

---

**Ready to deploy!** 🚀

