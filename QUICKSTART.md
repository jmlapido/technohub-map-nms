# Quick Start Guide

## Installation & Running

### Step 1: Install Dependencies
```bash
npm run install:all
```

This will install dependencies for:
- Root project (concurrently)
- Frontend (Next.js, React, Leaflet, etc.)
- Backend (Express, SQLite, ping)

### Step 2: Start the Application
```bash
npm run dev
```

This starts both frontend and backend simultaneously:
- **Frontend:** http://localhost:4000
- **Backend API:** http://localhost:5000/api

### Step 3: Access the Application

Open your browser to **http://localhost:4000**

You'll see:
- **Network Map** - Geographic visualization with Manila and Cebu offices
- **Status** - Device monitoring dashboard
- **Settings** - Configure your network

## Default Configuration

The system comes with sample data for testing:

**Areas:**
- Manila Office (14.5995°N, 120.9842°E)
- Cebu Office (10.3157°N, 123.8854°E)

**Devices:**
- Router 1 (8.8.8.8) - Google DNS
- Router 2 (1.1.1.1) - Cloudflare DNS

**Link:**
- Manila ↔ Cebu

## Customizing Your Network

1. Go to **Settings** page
2. Click **Add Area** to add new locations
3. Enter the geographic coordinates (lat/lng)
4. Click **Add Device** to add devices to monitor
5. Enter device name and IP address
6. Select which area the device belongs to
7. Click **Add Link** to connect areas
8. Click **Save Settings** at the bottom

## Testing the System

The default devices (8.8.8.8 and 1.1.1.1) are public DNS servers, so they should be reachable and show as "up" (green) on the map.

## Troubleshooting

**"Cannot connect to backend" error:**
- Make sure the backend is running on port 5000
- Check the terminal for any backend errors

**Ping not working:**
- On Windows: Run PowerShell/CMD as Administrator
- On Linux/Mac: Run with sudo or configure ping permissions

**Map not showing:**
- Check your internet connection (uses OpenStreetMap)
- Clear browser cache

## Next Steps

1. Replace default devices with your actual network devices
2. Add your real office locations
3. Adjust ping intervals in settings (default: 10 seconds)
4. Customize thresholds for your network needs

## Running in Production

```bash
# Frontend
cd frontend
npm run build
npm start

# Backend
cd backend
npm start
```

Enjoy monitoring your network! 🚀


