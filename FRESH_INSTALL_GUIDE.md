# Fresh Install Guide

## Complete Removal and Fresh Install from GitHub

This guide will help you completely remove the old installation and install fresh from GitHub.

## 🚀 Quick Method (Automated)

### On Your Ubuntu Server:

```bash
# Download the fresh install script
cd ~
wget https://raw.githubusercontent.com/jmlapido/technohub-map-nms/main/fresh-install.sh

# Make it executable
chmod +x fresh-install.sh

# Run it
./fresh-install.sh
```

This will automatically:
1. Stop and remove all PM2 processes
2. Remove the old installation directory
3. Clone fresh from GitHub
4. Run the installation script
5. Start the application

## 📝 Manual Method (Step by Step)

If you prefer to do it manually, follow these steps:

### Step 1: Stop and Remove PM2 Processes

```bash
# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Optional: Kill PM2 daemon
pm2 kill
```

### Step 2: Remove Old Installation

```bash
# Go to the parent directory
cd ~

# Remove the old installation
rm -rf technohub-map-nms
```

### Step 3: Clone Fresh from GitHub

```bash
# Clone the repository
git clone https://github.com/jmlapido/technohub-map-nms.git

# Go into the directory
cd technohub-map-nms
```

### Step 4: Run Installation Script

```bash
# Make the script executable
chmod +x install-ubuntu.sh

# Run the installation
./install-ubuntu.sh
```

### Step 5: Verify Installation

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs --lines 20

# Test backend API
curl http://localhost:5000/api/status
```

## 🔧 Alternative: Keep Data, Fresh Code

If you want to keep your configuration and data but get fresh code:

```bash
cd ~/technohub-map-nms

# Backup your data
cp backend/config.json ~/config-backup.json
cp backend/database.sqlite ~/database-backup.sqlite

# Pull latest code
git fetch origin
git reset --hard origin/main

# Restore your data
cp ~/config-backup.json backend/config.json
cp ~/database-backup.sqlite backend/database.sqlite

# Rebuild and restart
cd frontend
npm install
npm run build
cd ..
pm2 restart all
```

## 🎯 What Gets Removed

When you do a fresh install, the following will be removed:
- ❌ All PM2 processes
- ❌ Node modules
- ❌ Build files
- ❌ Logs
- ❌ Configuration files
- ❌ Database

## ✅ What Gets Installed Fresh

- ✅ Latest code from GitHub
- ✅ All dependencies (npm packages)
- ✅ Fresh configuration (default settings)
- ✅ New database
- ✅ PM2 processes
- ✅ Auto-start on boot

## 🔄 After Fresh Install

### 1. Check Status
```bash
pm2 status
```

### 2. View Logs
```bash
pm2 logs
```

### 3. Access Application
- **Cloudflare:** https://map.jmlapido.com
- **Local IP:** http://YOUR_IP:4000
- **Localhost:** http://localhost:4000

### 4. Restore Your Configuration (if needed)

If you had custom settings, you can restore them:

```bash
# Edit the configuration
cd ~/technohub-map-nms/backend
nano config.json

# Restart to apply changes
pm2 restart map-ping-backend
```

## 🐛 Troubleshooting

### PM2 Won't Stop

```bash
# Force kill PM2
pm2 kill
pkill -f PM2
```

### Directory Won't Delete

```bash
# Check what's using it
lsof +D ~/technohub-map-nms

# Force remove
rm -rf ~/technohub-map-nms
```

### Installation Fails

```bash
# Check Node.js version
node --version

# Update npm
npm install -g npm@latest

# Try again
cd ~/technohub-map-nms
./install-ubuntu.sh
```

### Port Already in Use

```bash
# Find what's using the port
sudo lsof -i :5000
sudo lsof -i :4000

# Kill the process
sudo kill -9 PID
```

## 📊 Comparison

| Method | Pros | Cons |
|--------|------|------|
| **Fresh Install** | Clean slate, latest code, no conflicts | Loses all data and settings |
| **Git Pull** | Keeps data and settings | May have conflicts |
| **Manual Update** | Full control | More steps |

## 🎉 When to Use Fresh Install

Use fresh install when:
- ✅ You have major issues that won't resolve
- ✅ You want to start completely clean
- ✅ You're testing the installation process
- ✅ You want to verify everything works fresh
- ✅ You don't have important custom data

## 💡 Tips

1. **Backup First:** Always backup important data before fresh install
2. **Check GitHub:** Make sure latest code is on GitHub first
3. **Test After:** Always test the application after installation
4. **Keep Logs:** Check logs if something doesn't work
5. **Document Settings:** Write down any custom settings before removing

## 🔗 Quick Links

- **GitHub Repo:** https://github.com/jmlapido/technohub-map-nms
- **Install Script:** `install-ubuntu.sh`
- **Fresh Install Script:** `fresh-install.sh`
- **Deploy Updates:** `deploy-updates.sh`

---

**Ready for fresh install?** Run the automated script or follow the manual steps above!

