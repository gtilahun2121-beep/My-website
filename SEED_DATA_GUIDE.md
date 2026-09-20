# QalNet Database Seed Data Guide

**Date:** August 29, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

QalNet uses clean database initialization. There is **no test data** embedded in migrations. Instead, this guide explains how to seed real starter data for production deployment.

---

## Part 1: Database Initialization

### Step 1: Create Fresh Database

```bash
# Development
createdb qalnet_dev

# Staging
createdb qalnet_staging

# Production
createdb qalnet_production
```

### Step 2: Run Migrations

```bash
# Migrations automatically create schema from:
# apps/backend/database/schema.sql
# apps/backend/database/migrations/*.sql

npm run db:migrate

# Or manually:
psql -U qalnet_app -d qalnet_production < apps/backend/database/schema.sql
for f in apps/backend/database/migrations/*.sql; do
  psql -U qalnet_app -d qalnet_production < "$f"
done
```

### Step 3: Verify Schema

```bash
psql -U qalnet_app -d qalnet_production

# List all tables
\dt

# Check key tables exist:
SELECT table_name FROM information_schema.tables WHERE table_schema='public';

# Expected tables:
# - users
# - wallets
# - equb_groups
# - memberships
# - payments
# - payouts
# - wallet_transactions
# - notifications
```

---

## Part 2: Seeding Real Starter Data

### Option A: Manual SQL Inserts

Create initial admin user:

```sql
INSERT INTO users (
  id, first_name, last_name, phone, email, password_hash, role, is_active
) VALUES (
  gen_random_uuid(),
  'Admin',
  'QalNet',
  '+251911567890',
  'admin@qalnet.com',
  'hashed_password_here',
  'admin',
  true
);
```

### Option B: Application Setup Script

Create `scripts/seed-production.js`:

```javascript
const postgres = require('postgres');
const argon2 = require('argon2');
const crypto = require('crypto');

const sql = postgres(process.env.DATABASE_URL);

async function seedProduction() {
  console.log('🌱 Seeding production database...');

  // Create admin account
  const adminPassword = 'YourSecurePassword123!';
  const adminHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await sql`
    INSERT INTO users (
      first_name, last_name, phone, email, password_hash, role, is_active
    ) VALUES (
      'System',
      'Administrator',
      '+251911567890',
      'admin@qalnet.com',
      ${adminHash},
      'admin',
      true
    )
    RETURNING id, email;
  `;

  console.log('✓ Admin created:', admin[0].email);

  // Create admin wallet
  await sql`
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (${admin[0].id}, 0, 'ETB')
    ON CONFLICT DO NOTHING;
  `;

  console.log('✓ Admin wallet created');

  // Create preset equb templates (from previous task)
  const templates = [
    {
      name: 'Daily Equb',
      description: 'Small daily contributions',
      contribution: 300,
      rounds: 103,
      cycle_days: 1,
      type: 'daily',
    },
    {
      name: 'Weekly Equb',
      description: 'Weekly savings group',
      contribution: 2000,
      rounds: 12,
      cycle_days: 7,
      type: 'weekly',
    },
    {
      name: 'Monthly Equb',
      description: 'Monthly rotations',
      contribution: 10000,
      rounds: 6,
      cycle_days: 30,
      type: 'monthly',
    },
  ];

  for (const template of templates) {
    await sql`
      INSERT INTO equb_groups (
        host_id,
        name,
        description,
        contribution_amount,
        total_rounds,
        cycle_days,
        status,
        is_preset,
        preset_template_id
      ) VALUES (
        ${admin[0].id},
        ${template.name},
        ${template.description},
        ${template.contribution},
        ${template.rounds},
        ${template.cycle_days},
        'open',
        true,
        ${template.type}
      )
      ON CONFLICT DO NOTHING;
    `;

    console.log(`✓ Template created: ${template.name}`);
  }

  console.log('\n✅ Seed data complete!');
  console.log('\nAdministrator Account:');
  console.log(`  Email: admin@qalnet.com`);
  console.log(`  Phone: +251911567890`);
  console.log(`  Password: [set during setup]`);
  console.log(`  Role: admin`);

  await sql.end();
}

seedProduction().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
```

Run seed script:

```bash
npm run db:seed:production
```

### Option C: Use NestJS Seeder Module

Create `apps/backend/src/database/seeders/production.seeder.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Seeder } from 'typeorm-seeding';
import { DataSource } from 'typeorm';

@Injectable()
export class ProductionSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<any> {
    console.log('🌱 Running production seeder...');

    // Create admin user
    const adminUser = dataSource
      .createQueryBuilder()
      .insert()
      .into('users')
      .values({
        firstName: 'System',
        lastName: 'Administrator',
        phone: '+251911567890',
        email: 'admin@qalnet.com',
        role: 'admin',
        isActive: true,
        passwordHash: 'bcrypt_hash_here',
      })
      .orIgnore()
      .execute();

    console.log('✓ Admin account created');

    // Create wallet for admin
    await dataSource
      .createQueryBuilder()
      .insert()
      .into('wallets')
      .values({
        userId: adminUser.identifiers[0].id,
        balance: 0,
        currency: 'ETB',
      })
      .orIgnore()
      .execute();

    console.log('✓ Admin wallet created');
  }
}
```

---

## Part 3: Production Data Strategy

### What NOT to Seed

❌ **Never seed test data for production:**
- Test user accounts
- Mock equbs
- Demo transactions
- Test payments

### What TO Initialize

✅ **Only seed essential infrastructure:**

```
1. Admin Account
   - Created during deployment
   - Secure password generated
   - Email verified
   - 2FA enabled

2. System Configuration
   - Currency: ETB
   - Equb templates (optional)
   - Notification templates
   - Email templates

3. Optional: Initial Equbs
   - Seed 0-3 community equbs
   - Only if representing real entities
   - With real host information
```

---

## Part 4: Multi-Environment Seeding

### Development Seed

```bash
# With test data for development
NODE_ENV=development npm run db:seed

# Creates:
# - Admin user (+251911567890 / 4488)
# - 3 test users
# - 5 sample equbs
# - Sample transactions
```

### Staging Seed

```bash
# Minimal data, production-like
NODE_ENV=staging npm run db:seed:staging

# Creates:
# - Admin account only
# - No test data
# - No sample equbs
```

### Production Seed

```bash
# Only admin + system config
NODE_ENV=production npm run db:seed:production

# Creates:
# - Admin account
# - System settings
# - No test data
```

---

## Part 5: Initial Setup Script

Create `scripts/initial-setup.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 QalNet Initial Setup"
echo "======================="

# Check environment
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "✓ Database URL found"

# Check database exists
psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Cannot connect to database"
  exit 1
fi

echo "✓ Database connection successful"

# Run migrations
echo "Running migrations..."
npm run db:migrate

echo "✓ Migrations completed"

# Seed data
echo "Seeding starter data..."
npm run db:seed:production

echo "✓ Seed data loaded"

# Verify tables
echo "Verifying schema..."
TABLES=$(psql "$DATABASE_URL" -tc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$TABLES" -gt 10 ]; then
  echo "✓ Schema verified ($TABLES tables)"
else
  echo "❌ Schema incomplete"
  exit 1
fi

# Create admin account
echo ""
echo "📝 Create Admin Account"
echo "====================="
read -p "First Name: " ADMIN_FIRST
read -p "Last Name: " ADMIN_LAST
read -p "Email: " ADMIN_EMAIL
read -p "Phone: " ADMIN_PHONE
read -sp "PIN (4 digits): " ADMIN_PIN
echo ""

# Hash PIN
ADMIN_HASH=$(node -e "console.log(require('argon2').hashSync('${ADMIN_PIN}QN${ADMIN_PIN}!'))")

# Insert admin
psql "$DATABASE_URL" <<EOF
INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_active)
VALUES ('$ADMIN_FIRST', '$ADMIN_LAST', '$ADMIN_EMAIL', '$ADMIN_PHONE', '$ADMIN_HASH', 'admin', true)
ON CONFLICT DO NOTHING;

INSERT INTO wallets (user_id, balance, currency)
SELECT id, 0, 'ETB' FROM users WHERE email='$ADMIN_EMAIL'
ON CONFLICT DO NOTHING;
EOF

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Admin Account Created:"
echo "  Email: $ADMIN_EMAIL"
echo "  Phone: $ADMIN_PHONE"
echo "  Role: admin"
echo ""
echo "Next: Start backend and access http://localhost:3001"
```

Run setup:

```bash
chmod +x scripts/initial-setup.sh
./scripts/initial-setup.sh
```

---

## Part 6: Data Validation

### Verify Seed Data

```bash
# Count users
psql $DATABASE_URL -c "SELECT COUNT(*) as users FROM users;"

# Count equbs
psql $DATABASE_URL -c "SELECT COUNT(*) as equbs FROM equb_groups;"

# Check admin exists
psql $DATABASE_URL -c "SELECT email, role FROM users WHERE role='admin';"

# Check wallets created
psql $DATABASE_URL -c "SELECT COUNT(*) as wallets FROM wallets;"
```

### Health Check

```bash
# Start backend
npm run start:backend

# Test admin login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+251911567890",
    "pin": "4488"
  }'

# Should return valid JWT token
```

---

## Part 7: Backup Before Production

### Pre-Production Backup

```bash
# Backup clean schema
pg_dump -U qalnet_app -d qalnet_production --schema-only \
  > backups/schema_backup_$(date +%Y%m%d).sql

# Backup with seed data
pg_dump -U qalnet_app -d qalnet_production \
  > backups/full_backup_$(date +%Y%m%d).sql

# Compress
gzip backups/full_backup_*.sql

# Upload to S3
aws s3 cp backups/full_backup_*.sql.gz s3://qalnet-backups/
```

---

## Part 8: Zero-Data Migrations

If you need to migrate databases **without test data**:

```bash
# Export clean schema
pg_dump -U old_user -d old_db --schema-only \
  --exclude-table-data='*' \
  > schema_only.sql

# Create new database from schema
psql -U new_user -d new_db < schema_only.sql

# Run migrations to update schema
npm run db:migrate -- --env production

# Seed only admin
npm run db:seed:production
```

---

## Part 9: Troubleshooting

### Issue: "relation does not exist"

**Cause:** Migrations didn't run  
**Solution:**
```bash
npm run db:migrate
# Or manually:
psql $DATABASE_URL < apps/backend/database/schema.sql
```

### Issue: "duplicate key value violates unique constraint"

**Cause:** Seed data already exists  
**Solution:**
```bash
# Use ON CONFLICT DO NOTHING in inserts
# Or reset database:
dropdb qalnet_production
createdb qalnet_production
npm run db:migrate
npm run db:seed:production
```

### Issue: Admin login fails

**Cause:** PIN hashing mismatch  
**Solution:**
```bash
# Verify PIN hash format
psql $DATABASE_URL -c "SELECT password_hash FROM users WHERE role='admin';"

# Should start with $argon2id$
# If not, re-hash and update:
UPDATE users SET password_hash='new_hash' WHERE role='admin';
```

---

## Part 10: Checklist

Production database initialization checklist:

- [ ] Database created
- [ ] Migrations run successfully
- [ ] Schema verified (all tables exist)
- [ ] Admin account created with strong password
- [ ] Admin wallet initialized (0 ETB balance)
- [ ] Admin 2FA configured
- [ ] No test data in production database
- [ ] Backups taken
- [ ] Backup uploaded to secure storage
- [ ] Admin login tested
- [ ] Health check endpoint responds
- [ ] Payment gateway endpoints verified

---

## References

- Schema: `apps/backend/database/schema.sql`
- Migrations: `apps/backend/database/migrations/`
- Seed script: `scripts/seed-production.js`
- Setup script: `scripts/initial-setup.sh`
- Migration runner: `npm run db:migrate`

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Data:** Clean migrations, no test data embedded
