-- ============================================
-- MIGRATION TO FIX SCHEMA
-- Run this to update your existing tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP EXISTING INDEXES (if they exist)
-- ============================================
DROP INDEX IF EXISTS idx_runs_user_date;
DROP INDEX IF EXISTS idx_runs_plan;
DROP INDEX IF EXISTS idx_strava_user;
DROP INDEX IF EXISTS idx_strava_date;
DROP INDEX IF EXISTS idx_nutrition_user_date;
DROP INDEX IF EXISTS idx_strength_user_date;

-- ============================================
-- DROP EXISTING TABLES (in correct order due to foreign keys)
-- ============================================
DROP TABLE IF EXISTS public.runs CASCADE;
DROP TABLE IF EXISTS public.strava_activities CASCADE;
DROP TABLE IF EXISTS public.nutrition_logs CASCADE;
DROP TABLE IF EXISTS public.strength_sessions CASCADE;
DROP TABLE IF EXISTS public.personal_bests CASCADE;
DROP TABLE IF EXISTS public.strava_tokens CASCADE;
DROP TABLE IF EXISTS public.training_plans CASCADE;
-- Keep profiles table as it has your user data

-- ============================================
-- 2. TRAINING PLANS TABLE
-- ============================================
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_race TEXT,
  goal_time TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. RUNS TABLE
-- ============================================
CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  run_type TEXT NOT NULL,
  session_type TEXT,
  planned_distance NUMERIC,
  target_pace TEXT,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  actual_distance NUMERIC,
  actual_pace TEXT,
  actuals TEXT,
  notes TEXT,
  comments TEXT,
  strava_activity_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. STRAVA ACTIVITIES TABLE
-- ============================================
CREATE TABLE public.strava_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_id BIGINT UNIQUE NOT NULL,
  activity_name TEXT,
  activity_type TEXT,
  activity_date DATE,
  distance NUMERIC,
  moving_time TEXT,
  elapsed_time INTEGER,
  pace TEXT,
  elevation_gain NUMERIC,
  avg_hr NUMERIC,
  max_hr NUMERIC,
  hr_zones TEXT,
  avg_speed NUMERIC,
  max_speed NUMERIC,
  calories INTEGER,
  suffer_score INTEGER,
  description TEXT,
  notes TEXT,
  splits TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. NUTRITION LOGS TABLE
-- ============================================
CREATE TABLE public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  week_number INTEGER,
  day_of_week TEXT,
  meals TEXT,
  total_calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fats INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  actuals TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. STRENGTH SESSIONS TABLE
-- ============================================
CREATE TABLE public.strength_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  week_number INTEGER,
  day_of_week TEXT,
  session_type TEXT,
  exercises TEXT,
  load_description TEXT,
  rpe TEXT,
  completed BOOLEAN DEFAULT FALSE,
  actuals TEXT,
  notes TEXT,
  duration_minutes INTEGER DEFAULT 45,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. PERSONAL BESTS TABLE
-- ============================================
CREATE TABLE public.personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  distance TEXT NOT NULL,
  time TEXT NOT NULL,
  pace TEXT,
  date DATE NOT NULL,
  is_target BOOLEAN DEFAULT FALSE,
  race_name TEXT,
  strava_activity_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, distance, is_target)
);

-- ============================================
-- 8. STRAVA TOKENS TABLE
-- ============================================
CREATE TABLE public.strava_tokens (
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
-- CREATE INDEXES
-- ============================================
CREATE INDEX idx_runs_user_date ON public.runs(user_id, scheduled_date);
CREATE INDEX idx_runs_plan ON public.runs(training_plan_id);
CREATE INDEX idx_strava_user ON public.strava_activities(user_id);
CREATE INDEX idx_strava_date ON public.strava_activities(activity_date);
CREATE INDEX idx_nutrition_user_date ON public.nutrition_logs(user_id, log_date);
CREATE INDEX idx_strength_user_date ON public.strength_sessions(user_id, session_date);

