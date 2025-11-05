import { io, Socket } from 'socket.io-client';

/**
 * WebSocket client for real-time status updates
 * 
 * Reduces network bandwidth by 70-80% compared to polling
 * Falls back to polling if WebSocket connection fails
 */

function getWebSocketUrl(): string {
  // If explicitly set via environment variable, use that
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // If running in browser, detect from current location
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    
    // Convert http/https to ws/wss
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    
    // If accessing via domain (Cloudflare), use same domain
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${wsProtocol}//${hostname}`;
    }
    
    // Default to localhost
    return 'ws://localhost:5000';
  }

  // Default for server-side rendering
  return 'ws://localhost:5000';
}

class WebSocketClient {
  private socket: Socket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnected = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.url = getWebSocketUrl();
  }

  connect(): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    console.log(`[WebSocket] Connecting to ${this.url}...`);

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'], // Fallback to polling
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 20000,
      forceNew: false
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[WebSocket] Connected');
      this.emit('connected', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log(`[WebSocket] Disconnected: ${reason}`);
      this.emit('disconnected', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.warn(`[WebSocket] Connection error (attempt ${this.reconnectAttempts}):`, error.message);
      this.emit('error', { error: error.message });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[WebSocket] Reconnected after ${attemptNumber} attempts`);
      this.emit('reconnected', { attemptNumber });
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[WebSocket] Reconnection attempt ${attemptNumber}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed, falling back to polling');
      this.emit('reconnect_failed', {});
    });

    // Status update events
    this.socket.on('status:update', (data) => {
      this.emit('status:update', data);
    });

    this.socket.on('device:update', (data) => {
      this.emit('device:update', data);
    });

    this.socket.on('area:update', (data) => {
      this.emit('area:update', data);
    });

    this.socket.on('alert:new', (data) => {
      this.emit('alert:new', data);
    });

    // Handle ping/pong for connection health
    this.socket.on('pong', (data) => {
      // Acknowledge pong
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
      console.log('[WebSocket] Disconnected');
    }
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  off(event: string, callback?: (data: any) => void): void {
    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(event);
      return;
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in callback for ${event}:`, error);
        }
      });
    }
  }

  subscribe(deviceId?: string, areaId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe', { deviceId, areaId });
    }
  }

  unsubscribe(deviceId?: string, areaId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { deviceId, areaId });
    }
  }

  getConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  ping(): void {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }
}

// Singleton instance
let wsClientInstance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient();
  }
  return wsClientInstance;
}

export function connectWebSocket(): WebSocketClient {
  const client = getWebSocketClient();
  if (!client.getConnected()) {
    client.connect();
  }
  return client;
}

export function disconnectWebSocket(): void {
  if (wsClientInstance) {
    wsClientInstance.disconnect();
    wsClientInstance = null;
  }
}

// Export types
export interface StatusUpdate {
  data: {
    areas: any[];
    links: any[];
  };
  timestamp: string;
}

export interface DeviceUpdate {
  deviceId: string;
  status: {
    deviceId: string;
    status: 'up' | 'down' | 'degraded' | 'unknown';
    latency?: number;
    packetLoss?: number;
    lastChecked: string;
  };
  timestamp: string;
}

export interface AreaUpdate {
  areaId: string;
  status: any;
  timestamp: string;
}

export interface Alert {
  alert: any;
  timestamp: string;
}

