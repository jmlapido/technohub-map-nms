'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { networkApi, authApi, setAuthToken, getAuthStatus, type Config, type Area, type Device, type Link, type LinkEndpoint, type LinkConnectionType, type TopologySettings } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Save, Copy, Search, ChevronDown, ChevronUp, Lock, Check, AlertCircle, Eye, EyeOff, Download, Upload } from 'lucide-react'

export default function SettingsPage() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [changePasswordData, setChangePasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Data states
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Client-side hydration flag
  const [isClient, setIsClient] = useState(false)

  // UI states
  const [searchArea, setSearchArea] = useState('')
  const [searchDevice, setSearchDevice] = useState('')
  const [searchLink, setSearchLink] = useState('')
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  
  // Modal states
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [editingLink, setEditingLink] = useState<Link | null>(null)
  const [linkDraft, setLinkDraft] = useState<Link | null>(null)
  
  // Export/Import states
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const areaMap = useMemo(() => {
    if (!config) return new Map<string, Area>()
    return new Map(config.areas.map(area => [area.id, area] as [string, Area]))
  }, [config])

  const deviceMap = useMemo(() => {
    if (!config) return new Map<string, Device>()
    return new Map(config.devices.map(device => [device.id, device] as [string, Device]))
  }, [config])

  const connectionTypeOptions = useMemo(
    () => [
      { value: 'wireless' as LinkConnectionType, label: 'Wireless / Backhaul' },
      { value: 'lan' as LinkConnectionType, label: 'LAN / Ethernet' },
      { value: 'fiber' as LinkConnectionType, label: 'Fiber' },
      { value: 'backhaul' as LinkConnectionType, label: 'Dedicated Backhaul' },
      { value: 'other' as LinkConnectionType, label: 'Other' }
    ],
    []
  )

  const loadConfig = useCallback(async () => {
    try {
      const data = await networkApi.getConfig()
      setConfig(data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load config:', error)
      setLoading(false)
    }
  }, [])

  const checkAuthStatus = useCallback(async () => {
    try {
      // First check if we have a valid token locally
      const localAuthStatus = getAuthStatus()
      
      if (localAuthStatus.isAuthenticated && localAuthStatus.tokenExpiry) {
        // We have a valid token locally, set authenticated state
        setIsAuthenticated(true)
        setSessionExpiresAt(localAuthStatus.tokenExpiry)
        loadConfig()
        return
      }
      
      // No valid token locally, try to verify with server
      const status = await authApi.getAuthStatus()
      setIsAuthenticated(status.authenticated)
      setSessionExpiresAt(new Date(status.sessionExpiresAt))
      if (status.authenticated) {
        loadConfig()
      }
    } catch {
      setIsAuthenticated(false)
      setSessionExpiresAt(null)
      setLoading(false)
    }
  }, [loadConfig])

  useEffect(() => {
    setIsClient(true)
    checkAuthStatus()
  }, [checkAuthStatus])

  // Listen for authentication failures
  useEffect(() => {
    const handleAuthFailed = () => {
      setIsAuthenticated(false)
      setSessionExpiresAt(null)
    }

    window.addEventListener('auth-failed', handleAuthFailed)
    return () => window.removeEventListener('auth-failed', handleAuthFailed)
  }, [])

  const autoSaveConfig = useCallback(async () => {
    if (!config || !isAuthenticated) {
      console.log('Auto-save skipped: no config or not authenticated')
      return
    }
    
    console.log('Starting auto-save...')
    setAutoSaving(true)
    
    try {
      const response = await networkApi.updateConfig(config)
      console.log('Auto-save successful')
      setLastSaved(new Date())
      const invalidCount = response?.invalidLinksRemoved ?? 0
      const successText = invalidCount > 0
        ? `✓ Auto-saved (removed ${invalidCount} invalid link${invalidCount === 1 ? '' : 's'})`
        : '✓ Auto-saved'
      setMessage({ type: 'success', text: successText })
      setTimeout(() => setMessage(null), 2000)
    } catch (error: unknown) {
      const apiError = ((): { message: string; status?: number } => {
        if (error && typeof error === 'object' && 'message' in error) {
          const errObj = error as { message?: string; response?: { status?: number } }
          return { message: errObj.message ?? 'Unknown error', status: errObj.response?.status }
        }
        return { message: 'Unknown error' }
      })()

      console.error('Auto-save error:', error)
      
      // Check if it's an authentication error
      if (apiError.status === 401) {
        console.log('Authentication error detected, logging out')
        setMessage({ type: 'error', text: 'Session expired. Please log in again.' })
        setIsAuthenticated(false)
        setSessionExpiresAt(null)
      } else if (apiError.message === 'Request throttled') {
        // Don't show error for throttled requests, just skip this save
        console.log('Auto-save skipped due to throttling')
      } else {
        setMessage({ type: 'error', text: 'Auto-save failed' })
      }
    } finally {
      setAutoSaving(false)
    }
  }, [config, isAuthenticated])

  const updateTopologySetting = useCallback((key: keyof TopologySettings, value: boolean) => {
    setConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        settings: {
          ...prev.settings,
          topology: {
            ...prev.settings.topology,
            [key]: value
          }
        }
      }
    })
  }, [])

  // Auto-save effect with debounce
  useEffect(() => {
    if (!config || !isAuthenticated) return
    
    const timeoutId = setTimeout(() => {
      autoSaveConfig()
    }, 5000) // Auto-save after 5 seconds of no changes

    return () => clearTimeout(timeoutId)
  }, [config, isAuthenticated, autoSaveConfig])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(false)
    
    try {
      const response = await authApi.login(passwordInput)
      setAuthToken(response.token, response.expiresAt)
      setIsAuthenticated(true)
      setSessionExpiresAt(new Date(response.expiresAt))
      setPasswordInput('')
      loadConfig()
    } catch {
      setAuthError(true)
      setPasswordInput('')
      setTimeout(() => setAuthError(false), 2000)
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore errors
    }
    setIsAuthenticated(false)
    setSessionExpiresAt(null)
    setConfig(null)
    setPasswordInput('')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }
    
    if (changePasswordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' })
      return
    }
    
    try {
      await authApi.changePassword(changePasswordData.currentPassword, changePasswordData.newPassword)
      setMessage({ type: 'success', text: 'Password changed successfully' })
      setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowChangePassword(false)
    } catch (error: unknown) {
      const apiError = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined
      setMessage({ type: 'error', text: apiError || 'Failed to change password' })
    }
  }

  // Area CRUD
  const openAreaModal = (area: Area | null = null) => {
    setEditingArea(area)
    setShowAreaModal(true)
  }

  const saveArea = (area: Area) => {
    if (!config) return
    
    if (editingArea) {
      // Update existing
      setConfig({
        ...config,
        areas: config.areas.map(a => a.id === area.id ? area : a)
      })
    } else {
      // Add new
      setConfig({ ...config, areas: [...config.areas, { ...area, id: `area-${Date.now()}` }] })
    }
    
    setShowAreaModal(false)
    setEditingArea(null)
  }

  const duplicateArea = (area: Area) => {
    if (!config) return
    const duplicated = {
      ...area,
      id: `area-${Date.now()}`,
      name: `${area.name} (Copy)`
    }
    setConfig({ ...config, areas: [...config.areas, duplicated] })
  }

  const removeArea = (id: string) => {
    if (!config) return
    if (!confirm('Delete this area? All devices in this area will also be removed.')) return
    
    setConfig({
      ...config,
      areas: config.areas.filter(a => a.id !== id),
      devices: config.devices.filter(d => d.areaId !== id)
    })
  }

  // Device CRUD
  const openDeviceModal = (device: Device | null = null) => {
    setEditingDevice(device)
    setShowDeviceModal(true)
  }

  const saveDevice = (device: Device) => {
    if (!config) return
    
    if (editingDevice) {
      // Update existing
      setConfig({
        ...config,
        devices: config.devices.map(d => d.id === device.id ? device : d)
      })
    } else {
      // Add new
      setConfig({ ...config, devices: [...config.devices, { ...device, id: `device-${Date.now()}` }] })
    }
    
    setShowDeviceModal(false)
    setEditingDevice(null)
  }

  const duplicateDevice = (device: Device) => {
    if (!config) return
    const duplicated = {
      ...device,
      id: `device-${Date.now()}`,
      name: `${device.name} (Copy)`
    }
    setConfig({ ...config, devices: [...config.devices, duplicated] })
  }

  const removeDevice = (id: string) => {
    if (!config) return
    if (!confirm('Delete this device?')) return
    setConfig({ ...config, devices: config.devices.filter(d => d.id !== id) })
  }

  // Link helpers & CRUD
  const getNormalizedEndpoints = useCallback((link: Link): [LinkEndpoint, LinkEndpoint] => {
    const base: LinkEndpoint[] = Array.isArray(link?.endpoints)
      ? link.endpoints.slice(0, 2) as LinkEndpoint[]
      : []

    while (base.length < 2) {
      base.push({} as LinkEndpoint)
    }

    return base.map((endpoint, index) => {
      const safeEndpoint = endpoint || ({} as LinkEndpoint)
      const fallbackAreaId = index === 0 ? (link.from ?? null) : (link.to ?? null)

      return {
        areaId: safeEndpoint.areaId ?? fallbackAreaId ?? null,
        deviceId: safeEndpoint.deviceId ?? null,
        interface: safeEndpoint.interface ?? undefined,
        interfaceType: safeEndpoint.interfaceType ?? link.type ?? undefined,
        label: safeEndpoint.label ?? undefined
      }
    }) as [LinkEndpoint, LinkEndpoint]
  }, [])

  const prepareLinkForEditing = useCallback((link: Link | null): Link => {
    const fallbackAreaA = config?.areas[0]?.id ?? null
    const fallbackAreaB = config?.areas[1]?.id ?? fallbackAreaA
    const baseType: LinkConnectionType | string = link?.type ?? 'wireless'
    const baseLabel = link?.label
    const baseMetadata = link?.metadata && typeof link.metadata === 'object' ? { ...link.metadata } : {}

    const fromAreaDefault = link?.from ?? link?.endpoints?.[0]?.areaId ?? fallbackAreaA
    const toAreaDefault = link?.to ?? link?.endpoints?.[1]?.areaId ?? fallbackAreaB

    const draft: Link = {
      id: link?.id ?? '',
      type: baseType,
      label: baseLabel,
      metadata: Object.keys(baseMetadata).length > 0 ? baseMetadata : undefined,
      endpoints: link?.endpoints,
      from: fromAreaDefault ?? null,
      to: toAreaDefault ?? null
    }

    const normalized = getNormalizedEndpoints(draft)

    const endpoints = normalized.map((endpoint, index) => {
      const defaultAreaId = index === 0 ? fallbackAreaA : fallbackAreaB
      const areaId = endpoint.areaId ?? defaultAreaId ?? null

      const resolvedDeviceId = (() => {
        if (!config) return endpoint.deviceId ?? null
        if (endpoint.deviceId && deviceMap.get(endpoint.deviceId)) {
          return endpoint.deviceId
        }
        if (areaId) {
          const fallbackDevice = config.devices.find(device => device.areaId === areaId)
          return fallbackDevice ? fallbackDevice.id : null
        }
        return null
      })()

      return {
        areaId,
        deviceId: resolvedDeviceId,
        interface: endpoint.interface ?? undefined,
        interfaceType: endpoint.interfaceType ?? baseType,
        label: endpoint.label ?? undefined
      }
    }) as [LinkEndpoint, LinkEndpoint]

    return {
      id: draft.id,
      type: baseType,
      label: draft.label,
      metadata: draft.metadata,
      endpoints,
      from: endpoints[0]?.areaId ?? null,
      to: endpoints[1]?.areaId ?? null
    }
  }, [config, deviceMap, getNormalizedEndpoints])

  const openLinkModal = (link: Link | null = null) => {
    if (!config) return
    const prepared = prepareLinkForEditing(link)
    setEditingLink(link)
    setLinkDraft(prepared)
    setShowLinkModal(true)
  }

  const saveLink = (link: Link) => {
    if (!config) return

    const prepared = prepareLinkForEditing(link)
    
    if (editingLink) {
      const targetId = editingLink.id
      const endpointsClone = prepared.endpoints
        ? prepared.endpoints.map(endpoint => ({ ...endpoint })) as [LinkEndpoint, LinkEndpoint]
        : undefined

      setConfig({
        ...config,
        links: config.links.map(existing =>
          existing.id === targetId
            ? {
                ...prepared,
                id: targetId,
                endpoints: endpointsClone,
                metadata: prepared.metadata && typeof prepared.metadata === 'object'
                  ? { ...prepared.metadata }
                  : prepared.metadata
              }
            : existing
        )
      })
    } else {
      const newId = `link-${Date.now()}`
      const endpointsClone = prepared.endpoints
        ? prepared.endpoints.map(endpoint => ({ ...endpoint })) as [LinkEndpoint, LinkEndpoint]
        : undefined

      setConfig({
        ...config,
        links: [
          ...config.links,
          {
            ...prepared,
            id: newId,
            endpoints: endpointsClone,
            metadata: prepared.metadata && typeof prepared.metadata === 'object'
              ? { ...prepared.metadata }
              : prepared.metadata
          }
        ]
      })
    }
    
    setShowLinkModal(false)
    setEditingLink(null)
    setLinkDraft(null)
  }

  const duplicateLink = (link: Link) => {
    if (!config) return
    const prepared = prepareLinkForEditing(link)
    const endpointsClone = prepared.endpoints
      ? prepared.endpoints.map(endpoint => ({ ...endpoint })) as [LinkEndpoint, LinkEndpoint]
      : undefined
    const duplicated = {
      ...prepared,
      id: `link-${Date.now()}`,
      label: prepared.label ? `${prepared.label} (Copy)` : prepared.label,
      endpoints: endpointsClone,
      metadata: prepared.metadata && typeof prepared.metadata === 'object'
        ? { ...prepared.metadata }
        : prepared.metadata
    }
    setConfig({ ...config, links: [...config.links, duplicated] })
  }

  const removeLink = (id: string) => {
    if (!config) return
    if (!confirm('Delete this link?')) return
    setConfig({ ...config, links: config.links.filter(l => l.id !== id) })
  }

  // Toggle area expansion
  const toggleAreaExpansion = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }

  // Export handler
  const handleExport = async () => {
    setIsExporting(true)
    setMessage(null)
    
    try {
      const blob = await networkApi.exportData()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `map-ping-backup-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      setMessage({ type: 'success', text: 'Data exported successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Export error:', err)
      setMessage({ type: 'error', text: 'Failed to export data' })
    } finally {
      setIsExporting(false)
    }
  }

  // Import handler
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.name.endsWith('.zip')) {
      setMessage({ type: 'error', text: 'Please select a valid backup file (.zip)' })
      return
    }
    
    if (!confirm('Import will replace all current data. A backup will be created. Continue?')) {
      e.target.value = ''
      return
    }
    
    setIsImporting(true)
    setMessage(null)
    
    try {
      const result = await networkApi.importData(file)
      
      setMessage({ type: 'success', text: result.message || 'Data imported successfully!' })
      
      // Reload config after import
      setTimeout(() => {
        loadConfig()
        setMessage(null)
      }, 2000)
      
    } catch (error: unknown) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Failed to import data'
      console.error('Import error:', error)
      setMessage({ 
        type: 'error', 
        text: message 
      })
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  // Filtered and grouped data
  const filteredAreas = useMemo(() => {
    if (!config) return []
    return config.areas.filter(area =>
      area.name.toLowerCase().includes(searchArea.toLowerCase()) ||
      area.type.toLowerCase().includes(searchArea.toLowerCase())
    )
  }, [config, searchArea])

  const groupedDevices = useMemo(() => {
    if (!config) return new Map<string, Device[]>()
    
    const grouped = new Map<string, Device[]>()
    
    config.devices
      .filter(device =>
        device.name.toLowerCase().includes(searchDevice.toLowerCase()) ||
        device.ip.toLowerCase().includes(searchDevice.toLowerCase()) ||
        device.type.toLowerCase().includes(searchDevice.toLowerCase())
      )
      .forEach(device => {
        const areaId = device.areaId
        if (!grouped.has(areaId)) {
          grouped.set(areaId, [])
        }
        grouped.get(areaId)!.push(device)
      })
    
    return grouped
  }, [config, searchDevice])

  const filteredLinks = useMemo(() => {
    if (!config) return []
      const searchLower = searchLink.toLowerCase()

    return config.links.filter(link => {
      const endpoints = getNormalizedEndpoints(link)
      const searchableValues: string[] = []

      endpoints.forEach(endpoint => {
        if (endpoint.areaId) {
          const area = areaMap.get(endpoint.areaId)
          if (area?.name) {
            searchableValues.push(area.name)
          }
        }
        if (endpoint.deviceId) {
          const device = deviceMap.get(endpoint.deviceId)
          if (device?.name) {
            searchableValues.push(device.name)
          }
        }
        if (endpoint.interface) {
          searchableValues.push(endpoint.interface)
        }
        if (endpoint.label) {
          searchableValues.push(endpoint.label)
        }
      })

      if (link.label) {
        searchableValues.push(link.label)
      }

      if (link.type) {
        searchableValues.push(String(link.type))
      }

      if (!searchLower) {
        return true
      }

      return searchableValues.some(value => value?.toLowerCase().includes(searchLower))
    })
  }, [config, areaMap, deviceMap, searchLink, getNormalizedEndpoints])

  // Password screen - only render after client hydration
  if (!isClient || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Settings Access</CardTitle>
            <CardDescription>Enter password to access settings</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={isClient && showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    className={isClient && authError ? 'border-red-500' : ''}
                    autoFocus={isClient}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authError && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Incorrect password
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full">
                Unlock Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No configuration available</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 lg:p-6">
      {/* Header */}
      <div className="mb-4 lg:mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2">Settings</h1>
            <p className="text-sm lg:text-base text-muted-foreground">Configure your network monitoring</p>
            {sessionExpiresAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Session expires: {sessionExpiresAt.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowChangePassword(true)}
              variant="outline"
              size="sm"
            >
              Change Password
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 lg:p-4 rounded-md text-sm lg:text-base flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Areas Section */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <CardTitle className="text-lg lg:text-xl">Areas ({filteredAreas.length})</CardTitle>
                <CardDescription className="text-xs lg:text-sm">Network sites and locations</CardDescription>
              </div>
              <Button onClick={() => openAreaModal()} size="sm" className="w-full lg:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Area
              </Button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search areas..."
                value={searchArea}
                onChange={(e) => setSearchArea(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-4 lg:p-6 pt-0">
          {filteredAreas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No areas found</p>
          ) : (
            filteredAreas.map((area) => (
              <div key={area.id} className="flex items-center gap-2 p-3 border rounded-md hover:bg-accent/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{area.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{area.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openAreaModal(area)}
                    className="h-8 w-8"
                    title="Edit"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicateArea(area)}
                    className="h-8 w-8"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArea(area.id)}
                    className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Devices Section - Grouped by Area */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <CardTitle className="text-lg lg:text-xl">Devices ({config.devices.length})</CardTitle>
                <CardDescription className="text-xs lg:text-sm">Network devices grouped by area</CardDescription>
              </div>
              <Button onClick={() => openDeviceModal()} size="sm" className="w-full lg:w-auto" disabled={config.areas.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchDevice}
                onChange={(e) => setSearchDevice(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 lg:p-6 pt-0">
          {config.areas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Add an area first to create devices</p>
          ) : (
            config.areas.map((area) => {
              const devicesInArea: Device[] = groupedDevices.get(area.id) || []
              const isExpanded = expandedAreas.has(area.id)

              return (
                <div key={area.id} className="border rounded-md overflow-hidden">
                  {/* Area Header */}
                  <div className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors">
                    <button
                      onClick={() => toggleAreaExpansion(area.id)}
                      className="flex items-center gap-2 flex-1"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      <span className="font-medium">{area.name}</span>
                      <Badge variant="secondary" className="text-xs">{devicesInArea.length} devices</Badge>
                    </button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        const newDevice: Device = {
                          id: '',
                          areaId: area.id,
                          name: '',
                          type: 'router',
                          ip: ''
                        }
                        openDeviceModal(newDevice)
                      }}
                      size="sm"
                      variant="outline"
                      className="ml-2 shrink-0"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add device for {area.name}
                    </Button>
                  </div>

                  {/* Devices List */}
                  {isExpanded && (
                    <div className="border-t bg-accent/10">
                      {devicesInArea.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-4">No devices in this area</p>
                      ) : (
                        <div className="divide-y">
                          {devicesInArea.map((device: Device) => (
                            <div key={device.id} className="flex items-center gap-2 p-3 hover:bg-background transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{device.name}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">{device.type}</Badge>
                                  {device.criticality && (
                                    <Badge 
                                      variant={device.criticality === 'critical' ? 'destructive' : 
                                               device.criticality === 'high' ? 'default' : 
                                               device.criticality === 'normal' ? 'secondary' : 'outline'}
                                      className="text-xs shrink-0"
                                    >
                                      {device.criticality === 'critical' ? '🔴 Critical' :
                                       device.criticality === 'high' ? '🟠 High' :
                                       device.criticality === 'normal' ? '🟡 Normal' : '🟢 Low'}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">IP: {device.ip}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDeviceModal(device)}
                                  className="h-8 w-8"
                                  title="Edit"
                                >
                                  <Search className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => duplicateDevice(device)}
                                  className="h-8 w-8"
                                  title="Duplicate"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeDevice(device.id)}
                                  className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Links Section */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <CardTitle className="text-lg lg:text-xl">Links ({filteredLinks.length})</CardTitle>
                <CardDescription className="text-xs lg:text-sm">Connections between areas</CardDescription>
              </div>
              <Button onClick={() => openLinkModal()} size="sm" className="w-full lg:w-auto" disabled={config.areas.length < 2}>
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search links..."
                value={searchLink}
                onChange={(e) => setSearchLink(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-4 lg:p-6 pt-0">
          {config.areas.length < 2 ? (
            <p className="text-center text-muted-foreground py-8">Add at least 2 areas to create links</p>
          ) : filteredLinks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No links found</p>
          ) : (
            filteredLinks.map((link) => {
              const endpoints = getNormalizedEndpoints(link)
              const [endpointA, endpointB] = endpoints

              const areaA = endpointA.areaId ? areaMap.get(endpointA.areaId) : null
              const areaB = endpointB.areaId ? areaMap.get(endpointB.areaId) : null
              const deviceA = endpointA.deviceId ? deviceMap.get(endpointA.deviceId) : null
              const deviceB = endpointB.deviceId ? deviceMap.get(endpointB.deviceId) : null

              const typeLabel = link.type
                ? connectionTypeOptions.find(option => option.value === link.type)?.label || String(link.type)
                : null
              
              return (
                <div key={link.id} className="flex flex-col gap-2 p-3 border rounded-md hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">
                        {link.label || `${deviceA?.name || areaA?.name || 'Endpoint A'} ↔ ${deviceB?.name || areaB?.name || 'Endpoint B'}`}
                      </span>
                      {typeLabel && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {typeLabel}
                        </Badge>
                      )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openLinkModal(link)}
                      className="h-8 w-8"
                      title="Edit"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateLink(link)}
                      className="h-8 w-8"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLink(link.id)}
                      className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
                    {[{ endpoint: endpointA, area: areaA, device: deviceA, label: 'Endpoint A' }, { endpoint: endpointB, area: areaB, device: deviceB, label: 'Endpoint B' }].map(({ endpoint, area, device, label }) => (
                      <div key={label} className="flex flex-col gap-1">
                        <span className="font-semibold text-muted-foreground/80">{label}</span>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {area?.name || 'Select area'}
                          </Badge>
                          {device?.name && (
                            <Badge variant="outline" className="text-[10px]">
                              {device.name}
                            </Badge>
                          )}
                          {endpoint.interface && (
                            <Badge variant="outline" className="text-[10px]">
                              {endpoint.interface}
                            </Badge>
                          )}
                          {endpoint.label && (
                            <Badge variant="outline" className="text-[10px]">
                              {endpoint.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Monitoring Settings */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-lg lg:text-xl">Monitoring Settings</CardTitle>
          <CardDescription className="text-xs lg:text-sm">Configure ping intervals and thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6 pt-0">
          <div>
            <Label>Ping Interval (seconds)</Label>
            <Input
              type="number"
              value={config.settings.pingInterval}
              onChange={(e) => {
                setConfig({
                  ...config,
                  settings: {
                    ...config.settings,
                    pingInterval: parseInt(e.target.value)
                  }
                })
              }}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Good Latency (ms)</Label>
              <Input
                type="number"
                value={config.settings.thresholds.latency.good}
                onChange={(e) => {
                  setConfig({
                    ...config,
                    settings: {
                      ...config.settings,
                      thresholds: {
                        ...config.settings.thresholds,
                        latency: {
                          ...config.settings.thresholds.latency,
                          good: parseInt(e.target.value)
                        }
                      }
                    }
                  })
                }}
              />
            </div>
            <div>
              <Label>Degraded Latency (ms)</Label>
              <Input
                type="number"
                value={config.settings.thresholds.latency.degraded}
                onChange={(e) => {
                  setConfig({
                    ...config,
                    settings: {
                      ...config.settings,
                      thresholds: {
                        ...config.settings.thresholds,
                        latency: {
                          ...config.settings.thresholds.latency,
                          degraded: parseInt(e.target.value)
                        }
                      }
                    }
                  })
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Topology Settings */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-lg lg:text-xl">Topology Display</CardTitle>
          <CardDescription className="text-xs lg:text-sm">
            Control how area topology renders on the status page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6 pt-0">
          <div className="flex items-start gap-3">
            <input
              id="topology-remote"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-input"
              checked={config.settings.topology.showRemoteAreas}
              onChange={(e) => updateTopologySetting('showRemoteAreas', e.target.checked)}
            />
            <div className="space-y-1">
              <Label htmlFor="topology-remote" className="text-sm font-semibold">Show remote area nodes</Label>
              <p className="text-xs text-muted-foreground">
                Display neighbouring areas and remote devices connected to the selected site.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="topology-latency"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-input"
              checked={config.settings.topology.showLinkLatency}
              onChange={(e) => updateTopologySetting('showLinkLatency', e.target.checked)}
            />
            <div className="space-y-1">
              <Label htmlFor="topology-latency" className="text-sm font-semibold">Show latency badges on links</Label>
              <p className="text-xs text-muted-foreground">
                Keep latency badges visible on each hop for quick performance checks.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="topology-compact"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-input"
              checked={config.settings.topology.preferCompactLayout}
              onChange={(e) => updateTopologySetting('preferCompactLayout', e.target.checked)}
            />
            <div className="space-y-1">
              <Label htmlFor="topology-compact" className="text-sm font-semibold">Compact link rows</Label>
              <p className="text-xs text-muted-foreground">
                Reduce spacing for dense areas so more paths fit on screen without scrolling.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="topology-unlinked"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-input"
              checked={config.settings.topology.autoIncludeUnlinkedDevices}
              onChange={(e) => updateTopologySetting('autoIncludeUnlinkedDevices', e.target.checked)}
            />
            <div className="space-y-1">
              <Label htmlFor="topology-unlinked" className="text-sm font-semibold">Display unlinked devices</Label>
              <p className="text-xs text-muted-foreground">
                Surface devices without topology assignments so you can link them quickly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export/Import Settings */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-lg lg:text-xl">Backup & Restore</CardTitle>
          <CardDescription className="text-xs lg:text-sm">
            Export your data for backup or import from a previous backup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 lg:p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Export Data</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Download a backup file containing your database and configuration
              </p>
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
                className="w-full"
                variant="outline"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </div>

            {/* Import Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Import Data</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Restore from a backup file (current data will be backed up)
              </p>
              <div className="relative">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleImport}
                  disabled={isImporting}
                  className="hidden"
                  id="import-file"
                />
                <Button 
                  onClick={() => document.getElementById('import-file')?.click()}
                  disabled={isImporting}
                  className="w-full"
                  variant="outline"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <p><strong>Export:</strong> Creates a ZIP file with your database and settings</p>
                <p><strong>Import:</strong> Restores from a backup. Your current data will be automatically backed up first</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Area Modal */}
      {showAreaModal && (
        <AreaModal
          area={editingArea}
          onSave={saveArea}
          onClose={() => {
            setShowAreaModal(false)
            setEditingArea(null)
          }}
        />
      )}

      {/* Device Modal */}
      {showDeviceModal && (
        <DeviceModal
          device={editingDevice}
          areas={config.areas}
          onSave={saveDevice}
          onClose={() => {
            setShowDeviceModal(false)
            setEditingDevice(null)
          }}
        />
      )}

      {/* Link Modal */}
      {showLinkModal && linkDraft && (
        <LinkModal
          link={linkDraft}
          areas={config.areas}
          devices={config.devices}
          connectionTypeOptions={connectionTypeOptions}
          onSave={saveLink}
          onClose={() => {
            setShowLinkModal(false)
            setEditingLink(null)
            setLinkDraft(null)
          }}
        />
      )}

      {/* Floating Auto-save Notification */}
      {(autoSaving || (lastSaved && !autoSaving)) && (
        <div className="fixed bottom-4 right-4 z-[9999] transform transition-all duration-300 ease-in-out">
          {autoSaving && (
            <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-pulse border border-blue-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm font-medium">Auto-saving...</span>
            </div>
          )}
          {lastSaved && !autoSaving && (
            <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 transform transition-all duration-300 ease-in-out border border-green-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Saved {new Date(lastSaved).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowChangePassword(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your settings password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="current-password">Current Password *</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={changePasswordData.currentPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, currentPassword: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">New Password *</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={changePasswordData.newPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Password must be at least 6 characters long</p>
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm New Password *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={changePasswordData.confirmPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Change Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Area Modal Component
function AreaModal({ area, onSave, onClose }: { area: Area | null, onSave: (area: Area) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<Area>(area || {
    id: '',
    name: '',
    type: 'Homes',
    lat: 14.5995,
    lng: 120.9842
  })
  const [coordinatesInput, setCoordinatesInput] = useState(area ? `${area.lat}, ${area.lng}` : '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleCoordinatesPaste = (value: string) => {
    setCoordinatesInput(value)
    
    // Parse coordinates from format "lat, lng" or "lat,lng"
    const parts = value.split(',').map(part => part.trim())
    if (parts.length === 2) {
      const lat = parseFloat(parts[0])
      const lng = parseFloat(parts[1])
      
      if (!isNaN(lat) && !isNaN(lng)) {
        setFormData(prev => ({ ...prev, lat, lng }))
      }
    }
  }

  const handleLatChange = (value: number) => {
    setFormData(prev => {
      setCoordinatesInput(`${value}, ${prev.lng}`)
      return { ...prev, lat: value }
    })
  }

  const handleLngChange = (value: number) => {
    setFormData(prev => {
      setCoordinatesInput(`${prev.lat}, ${value}`)
      return { ...prev, lng: value }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>{area ? 'Edit Area' : 'Add New Area'}</CardTitle>
          <CardDescription>Configure area location and type</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="area-name">Name *</Label>
              <Input
                id="area-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Office"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="area-type">Type *</Label>
              <select
                id="area-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Area['type'] })}
              >
                <option value="Homes">🏠 Homes</option>
                <option value="PisoWiFi Vendo">🛒 PisoWiFi Vendo</option>
                <option value="Schools">🎓 Schools</option>
                <option value="Server/Relay">📡 Server/Relay</option>
              </select>
            </div>

            <div>
              <Label htmlFor="coordinates">Coordinates (Quick Paste) *</Label>
              <Input
                id="coordinates"
                value={coordinatesInput}
                onChange={(e) => handleCoordinatesPaste(e.target.value)}
                placeholder="e.g., 6.514039071296758, 124.64302483013414"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste coordinates in format: latitude, longitude
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="area-lat">Latitude *</Label>
                <Input
                  id="area-lat"
                  type="number"
                  step="0.0001"
                  value={formData.lat}
                  onChange={(e) => handleLatChange(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="area-lng">Longitude *</Label>
                <Input
                  id="area-lng"
                  type="number"
                  step="0.0001"
                  value={formData.lng}
                  onChange={(e) => handleLngChange(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {area ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Device Modal Component
function DeviceModal({ device, areas, onSave, onClose }: { device: Device | null, areas: Area[], onSave: (device: Device) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<Device>(device || {
    id: '',
    areaId: areas[0]?.id || '',
    name: '',
    type: 'router',
    ip: '',
    criticality: 'normal'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const criticalityOptions = [
    { value: 'critical', label: '🔴 Critical (30s)', description: 'Mission-critical devices' },
    { value: 'high', label: '🟠 High (1m)', description: 'Important devices' },
    { value: 'normal', label: '🟡 Normal (2m)', description: 'Standard devices' },
    { value: 'low', label: '🟢 Low (5m)', description: 'Non-critical devices' }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>{device ? 'Edit Device' : 'Add New Device'}</CardTitle>
          <CardDescription>Configure device details and location</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="device-name">Name *</Label>
              <Input
                id="device-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Router"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="device-type">Type *</Label>
              <select
                id="device-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Device['type'] })}
              >
                <option value="wireless-antenna">📡 Wireless Antenna</option>
                <option value="wifi-soho">📶 WiFi SOHO Router/AP</option>
                <option value="router">🔌 Router</option>
                <option value="wifi-outdoor">📻 WiFi Outdoor AP</option>
              </select>
            </div>

            <div>
              <Label htmlFor="device-ip">IP Address *</Label>
              <Input
                id="device-ip"
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                placeholder="e.g., 192.168.1.1"
                required
              />
            </div>

            <div>
              <Label htmlFor="device-area">Area *</Label>
              <select
                id="device-area"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.areaId}
                onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="device-criticality">Criticality Level *</Label>
              <select
                id="device-criticality"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.criticality || 'normal'}
                onChange={(e) => setFormData({ ...formData, criticality: e.target.value as Device['criticality'] })}
              >
                {criticalityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {criticalityOptions.find(opt => opt.value === (formData.criticality || 'normal'))?.description}
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {device ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Link Modal Component
function LinkModal({
  link,
  areas,
  devices,
  connectionTypeOptions,
  onSave,
  onClose
}: {
  link: Link
  areas: Area[]
  devices: Device[]
  connectionTypeOptions: { value: LinkConnectionType | string, label: string }[]
  onSave: (link: Link) => void
  onClose: () => void
}) {
  const ensureTwoEndpoints = useCallback((endpoints?: LinkEndpoint[]): [LinkEndpoint, LinkEndpoint] => {
    const normalized = Array.isArray(endpoints) ? endpoints.slice(0, 2) : []
    while (normalized.length < 2) {
      normalized.push({ areaId: null, deviceId: null })
    }
    return normalized.map(endpoint => ({
      areaId: endpoint?.areaId ?? null,
      deviceId: endpoint?.deviceId ?? null,
      interface: endpoint?.interface ?? undefined,
      interfaceType: endpoint?.interfaceType ?? undefined,
      label: endpoint?.label ?? undefined
    })) as [LinkEndpoint, LinkEndpoint]
  }, [])

  const buildInitialForm = useCallback((): Link => {
    const defaultAreaA = link.from ?? link.endpoints?.[0]?.areaId ?? areas[0]?.id ?? null
    const defaultAreaB = link.to ?? link.endpoints?.[1]?.areaId ?? areas[1]?.id ?? defaultAreaA
    const baseType = link.type ?? 'wireless'

    const endpoints = ensureTwoEndpoints(link.endpoints)

    const resolvedEndpoints = endpoints.map((endpoint, index) => {
      const targetAreaId = endpoint.areaId ?? (index === 0 ? defaultAreaA : defaultAreaB) ?? null
      const devicesForArea = targetAreaId ? devices.filter(device => device.areaId === targetAreaId) : []
      const existingDevice = endpoint.deviceId && devicesForArea.some(device => device.id === endpoint.deviceId)
        ? endpoint.deviceId
        : devicesForArea[0]?.id ?? null

      return {
        areaId: targetAreaId,
        deviceId: existingDevice,
        interface: endpoint.interface ?? undefined,
        interfaceType: endpoint.interfaceType ?? baseType,
        label: endpoint.label ?? undefined
      }
    }) as [LinkEndpoint, LinkEndpoint]

    return {
      id: link.id ?? '',
      label: link.label,
      type: baseType,
      metadata: link.metadata,
      endpoints: resolvedEndpoints,
      from: resolvedEndpoints[0]?.areaId ?? null,
      to: resolvedEndpoints[1]?.areaId ?? null
    }
  }, [areas, devices, ensureTwoEndpoints, link])

  const [formData, setFormData] = useState<Link>(buildInitialForm)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFormData(buildInitialForm())
    setError(null)
  }, [buildInitialForm])

  const handleTypeChange = (newType: LinkConnectionType | string) => {
    setFormData(prev => {
      const endpoints = ensureTwoEndpoints(prev.endpoints).map(endpoint => ({
        ...endpoint,
        interfaceType: !endpoint.interfaceType || endpoint.interfaceType === prev.type ? newType : endpoint.interfaceType
      })) as [LinkEndpoint, LinkEndpoint]
      return {
        ...prev,
        type: newType,
        endpoints
      }
    })
  }

  const handleEndpointAreaChange = (index: number, areaId: string) => {
    setFormData(prev => {
      const endpoints = ensureTwoEndpoints(prev.endpoints)
      const newAreaId = areaId || null
      const devicesForArea = newAreaId ? devices.filter(device => device.areaId === newAreaId) : []
      const currentEndpoint = endpoints[index]
      const isDeviceValid = currentEndpoint.deviceId && devicesForArea.some(device => device.id === currentEndpoint.deviceId)
      const newDeviceId = isDeviceValid ? currentEndpoint.deviceId : devicesForArea[0]?.id ?? null

      const updatedEndpoint: LinkEndpoint = {
        ...currentEndpoint,
        areaId: newAreaId,
        deviceId: newDeviceId
      }

      const updatedEndpoints = endpoints.map((endpoint, idx) => (idx === index ? updatedEndpoint : endpoint)) as [LinkEndpoint, LinkEndpoint]

      return {
        ...prev,
        endpoints: updatedEndpoints,
        from: updatedEndpoints[0]?.areaId ?? null,
        to: updatedEndpoints[1]?.areaId ?? null
      }
    })
  }

  const handleEndpointDeviceChange = (index: number, deviceId: string) => {
    setFormData(prev => {
      const endpoints = ensureTwoEndpoints(prev.endpoints)
      const updatedEndpoints = endpoints.map((endpoint, idx) => (
        idx === index
          ? { ...endpoint, deviceId: deviceId || null }
          : endpoint
      )) as [LinkEndpoint, LinkEndpoint]

      return {
        ...prev,
        endpoints: updatedEndpoints
      }
    })
  }

  const handleEndpointFieldChange = (index: number, updates: Partial<LinkEndpoint>) => {
    setFormData(prev => {
      const endpoints = ensureTwoEndpoints(prev.endpoints)
      const updatedEndpoints = endpoints.map((endpoint, idx) => (
        idx === index
          ? { ...endpoint, ...updates }
          : endpoint
      )) as [LinkEndpoint, LinkEndpoint]

      return {
        ...prev,
        endpoints: updatedEndpoints
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const endpoints = ensureTwoEndpoints(formData.endpoints)

    if (endpoints.some(endpoint => !endpoint.areaId)) {
      setError('Please select an area for both endpoints.')
      return
    }

    const sanitizedEndpoints = endpoints.map(endpoint => ({
      areaId: endpoint.areaId,
      deviceId: endpoint.deviceId || null,
      interface: endpoint.interface?.trim() ? endpoint.interface.trim() : undefined,
      interfaceType: endpoint.interfaceType || formData.type || undefined,
      label: endpoint.label?.trim() ? endpoint.label.trim() : undefined
    })) as [LinkEndpoint, LinkEndpoint]

    const submission: Link = {
      ...formData,
      label: formData.label?.toString().trim() ? formData.label.toString().trim() : undefined,
      endpoints: sanitizedEndpoints,
      from: sanitizedEndpoints[0]?.areaId ?? null,
      to: sanitizedEndpoints[1]?.areaId ?? null
    }

    onSave(submission)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>{link.id ? 'Edit Link' : 'Add New Link'}</CardTitle>
          <CardDescription>Connect specific devices and interfaces across areas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <Label htmlFor="link-label">Link Label</Label>
                <Input
                  id="link-label"
                  value={formData.label ?? ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Main Backhaul"
                />
              </div>
              <div>
                <Label htmlFor="link-type">Connection Type</Label>
              <select
                  id="link-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.type ?? ''}
                  onChange={(e) => handleTypeChange(e.target.value as LinkConnectionType)}
              >
                  {connectionTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ensureTwoEndpoints(formData.endpoints).map((endpoint, index) => {
                const isFirst = index === 0
                const areaOptions = areas
                const selectedAreaId = endpoint.areaId ?? ''
                const devicesForArea = endpoint.areaId ? devices.filter(device => device.areaId === endpoint.areaId) : []

                return (
                  <div key={index} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{isFirst ? 'Endpoint A' : 'Endpoint B'}</span>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {endpoint.interfaceType || formData.type || 'link'}
                      </Badge>
                    </div>

                    <div className="space-y-2">
            <div>
                        <Label>Area *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={selectedAreaId}
                          onChange={(e) => handleEndpointAreaChange(index, e.target.value)}
              >
                          <option value="">Select area</option>
                          {areaOptions.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

                      <div>
                        <Label>Device</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                          value={endpoint.deviceId ?? ''}
                          onChange={(e) => handleEndpointDeviceChange(index, e.target.value)}
                          disabled={!endpoint.areaId || devicesForArea.length === 0}
                        >
                          <option value="">{endpoint.areaId ? 'Select device' : 'Select an area first'}</option>
                          {devicesForArea.map(device => (
                            <option key={device.id} value={device.id}>{device.name}</option>
                          ))}
                        </select>
                        {endpoint.areaId && devicesForArea.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">No devices available in this area yet.</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Interface Type</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={endpoint.interfaceType ?? ''}
                            onChange={(e) => handleEndpointFieldChange(index, { interfaceType: e.target.value || undefined })}
                          >
                            <option value="">Use link type ({formData.type})</option>
                            {connectionTypeOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label>Interface Name</Label>
                          <Input
                            value={endpoint.interface ?? ''}
                            onChange={(e) => handleEndpointFieldChange(index, { interface: e.target.value })}
                            placeholder={isFirst ? 'e.g., Wireless Uplink' : 'e.g., LAN Port 1'}
                          />
                        </div>
                        <div>
                          <Label>Interface Label</Label>
                          <Input
                            value={endpoint.label ?? ''}
                            onChange={(e) => handleEndpointFieldChange(index, { label: e.target.value })}
                            placeholder="Optional display tag"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {link.id ? 'Update Link' : 'Create Link'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

