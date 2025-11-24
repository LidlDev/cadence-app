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

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Fetch recent runs
    const { data: recentRuns } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('date', { ascending: false })
      .limit(10)

    // Fetch training plan
    const { data: trainingPlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

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
      if (trainingPlan.goal_distance) systemMessage += `- Goal Distance: ${trainingPlan.goal_distance} km\n`
      systemMessage += `- Weeks: ${trainingPlan.weeks}\n`
      systemMessage += `\n`
    }

    if (recentRuns && recentRuns.length > 0) {
      systemMessage += `## Recent Runs (Last 10)\n`
      recentRuns.forEach((run: any) => {
        systemMessage += `- ${run.date}: ${run.distance}km, ${run.run_type}`
        if (run.pace) systemMessage += `, pace: ${run.pace}`
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
    systemMessage += `Provide personalized running advice based on the user's profile, training history, and goals. `
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

