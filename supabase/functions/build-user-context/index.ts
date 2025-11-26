// Supabase Edge Function to build user context for AI
// This is a helper function called by other Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const { userId } = await req.json()
    console.log('Building context for user:', userId)

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    console.log('Profile fetched:', !!profile, 'Error:', profileError?.message)

    // Fetch recent completed runs
    const { data: recentRuns, error: recentRunsError } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(10)
    console.log('Recent runs fetched:', recentRuns?.length || 0, 'Error:', recentRunsError?.message)

    // Fetch upcoming scheduled runs (next 30 days)
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    console.log('Fetching upcoming runs from', today, 'to', thirtyDaysFromNow)
    const { data: upcomingRuns, error: upcomingRunsError } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .gte('scheduled_date', today)
      .lte('scheduled_date', thirtyDaysFromNow)
      .order('scheduled_date', { ascending: true })
      .limit(30)
    console.log('Upcoming runs fetched:', upcomingRuns?.length || 0, 'Error:', upcomingRunsError?.message)

    // Fetch training plan
    const { data: trainingPlan, error: trainingPlanError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()
    console.log('Training plan fetched:', !!trainingPlan, 'Error:', trainingPlanError?.message)

    // Fetch strength training plan
    const { data: strengthPlan, error: strengthPlanError } = await supabase
      .from('strength_training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()
    console.log('Strength plan fetched:', !!strengthPlan, 'Error:', strengthPlanError?.message)

    // Fetch upcoming strength sessions
    let upcomingStrengthSessions: any[] = []
    if (strengthPlan) {
      const { data: sessions } = await supabase
        .from('strength_sessions')
        .select('*')
        .eq('strength_plan_id', strengthPlan.id)
        .eq('completed', false)
        .gte('scheduled_date', today)
        .lte('scheduled_date', thirtyDaysFromNow)
        .order('scheduled_date', { ascending: true })
        .limit(20)
      upcomingStrengthSessions = sessions || []
      console.log('Upcoming strength sessions fetched:', upcomingStrengthSessions.length)
    }

    // Fetch recent completed strength sessions
    let recentStrengthSessions: any[] = []
    if (strengthPlan) {
      const { data: sessions } = await supabase
        .from('strength_sessions')
        .select('*')
        .eq('strength_plan_id', strengthPlan.id)
        .eq('completed', true)
        .order('scheduled_date', { ascending: false })
        .limit(10)
      recentStrengthSessions = sessions || []
      console.log('Recent strength sessions fetched:', recentStrengthSessions.length)
    }

    // Fetch memories
    const { data: memories } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .limit(20)

    // Build system message
    let systemMessage = `You are a knowledgeable running coach assistant helping a runner with their training.\n\n`

    if (profile) {
      systemMessage += `## Runner Profile\n`
      if (profile.full_name) systemMessage += `- Name: ${profile.full_name}\n`
      if (profile.age) systemMessage += `- Age: ${profile.age}\n`
      if (profile.gender) systemMessage += `- Gender: ${profile.gender}\n`
      if (profile.weight) systemMessage += `- Weight: ${profile.weight} kg\n`
      systemMessage += `\n`
    }

    if (trainingPlan) {
      systemMessage += `## Current Training Plan\n`
      systemMessage += `- Plan: ${trainingPlan.name}\n`
      if (trainingPlan.goal_race) systemMessage += `- Goal Race: ${trainingPlan.goal_race}\n`
      if (trainingPlan.goal_time) systemMessage += `- Goal Time: ${trainingPlan.goal_time}\n`
      systemMessage += `- Start Date: ${trainingPlan.start_date}\n`
      systemMessage += `- End Date: ${trainingPlan.end_date}\n`
      systemMessage += `- Weeks: ${trainingPlan.weeks}\n`
      systemMessage += `\n`
    }

    if (upcomingRuns && upcomingRuns.length > 0) {
      systemMessage += `## Upcoming Scheduled Runs (Next 30 Days)\n`
      upcomingRuns.forEach((run: any) => {
        systemMessage += `- ${run.scheduled_date} (${run.day_of_week}): ${run.run_type}`
        if (run.planned_distance) systemMessage += ` - ${run.planned_distance}km`
        if (run.session_type) systemMessage += ` (${run.session_type})`
        if (run.target_pace) systemMessage += ` @ ${run.target_pace}`
        systemMessage += `\n`
      })
      systemMessage += `\n`
    }

    if (recentRuns && recentRuns.length > 0) {
      systemMessage += `## Recent Completed Runs (Last 10)\n`
      recentRuns.forEach((run: any) => {
        systemMessage += `- ${run.scheduled_date}: ${run.actual_distance || run.planned_distance}km, ${run.run_type}`
        if (run.actual_pace) systemMessage += `, pace: ${run.actual_pace}`
        systemMessage += `\n`
      })
      systemMessage += `\n`
    }

    // Add strength training context
    if (strengthPlan) {
      systemMessage += `## Strength Training Plan\n`
      systemMessage += `- Plan: ${strengthPlan.name}\n`
      systemMessage += `- Days per week: ${strengthPlan.days_per_week}\n`
      systemMessage += `- Start Date: ${strengthPlan.start_date}\n`
      systemMessage += `- Weeks: ${strengthPlan.weeks}\n`
      if (strengthPlan.goals) {
        systemMessage += `- Goals: ${(strengthPlan.goals as string[]).join(', ')}\n`
      }
      systemMessage += `\n`
    }

    if (upcomingStrengthSessions && upcomingStrengthSessions.length > 0) {
      systemMessage += `## Upcoming Strength Sessions (Next 30 Days)\n`
      upcomingStrengthSessions.forEach((session: any) => {
        systemMessage += `- ${session.scheduled_date}: ${session.session_type.replace('_', ' ')}`
        if (session.session_name) systemMessage += ` - ${session.session_name}`
        if (session.estimated_duration) systemMessage += ` (${session.estimated_duration} min)`
        if (session.focus_areas && session.focus_areas.length > 0) {
          systemMessage += ` [${session.focus_areas.join(', ')}]`
        }
        systemMessage += `\n`
      })
      systemMessage += `\n`
    }

    if (recentStrengthSessions && recentStrengthSessions.length > 0) {
      systemMessage += `## Recent Completed Strength Sessions (Last 10)\n`
      recentStrengthSessions.forEach((session: any) => {
        systemMessage += `- ${session.scheduled_date}: ${session.session_type.replace('_', ' ')}`
        if (session.actual_duration) systemMessage += `, ${session.actual_duration} min`
        if (session.rpe) systemMessage += `, RPE ${session.rpe}`
        systemMessage += `\n`
      })
      systemMessage += `\n`
    }

    if (memories && memories.length > 0) {
      systemMessage += `## Important Context (from previous conversations)\n`
      memories.forEach((mem: any) => {
        systemMessage += `- ${mem.content}\n`
      })
      systemMessage += `\n`
    }

    systemMessage += `## Your Role\n`
    systemMessage += `Provide personalized running and strength training advice based on the user's profile, training history, and goals. `
    systemMessage += `You understand how running and strength training work together - strength training improves running economy, prevents injuries, and builds power. `
    systemMessage += `Be encouraging, specific, and evidence-based in your recommendations.\n`

    return new Response(
      JSON.stringify({ systemMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error building user context:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

