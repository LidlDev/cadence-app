// Race Week Nutrition Protocol Edge Function
// Generates carb loading and race day nutrition strategies

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RaceWeekDay {
  date: string
  days_to_race: number
  phase: 'depletion' | 'loading' | 'race_day' | 'recovery'
  calories: number
  carbs_g: number
  protein_g: number
  fat_g: number
  hydration_ml: number
  meal_timing: string[]
  key_foods: string[]
  notes: string
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

    const { raceDate, raceDistance, raceTime, protocolType = 'standard' } = await req.json()

    if (!raceDate || !raceDistance) {
      throw new Error('Race date and distance are required')
    }

    // Get user's nutrition plan for base values
    const { data: nutritionPlan } = await supabase
      .from('nutrition_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    const baseCalories = nutritionPlan?.daily_calories || 2000
    const baseCarbs = nutritionPlan?.daily_carbs_g || 250
    const baseProtein = nutritionPlan?.daily_protein_g || 150

    // Get user profile for weight-based calculations
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('weight_kg')
      .eq('user_id', user.id)
      .single()

    const weightKg = profile?.weight_kg || 70

    // Generate race week protocol
    const protocol = generateRaceWeekProtocol(
      raceDate,
      raceDistance,
      raceTime,
      protocolType,
      baseCalories,
      baseCarbs,
      baseProtein,
      weightKg
    )

    // Use AI to generate personalized meal suggestions
    const aiPrompt = buildRaceWeekPrompt(protocol, raceDistance, raceTime)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sports nutrition expert specializing in race preparation.' },
          { role: 'user', content: aiPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error('OpenAI API error')

    const aiData = await response.json()
    const mealPlan = JSON.parse(aiData.choices[0].message.content)

    // Store the protocol in daily_nutrition_targets
    for (const day of protocol) {
      await supabase
        .from('daily_nutrition_targets')
        .upsert({
          user_id: user.id,
          target_date: day.date,
          target_calories: day.calories,
          target_carbs_g: day.carbs_g,
          target_protein_g: day.protein_g,
          target_fat_g: day.fat_g,
          target_hydration_ml: day.hydration_ml,
          training_type: day.phase === 'race_day' ? 'Race' : 'Taper',
          is_training_day: day.phase === 'race_day',
          notes: day.notes,
        }, { onConflict: 'user_id,target_date' })
    }

    return new Response(
      JSON.stringify({
        protocol,
        meal_suggestions: mealPlan,
        race_info: { date: raceDate, distance: raceDistance, time: raceTime },
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

function generateRaceWeekProtocol(
  raceDate: string,
  raceDistance: string,
  raceTime: string | undefined,
  protocolType: string,
  baseCalories: number,
  baseCarbs: number,
  baseProtein: number,
  weightKg: number
): RaceWeekDay[] {
  const protocol: RaceWeekDay[] = []
  const raceDateObj = new Date(raceDate)

  // Carb loading targets: 8-10g/kg for marathon, 6-8g/kg for half
  const isMarathon = raceDistance.toLowerCase().includes('marathon') && !raceDistance.toLowerCase().includes('half')
  const carbLoadingTarget = isMarathon ? weightKg * 10 : weightKg * 7

  for (let daysOut = 7; daysOut >= 0; daysOut--) {
    const date = new Date(raceDateObj)
    date.setDate(date.getDate() - daysOut)
    const dateStr = date.toISOString().split('T')[0]

    let day: RaceWeekDay

    if (daysOut === 0) {
      // Race day
      day = {
        date: dateStr,
        days_to_race: 0,
        phase: 'race_day',
        calories: Math.round(baseCalories * 0.9),
        carbs_g: Math.round(carbLoadingTarget * 0.8),
        protein_g: Math.round(baseProtein * 0.7),
        fat_g: 40,
        hydration_ml: 3000,
        meal_timing: ['3-4 hours before race: main pre-race meal', '1 hour before: light snack', 'During race: gels/sports drink'],
        key_foods: ['Oatmeal', 'Banana', 'Toast with honey', 'Sports drink'],
        notes: 'Focus on familiar, easily digestible foods. Nothing new on race day!',
      }
    } else if (daysOut <= 3) {
      // Carb loading phase
      day = {
        date: dateStr,
        days_to_race: daysOut,
        phase: 'loading',
        calories: Math.round(baseCalories * 1.1),
        carbs_g: Math.round(carbLoadingTarget),
        protein_g: Math.round(baseProtein * 0.9),
        fat_g: 50,
        hydration_ml: 3500,
        meal_timing: ['Breakfast: high carb', 'Lunch: pasta/rice based', 'Dinner: carb-focused', 'Snacks: fruits, pretzels'],
        key_foods: ['Pasta', 'Rice', 'Bread', 'Potatoes', 'Fruits', 'Sports drinks'],
        notes: `Carb loading phase - aim for ${Math.round(carbLoadingTarget)}g carbs (${Math.round(carbLoadingTarget/weightKg)}g/kg)`,
      }
    } else {
      // Normal taper week
      day = {
        date: dateStr,
        days_to_race: daysOut,
        phase: 'depletion',
        calories: Math.round(baseCalories * 0.95),
        carbs_g: Math.round(baseCarbs * 0.9),
        protein_g: baseProtein,
        fat_g: 60,
        hydration_ml: 3000,
        meal_timing: ['Regular meal timing', 'Focus on quality foods'],
        key_foods: ['Lean proteins', 'Vegetables', 'Whole grains', 'Fruits'],
        notes: 'Maintain normal eating, slightly reduced calories due to taper',
      }
    }

    protocol.push(day)
  }

  return protocol
}

function buildRaceWeekPrompt(protocol: RaceWeekDay[], raceDistance: string, raceTime?: string): string {
  let prompt = `Generate a detailed race week meal plan for a ${raceDistance} race.\n\n`

  if (raceTime) {
    prompt += `Race start time: ${raceTime}\n\n`
  }

  prompt += `Protocol summary:\n`
  protocol.forEach(day => {
    prompt += `- ${day.date} (${day.days_to_race} days out, ${day.phase}): ${day.carbs_g}g carbs, ${day.calories} cal\n`
  })

  prompt += `\nProvide JSON with meal suggestions for each day:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": { "name": "...", "description": "...", "carbs_g": 80 },
        "lunch": { "name": "...", "description": "...", "carbs_g": 100 },
        "dinner": { "name": "...", "description": "...", "carbs_g": 120 },
        "snacks": [{ "name": "...", "carbs_g": 30 }]
      },
      "hydration_schedule": ["8am: 500ml water", "..."],
      "tips": ["Tip 1", "Tip 2"]
    }
  ],
  "race_day_timeline": [
    { "time": "-4h", "action": "Wake up, light breakfast" },
    { "time": "-3h", "action": "Main pre-race meal" }
  ]
}`

  return prompt
}

