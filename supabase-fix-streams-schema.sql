-- =====================================================
-- Fix Activity Streams Schema Issues
-- =====================================================

-- 1. Add UNIQUE constraint to prevent duplicate streams for same run/type
-- First, delete any existing duplicates
DELETE FROM activity_streams a
USING activity_streams b
WHERE a.id > b.id
  AND a.run_id = b.run_id
  AND a.stream_type = b.stream_type;

-- Add the unique constraint
ALTER TABLE activity_streams
DROP CONSTRAINT IF EXISTS activity_streams_run_id_stream_type_key;

ALTER TABLE activity_streams
ADD CONSTRAINT activity_streams_run_id_stream_type_key
UNIQUE (run_id, stream_type);

-- 2. Update the has_* boolean fields in runs table based on actual stream data
-- This will set the flags to true if streams exist

UPDATE runs r
SET 
  has_heartrate = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'heartrate'
  ),
  has_cadence = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'cadence'
  ),
  has_power = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'watts'
  ),
  has_gps = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'latlng'
  ),
  has_time_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'time'
  ),
  has_distance_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'distance'
  ),
  has_latlng_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'latlng'
  ),
  has_altitude_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'altitude'
  ),
  has_velocity_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'velocity_smooth'
  ),
  has_grade_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'grade_smooth'
  ),
  has_temp_stream = EXISTS (
    SELECT 1 FROM activity_streams 
    WHERE run_id = r.id AND stream_type = 'temp'
  )
WHERE strava_activity_id IS NOT NULL;

-- 3. Verify the changes
SELECT 
  'Streams with NULL stream_type' as check_name,
  COUNT(*) as count
FROM activity_streams
WHERE stream_type IS NULL

UNION ALL

SELECT 
  'Duplicate streams (run_id + stream_type)' as check_name,
  COUNT(*) - COUNT(DISTINCT (run_id, stream_type)) as count
FROM activity_streams

UNION ALL

SELECT 
  'Runs with streams' as check_name,
  COUNT(DISTINCT run_id) as count
FROM activity_streams

UNION ALL

SELECT 
  'Total stream records' as check_name,
  COUNT(*) as count
FROM activity_streams;

