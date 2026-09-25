const { Client } = require('pg');
const tls = require('tls');

console.log('=== NEON SSL/TLS DIAGNOSTIC ===\n');

// Test SSL connection without verification
async function testSSLConnection() {
  console.log('STEP 1: Testing with SSL verification disabled');
  console.log('─'.repeat(50));
  
  const client = new Client({
    host: 'ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech',
    port: 5432,
    user: 'neondb_owner',
    password: 'npg_WxgCheAR4s6d',
    database: 'neondb',
    ssl: {
      rejectUnauthorized: false,  // Allow self-signed certs for testing
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('Attempting connection with SSL verification disabled...\n');
    await client.connect();
    
    console.log('✓ Connection successful!\n');
    
    // Get database info
    const result = await client.query('SELECT version()');
    console.log('Database Version:');
    console.log(`  ${result.rows[0].version}\n`);
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 10
    `);
    
    console.log(`Tables found: ${tables.rowCount}`);
    if (tables.rowCount === 0) {
      console.log('✓ Database is EMPTY - needs schema initialization');
    } else {
      console.log('✓ Database has schema:');
      tables.rows.forEach(t => console.log(`    - ${t.table_name}`));
    }
    
    await client.end();
    return true;
    
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    console.error('Details:', err.code, err.errno);
    return false;
  }
}

// Test SSL certificate chain
async function testSSLCertificate() {
  console.log('\n\nSTEP 2: Testing SSL Certificate');
  console.log('─'.repeat(50));
  
  const socket = tls.connect({
    host: 'ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech',
    port: 5432,
    rejectUnauthorized: false,
  }, function() {
    console.log('✓ TLS connection established');
    
    const cert = socket.getPeerCertificate();
    console.log(`\nSSL Certificate Details:`);
    console.log(`  Subject: ${JSON.stringify(cert.subject)}`);
    console.log(`  Issuer: ${JSON.stringify(cert.issuer)}`);
    console.log(`  Valid From: ${cert.valid_from}`);
    console.log(`  Valid To: ${cert.valid_to}`);
    
    socket.destroy();
  });

  socket.on('error', function(err) {
    console.error('✗ TLS connection failed:', err.message);
  });

  // Wait for connection to complete
  return new Promise(resolve => {
    setTimeout(() => {
      socket.destroy();
      resolve();
    }, 3000);
  });
}

// Run diagnostics
(async () => {
  try {
    const connected = await testSSLConnection();
    
    if (connected) {
      await testSSLCertificate();
      console.log('\n✓ Neon database is accessible!');
      console.log('✓ Recommended connection string:');
      console.log(`  postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require`);
    }
  } catch (err) {
    console.error('Diagnostic error:', err.message);
  }
  
  process.exit(0);
})();
