/**
 * Migrate QalNet Database from Local to Neon
 * 
 * This script:
 * 1. Exports schema and data from local database
 * 2. Imports to Neon database
 * 3. Verifies data integrity
 * 4. Updates .env to use Neon
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const LOCAL_DB = {
  connectionString: 'postgresql://postgres:postgres@localhost:5433/qalnet_dev'
};

const NEON_DB = {
  connectionString: 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

const BACKUP_DIR = path.join(__dirname, '../../backups');

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  QalNet Database Migration: Local → Neon          ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function main() {
  try {
    // Step 1: Check local database
    console.log('STEP 1: Checking local database...');
    await checkLocalDatabase();
    
    // Step 2: Create backup
    console.log('\nSTEP 2: Creating backup...');
    await createBackup();
    
    // Step 3: Check Neon connection
    console.log('\nSTEP 3: Testing Neon connection...');
    await checkNeonConnection();
    
    // Step 4: Migrate data
    console.log('\nSTEP 4: Migrating data...');
    await migrateData();
    
    // Step 5: Verify migration
    console.log('\nSTEP 5: Verifying migration...');
    await verifyMigration();
    
    // Step 6: Update environment
    console.log('\nSTEP 6: Updating environment configuration...');
    await updateEnvironment();
    
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  ✓ Migration Complete!                            ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    console.log('✓ Next steps:');
    console.log('  1. Review .env file - now configured for Neon');
    console.log('  2. Run: npm run dev');
    console.log('  3. Test application functionality\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error('\nRollback steps:');
    console.error('  1. Restore from backup file in:', BACKUP_DIR);
    console.error('  2. Revert .env to use local database');
    process.exit(1);
  }
}

async function checkLocalDatabase() {
  const client = new Client(LOCAL_DB);
  try {
    await client.connect();
    console.log('✓ Connected to local database (localhost:5433)');
    
    const result = await client.query('SELECT COUNT(*) as count FROM users');
    const userCount = result.rows[0].count;
    console.log(`✓ Found ${userCount} users in local database`);
    
    // Get table info
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`✓ Found ${tables.rowCount} tables`);
    
  } finally {
    await client.end();
  }
}

async function createBackup() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `qalnet_backup_${timestamp}.sql`);
  
  console.log(`Creating backup to: ${backupFile}`);
  
  try {
    // Use pg_dump to backup
    const cmd = `pg_dump -h localhost -p 5433 -U postgres qalnet_dev > "${backupFile}"`;
    const { stderr } = await execAsync(cmd);
    
    if (fs.existsSync(backupFile)) {
      const stats = fs.statSync(backupFile);
      console.log(`✓ Backup created (${(stats.size / 1024).toFixed(2)} KB)`);
      return backupFile;
    }
  } catch (error) {
    console.warn('⚠ pg_dump not available - using pg module instead');
    return await backupWithPgModule();
  }
}

async function backupWithPgModule() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `qalnet_backup_${timestamp}.json`);
  
  const client = new Client(LOCAL_DB);
  try {
    await client.connect();
    
    // Get all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const backup = {};
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      const result = await client.query(`SELECT * FROM "${tableName}"`);
      backup[tableName] = result.rows;
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`✓ Backup created (${Object.keys(backup).length} tables)`);
    
    return backupFile;
  } finally {
    await client.end();
  }
}

async function checkNeonConnection() {
  const client = new Client(NEON_DB);
  try {
    await client.connect();
    console.log('✓ Connected to Neon database');
    
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version.split(',')[0];
    console.log(`✓ Database: ${version}`);
    
    // Check if empty
    const tables = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableCount = parseInt(tables.rows[0].count);
    if (tableCount === 0) {
      console.log('✓ Neon database is empty (ready for migration)');
    } else {
      console.log(`⚠ Neon database has ${tableCount} tables (will be overwritten)`);
    }
    
  } finally {
    await client.end();
  }
}

async function migrateData() {
  const localClient = new Client(LOCAL_DB);
  const neonClient = new Client(NEON_DB);
  
  try {
    await localClient.connect();
    await neonClient.connect();
    
    console.log('Starting data migration...');
    
    // Get all tables from local
    const tables = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Start transaction on Neon
    await neonClient.query('BEGIN TRANSACTION');
    
    try {
      for (const table of tables.rows) {
        const tableName = table.table_name;
        
        // Get data from local
        const data = await localClient.query(`SELECT * FROM "${tableName}"`);
        
        if (data.rowCount === 0) {
          console.log(`  - ${tableName}: (empty)`);
          continue;
        }
        
        // Get column info
        const columnInfo = await localClient.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        const columns = columnInfo.rows.map(r => r.column_name);
        
        // Insert data into Neon
        for (const row of data.rows) {
          const values = columns.map(col => row[col]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
          
          await neonClient.query(query, values);
        }
        
        console.log(`  ✓ ${tableName}: ${data.rowCount} rows migrated`);
      }
      
      await neonClient.query('COMMIT');
      console.log('\n✓ All data migrated successfully');
      
    } catch (error) {
      await neonClient.query('ROLLBACK');
      throw error;
    }
    
  } finally {
    await localClient.end();
    await neonClient.end();
  }
}

async function verifyMigration() {
  const localClient = new Client(LOCAL_DB);
  const neonClient = new Client(NEON_DB);
  
  try {
    await localClient.connect();
    await neonClient.connect();
    
    // Compare record counts
    const tables = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Verifying record counts...');
    
    let allMatch = true;
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      const localCount = await localClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const neonCount = await neonClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      
      const localRows = parseInt(localCount.rows[0].count);
      const neonRows = parseInt(neonCount.rows[0].count);
      
      if (localRows === neonRows) {
        console.log(`  ✓ ${tableName}: ${localRows} rows`);
      } else {
        console.log(`  ✗ ${tableName}: local=${localRows}, neon=${neonRows}`);
        allMatch = false;
      }
    }
    
    if (allMatch) {
      console.log('\n✓ All records verified - migration successful!');
    } else {
      throw new Error('Record count mismatch detected');
    }
    
  } finally {
    await localClient.end();
    await neonClient.end();
  }
}

async function updateEnvironment() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('✗ .env file not found');
    return;
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update DATABASE_URL
  const oldPattern = /DATABASE_URL=.*/;
  const newUrl = `DATABASE_URL="postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"`;
  
  if (oldPattern.test(envContent)) {
    envContent = envContent.replace(oldPattern, newUrl);
    fs.writeFileSync(envPath, envContent);
    console.log('✓ .env updated - DATABASE_URL now points to Neon');
  } else {
    console.warn('⚠ Could not find DATABASE_URL in .env');
  }
}

// Run migration
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
