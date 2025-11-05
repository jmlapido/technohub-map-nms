/**
 * Test Redis Fallback Mechanism
 * 
 * Tests that the system gracefully handles Redis connection failures
 * and falls back to SQLite
 */

const http = require('http');

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

async function testRedisFallback() {
  console.log('========================================');
  console.log('Redis Fallback Test');
  console.log('========================================\n');
  
  console.log('Testing system behavior with Redis unavailable...');
  console.log('(This test assumes Redis can be stopped temporarily)\n');
  
  // Check current Redis status
  console.log('1. Checking current Redis status...');
  try {
    const stats = await httpGet('/api/system/stats');
    if (stats.data.redis) {
      console.log(`   Redis Status: ${stats.data.redis.status}`);
      console.log(`   Redis Healthy: ${stats.data.redis.healthy ? 'Yes' : 'No'}`);
      
      if (!stats.data.redis.healthy) {
        console.log('   ⚠️  Redis is currently unavailable');
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test status endpoint (should work with or without Redis)
  console.log('\n2. Testing status endpoint (should work with SQLite fallback)...');
  try {
    const status = await httpGet('/api/status');
    if (status.status === 200) {
      console.log('   ✅ Status endpoint responding');
      console.log(`   Areas: ${status.data.areas?.length || 0}`);
      console.log(`   Links: ${status.data.links?.length || 0}`);
    } else {
      console.log(`   ❌ Status endpoint failed: HTTP ${status.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test dashboard endpoint
  console.log('\n3. Testing dashboard endpoint...');
  try {
    const dashboard = await httpGet('/api/dashboard');
    if (dashboard.status === 200) {
      console.log('   ✅ Dashboard endpoint responding');
      console.log(`   Config Areas: ${dashboard.data.config?.areas?.length || 0}`);
      console.log(`   Config Devices: ${dashboard.data.config?.devices?.length || 0}`);
    } else {
      console.log(`   ❌ Dashboard endpoint failed: HTTP ${dashboard.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n========================================');
  console.log('Fallback Test Complete');
  console.log('========================================\n');
  
  console.log('📝 Manual Test Instructions:');
  console.log('1. Stop Redis: docker-compose stop redis');
  console.log('2. Wait 10-30 seconds for reconnection attempts');
  console.log('3. Verify system still responds via SQLite fallback');
  console.log('4. Restart Redis: docker-compose start redis');
  console.log('5. Verify Redis reconnects automatically');
}

if (require.main === module) {
  testRedisFallback().catch(console.error);
}

module.exports = { testRedisFallback };

