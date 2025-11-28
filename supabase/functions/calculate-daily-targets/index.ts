// Calculate Daily Nutrition Targets Edge Function
// Auto-adjusts macros based on training load for the day

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Training intensity multipliers for calorie adjustment
const TRAINING_MULTIPLIERS: Record<string, { calories: number; carbs: number; protein: number }> = {
  'Long Run': { calories: 1.25, carbs: 1.4, protein: 1.1 },
  'Tempo Run': { calories: 1.15, carbs: 1.2, protein: 1.1 },
  'Quality Run': { calories: 1.2, carbs: 1.3, protein: 1.15 },
  'Intervals': { calories: 1.15, carbs: 1.25, protein: 1.1 },
  'Hill Repeats': { calories: 1.15, carbs: 1.2, protein: 1.1 },
  'Easy Run': { calories: 1.08, carbs: 1.1, protein: 1.0 },
  'Recovery Run': { calories: 1.05, carbs: 1.05, protein: 1.0 },
  'Rest': { calories: 1.0, carbs: 1.0, protein: 1.0 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const { date, daysAhead = 7 } = await req.json()
    const startDate = date || new Date().toISOString().split('T')[0]

    // Get user's base nutrition plan
    const { data: nutritionPlan } = await supabase
      .from('nutrition_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!nutritionPlan) {
      return new Response(
        JSON.stringify({ error: 'No active nutrition plan found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get scheduled runs for the date range
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + daysAhead)

    const { data: runs } = await supabase
      .from('runs')
      .select('scheduled_date, run_type, distance_km, duration_minutes')
      .eq('user_id', user.id)
      .gte('scheduled_date', startDate)
      .lt('scheduled_date', endDate.toISOString().split('T')[0])

    // Get strength sessions for the date range
    const { data: strengthSessions } = await supabase
      .from('strength_sessions')
      .select('scheduled_date, session_type, estimated_duration')
      .eq('user_id', user.id)
      .gte('scheduled_date', startDate)
      .lt('scheduled_date', endDate.toISOString().split('T')[0])

    // Calculate targets for each day
    const dailyTargets = []
    const currentDate = new Date(startDate)

    for (let i = 0; i < daysAhead; i++) {
      const dateStr = currentDate.toISOString().split('T')[0]

      // Find training for this day
      const dayRuns = runs?.filter(r => r.scheduled_date === dateStr) || []
      const dayStrength = strengthSessions?.filter(s => s.scheduled_date === dateStr) || []

      // Calculate multipliers based on training
      let calorieMultiplier = 1.0
      let carbMultiplier = 1.0
      let proteinMultiplier = 1.0

      // Apply run multipliers (use highest intensity if multiple runs)
      for (const run of dayRuns) {
        const mult = TRAINING_MULTIPLIERS[run.run_type] || TRAINING_MULTIPLIERS['Easy Run']
        calorieMultiplier = Math.max(calorieMultiplier, mult.calories)
        carbMultiplier = Math.max(carbMultiplier, mult.carbs)
        proteinMultiplier = Math.max(proteinMultiplier, mult.protein)

        // Add distance-based calories (approx 60-80 cal per km)
        const distanceCalories = (run.distance_km || 0) * 70
        calorieMultiplier += distanceCalories / (nutritionPlan.daily_calories || 2000)
      }

      // Add strength training bonus
      if (dayStrength.length > 0) {
        proteinMultiplier += 0.1 // Extra protein for strength days
        calorieMultiplier += 0.05
      }

      const targets = {
        user_id: user.id,
        target_date: dateStr,
        target_calories: Math.round((nutritionPlan.daily_calories || 2000) * calorieMultiplier),
        target_protein_g: Math.round((nutritionPlan.daily_protein_g || 150) * proteinMultiplier),
        target_carbs_g: Math.round((nutritionPlan.daily_carbs_g || 250) * carbMultiplier),
        target_fat_g: Math.round(nutritionPlan.daily_fat_g || 70),
        target_hydration_ml: calculateHydration(dayRuns, nutritionPlan.daily_hydration_ml || 2500),
        training_type: dayRuns.length > 0 ? dayRuns[0].run_type : (dayStrength.length > 0 ? 'Strength' : 'Rest'),
        is_training_day: dayRuns.length > 0 || dayStrength.length > 0,
      }

      dailyTargets.push(targets)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Upsert all targets
    const { error: upsertError } = await supabase
      .from('daily_nutrition_targets')
      .upsert(dailyTargets, { onConflict: 'user_id,target_date' })

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ success: true, targets: dailyTargets }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateHydration(runs: any[], baseHydration: number): number {
  let extra = 0
  for (const run of runs) {
    // Add ~500ml per 30 min of running
    extra += ((run.duration_minutes || 30) / 30) * 500
  }
  return Math.round(baseHydration + extra)
}

