-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training Plans table
CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_race TEXT,
  goal_distance NUMERIC,
  goal_time INTERVAL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks INTEGER NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, paused
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Runs table
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  run_type TEXT NOT NULL, -- Easy Run, Tempo Run, Quality Run, Long Run
  session_type TEXT, -- Fartlek, Intervals, etc.
  planned_distance NUMERIC NOT NULL,
  planned_pace TEXT,
  target_pace TEXT,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  actual_distance NUMERIC,
  actual_pace TEXT,
  actual_time INTERVAL,
  rpe INTEGER, -- Rate of Perceived Exertion (1-10)
  notes TEXT,
  comments TEXT,
  strava_activity_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strength Training table
CREATE TABLE IF NOT EXISTS public.strength_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  session_type TEXT,
  exercises JSONB, -- Array of exercises with sets, reps, weight
  duration INTEGER, -- minutes
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nutrition table
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  meal_type TEXT, -- breakfast, lunch, dinner, snack
  description TEXT,
  calories INTEGER,
  protein NUMERIC,
  carbs NUMERIC,
  fats NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strava Activities table (synced data)
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  type TEXT,
  distance NUMERIC,
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE,
  average_speed NUMERIC,
  max_speed NUMERIC,
  average_heartrate NUMERIC,
  max_heartrate NUMERIC,
  suffer_score INTEGER,
  calories NUMERIC,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strava Tokens table
CREATE TABLE IF NOT EXISTS public.strava_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  athlete_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personal Bests table
CREATE TABLE IF NOT EXISTS public.personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  distance NUMERIC NOT NULL,
  distance_unit TEXT DEFAULT 'km',
  time INTERVAL NOT NULL,
  pace TEXT,
  achieved_date DATE NOT NULL,
  race_name TEXT,
  strava_activity_id BIGINT,
  is_target BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own training plans" ON public.training_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own training plans" ON public.training_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own training plans" ON public.training_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own training plans" ON public.training_plans FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables
CREATE POLICY "Users can manage own runs" ON public.runs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own strength sessions" ON public.strength_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own nutrition logs" ON public.nutrition_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own strava activities" ON public.strava_activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own strava tokens" ON public.strava_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own personal bests" ON public.personal_bests FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_runs_user_id ON public.runs(user_id);
CREATE INDEX idx_runs_training_plan_id ON public.runs(training_plan_id);
CREATE INDEX idx_runs_scheduled_date ON public.runs(scheduled_date);
CREATE INDEX idx_strava_activities_user_id ON public.strava_activities(user_id);
CREATE INDEX idx_strava_activities_start_date ON public.strava_activities(start_date);

