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
// Cache only device statuses (raw data), not fully resolved status with names
// This ensures names are always resolved from current config
let statusCache = {
  deviceStatuses: null,
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

// Recover from database corruption
function recoverDatabase() {
  console.warn('Database corruption detected. Attempting recovery...');
  
  // Close existing connection if any
  if (db) {
    try {
      db.close();
    } catch (e) {
      // Ignore errors when closing corrupted db
    }
    db = null;
  }
  
  // Backup corrupted database
  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(dataDir, `database-corrupted-${Date.now()}.sqlite.backup`);
    try {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`Corrupted database backed up to: ${backupPath}`);
    } catch (error) {
      console.error('Failed to backup corrupted database:', error);
    }
    
    // Remove corrupted database
    try {
      fs.unlinkSync(dbPath);
      console.log('Removed corrupted database file');
    } catch (error) {
      console.error('Failed to remove corrupted database:', error);
    }
    
    // Also remove any journal/WAL files
    const journalPath = `${dbPath}-journal`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    
    [journalPath, walPath, shmPath].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          // Ignore errors
        }
      }
    });
  }
  
  // Create new database
  try {
    db = new Database(dbPath);
    console.log('New database created successfully');
    initDatabase();
    console.log('Database recovery completed');
    return true;
  } catch (error) {
    console.error('Failed to recover database:', error);
    return false;
  }
}

function getDatabase() {
  if (!db) {
    try {
      // Only check integrity if database file already exists
      const dbExists = fs.existsSync(dbPath);
      
      db = new Database(dbPath);
      
      // Verify database integrity only if it's an existing database
      if (dbExists) {
        try {
          const integrityResult = db.pragma('integrity_check');
          // integrity_check returns 'ok' or details of corruption
          if (integrityResult && Array.isArray(integrityResult) && integrityResult[0] && integrityResult[0].integrity_check !== 'ok') {
            throw new Error('Database integrity check failed');
          }
        } catch (error) {
          if (error.code === 'SQLITE_CORRUPT' || error.message.includes('database disk image is malformed') || error.message.includes('integrity check failed')) {
            console.error('Database integrity check failed:', error);
            if (!recoverDatabase()) {
              throw new Error('Failed to recover from database corruption');
            }
            return db;
          }
          throw error;
        }
      }
      
      console.log('Database connection established');
    } catch (error) {
      // Check for corruption errors
      if (error.code === 'SQLITE_CORRUPT' || error.message.includes('database disk image is malformed')) {
        console.error('Database corruption detected during connection:', error);
        if (recoverDatabase()) {
          return db;
        }
      }
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
  
  // Periodically check database integrity (every 100th call to avoid overhead)
  if (Math.random() < 0.01) {
    try {
      const quickCheck = db.pragma('quick_check');
      if (quickCheck && Array.isArray(quickCheck) && quickCheck[0] && quickCheck[0].quick_check !== 'ok') {
        throw new Error('Database quick check failed');
      }
    } catch (error) {
      if (error.code === 'SQLITE_CORRUPT' || error.message.includes('database disk image is malformed') || error.message.includes('check failed')) {
        console.error('Database corruption detected during operation:', error);
        if (recoverDatabase()) {
          return db;
        }
        throw error;
      }
    }
  }
  
  return db;
}

// Wrapper for database operations that handles corruption gracefully
function safeDbOperation(operation, defaultValue = null) {
  try {
    return operation();
  } catch (error) {
    if (error.code === 'SQLITE_CORRUPT' || error.message.includes('database disk image is malformed')) {
      console.error('Database corruption detected during operation:', error);
      if (recoverDatabase()) {
        try {
          return operation();
        } catch (retryError) {
          console.error('Operation failed after recovery:', retryError);
          return defaultValue;
        }
      }
      return defaultValue;
    }
    throw error;
  }
}

// Initialize database schema
function initDatabase() {
  try {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS ping_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        status TEXT NOT NULL,
        latency REAL,
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
  } catch (error) {
    if (error.code === 'SQLITE_CORRUPT' || error.message.includes('database disk image is malformed')) {
      console.error('Database corruption detected during initialization:', error);
      if (recoverDatabase()) {
        // Retry initialization after recovery
        return initDatabase();
      }
      throw error;
    }
    throw error;
  }
}

// Store ping result
function storePingResult(deviceId, status, latency, packetLoss) {
  return safeDbOperation(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO ping_history (device_id, status, latency, packet_loss, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(deviceId, status, latency, packetLoss, Date.now());
    return true;
  }, false);
}

// Get offline duration for a device
function getOfflineDuration(deviceId) {
  return safeDbOperation(() => {
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
  }, null);
}

// Get current status for all devices (with caching)
function getCurrentStatus(config, forceRefresh = false) {
  const now = Date.now();
  
  // Query database with corruption handling (or use cached device statuses)
  let deviceStatuses = {};
  let shouldRebuildCache = forceRefresh || !statusCache.deviceStatuses || (now - statusCache.timestamp) >= statusCache.maxAge;
  
  if (shouldRebuildCache) {
    const results = safeDbOperation(() => {
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
      
      return stmt.all(oneMonthAgo, oneMonthAgo);
    }, []);
    
    // Group by device and get latest
    if (results && Array.isArray(results)) {
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
    }
    
    // Cache device statuses for next time
    statusCache.deviceStatuses = deviceStatuses;
    statusCache.timestamp = now;
  } else {
    // Use cached device statuses, but always re-resolve names from current config
    deviceStatuses = statusCache.deviceStatuses || {};
  }
  
  const areaMap = new Map(config.areas.map(area => [area.id, area]));
  const deviceMap = new Map(config.devices.map(device => [device.id, device]));
  
  // Debug: Log config summary
  console.log(`[getCurrentStatus] Config loaded: ${config.areas.length} areas, ${config.devices.length} devices`);
  console.log(`[getCurrentStatus] Area IDs in config:`, Array.from(areaMap.keys()));
  console.log(`[getCurrentStatus] Device IDs in config:`, Array.from(deviceMap.keys()));

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
  // Filter out links that reference areas/devices not in current config
  const validLinks = config.links.filter(link => {
    const rawEndpoints = Array.isArray(link.endpoints) ? link.endpoints.slice(0, 2) : [];
    const fallbackAreaIdA = link.from || (rawEndpoints[0]?.areaId || null);
    const fallbackAreaIdB = link.to || (rawEndpoints[1]?.areaId || null);
    
    // Check if both endpoints have valid area references
    const areaAValid = !fallbackAreaIdA || areaMap.has(fallbackAreaIdA);
    const areaBValid = !fallbackAreaIdB || areaMap.has(fallbackAreaIdB);
    
    // If endpoints have device IDs, check they exist in config
    const deviceAValid = !rawEndpoints[0]?.deviceId || deviceMap.has(rawEndpoints[0].deviceId);
    const deviceBValid = !rawEndpoints[1]?.deviceId || deviceMap.has(rawEndpoints[1]?.deviceId);
    
    return areaAValid && areaBValid && deviceAValid && deviceBValid;
  });
  
  const linkStatuses = validLinks.map(link => {
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

      // Ensure names are always resolved - if lookup fails, log warning but don't return null
      const areaName = area?.name || null;
      const deviceName = device?.name || null;
      
      // Detailed debugging for name resolution
      if (areaId) {
        if (!areaName) {
          console.warn(`[getCurrentStatus] ⚠️ Area ID "${areaId}" not found in config map`);
          console.warn(`[getCurrentStatus]   - Link ID: ${link.id}`);
          console.warn(`[getCurrentStatus]   - Endpoint index: ${index}`);
          console.warn(`[getCurrentStatus]   - Available area IDs:`, Array.from(areaMap.keys()));
          console.warn(`[getCurrentStatus]   - Area map size: ${areaMap.size}`);
          if (areaMap.size > 0) {
            console.warn(`[getCurrentStatus]   - Sample area from map:`, Array.from(areaMap.values())[0]);
          }
        } else {
          console.log(`[getCurrentStatus] ✓ Area "${areaId}" resolved to "${areaName}"`);
        }
      }
      
      if (deviceId) {
        if (!deviceName) {
          console.warn(`[getCurrentStatus] ⚠️ Device ID "${deviceId}" not found in config map`);
          console.warn(`[getCurrentStatus]   - Link ID: ${link.id}`);
          console.warn(`[getCurrentStatus]   - Endpoint index: ${index}`);
          console.warn(`[getCurrentStatus]   - Available device IDs:`, Array.from(deviceMap.keys()));
          console.warn(`[getCurrentStatus]   - Device map size: ${deviceMap.size}`);
          if (deviceMap.size > 0) {
            console.warn(`[getCurrentStatus]   - Sample device from map:`, Array.from(deviceMap.values())[0]);
          }
        } else {
          console.log(`[getCurrentStatus] ✓ Device "${deviceId}" resolved to "${deviceName}"`);
        }
      }

      return {
        areaId,
        areaName: areaName,
        deviceId,
        deviceName: deviceName,
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
      ? parseFloat((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2))
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
  
  // Update cache with device statuses (not fully resolved data, so names are always fresh)
  statusCache = {
    deviceStatuses: deviceStatuses,
    timestamp: now,
    maxAge: 30000
  };
  
  return statusData;
}

// Get device history with trending data (up to 1 month)
function getDeviceHistory(deviceId, period = '7d') {
  return safeDbOperation(() => {
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
          latency: row.latency || 0,
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
  }, []);
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
    deviceStatuses: null,
    timestamp: 0,
    maxAge: 30000
  };
}

// Safely reset database - clears all data and reinitializes schema
async function resetDatabase(createBackup = true) {
  console.log('Starting database reset...');
  
  try {
    // Close existing connection if any
    if (db) {
      try {
        db.close();
      } catch (e) {
        console.warn('Error closing database connection:', e.message);
      }
      db = null;
    }
    
    // Wait a moment to ensure all connections are released
    // This helps on Windows where file locks can persist briefly
    const waitForRelease = (ms = 100) => {
      return new Promise(resolve => setTimeout(resolve, ms));
    };
    
    // Get row counts before deletion for verification
    let beforeCount = { history: 0, aggregates: 0 };
    if (fs.existsSync(dbPath)) {
      try {
        const checkDb = new Database(dbPath);
        const historyCount = checkDb.prepare('SELECT COUNT(*) as count FROM ping_history').get();
        const aggregatesCount = checkDb.prepare('SELECT COUNT(*) as count FROM ping_aggregates').get();
        beforeCount.history = historyCount?.count || 0;
        beforeCount.aggregates = aggregatesCount?.count || 0;
        checkDb.close();
        console.log(`Records before reset: ${beforeCount.history} history, ${beforeCount.aggregates} aggregates`);
      } catch (e) {
        console.warn('Could not count records before reset:', e.message);
      }
    }
    
    // Create backup if requested and database exists
    if (createBackup && fs.existsSync(dbPath)) {
      const backupPath = path.join(dataDir, `database-backup-${Date.now()}.sqlite`);
      try {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`Database backed up to: ${backupPath}`);
      } catch (error) {
        console.error('Failed to backup database:', error);
        if (createBackup) {
          throw new Error('Backup failed - aborting reset for safety');
        }
      }
    }
    
    // Remove any journal/WAL/SHM files first (they can lock the database)
    const journalPath = `${dbPath}-journal`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    
    [journalPath, walPath, shmPath].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`Removed ${path.basename(file)}`);
        } catch (e) {
          console.warn(`Could not remove ${path.basename(file)}:`, e.message);
        }
      }
    });
    
    await waitForRelease(200); // Wait for file locks to release
    
    // Delete all data from tables (safer than deleting file)
    if (fs.existsSync(dbPath)) {
      try {
        // Open database with WAL mode disabled temporarily for better compatibility
        const tempDb = new Database(dbPath);
        tempDb.pragma('journal_mode = DELETE'); // Disable WAL mode
        
        // Use transaction for atomicity
        const transaction = tempDb.transaction(() => {
          // Delete all records from tables
          tempDb.prepare('DELETE FROM ping_history').run();
          tempDb.prepare('DELETE FROM ping_aggregates').run();
        });
        
        transaction();
        
        // Verify deletion
        const historyAfter = tempDb.prepare('SELECT COUNT(*) as count FROM ping_history').get();
        const aggregatesAfter = tempDb.prepare('SELECT COUNT(*) as count FROM ping_aggregates').get();
        
        const afterCount = {
          history: historyAfter?.count || 0,
          aggregates: aggregatesAfter?.count || 0
        };
        
        if (afterCount.history > 0 || afterCount.aggregates > 0) {
          throw new Error(`Deletion incomplete: ${afterCount.history} history, ${afterCount.aggregates} aggregates still exist`);
        }
        
        // Vacuum to reclaim space and optimize
        tempDb.exec('VACUUM');
        
        tempDb.close();
        console.log(`Database tables cleared: ${beforeCount.history} history and ${beforeCount.aggregates} aggregate records deleted`);
      } catch (error) {
        console.warn('Failed to clear tables, attempting file deletion:', error.message);
        
        // Fallback: delete the file and recreate
        try {
          // Close any connections first
          if (fs.existsSync(dbPath)) {
            try {
              const closeDb = new Database(dbPath);
              closeDb.close();
            } catch (e) {
              // Ignore - file may already be locked or closed
            }
          }
          
          await waitForRelease(300);
          
          // Remove all related files
          [dbPath, journalPath, walPath, shmPath].forEach(file => {
            if (fs.existsSync(file)) {
              try {
                fs.unlinkSync(file);
                console.log(`Deleted ${path.basename(file)}`);
              } catch (e) {
                console.warn(`Could not delete ${path.basename(file)}:`, e.message);
              }
            }
          });
          
          console.log('Database file deleted - will be recreated on next connection');
        } catch (deleteError) {
          console.error('Failed to delete database file:', deleteError);
          throw new Error('Failed to reset database: ' + deleteError.message);
        }
      }
    }
    
    // Reinitialize database connection and schema
    db = null; // Force new connection
    await waitForRelease(100);
    initDatabase();
    
    // Verify database is empty
    const verifyDb = getDatabase();
    const verifyHistory = verifyDb.prepare('SELECT COUNT(*) as count FROM ping_history').get();
    const verifyAggregates = verifyDb.prepare('SELECT COUNT(*) as count FROM ping_aggregates').get();
    
    if ((verifyHistory?.count || 0) > 0 || (verifyAggregates?.count || 0) > 0) {
      throw new Error('Database reset verification failed - data still exists');
    }
    
    console.log('Database reset verified: 0 records remaining');
    
    // Clear status cache
    clearStatusCache();
    
    console.log('Database reset completed successfully');
    return true;
  } catch (error) {
    console.error('Error resetting database:', error);
    // Reset db variable on error to allow retry
    db = null;
    throw error;
  }
}

// Get database statistics
function getDatabaseStats() {
  return safeDbOperation(() => {
    const db = getDatabase();
    const historyCount = db.prepare('SELECT COUNT(*) as count FROM ping_history').get();
    const aggregatesCount = db.prepare('SELECT COUNT(*) as count FROM ping_aggregates').get();
    
    return {
      pingHistory: historyCount?.count || 0,
      aggregates: aggregatesCount?.count || 0
    };
  }, { pingHistory: 0, aggregates: 0 });
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
  resetDatabase,
  getDatabaseStats,
  CRITICALITY_INTERVALS
};

