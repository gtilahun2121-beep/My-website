/**
 * Register a new user on Neon database
 * 
 * This script:
 * 1. Tests connection to Neon
 * 2. Creates a new user with all required fields
 * 3. Verifies the user was created
 */

const { Client } = require('pg');
const crypto = require('crypto');

const NEON_DB = {
  connectionString: 'postgresql://neondb_owner:npg_WxgCheAR4s6d@ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// User data to register
const newUser = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@qalnet.com',
  phone: '+251911234567',
  password: 'SecurePassword123!@#',
  role: 'participant'
};

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Register New User on Neon Database               ║');
console.log('╚════════════════════════════════════════════════════╝\n');

async function main() {
  const client = new Client(NEON_DB);

  try {
    // Step 1: Test connection
    console.log('STEP 1: Connecting to Neon database...');
    await client.connect();
    console.log('✓ Connected to Neon\n');

    // Step 2: Check if user already exists
    console.log('STEP 2: Checking if user already exists...');
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [newUser.email]
    );

    if (existingUser.rowCount > 0) {
      console.log(`✗ User with email ${newUser.email} already exists`);
      console.log(`  ID: ${existingUser.rows[0].id}`);
      console.log(`  Email: ${existingUser.rows[0].email}\n`);
    } else {
      console.log(`✓ Email ${newUser.email} is available\n`);

      // Step 3: Use simple hash for demo
      console.log('STEP 3: Creating password hash...');
      const passwordHash = crypto
        .createHash('sha256')
        .update(newUser.password + 'demo')
        .digest('hex');
      console.log('✓ Password prepared\n');

      // Step 4: Create user
      console.log('STEP 4: Creating user...');
      const userId = crypto.randomUUID();
      
      const result = await client.query(
        `INSERT INTO users (
          id, first_name, last_name, email, phone, password_hash, role, 
          is_active, created_at, updated_at, verification_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), 'unverified')
        RETURNING id, email, role, created_at`,
        [
          userId,
          newUser.first_name,
          newUser.last_name,
          newUser.email,
          newUser.phone,
          passwordHash,
          newUser.role,
          true
        ]
      );

      const createdUser = result.rows[0];
      console.log('✓ User created successfully\n');

      // Step 5: Verify creation
      console.log('STEP 5: Verifying user creation...');
      const verification = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [createdUser.id]
      );

      if (verification.rowCount > 0) {
        const user = verification.rows[0];
        console.log('✓ User verified in database\n');
        
        console.log('╔════════════════════════════════════════════════════╗');
        console.log('║  USER REGISTRATION SUCCESSFUL                     ║');
        console.log('╚════════════════════════════════════════════════════╝\n');
        
        console.log('USER DETAILS:');
        console.log(`  ID:           ${user.id}`);
        console.log(`  Name:         ${user.first_name} ${user.last_name}`);
        console.log(`  Email:        ${user.email}`);
        console.log(`  Phone:        ${user.phone}`);
        console.log(`  Role:         ${user.role}`);
        console.log(`  Active:       ${user.is_active}`);
        console.log(`  Status:       ${user.verification_status}`);
        console.log(`  Created:      ${new Date(user.created_at).toLocaleString()}\n`);

        console.log('LOGIN CREDENTIALS:');
        console.log(`  Email:        ${newUser.email}`);
        console.log(`  Password:     ${newUser.password}\n`);
      }
    }

    // Step 6: Show all users
    console.log('STEP 6: Current users in Neon database:');
    const allUsers = await client.query(
      'SELECT id, first_name, last_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 15'
    );

    console.log(`\nTotal users: ${allUsers.rowCount}\n`);
    allUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.first_name} ${user.last_name} (${user.email}) - ${user.role}`);
    });

    console.log('\n✓ Operation complete!\n');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nTroubleshooting:');
    
    if (error.message.includes('ETIMEDOUT')) {
      console.error('  - Port 5432 is still blocked');
      console.error('  - Run: node test-neon-ports.js');
      console.error('  - Whitelist IP 213.55.102.49/32 in Neon dashboard');
    } else if (error.message.includes('users')) {
      console.error('  - Users table does not exist');
      console.error('  - Run migrations first: npm run db:migrate');
    } else if (error.message.includes('auth')) {
      console.error('  - Authentication failed');
      console.error('  - Check credentials in connection string');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run registration
main();
