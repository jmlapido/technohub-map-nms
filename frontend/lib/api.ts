import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Extend Axios config to include custom retry properties
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _retryCount?: number
}

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
    const { protocol, hostname, port } = window.location
    
    // If accessing via domain (Cloudflare), use same domain (no port needed)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return `${protocol}//${hostname}`
    }
    
    // If accessing via IP address, use the same IP with backend port
    if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return `http://${hostname}:5000`
    }
    
    // If accessing via localhost, use localhost with backend port
    return 'http://localhost:5000'
  }

  // Default for server-side rendering
  return 'http://localhost:5000'
}

const API_BASE = getApiBaseUrl()

// Authentication token management
let authToken: string | null = null
let tokenExpiry: Date | null = null

type UnknownRecord = Record<string, unknown>

// API call throttling / dedupe
const lastApiCall: Record<string, number> = {}
const API_THROTTLE_MS = 2000 // Minimum 2 seconds between identical API calls
const inFlight: Map<string, Promise<unknown>> = new Map()
const recentCache: Map<string, { ts: number, data: unknown }> = new Map()
const RECENT_CACHE_MS = 1500

// ETag caching for better performance
const etagCache: Record<string, string> = {}

let hasWarnedTokenState = false;
// Check if token is valid and not expired
function isTokenValid(): boolean {
  if (!authToken || !tokenExpiry) {
    if (!hasWarnedTokenState) {
      console.log('Token validation failed: no token or expiry')
      hasWarnedTokenState = true
    }
    return false
  }
  const isValid = new Date() < tokenExpiry
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
  } else if (!hasWarnedTokenState) {
    console.log('No token found in localStorage')
    hasWarnedTokenState = true
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // Increased timeout for Cloudflare
  headers: {
    'Accept': 'application/json',
    // Remove unsafe Accept-Encoding header in browser
  }
})

// Enhanced request interceptor with ETag support
api.interceptors.request.use((config) => {
  const requestKey = `${config.method?.toUpperCase()}_${config.url}`
  const now = Date.now()
  
  // Smart throttling - less aggressive for dashboard endpoint
  const isDashboard = config.url?.includes('/api/dashboard')
  const isCriticalRequest = config.url?.includes('/api/status') || isDashboard
  const isPostConfig = config.method?.toUpperCase() === 'POST' && config.url?.includes('/api/config')
  const isGetConfig = config.method?.toUpperCase() === 'GET' && config.url?.includes('/api/config')
  
  // Reduced throttling for better responsiveness
  const throttleTime = isDashboard ? 1000 : API_THROTTLE_MS // 1s for dashboard, 2s for others
  
  if (!isCriticalRequest && !isPostConfig && !isGetConfig && lastApiCall[requestKey] && (now - lastApiCall[requestKey]) < throttleTime) {
    console.log(`API Request throttled: ${requestKey}`)
    return Promise.reject(new Error('Request throttled'))
  }
  
  if (!isCriticalRequest && !isPostConfig && !isGetConfig) {
    lastApiCall[requestKey] = now
  }
  
  // Add ETag for caching (unless explicitly bypassing cache)
  const bypassCache = config.headers?.['Cache-Control'] === 'no-cache' || config.headers?.['If-None-Match'] === ''
  const etag = bypassCache ? undefined : etagCache[requestKey]
  if (etag && !bypassCache && (config.url?.includes('/api/dashboard') || config.url?.includes('/api/config/public'))) {
    config.headers['If-None-Match'] = etag
  } else if (bypassCache) {
    // Ensure ETag header is removed when bypassing cache
    delete config.headers['If-None-Match']
  }
  
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}${etag && !bypassCache ? ' (with ETag)' : bypassCache ? ' (bypassing cache)' : ''}`)
  
  // Add authentication token to protected routes
  const needsAuth = config.url?.includes('/api/config') || config.url?.includes('/api/export') || config.url?.includes('/api/import') || config.url?.includes('/api/auth/change-password')
  if (needsAuth) {
    const tokenValid = isTokenValid()
    if (tokenValid) {
      config.headers.Authorization = `Bearer ${authToken}`
    }
  }
  
  return config
})

// Enhanced response interceptor with ETag caching
api.interceptors.response.use(
  (response) => {
    // Cache ETag for future requests (only if not bypassing cache)
    const bypassCache = response.config.headers?.['Cache-Control'] === 'no-cache' || response.config.headers?.['If-None-Match'] === ''
    const etag = response.headers.etag || response.headers.ETag
    if (etag && !bypassCache) {
      const requestKey = `${response.config.method?.toUpperCase()}_${response.config.url}`
      etagCache[requestKey] = etag
    }
    
    return response
  },
  async (error: AxiosError<unknown>) => {
    const config = error.config as ExtendedAxiosRequestConfig | undefined
    
    // Handle 304 Not Modified responses
    if (error.response?.status === 304) {
      console.log('Content not modified (304), but we need fresh data - will retry')
      // Don't return cached data for config endpoints - force fresh fetch
      if (config?.url?.includes('/api/config/public') || config?.url?.includes('/api/config')) {
        return Promise.reject({ ...error, needsFreshFetch: true })
      }
      // Return empty response - the caller should handle this
      return Promise.resolve({ ...error.response, data: null, notModified: true })
    }
    
    console.error('API Error:', error.message)
    
    // Handle throttled requests
    if (error.message === 'Request throttled') {
      return Promise.reject(error)
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      clearAuthToken()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-failed'))
      }
      return Promise.reject(error)
    }
    
    // Enhanced retry logic with exponential backoff
    if (
      config &&
      !config._retry &&
      (config.method === 'get' || config.method === 'GET') &&
      ((error.response?.status !== undefined && error.response.status >= 500) || error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED')
    ) {
      config._retry = true
      config._retryCount = 1;
    }
    if (
      config &&
      config._retry &&
      config._retryCount !== undefined &&
      config._retryCount < 3 &&
      (config.method === 'get' || config.method === 'GET') &&
      ((error.response?.status !== undefined && error.response.status >= 500) || error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED')
    ) {
      const delay = Math.min(1000 * Math.pow(2, config._retryCount), 5000)
      config._retryCount = (config._retryCount || 0) + 1
      console.log(`Retrying request after ${delay}ms... (attempt ${config._retryCount})`)
      await new Promise(resolve => setTimeout(resolve, delay))
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

export type LinkConnectionType = 'wireless' | 'lan' | 'fiber' | 'backhaul' | 'other'

export interface LinkEndpoint {
  areaId: string | null
  deviceId: string | null
  interface?: string | null
  interfaceType?: LinkConnectionType | string
  label?: string
}

export type LinkMetadata = Record<string, unknown>

export interface Link {
  id: string
  endpoints?: [LinkEndpoint, LinkEndpoint]
  type?: LinkConnectionType | string
  metadata?: LinkMetadata
  from?: string | null
  to?: string | null
  label?: string
}

export interface NetworkLinkStatusEndpoint {
  areaId: string | null
  areaName?: string | null
  deviceId: string | null
  deviceName?: string | null
  status?: 'up' | 'down' | 'degraded' | 'unknown'
  latency?: number
  packetLoss?: number
  lastChecked?: string | null
  interface?: string | null
  interfaceType?: string | null
  label?: string | null
}

export interface NetworkLinkStatus {
  linkId: string
  status: 'up' | 'down' | 'degraded' | 'unknown'
  latency?: number
  type?: string
  metadata?: Record<string, unknown>
  endpoints?: NetworkLinkStatusEndpoint[]
}

function normalizeDevice(rawDevice: Record<string, unknown>): Device {
  let thresholds: Device['thresholds'] | undefined = undefined
  
  // Safely extract thresholds with type checking
  if (rawDevice.thresholds && typeof rawDevice.thresholds === 'object') {
    const rawThresholds = rawDevice.thresholds as Record<string, unknown>
    
    const latencyObj = rawThresholds.latency && typeof rawThresholds.latency === 'object'
      ? rawThresholds.latency as Record<string, unknown>
      : null
      
    const packetLossObj = rawThresholds.packetLoss && typeof rawThresholds.packetLoss === 'object'
      ? rawThresholds.packetLoss as Record<string, unknown>
      : null
    
    if (latencyObj && packetLossObj) {
      thresholds = {
        latency: {
          good: typeof latencyObj.good === 'number' ? latencyObj.good : 50,
          degraded: typeof latencyObj.degraded === 'number' ? latencyObj.degraded : 150
        },
        packetLoss: {
          good: typeof packetLossObj.good === 'number' ? packetLossObj.good : 1,
          degraded: typeof packetLossObj.degraded === 'number' ? packetLossObj.degraded : 5
        }
      }
    }
  }
  
  return {
    id: String(rawDevice.id),
    areaId: String(rawDevice.areaId || ''),
    name: String(rawDevice.name || 'Unnamed Device'),
    type: (rawDevice.type as Device['type']) || 'router',
    ip: String(rawDevice.ip || ''),
    criticality: (rawDevice.criticality as Device['criticality']) || 'normal',
    thresholds
  }
}

function normalizeLink(rawLink: Record<string, unknown>, devices: Device[] = []): Link {
  if (!rawLink) {
    return {
      id: `link-${Date.now()}`,
      endpoints: [
        { areaId: null, deviceId: null },
        { areaId: null, deviceId: null }
      ]
    }
  }

  const deviceMap = new Map(devices.map(device => [device.id, device]))

  const rawEndpoints = Array.isArray(rawLink.endpoints) && rawLink.endpoints.length >= 2
    ? rawLink.endpoints
    : [
        {
          areaId: rawLink.from ?? null,
          deviceId: rawLink.fromDeviceId ?? null,
          interface: rawLink.fromInterface ?? null,
          interfaceType: rawLink.fromInterfaceType ?? rawLink.type
        },
        {
          areaId: rawLink.to ?? null,
          deviceId: rawLink.toDeviceId ?? null,
          interface: rawLink.toInterface ?? null,
          interfaceType: rawLink.toInterfaceType ?? rawLink.type
        }
      ]

  const endpoints = rawEndpoints.slice(0, 2).map((endpoint: UnknownRecord | null | undefined, index: number) => {
    const safeEndpoint = endpoint ?? {}
    const deviceId = safeEndpoint.deviceId != null ? String(safeEndpoint.deviceId) : null
    const resolvedDevice = deviceId ? deviceMap.get(deviceId) : undefined
    const fallbackAreaId = index === 0 ? rawLink.from : rawLink.to
    const rawAreaId = safeEndpoint.areaId ?? resolvedDevice?.areaId ?? fallbackAreaId
    const areaId = rawAreaId != null ? String(rawAreaId) : null

    const normalizedEndpoint: LinkEndpoint = {
      areaId,
      deviceId
    }

    if (safeEndpoint.interface !== undefined) {
      const interfaceVal = safeEndpoint.interface
      normalizedEndpoint.interface = interfaceVal != null ? String(interfaceVal) : null
    }

    if (safeEndpoint.interfaceType !== undefined && safeEndpoint.interfaceType != null) {
      normalizedEndpoint.interfaceType = String(safeEndpoint.interfaceType) as LinkConnectionType | string
    }

    if (safeEndpoint.label !== undefined && safeEndpoint.label != null) {
      normalizedEndpoint.label = String(safeEndpoint.label)
    }

    return normalizedEndpoint
  })

  while (endpoints.length < 2) {
    endpoints.push({ areaId: null, deviceId: null })
  }

  const tuple = [endpoints[0], endpoints[1]] as [LinkEndpoint, LinkEndpoint]

  const linkId = rawLink.id != null ? String(rawLink.id) : `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const linkType = rawLink.type != null ? String(rawLink.type) as LinkConnectionType | string : undefined
  const linkLabel = rawLink.label != null ? String(rawLink.label) : undefined
  const linkFrom = rawLink.from != null ? String(rawLink.from) : null
  const linkTo = rawLink.to != null ? String(rawLink.to) : null

  const metadata: LinkMetadata | undefined = rawLink.metadata && typeof rawLink.metadata === 'object' && !Array.isArray(rawLink.metadata)
    ? rawLink.metadata as LinkMetadata
    : undefined

  const normalized: Link = {
    id: linkId,
    endpoints: tuple,
    type: linkType,
    metadata,
    label: linkLabel
  }

  normalized.from = linkFrom ?? tuple[0]?.areaId ?? null
  normalized.to = linkTo ?? tuple[1]?.areaId ?? null

  return normalized
}

function normalizeLinks(rawLinks: UnknownRecord[] = [], devices: Device[] = []): Link[] {
  if (!Array.isArray(rawLinks)) {
    return []
  }
  return rawLinks.map(link => normalizeLink(link, devices))
}

function normalizeNetworkLinkEndpoint(rawEndpoint: UnknownRecord): NetworkLinkStatusEndpoint {
  return {
    areaId: rawEndpoint?.areaId != null ? String(rawEndpoint.areaId) : null,
    areaName: rawEndpoint?.areaName != null ? String(rawEndpoint.areaName) : null,
    deviceId: rawEndpoint?.deviceId != null ? String(rawEndpoint.deviceId) : null,
    deviceName: rawEndpoint?.deviceName != null ? String(rawEndpoint.deviceName) : null,
    status: (rawEndpoint?.status as NetworkLinkStatusEndpoint['status']) ?? 'unknown',
    latency: typeof rawEndpoint?.latency === 'number' ? rawEndpoint.latency : undefined,
    packetLoss: typeof rawEndpoint?.packetLoss === 'number' ? rawEndpoint.packetLoss : undefined,
    lastChecked: rawEndpoint?.lastChecked != null ? String(rawEndpoint.lastChecked) : null,
    interface: rawEndpoint?.interface != null ? String(rawEndpoint.interface) : null,
    interfaceType: rawEndpoint?.interfaceType != null ? String(rawEndpoint.interfaceType) : null,
    label: rawEndpoint?.label != null ? String(rawEndpoint.label) : null
  }
}

function normalizeNetworkLinkStatus(rawLinkStatus: UnknownRecord): NetworkLinkStatus {
  const statusValue = rawLinkStatus?.status
  const normalizedStatus: NetworkLinkStatus['status'] = statusValue === 'up' || statusValue === 'down' || statusValue === 'degraded'
    ? statusValue
    : 'unknown'

  const metadata: Record<string, unknown> | undefined = 
    rawLinkStatus?.metadata && 
    typeof rawLinkStatus.metadata === 'object' && 
    !Array.isArray(rawLinkStatus.metadata)
      ? rawLinkStatus.metadata as Record<string, unknown>
      : undefined

  return {
    linkId: rawLinkStatus?.linkId ? String(rawLinkStatus.linkId) : rawLinkStatus?.id ? String(rawLinkStatus.id) : '',
    status: normalizedStatus,
    latency: typeof rawLinkStatus?.latency === 'number' ? rawLinkStatus.latency : undefined,
    type: rawLinkStatus?.type != null ? String(rawLinkStatus.type) : undefined,
    metadata,
    endpoints: Array.isArray(rawLinkStatus?.endpoints)
      ? rawLinkStatus.endpoints.map(normalizeNetworkLinkEndpoint)
      : undefined
  }
}

function normalizeTopologySettings(rawTopology: UnknownRecord | undefined): TopologySettings {
  return {
    showRemoteAreas: rawTopology?.showRemoteAreas !== false,
    showLinkLatency: rawTopology?.showLinkLatency !== false,
    preferCompactLayout: rawTopology?.preferCompactLayout === true,
    autoIncludeUnlinkedDevices: rawTopology?.autoIncludeUnlinkedDevices !== false
  }
}

function normalizeSettings(rawSettings: UnknownRecord | undefined): Config['settings'] {
  // Safely extract nested threshold values with type checking
  let latencyGood: number | undefined = undefined
  let latencyDegraded: number | undefined = undefined
  let packetLossGood: number | undefined = undefined
  let packetLossDegraded: number | undefined = undefined
  
  if (rawSettings?.thresholds && typeof rawSettings.thresholds === 'object') {
    const thresholds = rawSettings.thresholds as Record<string, unknown>
    
    if (thresholds.latency && typeof thresholds.latency === 'object') {
      const latency = thresholds.latency as Record<string, unknown>
      if (typeof latency.good === 'number') latencyGood = latency.good
      if (typeof latency.degraded === 'number') latencyDegraded = latency.degraded
    }
    
    if (thresholds.packetLoss && typeof thresholds.packetLoss === 'object') {
      const packetLoss = thresholds.packetLoss as Record<string, unknown>
      if (typeof packetLoss.good === 'number') packetLossGood = packetLoss.good
      if (typeof packetLoss.degraded === 'number') packetLossDegraded = packetLoss.degraded
    }
  }

  return {
    pingInterval: typeof rawSettings?.pingInterval === 'number' ? rawSettings.pingInterval : 60,
    frontendPollInterval: typeof rawSettings?.frontendPollInterval === 'number' ? rawSettings.frontendPollInterval : undefined,
    cacheMaxAge: typeof rawSettings?.cacheMaxAge === 'number' ? rawSettings.cacheMaxAge : undefined,
    maxHistoryDays: typeof rawSettings?.maxHistoryDays === 'number' ? rawSettings.maxHistoryDays : undefined,
    batchSize: typeof rawSettings?.batchSize === 'number' ? rawSettings.batchSize : undefined,
    thresholds: {
      latency: {
        good: typeof latencyGood === 'number' ? latencyGood : 50,
        degraded: typeof latencyDegraded === 'number' ? latencyDegraded : 150
      },
      packetLoss: {
        good: typeof packetLossGood === 'number' ? packetLossGood : 1,
        degraded: typeof packetLossDegraded === 'number' ? packetLossDegraded : 5
      }
    },
    topology: normalizeTopologySettings(rawSettings?.topology as UnknownRecord | undefined)
  }
}

function normalizePartialConfig(rawConfig: Record<string, unknown> | undefined | null): Pick<Config, 'areas' | 'links' | 'devices' | 'settings'> {
  const safeConfig: Record<string, unknown> = rawConfig || {};
  const areas: Area[] = Array.isArray(safeConfig.areas)
    ? (safeConfig.areas as unknown[]).map(rawArea => {
        const area = rawArea as Record<string, unknown>
        return {
          id: area.id != null ? String(area.id) : '',
          name: area.name != null ? String(area.name) : 'Unknown Area',
          type: (area.type as Area['type']) || 'Homes',
          lat: area.lat != null ? Number(area.lat) : 0,
          lng: area.lng != null ? Number(area.lng) : 0
        }
      })
    : []

  const devices: Device[] = Array.isArray(safeConfig.devices)
    ? (safeConfig.devices as UnknownRecord[]).map(normalizeDevice)
    : []

  const links: Link[] = normalizeLinks(Array.isArray(safeConfig.links) ? (safeConfig.links as UnknownRecord[]) : [], devices)

  return {
    areas,
    devices,
    links,
    settings: normalizeSettings(safeConfig.settings as UnknownRecord | undefined)
  }
}

function normalizeFullConfig(rawConfig: Record<string, unknown> | null | undefined): Config {
  const partial = normalizePartialConfig(rawConfig)
  return {
    areas: partial.areas,
    devices: partial.devices,
    links: partial.links,
    settings: partial.settings
  }
}

function normalizeNetworkStatus(rawStatus: Record<string, unknown> | undefined | null): NetworkStatus {
  const safeStatus: Record<string, unknown> = rawStatus || {};
  const areas = Array.isArray(safeStatus.areas) ? (safeStatus.areas as AreaStatus[]) : []
  const links = Array.isArray(safeStatus.links)
    ? (safeStatus.links as UnknownRecord[]).map(normalizeNetworkLinkStatus)
    : []

  return {
    areas,
    links
  }
}

function normalizeDashboardResponse(data: UnknownRecord | null | undefined): { status: NetworkStatus, config: Pick<Config, 'areas' | 'links' | 'devices' | 'settings'>, lastUpdated: string } {
  if (!data) {
    return {
      status: { areas: [], links: [] },
      config: { areas: [], devices: [], links: [], settings: normalizeSettings(undefined) },
      lastUpdated: new Date().toISOString()
    }
  }

  const configData = data.config && typeof data.config === 'object' ? data.config as Record<string, unknown> : {}
  const statusData = data.status && typeof data.status === 'object' ? data.status as Record<string, unknown> : {}
  
  const normalizedConfig = normalizePartialConfig(configData)
  const status = normalizeNetworkStatus(statusData)

  const lastUpdated = typeof data.lastUpdated === 'string' ? data.lastUpdated : new Date().toISOString()
  
  return {
    status,
    config: normalizedConfig,
    lastUpdated
  }
}

function normalizeConfigForSave(config: Partial<Config>): Partial<Config> {
  if (!config) {
    return config
  }

  const payload: Partial<Config> = {
    ...config
  }

  if (payload.settings) {
    payload.settings = {
      ...payload.settings,
      topology: normalizeTopologySettings(payload.settings.topology as unknown as UnknownRecord | undefined)
    }
  }

  if (Array.isArray(config.links)) {
    const devices = (config.devices || []) as Device[]
    payload.links = config.links.map(link => {
      // Convert Link to Record<string, unknown> to satisfy normalizeLink parameters
      const linkData = link as unknown as Record<string, unknown>
      const normalized = normalizeLink(linkData, devices)
      return {
        id: normalized.id,
        type: normalized.type,
        endpoints: normalized.endpoints,
        metadata: normalized.metadata,
        from: normalized.from,
        to: normalized.to,
        label: normalized.label
      }
    })
  }

  return payload
}

export interface Device {
  id: string
  areaId: string
  name: string
  type: 'wireless-antenna' | 'wifi-soho' | 'router' | 'wifi-outdoor'
  ip: string
  criticality?: 'critical' | 'high' | 'normal' | 'low'
  thresholds?: {
    latency: { good: number, degraded: number }
    packetLoss: { good: number, degraded: number }
  }
  // V3: SNMP configuration
  snmpEnabled?: boolean
  snmpCommunity?: string
  snmpVersion?: 1 | 2 | 3
}

export interface TopologySettings {
  showRemoteAreas: boolean
  showLinkLatency: boolean
  preferCompactLayout: boolean
  autoIncludeUnlinkedDevices: boolean
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
  links: NetworkLinkStatus[]
}

export interface Config {
  areas: Area[]
  links: Link[]
  devices: Device[]
  settings: {
    pingInterval: number
    frontendPollInterval?: number
    cacheMaxAge?: number
    maxHistoryDays?: number
    batchSize?: number
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
    topology: TopologySettings
  }
}

export const networkApi = {
  // New optimized dashboard endpoint that combines status and config
  getDashboard: async (): Promise<{ status: NetworkStatus, config: Pick<Config, 'areas' | 'links' | 'devices' | 'settings'>, lastUpdated: string }> => {
    const key = 'GET_/api/dashboard'
    const now = Date.now()

    // Serve from very recent cache to avoid spam
    const cached = recentCache.get(key)
    if (cached && (now - cached.ts) < RECENT_CACHE_MS) {
      return cached.data as { status: NetworkStatus, config: Pick<Config, 'areas' | 'links' | 'devices' | 'settings'>, lastUpdated: string }
    }

    // Dedupe concurrent requests
    if (inFlight.has(key)) {
      return inFlight.get(key) as Promise<{ status: NetworkStatus, config: Pick<Config, 'areas' | 'links' | 'devices' | 'settings'>, lastUpdated: string }>
    }

    const promise = (async () => {
      try {
        const response = await api.get('/api/dashboard')
      
        // Handle 304 Not Modified
        // Custom property added in axios response interceptor
        if ((response as unknown as { notModified?: boolean }).notModified) {
          throw new Error('Not modified')
        }
      
        const result = normalizeDashboardResponse(response.data)
        recentCache.set(key, { ts: Date.now(), data: result })
        return result
      } catch (error: unknown) {
        const message = error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Unknown error'
        console.warn('Dashboard endpoint failed, falling back to separate calls:', message)
        const [statusData, configData] = await Promise.all([
          api.get('/api/status'),
          api.get('/api/config/public')
        ])
        const result = {
          status: normalizeNetworkStatus(statusData.data),
          config: normalizePartialConfig(configData.data),
          lastUpdated: new Date().toISOString()
        }
        recentCache.set(key, { ts: Date.now(), data: result })
        return result
      } finally {
        inFlight.delete(key)
      }
    })()

    inFlight.set(key, promise)
    return promise
  },
  
  getStatus: async (): Promise<NetworkStatus> => {
    const { data } = await api.get('/api/status')
    return normalizeNetworkStatus(data)
  },
  
  getHistory: async (deviceId: string): Promise<unknown[]> => {
    const { data } = await api.get(`/api/history/${deviceId}`)
    return data
  },
  
  getConfig: async (): Promise<Config> => {
    const { data } = await api.get('/api/config')
    return normalizeFullConfig(data)
  },
  
  getPublicConfig: async (): Promise<Pick<Config, 'areas' | 'links' | 'devices' | 'settings'>> => {
    try {
      const response = await api.get('/api/config/public')
      // Handle 304 Not Modified - force fresh fetch
      if ((response as unknown as { notModified?: boolean }).notModified || !response.data) {
        console.warn('[API] Config response was 304 or empty, forcing fresh fetch...')
        // Clear ETag cache and force fresh fetch
        const requestKey = 'GET:/api/config/public'
        const requestKeyAlt = 'GET_/api/config/public'
        delete etagCache[requestKey]
        delete etagCache[requestKeyAlt]
        // Use cache-busting query parameter to ensure fresh data
        const freshResponse = await api.get(`/api/config/public?_t=${Date.now()}`, {
          headers: { 'If-None-Match': '', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        console.log('[API getPublicConfig] Fresh fetch result:', {
          hasData: !!freshResponse.data,
          areasCount: freshResponse.data?.areas?.length || 0,
          devicesCount: freshResponse.data?.devices?.length || 0
        })
        return normalizePartialConfig(freshResponse.data)
      }
      const { data } = response
      console.log('[API getPublicConfig] Received config data:', {
        hasData: !!data,
        areasCount: data?.areas?.length || 0,
        devicesCount: data?.devices?.length || 0,
        linksCount: data?.links?.length || 0
      })
      return normalizePartialConfig(data)
    } catch (error: unknown) {
      // Handle 304 errors specifically
      const err = error as { needsFreshFetch?: boolean; response?: { status?: number } }
      if (err.needsFreshFetch || err.response?.status === 304) {
        console.warn('[API] Got 304, forcing fresh fetch without cache headers...')
        // Clear ETag cache to prevent infinite loop
        const requestKey = 'GET:/api/config/public'
        const requestKeyAlt = 'GET_/api/config/public'
        delete etagCache[requestKey]
        delete etagCache[requestKeyAlt]
        // Use cache-busting query parameter to ensure fresh data
        const freshResponse = await api.get(`/api/config/public?_t=${Date.now()}`, {
          headers: { 'If-None-Match': '', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        console.log('[API getPublicConfig] Fresh fetch after 304:', {
          hasData: !!freshResponse.data,
          areasCount: freshResponse.data?.areas?.length || 0,
          devicesCount: freshResponse.data?.devices?.length || 0
        })
        return normalizePartialConfig(freshResponse.data)
      }
      throw error
    }
  },
  
  updateConfig: async (config: Partial<Config>): Promise<{ success: boolean; invalidLinksRemoved?: number; message?: string }> => {
    const payload = normalizeConfigForSave(config)
    const { data } = await api.post('/api/config', payload)
    return data
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
    } catch {
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
    const key = 'GET_/api/auth/status'
    const now = Date.now()
    const cached = recentCache.get(key)
    if (cached && (now - cached.ts) < RECENT_CACHE_MS) {
      return cached.data as { authenticated: boolean, sessionExpiresAt: string }
    }

    if (inFlight.has(key)) {
      return inFlight.get(key) as Promise<{ authenticated: boolean, sessionExpiresAt: string }>
    }

    const promise = (async () => {
      try {
        const { data } = await api.get('/api/auth/status')
        recentCache.set(key, { ts: Date.now(), data })
        return data
      } finally {
        inFlight.delete(key)
      }
    })()

    inFlight.set(key, promise)
    return promise
  }
}

