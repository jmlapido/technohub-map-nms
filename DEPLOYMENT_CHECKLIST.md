# Deployment Checklist - TechnoHub Network Monitor

## Pre-Deployment

- [ ] Application tested on Windows
- [ ] All features working correctly
- [ ] No syntax errors
- [ ] Backend API responding
- [ ] Frontend loading properly
- [ ] Mobile responsive
- [ ] Ping monitoring working

## Ubuntu Server Setup

### 1. Server Requirements
- [ ] Ubuntu 20.04+ installed
- [ ] User account created
- [ ] SSH access configured
- [ ] Firewall configured (UFW)
- [ ] Internet connection available

### 2. Transfer Files
- [ ] Files transferred to Ubuntu VM
  - Option A: SCP from Windows
  - Option B: Git clone
  - Option C: WinSCP GUI

### 3. Installation
- [ ] SSH into Ubuntu VM
- [ ] Navigate to project directory
- [ ] Run `chmod +x install-ubuntu.sh`
- [ ] Run `./install-ubuntu.sh`
- [ ] Installation completed successfully

### 4. Verify Installation
- [ ] Node.js installed (v20.x)
- [ ] PM2 installed
- [ ] Dependencies installed
- [ ] Frontend built successfully
- [ ] Backend running
- [ ] Frontend running

### 5. Configure Firewall
- [ ] Port 4000 allowed (frontend)
- [ ] Port 5000 allowed (backend)
- [ ] Firewall rules verified

### 6. Test Application
- [ ] Frontend accessible from browser
- [ ] Backend API responding
- [ ] Map loading correctly
- [ ] Ping monitoring working
- [ ] Status panel showing data
- [ ] Mobile view working

### 7. Auto-Start Configuration
- [ ] PM2 startup configured
- [ ] PM2 save executed
- [ ] Reboot test completed
- [ ] Application starts automatically

## Post-Deployment

### 8. Security
- [ ] Firewall configured
- [ ] Only necessary ports open
- [ ] Strong passwords set
- [ ] SSH keys configured (optional)
- [ ] Regular updates scheduled

### 9. Monitoring
- [ ] Logs accessible
- [ ] PM2 monitoring working
- [ ] Alert notifications set up (optional)
- [ ] Backup strategy in place

### 10. Documentation
- [ ] Access URLs documented
- [ ] Credentials stored securely
- [ ] Team members informed
- [ ] Support contacts available

## Testing Checklist

### Functionality Tests
- [ ] Network map displays correctly
- [ ] Area markers show on map
- [ ] Links between areas visible
- [ ] Status panel shows at bottom
- [ ] Area details panel works
- [ ] Close button works
- [ ] Status page accessible
- [ ] Settings page accessible

### Device Monitoring Tests
- [ ] Devices being pinged
- [ ] Status updates every 10 seconds
- [ ] Online devices show green
- [ ] Offline devices show red
- [ ] Degraded devices show yellow
- [ ] Offline duration tracked
- [ ] 3-day history stored

### UI/UX Tests
- [ ] Mobile responsive
- [ ] Hamburger menu works
- [ ] Sidebar navigation works
- [ ] Touch interactions work
- [ ] All pages load correctly
- [ ] No console errors

### Performance Tests
- [ ] Page load time < 2s
- [ ] API response time < 100ms
- [ ] Smooth animations
- [ ] No memory leaks
- [ ] Handles multiple users

## Troubleshooting Guide

### Application Won't Start
```bash
pm2 status
pm2 logs
node --version
```

### Can't Access from Browser
```bash
sudo ufw status
pm2 status
curl http://localhost:4000
```

### Ping Not Working
```bash
ping -c 3 8.8.8.8
sudo setcap cap_net_raw+ep $(which node)
```

### High Memory Usage
```bash
pm2 monit
free -h
htop
```

## Maintenance

### Daily
- [ ] Check application status
- [ ] Review error logs
- [ ] Monitor device status

### Weekly
- [ ] Review performance metrics
- [ ] Check disk space
- [ ] Verify backups

### Monthly
- [ ] Update dependencies
- [ ] Security patches
- [ ] Review logs
- [ ] Test disaster recovery

## Backup Strategy

### Files to Backup
- [ ] backend/config.json
- [ ] backend/database.sqlite
- [ ] ecosystem.config.js
- [ ] Entire project directory

### Backup Frequency
- [ ] Daily: Database
- [ ] Weekly: Configuration
- [ ] Monthly: Full backup

### Backup Storage
- [ ] Local backup
- [ ] Remote backup (optional)
- [ ] Cloud backup (optional)

## Success Criteria

✅ **Deployment is successful when:**
- Application accessible from network
- All devices being monitored
- Status updates in real-time
- Auto-starts on reboot
- No errors in logs
- Mobile-friendly
- Fast performance

---

**Ready to deploy!** 🚀



