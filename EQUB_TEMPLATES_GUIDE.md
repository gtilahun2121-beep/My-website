# QalNet Equb Preset Templates Guide

**Date:** August 29, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

QalNet includes 7 professionally-configured preset equb templates covering real-world use cases. These are not demo data - they represent actual equb configurations used by Ethiopian savings groups.

---

## Part 1: Available Templates

### 1. Daily 300 ETB - Daily Savers

```
Contribution:     300 ETB per day
Total Members:    103
Total Duration:   103 days (~3.5 months)
Total Pot:        30,900 ETB per round
Winner Selection: Lottery
Visibility:       Public
Use Case:         Small daily savings, accessible to all income levels
```

**Who should join:**
- Daily wage earners
- Street vendors
- Small traders
- Anyone wanting regular forced savings

**Timeline:**
- Day 1-103: Members contribute daily
- Each day one random member could be selected as winner
- Winner receives full 30,900 ETB pot

---

### 2. Daily 1,500 ETB - High Daily Savers

```
Contribution:     1,500 ETB per day
Total Members:    103
Total Duration:   103 days (~3.5 months)
Total Pot:        154,500 ETB per round
Winner Selection: Lottery
Visibility:       Public
Use Case:         Aggressive daily savings for business owners
```

**Who should join:**
- Business owners
- Traders with good cash flow
- Professionals wanting rapid capital buildup

**Timeline:**
- Day 1-103: Members contribute 1,500 daily
- High velocity rounds - winners get 154,500 ETB

---

### 3. Weekly 2,000 ETB - Standard Weekly

```
Contribution:     2,000 ETB per week
Total Members:    12
Total Duration:   12 weeks (~3 months)
Total Pot:        24,000 ETB per round
Winner Selection: Lottery
Visibility:       Public
Use Case:         Standard weekly savings - most popular model
```

**Who should join:**
- Salaried employees
- Professionals
- Anyone with weekly income
- Most traditional equb members

**Timeline:**
- Week 1-12: Members contribute 2,000 per week
- Each week one member randomly selected
- Winner receives full 24,000 ETB pot
- Most balanced cycle

---

### 4. Monthly 10,000 ETB - Premium Monthly

```
Contribution:     10,000 ETB per month
Total Members:    6
Total Duration:   6 months
Total Pot:        60,000 ETB per round
Winner Selection: Lottery
Visibility:       Public
Use Case:         Large pot for major purchases/investments
```

**Who should join:**
- Business owners
- High-income professionals
- Organizations/cooperatives
- Those planning major expenses

**Timeline:**
- Month 1-6: Members contribute 10,000 per month
- Monthly draw for winner
- Winner receives 60,000 ETB for significant goals

---

### 5. Weekly 2,000 ETB (FCFS) - First-Come-First-Serve

```
Contribution:     2,000 ETB per week
Total Members:    12
Total Duration:   12 weeks
Total Pot:        24,000 ETB per round
Winner Selection: First-Come-First-Serve (FCFS)
Visibility:       Public
Use Case:         Rewards early/reliable payers
```

**Who should join:**
- Reliable/disciplined savers
- Those who prefer certainty over luck
- Members who always pay on time

**Difference from Lottery:**
- NOT random draw
- Winner is whoever paid first in the round
- More transparent - no luck involved
- Encourages punctual payments
- Builds financial discipline

**Timeline:**
- Week 1: First payer to complete gets position #1
- Week 2: Next payer gets position #2
- Week 12: Last payer gets position #12
- Payouts follow the order they paid

---

### 6. Corporate Fund 5,000 ETB - Employee Savings

```
Contribution:     5,000 ETB per month
Total Members:    10
Total Duration:   10 months
Total Pot:        50,000 ETB per round
Winner Selection: Lottery
Visibility:       Corporate (restricted to organization)
Use Case:         Employee benefit programs
```

**Who should join:**
- Organization employees only
- Company-sponsored savings
- Internal benefit program

**Corporate Features:**
- Restricted to organization members
- Company can sponsor/subsidize contributions
- HR can monitor participation
- Encourages employee engagement
- Tax-deductible in many cases

**Example:**
- Company XYZ creates equb for 50 employees
- Each contributes 5,000 ETB/month
- 10 selected winners get 50,000 ETB for emergencies/goals
- Builds workplace community

---

### 7. Private Circle 3,000 ETB - Friends & Family

```
Contribution:     3,000 ETB per month
Total Members:    6
Total Duration:   6 months
Total Pot:        18,000 ETB per round
Winner Selection: Lottery
Visibility:       Private (invite-only)
Use Case:         Closed circles of trusted people
```

**Who should join:**
- Tight-knit friend groups
- Family members
- People who trust each other
- Closed communities

**Private Features:**
- Not visible in public equb list
- Only invited members can join
- Host controls membership
- More intimate, personal setting
- No strangers

**Example:**
- Group of 6 childhood friends creates equb
- Each month 3,000 ETB is collected
- One friend receives 18,000 ETB per month
- Used for weddings, home improvements, emergencies

---

## Part 2: Creating Equbs from Templates

### User Flow

```
1. User navigates to "Create Equb"
2. See "Quick Start - Popular Templates" section
3. Choose template card
4. Form auto-fills with template values
5. Can customize if needed (optional)
6. Create equb with template values
```

### Template Auto-Fill

When user selects a template, form fills with:
- ✅ Contribution amount
- ✅ Total rounds/duration
- ✅ Cycle type (daily/weekly/monthly)
- ✅ Winner selection method
- ✅ Visibility (public/private/corporate)

User can still modify if desired.

---

## Part 3: Template Data Structure

### Database Table

```sql
CREATE TABLE equb_preset_templates (
  id                  VARCHAR(50) PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  description         TEXT,
  contribution_amount NUMERIC(15, 2) NOT NULL,
  total_rounds        INTEGER NOT NULL,
  cycle_days          INTEGER NOT NULL,
  cycle_type          VARCHAR(20) NOT NULL,
  winner_selection    VARCHAR(20) NOT NULL,
  equb_type           VARCHAR(20) NOT NULL,
  is_featured         BOOLEAN NOT NULL,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMP,
  updated_at          TIMESTAMP
);
```

### API Response

```json
{
  "templates": [
    {
      "id": "daily-300-103",
      "name": "Daily 300 ETB",
      "description": "Daily contribution for 103 days",
      "contribution_amount": 300,
      "total_rounds": 103,
      "cycle_days": 1,
      "cycle_type": "daily",
      "winner_selection": "lottery",
      "equb_type": "public",
      "is_featured": true,
      "display_order": 1
    },
    ...
  ]
}
```

---

## Part 4: Template Selection Best Practices

### For Different User Profiles

**Conservative Savers:**
- Daily 300 ETB (low commitment)
- Forced regular saving habit
- Good for learners

**Regular Income (Salaried):**
- Weekly 2,000 ETB (classic)
- Monthly 10,000 ETB (premium)
- Aligns with paycheck cycles

**Business Owners:**
- Daily 1,500 ETB (high velocity)
- Monthly 10,000 ETB (large pot)
- Flexible cash flow

**Risk-Averse:**
- FCFS Weekly 2,000 ETB
- Winner by payment order (not luck)
- Predictable outcomes

**Organizations:**
- Corporate 5,000 ETB
- Employee benefit
- HR integration

**Close Circles:**
- Private 3,000 ETB
- Trust-based
- Invite-only members

---

## Part 5: Adding New Templates

### Step 1: Design Template

Decide on:
- Contribution amount
- Duration (days/weeks/months)
- Member count (derived from duration)
- Winner selection method
- Visibility type
- Use case

### Step 2: Create Template ID

```sql
-- Format: {category}-{amount}-{rounds}
Examples:
- daily-300-103      (300 ETB daily for 103 days)
- weekly-2000-12     (2000 ETB weekly for 12 weeks)
- monthly-10000-6    (10000 ETB monthly for 6 months)
```

### Step 3: Insert into Database

```sql
INSERT INTO equb_preset_templates (
  id,
  name,
  description,
  contribution_amount,
  total_rounds,
  cycle_days,
  cycle_type,
  winner_selection,
  equb_type,
  is_featured,
  display_order
) VALUES (
  'weekly-5000-12',
  'Weekly 5,000 ETB',
  'Premium weekly equb for larger contributions',
  5000,
  12,
  7,
  'weekly',
  'lottery',
  'public',
  TRUE,
  6
);
```

### Step 4: Deploy

- Migration included in database setup
- Frontend automatically fetches and displays
- No code changes needed

---

## Part 6: Real-World Usage Examples

### Example 1: Market Trader

**Profile:** Abebe - vegetable vendor, ~500 ETB daily income

**Journey:**
```
1. Finds QalNet, sees templates
2. Selects "Daily 300 ETB" template
3. Creates equb with template values
4. Invites 4 other vendors
5. All contribute 300 ETB daily
6. After 103 days: payout = 30,900 ETB
7. Could pay for: new shop, inventory, equipment
```

---

### Example 2: Corporate Savings Program

**Profile:** ABC Software Company, 50 employees

**Journey:**
```
1. HR manager creates QalNet account
2. Selects "Corporate 5,000 ETB" template
3. Creates equb for company employees
4. Sends invite to all 50 staff
5. Monthly collection: 250,000 ETB
6. Monthly payout: 50,000 ETB to one employee
7. Used for: loans, wedding funds, medical, education
```

---

### Example 3: Tight Friend Group

**Profile:** University friends, 6-person group

**Journey:**
```
1. Tinu suggests QalNet to friends
2. Group selects "Private 3,000 ETB" template
3. Creates private equb (not public)
4. Only invited friends can see/join
5. Monthly 18,000 ETB pot
6. One friend selected randomly each month
7. Used for: birthday gifts, emergency help, fun activities
```

---

## Part 7: Template Customization

### Pre-loaded Values (Can be Modified)

✅ **Can be changed:**
- Equb name (group calls it something different)
- Description (add context)
- Contribution amount (±20% acceptable)
- Duration (extend or shorten)

❌ **Should NOT change:**
- Template ID (immutable reference)
- Core structure (changes template meaning)
- Historical data

### When to Customize

**Good reasons to customize:**
- Add organization name
- Adjust for local preferences
- Increase contribution for inflation
- Extend duration for large goals

**Not recommended:**
- Radical changes (defeats template purpose)
- Arbitrary modifications
- Changing core parameters

---

## Part 8: Analytics & Reporting

### Template Popularity

```sql
-- Track which templates are most used
SELECT 
  preset_template_id,
  COUNT(*) as equb_count,
  AVG(contribution_amount) as avg_contribution,
  SUM(members) as total_members
FROM equb_groups
WHERE is_preset = TRUE
GROUP BY preset_template_id
ORDER BY equb_count DESC;
```

### Result Example:

```
Template              | Equbs | Avg Contribution | Total Members
---------------------|-------|------------------|---------------
weekly-2000-12        | 1,245 | 2,000 ETB        | 14,940
daily-300-103         | 892   | 300 ETB          | 91,836
monthly-10000-6       | 456   | 10,000 ETB       | 2,736
corporate-5000-10     | 123   | 5,000 ETB        | 1,230
fcfs-2000-12          | 89    | 2,000 ETB        | 1,068
private-3000-6        | 234   | 3,000 ETB        | 1,404
daily-1500-103        | 67    | 1,500 ETB        | 6,901
```

---

## Part 9: Production Checklist

- [x] All 7 templates have real use cases
- [x] Templates loaded from database
- [x] Frontend fetches and displays templates
- [x] User can select template to auto-fill form
- [x] No demo/fake templates
- [x] Templates cover diverse income levels
- [x] Templates include all winner selection types
- [x] Templates include all visibility types
- [x] Localization support (EN/AM/OM/TI)
- [x] Mobile responsive display
- [x] Templates can be extended/customized

---

## Part 10: Future Enhancements

### Planned Features

**Seasonal Templates:**
- Holiday savings (Meskel, Timkat)
- School year (Sept-June)
- Agricultural cycles

**User-Created Templates:**
- Allow experienced users to create templates
- Community shares popular configurations
- Voting on most useful templates

**AI Recommendations:**
- Suggest template based on user income
- Predict success rate
- Match with similar users

---

## References

- Frontend: `apps/web/src/app/components/PresetTemplates.tsx`
- Create Page: `apps/web/src/app/create-equb/page.tsx`
- API Service: `apps/web/src/app/services/api.ts`
- Database: `apps/backend/database/migrations/20260829_add_fcfs_corporate_presets.sql`

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Templates:** 7 real, professionally-configured for various user profiles
