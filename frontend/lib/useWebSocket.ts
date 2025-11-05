import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketClient, type StatusUpdate, type DeviceUpdate } from './websocket';
import { networkApi, type NetworkStatus, type Config } from './api';

interface UseWebSocketOptions {
  enabled?: boolean;
  fallbackPollInterval?: number; // Polling interval if WebSocket fails (default: 60s)
  onStatusUpdate?: (status: NetworkStatus) => void;
  onDeviceUpdate?: (update: DeviceUpdate) => void;
  onError?: (error: Error) => void;
}

interface UseWebSocketResult {
  status: NetworkStatus | null;
  config: Config | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for WebSocket-based real-time status updates
 * Falls back to polling if WebSocket connection fails
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    enabled = true,
    fallbackPollInterval = 60000, // 60 seconds default
    onStatusUpdate,
    onDeviceUpdate,
    onError
  } = options;

  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [usePolling, setUsePolling] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const dashboardData = await networkApi.getDashboard();
      setStatus(dashboardData.status);
      setConfig(dashboardData.config as Config);
      setLoading(false);
      setError(null);
      
      if (onStatusUpdate) {
        onStatusUpdate(dashboardData.status);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      console.error('[useWebSocket] Error loading data:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  }, [onStatusUpdate, onError]);

  // Refresh function
  const refresh = useCallback(async () => {
    setLoading(true);
    await loadData();
  }, [loadData]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial data load
    loadData();

    const wsClient = getWebSocketClient();
    
    // Try to connect WebSocket
    if (!wsClient.getConnected()) {
      wsClient.connect();
    }

    // Check connection status periodically
    const checkConnection = () => {
      const connected = wsClient.getConnected();
      setIsConnected(connected);
      
      if (!connected && !usePolling) {
        console.warn('[useWebSocket] WebSocket not connected, falling back to polling');
        setUsePolling(true);
      } else if (connected && usePolling) {
        console.log('[useWebSocket] WebSocket connected, switching from polling');
        setUsePolling(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };

    // Set up polling fallback
    const startPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = setInterval(() => {
        if (!wsClient.getConnected()) {
          loadData();
        }
      }, fallbackPollInterval);
    };

    // WebSocket event handlers
    const unsubscribeStatus = wsClient.on('status:update', (data: unknown) => {
      const statusUpdate = data as StatusUpdate;
      if (statusUpdate.data) {
        setStatus(statusUpdate.data as NetworkStatus);
        if (onStatusUpdate) {
          onStatusUpdate(statusUpdate.data as NetworkStatus);
        }
      }
    });

    const unsubscribeDevice = wsClient.on('device:update', (data: unknown) => {
      const deviceUpdate = data as DeviceUpdate;
      if (onDeviceUpdate) {
        onDeviceUpdate(deviceUpdate);
      }
      
      // Update status with new device data (using functional update to avoid stale closure)
      setStatus(prevStatus => {
        if (!prevStatus || !deviceUpdate.deviceId || !deviceUpdate.status) {
          return prevStatus;
        }
        
        const updatedStatus = { ...prevStatus };
        updatedStatus.areas = updatedStatus.areas.map(area => ({
          ...area,
          devices: area.devices.map(device => 
            device.deviceId === deviceUpdate.deviceId
              ? { 
                  ...device, 
                  ...deviceUpdate.status,
                  // Normalize status to match DeviceStatus type ('up' | 'down' | 'unknown')
                  status: deviceUpdate.status.status === 'degraded' 
                    ? 'unknown' as const
                    : (deviceUpdate.status.status as 'up' | 'down' | 'unknown')
                }
              : device
          )
        }));
        return updatedStatus;
      });
    });

    const unsubscribeConnected = wsClient.on('connected', () => {
      setIsConnected(true);
      setUsePolling(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    });

    const unsubscribeDisconnected = wsClient.on('disconnected', () => {
      setIsConnected(false);
      setUsePolling(true);
      startPolling();
    });

    const unsubscribeError = wsClient.on('error', (data: unknown) => {
      const errorData = data as { error?: string };
      console.error('[useWebSocket] WebSocket error:', errorData.error);
      setUsePolling(true);
      startPolling();
      if (onError) {
        onError(new Error(errorData.error || 'WebSocket error'));
      }
    });

    const unsubscribeReconnectFailed = wsClient.on('reconnect_failed', () => {
      console.warn('[useWebSocket] WebSocket reconnection failed, using polling');
      setUsePolling(true);
      startPolling();
    });

    // Initial connection check
    checkConnection();
    const connectionCheckInterval = setInterval(checkConnection, 5000);

    // Start polling if needed
    if (!wsClient.getConnected()) {
      startPolling();
    }

    // Cleanup
    return () => {
      unsubscribeStatus();
      unsubscribeDevice();
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeError();
      unsubscribeReconnectFailed();
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      clearInterval(connectionCheckInterval);
    };
  }, [enabled, fallbackPollInterval, loadData, onStatusUpdate, onDeviceUpdate, onError, usePolling]);

  return {
    status,
    config,
    loading,
    error,
    isConnected,
    refresh
  };
}

