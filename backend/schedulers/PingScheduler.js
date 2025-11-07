/**
 * PingScheduler - Single master timer with priority queue system
 * 
 * Replaces individual setInterval timers per device with a single scheduler
 * that manages all device pings based on criticality and priority.
 * 
 * Features:
 * - Single master timer (10s tick interval)
 * - Priority queue based on device criticality
 * - Device staggering to prevent network storms
 * - Circuit breaker for failing devices
 * - Configurable concurrency limits
 */

class PingScheduler {
  constructor(options = {}) {
    this.tickInterval = options.tickInterval || 10000; // 10 seconds default
    this.maxConcurrentPings = options.maxConcurrentPings || 5;
    this.deviceStaggerDelay = options.deviceStaggerDelay || 50; // 50ms between devices
    
    // Priority levels (higher = more priority)
    this.priorityMap = {
      'critical': 4,
      'high': 3,
      'normal': 2,
      'low': 1
    };
    
    // Device state tracking
    this.devices = new Map(); // deviceId -> device info
    this.deviceSchedules = new Map(); // deviceId -> schedule info
    this.activePings = new Set(); // Currently pinging device IDs
    this.timer = null;
    this.isRunning = false;
    
    // Circuit breaker state
    this.circuitBreakers = new Map(); // deviceId -> { failures, lastFailure, state: 'closed'|'open'|'half-open' }
    this.circuitBreakerThreshold = 5; // Open circuit after 5 failures
    this.circuitBreakerTimeout = 60000; // 1 minute before trying half-open
    
    // Statistics
    this.stats = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      skippedPings: 0,
      lastTick: null
    };
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('[PingScheduler] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[PingScheduler] Starting with ${this.tickInterval}ms tick interval, max ${this.maxConcurrentPings} concurrent pings`);
    
    // Initial tick
    this.tick();
    
    // Set up recurring timer
    this.timer = setInterval(() => {
      this.tick();
    }, this.tickInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    console.log('[PingScheduler] Stopped');
  }

  /**
   * Add or update a device
   */
  addDevice(device, pingIntervalSeconds) {
    const deviceId = device.id;
    const criticality = device.criticality || 'normal';
    const priority = this.priorityMap[criticality] || 2;
    
    // Calculate ticks needed (e.g., 30s interval = 3 ticks at 10s interval)
    const ticksNeeded = Math.max(1, Math.floor((pingIntervalSeconds * 1000) / this.tickInterval));
    
    this.devices.set(deviceId, {
      ...device,
      criticality,
      priority,
      pingIntervalSeconds
    });
    
    this.deviceSchedules.set(deviceId, {
      ticksRemaining: ticksNeeded,
      ticksNeeded,
      lastPing: null,
      nextPing: Date.now() + (pingIntervalSeconds * 1000)
    });
    
    // Reset circuit breaker if device was added/updated
    this.circuitBreakers.delete(deviceId);
    
    console.log(`[PingScheduler] Added device ${device.name} (${criticality}) - interval: ${pingIntervalSeconds}s, ticks: ${ticksNeeded}`);
  }

  /**
   * Remove a device
   */
  removeDevice(deviceId) {
    this.devices.delete(deviceId);
    this.deviceSchedules.delete(deviceId);
    this.circuitBreakers.delete(deviceId);
    this.activePings.delete(deviceId);
  }

  /**
   * Clear all devices
   */
  clearDevices() {
    this.devices.clear();
    this.deviceSchedules.clear();
    this.circuitBreakers.clear();
    this.activePings.clear();
    console.log('[PingScheduler] All devices cleared');
  }

  /**
   * Main tick function - runs every tickInterval
   */
  tick() {
    if (!this.isRunning) {
      return;
    }

    this.stats.lastTick = new Date().toISOString();
    
    // Update device schedules
    const devicesToPing = [];
    
    for (const [deviceId, schedule] of this.deviceSchedules.entries()) {
      const device = this.devices.get(deviceId);
      if (!device) {
        continue; // Device was removed
      }
      
      // Decrement ticks
      schedule.ticksRemaining--;
      
      // Check if device should be pinged
      if (schedule.ticksRemaining <= 0) {
        // Check circuit breaker
        if (this.isCircuitOpen(deviceId)) {
          this.stats.skippedPings++;
          // Reset ticks but don't ping
          schedule.ticksRemaining = schedule.ticksNeeded;
          continue;
        }
        
        // Check if already pinging
        if (this.activePings.has(deviceId)) {
          continue; // Skip if already pinging
        }
        
        devicesToPing.push({
          deviceId,
          device,
          priority: device.priority,
          schedule
        });
        
        // Reset schedule
        schedule.ticksRemaining = schedule.ticksNeeded;
        schedule.nextPing = Date.now() + (device.pingIntervalSeconds * 1000);
      }
    }
    
    // Sort by priority (higher first)
    devicesToPing.sort((a, b) => b.priority - a.priority);
    
    // Process devices up to concurrency limit
    const devicesToProcess = devicesToPing.slice(0, this.maxConcurrentPings);
    
    // Stagger device pings to prevent network storms
    devicesToProcess.forEach((item, index) => {
      setTimeout(() => {
        this.pingDevice(item.deviceId, item.device);
      }, index * this.deviceStaggerDelay);
    });
  }

  /**
   * Ping a device (called by tick or manually)
   */
  async pingDevice(deviceId, device = null) {
    if (!device) {
      device = this.devices.get(deviceId);
    }
    
    if (!device) {
      return;
    }
    
    // Check if already pinging
    if (this.activePings.has(deviceId)) {
      return;
    }
    
    // Check circuit breaker
    if (this.isCircuitOpen(deviceId)) {
      this.stats.skippedPings++;
      return;
    }
    
    this.activePings.add(deviceId);
    this.stats.totalPings++;
    
    try {
      // Emit event that ping is starting (will be handled by monitor.js)
      if (this.onPingStart) {
        this.onPingStart(device);
      }
      
      // Note: Actual ping logic is handled by monitor.js
      // This scheduler just manages timing
      
    } catch (error) {
      console.error(`[PingScheduler] Error pinging device ${deviceId}:`, error);
      this.recordFailure(deviceId);
    } finally {
      // Remove from active pings after a delay to allow ping to complete
      setTimeout(() => {
        this.activePings.delete(deviceId);
      }, 5000); // 5 second timeout
    }
  }

  /**
   * Record successful ping
   */
  recordSuccess(deviceId) {
    const breaker = this.circuitBreakers.get(deviceId);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
      breaker.lastFailure = null;
    }
    
    this.stats.successfulPings++;
    
    const schedule = this.deviceSchedules.get(deviceId);
    if (schedule) {
      schedule.lastPing = Date.now();
    }
  }

  /**
   * Record failed ping
   */
  recordFailure(deviceId) {
    let breaker = this.circuitBreakers.get(deviceId);
    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailure: null,
        state: 'closed'
      };
      this.circuitBreakers.set(deviceId, breaker);
    }
    
    breaker.failures++;
    breaker.lastFailure = Date.now();
    this.stats.failedPings++;
    
    // Open circuit if threshold reached
    if (breaker.failures >= this.circuitBreakerThreshold && breaker.state === 'closed') {
      breaker.state = 'open';
      console.warn(`[PingScheduler] Circuit breaker opened for device ${deviceId} after ${breaker.failures} failures`);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(deviceId) {
    const breaker = this.circuitBreakers.get(deviceId);
    if (!breaker || breaker.state === 'closed') {
      return false;
    }
    
    if (breaker.state === 'open') {
      // Check if timeout has passed
      const timeSinceFailure = Date.now() - breaker.lastFailure;
      if (timeSinceFailure >= this.circuitBreakerTimeout) {
        // Try half-open
        breaker.state = 'half-open';
        return false; // Allow one ping attempt
      }
      return true; // Still open
    }
    
    if (breaker.state === 'half-open') {
      // After first attempt, if it fails, go back to open
      // If success, recordSuccess will close it
      return false; // Allow ping in half-open state
    }
    
    return false;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      devicesCount: this.devices.size,
      activePings: this.activePings.size,
      circuitBreakersOpen: Array.from(this.circuitBreakers.values()).filter(b => b.state === 'open').length,
      isRunning: this.isRunning
    };
  }

  /**
   * Get device schedule info
   */
  getDeviceSchedule(deviceId) {
    const schedule = this.deviceSchedules.get(deviceId);
    const device = this.devices.get(deviceId);
    const breaker = this.circuitBreakers.get(deviceId);
    
    return {
      device: device ? {
        id: device.id,
        name: device.name,
        criticality: device.criticality,
        priority: device.priority
      } : null,
      schedule,
      circuitBreaker: breaker
    };
  }
}

module.exports = PingScheduler;


