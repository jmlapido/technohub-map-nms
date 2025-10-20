# Quick Reference - Network Monitor

## 🚀 Quick Commands

### Check Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs --lines 50
pm2 logs map-ping-backend
pm2 logs map-ping-frontend
```

### Restart Services
```bash
pm2 restart all
pm2 restart map-ping-backend
pm2 restart map-ping-frontend
```

### Stop Services
```bash
pm2 stop all
```

### Start Services
```bash
pm2 start ecosystem.config.js
```

## 🌐 Access URLs

| Method | Frontend | Backend API |
|--------|----------|-------------|
| **Cloudflare** | https://map.jmlapido.com | https://map.jmlapido.com/api |
| **Local IP** | http://192.168.101.76:4000 | http://192.168.101.76:5000/api |
| **Localhost** | http://localhost:4000 | http://localhost:5000/api |

## 🔧 Common Tasks

### Deploy Updates
```bash
cd ~/technohub-map-nms
./deploy-updates.sh
```

### Test Backend
```bash
curl http://localhost:5000/api/status
```

### Check Ports
```bash
ss -tlnp | grep 5000
ss -tlnp | grep 4000
```

### Check Firewall
```bash
sudo ufw status
sudo ufw allow 5000/tcp
sudo ufw allow 4000/tcp
```

## 🐛 Troubleshooting

### Backend Not Responding
```bash
pm2 restart map-ping-backend
pm2 logs map-ping-backend --lines 50
```

### Frontend Connection Error
1. Check backend is running: `pm2 status`
2. Test backend: `curl http://localhost:5000/api/status`
3. Check browser console (F12)
4. Rebuild frontend: `cd frontend && npm run build && cd .. && pm2 restart all`

### Services Not Starting
```bash
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

### Complete Reset
```bash
cd ~/technohub-map-nms
pm2 stop all
pm2 delete all
npm install
cd backend && npm install && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

## 📊 Monitoring

### Real-time Logs
```bash
pm2 logs --lines 100
```

### System Resources
```bash
pm2 monit
```

### Process Info
```bash
pm2 info map-ping-backend
pm2 info map-ping-frontend
```

## 🔐 Cloudflare Tunnel

### Check Tunnel Status
```bash
cloudflared tunnel list
ps aux | grep cloudflared
```

### Restart Tunnel
```bash
sudo systemctl restart cloudflared
```

### View Tunnel Logs
```bash
sudo journalctl -u cloudflared -f
```

## 📝 Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Backend Config | `backend/config.json` | Network devices & settings |
| PM2 Config | `ecosystem.config.js` | Process management |
| Cloudflare Config | `/etc/cloudflared/config.yml` | Tunnel routing |

## 🆘 Emergency Commands

### Everything is broken!
```bash
cd ~/technohub-map-nms
pm2 stop all
pm2 delete all
pm2 kill
pm2 resurrect
pm2 start ecosystem.config.js
pm2 save
```

### Database issues
```bash
cd ~/technohub-map-nms/backend
rm database.sqlite
pm2 restart map-ping-backend
```

### Port conflicts
```bash
# Find process using port 5000
sudo lsof -i :5000
# Kill it
sudo kill -9 PID
```

## 📞 Getting Help

1. Run diagnostic: `./diagnose.sh`
2. Check status: `./check-status.sh`
3. View logs: `pm2 logs --lines 50`
4. Test API: `curl http://localhost:5000/api/status`

---

**Server IP:** 192.168.101.76  
**Domain:** map.jmlapido.com  
**Backend Port:** 5000  
**Frontend Port:** 4000

