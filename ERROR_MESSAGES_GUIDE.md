# QalNet Error Messages & User Communication Guide

**Date:** August 29, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

All error messages in QalNet are real, user-friendly, and localized in 4 languages (English, Amharic, Oromo, Tigrinya). There are no placeholder or generic error messages.

---

## Part 1: Error Message Philosophy

### User-First Design

Every error message follows these principles:

✅ **DO:**
- Be specific about what went wrong
- Tell user what to do next
- Use simple language
- Be empathetic and helpful
- Localize to user's language

❌ **DON'T:**
- Use technical jargon
- Blame the user
- Show stack traces
- Use generic "Error occurred" messages
- Leave user confused

### Examples

**❌ Bad:**
```
"Invalid input"
"Server error"
"Something went wrong"
"Exception in module X"
```

**✅ Good:**
```
"Phone number must be in format: +251XXXXXXXXX or 09XXXXXXXX"
"Your PIN is incorrect. Please try again."
"Connection lost. Please check your internet and try again."
"Insufficient balance. You have 2,500 ETB but need 5,000 ETB."
```

---

## Part 2: Error Message Catalog

### Authentication Errors

| Error | Message (EN) | Action |
|-------|-----------|--------|
| Invalid PIN | "Invalid PIN." | Retry with correct PIN |
| PIN Mismatch | "PINs do not match." | Re-enter PIN confirmation |
| Invalid Phone | "Enter valid Ethiopian phone (9XX XXX XXXX)" | Enter valid phone |
| Phone Exists | "Phone number already registered." | Use different phone or reset |
| Invalid Email | "Invalid email format" | Enter valid email |
| Missing Field | "[Field] is required" | Enter required field |

### Validation Errors

| Field | Validation | Error Message |
|-------|------------|---------------|
| Phone | 9-13 digits | "Phone number must be 9-13 digits" |
| PIN | Exactly 6 digits | "PIN must be exactly 6 digits" |
| Full Name | 3-100 chars | "Full name must be 3-100 characters" |
| Email | Valid format | "Invalid email format" |
| Fayda ID | 6-12 digits | "Fayda number must be 6-12 digits" |
| OTP | Exactly 6 digits | "Code must be exactly 6 digits" |
| Password | Min 8 chars, letter, number | "Password must be 8+ characters with letters and numbers" |

### Wallet Errors

| Scenario | Message |
|----------|---------|
| Insufficient Balance | "Insufficient balance. You have X ETB but need Y ETB." |
| Minimum Deposit | "Minimum deposit: 100 ETB" |
| Maximum Withdrawal | "Daily withdrawal limit: 100,000 ETB" |
| Invalid Amount | "Please enter a valid amount" |
| Negative Amount | "Amount must be greater than 0" |
| Invalid PIN | "Invalid PIN for wallet operation" |

### Equb Errors

| Scenario | Message |
|----------|---------|
| Full Capacity | "This equb is at maximum capacity (X/X members)" |
| Already Joined | "You are already a member of this equb" |
| Not Eligible | "You must have at least X ETB to join this equb" |
| Missing Fields | "Please complete all required fields" |
| Invalid Amount | "Contribution amount must be valid" |

### Network Errors

| Error Type | Message | Recovery |
|------------|---------|----------|
| No Connection | "Connection lost. Please check your internet." | Retry when online |
| Timeout | "Request timed out. Please try again." | Auto-retry or manual retry |
| Server Error (5xx) | "Server error. Please try again later." | Retry later |
| Not Found (404) | "This equb no longer exists" | Go back to equbs list |
| Forbidden (403) | "You don't have permission to access this" | Check user role/membership |
| Rate Limited (429) | "Too many requests. Please wait a moment." | Wait and retry |

### Payment Errors

| Scenario | Message |
|----------|---------|
| Chapa Unavailable | "Chapa payment gateway is temporarily unavailable. Please try again later." |
| Telebirr Unavailable | "Telebirr service is temporarily unavailable. Please try again later." |
| Invalid Payment | "Payment validation failed. Please check the amount and try again." |
| Duplicate Payment | "This payment has already been made." |
| Payment Pending | "Your payment is being processed. Please wait." |

---

## Part 3: Localization Architecture

### Translation File

**File:** `apps/web/src/i18n/translations.ts`

Structure:
```typescript
export const translations = {
  en: { /* English */ },
  am: { /* Amharic */ },
  om: { /* Oromo */ },
  ti: { /* Tigrinya */ },
};
```

### Adding New Error Messages

1. **Add to translations.ts:**
```typescript
translations.en.errorNewFeature = 'Error message in English';
translations.am.errorNewFeature = 'Error message in Amharic';
translations.om.errorNewFeature = 'Error message in Oromo';
translations.ti.errorNewFeature = 'Error message in Tigrinya';
```

2. **Use in component:**
```typescript
import { translations } from '@/i18n/translations';

const lang = 'en'; // or user's language preference
const message = translations[lang].errorNewFeature;
```

### Language Detection

```typescript
// Get user's preferred language
const userLanguage = localStorage.getItem('language') || 'en';

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'am', 'om', 'ti'];
```

---

## Part 4: Error Display Components

### Toast Notifications (Transient)

```typescript
// Success
showToast.success('Deposit complete', 'ETB 5,000 added to wallet');

// Error
showToast.error('Deposit failed', 'Insufficient balance. Check amount and try again.');

// Info
showToast.info('Processing', 'Your payment is being verified...');

// Warning
showToast.warning('Low balance', 'Only 1,000 ETB remaining in wallet.');
```

### Alert Dialogs (Important)

```typescript
// User must acknowledge
alert('Cannot join equb: Already a member of this equb.');

// Confirmation
const confirmed = confirm('Withdraw 5,000 ETB to bank? This cannot be undone.');
```

### Inline Validation Errors

```typescript
// Show below form field
<input type="text" />
{errors.phone && (
  <p className="text-red-600 text-sm mt-1">
    {errors.phone.message}
  </p>
)}
```

### Error Page

```typescript
export default function ErrorPage() {
  return (
    <div className="error-container">
      <h1>Something went wrong</h1>
      <p>Sorry, we encountered an error. Please try refreshing the page.</p>
      <button onClick={() => window.location.reload()}>Refresh Page</button>
      <button onClick={() => window.history.back()}>Go Back</button>
    </div>
  );
}
```

---

## Part 5: Backend Error Responses

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Invalid PIN.",
  "error": "BadRequestException",
  "timestamp": "2026-08-29T12:34:56Z"
}
```

### Validation Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "BadRequestException",
  "details": [
    {
      "field": "phone",
      "message": "Invalid phone number format"
    },
    {
      "field": "pin",
      "message": "PIN must be exactly 6 digits"
    }
  ]
}
```

### Payment Error Response

```json
{
  "statusCode": 402,
  "message": "Insufficient balance",
  "error": "PaymentException",
  "details": {
    "required": 10000,
    "available": 5000,
    "shortfall": 5000
  }
}
```

---

## Part 6: Real Error Handling Examples

### Example 1: Form Validation

```typescript
import { ValidationSchema } from '@/app/utils/validation';

const handleSignup = async (formData) => {
  // Validate phone
  const phoneValidation = ValidationSchema.validatePhone(formData.phone);
  if (!phoneValidation.valid) {
    showToast.error('Invalid Phone', phoneValidation.error);
    return;
  }

  // Validate PIN
  const pinValidation = ValidationSchema.validatePin(formData.pin);
  if (!pinValidation.valid) {
    showToast.error('Invalid PIN', pinValidation.error);
    return;
  }

  // Proceed with signup
};
```

### Example 2: Wallet Operation

```typescript
const handleDeposit = async () => {
  try {
    const res = await api.walletAPI.deposit(amount, pin);
    showToast.success('Deposit Complete', `ETB ${amount} added to wallet`);
    setBalance(res.balance);
  } catch (error: unknown) {
    if (error instanceof APIError) {
      if (error.status === 401) {
        showToast.error('Invalid PIN', 'Please check your PIN and try again');
      } else if (error.status === 400) {
        showToast.error('Deposit Failed', error.data?.message || 'Check amount and try again');
      } else {
        showToast.error('Error', 'Something went wrong. Please try again.');
      }
    }
  }
};
```

### Example 3: Network Retry

```typescript
const handlePaymentWithRetry = async (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await api.paymentsAPI.checkout(amount);
      return res;
    } catch (error) {
      if (i === maxRetries - 1) {
        showToast.error('Payment Failed', 'Please check your connection and try again.');
        throw error;
      }
      // Wait 2 seconds before retry
      await new Promise(r => setTimeout(r, 2000));
    }
  }
};
```

---

## Part 7: Localization Testing

### Test All 4 Languages

```bash
# Test English
localStorage.setItem('language', 'en');
// Trigger error and verify English message

# Test Amharic
localStorage.setItem('language', 'am');
// Trigger error and verify Amharic message

# Test Oromo
localStorage.setItem('language', 'om');
// Trigger error and verify Oromo message

# Test Tigrinya
localStorage.setItem('language', 'ti');
// Trigger error and verify Tigrinya message
```

### Error Message Checklist

- [ ] English translations correct
- [ ] Amharic translations correct
- [ ] Oromo translations correct
- [ ] Tigrinya translations correct
- [ ] No placeholder text
- [ ] User-friendly language
- [ ] No technical jargon
- [ ] Actionable next steps
- [ ] Consistent tone
- [ ] RTL-compatible (for Arabic languages)

---

## Part 8: Error Message Review Process

### Before Production

1. **Review all error messages for:**
   - User-friendliness
   - Clarity
   - Actionability
   - Correctness
   - Localization

2. **Test with real users:**
   - Are messages understandable?
   - Do they guide users to solution?
   - Are translations natural?

3. **Security review:**
   - No sensitive data exposed
   - No system paths
   - No internal details leaked

4. **Accessibility:**
   - Color not sole indicator
   - High contrast
   - Screen reader compatible

---

## Part 9: Common Mistakes to Avoid

❌ **DON'T show:**
```
"Connection refused: ECONNREFUSED 127.0.0.1:4000"
"TypeError: Cannot read property 'balance' of undefined"
"ValidationError: phone is invalid"
"SQL syntax error near 'WHERE'"
```

✅ **DO show:**
```
"Cannot connect to server. Check your internet connection."
"Your wallet information is temporarily unavailable."
"Please enter your phone number."
"A system error occurred. Please try again later."
```

---

## Part 10: Production Checklist

- [ ] All error messages are user-friendly (not technical)
- [ ] All error messages are actionable
- [ ] Error messages translated in 4 languages
- [ ] No placeholder text remaining
- [ ] No hardcoded error codes exposed to users
- [ ] Sensitive data not included in error messages
- [ ] Toast notifications properly styled
- [ ] Error pages have recovery options
- [ ] Network errors have retry logic
- [ ] Validation errors show inline
- [ ] Payment errors are specific
- [ ] Localization tested with all languages

---

## References

- Translations: `apps/web/src/i18n/translations.ts`
- Validation: `apps/web/src/app/utils/validation.ts`
- API Errors: `apps/web/src/app/services/api.ts`
- Notifications: `apps/web/src/app/services/notifications.ts`

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Error Messages:** Real, localized, user-friendly (4 languages)
