-- Fix dates in runs table: 2024 → 2025, 2025 → 2026
-- This corrects the year offset issue from the initial import

-- Update runs scheduled for 2024 to 2025
UPDATE runs
SET scheduled_date = (scheduled_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM scheduled_date) = 2024;

-- Update runs scheduled for 2025 to 2026
UPDATE runs
SET scheduled_date = (scheduled_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM scheduled_date) = 2025;

-- Update strava_activities from 2024 to 2025
UPDATE strava_activities
SET activity_date = (activity_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM activity_date) = 2024;

-- Update strava_activities from 2025 to 2026
UPDATE strava_activities
SET activity_date = (activity_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM activity_date) = 2025;

-- Update nutrition_logs from 2024 to 2025
UPDATE nutrition_logs
SET log_date = (log_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM log_date) = 2024;

-- Update nutrition_logs from 2025 to 2026
UPDATE nutrition_logs
SET log_date = (log_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM log_date) = 2025;

-- Update strength_sessions from 2024 to 2025
UPDATE strength_sessions
SET session_date = (session_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM session_date) = 2024;

-- Update strength_sessions from 2025 to 2026
UPDATE strength_sessions
SET session_date = (session_date::date + INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM session_date) = 2025;

-- Update personal_bests dates (stored as TEXT, need to parse and update)
-- This assumes format like "2024-11-03" or similar
UPDATE personal_bests
SET date = (date::date + INTERVAL '1 year')::text
WHERE date ~ '^\d{4}-\d{2}-\d{2}$' 
  AND EXTRACT(YEAR FROM date::date) = 2024;

UPDATE personal_bests
SET date = (date::date + INTERVAL '1 year')::text
WHERE date ~ '^\d{4}-\d{2}-\d{2}$' 
  AND EXTRACT(YEAR FROM date::date) = 2025;

-- Verify the changes
SELECT
  'runs' as table_name,
  COUNT(*) as total_records,
  MIN(scheduled_date) as earliest_date,
  MAX(scheduled_date) as latest_date
FROM runs
UNION ALL
SELECT
  'strava_activities',
  COUNT(*),
  MIN(activity_date),
  MAX(activity_date)
FROM strava_activities
UNION ALL
SELECT
  'nutrition_logs',
  COUNT(*),
  MIN(log_date),
  MAX(log_date)
FROM nutrition_logs
UNION ALL
SELECT
  'strength_sessions',
  COUNT(*),
  MIN(session_date),
  MAX(session_date)
FROM strength_sessions;

