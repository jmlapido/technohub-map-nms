# Smart API Configuration

## Overview

The application now automatically detects which environment it's running in and connects to the backend accordingly. This means it works seamlessly in all scenarios:

✅ **Cloudflare Tunnel** (map.jmlapido.com)  
✅ **Local IP Access** (192.168.101.76:4000)  
✅ **Localhost Development** (localhost:4000)  

## How It Works

### Frontend (Smart Detection)

The frontend now automatically detects the backend URL based on how you're accessing it:

```typescript
// If accessing via domain (Cloudflare)
https://map.jmlapido.com → Backend: https://map.jmlapido.com

// If accessing via local IP
http://192.168.101.76:4000 → Backend: http://192.168.101.76:5000

// If accessing via localhost
http://localhost:4000 → Backend: http://localhost:5000
```

### Backend (CORS Configuration)

The backend now accepts requests from any origin, so it works regardless of how you access it:

```javascript
// Allows all origins
cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})
```

## Deployment Instructions

### On Your Ubuntu Server:

```bash
cd ~/technohub-map-nms

# Pull the latest changes
git pull

# Rebuild frontend with new smart detection
cd frontend
npm run build
cd ..

# Restart services
pm2 restart all

# Check status
pm2 status
```

### Or use the automated deploy script:

```bash
cd ~/technohub-map-nms
chmod +x deploy-updates.sh
./deploy-updates.sh
```

## Accessing Your Application

After deployment, you can access the application in any of these ways:

### 1. Via Cloudflare Tunnel (Recommended)
```
https://map.jmlapido.com
```

### 2. Via Local IP
```
http://192.168.101.76:4000
```

### 3. Via Localhost (on the server)
```
http://localhost:4000
```

## Troubleshooting

### Check if it's working:

1. **Open browser console** (F12) and look for API requests
2. You should see: `API Request: GET https://map.jmlapido.com/api/status`
3. If you see errors, check the logs:

```bash
pm2 logs --lines 50
```

### Manual Override (if needed):

If you need to manually set the backend URL, create a `.env.local` file:

```bash
cd ~/technohub-map-nms/frontend
nano .env.local
```

Add:
```
NEXT_PUBLIC_API_URL=https://map.jmlapido.com
```

Then rebuild:
```bash
npm run build
cd ..
pm2 restart all
```

## Cloudflare Tunnel Configuration

Make sure your Cloudflare Tunnel is configured to route both frontend and backend:

### Option 1: Single Domain (Recommended)

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Route /api/* to backend
  - hostname: map.jmlapido.com
    path: /api/*
    service: http://localhost:5000
  
  # Route everything else to frontend
  - hostname: map.jmlapido.com
    service: http://localhost:4000
  
  # Catch-all rule (must be last)
  - service: http_status:404
```

### Option 2: Separate Domains

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Backend API
  - hostname: map.jmlapido.com
    service: http://localhost:5000
  
  # Frontend
  - hostname: app.jmlapido.com
    service: http://localhost:4000
  
  # Catch-all
  - service: http_status:404
```

## Benefits

1. **No Configuration Needed** - Works automatically in all scenarios
2. **Easy Testing** - Test locally, deploy to production without changes
3. **Flexible Access** - Access from anywhere (domain, IP, localhost)
4. **Better Debugging** - Console logs show exactly which backend is being used
5. **Future-Proof** - Easy to add more access methods

## Testing

Test all three access methods:

```bash
# Test backend API directly
curl http://localhost:5000/api/status

# Test via Cloudflare
curl https://map.jmlapido.com/api/status

# Test via local IP
curl http://192.168.101.76:5000/api/status
```

All should return the same JSON data.

## Support

If you encounter issues:

1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs --lines 50`
3. Test backend: `curl http://localhost:5000/api/status`
4. Check browser console for API errors
5. Verify Cloudflare Tunnel is running: `cloudflared tunnel list`

