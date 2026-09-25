const { Client } = require('pg');

(async () => {
  const c = new Client('postgresql://postgres:postgres@localhost:5433/qalnet_dev');
  try {
    await c.connect();
    const r = await c.query(`SELECT * FROM users LIMIT 1`);
    console.log('User table columns:', Object.keys(r.rows[0]));
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await c.end();
  }
})();
