# Email Notifications System - Setup Guide

**Status:** ✅ Implemented  
**Date:** September 22, 2026

---

## Overview

QalNet includes a comprehensive email notification system that sends transactional emails for:
- Member invitations and responses
- Payment confirmations and failures
- Lottery draw results
- Payout notifications
- KYC verification updates
- Account alerts

---

## Quick Start

### Development (Console Mode)

For development, emails are printed to console by default:

```bash
# In your .env file:
EMAIL_PROVIDER=console
```

Emails will appear in your terminal/logs when triggered.

### Production (SendGrid Recommended)

1. **Create SendGrid Account**
   ```
   https://sendgrid.com/
   ```

2. **Generate API Key**
   - Login to SendGrid
   - Go to Settings > API Keys
   - Create new API key with "Full Access"
   - Copy the key

3. **Configure Environment**
   ```env
   EMAIL_PROVIDER=sendgrid
   EMAIL_FROM=noreply@qalnet.app
   EMAIL_FROM_NAME=QalNet
   EMAIL_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   APP_URL=https://qalnet.app
   ```

4. **Verify Sender Email**
   - In SendGrid, go to Settings > Sender Authentication
   - Add your domain or verify single sender email

5. **Test**
   ```bash
   npm run test:email
   ```

---

## Email Providers

### 1. Console (Development)
```env
EMAIL_PROVIDER=console
```
- Prints emails to console/logs
- No setup required
- Perfect for development and testing

### 2. SendGrid (Recommended for Production)
```env
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=SG.xxxxx
```
- Industry-leading email service
- High deliverability
- Excellent tracking and analytics
- [Setup Guide](https://sendgrid.com/docs/for-developers/sending-email/quickstart-nodejs/)

### 3. Mailgun
```env
EMAIL_PROVIDER=mailgun
EMAIL_API_KEY=key-xxxxx
MAILGUN_DOMAIN=mail.qalnet.app
```
- Developer-friendly
- Good for low to medium volume
- [Setup Guide](https://documentation.mailgun.com/)

### 4. SMTP (Self-Hosted)
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password
```
- Use any SMTP server
- Gmail, Office365, custom servers
- Requires nodemailer

---

## Email Templates

### Member Management

#### 1. Member Invitation
**When:** Host invites participant  
**Recipient:** Invitee  
**Content:**
- Equb name and invitation message
- Accept/Reject buttons
- Host information

#### 2. Invitation Accepted
**When:** Member accepts invitation  
**Recipient:** Host  
**Content:**
- Member name who accepted
- Link to equb

#### 3. Invitation Rejected
**When:** Member declines invitation  
**Recipient:** Host  
**Content:**
- Member's rejection reason
- Option to invite others

#### 4. Member Removed
**When:** Host removes member  
**Recipient:** Member  
**Content:**
- Reason for removal
- Refund status
- Support contact

#### 5. Member Left
**When:** Member leaves equb  
**Recipient:** Host  
**Content:**
- Member name
- Reason for leaving

### Payment Notifications

#### 6. Payment Received
**When:** Payment confirmed  
**Recipient:** Member  
**Content:**
- Amount paid
- Equb name
- Transaction reference
- Next payment due date

#### 7. Payment Failed
**When:** Payment fails  
**Recipient:** Member  
**Content:**
- Amount and reason
- Retry link
- Alternative payment methods

### Lottery & Payout

#### 8. Draw Result (Winner)
**When:** Member wins draw  
**Recipient:** Winner  
**Content:**
- "Congratulations" message
- Payout amount
- Expected delivery date

#### 9. Draw Result (Non-Winner)
**When:** Draw completes  
**Recipient:** Non-winners  
**Content:**
- Winner name
- Next draw date
- Encouragement message

#### 10. Payout Processed
**When:** Payout is sent  
**Recipient:** Winner  
**Content:**
- Payout amount
- Payment method
- Transaction reference
- Tracking link

### Account & Compliance

#### 11. KYC Verified
**When:** Identity verified  
**Recipient:** User  
**Content:**
- Verification confirmation
- Increased limits
- Next steps

#### 12. KYC Rejected
**When:** Identity verification fails  
**Recipient:** User  
**Content:**
- Rejection reason
- Documents needed
- Resubmission process

#### 13. Welcome
**When:** New account created  
**Recipient:** User  
**Content:**
- Welcome message
- Getting started guide
- First equb suggestion

---

## API Integration

### Sending Emails Programmatically

```typescript
import { EmailService } from './services/email.service';

// Inject EmailService
constructor(private emailService: EmailService) {}

// Send member invitation
await this.emailService.sendMemberInvitation(
  recipientEmail,
  recipientName,
  equbName,
  personalMessage,
  hostId,
  equbId,
);

// Send payment received notification
await this.emailService.sendPaymentReceived(
  memberId,
  amount,
  equbName,
);

// Send draw result
await this.emailService.sendDrawResult(
  memberId,
  equbName,
  winnerName,
  amount,
  isWinner,
);
```

### Via NotificationsService

```typescript
import { NotificationsService } from './notifications.service';

constructor(private notificationsService: NotificationsService) {}

// All email methods available through NotificationsService
await this.notificationsService.sendMemberInvitation(...);
await this.notificationsService.sendPaymentReceived(...);
// etc.
```

---

## Environment Setup

### Create .env File

Copy `.env.example.email` to `.env`:

```bash
cp .env.example.email .env
```

### Required Variables

```env
# Core
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@qalnet.app
EMAIL_FROM_NAME=QalNet
APP_URL=https://qalnet.app

# Provider-specific (for SendGrid)
EMAIL_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxx
```

### Optional Variables

```env
# Feature flags
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_MEMBER_INVITATIONS=true
ENABLE_PAYMENT_NOTIFICATIONS=true
ENABLE_DRAW_NOTIFICATIONS=true
ENABLE_KYC_NOTIFICATIONS=true
```

---

## Package Installation

### SendGrid (Recommended)
```bash
npm install @sendgrid/mail
```

### Mailgun
```bash
npm install mailgun.js
```

### SMTP (Nodemailer)
```bash
npm install nodemailer
```

---

## Testing

### Console Mode Test

```bash
# Set EMAIL_PROVIDER=console in .env
npm run dev

# Trigger an email action (e.g., invite member)
# Check console output
```

### SendGrid Test

```bash
# Create test script
// test-email.ts
import { EmailService } from './services/email.service';

const emailService = new EmailService();

await emailService.sendWelcome(
  'test@example.com',
  'Test User'
);

// Run: npx ts-node test-email.ts
```

### Verify Email Sent

**SendGrid:**
- Dashboard > Mail > Send History
- Check "Delivered" status

**Mailgun:**
- Domain > Logs
- Filter by recipient email

---

## HTML Email Templates

All templates include:
- ✅ Responsive design (mobile-friendly)
- ✅ Professional styling
- ✅ Clear call-to-action buttons
- ✅ QalNet branding
- ✅ Support footer

### Customize Templates

Edit template rendering methods in `email.service.ts`:

```typescript
private renderMemberInvitationTemplate(data: {...}): string {
  // Customize HTML here
  return `...`;
}
```

---

## Best Practices

### 1. Email Frequency
- ✅ Do send: Payment confirmations, draw results, KYC updates
- ❌ Don't send: Marketing emails (use opt-in newsletter instead)

### 2. Unsubscribe
- ✅ Include unsubscribe link in footer
- ✅ Honor unsubscribe requests within 24 hours
- ✅ Track unsubscribes in database

### 3. Error Handling
- ✅ Handle failed email sends gracefully
- ✅ Log email errors for debugging
- ✅ Implement retry logic for transient failures
- ✅ Alert on persistent failures

### 4. Rate Limiting
- ✅ Implement per-user email rate limits
- ✅ Batch bulk emails (e.g., draw notifications)
- ✅ Respect provider rate limits

### 5. Compliance
- ✅ Comply with CAN-SPAM regulations
- ✅ Include physical address in emails
- ✅ Honor "do not reply" email addresses
- ✅ Maintain email audit trails

---

## Troubleshooting

### Emails Not Sending

**Check provider:**
```bash
# Console mode - should print to logs
EMAIL_PROVIDER=console

# Check for errors in application logs
tail -f logs/app.log | grep -i email
```

**Check credentials:**
```bash
# Verify in .env
cat .env | grep EMAIL
```

**Check rate limits:**
- SendGrid: 600 emails/second
- Mailgun: Contact support for limits

### Emails Going to Spam

**Fix:**
1. Add SPF record
2. Add DKIM signature
3. Add DMARC policy
4. Use authenticated domain

**SendGrid Help:** https://sendgrid.com/docs/for-developers/sending-email/authentication/

### Template Not Rendering

**Fix:**
1. Check template method exists in `email.service.ts`
2. Verify all required data properties passed
3. Test HTML rendering in browser

---

## Monitoring & Analytics

### SendGrid Dashboard
- Mail > Send Activity
- Track opens, clicks, bounces
- Set up alerts for issues

### Log Tracking

```typescript
// Email service logs all sends
this.logger.log(`Email sent to ${email} (ID: ${messageId})`);
this.logger.error(`Failed to send email: ${error}`);
```

Check logs:
```bash
grep "Email sent" logs/app.log
grep "Failed to send" logs/app.log
```

---

## Files Created

- ✅ `apps/backend/src/config/email.config.ts` - Configuration
- ✅ `apps/backend/src/modules/notifications/services/email-provider.ts` - Provider abstraction
- ✅ `apps/backend/src/modules/notifications/services/email.service.ts` - Main email service
- ✅ `apps/backend/src/modules/notifications/notifications.module.ts` - Module update
- ✅ `apps/backend/src/modules/notifications/notifications.service.ts` - Service update
- ✅ `.env.example.email` - Environment template

---

## Next Steps

1. **Configure your email provider** (SendGrid recommended)
2. **Set environment variables** in `.env`
3. **Test email sending** with console mode first
4. **Verify emails** in production provider dashboard
5. **Set up email analytics** and monitoring
6. **Implement unsubscribe handling** in database
7. **Add email audit trail** for compliance

---

## Support

For issues:
1. Check logs: `grep -i email logs/app.log`
2. Verify provider configuration
3. Test with console mode first
4. Check provider status page
5. Review this guide

---

**Status:** Production Ready ✅  
**Last Updated:** September 22, 2026
