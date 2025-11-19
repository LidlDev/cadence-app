-- =====================================================
-- Cadence App - Activity Streams Schema
-- Stores granular per-second/per-meter data from Strava
-- =====================================================

-- Activity Streams Table
-- Stores time-series data for each activity (HR, pace, cadence, etc.)
CREATE TABLE IF NOT EXISTS activity_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stream metadata
  stream_type TEXT NOT NULL, -- 'time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
  original_size INTEGER NOT NULL,
  resolution TEXT, -- 'low', 'medium', 'high'
  series_type TEXT, -- 'distance' or 'time'
  
  -- Stream data (stored as JSONB for flexibility)
  data JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(run_id, stream_type)
);

-- Heart Rate Zones Table
-- Stores heart rate zone distribution for each activity
CREATE TABLE IF NOT EXISTS activity_heart_rate_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Zone data (time in seconds spent in each zone)
  zone_1_time INTEGER DEFAULT 0, -- < 60% max HR
  zone_2_time INTEGER DEFAULT 0, -- 60-70% max HR
  zone_3_time INTEGER DEFAULT 0, -- 70-80% max HR
  zone_4_time INTEGER DEFAULT 0, -- 80-90% max HR
  zone_5_time INTEGER DEFAULT 0, -- > 90% max HR
  
  -- Average HR
  average_hr INTEGER,
  max_hr INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(run_id)
);

-- Best Performances Table
-- Stores all-time best performances for different distances
CREATE TABLE IF NOT EXISTS best_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Performance data
  distance_meters FLOAT NOT NULL, -- Exact distance in meters
  distance_label TEXT NOT NULL, -- '1K', '5K', '10K', 'Half Marathon', 'Marathon'
  time_seconds INTEGER NOT NULL,
  pace_per_km TEXT NOT NULL, -- Formatted pace (e.g., '4:30')
  
  -- Ranking (1 = best, 2 = second best, 3 = third best)
  rank INTEGER NOT NULL,
  
  -- Activity details
  activity_date DATE NOT NULL,
  activity_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, distance_label, rank)
);

-- AI Memories Table
-- Stores contextual memories for AI chat
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Memory content
  memory_type TEXT NOT NULL, -- 'goal', 'preference', 'injury', 'achievement', 'insight'
  content TEXT NOT NULL,
  context JSONB, -- Additional structured context
  
  -- Relevance
  importance INTEGER DEFAULT 5, -- 1-10 scale
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strava Webhook Events Table
-- Stores webhook events from Strava for processing
CREATE TABLE IF NOT EXISTS strava_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event data
  object_type TEXT NOT NULL, -- 'activity', 'athlete'
  object_id BIGINT NOT NULL,
  aspect_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  owner_id BIGINT NOT NULL, -- Strava athlete ID
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  
  -- Raw event data
  event_data JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_streams_run_id ON activity_streams(run_id);
CREATE INDEX IF NOT EXISTS idx_activity_streams_user_id ON activity_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_streams_type ON activity_streams(stream_type);

CREATE INDEX IF NOT EXISTS idx_hr_zones_run_id ON activity_heart_rate_zones(run_id);
CREATE INDEX IF NOT EXISTS idx_hr_zones_user_id ON activity_heart_rate_zones(user_id);

CREATE INDEX IF NOT EXISTS idx_best_perf_user_id ON best_performances(user_id);
CREATE INDEX IF NOT EXISTS idx_best_perf_distance ON best_performances(distance_label);
CREATE INDEX IF NOT EXISTS idx_best_perf_rank ON best_performances(rank);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_type ON ai_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memories_importance ON ai_memories(importance DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON strava_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_owner ON strava_webhook_events(owner_id);

-- Enable Row Level Security
ALTER TABLE activity_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_heart_rate_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_streams
CREATE POLICY "Users can view their own activity streams"
  ON activity_streams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity streams"
  ON activity_streams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity streams"
  ON activity_streams FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for activity_heart_rate_zones (same pattern)
CREATE POLICY "Users can view their own HR zones"
  ON activity_heart_rate_zones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own HR zones"
  ON activity_heart_rate_zones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for best_performances
CREATE POLICY "Users can view their own best performances"
  ON best_performances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own best performances"
  ON best_performances FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for ai_memories
CREATE POLICY "Users can view their own AI memories"
  ON ai_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own AI memories"
  ON ai_memories FOR ALL
  USING (auth.uid() = user_id);

-- Webhook events are service-level, no user-specific RLS needed
CREATE POLICY "Service role can manage webhook events"
  ON strava_webhook_events FOR ALL
  USING (true);

