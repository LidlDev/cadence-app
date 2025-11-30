# 📊 Apply Database Schemas - Step by Step

## Overview

You need to apply two SQL files to your Supabase database to enable the advanced features:

1. `supabase-runs-table-updates.sql` - Adds Strava integration fields to existing runs table
2. `supabase-activity-streams-schema.sql` - Creates new tables for granular data

## Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: `wfdqshevlvuatzhpudqr`
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Apply Runs Table Updates

1. Open the file `supabase-runs-table-updates.sql` in your code editor
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see: "Success. No rows returned"

**What this does:**
- Adds `strava_activity_id` column to link runs with Strava activities
- Adds heart rate fields: `average_hr`, `max_hr`, `has_heartrate`
- Adds cadence fields: `average_cadence`, `has_cadence`
- Adds power fields: `average_watts`, `max_watts`, `kilojoules`, `has_power`
- Adds elevation fields: `elev_high`, `elev_low`
- Adds `suffer_score` for Strava's proprietary metric
- Adds stream availability flags for all data types

## Step 3: Apply Activity Streams Schema

1. Open the file `supabase-activity-streams-schema.sql` in your code editor
2. Copy the entire contents
3. Paste into the Supabase SQL Editor (new query)
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see: "Success. No rows returned"

**What this creates:**

### New Tables:

1. **`activity_streams`** - Stores granular per-second/per-meter data
   - Heart rate data points
   - Pace/velocity data points
   - Cadence data points
   - GPS coordinates (latlng)
   - Altitude/elevation data points
   - Temperature data points
   - Grade/slope data points

2. **`activity_heart_rate_zones`** - Stores HR zone distribution
   - Time spent in each of 5 HR zones
   - Average and max heart rate
   - Used for pie charts and zone analysis

3. **`best_performances`** - Tracks all-time best times
   - Best times for 1K, 5K, 10K, Half Marathon, Marathon
   - Ranking (1st, 2nd, 3rd place)
   - Links to the run that achieved the performance
   - Date and pace information

4. **`ai_memories`** - Stores user context for AI chat
   - User goals, preferences, injuries
   - Training insights and patterns
   - Importance scoring for relevance
   - Access tracking for memory retrieval

5. **`strava_webhook_events`** - Queue for webhook events
   - Stores incoming Strava webhook events
   - Processing status tracking
   - Error logging

## Step 4: Verify Tables Were Created

1. In Supabase, click on **Table Editor** in the left sidebar
2. You should see the new tables:
   - `activity_streams`
   - `activity_heart_rate_zones`
   - `best_performances`
   - `ai_memories`
   - `strava_webhook_events`

3. Click on the `runs` table
4. Click on the **Columns** tab
5. Scroll down and verify you see the new columns:
   - `strava_activity_id`
   - `average_hr`
   - `max_hr`
   - `suffer_score`
   - etc.

## Step 5: Verify Row Level Security (RLS)

1. Click on any of the new tables
2. Click on the **Policies** tab
3. You should see RLS policies like:
   - "Users can view their own activity streams"
   - "Users can insert their own activity streams"
   - etc.

## Troubleshooting

### Error: "column already exists"
- This means the schema has already been applied
- You can safely ignore this error
- Or drop the column first: `ALTER TABLE runs DROP COLUMN IF EXISTS strava_activity_id;`

### Error: "relation already exists"
- This means the table has already been created
- You can safely ignore this error
- Or drop the table first: `DROP TABLE IF EXISTS activity_streams CASCADE;`

### Error: "permission denied"
- Make sure you're logged in as the project owner
- Check that you have the correct project selected

## Next Steps

After applying the schemas:
1. ✅ Database is ready for Strava webhook integration
2. ✅ Database is ready for granular activity data
3. ✅ Database is ready for best performances tracking
4. ✅ Database is ready for AI chat with memories

You can now proceed with implementing the features!

