-- =============================================================================
-- NUTRITION FAVOURITES SCHEMA
-- Adds favourites functionality for ingredients (food items) 
-- Note: user_recipes already has is_favorite column
-- =============================================================================

-- =============================================================================
-- 1. USER FOOD FAVOURITES TABLE
-- =============================================================================
-- Track user's favourite food items/ingredients for quick access
-- This is separate from user_recent_foods which tracks recently used items

CREATE TABLE IF NOT EXISTS user_food_favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Reference to food_items if the food is in our database
  food_item_id UUID REFERENCES food_items(id) ON DELETE CASCADE,
  
  -- Food data stored for quick access (even if from external API like FatSecret)
  food_name TEXT NOT NULL,
  food_brand TEXT,
  
  -- Nutrition data (per serving)
  calories DECIMAL(8,2),
  protein_g DECIMAL(8,2),
  carbs_g DECIMAL(8,2),
  fat_g DECIMAL(8,2),
  fiber_g DECIMAL(8,2),
  
  -- Serving info
  serving_size DECIMAL(8,2),
  serving_unit TEXT DEFAULT 'g',
  
  -- Source tracking
  source TEXT CHECK (source IN ('fatsecret', 'openfoodfacts', 'manual', 'ai_estimated', 'recipe')),
  external_id TEXT, -- External API ID for re-fetching if needed
  
  -- Metadata
  notes TEXT, -- User can add notes about this favourite (e.g., "use for breakfast")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate favourites
  UNIQUE(user_id, food_name, food_brand)
);

-- =============================================================================
-- 2. ADD is_favorite COLUMN TO user_recent_foods IF NOT EXISTS
-- =============================================================================
-- This allows users to favourite items directly from their recents list

ALTER TABLE user_recent_foods 
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- =============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_food_favourites_user_id 
  ON user_food_favourites(user_id);

CREATE INDEX IF NOT EXISTS idx_user_food_favourites_food_name 
  ON user_food_favourites(food_name);

CREATE INDEX IF NOT EXISTS idx_user_recent_foods_is_favorite 
  ON user_recent_foods(user_id, is_favorite) 
  WHERE is_favorite = true;

CREATE INDEX IF NOT EXISTS idx_user_recipes_is_favorite 
  ON user_recipes(user_id, is_favorite) 
  WHERE is_favorite = true;

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE user_food_favourites ENABLE ROW LEVEL SECURITY;

-- Users can only view their own favourites
CREATE POLICY "Users can view own food favourites" 
  ON user_food_favourites FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only insert their own favourites
CREATE POLICY "Users can insert own food favourites" 
  ON user_food_favourites FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own favourites
CREATE POLICY "Users can update own food favourites" 
  ON user_food_favourites FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can only delete their own favourites
CREATE POLICY "Users can delete own food favourites" 
  ON user_food_favourites FOR DELETE 
  USING (auth.uid() = user_id);

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- Function to toggle favourite status for a recipe
CREATE OR REPLACE FUNCTION toggle_recipe_favourite(recipe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  new_status BOOLEAN;
BEGIN
  UPDATE user_recipes 
  SET is_favorite = NOT is_favorite,
      updated_at = NOW()
  WHERE id = recipe_id AND user_id = auth.uid()
  RETURNING is_favorite INTO new_status;
  
  RETURN new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all favourites (both foods and recipes) for a user
CREATE OR REPLACE FUNCTION get_all_favourites()
RETURNS TABLE (
  id UUID,
  type TEXT,
  name TEXT,
  brand TEXT,
  calories DECIMAL,
  protein_g DECIMAL,
  carbs_g DECIMAL,
  fat_g DECIMAL,
  serving_size DECIMAL,
  serving_unit TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Return favourite foods
  RETURN QUERY
  SELECT 
    f.id,
    'food'::TEXT as type,
    f.food_name as name,
    f.food_brand as brand,
    f.calories,
    f.protein_g,
    f.carbs_g,
    f.fat_g,
    f.serving_size,
    f.serving_unit,
    f.created_at
  FROM user_food_favourites f
  WHERE f.user_id = auth.uid()
  
  UNION ALL
  
  -- Return favourite recipes
  SELECT 
    r.id,
    'recipe'::TEXT as type,
    r.name,
    NULL::TEXT as brand,
    r.total_calories as calories,
    r.total_protein_g as protein_g,
    r.total_carbs_g as carbs_g,
    r.total_fat_g as fat_g,
    1::DECIMAL as serving_size,
    'serving'::TEXT as serving_unit,
    r.created_at
  FROM user_recipes r
  WHERE r.user_id = auth.uid() AND r.is_favorite = true
  
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

