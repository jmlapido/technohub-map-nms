'use client'

import { useEffect, useState } from 'react'
import { Activity, Zap, Server, Database } from 'lucide-react'

interface RealTimeStats {
  activePings: number
  activeDevices: number
  cacheHitRate: number
  lastPingTimestamp: string | null
}

export default function RealTimeWidget() {
  const [stats, setStats] = useState<RealTimeStats>({
    activePings: 0,
    activeDevices: 0,
    cacheHitRate: 0,
    lastPingTimestamp: null
  })

  // In a real implementation, this would be updated via WebSocket
  // For now, we'll simulate updates
  useEffect(() => {
    const updateStats = () => {
      setStats(prev => ({
        activePings: Math.floor(Math.random() * 10) + 1,
        activeDevices: prev.activeDevices,
        cacheHitRate: Math.floor(Math.random() * 20) + 80, // 80-100%
        lastPingTimestamp: new Date().toISOString()
      }))
    }

    // Initial update
    updateStats()

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-border py-2 px-4">
      <div className="container mx-auto flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span>Active Pings: {stats.activePings}</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            <span>Active Devices: {stats.activeDevices}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            <span>Cache Hit Rate: {stats.cacheHitRate}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span>Last Ping: {stats.lastPingTimestamp ? new Date(stats.lastPingTimestamp).toLocaleTimeString() : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}


