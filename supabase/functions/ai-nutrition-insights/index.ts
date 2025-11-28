// AI Nutrition Insights Edge Function
// Analyzes nutrition patterns and provides training-aligned insights

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
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const { period = 'week' } = await req.json()
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7)
    } else if (period === 'month') {
      startDate.setDate(startDate.getDate() - 30)
    }

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // Fetch nutrition data
    const { data: mealLogs } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', startStr)
      .lte('log_date', endStr)
      .order('log_date', { ascending: true })

    const { data: targets } = await supabase
      .from('daily_nutrition_targets')
      .select('*')
      .eq('user_id', user.id)
      .gte('target_date', startStr)
      .lte('target_date', endStr)

    const { data: hydrationLogs } = await supabase
      .from('hydration_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', startStr)
      .lte('log_date', endStr)

    // Fetch training data for correlation
    const { data: completedRuns } = await supabase
      .from('runs')
      .select('scheduled_date, run_type, distance_km, duration_minutes, average_pace, average_heart_rate')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)

    // Calculate daily summaries
    const dailyData = aggregateDailyData(mealLogs || [], targets || [], hydrationLogs || [], completedRuns || [])

    // Build AI analysis prompt
    const prompt = buildInsightsPrompt(dailyData, period)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sports nutrition expert analyzing an endurance athlete\'s nutrition data.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error('OpenAI API error')

    const aiData = await response.json()
    const insights = JSON.parse(aiData.choices[0].message.content)

    return new Response(
      JSON.stringify({
        insights,
        period,
        data_summary: {
          days_tracked: dailyData.length,
          avg_calories: Math.round(dailyData.reduce((s, d) => s + d.calories, 0) / dailyData.length),
          avg_protein: Math.round(dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length),
          training_days: dailyData.filter(d => d.training).length,
        },
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

interface DailyData {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  target_calories: number
  target_protein: number
  hydration_ml: number
  training: boolean
  run_type?: string
  distance_km?: number
}

function aggregateDailyData(
  meals: any[],
  targets: any[],
  hydration: any[],
  runs: any[]
): DailyData[] {
  const dateMap = new Map<string, DailyData>()

  // Initialize with targets
  targets.forEach(t => {
    dateMap.set(t.target_date, {
      date: t.target_date,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      target_calories: t.target_calories || 2000,
      target_protein: t.target_protein_g || 150,
      hydration_ml: 0,
      training: false,
    })
  })

  // Add meal data
  meals.forEach(m => {
    const existing = dateMap.get(m.log_date) || {
      date: m.log_date,
      calories: 0, protein: 0, carbs: 0, fat: 0,
      target_calories: 2000, target_protein: 150,
      hydration_ml: 0, training: false,
    }
    existing.calories += m.total_calories || 0
    existing.protein += m.total_protein_g || 0
    existing.carbs += m.total_carbs_g || 0
    existing.fat += m.total_fat_g || 0
    dateMap.set(m.log_date, existing)
  })

  // Add hydration
  hydration.forEach(h => {
    const existing = dateMap.get(h.log_date)
    if (existing) {
      existing.hydration_ml += h.amount_ml || 0
    }
  })

  // Add training data
  runs.forEach(r => {
    const existing = dateMap.get(r.scheduled_date)
    if (existing) {
      existing.training = true
      existing.run_type = r.run_type
      existing.distance_km = r.distance_km
    }
  })

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function buildInsightsPrompt(data: DailyData[], period: string): string {
  let prompt = `Analyze this ${period}'s nutrition data for an endurance athlete:\n\n`

  prompt += `## Daily Data:\n`
  data.forEach(d => {
    prompt += `${d.date}: ${d.calories}/${d.target_calories} kcal, ${d.protein}/${d.target_protein}g protein`
    if (d.training) prompt += ` [${d.run_type} ${d.distance_km}km]`
    prompt += `\n`
  })

  prompt += `\nProvide insights in JSON format:
{
  "summary": "Brief overall assessment",
  "score": 85,
  "highlights": ["positive point 1", "positive point 2"],
  "concerns": ["area needing attention"],
  "recommendations": [
    {"title": "Recommendation", "description": "Details", "priority": "high|medium|low"}
  ],
  "training_correlation": "How nutrition aligns with training",
  "protein_adherence": "Assessment of protein intake",
  "hydration_status": "Hydration assessment"
}`

  return prompt
}

