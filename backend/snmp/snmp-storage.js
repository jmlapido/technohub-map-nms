/**
 * SNMP Data Storage Module
 * 
 * Handles storage of SNMP metrics:
 * - Interface statistics (speed, status, errors)
 * - Wireless statistics (signal, rates)
 * 
 * @module snmp-storage
 * @version 3.0.0
 */

const { getDatabase } = require('../database');
const { getRedisManagerInstance } = require('../database');

/**
 * Store interface metrics in database
 * @param {Object} data - Interface metric data
 * @returns {Promise<boolean>} Success status
 */
async function storeInterfaceMetrics(data) {
  try {
    const {
      deviceId,
      ifIndex,
      ifName,
      ifDescr,
      operStatus,
      adminStatus,
      speedMbps,
      inOctets,
      outOctets,
      inErrors,
      outErrors,
      inDiscards,
      outDiscards,
      timestamp
    } = data;
    
    // Store in SQLite
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO interface_history (
        device_id, if_index, if_name, if_descr,
        oper_status, admin_status, speed_mbps,
        in_octets, out_octets,
        in_errors, out_errors,
        in_discards, out_discards,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      deviceId,
      ifIndex,
      ifName,
      ifDescr,
      operStatus,
      adminStatus,
      speedMbps,
      inOctets,
      outOctets,
      inErrors,
      outErrors,
      inDiscards,
      outDiscards,
      timestamp
    );
    
    // Store latest state in Redis for fast access
    const redis = getRedisManagerInstance();
    if (redis && redis.isAvailable()) {
      const key = `interface:status:${deviceId}:${ifIndex}`;
      await redis.set(key, {
        deviceId,
        ifIndex,
        ifName,
        operStatus,
        speedMbps,
        inErrors,
        outErrors,
        timestamp,
        lastChecked: new Date(timestamp).toISOString()
      }, 3600); // 1 hour TTL
    }
    
    return true;
    
  } catch (error) {
    console.error('[SNMP Storage] Error storing interface metrics:', error);
    return false;
  }
}

/**
 * Store wireless statistics in database
 * @param {Object} data - Wireless metric data
 * @returns {Promise<boolean>} Success status
 */
async function storeWirelessStats(data) {
  try {
    const {
      deviceId,
      ssid,
      signal,
      noiseFloor,
      txRate,
      rxRate,
      timestamp
    } = data;
    
    // Store in SQLite
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO wireless_stats (
        device_id, ssid, signal, noise_floor, tx_rate, rx_rate, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      deviceId,
      ssid,
      signal,
      noiseFloor,
      txRate,
      rxRate,
      timestamp
    );
    
    // Store latest state in Redis
    const redis = getRedisManagerInstance();
    if (redis && redis.isAvailable()) {
      const key = `wireless:status:${deviceId}`;
      await redis.set(key, {
        deviceId,
        ssid,
        signal,
        noiseFloor,
        txRate,
        rxRate,
        timestamp,
        lastChecked: new Date(timestamp).toISOString()
      }, 3600); // 1 hour TTL
    }
    
    return true;
    
  } catch (error) {
    console.error('[SNMP Storage] Error storing wireless stats:', error);
    return false;
  }
}

/**
 * Get interface status for a device
 * @param {string} deviceId - Device ID
 * @returns {Promise<Array>} Array of interface statuses
 */
async function getInterfaceStatus(deviceId) {
  try {
    // Try Redis first
    const redis = getRedisManagerInstance();
    if (redis && redis.isAvailable()) {
      const pattern = `interface:status:${deviceId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        const interfaces = [];
        for (const key of keys) {
          const data = await redis.get(key);
          if (data) {
            interfaces.push(data);
          }
        }
        return interfaces;
      }
    }
    
    // Fall back to SQLite
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        device_id as deviceId,
        if_index as ifIndex,
        if_name as ifName,
        oper_status as operStatus,
        speed_mbps as speedMbps,
        in_errors as inErrors,
        out_errors as outErrors,
        timestamp
      FROM interface_history
      WHERE device_id = ?
      AND timestamp = (
        SELECT MAX(timestamp)
        FROM interface_history
        WHERE device_id = ? AND if_index = interface_history.if_index
      )
      ORDER BY if_index
    `);
    
    const results = stmt.all(deviceId, deviceId);
    return results.map(row => ({
      ...row,
      lastChecked: new Date(row.timestamp).toISOString()
    }));
    
  } catch (error) {
    console.error('[SNMP Storage] Error getting interface status:', error);
    return [];
  }
}

/**
 * Get interface history
 * @param {string} deviceId - Device ID
 * @param {number} ifIndex - Interface index
 * @param {number} hours - Number of hours of history
 * @returns {Promise<Array>} Array of historical metrics
 */
async function getInterfaceHistory(deviceId, ifIndex, hours = 24) {
  try {
    const db = getDatabase();
    const timestamp = Date.now() - (hours * 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      SELECT *
      FROM interface_history
      WHERE device_id = ? AND if_index = ? AND timestamp > ?
      ORDER BY timestamp ASC
    `);
    
    return stmt.all(deviceId, ifIndex, timestamp);
    
  } catch (error) {
    console.error('[SNMP Storage] Error getting interface history:', error);
    return [];
  }
}

/**
 * Store flapping event
 * @param {Object} event - Flapping event data
 * @returns {Promise<boolean>} Success status
 */
async function storeFlappingEvent(event) {
  try {
    const {
      deviceId,
      ifIndex,
      ifName,
      eventType,
      fromSpeed,
      toSpeed,
      fromStatus,
      toStatus,
      severity,
      timestamp
    } = event;
    
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO flapping_events (
        device_id, if_index, if_name, event_type,
        from_speed, to_speed, from_status, to_status,
        severity, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      deviceId,
      ifIndex,
      ifName,
      eventType,
      fromSpeed,
      toSpeed,
      fromStatus,
      toStatus,
      severity,
      timestamp
    );
    
    return true;
    
  } catch (error) {
    console.error('[SNMP Storage] Error storing flapping event:', error);
    return false;
  }
}

/**
 * Get flapping events for a device
 * @param {string} deviceId - Device ID
 * @param {number} hours - Number of hours to look back
 * @returns {Promise<Array>} Array of flapping events
 */
async function getFlappingEvents(deviceId, hours = 24) {
  try {
    const db = getDatabase();
    const timestamp = Date.now() - (hours * 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      SELECT *
      FROM flapping_events
      WHERE device_id = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `);
    
    return stmt.all(deviceId, timestamp);
    
  } catch (error) {
    console.error('[SNMP Storage] Error getting flapping events:', error);
    return [];
  }
}

/**
 * Get flapping report for all devices
 * @param {number} hours - Number of hours to analyze
 * @returns {Promise<Array>} Flapping report
 */
async function getFlappingReport(hours = 24) {
  try {
    const db = getDatabase();
    const timestamp = Date.now() - (hours * 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      SELECT 
        device_id as deviceId,
        if_index as ifIndex,
        if_name as ifName,
        COUNT(*) as changeCount,
        MAX(timestamp) as lastChange,
        MIN(timestamp) as firstChange,
        GROUP_CONCAT(event_type) as eventTypes
      FROM flapping_events
      WHERE timestamp > ?
      GROUP BY device_id, if_index
      HAVING changeCount > 0
      ORDER BY changeCount DESC
    `);
    
    const results = stmt.all(timestamp);
    
    return results.map(row => ({
      ...row,
      lastChange: new Date(row.lastChange).toISOString(),
      firstChange: new Date(row.firstChange).toISOString(),
      isFlapping: row.changeCount >= 5 // Threshold: 5+ changes = flapping
    }));
    
  } catch (error) {
    console.error('[SNMP Storage] Error getting flapping report:', error);
    return [];
  }
}

module.exports = {
  storeInterfaceMetrics,
  storeWirelessStats,
  getInterfaceStatus,
  getInterfaceHistory,
  storeFlappingEvent,
  getFlappingEvents,
  getFlappingReport
};


