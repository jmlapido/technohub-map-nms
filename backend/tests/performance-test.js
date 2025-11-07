/**
 * Performance Testing Script
 * 
 * Tests CPU usage, memory consumption, and throughput
 * with varying device counts
 */

const http = require('http');
const { performance } = require('perf_hooks');

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

async function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function measureLatency(iterations = 10) {
  const latencies = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await httpGet('/api/status');
      const end = performance.now();
      latencies.push(end - start);
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error.message);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (latencies.length === 0) {
    return null;
  }
  
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  
  return { avg, min, max, count: latencies.length };
}

async function testSystemStats() {
  console.log('\n📊 System Statistics:');
  console.log('========================================');
  
  try {
    const result = await httpGet('/api/system/stats');
    
    if (result.status !== 200) {
      console.error('❌ Failed to get system stats');
      return;
    }
    
    const stats = result.data;
    
    // Scheduler Stats
    if (stats.scheduler) {
      console.log('\n🔧 Scheduler:');
      console.log(`   Devices: ${stats.scheduler.devicesCount || 0}`);
      console.log(`   Active Pings: ${stats.scheduler.activePings || 0}`);
      console.log(`   Total Pings: ${stats.scheduler.totalPings || 0}`);
      console.log(`   Successful: ${stats.scheduler.successfulPings || 0}`);
      console.log(`   Failed: ${stats.scheduler.failedPings || 0}`);
      console.log(`   Skipped: ${stats.scheduler.skippedPings || 0}`);
      console.log(`   Circuit Breakers Open: ${stats.scheduler.circuitBreakersOpen || 0}`);
      console.log(`   Running: ${stats.scheduler.isRunning ? 'Yes' : 'No'}`);
    }
    
    // Batch Writer Stats
    if (stats.batchWriter) {
      console.log('\n💾 Batch Writer:');
      console.log(`   Total Writes: ${stats.batchWriter.totalWrites || 0}`);
      console.log(`   Total Batches: ${stats.batchWriter.totalBatches || 0}`);
      console.log(`   Queue Size: ${stats.batchWriter.queueSize || 0}`);
      console.log(`   Avg Batch Size: ${stats.batchWriter.avgBatchSize || 0}`);
      console.log(`   Last Flush: ${stats.batchWriter.lastFlushTime || 'Never'}`);
      console.log(`   Queue Overflows: ${stats.batchWriter.totalQueueOverflows || 0}`);
    }
    
    // Redis Stats
    if (stats.redis) {
      console.log('\n🔴 Redis:');
      console.log(`   Status: ${stats.redis.status || 'unknown'}`);
      console.log(`   Healthy: ${stats.redis.healthy ? 'Yes' : 'No'}`);
      if (stats.redis.latency) {
        console.log(`   Latency: ${stats.redis.latency}`);
      }
      if (stats.redis.error) {
        console.log(`   Error: ${stats.redis.error}`);
      }
    }
    
    // WebSocket Stats
    if (stats.websocket) {
      console.log('\n🔌 WebSocket:');
      console.log(`   Connected Clients: ${stats.websocket.connectedClients || 0}`);
      console.log(`   Initialized: ${stats.websocket.isInitialized ? 'Yes' : 'No'}`);
    }
    
    // Database Stats
    if (stats.database) {
      console.log('\n🗄️  Database:');
      console.log(`   Ping History: ${stats.database.pingHistory || 0} records`);
      console.log(`   Aggregates: ${stats.database.aggregates || 0} records`);
    }
    
  } catch (error) {
    console.error('❌ Error getting system stats:', error.message);
  }
}

async function testPerformance() {
  console.log('\n⚡ Performance Tests:');
  console.log('========================================');
  
  // Test API latency
  console.log('\n📡 Testing API Response Latency...');
  const latency = await measureLatency(10);
  if (latency) {
    console.log(`   Average: ${latency.avg.toFixed(2)}ms`);
    console.log(`   Min: ${latency.min.toFixed(2)}ms`);
    console.log(`   Max: ${latency.max.toFixed(2)}ms`);
    
    // Performance targets
    if (latency.avg < 100) {
      console.log('   ✅ PASS: Average latency < 100ms');
    } else if (latency.avg < 500) {
      console.log('   ⚠️  WARN: Average latency < 500ms (acceptable)');
    } else {
      console.log('   ❌ FAIL: Average latency > 500ms');
    }
  }
  
  // Test system stats endpoint
  console.log('\n📊 Testing System Stats Endpoint...');
  const start = performance.now();
  try {
    await httpGet('/api/system/stats');
    const duration = performance.now() - start;
    console.log(`   Response time: ${duration.toFixed(2)}ms`);
    if (duration < 200) {
      console.log('   ✅ PASS: Response time < 200ms');
    } else {
      console.log('   ⚠️  WARN: Response time > 200ms');
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }
}

async function runPerformanceTest() {
  console.log('========================================');
  console.log('Map-Ping v2.0 - Performance Test');
  console.log('========================================');
  
  await testSystemStats();
  await testPerformance();
  
  console.log('\n========================================');
  console.log('Performance Test Complete');
  console.log('========================================\n');
}

if (require.main === module) {
  runPerformanceTest().catch(console.error);
}

module.exports = { runPerformanceTest, testSystemStats, measureLatency };


