# Supabase Database Fixes - URGENT

## Issue Summary
The `runs` table is missing the `actual_time` column (or has it as wrong type), causing all time tracking to fail.

## Step 1: Check Current Schema

Go to Supabase SQL Editor and run:

```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'runs'
ORDER BY ordinal_position;
```

**Look for:** `actual_time`, `actual_distance`, `actual_pace` columns and their types.

## Step 2: Fix the Runs Table

Copy and paste this entire block into Supabase SQL Editor:

```sql
-- =====================================================
-- Fix runs table - Add missing columns
-- =====================================================

-- Add actual_time as TEXT (format: "HH:MM:SS" or "MM:SS")
DO $$ 
BEGIN
  -- Check if actual_time exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'runs' AND column_name = 'actual_time'
  ) THEN
    -- Check if it's INTERVAL type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'runs' 
        AND column_name = 'actual_time' 
        AND data_type = 'interval'
    ) THEN
      -- Drop the INTERVAL column and recreate as TEXT
      ALTER TABLE runs DROP COLUMN actual_time;
      ALTER TABLE runs ADD COLUMN actual_time TEXT;
    END IF;
  ELSE
    -- Column doesn't exist, create it
    ALTER TABLE runs ADD COLUMN actual_time TEXT;
  END IF;
END $$;

-- Add actual_distance as FLOAT (in kilometers)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS actual_distance FLOAT;

-- Add actual_pace as TEXT (format: "MM:SS" per km)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS actual_pace TEXT;

-- Add RPE if missing
ALTER TABLE runs ADD COLUMN IF NOT EXISTS rpe INTEGER;

-- Add comments if missing
ALTER TABLE runs ADD COLUMN IF NOT EXISTS comments TEXT;

-- Add total_elevation_gain for Strava data
ALTER TABLE runs ADD COLUMN IF NOT EXISTS total_elevation_gain FLOAT;

-- Add calories
ALTER TABLE runs ADD COLUMN IF NOT EXISTS calories INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_completed ON runs(completed);
CREATE INDEX IF NOT EXISTS idx_runs_scheduled_date ON runs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_runs_user_completed ON runs(user_id, completed);
```

## Step 3: Apply Performance Indexes

Run the fixed `supabase-performance-indexes.sql` file.

## Step 4: (Optional) Add Extended Strava Columns

If you want detailed Strava metrics (HR, cadence, elevation), run `supabase-runs-table-updates.sql`.

## Expected Result

After running Step 2, you should be able to:
- ✅ Link Strava activities successfully
- ✅ See actual_time displayed in completed runs
- ✅ See best performances calculated
- ✅ See race predictions based on VDOT

## Verification

Run this to verify the fix worked:

```sql
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'runs'
  AND column_name IN ('actual_time', 'actual_distance', 'actual_pace')
ORDER BY column_name;
```

Should show:
- `actual_distance` | `double precision` (or `numeric`)
- `actual_pace` | `text`
- `actual_time` | `text`

