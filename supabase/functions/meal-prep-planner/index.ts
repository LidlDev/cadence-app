// Meal Prep Planner Edge Function
// Generates weekly meal prep plans with shopping lists

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

    const { weekStartDate, preferences } = await req.json()
    const startDate = weekStartDate || getNextSunday()

    // Get user's nutrition plan
    const { data: nutritionPlan } = await supabase
      .from('nutrition_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Get training schedule for the week
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    const { data: runs } = await supabase
      .from('runs')
      .select('scheduled_date, run_type, distance_km')
      .eq('user_id', user.id)
      .gte('scheduled_date', startDate)
      .lt('scheduled_date', endDate.toISOString().split('T')[0])

    // Get user's favorite recipes
    const { data: favoriteRecipes } = await supabase
      .from('user_recipes')
      .select('name, total_calories, total_protein_g, total_carbs_g')
      .eq('user_id', user.id)
      .eq('is_favorite', true)
      .limit(10)

    // Build AI prompt
    const prompt = buildMealPrepPrompt(
      nutritionPlan,
      runs || [],
      favoriteRecipes || [],
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
          { role: 'system', content: 'You are a meal prep expert for endurance athletes. Create practical, batch-cookable meal plans.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error('OpenAI API error')

    const aiData = await response.json()
    const mealPlan = JSON.parse(aiData.choices[0].message.content)

    return new Response(
      JSON.stringify({
        week_start: startDate,
        meal_plan: mealPlan.meals,
        shopping_list: mealPlan.shopping_list,
        prep_schedule: mealPlan.prep_schedule,
        storage_tips: mealPlan.storage_tips,
        estimated_cost: mealPlan.estimated_cost,
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

function getNextSunday(): string {
  const today = new Date()
  const daysUntilSunday = (7 - today.getDay()) % 7
  today.setDate(today.getDate() + daysUntilSunday)
  return today.toISOString().split('T')[0]
}

function buildMealPrepPrompt(
  nutritionPlan: any,
  runs: any[],
  favoriteRecipes: any[],
  preferences?: any
): string {
  let prompt = `Create a weekly meal prep plan for an endurance athlete.\n\n`

  prompt += `## Nutrition Targets:\n`
  prompt += `- Daily calories: ${nutritionPlan?.daily_calories || 2000}\n`
  prompt += `- Protein: ${nutritionPlan?.daily_protein_g || 150}g\n`
  prompt += `- Carbs: ${nutritionPlan?.daily_carbs_g || 250}g\n`
  prompt += `- Fat: ${nutritionPlan?.daily_fat_g || 70}g\n\n`

  if (nutritionPlan?.dietary_restrictions?.length) {
    prompt += `## Dietary Restrictions: ${nutritionPlan.dietary_restrictions.join(', ')}\n\n`
  }

  prompt += `## Training Schedule:\n`
  runs.forEach(run => {
    prompt += `- ${run.scheduled_date}: ${run.run_type} (${run.distance_km}km)\n`
  })

  if (favoriteRecipes.length > 0) {
    prompt += `\n## User's Favorite Recipes (incorporate if possible):\n`
    favoriteRecipes.forEach(r => {
      prompt += `- ${r.name}\n`
    })
  }

  if (preferences) {
    prompt += `\n## Preferences: ${JSON.stringify(preferences)}\n`
  }

  prompt += `\nGenerate a practical meal prep plan in JSON format:
{
  "meals": {
    "proteins": [
      { "name": "Grilled Chicken Breast", "quantity": "2 lbs", "prep_time": "30 min", "storage": "5 days fridge", "uses": ["lunch bowls", "dinner salads"] }
    ],
    "carbs": [
      { "name": "Brown Rice", "quantity": "4 cups cooked", "prep_time": "25 min", "storage": "5 days fridge", "uses": ["lunch bowls", "stir fry base"] }
    ],
    "vegetables": [
      { "name": "Roasted Vegetables", "quantity": "2 sheet pans", "prep_time": "40 min", "storage": "5 days fridge", "uses": ["side dishes", "bowl toppings"] }
    ],
    "snacks": [
      { "name": "Energy Balls", "quantity": "12 balls", "prep_time": "15 min", "storage": "1 week fridge", "uses": ["pre-run fuel", "afternoon snack"] }
    ]
  },
  "shopping_list": {
    "proteins": [{ "item": "Chicken breast", "quantity": "2 lbs", "estimated_cost": 12 }],
    "produce": [{ "item": "Broccoli", "quantity": "2 heads", "estimated_cost": 4 }],
    "grains": [{ "item": "Brown rice", "quantity": "2 cups dry", "estimated_cost": 3 }],
    "dairy": [{ "item": "Greek yogurt", "quantity": "32 oz", "estimated_cost": 6 }],
    "pantry": [{ "item": "Olive oil", "quantity": "if needed", "estimated_cost": 0 }]
  },
  "prep_schedule": {
    "sunday": [
      { "time": "10:00 AM", "task": "Start rice cooker", "duration": "5 min active" },
      { "time": "10:05 AM", "task": "Season and prep chicken", "duration": "10 min" },
      { "time": "10:15 AM", "task": "Chop vegetables for roasting", "duration": "15 min" }
    ]
  },
  "storage_tips": [
    "Store proteins and carbs separately",
    "Keep sauces in separate containers",
    "Freeze half the chicken if not using within 3 days"
  ],
  "estimated_cost": { "total": 65, "per_meal": 3.25 }
}`

  return prompt
}

