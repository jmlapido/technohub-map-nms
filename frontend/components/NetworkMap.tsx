'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type NetworkStatus, type Config, type AreaStatus, type DeviceStatus } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Wifi, WifiOff, AlertTriangle, X, Home, ShoppingBag, GraduationCap, Router, Radio, Satellite, Map as MapIcon, Globe, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [statusPanelMaximized, setStatusPanelMaximized] = useState(false)
  const [mapView, setMapView] = useState<'street' | 'satellite'>('street')
  const [focusedAreaId, setFocusedAreaId] = useState<string | null>(null)
  const [hasInitiallyCentered, setHasInitiallyCentered] = useState(false)
  const mapRef = useRef<L.Map>(null)

  // Calculate initial bounds from all areas
  const getInitialBounds = () => {
    if (config.areas.length > 0) {
      const coords = config.areas.map(area => [area.lat, area.lng] as [number, number])
      return L.latLngBounds(coords)
    }
    return null
  }

  useEffect(() => {
    // Calculate bounds to fit all areas
    if (config.areas.length > 0) {
      const coords = config.areas.map(area => [area.lat, area.lng] as [number, number])
      const newBounds = L.latLngBounds(coords)
      setBounds(newBounds)
      
      // Only fit bounds on initial load, not on every data refresh
      if (mapRef.current && !hasInitiallyCentered) {
        // Small delay to ensure map is fully initialized
        setTimeout(() => {
          mapRef.current?.fitBounds(newBounds, { 
            padding: [80, 80], // Increased padding for better visibility
            maxZoom: 15 // Prevent zooming in too close
          })
          setHasInitiallyCentered(true)
        }, 100)
      }
    }
  }, [config.areas, hasInitiallyCentered])

  // Also fit bounds when map becomes ready (only on initial load)
  const handleMapCreated = (map: L.Map) => {
    const initialBounds = getInitialBounds()
    if (initialBounds && !hasInitiallyCentered) {
      map.fitBounds(initialBounds, { 
        padding: [80, 80],
        maxZoom: 15
      })
      setHasInitiallyCentered(true)
    }
  }

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

  // Focus on a specific area
  const focusOnArea = (areaId: string) => {
    const area = config.areas.find(a => a.id === areaId)
    if (area && mapRef.current) {
      mapRef.current.flyTo([area.lat, area.lng], 17, {
        duration: 1.5
      })
      setFocusedAreaId(areaId)
      
      // Clear focus highlight after animation
      setTimeout(() => {
        setFocusedAreaId(null)
      }, 3000)
    }
  }

  // Center map on all areas
  const centerMapOnAllAreas = () => {
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, { 
        padding: [80, 80],
        maxZoom: 15
      })
    }
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
      case 'Server/Relay': return <Radio className="w-3 h-3" />
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

  // Get SVG icon string for area type
  const getAreaTypeIconSVG = (type: string) => {
    const iconMap: Record<string, string> = {
      'Homes': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      'PisoWiFi Vendo': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
      'Schools': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
      'Server/Relay': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>`,
      'default': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`
    }
    return iconMap[type] || iconMap['default']
  }

  // Create custom icon for area markers
  const createCustomIcon = (statusColor: string, areaType: string, isFocused: boolean = false) => {
    const iconSVG = getAreaTypeIconSVG(areaType)
    
    return L.divIcon({
      className: 'custom-area-marker',
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background-color: ${statusColor};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
          ${isFocused ? 'animation: pulse-marker 1s ease-in-out infinite;' : ''}
        " class="area-marker-circle ${isFocused ? 'focused' : ''}">
          ${iconSVG}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    })
  }

  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="flex-1 relative">
        <MapContainer
          center={[14.5995, 120.9842]}
          zoom={6}
          style={{ height: '100%', width: '100%', zIndex: 1 }}
          ref={mapRef}
          className="z-0"
          whenReady={(e) => handleMapCreated(e.target)}
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
          const areaType = area.type || 'Other'
          const isFocused = focusedAreaId === area.id
          const customIcon = createCustomIcon(statusColor, areaType, isFocused)

          return (
            <Marker
              key={area.id}
              position={[area.lat, area.lng]}
              icon={customIcon}
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
            </Marker>
          )
        })}
        </MapContainer>

        {/* Map View Toggle Button */}
        <div className="absolute top-16 right-2 lg:top-20 lg:right-4 z-[1000]">
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

      {/* Docked Status Bar */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-border shadow-lg">
        {/* Top Bar - Always Visible */}
        <div className="px-3 lg:px-4 py-2 lg:py-2.5 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 lg:gap-4 flex-wrap">
              {Object.entries(groupedAreas).map(([type, areas], idx) => {
                const onlineCount = areas.reduce((sum, area) => 
                  sum + area.devices.filter((d: DeviceStatus) => d.status === 'up').length, 0
                )
                const totalCount = areas.reduce((sum, area) => sum + area.devices.length, 0)
                
                return (
                  <div key={type} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-muted-foreground">|</span>}
                    {getAreaTypeIcon(type)}
                    <span className="text-xs lg:text-sm font-medium">
                      {type}{' '}
                      <span className="text-green-600 font-semibold">{onlineCount}</span>
                      <span className="text-muted-foreground">/{totalCount}</span>
                    </span>
                  </div>
                )
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newMaximized = !statusPanelMaximized
                setStatusPanelMaximized(newMaximized)
                // Center map when minimizing the panel
                if (!newMaximized) {
                  centerMapOnAllAreas()
                }
              }}
              className="h-7 lg:h-8 px-2 lg:px-3 text-xs shrink-0 flex items-center gap-1"
            >
              {statusPanelMaximized ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Minimize</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Maximize</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Content - Only when Maximized */}
        {statusPanelMaximized && (
          <div className="px-3 lg:px-4 py-3 max-h-[40vh] overflow-y-auto">
            {/* Areas Status - Grouped by Type */}
            <div className="space-y-3">
              {Object.entries(groupedAreas).map(([type, areas]) => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
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
                        <button
                          key={area.areaId}
                          onClick={() => focusOnArea(area.areaId)}
                          className="flex items-center gap-1.5 hover:bg-muted px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                          <span className="text-xs lg:text-sm font-medium">
                            {area.areaInfo?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({onlineCount}/{totalCount})
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Offline Devices List */}
            {offlineDevices > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <h4 className="text-xs lg:text-sm font-semibold mb-2 text-red-600">Offline Devices</h4>
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
                              <span className="text-muted-foreground"> (Offline for {duration})</span>
                            </span>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

