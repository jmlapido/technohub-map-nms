# TechnoHub Network Monitor

A real-time network monitoring system with geographic visualization built with Next.js, Leaflet, and Node.js.

## Features

- 🗺️ **Geographic Map Visualization** - View your network topology on a real map
- 📊 **Real-time Monitoring** - Live status updates every 10 seconds
- 📱 **Mobile Friendly** - Responsive design that works on all devices
- 📈 **3-Day History** - Track network performance over time
- ⚙️ **Easy Configuration** - Simple web-based settings management
- 🎨 **Modern UI** - Built with shadcn/ui and Tailwind CSS
- 📊 **Interactive Status Bar** - Docked status panel with minimize/maximize and area focus
- 💾 **Export/Import Data** - Backup and restore your configuration and monitoring data
- 🎯 **Auto-Center Map** - Click area names to focus the map with smooth animations

## Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- shadcn/ui + Tailwind CSS
- Leaflet + React-Leaflet
- Recharts

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- node-ping
- archiver (ZIP export)
- multer (file upload)
- extract-zip (ZIP import)

## Project Structure

```
map-ping/
├── frontend/          # Next.js frontend app
│   ├── app/          # Pages (/, /status, /settings)
│   ├── components/   # React components
│   └── lib/          # API client and utilities
├── backend/          # Express API server
│   ├── server.js     # Main server
│   ├── database.js   # SQLite database operations
│   ├── monitor.js    # Ping monitoring logic
│   └── config.json   # Network configuration
└── package.json      # Root package.json with scripts
```

## Installation

### 🐳 Docker Deployment (Recommended)

The fastest way to get started:

```bash
# Clone the repository
git clone https://github.com/jmlapido/technohub-map-nms.git
cd technohub-map-nms

# Start with Docker Compose
docker compose up -d

# Access the application
# Frontend: http://localhost:4000
# Backend API: http://localhost:5000/api
```

**Management:**
```bash
docker compose logs -f      # View logs
docker compose restart      # Restart
docker compose down         # Stop
```

📖 **Detailed Docker Guide:** See `DOCKER_README.md`

### Quick Start from GitHub (Manual)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jmlapido/technohub-map-nms.git
   cd technohub-map-nms
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:4000
   - Backend API: http://localhost:5000/api

### Windows (Development)

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Start both frontend and backend:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:4000
   - Backend API: http://localhost:5000/api

### Ubuntu (Production with Auto-Start)

**Quick Install (5 minutes):**
```bash
# 1. Clone the repository
git clone https://github.com/jmlapido/technohub-map-nms.git
cd technohub-map-nms

# 2. Install Node.js and PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 3. Install dependencies
npm run install:all

# 4. Build frontend
cd frontend && npm run build && cd ..

# 5. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions

# 6. Configure firewall
sudo ufw allow 4000/tcp
sudo ufw enable
```

**Access at:** `http://your-ubuntu-ip:4000`

**Management:**
```bash
pm2 status          # Check status
pm2 logs map-ping   # View logs
pm2 restart map-ping # Restart
pm2 stop map-ping   # Stop
pm2 monit           # Monitor resources
```

📖 **Detailed Guides:**
- Quick Start: `QUICK_START_UBUNTU.md`
- Full Deployment: `DEPLOY_UBUNTU.md`

## Configuration

### Default Configuration

The system comes with sample data:
- **Areas:** Manila Office (Homes), Cebu Office (Schools), Portal 1 & 2 (PisoWiFi Vendo)
- **Devices:** Router 1 (8.8.8.8), Router 2 (1.1.1.1), Router 2a (8.8.4.4), Vendo1 (192.168.1.1)
- **Links:** Connections between areas

### Customizing Your Network

1. Navigate to the **Settings** page
2. Add/edit areas with their geographic coordinates (lat/lng)
3. Add/edit devices with their IP addresses
4. Define links between areas
5. Adjust ping intervals and thresholds
6. Click **Save Settings**

### Thresholds

- **Good (Green):** Latency ≤ 50ms, Packet Loss ≤ 1%
- **Degraded (Yellow):** Latency ≤ 150ms, Packet Loss ≤ 5%
- **Down (Red):** Latency > 150ms or Packet Loss > 5%

## Pages

### 1. Network Map (`/`)
- Geographic visualization of your network
- Color-coded links showing connection quality
- Hover over areas to see device details
- Mobile-friendly touch interactions

### 2. Status Page (`/status`)
- Overview of all devices and areas
- Real-time status indicators
- Device-level details with latency
- Quick statistics dashboard

### 3. Settings Page (`/settings`)
- Configure areas (name, lat/lng)
- Add/edit devices (name, IP, area)
- Define links between areas
- Adjust monitoring settings
- Export/Import data backup and restore

## New Features

### Interactive Status Bar
- **Docked Layout**: Status bar is now docked at the bottom instead of floating
- **Minimize/Maximize**: Toggle between compact and detailed views
- **Area Statistics**: Quick overview of online/offline counts by area type
- **Map Focus**: Click area names to automatically center the map with smooth animations
- **Marker Animation**: Focused areas show pulsing marker animation for 3 seconds

### Export/Import System
- **One-Click Backup**: Export your entire configuration and monitoring data as a ZIP file
- **Safe Import**: Automatic backup of current data before importing new data
- **File Validation**: Ensures imported files contain valid database and configuration
- **Auto-Restart**: Monitoring automatically restarts with imported configuration
- **Backup Management**: Previous data is preserved in timestamped backup folders

## API Endpoints

```
GET  /api/status          # Current network status
GET  /api/history/:device # 3-day history for a device
GET  /api/config          # Current configuration
POST /api/config          # Update configuration
GET  /api/export          # Export data as ZIP file
POST /api/import          # Import data from ZIP file
```

## Database

The system uses SQLite to store ping history for the last 3 days. The database is automatically created and cleaned up.

**Schema:**
```sql
CREATE TABLE ping_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL,
  latency INTEGER,
  packet_loss REAL,
  timestamp INTEGER NOT NULL
);
```

## Development

### Frontend
```bash
cd frontend
npm run dev
```

### Backend
```bash
cd backend
npm run dev
```

## Production Build

```bash
# Frontend
cd frontend
npm run build
npm start

# Backend
cd backend
npm start
```

## Production Deployment

### 🐳 Docker Deployment

Deploy with Docker for easy management and portability:

```bash
# Build and run
docker compose up -d

# Or pull from GitHub Container Registry
docker pull ghcr.io/jmlapido/technohub-map-nms:latest
docker run -d -p 4000:4000 -p 5000:5000 ghcr.io/jmlapido/technohub-map-nms:latest
```

**Benefits:**
- ✅ Isolated environment
- ✅ Easy updates with `docker compose pull && docker compose up -d`
- ✅ Persistent data with volumes
- ✅ Health checks and auto-restart
- ✅ Works on any platform with Docker

📖 **See:** `DEPLOYMENT.md` for comprehensive deployment options

### Ubuntu Auto-Start

The application is configured to auto-start on Ubuntu using PM2:

```bash
# Install (one-time)
./install-ubuntu.sh

# Application will start automatically on boot
# No manual intervention needed
```

### PM2 Process Manager

- **Auto-restart** on crashes
- **Log management** with rotation
- **Zero-downtime** restarts
- **Resource monitoring**
- **Auto-start on boot**

### Firewall Setup

```bash
sudo ufw allow 4000/tcp  # Frontend
sudo ufw allow 5000/tcp  # Backend API
```

## Notes

- The system uses ICMP ping, which may require elevated permissions on some systems
- Default devices (8.8.8.8, 1.1.1.1) are Google and Cloudflare DNS servers for testing
- Replace with your actual network device IPs in the settings
- The frontend runs on port 4000 (as per your preference)
- The backend runs on port 5000
- PM2 handles process management and auto-restart in production

## Troubleshooting

**Frontend can't connect to backend:**
- Make sure the backend is running on port 5000
- Check that CORS is enabled in the backend

**Ping not working:**
- On Windows, you may need to run as Administrator
- On Linux/Mac, you may need to run with sudo

**Map not loading:**
- Check your internet connection (uses OpenStreetMap tiles)
- Clear browser cache

## License

MIT
