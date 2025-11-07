/**
 * Telegraf Data Receiver Routes
 * 
 * Handles incoming metrics from Telegraf:
 * - ICMP ping data (latency, packet loss, reachability)
 * - SNMP interface data (speed, status, errors)
 * 
 * @module telegraf-routes
 * @version 3.0.0
 */

const express = require('express');
const router = express.Router();
const { storePingResult } = require('../database');
const { storeInterfaceMetrics, storeWirelessStats } = require('../snmp/snmp-storage');
const { detectFlapping } = require('../snmp/FlappingDetector');
const { getRedisManagerInstance } = require('../database');

// Load current config to map IPs to device IDs
let currentConfig = null;

/**
 * Set current configuration (called by server.js)
 */
function setConfig(config) {
  currentConfig = config;
  console.log('[Telegraf Routes] Configuration updated:', config.devices?.length || 0, 'devices');
}

/**
 * Find device by IP address
 */
function findDeviceByIp(ip) {
  if (!currentConfig || !currentConfig.devices) {
    return null;
  }
  
  // Clean IP (remove port if present)
  const cleanIp = ip.split(':')[0];
  
  return currentConfig.devices.find(d => {
    const deviceIp = d.ip.split(':')[0];
    return deviceIp === cleanIp;
  });
}

/**
 * POST /api/telegraf/ping
 * Receive ICMP ping metrics from Telegraf
 */
router.post('/ping', express.json(), async (req, res) => {
  try {
    const metrics = req.body;
    
    if (!Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Expected array of metrics' });
    }
    
    console.log(`[Telegraf] Received ${metrics.length} ping metrics`);
    
    let processed = 0;
    let errors = 0;
    
    for (const metric of metrics) {
      try {
        if (metric.name !== 'ping') {
          continue; // Skip non-ping metrics
        }
        
        const url = metric.tags?.url;
        if (!url) {
          console.warn('[Telegraf] Ping metric missing URL tag:', metric);
          continue;
        }
        
        // Find device by IP
        const device = findDeviceByIp(url);
        if (!device) {
          console.warn(`[Telegraf] No device found for IP: ${url}`);
          continue;
        }
        
        // Extract ping metrics
        const fields = metric.fields || {};
        const latency = fields.average_response_ms || fields.avg || undefined;
        const packetLoss = fields.percent_packet_loss || fields.packet_loss || 0;
        const isAlive = fields.result_code === 0 || latency !== undefined;
        
        // Determine status based on thresholds
        let status = 'down';
        if (isAlive && latency !== undefined) {
          const thresholds = device.thresholds || currentConfig.settings.thresholds;
          
          if (latency <= thresholds.latency.good && packetLoss <= thresholds.packetLoss.good) {
            status = 'up';
          } else if (latency <= thresholds.latency.degraded && packetLoss <= thresholds.packetLoss.degraded) {
            status = 'degraded';
          } else {
            status = 'down';
          }
        }
        
        // Store result (includes Redis and SQLite via BatchWriter)
        await storePingResult(device.id, status, latency, packetLoss);
        
        // Emit to WebSocket (handled by Redis pub/sub)
        const redis = getRedisManagerInstance();
        if (redis && redis.isAvailable()) {
          await redis.client.publish('device:update', JSON.stringify({
            deviceId: device.id,
            status,
            latency,
            packetLoss,
            lastChecked: new Date().toISOString()
          }));
        }
        
        processed++;
        
      } catch (error) {
        console.error('[Telegraf] Error processing ping metric:', error.message);
        errors++;
      }
    }
    
    console.log(`[Telegraf] Processed ${processed} ping metrics (${errors} errors)`);
    
    res.status(204).send(); // No content response
    
  } catch (error) {
    console.error('[Telegraf] Error handling ping data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/telegraf/snmp
 * Receive SNMP metrics from Telegraf
 */
router.post('/snmp', express.json(), async (req, res) => {
  try {
    const metrics = req.body;
    
    if (!Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Expected array of metrics' });
    }
    
    console.log(`[Telegraf] Received ${metrics.length} SNMP metrics`);
    
    let processed = 0;
    let errors = 0;
    
    for (const metric of metrics) {
      try {
        const metricName = metric.name;
        const agent = metric.tags?.agent_host;
        
        if (!agent) {
          console.warn('[Telegraf] SNMP metric missing agent_host:', metric);
          continue;
        }
        
        // Find device by IP
        const device = findDeviceByIp(agent);
        if (!device) {
          console.warn(`[Telegraf] No device found for IP: ${agent}`);
          continue;
        }
        
        // Handle different metric types
        if (metricName === 'interface') {
          await handleInterfaceMetric(device, metric);
          processed++;
        } else if (metricName === 'ubiquiti_wireless') {
          await handleWirelessMetric(device, metric);
          processed++;
        } else {
          // Unknown metric type
          console.debug(`[Telegraf] Unknown SNMP metric type: ${metricName}`);
        }
        
      } catch (error) {
        console.error('[Telegraf] Error processing SNMP metric:', error.message);
        errors++;
      }
    }
    
    console.log(`[Telegraf] Processed ${processed} SNMP metrics (${errors} errors)`);
    
    res.status(204).send(); // No content response
    
  } catch (error) {
    console.error('[Telegraf] Error handling SNMP data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle interface metric from SNMP
 */
async function handleInterfaceMetric(device, metric) {
  const tags = metric.tags || {};
  const fields = metric.fields || {};
  const timestamp = metric.timestamp || Date.now() / 1000; // Telegraf uses seconds
  
  const ifIndex = parseInt(tags.ifIndex) || 0;
  const ifName = tags.ifName || tags.ifDescr || 'unknown';
  const ifDescr = tags.ifDescr || '';
  
  // Interface status (1=up, 2=down)
  const operStatus = parseInt(fields.ifOperStatus) || 2;
  const adminStatus = parseInt(fields.ifAdminStatus) || 2;
  
  // Speed in Mbps
  let speedMbps = 0;
  if (fields.ifHighSpeed) {
    speedMbps = parseInt(fields.ifHighSpeed); // Already in Mbps
  } else if (fields.ifSpeed) {
    speedMbps = Math.floor(parseInt(fields.ifSpeed) / 1000000); // Convert bps to Mbps
  }
  
  // Traffic counters
  const inOctets = fields.ifHCInOctets || fields.ifInOctets || 0;
  const outOctets = fields.ifHCOutOctets || fields.ifOutOctets || 0;
  
  // Error counters
  const inErrors = parseInt(fields.ifInErrors) || 0;
  const outErrors = parseInt(fields.ifOutErrors) || 0;
  const inDiscards = parseInt(fields.ifInDiscards) || 0;
  const outDiscards = parseInt(fields.ifOutDiscards) || 0;
  
  // Store interface metrics
  await storeInterfaceMetrics({
    deviceId: device.id,
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
    timestamp: Math.floor(timestamp * 1000) // Convert to milliseconds
  });
  
  // Detect flapping (speed changes, status changes)
  const flappingEvent = await detectFlapping(device.id, ifIndex, ifName, {
    operStatus,
    speedMbps,
    timestamp: Math.floor(timestamp * 1000)
  });
  
  if (flappingEvent) {
    console.warn(`[Telegraf] Flapping detected:`, flappingEvent);
    
    // Emit alert via Redis pub/sub
    const redis = getRedisManagerInstance();
    if (redis && redis.isAvailable()) {
      await redis.client.publish('alert:flapping', JSON.stringify(flappingEvent));
    }
  }
  
  // Emit interface update via Redis pub/sub
  const redis = getRedisManagerInstance();
  if (redis && redis.isAvailable()) {
    await redis.client.publish('interface:update', JSON.stringify({
      deviceId: device.id,
      ifIndex,
      ifName,
      operStatus,
      speedMbps,
      inErrors,
      outErrors,
      isFlapping: !!flappingEvent,
      timestamp: new Date(timestamp * 1000).toISOString()
    }));
  }
}

/**
 * Handle wireless metric from SNMP (Ubiquiti specific)
 */
async function handleWirelessMetric(device, metric) {
  const tags = metric.tags || {};
  const fields = metric.fields || {};
  const timestamp = metric.timestamp || Date.now() / 1000;
  
  const ssid = tags.ubntWlStatSsid || '';
  const signal = parseInt(fields.ubntWlStatSignal) || 0;
  const noiseFloor = parseInt(fields.ubntWlStatNoiseFloor) || 0;
  const txRate = parseInt(fields.ubntWlStatTxRate) || 0;
  const rxRate = parseInt(fields.ubntWlStatRxRate) || 0;
  
  // Store wireless stats
  await storeWirelessStats({
    deviceId: device.id,
    ssid,
    signal,
    noiseFloor,
    txRate,
    rxRate,
    timestamp: Math.floor(timestamp * 1000)
  });
  
  // Emit wireless update via Redis pub/sub
  const redis = getRedisManagerInstance();
  if (redis && redis.isAvailable()) {
    await redis.client.publish('wireless:update', JSON.stringify({
      deviceId: device.id,
      ssid,
      signal,
      noiseFloor,
      txRate,
      rxRate,
      timestamp: new Date(timestamp * 1000).toISOString()
    }));
  }
}

/**
 * GET /api/telegraf/status
 * Get Telegraf integration status
 */
router.get('/status', (req, res) => {
  res.json({
    enabled: true,
    devicesConfigured: currentConfig?.devices?.length || 0,
    snmpDevicesConfigured: currentConfig?.devices?.filter(d => d.snmpEnabled)?.length || 0,
    version: '3.0.0'
  });
});

module.exports = {
  router,
  setConfig
};


