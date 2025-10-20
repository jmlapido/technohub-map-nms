import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

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

