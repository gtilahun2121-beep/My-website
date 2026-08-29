# QalNet Complete Setup Guide

This guide covers all remaining setup steps for full QalNet functionality.

## Prerequisites Installed ✓
- Node.js 20+
- npm 10+
- Dependencies: 1157 packages installed
- Builds: Backend (NestJS) and Frontend (Next.js) compiled successfully

## Current Status

### Completed ✓
- [x] Dependencies installed (npm install)
- [x] Environment files created (.env, .env.local)
- [x] JWT RSA keys generated (2048-bit pair)
- [x] TypeScript type checking passed
- [x] Backend NestJS build successful
- [x] Frontend Next.js build successful

### Still Required ⚠️
- [ ] PostgreSQL database setup
- [ ] Database schema initialization
- [ ] Admin user seeding
- [ ] Redis service configuration
- [ ] Service verification

---

## Step 1: PostgreSQL Database Setup

### Option A: Docker (Recommended)

If you have Docker installed and running:

```bash
# Start PostgreSQL and Redis with Docker Compose
docker-compose up -d

# Verify containers are running
docker ps
```

The docker-compose.yml file includes:
- **PostgreSQL 18**: Port 5432, database: qalnet_dev
- **Redis 7**: Port 6379

### Option B: Local PostgreSQL Installation (Windows)

If you prefer local installation:

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 18 (recommended)

2. **Install PostgreSQL**
   - Run installer: `postgresql-18-x64.exe`
   - Choose installation directory (e.g., `C:\Program Files\PostgreSQL\18`)
   - Set PostgreSQL password (remember this)
   - Choose port 5432 (default)
   - Install additional tools (pgAdmin is helpful)

3. **Create Development Database**
   ```bash
   # Open Command Prompt and connect to PostgreSQL
   psql -U postgres -h localhost
   
   # Create database
   CREATE DATABASE qalnet_dev;
   
   # List databases
   \l
   
   # Exit
   \q
   ```

4. **Update .env file**
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/qalnet_dev"
   ```

### Option C: Cloud PostgreSQL (Neon)

For cloud-hosted database:

1. Visit: https://console.neon.tech
2. Create account and new project
3. Copy connection string
4. Update .env:
   ```
   DATABASE_URL="postgresql://user:password@ep-xxxx.region.neon.tech/neondb"
   ```

---

## Step 2: Initialize Database Schema

Once PostgreSQL is running and connected:

```bash
# Check database connectivity
node scripts/db/dbcheck.cjs

# Expected output:
# DB OK {"db":"qalnet_dev","usr":"postgres"}
# TABLES: ...
# COUNTS {"users":0,"equbs":0,...}
```

**If connection fails:**
- Verify PostgreSQL is running: `psql --version`
- Check DATABASE_URL in .env
- Test connection: `psql -U postgres -h localhost -d qalnet_dev`

### Database Schema

The schema is automatically loaded from:
- `apps/backend/database/schema.sql` - Main schema
- `apps/backend/database/migrations/` - Migration files (001-009)

**Key tables created:**
- `users` - User profiles with encrypted Fayda IDs
- `equb_groups` - Equb (rotating savings groups) definitions
- `memberships` - User membership in groups
- `wallets` - Digital wallets for transactions
- `payments` - Payment records
- `notifications` - User notifications
- `credit_scores` - Trust/credit scoring system
- `refresh_tokens` - JWT refresh token storage
- `user_settings` - 2FA, theme preferences
- And 10+ more supporting tables

---

## Step 3: Redis Configuration

### Option A: Docker (Already started above)
Redis is included in docker-compose.yml and runs on port 6379.

### Option B: Local Redis Installation (Windows)

1. **Download Redis for Windows**
   - Option 1: Use Windows Subsystem for Linux (WSL)
     ```bash
     wsl
     sudo apt-get update
     sudo apt-get install redis-server
     redis-server
     ```
   - Option 2: Use MSOpenTech port (community maintained)
     - https://github.com/microsoftarchive/redis/releases
     - Extract and run: `redis-server.exe`

2. **Verify Redis is running**
   ```bash
   redis-cli ping
   # Expected response: PONG
   ```

3. **Update .env if needed**
   ```
   REDIS_URL="redis://localhost:6379"
   ```

---

## Step 4: Seed Admin User

After database is initialized:

```bash
# Run admin seeding script
node apps/backend/scripts/seed-admin.cjs
```

This creates an admin user with:
- Phone: +251911223344 (Ethiopian format)
- Email: admin@qalnet.local
- Password: (check seed-admin.cjs for initial password)
- Role: admin

---

## Step 5: Start Development Servers

Once all services are configured:

### Option A: Development Mode (with auto-reload)
```bash
npm run dev
```

Servers:
- Backend API: http://localhost:4000
- Frontend: http://localhost:3001
- API Docs: http://localhost:4000/api/docs

### Option B: PM2 Production Mode (with auto-restart)
```bash
npm run pm2:start       # Build and start
npm run pm2:status      # Check health
npm run pm2:logs        # View logs
npm run pm2:stop        # Stop servers
```

### Troubleshooting: Port Already in Use

If you get "EADDRINUSE" on ports 4000/3001:

```bash
# Option 1: Auto-restart dev servers (kills orphaned processes)
npm run dev:restart

# Option 2: Manual port kill (Windows)
taskkill /F /IM node.exe

# Option 3: Check which process is using port
netstat -ano | findstr :4000
taskkill /F /PID <pid>
```

---

## Step 6: Service Verification

Verify all services are running:

```bash
# Check database
node scripts/db/dbcheck.cjs

# Check Redis
redis-cli ping

# Check backend health (once running)
curl http://localhost:4000/api/docs

# Check frontend
curl http://localhost:3001
```

---

## Step 7: Testing API Endpoints

Once servers are running, test core endpoints:

```bash
# Test registration
node scripts/test-reg.cjs

# Manual API test with curl
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+251911223344",
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

---

## Environment Variables Quick Reference

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qalnet_dev
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY=<generated>
JWT_PUBLIC_KEY=<generated>
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
DEV_OTP=818959
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NODE_ENV=development
```

---

## Production Deployment Checklist

- [ ] Generate real JWT keys (already done: scripts/fix-jwt-keys.cjs)
- [ ] Set ALLOWED_ORIGINS for your production domain
- [ ] Configure real payment gateways (Chapa, Telebirr)
- [ ] Configure production SMS service (AfricasTalking API key)
- [ ] Set up production PostgreSQL (Neon recommended)
- [ ] Configure Redis for production (ElastiCache/Vercel)
- [ ] Set NODE_ENV=production in frontend
- [ ] Run type-check and build tests
- [ ] Run full test suite: npm run test
- [ ] Deploy using: npm run pm2:start or Docker

---

## Support & Troubleshooting

### Common Issues

**"DB connection refused"**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Try: `psql -U postgres -h localhost`

**"Port 4000/3001 already in use"**
- Run: `npm run dev:restart`
- Or manually kill: `taskkill /F /PID <pid>`

**"Redis connection timeout"**
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in .env

**"TypeScript errors during build"**
- Run: `npm run type-check`
- Check for missing type definitions

### Useful Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Build backend + frontend |
| `npm run type-check` | TypeScript validation |
| `npm run test` | Run test suite |
| `npm run lint` | Code linting |
| `npm run format` | Format code with Prettier |
| `npm run dev` | Start dev servers |
| `npm run dev:restart` | Restart dev after port cleanup |
| `npm run pm2:start` | Start with PM2 (production) |
| `npm run pm2:logs` | View PM2 logs |

---

## Next Steps

1. **Set up PostgreSQL** (Docker or local installation)
2. **Initialize database schema** with dbcheck.cjs
3. **Configure Redis** (included in Docker or local installation)
4. **Seed admin user** for initial login
5. **Start dev servers** with npm run dev
6. **Run tests** to verify everything works
7. **Customize for your environment** (payment gateways, SMS, etc.)

---

## Documentation Links

- Backend API: http://localhost:4000/api/docs (Swagger/OpenAPI)
- NestJS: https://docs.nestjs.com
- Next.js: https://nextjs.org/docs
- PostgreSQL: https://www.postgresql.org/docs
- Redis: https://redis.io/documentation
- Docker: https://docs.docker.com

---

*Generated: 2026-08-29 | QalNet System Setup*
