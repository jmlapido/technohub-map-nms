# View Service Logs / Terminal Output

## View Logs in Real-Time (Like a Terminal)

```bash
# Follow logs in real-time (like tail -f)
sudo journalctl -u map-ping -f
```

This will show you the live output just like a terminal. Press `Ctrl+C` to exit.

## View Recent Logs

```bash
# View last 50 lines
sudo journalctl -u map-ping -n 50

# View last 100 lines
sudo journalctl -u map-ping -n 100

# View last 200 lines
sudo journalctl -u map-ping -n 200
```

## View Logs Since Today

```bash
# Logs since today
sudo journalctl -u map-ping --since today

# Logs since 1 hour ago
sudo journalctl -u map-ping --since "1 hour ago"

# Logs since yesterday
sudo journalctl -u map-ping --since yesterday
```

## View Logs with Timestamps

```bash
# Show logs with timestamps
sudo journalctl -u map-ping -f --no-pager

# Show logs since boot
sudo journalctl -u map-ping --since boot
```

## Filter Logs

```bash
# Show only errors
sudo journalctl -u map-ping -p err

# Show errors and warnings
sudo journalctl -u map-ping -p warning

# Search for specific text
sudo journalctl -u map-ping | grep "error"
sudo journalctl -u map-ping | grep "backend"
sudo journalctl -u map-ping | grep "frontend"
```

## Export Logs to File

```bash
# Export to file
sudo journalctl -u map-ping > service-logs.txt

# Export recent logs only
sudo journalctl -u map-ping --since "1 hour ago" > recent-logs.txt
```

## Quick Commands Reference

```bash
# Real-time logs (most common)
sudo journalctl -u map-ping -f

# Last 50 lines
sudo journalctl -u map-ping -n 50

# Last 100 lines with timestamps
sudo journalctl -u map-ping -n 100 --no-pager

# Errors only
sudo journalctl -u map-ping -p err -n 50
```

