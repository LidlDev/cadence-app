-- ============================================
-- CORRECTED SCHEMA FOR CADENCE RUNNING TRACKER
-- This matches your CSV data structure
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (already exists, but ensure it's correct)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TRAINING PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_race TEXT,
  goal_time TEXT, -- Changed from INTERVAL to TEXT for easier handling
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. RUNS TABLE (matches your CSV structure)
-- ============================================
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  run_type TEXT NOT NULL, -- Easy Run, Tempo Run, Quality Run, Long Run
  session_type TEXT, -- Session/Exercise from CSV
  planned_distance NUMERIC, -- Can be null for Fartlek/Intervals
  target_pace TEXT,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  actual_distance NUMERIC,
  actual_pace TEXT,
  actuals TEXT, -- Full actuals string from CSV
  notes TEXT, -- Comments from CSV
  comments TEXT, -- Additional comments
  strava_activity_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. STRAVA ACTIVITIES TABLE (matches Strava export)
-- ============================================
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_id BIGINT UNIQUE NOT NULL,
  activity_name TEXT,
  activity_type TEXT,
  activity_date DATE,
  distance NUMERIC,
  moving_time TEXT, -- Store as text like "41:02:00"
  elapsed_time INTEGER, -- Seconds
  pace TEXT, -- Pace per km
  elevation_gain NUMERIC,
  avg_hr NUMERIC,
  max_hr NUMERIC,
  hr_zones TEXT, -- Store HR zones as text
  avg_speed NUMERIC,
  max_speed NUMERIC,
  calories INTEGER,
  suffer_score INTEGER,
  description TEXT,
  notes TEXT,
  splits TEXT, -- Store splits as text
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. NUTRITION LOGS TABLE (matches your CSV)
-- ============================================
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  week_number INTEGER,
  day_of_week TEXT,
  meals TEXT, -- Example Meals from CSV
  total_calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fats INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  actuals TEXT,
  notes TEXT, -- Comments from CSV
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. STRENGTH SESSIONS TABLE (matches your CSV)
-- ============================================
CREATE TABLE IF NOT EXISTS public.strength_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  week_number INTEGER,
  day_of_week TEXT,
  session_type TEXT, -- Type from CSV (Foundation & Form, etc.)
  exercises TEXT, -- Session/Exercise from CSV
  load_description TEXT, -- Load from CSV
  rpe TEXT, -- RPE from CSV (can be range like "6-7")
  completed BOOLEAN DEFAULT FALSE,
  actuals TEXT,
  notes TEXT, -- Comments from CSV
  duration_minutes INTEGER DEFAULT 45,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. PERSONAL BESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  distance TEXT NOT NULL, -- "5K", "10K", "Half Marathon", "Marathon"
  time TEXT NOT NULL, -- "00:26:01"
  pace TEXT, -- "5:11"
  date DATE NOT NULL,
  is_target BOOLEAN DEFAULT FALSE,
  race_name TEXT,
  strava_activity_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, distance, is_target)
);

-- ============================================
-- 8. STRAVA TOKENS TABLE (for OAuth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.strava_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  athlete_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_runs_user_date ON public.runs(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_runs_plan ON public.runs(training_plan_id);
CREATE INDEX IF NOT EXISTS idx_strava_user ON public.strava_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_date ON public.strava_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON public.nutrition_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_strength_user_date ON public.strength_sessions(user_id, session_date);

