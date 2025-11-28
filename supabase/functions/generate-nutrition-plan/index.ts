import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Macro modifiers based on day type
const DAY_TYPE_MODIFIERS = {
  rest: { calories: 0.90, carbs: 0.80, protein: 1.00 },
  easy_run: { calories: 1.00, carbs: 1.00, protein: 1.00 },
  tempo: { calories: 1.10, carbs: 1.15, protein: 1.10 },
  intervals: { calories: 1.10, carbs: 1.15, protein: 1.10 },
  long_run: { calories: 1.20, carbs: 1.30, protein: 1.15 },
  race: { calories: 1.15, carbs: 1.40, protein: 1.00 },
  recovery: { calories: 1.05, carbs: 1.10, protein: 1.20 },
  strength: { calories: 1.10, carbs: 1.10, protein: 1.25 },
  cross_training: { calories: 1.05, carbs: 1.05, protein: 1.05 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Verify user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Invalid token')

    const { onboardingData, planWeeks = 12 } = await req.json()
    console.log('Generating nutrition plan for user:', user.id)

    // Get user's profile for physical data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Get active running plan for training integration
    const { data: runningPlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Get upcoming runs for the plan period
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + planWeeks * 7)

    const { data: upcomingRuns } = await supabase
      .from('runs')
      .select('scheduled_date, run_type')
      .eq('user_id', user.id)
      .gte('scheduled_date', startDate.toISOString().split('T')[0])
      .lte('scheduled_date', endDate.toISOString().split('T')[0])

    // Get strength sessions
    const { data: strengthSessions } = await supabase
      .from('strength_sessions')
      .select('scheduled_date, session_type')
      .eq('user_id', user.id)
      .gte('scheduled_date', startDate.toISOString().split('T')[0])
      .lte('scheduled_date', endDate.toISOString().split('T')[0])

    // Calculate base macros using AI
    const aiPrompt = buildAIPrompt(onboardingData, profile, runningPlan)
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a sports nutrition expert specializing in endurance athletes. 
Calculate optimal daily macro targets based on the user's profile and goals.
Return a JSON object with these fields:
- base_calories: number (daily calorie target)
- base_protein_g: number (grams of protein)
- base_carbs_g: number (grams of carbs)
- base_fat_g: number (grams of fat)
- base_fiber_g: number (grams of fiber, typically 25-35g)
- base_sodium_mg: number (mg of sodium, typically 2000-3000mg for athletes)
- base_hydration_ml: number (ml of water, typically 2500-4000ml)
- explanation: string (brief explanation of the calculations)`
          },
          { role: 'user', content: aiPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    const aiData = await openaiResponse.json()
    const baseMacros = JSON.parse(aiData.choices[0].message.content)
    console.log('AI calculated base macros:', baseMacros)

    // Create the nutrition plan
    const { data: nutritionPlan, error: planError } = await supabase
      .from('nutrition_plans')
      .insert({
        user_id: user.id,
        status: 'active',
        primary_goal: onboardingData.primary_goal,
        current_weight_kg: onboardingData.current_weight_kg,
        target_weight_kg: onboardingData.target_weight_kg,
        meals_per_day: onboardingData.meals_per_day,
        eating_window_start: onboardingData.eating_window_start,
        eating_window_end: onboardingData.eating_window_end,
        cooking_frequency: onboardingData.cooking_frequency,
        meal_prep_preference: onboardingData.meal_prep_preference,
        diet_type: onboardingData.diet_type,
        allergies: onboardingData.allergies || [],
        foods_to_avoid: onboardingData.foods_to_avoid,
        favorite_foods: onboardingData.favorite_foods,
        activity_level: onboardingData.activity_level,
        sleep_schedule_start: onboardingData.sleep_schedule_start,
        sleep_schedule_end: onboardingData.sleep_schedule_end,
        hydration_baseline_ml: onboardingData.hydration_baseline_ml,
        supplements: onboardingData.supplements || [],
        base_calories: baseMacros.base_calories,
        base_protein_g: baseMacros.base_protein_g,
        base_carbs_g: baseMacros.base_carbs_g,
        base_fat_g: baseMacros.base_fat_g,
        base_fiber_g: baseMacros.base_fiber_g,
        base_sodium_mg: baseMacros.base_sodium_mg,
        base_hydration_ml: baseMacros.base_hydration_ml,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      })
      .select()
      .single()

    if (planError) throw planError

    // Build daily targets for the plan period
    const dailyTargets = []
    const runMap = new Map(upcomingRuns?.map(r => [r.scheduled_date, r.run_type]) || [])
    const strengthMap = new Map(strengthSessions?.map(s => [s.scheduled_date, s.session_type]) || [])

    for (let i = 0; i < planWeeks * 7; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // Determine day type based on scheduled activities
      let dayType = 'rest'
      let trainingLoad = 'none'

      const runType = runMap.get(dateStr)
      const strengthType = strengthMap.get(dateStr)

      if (runType) {
        switch (runType) {
          case 'Long Run': dayType = 'long_run'; trainingLoad = 'very_high'; break
          case 'Tempo Run': dayType = 'tempo'; trainingLoad = 'high'; break
          case 'Quality Run':
          case 'Interval':
          case 'Fartlek': dayType = 'intervals'; trainingLoad = 'high'; break
          case 'Easy Run': dayType = 'easy_run'; trainingLoad = 'moderate'; break
          default: dayType = 'easy_run'; trainingLoad = 'low'
        }
      } else if (strengthType) {
        dayType = 'strength'
        trainingLoad = 'moderate'
      }

      const modifiers = DAY_TYPE_MODIFIERS[dayType] || DAY_TYPE_MODIFIERS.rest

      dailyTargets.push({
        nutrition_plan_id: nutritionPlan.id,
        user_id: user.id,
        target_date: dateStr,
        day_type: dayType,
        training_load: trainingLoad,
        target_calories: Math.round(baseMacros.base_calories * modifiers.calories),
        target_protein_g: Math.round(baseMacros.base_protein_g * modifiers.protein),
        target_carbs_g: Math.round(baseMacros.base_carbs_g * modifiers.carbs),
        target_fat_g: baseMacros.base_fat_g,
        target_fiber_g: baseMacros.base_fiber_g,
        target_sodium_mg: baseMacros.base_sodium_mg,
        target_hydration_ml: baseMacros.base_hydration_ml,
        calorie_modifier: modifiers.calories,
        carb_modifier: modifiers.carbs,
        protein_modifier: modifiers.protein,
      })
    }

    // Batch insert daily targets
    const { error: targetsError } = await supabase
      .from('daily_nutrition_targets')
      .insert(dailyTargets)

    if (targetsError) {
      console.error('Error inserting daily targets:', targetsError)
    }

    console.log(`Created nutrition plan with ${dailyTargets.length} daily targets`)

    return new Response(
      JSON.stringify({
        success: true,
        plan: nutritionPlan,
        dailyTargetsCount: dailyTargets.length,
        baseMacros,
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

function buildAIPrompt(onboardingData: any, profile: any, runningPlan: any): string {
  const weight = onboardingData.current_weight_kg || profile?.weight_kg || 70
  const height = profile?.height_cm || 170
  const age = profile?.age || 30
  const gender = profile?.gender || 'prefer_not_to_say'

  return `Calculate optimal daily nutrition targets for an endurance athlete:

**User Profile:**
- Weight: ${weight}kg
- Height: ${height}cm
- Age: ${age}
- Gender: ${gender}
- Activity Level (outside training): ${onboardingData.activity_level}

**Nutrition Goals:**
- Primary Goal: ${onboardingData.primary_goal}
${onboardingData.target_weight_kg ? `- Target Weight: ${onboardingData.target_weight_kg}kg` : ''}

**Diet Information:**
- Diet Type: ${onboardingData.diet_type}
- Meals Per Day: ${onboardingData.meals_per_day}
${onboardingData.allergies?.length > 0 ? `- Allergies: ${onboardingData.allergies.join(', ')}` : ''}

**Training Context:**
${runningPlan ? `- Has active running plan (${runningPlan.weeks} weeks)` : '- No active running plan'}
- Current Hydration Baseline: ${onboardingData.hydration_baseline_ml}ml

Calculate base macros for a MODERATE training day. The system will automatically adjust these based on daily training load.
Consider the endurance athlete's higher carbohydrate needs for glycogen replenishment.
Protein should support muscle recovery (typically 1.4-2.0g/kg for endurance athletes).

Return the JSON with base_calories, base_protein_g, base_carbs_g, base_fat_g, base_fiber_g, base_sodium_mg, base_hydration_ml, and explanation.`
}

