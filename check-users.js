const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5433/qalnet_dev'
});

(async () => {
  try {
    await client.connect();
    console.log('Connected to LOCAL database (localhost:5433)\n');
    
    const result = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`Total users: ${result.rows[0].count}\n`);
    
    const users = await client.query(`
      SELECT 
        id, 
        email, 
        first_name,
        last_name,
        role, 
        is_active,
        created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    console.log('Recent users:\n');
    users.rows.forEach((u, i) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'No name';
      console.log(`${i+1}. ${name}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Role: ${u.role || 'participant'}`);
      console.log(`   Active: ${u.is_active}`);
      console.log(`   Created: ${new Date(u.created_at).toLocaleString()}\n`);
    });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
})();
