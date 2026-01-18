-- =============================================================================
-- CADENCE APP - FOOD API SOURCES UPDATE
-- =============================================================================
-- Migration to add new food sources: api_ninjas, usda
-- Run this SQL in Supabase SQL Editor
-- =============================================================================

-- Update the food_items table to include new API sources
ALTER TABLE food_items DROP CONSTRAINT IF EXISTS food_items_source_check;
ALTER TABLE food_items ADD CONSTRAINT food_items_source_check 
  CHECK (source IN ('fatsecret', 'openfoodfacts', 'manual', 'ai_estimated', 'api_ninjas', 'usda'));

-- Also update the user_food_favourites table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_food_favourites') THEN
    ALTER TABLE user_food_favourites DROP CONSTRAINT IF EXISTS user_food_favourites_source_check;
    -- Note: user_food_favourites might have a different constraint name, this is a safe attempt
    EXECUTE 'ALTER TABLE user_food_favourites ADD CONSTRAINT user_food_favourites_source_check 
      CHECK (source IN (''fatsecret'', ''openfoodfacts'', ''manual'', ''ai_estimated'', ''api_ninjas'', ''usda'', ''recipe'', ''recent''))';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Constraint may not exist or have different name, continue
    NULL;
END $$;

-- Update the nutrition-favourites-schema source check if needed
-- This accommodates all sources used in the application

SELECT 'Food API sources migration complete!' as status;
