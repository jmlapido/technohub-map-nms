# TechnoHub Network Monitor - Ubuntu Quick Start

## 🚀 One-Command Installation

```bash
chmod +x install-ubuntu.sh
./install-ubuntu.sh
```

**That's it!** The application will:
- ✅ Install automatically
- ✅ Start running
- ✅ Auto-start on reboot

## 📍 Access Your Application

After installation, access at:
```
http://your-ubuntu-ip:4000
```

## 🔧 Quick Commands

```bash
pm2 status          # Check if running
pm2 logs            # View logs
pm2 restart all     # Restart app
pm2 stop all        # Stop app
```

## 🔥 Firewall Setup

```bash
sudo ufw allow 4000/tcp
sudo ufw allow 5000/tcp
```

## 📚 Full Documentation

See `UBUNTU_INSTALL.md` for detailed instructions.

## 🎯 What You Get

- **Network Map** - Geographic visualization
- **Real-time Monitoring** - Updates every 10 seconds
- **Mobile-Friendly** - Works on all devices
- **Auto-Start** - Runs on boot
- **3-Day History** - Track performance
- **Offline Tracking** - See how long devices are down

## 🆘 Need Help?

```bash
pm2 logs            # Check logs
pm2 status          # Check status
sudo ufw status     # Check firewall
```

---

**TechnoHub Network Monitor** - Real-time network monitoring made simple! 🎉

