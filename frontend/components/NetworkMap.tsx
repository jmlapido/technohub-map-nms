'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type NetworkStatus, type Config, type AreaStatus, type DeviceStatus } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Wifi, WifiOff, AlertTriangle, X, Home, ShoppingBag, GraduationCap, Router, Radio, Satellite, Map as MapIcon, Globe } from 'lucide-react'

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface NetworkMapProps {
  status: NetworkStatus
  config: Config
}

export default function NetworkMap({ status, config }: NetworkMapProps) {
  const [selectedArea, setSelectedArea] = useState<AreaStatus | null>(null)
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null)
  const [showStatusPanel, setShowStatusPanel] = useState(true)
  const [mapView, setMapView] = useState<'street' | 'satellite'>('street')
  const mapRef = useRef<L.Map>(null)

  useEffect(() => {
    // Calculate bounds to fit all areas
    if (config.areas.length > 0) {
      const coords = config.areas.map(area => [area.lat, area.lng] as [number, number])
      const newBounds = L.latLngBounds(coords)
      setBounds(newBounds)
      
      // Fit map to bounds
      if (mapRef.current) {
        mapRef.current.fitBounds(newBounds, { padding: [50, 50] })
      }
    }
  }, [config.areas])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up': return '#10b981' // green
      case 'degraded': return '#f59e0b' // yellow
      case 'down': return '#ef4444' // red
      default: return '#6b7280' // gray
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up': return <Wifi className="w-4 h-4" />
      case 'degraded': return <AlertTriangle className="w-4 h-4" />
      case 'down': return <WifiOff className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getLinkColor = (linkStatus: string) => {
    return getStatusColor(linkStatus)
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  // Calculate statistics
  const totalDevices = status.areas.reduce((sum, area) => sum + area.devices.length, 0)
  const onlineDevices = status.areas.reduce((sum, area) => 
    sum + area.devices.filter(d => d.status === 'up').length, 0
  )
  const offlineDevices = totalDevices - onlineDevices

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
  }, {} as Record<string, any[]>)

  // Create a map of area statuses
  const areaStatusMap = new Map(status.areas.map(a => [a.areaId, a]))
  const linkStatusMap = new Map(status.links.map(l => [l.linkId, l]))

  const getAreaTypeIcon = (type: string) => {
    switch (type) {
      case 'Homes': return <Home className="w-3 h-3" />
      case 'PisoWiFi Vendo': return <ShoppingBag className="w-3 h-3" />
      case 'Schools': return <GraduationCap className="w-3 h-3" />
      default: return <Activity className="w-3 h-3" />
    }
  }

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'wireless-antenna': return <Satellite className="w-3 h-3" />
      case 'wifi-soho': return <Wifi className="w-3 h-3" />
      case 'router': return <Router className="w-3 h-3" />
      case 'wifi-outdoor': return <Radio className="w-3 h-3" />
      default: return <Activity className="w-3 h-3" />
    }
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[14.5995, 120.9842]}
        zoom={6}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        ref={mapRef}
        className="z-0"
      >
        {mapView === 'street' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {/* Draw links between areas */}
        {config.links.map(link => {
          const fromArea = config.areas.find(a => a.id === link.from)
          const toArea = config.areas.find(a => a.id === link.to)
          const linkStatus = linkStatusMap.get(link.id)

          if (!fromArea || !toArea) return null

          const positions: [number, number][] = [
            [fromArea.lat, fromArea.lng],
            [toArea.lat, toArea.lng]
          ]

          return (
            <Polyline
              key={link.id}
              positions={positions}
              color={linkStatus ? getLinkColor(linkStatus.status) : '#6b7280'}
              weight={3}
              opacity={0.7}
            />
          )
        })}

        {/* Draw area markers */}
        {config.areas.map(area => {
          const areaStatus = areaStatusMap.get(area.id)
          const statusColor = areaStatus ? getStatusColor(areaStatus.status) : '#6b7280'

          return (
            <CircleMarker
              key={area.id}
              center={[area.lat, area.lng]}
              radius={15}
              pathOptions={{
                color: statusColor,
                fillColor: statusColor,
                fillOpacity: 0.8,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedArea(areaStatus || null)
                },
                mouseover: () => {
                  setSelectedArea(areaStatus || null)
                }
              }}
            >
              <Popup>
                <div className="p-3">
                  <h3 className="font-bold text-lg mb-2">{area.name}</h3>
                  {areaStatus && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(areaStatus.status)}
                        <span className={`text-sm font-semibold capitalize ${
                          areaStatus.status === 'up' ? 'text-green-600' :
                          areaStatus.status === 'degraded' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {getStatusLabel(areaStatus.status)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {areaStatus.devices.length} device{areaStatus.devices.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Map View Toggle Button */}
      <div className="absolute top-2 right-2 lg:top-4 lg:right-4 z-[1000]">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-border overflow-hidden">
          <button
            onClick={() => setMapView(mapView === 'street' ? 'satellite' : 'street')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={`Switch to ${mapView === 'street' ? 'satellite' : 'street'} view`}
          >
            {mapView === 'street' ? (
              <>
                <Satellite className="w-4 h-4" />
                <span className="text-xs lg:text-sm font-medium">Satellite</span>
              </>
            ) : (
              <>
                <MapIcon className="w-4 h-4" />
                <span className="text-xs lg:text-sm font-medium">Street</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Panel */}
      {showStatusPanel && (
        <div className="absolute bottom-2 left-2 right-2 lg:bottom-4 lg:left-4 lg:right-4 z-[1000]">
          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3 lg:p-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
                    <span className="text-xs lg:text-sm font-medium">
                      {onlineDevices}/{totalDevices} Online
                    </span>
                  </div>
                  
                  {offlineDevices > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600"></div>
                      <span className="text-xs lg:text-sm font-medium text-red-600">
                        {offlineDevices} Offline
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <span className="text-xs lg:text-sm font-medium">
                      {status.links.length} Links
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStatusPanel(false)}
                  className="h-7 lg:h-8 px-2 lg:px-3 text-xs"
                >
                  Hide
                </Button>
              </div>

              {/* Areas Status - Grouped by Type */}
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {Object.entries(groupedAreas).map(([type, areas]) => (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-1">
                      {getAreaTypeIcon(type)}
                      <span className="text-xs lg:text-sm font-semibold">{type}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:gap-3 ml-5">
                      {areas.map(area => {
                        const onlineCount = area.devices.filter((d: DeviceStatus) => d.status === 'up').length
                        const totalCount = area.devices.length
                        
                        // Determine area status color
                        let dotColor = 'bg-green-600'
                        if (onlineCount === 0) {
                          dotColor = 'bg-red-600'
                        } else if (onlineCount < totalCount) {
                          dotColor = 'bg-yellow-600'
                        }
                        
                        return (
                          <div key={area.areaId} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                            <span className="text-xs lg:text-sm font-medium">
                              {area.areaInfo?.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({onlineCount}/{totalCount})
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Offline Devices List */}
              {offlineDevices > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="space-y-2">
                    {status.areas.map(area => {
                      const areaInfo = config.areas.find(a => a.id === area.areaId)
                      const offlineDevicesInArea = area.devices.filter(d => d.status === 'down')
                      
                      if (offlineDevicesInArea.length === 0) return null
                      
                      return (
                        <div key={area.areaId} className="text-xs lg:text-sm">
                          <span className="font-medium">{areaInfo?.name}:</span>{' '}
                          {offlineDevicesInArea.map((device, idx) => {
                            const deviceInfo = config.devices.find(d => d.id === device.deviceId)
                            const duration = device.offlineDuration 
                              ? formatDuration(device.offlineDuration)
                              : 'recently'
                            
                            return (
                              <span key={device.deviceId}>
                                {idx > 0 && ', '}
                                <span className="text-red-600">{deviceInfo?.name}</span>
                                <span className="text-muted-foreground"> ({duration})</span>
                              </span>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show Status Panel Button */}
      {!showStatusPanel && (
        <div className="absolute bottom-2 left-2 lg:bottom-4 lg:left-4 z-[1000]">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowStatusPanel(true)}
            className="h-8 lg:h-9 px-3 lg:px-4 text-xs lg:text-sm shadow-lg"
          >
            Show Status
          </Button>
        </div>
      )}

      {/* Area details panel */}
      {selectedArea && (
        <div className="absolute top-12 right-2 lg:top-16 lg:right-4 z-[1000] max-w-[calc(100vw-1rem)] lg:max-w-sm w-full max-h-[calc(85vh-3rem)] lg:max-h-[calc(80vh-3rem)] overflow-auto">
          <Card>
            <CardHeader className="p-4 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="text-base lg:text-lg">Area Details</CardTitle>
                  <CardDescription className="text-xs lg:text-sm">
                    {config.areas.find(a => a.id === selectedArea.areaId)?.name}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedArea(null)}
                  className="h-8 w-8 shrink-0"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 lg:p-6 pt-0">
              <div className="flex items-center gap-2">
                <Badge 
                  className={
                    selectedArea.status === 'up' ? 'bg-green-600 hover:bg-green-700' :
                    selectedArea.status === 'degraded' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-red-600 hover:bg-red-700'
                  }
                >
                  {getStatusLabel(selectedArea.status)}
                </Badge>
                <span className="text-xs lg:text-sm text-muted-foreground">
                  {selectedArea.devices.length} devices
                </span>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs lg:text-sm font-semibold">Devices:</h4>
                {selectedArea.devices.map((device, idx) => {
                  const deviceInfo = config.devices.find(d => d.id === device.deviceId)
                  return (
                    <div key={idx} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 p-2 bg-muted rounded-md">
                      <div className="flex items-center gap-2">
                        {getDeviceTypeIcon(deviceInfo?.type || 'router')}
                        <div>
                          <div className="font-medium text-xs lg:text-sm">{deviceInfo?.name || device.deviceId}</div>
                          <div className="text-xs text-muted-foreground">{deviceInfo?.ip}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {device.latency && (
                          <span className="text-xs font-medium">{device.latency}ms</span>
                        )}
                        <Badge 
                          className={`text-xs ${
                            device.status === 'up' ? 'bg-green-600 hover:bg-green-700' :
                            device.status === 'down' ? 'bg-red-600 hover:bg-red-700' :
                            'bg-yellow-600 hover:bg-yellow-700'
                          }`}
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
        </div>
      )}
    </div>
  )
}

