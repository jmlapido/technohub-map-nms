const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use data directory for persistence
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'database.sqlite');

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

// Initialize database lazily
let db = null;

// In-memory cache for status data
let statusCache = {
  data: null,
  timestamp: 0,
  maxAge: 30000 // 30 seconds
};

// Device criticality levels and their ping intervals (in seconds)
const CRITICALITY_INTERVALS = {
  'critical': 30,    // Critical devices ping every 30 seconds
  'high': 60,        // High priority ping every 1 minute
  'normal': 120,     // Normal devices ping every 2 minutes
  'low': 300         // Low priority ping every 5 minutes
};

function getDatabase() {
  if (!db) {
    try {
      db = new Database(dbPath);
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
  return db;
}

// Initialize database schema
function initDatabase() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ping_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL,
      latency INTEGER,
      packet_loss REAL,
      timestamp INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS ping_aggregates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      period_type TEXT NOT NULL, -- 'hourly' or 'daily'
      period_start INTEGER NOT NULL,
      avg_latency REAL,
      min_latency INTEGER,
      max_latency INTEGER,
      avg_packet_loss REAL,
      uptime_percent REAL,
      ping_count INTEGER,
      down_count INTEGER,
      degraded_count INTEGER
    );
    
    -- Optimized indexes
    CREATE INDEX IF NOT EXISTS idx_device_timestamp ON ping_history(device_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON ping_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_device_status_timestamp ON ping_history(device_id, status, timestamp);
    CREATE INDEX IF NOT EXISTS idx_status_timestamp ON ping_history(status, timestamp);
    
    -- Aggregate indexes
    CREATE INDEX IF NOT EXISTS idx_aggregates_device_period ON ping_aggregates(device_id, period_type, period_start);
    CREATE INDEX IF NOT EXISTS idx_aggregates_period_start ON ping_aggregates(period_start);
  `);
  
  console.log('Database initialized with optimized schema');
}

// Store ping result
function storePingResult(deviceId, status, latency, packetLoss) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO ping_history (device_id, status, latency, packet_loss, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(deviceId, status, latency, packetLoss, Date.now());
}

// Get offline duration for a device
function getOfflineDuration(deviceId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT timestamp FROM ping_history
    WHERE device_id = ? AND status = 'down'
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  const result = stmt.get(deviceId);
  if (result) {
    const offlineTime = result.timestamp;
    const now = Date.now();
    const duration = now - offlineTime;
    return duration;
  }
  return null;
}

// Get current status for all devices (with caching)
function getCurrentStatus(config, forceRefresh = false) {
  const now = Date.now();
  
  // Return cached data if still valid
  if (!forceRefresh && statusCache.data && (now - statusCache.timestamp) < statusCache.maxAge) {
    return statusCache.data;
  }
  
  const db = getDatabase();
  const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  // Get latest ping for each device (optimized query)
  const stmt = db.prepare(`
    SELECT device_id, status, latency, packet_loss, timestamp
    FROM ping_history p1
    WHERE timestamp > ? AND timestamp = (
      SELECT MAX(timestamp) FROM ping_history p2 
      WHERE p2.device_id = p1.device_id AND p2.timestamp > ?
    )
    ORDER BY device_id
  `);
  
  const results = stmt.all(oneMonthAgo, oneMonthAgo);
  
  // Group by device and get latest
  const deviceStatuses = {};
  results.forEach(row => {
    if (!deviceStatuses[row.device_id]) {
      deviceStatuses[row.device_id] = {
        deviceId: row.device_id,
        status: row.status,
        latency: row.latency,
        packetLoss: row.packet_loss,
        lastChecked: new Date(row.timestamp).toISOString()
      };
    }
  });
  
  const areaMap = new Map(config.areas.map(area => [area.id, area]));
  const deviceMap = new Map(config.devices.map(device => [device.id, device]));

  // Build area status
  const areaStatuses = config.areas.map(area => {
    const areaDevices = config.devices.filter(d => d.areaId === area.id);
    const devices = areaDevices.map(device => {
      const status = deviceStatuses[device.id] || {
        deviceId: device.id,
        status: 'unknown',
        lastChecked: new Date().toISOString()
      };
      
      // Add offline duration if device is down
      if (status.status === 'down') {
        const offlineDuration = getOfflineDuration(device.id);
        if (offlineDuration !== null) {
          status.offlineDuration = offlineDuration;
        }
      }
      
      return status;
    });
    
    // Determine area status based on devices
    let areaStatus = 'up';
    if (devices.some(d => d.status === 'down')) {
      areaStatus = 'down';
    } else if (devices.some(d => d.status === 'degraded')) {
      areaStatus = 'degraded';
    }
    
    return {
      areaId: area.id,
      status: areaStatus,
      devices
    };
  });
  
  const areaStatusMap = new Map(areaStatuses.map(areaStatus => [areaStatus.areaId, areaStatus]));

  // Build link status with device-level awareness
  const linkStatuses = config.links.map(link => {
    const rawEndpoints = Array.isArray(link.endpoints) ? link.endpoints.slice(0, 2) : [];
    while (rawEndpoints.length < 2) {
      rawEndpoints.push({});
    }

    const endpointDetails = rawEndpoints.map((endpoint, index) => {
      const safeEndpoint = endpoint || {};
      const fallbackAreaId = index === 0 ? link.from : link.to;
      const areaId = safeEndpoint.areaId || fallbackAreaId || null;
      const deviceId = safeEndpoint.deviceId || null;
      const area = areaId ? areaMap.get(areaId) : null;
      const device = deviceId ? deviceMap.get(deviceId) : null;
      const deviceStatus = device ? deviceStatuses[device.id] : null;
      const status = deviceStatus?.status || (areaId ? areaStatusMap.get(areaId)?.status || 'unknown' : 'unknown');

      return {
        areaId,
        areaName: area?.name || null,
        deviceId,
        deviceName: device?.name || null,
        status,
        latency: deviceStatus?.latency,
        packetLoss: deviceStatus?.packetLoss,
        lastChecked: deviceStatus?.lastChecked || null,
        interface: safeEndpoint.interface || null,
        interfaceType: safeEndpoint.interfaceType || link.type || null,
        label: safeEndpoint.label || null
      };
    });

    const endpointStatuses = endpointDetails.map(endpoint => endpoint.status).filter(Boolean);

    let linkStatus = 'unknown';
    if (endpointStatuses.includes('down')) {
      linkStatus = 'down';
    } else if (endpointStatuses.includes('degraded')) {
      linkStatus = 'degraded';
    } else if (endpointStatuses.includes('up')) {
      linkStatus = 'up';
    } else {
      // Fallback to area status if device data is unavailable
      const fallbackStatuses = endpointDetails
        .map(endpoint => areaStatusMap.get(endpoint.areaId || '')?.status)
        .filter(Boolean);
      if (fallbackStatuses.includes('down')) {
        linkStatus = 'down';
      } else if (fallbackStatuses.includes('degraded')) {
        linkStatus = 'degraded';
      } else if (fallbackStatuses.includes('up')) {
        linkStatus = 'up';
      }
    }

    const latencies = endpointDetails
      .map(endpoint => endpoint.latency)
      .filter(value => typeof value === 'number');

    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : undefined;

    const metadata = link.metadata && typeof link.metadata === 'object' ? link.metadata : {};

    return {
      linkId: link.id,
      status: linkStatus,
      latency: avgLatency,
      type: link.type || (endpointDetails[0]?.interfaceType === endpointDetails[1]?.interfaceType ? endpointDetails[0]?.interfaceType : undefined),
      metadata,
      endpoints: endpointDetails
    };
  });
  
  const statusData = {
    areas: areaStatuses,
    links: linkStatuses
  };
  
  // Update cache
  statusCache = {
    data: statusData,
    timestamp: now,
    maxAge: 30000
  };
  
  return statusData;
}

// Get device history with trending data (up to 1 month)
function getDeviceHistory(deviceId, period = '7d') {
  const db = getDatabase();
  let timeAgo;
  
  switch(period) {
    case '1h': timeAgo = Date.now() - (60 * 60 * 1000); break;
    case '24h': timeAgo = Date.now() - (24 * 60 * 60 * 1000); break;
    case '7d': timeAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); break;
    case '30d': timeAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); break;
    default: timeAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  }
  
  // For longer periods, use aggregated data when available
  if (period === '30d' || period === '7d') {
    const aggregateStmt = db.prepare(`
      SELECT 'hourly' as type, period_start as timestamp, avg_latency as latency, 
             avg_packet_loss as packet_loss, uptime_percent, ping_count
      FROM ping_aggregates
      WHERE device_id = ? AND period_type = 'hourly' AND period_start > ?
      ORDER BY period_start ASC
    `);
    
    const aggregateResults = aggregateStmt.all(deviceId, timeAgo);
    
    if (aggregateResults.length > 0) {
      return aggregateResults.map(row => ({
        status: row.uptime_percent > 90 ? 'up' : row.uptime_percent > 50 ? 'degraded' : 'down',
        latency: Math.round(row.latency || 0),
        packetLoss: row.packet_loss || 0,
        timestamp: new Date(row.timestamp).toISOString(),
        isAggregated: true,
        uptimePercent: row.uptime_percent,
        pingCount: row.ping_count
      }));
    }
  }
  
  // Fall back to raw data for shorter periods or when aggregates not available
  const stmt = db.prepare(`
    SELECT status, latency, packet_loss, timestamp
    FROM ping_history
    WHERE device_id = ? AND timestamp > ?
    ORDER BY timestamp ASC
  `);
  
  const results = stmt.all(deviceId, timeAgo);
  
  return results.map(row => ({
    status: row.status,
    latency: row.latency,
    packetLoss: row.packet_loss,
    timestamp: new Date(row.timestamp).toISOString(),
    isAggregated: false
  }));
}

// Generate hourly and daily aggregates
function generateAggregates() {
  const db = getDatabase();
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  try {
    // Generate hourly aggregates
    const hourlyStmt = db.prepare(`
      INSERT OR REPLACE INTO ping_aggregates 
      (device_id, period_type, period_start, avg_latency, min_latency, max_latency, 
       avg_packet_loss, uptime_percent, ping_count, down_count, degraded_count)
      SELECT 
        device_id,
        'hourly' as period_type,
        (timestamp / 3600000) * 3600000 as period_start,
        AVG(CASE WHEN latency IS NOT NULL THEN latency END) as avg_latency,
        MIN(CASE WHEN latency IS NOT NULL THEN latency END) as min_latency,
        MAX(CASE WHEN latency IS NOT NULL THEN latency END) as max_latency,
        AVG(CASE WHEN packet_loss IS NOT NULL THEN packet_loss END) as avg_packet_loss,
        (COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*)) as uptime_percent,
        COUNT(*) as ping_count,
        COUNT(CASE WHEN status = 'down' THEN 1 END) as down_count,
        COUNT(CASE WHEN status = 'degraded' THEN 1 END) as degraded_count
      FROM ping_history
      WHERE timestamp > ? AND timestamp < ?
      GROUP BY device_id, (timestamp / 3600000)
    `);
    
    const hourlyResult = hourlyStmt.run(oneDayAgo, oneHourAgo);
    
    // Generate daily aggregates
    const dailyStmt = db.prepare(`
      INSERT OR REPLACE INTO ping_aggregates 
      (device_id, period_type, period_start, avg_latency, min_latency, max_latency, 
       avg_packet_loss, uptime_percent, ping_count, down_count, degraded_count)
      SELECT 
        device_id,
        'daily' as period_type,
        (timestamp / 86400000) * 86400000 as period_start,
        AVG(CASE WHEN latency IS NOT NULL THEN latency END) as avg_latency,
        MIN(CASE WHEN latency IS NOT NULL THEN latency END) as min_latency,
        MAX(CASE WHEN latency IS NOT NULL THEN latency END) as max_latency,
        AVG(CASE WHEN packet_loss IS NOT NULL THEN packet_loss END) as avg_packet_loss,
        (COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*)) as uptime_percent,
        COUNT(*) as ping_count,
        COUNT(CASE WHEN status = 'down' THEN 1 END) as down_count,
        COUNT(CASE WHEN status = 'degraded' THEN 1 END) as degraded_count
      FROM ping_history
      WHERE timestamp > ? AND timestamp < ?
      GROUP BY device_id, (timestamp / 86400000)
    `);
    
    const dailyResult = dailyStmt.run(Date.now() - (7 * 24 * 60 * 60 * 1000), oneDayAgo);
    
    console.log(`Generated ${hourlyResult.changes} hourly and ${dailyResult.changes} daily aggregates`);
  } catch (error) {
    console.error('Error generating aggregates:', error);
  }
}

// Clean up old data (keep 1 month of raw data, 3 months of aggregates)
function cleanupOldData() {
  const db = getDatabase();
  const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  
  try {
    // Clean up raw ping history older than 1 month
    const rawStmt = db.prepare(`DELETE FROM ping_history WHERE timestamp < ?`);
    const rawResult = rawStmt.run(oneMonthAgo);
    
    // Clean up aggregates older than 3 months
    const aggregateStmt = db.prepare(`DELETE FROM ping_aggregates WHERE period_start < ?`);
    const aggregateResult = aggregateStmt.run(threeMonthsAgo);
    
    console.log(`Cleaned up ${rawResult.changes} old records and ${aggregateResult.changes} old aggregates`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Clear status cache
function clearStatusCache() {
  statusCache = {
    data: null,
    timestamp: 0,
    maxAge: 30000
  };
}

// Get device criticality ping intervals
function getDevicePingInterval(device) {
  const criticality = device.criticality || 'normal';
  return CRITICALITY_INTERVALS[criticality] || CRITICALITY_INTERVALS.normal;
}

// Run cleanup every hour and aggregation every 10 minutes
setInterval(cleanupOldData, 60 * 60 * 1000);
setInterval(generateAggregates, 10 * 60 * 1000);

// Generate initial aggregates
setTimeout(generateAggregates, 5000); // Wait 5 seconds after startup

module.exports = {
  initDatabase,
  storePingResult,
  getCurrentStatus,
  getDeviceHistory,
  getOfflineDuration,
  clearStatusCache,
  getDevicePingInterval,
  generateAggregates,
  CRITICALITY_INTERVALS
};

