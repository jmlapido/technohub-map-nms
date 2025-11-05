const ping = require('ping');
const { storePingResult, getDevicePingInterval, clearStatusCache } = require('./database');
const PingScheduler = require('./schedulers/PingScheduler');

// Use PingScheduler instead of individual intervals
let scheduler = null;
let currentConfig = null;
let isMonitoring = false;
let statusEmitter = null; // WebSocket emitter for real-time updates

// Batch processing for better performance
const BATCH_SIZE = 10;
const MAX_CONCURRENT_PINGS = 5;

function formatLatencyForLog(latency) {
  if (typeof latency === 'number' && Number.isFinite(latency)) {
    // For values less than 1ms, show decimal precision (e.g., 0.75ms, 0.20ms)
    if (latency < 1 && latency > 0) {
      return `${latency.toFixed(2)}ms`;
    }

    // For zero or negative values, show as 0.00ms
    if (latency <= 0) {
      return '0.00ms';
    }

    // For values >= 1ms, show integer if whole number, otherwise 1 decimal place
    const displayValue = Number.isInteger(latency)
      ? latency.toString()
      : latency.toFixed(1);

    return `${displayValue}ms`;
  }

  return '0.00ms';
}

function startMonitoring(config, emitter = null) {
  stopMonitoring();
  currentConfig = config;
  isMonitoring = true;
  statusEmitter = emitter;
  
  console.log('[Monitor] Starting optimized monitoring with queue-based scheduler...');
  
  // Initialize scheduler
  if (!scheduler) {
    scheduler = new PingScheduler({
      tickInterval: 10000, // 10 seconds
      maxConcurrentPings: 5,
      deviceStaggerDelay: 50 // 50ms between devices
    });
    
    // Set up ping handler
    scheduler.onPingStart = (device) => {
      pingDevice(device);
    };
  }
  
  // Add all devices to scheduler
  currentConfig.devices.forEach(device => {
    const pingInterval = getDevicePingInterval(device);
    scheduler.addDevice(device, pingInterval);
  });
  
  // Start scheduler
  scheduler.start();
  
  // Initial ping for all devices (staggered)
  setTimeout(() => {
    pingAllDevices();
  }, 1000);
  
  console.log(`[Monitor] Monitoring ${currentConfig.devices.length} devices with scheduler`);
}

function stopMonitoring() {
  isMonitoring = false;
  
  if (scheduler) {
    scheduler.stop();
    scheduler.clearDevices();
  }
  
  console.log('[Monitor] Monitoring stopped');
}

// Ping all devices (used for initial startup)
async function pingAllDevices() {
  if (!currentConfig || !isMonitoring) return;
  
  console.log('Initial ping for all devices...');
  
  // Process devices in batches to avoid overwhelming the network
  const devices = currentConfig.devices;
  for (let i = 0; i < devices.length; i += BATCH_SIZE) {
    const batch = devices.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(device => pingDevice(device));
    
    try {
      await Promise.all(batchPromises);
    } catch (error) {
      console.error('Error in batch ping:', error);
    }
    
    // Small delay between batches to prevent network congestion
    if (i + BATCH_SIZE < devices.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Clear status cache after batch update
  clearStatusCache();
}

// Enhanced ping function with better error handling and performance
async function pingDevice(device) {
  if (!isMonitoring) return;
  
  const startTime = Date.now();
  const criticality = device.criticality || 'normal';
  
  try {
    // Extract IP address without port
    const ipAddress = device.ip.split(':')[0];
    
    // Validate IP address
    if (!isValidIP(ipAddress)) {
      throw new Error(`Invalid IP address: ${ipAddress}`);
    }
    
    // Adjust ping parameters based on criticality
    const pingOptions = {
      timeout: criticality === 'critical' ? 3 : 5,
      min_reply: criticality === 'critical' ? 2 : 3,
      numeric: true // Use numeric output for better performance
    };
    
    const result = await ping.promise.probe(ipAddress, pingOptions);
    
    let status = 'down';
    let latency = undefined;
    let packetLoss = undefined;
    
    if (result.alive) {
      // Preserve decimal precision, especially for values less than 1ms
      latency = parseFloat(result.avg);
      packetLoss = result.packetLoss ? parseFloat(result.packetLoss) : 0;
      
      // Apply device-specific thresholds if available, otherwise use global
      const thresholds = device.thresholds || currentConfig.settings.thresholds;
      
      if (latency <= thresholds.latency.good && packetLoss <= thresholds.packetLoss.good) {
        status = 'up';
      } else if (latency <= thresholds.latency.degraded && packetLoss <= thresholds.packetLoss.degraded) {
        status = 'degraded';
      } else {
        status = 'down';
      }
    }
    
    // Store result (now async)
    await storePingResult(device.id, status, latency, packetLoss);
    
    // Record success in scheduler
    if (scheduler) {
      scheduler.recordSuccess(device.id);
    }
    
    const duration = Date.now() - startTime;
    const logLevel = criticality === 'critical' ? 'info' : 'debug';
    
    if (logLevel === 'info' || status !== 'up') {
      console.log(`[${criticality.toUpperCase()}] ${device.name} (${device.ip}): ${status} - ${formatLatencyForLog(latency)} (${duration}ms total)`);
    }
    
    // Emit WebSocket update if available
    if (statusEmitter) {
      statusEmitter.emitDeviceUpdate(device.id, {
        deviceId: device.id,
        status,
        latency,
        packetLoss,
        lastChecked: new Date().toISOString()
      });
    }
    
    // Clear cache only if status might have changed
    if (status !== 'up') {
      clearStatusCache();
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${criticality.toUpperCase()}] Error pinging ${device.name} (${device.ip}): ${error.message} (${duration}ms)`);
    
    // Record failure in scheduler
    if (scheduler) {
      scheduler.recordFailure(device.id);
    }
    
    // Store as down with error context
    await storePingResult(device.id, 'down', undefined, undefined);
    
    // Emit WebSocket update
    if (statusEmitter) {
      statusEmitter.emitDeviceUpdate(device.id, {
        deviceId: device.id,
        status: 'down',
        lastChecked: new Date().toISOString()
      });
    }
    
    clearStatusCache(); // Clear cache on errors
  }
}

// Utility function to validate IP addresses
function isValidIP(ip) {
  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

// Restart monitoring when config changes
function restartMonitoring(newConfig, emitter = null) {
  console.log('[Monitor] Restarting monitoring with new configuration...');
  stopMonitoring();
  currentConfig = newConfig;
  statusEmitter = emitter;
  setTimeout(() => startMonitoring(newConfig, emitter), 1000);
}

// Get scheduler instance (for stats/monitoring)
function getScheduler() {
  return scheduler;
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  restartMonitoring,
  getScheduler,
  pingDevice // Export for manual testing
};



