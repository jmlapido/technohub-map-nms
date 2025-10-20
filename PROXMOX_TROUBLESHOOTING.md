# Proxmox Container Network Troubleshooting

## Understanding the Issue

When Ubuntu runs in a Proxmox container, network access can be blocked by:
1. **Proxmox firewall** - May block incoming connections
2. **Container network configuration** - May not be bridged properly
3. **Port forwarding** - May not be configured
4. **Cloudflare tunnel** - May not be able to reach the container

## 🔍 Diagnostic Steps

### Step 1: Check Container Network Configuration

On your Proxmox host (not the container):

```bash
# Check container network settings
pct config <container-id>
```

Look for:
- **Bridge:** Should be set to a bridge (e.g., `vmbr0`)
- **IP:** Should have a proper IP address
- **Firewall:** Check if firewall is enabled

### Step 2: Test from Proxmox Host

From the Proxmox host, try to access the container:

```bash
# Test backend
curl http://CONTAINER_IP:5000/api/status

# Test frontend
curl http://CONTAINER_IP:4000
```

If this works, the container is running fine but network is blocked.

### Step 3: Check Proxmox Firewall

On Proxmox host:

```bash
# Check firewall status
pve-firewall status

# Check container firewall
pct config <container-id> | grep firewall
```

### Step 4: Test from Outside Proxmox

Try accessing from another machine on the same network:

```bash
# From another computer
curl http://192.168.101.76:5000/api/status
curl http://192.168.101.76:4000
```

## 🔧 Solutions

### Solution 1: Configure Proxmox Firewall (Recommended)

On Proxmox host, edit container configuration:

```bash
# Edit container config
pct set <container-id> -firewall 1

# Or edit via web UI:
# Datacenter → Firewall → Options → Enable firewall
```

Then add firewall rules for the container:

```bash
# Allow port 5000 (backend)
pct set <container-id> -net0 name=eth0,bridge=vmbr0,firewall=1,ip=dhcp

# Add firewall rule via web UI:
# Firewall → Container → Add Rule
# Action: ACCEPT
# Protocol: TCP
# Dest. Port: 5000, 4000
```

### Solution 2: Use Host Network Mode

This makes the container use the host's network directly:

```bash
# Edit container config
pct set <container-id> -net0 name=eth0,bridge=vmbr0,ip=dhcp,firewall=0

# Or in /etc/pve/lxc/<container-id>.conf:
net0: name=eth0,bridge=vmbr0,ip=dhcp,firewall=0
```

### Solution 3: Configure Port Forwarding

If you need to forward ports from Proxmox host to container:

```bash
# On Proxmox host, edit /etc/network/interfaces
# Add port forwarding rules

# Example for vmbr0:
up iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 5000 -j DNAT --to-destination CONTAINER_IP:5000
up iptables -t nat -A PREROUTING -i vmbr0 -p tcp --dport 4000 -j DNAT --to-destination CONTAINER_IP:4000
```

### Solution 4: Cloudflare Tunnel Configuration

If Cloudflare tunnel is running on the Proxmox host (not in container):

Edit `/etc/cloudflared/config.yml` on the Proxmox host:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Backend API - point to container IP
  - hostname: map.jmlapido.com
    path: /api/*
    service: http://CONTAINER_IP:5000
  
  # Frontend - point to container IP
  - hostname: map.jmlapido.com
    service: http://CONTAINER_IP:4000
  
  # Catch-all
  - service: http_status:404
```

Replace `CONTAINER_IP` with your container's actual IP (e.g., `192.168.101.76`).

## 🎯 Quick Fix Commands

### On Proxmox Host:

```bash
# 1. Get container ID
pct list

# 2. Get container IP
pct config <container-id> | grep ip

# 3. Test connectivity
ping CONTAINER_IP
curl http://CONTAINER_IP:5000/api/status

# 4. Check firewall
pve-firewall status

# 5. Disable firewall for testing (temporary)
pct set <container-id> -firewall 0
```

### On Ubuntu Container:

```bash
# 1. Check if services are running
pm2 status

# 2. Check if ports are listening
ss -tlnp | grep 5000
ss -tlnp | grep 4000

# 3. Test locally
curl http://localhost:5000/api/status

# 4. Check firewall
sudo ufw status

# 5. Allow ports if firewall is active
sudo ufw allow 5000/tcp
sudo ufw allow 4000/tcp
```

## 🔍 Detailed Diagnosis

### Check 1: Container Network

```bash
# On container
ip addr show
ip route show

# Should show:
# - eth0 with IP address
# - Default route to gateway
```

### Check 2: Host to Container

```bash
# On Proxmox host
ping CONTAINER_IP
telnet CONTAINER_IP 5000
telnet CONTAINER_IP 4000
```

### Check 3: Container to Host

```bash
# On container
ping GATEWAY_IP
ping 8.8.8.8
```

### Check 4: External Access

```bash
# From another machine on network
ping 192.168.101.76
curl http://192.168.101.76:5000/api/status
curl http://192.168.101.76:4000
```

## 📊 Common Proxmox Network Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Firewall Blocking** | Can't access from outside | Disable firewall or add rules |
| **Wrong Bridge** | No network at all | Configure proper bridge |
| **No IP Address** | Container has no IP | Set IP or use DHCP |
| **Port Not Open** | Services running but not accessible | Configure port forwarding |
| **Cloudflare Can't Reach** | Domain doesn't work | Point tunnel to container IP |

## 🎯 Recommended Configuration

### For Proxmox Container:

1. **Network Settings:**
   - Bridge: `vmbr0` (or your main bridge)
   - IP: Static or DHCP
   - Firewall: Disabled (or properly configured)

2. **Container Config:**
   ```bash
   # /etc/pve/lxc/<container-id>.conf
   net0: name=eth0,bridge=vmbr0,ip=dhcp,firewall=0
   ```

3. **Cloudflare Tunnel:**
   - Run on Proxmox host (not in container)
   - Point to container IP
   - Use container IP in config.yml

### For Ubuntu Container:

1. **Firewall:**
   ```bash
   sudo ufw allow 5000/tcp
   sudo ufw allow 4000/tcp
   sudo ufw allow 22/tcp
   ```

2. **Services:**
   ```bash
   pm2 status
   pm2 logs
   ```

## 🚀 Step-by-Step Fix

### Step 1: Find Container Details

```bash
# On Proxmox host
pct list
# Note the container ID and IP
```

### Step 2: Test Container Locally

```bash
# On container
pm2 status
curl http://localhost:5000/api/status
```

### Step 3: Test from Proxmox Host

```bash
# On Proxmox host
curl http://CONTAINER_IP:5000/api/status
```

### Step 4: Configure Firewall

```bash
# On Proxmox host - disable firewall for testing
pct set <container-id> -firewall 0

# Test again
curl http://CONTAINER_IP:5000/api/status
```

### Step 5: Update Cloudflare Tunnel

```bash
# On Proxmox host
nano /etc/cloudflared/config.yml

# Update with container IP
service: http://CONTAINER_IP:5000
service: http://CONTAINER_IP:4000

# Restart tunnel
sudo systemctl restart cloudflared
```

### Step 6: Test External Access

```bash
# From another machine
curl http://192.168.101.76:5000/api/status
curl https://map.jmlapido.com/api/status
```

## 🆘 Still Not Working?

1. **Check Proxmox logs:**
   ```bash
   journalctl -u pve-firewall -f
   ```

2. **Check container logs:**
   ```bash
   # On container
   pm2 logs --lines 50
   ```

3. **Check Cloudflare tunnel logs:**
   ```bash
   # On Proxmox host
   sudo journalctl -u cloudflared -f
   ```

4. **Verify network:**
   ```bash
   # On Proxmox host
   tcpdump -i vmbr0 port 5000
   ```

---

**Need help?** Run these diagnostics and share the output!

