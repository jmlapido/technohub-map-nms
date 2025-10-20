const ping = require('ping');
const { storePingResult } = require('./database');

let monitoringInterval = null;
let currentConfig = null;

function startMonitoring(config) {
  stopMonitoring();
  currentConfig = config;
  
  console.log('Starting monitoring...');
  
  // Initial ping
  pingAllDevices();
  
  // Set up interval
  const interval = config.settings.pingInterval * 1000;
  monitoringInterval = setInterval(pingAllDevices, interval);
}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('Monitoring stopped');
  }
}

async function pingAllDevices() {
  if (!currentConfig) return;
  
  console.log('Pinging devices...');
  
  const pingPromises = currentConfig.devices.map(device => 
    pingDevice(device)
  );
  
  await Promise.all(pingPromises);
}

async function pingDevice(device) {
  try {
    const result = await ping.promise.probe(device.ip, {
      timeout: 5,
      min_reply: 3
    });
    
    let status = 'down';
    let latency = undefined;
    let packetLoss = undefined;
    
    if (result.alive) {
      latency = Math.round(result.avg);
      packetLoss = result.packetLoss ? parseFloat(result.packetLoss) : 0;
      
      // Determine status based on thresholds
      const thresholds = currentConfig.settings.thresholds;
      
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
    
    console.log(`${device.name} (${device.ip}): ${status} - ${latency}ms`);
    
  } catch (error) {
    console.error(`Error pinging ${device.name} (${device.ip}):`, error.message);
    
    // Store as down
    storePingResult(device.id, 'down', undefined, undefined);
  }
}

module.exports = {
  startMonitoring,
  stopMonitoring
};

