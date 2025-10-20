'use client'

import { useEffect, useState } from 'react'
import { networkApi, type NetworkStatus, type Config, type DeviceStatus } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle2, XCircle, Home, ShoppingBag, GraduationCap, Router, Radio, Satellite } from 'lucide-react'

export default function StatusPage() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statusData, configData] = await Promise.all([
        networkApi.getStatus(),
        networkApi.getConfig()
      ])
      setStatus(statusData)
      setConfig(configData)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load data:', err)
      setLoading(false)
    }
  }

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

  // Group areas by type
  const groupedAreas = status.areas.reduce((acc, area) => {
    const areaInfo = config.areas.find(a => a.id === area.areaId)
    if (!areaInfo) return acc
    
    const type = areaInfo.type || 'Other'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push({ ...area, areaInfo })
    return acc
  }, {} as Record<string, Array<{ areaId: string; status: 'up' | 'down' | 'degraded'; devices: DeviceStatus[]; areaInfo: { id: string; name: string; type: string; lat: number; lng: number } }>>)

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

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <Card className="border-2 hover:border-blue-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Total Devices</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0">
            <div className="text-xl lg:text-2xl font-bold">{totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {upDevices} online, {downDevices} offline
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-green-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Network Links</CardTitle>
            <Wifi className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0">
            <div className="text-xl lg:text-2xl font-bold">{totalLinks}</div>
            <p className="text-xs text-muted-foreground">
              {upLinks} online, {degradedLinks} degraded
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-purple-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Areas</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0">
            <div className="text-xl lg:text-2xl font-bold">{status.areas.length}</div>
            <p className="text-xs text-muted-foreground">
              {status.areas.filter(a => a.status === 'up').length} operational
            </p>
          </CardContent>
        </Card>

        <Card className={`border-2 transition-all ${
          downDevices === 0 ? 'hover:border-green-300' : 'hover:border-yellow-300'
        }`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-6">
            <CardTitle className="text-xs lg:text-sm font-medium">Health</CardTitle>
            {downDevices === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0">
            <div className="text-xl lg:text-2xl font-bold">
              {totalDevices > 0 ? Math.round((upDevices / totalDevices) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {downDevices === 0 ? 'All systems operational' : `${downDevices} issues detected`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Areas Status - Grouped by Type */}
      <div className="space-y-4 lg:space-y-6">
        <h2 className="text-lg lg:text-xl font-semibold">Areas by Type</h2>
        
        {Object.entries(groupedAreas).map(([type, areas]) => (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              {getAreaTypeIcon(type)}
              <h3 className="text-base lg:text-lg font-semibold">{type}</h3>
              <span className="text-sm text-muted-foreground">({areas.length} {areas.length === 1 ? 'area' : 'areas'})</span>
            </div>
            
            <div className="space-y-3">
              {areas.map(area => (
                <Card key={area.areaId}>
                  <CardHeader className="p-4 lg:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                      <div>
                        <CardTitle className="text-base lg:text-lg">{area.areaInfo?.name || area.areaId}</CardTitle>
                        <CardDescription className="text-xs lg:text-sm">{area.devices.length} devices</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
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
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0">
                    <div className="space-y-2">
                      {area.devices.map((device: DeviceStatus, idx: number) => {
                        const deviceInfo = config.devices.find(d => d.id === device.deviceId)
                        return (
                          <div key={idx} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 p-3 bg-muted rounded-md">
                            <div className="flex items-center gap-3">
                              {getDeviceTypeIcon(deviceInfo?.type || 'router')}
                              <div>
                                <div className="font-medium text-sm lg:text-base">{deviceInfo?.name || device.deviceId}</div>
                                <div className="text-xs lg:text-sm text-muted-foreground">{deviceInfo?.ip}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {device.latency && (
                                <span className="text-xs lg:text-sm font-medium text-muted-foreground">{device.latency}ms</span>
                              )}
                              <Badge 
                                className={
                                  device.status === 'up' ? 'bg-green-600 hover:bg-green-700' :
                                  device.status === 'down' ? 'bg-red-600 hover:bg-red-700' :
                                  'bg-yellow-600 hover:bg-yellow-700'
                                }
                              >
                                {device.status === 'up' ? 'online' : device.status}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

