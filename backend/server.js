const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, getCurrentStatus, clearStatusCache, resetDatabase, getDatabaseStats } = require('./database');
const { startMonitoring, restartMonitoring } = require('./monitor');
const StatusEmitter = require('./websocket/StatusEmitter');
const archiver = require('archiver');
const multer = require('multer');
const extract = require('extract-zip');
const compression = require('compression');

// V3: Telegraf and SNMP support
const { updateTelegrafConfig, checkTelegrafStatus, getTelegrafLogs } = require('./telegraf-manager');
const { router: telegrafRoutes, setConfig: setTelegrafConfig } = require('./routes/telegraf-routes');
const { getPubSubManager } = require('./pubsub/PubSubManager');
const { getInterfaceStatus, getFlappingReport } = require('./snmp/snmp-storage');
const { getStats: getFlappingStats, getConfig: getFlappingConfig, updateConfig: updateFlappingConfig } = require('./snmp/FlappingDetector');

const app = express();
const server = http.createServer(app);
const PORT = process.env.BACKEND_PORT || 5000;

// Initialize WebSocket server
const statusEmitter = new StatusEmitter(server);

// V3: Initialize Redis pub/sub for real-time synchronization
let pubSubManager = null;

// Enable compression for better performance over Cloudflare
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (1-9, 6 is good balance)
  filter: (req, res) => {
    // Don't compress if the request includes a cache-busting parameter
    if (req.query.nocache) return false;
    return compression.filter(req, res);
  }
}));

// Middleware - CORS configuration to allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'If-None-Match', 'If-Modified-Since']
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for imports

// V3: Mount Telegraf routes
app.use('/api/telegraf', telegrafRoutes);

// Add ETag and caching middleware
app.use((req, res, next) => {
  // Set cache headers for API endpoints
  if (req.path.startsWith('/api/')) {
    // Public endpoints can be cached
    if (req.path.includes('/api/status') || req.path.includes('/api/config/public')) {
      res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    }
    // Authenticated endpoints should not be cached by intermediaries
    else if (req.path.includes('/api/config') && !req.path.includes('public')) {
      res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    }
  }
  next();
});

// Helper functions
function loadConfig(configPath = path.join(__dirname, 'data', 'config.json')) {
  let rawConfig;
  console.log(`[loadConfig] Loading config from: ${configPath}`);
  console.log(`[loadConfig] Config file exists: ${fs.existsSync(configPath)}`);

  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    rawConfig = JSON.parse(data);
    console.log(`[loadConfig] Config loaded: ${rawConfig.areas?.length || 0} areas, ${rawConfig.devices?.length || 0} devices, ${rawConfig.links?.length || 0} links`);
  } else {
    // Default configuration (device-aware links)
    rawConfig = {
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
    devices: [
      {
        id: 'device-1',
        areaId: 'area-1',
        name: 'Router 1',
        type: 'router',
          ip: '8.8.8.8',
          criticality: 'normal'
      },
      {
        id: 'device-2',
        areaId: 'area-2',
        name: 'Router 2',
        type: 'router',
          ip: '1.1.1.1',
          criticality: 'normal'
        }
      ],
      links: [
        {
          id: 'link-1',
          type: 'wireless',
          endpoints: [
            {
              areaId: 'area-1',
              deviceId: 'device-1',
              interfaceType: 'wireless',
              interface: 'uplink'
            },
            {
              areaId: 'area-2',
              deviceId: 'device-2',
              interfaceType: 'wireless',
              interface: 'uplink'
            }
          ]
      }
    ],
    settings: {
      pingInterval: 60, // Default to 1 minute for better performance
      frontendPollInterval: 60, // Frontend polling interval
      cacheMaxAge: 30, // Cache duration in seconds
      maxHistoryDays: 30, // Keep 1 month of data
      batchSize: 10, // Batch size for parallel pings
      thresholds: {
        latency: {
          good: 50,
          degraded: 150
        },
        packetLoss: {
          good: 1,
          degraded: 5
        }
      },
      topology: {
        showRemoteAreas: true,
        showLinkLatency: true,
        preferCompactLayout: false,
        autoIncludeUnlinkedDevices: true
      }
    }
  };
  }

  return normalizeConfig(rawConfig);
}

function saveConfig(newConfig) {
  const configPath = path.join(__dirname, 'data', 'config.json');
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(configPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const report = {};
  const normalizedConfig = normalizeConfig(newConfig, report);
  fs.writeFileSync(configPath, JSON.stringify(normalizedConfig, null, 2));
  return { config: normalizedConfig, report };
}

function normalizeConfig(rawConfig = {}, report) {
  const defaultSettings = {
    pingInterval: 60,
    frontendPollInterval: 60,
    cacheMaxAge: 30,
    maxHistoryDays: 30,
    batchSize: 10,
    thresholds: {
      latency: {
        good: 50,
        degraded: 150
      },
      packetLoss: {
        good: 1,
        degraded: 5
      }
    },
    topology: {
      showRemoteAreas: true,
      showLinkLatency: true,
      preferCompactLayout: false,
      autoIncludeUnlinkedDevices: true
    }
  };

  const areas = Array.isArray(rawConfig.areas) ? rawConfig.areas : [];

  const devices = Array.isArray(rawConfig.devices)
    ? rawConfig.devices.map(device => ({
        ...device,
        criticality: device.criticality || 'normal'
      }))
    : [];

  const normalizedLinks = normalizeLinks(Array.isArray(rawConfig.links) ? rawConfig.links : [], areas, devices);
  const { valid: validLinks, invalid: invalidLinks } = validateLinkIntegrity(normalizedLinks, devices);

  if (invalidLinks.length > 0) {
    console.warn(`[config] Dropped ${invalidLinks.length} invalid link(s) during normalization`, invalidLinks);
  }

  if (report) {
    report.invalidLinks = invalidLinks
  }

  const settings = {
    ...defaultSettings,
    ...(rawConfig.settings || {})
  };

  if (!settings.thresholds) {
    settings.thresholds = defaultSettings.thresholds;
  } else {
    settings.thresholds.latency = {
      ...defaultSettings.thresholds.latency,
      ...(settings.thresholds.latency || {})
    };
    settings.thresholds.packetLoss = {
      ...defaultSettings.thresholds.packetLoss,
      ...(settings.thresholds.packetLoss || {})
    };
  }

  settings.topology = {
    ...defaultSettings.topology,
    ...(settings.topology || {})
  };

  settings.topology.showRemoteAreas = settings.topology.showRemoteAreas !== false;
  settings.topology.showLinkLatency = settings.topology.showLinkLatency !== false;
  settings.topology.preferCompactLayout = settings.topology.preferCompactLayout === true;
  settings.topology.autoIncludeUnlinkedDevices = settings.topology.autoIncludeUnlinkedDevices !== false;

  return {
    areas,
    devices,
    links: validLinks,
    settings
  };
}

function normalizeLinks(rawLinks, areas, devices) {
  const deviceMap = new Map(devices.map(device => [device.id, device]));

  const normalizeEndpoints = (link) => {
    const endpoints = Array.isArray(link?.endpoints) ? link.endpoints.slice(0, 2) : []

    while (endpoints.length < 2) {
      endpoints.push({})
    }

    return endpoints.map((endpoint, index) => {
      const safeEndpoint = endpoint || {}
      const fallbackAreaId = index === 0 ? (link?.from || null) : (link?.to || null)
      const areaId = safeEndpoint.areaId || fallbackAreaId || null
      const deviceId = safeEndpoint.deviceId || null

      return {
        areaId,
        deviceId,
        interface: safeEndpoint.interface || null,
        interfaceType: safeEndpoint.interfaceType || link?.type || null,
        label: safeEndpoint.label || null
      }
    })
  }

  return rawLinks.map((link, index) => {
    const linkId = link?.id || `link-${Date.now()}-${index}`;

    const endpoints = normalizeEndpoints(link)

    endpoints.forEach((endpoint, endpointIndex) => {
      if (endpoint.deviceId && !deviceMap.has(endpoint.deviceId)) {
        endpoint.deviceId = null
      }

      if (!endpoint.areaId && endpoint.deviceId) {
        const resolvedDevice = deviceMap.get(endpoint.deviceId)
        if (resolvedDevice) {
          endpoint.areaId = resolvedDevice.areaId
        }
      }

      if (!endpoint.areaId) {
        endpoint.areaId = endpointIndex === 0 ? (link?.from || null) : (link?.to || null)
      }
    })

    while (endpoints.length < 2) {
      endpoints.push({ areaId: null, deviceId: null });
    }

    const primaryEndpoint = endpoints[0] || { areaId: null };
    const secondaryEndpoint = endpoints[1] || { areaId: null };

    const normalizedLink = {
      id: linkId,
      endpoints,
      type: link?.type || (link?.metadata?.type) || undefined,
      metadata: link?.metadata && typeof link.metadata === 'object' ? link.metadata : {}
    };

    if (primaryEndpoint.areaId) {
      normalizedLink.from = primaryEndpoint.areaId;
    }

    if (secondaryEndpoint.areaId) {
      normalizedLink.to = secondaryEndpoint.areaId;
    }

    if (link?.label) {
      normalizedLink.label = link.label;
    }

    return normalizedLink;
  });
}

function validateLinkIntegrity(links = [], devices = []) {
  const deviceIds = new Set(devices.map(device => device.id))
  const valid = []
  const invalid = []

  links.forEach(link => {
    if (!link?.endpoints || link.endpoints.length < 2) {
      invalid.push({ linkId: link?.id || null, reason: 'missing_endpoints' })
      return
    }

    const [endpointA, endpointB] = link.endpoints

    if (!endpointA?.areaId || !endpointB?.areaId) {
      invalid.push({ linkId: link.id, reason: 'missing_area' })
      return
    }

    if (endpointA.deviceId && !deviceIds.has(endpointA.deviceId)) {
      invalid.push({ linkId: link.id, reason: 'missing_device_a' })
      return
    }

    if (endpointB.deviceId && !deviceIds.has(endpointB.deviceId)) {
      invalid.push({ linkId: link.id, reason: 'missing_device_b' })
      return
    }

    if (endpointA.areaId === endpointB.areaId && endpointA.deviceId === endpointB.deviceId) {
      invalid.push({ linkId: link.id, reason: 'self_loop' })
      return
    }

    valid.push(link)
  })

  return { valid, invalid }
}

// Enhanced logging middleware with performance tracking
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const duration = Date.now() - start;
    const size = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body || '', 'utf8');
    
    // Only log slow requests or errors
    if (duration > 1000 || res.statusCode >= 400) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${size} bytes - ${req.ip}`);
    }
    
    originalSend.call(this, body);
  };
  
  next();
});

// Initialize database (now async)
let config = null;
const configPath = path.join(__dirname, 'data', 'config.json');

(async () => {
  try {
    console.log('[Server] Initializing Map-Ping V3...');
    
    // Initialize database
    await initDatabase();
    console.log('[Server] ✓ Database initialization complete');
    
    // Load configuration
    config = loadConfig(configPath);
    console.log(`[Server] ✓ Configuration loaded: ${config.devices.length} devices`);
    
    // V3: Initialize Redis pub/sub
    try {
      pubSubManager = getPubSubManager();
      await pubSubManager.initialize();
      console.log('[Server] ✓ Redis pub/sub initialized');
      
      // Connect WebSocket to pub/sub channels
      pubSubManager.on('device:update', (data) => {
        if (statusEmitter) {
          statusEmitter.emitDeviceUpdate(data.deviceId, data);
        }
      });
      
      pubSubManager.on('interface:update', (data) => {
        if (statusEmitter) {
          statusEmitter.io.emit('interface:update', data);
        }
      });
      
      pubSubManager.on('alert:flapping', (data) => {
        if (statusEmitter) {
          statusEmitter.emitAlert(data);
        }
      });
      
      console.log('[Server] ✓ WebSocket connected to pub/sub');
      
    } catch (error) {
      console.warn('[Server] ⚠️  Redis pub/sub initialization failed (will work without it):', error.message);
      pubSubManager = null;
    }
    
    // V3: Check and configure Telegraf
    const telegrafStatus = await checkTelegrafStatus();
    
    if (telegrafStatus.installed) {
      console.log('[Server] ✓ Telegraf detected:', telegrafStatus.version);
      
      // Generate initial Telegraf configuration
      const telegrafResult = await updateTelegrafConfig(config);
      
      if (telegrafResult.success) {
        console.log('[Server] ✓ Telegraf configuration generated');
        setTelegrafConfig(config); // Make config available to routes
      } else {
        console.warn('[Server] ⚠️  Failed to generate Telegraf config:', telegrafResult.error);
      }
    } else {
      console.log('[Server] ℹ️  Telegraf not installed, using built-in monitor');
      
      // Start built-in monitoring
      setTimeout(() => {
        startMonitoring(config, statusEmitter);
      }, 2000);
    }
    
    console.log('[Server] ✅ Initialization complete - Map-Ping V3 ready!');
    
  } catch (error) {
    console.error('[Server] ❌ Failed to initialize:', error);
    process.exit(1);
  }
})();

// Enhanced Routes with better error handling and caching

// Health check endpoint (lightweight, no database)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Combined dashboard endpoint (status + public config)
app.get('/api/dashboard', async (req, res) => {
  try {
    // Always use fresh config to ensure names are resolved correctly
    const freshConfig = loadConfig(configPath);
    const status = await getCurrentStatus(freshConfig);
    const publicConfig = {
      areas: freshConfig.areas || [],
      links: freshConfig.links || [],
      devices: (freshConfig.devices || []).map(device => ({
        ...device,
        // Include criticality in public config for UI
        criticality: device.criticality || 'normal'
      })),
      settings: {
        topology: (freshConfig.settings && freshConfig.settings.topology) || {
          showRemoteAreas: true,
          showLinkLatency: true,
          preferCompactLayout: false,
          autoIncludeUnlinkedDevices: true
        }
      }
    };
    
    const dashboardData = {
      status,
      config: publicConfig,
      lastUpdated: new Date().toISOString()
    };
    
    // Generate ETag for caching
    const etag = `"${Buffer.from(JSON.stringify(dashboardData)).toString('base64').slice(0, 16)}"`;
    res.set('ETag', etag);
    
    // Check if client has current version
    if (req.get('If-None-Match') === etag) {
      return res.status(304).end();
    }
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// Legacy status endpoint (kept for backward compatibility)
app.get('/api/status', async (req, res) => {
  try {
    console.log(`[API /status] Request received at ${new Date().toISOString()}`);
    // Always use fresh config to ensure names are resolved correctly
    const freshConfig = loadConfig(configPath);
    console.log(`[API /status] Config loaded: ${freshConfig.areas.length} areas, ${freshConfig.devices.length} devices`);
    console.log(`[API /status] Config areas:`, freshConfig.areas.map(a => ({ id: a.id, name: a.name })));
    console.log(`[API /status] Config devices:`, freshConfig.devices.map(d => ({ id: d.id, name: d.name, areaId: d.areaId })));
    const status = await getCurrentStatus(freshConfig);
    
    // Debug: Check for null names in response
    const linksWithNullNames = status.links.filter(link => 
      link.endpoints.some(ep => !ep.areaName && ep.areaId) || 
      link.endpoints.some(ep => !ep.deviceName && ep.deviceId)
    );
    if (linksWithNullNames.length > 0) {
      console.warn(`[API /status] ⚠️ ${linksWithNullNames.length} links have null names:`);
      linksWithNullNames.forEach(link => {
        link.endpoints.forEach((ep, idx) => {
          if ((ep.areaId && !ep.areaName) || (ep.deviceId && !ep.deviceName)) {
            console.warn(`[API /status]   - Link ${link.linkId}, endpoint ${idx}: areaId=${ep.areaId}, areaName=${ep.areaName}, deviceId=${ep.deviceId}, deviceName=${ep.deviceName}`);
          }
        });
      });
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status', details: error.message });
  }
});

app.get('/api/history/:deviceId', (req, res) => {
  try {
    const { getDeviceHistory } = require('./database');
    const { deviceId } = req.params;
    const { period = '7d' } = req.query;
    
    // Validate period parameter
    const validPeriods = ['1h', '24h', '7d', '30d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use: 1h, 24h, 7d, or 30d' });
    }
    
    const history = getDeviceHistory(deviceId, period);
    
    // Add cache headers for history data
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json({
      deviceId,
      period,
      data: history,
      count: history.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching device history:', error);
    res.status(500).json({ error: 'Failed to fetch device history', details: error.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

app.get('/api/config/public', (req, res) => {
  try {
    // Always use fresh config to ensure data is up-to-date
    const freshConfig = loadConfig(configPath);
    console.log(`[API /config/public] Config loaded: ${freshConfig.areas.length} areas, ${freshConfig.devices.length} devices`);
    
    // Return only public config with device criticality
    const publicConfig = {
      areas: freshConfig.areas || [],
      links: freshConfig.links || [],
      devices: (freshConfig.devices || []).map(device => ({
        ...device,
        criticality: device.criticality || 'normal'
      })),
      settings: {
        topology: (freshConfig.settings && freshConfig.settings.topology) || {
          showRemoteAreas: true,
          showLinkLatency: true,
          preferCompactLayout: false,
          autoIncludeUnlinkedDevices: true
        }
      },
      lastUpdated: new Date().toISOString()
    };
    
    // Validate config is not empty
    if (publicConfig.areas.length === 0 && publicConfig.devices.length === 0) {
      console.warn(`[API /config/public] ⚠️ Warning: Config is empty! Areas: ${freshConfig.areas.length}, Devices: ${freshConfig.devices.length}`);
    }
    
    // Add caching headers
    res.set('Cache-Control', 'public, max-age=30'); // Reduced cache time to 30 seconds
    
    // Generate ETag for better caching
    const etag = `"${Buffer.from(JSON.stringify(publicConfig)).toString('base64').slice(0, 16)}"`;
    res.set('ETag', etag);
    
    if (req.get('If-None-Match') === etag) {
      return res.status(304).end();
    }
    
    res.json(publicConfig);
  } catch (error) {
    console.error('Error fetching public config:', error);
    res.status(500).json({ error: 'Failed to fetch public config', details: error.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validate configuration
    if (!newConfig.areas || !newConfig.devices) {
      return res.status(400).json({ error: 'Invalid configuration: missing required fields' });
    }
    
    // Ensure devices have criticality set
    newConfig.devices = (newConfig.devices || []).map(device => ({
      ...device,
      criticality: device.criticality || 'normal'
    }));
    
    // Ensure settings exist with optimized defaults
    if (!newConfig.settings) {
      newConfig.settings = {
        pingInterval: 60, // Default to 1 minute
        thresholds: {
          latency: { good: 50, degraded: 150 },
          packetLoss: { good: 1, degraded: 5 }
        }
      };
    }
    
    if (!Array.isArray(newConfig.links)) {
      newConfig.links = [];
    }

    const { config: normalizedConfig, report } = saveConfig(newConfig);
    config = normalizedConfig;
    
    // Clear cache before restarting monitoring
    clearStatusCache();
    
    // V3: Check if Telegraf is available
    const telegrafStatus = await checkTelegrafStatus();
    let telegrafUpdated = false;
    
    if (telegrafStatus.installed) {
      console.log('[Config] Telegraf detected, updating configuration...');
      
      // Update Telegraf configuration with new device list
      const telegrafResult = await updateTelegrafConfig(normalizedConfig);
      
      if (telegrafResult.success) {
        console.log('[Config] Telegraf configuration updated successfully');
        telegrafUpdated = true;
        
        // Update config in Telegraf routes
        setTelegrafConfig(normalizedConfig);
      } else {
        console.warn('[Config] Failed to update Telegraf:', telegrafResult.error);
        // Don't fail the request, just log warning
      }
    } else {
      console.log('[Config] Telegraf not installed, using built-in monitor');
      // Fall back to built-in monitor
      restartMonitoring(config, statusEmitter);
    }
    
    res.json({ 
      success: true, 
      message: 'Configuration updated successfully',
      devicesCount: normalizedConfig.devices.length,
      areasCount: normalizedConfig.areas.length,
      linksCount: normalizedConfig.links.length,
      invalidLinksRemoved: report?.invalidLinks?.length || 0,
      telegrafUpdated,
      monitoringMode: telegrafStatus.installed ? 'telegraf' : 'builtin',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration', details: error.message });
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
    
    // Restart monitoring with WebSocket emitter
    startMonitoring(config, statusEmitter);
    
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

// Check database statistics
app.get('/api/database/stats', (req, res) => {
  try {
    const stats = getDatabaseStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get database stats', 
      details: error.message 
    });
  }
});

// Reset database - clears all ping history data
app.post('/api/database/reset', async (req, res) => {
  try {
    const { createBackup = true } = req.body; // Default to creating backup for safety
    
    // Reset the database (now async)
    await resetDatabase(createBackup);
    
    // Clear status cache
    clearStatusCache();
    
    res.json({ 
      success: true, 
      message: 'Database reset successfully',
      backupCreated: createBackup,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database reset error:', error);
    res.status(500).json({ 
      error: 'Failed to reset database', 
      details: error.message 
    });
  }
});

// Authentication routes
app.post('/api/auth/login', (req, res) => {
  try {
    const { password } = req.body;
    const authPath = path.join(__dirname, 'data', 'auth.json');
    
    if (!fs.existsSync(authPath)) {
      return res.status(401).json({ error: 'Authentication not configured' });
    }
    
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    
    if (password === authData.password) {
      const token = 'auth-token-' + Date.now(); // Simple token for now
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      res.json({ token, expiresAt: expiresAt.toISOString() });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: false }); // Simple implementation - always false for now
});

app.post('/api/auth/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const authPath = path.join(__dirname, 'data', 'auth.json');
    
    if (!fs.existsSync(authPath)) {
      return res.status(401).json({ error: 'Authentication not configured' });
    }
    
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    
    if (currentPassword === authData.password) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      
      const newAuthData = {
        password: newPassword,
        lastChanged: new Date().toISOString()
      };
      
      fs.writeFileSync(authPath, JSON.stringify(newAuthData, null, 2));
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Current password is incorrect' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Health check endpoint with system stats
app.get('/api/system/stats', async (req, res) => {
  try {
    const { getScheduler } = require('./monitor');
    const { getBatchWriter, getRedisManagerInstance } = require('./database');
    
    const scheduler = getScheduler();
    const batchWriter = getBatchWriter();
    const redisManager = getRedisManagerInstance();
    
    const stats = {
      scheduler: scheduler ? scheduler.getStats() : null,
      batchWriter: batchWriter ? batchWriter.getStats() : null,
      redis: redisManager ? await redisManager.healthCheck() : null,
      websocket: statusEmitter ? statusEmitter.getStats() : null,
      database: getDatabaseStats(),
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats', details: error.message });
  }
});

// V3: Monitoring status endpoint
app.get('/api/monitoring/status', async (req, res) => {
  try {
    const telegrafStatus = await checkTelegrafStatus();
    const flappingStats = getFlappingStats();
    
    const status = {
      mode: telegrafStatus.installed ? 'telegraf' : 'builtin',
      telegraf: telegrafStatus,
      devices: config?.devices?.length || 0,
      snmpDevices: config?.devices?.filter(d => d.snmpEnabled)?.length || 0,
      flappingDetection: {
        enabled: true,
        config: getFlappingConfig(),
        stats: flappingStats
      },
      pubsub: pubSubManager ? pubSubManager.getStatus() : null
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ error: 'Failed to get monitoring status', details: error.message });
  }
});

// V3: Get interface status for a device
app.get('/api/snmp/interfaces/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const interfaces = await getInterfaceStatus(deviceId);
    res.json(interfaces);
  } catch (error) {
    console.error('Error getting interface status:', error);
    res.status(500).json({ error: 'Failed to get interface status', details: error.message });
  }
});

// V3: Get flapping report
app.get('/api/snmp/flapping-report', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const report = await getFlappingReport(hours);
    res.json(report);
  } catch (error) {
    console.error('Error getting flapping report:', error);
    res.status(500).json({ error: 'Failed to get flapping report', details: error.message });
  }
});

// V3: Get Telegraf logs
app.get('/api/monitoring/telegraf/logs', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 50;
    const logs = await getTelegrafLogs(lines);
    res.json({ logs });
  } catch (error) {
    console.error('Error getting Telegraf logs:', error);
    res.status(500).json({ error: 'Failed to get logs', details: error.message });
  }
});

// V3: Update flapping detection configuration
app.post('/api/snmp/flapping-config', (req, res) => {
  try {
    const newConfig = req.body;
    updateFlappingConfig(newConfig);
    res.json({ success: true, config: getFlappingConfig() });
  } catch (error) {
    console.error('Error updating flapping config:', error);
    res.status(500).json({ error: 'Failed to update config', details: error.message });
  }
});

server.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});

