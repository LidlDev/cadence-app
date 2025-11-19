-- =====================================================
-- Cadence App - Runs Table Updates
-- Add fields for Strava integration and granular data
-- =====================================================

-- Add Strava-related columns to runs table
ALTER TABLE runs 
  ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS strava_synced BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS strava_sync_date TIMESTAMPTZ,
  
  -- Heart rate data
  ADD COLUMN IF NOT EXISTS average_hr INTEGER,
  ADD COLUMN IF NOT EXISTS max_hr INTEGER,
  ADD COLUMN IF NOT EXISTS has_heartrate BOOLEAN DEFAULT FALSE,
  
  -- Cadence data
  ADD COLUMN IF NOT EXISTS average_cadence FLOAT,
  ADD COLUMN IF NOT EXISTS has_cadence BOOLEAN DEFAULT FALSE,
  
  -- Power data (for cycling/running power meters)
  ADD COLUMN IF NOT EXISTS average_watts FLOAT,
  ADD COLUMN IF NOT EXISTS max_watts INTEGER,
  ADD COLUMN IF NOT EXISTS kilojoules FLOAT,
  ADD COLUMN IF NOT EXISTS has_power BOOLEAN DEFAULT FALSE,
  
  -- Temperature
  ADD COLUMN IF NOT EXISTS average_temp INTEGER,
  
  -- Elevation
  ADD COLUMN IF NOT EXISTS elev_high FLOAT,
  ADD COLUMN IF NOT EXISTS elev_low FLOAT,
  
  -- Speed
  ADD COLUMN IF NOT EXISTS max_speed FLOAT,
  
  -- Suffer score (Strava's proprietary metric)
  ADD COLUMN IF NOT EXISTS suffer_score INTEGER,
  
  -- Device info
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  
  -- GPS data availability
  ADD COLUMN IF NOT EXISTS has_gps BOOLEAN DEFAULT FALSE,
  
  -- Streams availability flags
  ADD COLUMN IF NOT EXISTS has_time_stream BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_distance_stream BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_latlng_stream BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_altitude_stream BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_velocity_stream BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_grade_stream BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_temp_stream BOOLEAN DEFAULT FALSE;

-- Create index on strava_activity_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_runs_strava_activity_id ON runs(strava_activity_id);
CREATE INDEX IF NOT EXISTS idx_runs_strava_synced ON runs(strava_synced);

-- Add comment to table
COMMENT ON COLUMN runs.strava_activity_id IS 'Strava activity ID for synced activities';
COMMENT ON COLUMN runs.strava_synced IS 'Whether this run has been synced with Strava data';
COMMENT ON COLUMN runs.suffer_score IS 'Strava suffer score (0-10 scale based on HR zones)';

