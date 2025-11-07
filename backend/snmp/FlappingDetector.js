/**
 * Flapping Detection Module
 * 
 * Detects unstable network interfaces by tracking:
 * - Speed changes (10Mbps → 100Mbps → 10Mbps)
 * - Status changes (up → down → up)
 * - High frequency changes within time window
 * 
 * @module FlappingDetector
 * @version 3.0.0
 */

const { storeFlappingEvent } = require('./snmp-storage');

// In-memory tracking of interface history
const interfaceHistory = new Map(); // Key: "deviceId:ifIndex"

// Flapping detection thresholds (configurable)
const FLAPPING_CONFIG = {
  windowMinutes: 10,           // Time window to analyze
  changeThreshold: 5,          // Number of changes to trigger alert
  minSpeedChangeMbps: 10,      // Minimum speed change to consider (ignore small fluctuations)
  historySize: 100             // Number of readings to keep per interface
};

/**
 * Detect flapping for an interface
 * @param {string} deviceId - Device ID
 * @param {number} ifIndex - Interface index
 * @param {string} ifName - Interface name
 * @param {Object} currentState - Current interface state
 * @returns {Promise<Object|null>} Flapping event or null
 */
async function detectFlapping(deviceId, ifIndex, ifName, currentState) {
  try {
    const key = `${deviceId}:${ifIndex}`;
    
    // Get or create history for this interface
    if (!interfaceHistory.has(key)) {
      interfaceHistory.set(key, {
        readings: [],
        changes: [],
        lastAlertTime: 0
      });
    }
    
    const history = interfaceHistory.get(key);
    const { operStatus, speedMbps, timestamp } = currentState;
    
    // Add current reading to history
    history.readings.push({
      operStatus,
      speedMbps,
      timestamp
    });
    
    // Trim history to max size
    if (history.readings.length > FLAPPING_CONFIG.historySize) {
      history.readings.shift();
    }
    
    // Need at least 2 readings to detect changes
    if (history.readings.length < 2) {
      return null;
    }
    
    // Get previous reading
    const previous = history.readings[history.readings.length - 2];
    const current = history.readings[history.readings.length - 1];
    
    // Detect speed change
    const speedChanged = Math.abs(previous.speedMbps - current.speedMbps) >= FLAPPING_CONFIG.minSpeedChangeMbps;
    
    // Detect status change
    const statusChanged = previous.operStatus !== current.operStatus;
    
    // If no changes, return early
    if (!speedChanged && !statusChanged) {
      return null;
    }
    
    // Record change
    const change = {
      timestamp: current.timestamp,
      type: speedChanged ? 'speed_change' : 'status_change',
      fromSpeed: previous.speedMbps,
      toSpeed: current.speedMbps,
      fromStatus: previous.operStatus,
      toStatus: current.operStatus
    };
    
    history.changes.push(change);
    
    // Log the change
    if (speedChanged) {
      console.log(`[Flapping] Speed change detected: ${deviceId} ${ifName} ${previous.speedMbps}→${current.speedMbps}Mbps`);
    }
    if (statusChanged) {
      console.log(`[Flapping] Status change detected: ${deviceId} ${ifName} ${previous.operStatus === 1 ? 'UP' : 'DOWN'}→${current.operStatus === 1 ? 'UP' : 'DOWN'}`);
    }
    
    // Analyze flapping within time window
    const windowStart = current.timestamp - (FLAPPING_CONFIG.windowMinutes * 60 * 1000);
    const recentChanges = history.changes.filter(c => c.timestamp >= windowStart);
    
    // Count changes by type
    const speedChanges = recentChanges.filter(c => c.type === 'speed_change').length;
    const statusChanges = recentChanges.filter(c => c.type === 'status_change').length;
    const totalChanges = recentChanges.length;
    
    // Determine if flapping
    const isFlapping = totalChanges >= FLAPPING_CONFIG.changeThreshold;
    
    // Determine severity
    let severity = 'info';
    if (totalChanges >= FLAPPING_CONFIG.changeThreshold) {
      severity = 'warning';
    }
    if (totalChanges >= FLAPPING_CONFIG.changeThreshold * 2) {
      severity = 'critical';
    }
    
    // Only alert if flapping detected
    if (!isFlapping) {
      return null;
    }
    
    // Prevent alert spam (only alert every 5 minutes for same interface)
    const timeSinceLastAlert = current.timestamp - history.lastAlertTime;
    if (timeSinceLastAlert < 5 * 60 * 1000) {
      return null; // Skip alert, too soon
    }
    
    // Update last alert time
    history.lastAlertTime = current.timestamp;
    
    // Create flapping event
    const event = {
      deviceId,
      ifIndex,
      ifName,
      eventType: speedChanged ? 'speed_change' : 'status_change',
      fromSpeed: previous.speedMbps,
      toSpeed: current.speedMbps,
      fromStatus: previous.operStatus,
      toStatus: current.operStatus,
      severity,
      timestamp: current.timestamp,
      changes: {
        total: totalChanges,
        speed: speedChanges,
        status: statusChanges,
        windowMinutes: FLAPPING_CONFIG.windowMinutes
      }
    };
    
    // Store flapping event in database
    await storeFlappingEvent(event);
    
    console.warn(`[Flapping] ⚠️ FLAPPING DETECTED: ${deviceId} ${ifName} - ${totalChanges} changes in ${FLAPPING_CONFIG.windowMinutes} minutes`);
    
    return event;
    
  } catch (error) {
    console.error('[Flapping] Error detecting flapping:', error);
    return null;
  }
}

/**
 * Get interface history for debugging
 * @param {string} deviceId - Device ID
 * @param {number} ifIndex - Interface index
 * @returns {Object|null} Interface history
 */
function getInterfaceHistory(deviceId, ifIndex) {
  const key = `${deviceId}:${ifIndex}`;
  return interfaceHistory.get(key) || null;
}

/**
 * Clear interface history (for testing or reset)
 * @param {string} deviceId - Device ID (optional, clears all if not provided)
 * @param {number} ifIndex - Interface index (optional)
 */
function clearHistory(deviceId = null, ifIndex = null) {
  if (!deviceId) {
    // Clear all history
    interfaceHistory.clear();
    console.log('[Flapping] All interface history cleared');
    return;
  }
  
  if (ifIndex === null) {
    // Clear all interfaces for device
    const keysToDelete = [];
    for (const key of interfaceHistory.keys()) {
      if (key.startsWith(`${deviceId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => interfaceHistory.delete(key));
    console.log(`[Flapping] Cleared history for device ${deviceId}: ${keysToDelete.length} interfaces`);
  } else {
    // Clear specific interface
    const key = `${deviceId}:${ifIndex}`;
    interfaceHistory.delete(key);
    console.log(`[Flapping] Cleared history for ${key}`);
  }
}

/**
 * Update flapping configuration
 * @param {Object} config - New configuration
 */
function updateConfig(config) {
  if (config.windowMinutes !== undefined) {
    FLAPPING_CONFIG.windowMinutes = config.windowMinutes;
  }
  if (config.changeThreshold !== undefined) {
    FLAPPING_CONFIG.changeThreshold = config.changeThreshold;
  }
  if (config.minSpeedChangeMbps !== undefined) {
    FLAPPING_CONFIG.minSpeedChangeMbps = config.minSpeedChangeMbps;
  }
  if (config.historySize !== undefined) {
    FLAPPING_CONFIG.historySize = config.historySize;
  }
  
  console.log('[Flapping] Configuration updated:', FLAPPING_CONFIG);
}

/**
 * Get current configuration
 * @returns {Object} Current configuration
 */
function getConfig() {
  return { ...FLAPPING_CONFIG };
}

/**
 * Get statistics about tracked interfaces
 * @returns {Object} Statistics
 */
function getStats() {
  const stats = {
    trackedInterfaces: interfaceHistory.size,
    interfaces: []
  };
  
  for (const [key, history] of interfaceHistory.entries()) {
    const [deviceId, ifIndex] = key.split(':');
    const recentChanges = history.changes.filter(
      c => c.timestamp >= Date.now() - (FLAPPING_CONFIG.windowMinutes * 60 * 1000)
    );
    
    stats.interfaces.push({
      deviceId,
      ifIndex: parseInt(ifIndex),
      readingsCount: history.readings.length,
      totalChanges: history.changes.length,
      recentChanges: recentChanges.length,
      isFlapping: recentChanges.length >= FLAPPING_CONFIG.changeThreshold,
      lastReading: history.readings[history.readings.length - 1]
    });
  }
  
  // Sort by most recent changes
  stats.interfaces.sort((a, b) => b.recentChanges - a.recentChanges);
  
  return stats;
}

module.exports = {
  detectFlapping,
  getInterfaceHistory,
  clearHistory,
  updateConfig,
  getConfig,
  getStats
};


