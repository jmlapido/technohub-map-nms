'use client'

import { useEffect, useState } from 'react'
import { networkApi, type Config } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Save, Home, ShoppingBag, GraduationCap, Router, Wifi, Radio, Satellite } from 'lucide-react'

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

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

  const saveConfig = async () => {
    if (!config) return
    
    setSaving(true)
    setMessage(null)
    
    try {
      await networkApi.updateConfig(config)
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const addArea = () => {
    if (!config) return
    const newArea = {
      id: `area-${Date.now()}`,
      name: 'New Area',
      type: 'Homes' as const,
      lat: 14.5995,
      lng: 120.9842
    }
    setConfig({ ...config, areas: [...config.areas, newArea] })
  }

  const removeArea = (id: string) => {
    if (!config) return
    setConfig({
      ...config,
      areas: config.areas.filter(a => a.id !== id),
      devices: config.devices.filter(d => d.areaId !== id)
    })
  }

  const addDevice = () => {
    if (!config || config.areas.length === 0) return
    const newDevice = {
      id: `device-${Date.now()}`,
      areaId: config.areas[0].id,
      name: 'New Device',
      type: 'router' as const,
      ip: '192.168.1.1'
    }
    setConfig({ ...config, devices: [...config.devices, newDevice] })
  }

  const removeDevice = (id: string) => {
    if (!config) return
    setConfig({ ...config, devices: config.devices.filter(d => d.id !== id) })
  }

  const addLink = () => {
    if (!config || config.areas.length < 2) return
    const newLink = {
      id: `link-${Date.now()}`,
      from: config.areas[0].id,
      to: config.areas[1].id
    }
    setConfig({ ...config, links: [...config.links, newLink] })
  }

  const removeLink = (id: string) => {
    if (!config) return
    setConfig({ ...config, links: config.links.filter(l => l.id !== id) })
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
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2">Settings</h1>
        <p className="text-sm lg:text-base text-muted-foreground">Configure your network monitoring</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 lg:p-4 rounded-md text-sm lg:text-base ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Areas */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="text-lg lg:text-xl">Areas</CardTitle>
              <CardDescription className="text-xs lg:text-sm">Define network sites/locations</CardDescription>
            </div>
            <Button onClick={addArea} size="sm" className="w-full lg:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Area
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6 pt-0">
          {config.areas.map((area, idx) => (
            <div key={area.id} className="flex gap-4 items-start p-4 border rounded-md">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={area.name}
                      onChange={(e) => {
                        const newAreas = [...config.areas]
                        newAreas[idx].name = e.target.value
                        setConfig({ ...config, areas: newAreas })
                      }}
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={area.type}
                      onChange={(e) => {
                        const newAreas = [...config.areas]
                        newAreas[idx].type = e.target.value as 'Homes' | 'PisoWiFi Vendo' | 'Schools'
                        setConfig({ ...config, areas: newAreas })
                      }}
                    >
                      <option value="Homes">🏠 Homes</option>
                      <option value="PisoWiFi Vendo">🛒 PisoWiFi Vendo</option>
                      <option value="Schools">🎓 Schools</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={area.lat}
                      onChange={(e) => {
                        const newAreas = [...config.areas]
                        newAreas[idx].lat = parseFloat(e.target.value)
                        setConfig({ ...config, areas: newAreas })
                      }}
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={area.lng}
                      onChange={(e) => {
                        const newAreas = [...config.areas]
                        newAreas[idx].lng = parseFloat(e.target.value)
                        setConfig({ ...config, areas: newAreas })
                      }}
                    />
                  </div>
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeArea(area.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Devices */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="text-lg lg:text-xl">Devices</CardTitle>
              <CardDescription className="text-xs lg:text-sm">Network devices to monitor</CardDescription>
            </div>
            <Button onClick={addDevice} size="sm" className="w-full lg:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6 pt-0">
          {config.devices.map((device, idx) => (
            <div key={device.id} className="flex gap-4 items-start p-4 border rounded-md">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={device.name}
                      onChange={(e) => {
                        const newDevices = [...config.devices]
                        newDevices[idx].name = e.target.value
                        setConfig({ ...config, devices: newDevices })
                      }}
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={device.type}
                      onChange={(e) => {
                        const newDevices = [...config.devices]
                        newDevices[idx].type = e.target.value as 'wireless-antenna' | 'wifi-soho' | 'router' | 'wifi-outdoor'
                        setConfig({ ...config, devices: newDevices })
                      }}
                    >
                      <option value="wireless-antenna">📡 Wireless Antenna</option>
                      <option value="wifi-soho">📶 WiFi SOHO Router/AP</option>
                      <option value="router">🔌 Router</option>
                      <option value="wifi-outdoor">📻 WiFi Outdoor AP</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>IP Address</Label>
                    <Input
                      value={device.ip}
                      onChange={(e) => {
                        const newDevices = [...config.devices]
                        newDevices[idx].ip = e.target.value
                        setConfig({ ...config, devices: newDevices })
                      }}
                    />
                  </div>
                  <div>
                    <Label>Area</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={device.areaId}
                      onChange={(e) => {
                        const newDevices = [...config.devices]
                        newDevices[idx].areaId = e.target.value
                        setConfig({ ...config, devices: newDevices })
                      }}
                    >
                      {config.areas.map(area => (
                        <option key={area.id} value={area.id}>{area.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeDevice(device.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Links */}
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="text-lg lg:text-xl">Links</CardTitle>
              <CardDescription className="text-xs lg:text-sm">Connections between areas</CardDescription>
            </div>
            <Button onClick={addLink} size="sm" className="w-full lg:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6 pt-0">
          {config.links.map((link, idx) => (
            <div key={link.id} className="flex gap-4 items-center p-4 border rounded-md">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <Label>From</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={link.from}
                    onChange={(e) => {
                      const newLinks = [...config.links]
                      newLinks[idx].from = e.target.value
                      setConfig({ ...config, links: newLinks })
                    }}
                  >
                    {config.areas.map(area => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>To</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={link.to}
                    onChange={(e) => {
                      const newLinks = [...config.links]
                      newLinks[idx].to = e.target.value
                      setConfig({ ...config, links: newLinks })
                    }}
                  >
                    {config.areas.map(area => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeLink(link.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

