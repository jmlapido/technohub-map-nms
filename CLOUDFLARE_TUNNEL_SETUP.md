# Cloudflare Tunnel Setup for Map-Ping

This guide shows you how to configure Cloudflare Tunnel to properly route traffic to your Map-Ping application running in Docker.

## Architecture Overview

```
Internet → Cloudflare → Cloudflare Tunnel → Ubuntu Container → Docker Container
                                                              ├─ Frontend (port 4000)
                                                              └─ Backend (port 5000)
```

## Prerequisites

- Cloudflare account with domain `jmlapido.com`
- Ubuntu container on Proxmox
- Docker and Docker Compose installed
- Cloudflared installed in Ubuntu container

## Step 1: Install Cloudflared (if not already installed)

```bash
# Download and install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

## Step 2: Authenticate Cloudflared

```bash
# Login to Cloudflare
cloudflared tunnel login
```

This will open a browser window. Select your domain (`jmlapido.com`).

## Step 3: Create a Tunnel

```bash
# Create a new tunnel
cloudflared tunnel create map-ping

# This will output a tunnel ID, save it for later
```

## Step 4: Configure the Tunnel

Create configuration file:

```bash
sudo nano /etc/cloudflared/config.yml
```

Add this configuration:

```yaml
tunnel: map-ping
credentials-file: /root/.cloudflared/<tunnel-id>.json

# Performance and stability settings for better connection handling
originRequest:
  # Increase timeouts for better stability
  connectTimeout: 30s
  tlsTimeout: 10s
  tcpKeepAlive: 30s
  keepAliveConnections: 10
  keepAliveTimeout: 90s
  
  # Disable compression for API calls (can cause issues)
  disableChunkedEncoding: false
  
  # Add custom headers
  httpHostHeader: map.jmlapido.com
  originServerName: map.jmlapido.com

ingress:
  # API routes with specific settings for stability
  - hostname: map.jmlapido.com
    path: /api/*
    service: http://localhost:5000
    originRequest:
      # API-specific settings for frequent polling
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 20
      keepAliveTimeout: 90s
      httpHostHeader: map.jmlapido.com
  
  # Frontend routes
  - hostname: map.jmlapido.com
    service: http://localhost:4000
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 10
      keepAliveTimeout: 90s
      httpHostHeader: map.jmlapido.com
  
  # Catch-all rule (required)
  - service: http_status:404
```

**Important:** Replace `<tunnel-id>` with your actual tunnel ID from Step 3.

## Step 5: Create DNS Record

```bash
# Create DNS record for your tunnel
cloudflared tunnel route dns map-ping map.jmlapido.com
```

Or manually create a CNAME record in Cloudflare Dashboard:
- **Type**: CNAME
- **Name**: map
- **Target**: `<tunnel-id>.cfargotunnel.com`

## Step 6: Test the Configuration

```bash
# Test the configuration
cloudflared tunnel --config /etc/cloudflared/config.yml run map-ping
```

If there are no errors, press Ctrl+C and continue to the next step.

## Step 7: Install as a Service

```bash
# Install cloudflared as a systemd service
sudo cloudflared service install
```

This will:
- Copy the config file to `/etc/cloudflared/config.yml`
- Create a systemd service
- Start the tunnel automatically

## Step 8: Start and Enable the Service

```bash
# Start the service
0
```

## Step 9: Update Docker Compose

The `docker-compose.yml` is already configured with:
```yaml
environment:
  - NEXT_PUBLIC_API_URL=https://map.jmlapido.com
```

This tells the frontend to use the same domain for API requests.

## Step 10: Deploy Your Application

```bash
cd ~/technohub-map-nms

# Pull latest changes
git pull origin main

# Start the application
docker compose up -d
```

## Step 11: Verify Everything Works

```bash
# Check Docker containers
docker compose ps

# Check Cloudflared service
sudo systemctl status cloudflared

# Test from your browser
# Visit: https://map.jmlapido.com
```

## Troubleshooting

### Frontend Can't Connect to Backend

1. **Check Cloudflared logs:**
   ```bash
   sudo journalctl -u cloudflared -f
   ```

2. **Verify routing in config:**
   ```bash
   sudo cat /etc/cloudflared/config.yml
   ```
   
   Make sure `/api/*` is routed to port 5000 first, then everything else to port 4000.

3. **Check Docker logs:**
   ```bash
   docker compose logs -f
   ```

4. **Test backend directly:**
   ```bash
   curl http://localhost:5000/api/status
   ```

5. **Test frontend directly:**
   ```bash
   curl http://localhost:4000
   ```

### Cloudflared Service Not Starting

```bash
# Check service status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -n 50

# Restart service
sudo systemctl restart cloudflared
```

### DNS Issues

```bash
# Check DNS resolution
nslookup map.jmlapido.com

# Should return your Cloudflare IP addresses
```

### SSL Certificate Issues

Cloudflare Tunnel automatically handles SSL certificates. If you see certificate errors:

1. Check Cloudflare Dashboard → SSL/TLS → Overview
2. Ensure SSL/TLS encryption mode is set to "Full" or "Full (strict)"
3. Verify tunnel is running: `sudo systemctl status cloudflared`

## Advanced Configuration

### Custom Headers

Add custom headers in the ingress rules:

```yaml
ingress:
  - hostname: map.jmlapido.com
    path: /api/*
    service: http://localhost:5000
    originRequest:
      httpHostHeader: map.jmlapido.com
      noTLSVerify: false
  
  - hostname: map.jmlapido.com
    service: http://localhost:4000
    originRequest:
      httpHostHeader: map.jmlapido.com
```

### Multiple Domains

To use multiple domains:

```yaml
ingress:
  - hostname: map.jmlapido.com
    path: /api/*
    service: http://localhost:5000
  
  - hostname: map.jmlapido.com
    service: http://localhost:4000
  
  - hostname: status.jmlapido.com
    path: /api/*
    service: http://localhost:5000
  
  - hostname: status.jmlapido.com
    service: http://localhost:4000
  
  - service: http_status:404
```

### Access Control

Add Cloudflare Access for authentication:

1. Go to Cloudflare Dashboard → Zero Trust
2. Create an Access Application
3. Configure rules for `map.jmlapido.com`
4. Add users/groups with access

## Maintenance

### Update Cloudflared

```bash
# Download latest version
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install
sudo dpkg -i cloudflared-linux-amd64.deb

# Restart service
sudo systemctl restart cloudflared
```

### Update Application

```bash
cd ~/technohub-map-nms
git pull origin main
docker compose up -d --build
```

### View Logs

```bash
# Cloudflared logs
sudo journalctl -u cloudflared -f

# Docker logs
docker compose logs -f

# Specific service logs
docker compose logs -f map-ping
```

### Backup

```bash
# Backup Cloudflared config
sudo cp /etc/cloudflared/config.yml ~/backup-cloudflared-config.yml

# Backup Docker volume
docker run --rm -v technohub-map-nms_map-ping-data:/data -v $(pwd):/backup alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data
```

## Optimal Cloudflare Dashboard Settings

### SSL/TLS Configuration
```
SSL/TLS encryption mode: Full (strict)
Edge Certificates: Always Use HTTPS ✅
Automatic HTTPS Rewrites ✅
Minimum TLS Version: 1.2
```

### Security Settings (Optimized for Stability)
```
Security Level: Medium (not High or I'm Under Attack)
Bot Fight Mode: OFF (can cause issues with frequent polling)
Challenge Passage: 30 minutes (instead of default 5 minutes)
Browser Integrity Check: OFF (can interfere with API calls)
```

### Firewall Rules (Create These)
Go to **Security → WAF → Custom Rules** and create:

**Rule 1: Allow API Polling**
```
Field: URI Path
Operator: starts with
Value: /api/
Action: Skip all remaining rules
```

**Rule 2: Allow Frequent Requests**
```
Field: Request Rate
Operator: is greater than
Value: 20 requests per minute
AND
Field: URI Path
Operator: does not start with
Value: /api/
Action: Challenge (not Block)
```

### Page Rules (Create This)
Go to **Rules → Page Rules** and create:

```
URL: map.jmlapido.com/api/*
Settings:
- Cache Level: Bypass Cache
- Security Level: Essentially Off
- Disable Security
- Disable Performance
```

### Speed Settings
```
Auto Minify: OFF (can cause issues with dynamic content)
Brotli: ON
HTTP/2: ON
HTTP/3 (with QUIC): ON
0-RTT Connection Resumption: ON
```

### Caching Settings
```
Caching Level: Standard
Browser Cache TTL: 2 hours
Edge Cache TTL: 2 hours
```

## Security Recommendations

1. **Cloudflare Security Settings:**
   - Enable "Always Use HTTPS"
   - Enable "Automatic HTTPS Rewrites"
   - Set SSL/TLS to "Full (strict)"
   - Use the optimized settings above for better stability

2. **Firewall:**
   ```bash
   # Only allow Cloudflare IPs (optional but recommended)
   sudo ufw allow from 173.245.48.0/20
   sudo ufw allow from 103.21.244.0/22
   sudo ufw allow from 103.22.200.0/22
   sudo ufw allow from 103.31.4.0/22
   sudo ufw allow from 141.101.64.0/18
   sudo ufw allow from 108.162.192.0/18
   sudo ufw allow from 190.93.240.0/20
   sudo ufw allow from 188.114.96.0/20
   sudo ufw allow from 197.234.240.0/22
   sudo ufw allow from 198.41.128.0/17
   sudo ufw allow from 162.158.0.0/15
   sudo ufw allow from 104.16.0.0/13
   sudo ufw allow from 104.24.0.0/14
   sudo ufw allow from 172.64.0.0/13
   sudo ufw allow from 131.0.72.0/22
   ```

3. **Rate Limiting:**
   - Configure rate limiting in Cloudflare Dashboard
   - Set up rules to prevent abuse

4. **DDoS Protection:**
   - Enable Cloudflare DDoS protection
   - Configure firewall rules

## Quick Reference

```bash
# Start/Stop/Status
sudo systemctl start cloudflared
sudo systemctl stop cloudflared
sudo systemctl status cloudflared
sudo systemctl restart cloudflared

# View logs
sudo journalctl -u cloudflared -f

# Test configuration
cloudflared tunnel --config /etc/cloudflared/config.yml run map-ping

# List tunnels
cloudflared tunnel list

# Delete tunnel
cloudflared tunnel delete map-ping
```

## Support

For issues:
- Cloudflared logs: `sudo journalctl -u cloudflared -f`
- Docker logs: `docker compose logs -f`
- Cloudflare Dashboard: https://dash.cloudflare.com
- Cloudflared docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

## Summary

With Cloudflare Tunnel, your setup is:
- ✅ No need for Nginx reverse proxy
- ✅ Automatic SSL/HTTPS
- ✅ DDoS protection
- ✅ Global CDN
- ✅ Easy to configure and maintain

Your application is accessible at: **https://map.jmlapido.com**

