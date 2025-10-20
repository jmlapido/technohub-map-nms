# 🚀 Deploy TechnoHub Network Monitor to Ubuntu - NOW!

## ⚡ Quick Deploy (5 Minutes)

### Step 1: Transfer to Ubuntu VM

**From Windows PowerShell:**
```powershell
scp -r C:\Users\Administrator\map-ping user@ubuntu-ip:/home/user/
```

**Replace:**
- `user` with your Ubuntu username
- `ubuntu-ip` with your Ubuntu VM IP address

**Example:**
```powershell
scp -r C:\Users\Administrator\map-ping ubuntu@192.168.1.100:/home/ubuntu/
```

### Step 2: SSH into Ubuntu

```bash
ssh user@ubuntu-ip
```

**Example:**
```bash
ssh ubuntu@192.168.1.100
```

### Step 3: Install & Start

```bash
cd map-ping
chmod +x install-ubuntu.sh
./install-ubuntu.sh
```

**Wait for installation to complete** (2-3 minutes)

### Step 4: Configure Firewall

```bash
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp
sudo ufw status
```

### Step 5: Access Your Application!

Open browser and go to:
```
http://ubuntu-ip:4000
```

**Example:**
```
http://192.168.1.100:4000
```

## ✅ That's It!

Your application is now:
- ✅ Running on Ubuntu
- ✅ Auto-starting on boot
- ✅ Accessible from your network
- ✅ Monitoring your devices

## 🔧 Quick Commands

```bash
pm2 status          # Check if running
pm2 logs            # View logs
pm2 restart all     # Restart
pm2 stop all        # Stop
```

## 🎯 What You Get

### Network Map Page
- 🗺️ Geographic map with your network sites
- 🟢 Green dots for online areas
- 🟡 Yellow dots for degraded areas
- 🔴 Red dots for offline areas
- 📊 Minimalist status panel at bottom
- ⏱️ Offline duration tracking

### Status Page
- 📈 Statistics dashboard
- 📋 Device list by area
- 🎨 Color-coded status
- ⚡ Real-time updates

### Settings Page
- ⚙️ Configure areas (lat/lng)
- 🔧 Add/edit devices (IPs)
- 🔗 Define links between areas
- 📊 Adjust thresholds

## 📱 Mobile-Friendly

Access from your phone:
```
http://ubuntu-ip:4000
```

- ✅ Responsive design
- ✅ Touch-friendly
- ✅ Hamburger menu
- ✅ Optimized for small screens

## 🔄 Auto-Start on Boot

The application **automatically starts** when Ubuntu reboots:
- ✅ No manual intervention needed
- ✅ PM2 manages the process
- ✅ Auto-restart on crashes
- ✅ Logs managed automatically

## 🎨 Features

✅ **Real-time Monitoring** - Updates every 10 seconds  
✅ **Geographic Map** - See your network on a real map  
✅ **Color-coded Status** - Green/Yellow/Red indicators  
✅ **Offline Tracking** - Shows how long devices are down  
✅ **3-Day History** - Track performance over time  
✅ **Mobile-Friendly** - Works on all devices  
✅ **Easy Configuration** - Web-based settings  
✅ **Auto-Start** - Runs on boot  

## 📊 Default Devices

The system comes with sample data for testing:
- **Manila Office** - Router 1 (8.8.8.8)
- **Cebu Office** - Router 2 (1.1.1.1), Router 2a (8.8.4.4)

**Replace these with your actual network devices in Settings!**

## 🆘 Troubleshooting

### Can't Access from Browser
```bash
# Check if running
pm2 status

# Check firewall
sudo ufw status

# Check logs
pm2 logs
```

### Application Not Starting
```bash
# Check logs
pm2 logs

# Check Node.js
node --version

# Restart
pm2 restart all
```

### Ping Not Working
```bash
# Test ping
ping -c 3 8.8.8.8

# Allow ping without sudo
sudo setcap cap_net_raw+ep $(which node)
```

## 📚 Documentation

- **README_UBUNTU.md** - Quick Ubuntu guide
- **UBUNTU_INSTALL.md** - Detailed installation
- **DEPLOYMENT_CHECKLIST.md** - Deployment checklist
- **FINAL_SUMMARY.md** - Complete feature list

## 🎉 Success!

Once deployed, you'll have:
- ✅ Real-time network monitoring
- ✅ Geographic visualization
- ✅ Mobile access
- ✅ Auto-start on boot
- ✅ 3-day history
- ✅ Offline duration tracking

---

**Ready to deploy?** Just follow the 5 steps above! 🚀

**TechnoHub Network Monitor** - Monitor your network like a pro! 🎯

