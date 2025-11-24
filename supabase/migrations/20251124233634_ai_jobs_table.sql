-- AI Job Tracking System
-- Tracks long-running AI requests for better UX and debugging

-- Create ai_jobs table
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- 'agentic_chat', 'analysis', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  
  -- Request data
  request_data JSONB NOT NULL,
  
  -- Response data
  response_data JSONB,
  error_message TEXT,
  
  -- Metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Performance tracking
  execution_time_ms INTEGER,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id ON ai_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_status ON ai_jobs(user_id, status, created_at DESC);

-- Enable RLS
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own jobs"
  ON ai_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON ai_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON ai_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER ai_jobs_updated_at
  BEFORE UPDATE ON ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_jobs_updated_at();

-- Function to clean up old completed jobs (optional, run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_ai_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_jobs
  WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ai_jobs TO authenticated;
GRANT ALL ON ai_jobs TO service_role;

COMMENT ON TABLE ai_jobs IS 'Tracks long-running AI processing jobs';
COMMENT ON COLUMN ai_jobs.job_type IS 'Type of AI job: agentic_chat, analysis, etc.';
COMMENT ON COLUMN ai_jobs.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN ai_jobs.request_data IS 'Original request payload';
COMMENT ON COLUMN ai_jobs.response_data IS 'AI response data';
COMMENT ON COLUMN ai_jobs.execution_time_ms IS 'Total execution time in milliseconds';

