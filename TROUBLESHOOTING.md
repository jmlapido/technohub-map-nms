# Troubleshooting Connection Error

## Quick Diagnostic Commands

Run these commands on your Ubuntu server to diagnose the connection issue:

### 1. Check PM2 Status
```bash
pm2 status
```
**Expected Output:** Both `map-ping-backend` and `map-ping-frontend` should show "online"

**If not running:**
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 2. Check Backend Logs
```bash
pm2 logs map-ping-backend --lines 50
```
**Look for:** `Backend server running on port 5000`

**Common errors:**
- "Cannot find module" → Run `cd backend && npm install`
- "Port already in use" → Kill the process using port 5000
- "Permission denied" → Check file permissions

### 3. Check Frontend Logs
```bash
pm2 logs map-ping-frontend --lines 50
```
**Look for:** Any startup errors or connection issues

### 4. Test Backend API Directly
```bash
curl http://localhost:5000/api/status
```
**Expected Output:** JSON data with network status

**If this fails:** Backend is not running or not accessible

### 5. Check Ports Are Listening
```bash
sudo netstat -tlnp | grep 5000
sudo netstat -tlnp | grep 4000
```
**Expected Output:** Should show processes listening on these ports

### 6. Check Firewall
```bash
sudo ufw status
```
**If firewall is active and blocking:**
```bash
sudo ufw allow 5000/tcp
sudo ufw allow 4000/tcp
```

### 7. Check if You're Accessing from Another Machine

If you're accessing the frontend from another computer (not the Ubuntu server itself), you need to:

1. **Find your Ubuntu server's IP address:**
```bash
hostname -I
```

2. **Access the frontend using the server's IP:**
```
http://YOUR_SERVER_IP:4000
```

3. **The frontend needs to know the backend URL:**
```bash
cd ~/map-ping/frontend
nano .env.local
```

Add this line (replace with your server's IP):
```
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:5000
```

Or if accessing from the same machine:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

4. **Rebuild and restart:**
```bash
cd ~/map-ping/frontend
npm run build
cd ~/map-ping
pm2 restart all
```

## Common Issues and Solutions

### Issue 1: Backend Not Starting
**Symptoms:** PM2 shows backend as "errored" or "stopped"

**Solution:**
```bash
cd ~/map-ping/backend
npm install
pm2 restart map-ping-backend
pm2 logs map-ping-backend
```

### Issue 2: Frontend Can't Connect to Backend
**Symptoms:** Frontend loads but shows "Connection Error"

**Solution:**
- Check if backend is running: `pm2 status`
- Test backend: `curl http://localhost:5000/api/status`
- If accessing from another machine, set `NEXT_PUBLIC_API_URL` to the server's IP

### Issue 3: Port Already in Use
**Symptoms:** Backend fails to start with "EADDRINUSE" error

**Solution:**
```bash
# Find what's using port 5000
sudo lsof -i :5000
# Kill the process (replace PID with actual process ID)
sudo kill -9 PID
# Restart
pm2 restart map-ping-backend
```

### Issue 4: Permission Denied
**Symptoms:** "EACCES: permission denied" errors

**Solution:**
```bash
# Fix permissions
cd ~/map-ping
sudo chown -R $USER:$USER .
```

### Issue 5: Firewall Blocking
**Symptoms:** Can access locally but not from other machines

**Solution:**
```bash
sudo ufw allow 5000/tcp
sudo ufw allow 4000/tcp
sudo ufw reload
```

## Complete Reset (Last Resort)

If nothing works, do a complete reset:

```bash
cd ~/map-ping

# Stop everything
pm2 stop all
pm2 delete all

# Reinstall dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Rebuild frontend
cd frontend
npm run build
cd ..

# Start fresh
pm2 start ecosystem.config.js
pm2 save

# Check status
pm2 status
pm2 logs
```

## Getting Help

If the issue persists, run the diagnostic script and share the output:

```bash
chmod +x diagnose.sh
./diagnose.sh
```

This will show you exactly what's wrong.

## Quick Test Checklist

- [ ] PM2 shows both services as "online"
- [ ] Backend logs show "Backend server running on port 5000"
- [ ] `curl http://localhost:5000/api/status` returns JSON
- [ ] Ports 5000 and 4000 are listening
- [ ] Firewall allows ports 5000 and 4000
- [ ] Frontend `.env.local` has correct `NEXT_PUBLIC_API_URL`
- [ ] Accessing frontend from browser shows the map (not connection error)

