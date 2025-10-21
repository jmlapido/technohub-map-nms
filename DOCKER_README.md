# Map-Ping Docker Deployment Guide

This guide explains how to deploy the Map-Ping network monitoring application using Docker.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- At least 2GB of RAM
- 5GB of free disk space

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd map-ping
```

### 2. Build and Run with Docker Compose

```bash
docker compose up -d
```

This will:
- Build the Docker image
- Start both backend and frontend services
- Expose the application on ports 4000 (frontend) and 5000 (backend)

### 3. Access the Application

- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:5000/api

## Manual Docker Build

If you prefer to build and run manually:

```bash
# Build the image
docker build -t map-ping:latest .

# Run the container
docker run -d \
  --name map-ping \
  -p 4000:4000 \
  -p 5000:5000 \
  -v $(pwd)/backend/database.sqlite:/app/backend/database.sqlite \
  -v $(pwd)/backend/config.json:/app/backend/config.json \
  map-ping:latest
```

## Configuration

### Environment Variables

You can customize the deployment using environment variables:

```yaml
environment:
  - NODE_ENV=production
  - BACKEND_PORT=5000
  - FRONTEND_PORT=4000
```

### Persistent Data

The following volumes are mounted to persist data:

- `./backend/database.sqlite` - SQLite database
- `./backend/config.json` - Application configuration

To use different paths, modify the `volumes` section in `docker-compose.yml`.

## Management Commands

### View Logs

```bash
# All logs
docker compose logs -f

# Backend logs only
docker compose logs -f map-ping | grep backend

# Last 100 lines
docker compose logs --tail=100 map-ping
```

### Stop the Application

```bash
docker compose down
```

### Restart the Application

```bash
docker compose restart
```

### Update the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

### Check Status

```bash
# Container status
docker compose ps

# Health check
docker compose exec map-ping wget -qO- http://localhost:5000/api/status
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs map-ping

# Verify ports are available
netstat -tuln | grep -E ':(4000|5000)'
```

### Permission Issues with Database

```bash
# Fix database permissions
sudo chown -R $USER:$USER backend/database.sqlite
```

### Ping Not Working

The container needs `iputils` package for ping functionality. This is included in the Dockerfile. If ping fails, ensure:

1. The container has network access
2. ICMP is allowed in your firewall
3. The target IPs are reachable from the container

### Rebuild from Scratch

```bash
# Stop and remove containers
docker compose down -v

# Remove images
docker rmi map-ping:latest

# Rebuild
docker compose up -d --build
```

## Production Deployment

### Using Docker Compose

For production, consider:

1. **Use a reverse proxy** (nginx, Traefik)
2. **Enable SSL/TLS** certificates
3. **Set up regular backups** of the database
4. **Configure log rotation**
5. **Use Docker secrets** for sensitive data

Example with nginx:

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

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  map-ping:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Backup and Restore

### Backup Database

```bash
# While container is running
docker cp map-ping:/app/backend/database.sqlite ./backup-$(date +%Y%m%d).sqlite

# Or from host
cp backend/database.sqlite backup-$(date +%Y%m%d).sqlite
```

### Restore Database

```bash
# Stop the container
docker compose down

# Replace database
cp backup-20240101.sqlite backend/database.sqlite

# Start the container
docker compose up -d
```

## Monitoring

### Health Check

The container includes a health check that monitors the backend API:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' map-ping
```

### Resource Usage

```bash
# CPU and memory usage
docker stats map-ping

# Disk usage
docker system df
```

## Support

For issues and questions:
- Check the main README.md
- Review TROUBLESHOOTING.md
- Open an issue on GitHub

## License

See LICENSE file for details.

