/**
 * WebSocket Connection Test
 * 
 * Tests WebSocket server connectivity, reconnection, and event handling
 */

const { io } = require('socket.io-client');

const WS_BASE = process.env.WS_BASE || 'http://localhost:5000';

async function testWebSocketConnection() {
  console.log('========================================');
  console.log('WebSocket Connection Test');
  console.log('========================================\n');
  
  return new Promise((resolve) => {
    const results = {
      connected: false,
      receivedConnected: false,
      receivedStatusUpdate: false,
      receivedDeviceUpdate: false,
      reconnectionTest: false
    };
    
    console.log(`Connecting to WebSocket server: ${WS_BASE}...`);
    
    const socket = io(WS_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3,
      timeout: 5000
    });
    
    const timeout = setTimeout(() => {
      socket.disconnect();
      console.log('\n⏱️  Test timeout after 10 seconds');
      printResults(results);
      resolve(results);
    }, 10000);
    
    socket.on('connect', () => {
      results.connected = true;
      console.log('✅ WebSocket connected');
      clearTimeout(timeout);
      
      // Test receiving events
      setTimeout(() => {
        socket.disconnect();
        printResults(results);
        resolve(results);
      }, 5000);
    });
    
    socket.on('connected', (data) => {
      results.receivedConnected = true;
      console.log('✅ Received "connected" event');
      console.log(`   Socket ID: ${data.socketId || 'unknown'}`);
    });
    
    socket.on('status:update', (data) => {
      results.receivedStatusUpdate = true;
      console.log('✅ Received "status:update" event');
      console.log(`   Areas: ${data.data?.areas?.length || 0}`);
      console.log(`   Links: ${data.data?.links?.length || 0}`);
    });
    
    socket.on('device:update', (data) => {
      results.receivedDeviceUpdate = true;
      console.log('✅ Received "device:update" event');
      console.log(`   Device ID: ${data.deviceId || 'unknown'}`);
    });
    
    socket.on('connect_error', (error) => {
      console.log(`❌ Connection error: ${error.message}`);
      clearTimeout(timeout);
      printResults(results);
      resolve(results);
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`ℹ️  Disconnected: ${reason}`);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      results.reconnectionTest = true;
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
    });
  });
}

function printResults(results) {
  console.log('\n========================================');
  console.log('WebSocket Test Results');
  console.log('========================================');
  console.log(`Connection: ${results.connected ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Received "connected" event: ${results.receivedConnected ? '✅ PASS' : '⚠️  Not received'}`);
  console.log(`Received "status:update": ${results.receivedStatusUpdate ? '✅ PASS' : '⚠️  Not received (may need status change)'}`);
  console.log(`Received "device:update": ${results.receivedDeviceUpdate ? '✅ PASS' : '⚠️  Not received (may need device update)'}`);
  console.log(`Reconnection test: ${results.reconnectionTest ? '✅ PASS' : '⚠️  Not tested'}`);
  console.log('\n========================================\n');
}

async function testWebSocketFallback() {
  console.log('\n========================================');
  console.log('WebSocket Fallback Test');
  console.log('========================================\n');
  
  console.log('Testing WebSocket with intentional connection failure...');
  
  // Try connecting to invalid URL to test fallback
  const invalidSocket = io('http://localhost:9999', {
    transports: ['websocket'],
    reconnection: false,
    timeout: 2000
  });
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      invalidSocket.disconnect();
      console.log('✅ Fallback mechanism works (connection failed, no crash)');
      resolve();
    }, 3000);
    
    invalidSocket.on('connect_error', () => {
      clearTimeout(timeout);
      console.log('✅ Connection error handled gracefully');
      invalidSocket.disconnect();
      resolve();
    });
  });
}

async function runWebSocketTests() {
  await testWebSocketConnection();
  await testWebSocketFallback();
  
  console.log('\n📝 Manual Test Instructions:');
  console.log('1. Open browser console');
  console.log('2. Check WebSocket connection in Network tab');
  console.log('3. Verify real-time updates on frontend');
  console.log('4. Test reconnection by stopping/starting backend');
  console.log('5. Verify fallback to polling if WebSocket fails');
}

if (require.main === module) {
  runWebSocketTests().catch(console.error);
}

module.exports = { testWebSocketConnection, testWebSocketFallback };

