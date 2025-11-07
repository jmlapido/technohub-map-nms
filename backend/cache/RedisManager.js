const Redis = require('ioredis');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
  }

  async connect() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisPassword = process.env.REDIS_PASSWORD || null;

    const options = {
      host: redisHost,
      port: parseInt(redisPort),
      retryStrategy: (times) => {
        if (times > this.maxReconnectAttempts) {
          console.error('[Redis] Max reconnection attempts reached');
          return null; // Stop retrying
        }
        const delay = Math.min(times * this.reconnectDelay, 30000);
        console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false, // Don't queue commands when disconnected
    };

    if (redisPassword) {
      options.password = redisPassword;
    }

    this.client = new Redis(options);

    this.client.on('connect', () => {
      console.log('[Redis] Connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[Redis] Connected and ready');
    });

    this.client.on('error', (error) => {
      console.error('[Redis] Error:', error.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('[Redis] Connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      console.log(`[Redis] Reconnecting... (attempt ${this.reconnectAttempts})`);
    });

    // Wait for connection
    try {
      await this.client.ping();
      this.isConnected = true;
    } catch (error) {
      console.warn('[Redis] Initial connection failed, will retry:', error.message);
      this.isConnected = false;
    }

    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('[Redis] Disconnected');
    }
  }

  isAvailable() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  async get(key) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Redis] Error getting key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = null) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting key ${key}:`, error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Error deleting key ${key}:`, error.message);
      return false;
    }
  }

  async mget(keys) {
    if (!this.isAvailable() || !keys || keys.length === 0) {
      return [];
    }

    try {
      const values = await this.client.mget(keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      console.error('[Redis] Error in mget:', error.message);
      return [];
    }
  }

  async mset(keyValuePairs, ttlSeconds = null) {
    if (!this.isAvailable() || !keyValuePairs || Object.keys(keyValuePairs).length === 0) {
      return false;
    }

    try {
      const pipeline = this.client.pipeline();
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('[Redis] Error in mset:', error.message);
      return false;
    }
  }

  async keys(pattern) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`[Redis] Error getting keys with pattern ${pattern}:`, error.message);
      return [];
    }
  }

  async healthCheck() {
    if (!this.isAvailable()) {
      return { healthy: false, status: 'disconnected' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        status: 'connected',
        latency: `${latency}ms`
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        error: error.message
      };
    }
  }
}

// Singleton instance
let redisManagerInstance = null;

function getRedisManager() {
  if (!redisManagerInstance) {
    redisManagerInstance = new RedisManager();
  }
  return redisManagerInstance;
}

module.exports = {
  RedisManager,
  getRedisManager
};


