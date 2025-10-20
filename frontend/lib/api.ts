import axios from 'axios'

// Smart API URL detection that works in all scenarios:
// 1. Cloudflare Tunnel (same domain)
// 2. Local IP access
// 3. Localhost development
function getApiBaseUrl(): string {
  // If explicitly set via environment variable, use that
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  // If running in browser, detect from current location
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    
    // If accessing via domain (Cloudflare), use same domain
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}`
    }
    
    // If accessing via local IP, use the same IP
    // This will be handled by the browser automatically
    return 'http://localhost:5000'
  }

  // Default for server-side rendering
  return 'http://localhost:5000'
}

const API_BASE = getApiBaseUrl()

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

// Add request interceptor for debugging
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
  return config
})

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message)
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - backend may not be responding')
    }
    return Promise.reject(error)
  }
)

export interface Area {
  id: string
  name: string
  type: 'Homes' | 'PisoWiFi Vendo' | 'Schools'
  lat: number
  lng: number
}

export interface Link {
  id: string
  from: string
  to: string
}

export interface Device {
  id: string
  areaId: string
  name: string
  type: 'wireless-antenna' | 'wifi-soho' | 'router' | 'wifi-outdoor'
  ip: string
}

export interface DeviceStatus {
  deviceId: string
  status: 'up' | 'down' | 'unknown'
  latency?: number
  packetLoss?: number
  lastChecked: string
  offlineDuration?: number
}

export interface AreaStatus {
  areaId: string
  status: 'up' | 'down' | 'degraded'
  devices: DeviceStatus[]
}

export interface NetworkStatus {
  areas: AreaStatus[]
  links: Array<{
    linkId: string
    status: 'up' | 'down' | 'degraded'
    latency?: number
  }>
}

export interface Config {
  areas: Area[]
  links: Link[]
  devices: Device[]
  settings: {
    pingInterval: number
    thresholds: {
      latency: {
        good: number
        degraded: number
      }
      packetLoss: {
        good: number
        degraded: number
      }
    }
  }
}

export const networkApi = {
  getStatus: async (): Promise<NetworkStatus> => {
    const { data } = await api.get('/api/status')
    return data
  },
  
  getHistory: async (deviceId: string): Promise<any[]> => {
    const { data } = await api.get(`/api/history/${deviceId}`)
    return data
  },
  
  getConfig: async (): Promise<Config> => {
    const { data } = await api.get('/api/config')
    return data
  },
  
  updateConfig: async (config: Partial<Config>): Promise<void> => {
    await api.post('/api/config', config)
  },
}

