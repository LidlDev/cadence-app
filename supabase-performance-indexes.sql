-- Performance Optimization: Add indexes to speed up common queries
-- Run this in Supabase SQL Editor to improve query performance

-- Index for runs table - most common queries
CREATE INDEX IF NOT EXISTS idx_runs_user_scheduled_date 
ON runs(user_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_runs_user_completed 
ON runs(user_id, completed, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_runs_strava_activity 
ON runs(strava_activity_id) WHERE strava_activity_id IS NOT NULL;

-- Index for personal_bests table (no rank column in this table)
CREATE INDEX IF NOT EXISTS idx_personal_bests_user_distance
ON personal_bests(user_id, distance);

-- Index for activity_streams table
CREATE INDEX IF NOT EXISTS idx_activity_streams_run 
ON activity_streams(run_id, stream_type) WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_streams_user 
ON activity_streams(user_id, created_at DESC);

-- Index for activity_heart_rate_zones table
CREATE INDEX IF NOT EXISTS idx_hr_zones_run 
ON activity_heart_rate_zones(run_id) WHERE run_id IS NOT NULL;

-- Index for best_performances table
CREATE INDEX IF NOT EXISTS idx_best_performances_user_distance 
ON best_performances(user_id, distance, rank);

-- Index for strava_tokens table
CREATE INDEX IF NOT EXISTS idx_strava_tokens_user 
ON strava_tokens(user_id);

-- Index for training_plans table
CREATE INDEX IF NOT EXISTS idx_training_plans_user_status 
ON training_plans(user_id, status);

-- Analyze tables to update statistics for query planner
ANALYZE runs;
ANALYZE personal_bests;
ANALYZE activity_streams;
ANALYZE activity_heart_rate_zones;
ANALYZE best_performances;
ANALYZE strava_tokens;
ANALYZE training_plans;

