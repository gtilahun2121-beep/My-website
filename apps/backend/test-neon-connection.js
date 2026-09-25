const { Client } = require('pg');
const https = require('https');

console.log('=== NEON DATABASE CONNECTION DIAGNOSTIC ===\n');

// Test different connection string variations
const connectionVariations = [
  {
    name: 'Standard (sslmode=require)',
    url: 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require'
  },
  {
    name: 'With libpq compat',
    url: 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require&uselibpqcompat=true'
  },
  {
    name: 'SSL verify-full',
    url: 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=verify-full'
  },
  {
    name: 'Direct IP (if available)',
    url: 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=disable'
  }
];

// Step 1: Test DNS resolution
console.log('STEP 1: DNS RESOLUTION TEST');
console.log('─'.repeat(50));
const dns = require('dns').promises;

(async () => {
  try {
    const addresses = await dns.resolve4('ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech');
    console.log('✓ DNS resolved successfully');
    console.log(`  IP Addresses: ${addresses.join(', ')}\n`);
  } catch (err) {
    console.error('✗ DNS resolution failed:', err.message, '\n');
  }

  // Step 2: Test each connection variation
  console.log('STEP 2: CONNECTION TESTS');
  console.log('─'.repeat(50));
  
  for (const variation of connectionVariations) {
    await testConnection(variation.name, variation.url);
  }

  console.log('\n=== DIAGNOSIS COMPLETE ===\n');
  process.exit(0);
})();

async function testConnection(name, url) {
  console.log(`\nTesting: ${name}`);
  
  const client = new Client({ 
    connectionString: url,
    // Set connection timeout
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
  });

  try {
    console.log('  Connecting...');
    await client.connect();
    
    console.log('  ✓ Connected successfully');
    
    // Query database version
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version.split(',')[0];
    console.log(`  ✓ Database: ${version}`);
    
    // Check if database is empty
    const tables = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableCount = parseInt(tables.rows[0].count);
    console.log(`  ✓ Tables: ${tableCount}`);
    
    if (tableCount === 0) {
      console.log('  ⚠️  Database is empty (needs schema initialization)');
    } else {
      console.log('  ✓ Database has schema');
    }
    
    await client.end();
    return true;
    
  } catch (err) {
    console.log(`  ✗ Connection failed: ${err.message}`);
    
    // Provide specific error diagnostics
    if (err.message.includes('SSL')) {
      console.log('    → SSL/TLS certificate issue');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.log('    → Connection refused - host may be down');
    } else if (err.message.includes('ENOTFOUND')) {
      console.log('    → Host not found - DNS issue');
    } else if (err.message.includes('ETIMEDOUT')) {
      console.log('    → Connection timeout - network issue');
    }
    
    return false;
  }
}
