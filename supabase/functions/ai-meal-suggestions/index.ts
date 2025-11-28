// AI Meal Suggestions Edge Function
// Provides intelligent meal recommendations based on remaining macros, training, and preferences

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MealSuggestion {
  name: string
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_type: string
  prep_time_mins: number
  ingredients: string[]
  instructions: string[]
  tags: string[]
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

    const { mealType, date, preferences } = await req.json()
    const targetDate = date || new Date().toISOString().split('T')[0]

    // Get user's daily targets
    const { data: target } = await supabase
      .from('daily_nutrition_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('target_date', targetDate)
      .single()

    // Get already logged meals for today
    const { data: meals } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', targetDate)

    // Calculate remaining macros
    const consumed = {
      calories: meals?.reduce((sum, m) => sum + (m.total_calories || 0), 0) || 0,
      protein: meals?.reduce((sum, m) => sum + (m.total_protein_g || 0), 0) || 0,
      carbs: meals?.reduce((sum, m) => sum + (m.total_carbs_g || 0), 0) || 0,
      fat: meals?.reduce((sum, m) => sum + (m.total_fat_g || 0), 0) || 0,
    }

    const remaining = {
      calories: (target?.target_calories || 2000) - consumed.calories,
      protein: (target?.target_protein_g || 150) - consumed.protein,
      carbs: (target?.target_carbs_g || 250) - consumed.carbs,
      fat: (target?.target_fat_g || 70) - consumed.fat,
    }

    // Get tomorrow's training for context
    const tomorrow = new Date(targetDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const { data: tomorrowRun } = await supabase
      .from('runs')
      .select('run_type, distance_km')
      .eq('user_id', user.id)
      .eq('scheduled_date', tomorrowStr)
      .single()

    // Get user's dietary preferences from profile or nutrition plan
    const { data: nutritionPlan } = await supabase
      .from('nutrition_plans')
      .select('dietary_restrictions, allergies, preferences')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Build AI prompt
    const prompt = buildMealSuggestionPrompt(
      mealType || 'any',
      remaining,
      tomorrowRun,
      nutritionPlan,
      preferences
    )

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sports nutrition expert specializing in endurance athlete nutrition.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error('OpenAI API error')

    const aiData = await response.json()
    const suggestions = JSON.parse(aiData.choices[0].message.content)

    return new Response(
      JSON.stringify({
        suggestions: suggestions.meals,
        remaining_macros: remaining,
        tomorrow_training: tomorrowRun,
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

function buildMealSuggestionPrompt(
  mealType: string,
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  tomorrowRun: { run_type: string; distance_km: number } | null,
  nutritionPlan: { dietary_restrictions?: string[]; allergies?: string[]; preferences?: any } | null,
  userPreferences?: string
): string {
  let prompt = `Generate 3 meal suggestions for an endurance athlete.\n\n`

  prompt += `## Macro Targets Remaining Today:\n`
  prompt += `- Calories: ${Math.max(0, remaining.calories)} kcal\n`
  prompt += `- Protein: ${Math.max(0, remaining.protein)}g\n`
  prompt += `- Carbs: ${Math.max(0, remaining.carbs)}g\n`
  prompt += `- Fat: ${Math.max(0, remaining.fat)}g\n\n`

  if (mealType !== 'any') {
    prompt += `## Meal Type: ${mealType}\n\n`
  }

  if (tomorrowRun) {
    prompt += `## Tomorrow's Training:\n`
    prompt += `- Type: ${tomorrowRun.run_type}\n`
    prompt += `- Distance: ${tomorrowRun.distance_km}km\n`
    prompt += `Consider pre-workout nutrition needs.\n\n`
  }

  if (nutritionPlan?.dietary_restrictions?.length) {
    prompt += `## Dietary Restrictions: ${nutritionPlan.dietary_restrictions.join(', ')}\n`
  }
  if (nutritionPlan?.allergies?.length) {
    prompt += `## Allergies: ${nutritionPlan.allergies.join(', ')}\n`
  }
  if (userPreferences) {
    prompt += `## User Preferences: ${userPreferences}\n`
  }

  prompt += `\nRespond with JSON in this format:
{
  "meals": [
    {
      "name": "Meal name",
      "description": "Brief description",
      "calories": 500,
      "protein_g": 35,
      "carbs_g": 50,
      "fat_g": 15,
      "meal_type": "dinner",
      "prep_time_mins": 20,
      "ingredients": ["ingredient 1", "ingredient 2"],
      "instructions": ["step 1", "step 2"],
      "tags": ["high-protein", "quick", "pre-run"]
    }
  ]
}`

  return prompt
}

