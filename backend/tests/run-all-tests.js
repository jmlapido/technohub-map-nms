#!/usr/bin/env node
/**
 * Run All Tests - Task 1.6 Testing & Validation
 * 
 * Executes all test suites for Phase 1 validation
 */

const TestSuite = require('./test-suite');
const { runPerformanceTest } = require('./performance-test');
const { testRedisFallback } = require('./test-redis-fallback');
const { testWebSocketConnection } = require('./test-websocket');

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Map-Ping v2.0 - Test Suite v2.0   ║');
  console.log('║   Task 1.6: Testing & Validation    ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const results = {
    testSuite: null,
    performance: null,
    redis: null,
    websocket: null
  };
  
  // Test 1.6.1: Scheduler
  console.log('════════════════════════════════════════');
  console.log('Task 1.6.1: Scheduler Tests');
  console.log('════════════════════════════════════════');
  const testSuite = new TestSuite();
  results.testSuite = await testSuite.runAll();
  
  // Test 1.6.2: Redis Integration
  console.log('\n════════════════════════════════════════');
  console.log('Task 1.6.2: Redis Integration Tests');
  console.log('════════════════════════════════════════');
  await testRedisFallback();
  
  // Test 1.6.3: WebSocket Implementation
  console.log('\n════════════════════════════════════════');
  console.log('Task 1.6.3: WebSocket Implementation Tests');
  console.log('════════════════════════════════════════');
  results.websocket = await testWebSocketConnection();
  
  // Test 1.6.4: Batch Writing
  console.log('\n════════════════════════════════════════');
  console.log('Task 1.6.4: Batch Writing & Performance');
  console.log('════════════════════════════════════════');
  await runPerformanceTest();
  
  // Final Summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         FINAL TEST SUMMARY           ║');
  console.log('╚════════════════════════════════════════╝');
  
  if (results.testSuite) {
    console.log(`\n📋 Test Suite: ${results.testSuite.passed} passed, ${results.testSuite.failed} failed`);
  }
  
  if (results.websocket) {
    const wsPassed = Object.values(results.websocket).filter(v => v === true).length;
    const wsTotal = Object.keys(results.websocket).length;
    console.log(`🔌 WebSocket: ${wsPassed}/${wsTotal} tests passed`);
  }
  
  console.log('\n✅ Performance tests completed');
  console.log('✅ Redis fallback tests completed');
  
  console.log('\n📝 Next Steps:');
  console.log('1. Review test results above');
  console.log('2. Test with 100+ devices (use generate-test-config.js)');
  console.log('3. Monitor CPU/memory usage during stress test');
  console.log('4. Verify WebSocket reconnection after network interruption');
  console.log('5. Test batch writing with high ping volume');
  
  const exitCode = (results.testSuite && results.testSuite.failed > 0) ? 1 : 0;
  process.exit(exitCode);
}

if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };

