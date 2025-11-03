'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { networkApi, type NetworkStatus, type Config } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Home as HomeIcon, ShoppingBag, GraduationCap, Radio, Activity } from 'lucide-react'

// Dynamically import the map component to avoid SSR issues with Leaflet
const NetworkMap = dynamic(() => import('@/components/NetworkMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    </div>
  )
})

// Helper function to get category icon
const getCategoryIcon = (categoryType: string) => {
  switch (categoryType) {
    case 'Homes': return <HomeIcon className="w-3 h-3" />
    case 'PisoWiFi Vendo': return <ShoppingBag className="w-3 h-3" />
    case 'Schools': return <GraduationCap className="w-3 h-3" />
    case 'Server/Relay': return <Radio className="w-3 h-3" />
    default: return <Activity className="w-3 h-3" />
  }
}

const categoryOrder = ['Server/Relay', 'Schools', 'PisoWiFi Vendo', 'Homes'] as const

type CategoryOrder = typeof categoryOrder[number]

export default function Home() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const categoryStats = useMemo(() => {
    if (!status || !config) {
      return []
    }

    const statusAreaMap = new Map(status.areas.map(area => [area.areaId, area]))
    const statsMap = new Map<string, { type: string; totalDevices: number; upDevices: number; areaCount: number }>()

    config.areas.forEach(areaInfo => {
      const type = areaInfo.type || 'Other'
      const areaStatus = statusAreaMap.get(areaInfo.id)
      const totalDevices = areaStatus
        ? areaStatus.devices.length
        : config.devices.filter(device => device.areaId === areaInfo.id).length
      const upDevices = areaStatus ? areaStatus.devices.filter(device => device.status === 'up').length : 0

      if (!statsMap.has(type)) {
        statsMap.set(type, { type, totalDevices: 0, upDevices: 0, areaCount: 0 })
      }

      const stat = statsMap.get(type)!
      stat.totalDevices += totalDevices
      stat.upDevices += upDevices
      stat.areaCount += 1
    })

    const unsortedStats = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      percent: stat.totalDevices > 0 ? Math.round((stat.upDevices / stat.totalDevices) * 100) : 0
    }))

    return unsortedStats.sort((a, b) => {
      const indexA = (categoryOrder as ReadonlyArray<string>).indexOf(a.type as CategoryOrder)
      const indexB = (categoryOrder as ReadonlyArray<string>).indexOf(b.type as CategoryOrder)

      if (indexA === -1 && indexB === -1) {
        return a.type.localeCompare(b.type)
      }

      if (indexA === -1) {
        return 1
      }

      if (indexB === -1) {
        return -1
      }

      return indexA - indexB
    })
  }, [status, config])

  // Memoized load function for better performance
  const loadData = useCallback(async () => {
    try {
      // Use optimized dashboard endpoint
      const dashboardData = await networkApi.getDashboard()
      setStatus(dashboardData.status)
      setConfig(dashboardData.config as Config) // Cast to full Config type
      setLoading(false)
      setError(null)
      setRetryCount(0) // Reset retry count on success
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown dashboard error')
      console.error('Failed to load dashboard data:', error)
      
      // Handle 304 Not Modified gracefully
      if (error.message === 'Not modified') {
        console.log('Data not modified, keeping existing data')
        return
      }
      
      // Exponential backoff for retries
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)
      const backoffDelay = Math.min(1000 * Math.pow(2, newRetryCount), 30000)
      
      setError(`Connection lost. Retrying in ${Math.round(backoffDelay/1000)}s... (${newRetryCount})`)
      setLoading(false)
      
      // Auto-retry with backoff
      setTimeout(loadData, backoffDelay)
    }
  }, [retryCount])

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    setLoading(true)
    setRetryCount(0)
    loadData()
  }, [loadData])

  useEffect(() => {
    loadData()
    
    // Optimized polling - 60 seconds instead of 15
    const interval = setInterval(loadData, 60000) // 1 minute for better performance
    return () => clearInterval(interval)
  }, [loadData])

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading network status...</p>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Retry attempt: {retryCount}</p>
          )}
        </div>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Connection Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button 
              onClick={handleRefresh}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Retry Now
            </button>
            <div className="text-xs text-muted-foreground text-center">
              <p>Having connection issues?</p>
              <p>Check if the backend server is running on port 5000</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full relative">
      {/* Floating Category Health Cards */}
      {status && config && categoryStats.length > 0 && (
        <div className="absolute top-4 sm:top-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-0 sm:px-2 w-auto pointer-events-none">
          {/* Mobile: compact grid 2xN; Desktop: horizontal scroll */}
          <div className="grid grid-cols-2 gap-1 sm:max-h-36 overflow-y-auto p-1 sm:p-0 sm:max-h-none sm:overflow-visible sm:grid-cols-none sm:flex sm:gap-2 sm:overflow-x-auto sm:py-1 sm:px-2 pointer-events-auto">
            {categoryStats.map(category => {
              const barColor = category.percent === 100 ? 'bg-green-600' : category.percent >= 80 ? 'bg-yellow-600' : 'bg-red-600'
              return (
                <div key={category.type} className="w-full sm:w-auto sm:min-w-[150px] sm:max-w-[210px] px-1.5 py-1 rounded-md bg-white/80 dark:bg-gray-900/80 border border-border/80 shadow-sm">
                  <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
                    <div className="flex items-center gap-1.5">
                      {getCategoryIcon(category.type)}
                      <div className="text-[10px] sm:text-xs font-medium truncate" title={category.type}>{category.type}</div>
                    </div>
                    <div className={`text-[9px] sm:text-[10px] font-bold ${category.percent === 100 ? 'text-green-600' : category.percent >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{category.percent}%</div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground mb-0.5 sm:mb-1">
                    <span>Devices</span>
                    <span className="font-medium">{category.totalDevices}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground mb-0.5 sm:mb-1">
                    <span>Online</span>
                    <span className="font-medium">{category.upDevices}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-[3px] sm:h-1.5">
                    <div className={`h-[3px] sm:h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${category.percent}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Map container - full height */}
      {status && config ? (
        <NetworkMap 
          status={status} 
          config={config}
          onRefresh={handleRefresh}
          isRefreshing={loading}
          errorMessage={error}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground">Waiting for data...</p>
          </div>
        </div>
      )}
    </div>
  )
}

