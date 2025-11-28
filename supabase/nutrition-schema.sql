-- =============================================================================
-- CADENCE APP - NUTRITION FEATURE DATABASE SCHEMA
-- =============================================================================
-- Run this SQL in Supabase SQL Editor to create all nutrition-related tables
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. NUTRITION PLANS
-- =============================================================================
-- Stores the user's nutrition plan with preferences from onboarding

CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  -- Goals (Step 1)
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('performance', 'weight_loss', 'weight_gain', 'maintain', 'body_recomposition')),
  current_weight_kg DECIMAL(5,2),
  target_weight_kg DECIMAL(5,2),
  
  -- Eating Habits (Step 2)
  meals_per_day INTEGER NOT NULL DEFAULT 3 CHECK (meals_per_day BETWEEN 2 AND 6),
  eating_window_start TIME,
  eating_window_end TIME,
  cooking_frequency TEXT CHECK (cooking_frequency IN ('daily', 'few_times_week', 'rarely')),
  meal_prep_preference TEXT CHECK (meal_prep_preference IN ('yes', 'no', 'sometimes')),
  
  -- Dietary Preferences (Step 3)
  diet_type TEXT NOT NULL DEFAULT 'omnivore' CHECK (diet_type IN ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean')),
  allergies TEXT[] DEFAULT '{}',
  foods_to_avoid TEXT,
  favorite_foods TEXT,
  
  -- Lifestyle Factors (Step 4)
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active')),
  sleep_schedule_start TIME,
  sleep_schedule_end TIME,
  hydration_baseline_ml INTEGER DEFAULT 2000,
  supplements TEXT[] DEFAULT '{}',
  
  -- Calculated Base Targets
  base_calories INTEGER,
  base_protein_g INTEGER,
  base_carbs_g INTEGER,
  base_fat_g INTEGER,
  base_fiber_g INTEGER,
  base_sodium_mg INTEGER,
  base_hydration_ml INTEGER,
  
  -- Metadata
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. DAILY NUTRITION TARGETS
-- =============================================================================
-- Per-day macro targets adjusted based on training schedule

CREATE TABLE IF NOT EXISTS daily_nutrition_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nutrition_plan_id UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  
  -- Training context for the day
  day_type TEXT NOT NULL DEFAULT 'rest' CHECK (day_type IN ('rest', 'easy_run', 'tempo', 'intervals', 'long_run', 'race', 'recovery', 'strength', 'cross_training')),
  training_load TEXT CHECK (training_load IN ('none', 'low', 'moderate', 'high', 'very_high')),
  
  -- Adjusted targets for the day
  target_calories INTEGER NOT NULL,
  target_protein_g INTEGER NOT NULL,
  target_carbs_g INTEGER NOT NULL,
  target_fat_g INTEGER NOT NULL,
  target_fiber_g INTEGER,
  target_sodium_mg INTEGER,
  target_hydration_ml INTEGER NOT NULL,
  
  -- Modifiers applied
  calorie_modifier DECIMAL(3,2) DEFAULT 1.00,
  carb_modifier DECIMAL(3,2) DEFAULT 1.00,
  protein_modifier DECIMAL(3,2) DEFAULT 1.00,
  
  -- Meal slot times
  breakfast_time TIME,
  lunch_time TIME,
  dinner_time TIME,
  snack_times TIME[] DEFAULT '{}',
  
  -- AI notes
  ai_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, target_date)
);

-- =============================================================================
-- 3. FOOD ITEMS (cached from API)
-- =============================================================================
-- Cache of food items from FatSecret/OpenFoodFacts to reduce API calls

CREATE TABLE IF NOT EXISTS food_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('fatsecret', 'openfoodfacts', 'manual', 'ai_estimated')),
  barcode TEXT,
  
  name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  
  -- Per 100g or per serving
  serving_size DECIMAL(8,2),
  serving_unit TEXT DEFAULT 'g',
  servings_per_container DECIMAL(6,2),
  
  -- Macros
  calories DECIMAL(8,2),
  protein_g DECIMAL(8,2),
  carbs_g DECIMAL(8,2),
  fat_g DECIMAL(8,2),
  fiber_g DECIMAL(8,2),
  sugar_g DECIMAL(8,2),
  sodium_mg DECIMAL(8,2),
  
  -- Additional micros (optional)
  saturated_fat_g DECIMAL(8,2),
  cholesterol_mg DECIMAL(8,2),
  potassium_mg DECIMAL(8,2),
  vitamin_a_pct DECIMAL(5,2),
  vitamin_c_pct DECIMAL(5,2),
  calcium_pct DECIMAL(5,2),
  iron_pct DECIMAL(5,2),
  
  -- Metadata
  image_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. MEAL LOGS
-- =============================================================================
-- User's logged meals

CREATE TABLE IF NOT EXISTS meal_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,

  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout')),
  meal_time TIME,
  meal_name TEXT,

  -- Totals (calculated from items)
  total_calories DECIMAL(8,2) DEFAULT 0,
  total_protein_g DECIMAL(8,2) DEFAULT 0,
  total_carbs_g DECIMAL(8,2) DEFAULT 0,
  total_fat_g DECIMAL(8,2) DEFAULT 0,
  total_fiber_g DECIMAL(8,2) DEFAULT 0,
  total_sodium_mg DECIMAL(8,2) DEFAULT 0,

  notes TEXT,
  photo_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. MEAL LOG ITEMS
-- =============================================================================
-- Individual food items within a meal

CREATE TABLE IF NOT EXISTS meal_log_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_log_id UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES food_items(id),

  -- If food not in database, store inline
  food_name TEXT NOT NULL,
  food_brand TEXT,

  -- Quantity
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  serving_size DECIMAL(8,2),
  serving_unit TEXT DEFAULT 'g',

  -- Nutrition for this item (quantity * per-serving)
  calories DECIMAL(8,2),
  protein_g DECIMAL(8,2),
  carbs_g DECIMAL(8,2),
  fat_g DECIMAL(8,2),
  fiber_g DECIMAL(8,2),
  sodium_mg DECIMAL(8,2),

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. HYDRATION LOGS
-- =============================================================================
-- Water and beverage tracking

CREATE TABLE IF NOT EXISTS hydration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_time TIME DEFAULT CURRENT_TIME,

  beverage_type TEXT NOT NULL DEFAULT 'water' CHECK (beverage_type IN ('water', 'electrolytes', 'sports_drink', 'coffee', 'tea', 'other')),
  amount_ml INTEGER NOT NULL,

  -- For sports drinks/electrolytes
  sodium_mg INTEGER,
  potassium_mg INTEGER,
  calories INTEGER,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 7. DAILY NUTRITION SUMMARIES
-- =============================================================================
-- Materialized daily totals for fast querying

CREATE TABLE IF NOT EXISTS daily_nutrition_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,

  -- Actual consumed
  actual_calories DECIMAL(8,2) DEFAULT 0,
  actual_protein_g DECIMAL(8,2) DEFAULT 0,
  actual_carbs_g DECIMAL(8,2) DEFAULT 0,
  actual_fat_g DECIMAL(8,2) DEFAULT 0,
  actual_fiber_g DECIMAL(8,2) DEFAULT 0,
  actual_sodium_mg DECIMAL(8,2) DEFAULT 0,
  actual_hydration_ml INTEGER DEFAULT 0,

  -- Targets for the day (denormalized for fast access)
  target_calories INTEGER,
  target_protein_g INTEGER,
  target_carbs_g INTEGER,
  target_fat_g INTEGER,
  target_hydration_ml INTEGER,

  -- Adherence percentages
  calories_pct DECIMAL(5,2),
  protein_pct DECIMAL(5,2),
  carbs_pct DECIMAL(5,2),
  fat_pct DECIMAL(5,2),
  hydration_pct DECIMAL(5,2),

  -- Meals logged count
  meals_logged INTEGER DEFAULT 0,

  -- AI insight for the day
  ai_insight TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, summary_date)
);

-- =============================================================================
-- 8. RECENT FOODS (for quick-add)
-- =============================================================================
-- Track user's frequently used foods for quick logging

CREATE TABLE IF NOT EXISTS user_recent_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES food_items(id),

  -- If not in food_items table
  food_name TEXT NOT NULL,
  food_data JSONB, -- Full nutrition data

  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, food_name)
);

-- =============================================================================
-- 9. USER RECIPES (Custom meals/recipes)
-- =============================================================================
-- Users can combine ingredients into reusable recipes

CREATE TABLE IF NOT EXISTS user_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout', 'other')),

  -- Total nutrition (calculated from ingredients)
  total_calories DECIMAL(8,2) DEFAULT 0,
  total_protein_g DECIMAL(8,2) DEFAULT 0,
  total_carbs_g DECIMAL(8,2) DEFAULT 0,
  total_fat_g DECIMAL(8,2) DEFAULT 0,
  total_fiber_g DECIMAL(8,2) DEFAULT 0,

  -- Serving info
  servings INTEGER DEFAULT 1,

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_favorite BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- =============================================================================
-- 10. USER RECIPE INGREDIENTS
-- =============================================================================
-- Ingredients that make up a user's custom recipe

CREATE TABLE IF NOT EXISTS user_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES food_items(id),

  -- Food info (stored for quick access even if from API)
  food_name TEXT NOT NULL,
  food_brand TEXT,

  -- Quantity
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  serving_size DECIMAL(8,2),
  serving_unit TEXT DEFAULT 'g',

  -- Nutrition per this ingredient amount
  calories DECIMAL(8,2),
  protein_g DECIMAL(8,2),
  carbs_g DECIMAL(8,2),
  fat_g DECIMAL(8,2),
  fiber_g DECIMAL(8,2),

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_id ON nutrition_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_status ON nutrition_plans(status);
CREATE INDEX IF NOT EXISTS idx_daily_targets_user_date ON daily_nutrition_targets(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_daily_targets_plan_id ON daily_nutrition_targets(nutrition_plan_id);
CREATE INDEX IF NOT EXISTS idx_food_items_barcode ON food_items(barcode);
CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);
CREATE INDEX IF NOT EXISTS idx_food_items_source ON food_items(source);
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON meal_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_meal_log_items_meal_id ON meal_log_items(meal_log_id);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_date ON hydration_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON daily_nutrition_summaries(user_id, summary_date);
CREATE INDEX IF NOT EXISTS idx_recent_foods_user_id ON user_recent_foods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recipes_user_id ON user_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recipes_category ON user_recipes(category);
CREATE INDEX IF NOT EXISTS idx_user_recipe_ingredients_recipe_id ON user_recipe_ingredients(recipe_id);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recent_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Nutrition Plans: Users can only access their own
CREATE POLICY "Users can view own nutrition plans" ON nutrition_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition plans" ON nutrition_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition plans" ON nutrition_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nutrition plans" ON nutrition_plans FOR DELETE USING (auth.uid() = user_id);

-- Daily Nutrition Targets: Users can only access their own
CREATE POLICY "Users can view own daily targets" ON daily_nutrition_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily targets" ON daily_nutrition_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily targets" ON daily_nutrition_targets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily targets" ON daily_nutrition_targets FOR DELETE USING (auth.uid() = user_id);

-- Food Items: Public read, authenticated write
CREATE POLICY "Anyone can view food items" ON food_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert food items" ON food_items FOR INSERT TO authenticated WITH CHECK (true);

-- Meal Logs: Users can only access their own
CREATE POLICY "Users can view own meal logs" ON meal_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal logs" ON meal_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal logs" ON meal_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal logs" ON meal_logs FOR DELETE USING (auth.uid() = user_id);

-- Meal Log Items: Access through parent meal_log
CREATE POLICY "Users can view own meal log items" ON meal_log_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM meal_logs WHERE meal_logs.id = meal_log_items.meal_log_id AND meal_logs.user_id = auth.uid()));
CREATE POLICY "Users can insert own meal log items" ON meal_log_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM meal_logs WHERE meal_logs.id = meal_log_items.meal_log_id AND meal_logs.user_id = auth.uid()));
CREATE POLICY "Users can update own meal log items" ON meal_log_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM meal_logs WHERE meal_logs.id = meal_log_items.meal_log_id AND meal_logs.user_id = auth.uid()));
CREATE POLICY "Users can delete own meal log items" ON meal_log_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM meal_logs WHERE meal_logs.id = meal_log_items.meal_log_id AND meal_logs.user_id = auth.uid()));

-- Hydration Logs: Users can only access their own
CREATE POLICY "Users can view own hydration logs" ON hydration_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hydration logs" ON hydration_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hydration logs" ON hydration_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own hydration logs" ON hydration_logs FOR DELETE USING (auth.uid() = user_id);

-- Daily Summaries: Users can only access their own
CREATE POLICY "Users can view own daily summaries" ON daily_nutrition_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily summaries" ON daily_nutrition_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily summaries" ON daily_nutrition_summaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily summaries" ON daily_nutrition_summaries FOR DELETE USING (auth.uid() = user_id);

-- Recent Foods: Users can only access their own
CREATE POLICY "Users can view own recent foods" ON user_recent_foods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recent foods" ON user_recent_foods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recent foods" ON user_recent_foods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recent foods" ON user_recent_foods FOR DELETE USING (auth.uid() = user_id);

-- User Recipes: Users can only access their own
CREATE POLICY "Users can view own recipes" ON user_recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON user_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON user_recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON user_recipes FOR DELETE USING (auth.uid() = user_id);

-- User Recipe Ingredients: Access through parent recipe
CREATE POLICY "Users can view own recipe ingredients" ON user_recipe_ingredients FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_recipes WHERE user_recipes.id = user_recipe_ingredients.recipe_id AND user_recipes.user_id = auth.uid()));
CREATE POLICY "Users can insert own recipe ingredients" ON user_recipe_ingredients FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_recipes WHERE user_recipes.id = user_recipe_ingredients.recipe_id AND user_recipes.user_id = auth.uid()));
CREATE POLICY "Users can update own recipe ingredients" ON user_recipe_ingredients FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_recipes WHERE user_recipes.id = user_recipe_ingredients.recipe_id AND user_recipes.user_id = auth.uid()));
CREATE POLICY "Users can delete own recipe ingredients" ON user_recipe_ingredients FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_recipes WHERE user_recipes.id = user_recipe_ingredients.recipe_id AND user_recipes.user_id = auth.uid()));

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to update daily summary when meals are logged
CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_log_date DATE;
  v_target RECORD;
BEGIN
  -- Get user_id and date from the meal log
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_log_date := OLD.log_date;
  ELSE
    v_user_id := NEW.user_id;
    v_log_date := NEW.log_date;
  END IF;

  -- Get target for the day
  SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_hydration_ml
  INTO v_target
  FROM daily_nutrition_targets
  WHERE user_id = v_user_id AND target_date = v_log_date;

  -- Upsert the daily summary
  INSERT INTO daily_nutrition_summaries (
    user_id, summary_date,
    actual_calories, actual_protein_g, actual_carbs_g, actual_fat_g, actual_fiber_g, actual_sodium_mg,
    target_calories, target_protein_g, target_carbs_g, target_fat_g, target_hydration_ml,
    meals_logged, updated_at
  )
  SELECT
    v_user_id,
    v_log_date,
    COALESCE(SUM(total_calories), 0),
    COALESCE(SUM(total_protein_g), 0),
    COALESCE(SUM(total_carbs_g), 0),
    COALESCE(SUM(total_fat_g), 0),
    COALESCE(SUM(total_fiber_g), 0),
    COALESCE(SUM(total_sodium_mg), 0),
    v_target.target_calories,
    v_target.target_protein_g,
    v_target.target_carbs_g,
    v_target.target_fat_g,
    v_target.target_hydration_ml,
    COUNT(*),
    NOW()
  FROM meal_logs
  WHERE user_id = v_user_id AND log_date = v_log_date
  ON CONFLICT (user_id, summary_date) DO UPDATE SET
    actual_calories = EXCLUDED.actual_calories,
    actual_protein_g = EXCLUDED.actual_protein_g,
    actual_carbs_g = EXCLUDED.actual_carbs_g,
    actual_fat_g = EXCLUDED.actual_fat_g,
    actual_fiber_g = EXCLUDED.actual_fiber_g,
    actual_sodium_mg = EXCLUDED.actual_sodium_mg,
    meals_logged = EXCLUDED.meals_logged,
    updated_at = NOW();

  -- Update percentages
  UPDATE daily_nutrition_summaries SET
    calories_pct = CASE WHEN target_calories > 0 THEN (actual_calories / target_calories) * 100 ELSE 0 END,
    protein_pct = CASE WHEN target_protein_g > 0 THEN (actual_protein_g / target_protein_g) * 100 ELSE 0 END,
    carbs_pct = CASE WHEN target_carbs_g > 0 THEN (actual_carbs_g / target_carbs_g) * 100 ELSE 0 END,
    fat_pct = CASE WHEN target_fat_g > 0 THEN (actual_fat_g / target_fat_g) * 100 ELSE 0 END
  WHERE user_id = v_user_id AND summary_date = v_log_date;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for meal log changes
CREATE TRIGGER trigger_update_daily_summary
AFTER INSERT OR UPDATE OR DELETE ON meal_logs
FOR EACH ROW EXECUTE FUNCTION update_daily_nutrition_summary();

-- Function to update hydration in daily summary
CREATE OR REPLACE FUNCTION update_daily_hydration_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_log_date DATE;
  v_target_hydration INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_log_date := OLD.log_date;
  ELSE
    v_user_id := NEW.user_id;
    v_log_date := NEW.log_date;
  END IF;

  -- Get hydration target
  SELECT target_hydration_ml INTO v_target_hydration
  FROM daily_nutrition_targets
  WHERE user_id = v_user_id AND target_date = v_log_date;

  -- Upsert hydration total
  INSERT INTO daily_nutrition_summaries (user_id, summary_date, actual_hydration_ml, target_hydration_ml, updated_at)
  SELECT v_user_id, v_log_date, COALESCE(SUM(amount_ml), 0), v_target_hydration, NOW()
  FROM hydration_logs
  WHERE user_id = v_user_id AND log_date = v_log_date
  ON CONFLICT (user_id, summary_date) DO UPDATE SET
    actual_hydration_ml = EXCLUDED.actual_hydration_ml,
    target_hydration_ml = COALESCE(EXCLUDED.target_hydration_ml, daily_nutrition_summaries.target_hydration_ml),
    hydration_pct = CASE
      WHEN COALESCE(EXCLUDED.target_hydration_ml, daily_nutrition_summaries.target_hydration_ml) > 0
      THEN (EXCLUDED.actual_hydration_ml::DECIMAL / COALESCE(EXCLUDED.target_hydration_ml, daily_nutrition_summaries.target_hydration_ml)) * 100
      ELSE 0
    END,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for hydration log changes
CREATE TRIGGER trigger_update_hydration_summary
AFTER INSERT OR UPDATE OR DELETE ON hydration_logs
FOR EACH ROW EXECUTE FUNCTION update_daily_hydration_summary();

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
-- Run this entire file in Supabase SQL Editor
-- After running, verify tables exist in Table Editor
-- =============================================================================

