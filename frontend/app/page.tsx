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

export default function Home() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

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

  // Group areas by category and calculate category stats
  // This hook must be called before any conditional returns
  const categoryStats = useMemo(() => {
    if (!status || !config) return []
    
    // Group areas by their type/category
    const categoryMap = new Map<string, { total: number; up: number }>()
    
    status.areas.forEach(area => {
      const areaInfo = config.areas.find(a => a.id === area.areaId)
      const category = areaInfo?.type || 'Other'
      
      const current = categoryMap.get(category) || { total: 0, up: 0 }
      current.total += area.devices.length
      current.up += area.devices.filter(d => d.status === 'up').length
      categoryMap.set(category, current)
    })
    
    // Convert to array and calculate percentages
    return Array.from(categoryMap.entries()).map(([category, stats]) => {
      const percent = stats.total > 0 ? Math.round((stats.up / stats.total) * 100) : 0
      return {
        category,
        total: stats.total,
        up: stats.up,
        percent
      }
    })
  }, [status, config])

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
        <div className="absolute top-6 sm:top-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-0 sm:px-2 w-auto pointer-events-none">
          {/* Mobile: compact grid 2xN; Desktop: horizontal scroll */}
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 sm:p-0 sm:max-h-none sm:overflow-visible sm:grid-cols-none sm:flex sm:gap-2 sm:overflow-x-auto sm:py-1 sm:px-2 pointer-events-auto">
            {categoryStats.map(({ category, total, up, percent }) => {
              const barColor = percent === 100 ? 'bg-green-600' : percent >= 80 ? 'bg-yellow-600' : 'bg-red-600'
              return (
                <div key={category} className="w-full sm:w-auto sm:min-w-[160px] sm:max-w-[220px] px-2 py-1 rounded-md bg-white/75 dark:bg-gray-900/75 border border-border shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-0.5 sm:mb-1">
                    <div className="flex items-center gap-1.5">
                      {getCategoryIcon(category)}
                      <div className="text-[11px] sm:text-xs font-medium truncate" title={category}>{category}</div>
                    </div>
                    <div className={`text-[10px] font-bold ${percent === 100 ? 'text-green-600' : percent >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{percent}%</div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5 sm:mb-1">
                    <span>Devices</span>
                    <span className="font-medium">{up}/{total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5">
                    <div className={`h-1 sm:h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }}></div>
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

