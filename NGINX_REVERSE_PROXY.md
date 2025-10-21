# Nginx Reverse Proxy Setup for Production

This guide shows you how to set up Nginx as a reverse proxy to serve your Map-Ping application through a single domain.

## Why Use a Reverse Proxy?

When deploying with a domain (like `map.jmlapido.com`), you need a reverse proxy to:
- Route `/api/*` requests to the backend (port 5000)
- Route all other requests to the frontend (port 4000)
- Enable SSL/HTTPS with Let's Encrypt
- Handle CORS properly

## Prerequisites

- Ubuntu/Debian server
- Domain name pointing to your server IP
- Docker and Docker Compose installed
- Nginx installed

## Step 1: Install Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

## Step 2: Configure Nginx

Create a new Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/map-ping
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name map.jmlapido.com;  # Replace with your domain

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
    }
}
```

**Important:** Replace `map.jmlapido.com` with your actual domain name!

## Step 3: Enable the Site

```bash
# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/map-ping /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 4: Update docker-compose.yml

Update your `docker-compose.yml` to use the domain for the API URL:

```yaml
environment:
  - NODE_ENV=production
  - BACKEND_PORT=5000
  - FRONTEND_PORT=4000
  - PORT=4000
  - NEXT_PUBLIC_API_URL=https://map.jmlapido.com  # Use your domain
```

Then rebuild:

```bash
cd ~/technohub-map-nms
docker compose down
docker compose up -d --build
```

## Step 5: Enable HTTPS with Let's Encrypt (Optional but Recommended)

Install Certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

Obtain SSL certificate:

```bash
sudo certbot --nginx -d map.jmlapido.com
```

Follow the prompts and Certbot will:
- Obtain SSL certificate
- Configure Nginx to use HTTPS
- Set up automatic renewal

## Step 6: Update Nginx for HTTPS

Certbot will automatically update your Nginx config, but if you need to do it manually:

```nginx
server {
    listen 443 ssl http2;
    server_name map.jmlapido.com;

    ssl_certificate /etc/letsencrypt/live/map.jmlapido.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/map.jmlapido.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name map.jmlapido.com;
    return 301 https://$server_name$request_uri;
}
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```

## Step 7: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Remove direct access to ports 4000 and 5000 (optional but recommended)
sudo ufw delete allow 4000/tcp
sudo ufw delete allow 5000/tcp
```

## Step 8: Verify Everything Works

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Docker containers
docker compose ps

# Test frontend
curl https://map.jmlapido.com

# Test backend API
curl https://map.jmlapido.com/api/status
```

## Troubleshooting

### Frontend Can't Connect to Backend

Check browser console for errors. The API URL should be `https://map.jmlapido.com/api`.

### Nginx 502 Bad Gateway

```bash
# Check if Docker containers are running
docker compose ps

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates
```

### CORS Errors

The Nginx configuration above includes proper headers. If you still see CORS errors, check that:
1. Backend CORS is configured to allow your domain
2. Nginx is forwarding the correct headers
3. Browser is not blocking mixed content (HTTP/HTTPS)

## Maintenance

### Update Application

```bash
cd ~/technohub-map-nms
git pull origin main
docker compose up -d --build
```

### View Logs

```bash
# Docker logs
docker compose logs -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Backup Database

```bash
# Backup Docker volume
docker run --rm -v technohub-map-nms_map-ping-data:/data -v $(pwd):/backup alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data

# Restore from backup
docker run --rm -v technohub-map-nms_map-ping-data:/data -v $(pwd):/backup alpine tar xzf /backup/backup-20250101.tar.gz -C /
```

## Security Recommendations

1. **Use HTTPS**: Always use SSL certificates in production
2. **Firewall**: Close ports 4000 and 5000, only expose 80/443
3. **Regular Updates**: Keep Nginx, Docker, and your application updated
4. **Rate Limiting**: Consider adding rate limiting to Nginx
5. **Fail2Ban**: Install fail2ban to protect against brute force attacks

## Quick Reference

```bash
# Start application
cd ~/technohub-map-nms && docker compose up -d

# Stop application
cd ~/technohub-map-nms && docker compose down

# View logs
docker compose logs -f

# Restart Nginx
sudo systemctl restart nginx

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check SSL certificate
sudo certbot certificates
```

## Support

For issues or questions:
- Check Docker logs: `docker compose logs -f`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check application status: `docker compose ps`
- Review this guide and DEPLOYMENT.md

