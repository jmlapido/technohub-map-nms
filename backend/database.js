const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Initialize database schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ping_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL,
      latency INTEGER,
      packet_loss REAL,
      timestamp INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_device_timestamp ON ping_history(device_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON ping_history(timestamp);
  `);
  
  console.log('Database initialized');
}

// Store ping result
function storePingResult(deviceId, status, latency, packetLoss) {
  const stmt = db.prepare(`
    INSERT INTO ping_history (device_id, status, latency, packet_loss, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(deviceId, status, latency, packetLoss, Date.now());
}

// Get offline duration for a device
function getOfflineDuration(deviceId) {
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

// Get current status for all devices
function getCurrentStatus(config) {
  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
  
  // Get latest ping for each device
  const stmt = db.prepare(`
    SELECT device_id, status, latency, packet_loss, timestamp
    FROM ping_history
    WHERE timestamp > ?
    ORDER BY device_id, timestamp DESC
  `);
  
  const results = stmt.all(threeDaysAgo);
  
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
  
  // Build link status
  const linkStatuses = config.links.map(link => {
    const fromArea = config.areas.find(a => a.id === link.from);
    const toArea = config.areas.find(a => a.id === link.to);
    
    if (!fromArea || !toArea) {
      return { linkId: link.id, status: 'unknown' };
    }
    
    const fromDevices = config.devices.filter(d => d.areaId === link.from);
    const toDevices = config.devices.filter(d => d.areaId === link.to);
    
    const fromStatus = fromDevices.map(d => deviceStatuses[d.id]?.status || 'unknown');
    const toStatus = toDevices.map(d => deviceStatuses[d.id]?.status || 'unknown');
    
    let linkStatus = 'up';
    if (fromStatus.includes('down') || toStatus.includes('down')) {
      linkStatus = 'down';
    } else if (fromStatus.includes('degraded') || toStatus.includes('degraded')) {
      linkStatus = 'degraded';
    }
    
    // Calculate average latency for link
    const allLatencies = [
      ...fromDevices.map(d => deviceStatuses[d.id]?.latency).filter(Boolean),
      ...toDevices.map(d => deviceStatuses[d.id]?.latency).filter(Boolean)
    ];
    
    const avgLatency = allLatencies.length > 0
      ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
      : undefined;
    
    return {
      linkId: link.id,
      status: linkStatus,
      latency: avgLatency
    };
  });
  
  return {
    areas: areaStatuses,
    links: linkStatuses
  };
}

// Get device history (last 3 days)
function getDeviceHistory(deviceId) {
  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
  
  const stmt = db.prepare(`
    SELECT status, latency, packet_loss, timestamp
    FROM ping_history
    WHERE device_id = ? AND timestamp > ?
    ORDER BY timestamp ASC
  `);
  
  const results = stmt.all(deviceId, threeDaysAgo);
  
  return results.map(row => ({
    status: row.status,
    latency: row.latency,
    packetLoss: row.packet_loss,
    timestamp: new Date(row.timestamp).toISOString()
  }));
}

// Clean up old data (older than 3 days)
function cleanupOldData() {
  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
  
  const stmt = db.prepare(`
    DELETE FROM ping_history WHERE timestamp < ?
  `);
  
  const result = stmt.run(threeDaysAgo);
  console.log(`Cleaned up ${result.changes} old records`);
}

// Run cleanup every hour
setInterval(cleanupOldData, 60 * 60 * 1000);

module.exports = {
  initDatabase,
  storePingResult,
  getCurrentStatus,
  getDeviceHistory,
  getOfflineDuration
};

