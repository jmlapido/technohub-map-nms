# Deploy Smart API Configuration

## What Was Changed

I've updated the code to make the application work seamlessly in all scenarios:

### 1. Frontend (`frontend/lib/api.ts`)
- ✅ **Smart API URL detection** - Automatically detects backend based on how you access it
- ✅ **Works with Cloudflare** - Uses same domain when accessed via map.jmlapido.com
- ✅ **Works with local IP** - Uses same IP when accessed via 192.168.101.76:4000
- ✅ **Works with localhost** - Uses localhost when accessed locally
- ✅ **Better error handling** - Console logs show exactly what's happening
- ✅ **Request/response interceptors** - For debugging and error tracking

### 2. Backend (`backend/server.js`)
- ✅ **Updated CORS** - Accepts requests from any origin
- ✅ **Request logging** - Logs all incoming requests with timestamp and IP
- ✅ **Better error handling** - More detailed error messages

### 3. New Scripts
- ✅ **`deploy-updates.sh`** - Automated deployment script
- ✅ **`diagnose.sh`** - Comprehensive diagnostic tool
- ✅ **`check-status.sh`** - Quick status check

## How to Deploy

### Step 1: Pull the Changes

On your Ubuntu server:

```bash
cd ~/technohub-map-nms
git pull
```

### Step 2: Rebuild Frontend

```bash
cd frontend
npm run build
cd ..
```

### Step 3: Restart Services

```bash
pm2 restart all
pm2 status
```

### Step 4: Verify

```bash
# Test backend
curl http://localhost:5000/api/status

# Check PM2 status
pm2 status

# View logs
pm2 logs --lines 20
```

## Or Use the Automated Script

```bash
cd ~/technohub-map-nms
chmod +x deploy-updates.sh
./deploy-updates.sh
```

This will:
1. Pull latest changes
2. Install dependencies
3. Rebuild frontend
4. Restart services
5. Show status

## Testing All Access Methods

After deployment, test all three ways to access:

### 1. Via Cloudflare (Domain)
```
https://map.jmlapido.com
```
Open browser console (F12) and you should see:
```
API Request: GET https://map.jmlapido.com/api/status
```

### 2. Via Local IP
```
http://192.168.101.76:4000
```
Browser console should show:
```
API Request: GET http://192.168.101.76:5000/api/status
```

### 3. Via Localhost (on server)
```
http://localhost:4000
```
Browser console should show:
```
API Request: GET http://localhost:5000/api/status
```

## What to Expect

### Before (Old Behavior)
- ❌ Only worked with one access method
- ❌ Had to manually configure backend URL
- ❌ Connection errors when accessing from different methods
- ❌ Hard to debug

### After (New Behavior)
- ✅ Works with all access methods automatically
- ✅ No manual configuration needed
- ✅ No connection errors
- ✅ Easy to debug with console logs

## Troubleshooting

### If you see "Connection Error" after deployment:

1. **Check PM2 status:**
```bash
pm2 status
```
Both services should be "online"

2. **Check backend logs:**
```bash
pm2 logs map-ping-backend --lines 50
```
Should see: "Backend server running on port 5000"

3. **Test backend API:**
```bash
curl http://localhost:5000/api/status
```
Should return JSON data

4. **Check browser console:**
Press F12 in browser and look at Console tab
You should see API requests being made

5. **If still not working, rebuild:**
```bash
cd ~/technohub-map-nms/frontend
rm -rf .next
npm run build
cd ..
pm2 restart all
```

## Cloudflare Tunnel Configuration

Make sure your Cloudflare Tunnel is configured correctly:

### Check if tunnel is running:
```bash
cloudflared tunnel list
```

### Check tunnel config:
```bash
cat /etc/cloudflared/config.yml
```

### Recommended config (single domain):
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: map.jmlapido.com
    path: /api/*
    service: http://localhost:5000
  
  - hostname: map.jmlapido.com
    service: http://localhost:4000
  
  - service: http_status:404
```

### Restart tunnel after config change:
```bash
sudo systemctl restart cloudflared
```

## Benefits

1. **Universal Access** - Works from anywhere (domain, IP, localhost)
2. **Zero Configuration** - No need to set environment variables
3. **Easy Debugging** - Console logs show exactly what's happening
4. **Better Error Messages** - Know exactly why something failed
5. **Future-Proof** - Easy to add more access methods

## Files Modified

- `frontend/lib/api.ts` - Smart API detection
- `backend/server.js` - Improved CORS and logging
- `deploy-updates.sh` - New deployment script
- `diagnose.sh` - Diagnostic tool
- `check-status.sh` - Status checker

## Next Steps

1. Deploy the changes (see instructions above)
2. Test all access methods
3. Check browser console for API requests
4. Verify no connection errors
5. Enjoy seamless access! 🎉

## Support

If you need help:
1. Run `./diagnose.sh` and share output
2. Run `./check-status.sh` and share output
3. Check `pm2 logs --lines 50`
4. Check browser console (F12)

---

**Ready to deploy?** Run the commands in Step 1-4 above, or just run:
```bash
./deploy-updates.sh
```

