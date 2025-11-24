// Supabase Edge Function for AI Run Insights
// Handles long-running AI insight generation without timeout constraints

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Extract JWT token from Authorization header
    const jwt = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        persistSession: false,
      },
    })

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { runId } = await req.json()

    if (!runId) {
      return new Response(
        JSON.stringify({ error: 'Missing runId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the run data
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .eq('user_id', user.id)
      .single()

    if (runError || !run) {
      return new Response(
        JSON.stringify({ error: 'Run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If insights already exist, return them
    if (run.ai_insights) {
      return new Response(
        JSON.stringify({ insights: run.ai_insights, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Fetch training plan for context
    const { data: trainingPlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', run.training_plan_id)
      .single()

    // Fetch recent runs for comparison
    const { data: recentRuns } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(10)

    // Build context for AI
    const context = buildRunContext(run, profile, trainingPlan, recentRuns || [])

    // Generate insights using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an enthusiastic and knowledgeable running coach analyzing a completed run.
Provide energetic, motivating insights about the runner's performance. Be specific, encouraging, and actionable.
Focus on:
1. How this run compares to their target and recent performances
2. What this run tells us about their fitness and progress
3. Specific recommendations for future training
4. Recognition of achievements and areas for improvement
5. If the runner has added personal notes from Strava, acknowledge and respond to their feelings, observations, or concerns

Use emojis sparingly but effectively. Be conversational and upbeat while remaining professional.
Keep your response well-structured with clear sections using markdown formatting (headings, bold, lists).`
          },
          {
            role: 'user',
            content: context
          }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to generate insights', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const completion = await response.json()
    const insights = completion.choices[0].message.content

    // Store insights in database
    await supabase
      .from('runs')
      .update({ ai_insights: insights })
      .eq('id', runId)

    return new Response(
      JSON.stringify({ insights, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error generating run insights:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildRunContext(run: any, profile: any, trainingPlan: any, recentRuns: any[]): string {
  let context = `Analyze this completed run:\n\n`

  context += `## Run Details\n`
  context += `- Type: ${run.run_type}${run.session_type ? ` (${run.session_type})` : ''}\n`
  context += `- Week ${run.week_number} of training plan\n`
  context += `- Planned: ${run.planned_distance}km${run.target_pace ? ` at ${run.target_pace}/km` : ''}\n`
  context += `- Actual: ${run.actual_distance}km in ${run.actual_time}${run.actual_pace ? ` at ${run.actual_pace}/km` : ''}\n`

  if (run.average_hr) context += `- Average HR: ${run.average_hr} bpm${run.max_hr ? ` (Max: ${run.max_hr})` : ''}\n`
  if (run.average_cadence) context += `- Average Cadence: ${Math.round(run.average_cadence * 2)} spm\n`
  if (run.total_elevation_gain) context += `- Elevation Gain: ${run.total_elevation_gain}m\n`
  if (run.rpe) context += `- RPE: ${run.rpe}/10\n`
  if (run.notes) context += `\n**Coach's Notes:** ${run.notes}\n`
  if (run.strava_description) context += `\n**Runner's Personal Notes (from Strava):** "${run.strava_description}"\n`
  if (run.comments) context += `**Comments:** ${run.comments}\n`

  if (trainingPlan) {
    context += `\n## Training Context\n`
    context += `- Plan: ${trainingPlan.name}\n`
    context += `- Goal: ${trainingPlan.goal_race || 'General fitness'}\n`
    if (trainingPlan.goal_time) context += `- Target Time: ${trainingPlan.goal_time}\n`
  }

  if (profile) {
    context += `\n## Runner Profile\n`
    if (profile.age) context += `- Age: ${profile.age}\n`
    if (profile.gender) context += `- Gender: ${profile.gender}\n`
    if (profile.max_heart_rate) context += `- Max HR: ${profile.max_heart_rate} bpm\n`
    if (profile.resting_heart_rate) context += `- Resting HR: ${profile.resting_heart_rate} bpm\n`
  }

  if (recentRuns && recentRuns.length > 0) {
    context += `\n## Recent Performance (Last ${recentRuns.length} runs)\n`
    recentRuns.slice(0, 5).forEach((r: any, i: number) => {
      context += `${i + 1}. ${r.run_type}: ${r.actual_distance}km in ${r.actual_time}`
      if (r.actual_pace) context += ` (${r.actual_pace}/km)`
      if (r.average_hr) context += ` - HR: ${r.average_hr}`
      context += `\n`
    })
  }

  return context
}


