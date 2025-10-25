'use client'

import { useEffect, useState, useMemo } from 'react'
import { networkApi, type NetworkStatus, type Config, type DeviceStatus } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle2, XCircle, Home, ShoppingBag, GraduationCap, Router, Radio, Satellite, Search, Filter } from 'lucide-react'

export default function StatusPage() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
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
    try {
      const [statusData, configData] = await Promise.all([
        networkApi.getStatus(),
        networkApi.getPublicConfig()
      ])
      setStatus(statusData)
      setConfig(configData)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load data:', err)
      setLoading(false)
    }
  }

  // Group areas by type - moved before early returns
  const groupedAreas = useMemo(() => {
    if (!status || !config) return {}
    return status.areas.reduce((acc, area) => {
      const areaInfo = config.areas.find(a => a.id === area.areaId)
      if (!areaInfo) return acc
      
      const type = areaInfo.type || 'Other'
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push({ ...area, areaInfo })
      return acc
    }, {} as Record<string, Array<{ areaId: string; status: 'up' | 'down' | 'degraded'; devices: DeviceStatus[]; areaInfo: { id: string; name: string; type: string; lat: number; lng: number } }>>)
  }, [status, config])

  // Calculate area type statistics
  const areaTypeStats = useMemo(() => {
    const stats: Record<string, { totalAreas: number; totalDevices: number; upDevices: number; downDevices: number }> = {}
    
    Object.entries(groupedAreas).forEach(([type, areas]) => {
      const totalDevices = areas.reduce((sum, area) => sum + area.devices.length, 0)
      const upDevices = areas.reduce((sum, area) => 
        sum + area.devices.filter(d => d.status === 'up').length, 0
      )
      
      stats[type] = {
        totalAreas: areas.length,
        totalDevices,
        upDevices,
        downDevices: totalDevices - upDevices
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!status || !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Calculate statistics
  const totalDevices = status.areas.reduce((sum, area) => sum + area.devices.length, 0)
  const upDevices = status.areas.reduce((sum, area) => 
    sum + area.devices.filter(d => d.status === 'up').length, 0
  )
  const downDevices = totalDevices - upDevices

  const totalLinks = status.links.length
  const upLinks = status.links.filter(l => l.status === 'up').length
  const degradedLinks = status.links.filter(l => l.status === 'degraded').length

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

  const formatIpAsUrl = (ip: string) => {
    // Check if IP already starts with http:// or https://
    if (ip.startsWith('http://') || ip.startsWith('https://')) {
      return ip
    }
    // Otherwise, prepend http://
    return `http://${ip}`
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

  return (
    <div className="h-full overflow-auto p-4 lg:p-6">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2">Network Status</h1>
        <p className="text-sm lg:text-base text-muted-foreground">Real-time monitoring overview</p>
      </div>

      {/* Status Legend */}
      <div className="mb-4 lg:mb-6 flex flex-wrap gap-3 lg:gap-4 p-3 lg:p-4 bg-muted rounded-lg">
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 lg:mb-6 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search devices or areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 lg:h-10"
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
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('up')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                statusFilter === 'up' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden sm:inline">Online</span>
              <span className="sm:hidden">Up</span>
            </button>
            <button
              onClick={() => setStatusFilter('down')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                statusFilter === 'down' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <XCircle className="h-3 w-3" />
              <span className="hidden sm:inline">Offline</span>
              <span className="sm:hidden">Down</span>
            </button>
            <button
              onClick={() => setStatusFilter('degraded')}
              className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                statusFilter === 'degraded' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">Degraded</span>
              <span className="sm:hidden">Deg</span>
            </button>
          </div>
        </div>

        {/* Area Type Filter - Optimized for mobile */}
        <div className="flex flex-wrap gap-1.5 lg:gap-2">
          <button
            onClick={() => setAreaTypeFilter('all')}
            className={`px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm rounded-md transition-all ${
              areaTypeFilter === 'all' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            }`}
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
              }`}
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

      {/* Areas Status - Grouped by Type */}
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg lg:text-xl font-semibold">
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
                        <div className="space-y-1">
                          {area.devices.map((device: DeviceStatus, idx: number) => {
                            const deviceInfo = config.devices.find(d => d.id === device.deviceId)
                            return (
                              <div key={idx} className="flex flex-row items-center justify-between gap-1.5 p-1.5 lg:p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors">
                                {/* Left side: Icon, Device Name, Status */}
                                <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
                                  {getDeviceTypeIcon(deviceInfo?.type || 'router')}
                                  <div className="flex flex-col lg:flex-row lg:items-center lg:gap-1.5 gap-0.5 min-w-0">
                                    <div className="font-medium text-xs truncate">{deviceInfo?.name || device.deviceId}</div>
                                    <Badge 
                                      className={`text-xs px-1 py-0.5 shrink-0 ${
                                        device.status === 'up' ? 'bg-green-600 hover:bg-green-700' :
                                        device.status === 'down' ? 'bg-red-600 hover:bg-red-700' :
                                        'bg-yellow-600 hover:bg-yellow-700'
                                      }`}
                                    >
                                      {device.status === 'up' ? 'online' : device.status}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {/* Right side: Ping Status, IP */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {device.latency && (
                                    <span className="text-xs font-medium text-muted-foreground">{device.latency}ms</span>
                                  )}
                                  <a 
                                    href={formatIpAsUrl(deviceInfo?.ip || '')} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors inline-flex items-center gap-0.5"
                                  >
                                    {deviceInfo?.ip}
                                    <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}

