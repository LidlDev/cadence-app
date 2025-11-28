// Nutrition-Performance Correlation Analysis Edge Function
// Analyzes how nutrition impacts run performance metrics

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Unauthorized')

    const { lookbackDays = 30 } = await req.json().catch(() => ({}))
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - lookbackDays)
    const startStr = startDate.toISOString().split('T')[0]

    // Fetch completed runs with performance data
    const { data: runs } = await supabase
      .from('runs')
      .select(`
        id, scheduled_date, run_type, distance_km, duration_minutes,
        actual_distance, actual_time, average_pace, rpe, average_hr, max_hr,
        suffer_score, calories, elevation_gain
      `)
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('scheduled_date', startStr)
      .order('scheduled_date', { ascending: true })

    // Fetch nutrition data for days before runs
    const { data: mealLogs } = await supabase
      .from('meal_logs')
      .select('log_date, meal_type, total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('user_id', user.id)
      .gte('log_date', startStr)

    // Fetch hydration data
    const { data: hydrationLogs } = await supabase
      .from('hydration_logs')
      .select('log_date, amount_ml, beverage_type')
      .eq('user_id', user.id)
      .gte('log_date', startStr)

    // Build correlation data: for each run, get nutrition from day before and same day
    const correlationData = (runs || []).map(run => {
      const runDate = run.scheduled_date
      const dayBefore = new Date(runDate)
      dayBefore.setDate(dayBefore.getDate() - 1)
      const dayBeforeStr = dayBefore.toISOString().split('T')[0]

      const sameDayNutrition = aggregateNutrition(mealLogs || [], runDate)
      const prevDayNutrition = aggregateNutrition(mealLogs || [], dayBeforeStr)
      const sameDayHydration = (hydrationLogs || [])
        .filter(h => h.log_date === runDate)
        .reduce((sum, h) => sum + (h.amount_ml || 0), 0)

      return {
        run_date: runDate,
        run_type: run.run_type,
        distance_km: run.actual_distance || run.distance_km,
        rpe: run.rpe,
        avg_hr: run.average_hr,
        suffer_score: run.suffer_score,
        same_day: sameDayNutrition,
        prev_day: prevDayNutrition,
        hydration_ml: sameDayHydration,
      }
    })

    // Use AI to analyze patterns
    const prompt = `Analyze this runner's nutrition-performance correlation data:
${JSON.stringify(correlationData, null, 2)}

Provide insights in JSON format with these fields:
- carb_impact: Analysis of how carb intake before runs affects performance (RPE, heart rate)
- protein_impact: Analysis of protein timing and recovery
- hydration_impact: How hydration correlates with performance
- pre_run_patterns: Best pre-run meal patterns observed
- recommendations: Array of 3-5 specific recommendations
- performance_score: Overall nutrition-performance alignment score (1-100)`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sports nutritionist analyzing endurance athlete data.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error('OpenAI API error')

    const aiData = await response.json()
    const analysis = JSON.parse(aiData.choices[0].message.content)

    return new Response(
      JSON.stringify({
        analysis,
        data_points: correlationData.length,
        period_days: lookbackDays,
      }),
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

function aggregateNutrition(meals: any[], date: string) {
  const dayMeals = meals.filter(m => m.log_date === date)
  return {
    calories: dayMeals.reduce((s, m) => s + (m.total_calories || 0), 0),
    protein_g: dayMeals.reduce((s, m) => s + (m.total_protein_g || 0), 0),
    carbs_g: dayMeals.reduce((s, m) => s + (m.total_carbs_g || 0), 0),
    fat_g: dayMeals.reduce((s, m) => s + (m.total_fat_g || 0), 0),
    meal_count: dayMeals.length,
  }
}

