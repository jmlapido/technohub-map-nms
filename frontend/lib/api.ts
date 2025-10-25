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

// Authentication token management
let authToken: string | null = null
let tokenExpiry: Date | null = null

// API call throttling to prevent spam
let lastApiCall: { [key: string]: number } = {}
const API_THROTTLE_MS = 5000 // Minimum 5 seconds between identical API calls

// Check if token is valid and not expired
function isTokenValid(): boolean {
  if (!authToken || !tokenExpiry) {
    console.log('Token validation failed: no token or expiry')
    return false
  }
  const isValid = new Date() < tokenExpiry
  console.log('Token validation:', { isValid, tokenExpiry, now: new Date() })
  return isValid
}

// Set authentication token
export function setAuthToken(token: string, expiresAt: string) {
  authToken = token
  tokenExpiry = new Date(expiresAt)
  
  // Store in localStorage for persistence across page reloads
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token)
    localStorage.setItem('authTokenExpiry', expiresAt)
  }
}

// Clear authentication token
export function clearAuthToken() {
  authToken = null
  tokenExpiry = null
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authTokenExpiry')
  }
}

// Get current authentication status
export function getAuthStatus(): { isAuthenticated: boolean, tokenExpiry: Date | null } {
  return {
    isAuthenticated: isTokenValid(),
    tokenExpiry: tokenExpiry
  }
}

// Initialize token from localStorage on client side
if (typeof window !== 'undefined') {
  const storedToken = localStorage.getItem('authToken')
  const storedExpiry = localStorage.getItem('authTokenExpiry')
  
  if (storedToken && storedExpiry) {
    const expiryDate = new Date(storedExpiry)
    if (expiryDate > new Date()) {
      authToken = storedToken
      tokenExpiry = expiryDate
      console.log('Token initialized from localStorage:', { hasToken: !!authToken, expiry: tokenExpiry })
    } else {
      // Token expired, clear it
      console.log('Token expired, clearing from localStorage')
      localStorage.removeItem('authToken')
      localStorage.removeItem('authTokenExpiry')
    }
  } else {
    console.log('No token found in localStorage')
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
})

// Add request interceptor for debugging and authentication
api.interceptors.request.use((config) => {
  const requestKey = `${config.method?.toUpperCase()}_${config.url}`
  const now = Date.now()
  
  // Don't throttle critical requests or POST requests to config (auto-save)
  const isCriticalRequest = config.url?.includes('/api/status')
  const isPostConfig = config.method?.toUpperCase() === 'POST' && config.url?.includes('/api/config')
  const isGetConfig = config.method?.toUpperCase() === 'GET' && config.url?.includes('/api/config')
  
  // Only throttle if it's not a critical request, not a POST config request, and not a GET config request
  if (!isCriticalRequest && !isPostConfig && !isGetConfig && lastApiCall[requestKey] && (now - lastApiCall[requestKey]) < API_THROTTLE_MS) {
    console.log(`API Request throttled: ${requestKey}`)
    return Promise.reject(new Error('Request throttled'))
  }
  
  // Only track requests that we might want to throttle in the future
  if (!isCriticalRequest && !isPostConfig && !isGetConfig) {
    lastApiCall[requestKey] = now
  }
  
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
  
  // Add authentication token to protected routes
  const needsAuth = config.url?.includes('/api/config') || config.url?.includes('/api/export') || config.url?.includes('/api/import') || config.url?.includes('/api/auth/change-password')
  if (needsAuth) {
    const tokenValid = isTokenValid()
    console.log(`Auth needed for ${config.url}:`, { tokenValid, hasToken: !!authToken })
    if (tokenValid) {
      config.headers.Authorization = `Bearer ${authToken}`
      console.log('Added auth header')
    } else {
      console.log('No valid token, request will likely fail')
    }
  }
  
  return config
})

// Add response interceptor with retry logic for better stability
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    
    console.error('API Error:', error.message)
    
    // Handle throttled requests - don't retry these or treat as auth failure
    if (error.message === 'Request throttled') {
      console.log('Request was throttled, not an authentication issue')
      return Promise.reject(error)
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.log('Authentication failed, clearing token')
      clearAuthToken()
      
      // Dispatch custom event for authentication failure
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-failed'))
      }
      
      return Promise.reject(error)
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - backend may not be responding')
    }
    
    // Retry logic for failed requests (server errors and timeouts) - limit to 1 retry
    if (config && !config._retry && (error.response?.status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED')) {
      config._retry = true
      console.log('Retrying request after error...')
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retry
      return api(config)
    }
    
    return Promise.reject(error)
  }
)

export interface Area {
  id: string
  name: string
  type: 'Homes' | 'PisoWiFi Vendo' | 'Schools' | 'Server/Relay'
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
    console.log('Calling getStatus from API_BASE:', API_BASE)
    const { data } = await api.get('/api/status')
    console.log('Received status data:', data)
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
  
  getPublicConfig: async (): Promise<Pick<Config, 'areas' | 'links' | 'devices'>> => {
    console.log('Calling getPublicConfig from API_BASE:', API_BASE)
    const { data } = await api.get('/api/config/public')
    console.log('Received config data:', data)
    return data
  },
  
  updateConfig: async (config: Partial<Config>): Promise<void> => {
    await api.post('/api/config', config)
  },
  
  exportData: async (): Promise<Blob> => {
    const response = await api.get('/api/export', {
      responseType: 'blob'
    })
    return response.data
  },
  
  importData: async (file: File): Promise<{ success: boolean, message: string }> => {
    const formData = new FormData()
    formData.append('backup', file)
    
    const { data } = await api.post('/api/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    return data
  }
}

export const authApi = {
  login: async (password: string): Promise<{ token: string, expiresAt: string }> => {
    const { data } = await api.post('/api/auth/login', { password })
    return data
  },
  
  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Ignore errors on logout
    }
    clearAuthToken()
  },
  
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    })
  },
  
  getAuthStatus: async (): Promise<{ authenticated: boolean, sessionExpiresAt: string }> => {
    const { data } = await api.get('/api/auth/status')
    return data
  }
}

