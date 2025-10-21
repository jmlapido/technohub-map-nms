# Deployment Guide

This document provides comprehensive deployment instructions for the Map-Ping application.

## Deployment Options

### 1. Docker Deployment (Recommended)

The easiest way to deploy Map-Ping is using Docker.

#### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 5GB disk space

#### Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd map-ping

# Start the application
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Access the application at:
- Frontend: http://localhost:4000
- Backend API: http://localhost:5000

See [DOCKER_README.md](./DOCKER_README.md) for detailed Docker documentation.

### 2. Manual Deployment

#### Prerequisites
- Node.js 18+
- npm or yarn
- SQLite3
- Network access for ICMP (ping)

#### Installation Steps

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd map-ping
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Configure the application**
Edit `backend/config.json` to add your devices and network configuration.

4. **Start the application**
```bash
# Development mode
npm run dev

# Production mode
cd backend && npm start &
cd frontend && npm run build && npm start
```

5. **Access the application**
- Frontend: http://localhost:4000
- Backend API: http://localhost:5000

### 3. Cloud Deployment

#### Using GitHub Container Registry

The repository includes GitHub Actions workflows for automated Docker builds.

1. **Push to GitHub**
```bash
git push origin main
```

2. **Access your image**
```bash
docker pull ghcr.io/<your-username>/map-ping:latest
```

3. **Run the container**
```bash
docker run -d \
  --name map-ping \
  -p 4000:4000 \
  -p 5000:5000 \
  -v $(pwd)/data:/app/backend \
  ghcr.io/<your-username>/map-ping:latest
```

#### Using Docker Hub

1. **Build and tag**
```bash
docker build -t <your-username>/map-ping:latest .
```

2. **Push to Docker Hub**
```bash
docker login
docker push <your-username>/map-ping:latest
```

3. **Pull and run**
```bash
docker pull <your-username>/map-ping:latest
docker run -d -p 4000:4000 -p 5000:5000 <your-username>/map-ping:latest
```

### 4. VPS/Cloud Server Deployment

#### Ubuntu/Debian

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose V2
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Clone and deploy
git clone <your-repo-url>
cd map-ping
docker compose up -d
```

#### Using Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt-get install nginx

# Create configuration
sudo nano /etc/nginx/sites-available/map-ping
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/map-ping /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Systemd Service (Non-Docker)

Create a systemd service for production deployment:

```bash
sudo nano /etc/systemd/system/map-ping.service
```

Add this configuration:
```ini
[Unit]
Description=Map-Ping Network Monitor
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/map-ping
ExecStart=/usr/bin/node /path/to/map-ping/backend/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable map-ping
sudo systemctl start map-ping
sudo systemctl status map-ping
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (production/development) | production |
| `BACKEND_PORT` | Backend API port | 5000 |
| `FRONTEND_PORT` | Frontend port | 4000 |
| `NEXT_PUBLIC_API_URL` | Frontend API URL override | auto-detect |

### Configuration File

Edit `backend/config.json` to customize:
- Network areas (locations)
- Devices to monitor
- Network links
- Ping intervals
- Thresholds for latency and packet loss

## Monitoring and Maintenance

### Health Checks

```bash
# Docker health check
docker inspect --format='{{.State.Health.Status}}' map-ping

# API health check
curl http://localhost:5000/api/status
```

### Logs

```bash
# Docker logs
docker compose logs -f

# Systemd logs
journalctl -u map-ping -f
```

### Backup

```bash
# Backup database
cp backend/database.sqlite backup-$(date +%Y%m%d).sqlite

# Backup configuration
cp backend/config.json backup-config-$(date +%Y%m%d).json
```

### Updates

```bash
# Docker update
git pull
docker compose down
docker compose up -d --build

# Manual update
git pull
npm run install:all
pm2 restart map-ping
```

## Security Considerations

1. **Firewall**: Only expose necessary ports (4000, 5000)
2. **Reverse Proxy**: Use nginx or Traefik with SSL
3. **Authentication**: Consider adding authentication for production
4. **Network Isolation**: Run in a private network if possible
5. **Regular Updates**: Keep dependencies and system updated

## Troubleshooting

### Container won't start
```bash
docker compose logs map-ping
```

### Port conflicts
```bash
# Check what's using the ports
sudo netstat -tuln | grep -E ':(4000|5000)'

# Change ports in docker-compose.yml
```

### Docker Compose V2 Required

If you get `ModuleNotFoundError: No module named 'distutils'`:
```bash
# Install Docker Compose V2
sudo apt-get install -y docker-compose-plugin

# Use 'docker compose' (two words) instead of 'docker-compose'
docker compose up -d
```

### Database issues
```bash
# Check database permissions
ls -la backend/database.sqlite

# Recreate database
rm backend/database.sqlite
docker compose restart
```

### Ping not working
- Ensure ICMP is allowed in firewall
- Check network connectivity from container
- Verify target IPs are reachable

## Support

For more information:
- [DOCKER_README.md](./DOCKER_README.md) - Docker-specific documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [README.md](./README.md) - General project information

## License

See LICENSE file for details.

