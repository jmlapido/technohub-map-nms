/**
 * Telegraf Configuration Manager
 * 
 * Dynamically generates Telegraf configuration based on device list
 * and manages Telegraf service lifecycle.
 * 
 * @module telegraf-manager
 * @version 3.0.0
 */

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

// Configuration paths
const TELEGRAF_CONFIG_PATH = process.env.TELEGRAF_CONFIG_PATH || '/etc/telegraf/telegraf.conf';
const TELEGRAF_TEMP_PATH = path.join(__dirname, 'data', 'telegraf.conf.tmp');
const BACKEND_PORT = process.env.BACKEND_PORT || 5000;

// Telegraf control commands
const TELEGRAF_RELOAD_COMMAND = 'systemctl reload telegraf';
const TELEGRAF_RESTART_COMMAND = 'systemctl restart telegraf';
const TELEGRAF_STATUS_COMMAND = 'systemctl status telegraf';

/**
 * Generate Telegraf configuration from current device config
 * @param {Object} config - Application configuration
 * @returns {string} Telegraf configuration content
 */
function generateTelegrafConfig(config) {
  console.log('[Telegraf] Generating configuration...');
  
  const devices = config.devices || [];
  const settings = config.settings || {};
  
  // Extract ICMP ping interval from settings
  const pingInterval = settings.pingInterval || 30;
  
  // Separate devices by monitoring type
  const allDeviceIps = devices.map(d => d.ip.split(':')[0]); // All get ICMP ping
  
  // Filter SNMP-enabled devices
  const snmpDevices = devices.filter(d => d.snmpEnabled);
  
  // Group SNMP devices by community string and version
  const snmpGroups = {};
  snmpDevices.forEach(device => {
    const ip = device.ip.split(':')[0];
    const community = device.snmpCommunity || 'public';
    const version = device.snmpVersion || 2;
    const key = `${community}_v${version}`;
    
    if (!snmpGroups[key]) {
      snmpGroups[key] = {
        community,
        version,
        agents: []
      };
    }
    snmpGroups[key].agents.push(ip);
  });
  
  // Generate ICMP ping URLs list
  const pingUrls = allDeviceIps.length > 0 
    ? allDeviceIps.map(ip => `    "${ip}"`).join(',\n')
    : '    # No devices configured';
  
  // Generate SNMP input sections
  let snmpInputs = '';
  
  if (Object.keys(snmpGroups).length > 0) {
    Object.values(snmpGroups).forEach(group => {
      const agents = group.agents.map(ip => `    "${ip}"`).join(',\n');
      
      snmpInputs += `
# SNMP monitoring for devices with community "${group.community}" (v${group.version})
[[inputs.snmp]]
  agents = [
${agents}
  ]
  version = ${group.version}
  community = "${group.community}"
  interval = "${pingInterval}s"
  timeout = "10s"
  retries = 3
  
  # Device identification
  [[inputs.snmp.field]]
    name = "hostname"
    oid = "RFC1213-MIB::sysName.0"
    is_tag = true
  
  [[inputs.snmp.field]]
    name = "uptime"
    oid = "DISMAN-EVENT-MIB::sysUpTimeInstance"
  
  # Interface statistics table
  [[inputs.snmp.table]]
    name = "interface"
    inherit_tags = ["hostname"]
    
    [[inputs.snmp.table.field]]
      name = "ifIndex"
      oid = "IF-MIB::ifIndex"
      is_tag = true
    
    [[inputs.snmp.table.field]]
      name = "ifName"
      oid = "IF-MIB::ifName"
      is_tag = true
    
    [[inputs.snmp.table.field]]
      name = "ifDescr"
      oid = "IF-MIB::ifDescr"
      is_tag = true
    
    [[inputs.snmp.table.field]]
      name = "ifOperStatus"
      oid = "IF-MIB::ifOperStatus"
    
    [[inputs.snmp.table.field]]
      name = "ifAdminStatus"
      oid = "IF-MIB::ifAdminStatus"
    
    [[inputs.snmp.table.field]]
      name = "ifSpeed"
      oid = "IF-MIB::ifSpeed"
    
    [[inputs.snmp.table.field]]
      name = "ifHighSpeed"
      oid = "IF-MIB::ifHighSpeed"
    
    [[inputs.snmp.table.field]]
      name = "ifHCInOctets"
      oid = "IF-MIB::ifHCInOctets"
    
    [[inputs.snmp.table.field]]
      name = "ifHCOutOctets"
      oid = "IF-MIB::ifHCOutOctets"
    
    [[inputs.snmp.table.field]]
      name = "ifInErrors"
      oid = "IF-MIB::ifInErrors"
    
    [[inputs.snmp.table.field]]
      name = "ifOutErrors"
      oid = "IF-MIB::ifOutErrors"
    
    [[inputs.snmp.table.field]]
      name = "ifInDiscards"
      oid = "IF-MIB::ifInDiscards"
    
    [[inputs.snmp.table.field]]
      name = "ifOutDiscards"
      oid = "IF-MIB::ifOutDiscards"
  
  # Ubiquiti wireless stats (for LiteBeam, NanoBeam, etc.)
  [[inputs.snmp.table]]
    name = "ubiquiti_wireless"
    inherit_tags = ["hostname"]
    
    [[inputs.snmp.table.field]]
      name = "ubntWlStatSsid"
      oid = "1.3.6.1.4.1.41112.1.4.5.1.4"
      is_tag = true
    
    [[inputs.snmp.table.field]]
      name = "ubntWlStatSignal"
      oid = "1.3.6.1.4.1.41112.1.4.5.1.5"
    
    [[inputs.snmp.table.field]]
      name = "ubntWlStatNoiseFloor"
      oid = "1.3.6.1.4.1.41112.1.4.5.1.6"
    
    [[inputs.snmp.table.field]]
      name = "ubntWlStatTxRate"
      oid = "1.3.6.1.4.1.41112.1.4.5.1.9"
    
    [[inputs.snmp.table.field]]
      name = "ubntWlStatRxRate"
      oid = "1.3.6.1.4.1.41112.1.4.5.1.10"

`;
    });
  } else {
    snmpInputs = '# No SNMP-enabled devices configured\n';
  }
  
  // Generate complete Telegraf configuration
  const telegrafConfig = `# Telegraf Configuration for Map-Ping
# Auto-generated by map-ping backend
# Generated at: ${new Date().toISOString()}
# Total devices: ${devices.length}
# SNMP-enabled devices: ${snmpDevices.length}
# DO NOT EDIT MANUALLY - Changes will be overwritten

###############################################################################
#                            GLOBAL AGENT CONFIG                               #
###############################################################################

[agent]
  ## Default data collection interval for all inputs
  interval = "${pingInterval}s"
  
  ## Rounds collection interval to 'interval'
  round_interval = true
  
  ## Telegraf will send metrics to outputs in batches
  metric_batch_size = 1000
  
  ## Maximum number of unwritten metrics per output
  metric_buffer_limit = 10000
  
  ## Collection jitter
  collection_jitter = "0s"
  
  ## Flush interval
  flush_interval = "10s"
  flush_jitter = "0s"
  
  ## Logging
  debug = false
  quiet = false
  logfile = ""
  
  ## Hostname
  hostname = "map-ping-monitor"
  omit_hostname = false

###############################################################################
#                            INPUT PLUGINS                                     #
###############################################################################

# ICMP Ping monitoring for all devices
[[inputs.ping]]
  ## URLs to ping (all monitored devices)
  urls = [
${pingUrls}
  ]
  
  ## Method used for sending pings
  ## Can be: native, exec
  ## native: Uses Go's net.Ping (requires raw socket permissions)
  ## exec: Calls system ping command (default)
  method = "native"
  
  ## Number of ping packets to send per interval
  count = 3
  
  ## Time to wait between sending ping packets
  ping_interval = 1.0
  
  ## Timeout for each ping attempt
  timeout = 5.0
  
  ## Interface or source address to send ping from
  # interface = ""
  
  ## Percentiles to calculate
  percentiles = [50, 95, 99]
  
  ## Specify the ping binary path (auto-detected if not specified)
  ## Prefer fping if available for better performance
  # binary = "/usr/bin/fping"
  
  ## Tag all metrics with source
  [inputs.ping.tags]
    source = "map-ping"
    version = "3.0"

${snmpInputs}

###############################################################################
#                            OUTPUT PLUGINS                                    #
###############################################################################

# Send ping metrics to backend API
[[outputs.http]]
  ## URL to send metrics to
  url = "http://localhost:${BACKEND_PORT}/api/telegraf/ping"
  
  ## HTTP method
  method = "POST"
  
  ## Data format to output
  data_format = "json"
  
  ## Timeout for HTTP requests
  timeout = "5s"
  
  ## Only send ping metrics through this output
  namepass = ["ping"]

${snmpDevices.length > 0 ? `
# Send SNMP metrics to backend API
[[outputs.http]]
  ## URL to send metrics to
  url = "http://localhost:${BACKEND_PORT}/api/telegraf/snmp"
  
  ## HTTP method
  method = "POST"
  
  ## Data format to output
  data_format = "json"
  
  ## Timeout for HTTP requests
  timeout = "5s"
  
  ## Only send SNMP metrics through this output
  namepass = ["interface", "snmp", "ubiquiti_wireless"]
` : '# No SNMP outputs configured (no SNMP-enabled devices)'}

###############################################################################
#                            SERVICE INPUT PLUGINS                             #
###############################################################################

# No additional service inputs configured
`;

  return telegrafConfig;
}

/**
 * Write Telegraf configuration to file and reload service
 * @param {Object} config - Application configuration
 * @returns {Promise<Object>} Result object with success status
 */
async function updateTelegrafConfig(config) {
  try {
    console.log('[Telegraf] Updating configuration...');
    
    // Generate configuration
    const telegrafConfig = generateTelegrafConfig(config);
    
    // Ensure data directory exists
    const dataDir = path.dirname(TELEGRAF_TEMP_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write to temporary file first
    fs.writeFileSync(TELEGRAF_TEMP_PATH, telegrafConfig);
    console.log('[Telegraf] Configuration written to temporary file:', TELEGRAF_TEMP_PATH);
    
    // Validate configuration before applying
    const isValid = await validateTelegrafConfig(TELEGRAF_TEMP_PATH);
    
    if (!isValid) {
      throw new Error('Generated Telegraf configuration is invalid');
    }
    
    console.log('[Telegraf] Configuration validated successfully');
    
    // Copy to actual location (requires sudo/root permissions)
    try {
      // Try direct copy first (works if running as root)
      fs.copyFileSync(TELEGRAF_TEMP_PATH, TELEGRAF_CONFIG_PATH);
      console.log('[Telegraf] Configuration copied directly to', TELEGRAF_CONFIG_PATH);
    } catch (error) {
      // Fall back to sudo if not root
      console.log('[Telegraf] Direct copy failed, using sudo...');
      await execAsync(`sudo cp ${TELEGRAF_TEMP_PATH} ${TELEGRAF_CONFIG_PATH}`);
      console.log('[Telegraf] Configuration copied via sudo to', TELEGRAF_CONFIG_PATH);
    }
    
    // Reload Telegraf service (graceful reload, no downtime)
    await reloadTelegraf();
    
    console.log('[Telegraf] Configuration updated and service reloaded successfully');
    
    return { 
      success: true, 
      message: 'Telegraf configuration updated successfully',
      devices: config.devices.length,
      snmpDevices: config.devices.filter(d => d.snmpEnabled).length
    };
    
  } catch (error) {
    console.error('[Telegraf] Failed to update configuration:', error.message);
    return { 
      success: false, 
      error: error.message,
      details: error.stderr || error.stdout
    };
  }
}

/**
 * Validate Telegraf configuration file
 * @param {string} configPath - Path to config file to validate
 * @returns {Promise<boolean>} True if config is valid
 */
async function validateTelegrafConfig(configPath) {
  try {
    console.log('[Telegraf] Validating configuration...');
    
    // Run telegraf config test
    const { stdout, stderr } = await execAsync(
      `telegraf --config ${configPath} --test --quiet`,
      { timeout: 10000 }
    );
    
    console.log('[Telegraf] Configuration validation passed');
    return true;
    
  } catch (error) {
    console.error('[Telegraf] Configuration validation failed:', error.stderr || error.message);
    return false;
  }
}

/**
 * Reload Telegraf service gracefully
 * @returns {Promise<void>}
 */
async function reloadTelegraf() {
  try {
    console.log('[Telegraf] Reloading service...');
    
    // Try reload first (graceful, no downtime)
    try {
      await execAsync(`sudo ${TELEGRAF_RELOAD_COMMAND}`);
      console.log('[Telegraf] Service reloaded gracefully');
    } catch (reloadError) {
      // Fall back to restart if reload fails
      console.warn('[Telegraf] Reload failed, attempting restart...');
      await execAsync(`sudo ${TELEGRAF_RESTART_COMMAND}`);
      console.log('[Telegraf] Service restarted');
    }
    
  } catch (error) {
    console.error('[Telegraf] Failed to reload service:', error.message);
    throw error;
  }
}

/**
 * Check if Telegraf is installed and running
 * @returns {Promise<Object>} Status object
 */
async function checkTelegrafStatus() {
  try {
    // Check if telegraf binary exists
    try {
      await execAsync('which telegraf');
    } catch (error) {
      return { 
        installed: false, 
        running: false, 
        message: 'Telegraf is not installed'
      };
    }
    
    // Check if service is running
    const { stdout } = await execAsync(`sudo ${TELEGRAF_STATUS_COMMAND}`);
    const isRunning = stdout.includes('active (running)');
    const isActive = stdout.includes('Active: active');
    
    // Extract version
    let version = 'unknown';
    try {
      const { stdout: versionOutput } = await execAsync('telegraf version');
      const versionMatch = versionOutput.match(/Telegraf\s+([\d.]+)/);
      if (versionMatch) {
        version = versionMatch[1];
      }
    } catch (error) {
      // Version check is optional
    }
    
    return { 
      installed: true, 
      running: isRunning,
      active: isActive,
      version,
      message: isRunning ? 'Telegraf is running' : 'Telegraf is installed but not running'
    };
    
  } catch (error) {
    console.error('[Telegraf] Status check failed:', error.message);
    return { 
      installed: false, 
      running: false, 
      error: error.message,
      message: 'Unable to determine Telegraf status'
    };
  }
}

/**
 * Get Telegraf service logs
 * @param {number} lines - Number of log lines to retrieve
 * @returns {Promise<string>} Log output
 */
async function getTelegrafLogs(lines = 50) {
  try {
    const { stdout } = await execAsync(`sudo journalctl -u telegraf -n ${lines} --no-pager`);
    return stdout;
  } catch (error) {
    console.error('[Telegraf] Failed to get logs:', error.message);
    return null;
  }
}

/**
 * Test Telegraf configuration without applying
 * @param {Object} config - Application configuration to test
 * @returns {Promise<Object>} Test result
 */
async function testTelegrafConfig(config) {
  try {
    const telegrafConfig = generateTelegrafConfig(config);
    const testPath = path.join(__dirname, 'data', 'telegraf.conf.test');
    
    // Write test config
    fs.writeFileSync(testPath, telegrafConfig);
    
    // Validate
    const isValid = await validateTelegrafConfig(testPath);
    
    // Clean up test file
    fs.unlinkSync(testPath);
    
    return {
      valid: isValid,
      devices: config.devices.length,
      snmpDevices: config.devices.filter(d => d.snmpEnabled).length,
      config: telegrafConfig
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  generateTelegrafConfig,
  updateTelegrafConfig,
  validateTelegrafConfig,
  reloadTelegraf,
  checkTelegrafStatus,
  getTelegrafLogs,
  testTelegrafConfig
};


