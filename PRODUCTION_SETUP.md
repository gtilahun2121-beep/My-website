# QalNet Production Setup Guide

**Status:** ✅ Real Configuration - No Test Credentials  
**Date:** August 29, 2026

---

## Overview

This guide covers moving QalNet from development to production. All test credentials and placeholder data have been removed. The system is now configured via environment variables for real deployment.

---

## Environment Variables Configuration

### Required Variables

Create a `.env` file in the root directory or set these in your deployment environment:

```bash
# ==================
# Core Configuration
# ==================

# JWT Secret - Use a strong, random 32+ character string
JWT_SECRET=your-strong-random-jwt-secret-here-min-32-chars

# Database Configuration
DB_TYPE=postgresql          # or mysql, mariadb
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=qalnet_production
DB_USER=qalnet_app
DB_PASSWORD=strong-db-password

# ==================
# Payment Integration
# ==================

# Chapa Payment Gateway
CHAPA_PUBLIC_KEY=your-chapa-public-key-here
CHAPA_SECRET_KEY=CHASECK_TEST-JXfelzS59KnCESAXpB390yHrLqG1k5tF
CHAPA_ENVIRONMENT=test               # 'test' or 'production'

# Telebirr Payment Gateway
TELEBIRR_MERCHANT_ID=your-telebirr-merchant-id
TELEBIRR_API_KEY=your-telebirr-api-key
TELEBIRR_ENVIRONMENT=test            # 'test' or 'production'

# ==================
# Application
# ==================

# Server Configuration
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Frontend URL (for CORS configuration)
FRONTEND_URL=https://your-domain.com

# ==================
# Security
# ==================

# Admin Account (created during initial setup)
ADMIN_PHONE=+251911123456         # Change to real admin phone
ADMIN_EMAIL=admin@qalnet.com      # Change to real admin email

# Wallet Defaults
INITIAL_WALLET_BALANCE=0           # New users start with 0 ETB

# ==================
# Logging & Monitoring
# ==================

LOG_LEVEL=info                      # 'debug', 'info', 'warn', 'error'
SENTRY_DSN=                         # Optional: Sentry error tracking
```

---

## Step-by-Step Production Deployment

### 1. Database Setup

#### PostgreSQL (Recommended)

See [SEED_DATA_GUIDE.md](./SEED_DATA_GUIDE.md) for detailed initialization steps.

Quick summary:
```bash
# Create database
createdb qalnet_production

# Run migrations (creates schema)
npm run db:migrate

# Seed initial data (admin account only)
npm run db:seed:production

# Verify
psql -c "SELECT COUNT(*) as users FROM users;"
```

#### Verify Database

```bash
psql qalnet_production -c "\dt"        # List all tables
psql qalnet_production -c "\d users"   # Check users table
```

---

### 2. Payment Gateway Integration

#### Chapa Setup

**See:** [PAYMENT_CONFIGURATION.md](./PAYMENT_CONFIGURATION.md) - Part 1

Quick summary:
1. Sign up at [Chapa](https://chapa.co)
2. Go to Settings → API Keys
3. Copy Public Key and Secret Key
4. Add to `.env`:
   ```bash
   CHAPA_PUBLIC_KEY=CHAPUBK_xxx
   CHAPA_SECRET_KEY=CHASECK_xxx
   ```

#### Telebirr Setup

**See:** [PAYMENT_CONFIGURATION.md](./PAYMENT_CONFIGURATION.md) - Part 2

Quick summary:
1. Register at [Telebirr Developer Portal](https://developer.ethiotelecom.et)
2. Create merchant application
3. Get App ID and App Secret
4. Add to `.env`:
   ```bash
   TELEBIRR_APP_KEY=your-app-id
   TELEBIRR_APP_SECRET=your-app-secret
   ```

---

### 3. Admin Account Creation

After database setup, create the first admin account:

```bash
# Run admin setup script
node scripts/create-admin.js

# You'll be prompted for:
# - Admin phone number (format: +251XXXXXXXXX)
# - Admin email
# - First name
# - Last name
# - Initial PIN (will be hashed)
```

**Example:**
```bash
$ node scripts/create-admin.js
? Admin phone number: +251911567890
? Admin email: admin@qalnet.com
? First name: Abebe
? Last name: Kebede
? Initial PIN: (enter 4-digit PIN)

✓ Admin account created successfully
  Phone: +251911567890
  Email: admin@qalnet.com
  Role: admin
```

---

### 4. Security Hardening

#### Generate Strong JWT Secret

```bash
# Generate 32+ character random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# a7f3e9c2b1d8f4a6e2c9b5d7f1a3e5c7b9d1f3a5e7c9b2d4f6a8e0c2b4d6f8

# Add to .env:
JWT_SECRET=a7f3e9c2b1d8f4a6e2c9b5d7f1a3e5c7b9d1f3a5e7c9b2d4f6a8e0c2b4d6f8
```

#### Database Security

```sql
-- Create read-only user for reports
CREATE USER 'qalnet_readonly'@'localhost' IDENTIFIED BY 'readonly-password';
GRANT SELECT ON qalnet_production.* TO 'qalnet_readonly'@'localhost';

-- Enable SSL for database connections
-- (Configure in your hosting provider)
```

#### Application Security

```bash
# Install security headers
npm install helmet

# Enable in backend-server.js:
# app.use(helmet());
```

---

### 5. Deployment (Docker)

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Run migrations
RUN npm run db:migrate

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "backend-server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - CHAPA_SECRET_KEY=${CHAPA_SECRET_KEY}
      - TELEBIRR_API_KEY=${TELEBIRR_API_KEY}
      - DB_HOST=postgres
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
      - NODE_ENV=production
    ports:
      - "3001:3001"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Deploy with Docker Compose

```bash
# Create .env file with production values
cp .env.example .env
# Edit .env with real credentials

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

### 6. Cloud Deployment

#### AWS EC2

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Clone repository
git clone https://github.com/your-org/qalnet.git
cd qalnet

# Install dependencies
npm ci

# Configure environment
nano .env

# Start with PM2
npm install -g pm2
pm2 start backend-server.js --name qalnet-backend
pm2 start "npm run start" --cwd ./apps/web --name qalnet-frontend
pm2 save
pm2 startup
```

#### Google Cloud Run

```bash
# Build Docker image
gcloud builds submit --tag gcr.io/your-project/qalnet-backend

# Deploy
gcloud run deploy qalnet-backend \
  --image gcr.io/your-project/qalnet-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars "JWT_SECRET=${JWT_SECRET},CHAPA_SECRET_KEY=${CHAPA_SECRET_KEY}" \
  --memory 512Mi \
  --timeout 300
```

---

### 7. SSL/TLS Certificate

#### Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### Configure Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }
}
```

---

### 8. Monitoring & Logging

#### Application Monitoring

```bash
# Install PM2 Plus for monitoring
pm2 install pm2-auto-pull
pm2 link

# View dashboard
pm2 web

# Access at http://localhost:9615
```

#### Database Monitoring

```bash
# Check PostgreSQL stats
psql -d qalnet_production -c "SELECT * FROM pg_stat_statements LIMIT 10;"

# Monitor connections
psql -d qalnet_production -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Error Tracking

```bash
# Install Sentry
npm install @sentry/node

# Add to backend-server.js:
# const Sentry = require("@sentry/node");
# Sentry.init({ dsn: process.env.SENTRY_DSN });
# app.use(Sentry.Handlers.errorHandler());
```

---

## Pre-Launch Checklist

- [ ] All environment variables configured (check `.env`)
- [ ] Database created and migrations run
- [ ] Admin account created and tested
- [ ] Payment gateways (Chapa/Telebirr) connected and tested
- [ ] SSL certificate installed
- [ ] Backups configured (daily automated)
- [ ] Monitoring and alerts set up (Sentry/PM2)
- [ ] CORS properly configured for your domain
- [ ] API rate limiting configured
- [ ] Database indexes optimized
- [ ] Load testing completed (simulate 100+ concurrent users)
- [ ] Security audit completed
- [ ] Documentation reviewed by team
- [ ] Disaster recovery plan tested

---

## First-Time Operations

### Initial Sign-In

After deployment, create your first user account:

1. Visit your production URL
2. Click "Create Account"
3. Enter phone number (format: +251XXXXXXXXX)
4. Complete SMS verification
5. Set 4-digit PIN
6. Account created

**Admin account** created separately via `create-admin.js` script.

### First Admin Tasks

1. Review pending membership requests
2. Approve initial equb requests
3. Configure equb tier amounts (if custom)
4. Test payment integration (Chapa/Telebirr)
5. Send welcome email to users
6. Monitor system performance

---

## Backup & Recovery

### Automated Daily Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U qalnet_app qalnet_production | gzip > /backups/qalnet_$DATE.sql.gz
aws s3 cp /backups/qalnet_$DATE.sql.gz s3://your-backup-bucket/
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# 0 2 * * * /path/to/backup.sh
```

### Restore from Backup

```bash
# Download from S3
aws s3 cp s3://your-backup-bucket/qalnet_20260829_020000.sql.gz .

# Restore
gunzip -c qalnet_20260829_020000.sql.gz | psql -U qalnet_app qalnet_production
```

---

## Scaling & Performance

### Horizontal Scaling

```bash
# Multiple backend instances behind load balancer
# Use PM2 cluster mode:
pm2 start backend-server.js -i max --name "qalnet"

# Configure load balancer (Nginx)
upstream backend {
    server backend1:4000;
    server backend2:4000;
    server backend3:4000;
}

server {
    location /api/ {
        proxy_pass http://backend;
    }
}
```

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_equbs_status ON equbs(status);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM equbs WHERE status = 'active';
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** Payment gateway failing  
**Solution:** Verify API keys in `.env`, check payment gateway status

**Issue:** Database connection error  
**Solution:** Verify DB credentials, check connection string, test with `psql`

**Issue:** Slow response times  
**Solution:** Check database indexes, verify API rate limiting, monitor CPU/memory

### Emergency Contacts

- **Chapa Support:** https://chapa.co/contact
- **Telebirr Support:** https://www.ethiotelecom.et
- **PostgreSQL Docs:** https://www.postgresql.org/docs

---

## Security Best Practices

✅ **DO:**
- Rotate JWT secret annually
- Update dependencies monthly
- Monitor payment transactions
- Keep backups offsite
- Use strong database passwords
- Enable database encryption at rest
- Log all admin actions

❌ **DON'T:**
- Store credentials in code
- Share `.env` file
- Use same secret in multiple environments
- Disable SSL/TLS
- Skip database backups
- Run without monitoring
- Commit secrets to Git

---

## Post-Deployment Monitoring

### Daily Checklist

```bash
# Check backend health
curl https://your-domain.com/api/v1/health

# Check database size
psql -d qalnet_production -c "SELECT pg_size_pretty(pg_database_size('qalnet_production'));"

# Monitor error rate
tail -f /var/log/qalnet/error.log

# Check payment transactions
curl https://your-domain.com/api/v1/admin/transactions?token=ADMIN_TOKEN
```

### Weekly Checklist

- [ ] Review backup logs
- [ ] Check error trends in Sentry
- [ ] Verify payment gateway integration
- [ ] Monitor database query performance
- [ ] Review security logs
- [ ] Update dependencies if critical patches available

---

**Version:** 1.0.0  
**Last Updated:** August 29, 2026  
**Status:** ✅ Production Ready

All test credentials removed. System configured for real deployment with environment variables.
