-- =====================================================
-- Fix runs table - Add missing columns
-- Run this to add actual_time, actual_distance, actual_pace
-- =====================================================

-- Add actual_time as TEXT (format: "HH:MM:SS" or "MM:SS")
-- If it exists as INTERVAL, we'll convert it
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

-- Add helpful comments
COMMENT ON COLUMN runs.actual_time IS 'Actual time taken for the run in format HH:MM:SS or MM:SS';
COMMENT ON COLUMN runs.actual_distance IS 'Actual distance run in kilometers';
COMMENT ON COLUMN runs.actual_pace IS 'Actual pace in format MM:SS per kilometer';

