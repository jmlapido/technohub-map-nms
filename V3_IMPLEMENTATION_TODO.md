# Map-Ping Version 3.0 - Implementation TODO

**Hybrid Monitoring Architecture: Telegraf + SNMP + Redis Pub/Sub**

## 📋 Project Overview

Version 3.0 introduces:
- ✅ Telegraf-based data collection (replacing custom ping logic)
- ✅ fping for reliable ICMP monitoring
- ✅ SNMP support for interface monitoring (LiteBeam 5AC, etc.)
- ✅ Redis pub/sub for real-time synchronization
- ✅ Flapping detection for unstable interfaces
- ✅ Dynamic Telegraf config generation from UI
- ✅ Optional Prometheus integration

---

## 🎯 PHASE 1: Core Infrastructure (Week 1-2)

### Backend: Telegraf Manager Module
- [x] Create `backend/telegraf-manager.js`
  - [x] `generateTelegrafConfig(config)` - Generate telegraf.conf from device list
  - [x] `updateTelegrafConfig(config)` - Write config and reload Telegraf
  - [x] `validateTelegrafConfig(path)` - Test config before applying
  - [x] `reloadTelegraf()` - Graceful reload without downtime
  - [x] `checkTelegrafStatus()` - Check if installed and running
  - [x] Handle ICMP ping configuration
  - [x] Handle SNMP configuration (group by community string)
  - [x] Support dynamic device lists

### Backend: Database Schema Updates
- [ ] Update `backend/database.js` with new tables:
  - [ ] `interface_history` - Store SNMP interface metrics
    - device_id, if_index, if_name, oper_status, speed_mbps, in_errors, out_errors, timestamp
  - [ ] `flapping_events` - Track speed/status changes
    - device_id, if_index, if_name, from_speed, to_speed, from_status, to_status, timestamp
  - [ ] `snmp_metrics` - General SNMP metrics storage
  - [ ] Add indexes for performance
- [ ] Create migration script for existing installations

### Backend: Redis Pub/Sub Implementation
- [ ] Update `backend/cache/RedisManager.js`
  - [ ] Add `publish(channel, message)` method
  - [ ] Add `subscribe(channel, callback)` method
  - [ ] Add `createSubscriber()` for separate subscriber connection
- [ ] Create `backend/pubsub/PubSubManager.js`
  - [ ] Device update channel: `device:update`
  - [ ] Interface update channel: `interface:update`
  - [ ] Alert channel: `alert:flapping`
  - [ ] System status channel: `system:status`

### Backend: Telegraf Data Receivers
- [ ] Create `backend/routes/telegraf-routes.js`
  - [ ] `POST /api/telegraf/ping` - Receive ICMP ping data
    - Parse Telegraf JSON format
    - Extract latency, packet_loss, alive status
    - Map IP to device ID
    - Store in Redis + SQLite
    - Publish to Redis pub/sub
  - [ ] `POST /api/telegraf/snmp` - Receive SNMP data
    - Parse interface metrics
    - Detect speed changes (flapping)
    - Store interface history
    - Publish interface updates
- [ ] Integrate with existing `storePingResult()` function

### Backend: SNMP Flapping Detection
- [ ] Create `backend/snmp/FlappingDetector.js`
  - [ ] Track interface speed history (last 100 readings)
  - [ ] Detect speed changes (10→100→10 Mbps)
  - [ ] Count changes in 10-minute window
  - [ ] Alert if >5 changes (configurable threshold)
  - [ ] Store flapping events in database
  - [ ] Emit WebSocket alerts
- [ ] Add configuration for flapping thresholds

### Backend: Update Config Management
- [ ] Modify `backend/server.js`
  - [ ] Update `POST /api/config` to call Telegraf manager
  - [ ] Add `GET /api/monitoring/status` endpoint
  - [ ] Add `GET /api/snmp/interfaces/:deviceId` endpoint
  - [ ] Add `GET /api/snmp/flapping-report` endpoint
  - [ ] Add graceful fallback if Telegraf not installed
- [ ] Keep existing monitor.js as fallback

### Backend: WebSocket Updates
- [ ] Update `backend/websocket/StatusEmitter.js`
  - [ ] Subscribe to Redis pub/sub channels
  - [ ] Add `interface:update` event type
  - [ ] Add `alert:flapping` event type
  - [ ] Broadcast interface status changes
  - [ ] Handle multiple backend instances (via Redis)

---

## 🎯 PHASE 2: Frontend Integration (Week 2-3)

### Frontend: Device Model Updates
- [ ] Update `frontend/lib/api.ts`
  - [ ] Add `snmpEnabled?: boolean` to Device interface
  - [ ] Add `snmpCommunity?: string` to Device interface
  - [ ] Add `snmpVersion?: 1 | 2 | 3` to Device interface
  - [ ] Add interface types/models
  - [ ] Add flapping report types

### Frontend: Settings Page - SNMP Fields
- [ ] Update `frontend/app/settings/page.tsx`
  - [ ] Add SNMP configuration section in device modal
    - [ ] Checkbox: Enable SNMP
    - [ ] Input: SNMP Community String
    - [ ] Select: SNMP Version (1, 2c, 3)
  - [ ] Add monitoring status card
    - [ ] Show Telegraf status (installed/running)
    - [ ] Show monitoring mode (telegraf/builtin)
    - [ ] Show total monitored devices
  - [ ] Update device save to include SNMP fields

### Frontend: WebSocket - Interface Updates
- [ ] Update `frontend/lib/useWebSocket.ts`
  - [ ] Subscribe to `interface:update` events
  - [ ] Subscribe to `alert:flapping` events
  - [ ] Handle interface status updates
  - [ ] Update device state with interface data

### Frontend: New Interface Status Component
- [ ] Create `frontend/components/InterfaceStatus.tsx`
  - [ ] Display interface list for SNMP devices
  - [ ] Show interface name (eth0, eth1, wlan0)
  - [ ] Show status (up/down)
  - [ ] Show speed (10/100/1000 Mbps)
  - [ ] Show flapping indicator
  - [ ] Show error counts
  - [ ] Real-time updates via WebSocket

### Frontend: Flapping Report Page
- [ ] Create `frontend/app/reports/flapping/page.tsx`
  - [ ] Table of devices with flapping interfaces
  - [ ] Show device name, interface, change count
  - [ ] Timeline chart of speed changes
  - [ ] Filter by time range (24h, 7d, 30d)
  - [ ] Export to CSV

### Frontend: Status Page Updates
- [ ] Update `frontend/app/status/page.tsx`
  - [ ] Add interface status indicators for SNMP devices
  - [ ] Show interface details in device card
  - [ ] Add flapping warnings

---

## 🎯 PHASE 3: Installation & Deployment (Week 3-4)

### Installation Scripts
- [ ] Create `backend/install-telegraf.sh`
  - [ ] Detect OS (Ubuntu/Debian)
  - [ ] Install Telegraf from official repo
  - [ ] Install fping
  - [ ] Set up permissions for config file
  - [ ] Create sudoers rules for reload
  - [ ] Test installation

### System Configuration
- [ ] Create `backend/setup-permissions.sh`
  - [ ] Add sudoers rules for Telegraf reload
  - [ ] Set file permissions
  - [ ] Configure systemd service

### Update Documentation
- [ ] Update `README.md` with V3 features
- [ ] Create `V3_INSTALL_GUIDE.md` (comprehensive guide)
- [ ] Create `V3_MIGRATION_GUIDE.md` (for V2 users)
- [ ] Update `TROUBLESHOOTING.md` with Telegraf issues

### GitHub Deployment Workflow
- [ ] Update `.github/workflows/deploy.yml` (if exists)
- [ ] Create deployment script for live updates
- [ ] Add database migration runner
- [ ] Add backup before update

---

## 🎯 PHASE 4: Optional Prometheus Integration (Week 4-5)

### Prometheus Metrics Exporter
- [ ] Create `backend/prometheus/MetricsExporter.js`
  - [ ] `GET /metrics` endpoint in Prometheus format
  - [ ] Export device status metrics
  - [ ] Export interface metrics
  - [ ] Export flapping counts
  - [ ] Export system stats

### Prometheus Configuration
- [ ] Create `prometheus/prometheus.yml`
  - [ ] Scrape backend /metrics
  - [ ] Configure retention
  - [ ] Add alert rules

### Alert Rules
- [ ] Create `prometheus/alerts.yml`
  - [ ] Device down alerts
  - [ ] Interface flapping alerts
  - [ ] High error rate alerts
  - [ ] Packet loss alerts

### Grafana Dashboards (Optional)
- [ ] Create dashboard JSON exports
  - [ ] Network overview dashboard
  - [ ] Device details dashboard
  - [ ] Interface monitoring dashboard
  - [ ] Flapping analysis dashboard

---

## 🎯 PHASE 5: Testing & Quality Assurance (Week 5-6)

### Unit Tests
- [ ] Test Telegraf config generation
- [ ] Test SNMP data parsing
- [ ] Test flapping detection logic
- [ ] Test Redis pub/sub
- [ ] Test database operations

### Integration Tests
- [ ] Test end-to-end device add/remove flow
- [ ] Test WebSocket updates
- [ ] Test Telegraf reload
- [ ] Test fallback to builtin monitor
- [ ] Test with actual SNMP devices

### Performance Tests
- [ ] Test with 100 devices
- [ ] Test with 500 devices
- [ ] Test with 1000 devices
- [ ] Monitor memory usage
- [ ] Monitor CPU usage
- [ ] Test Cloudflare tunnel compatibility

### Manual Testing
- [ ] Add device via UI → verify Telegraf config update
- [ ] Remove device via UI → verify Telegraf config update
- [ ] Enable SNMP on device → verify interface monitoring
- [ ] Simulate interface flapping → verify alerts
- [ ] Test with LiteBeam 5AC devices
- [ ] Test real-time updates through Cloudflare tunnel

---

## 🎯 PHASE 6: Documentation & Release (Week 6)

### User Documentation
- [ ] Quick start guide
- [ ] SNMP configuration guide
- [ ] Flapping detection explanation
- [ ] UI screenshots
- [ ] Video tutorial (optional)

### Admin Documentation
- [ ] Architecture diagram
- [ ] Component interaction flows
- [ ] Troubleshooting guide
- [ ] Performance tuning guide
- [ ] Scaling guide

### Release Preparation
- [ ] Version bump to 3.0.0
- [ ] Update changelog
- [ ] Tag release in git
- [ ] Create release notes
- [ ] Update GitHub README

---

## 📊 Progress Tracking

**Overall Progress: 60%**

- [x] Phase 1: Core Infrastructure (100%) ✅
- [ ] Phase 2: Frontend Integration (20%)
- [x] Phase 3: Installation & Deployment (90%) ✅
- [ ] Phase 4: Prometheus Integration (0%)
- [ ] Phase 5: Testing & QA (0%)
- [ ] Phase 6: Documentation & Release (50%)

---

## 🔧 Current Task

**Status:** 🔨 In Progress - Backend Complete, Frontend In Progress

**Completed:**
- ✅ Telegraf Manager Module
- ✅ Database Migration (v2-to-v3)
- ✅ Installation Scripts
- ✅ Telegraf Data Receivers
- ✅ SNMP Storage Module
- ✅ Flapping Detector
- ✅ Redis Pub/Sub Manager
- ✅ Server.js Integration
- ✅ WebSocket Pub/Sub Integration
- ✅ Deployment Script
- ✅ Documentation (Install Guide, TODO tracking)

**Next Steps:**
1. Update frontend Device model with SNMP fields
2. Add SNMP configuration UI in Settings page
3. Test V3 deployment
4. Create migration guide for V2 users

---

## 📝 Notes

### Design Decisions
- Use Telegraf for reliability over custom ping logic
- Redis pub/sub for real-time sync (solves race conditions)
- Keep SQLite for historical data (proven, reliable)
- Graceful fallback to builtin monitor if Telegraf unavailable
- Support both ICMP-only and SNMP-enabled devices

### Technical Debt
- [ ] Remove old monitor.js after V3 is stable (keep as fallback initially)
- [ ] Migrate existing ping data to new schema
- [ ] Update all API clients to use new WebSocket events

### Known Issues
- Telegraf reload requires sudo permissions (documented in install guide)
- SNMP community strings stored in plain text (consider encryption later)
- Interface flapping threshold is global (may need per-device config)

---

**Last Updated:** 2024-11-07
**Version:** 3.0.0-dev
**Status:** In Development

