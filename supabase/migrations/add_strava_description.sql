-- Add strava_description field to runs table
ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS strava_description TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.runs.strava_description IS 'Description from Strava activity (user-added notes on Strava)';

