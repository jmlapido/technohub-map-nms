'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { networkApi, type NetworkStatus, type Config } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function Home() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    loadData()
    
    // Dynamic interval based on retry count with exponential backoff
    const baseInterval = 10000
    const retryInterval = Math.min(baseInterval * Math.pow(1.5, retryCount), 60000) // Max 60s
    
    const interval = setInterval(loadData, retryInterval)
    return () => clearInterval(interval)
  }, [retryCount])

  const loadData = async () => {
    try {
      const [statusData, configData] = await Promise.all([
        networkApi.getStatus(),
        networkApi.getConfig()
      ])
      setStatus(statusData)
      setConfig(configData)
      setLoading(false)
      setError(null)
      setRetryCount(0) // Reset retry count on success
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Connection lost. Retrying...')
      setLoading(false)
      setRetryCount(prev => prev + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading network status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Connection Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button 
              onClick={loadData}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full relative">
      {status && config && (
        <NetworkMap status={status} config={config} />
      )}
    </div>
  )
}

