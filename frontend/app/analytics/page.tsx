'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartTooltip,
  Legend,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar
} from 'recharts'
import { networkApi, type NetworkStatus, type Config, type DeviceStatus, type NetworkLinkStatus } from '@/lib/api'
import { formatLatency } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  Clock,
  Gauge,
  Link as LinkIcon,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
  WifiOff
} from 'lucide-react'

type DashboardConfig = Pick<Config, 'areas' | 'links' | 'devices' | 'settings'>
type DeviceStatusValue = DeviceStatus['status'] | 'degraded'

interface DeviceMetric {
  deviceId: string
  name: string
  areaName: string
  type: string
  status: DeviceStatusValue
  latency?: number
  packetLoss?: number
  lastChecked?: string
  criticality?: Config['devices'][number]['criticality']
}

interface AreaAttention {
  areaId: string
  name: string
  type?: string
  status: 'up' | 'down' | 'degraded'
  totalDevices: number
  downDevices: number
  degradedDevices: number
  unknownDevices: number
}

interface LinkAttention {
  linkId: string
  label: string
  status: NetworkLinkStatus['status']
  latency?: number
  from?: string | null
  to?: string | null
}

const DEVICE_STATUS_TONE: Record<DeviceStatusValue | 'unknown', string> = {
  up: 'bg-emerald-600/90 text-white',
  down: 'bg-red-600/90 text-white',
  degraded: 'bg-amber-500/90 text-white',
  unknown: 'bg-slate-200 text-slate-700 dark:bg-slate-700/70 dark:text-slate-100'
}

const LINK_STATUS_TONE: Record<NetworkLinkStatus['status'] | 'unknown', string> = {
  up: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900',
  degraded: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900',
  down: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900',
  unknown: 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-700'
}

const STATUS_PIE_COLORS = ['#16a34a', '#f97316', '#dc2626', '#6b7280']

export default function AnalyticsPage() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const { status: statusData, config: configData, lastUpdated: updatedAt } = await networkApi.getDashboard()
      setStatus(statusData)
      setConfig(configData)
      setLastUpdated(updatedAt ?? new Date().toISOString())
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics data'
      if (message === 'Not modified') {
        setError(null)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      loadData()
    }, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  const deviceStatusMap = useMemo(() => {
    const map = new Map<string, DeviceStatus & { latency?: number; packetLoss?: number }>()
    if (!status) return map

    status.areas.forEach(area => {
      area.devices.forEach(device => {
        const existing = map.get(device.deviceId)
        if (!existing) {
          map.set(device.deviceId, device)
          return
        }

        if (!existing.lastChecked || !device.lastChecked) {
          map.set(device.deviceId, device)
          return
        }

        if (new Date(device.lastChecked).getTime() > new Date(existing.lastChecked).getTime()) {
          map.set(device.deviceId, device)
        }
      })
    })

    return map
  }, [status])

  const areaMap = useMemo(() => {
    const map = new Map<string, DashboardConfig['areas'][number]>()
    if (!config) return map
    config.areas.forEach(area => map.set(area.id, area))
    return map
  }, [config])

  const summaryMetrics = useMemo(() => {
    if (!config) {
      return {
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        degradedDevices: 0,
        unknownDevices: 0,
        onlinePercent: 0
      }
    }

    const counts = {
      up: 0,
      down: 0,
      degraded: 0,
      unknown: 0
    }

    config.devices.forEach(device => {
      const deviceStatus = deviceStatusMap.get(device.id)
      const statusValue = (deviceStatus?.status ?? 'unknown') as DeviceStatusValue | 'unknown'

      if (statusValue === 'up') counts.up += 1
      else if (statusValue === 'down') counts.down += 1
      else if (statusValue === 'degraded') counts.degraded += 1
      else counts.unknown += 1
    })

    const total = config.devices.length
    const onlinePercent = total > 0 ? Math.round((counts.up / total) * 100) : 0

    return {
      totalDevices: total,
      onlineDevices: counts.up,
      offlineDevices: counts.down,
      degradedDevices: counts.degraded,
      unknownDevices: counts.unknown,
      onlinePercent
    }
  }, [config, deviceStatusMap])

  const latencyStats = useMemo(() => {
    if (!status || !config) {
      return {
        averageLatency: null as number | null,
        samples: [] as DeviceMetric[]
      }
    }

    const samples: DeviceMetric[] = []

    status.areas.forEach(area => {
      const areaInfo = areaMap.get(area.areaId)
      area.devices.forEach(device => {
        if (typeof device.latency === 'number' && Number.isFinite(device.latency)) {
          const deviceInfo = config.devices.find(item => item.id === device.deviceId)
          samples.push({
            deviceId: device.deviceId,
            name: deviceInfo?.name || device.deviceId,
            areaName: areaInfo?.name || area.areaId,
            type: deviceInfo?.type || 'router',
            status: device.status as DeviceStatusValue,
            latency: device.latency,
            packetLoss: device.packetLoss,
            lastChecked: device.lastChecked,
            criticality: deviceInfo?.criticality
          })
        }
      })
    })

    const averageLatency = samples.length
      ? Math.round(samples.reduce((acc, sample) => acc + (sample.latency ?? 0), 0) / samples.length)
      : null

    return {
      averageLatency,
      samples
    }
  }, [status, config, areaMap])

  const healthScore = useMemo(() => {
    if (!config) return 0
    if (config.devices.length === 0) return 0

    let weightedSum = 0
    let totalWeight = 0

    config.devices.forEach(device => {
      const statusValue = (deviceStatusMap.get(device.id)?.status ?? 'unknown') as DeviceStatusValue | 'unknown'
      const criticality = device.criticality || 'normal'
      const weight =
        criticality === 'critical'
          ? 1.5
          : criticality === 'high'
            ? 1.2
            : criticality === 'low'
              ? 0.8
              : 1

      const base =
        statusValue === 'up'
          ? 1
          : statusValue === 'degraded'
            ? 0.55
            : statusValue === 'unknown'
              ? 0.35
              : 0

      weightedSum += base * weight
      totalWeight += weight
    })

    if (totalWeight === 0) return 0
    const percent = Math.round((weightedSum / totalWeight) * 100)
    return Math.max(0, Math.min(100, percent))
  }, [config, deviceStatusMap])

  const statusDistributionData = useMemo(() => {
    const { onlineDevices, degradedDevices, offlineDevices, unknownDevices } = summaryMetrics
    return [
      { name: 'Online', value: onlineDevices },
      { name: 'Degraded', value: degradedDevices },
      { name: 'Offline', value: offlineDevices },
      { name: 'Pending', value: unknownDevices }
    ].filter(item => item.value > 0)
  }, [summaryMetrics])

  const areaTypeHealthData = useMemo(() => {
    if (!config) return [] as Array<{ type: string; totalDevices: number; onlinePercent: number }>

    const grouped = new Map<string, { totalDevices: number; upDevices: number }>()

    config.areas.forEach(area => {
      const type = area.type || 'Other'
      if (!grouped.has(type)) {
        grouped.set(type, { totalDevices: 0, upDevices: 0 })
      }

      const bucket = grouped.get(type)!
      const areaDevices = config.devices.filter(device => device.areaId === area.id)
      bucket.totalDevices += areaDevices.length

      areaDevices.forEach(device => {
        const deviceStatus = deviceStatusMap.get(device.id)
        if ((deviceStatus?.status ?? 'unknown') === 'up') {
          bucket.upDevices += 1
        }
      })
    })

    return Array.from(grouped.entries()).map(([type, value]) => ({
      type,
      totalDevices: value.totalDevices,
      onlinePercent: value.totalDevices > 0 ? Math.round((value.upDevices / value.totalDevices) * 100) : 0
    }))
  }, [config, deviceStatusMap])

  const highestLatencyDevices = useMemo(() => {
    if (latencyStats.samples.length === 0) return [] as DeviceMetric[]

    const seen = new Set<string>()
    const sorted = [...latencyStats.samples]
      .sort((a, b) => (b.latency ?? 0) - (a.latency ?? 0))
      .filter(sample => {
        if (seen.has(sample.deviceId)) return false
        seen.add(sample.deviceId)
        return true
      })
      .slice(0, 6)

    return sorted
  }, [latencyStats.samples])

  const criticalDevices = useMemo(() => {
    if (!config) return [] as DeviceMetric[]

    const priorityLevels = new Set(['critical', 'high'])

    return config.devices
      .filter(device => priorityLevels.has(device.criticality || 'normal'))
      .map(device => {
        const statusValue = deviceStatusMap.get(device.id)
        const areaInfo = areaMap.get(device.areaId)
        return {
          deviceId: device.id,
          name: device.name,
          areaName: areaInfo?.name || device.areaId,
          type: device.type,
          status: (statusValue?.status ?? 'unknown') as DeviceStatusValue,
          latency: statusValue?.latency,
          packetLoss: statusValue?.packetLoss,
          lastChecked: statusValue?.lastChecked,
          criticality: device.criticality || 'normal'
        }
      })
      .sort((a, b) => {
        const severityOrder: Record<DeviceStatusValue | 'unknown', number> = {
          down: 3,
          degraded: 2,
          unknown: 1,
          up: 0
        }
        const diff = severityOrder[b.status] - severityOrder[a.status]
        if (diff !== 0) return diff
        const latencyDiff = (b.latency ?? 0) - (a.latency ?? 0)
        if (latencyDiff !== 0) return latencyDiff
        return a.name.localeCompare(b.name)
      })
  }, [config, areaMap, deviceStatusMap])

  const attentionAreas = useMemo(() => {
    if (!status) return [] as AreaAttention[]

    const areas: AreaAttention[] = status.areas
      .filter(area => area.status === 'down' || area.status === 'degraded')
      .map(area => {
        const info = areaMap.get(area.areaId)
        const downDevices = area.devices.filter(device => device.status === 'down').length
        const degradedDevices = area.devices.filter(device => device.status === 'degraded').length
        const unknownDevices = area.devices.filter(device => device.status === 'unknown').length

        return {
          areaId: area.areaId,
          name: info?.name || area.areaId,
          type: info?.type,
          status: area.status,
          totalDevices: area.devices.length,
          downDevices,
          degradedDevices,
          unknownDevices
        }
      })

    const severityOrder: Record<'down' | 'degraded', number> = { down: 1, degraded: 0 }

    return areas.sort((a, b) => {
      const severity = severityOrder[b.status] - severityOrder[a.status]
      if (severity !== 0) return severity
      const downDiff = b.downDevices - a.downDevices
      if (downDiff !== 0) return downDiff
      return a.name.localeCompare(b.name)
    })
  }, [status, areaMap])

  const linkAttention = useMemo(() => {
    if (!status) return [] as LinkAttention[]

    const linkMap = new Map<string, DashboardConfig['links'][number]>()
    config?.links.forEach(link => linkMap.set(link.id, link))

    const severity: Record<NetworkLinkStatus['status'], number> = {
      down: 2,
      degraded: 1,
      up: 0,
      unknown: 0
    }

    return status.links
      .filter(link => link.status === 'down' || link.status === 'degraded')
      .map(link => {
        const linked = linkMap.get(link.linkId)
        return {
          linkId: link.linkId,
          label: linked?.label || `Link ${link.linkId}`,
          status: link.status,
          latency: link.latency,
          from: linked?.from ?? linked?.endpoints?.[0]?.areaId ?? null,
          to: linked?.to ?? linked?.endpoints?.[1]?.areaId ?? null
        }
      })
      .sort((a, b) => {
        const severityDiff = severity[b.status] - severity[a.status]
        if (severityDiff !== 0) return severityDiff
        const latencyDiff = (b.latency ?? 0) - (a.latency ?? 0)
        if (latencyDiff !== 0) return latencyDiff
        return a.label.localeCompare(b.label)
      })
  }, [status, config])

  const linkStatusSummary = useMemo(() => {
    if (!status) {
      return {
        up: 0,
        degraded: 0,
        down: 0,
        unknown: 0
      }
    }

    return status.links.reduce(
      (acc, link) => {
        acc[link.status] += 1
        return acc
      },
      { up: 0, degraded: 0, down: 0, unknown: 0 } as Record<NetworkLinkStatus['status'], number>
    )
  }, [status])

  const handleRefresh = useCallback(() => {
    if (fetching) return
    void loadData()
  }, [fetching, loadData])

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return '—'
    const date = new Date(lastUpdated)
    if (Number.isNaN(date.getTime())) return '—'
    const now = Date.now()
    const diffMs = now - date.getTime()

    const minutes = Math.floor(diffMs / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }, [lastUpdated])

  if (loading && !status) {
    return (
      <div className="h-full overflow-auto p-4 lg:p-6">
        <div className="space-y-4 max-w-5xl mx-auto">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-muted/60 border border-border rounded-lg p-4 space-y-3 animate-pulse">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-6 w-16 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
          <div className="h-72 rounded-lg border border-dashed border-border" />
        </div>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="h-full overflow-auto p-4 lg:p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Analytics unavailable
            </CardTitle>
            <CardDescription>
              {error}. Check that the backend is reachable and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Network Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Trend insights derived from device telemetry, link health, and area-level performance.
            </p>
            {error && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              Updated {formattedLastUpdated}
              {lastUpdated && (
                <span className="text-[11px] text-muted-foreground/80">
                  ({new Date(lastUpdated).toLocaleString()})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={fetching}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
              {fetching ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </header>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="areas">Areas</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total devices</CardDescription>
                  <CardTitle className="text-3xl">{summaryMetrics.totalDevices}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  {summaryMetrics.onlinePercent}% online coverage
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Online devices</CardDescription>
                  <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">
                    {summaryMetrics.onlineDevices}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  {summaryMetrics.degradedDevices > 0 ? (
                    <span>
                      {summaryMetrics.degradedDevices} degraded, {summaryMetrics.offlineDevices} offline
                    </span>
                  ) : (
                    <span>{summaryMetrics.offlineDevices} offline</span>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Average latency</CardDescription>
                  <CardTitle className="text-3xl">
                    {latencyStats.averageLatency != null ? formatLatency(latencyStats.averageLatency) : '—'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart2 className="h-4 w-4" />
                  Based on {latencyStats.samples.length} live samples
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Health score</CardDescription>
                  <CardTitle className="text-3xl">{healthScore}%</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                    Weighted by device criticality
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        healthScore >= 90
                          ? 'bg-emerald-500'
                          : healthScore >= 70
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChartIcon className="h-5 w-5" /> Device status mix
                  </CardTitle>
                  <CardDescription>Snapshot of device availability by health category</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {statusDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          dataKey="value"
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={6}
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`slice-${entry.name}`} fill={STATUS_PIE_COLORS[index % STATUS_PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartTooltip
                          formatter={(value: number, name: string) => [`${value} devices`, name]}
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: 8, borderColor: 'hsl(var(--border))' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No device telemetry available yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart2 className="h-5 w-5" /> Area type health
                  </CardTitle>
                  <CardDescription>Average uptime across configured area categories</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {areaTypeHealthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={areaTypeHealthData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <RechartTooltip
                          formatter={(value: number) => [`${value}% online`, 'Health']}
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: 8, borderColor: 'hsl(var(--border))' }}
                        />
                        <Bar dataKey="onlinePercent" radius={[6, 6, 0, 0]} fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Configure areas and devices to view health by category.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="devices" className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ArrowUpRight className="h-5 w-5" /> Highest latency devices
                  </CardTitle>
                  <CardDescription>Devices ranked by latest observed latency</CardDescription>
                </CardHeader>
                <CardContent>
                  {highestLatencyDevices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-4 text-left">Device</th>
                            <th className="py-2 pr-4 text-left">Area</th>
                            <th className="py-2 pr-4 text-left">Latency</th>
                            <th className="py-2 pr-4 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {highestLatencyDevices.map(device => (
                            <tr key={device.deviceId} className="hover:bg-muted/40">
                              <td className="py-2 pr-4 font-medium text-foreground">
                                <div>{device.name}</div>
                                <p className="text-xs text-muted-foreground">{device.deviceId}</p>
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">{device.areaName}</td>
                              <td className="py-2 pr-4 font-semibold">
                                {formatLatency(device.latency)}
                                {typeof device.packetLoss === 'number' && (
                                  <span className="ml-2 text-xs text-muted-foreground">{device.packetLoss?.toFixed(1)}% loss</span>
                                )}
                              </td>
                              <td className="py-2 pr-4">
                                <Badge className={DEVICE_STATUS_TONE[device.status] || DEVICE_STATUS_TONE.unknown}>
                                  {device.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No latency samples recorded yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5" /> Critical &amp; high priority devices
                  </CardTitle>
                  <CardDescription>Visibility into the devices that impact service the most</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {criticalDevices.length > 0 ? (
                    criticalDevices.map(device => (
                      <div key={device.deviceId} className="rounded-lg border border-border/60 bg-background/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{device.name}</p>
                            <p className="text-xs text-muted-foreground">{device.areaName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                              {device.criticality}
                            </Badge>
                            <Badge className={DEVICE_STATUS_TONE[device.status] || DEVICE_STATUS_TONE.unknown}>
                              {device.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>Latency: {device.latency != null ? formatLatency(device.latency) : '—'}</span>
                          <span>
                            Packet loss:{' '}
                            {typeof device.packetLoss === 'number' ? `${device.packetLoss.toFixed(1)}%` : '—'}
                          </span>
                          <span>
                            Last seen: {device.lastChecked ? new Date(device.lastChecked).toLocaleTimeString() : 'unknown'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Mark devices as high or critical in configuration to track them here.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="areas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WifiOff className="h-5 w-5" /> Areas needing attention
                </CardTitle>
                <CardDescription>Areas with offline or degraded devices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {attentionAreas.length > 0 ? (
                  attentionAreas.map(area => (
                    <div key={area.areaId} className="rounded-lg border border-border/60 bg-background/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{area.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {area.type || 'Uncategorized'} • {area.totalDevices} devices
                          </p>
                        </div>
                        <Badge className={DEVICE_STATUS_TONE[area.status as DeviceStatusValue] || DEVICE_STATUS_TONE.unknown}>
                          {area.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-red-600 dark:text-red-400">{area.downDevices} offline</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{area.degradedDevices} degraded</span>
                        <span>{area.unknownDevices} pending</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">All areas look healthy.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LinkIcon className="h-5 w-5" /> Link status summary
                  </CardTitle>
                  <CardDescription>Current health of configured links</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <StatusPill label="Online" value={linkStatusSummary.up} tone="up" />
                    <StatusPill label="Degraded" value={linkStatusSummary.degraded} tone="degraded" />
                    <StatusPill label="Offline" value={linkStatusSummary.down} tone="down" />
                    <StatusPill label="Pending" value={linkStatusSummary.unknown} tone="unknown" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5" /> Links requiring investigation
                  </CardTitle>
                  <CardDescription>Degraded or offline links sorted by severity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {linkAttention.length > 0 ? (
                    linkAttention.map(link => (
                      <div key={link.linkId} className={`rounded-lg px-3 py-2 text-sm ${LINK_STATUS_TONE[link.status]}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{link.label}</p>
                            <p className="text-xs text-muted-foreground">
                              Path: {link.from || '—'} → {link.to || '—'}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                            {link.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Latency: {link.latency != null ? formatLatency(link.latency) : 'unknown'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No active link incidents.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

interface StatusPillProps {
  label: string
  value: number
  tone: keyof typeof LINK_STATUS_TONE
}

function StatusPill({ label, value, tone }: StatusPillProps) {
  return (
    <div className={`rounded-md px-3 py-2 ${LINK_STATUS_TONE[tone]}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
