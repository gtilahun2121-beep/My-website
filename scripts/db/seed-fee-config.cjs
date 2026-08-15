const postgres = require('postgres');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const [row] = await sql`select count(*)::int as c from fee_config`;
    if (Number(row.c) === 0) {
      await sql`
        INSERT INTO fee_config (total_fee_rate, host_commission_rate, admin_fee_rate, is_active)
        VALUES (0.001, 0.0002, 0.0008, TRUE)
      `;
      console.log('fee_config seeded: 0.1% total -> 0.02% host + 0.08% admin');
    } else {
      console.log('fee_config already has rows:', row.c);
    }
  } catch (e) {
    console.error(e.message);
  } finally {
    await sql.end();
  }
})();