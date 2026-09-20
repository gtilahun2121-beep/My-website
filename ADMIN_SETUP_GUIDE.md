# QalNet Admin Setup & Onboarding Guide

**Date:** August 29, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

This guide covers how to set up the first admin account and onboard administrators for QalNet deployment. No test admin accounts are pre-configured - you create real admins during deployment.

---

## Part 1: First-Time Admin Setup

### Step 1: Generate Bootstrap Token

Before deployment, generate a one-time admin bootstrap token:

```bash
# Generate a secure random token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# a7f3e9c2b1d8f4a6e2c9b5d7f1a3e5c7b9d1f3a5e7c9b2d4f6a8e0c2b4d6f8

# Add to .env file:
ADMIN_BOOTSTRAP_TOKEN=a7f3e9c2b1d8f4a6e2c9b5d7f1a3e5c7b9d1f3a5e7c9b2d4f6a8e0c2b4d6f8
```

### Step 2: Configure Environment Variables

```bash
# .env (production)
NODE_ENV=production
DATABASE_URL=postgresql://qalnet_app:password@db.example.com:5432/qalnet

# Admin Bootstrap
ADMIN_BOOTSTRAP_TOKEN=a7f3e9c2b1d8f4a6e2c9b5d7f1a3e5c7b9d1f3a5e7c9b2d4f6a8e0c2b4d6f8

# Email for admin account
ADMIN_EMAIL=admin@qalnet.com
ADMIN_PHONE=+251911567890
```

### Step 3: Run Database Migrations

```bash
npm run db:migrate

# Verify schema created
psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Should show 30+ tables including users, wallets, equb_groups, etc.
```

### Step 4: Create First Admin Account

```bash
# Interactive setup
npm run setup:admin

# Or manual SQL (if setup script not available)
psql $DATABASE_URL << 'EOF'
INSERT INTO users (
  id,
  first_name,
  last_name,
  email,
  phone,
  password_hash,
  role,
  is_active
) VALUES (
  gen_random_uuid(),
  'System',
  'Administrator',
  'admin@qalnet.com',
  '+251911567890',
  '$argon2id$v=19$m=19456,t=2,p=1$...',
  'admin',
  true
) RETURNING id;

-- Create wallet for admin
INSERT INTO wallets (user_id, balance, currency)
VALUES ('admin-uuid-here', 0, 'ETB');
EOF
```

### Step 5: Enable 2FA (Recommended)

```bash
# Admin should enable Two-Factor Authentication
# Via API: POST /api/v1/auth/2fa/setup
# Receive TOTP secret, scan with Google Authenticator
# Backup codes generated automatically
```

---

## Part 2: Admin Account Credentials

### Secure Credential Storage

✅ **DO:**
- Store password in secure vault (1Password, LastPass, Vault)
- Use strong password: 16+ chars, uppercase, lowercase, numbers, symbols
- Store PIN in separate secure location
- Keep backup codes in safety deposit box
- Never share credentials via email

❌ **DON'T:**
- Write credentials in files
- Share via email or chat
- Use same password elsewhere
- Store in browser autofill
- Leave default credentials

### Example Strong Credentials

```
Email: admin@qalnet.com
Phone: +251911567890
Password: Tr0p!cal#Equb$2026*Solar
PIN: 7592 (4 unique digits)
2FA: Enabled with Google Authenticator
Backup Codes: Stored securely (10 codes)
```

### Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)

---

## Part 3: Admin Roles & Permissions

### Admin Permissions

Admins can:

✅ **User Management**
- View all users
- Deactivate accounts (not delete)
- Reset user PINs (after verification)
- View user KYC status

✅ **Equb Management**
- Approve pending equbs
- Pause/resume equbs
- Manually resolve disputes
- View all equbs (including private)
- Manage preset templates

✅ **Financial**
- View all transactions
- View all payouts
- Trigger manual reconciliation
- Export financial reports
- Adjust limits if needed

✅ **System**
- View system health dashboard
- View error logs
- Configure notifications
- Manage other admins

❌ **Cannot:**
- Delete user data (compliance)
- Modify transaction history (audit trail)
- Access user wallets (data privacy)
- Change security settings unilaterally

---

## Part 4: Admin Dashboard

### Dashboard Components

**1. System Health**
```
Status:  ✅ All systems operational
Backend: ✅ Running
Database: ✅ Connected
Redis: ✅ Connected
Chapa: ✅ API responding
Telebirr: ✅ API responding
```

**2. Key Metrics**
```
Total Users: 12,453
Active Equbs: 3,456
Total Transactions: 234,567
Daily Volume: 45,123,000 ETB
Payment Success Rate: 99.2%
```

**3. Recent Activities**
```
- 23 new users joined today
- 5 equbs created
- 4 equbs completed
- 12 payment failures (resolved)
```

**4. Pending Approvals**
```
Equb Requests: 3
KYC Verifications: 7
Support Tickets: 2
```

---

## Part 5: Admin Onboarding Checklist

### Week 1: Access & Training

- [ ] Admin account created
- [ ] Email + SMS verified
- [ ] 2FA enabled & tested
- [ ] Dashboard access confirmed
- [ ] Backup codes stored safely
- [ ] Login from 2-3 devices tested
- [ ] Password manager configured

### Week 2: System Familiarization

- [ ] System architecture reviewed
- [ ] Database schema understood
- [ ] API endpoints tested (read-only)
- [ ] Error handling verified
- [ ] Backup procedures understood
- [ ] Recovery procedures reviewed
- [ ] Support channels established

### Week 3: Operations

- [ ] User management tested
- [ ] Equb approval flow practiced
- [ ] Financial reports generated
- [ ] Notifications system tested
- [ ] Admin reports generated
- [ ] Escalation procedures practiced

### Month 1: Full Operations

- [ ] Full operational control
- [ ] Monthly reconciliation completed
- [ ] User inquiries handled
- [ ] System optimization recommendations made
- [ ] Documentation updated

---

## Part 6: Daily Admin Tasks

### Morning (9 AM)

```
1. Check system health dashboard
   - All systems running?
   - Any errors overnight?
   
2. Review overnight activity
   - New users registered?
   - Any failed payments?
   - Any equbs completed?
   
3. Monitor key metrics
   - Transaction volume normal?
   - Error rates acceptable?
   - Payment gateway status OK?
```

### Throughout Day

```
1. Review pending approvals
   - New equb requests
   - KYC verifications
   - Support tickets
   
2. Monitor system performance
   - Check error logs periodically
   - Monitor database performance
   - Track API response times
   
3. Handle user inquiries
   - Payment disputes
   - Account issues
   - Equb questions
```

### Evening (5 PM)

```
1. Generate daily report
   - Total transactions
   - New users
   - Issues resolved
   
2. Backup verification
   - Confirm daily backup completed
   - Verify backup integrity
   
3. Next day preparation
   - Note any pending items
   - Flag critical issues
   - Prepare escalations
```

---

## Part 7: Critical Admin Procedures

### Emergency: Payment Gateway Down

```
1. Check Chapa status: https://status.chapa.co
2. Check Telebirr status: https://developer.ethiotelecom.et
3. If down:
   - Post message: "Payment services temporarily unavailable"
   - Queue transactions for retry
   - Send alerts to support team
4. Monitor gateway recovery
5. Process queued transactions once up
```

### Emergency: Database Inaccessible

```
1. Check database connectivity
   psql $DATABASE_URL -c "SELECT 1"

2. If failed:
   - Alert DevOps/AWS support
   - Failover to backup database (if configured)
   - Notify users: "Service temporarily unavailable"
   
3. Recovery:
   - Investigate database logs
   - Restore from last backup if needed
   - Verify data integrity
```

### Emergency: Security Breach

```
1. Immediate actions:
   - Disable compromised admin account
   - Change all other admin passwords
   - Rotate API keys
   - Enable enhanced logging
   
2. Investigation:
   - Check audit logs
   - Identify affected users/data
   - Determine breach scope
   
3. User communication:
   - Notify affected users
   - Instructions for password reset
   - Information about compensation
   
4. Recovery:
   - Restore from uncompromised backup
   - Security audit
   - Implement preventive measures
```

---

## Part 8: Admin Tools & Access

### Command Line Tools

```bash
# Health check
curl https://api.qalnet.com/api/v1/health

# Database connection test
npm run db:check

# Admin CLI
npm run admin:cli

# View logs
tail -f /var/log/qalnet/backend.log
docker logs qalnet-backend  # if Docker

# Database access
psql $DATABASE_URL
```

### Admin Panel Access

```
URL: https://admin.qalnet.com
Username: admin@qalnet.com
Password: [strong password]
2FA: Required
```

### Documentation Access

```
API Docs: https://api.qalnet.com/docs
System Docs: https://docs.qalnet.com
Admin Guide: This file (offline copy)
Knowledge Base: https://kb.qalnet.com
```

---

## Part 9: Admin Security Best Practices

### Password Management

✅ DO:
- Use password manager
- Use unique strong passwords
- Change password every 90 days
- Enable 2FA always
- Log out when leaving desk

❌ DON'T:
- Write passwords down
- Share passwords
- Use same password elsewhere
- Disable 2FA
- Leave sessions open

### Session Management

```
Admin sessions:
- Timeout after 30 minutes of inactivity
- Force logout at end of day
- Monitor active sessions
- Log out of unused devices
- Session activity logged
```

### Audit Trail

Every admin action is logged:
```
- User approval (who, when, which user)
- Equb modifications (what changed, by whom)
- Financial operations (amount, recipient, approver)
- System changes (what, by whom)
- Failed login attempts (IP, time, user)
```

---

## Part 10: Production Checklist

### Before Going Live

- [ ] First admin account created with strong password
- [ ] 2FA enabled and tested
- [ ] Backup codes stored securely
- [ ] Dashboard access verified
- [ ] Admin tools working
- [ ] Documentation reviewed
- [ ] Emergency procedures practiced
- [ ] Support channels established
- [ ] Escalation procedures defined
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Recovery procedures tested

### Monthly

- [ ] Password changed (90+ days?)
- [ ] 2FA codes regenerated
- [ ] Session activity reviewed
- [ ] Audit logs reviewed
- [ ] System performance analyzed
- [ ] User feedback collected
- [ ] Security updates applied

### Quarterly

- [ ] Security audit completed
- [ ] Disaster recovery drilled
- [ ] Backup restore tested
- [ ] Admin training refreshed
- [ ] Procedures updated
- [ ] Documentation reviewed

---

## Part 11: Troubleshooting

### Issue: Admin Login Fails

**Solution:**
```bash
# Reset admin password via database
psql $DATABASE_URL
UPDATE users SET password_hash = '$new_hash' WHERE email='admin@qalnet.com';
```

### Issue: 2FA Not Working

**Solution:**
```bash
# Regenerate 2FA secret
DELETE FROM user_settings WHERE user_id='admin-uuid';
INSERT INTO user_settings (user_id, two_factor_enabled) VALUES ('admin-uuid', false);
# Admin logs in, re-enables 2FA
```

### Issue: Admin Account Locked

**Solution:**
```bash
# Check login lockout
SELECT * FROM users WHERE email='admin@qalnet.com' AND login_attempts >= 5;

# Unlock account
UPDATE users SET login_attempts=0 WHERE email='admin@qalnet.com';
```

---

## References

- Setup Script: `scripts/setup-admin.js`
- Bootstrap Token: `.env` file
- Admin Dashboard: `https://admin.qalnet.com`
- Emergency Procedures: This guide

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Admin Setup:** Real procedures, no test accounts
