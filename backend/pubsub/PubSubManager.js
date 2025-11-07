/**
 * Redis Pub/Sub Manager
 * 
 * Manages Redis pub/sub for real-time synchronization across:
 * - Multiple backend instances
 * - WebSocket connections
 * - Device updates
 * - Interface updates
 * - Alerts
 * 
 * @module PubSubManager
 * @version 3.0.0
 */

const { getRedisManager } = require('../cache/RedisManager');

class PubSubManager {
  constructor() {
    this.redis = null;
    this.subscriber = null;
    this.isInitialized = false;
    this.channels = {
      'device:update': [],
      'interface:update': [],
      'wireless:update': [],
      'alert:flapping': [],
      'system:status': []
    };
  }

  /**
   * Initialize pub/sub connections
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('[PubSub] Already initialized');
      return;
    }

    try {
      this.redis = getRedisManager();
      
      // Create separate connection for subscriber
      this.subscriber = this.redis.client.duplicate();
      
      console.log('[PubSub] Initializing...');
      
      // Wait for subscriber to be ready
      await new Promise((resolve, reject) => {
        this.subscriber.on('ready', resolve);
        this.subscriber.on('error', reject);
        setTimeout(() => reject(new Error('Subscriber connection timeout')), 5000);
      });
      
      // Subscribe to all channels
      await this.subscriber.subscribe(...Object.keys(this.channels));
      
      // Set up message handler
      this.subscriber.on('message', (channel, message) => {
        this.handleMessage(channel, message);
      });
      
      this.isInitialized = true;
      console.log('[PubSub] Initialized and subscribed to channels:', Object.keys(this.channels));
      
    } catch (error) {
      console.error('[PubSub] Initialization failed:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Handle incoming message from Redis
   */
  handleMessage(channel, message) {
    try {
      const data = JSON.parse(message);
      
      // Get callbacks for this channel
      const callbacks = this.channels[channel] || [];
      
      // Call all registered callbacks
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PubSub] Error in callback for ${channel}:`, error.message);
        }
      });
      
    } catch (error) {
      console.error(`[PubSub] Error handling message on ${channel}:`, error.message);
    }
  }

  /**
   * Subscribe to a channel with callback
   * @param {string} channel - Channel name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(channel, callback) {
    if (!this.channels[channel]) {
      console.warn(`[PubSub] Unknown channel: ${channel}`);
      this.channels[channel] = [];
    }
    
    this.channels[channel].push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.channels[channel].indexOf(callback);
      if (index > -1) {
        this.channels[channel].splice(index, 1);
      }
    };
  }

  /**
   * Publish message to channel
   * @param {string} channel - Channel name
   * @param {Object} data - Data to publish
   */
  async publish(channel, data) {
    if (!this.isInitialized || !this.redis) {
      console.warn('[PubSub] Not initialized, skipping publish to', channel);
      return false;
    }

    try {
      const message = JSON.stringify(data);
      await this.redis.client.publish(channel, message);
      return true;
    } catch (error) {
      console.error(`[PubSub] Error publishing to ${channel}:`, error.message);
      return false;
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    
    this.isInitialized = false;
    console.log('[PubSub] Disconnected');
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      channels: Object.keys(this.channels),
      subscriberCount: Object.values(this.channels).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
}

// Singleton instance
let pubSubInstance = null;

/**
 * Get singleton instance
 */
function getPubSubManager() {
  if (!pubSubInstance) {
    pubSubInstance = new PubSubManager();
  }
  return pubSubInstance;
}

module.exports = {
  PubSubManager,
  getPubSubManager
};


