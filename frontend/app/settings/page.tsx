'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { networkApi, authApi, setAuthToken, clearAuthToken, getAuthStatus, type Config, type Area, type Device, type Link } from '@/lib/api'
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
  
  // Export/Import states
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    setIsClient(true)
    checkAuthStatus()
  }, [])

  // Listen for authentication failures
  useEffect(() => {
    const handleAuthFailed = () => {
      setIsAuthenticated(false)
      setSessionExpiresAt(null)
    }

    window.addEventListener('auth-failed', handleAuthFailed)
    return () => window.removeEventListener('auth-failed', handleAuthFailed)
  }, [])

  const checkAuthStatus = async () => {
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
    } catch (err) {
      setIsAuthenticated(false)
      setSessionExpiresAt(null)
      setLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const data = await networkApi.getConfig()
      setConfig(data)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load config:', err)
      setLoading(false)
    }
  }

  const autoSaveConfig = useCallback(async () => {
    if (!config || !isAuthenticated) {
      console.log('Auto-save skipped: no config or not authenticated')
      return
    }
    
    console.log('Starting auto-save...')
    setAutoSaving(true)
    
    try {
      await networkApi.updateConfig(config)
      console.log('Auto-save successful')
      setLastSaved(new Date())
      setMessage({ type: 'success', text: '✓ Auto-saved' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err: any) {
      console.error('Auto-save error:', err)
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      })
      
      // Check if it's an authentication error
      if (err.response?.status === 401) {
        console.log('Authentication error detected, logging out')
        setMessage({ type: 'error', text: 'Session expired. Please log in again.' })
        setIsAuthenticated(false)
        setSessionExpiresAt(null)
      } else if (err.message === 'Request throttled') {
        // Don't show error for throttled requests, just skip this save
        console.log('Auto-save skipped due to throttling')
      } else {
        setMessage({ type: 'error', text: 'Auto-save failed' })
      }
    } finally {
      setAutoSaving(false)
    }
  }, [config, isAuthenticated])

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
    } catch (err) {
      setAuthError(true)
      setPasswordInput('')
      setTimeout(() => setAuthError(false), 2000)
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (err) {
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to change password' })
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

  // Link CRUD
  const openLinkModal = (link: Link | null = null) => {
    setEditingLink(link)
    setShowLinkModal(true)
  }

  const saveLink = (link: Link) => {
    if (!config) return
    
    if (editingLink) {
      // Update existing
      setConfig({
        ...config,
        links: config.links.map(l => l.id === link.id ? link : l)
      })
    } else {
      // Add new
      setConfig({ ...config, links: [...config.links, { ...link, id: `link-${Date.now()}` }] })
    }
    
    setShowLinkModal(false)
    setEditingLink(null)
  }

  const duplicateLink = (link: Link) => {
    if (!config) return
    const duplicated = {
      ...link,
      id: `link-${Date.now()}`
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
      
    } catch (err: any) {
      console.error('Import error:', err)
      setMessage({ 
        type: 'error', 
        text: err.message || 'Failed to import data' 
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
  }, [config?.areas, searchArea])

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
  }, [config?.devices, searchDevice])

  const filteredLinks = useMemo(() => {
    if (!config) return []
    return config.links.filter(link => {
      const fromArea = config.areas.find(a => a.id === link.from)
      const toArea = config.areas.find(a => a.id === link.to)
      const searchLower = searchLink.toLowerCase()
      return (
        fromArea?.name.toLowerCase().includes(searchLower) ||
        toArea?.name.toLowerCase().includes(searchLower)
      )
    })
  }, [config?.links, config?.areas, searchLink])

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
              const fromArea = config.areas.find(a => a.id === link.from)
              const toArea = config.areas.find(a => a.id === link.to)
              
              return (
                <div key={link.id} className="flex items-center gap-2 p-3 border rounded-md hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{fromArea?.name || 'Unknown'}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium truncate">{toArea?.name || 'Unknown'}</span>
                    </div>
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
      {showLinkModal && (
        <LinkModal
          link={editingLink}
          areas={config.areas}
          onSave={saveLink}
          onClose={() => {
            setShowLinkModal(false)
            setEditingLink(null)
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
    ip: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

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
function LinkModal({ link, areas, onSave, onClose }: { link: Link | null, areas: Area[], onSave: (link: Link) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<Link>(link || {
    id: '',
    from: areas[0]?.id || '',
    to: areas[1]?.id || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>{link ? 'Edit Link' : 'Add New Link'}</CardTitle>
          <CardDescription>Configure connection between areas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="link-from">From Area *</Label>
              <select
                id="link-from"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.from}
                onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="link-to">To Area *</Label>
              <select
                id="link-to"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {link ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

