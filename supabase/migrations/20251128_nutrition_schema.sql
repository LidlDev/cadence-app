-- ============================================
-- NUTRITION TRACKING SCHEMA
-- Run this migration to add nutrition support
-- ============================================

-- ============================================
-- 1. NUTRITION PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  
  -- Goals from onboarding
  primary_goal TEXT NOT NULL, -- 'performance', 'weight_loss', 'weight_gain', 'maintain', 'body_recomposition'
  target_weight NUMERIC, -- Optional target weight in user's preferred unit
  target_weight_unit TEXT DEFAULT 'kg', -- 'kg' or 'lbs'
  
  -- Eating habits
  meals_per_day INTEGER DEFAULT 4, -- 2-6
  eating_window_start TIME, -- For IF support
  eating_window_end TIME,
  cooking_frequency TEXT, -- 'daily', 'few_times_week', 'rarely'
  meal_prep_preference TEXT, -- 'yes', 'no', 'sometimes'
  
  -- Dietary preferences
  diet_type TEXT DEFAULT 'omnivore', -- 'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean'
  allergies JSONB DEFAULT '[]', -- ['gluten', 'dairy', 'nuts', etc.]
  foods_to_avoid TEXT,
  favorite_foods TEXT,
  
  -- Lifestyle factors
  activity_level TEXT DEFAULT 'moderate', -- 'sedentary', 'light', 'moderate', 'active', 'very_active'
  sleep_schedule_start TIME, -- Typical bedtime
  sleep_schedule_end TIME, -- Typical wake time
  hydration_baseline NUMERIC DEFAULT 2.0, -- Liters per day baseline
  supplements TEXT, -- Free text for current supplements
  
  -- Base macro targets (calculated from user data)
  base_calories INTEGER NOT NULL,
  base_protein_g INTEGER NOT NULL,
  base_carbs_g INTEGER NOT NULL,
  base_fat_g INTEGER NOT NULL,
  base_fiber_g INTEGER DEFAULT 30,
  base_sodium_mg INTEGER DEFAULT 2300,
  base_hydration_ml INTEGER DEFAULT 3000,
  
  -- Plan structure
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks INTEGER NOT NULL DEFAULT 12,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. DAILY NUTRITION TARGETS TABLE
-- Stores per-day macro targets adjusted for training
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_nutrition_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nutrition_plan_id UUID REFERENCES public.nutrition_plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  target_date DATE NOT NULL,
  day_type TEXT NOT NULL, -- 'rest', 'easy_run', 'tempo', 'intervals', 'long_run', 'race', 'recovery', 'strength'
  training_description TEXT, -- e.g., "10K Tempo Run" or "Lower Body Strength"
  
  -- Adjusted targets for this specific day
  calories INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  fiber_g INTEGER DEFAULT 30,
  sodium_mg INTEGER DEFAULT 2300,
  hydration_ml INTEGER NOT NULL,
  
  -- Modifiers applied
  carb_modifier NUMERIC DEFAULT 1.0,
  protein_modifier NUMERIC DEFAULT 1.0,
  calorie_modifier NUMERIC DEFAULT 1.0,
  
  -- Notes for race week or special days
  special_notes TEXT,
  is_race_week BOOLEAN DEFAULT FALSE,
  days_until_race INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(nutrition_plan_id, target_date)
);

-- ============================================
-- 3. MEAL TEMPLATES TABLE
-- AI-generated or user-saved meal suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS public.meal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nutrition_plan_id UUID REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'
  description TEXT,
  
  -- Nutritional values
  calories INTEGER NOT NULL,
  protein_g NUMERIC NOT NULL,
  carbs_g NUMERIC NOT NULL,
  fat_g NUMERIC NOT NULL,
  fiber_g NUMERIC DEFAULT 0,
  sodium_mg INTEGER DEFAULT 0,
  
  -- Ingredients as JSON array
  ingredients JSONB DEFAULT '[]', -- [{name, amount, unit, calories, protein_g, carbs_g, fat_g}]
  
  -- Categorization
  day_types JSONB DEFAULT '["any"]', -- Which day types this is good for
  prep_time_minutes INTEGER,
  is_user_favorite BOOLEAN DEFAULT FALSE,
  times_logged INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. MEAL LOGS TABLE
-- User's actual logged meals
-- ============================================
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  nutrition_plan_id UUID REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  
  log_date DATE NOT NULL,
  meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'
  meal_time TIME,
  meal_name TEXT, -- Optional name like "Oatmeal with Berries"
  
  -- Total nutritional values (sum of items)
  total_calories INTEGER DEFAULT 0,
  total_protein_g NUMERIC DEFAULT 0,
  total_carbs_g NUMERIC DEFAULT 0,
  total_fat_g NUMERIC DEFAULT 0,
  total_fiber_g NUMERIC DEFAULT 0,
  total_sodium_mg INTEGER DEFAULT 0,
  
  notes TEXT,
  photo_url TEXT, -- Optional meal photo
  
  -- If logged from a template
  from_template_id UUID REFERENCES public.meal_templates(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

