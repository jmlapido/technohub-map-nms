# Fix Docker Compose Error on Ubuntu

## Problem

When running `docker-compose up -d`, you get this error:
```
ModuleNotFoundError: No module named 'distutils'
```

This happens because:
- You have Python 3.12 installed
- You're using the old `docker-compose` (v1)
- Python 3.12 removed the `distutils` module

## Solution: Install Docker Compose V2

Docker Compose V2 is the modern, recommended version that works with Python 3.12.

### Quick Fix (Recommended)

```bash
# Run the installation script
chmod +x install-docker-compose-v2.sh
sudo ./install-docker-compose-v2.sh
```

### Manual Installation

```bash
# 1. Remove old docker-compose
sudo apt-get remove -y docker-compose
sudo rm -f /usr/local/bin/docker-compose
sudo rm -f /usr/bin/docker-compose

# 2. Install Docker Compose V2
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# 3. Verify installation
docker compose version
```

## Important Change: Command Syntax

After installing Docker Compose V2, the command syntax changes:

### Old (v1) - NO LONGER WORKS
```bash
docker-compose up -d        # ❌ Old syntax
docker-compose down         # ❌ Old syntax
docker-compose logs -f      # ❌ Old syntax
```

### New (v2) - USE THIS
```bash
docker compose up -d        # ✅ New syntax (two words)
docker compose down         # ✅ New syntax
docker compose logs -f      # ✅ New syntax
```

**Note:** It's now `docker compose` (two words) instead of `docker-compose` (one word)

## Deploy Your Application

After installing Docker Compose V2, deploy your application:

```bash
# Navigate to your project
cd ~/technohub-map-nms

# Start the application
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop the application
docker compose down
```

## Alternative: Install distutils (Not Recommended)

If you really need the old docker-compose v1:

```bash
# Install distutils for Python 3.12
sudo apt-get install -y python3.12-distutils

# Or install distutils2
sudo apt-get install -y python3-distutils
```

**However, this is NOT recommended** because:
- docker-compose v1 is deprecated
- Docker Compose V2 is faster and more reliable
- V2 has better features and bug fixes

## Verify Your Setup

```bash
# Check Docker version
docker --version

# Check Docker Compose version (V2)
docker compose version

# Check if plugin is installed
docker info | grep -i compose
```

## Troubleshooting

### If you still get the error:

1. **Check which docker-compose you're using:**
   ```bash
   which docker-compose
   which docker
   ```

2. **Remove all old versions:**
   ```bash
   sudo apt-get remove -y docker-compose
   sudo pip3 uninstall docker-compose
   sudo rm -f /usr/local/bin/docker-compose
   sudo rm -f /usr/bin/docker-compose
   ```

3. **Reinstall Docker Compose V2:**
   ```bash
   sudo apt-get install -y docker-compose-plugin
   ```

4. **Verify:**
   ```bash
   docker compose version
   ```

### If Docker Compose V2 is not found:

Make sure you have Docker Desktop or Docker Engine with Compose plugin:

```bash
# For Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# For CentOS/RHEL
sudo yum install -y docker-compose-plugin

# For Fedora
sudo dnf install -y docker-compose-plugin
```

## Updated Documentation

All the documentation has been updated to use the new syntax:

- `DOCKER_README.md` - Uses `docker compose` (V2)
- `DEPLOYMENT.md` - Uses `docker compose` (V2)
- `README.md` - Uses `docker compose` (V2)

## Summary

✅ **Solution:** Install Docker Compose V2
✅ **Command:** `docker compose` (two words, no hyphen)
✅ **Install:** `sudo apt-get install -y docker-compose-plugin`
✅ **Verify:** `docker compose version`

Your application will work perfectly after this update!

