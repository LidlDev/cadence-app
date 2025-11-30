# Fix Dates in Supabase

## Problem
Dates were imported with wrong years:
- November/December runs stored as **2024** (should be **2025**)
- January runs stored as **2025** (should be **2026**)

## Solution
You have **two options** to fix this:

---

## Option 1: Run SQL in Supabase (RECOMMENDED - Faster)

### Steps:
1. Go to **https://wfdqshevlvuatzhpudqr.supabase.co**
2. Click **"SQL Editor"** → **"New Query"**
3. Copy **ALL** content from `cadence-app/supabase-fix-dates.sql`
4. Paste and click **"Run"**

### What it does:
- Updates all dates in `runs` table (+1 year)
- Updates all dates in `strava_activities` table (+1 year)
- Updates all dates in `nutrition_logs` table (+1 year)
- Updates all dates in `strength_sessions` table (+1 year)
- Updates all dates in `personal_bests` table (+1 year)
- Shows verification query at the end

### Expected Result:
```
✓ Runs: 2025-11-03 to 2026-01-26
✓ Strava Activities: 2025-11-14 to 2026-01-14
✓ Nutrition Logs: 2025-11-03 to 2026-01-26
✓ Strength Sessions: 2025-11-03 to 2026-01-26
```

---

## Option 2: Run TypeScript Script

### Steps:
```bash
cd cadence-app
npx tsx scripts/fix-dates.ts
```

### What it does:
- Fetches all records from each table
- Updates dates by adding 1 year
- Shows progress for each record
- Displays summary at the end

### Expected Output:
```
🔧 Fixing dates in Supabase...

📅 Updating runs table...
  ✓ Updated run xxx: 2024-11-03 → 2025-11-03
  ✓ Updated run xxx: 2024-11-04 → 2025-11-04
  ...
✅ Updated 48 runs

📅 Updating strava_activities table...
  ✓ Updated activity xxx: 2024-11-14 → 2025-11-14
  ...
✅ Updated 20 activities

📅 Updating nutrition_logs table...
  ✓ Updated nutrition log xxx: 2024-11-03 → 2025-11-03
  ...
✅ Updated 48 nutrition logs

📅 Updating strength_sessions table...
  ✓ Updated strength session xxx: 2024-11-03 → 2025-11-03
  ...
✅ Updated 36 strength sessions

🎉 All dates fixed successfully!

📊 Summary:
  - Runs: 48
  - Strava Activities: 20
  - Nutrition Logs: 48
  - Strength Sessions: 36
  - Total: 152
```

---

## After Running Either Option

### Verify the Fix:
1. Refresh your browser at http://localhost:3000
2. Go to `/runs`
3. Check that dates now show:
   - November runs: **2025**
   - December runs: **2025**
   - January runs: **2026**

### Check Dashboard:
1. Go to `/dashboard`
2. Month selector should show:
   - November 2025
   - December 2025
   - January 2026

---

## Why This Happened

The original import script (`scripts/import-csv-data.ts`) had this logic:
```typescript
// Assumed Nov/Dec = 2024, Jan = 2025
const year = month === 'November' || month === 'December' ? 2024 : 2025
```

But your training plan is actually:
- **November 2025** - Week 1-4
- **December 2025** - Week 5-8
- **January 2026** - Week 9-12

---

## Files Created

- `supabase-fix-dates.sql` - SQL migration (Option 1)
- `scripts/fix-dates.ts` - TypeScript script (Option 2)
- `FIX-DATES-INSTRUCTIONS.md` - This file

---

## Recommendation

**Use Option 1 (SQL)** - It's faster and updates all records in one transaction.

**Use Option 2 (TypeScript)** - If you want to see detailed progress for each record.

Both options are safe and will produce the same result! ✅

