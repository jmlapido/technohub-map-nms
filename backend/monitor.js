const ping = require('ping');
const { storePingResult, getDevicePingInterval, clearStatusCache } = require('./database');

// Store multiple intervals for different device criticalities
let deviceIntervals = new Map();
let currentConfig = null;
let isMonitoring = false;

// Batch processing for better performance
const BATCH_SIZE = 10;
const MAX_CONCURRENT_PINGS = 5;

function formatLatencyForLog(latency) {
  if (typeof latency === 'number' && Number.isFinite(latency)) {
    if (latency <= 0) {
      return 'sub 0ms';
    }

    if (latency < 1) {
      return '<1ms';
    }

    return `${latency}ms`;
  }

  return 'sub 0ms';
}

function startMonitoring(config) {
  stopMonitoring();
  currentConfig = config;
  isMonitoring = true;
  
  console.log('Starting optimized monitoring with device criticality...');
  
  // Initial ping for all devices
  setTimeout(pingAllDevices, 1000); // Delay to ensure database is ready
  
  // Set up individual intervals for each device based on criticality
  setupDeviceIntervals();
}

function setupDeviceIntervals() {
  if (!currentConfig || !isMonitoring) return;
  
  currentConfig.devices.forEach(device => {
    const pingInterval = getDevicePingInterval(device) * 1000; // Convert to milliseconds
    const criticality = device.criticality || 'normal';
    
    console.log(`Setting up ${device.name} (${criticality}) with ${pingInterval/1000}s interval`);
    
    // Create individual interval for each device
    const intervalId = setInterval(() => {
      if (isMonitoring) {
        pingDevice(device);
      }
    }, pingInterval);
    
    deviceIntervals.set(device.id, intervalId);
  });
}

function stopMonitoring() {
  isMonitoring = false;
  
  // Clear all device intervals
  deviceIntervals.forEach((intervalId, deviceId) => {
    clearInterval(intervalId);
  });
  deviceIntervals.clear();
  
  console.log('Monitoring stopped');
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
      latency = Math.round(result.avg);
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
    
    // Store result
    storePingResult(device.id, status, latency, packetLoss);
    
    const duration = Date.now() - startTime;
    const logLevel = criticality === 'critical' ? 'info' : 'debug';
    
    if (logLevel === 'info' || status !== 'up') {
      console.log(`[${criticality.toUpperCase()}] ${device.name} (${device.ip}): ${status} - ${formatLatencyForLog(latency)} (${duration}ms total)`);
    }
    
    // Clear cache only if status might have changed
    if (status !== 'up') {
      clearStatusCache();
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${criticality.toUpperCase()}] Error pinging ${device.name} (${device.ip}): ${error.message} (${duration}ms)`);
    
    // Store as down with error context
    storePingResult(device.id, 'down', undefined, undefined);
    clearStatusCache(); // Clear cache on errors
  }
}

// Utility function to validate IP addresses
function isValidIP(ip) {
  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

// Restart monitoring when config changes
function restartMonitoring(newConfig) {
  console.log('Restarting monitoring with new configuration...');
  stopMonitoring();
  currentConfig = newConfig;
  setTimeout(() => startMonitoring(newConfig), 1000);
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  restartMonitoring,
  pingDevice // Export for manual testing
};



