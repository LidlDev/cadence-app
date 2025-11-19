-- Add detailed Strava fields to runs table
-- These fields store the rich data from Strava activities

-- Heart rate data
ALTER TABLE runs ADD COLUMN IF NOT EXISTS average_hr INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS max_hr INTEGER;

-- Elevation data
ALTER TABLE runs ADD COLUMN IF NOT EXISTS elevation_gain NUMERIC;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS elevation_loss NUMERIC;

-- Cadence data
ALTER TABLE runs ADD COLUMN IF NOT EXISTS average_cadence NUMERIC;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS max_cadence NUMERIC;

-- Power data (if available)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS average_watts NUMERIC;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS max_watts NUMERIC;

-- Calories
ALTER TABLE runs ADD COLUMN IF NOT EXISTS calories INTEGER;

-- Temperature
ALTER TABLE runs ADD COLUMN IF NOT EXISTS average_temp NUMERIC;

-- Suffer score (Strava's intensity metric)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS suffer_score INTEGER;

-- Moving time vs elapsed time
ALTER TABLE runs ADD COLUMN IF NOT EXISTS moving_time INTEGER; -- seconds
ALTER TABLE runs ADD COLUMN IF NOT EXISTS elapsed_time INTEGER; -- seconds

-- Achievement count
ALTER TABLE runs ADD COLUMN IF NOT EXISTS achievement_count INTEGER;

-- PR count
ALTER TABLE runs ADD COLUMN IF NOT EXISTS pr_count INTEGER;

-- Kudos count
ALTER TABLE runs ADD COLUMN IF NOT EXISTS kudos_count INTEGER;

-- Comment count
ALTER TABLE runs ADD COLUMN IF NOT EXISTS comment_count INTEGER;

-- Perceived exertion (from Strava)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS perceived_exertion NUMERIC;

-- Device name
ALTER TABLE runs ADD COLUMN IF NOT EXISTS device_name TEXT;

-- Gear ID (shoes, etc.)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS gear_id TEXT;

-- Average speed (m/s)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS average_speed NUMERIC;

-- Max speed (m/s)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS max_speed NUMERIC;

-- Create index on strava_activity_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_runs_strava_activity_id ON runs(strava_activity_id);

-- Create index on user_id and completed for dashboard queries
CREATE INDEX IF NOT EXISTS idx_runs_user_completed ON runs(user_id, completed);

-- Create index on user_id and scheduled_date for calendar queries
CREATE INDEX IF NOT EXISTS idx_runs_user_scheduled_date ON runs(user_id, scheduled_date);

