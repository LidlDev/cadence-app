-- ============================================
-- PROFILE ENHANCEMENTS FOR CADENCE RUNNING APP
-- Adds user physical data and HR zone configuration
-- ============================================

-- Add new columns to profiles table
ALTER TABLE public.profiles
  -- Physical attributes
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,2), -- e.g., 70.50 kg
  ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,2), -- e.g., 175.50 cm
  
  -- Heart rate configuration
  ADD COLUMN IF NOT EXISTS max_heart_rate INTEGER, -- User's max HR (can be calculated or manually set)
  ADD COLUMN IF NOT EXISTS resting_heart_rate INTEGER, -- Resting HR for fitness tracking
  
  -- Custom HR zones (BPM thresholds)
  -- If null, we'll use percentage-based zones from max_heart_rate
  ADD COLUMN IF NOT EXISTS hr_zone_1_max INTEGER, -- Zone 1 upper limit (e.g., 120 bpm)
  ADD COLUMN IF NOT EXISTS hr_zone_2_max INTEGER, -- Zone 2 upper limit (e.g., 140 bpm)
  ADD COLUMN IF NOT EXISTS hr_zone_3_max INTEGER, -- Zone 3 upper limit (e.g., 160 bpm)
  ADD COLUMN IF NOT EXISTS hr_zone_4_max INTEGER, -- Zone 4 upper limit (e.g., 175 bpm)
  -- Zone 5 is anything above zone_4_max
  
  -- Preferences
  ADD COLUMN IF NOT EXISTS preferred_units TEXT DEFAULT 'metric' CHECK (preferred_units IN ('metric', 'imperial')),
  ADD COLUMN IF NOT EXISTS running_experience TEXT CHECK (running_experience IN ('beginner', 'intermediate', 'advanced', 'elite')),
  
  -- Training context
  ADD COLUMN IF NOT EXISTS training_goal TEXT, -- e.g., "Sub-3 hour marathon", "Improve 5K time"
  ADD COLUMN IF NOT EXISTS injury_notes TEXT; -- Current or past injuries to be aware of

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.age IS 'User age for VDOT calculations and training recommendations';
COMMENT ON COLUMN public.profiles.gender IS 'Gender for physiological calculations';
COMMENT ON COLUMN public.profiles.weight_kg IS 'Weight in kilograms (converted from lbs if imperial)';
COMMENT ON COLUMN public.profiles.height_cm IS 'Height in centimeters (converted from inches if imperial)';
COMMENT ON COLUMN public.profiles.max_heart_rate IS 'Maximum heart rate (220 - age is default, but can be manually set)';
COMMENT ON COLUMN public.profiles.resting_heart_rate IS 'Resting heart rate for fitness tracking';
COMMENT ON COLUMN public.profiles.hr_zone_1_max IS 'Upper BPM limit for HR Zone 1 (Recovery). If null, calculated as 60% of max HR';
COMMENT ON COLUMN public.profiles.hr_zone_2_max IS 'Upper BPM limit for HR Zone 2 (Aerobic). If null, calculated as 70% of max HR';
COMMENT ON COLUMN public.profiles.hr_zone_3_max IS 'Upper BPM limit for HR Zone 3 (Tempo). If null, calculated as 80% of max HR';
COMMENT ON COLUMN public.profiles.hr_zone_4_max IS 'Upper BPM limit for HR Zone 4 (Threshold). If null, calculated as 90% of max HR';
COMMENT ON COLUMN public.profiles.preferred_units IS 'Preferred unit system: metric (km, kg) or imperial (miles, lbs)';
COMMENT ON COLUMN public.profiles.running_experience IS 'Running experience level for training recommendations';
COMMENT ON COLUMN public.profiles.training_goal IS 'Current training goal for AI context';
COMMENT ON COLUMN public.profiles.injury_notes IS 'Current or past injuries for AI awareness';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);

-- ============================================
-- HELPER FUNCTION: Calculate HR Zones
-- ============================================
-- This function returns the HR zone thresholds for a user
-- If custom zones are set, it uses those; otherwise, it calculates from max HR
CREATE OR REPLACE FUNCTION get_user_hr_zones(user_id UUID)
RETURNS TABLE (
  zone_1_max INTEGER,
  zone_2_max INTEGER,
  zone_3_max INTEGER,
  zone_4_max INTEGER,
  zone_5_min INTEGER
) AS $$
DECLARE
  profile_record RECORD;
  calculated_max_hr INTEGER;
BEGIN
  -- Get user profile
  SELECT * INTO profile_record
  FROM public.profiles
  WHERE id = user_id;
  
  -- Determine max HR (use custom if set, otherwise calculate from age)
  IF profile_record.max_heart_rate IS NOT NULL THEN
    calculated_max_hr := profile_record.max_heart_rate;
  ELSIF profile_record.age IS NOT NULL THEN
    calculated_max_hr := 220 - profile_record.age;
  ELSE
    -- Default to 180 if no data available
    calculated_max_hr := 180;
  END IF;
  
  -- Return custom zones if set, otherwise calculate from max HR
  RETURN QUERY SELECT
    COALESCE(profile_record.hr_zone_1_max, CAST(calculated_max_hr * 0.60 AS INTEGER)),
    COALESCE(profile_record.hr_zone_2_max, CAST(calculated_max_hr * 0.70 AS INTEGER)),
    COALESCE(profile_record.hr_zone_3_max, CAST(calculated_max_hr * 0.80 AS INTEGER)),
    COALESCE(profile_record.hr_zone_4_max, CAST(calculated_max_hr * 0.90 AS INTEGER)),
    COALESCE(profile_record.hr_zone_4_max, CAST(calculated_max_hr * 0.90 AS INTEGER)) + 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EXAMPLE USAGE
-- ============================================
-- Update your profile with HR zones:
-- UPDATE public.profiles
-- SET 
--   age = 30,
--   gender = 'male',
--   weight_kg = 70.5,
--   height_cm = 175.0,
--   max_heart_rate = 190,
--   resting_heart_rate = 55,
--   hr_zone_1_max = 114,  -- 60% of 190
--   hr_zone_2_max = 133,  -- 70% of 190
--   hr_zone_3_max = 152,  -- 80% of 190
--   hr_zone_4_max = 171,  -- 90% of 190
--   preferred_units = 'metric',
--   running_experience = 'intermediate',
--   training_goal = 'Sub-3 hour marathon'
-- WHERE id = auth.uid();

-- Get your HR zones:
-- SELECT * FROM get_user_hr_zones(auth.uid());

-- ============================================
-- NOTES
-- ============================================
-- 1. HR zones are stored as upper limits (max BPM for each zone)
-- 2. Zone 5 is anything above zone_4_max
-- 3. If custom zones are not set, they're calculated from max_heart_rate
-- 4. If max_heart_rate is not set, it's calculated as 220 - age
-- 5. Weight and height are always stored in metric (kg, cm) for consistency
-- 6. UI can convert to imperial for display if preferred_units = 'imperial'

