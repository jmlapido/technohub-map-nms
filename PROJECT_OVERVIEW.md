# Network Link Map Monitor - Project Overview

## 🎯 What We Built

A **real-time network monitoring system** with geographic visualization that shows:
- Network sites on a real map (using Leaflet)
- Colored lines connecting sites (green/yellow/red based on link quality)
- Hover tooltips showing device status
- Mobile-friendly interface
- 3-day history tracking

## 📁 Project Structure

```
map-ping/
├── frontend/                    # Next.js 14 App
│   ├── app/
│   │   ├── page.tsx            # Main map page
│   │   ├── status/page.tsx     # Status dashboard
│   │   ├── settings/page.tsx   # Configuration UI
│   │   ├── layout.tsx          # App layout with sidebar
│   │   └── globals.css         # Tailwind styles
│   ├── components/
│   │   ├── NetworkMap.tsx      # Leaflet map component
│   │   └── ui/                 # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── badge.tsx
│   │       ├── input.tsx
│   │       └── label.tsx
│   └── lib/
│       ├── api.ts              # API client
│       └── utils.ts            # Utilities
│
├── backend/                     # Express API
│   ├── server.js               # Main server
│   ├── database.js             # SQLite operations
│   ├── monitor.js              # Ping monitoring
│   ├── config.json             # Network config
│   └── database.sqlite         # Auto-generated DB
│
├── package.json                # Root package
├── README.md                   # Full documentation
├── QUICKSTART.md              # Quick start guide
└── PROJECT_OVERVIEW.md        # This file
```

## 🎨 Features

### 1. Network Map Page (`/`)
- **Geographic visualization** with Leaflet
- **Real-time updates** every 10 seconds
- **Color-coded links:**
  - 🟢 Green = Good (latency ≤ 50ms)
  - 🟡 Yellow = Degraded (latency ≤ 150ms)
  - 🔴 Red = Down (latency > 150ms)
- **Interactive markers** - hover to see device details
- **Mobile-friendly** - pinch/zoom, touch interactions
- **Area details panel** - shows all devices in an area

### 2. Status Page (`/status`)
- **Statistics cards:**
  - Total devices
  - Network links
  - Areas
  - Health percentage
- **Device list** organized by area
- **Real-time status** for each device
- **Latency display** in milliseconds

### 3. Settings Page (`/settings`)
- **Add/Edit Areas:**
  - Name
  - Latitude/Longitude
- **Add/Edit Devices:**
  - Name
  - IP Address
  - Area assignment
- **Add/Edit Links:**
  - Connect areas
- **Monitoring Settings:**
  - Ping interval
  - Latency thresholds
- **Save button** to persist changes

## 🔧 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **Leaflet** - Interactive maps
- **React-Leaflet** - React bindings for Leaflet
- **Axios** - HTTP client
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **SQLite** - Database (better-sqlite3)
- **node-ping** - ICMP ping library
- **CORS** - Cross-origin support

## 🔄 Data Flow

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       │ HTTP Requests
       │ (GET /api/status)
       ▼
┌─────────────┐
│   Express   │
│   Backend   │
└──────┬──────┘
       │
       ├──► SQLite Database
       │    (3-day history)
       │
       └──► Ping Monitor
            (Every 10 seconds)
            └──► ICMP Pings
                 └──► Store Results
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Current network status |
| GET | `/api/history/:deviceId` | 3-day history for device |
| GET | `/api/config` | Current configuration |
| POST | `/api/config` | Update configuration |

## 🗄️ Database Schema

```sql
CREATE TABLE ping_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL,           -- 'up', 'down', 'degraded'
  latency INTEGER,                 -- milliseconds
  packet_loss REAL,                -- percentage
  timestamp INTEGER NOT NULL       -- Unix timestamp
);
```

**Auto-cleanup:** Old records (>3 days) are automatically deleted every hour.

## 🎯 Key Components

### NetworkMap.tsx
- Renders Leaflet map
- Draws area markers as colored circles
- Draws links as polylines between areas
- Shows popup on hover
- Displays area details panel

### Monitor.js
- Runs ping monitoring loop
- Pings all devices at configured interval
- Determines status based on thresholds
- Stores results in database

### Database.js
- Initializes SQLite database
- Stores ping results
- Retrieves current status
- Calculates area/link status from device data
- Provides 3-day history

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm run install:all

# 2. Start the application
npm run dev

# 3. Open browser
# Frontend: http://localhost:4000
# Backend: http://localhost:5000/api
```

## 📱 Mobile Support

- **Responsive layout** - works on all screen sizes
- **Touch-friendly** - optimized for mobile devices
- **Map controls** - pinch/zoom, drag
- **Sidebar** - collapsible navigation

## 🔐 Security Notes

- No authentication (add if needed for production)
- CORS enabled for localhost
- SQLite database stored locally
- Ping requires appropriate permissions

## 🎨 Color Scheme

- **Primary:** Blue (#3b82f6)
- **Success/Up:** Green (#10b981)
- **Warning/Degraded:** Yellow (#f59e0b)
- **Danger/Down:** Red (#ef4444)
- **Muted:** Gray (#6b7280)

## 📈 Future Enhancements (Optional)

- [ ] Add authentication
- [ ] Export reports (PDF/CSV)
- [ ] Email alerts
- [ ] Historical graphs
- [ ] Animated flow indicators on links
- [ ] Dark mode toggle
- [ ] Multiple user accounts
- [ ] Device grouping
- [ ] Custom alert rules

## 🐛 Known Limitations

- Ping requires elevated permissions on some systems
- ICMP may be blocked by firewalls
- OpenStreetMap tiles require internet connection
- SQLite is single-write (not ideal for high concurrency)

## 📝 Configuration Example

```json
{
  "areas": [
    {
      "id": "area-1",
      "name": "Manila Office",
      "lat": 14.5995,
      "lng": 120.9842
    }
  ],
  "devices": [
    {
      "id": "device-1",
      "areaId": "area-1",
      "name": "Router 1",
      "ip": "192.168.1.1"
    }
  ],
  "links": [
    {
      "id": "link-1",
      "from": "area-1",
      "to": "area-2"
    }
  ],
  "settings": {
    "pingInterval": 10,
    "thresholds": {
      "latency": { "good": 50, "degraded": 150 },
      "packetLoss": { "good": 1, "degraded": 5 }
    }
  }
}
```

## 🎓 Learning Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Leaflet Docs](https://leafletjs.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [SQLite](https://www.sqlite.org/)

---

**Built with ❤️ using modern web technologies**

