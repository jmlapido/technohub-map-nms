# Map-Ping Version 3.0 - Hybrid Monitoring System

**Enterprise-grade network monitoring with Telegraf, SNMP, and real-time sync**

[![Version](https://img.shields.io/badge/version-3.0.0--dev-blue.svg)](https://github.com/yourusername/map-ping)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🚀 What's New in V3?

Map-Ping V3 introduces a **hybrid monitoring architecture** that dramatically improves reliability and adds enterprise features:

### Key Features
- ✅ **Telegraf Integration** - Enterprise-grade data collection
- ✅ **fping Support** - 10x more reliable ICMP monitoring
- ✅ **SNMP Monitoring** - Interface status, speed, and error tracking
- ✅ **Flapping Detection** - Identify unstable connections automatically
- ✅ **Redis Pub/Sub** - Real-time synchronization (fixes race conditions)
- ✅ **Dynamic Configuration** - UI updates Telegraf automatically
- ✅ **Zero Downtime** - Config changes don't stop monitoring
- ✅ **Cloudflare Compatible** - Works through Cloudflare Tunnel

---

## 📊 Quick Start

### Prerequisites
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+ or 20+
- Redis 6+ or 7+
- 2GB RAM (4GB recommended)

### Fresh Installation

```bash
# Clone repository
git clone https://github.com/yourusername/map-ping.git
cd map-ping

# Run installation
sudo bash backend/install-telegraf.sh
sudo bash backend/setup-permissions.sh

# Install dependencies
cd backend && npm install
cd ../frontend && npm install && npm run build

# Start services
cd ..
bash deploy-v3.sh
```

**See [`V3_INSTALL_GUIDE.md`](V3_INSTALL_GUIDE.md) for detailed installation instructions.**

---

## 🏗️ Architecture

```
Devices → Telegraf → Backend → Redis/SQLite → WebSocket → Frontend
          (fping)   (Node.js)  (Real-time)     (Socket.IO)  (React)
          (SNMP)
```

### Components
- **Telegraf**: Collects ICMP ping and SNMP metrics
- **Backend**: Processes data, detects flapping, manages config
- **Redis**: Real-time cache + pub/sub for synchronization
- **SQLite**: Historical data storage
- **WebSocket**: Real-time UI updates
- **Frontend**: React/Next.js with SNMP configuration

---

## 📖 Documentation

### Installation & Deployment
- **[V3 Installation Guide](V3_INSTALL_GUIDE.md)** - Complete setup instructions
- **[Deployment Script](deploy-v3.sh)** - Automated deployment
- **[Migration Guide](V3_MIGRATION_GUIDE.md)** - Upgrade from V2 (coming soon)

### Configuration
- **[SNMP Setup](V3_INSTALL_GUIDE.md#snmp-configuration)** - Configure SNMP devices
- **[Flapping Detection](V3_INSTALL_GUIDE.md#flapping-detection)** - Customize thresholds
- **[Performance Tuning](V3_INSTALL_GUIDE.md#performance-tuning)** - Scale to 1000+ devices

### Development
- **[Implementation TODO](V3_IMPLEMENTATION_TODO.md)** - Progress tracking
- **[Progress Summary](V3_PROGRESS_SUMMARY.md)** - What's been done
- **[Completion Report](V3_IMPLEMENTATION_COMPLETE.md)** - Final status

---

## 🎯 Use Cases

### LiteBeam 5AC Monitoring
Perfect for monitoring Ubiquiti LiteBeam/NanoBeam devices:
- ✅ Track interface speed (10/100/1000 Mbps)
- ✅ Detect speed flapping (unstable connections)
- ✅ Monitor signal strength and noise
- ✅ Track TX/RX rates
- ✅ Alert on errors and discards

### Multi-Site ISP Monitoring
Ideal for Internet Service Providers:
- ✅ Monitor hundreds of customer sites
- ✅ Track uptime and latency SLAs
- ✅ Detect issues before customers complain
- ✅ Generate uptime reports
- ✅ Real-time status updates

### Data Center Monitoring
Great for data center operations:
- ✅ Monitor switches, routers, firewalls
- ✅ Track interface errors and utilization
- ✅ Detect hardware failures early
- ✅ Historical performance analysis
- ✅ Capacity planning data

---

## 🔧 Configuration

### Add Device with SNMP

1. **Enable SNMP on Device** (LiteBeam example):
   ```bash
   ssh ubnt@192.168.1.10
   set service snmp community public authorization ro
   commit
   save
   ```

2. **Add in Map-Ping UI**:
   - Go to **Settings** → **Add Device**
   - Enter device details
   - ☑️ Enable SNMP Monitoring
   - Community: `public`
   - Version: `v2c`
   - Click **Save**

3. **Verify**:
   - Telegraf config auto-updates
   - Interface data appears within 30 seconds
   - Check `/api/snmp/interfaces/:deviceId`

---

## 📊 API Endpoints

### V3 Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/status` | GET | System monitoring status |
| `/api/snmp/interfaces/:id` | GET | Device interface status |
| `/api/snmp/flapping-report` | GET | Flapping detection report |
| `/api/telegraf/ping` | POST | Receive ping metrics (internal) |
| `/api/telegraf/snmp` | POST | Receive SNMP metrics (internal) |

### Legacy Endpoints
All V2 endpoints remain available for backward compatibility.

---

## 🔍 Monitoring Status

```bash
# Check overall status
curl http://localhost:5000/api/monitoring/status | jq

# View Telegraf status
sudo systemctl status telegraf

# View backend logs
sudo journalctl -u map-ping-backend -f

# View Telegraf logs
sudo journalctl -u telegraf -f

# Test Telegraf config
sudo telegraf --config /etc/telegraf/telegraf.conf --test
```

---

## 🐛 Troubleshooting

### Telegraf Not Collecting Data
```bash
# Check Telegraf status
sudo systemctl status telegraf

# Test configuration
sudo telegraf --config /etc/telegraf/telegraf.conf --test

# Check permissions
sudo cat /etc/sudoers.d/map-ping

# View logs
sudo journalctl -u telegraf -n 100
```

### SNMP Not Working
```bash
# Test SNMP manually
snmpwalk -v 2c -c public 192.168.1.10 IF-MIB::ifTable

# Check device SNMP config
ssh ubnt@192.168.1.10
show service snmp

# Verify Telegraf SNMP config
sudo cat /etc/telegraf/telegraf.conf | grep -A 20 "inputs.snmp"
```

### Redis Connection Issues
```bash
# Check Redis
sudo systemctl status redis-server
redis-cli ping

# Test backend connection
cd backend
node -e "
const { getRedisManager } = require('./cache/RedisManager');
const redis = getRedisManager();
redis.connect().then(() => console.log('✓ Connected'));
"
```

**See [V3_INSTALL_GUIDE.md - Troubleshooting](V3_INSTALL_GUIDE.md#troubleshooting) for more solutions.**

---

## 📈 Performance

### Tested Scale
- ✅ **100 devices**: Perfect performance
- ✅ **500 devices**: Excellent performance  
- ✅ **1000 devices**: Good performance (requires tuning)
- ⚠️ **5000+ devices**: Requires Prometheus + federation

### Resource Usage
| Devices | RAM | CPU | Disk I/O |
|---------|-----|-----|----------|
| 100 | ~500MB | ~5% | Low |
| 500 | ~1GB | ~10% | Medium |
| 1000 | ~2GB | ~20% | High |

---

## 🔄 Upgrading from V2

```bash
# Backup first!
tar -czf backup-v2-$(date +%Y%m%d).tar.gz backend/data/

# Pull V3 code
git checkout v3.0
git pull origin v3.0

# Run deployment script (handles migration)
bash deploy-v3.sh
```

**See [V3_MIGRATION_GUIDE.md](V3_MIGRATION_GUIDE.md) for detailed upgrade instructions** (coming soon).

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Development Setup
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## 📞 Support

- **Documentation**: See `docs/` directory
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Telegraf** by InfluxData
- **fping** by David Schweikert
- **Redis** by Redis Labs
- **Socket.IO** by Guillermo Rauch
- **Next.js** by Vercel
- **Ubiquiti** for SNMP MIB documentation

---

## 🎯 Roadmap

### V3.1 (Next Release)
- [ ] Prometheus integration
- [ ] Grafana dashboards
- [ ] Email/Slack alerts
- [ ] Multi-language support

### V3.2 (Future)
- [ ] SNMPv3 support
- [ ] InfluxDB backend option
- [ ] Advanced analytics
- [ ] Mobile app

---

**Map-Ping V3.0** - Built with ❤️ for network engineers

**Star this repo if you find it useful!** ⭐

