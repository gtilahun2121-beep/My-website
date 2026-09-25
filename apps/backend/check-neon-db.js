const { Client } = require('pg');

(async () => {
  const connectionString = 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require&uselibpqcompat=true';
  
  const c = new Client({ connectionString });
  
  try {
    console.log('Connecting to Neon...');
    await c.connect();
    console.log('✓ Connected to Neon database\n');
    
    const tables = await c.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} tables:`);
    if (tables.rows.length === 0) {
      console.log('  (empty database - needs initialization)');
    } else {
      tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
    }
    
  } catch(e) {
    console.error('✗ Error:', e.message);
  } finally {
    await c.end();
  }
})();
