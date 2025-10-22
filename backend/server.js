const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { startMonitoring } = require('./monitor');
const archiver = require('archiver');
const multer = require('multer');
const extract = require('extract-zip');

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;

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
const configPath = path.join(__dirname, 'data', 'config.json');
let config = loadConfig(configPath);

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

// Configure multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'data', 'temp') });

// Export database and config
app.get('/api/export', (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const dbPath = path.join(dataDir, 'database.sqlite');
    const configPath = path.join(dataDir, 'config.json');
    
    // Check if files exist
    if (!fs.existsSync(dbPath) || !fs.existsSync(configPath)) {
      return res.status(404).json({ error: 'Database or config file not found' });
    }
    
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `map-ping-backup-${timestamp}.zip`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Failed to create backup' });
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add files to archive
    archive.file(dbPath, { name: 'database.sqlite' });
    archive.file(configPath, { name: 'config.json' });
    
    // Finalize archive
    archive.finalize();
    
    console.log('Export initiated:', filename);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Import database and config
app.post('/api/import', upload.single('backup'), async (req, res) => {
  const tempDir = path.join(__dirname, 'data', 'temp');
  const extractDir = path.join(tempDir, 'extract');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('Import file received:', req.file.originalname);
    
    // Create extract directory
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Extract the zip file
    await extract(req.file.path, { dir: extractDir });
    
    const extractedDbPath = path.join(extractDir, 'database.sqlite');
    const extractedConfigPath = path.join(extractDir, 'config.json');
    
    // Validate extracted files
    if (!fs.existsSync(extractedDbPath) || !fs.existsSync(extractedConfigPath)) {
      throw new Error('Invalid backup file: missing database or config');
    }
    
    // Stop monitoring before importing
    const { stopMonitoring } = require('./monitor');
    stopMonitoring();
    
    // Backup current files
    const dataDir = path.join(__dirname, 'data');
    const backupDir = path.join(dataDir, 'backup-' + Date.now());
    fs.mkdirSync(backupDir, { recursive: true });
    
    const currentDbPath = path.join(dataDir, 'database.sqlite');
    const currentConfigPath = path.join(dataDir, 'config.json');
    
    if (fs.existsSync(currentDbPath)) {
      fs.copyFileSync(currentDbPath, path.join(backupDir, 'database.sqlite'));
    }
    if (fs.existsSync(currentConfigPath)) {
      fs.copyFileSync(currentConfigPath, path.join(backupDir, 'config.json'));
    }
    
    // Import new files
    fs.copyFileSync(extractedDbPath, currentDbPath);
    fs.copyFileSync(extractedConfigPath, currentConfigPath);
    
    // Load new config
    config = loadConfig(currentConfigPath);
    
    // Restart monitoring
    startMonitoring(config);
    
    // Cleanup temp files
    fs.unlinkSync(req.file.path);
    fs.rmSync(extractDir, { recursive: true, force: true });
    
    console.log('Import successful. Backup saved to:', backupDir);
    
    res.json({ 
      success: true, 
      message: 'Data imported successfully',
      backupLocation: backupDir
    });
    
  } catch (error) {
    console.error('Import error:', error);
    
    // Cleanup on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    
    res.status(500).json({ 
      error: 'Failed to import data', 
      details: error.message 
    });
  }
});

// Helper functions
function loadConfig(configPath = path.join(__dirname, 'config.json')) {
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
  const configPath = path.join(__dirname, 'data', 'config.json');
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(configPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

