-- ============================================
-- USER PROFILE ENHANCEMENTS FOR CADENCE
-- Add HR zones, physical attributes, and preferences
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
  
  -- Custom HR zones (if user wants to override calculated zones)
  ADD COLUMN IF NOT EXISTS hr_zone_1_max INTEGER, -- Max HR for Zone 1 (Recovery)
  ADD COLUMN IF NOT EXISTS hr_zone_2_max INTEGER, -- Max HR for Zone 2 (Aerobic)
  ADD COLUMN IF NOT EXISTS hr_zone_3_max INTEGER, -- Max HR for Zone 3 (Tempo)
  ADD COLUMN IF NOT EXISTS hr_zone_4_max INTEGER, -- Max HR for Zone 4 (Threshold)
  -- Zone 5 is anything above zone_4_max
  
  -- Training preferences
  ADD COLUMN IF NOT EXISTS preferred_units TEXT DEFAULT 'metric' CHECK (preferred_units IN ('metric', 'imperial')),
  ADD COLUMN IF NOT EXISTS running_experience TEXT CHECK (running_experience IN ('beginner', 'intermediate', 'advanced', 'elite')),
  ADD COLUMN IF NOT EXISTS training_goal TEXT, -- Free text for current training goal
  ADD COLUMN IF NOT EXISTS weekly_mileage_target DECIMAL(5,2); -- Target weekly mileage/km

-- Add comment to explain HR zones
COMMENT ON COLUMN public.profiles.hr_zone_1_max IS 'Maximum heart rate for Zone 1 (Recovery). Typically 60% of max HR.';
COMMENT ON COLUMN public.profiles.hr_zone_2_max IS 'Maximum heart rate for Zone 2 (Aerobic). Typically 70% of max HR.';
COMMENT ON COLUMN public.profiles.hr_zone_3_max IS 'Maximum heart rate for Zone 3 (Tempo). Typically 80% of max HR.';
COMMENT ON COLUMN public.profiles.hr_zone_4_max IS 'Maximum heart rate for Zone 4 (Threshold). Typically 90% of max HR.';

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
  
  -- If no profile found, return NULL
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate max HR if not set (220 - age formula)
  calculated_max_hr := COALESCE(
    profile_record.max_heart_rate,
    CASE WHEN profile_record.age IS NOT NULL THEN 220 - profile_record.age ELSE 190 END
  );
  
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
-- HELPER FUNCTION: Calculate Max HR from Age
-- ============================================
CREATE OR REPLACE FUNCTION calculate_max_hr_from_age(user_age INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Using the classic 220 - age formula
  -- More accurate formulas exist (e.g., 208 - 0.7 * age) but this is most common
  RETURN 220 - user_age;
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
--   training_goal = 'Sub-3 hour marathon',
--   weekly_mileage_target = 50.0
-- WHERE id = auth.uid();

-- Get your HR zones:
-- SELECT * FROM get_user_hr_zones(auth.uid());

-- ============================================
-- NOTES
-- ============================================
-- 1. HR zones are based on percentage of max heart rate:
--    - Zone 1 (Recovery): < 60% max HR
--    - Zone 2 (Aerobic): 60-70% max HR
--    - Zone 3 (Tempo): 70-80% max HR
--    - Zone 4 (Threshold): 80-90% max HR
--    - Zone 5 (Max): > 90% max HR
--
-- 2. Users can either:
--    a) Set their max HR and let the app calculate zones
--    b) Manually set custom zone thresholds (e.g., from lab testing)
--
-- 3. If age is provided but max HR is not, we use 220 - age formula
--
-- 4. The get_user_hr_zones() function should be used whenever displaying
--    or calculating HR zone data to ensure consistency

