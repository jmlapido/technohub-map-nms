# Icons and Types Reference

## 🏢 Area Types

### Homes 🏠
- **Icon:** Home (blue)
- **Use Case:** Residential areas, home installations
- **Color:** Blue (#2563eb)

### PisoWiFi Vendo 🛒
- **Icon:** ShoppingBag (purple)
- **Use Case:** PisoWiFi vending machines, kiosks, small retail
- **Color:** Purple (#9333ea)

### Schools 🎓
- **Icon:** GraduationCap (green)
- **Use Case:** Educational institutions, campuses
- **Color:** Green (#16a34a)

## 📡 Device Types

### Wireless Antenna 📡
- **Icon:** Satellite (orange)
- **Use Case:** Ubiquiti LiteBeam, point-to-point links
- **Color:** Orange (#ea580c)
- **Examples:** LiteBeam, NanoBeam, AirMax

### WiFi SOHO Router/AP 📶
- **Icon:** Wifi (blue)
- **Use Case:** Small office/home office routers, WiFi APs
- **Color:** Blue (#2563eb)
- **Examples:** TP-Link, D-Link, consumer routers

### Router 🔌
- **Icon:** Router (green)
- **Use Case:** Network routers, switches
- **Color:** Green (#16a34a)
- **Examples:** Cisco, MikroTik, enterprise routers

### WiFi Outdoor AP 📻
- **Icon:** Radio (purple)
- **Use Case:** Outdoor access points, weatherproof APs
- **Color:** Purple (#9333ea)
- **Examples:** Ubiquiti UniFi Outdoor, TP-Link Outdoor AP

## 🎨 Icon Mapping

### Area Type Icons
```tsx
Homes           → <Home className="w-4 h-4 text-blue-600" />
PisoWiFi Vendo  → <ShoppingBag className="w-4 h-4 text-purple-600" />
Schools         → <GraduationCap className="w-4 h-4 text-green-600" />
```

### Device Type Icons
```tsx
wireless-antenna → <Satellite className="w-4 h-4 text-orange-600" />
wifi-soho        → <Wifi className="w-4 h-4 text-blue-600" />
router           → <Router className="w-4 h-4 text-green-600" />
wifi-outdoor     → <Radio className="w-4 h-4 text-purple-600" />
```

## 📊 Display Locations

### Status Page
- **Area Type Icons:** Next to area type headings
- **Device Type Icons:** Next to device names in lists
- **Grouped Display:** Areas organized by type

### Network Map Page
- **Area Type Icons:** In status panel (grouped by type)
- **Device Type Icons:** In area details panel
- **Bottom Status Panel:** Shows area types with icons

### Settings Page
- **Dropdown Selectors:** Icons shown in dropdown options
- **Visual Selection:** Easy to choose types

## 🎯 Usage Examples

### Adding a New Home Area
```json
{
  "id": "area-home-1",
  "name": "Residential Area 1",
  "type": "Homes",
  "lat": 14.5995,
  "lng": 120.9842
}
```

### Adding a Wireless Antenna Device
```json
{
  "id": "device-antenna-1",
  "areaId": "area-home-1",
  "name": "LiteBeam AC",
  "type": "wireless-antenna",
  "ip": "192.168.1.10"
}
```

### Adding a WiFi SOHO Device
```json
{
  "id": "device-wifi-1",
  "areaId": "area-home-1",
  "name": "TP-Link Router",
  "type": "wifi-soho",
  "ip": "192.168.1.1"
}
```

## 📱 Visual Hierarchy

### Status Panel (Bottom of Map)
```
┌─────────────────────────────────────────────┐
│ 🟢 3/3 Online  🔵 1 Links            [Hide] │
├─────────────────────────────────────────────┤
│ 🏠 Homes                                      │
│   🟢 Manila Office (1/1)                     │
│ 🎓 Schools                                    │
│   🟢 Cebu Office (2/2)                       │
└─────────────────────────────────────────────┘
```

### Status Page
```
┌─────────────────────────────────────────────┐
│ 🏠 Homes (1 area)                            │
├─────────────────────────────────────────────┤
│ Manila Office                        [online]│
│   🔌 Router 1 (8.8.8.8)             5ms     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🎓 Schools (1 area)                          │
├─────────────────────────────────────────────┤
│ Cebu Office                          [online]│
│   🔌 Router 2 (1.1.1.1)             8ms     │
│   📻 Router 2a (8.8.4.4)            6ms     │
└─────────────────────────────────────────────┘
```

## 🎨 Color Scheme

| Type | Icon | Color | Hex |
|------|------|-------|-----|
| **Homes** | 🏠 Home | Blue | `#2563eb` |
| **PisoWiFi Vendo** | 🛒 ShoppingBag | Purple | `#9333ea` |
| **Schools** | 🎓 GraduationCap | Green | `#16a34a` |
| **Wireless Antenna** | 📡 Satellite | Orange | `#ea580c` |
| **WiFi SOHO** | 📶 Wifi | Blue | `#2563eb` |
| **Router** | 🔌 Router | Green | `#16a34a` |
| **WiFi Outdoor** | 📻 Radio | Purple | `#9333ea` |

## 💡 Benefits

✅ **Visual Clarity** - Easy to identify types at a glance  
✅ **Better Organization** - Grouped by type for easier management  
✅ **Professional Look** - Icons make it more intuitive  
✅ **Mobile Friendly** - Icons work great on small screens  
✅ **Quick Recognition** - Color-coded for instant identification  

---

**TechnoHub Network Monitor** - Now with type-based organization! 🎯

