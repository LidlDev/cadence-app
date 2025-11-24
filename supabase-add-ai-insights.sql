-- Add ai_insights field to runs table
-- This field stores AI-generated insights about the run performance
-- Run this in Supabase SQL Editor

ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS ai_insights TEXT;

-- Add comment to document the field
COMMENT ON COLUMN public.runs.ai_insights IS 'AI-generated insights about run performance, progress, and recommendations. Generated once and cached.';

