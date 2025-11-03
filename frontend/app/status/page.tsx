'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { networkApi, type NetworkStatus, type Config, type DeviceStatus, type NetworkLinkStatus, type TopologySettings, type AreaStatus } from '@/lib/api'
import { formatLatency } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Activity, Wifi, AlertTriangle, CheckCircle2, XCircle, Home, ShoppingBag, GraduationCap, Router, Radio, Satellite, Search, Filter, Gauge } from 'lucide-react'
import { emitTelemetry } from '@/components/TelemetryToast'

class SectionErrorBoundary extends React.Component<React.PropsWithChildren<{ fallback?: React.ReactNode }>, { hasError: boolean }> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ReactNode }>) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Section rendering failed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null
    }
    return this.props.children
  }
}

interface DeviceChipProps {
  label: string
  subtitle?: string
  status?: DeviceStatus['status'] | NetworkLinkStatus['status'] | 'unknown'
  variant: 'remote' | 'local' | 'summary' | 'interface'
  className?: string
}

function DeviceChip({ label, subtitle, status = 'unknown', variant, className }: DeviceChipProps) {
  const baseClasses =
    variant === 'remote'
      ? 'border-blue-200/60 bg-blue-50/60 text-blue-700 dark:border-blue-500/30 dark:bg-blue-900/30 dark:text-blue-100'
      : variant === 'summary'
        ? 'border-slate-200/70 bg-slate-50/70 text-slate-800 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-100'
        : variant === 'interface'
          ? 'border-slate-300/60 bg-slate-100/60 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/40 dark:text-slate-200'
          : 'border-emerald-200/60 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-100'

  return (
    <div className={`flex flex-col rounded-md border px-2 py-1 min-w-0 w-full sm:w-auto sm:min-w-[120px] ${baseClasses} ${className || ''}`}>
      <div className="flex items-center gap-1">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${getDeviceStatusDot(status)}`} aria-hidden="true"></span>
        <span className="font-medium truncate text-xs">{label}</span>
      </div>
      {subtitle && (
        (() => {
          const isPossibleIp = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(subtitle) || subtitle.includes(':')
          if (isPossibleIp) {
            const href = subtitle.startsWith('http') ? subtitle : `http://${subtitle}`
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-600 hover:text-blue-800 underline truncate"
              >
                {subtitle}
              </a>
            )
          }
          return <span className="text-[10px] text-muted-foreground truncate">{subtitle}</span>
        })()
      )}
    </div>
  )
}

interface LinkConnectorSegmentProps {
  status: NetworkLinkStatus['status'] | 'unknown'
  latency?: number
  fromInterface?: string | null
  fromInterfaceType?: string | null
  toInterface?: string | null
  toInterfaceType?: string | null
  showLatencyBadge?: boolean
}

function LinkConnectorSegment({ status, latency, fromInterface, fromInterfaceType, toInterface, toInterfaceType, showLatencyBadge = true }: LinkConnectorSegmentProps) {
  const color = resolveLinkColor(status)
  const isNumericLatency = typeof latency === 'number' && !Number.isNaN(latency)
  const latencyTheme = isNumericLatency ? resolveLatencyBadgeStyle(latency) : null
  const latencyLabel = formatLatency(latency)
  const badgeTheme = latencyTheme ?? { fill: '#6b7280', text: '#ffffff' }

  const renderInterface = (label?: string | null, type?: string | null) => {
    const marker = label || type ? resolveInterfaceMarker(type || label) : null
    const text = label ?? marker?.label
    if (!text) return null

    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
        {marker && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white"
            style={{ backgroundColor: marker.fill }}
          >
            {marker.label}
          </span>
        )}
        <span>({text})</span>
      </span>
    )
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
      {renderInterface(fromInterface, fromInterfaceType)}
      <div className="relative flex items-center justify-center py-3 sm:py-0">
        <div className="w-[2px] h-8 sm:h-[2px] sm:w-10 rounded-full" style={{ backgroundColor: color }} />
        {showLatencyBadge && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold shadow-sm whitespace-nowrap sm:left-1/2 sm:-top-5 sm:translate-y-0 sm:-translate-x-1/2"
            style={{ backgroundColor: badgeTheme.fill, color: badgeTheme.text }}
          >
            {latencyLabel}
          </span>
        )}
      </div>
      {renderInterface(toInterface, toInterfaceType)}
    </div>
  )
}

function getDeviceStatusDot(status: DeviceStatus['status'] | NetworkLinkStatus['status'] | 'unknown') {
  switch (status) {
    case 'up':
      return 'bg-emerald-500'
    case 'degraded':
      return 'bg-amber-500'
    case 'down':
      return 'bg-red-500'
    default:
      return 'bg-slate-400'
  }
}

function resolveInterfaceMarker(type?: string | null) {
  const normalized = (type || '').toLowerCase()
  if (normalized.includes('wireless') || normalized.includes('wifi') || normalized.includes('radio')) {
    return { fill: '#f97316', label: 'W' }
  }
  if (normalized.includes('lan') || normalized.includes('ether') || normalized.includes('eth')) {
    return { fill: '#2563eb', label: 'E' }
  }
  if (normalized.includes('fiber')) {
    return { fill: '#8b5cf6', label: 'F' }
  }
  if (normalized.includes('backhaul')) {
    return { fill: '#0ea5e9', label: 'B' }
  }
  if (normalized.includes('wan')) {
    return { fill: '#14b8a6', label: 'N' }
  }
  return { fill: '#6b7280', label: 'L' }
}

function resolveLatencyBadgeStyle(latency: number) {
  if (latency <= 20) {
    return { fill: '#16a34a', text: '#ffffff' }
  }
  if (latency <= 80) {
    return { fill: '#d97706', text: '#ffffff' }
  }
  return { fill: '#dc2626', text: '#ffffff' }
}

function resolveLinkColor(status: NetworkLinkStatus['status'] | 'unknown') {
  switch (status) {
    case 'up':
      return '#16a34a'
    case 'degraded':
      return '#d97706'
    case 'down':
      return '#dc2626'
    default:
      return '#6b7280'
  }
}

const FALLBACK_LAST_CHECKED = '1970-01-01T00:00:00.000Z'

function deriveAreaStatusFromDevices(devices: DeviceStatus[]): AreaStatus['status'] {
  if (devices.length === 0) {
    return 'down'
  }
  
  const upDevices = devices.filter(device => device.status === 'up').length
  const downDevices = devices.filter(device => device.status === 'down').length
  
  if (downDevices === devices.length) {
    return 'down'
  }
  if (upDevices === devices.length) {
    return 'up'
  }
  // Mixed status (some up, some down) = degraded
  return 'degraded'
}

export default function StatusPage() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<Pick<Config, 'areas' | 'links' | 'devices' | 'settings'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down' | 'degraded'>('all')
  const [areaTypeFilter, setAreaTypeFilter] = useState<string>('all')

  useEffect(() => {
    loadData()
    
    // Fixed interval - no need to recreate on every retry
    const interval = setInterval(loadData, 15000) // 15 seconds to reduce load
    return () => clearInterval(interval)
  }, []) // Empty dependency array - only run once on mount

  const loadData = async () => {
    const startTime = Date.now();
    try {
      const [statusData, configData] = await Promise.all([
        networkApi.getStatus(),
        networkApi.getPublicConfig()
      ])
      const duration = Date.now() - startTime;
      console.log(`✅ Status loaded in ${duration}ms`);
      
      // Show success toast for slow loads
      if (duration > 2000) {
        emitTelemetry('warning', `Slow data load: ${duration}ms`);
      } else if (duration > 1000) {
        emitTelemetry('info', `Status updated in ${duration}ms`);
      }
      
      setStatus(statusData)
      setConfig(configData)
      setLoading(false)
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Failed to load status data after ${duration}ms:`, message);
      emitTelemetry('error', `Failed to load status: ${message}`);
      setLoading(false);
    }
  }

  const topologySettings = config?.settings?.topology
  const includeUnlinkedDevices = topologySettings?.autoIncludeUnlinkedDevices ?? true

  const areaStatusMap = useMemo(() => {
    if (!status) return new Map<string, AreaStatus>()
    return new Map(status.areas.map(areaItem => [areaItem.areaId, areaItem]))
  }, [status])

  const devicesByArea = useMemo(() => {
    if (!config) return new Map<string, Config['devices'][number][]>()
    return config.devices.reduce((acc, device) => {
      const list = acc.get(device.areaId) ?? []
      list.push(device)
      acc.set(device.areaId, list)
      return acc
    }, new Map<string, Config['devices'][number][]>())
  }, [config])

  const allAreas = useMemo(() => {
    if (!config) return []

    const baseAreas = config.areas.map(areaInfo => {
      const statusArea = areaStatusMap.get(areaInfo.id)
      const baseDevices = statusArea?.devices ?? []
      const configuredDevices = devicesByArea.get(areaInfo.id) ?? []

      let mergedDevices: DeviceStatus[] = baseDevices

      if (includeUnlinkedDevices) {
        const knownDevices = new Set(baseDevices.map(device => device.deviceId))
        const placeholders = configuredDevices
          .filter(device => !knownDevices.has(device.id))
          .map(device => ({
            deviceId: device.id,
            status: 'unknown' as const,
            lastChecked: FALLBACK_LAST_CHECKED
          }))
        mergedDevices = [...baseDevices, ...placeholders]
      } else if (!statusArea && configuredDevices.length > 0) {
        mergedDevices = configuredDevices.map(device => ({
          deviceId: device.id,
          status: 'unknown' as const,
          lastChecked: FALLBACK_LAST_CHECKED
        }))
      }

      return {
        areaId: areaInfo.id,
        status: statusArea?.status ?? deriveAreaStatusFromDevices(mergedDevices),
        devices: mergedDevices,
        areaInfo
      }
    })

    if (!status) {
      return baseAreas
    }

    const additionalAreas = status.areas
      .filter(areaItem => !config.areas.some(areaInfo => areaInfo.id === areaItem.areaId))
      .map(areaItem => ({
        ...areaItem,
        areaInfo: undefined
      }))

    return [...baseAreas, ...additionalAreas]
  }, [config, status, areaStatusMap, devicesByArea, includeUnlinkedDevices])

  const groupedAreas = useMemo(() => {
    return allAreas.reduce((acc, areaItem) => {
      const type = areaItem.areaInfo?.type || 'Other'
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(areaItem)
      return acc
    }, {} as Record<string, Array<AreaWithInfo>>)
  }, [allAreas])

  // Calculate area type statistics
  const areaTypeStats = useMemo(() => {
    const stats: Record<string, { totalAreas: number; totalDevices: number; upDevices: number; downDevices: number; pendingDevices: number }> = {}
    
    Object.entries(groupedAreas).forEach(([type, areas]) => {
      const totalDevices = areas.reduce((sum, area) => sum + area.devices.length, 0)
      const upDevices = areas.reduce((sum, area) => 
        sum + area.devices.filter(d => d.status === 'up').length, 0
      )
      const downDevices = areas.reduce((sum, area) =>
        sum + area.devices.filter(d => d.status === 'down').length, 0
      )
      const pendingDevices = areas.reduce((sum, area) =>
        sum + area.devices.filter(d => d.status === 'unknown').length, 0
      )
      
      stats[type] = {
        totalAreas: areas.length,
        totalDevices,
        upDevices,
        downDevices,
        pendingDevices
      }
    })
    
    return stats
  }, [groupedAreas])

  // Get unique area types for filter, sorted in specific order
  const areaTypes = useMemo(() => {
    const allTypes = Object.keys(groupedAreas)
    const sortedOrder = ['Server/Relay', 'Schools', 'PisoWiFi Vendo', 'Homes']
    
    // Sort by predefined order, then add any remaining types
    const sortedTypes: string[] = []
    sortedOrder.forEach(type => {
      if (allTypes.includes(type)) {
        sortedTypes.push(type)
      }
    })
    
    // Add any remaining types not in the predefined order
    allTypes.forEach(type => {
      if (!sortedOrder.includes(type)) {
        sortedTypes.push(type)
      }
    })
    
    return sortedTypes
  }, [groupedAreas])

  // Filter and search logic
  const filteredGroupedAreas = useMemo(() => {
    if (!config) return {}
    let filtered = { ...groupedAreas }
    
    // Filter by area type
    if (areaTypeFilter !== 'all') {
      filtered = { [areaTypeFilter]: groupedAreas[areaTypeFilter] || [] }
    }
    
    // Filter by status and search
    Object.keys(filtered).forEach(type => {
      filtered[type] = filtered[type].filter(area => {
        // Status filter
        if (statusFilter !== 'all') {
          const hasMatchingDevice = area.devices.some(d => d.status === statusFilter)
          if (!hasMatchingDevice) return false
        }
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const areaNameMatch = area.areaInfo.name.toLowerCase().includes(query)
          const deviceMatch = area.devices.some(device => {
            const deviceInfo = config.devices.find(d => d.id === device.deviceId)
            return deviceInfo?.name.toLowerCase().includes(query) || 
                   deviceInfo?.ip.toLowerCase().includes(query)
          })
          return areaNameMatch || deviceMatch
        }
        
        return true
      })
      
      // Filter devices within areas based on status
      if (statusFilter !== 'all') {
        filtered[type] = filtered[type].map(area => ({
          ...area,
          devices: area.devices.filter(d => d.status === statusFilter)
        }))
      }
      
      // Remove empty area types
      if (filtered[type].length === 0) {
        delete filtered[type]
      }
    })
    
    return filtered
  }, [groupedAreas, statusFilter, areaTypeFilter, searchQuery, config])

  const linkStatusMap = useMemo(() => {
    if (!status) return new Map<string, NetworkLinkStatus>()
    return new Map(status.links.map(link => [link.linkId, link]))
  }, [status])

  if (loading) {
    return (
      <div className="h-full overflow-auto p-4 lg:p-6" role="status" aria-live="polite">
        <div className="mb-4 lg:mb-6">
          <div className="h-6 lg:h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 lg:p-4 border rounded-md bg-background">
              <div className="h-4 w-28 bg-muted rounded mb-3 animate-pulse" />
              <div className="h-3 w-full bg-muted rounded mb-2 animate-pulse" />
              <div className="h-3 w-5/6 bg-muted rounded mb-2 animate-pulse" />
              <div className="h-2 w-full bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!status || !config) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up': return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'down': return <XCircle className="w-5 h-5 text-red-500" />
      default: return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'up': return 'online'
      case 'degraded': return 'degraded'
      case 'down': return 'offline'
      default: return 'unknown'
    }
  }

  const getAreaTypeIcon = (type: string) => {
    switch (type) {
      case 'Homes': return <Home className="w-4 h-4 text-blue-600" />
      case 'PisoWiFi Vendo': return <ShoppingBag className="w-4 h-4 text-purple-600" />
      case 'Schools': return <GraduationCap className="w-4 h-4 text-green-600" />
      default: return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'wireless-antenna': return <Satellite className="w-4 h-4 text-orange-600" />
      case 'wifi-soho': return <Wifi className="w-4 h-4 text-blue-600" />
      case 'router': return <Router className="w-4 h-4 text-green-600" />
      case 'wifi-outdoor': return <Radio className="w-4 h-4 text-purple-600" />
      default: return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  // Count device types in an area
  const getDeviceTypeBreakdown = (devices: DeviceStatus[]) => {
    const breakdown: Record<string, number> = {}
    devices.forEach(device => {
      const deviceInfo = config.devices.find(d => d.id === device.deviceId)
      const type = deviceInfo?.type || 'router'
      breakdown[type] = (breakdown[type] || 0) + 1
    })
    return breakdown
  }

  const getDeviceTypeName = (type: string) => {
    switch (type) {
      case 'wireless-antenna': return 'Antenna'
      case 'wifi-soho': return 'WiFi SOHO'
      case 'router': return 'Router'
      case 'wifi-outdoor': return 'WiFi Outdoor'
      default: return type
    }
  }

  // Calculate health score (0-100) as a proper weighted average
  const calculateHealthScore = (statusData: NetworkStatus, configData: Pick<Config, 'areas' | 'links' | 'devices'>): number => {
    const allDevices = statusData.areas.flatMap(area => area.devices)
    if (allDevices.length === 0) return 0

    let weightedSum = 0
    let totalWeight = 0

    for (const device of allDevices) {
      const deviceInfo = configData.devices.find(d => d.id === device.deviceId)
      const criticality = deviceInfo?.criticality || 'normal'
      const weight = criticality === 'critical' ? 1.5 :
                     criticality === 'high' ? 1.2 :
                     criticality === 'low' ? 0.8 : 1

      const base =
        device.status === 'up'
          ? 1
          : device.status === 'degraded'
            ? 0.5
            : device.status === 'unknown'
              ? 0.35
              : 0

      weightedSum += base * weight
      totalWeight += weight
    }

    if (totalWeight === 0) return 0
    const percent = Math.round((weightedSum / totalWeight) * 100)
    return Math.max(0, Math.min(100, percent))
  }

  const healthScore = calculateHealthScore(status, config);

  return (
    <div className="h-full overflow-auto p-4 lg:p-6">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2">Network Status</h1>
        <p className="text-sm lg:text-base text-muted-foreground">Real-time monitoring overview</p>
      </div>

      {/* Network Health Score */}
      <SectionErrorBoundary fallback={<Card className="mb-4 lg:mb-6"><CardContent className="text-red-600 p-3">Failed to render network health summary. Try reloading or contact support.</CardContent></Card>}>
      <Card className="mb-4 lg:mb-6" role="region" aria-labelledby="network-health-heading">
        <CardContent className="p-3 lg:p-4">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className={`w-5 h-5 ${healthScore >= 90 ? 'text-green-500' : healthScore >= 70 ? 'text-yellow-500' : 'text-red-500'}`} aria-hidden="true" />
                <h2 id="network-health-heading" className="text-sm lg:text-base font-semibold">Network Health</h2>
                <span aria-live="polite" className="relative group">
                  <Badge variant={healthScore >= 90 ? 'default' : healthScore >= 70 ? 'secondary' : 'destructive'} tabIndex={0} aria-label={`Network health ${healthScore} percent`}>
                    {healthScore}%
                  </Badge>
                  <span className="absolute left-1/2 -translate-x-1/2 -top-10 mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition bg-black text-white text-xs rounded px-3 py-1 pointer-events-none z-10 whitespace-nowrap shadow-lg">
                    The health score weights uptime, device status, and criticality. 100% means all devices are online.
                  </span>
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden" aria-hidden="true">
                <div 
                  className={`h-full rounded-full transition-all ${healthScore >= 90 ? 'bg-green-500' : healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </SectionErrorBoundary>

      {/* Status Legend */}
      <div className="mb-4 lg:mb-6 flex flex-wrap gap-3 lg:gap-4 p-3 lg:p-4 bg-muted rounded-lg" role="region" aria-label="Status legend">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span className="text-xs lg:text-sm font-medium">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
          <span className="text-xs lg:text-sm font-medium">Degraded</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span className="text-xs lg:text-sm font-medium">Offline</span>
        </div>
      </div>


      {/* Area Type Summary Cards */}
      <div className="mb-4 lg:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 lg:gap-4">
          {areaTypes.map(type => {
            const stats = areaTypeStats[type]
            if (!stats) return null
            const healthPercent = stats.totalDevices > 0 ? Math.round((stats.upDevices / stats.totalDevices) * 100) : 0
            return (
              <Card key={type} className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="p-2 lg:p-4 pb-1.5 lg:pb-2">
                  <div className="flex flex-col gap-1.5 lg:gap-0 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-1.5">
                      {getAreaTypeIcon(type)}
                      <CardTitle className="text-xs lg:text-base truncate">{type}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 w-fit">
                      {stats.totalAreas} {stats.totalAreas === 1 ? 'area' : 'areas'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-2 lg:p-4 pt-0">
                  <div className="space-y-1 lg:space-y-1.5">
                    {/* Mobile: Horizontal layout for stats */}
                    <div className="flex justify-between items-center lg:flex-col lg:items-start lg:justify-start">
                      <div className="flex items-center gap-1.5 lg:gap-0 lg:justify-between lg:w-full">
                        <span className="text-xs text-muted-foreground">Devices</span>
                        <span className="text-xs font-semibold">{stats.totalDevices}</span>
                      </div>
                      <div className="flex items-center gap-1.5 lg:gap-0 lg:justify-between lg:w-full lg:mt-0.5">
                        <span className="text-xs text-muted-foreground">Online</span>
                        <span className="text-xs font-semibold text-green-600">{stats.upDevices}</span>
                      </div>
                    </div>
                    
                    {/* Mobile: Compact health display */}
                    <div className="pt-1 lg:pt-1.5 border-t">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium">Health</span>
                        <span className={`text-xs lg:text-sm font-bold ${
                          healthPercent === 100 ? 'text-green-600' : 
                          healthPercent >= 80 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {healthPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1 lg:h-1.5">
                        <div 
                          className={`h-1 lg:h-1.5 rounded-full transition-all ${
                            healthPercent === 100 ? 'bg-green-600' : 
                            healthPercent >= 80 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${healthPercent}%` }}
                        ></div>
                      </div>
                      {/* Show offline count on mobile */}
                      <div className="flex justify-between items-center mt-0.5 lg:hidden">
                        <span className="text-xs text-muted-foreground">Offline</span>
                        <span className="text-xs font-semibold text-red-600">{stats.downDevices}</span>
                      </div>
                      {stats.pendingDevices > 0 && (
                        <div className="flex justify-between items-center mt-0.5 lg:hidden">
                          <span className="text-xs text-muted-foreground">Pending</span>
                          <span className="text-xs font-semibold text-amber-600">{stats.pendingDevices}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <SectionErrorBoundary fallback={<div className="mb-4 lg:mb-6 bg-red-100 p-4 rounded text-red-600 text-sm">Filters temporarily unavailable. Reload page or try different browser tab.</div>}>
      <div className="mb-4 lg:mb-6 space-y-3 relative" role="region" aria-labelledby="filters-heading">
        {(searchQuery || statusFilter !== 'all' || areaTypeFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setAreaTypeFilter('all');
            }}
            className="absolute right-0 top-0 mt-1 mr-2 z-10 bg-muted hover:bg-primary px-2 py-1 rounded text-xs text-foreground border border-muted-foreground transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Clear all filters"
          >
            Clear filters
          </button>
        )}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Search devices or areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchQuery('')
              }}
              className="pl-10 h-9 lg:h-10"
              aria-label="Search devices or areas"
            />
          </div>
          
          {/* Status Filter - Optimized for mobile */}
          <div className="flex gap-1 lg:gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all whitespace-nowrap ${
                statusFilter === 'all' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              aria-pressed={statusFilter === 'all'}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('up')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                statusFilter === 'up' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-muted hover:bg-muted/80'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              aria-pressed={statusFilter === 'up'}
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Online</span>
              <span className="sm:hidden">Up</span>
            </button>
            <button
              onClick={() => setStatusFilter('down')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                statusFilter === 'down' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-muted hover:bg-muted/80'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              aria-pressed={statusFilter === 'down'}
            >
              <XCircle className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Offline</span>
              <span className="sm:hidden">Down</span>
            </button>
            <button
              onClick={() => setStatusFilter('degraded')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                statusFilter === 'degraded' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-muted hover:bg-muted/80'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              aria-pressed={statusFilter === 'degraded'}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Degraded</span>
              <span className="sm:hidden">Deg</span>
            </button>
          </div>
        </div>

        {/* Area Type Filter - Optimized for mobile */}
        <div className="flex flex-wrap gap-1.5 lg:gap-2" role="group" aria-label="Area type filter buttons">
          <button
            onClick={() => setAreaTypeFilter('all')}
            className={`px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm rounded-md transition-all ${
              areaTypeFilter === 'all' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
            aria-pressed={areaTypeFilter === 'all'}
          >
            <span className="hidden sm:inline">All Types</span>
            <span className="sm:hidden">All</span>
          </button>
          {areaTypes.map(type => (
            <button
              key={type}
              onClick={() => setAreaTypeFilter(type)}
              className={`px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 lg:gap-1.5 ${
                areaTypeFilter === type 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              aria-pressed={areaTypeFilter === type}
              aria-label={`Filter by ${type}`}
            >
              {getAreaTypeIcon(type)}
              <span className="hidden sm:inline">{type}</span>
              <span className="sm:hidden">
                {type === 'Server/Relay' ? 'Server' :
                 type === 'PisoWiFi Vendo' ? 'PisoWiFi' :
                 type === 'Schools' ? 'Schools' :
                 type === 'Homes' ? 'Homes' : type}
              </span>
            </button>
          ))}
        </div>
      </div>
      </SectionErrorBoundary>

      {/* Areas Status - Grouped by Type */}
      <div className="space-y-4 lg:space-y-6" role="region" aria-labelledby="areas-heading">
        <div className="flex items-center justify-between">
          <h2 id="areas-heading" className="text-lg lg:text-xl font-semibold">
            {areaTypeFilter === 'all' ? 'All Areas' : `${areaTypeFilter} Areas`}
          </h2>
          {(searchQuery || statusFilter !== 'all' || areaTypeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setAreaTypeFilter('all')
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
        
        <SectionErrorBoundary fallback={<Card className="p-6"><CardContent className="p-0"><div className="text-center text-muted-foreground">Failed to render areas. Please adjust filters or reload.</div></CardContent></Card>}>
        {Object.keys(filteredGroupedAreas).length === 0 ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No devices found matching your filters</p>
            </div>
          </Card>
        ) : (
          areaTypes.filter(type => filteredGroupedAreas[type] && filteredGroupedAreas[type].length > 0).map(type => {
            const areas = filteredGroupedAreas[type]
            return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                {getAreaTypeIcon(type)}
                <h3 className="text-base lg:text-lg font-semibold">{type}</h3>
                <span className="text-sm text-muted-foreground">({areas.length} {areas.length === 1 ? 'area' : 'areas'})</span>
              </div>
              
              <div className="space-y-3">
                {areas.map(area => {
                  const deviceTypeBreakdown = getDeviceTypeBreakdown(area.devices)
                  const upCount = area.devices.filter(d => d.status === 'up').length
                  const downCount = area.devices.filter(d => d.status === 'down').length
                  const unknownCount = area.devices.filter(d => d.status === 'unknown').length
                  
                  return (
                    <Card key={area.areaId} className="border-2 hover:shadow-md transition-all">
                      <CardHeader className="p-3 lg:p-4 pb-2">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5">
                            <div>
                              <CardTitle className="text-sm lg:text-base">{area.areaInfo?.name || area.areaId}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">
                                {area.devices.length} {area.devices.length === 1 ? 'device' : 'devices'}
                                {upCount > 0 && <span className="text-green-600 ml-1">{upCount} online</span>}
                                {downCount > 0 && <span className="text-red-600 ml-1">{downCount} offline</span>}
                                {unknownCount > 0 && <span className="text-amber-600 ml-1">{unknownCount} pending</span>}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getStatusIcon(area.status)}
                              <Badge 
                                className={
                                  area.status === 'up' ? 'bg-green-600 hover:bg-green-700' :
                                  area.status === 'degraded' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                  'bg-red-600 hover:bg-red-700'
                                }
                              >
                                {getStatusLabel(area.status)}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Device Type Breakdown */}
                          {Object.keys(deviceTypeBreakdown).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(deviceTypeBreakdown).map(([type, count]) => (
                                <Badge key={type} variant="outline" className="text-xs px-1.5 py-0.5">
                                  {getDeviceTypeIcon(type)}
                                  <span className="ml-1">{count} {getDeviceTypeName(type)}</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 lg:p-4 pt-0">
                        <AreaTopology
                          area={area}
                          config={config}
                          linkStatusMap={linkStatusMap}
                          topologySettings={topologySettings}
                        />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
            )
          })
        )}
        </SectionErrorBoundary>
      </div>

    </div>
  )
}

type AreaWithInfo = AreaStatus & { areaInfo?: Config['areas'][number] }

interface AreaTopologyProps {
  area: AreaWithInfo
  config: Pick<Config, 'areas' | 'links' | 'devices'>
  linkStatusMap: Map<string, NetworkLinkStatus>
  topologySettings?: TopologySettings
}

interface PathNode {
  key: string
  label: string
  subtitle?: string
  variant: DeviceChipProps['variant']
  status: NetworkLinkStatus['status'] | DeviceStatus['status'] | 'unknown'
}

interface PathEdge {
  id: string
  fromKey: string
  toKey: string
  status: NetworkLinkStatus['status']
  latency?: number
  fromInterface?: string | null
  fromInterfaceType?: string | null
  toInterface?: string | null
  toInterfaceType?: string | null
}

interface PathSequence {
  nodes: PathNode[]
  edges: PathEdge[]
}

function AreaTopology({ area, config, linkStatusMap, topologySettings }: AreaTopologyProps) {
  const areaInfo = area.areaInfo || config.areas.find(a => a.id === area.areaId)

  const showRemoteAreas = topologySettings?.showRemoteAreas ?? true
  const showLatencyBadge = topologySettings?.showLinkLatency ?? true
  const includeUnlinkedAreaDevices = topologySettings?.autoIncludeUnlinkedDevices ?? true
  const preferCompactLayout = topologySettings?.preferCompactLayout ?? false

  const configLinkMapMemo = useMemo(() => new Map(config.links.map(link => [link.id, link])), [config.links])

  const statusPriority: Record<NetworkLinkStatus['status'], number> = {
    down: 3,
    degraded: 2,
    up: 1,
    unknown: 0
  }

  const deviceInfoMap = new Map(config.devices.map(device => [device.id, device]))
  const deviceStatusMap = new Map(area.devices.map(device => [device.deviceId, device]))
  const areaMap = new Map(config.areas.map(areaItem => [areaItem.id, areaItem]))

  const getAreaName = (areaId: string | null, fallback: string | null) => {
    if (areaId) {
      const ref = areaMap.get(areaId)
      if (ref?.name) return ref.name
    }
    return fallback ?? 'Unassigned area'
  }

  const nodeMap = new Map<string, PathNode>()
  const edges: PathEdge[] = []

  const ensureNode = (endpoint: NetworkLinkStatus['endpoints'][number] | undefined, fallbackLabel: string): PathNode => {
    const areaId = endpoint?.areaId ?? null
    const deviceId = endpoint?.deviceId ?? null
    const areaName = getAreaName(areaId, null)
    const isLocalArea = areaId === area.areaId

    let label = fallbackLabel
    let subtitle: string | undefined
    const variant: DeviceChipProps['variant'] = isLocalArea ? 'local' : 'remote'
    let status: NetworkLinkStatus['status'] | DeviceStatus['status'] | 'unknown' = endpoint?.status ?? 'unknown'

    if (deviceId) {
      const deviceInfo = deviceInfoMap.get(deviceId)
      label = deviceInfo?.name || endpoint?.deviceName || deviceId
      if (isLocalArea) {
        subtitle = deviceInfo?.ip ?? undefined
        status = deviceStatusMap.get(deviceId)?.status ?? status
      } else if (areaName && areaName !== areaInfo?.name) {
        label = `[${areaName}] ${label}`
        subtitle = areaName
      }
    } else if (areaName) {
      label = isLocalArea ? areaName : `[${areaName}]`
      if (!isLocalArea) subtitle = areaName
    }

    const key = deviceId ? `device:${deviceId}` : `area:${areaId ?? label}`
    const existing = nodeMap.get(key)
    if (existing) {
      if (statusPriority[status as NetworkLinkStatus['status']] > statusPriority[existing.status as NetworkLinkStatus['status'] ?? 'unknown']) {
        nodeMap.set(key, { ...existing, status })
        return nodeMap.get(key)!
      }
      return existing
    }

    const node: PathNode = { key, label, subtitle, variant, status }
    nodeMap.set(key, node)
    return node
  }

  linkStatusMap.forEach(linkStatus => {
    const endpoints = Array.isArray(linkStatus.endpoints) ? linkStatus.endpoints.slice(0, 2) : []
    if (endpoints.length < 2) return
    const [left, right] = endpoints
    if (!left || !right) return

    const involvesCurrentArea = [left, right].some(endpoint => (endpoint?.areaId ?? null) === area.areaId)
    if (!involvesCurrentArea) return

    const configLink = configLinkMapMemo.get(linkStatus.linkId)
    const defaultType = (configLink?.type as string | undefined) || (configLink?.metadata?.type as string | undefined) || (linkStatus.type as string | undefined) || null

    const fromNode = ensureNode(left, 'Endpoint A')
    const toNode = ensureNode(right, 'Endpoint B')

    edges.push({
      id: `${linkStatus.linkId}-${edges.length}`,
      fromKey: fromNode.key,
      toKey: toNode.key,
      status: linkStatus.status ?? 'unknown',
      latency: linkStatus.latency,
      fromInterface: left?.interface ?? null,
      fromInterfaceType: (left?.interfaceType as string | undefined) || defaultType,
      toInterface: right?.interface ?? null,
      toInterfaceType: (right?.interfaceType as string | undefined) || defaultType
    })
  })

  const adjacency = new Map<string, PathEdge[]>()
  const indegree = new Map<string, number>()

  edges.forEach(edge => {
    if (!adjacency.has(edge.fromKey)) adjacency.set(edge.fromKey, [])
    adjacency.get(edge.fromKey)!.push(edge)

    indegree.set(edge.toKey, (indegree.get(edge.toKey) || 0) + 1)
    if (!indegree.has(edge.fromKey)) indegree.set(edge.fromKey, indegree.get(edge.fromKey) || 0)
  })

  const sequences: PathSequence[] = []
  const globalVisited = new Set<string>()

  const addSequence = (sequence: PathSequence) => {
    if (!sequence || sequence.edges.length === 0) return
    sequences.push(sequence)
    sequence.edges.forEach(edge => globalVisited.add(edge.id))
  }

  const traverse = (currentKey: string, nodesSeq: PathNode[], edgesSeq: PathEdge[], visited: Set<string>) => {
    const outgoing = (adjacency.get(currentKey) || []).filter(edge => !visited.has(edge.id))
    if (outgoing.length === 0) {
      addSequence({ nodes: nodesSeq, edges: edgesSeq })
      return
    }

    outgoing.forEach(edge => {
      const nextNode = nodeMap.get(edge.toKey)
      if (!nextNode) {
        addSequence({ nodes: nodesSeq, edges: [...edgesSeq, edge] })
        return
      }

      const nextVisited = new Set(visited)
      nextVisited.add(edge.id)
      traverse(edge.toKey, [...nodesSeq, nextNode], [...edgesSeq, edge], nextVisited)
    })
  }

  const startNodes = Array.from(nodeMap.values()).filter(node => (adjacency.get(node.key)?.length || 0) > 0 && (indegree.get(node.key) ?? 0) === 0)

  if (startNodes.length > 0) {
    startNodes.forEach(startNode => {
      traverse(startNode.key, [startNode], [], new Set())
    })
  }

  edges.forEach(edge => {
    if (globalVisited.has(edge.id)) return
    const fromNode = nodeMap.get(edge.fromKey)
    const toNode = nodeMap.get(edge.toKey)
    if (!fromNode || !toNode) return
    addSequence({ nodes: [fromNode, toNode], edges: [edge] })
  })

  sequences.sort((a, b) => a.nodes[0].label.localeCompare(b.nodes[0].label))

  const renderNodeChip = (node: PathNode, key: string, extraClassName = '') => {
    if (!showRemoteAreas && node.variant === 'remote') {
      return (
        <div key={key} className={extraClassName}>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide"
            title={node.label}
          >
            Remote Hidden
          </Badge>
        </div>
      )
    }

    return (
      <DeviceChip
        key={key}
        label={node.label}
        subtitle={node.subtitle}
        status={node.status}
        variant={node.variant}
        className={extraClassName}
      />
    )
  }

  const desktopConnectionRowClass = `hidden sm:flex sm:flex-wrap sm:items-center rounded-md border border-border/40 bg-muted/30 w-full ${preferCompactLayout ? 'gap-2 px-2.5 py-2 text-[13px]' : 'gap-3 px-3 py-3'}`

  const formatInterfaceLabel = (iface?: string | null, type?: string | null) => {
    if (typeof iface === 'string' && iface.trim().length > 0) return iface
    if (typeof type === 'string' && type.trim().length > 0) return type
    return 'link'
  }

  const renderMobileEdge = (edge: PathEdge, keySuffix: string) => {
    const latencyText = formatLatency(edge.latency)
    const showLatencyInfo = showLatencyBadge && latencyText !== '—'

    return (
      <div key={`mobile-edge-${keySuffix}`} className="flex-1 rounded-md border border-border/40 bg-background/90 px-3 py-2 text-xs shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
          <span>Connection</span>
          <span className="inline-flex items-center gap-1 capitalize text-foreground/80">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: resolveLinkColor(edge.status) }}
            />
            {getLinkStatusLabel(edge.status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-foreground">
          <span>{formatInterfaceLabel(edge.fromInterface, edge.fromInterfaceType)}</span>
          <span className="text-muted-foreground">→</span>
          <span>{formatInterfaceLabel(edge.toInterface, edge.toInterfaceType)}</span>
        </div>
        {showLatencyInfo && (
          <div className="inline-flex items-center gap-1 text-[10px] font-medium">
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              {latencyText}
            </span>
          </div>
        )}
      </div>
    )
  }

  const renderSequenceMobile = (sequence: PathSequence, sequenceIndex: number) => (
    <div key={`sequence-${sequenceIndex}-mobile`} className="sm:hidden rounded-md border border-border/40 bg-muted/20 p-3 space-y-4">
      {sequence.nodes.map((node, nodeIndex) => {
        const edge = sequence.edges[nodeIndex]
        const hasNext = Boolean(edge)

        return (
          <React.Fragment key={`sequence-${sequenceIndex}-mobile-node-${nodeIndex}`}>
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-full border border-border ${getDeviceStatusDot((node.status as DeviceStatus['status']) || 'unknown')}`} />
                {hasNext && <span className="flex-1 w-[2px] bg-border/60" />}
              </div>
              <DeviceChip
                label={node.label}
                subtitle={node.subtitle}
                status={node.status}
                variant={node.variant}
                className="w-full"
              />
            </div>
            {hasNext && (
              <div className="flex gap-3 pl-2">
                <div className="flex flex-col items-center">
                  <span className="flex-1 w-[2px] bg-border/60" />
                </div>
                {renderMobileEdge(edge, `${sequenceIndex}-${nodeIndex}`)}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )

  const renderSequenceDesktop = (sequence: PathSequence, index: number) => (
    <div key={`sequence-${index}-desktop`} className={desktopConnectionRowClass}>
      {renderNodeChip(sequence.nodes[0], `sequence-${index}-node-0-desktop`, 'w-full sm:w-auto sm:min-w-[160px]')}
      {sequence.edges.map((edge, edgeIndex) => {
        const targetNode = sequence.nodes[edgeIndex + 1]
        return (
          <React.Fragment key={`${edge.id}-desktop-${edgeIndex}`}>
            <LinkConnectorSegment
              status={edge.status}
              latency={edge.latency}
              fromInterface={edge.fromInterface}
              fromInterfaceType={edge.fromInterfaceType}
              toInterface={edge.toInterface}
              toInterfaceType={edge.toInterfaceType}
              showLatencyBadge={showLatencyBadge}
            />
            {renderNodeChip(targetNode, `sequence-${index}-node-${edgeIndex + 1}-desktop`, 'w-full sm:w-auto sm:min-w-[160px]')}
          </React.Fragment>
        )
      })}
    </div>
  )

  const connectedLocalDeviceIds = new Set<string>()
  sequences.forEach(sequence => {
    sequence.nodes.forEach(node => {
      if (node.variant === 'local' && node.key.startsWith('device:')) {
        connectedLocalDeviceIds.add(node.key.replace('device:', ''))
      }
    })
  })

  const unlinkedDevices = includeUnlinkedAreaDevices
    ? area.devices.filter(device => !connectedLocalDeviceIds.has(device.deviceId))
    : []

  const getLinkStatusLabel = (status: NetworkLinkStatus['status']) => {
    switch (status) {
      case 'up':
        return 'online'
      case 'degraded':
        return 'degraded'
      case 'down':
        return 'offline'
      default:
        return 'unknown'
    }
  }

  const getStatusToneClass = (status: NetworkLinkStatus['status']) => {
    if (status === 'down') return 'bg-red-600 hover:bg-red-700 text-white'
    if (status === 'degraded') return 'bg-yellow-600 hover:bg-yellow-700 text-white'
    if (status === 'up') return 'bg-green-600 hover:bg-green-700 text-white'
    return 'bg-secondary hover:bg-secondary/80'
  }

  const sequenceContent = sequences.length > 0 ? (
    <div className="space-y-3">
      {sequences.map((sequence, index) => (
        <div key={`sequence-${index}`} className="space-y-3">
          {renderSequenceMobile(sequence, index)}
          {renderSequenceDesktop(sequence, index)}
        </div>
      ))}
    </div>
  ) : (
    <div className="text-xs text-muted-foreground">No link topology data available for this area yet.</div>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background/70 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{areaInfo?.name || area.areaId}</div>
            <div className="text-[11px] text-muted-foreground">
              {area.devices.length} device{area.devices.length === 1 ? '' : 's'}
            </div>
          </div>
          <Badge className={`text-[10px] ${getStatusToneClass(area.status)}`}>
            {getLinkStatusLabel(area.status)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {area.devices.map(device => {
            const info = deviceInfoMap.get(device.deviceId)
            return (
              <DeviceChip
                key={device.deviceId}
                label={info?.name || device.deviceId}
                subtitle={info?.ip ?? undefined}
                status={device.status}
                variant="summary"
              />
            )
          })}
        </div>
      </div>

      {sequenceContent}

      {includeUnlinkedAreaDevices && unlinkedDevices.length > 0 && (
        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/70 p-3 dark:border-amber-700/70 dark:bg-amber-950/20 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Unlinked devices
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unlinkedDevices.map(device => {
              const info = deviceInfoMap.get(device.deviceId)
              return (
                <DeviceChip
                  key={`unlinked-${device.deviceId}`}
                  label={info?.name || device.deviceId}
                  subtitle={info?.ip ?? undefined}
                  status={device.status}
                  variant="summary"
                />
              )
            })}
          </div>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-100/70">
            Add these devices to a link to visualize their connectivity.
          </p>
        </div>
      )}
    </div>
  )
}
