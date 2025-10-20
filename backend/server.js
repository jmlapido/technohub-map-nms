const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { startMonitoring } = require('./monitor');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS configuration to allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Initialize database
initDatabase();

// Load configuration
let config = loadConfig();

// Start monitoring
startMonitoring(config);

// Routes
app.get('/api/status', (req, res) => {
  const { getCurrentStatus } = require('./database');
  const status = getCurrentStatus(config);
  res.json(status);
});

app.get('/api/history/:deviceId', (req, res) => {
  const { getDeviceHistory } = require('./database');
  const { deviceId } = req.params;
  const history = getDeviceHistory(deviceId);
  res.json(history);
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    saveConfig(newConfig);
    config = newConfig;
    
    // Restart monitoring with new config
    const { stopMonitoring } = require('./monitor');
    stopMonitoring();
    startMonitoring(config);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Helper functions
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  }
  
  // Default configuration
  return {
    areas: [
      {
        id: 'area-1',
        name: 'Manila Office',
        type: 'Homes',
        lat: 14.5995,
        lng: 120.9842
      },
      {
        id: 'area-2',
        name: 'Cebu Office',
        type: 'Schools',
        lat: 10.3157,
        lng: 123.8854
      }
    ],
    links: [
      {
        id: 'link-1',
        from: 'area-1',
        to: 'area-2'
      }
    ],
    devices: [
      {
        id: 'device-1',
        areaId: 'area-1',
        name: 'Router 1',
        type: 'router',
        ip: '8.8.8.8'
      },
      {
        id: 'device-2',
        areaId: 'area-2',
        name: 'Router 2',
        type: 'router',
        ip: '1.1.1.1'
      }
    ],
    settings: {
      pingInterval: 10,
      thresholds: {
        latency: {
          good: 50,
          degraded: 150
        },
        packetLoss: {
          good: 1,
          degraded: 5
        }
      }
    }
  };
}

function saveConfig(newConfig) {
  const configPath = path.join(__dirname, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

