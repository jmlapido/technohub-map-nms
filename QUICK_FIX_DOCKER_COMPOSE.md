# 🚨 Quick Fix: Docker Compose Error

## Your Error
```
ModuleNotFoundError: No module named 'distutils'
```

## ✅ Solution (2 minutes)

### Step 1: Install Docker Compose V2

```bash
# Run this command on your Ubuntu server
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

### Step 2: Use the New Command

**OLD (doesn't work):**
```bash
docker-compose up -d    # ❌ One word with hyphen
```

**NEW (works):**
```bash
docker compose up -d    # ✅ Two words, no hyphen
```

### Step 3: Deploy Your Application

```bash
cd ~/technohub-map-nms
docker compose up -d
```

## That's It! 🎉

Your application should now be running at:
- **Frontend:** http://your-server-ip:4000
- **Backend:** http://your-server-ip:5000

## Management Commands

```bash
# View logs
docker compose logs -f

# Check status
docker compose ps

# Restart
docker compose restart

# Stop
docker compose down
```

## Why This Happened

- Python 3.12 removed the `distutils` module
- Old `docker-compose` (v1) depends on distutils
- Docker Compose V2 is the modern replacement
- V2 is faster, more reliable, and actively maintained

## Need More Help?

See **FIX_DOCKER_COMPOSE.md** for detailed troubleshooting.

