'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { type NetworkStatus, type Config, type AreaStatus, type DeviceStatus, type NetworkLinkStatus } from '@/lib/api'
import { formatLatency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Wifi, WifiOff, AlertTriangle, X, Home, ShoppingBag, GraduationCap, Router, Radio, Satellite, Map as MapIcon, ChevronDown, ChevronUp, Network } from 'lucide-react'

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface NetworkMapProps {
  status: NetworkStatus
  config: Config
  onRefresh?: () => void
  isRefreshing?: boolean
  errorMessage?: string | null
}

export default function NetworkMap({ status, config, onRefresh, isRefreshing = false, errorMessage }: NetworkMapProps) {
  const [selectedArea, setSelectedArea] = useState<AreaStatus | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null)
  const [statusPanelMaximized, setStatusPanelMaximized] = useState(false)
  const [mapView, setMapView] = useState<'street' | 'satellite'>('street')
  const [focusedAreaId, setFocusedAreaId] = useState<string | null>(null)
  const [hasInitiallyCentered, setHasInitiallyCentered] = useState(false)
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set())
  const [hasInitializedCategories, setHasInitializedCategories] = useState(false)
  const mapRef = useRef<L.Map>(null)

  const areaMap = useMemo(() => new Map(config.areas.map(area => [area.id, area])), [config.areas])
  const deviceMap = useMemo(() => new Map(config.devices.map(device => [device.id, device])), [config.devices])

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

  // Toggle category visibility
  const toggleCategoryVisibility = (categoryType: string) => {
    setVisibleCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryType)) {
        newSet.delete(categoryType)
      } else {
        newSet.add(categoryType)
      }
      return newSet
    })
  }

  // Focus on a specific area and show details
  const focusOnArea = (areaId: string, areaStatus?: AreaStatus) => {
    const area = config.areas.find(a => a.id === areaId)
    if (area && mapRef.current) {
      mapRef.current.flyTo([area.lat, area.lng], 17, {
        duration: 1.5
      })
      setFocusedAreaId(areaId)
      
      // Show area details panel if areaStatus is provided
      if (areaStatus) {
        setSelectedArea(areaStatus)
      }
      
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

  // Auto-adjust map bounds when panel is maximized
  useEffect(() => {
    if (statusPanelMaximized && bounds && mapRef.current) {
      // Small delay to ensure panel animation completes
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitBounds(bounds, { 
            padding: [120, 80], // Increased top padding for maximized panel
            maxZoom: 15
          })
        }
      }, 300)
    }
  }, [statusPanelMaximized, bounds])

  // Calculate statistics
  const totalDevices = status.areas.reduce((sum, area) => sum + area.devices.length, 0)
  const onlineDevices = status.areas.reduce((sum, area) => 
    sum + area.devices.filter(d => d.status === 'up').length, 0
  )
  const offlineDevices = totalDevices - onlineDevices

  type GroupedArea = AreaStatus & { areaInfo: Config['areas'][number] }
  type GroupedAreasByType = Record<string, GroupedArea[]>

  // Group areas by type - memoized to prevent unnecessary recalculations
  const groupedAreas: GroupedAreasByType = useMemo(() => {
    return status.areas.reduce<GroupedAreasByType>((acc, area) => {
      const areaInfo = config.areas.find(a => a.id === area.areaId)
      if (!areaInfo) return acc
      const type = areaInfo.type || 'Other'
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push({ ...area, areaInfo })
      return acc
    }, {})
  }, [status.areas, config.areas])

  // Initialize visible categories with all available types (only once)
  useEffect(() => {
    const allTypes = Object.keys(groupedAreas)
    
    if (allTypes.length > 0 && !hasInitializedCategories) {
      setVisibleCategories(new Set(allTypes))
      setHasInitializedCategories(true)
    }
  }, [groupedAreas, hasInitializedCategories])

  const areaStatusMap = useMemo(() => new Map(status.areas.map(a => [a.areaId, a])), [status.areas])
  const linkStatusMap = useMemo(() => new Map(status.links.map(l => [l.linkId, l])), [status.links])

  type ConfigLink = Config['links'][number]

  interface ResolvedLinkEndpoint {
    index: number
    areaId: string | null
    areaName: string | null
    deviceId: string | null
    deviceName: string | null
    interface?: string | null
    interfaceType?: string | null
    label?: string | null
    status: string
    latency?: number
    packetLoss?: number
    lastChecked?: string | null
    area?: Config['areas'][number]
    device?: Config['devices'][number]
  }

  interface ResolvedLinkData {
    id: string
    label?: string
    status: string
    latency?: number
    type?: string
    metadata?: Record<string, unknown>
    endpoints: ResolvedLinkEndpoint[]
    positions: [number, number][] | null
    sameArea: boolean
  }

  const normalizeConfigEndpoints = useCallback((link: ConfigLink): [ResolvedLinkEndpoint, ResolvedLinkEndpoint] => {
    const endpoints = Array.isArray(link.endpoints) ? link.endpoints.slice(0, 2) : []

    while (endpoints.length < 2) {
      endpoints.push({ areaId: null, deviceId: null, interface: null, interfaceType: null, label: null })
    }

    return endpoints.map((endpoint, index) => {
      const fallbackAreaId = index === 0 ? (link.from ?? null) : (link.to ?? null)
      const areaId = endpoint?.areaId ?? fallbackAreaId ?? null
      const deviceId = endpoint?.deviceId ?? null

      return {
        index,
        areaId,
        areaName: null,
        deviceId,
        deviceName: null,
        interface: endpoint?.interface ?? null,
        interfaceType: endpoint?.interfaceType ?? link.type ?? null,
        label: endpoint?.label ?? null,
        status: 'unknown',
        latency: undefined,
        packetLoss: undefined,
        lastChecked: null
      }
    }) as [ResolvedLinkEndpoint, ResolvedLinkEndpoint]
  }, [])

  const createOffsetPositions = useCallback((area: Config['areas'][number], linkId: string): [number, number][] => {
    const hash = Array.from(linkId).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const angle = (hash % 360) * (Math.PI / 180)
    const radius = 0.02 // ~2km offset for visibility
    const latOffset = radius * Math.cos(angle)
    const lngOffset = radius * Math.sin(angle)

    return [
      [area.lat + latOffset, area.lng + lngOffset],
      [area.lat - latOffset, area.lng - lngOffset]
    ]
  }, [])

  const computeLinkPositions = useCallback((endpoints: ResolvedLinkEndpoint[], linkId: string): { positions: [number, number][] | null, sameArea: boolean } => {
    const [endpointA, endpointB] = endpoints
    const areaA = endpointA.area
    const areaB = endpointB.area

    if (!areaA || !areaB) {
      return { positions: null, sameArea: false }
    }

    const sameArea = areaA.id === areaB.id

    if (sameArea) {
      return { positions: createOffsetPositions(areaA, linkId), sameArea: true }
    }

    return {
      positions: [
        [areaA.lat, areaA.lng],
        [areaB.lat, areaB.lng]
      ],
      sameArea: false
    }
  }, [createOffsetPositions])

  const mergeLinkStatus = useCallback((statusInfo: NetworkLinkStatus | undefined, endpointIndex: number) => {
    if (!statusInfo?.endpoints || !Array.isArray(statusInfo.endpoints)) return undefined
    return statusInfo.endpoints[endpointIndex]
  }, [])

  const getResolvedLinkData = useCallback((link: ConfigLink): ResolvedLinkData | null => {
    const statusInfo = linkStatusMap.get(link.id)
    const normalizedEndpoints = normalizeConfigEndpoints(link)

    const resolvedEndpoints = normalizedEndpoints.map((endpoint, index) => {
      const area = endpoint.areaId ? areaMap.get(endpoint.areaId) : undefined
      const device = endpoint.deviceId ? deviceMap.get(endpoint.deviceId) : undefined
      const statusEndpoint = mergeLinkStatus(statusInfo, index)

      const status = statusEndpoint?.status ?? statusInfo?.status ?? endpoint.status ?? 'unknown'

      const resolvedAreaName = area?.name ?? statusEndpoint?.areaName ?? endpoint.areaName;
      const resolvedDeviceName = device?.name ?? statusEndpoint?.deviceName ?? endpoint.deviceName;
      
      // Debug logging for name resolution in NetworkMap
      if (endpoint.areaId && !resolvedAreaName) {
        console.warn(`[NetworkMap] ⚠️ Area ID "${endpoint.areaId}" not resolved:`, {
          areaFromMap: area?.name,
          statusEndpointAreaName: statusEndpoint?.areaName,
          endpointAreaName: endpoint.areaName,
          areaMapHas: areaMap.has(endpoint.areaId),
          linkId: link.id
        });
      }
      if (endpoint.deviceId && !resolvedDeviceName) {
        console.warn(`[NetworkMap] ⚠️ Device ID "${endpoint.deviceId}" not resolved:`, {
          deviceFromMap: device?.name,
          statusEndpointDeviceName: statusEndpoint?.deviceName,
          endpointDeviceName: endpoint.deviceName,
          deviceMapHas: deviceMap.has(endpoint.deviceId),
          linkId: link.id
        });
      }
      
      return {
        ...endpoint,
        area,
        device,
        areaName: resolvedAreaName,
        deviceName: resolvedDeviceName,
        interface: endpoint.interface ?? statusEndpoint?.interface ?? null,
        interfaceType: endpoint.interfaceType ?? statusEndpoint?.interfaceType ?? statusInfo?.type ?? null,
        label: endpoint.label ?? statusEndpoint?.label ?? null,
        status,
        latency: typeof statusEndpoint?.latency === 'number' ? statusEndpoint.latency : undefined,
        packetLoss: typeof statusEndpoint?.packetLoss === 'number' ? statusEndpoint.packetLoss : undefined,
        lastChecked: statusEndpoint?.lastChecked ?? null
      }
    }) as ResolvedLinkEndpoint[]

    const { positions, sameArea } = computeLinkPositions(resolvedEndpoints, link.id)

    if (!positions) {
      return null
    }

    return {
      id: link.id,
      label: link.label,
      status: statusInfo?.status ?? 'unknown',
      latency: typeof statusInfo?.latency === 'number' ? statusInfo.latency : undefined,
      type: statusInfo?.type ?? link.type,
      metadata: statusInfo?.metadata ?? link.metadata,
      endpoints: resolvedEndpoints,
      positions,
      sameArea
    }
  }, [areaMap, deviceMap, linkStatusMap, normalizeConfigEndpoints, computeLinkPositions, mergeLinkStatus])

  const resolvedLinks = useMemo(() => {
    return config.links
      .map(link => getResolvedLinkData(link))
      .filter((data): data is ResolvedLinkData => data !== null)
  }, [config.links, getResolvedLinkData])

  interface DeviceConnection {
    link: ResolvedLinkData
    remote: ResolvedLinkEndpoint
    localEndpoint: ResolvedLinkEndpoint
  }

  const deviceConnections = useMemo(() => {
    if (!selectedDeviceId) return [] as DeviceConnection[]

    return resolvedLinks
      .map(link => {
        const localIndex = link.endpoints.findIndex(endpoint => endpoint.deviceId === selectedDeviceId)
        if (localIndex === -1) return null
        const remoteIndex = localIndex === 0 ? 1 : 0
        const localEndpoint = link.endpoints[localIndex]
        const remoteEndpoint = link.endpoints[remoteIndex]

        return {
          link,
          remote: remoteEndpoint,
          localEndpoint
        } as DeviceConnection
      })
      .filter((value): value is DeviceConnection => value !== null)
  }, [resolvedLinks, selectedDeviceId])

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
          zoomControl={false}
          whenReady={() => {
            if (mapRef.current) {
              handleMapCreated(mapRef.current)
            }
          }}
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

        {/* Draw links between areas/devices */}
        {resolvedLinks.map(link => {
          if (!link.positions) return null

          const polylineColor = getLinkColor(link.status)
          const strokeWeight = link.sameArea ? 2 : 3.5

          const endpointSummary = link.endpoints
            .map(endpoint => endpoint.deviceName || endpoint.areaName || 'Unknown')
            .join(' ↔ ')

          return (
            <Polyline
              key={link.id}
              positions={link.positions}
              color={polylineColor}
              weight={strokeWeight}
              opacity={0.8}
              dashArray={link.sameArea ? '6 6' : undefined}
            >
              <Tooltip direction="center" opacity={0.9} sticky>
                <div className="space-y-1 text-[11px]">
                  <div className="font-semibold text-xs">
                    {link.label || endpointSummary}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {endpointSummary}
                  </div>
                  <div>Latency: {formatLatency(link.latency)}</div>
                  <div>Status: {getStatusLabel(link.status)}</div>
                </div>
              </Tooltip>
            </Polyline>
          )
        })}

        {/* Draw area markers */}
        {config.areas.map(area => {
          const areaStatus = areaStatusMap.get(area.id)
          const areaType = area.type || 'Other'
          
          // Skip rendering if category is hidden
          if (!visibleCategories.has(areaType)) return null
          
          const statusColor = areaStatus ? getStatusColor(areaStatus.status) : '#6b7280'
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
                  setSelectedDeviceId(null) // Close device connections when selecting new area
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

        {/* Map Controls - positioned lower left */}
        <div className="absolute bottom-4 left-3 sm:left-6 z-[1000] pointer-events-none">
          <div className="flex flex-col gap-2 pointer-events-auto w-36 sm:w-44">
            {errorMessage && (
              <div className="text-xs text-orange-600 bg-white/90 dark:bg-gray-900/90 px-2 py-1 rounded shadow">
                {errorMessage}
              </div>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="h-7 w-full text-[11px] bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 shadow disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="h-7 w-7 flex items-center justify-center bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 shadow"
                title="Zoom In"
                aria-label="Zoom in"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="h-7 w-7 flex items-center justify-center bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 shadow"
                title="Zoom Out"
                aria-label="Zoom out"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                onClick={() => setMapView(mapView === 'street' ? 'satellite' : 'street')}
                className="h-7 flex-1 px-2 text-[11px] bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 shadow flex items-center justify-center gap-1"
                title={`Switch to ${mapView === 'street' ? 'satellite' : 'street'} view`}
              >
                {mapView === 'street' ? (
                  <>
                    <Satellite className="w-3 h-3" />
                    <span className="hidden sm:inline">Satellite</span>
                  </>
                ) : (
                  <>
                    <MapIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">Street</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Area details panel */}
        {selectedArea && (
          <div 
            className={`absolute top-12 z-[1000] max-w-[calc(100vw-1rem)] lg:max-w-sm w-full max-h-[calc(85vh-3rem)] lg:max-h-[calc(80vh-3rem)] overflow-auto transition-all duration-300 ease-in-out ${
              selectedDeviceId 
                ? 'hidden lg:block right-[calc(100%-30rem)]' 
                : 'right-2 lg:right-4'
            }`}
          >
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
                    // Check if this device has connections
                    const hasConnections = resolvedLinks.some(link => 
                      link.endpoints.some(endpoint => endpoint.deviceId === device.deviceId)
                    )
                    
                    return (
                      <div key={idx} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2 flex-1">
                          {getDeviceTypeIcon(deviceInfo?.type || 'router')}
                          <div className="flex-1">
                            <div className="font-medium text-xs lg:text-sm">{deviceInfo?.name || device.deviceId}</div>
                            <div className="text-xs text-muted-foreground">{deviceInfo?.ip}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{formatLatency(device.latency)}</span>
                          <Badge 
                            className={`text-xs ${
                              device.status === 'up' ? 'bg-green-600 hover:bg-green-700' :
                              device.status === 'down' ? 'bg-red-600 hover:bg-red-700' :
                              'bg-yellow-600 hover:bg-yellow-700'
                            }`}
                          >
                            {device.status === 'up' ? 'online' : device.status}
                          </Badge>
                          {hasConnections && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Toggle: if same device is open, close it; otherwise open this device (closing previous)
                                setSelectedDeviceId(device.deviceId === selectedDeviceId ? null : device.deviceId)
                              }}
                              className={`h-7 w-7 p-0 hover:bg-primary/10 ${
                                device.deviceId === selectedDeviceId ? 'bg-primary/10' : ''
                              }`}
                              title="View connections"
                              aria-label="View device connections"
                            >
                              <Network className={`h-4 w-4 ${device.deviceId === selectedDeviceId ? 'text-primary' : 'text-muted-foreground'}`} />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Device connections panel */}
        {selectedDeviceId && (
          <div className="absolute top-12 right-2 lg:top-16 lg:right-4 z-[1001] max-w-[calc(100vw-1rem)] lg:max-w-sm w-full max-h-[calc(85vh-3rem)] lg:max-h-[calc(80vh-3rem)] overflow-auto transition-all duration-300">
            <Card>
              <CardHeader className="p-4 lg:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base lg:text-lg">Device Connections</CardTitle>
                    <CardDescription className="text-xs lg:text-sm">
                      {config.devices.find(d => d.id === selectedDeviceId)?.name || selectedDeviceId}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDeviceId(null)}
                    className="h-8 w-8 shrink-0"
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 lg:p-6 pt-0">
                {deviceConnections.length > 0 ? (
                  <div className="space-y-2">
                    {deviceConnections.map(connection => {
                      const { link, remote, localEndpoint } = connection
                      const deviceInfo = config.devices.find(d => d.id === selectedDeviceId)

                      const remoteName = remote.deviceName || remote.areaName || 'Unknown endpoint'
                      const interfaceLabel = localEndpoint.interface || localEndpoint.interfaceType || 'link'
                      const remoteInterfaceLabel = remote.interface || remote.interfaceType

                      return (
                        <div key={link.id} className="p-2 bg-muted rounded-md space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs lg:text-sm font-medium truncate">
                              {link.label || remoteName}
                            </span>
                            <Badge
                              className={`text-[10px] uppercase tracking-wide ${
                                link.status === 'up'
                                  ? 'bg-green-600 hover:bg-green-700'
                                  : link.status === 'degraded'
                                  ? 'bg-yellow-600 hover:bg-yellow-700'
                                  : link.status === 'down'
                                  ? 'bg-red-600 hover:bg-red-700'
                                  : 'bg-gray-600 hover:bg-gray-700'
                              }`}
                            >
                              {getStatusLabel(link.status)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{deviceInfo?.name || selectedDeviceId}</span>
                            {interfaceLabel && (
                              <span className="ml-1 text-muted-foreground">({interfaceLabel})</span>
                            )}
                            {' → '}
                            <span className="font-semibold text-foreground">{remoteName}</span>
                            {remoteInterfaceLabel && (
                              <span className="ml-1 text-muted-foreground">({remoteInterfaceLabel})</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Average latency: {formatLatency(link.latency)}
                          </div>
                          {remote.latency !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              Last measured: {formatLatency(remote.latency)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No connections found for this device</p>
                  </div>
                )}
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(groupedAreas).map(([type, areas]) => {
                const onlineCount = areas.reduce((sum, area) => 
                  sum + area.devices.filter((d: DeviceStatus) => d.status === 'up').length, 0
                )
                const totalCount = areas.reduce((sum, area) => sum + area.devices.length, 0)
                const isVisible = visibleCategories.has(type)
                
                return (
                  <button
                    key={type}
                    onClick={() => toggleCategoryVisibility(type)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                      isVisible 
                        ? 'bg-muted/50 hover:bg-muted/70' 
                        : 'bg-muted/20 hover:bg-muted/40 opacity-60'
                    }`}
                    title={`Click to ${isVisible ? 'hide' : 'show'} ${type} on map`}
                  >
                    {getAreaTypeIcon(type)}
                    <span className="text-xs lg:text-sm font-medium">
                      {type}{' '}
                      <span className="text-green-600 font-semibold">{onlineCount}</span>
                      <span className="text-muted-foreground">/{totalCount}</span>
                    </span>
                  </button>
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
                  <div className="flex flex-wrap gap-1 lg:gap-1.5 ml-5">
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
                          onClick={() => focusOnArea(area.areaId, area)}
                          className="flex items-center gap-1 hover:bg-muted px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
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

