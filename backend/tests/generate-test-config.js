/**
 * Generate test configuration with 100+ devices for stress testing
 */

const fs = require('fs');
const path = require('path');

function generateTestConfig(deviceCount = 100) {
  const areas = [
    { id: 'area-1', name: 'Manila Office', type: 'Server/Relay', lat: 14.5995, lng: 120.9842 },
    { id: 'area-2', name: 'Cebu Office', type: 'Schools', lat: 10.3157, lng: 123.8854 },
    { id: 'area-3', name: 'Davao Office', type: 'Homes', lat: 7.1907, lng: 125.4553 },
    { id: 'area-4', name: 'Makati Office', type: 'PisoWiFi Vendo', lat: 14.5547, lng: 121.0244 }
  ];

  const devices = [];
  const criticalities = ['critical', 'high', 'normal', 'low'];
  const deviceTypes = ['router', 'wireless-antenna', 'wifi-soho', 'wifi-outdoor'];
  
  // Test IPs (safe to ping)
  const testIPs = [
    '8.8.8.8',      // Google DNS
    '1.1.1.1',      // Cloudflare DNS
    '8.8.4.4',      // Google DNS 2
    '1.0.0.1',      // Cloudflare DNS 2
    '208.67.222.222', // OpenDNS
    '208.67.220.220'  // OpenDNS 2
  ];

  for (let i = 0; i < deviceCount; i++) {
    const areaIndex = i % areas.length;
    const area = areas[areaIndex];
    const criticality = criticalities[i % criticalities.length];
    const deviceType = deviceTypes[i % deviceTypes.length];
    const ipIndex = i % testIPs.length;
    
    devices.push({
      id: `test-device-${i + 1}`,
      areaId: area.id,
      name: `Test Device ${i + 1}`,
      type: deviceType,
      ip: testIPs[ipIndex],
      criticality: criticality
    });
  }

  // Create links between areas
  const links = [
    {
      id: 'link-1',
      type: 'wireless',
      endpoints: [
        { areaId: 'area-1', deviceId: devices[0].id },
        { areaId: 'area-2', deviceId: devices[1].id }
      ]
    },
    {
      id: 'link-2',
      type: 'fiber',
      endpoints: [
        { areaId: 'area-2', deviceId: devices[2].id },
        { areaId: 'area-3', deviceId: devices[3].id }
      ]
    }
  ];

  const config = {
    areas,
    devices,
    links,
    settings: {
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
    }
  };

  return config;
}

// Main execution
if (require.main === module) {
  const deviceCount = parseInt(process.argv[2]) || 100;
  console.log(`Generating test configuration with ${deviceCount} devices...`);
  
  const config = generateTestConfig(deviceCount);
  
  const outputPath = path.join(__dirname, '..', 'data', 'test-config.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  
  console.log(`✅ Test configuration saved to: ${outputPath}`);
  console.log(`   - ${config.areas.length} areas`);
  console.log(`   - ${config.devices.length} devices`);
  console.log(`   - ${config.links.length} links`);
  
  // Count by criticality
  const byCriticality = config.devices.reduce((acc, device) => {
    acc[device.criticality] = (acc[device.criticality] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\nDevice distribution by criticality:');
  Object.entries(byCriticality).forEach(([crit, count]) => {
    console.log(`   - ${crit}: ${count} devices`);
  });
}

module.exports = { generateTestConfig };

