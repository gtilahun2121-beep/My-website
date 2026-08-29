# QalNet - Quick Start Guide

**Get QalNet running in 5-15 minutes**

## 🚀 Option 1: Quick Start (No Database)

Perfect for exploring the frontend without setting up a database.

```bash
npm run dev
```

✅ Frontend: http://localhost:3001  
⚠️ Backend API: Not available (no database)

**Time:** 2 minutes

---

## 🐳 Option 2: Full Stack with Docker (Recommended)

Complete setup with PostgreSQL and Redis in containers.

```bash
# 1. Start database and cache
docker-compose -f docker-compose-lite.yml up -d

# 2. Wait 10 seconds for services to start
# 3. Initialize database
node scripts/db/dbcheck.cjs

# 4. Seed admin user
node apps/backend/scripts/seed-admin.cjs

# 5. Start application
npm run dev
```

✅ Frontend: http://localhost:3001  
✅ Backend: http://localhost:4000  
✅ API Docs: http://localhost:4000/api/docs  

**Admin Credentials:**
- Phone: +251904556677
- PIN: 4488
- Email: danel@qalnet.com

**Time:** 10 minutes

---

## 💻 Option 3: Local PostgreSQL

For developers who have PostgreSQL installed locally.

```bash
# 1. Ensure PostgreSQL is running
psql --version

# 2. Create database
psql -U postgres -c "CREATE DATABASE qalnet_dev;"

# 3. Initialize schema
.\scripts\db\init-db.ps1

# 4. Seed admin
node apps/backend/scripts/seed-admin.cjs

# 5. Start Redis (if available)
redis-server

# 6. Start application
npm run dev
```

**Time:** 15 minutes

---

## ☁️ Option 4: Cloud Database (Fastest)

```bash
# 1. Create account at https://console.neon.tech
# 2. Create new project
# 3. Copy connection string
# 4. Update DATABASE_URL in apps/backend/.env
# 5. Start services
npm run dev
```

**Time:** 5 minutes

---

## 🎯 What to Do After Starting

### 1. Login to Frontend
- Visit: http://localhost:3001
- Click "Login"
- Use admin credentials (see above)

### 2. Explore Features
- **Dashboard:** View overview
- **Equbs:** Create or join groups
- **Wallet:** Check balance
- **Admin:** Manage users and approvals

### 3. Test API
- **API Docs:** http://localhost:4000/api/docs
- Try endpoints with "Try it out" buttons
- Or use curl:

```bash
# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251904556677","pin":"4488"}'

# Get users
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/users
```

### 4. Monitor Services
```bash
# View logs
npm run pm2:logs

# Check status
npm run pm2:status
```

---

## 📋 Useful Commands

```bash
# Development
npm run dev              # Start dev servers
npm run dev:restart      # Fix port conflicts

# Building
npm run build            # Build all
npm run type-check       # Check types

# Testing
.\scripts\check-system.ps1   # Verify system
.\scripts\test-api.ps1       # Test API

# Database
node scripts/db/dbcheck.cjs              # Check connection
node apps/backend/scripts/seed-admin.cjs # Seed admin

# Production
npm run pm2:start     # Start with PM2
npm run pm2:stop      # Stop
npm run pm2:logs      # View logs
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
npm run dev:restart
```

### Database Connection Failed
```bash
node scripts/db/dbcheck.cjs
```

### Docker Containers Not Starting
```bash
docker-compose -f docker-compose-lite.yml logs
```

### Build Errors
```bash
npm run clean
npm install
npm run build
```

### Redis Not Found
Redis is optional. If not available:
1. Install via Docker: `docker run -d -p 6379:6379 redis`
2. Or skip for development mode

---

## 📚 Documentation

For detailed information, see:
- **Complete Setup:** [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **API Reference:** [API_TESTING.md](./API_TESTING.md)
- **System Status:** [SYSTEM_STATUS.md](./SYSTEM_STATUS.md)
- **Deployment:** [DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md)

---

## 🎓 First Time Users

1. **Start with Option 2** (Docker - takes 10 minutes)
2. **Login with admin credentials** to explore
3. **Create a test Equb** to understand the system
4. **Review API documentation** at http://localhost:4000/api/docs
5. **Check code** in `apps/backend/src` and `apps/web/src`

---

## ✅ Verification

Run these commands to verify everything works:

```bash
# Check system
check-system.bat

# Verify database
node scripts/db/dbcheck.cjs

# Test API endpoints
.\scripts\test-api.ps1
```

Expected output: All checks pass ✓

---

## 📞 Getting Help

1. **Check logs:** `npm run pm2:logs`
2. **Verify setup:** `check-system.bat`
3. **Read docs:** See links above
4. **Check API:** http://localhost:4000/api/docs
5. **Review errors:** Look at console output

---

## 🎉 You're Ready!

Your QalNet system is now running. 

**Frontend:** http://localhost:3001  
**Backend:** http://localhost:4000  
**API Docs:** http://localhost:4000/api/docs

Happy coding! 🚀
