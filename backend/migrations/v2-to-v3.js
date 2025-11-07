/**
 * Migration Script: V2 to V3
 * 
 * Adds new tables for SNMP monitoring and flapping detection
 * Migrates existing data to new schema
 * 
 * @version 3.0.0
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'database.sqlite');

async function runMigration() {
  console.log('========================================');
  console.log('Map-Ping V2 to V3 Database Migration');
  console.log('========================================\n');
  
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.log('✅ Fresh installation detected - creating new database');
    return runFreshInstall();
  }
  
  console.log('📦 Existing database found:', dbPath);
  console.log('📊 Starting migration...\n');
  
  try {
    const db = new Database(dbPath);
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Check current schema version
    const versionTable = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='schema_version'
    `).get();
    
    let currentVersion = 2; // Assume V2 if no version table
    
    if (versionTable) {
      const versionRow = db.prepare('SELECT version FROM schema_version ORDER BY id DESC LIMIT 1').get();
      currentVersion = versionRow ? versionRow.version : 2;
    } else {
      // Create version table
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER NOT NULL,
          description TEXT,
          migrated_at INTEGER NOT NULL
        )
      `);
      // Record V2 as starting point
      db.prepare(`
        INSERT INTO schema_version (version, description, migrated_at)
        VALUES (2, 'Initial version before V3 migration', ?)
      `).run(Date.now());
    }
    
    console.log(`📌 Current schema version: ${currentVersion}`);
    
    if (currentVersion >= 3) {
      console.log('✅ Database is already at V3 or higher');
      db.close();
      return { success: true, message: 'No migration needed' };
    }
    
    console.log('🔧 Applying V3 migrations...\n');
    
    // Migration 1: Add interface_history table
    console.log('  → Creating interface_history table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS interface_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        if_index INTEGER NOT NULL,
        if_name TEXT,
        if_descr TEXT,
        oper_status INTEGER,     -- 1=up, 2=down, 3=testing, 4=unknown, 5=dormant, 6=notPresent, 7=lowerLayerDown
        admin_status INTEGER,    -- 1=up, 2=down, 3=testing
        speed_mbps INTEGER,      -- Interface speed in Mbps
        in_octets BIGINT,        -- Bytes in
        out_octets BIGINT,       -- Bytes out
        in_errors INTEGER,       -- Input errors
        out_errors INTEGER,      -- Output errors
        in_discards INTEGER,     -- Input discards
        out_discards INTEGER,    -- Output discards
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);
    
    // Add indexes for interface_history
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_interface_device_timestamp 
        ON interface_history(device_id, if_index, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_interface_timestamp 
        ON interface_history(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_interface_device_name 
        ON interface_history(device_id, if_name);
    `);
    console.log('  ✓ interface_history table created');
    
    // Migration 2: Add flapping_events table
    console.log('  → Creating flapping_events table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS flapping_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        if_index INTEGER NOT NULL,
        if_name TEXT,
        event_type TEXT NOT NULL,   -- 'speed_change', 'status_change'
        from_speed INTEGER,
        to_speed INTEGER,
        from_status INTEGER,
        to_status INTEGER,
        severity TEXT,              -- 'info', 'warning', 'critical'
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);
    
    // Add indexes for flapping_events
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_flapping_device_timestamp 
        ON flapping_events(device_id, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_flapping_timestamp 
        ON flapping_events(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_flapping_severity 
        ON flapping_events(severity, timestamp);
    `);
    console.log('  ✓ flapping_events table created');
    
    // Migration 3: Add alerts table
    console.log('  → Creating alerts table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,          -- 'device_down', 'interface_flapping', 'high_latency', etc.
        severity TEXT NOT NULL,      -- 'info', 'warning', 'critical'
        device_id TEXT,
        if_index INTEGER,
        if_name TEXT,
        message TEXT NOT NULL,
        details TEXT,                -- JSON string with additional details
        acknowledged BOOLEAN DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);
    
    // Add indexes for alerts
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at 
        ON alerts(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_alerts_device 
        ON alerts(device_id, created_at);
      
      CREATE INDEX IF NOT EXISTS idx_alerts_severity 
        ON alerts(severity, acknowledged, created_at);
    `);
    console.log('  ✓ alerts table created');
    
    // Migration 4: Add wireless_stats table (for Ubiquiti devices)
    console.log('  → Creating wireless_stats table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS wireless_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        ssid TEXT,
        signal INTEGER,              -- Signal strength in dBm
        noise_floor INTEGER,         -- Noise floor in dBm
        tx_rate INTEGER,             -- TX rate in Mbps
        rx_rate INTEGER,             -- RX rate in Mbps
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);
    
    // Add indexes for wireless_stats
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wireless_device_timestamp 
        ON wireless_stats(device_id, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_wireless_timestamp 
        ON wireless_stats(timestamp);
    `);
    console.log('  ✓ wireless_stats table created');
    
    // Migration 5: Update schema version
    console.log('  → Updating schema version...');
    db.prepare(`
      INSERT INTO schema_version (version, description, migrated_at)
      VALUES (3, 'V3: Added SNMP monitoring, flapping detection, and alerts', ?)
    `).run(Date.now());
    console.log('  ✓ Schema version updated to 3');
    
    // Commit transaction
    db.exec('COMMIT');
    
    // Verify migration
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Current database tables:');
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });
    
    // Get table sizes
    console.log('\n📊 Table statistics:');
    const pingCount = db.prepare('SELECT COUNT(*) as count FROM ping_history').get();
    console.log(`   - ping_history: ${pingCount.count} records`);
    
    db.close();
    
    return { 
      success: true, 
      message: 'Migration completed successfully',
      version: 3
    };
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔄 Rolling back changes...');
    
    try {
      const db = new Database(dbPath);
      db.exec('ROLLBACK');
      db.close();
      console.log('✓ Rollback completed');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError.message);
    }
    
    throw error;
  }
}

async function runFreshInstall() {
  console.log('🆕 Running fresh installation...\n');
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const db = new Database(dbPath);
    
    // Create all V3 tables from scratch
    db.exec(`
      -- Schema version table
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        description TEXT,
        migrated_at INTEGER NOT NULL
      );
      
      -- Ping history (existing V2 table)
      CREATE TABLE IF NOT EXISTS ping_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        status TEXT NOT NULL,
        latency REAL,
        packet_loss REAL,
        timestamp INTEGER NOT NULL
      );
      
      -- Ping aggregates (existing V2 table)
      CREATE TABLE IF NOT EXISTS ping_aggregates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        period_type TEXT NOT NULL,
        period_start INTEGER NOT NULL,
        avg_latency REAL,
        min_latency INTEGER,
        max_latency INTEGER,
        avg_packet_loss REAL,
        uptime_percent REAL,
        ping_count INTEGER,
        down_count INTEGER,
        degraded_count INTEGER
      );
      
      -- Interface history (new in V3)
      CREATE TABLE IF NOT EXISTS interface_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        if_index INTEGER NOT NULL,
        if_name TEXT,
        if_descr TEXT,
        oper_status INTEGER,
        admin_status INTEGER,
        speed_mbps INTEGER,
        in_octets BIGINT,
        out_octets BIGINT,
        in_errors INTEGER,
        out_errors INTEGER,
        in_discards INTEGER,
        out_discards INTEGER,
        timestamp INTEGER NOT NULL
      );
      
      -- Flapping events (new in V3)
      CREATE TABLE IF NOT EXISTS flapping_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        if_index INTEGER NOT NULL,
        if_name TEXT,
        event_type TEXT NOT NULL,
        from_speed INTEGER,
        to_speed INTEGER,
        from_status INTEGER,
        to_status INTEGER,
        severity TEXT,
        timestamp INTEGER NOT NULL
      );
      
      -- Alerts (new in V3)
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        device_id TEXT,
        if_index INTEGER,
        if_name TEXT,
        message TEXT NOT NULL,
        details TEXT,
        acknowledged BOOLEAN DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at INTEGER,
        created_at INTEGER NOT NULL
      );
      
      -- Wireless stats (new in V3)
      CREATE TABLE IF NOT EXISTS wireless_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        ssid TEXT,
        signal INTEGER,
        noise_floor INTEGER,
        tx_rate INTEGER,
        rx_rate INTEGER,
        timestamp INTEGER NOT NULL
      );
      
      -- Indexes for ping_history
      CREATE INDEX IF NOT EXISTS idx_device_timestamp ON ping_history(device_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON ping_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_device_status_timestamp ON ping_history(device_id, status, timestamp);
      CREATE INDEX IF NOT EXISTS idx_status_timestamp ON ping_history(status, timestamp);
      
      -- Indexes for ping_aggregates
      CREATE INDEX IF NOT EXISTS idx_aggregates_device_period ON ping_aggregates(device_id, period_type, period_start);
      CREATE INDEX IF NOT EXISTS idx_aggregates_period_start ON ping_aggregates(period_start);
      
      -- Indexes for interface_history
      CREATE INDEX IF NOT EXISTS idx_interface_device_timestamp ON interface_history(device_id, if_index, timestamp);
      CREATE INDEX IF NOT EXISTS idx_interface_timestamp ON interface_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_interface_device_name ON interface_history(device_id, if_name);
      
      -- Indexes for flapping_events
      CREATE INDEX IF NOT EXISTS idx_flapping_device_timestamp ON flapping_events(device_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_flapping_timestamp ON flapping_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_flapping_severity ON flapping_events(severity, timestamp);
      
      -- Indexes for alerts
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity, acknowledged, created_at);
      
      -- Indexes for wireless_stats
      CREATE INDEX IF NOT EXISTS idx_wireless_device_timestamp ON wireless_stats(device_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_wireless_timestamp ON wireless_stats(timestamp);
    `);
    
    // Record initial schema version
    db.prepare(`
      INSERT INTO schema_version (version, description, migrated_at)
      VALUES (3, 'Fresh V3 installation', ?)
    `).run(Date.now());
    
    db.close();
    
    console.log('✅ Fresh installation completed successfully!');
    console.log('📌 Database created with V3 schema\n');
    
    return { 
      success: true, 
      message: 'Fresh installation completed',
      version: 3
    };
    
  } catch (error) {
    console.error('\n❌ Fresh installation failed:', error.message);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then(result => {
      console.log('\n' + '='.repeat(40));
      console.log('Migration Result:', result.message);
      console.log('='.repeat(40) + '\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n' + '='.repeat(40));
      console.error('Migration Failed:', error.message);
      console.error('='.repeat(40) + '\n');
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  runFreshInstall
};

